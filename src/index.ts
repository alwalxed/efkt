#!/usr/bin/env bun

import { stat } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { extractEffects } from './extract.ts';
import { formatJson } from './format/json.ts';
import { formatMarkdown } from './format/markdown.ts';
import { scanFiles } from './scan.ts';
import type {
  Effect,
  EffectGroup,
  EffectSubgroup,
  FormatOptions,
  GroupedEffects,
  HealthStatus,
  ScanResult,
} from './types.ts';
import { GROUP_KEYS, SUBGROUP_KEYS } from './types.ts';

const CATEGORY_DESCRIPTIONS: Record<EffectGroup, Record<EffectSubgroup, string>> = {
  untracked: {
    plain:
      'No dependency array, no cleanup. Reruns on every render. Highest risk of stale closures and infinite loops.',
    cleanup:
      'No dependency array, but returns a cleanup function. Still reruns every render; cleanup reduces leak risk.',
  },
  reactive: {
    plain: 'Runs when listed dependencies change. No cleanup, so subscriptions or timers may leak.',
    cleanup: 'Runs when dependencies change and cleans up before each re-run. Recommended pattern.',
  },
  once: {
    plain:
      'Empty dependency array, runs once on mount. No cleanup; fine for fire-and-forget fetches.',
    cleanup: 'Empty dependency array, runs once on mount and cleans up on unmount. Usually safe.',
  },
};

const USAGE = `Usage: efkt [path] [--json|--md] [--limit N] [--case <group.sub>] [--strip-comments]

Arguments:
  path               Directory or file to scan (default: ./)

Options:
  --json             Output as JSON
  --md               Output as Markdown
  --limit N          Truncate output to N effects
  --case <group.sub> Filter by sub-category
                       group: untracked | reactive | once
                       sub:   plain | cleanup
                       e.g.   --case reactive.plain
  --strip-comments   Strip comments from effect bodies
  --help             Show this help
  --version          Print version`;

function fatal(message: string): never {
  process.stderr.write(`efkt: ${message}\n`);
  process.exit(1);
}

async function readVersion(): Promise<string> {
  const pkgPath = resolve(import.meta.dir, '../package.json');
  const pkg = await Bun.file(pkgPath).json();
  return pkg.version as string;
}

interface CaseFilter {
  group: EffectGroup;
  subgroup: EffectSubgroup;
}

interface ParsedArgs {
  path: string;
  format: 'json' | 'md' | null;
  limit: number | null;
  help: boolean;
  version: boolean;
  stripComments: boolean;
  case: CaseFilter | null;
}

function parseArgs(argv: string[]): ParsedArgs {
  let path = './';
  let json = false;
  let md = false;
  let help = false;
  let version = false;
  let limit: number | null = null;
  let stripComments = false;
  let caseFilter: CaseFilter | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    switch (arg) {
      case '--json':
        json = true;
        break;
      case '--md':
        md = true;
        break;
      case '--help':
        help = true;
        break;
      case '--version':
        version = true;
        break;
      case '--strip-comments':
        stripComments = true;
        break;
      case '--limit': {
        const raw = argv[++i];
        if (raw === undefined) fatal('--limit requires a value');
        const n = Number(raw);
        if (!Number.isInteger(n) || n <= 0) fatal(`invalid --limit value: ${raw}`);
        limit = n;
        break;
      }
      case '--case': {
        const raw = argv[++i];
        if (raw === undefined) fatal('--case requires a value');
        const parts = raw.split('.');
        const group = parts[0];
        const subgroup = parts[1];
        if (
          parts.length !== 2 ||
          !GROUP_KEYS.includes(group as EffectGroup) ||
          !SUBGROUP_KEYS.includes(subgroup as EffectSubgroup)
        ) {
          fatal(`invalid --case value: ${raw}`);
        }
        caseFilter = { group: group as EffectGroup, subgroup: subgroup as EffectSubgroup };
        break;
      }
      default:
        if (!arg.startsWith('-')) path = arg;
    }
  }

  if (json && md) {
    fatal('cannot use both --json and --md');
  }

  return {
    path,
    format: json ? 'json' : md ? 'md' : null,
    limit,
    help,
    version,
    stripComments,
    case: caseFilter,
  };
}

async function promptFormat(): Promise<'json' | 'md'> {
  const options = ['Markdown', 'JSON'] as const;
  let selected = 0;

  function render(initial: boolean) {
    const lineCount = options.length + 1;
    if (!initial) {
      process.stderr.write(`\x1b[${lineCount}A`);
    }
    let out = `\x1b[2K? Output format: (Use arrow keys)\n`;
    for (let i = 0; i < options.length; i++) {
      const prefix = i === selected ? '\x1b[36m>\x1b[0m ' : '  ';
      out += `\x1b[2K${prefix}${options[i]}\n`;
    }
    process.stderr.write(out);
  }

  return new Promise<'json' | 'md'>((resolve, reject) => {
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    render(true);

    function cleanup() {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
    }

    function onData(data: Buffer) {
      const key = data.toString();

      if (key === '\x03') {
        cleanup();
        process.stderr.write('\n');
        process.exit(130);
      }

      if (key === '\x1b[A') {
        selected = selected > 0 ? selected - 1 : options.length - 1;
        render(false);
        return;
      }

      if (key === '\x1b[B') {
        selected = selected < options.length - 1 ? selected + 1 : 0;
        render(false);
        return;
      }

      if (key === '\r' || key === '\n') {
        cleanup();
        process.stderr.write('\n');
        resolve(selected === 0 ? 'md' : 'json');
        return;
      }
    }

    stdin.on('data', onData);
    stdin.once('error', (err) => {
      cleanup();
      reject(err);
    });
  });
}

function classifyEffect(effect: Effect): { group: EffectGroup; subgroup: EffectSubgroup } {
  const subgroup: EffectSubgroup = effect.hasCleanup ? 'cleanup' : 'plain';
  if (effect.deps === null) return { group: 'untracked', subgroup };
  if (effect.deps.length === 0) return { group: 'once', subgroup };
  return { group: 'reactive', subgroup };
}

function groupEffects(effects: Effect[]): GroupedEffects {
  const grouped: GroupedEffects = {
    untracked: { plain: [], cleanup: [] },
    reactive: { plain: [], cleanup: [] },
    once: { plain: [], cleanup: [] },
  };

  for (const effect of effects) {
    const { group, subgroup } = classifyEffect(effect);
    grouped[group][subgroup].push(effect);
  }

  return grouped;
}

function buildCommand(argv: string[]): string {
  return ['efkt', ...argv].join(' ');
}

function buildCategoryCounts(
  grouped: GroupedEffects
): Record<EffectGroup, Record<EffectSubgroup, number>> {
  return Object.fromEntries(
    GROUP_KEYS.map((g) => [
      g,
      Object.fromEntries(SUBGROUP_KEYS.map((s) => [s, grouped[g][s].length])),
    ])
  ) as Record<EffectGroup, Record<EffectSubgroup, number>>;
}

function deriveHealth(grouped: GroupedEffects): HealthStatus {
  if (grouped.untracked.plain.length > 0) return 'critical';
  if (
    grouped.untracked.cleanup.length > 0 ||
    grouped.reactive.plain.length > 0 ||
    grouped.once.plain.length > 0
  )
    return 'warning';
  return 'good';
}

function deriveHealthReason(grouped: GroupedEffects, health: HealthStatus): string {
  if (health === 'good') {
    return 'All effects use safe patterns (reactive.cleanup or once.cleanup) or no effects were found.';
  }
  if (health === 'critical') {
    const n = grouped.untracked.plain.length;
    return `${n} untracked.plain effect${n === 1 ? '' : 's'} found — reruns on every render with no cleanup.`;
  }
  const parts: string[] = [];
  if (grouped.untracked.cleanup.length > 0) {
    const n = grouped.untracked.cleanup.length;
    parts.push(`${n} untracked.cleanup effect${n === 1 ? '' : 's'}`);
  }
  if (grouped.reactive.plain.length > 0) {
    const n = grouped.reactive.plain.length;
    parts.push(`${n} reactive.plain effect${n === 1 ? '' : 's'}`);
  }
  if (grouped.once.plain.length > 0) {
    const n = grouped.once.plain.length;
    parts.push(`${n} once.plain effect${n === 1 ? '' : 's'}`);
  }
  return `${parts.join(' and ')} found.`;
}

async function main() {
  const rawArgv = process.argv.slice(2);
  const args = parseArgs(rawArgv);

  if (args.help) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }

  if (args.version) {
    process.stdout.write(`${await readVersion()}\n`);
    process.exit(0);
  }

  const resolvedPath = resolve(args.path);

  let statResult: Awaited<ReturnType<typeof stat>>;
  try {
    statResult = await stat(resolvedPath);
  } catch {
    fatal(`path does not exist: ${args.path}`);
  }

  const rootDir = statResult.isDirectory() ? resolvedPath : dirname(resolvedPath);

  let format = args.format;
  if (!format) {
    if (process.stdin.isTTY) {
      format = await promptFormat();
    } else {
      fatal('no output format specified (use --json or --md)');
    }
  }

  const files = await scanFiles(args.path);
  const uniqueFiles = [...new Set(files)];

  const displayPaths = new Map<string, string>();
  for (const file of uniqueFiles) {
    const rel = relative(rootDir, file) || '';
    const base = rel === '' ? file : rel;
    const normalized = base.replace(/^[\\/]+/, '');
    const display =
      normalized.startsWith('./') || normalized.startsWith('../') ? normalized : `./${normalized}`;
    displayPaths.set(file, display);
  }

  if (uniqueFiles.length === 0) {
    process.stderr.write('warning: no .js/.jsx/.ts/.tsx files found\n');
  }

  const allEffects: Effect[] = [];
  const errors: string[] = [];

  for (const file of uniqueFiles) {
    try {
      const displayPath = displayPaths.get(file) ?? file;
      const effects = await extractEffects(file, displayPath);
      allEffects.push(...effects);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const displayPath = displayPaths.get(file) ?? file;
      errors.push(`warning: failed to parse ${displayPath}: ${message}`);
    }
  }

  for (const warning of errors) {
    process.stderr.write(`${warning}\n`);
  }

  if (uniqueFiles.length > 0 && allEffects.length === 0 && errors.length === 0) {
    process.stderr.write('0 effects found.\n');
  }

  const grouped = groupEffects(allEffects);

  if (args.case !== null) {
    const { group: selGroup, subgroup: selSub } = args.case;
    for (const g of GROUP_KEYS) {
      for (const s of SUBGROUP_KEYS) {
        if (g !== selGroup || s !== selSub) grouped[g][s] = [];
      }
    }
  }

  if (args.limit !== null) {
    let remaining = args.limit;
    for (const g of GROUP_KEYS) {
      for (const s of SUBGROUP_KEYS) {
        if (remaining <= 0) {
          grouped[g][s] = [];
        } else {
          grouped[g][s] = grouped[g][s].slice(0, remaining);
          remaining -= grouped[g][s].length;
        }
      }
    }
  }

  const totalEffects = GROUP_KEYS.reduce(
    (sum, g) => sum + SUBGROUP_KEYS.reduce((s2, s) => s2 + grouped[g][s].length, 0),
    0
  );

  const health = deriveHealth(grouped);

  const result: ScanResult = {
    scannedAt: new Date().toISOString(),
    command: buildCommand(rawArgv),
    root: args.path,
    totalFiles: uniqueFiles.length,
    totalEffects,
    categoryCounts: buildCategoryCounts(grouped),
    categoryDescriptions: CATEGORY_DESCRIPTIONS,
    health,
    healthReason: deriveHealthReason(grouped, health),
    effects: grouped,
  };

  const formatOptions: FormatOptions = { stripComments: args.stripComments };

  process.stdout.write(
    format === 'json' ? formatJson(result, formatOptions) : formatMarkdown(result, formatOptions)
  );
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`efkt: unexpected error: ${message}\n`);
  process.exit(1);
});
