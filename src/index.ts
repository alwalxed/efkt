#!/usr/bin/env bun

import { stat } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { extractEffects } from './extract.ts';
import { formatJson } from './format/json.ts';
import { formatMarkdown } from './format/markdown.ts';
import { scanFiles } from './scan.ts';
import type { Effect, EffectCategory, FormatOptions, GroupedEffects, ScanResult } from './types.ts';
import { CATEGORY_KEYS } from './types.ts';

const USAGE = `Usage: efkt [path] [--json | --md] [--limit <number>] [--case <category>] [--strip-comments]

Arguments:
  path                  Directory or file to scan (default: ./)

Options:
  --json                Output as JSON
  --md                  Output as Markdown
  --limit <number>      Only output the first N effects
  --case <category>     Only output effects from one category
                        (noDeps_noCleanup | noDeps_withCleanup | deps_noCleanup |
                         deps_withCleanup | emptyDeps_noCleanup | emptyDeps_withCleanup)
  --strip-comments      Strip // and /* */ comments from effect bodies in output
  --help                Show this help message
  --version             Print version`;

function fatal(message: string): never {
  process.stderr.write(`efkt: ${message}\n`);
  process.exit(1);
}

async function readVersion(): Promise<string> {
  const pkgPath = resolve(import.meta.dir, '../package.json');
  const pkg = await Bun.file(pkgPath).json();
  return pkg.version as string;
}

interface ParsedArgs {
  path: string;
  format: 'json' | 'md' | null;
  limit: number | null;
  help: boolean;
  version: boolean;
  stripComments: boolean;
  case: EffectCategory | null;
}

function parseArgs(argv: string[]): ParsedArgs {
  let path = './';
  let json = false;
  let md = false;
  let help = false;
  let version = false;
  let limit: number | null = null;
  let stripComments = false;
  let caseFilter: EffectCategory | null = null;

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
        const valid: readonly string[] = CATEGORY_KEYS;
        if (!valid.includes(raw)) fatal(`invalid --case value: ${raw}`);
        caseFilter = raw as EffectCategory;
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

function classifyEffect(effect: Effect): EffectCategory {
  if (effect.deps === null) {
    return effect.hasCleanup ? 'noDeps_withCleanup' : 'noDeps_noCleanup';
  }
  if (effect.deps.length === 0) {
    return effect.hasCleanup ? 'emptyDeps_withCleanup' : 'emptyDeps_noCleanup';
  }
  return effect.hasCleanup ? 'deps_withCleanup' : 'deps_noCleanup';
}

function groupEffects(effects: Effect[]): GroupedEffects {
  const grouped: GroupedEffects = {
    noDeps_noCleanup: [],
    noDeps_withCleanup: [],
    deps_noCleanup: [],
    deps_withCleanup: [],
    emptyDeps_noCleanup: [],
    emptyDeps_withCleanup: [],
  };

  for (const effect of effects) {
    grouped[classifyEffect(effect)].push(effect);
  }

  return grouped;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

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

  const limitedEffects = args.limit !== null ? allEffects.slice(0, args.limit) : allEffects;

  const grouped = groupEffects(limitedEffects);

  if (args.case !== null) {
    const selected = args.case;
    for (const key of CATEGORY_KEYS) {
      if (key !== selected) grouped[key] = [];
    }
  }

  const totalEffects = CATEGORY_KEYS.reduce((sum, key) => sum + grouped[key].length, 0);

  const result: ScanResult = {
    scannedAt: new Date().toISOString(),
    root: args.path,
    totalFiles: uniqueFiles.length,
    totalEffects,
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
