import type { Effect, ScanResult } from '../types.ts';

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

  const allEffects: Effect[] = Object.values(result.effects).flat();
  const grouped = groupByFile(allEffects);

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

function groupByFile(effects: Effect[]): Map<string, Effect[]> {
  const map = new Map<string, Effect[]>();
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
