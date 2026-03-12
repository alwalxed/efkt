import { expect, test } from 'bun:test';
import { resetFixtureDir, runEfkt, writeFixtureFile } from './helpers.ts';

test('renamed imports are not matched', async () => {
  const dir = await resetFixtureDir('renamed-import');
  await writeFixtureFile(
    dir,
    'src/hooks/useRenamed.ts',
    `
import { useEffect as ue } from "react";

export function UseRenamed() {
  ue(() => {}, []);
}
`.trimStart()
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);

  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as { totalEffects: number };
  expect(parsed.totalEffects).toBe(0);
});

test('non-arrow callbacks and missing callback are skipped', async () => {
  const dir = await resetFixtureDir('non-arrow');
  await writeFixtureFile(
    dir,
    'src/hooks/useWeird.ts',
    `
import { useEffect } from "react";

export function UseWeird() {
  useEffect(function () {}, []);
  // @ts-expect-error intentionally malformed call
  useEffect();
}
`.trimStart()
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);

  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as { totalEffects: number };
  expect(parsed.totalEffects).toBe(0);
});
