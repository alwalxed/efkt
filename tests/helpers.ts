import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const fixturesRoot = join(import.meta.dir, 'fixtures');

export async function resetFixtureDir(name: string): Promise<string> {
  const dir = join(fixturesRoot, name);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function writeFixtureFile(
  baseDir: string,
  relPath: string,
  contents: string
): Promise<string> {
  const fullPath = join(baseDir, relPath);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, contents);
  return fullPath;
}

export async function runEfkt(args: string[], cwd?: string): Promise<RunResult> {
  const cliPath = join(fixturesRoot, '..', '..', 'src', 'index.ts');
  const proc = Bun.spawn(['bun', cliPath, ...args], {
    cwd: cwd ?? join(fixturesRoot, '..', '..'),
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    proc.stdout?.text() ?? Promise.resolve(''),
    proc.stderr?.text() ?? Promise.resolve(''),
    proc.exited,
  ]);

  return { stdout, stderr, exitCode };
}
