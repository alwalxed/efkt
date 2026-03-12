import { expect, test } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { resetFixtureDir, runEfkt, writeFixtureFile } from './helpers.ts';

test('root .gitignore excludes files', async () => {
  const dir = await resetFixtureDir('gitignore-root');
  await writeFixtureFile(
    dir,
    'src/components/Included.tsx',
    `
import { useEffect } from "react";

export function Included() {
  useEffect(() => {}, []);
}
`.trimStart()
  );
  await writeFixtureFile(
    dir,
    'src/components/Ignored.tsx',
    `
import { useEffect } from "react";

export function Ignored() {
  useEffect(() => {}, []);
}
`.trimStart()
  );

  await writeFile(join(dir, '.gitignore'), 'src/components/Ignored.tsx\n');

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);

  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    totalFiles: number;
    totalEffects: number;
    effects: Record<string, Array<{ file: string }>>;
  };

  expect(parsed.totalFiles).toBe(1);
  expect(parsed.totalEffects).toBe(1);
  expect(parsed.effects.emptyDeps_noCleanup[0].file).toBe('./src/components/Included.tsx');
});

test('nested .gitignore excludes files', async () => {
  const dir = await resetFixtureDir('gitignore-nested');
  await writeFixtureFile(
    dir,
    'src/components/Included.tsx',
    `
import { useEffect } from "react";

export function Included() {
  useEffect(() => {}, []);
}
`.trimStart()
  );
  await writeFixtureFile(
    dir,
    'src/ignored/Inner.tsx',
    `
import { useEffect } from "react";

export function Inner() {
  useEffect(() => {}, []);
}
`.trimStart()
  );

  await writeFile(join(dir, 'src/ignored/.gitignore'), 'Inner.tsx\n');

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);

  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    totalFiles: number;
    totalEffects: number;
    effects: Record<string, Array<{ file: string }>>;
  };

  expect(parsed.totalFiles).toBe(1);
  expect(parsed.totalEffects).toBe(1);
  expect(parsed.effects.emptyDeps_noCleanup[0].file).toBe('./src/components/Included.tsx');
});
