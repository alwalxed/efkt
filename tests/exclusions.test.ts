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

test('function expression callbacks are matched', async () => {
  const dir = await resetFixtureDir('function-expression');
  await writeFixtureFile(
    dir,
    'src/hooks/useFnExpr.ts',
    `
import { useEffect } from "react";

export function UseFnExpr() {
  useEffect(function () {
    console.log("hello");
  }, []);
}
`.trimStart()
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);

  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as { totalEffects: number };
  expect(parsed.totalEffects).toBe(1);
});

test('missing callback is skipped', async () => {
  const dir = await resetFixtureDir('missing-callback');
  await writeFixtureFile(
    dir,
    'src/hooks/useMissing.ts',
    `
import { useEffect } from "react";

export function UseMissing() {
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

test('React.useEffect namespaced call is matched', async () => {
  const dir = await resetFixtureDir('namespaced');
  await writeFixtureFile(
    dir,
    'src/hooks/useNamespaced.ts',
    `
import * as React from "react";

export function UseNamespaced() {
  React.useEffect(() => {
    console.log("namespaced");
  }, []);
}
`.trimStart()
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);

  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as { totalEffects: number };
  expect(parsed.totalEffects).toBe(1);
});