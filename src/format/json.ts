import type { Effect, FormatOptions, ScanResult } from '../types.ts';
import { CATEGORY_KEYS } from '../types.ts';

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

function stripEffectComments(effect: Effect): Effect {
  return {
    ...effect,
    raw: stripComments(effect.raw),
    body: stripComments(effect.body),
  };
}

export function formatJson(
  result: ScanResult,
  opts: FormatOptions = { stripComments: false }
): string {
  if (!opts.stripComments) {
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  const stripped = {
    ...result,
    effects: Object.fromEntries(
      CATEGORY_KEYS.map((key) => [key, result.effects[key].map(stripEffectComments)])
    ),
  };

  return `${JSON.stringify(stripped, null, 2)}\n`;
}
