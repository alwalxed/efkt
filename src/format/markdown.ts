import type { ScanResult } from '../types.ts';
import { CATEGORY_KEYS } from '../types.ts';

function dedent(code: string): string {
  const lines = code.split('\n');
  const minIndent = lines
    .filter((line) => line.trim().length > 0)
    .reduce((min, line) => {
      const match = line.match(/^(\s*)/);
      const indent = match?.[1]?.length ?? 0;
      return Math.min(min, indent);
    }, Infinity);

  if (minIndent === Infinity || minIndent === 0) return code;
  return lines.map((line) => line.slice(minIndent)).join('\n');
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
