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
    effects: Record<string, Record<string, Array<{ deps: string[] | null }>>>;
  };

  // [a, b] -> reactive.plain[0]
  expect(parsed.effects.reactive.plain[0].deps).toEqual(['a', 'b']);
  // [] -> once.plain[0]
  expect(parsed.effects.once.plain[0].deps).toEqual([]);
  // [a.b, fn()] -> reactive.plain[1]
  expect(parsed.effects.reactive.plain[1].deps).toEqual(['a.b', 'fn()']);
  // undefined as any -> null deps -> untracked.plain[0]
  expect(parsed.effects.untracked.plain[0].deps).toBeNull();
  // no dep arg -> null deps -> untracked.plain[1]
  expect(parsed.effects.untracked.plain[1].deps).toBeNull();
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
    effects: Record<string, Record<string, Array<{ hasCleanup: boolean }>>>;
  };

  // [url] + cleanup -> reactive.cleanup
  expect(parsed.effects.reactive.cleanup[0].hasCleanup).toBe(true);
  // [] + no cleanup -> once.plain
  expect(parsed.effects.once.plain[0].hasCleanup).toBe(false);
});
