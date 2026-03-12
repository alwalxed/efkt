export interface Effect {
  file: string;
  component: string | null;
  startLine: number;
  endLine: number;
  body: string;
  deps: string[] | null;
  hasCleanup: boolean;
}

export interface ScanResult {
  scannedAt: string;
  root: string;
  totalFiles: number;
  totalEffects: number;
  effects: Effect[];
}
