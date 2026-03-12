import { expect, test } from 'bun:test';
import { resetFixtureDir, runEfkt, writeFixtureFile } from './helpers.ts';

test('JSON output basic', async () => {
  const dir = await resetFixtureDir('happy-json');
  await writeFixtureFile(
    dir,
    'src/components/Auth.tsx',
    `
import { useEffect, useState } from "react";

export function AuthForm({ userId, token }: { userId: string; token: string }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser(userId);
    setLoading(false);
  }, [userId, token]);

  return <div>{loading ? "Loading..." : "Done"}</div>;
}
`.trimStart()
  );

  const { stdout, stderr, exitCode } = await runEfkt(['--json', '.'], dir);

  expect(exitCode).toBe(0);
  expect(stderr).toBe('');

  type EffectEntry = { file: string; component: string | null; deps: string[] | null; hasCleanup: boolean };
  const parsed = JSON.parse(stdout) as {
    totalFiles: number;
    totalEffects: number;
    effects: Record<string, EffectEntry[]>;
  };

  expect(parsed.totalFiles).toBe(1);
  expect(parsed.totalEffects).toBe(1);
  expect(parsed.effects.deps_noCleanup[0].file).toBe('./src/components/Auth.tsx');
  expect(parsed.effects.deps_noCleanup[0].component).toBe('AuthForm');
  expect(parsed.effects.deps_noCleanup[0].deps).toEqual(['userId', 'token']);
  expect(parsed.effects.deps_noCleanup[0].hasCleanup).toBe(false);
});

test('Markdown output basic', async () => {
  const dir = await resetFixtureDir('happy-md');
  await writeFixtureFile(
    dir,
    'src/components/Dashboard.tsx',
    `
import { useEffect } from "react";

const Dashboard = () => {
  useEffect(() => {
    document.title = "Dashboard";
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => console.log(e.key);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return <div>Dashboard</div>;
};

export default Dashboard;
`.trimStart()
  );

  const { stdout, stderr, exitCode } = await runEfkt(['--md', '.'], dir);

  expect(exitCode).toBe(0);
  expect(stderr).toBe('');

  expect(stdout).toContain('# useEffect Report');
  expect(stdout).toContain('| scannedAt |');
  expect(stdout).toContain('| totalFiles |');
  expect(stdout).toContain('| totalEffects |');
  expect(stdout).toContain('## emptyDeps_noCleanup');
  expect(stdout).toContain('## noDeps_withCleanup');
  expect(stdout).toContain('// ./src/components/Dashboard.tsx');
  expect(stdout).toContain('useEffect(');
  expect(stdout).toContain('```tsx');
});
