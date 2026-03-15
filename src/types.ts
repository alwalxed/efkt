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

export const GROUP_KEYS = ['untracked', 'reactive', 'once'] as const;
export type EffectGroup = (typeof GROUP_KEYS)[number];

export const SUBGROUP_KEYS = ['plain', 'cleanup'] as const;
export type EffectSubgroup = (typeof SUBGROUP_KEYS)[number];

export type GroupedEffects = Record<EffectGroup, Record<EffectSubgroup, Effect[]>>;

export type HealthStatus = 'good' | 'warning' | 'critical';

export interface ScanResult {
  scannedAt: string;
  root: string;
  totalFiles: number;
  totalEffects: number;
  categoryCounts: Record<EffectGroup, Record<EffectSubgroup, number>>;
  health: HealthStatus;
  effects: GroupedEffects;
}

export interface FormatOptions {
  stripComments: boolean;
}
