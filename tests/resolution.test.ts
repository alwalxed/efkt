import { expect, test } from 'bun:test';
import { resetFixtureDir, runEfkt, writeFixtureFile } from './helpers.ts';

test('single file scanning', async () => {
  const dir = await resetFixtureDir('single-file');
  const file = await writeFixtureFile(
    dir,
    'src/components/Auth.tsx',
    `
import { useEffect } from "react";

export function AuthForm() {
  useEffect(() => {
    doThing();
  }, []);
}
`.trimStart()
  );

  const rel = file.slice(dir.length + 1);
  const { stdout, exitCode } = await runEfkt(['--json', rel], dir);

  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    root: string;
    totalFiles: number;
    totalEffects: number;
    effects: Record<string, Array<unknown>>;
  };

  expect(parsed.root).toBe(rel);
  expect(parsed.totalFiles).toBe(1);
  expect(parsed.totalEffects).toBe(1);
});

test('component resolution cases', async () => {
  const dir = await resetFixtureDir('component-resolution');
  await writeFixtureFile(
    dir,
    'src/components/Components.tsx',
    `
import { useEffect } from "react";

export function Named() {
  useEffect(() => {}, []);
}

export const Arrow = () => {
  useEffect(() => {}, []);
};

useEffect(() => {}, []);
`.trimStart()
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);

  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    effects: Record<string, Record<string, Array<{ component: string | null }>>>;
  };

  const components = Object.values(parsed.effects)
    .flatMap((g) => Object.values(g).flat())
    .map((e) => e.component);
  expect(components).toContain('Named');
  expect(components).toContain('Arrow');
  expect(components).toContain(null);
});
