import type {
  EffectGroup,
  EffectSubgroup,
  FormatOptions,
  HealthStatus,
  ScanResult,
} from '../types.ts';
import { GROUP_KEYS, SUBGROUP_KEYS } from '../types.ts';

const HEALTH_LABEL: Record<HealthStatus, string> = {
  good: '🟢 Good',
  warning: '🟡 Warning',
  critical: '🔴 Critical',
};

const RISK_LABEL: Record<EffectGroup, Record<EffectSubgroup, string>> = {
  untracked: { plain: '🔴 High', cleanup: '🟠 Medium' },
  reactive: { plain: '🟡 Medium', cleanup: '🟢 Low' },
  once: { plain: '🟡 Low', cleanup: '🟢 Low' },
};

const LEGEND_LINES: string[] = [
  '- **untracked.plain**: no deps, no cleanup -> runs every render (highest risk)',
  '- **untracked.cleanup**: no deps, cleanup present -> still runs every render',
  '- **reactive.plain**: runs on dep changes, no cleanup -> subscriptions may leak',
  '- **reactive.cleanup**: runs on dep changes with cleanup (recommended)',
  '- **once.plain**: runs once on mount, no cleanup',
  '- **once.cleanup**: runs once, cleans up on unmount (safest)',
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function gcd(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y) {
    const r = x % y;
    x = y;
    y = r;
  }
  return x;
}

function dedent(code: string): string {
  const lines = code.split('\n');
  if (lines.length <= 1) return code;

  const tail = lines.slice(1);
  const tailNonEmpty = tail.filter((l) => l.trim().length > 0);
  const minIndent =
    tailNonEmpty.length > 0
      ? Math.min(...tailNonEmpty.map((l) => l.match(/^(\s*)/)?.[1]?.length ?? 0))
      : 0;

  if (minIndent > 0) {
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;
      lines[i] = line.slice(minIndent);
    }
  }

  const nonZero = lines
    .slice(1)
    .filter((l) => l.trim().length > 0)
    .map((l) => l.match(/^(\s*)/)?.[1]?.length ?? 0)
    .filter((n) => n > 0);

  if (nonZero.length > 0) {
    const unit = nonZero.reduce(gcd);
    if (unit > 2) {
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line === undefined) continue;
        const m = line.match(/^(\s*)(.*)/s);
        if (!m) continue;
        const depth = (m[1]?.length ?? 0) / unit;
        lines[i] = '  '.repeat(depth) + (m[2] ?? '');
      }
    }
  }

  return lines.join('\n');
}

function stripComments(code: string): string {
  let result = code.replace(/\/\*[\s\S]*?\*\//g, '');
  result = result.replace(/\/\/[^\n]*/g, '');
  result = result
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : line))
    .join('\n');
  result = result.replace(/\n{3,}/g, '\n\n');
  return result.trim();
}

export function formatMarkdown(
  result: ScanResult,
  opts: FormatOptions = { stripComments: false }
): string {
  const lines: string[] = [
    `# efkt results: ${result.root}`,
    '',
    `> \`${result.command}\` · ${formatDate(result.scannedAt)} · ${result.totalFiles} files · ${result.totalEffects} effects`,
    '',
    `Health: ${HEALTH_LABEL[result.health]} · ${result.healthReason}`,
    '',
    '---',
    '',
    '## Distribution',
    '',
    '| Category | Count | Risk |',
    '|---|---:|---|',
    ...GROUP_KEYS.flatMap((g) =>
      SUBGROUP_KEYS.map(
        (s) => `| ${g}.${s} | ${result.categoryCounts[g][s]} | ${RISK_LABEL[g][s]} |`
      )
    ),
    `| **Total** | **${result.totalEffects}** | |`,
    '',
    '---',
    '',
    '## Legend',
    '',
    ...LEGEND_LINES,
    '',
    '---',
  ];

  let groupIdx = 0;

  for (const group of GROUP_KEYS) {
    const subgroups = result.effects[group];
    const groupHasEffects = SUBGROUP_KEYS.some((s) => subgroups[s].length > 0);
    if (!groupHasEffects) continue;

    groupIdx++;
    lines.push('', `## ${groupIdx}. ${group}`);

    let subIdx = 0;

    for (const sub of SUBGROUP_KEYS) {
      const effects = subgroups[sub];
      if (effects.length === 0) continue;

      subIdx++;
      lines.push('', `### ${groupIdx}.${subIdx} ${sub}`);

      for (let i = 0; i < effects.length; i++) {
        const effect = effects[i];
        if (!effect) continue;
        const raw = opts.stripComments ? stripComments(dedent(effect.raw)) : dedent(effect.raw);
        lines.push(
          '',
          `#### ${groupIdx}.${subIdx}.${i + 1} ${effect.file}`,
          '',
          '```tsx',
          raw,
          '```'
        );
      }
    }
  }

  return lines.join('\n');
}
