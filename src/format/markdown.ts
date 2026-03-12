import type { ScanResult } from '../types.ts';
import { CATEGORY_KEYS } from '../types.ts';

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

    lines.push('', `## ${key}`, '');

    for (const effect of effects) {
      const name = effect.component ?? '(anonymous)';
      lines.push(
        `**\`${name}\`** in \`${effect.file}\` (lines ${effect.startLine}–${effect.endLine})`
      );

      if (effect.body) {
        lines.push('', '```tsx', effect.body, '```', '');
      } else {
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}
