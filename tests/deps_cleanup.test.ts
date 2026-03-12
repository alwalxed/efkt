import { expect, test } from 'bun:test';
import { resetFixtureDir, runEfkt, writeFixtureFile } from './helpers.ts';

test('deps matrix', async () => {
  const dir = await resetFixtureDir('deps-matrix');
  await writeFixtureFile(
    dir,
    'src/hooks/useDeps.ts',
    `
import { useEffect } from "react";

export function UseDeps(a: any, b: any) {
  useEffect(() => {}, [a, b]);
  useEffect(() => {}, []);
  useEffect(() => {}, [a.b, fn()]);
  useEffect(() => {}, undefined as any);
  useEffect(() => {});
}
`.trimStart()
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);

  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    effects: Array<{ deps: string[] | null }>;
  };

  expect(parsed.effects[0].deps).toEqual(['a', 'b']);
  expect(parsed.effects[1].deps).toEqual([]);
  expect(parsed.effects[2].deps).toEqual(['a.b', 'fn()']);
  expect(parsed.effects[3].deps).toBeNull();
  expect(parsed.effects[4].deps).toBeNull();
});

test('hasCleanup detection', async () => {
  const dir = await resetFixtureDir('cleanup');
  await writeFixtureFile(
    dir,
    'src/hooks/useCleanup.ts',
    `
import { useEffect } from "react";

export function UseCleanup(url: string) {
  useEffect(() => {
    const socket = connect(url);
    return () => socket.close();
  }, [url]);

  useEffect(() => {
    console.log("no cleanup");
  }, []);
}
`.trimStart()
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);

  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    effects: Array<{ hasCleanup: boolean }>;
  };

  const flags = parsed.effects.map((e) => e.hasCleanup);
  expect(flags).toEqual([true, false]);
});
