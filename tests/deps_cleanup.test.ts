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
    effects: Record<string, Array<{ deps: string[] | null }>>;
  };

  // [a, b] -> deps_noCleanup[0]
  expect(parsed.effects.deps_noCleanup[0].deps).toEqual(['a', 'b']);
  // [] -> emptyDeps_noCleanup[0]
  expect(parsed.effects.emptyDeps_noCleanup[0].deps).toEqual([]);
  // [a.b, fn()] -> deps_noCleanup[1]
  expect(parsed.effects.deps_noCleanup[1].deps).toEqual(['a.b', 'fn()']);
  // undefined as any -> null deps -> noDeps_noCleanup[0]
  expect(parsed.effects.noDeps_noCleanup[0].deps).toBeNull();
  // no dep arg -> null deps -> noDeps_noCleanup[1]
  expect(parsed.effects.noDeps_noCleanup[1].deps).toBeNull();
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
    effects: Record<string, Array<{ hasCleanup: boolean }>>;
  };

  // [url] + cleanup -> deps_withCleanup
  expect(parsed.effects.deps_withCleanup[0].hasCleanup).toBe(true);
  // [] + no cleanup -> emptyDeps_noCleanup
  expect(parsed.effects.emptyDeps_noCleanup[0].hasCleanup).toBe(false);
});
