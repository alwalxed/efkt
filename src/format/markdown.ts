import type { ScanResult } from '../types.ts';
import { CATEGORY_KEYS } from '../types.ts';

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

  // The raw slice always starts at the `u` of `useEffect` (column 0 in the
  // raw string), but lines after the first retain their original absolute
  // column positions from the source file. Normalise only lines[1:] so we
  // compute relative indentation correctly.
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

  // Detect indent unit via GCD of all non-zero relative indents in the tail
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

export function formatMarkdown(result: ScanResult): string {
  const lines: string[] = [
    '# useEffect Report',
    '',
    '| Field | Value |',
    '|---|---|',
    `| scannedAt | ${result.scannedAt} |`,
    `| root | ${result.root} |`,
    `| totalFiles | ${result.totalFiles} |`,
    `| totalEffects | ${result.totalEffects} |`,
    '',
    '---',
  ];

  for (const key of CATEGORY_KEYS) {
    const effects = result.effects[key];
    if (!effects || effects.length === 0) continue;

    lines.push('', `## ${key}`);

    for (const effect of effects) {
      lines.push('', `### ${effect.file}`, '', '```tsx', dedent(effect.raw), '```');
    }
  }

  return lines.join('\n');
}
