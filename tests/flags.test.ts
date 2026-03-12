import { expect, test } from 'bun:test';
import { resetFixtureDir, runEfkt, writeFixtureFile } from './helpers.ts';

const FIXTURE_SOURCE = `
import { useEffect } from "react";

export function MyComp(id: string) {
  // Fetch on mount
  useEffect(() => {
    /* block comment */
    fetchData(id); // inline comment
  }, [id]);

  useEffect(() => {
    console.log("no deps");
  });
}
`.trimStart();

test('--strip-comments removes // and /* */ from Markdown code blocks', async () => {
  const dir = await resetFixtureDir('strip-comments-md');
  await writeFixtureFile(dir, 'src/MyComp.tsx', FIXTURE_SOURCE);

  const { stdout, stderr, exitCode } = await runEfkt(['--md', '--strip-comments', '.'], dir);

  expect(exitCode).toBe(0);
  expect(stderr).toBe('');

  // Comments must be absent from the output code blocks
  expect(stdout).not.toContain('// Fetch on mount');
  expect(stdout).not.toContain('/* block comment */');
  expect(stdout).not.toContain('// inline comment');

  // Code itself must still be present
  expect(stdout).toContain('fetchData(id)');
  expect(stdout).toContain('console.log');
});

test('--strip-comments removes // and /* */ from JSON raw and body fields', async () => {
  const dir = await resetFixtureDir('strip-comments-json');
  await writeFixtureFile(dir, 'src/MyComp.tsx', FIXTURE_SOURCE);

  const { stdout, exitCode } = await runEfkt(['--json', '--strip-comments', '.'], dir);

  expect(exitCode).toBe(0);

  const parsed = JSON.parse(stdout) as {
    effects: Record<string, Array<{ raw: string; body: string }>>;
  };

  const depsEffect = parsed.effects.deps_noCleanup?.[0];
  expect(depsEffect).toBeDefined();
  expect(depsEffect?.raw).not.toContain('// Fetch on mount');
  expect(depsEffect?.raw).not.toContain('/* block comment */');
  expect(depsEffect?.raw).not.toContain('// inline comment');
  expect(depsEffect?.raw).toContain('fetchData(id)');

  const noDepsEffect = parsed.effects.noDeps_noCleanup?.[0];
  expect(noDepsEffect).toBeDefined();
  expect(noDepsEffect?.raw).toContain('console.log');
});

test('--case filters output to only the specified category', async () => {
  const dir = await resetFixtureDir('case-filter');
  await writeFixtureFile(dir, 'src/MyComp.tsx', FIXTURE_SOURCE);

  const { stdout, exitCode } = await runEfkt(['--json', '--case', 'deps_noCleanup', '.'], dir);

  expect(exitCode).toBe(0);

  const parsed = JSON.parse(stdout) as {
    totalEffects: number;
    effects: Record<string, unknown[]>;
  };

  expect(parsed.totalEffects).toBe(1);
  expect(parsed.effects.deps_noCleanup).toHaveLength(1);
  expect(parsed.effects.noDeps_noCleanup).toHaveLength(0);
});

test('--case filters Markdown to only show the specified section', async () => {
  const dir = await resetFixtureDir('case-filter-md');
  await writeFixtureFile(dir, 'src/MyComp.tsx', FIXTURE_SOURCE);

  const { stdout, exitCode } = await runEfkt(['--md', '--case', 'noDeps_noCleanup', '.'], dir);

  expect(exitCode).toBe(0);

  expect(stdout).toContain('## 1. noDeps_noCleanup');
  expect(stdout).not.toContain('deps_noCleanup');
  // Hierarchical numbering for the single effect
  expect(stdout).toContain('### 1.1 ./src/MyComp.tsx');
});

test('--case with an invalid category name exits 1 with an error', async () => {
  const { stdout, stderr, exitCode } = await runEfkt(['--json', '--case', 'invalid_category', '.']);

  expect(exitCode).toBe(1);
  expect(stdout).toBe('');
  expect(stderr).toContain('invalid --case value: invalid_category');
});

test('--case combined with --strip-comments applies both', async () => {
  const dir = await resetFixtureDir('case-strip-combined');
  await writeFixtureFile(dir, 'src/MyComp.tsx', FIXTURE_SOURCE);

  const { stdout, exitCode } = await runEfkt(
    ['--json', '--case', 'deps_noCleanup', '--strip-comments', '.'],
    dir
  );

  expect(exitCode).toBe(0);

  const parsed = JSON.parse(stdout) as {
    totalEffects: number;
    effects: Record<string, Array<{ raw: string }>>;
  };

  expect(parsed.totalEffects).toBe(1);

  const effect = parsed.effects.deps_noCleanup?.[0];
  expect(effect).toBeDefined();
  expect(effect?.raw).not.toContain('// Fetch on mount');
  expect(effect?.raw).not.toContain('/* block comment */');
  expect(effect?.raw).toContain('fetchData(id)');
});
