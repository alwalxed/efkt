import { expect, test } from 'bun:test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { resetFixtureDir, runEfkt, writeFixtureFile } from './helpers.ts';

test('path does not exist', async () => {
  const { stdout, stderr, exitCode } = await runEfkt(['--json', 'nonexistent-path']);

  expect(exitCode).toBe(1);
  expect(stdout).toBe('');
  expect(stderr).toContain('path does not exist');
});

test('both --json and --md passed', async () => {
  const { stdout, stderr, exitCode } = await runEfkt(['--json', '--md']);

  expect(exitCode).toBe(1);
  expect(stdout).toBe('');
  expect(stderr).toContain('cannot use both --json and --md');
});

test('non-TTY stdin without format flag', async () => {
  const proc = Bun.spawn(['bun', 'src/index.ts'], {
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  });
  proc.stdin?.write('data');
  proc.stdin?.end();

  const [stdout, stderr, exitCode] = await Promise.all([
    proc.stdout?.text() ?? Promise.resolve(''),
    proc.stderr?.text() ?? Promise.resolve(''),
    proc.exited,
  ]);

  expect(exitCode).toBe(1);
  expect(stdout).toBe('');
  expect(stderr).toContain('no output format specified');
});

test('parse error is non-fatal', async () => {
  const dir = await resetFixtureDir('parse-error');
  await writeFixtureFile(
    dir,
    'src/components/Good.tsx',
    `
import { useEffect } from "react";

export function Good() {
  useEffect(() => {}, []);
}
`.trimStart()
  );
  await writeFixtureFile(
    dir,
    'src/components/Broken.tsx',
    `
import { useEffect } from "react";

export function Broken() {
  useEffect(() => {
    // missing closing braces
`.trimStart()
  );

  const { stdout, stderr, exitCode } = await runEfkt(['--json', '.'], dir);

  expect(exitCode).toBe(0);
  expect(stderr).toContain('could not parse ./src/components/Broken.tsx');

  const parsed = JSON.parse(stdout) as { totalEffects: number };
  expect(parsed.totalEffects).toBe(1);
});

test('no matching files found', async () => {
  const dir = await resetFixtureDir('empty-dir');
  const { stdout, stderr, exitCode } = await runEfkt(['--json', '.'], dir);

  expect(exitCode).toBe(0);
  expect(stderr).toContain('no .js/.jsx/.ts/.tsx files found');

  const parsed = JSON.parse(stdout) as {
    totalFiles: number;
    totalEffects: number;
  };
  expect(parsed.totalFiles).toBe(0);
  expect(parsed.totalEffects).toBe(0);
});

test('no effects found when files exist', async () => {
  const dir = await resetFixtureDir('no-effects');
  await writeFixtureFile(
    dir,
    'src/utils/math.ts',
    `
export function add(a: number, b: number): number {
  return a + b;
}
`.trimStart()
  );

  const { stdout, stderr, exitCode } = await runEfkt(['--json', '.'], dir);

  expect(exitCode).toBe(0);
  expect(stderr.trim()).toBe('0 effects found.');

  const parsed = JSON.parse(stdout) as {
    totalFiles: number;
    totalEffects: number;
  };
  expect(parsed.totalFiles).toBe(1);
  expect(parsed.totalEffects).toBe(0);
});

test('scanning empty directory warns and exits 0', async () => {
  const dir = await resetFixtureDir('unreadable');
  await writeFixtureFile(
    dir,
    'src/components/Good.tsx',
    `
import { useEffect } from "react";

export function Good() {
  useEffect(() => {}, []);
}
`.trimStart()
  );

  const unreadableDir = join(dir, 'unreadable');
  await mkdir(unreadableDir, { recursive: true });

  const { stdout, stderr, exitCode } = await runEfkt(['--json', join(dir, 'unreadable')]);

  expect(exitCode).toBe(0);
  expect(stderr).toContain('no .js/.jsx/.ts/.tsx files found');
  const parsed = JSON.parse(stdout) as { totalFiles: number; totalEffects: number };
  expect(parsed.totalFiles).toBe(0);
  expect(parsed.totalEffects).toBe(0);
});
