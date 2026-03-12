import type { ScanResult } from '../types.ts';

export function formatMarkdown(result: ScanResult): string {
  const date = result.scannedAt.split('T')[0];
  const lines: string[] = [
    '# useEffect Report',
    '',
    `**Scanned:** ${result.root}  `,
    `**Files:** ${result.totalFiles}  `,
    `**Effects found:** ${result.totalEffects}  `,
    `**Date:** ${date}`,
  ];

  const grouped = groupByFile(result.effects);

  for (const [file, effects] of grouped) {
    lines.push('', '---', '', `## ${file}`);

    for (const effect of effects) {
      const name = effect.component ?? '(anonymous)';
      lines.push('', `### ${name} (line ${effect.startLine}\u2013${effect.endLine})`, '');

      if (effect.deps === null) {
        lines.push('deps: (none provided)  ');
      } else if (effect.deps.length === 0) {
        lines.push('deps: none  ');
      } else {
        const formatted = effect.deps.map((d) => `\`${d}\``).join(', ');
        lines.push(`deps: ${formatted}  `);
      }

      lines.push(`cleanup: ${effect.hasCleanup ? 'yes' : 'no'}`);

      if (effect.body) {
        lines.push('', '```tsx', effect.body, '```');
      }
    }
  }

  lines.push('', '---', '');
  return lines.join('\n');
}

function groupByFile(effects: ScanResult['effects']): Map<string, ScanResult['effects']> {
  const map = new Map<string, ScanResult['effects']>();
  for (const effect of effects) {
    const existing = map.get(effect.file);
    if (existing) {
      existing.push(effect);
    } else {
      map.set(effect.file, [effect]);
    }
  }
  return map;
}
