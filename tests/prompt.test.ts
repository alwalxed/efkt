import { expect, test } from 'bun:test';
import { resetFixtureDir, runEfkt, writeFixtureFile } from './helpers.ts';

test('no prompt text when format flag is provided', async () => {
  const dir = await resetFixtureDir('prompt-json-flag');
  await writeFixtureFile(
    dir,
    'src/components/Auth.tsx',
    `
import { useEffect } from "react";

export function AuthForm() {
  useEffect(() => {}, []);
}
`.trimStart()
  );

  const { stderr } = await runEfkt(['--json', '.'], dir);
  expect(stderr).not.toContain('Output format');
});
