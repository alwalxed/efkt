export interface Effect {
  file: string;
  component: string | null;
  startLine: number;
  endLine: number;
  body: string;
  raw: string;
  deps: string[] | null;
  hasCleanup: boolean;
}

export const CATEGORY_KEYS = [
  'noDeps_noCleanup',
  'noDeps_withCleanup',
  'deps_noCleanup',
  'deps_withCleanup',
  'emptyDeps_noCleanup',
  'emptyDeps_withCleanup',
] as const;

export type EffectCategory = (typeof CATEGORY_KEYS)[number];

export type GroupedEffects = Record<EffectCategory, Effect[]>;

export interface ScanResult {
  scannedAt: string;
  root: string;
  totalFiles: number;
  totalEffects: number;
  effects: GroupedEffects;
}
