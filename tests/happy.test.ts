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
    effects: Record<string, Record<string, EffectEntry[]>>;
  };

  expect(parsed.totalFiles).toBe(1);
  expect(parsed.totalEffects).toBe(1);
  expect(parsed.effects.reactive.plain[0].file).toBe('./src/components/Auth.tsx');
  expect(parsed.effects.reactive.plain[0].component).toBe('AuthForm');
  expect(parsed.effects.reactive.plain[0].deps).toEqual(['userId', 'token']);
  expect(parsed.effects.reactive.plain[0].hasCleanup).toBe(false);
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
  expect(stdout).toContain('| Scanned At |');
  expect(stdout).toContain('| Command |');
  expect(stdout).toContain('| Total Files |');
  expect(stdout).toContain('| Total Effects |');
  expect(stdout).toContain('| Health |');
  expect(stdout).toContain('| Health Reason |');
  // untracked (no dep array, with cleanup) is group 1; once (empty deps, no cleanup) is group 2
  expect(stdout).toContain('## 1. untracked');
  expect(stdout).toContain('### 1.1 cleanup');
  expect(stdout).toContain('#### 1.1.1 ./src/components/Dashboard.tsx');
  expect(stdout).toContain('## 2. once');
  expect(stdout).toContain('### 2.1 plain');
  expect(stdout).toContain('#### 2.1.1 ./src/components/Dashboard.tsx');
  expect(stdout).toContain('useEffect(');
  expect(stdout).toContain('```tsx');

  // Code blocks must be dedented: no leading whitespace on the useEffect line
  expect(stdout).toContain('```tsx\nuseEffect(');
});

test('Markdown output normalizes 4-space indent to 2-space', async () => {
  const dir = await resetFixtureDir('happy-md');
  await writeFixtureFile(
    dir,
    'src/components/Dashboard.tsx',
    `
import { useEffect } from "react";

const Dashboard = () => {
    useEffect(() => {
        document.title = "Dashboard";
        if (true) {
            console.log("nested");
        }
    }, []);

    return <div>Dashboard</div>;
};

export default Dashboard;
`.trimStart()
  );

  const { stdout, stderr, exitCode } = await runEfkt(['--md', '.'], dir);

  expect(exitCode).toBe(0);
  expect(stderr).toBe('');

  // useEffect starts at column 0
  expect(stdout).toContain('```tsx\nuseEffect(');
  // first-level body is 2 spaces
  expect(stdout).toContain('\n  document.title = "Dashboard";\n');
  // doubly-nested block is 4 spaces (2 levels × 2)
  expect(stdout).toContain('\n    console.log("nested");\n');
  // closing }, []) is at column 0 (same indent level as useEffect).
  // Note: raw is sliced from the CallExpression node, which ends at `)`, not `;`.
  expect(stdout).toContain('\n}, [])\n```');
});
