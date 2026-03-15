import { expect, test } from 'bun:test';
import { resetFixtureDir, runEfkt, writeFixtureFile } from './helpers.ts';

// ─── ARG PARSING ─────────────────────────────────────────────────────────────

test('--help prints usage and exits 0', async () => {
  const { stdout, stderr, exitCode } = await runEfkt(['--help']);
  expect(exitCode).toBe(0);
  expect(stderr).toBe('');
  expect(stdout).toContain('Usage: efkt');
  expect(stdout).toContain('--json');
  expect(stdout).toContain('--md');
  expect(stdout).toContain('--limit');
  expect(stdout).toContain('--case');
  expect(stdout).toContain('--strip-comments');
});

test('--version prints a semver string and exits 0', async () => {
  const { stdout, stderr, exitCode } = await runEfkt(['--version']);
  expect(exitCode).toBe(0);
  expect(stderr).toBe('');
  expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
});

test('--limit 0 is rejected', async () => {
  const { stdout, stderr, exitCode } = await runEfkt(['--json', '--limit', '0', '.']);
  expect(exitCode).toBe(1);
  expect(stdout).toBe('');
  expect(stderr).toContain('invalid --limit value: 0');
});

test('--limit -1 is rejected', async () => {
  const { stdout, stderr, exitCode } = await runEfkt(['--json', '--limit', '-1', '.']);
  expect(exitCode).toBe(1);
  expect(stdout).toBe('');
  expect(stderr).toContain('invalid --limit value: -1');
});

test('--limit 2.5 (non-integer) is rejected', async () => {
  const { stdout, stderr, exitCode } = await runEfkt(['--json', '--limit', '2.5', '.']);
  expect(exitCode).toBe(1);
  expect(stdout).toBe('');
  expect(stderr).toContain('invalid --limit value: 2.5');
});

test('--limit abc (non-numeric) is rejected', async () => {
  const { stdout, stderr, exitCode } = await runEfkt(['--json', '--limit', 'abc', '.']);
  expect(exitCode).toBe(1);
  expect(stdout).toBe('');
  expect(stderr).toContain('invalid --limit value: abc');
});

test('--limit with no following value is rejected', async () => {
  const { stdout, stderr, exitCode } = await runEfkt(['--json', '--limit']);
  expect(exitCode).toBe(1);
  expect(stdout).toBe('');
  expect(stderr).toContain('--limit requires a value');
});

test('--case with no following value is rejected', async () => {
  const { stdout, stderr, exitCode } = await runEfkt(['--json', '--case']);
  expect(exitCode).toBe(1);
  expect(stdout).toBe('');
  expect(stderr).toContain('--case requires a value');
});

test('--case with group only (no dot separator) is rejected', async () => {
  const { stdout, stderr, exitCode } = await runEfkt(['--json', '--case', 'reactive', '.']);
  expect(exitCode).toBe(1);
  expect(stdout).toBe('');
  expect(stderr).toContain('invalid --case value: reactive');
});

test('--case with three dot-separated parts is rejected', async () => {
  const { stdout, stderr, exitCode } = await runEfkt([
    '--json',
    '--case',
    'reactive.plain.extra',
    '.',
  ]);
  expect(exitCode).toBe(1);
  expect(stdout).toBe('');
  expect(stderr).toContain('invalid --case value: reactive.plain.extra');
});

// ─── DETERMINISM ─────────────────────────────────────────────────────────────

test('output is deterministic across two runs (excluding scannedAt)', async () => {
  const dir = await resetFixtureDir('determinism');
  await writeFixtureFile(
    dir,
    'src/App.tsx',
    `import { useEffect } from "react";
export function App({ id }: { id: string }) {
  useEffect(() => { fetchData(id); }, [id]);
  useEffect(() => { document.title = "App"; }, []);
  useEffect(() => { console.log("mount"); });
}
`,
  );

  const run1 = await runEfkt(['--json', '.'], dir);
  const run2 = await runEfkt(['--json', '.'], dir);
  expect(run1.exitCode).toBe(0);
  expect(run2.exitCode).toBe(0);

  const p1 = JSON.parse(run1.stdout) as Record<string, unknown>;
  const p2 = JSON.parse(run2.stdout) as Record<string, unknown>;
  delete p1.scannedAt;
  delete p2.scannedAt;
  expect(p1).toEqual(p2);
});

test('files appear in stable alphabetical order regardless of creation order', async () => {
  const dir = await resetFixtureDir('file-ordering');
  for (const name of ['z_last', 'a_first', 'm_middle']) {
    await writeFixtureFile(
      dir,
      `src/${name}.tsx`,
      `import { useEffect } from "react";
export function Comp() { useEffect(() => {}, []); }
`,
    );
  }

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);

  const parsed = JSON.parse(stdout) as {
    effects: Record<string, Record<string, Array<{ file: string }>>>;
  };
  const files = parsed.effects.once.plain.map((e) => e.file);
  expect(files).toHaveLength(3);
  expect(files).toEqual([...files].sort());
  expect(files[0]).toContain('a_first');
  expect(files[2]).toContain('z_last');
});

test('effects within a file preserve source order', async () => {
  const dir = await resetFixtureDir('source-order');
  await writeFixtureFile(
    dir,
    'src/Ordered.tsx',
    `import { useEffect } from "react";
export function Ordered(a: string, b: string, c: string) {
  useEffect(() => { first(); }, [a]);
  useEffect(() => { second(); }, [b]);
  useEffect(() => { third(); }, [c]);
}
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);

  const parsed = JSON.parse(stdout) as {
    effects: Record<string, Record<string, Array<{ startLine: number; body: string }>>>;
  };
  const effects = parsed.effects.reactive.plain;
  expect(effects).toHaveLength(3);
  expect(effects[0]!.startLine).toBeLessThan(effects[1]!.startLine);
  expect(effects[1]!.startLine).toBeLessThan(effects[2]!.startLine);
  expect(effects[0]!.body).toContain('first');
  expect(effects[1]!.body).toContain('second');
  expect(effects[2]!.body).toContain('third');
});

// ─── CLEANUP DETECTION ───────────────────────────────────────────────────────

test('explicit return with cleanup arrow function is hasCleanup: true', async () => {
  const dir = await resetFixtureDir('cleanup-explicit');
  await writeFixtureFile(
    dir,
    'src/hooks/useSocket.ts',
    `import { useEffect } from "react";
export function UseSocket(url: string) {
  useEffect(() => {
    const s = connect(url);
    return () => s.close();
  }, [url]);
}
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    effects: Record<string, Record<string, Array<{ hasCleanup: boolean }>>>;
  };
  expect(parsed.effects.reactive.cleanup[0]!.hasCleanup).toBe(true);
});

test('bare return; (no argument) in an if-guard is NOT hasCleanup', async () => {
  // A `return;` without an argument is an early-exit guard clause, not a
  // cleanup function. The tool must not classify it as cleanup.
  const dir = await resetFixtureDir('cleanup-bare-return');
  await writeFixtureFile(
    dir,
    'src/hooks/useBareReturn.ts',
    `import { useEffect } from "react";
export function UseBareReturn(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    doSomething();
  }, [ready]);
}
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    effects: Record<string, Record<string, unknown[]>>;
  };
  expect(parsed.effects.reactive.plain).toHaveLength(1);
  expect(parsed.effects.reactive.cleanup).toHaveLength(0);
});

test('return inside try block body is hasCleanup: true', async () => {
  const dir = await resetFixtureDir('cleanup-try');
  await writeFixtureFile(
    dir,
    'src/hooks/useTry.ts',
    `import { useEffect } from "react";
export function UseTry() {
  useEffect(() => {
    try {
      return () => teardown();
    } catch (e) {
      console.error(e);
    }
  }, []);
}
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    effects: Record<string, Record<string, Array<{ hasCleanup: boolean }>>>;
  };
  expect(parsed.effects.once.cleanup[0]!.hasCleanup).toBe(true);
});

test('return inside catch block is hasCleanup: true', async () => {
  const dir = await resetFixtureDir('cleanup-catch');
  await writeFixtureFile(
    dir,
    'src/hooks/useCatch.ts',
    `import { useEffect } from "react";
export function UseCatch() {
  useEffect(() => {
    try {
      setup();
    } catch (e) {
      return () => teardown();
    }
  }, []);
}
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    effects: Record<string, Record<string, Array<{ hasCleanup: boolean }>>>;
  };
  expect(parsed.effects.once.cleanup[0]!.hasCleanup).toBe(true);
});

test('return inside finally block is hasCleanup: true', async () => {
  const dir = await resetFixtureDir('cleanup-finally');
  await writeFixtureFile(
    dir,
    'src/hooks/useFinally.ts',
    `import { useEffect } from "react";
export function UseFinally() {
  useEffect(() => {
    try {
      setup();
    } finally {
      return () => teardown();
    }
  }, []);
}
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    effects: Record<string, Record<string, Array<{ hasCleanup: boolean }>>>;
  };
  expect(parsed.effects.once.cleanup[0]!.hasCleanup).toBe(true);
});

test('return inside for-of loop body is hasCleanup: true', async () => {
  const dir = await resetFixtureDir('cleanup-loop');
  await writeFixtureFile(
    dir,
    'src/hooks/useLoop.ts',
    `import { useEffect } from "react";
export function UseLoop(items: string[]) {
  useEffect(() => {
    for (const item of items) {
      if (item === "special") return () => cleanup();
    }
  }, [items]);
}
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    effects: Record<string, Record<string, Array<{ hasCleanup: boolean }>>>;
  };
  expect(parsed.effects.reactive.cleanup[0]!.hasCleanup).toBe(true);
});

test('return inside switch case is hasCleanup: true', async () => {
  const dir = await resetFixtureDir('cleanup-switch');
  await writeFixtureFile(
    dir,
    'src/hooks/useSwitch.ts',
    `import { useEffect } from "react";
export function UseSwitch(type: string) {
  useEffect(() => {
    switch (type) {
      case "ws":
        return () => ws.close();
      default:
        break;
    }
  }, [type]);
}
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    effects: Record<string, Record<string, Array<{ hasCleanup: boolean }>>>;
  };
  expect(parsed.effects.reactive.cleanup[0]!.hasCleanup).toBe(true);
});

test('return inside a nested function declaration is NOT hasCleanup', async () => {
  // The return is scoped to the inner function, not the effect callback.
  const dir = await resetFixtureDir('cleanup-nested-fn');
  await writeFixtureFile(
    dir,
    'src/hooks/useNestedFn.ts',
    `import { useEffect } from "react";
export function UseNestedFn() {
  useEffect(() => {
    function inner() {
      return () => cleanup();
    }
    inner();
  }, []);
}
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    effects: Record<string, Record<string, unknown[]>>;
  };
  expect(parsed.effects.once.plain).toHaveLength(1);
  expect(parsed.effects.once.cleanup).toHaveLength(0);
});

test('return inside a nested arrow function is NOT hasCleanup', async () => {
  // The return is scoped to the inner arrow, not the effect callback.
  const dir = await resetFixtureDir('cleanup-nested-arrow');
  await writeFixtureFile(
    dir,
    'src/hooks/useNestedArrow.ts',
    `import { useEffect } from "react";
export function UseNestedArrow() {
  useEffect(() => {
    const inner = () => {
      return () => cleanup();
    };
    inner();
  }, []);
}
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    effects: Record<string, Record<string, unknown[]>>;
  };
  expect(parsed.effects.once.plain).toHaveLength(1);
  expect(parsed.effects.once.cleanup).toHaveLength(0);
});

// ─── COMMENT STRIPPING ───────────────────────────────────────────────────────

test('--strip-comments removes multiline /* */ block comments spanning lines', async () => {
  const dir = await resetFixtureDir('strip-multiline');
  await writeFixtureFile(
    dir,
    'src/Comp.tsx',
    `import { useEffect } from "react";
export function Comp() {
  useEffect(() => {
    /*
     * multiline
     * block comment
     */
    doWork();
  }, []);
}
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '--strip-comments', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    effects: Record<string, Record<string, Array<{ raw: string; body: string }>>>;
  };
  const effect = parsed.effects.once.plain[0]!;
  expect(effect.raw).not.toContain('multiline');
  expect(effect.raw).not.toContain('block comment');
  expect(effect.raw).toContain('doWork()');
});

test('--strip-comments is a no-op when effect body has no comments', async () => {
  const dir = await resetFixtureDir('strip-no-comments');
  await writeFixtureFile(
    dir,
    'src/Comp.tsx',
    `import { useEffect } from "react";
export function Comp() {
  useEffect(() => {
    fetchData();
    setLoaded(true);
  }, []);
}
`,
  );

  const { stdout: withStrip, exitCode: e1 } = await runEfkt(
    ['--json', '--strip-comments', '.'],
    dir,
  );
  const { stdout: withoutStrip, exitCode: e2 } = await runEfkt(['--json', '.'], dir);
  expect(e1).toBe(0);
  expect(e2).toBe(0);

  const p1 = JSON.parse(withStrip) as { scannedAt?: string; effects: unknown };
  const p2 = JSON.parse(withoutStrip) as { scannedAt?: string; effects: unknown };
  expect(p1.effects).toEqual(p2.effects);
});

test('--strip-comments corrupts // inside string literals (known regex limitation)', async () => {
  // The regex-based stripper cannot distinguish `//` in a comment from `//`
  // inside a string literal. "https://example.com" gets corrupted to "https:".
  // Fixing this properly would require an AST-aware approach.
  const dir = await resetFixtureDir('strip-url-bug');
  await writeFixtureFile(
    dir,
    'src/Comp.tsx',
    `import { useEffect } from "react";
export function Comp() {
  useEffect(() => {
    fetch("https://api.example.com");
  }, []);
}
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '--strip-comments', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    effects: Record<string, Record<string, Array<{ raw: string }>>>;
  };
  const raw = parsed.effects.once.plain[0]!.raw;
  // The `//` in the URL is treated as a comment delimiter and the rest is stripped
  expect(raw).not.toContain('//api.example.com');
  expect(raw).toContain('fetch("https:');
});

// ─── DEPS EXTRACTION ─────────────────────────────────────────────────────────

test('ternary expression in deps array is extracted as a source slice', async () => {
  const dir = await resetFixtureDir('deps-ternary');
  await writeFixtureFile(
    dir,
    'src/hooks/useTernary.ts',
    `import { useEffect } from "react";
export function UseTernary(cond: boolean, a: string, b: string) {
  useEffect(() => { doWork(); }, [cond ? a : b]);
}
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    effects: Record<string, Record<string, Array<{ deps: string[] }>>>;
  };
  expect(parsed.effects.reactive.plain[0]!.deps).toEqual(['cond ? a : b']);
});

test('template literal in deps array is extracted as a source slice', async () => {
  const dir = await resetFixtureDir('deps-template');
  await writeFixtureFile(
    dir,
    'src/hooks/useTemplate.ts',
    `import { useEffect } from "react";
export function UseTemplate(id: string) {
  useEffect(() => { doWork(); }, [\`key-\${id}\`]);
}
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    effects: Record<string, Record<string, Array<{ deps: string[] }>>>;
  };
  const dep = parsed.effects.reactive.plain[0]!.deps[0]!;
  expect(dep).toContain('key-');
  expect(dep).toContain('id');
});

test('hole element in sparse deps array is represented as empty string', async () => {
  const dir = await resetFixtureDir('deps-hole');
  await writeFixtureFile(
    dir,
    'src/hooks/useHole.ts',
    `import { useEffect } from "react";
export function UseHole(a: string) {
  // @ts-expect-error intentional sparse array for testing
  useEffect(() => { doWork(); }, [, a]);
}
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    effects: Record<string, Record<string, Array<{ deps: string[] }>>>;
  };
  const deps = parsed.effects.reactive.plain[0]!.deps;
  expect(deps).toHaveLength(2);
  expect(deps[0]).toBe('');
  expect(deps[1]).toBe('a');
});

test('spread element in deps array is extracted as a source slice', async () => {
  const dir = await resetFixtureDir('deps-spread');
  await writeFixtureFile(
    dir,
    'src/hooks/useSpread.ts',
    `import { useEffect } from "react";
export function UseSpread(deps: string[]) {
  // @ts-expect-error spread in deps for testing
  useEffect(() => { doWork(); }, [...deps]);
}
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    effects: Record<string, Record<string, Array<{ deps: string[] }>>>;
  };
  expect(parsed.effects.reactive.plain[0]!.deps[0]).toBe('...deps');
});

// ─── EFFECT EXTRACTION ───────────────────────────────────────────────────────

test('expression-body arrow function (concise body, no block) is extracted', async () => {
  const dir = await resetFixtureDir('expr-body');
  await writeFixtureFile(
    dir,
    'src/hooks/useExpr.ts',
    `import { useEffect } from "react";
export function UseExpr(id: string) {
  useEffect(() => void fetchData(id), [id]);
}
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    totalEffects: number;
    effects: Record<string, Record<string, Array<{ hasCleanup: boolean }>>>;
  };
  expect(parsed.totalEffects).toBe(1);
  // Expression-body arrows cannot contain a return statement
  expect(parsed.effects.reactive.plain[0]!.hasCleanup).toBe(false);
});

test('default-exported named function component name is resolved', async () => {
  const dir = await resetFixtureDir('default-export-named');
  await writeFixtureFile(
    dir,
    'src/App.tsx',
    `import { useEffect } from "react";
export default function App() {
  useEffect(() => { init(); }, []);
}
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    effects: Record<string, Record<string, Array<{ component: string | null }>>>;
  };
  expect(parsed.effects.once.plain[0]!.component).toBe('App');
});

test('.js file extension is scanned and effects are extracted', async () => {
  const dir = await resetFixtureDir('js-extension');
  await writeFixtureFile(
    dir,
    'src/legacy.js',
    `import { useEffect } from "react";
export function Legacy() {
  useEffect(function () { doThing(); }, []);
}
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as { totalFiles: number; totalEffects: number };
  expect(parsed.totalFiles).toBe(1);
  expect(parsed.totalEffects).toBe(1);
});

test('.jsx file extension is scanned and effects are extracted', async () => {
  const dir = await resetFixtureDir('jsx-extension');
  await writeFixtureFile(
    dir,
    'src/Legacy.jsx',
    `import { useEffect } from "react";
export function Legacy() {
  useEffect(() => { doThing(); }, []);
}
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as { totalFiles: number; totalEffects: number };
  expect(parsed.totalFiles).toBe(1);
  expect(parsed.totalEffects).toBe(1);
});

test('useEffect is matched by callee name regardless of import source', async () => {
  // The tool matches any call expression named `useEffect`; it does not
  // validate the import source. This is the intended design.
  const dir = await resetFixtureDir('own-use-effect');
  await writeFixtureFile(
    dir,
    'src/custom.ts',
    `import { useEffect } from "./myCustomHooks";
export function MyComp() {
  useEffect(() => { doThing(); }, []);
}
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as { totalEffects: number };
  expect(parsed.totalEffects).toBe(1);
});

// ─── FORMAT STRUCTURE ────────────────────────────────────────────────────────

test('JSON output has all required top-level fields with correct types', async () => {
  const dir = await resetFixtureDir('json-shape');
  await writeFixtureFile(
    dir,
    'src/A.tsx',
    `import { useEffect } from "react";
export function A() { useEffect(() => {}, []); }
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as Record<string, unknown>;
  expect(typeof parsed.scannedAt).toBe('string');
  expect(Number.isNaN(new Date(parsed.scannedAt as string).getTime())).toBe(false);
  expect(typeof parsed.root).toBe('string');
  expect(typeof parsed.totalFiles).toBe('number');
  expect(typeof parsed.totalEffects).toBe('number');
  expect(typeof parsed.effects).toBe('object');
});

test('JSON effects object always contains all 6 category slots', async () => {
  const dir = await resetFixtureDir('json-all-slots');
  // Only once.plain will be populated; verify all others are empty arrays
  await writeFixtureFile(
    dir,
    'src/A.tsx',
    `import { useEffect } from "react";
export function A() { useEffect(() => {}, []); }
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    effects: Record<string, Record<string, unknown[]>>;
  };

  for (const group of ['untracked', 'reactive', 'once']) {
    for (const sub of ['plain', 'cleanup']) {
      expect(Array.isArray(parsed.effects[group]?.[sub])).toBe(true);
    }
  }

  expect(parsed.effects.once?.plain).toHaveLength(1);
  expect(parsed.effects.untracked?.plain).toHaveLength(0);
  expect(parsed.effects.untracked?.cleanup).toHaveLength(0);
  expect(parsed.effects.reactive?.plain).toHaveLength(0);
  expect(parsed.effects.reactive?.cleanup).toHaveLength(0);
  expect(parsed.effects.once?.cleanup).toHaveLength(0);
});

test('Markdown skips headings for groups with zero effects', async () => {
  const dir = await resetFixtureDir('md-skip-empty');
  // Only once.plain — untracked and reactive must not appear at all
  await writeFixtureFile(
    dir,
    'src/A.tsx',
    `import { useEffect } from "react";
export function A() { useEffect(() => {}, []); }
`,
  );

  const { stdout, exitCode } = await runEfkt(['--md', '.'], dir);
  expect(exitCode).toBe(0);
  expect(stdout).not.toContain('## 1. untracked');
  expect(stdout).not.toContain('## 1. reactive');
  expect(stdout).toContain('once');
});

test('Markdown group numbering is contiguous when a middle group is empty', async () => {
  const dir = await resetFixtureDir('md-numbering');
  // untracked.plain (no deps) and once.plain (empty deps), NO reactive effects
  await writeFixtureFile(
    dir,
    'src/Comp.tsx',
    `import { useEffect } from "react";
export function Comp() {
  useEffect(() => { untrackedWork(); });
  useEffect(() => { mountWork(); }, []);
}
`,
  );

  const { stdout, exitCode } = await runEfkt(['--md', '.'], dir);
  expect(exitCode).toBe(0);
  // reactive is empty so it is skipped; once gets index 2, not 3
  expect(stdout).toContain('## 1. untracked');
  expect(stdout).toContain('## 2. once');
  expect(stdout).not.toContain('## 3.');
  expect(stdout).not.toContain('## 2. reactive');
  expect(stdout).not.toContain('## 3. reactive');
});

// ─── LIMIT BOUNDARY BEHAVIOR ─────────────────────────────────────────────────

test('--limit greater than total effects returns all effects unchanged', async () => {
  const dir = await resetFixtureDir('limit-over');
  await writeFixtureFile(
    dir,
    'src/Comp.tsx',
    `import { useEffect } from "react";
export function Comp(a: string, b: string) {
  useEffect(() => { first(); }, [a]);
  useEffect(() => { second(); }, [b]);
}
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '--limit', '100', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as { totalEffects: number };
  expect(parsed.totalEffects).toBe(2);
});

test('--limit 1 returns exactly one effect', async () => {
  const dir = await resetFixtureDir('limit-one');
  await writeFixtureFile(
    dir,
    'src/Comp.tsx',
    `import { useEffect } from "react";
export function Comp(a: string, b: string, c: string) {
  useEffect(() => { first(); }, [a]);
  useEffect(() => { second(); }, [b]);
  useEffect(() => { third(); }, [c]);
}
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '--limit', '1', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as { totalEffects: number };
  expect(parsed.totalEffects).toBe(1);
});

test('--limit applies in fixed group order: untracked before reactive before once', async () => {
  const dir = await resetFixtureDir('limit-order');
  await writeFixtureFile(
    dir,
    'src/Comp.tsx',
    `import { useEffect } from "react";
export function Comp(a: string) {
  useEffect(() => { untrackedWork(); });
  useEffect(() => { reactiveWork(); }, [a]);
  useEffect(() => { onceWork(); }, []);
}
`,
  );

  // With limit=1 the iteration visits untracked.plain first, so only it survives
  const { stdout, exitCode } = await runEfkt(['--json', '--limit', '1', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    totalEffects: number;
    effects: Record<string, Record<string, unknown[]>>;
  };
  expect(parsed.totalEffects).toBe(1);
  expect(parsed.effects.untracked?.plain).toHaveLength(1);
  expect(parsed.effects.reactive?.plain).toHaveLength(0);
  expect(parsed.effects.once?.plain).toHaveLength(0);
});

test('--limit with --case where the category is empty returns 0 effects', async () => {
  const dir = await resetFixtureDir('limit-empty-case');
  await writeFixtureFile(
    dir,
    'src/Comp.tsx',
    `import { useEffect } from "react";
export function Comp(a: string) {
  useEffect(() => { work(); }, [a]);
}
`,
  );

  // reactive.plain has 1 effect; filter to untracked.plain (empty), then limit 5
  const { stdout, exitCode } = await runEfkt(
    ['--json', '--case', 'untracked.plain', '--limit', '5', '.'],
    dir,
  );
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as { totalEffects: number };
  expect(parsed.totalEffects).toBe(0);
});

// ─── MULTI-FILE BEHAVIOR ─────────────────────────────────────────────────────

test('effects from multiple files are attributed to their respective source files', async () => {
  const dir = await resetFixtureDir('multi-file-attribution');
  await writeFixtureFile(
    dir,
    'src/Alpha.tsx',
    `import { useEffect } from "react";
export function Alpha() { useEffect(() => { alphaWork(); }, []); }
`,
  );
  await writeFixtureFile(
    dir,
    'src/Beta.tsx',
    `import { useEffect } from "react";
export function Beta() { useEffect(() => { betaWork(); }, []); }
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as {
    totalFiles: number;
    totalEffects: number;
    effects: Record<string, Record<string, Array<{ file: string; body: string }>>>;
  };
  expect(parsed.totalFiles).toBe(2);
  expect(parsed.totalEffects).toBe(2);

  const effects = parsed.effects.once.plain;
  const alphaEffect = effects.find((e) => e.file.includes('Alpha'));
  const betaEffect = effects.find((e) => e.file.includes('Beta'));
  expect(alphaEffect).toBeDefined();
  expect(betaEffect).toBeDefined();
  expect(alphaEffect!.body).toContain('alphaWork');
  expect(betaEffect!.body).toContain('betaWork');
});

// ─── SCAN EXCLUSIONS ─────────────────────────────────────────────────────────

test('node_modules directory is excluded from scan', async () => {
  const dir = await resetFixtureDir('exclude-node-modules');
  await writeFixtureFile(
    dir,
    'src/App.tsx',
    `import { useEffect } from "react";
export function App() { useEffect(() => {}, []); }
`,
  );
  await writeFixtureFile(
    dir,
    'node_modules/some-lib/index.tsx',
    `import { useEffect } from "react";
export function Lib() { useEffect(() => {}, []); }
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as { totalFiles: number; totalEffects: number };
  expect(parsed.totalFiles).toBe(1);
  expect(parsed.totalEffects).toBe(1);
});

test('dist directory is excluded from scan', async () => {
  const dir = await resetFixtureDir('exclude-dist');
  await writeFixtureFile(
    dir,
    'src/App.tsx',
    `import { useEffect } from "react";
export function App() { useEffect(() => {}, []); }
`,
  );
  await writeFixtureFile(
    dir,
    'dist/App.js',
    `import { useEffect } from "react";
export function App() { useEffect(() => {}, []); }
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as { totalFiles: number; totalEffects: number };
  expect(parsed.totalFiles).toBe(1);
  expect(parsed.totalEffects).toBe(1);
});

test('.next directory is excluded from scan', async () => {
  const dir = await resetFixtureDir('exclude-next');
  await writeFixtureFile(
    dir,
    'src/App.tsx',
    `import { useEffect } from "react";
export function App() { useEffect(() => {}, []); }
`,
  );
  await writeFixtureFile(
    dir,
    '.next/server/chunks/App.js',
    `import { useEffect } from "react";
export function App() { useEffect(() => {}, []); }
`,
  );

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as { totalFiles: number; totalEffects: number };
  expect(parsed.totalFiles).toBe(1);
  expect(parsed.totalEffects).toBe(1);
});

test('non-JS/TS files (.css, .json) are not counted in totalFiles', async () => {
  const dir = await resetFixtureDir('non-js-files');
  await writeFixtureFile(
    dir,
    'src/App.tsx',
    `import { useEffect } from "react";
export function App() { useEffect(() => {}, []); }
`,
  );
  await writeFixtureFile(dir, 'src/styles.css', '.app { color: red; }');
  await writeFixtureFile(dir, 'src/config.json', '{"key":"value"}');

  const { stdout, exitCode } = await runEfkt(['--json', '.'], dir);
  expect(exitCode).toBe(0);
  const parsed = JSON.parse(stdout) as { totalFiles: number };
  expect(parsed.totalFiles).toBe(1);
});
