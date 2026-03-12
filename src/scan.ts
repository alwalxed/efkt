import { readFile, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import fg from 'fast-glob';
import ignore from 'ignore';

const ALWAYS_IGNORED = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/coverage/**',
  '**/.next/**',
  '**/.turbo/**',
  '**/.git/**',
];

const MAX_FILES = 10_000;

interface GitignoreFilter {
  dir: string;
  ig: ReturnType<typeof ignore>;
}

async function loadGitignores(root: string): Promise<GitignoreFilter[]> {
  const paths = await fg('**/.gitignore', {
    cwd: root,
    ignore: ALWAYS_IGNORED,
    dot: true,
    absolute: false,
  });

  const filters: GitignoreFilter[] = [];

  for (const p of paths) {
    try {
      const content = await readFile(join(root, p), 'utf-8');
      const ig = ignore().add(content);
      const dir = dirname(p);
      filters.push({ dir: dir === '.' ? '' : dir, ig });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        process.stderr.write(`Warning: failed to read ${p}: ${(err as Error).message}\n`);
      }
    }
  }

  return filters;
}

function isGitignored(filePath: string, filters: GitignoreFilter[]): boolean {
  for (const { dir, ig } of filters) {
    const rel = dir === '' ? filePath : relative(dir, filePath);
    if (rel.startsWith('..')) continue;
    if (ig.ignores(rel)) return true;
  }
  return false;
}

export async function scanFiles(root: string): Promise<string[]> {
  const abs = resolve(root);

  let info: Awaited<ReturnType<typeof stat>>;
  try {
    info = await stat(abs);
  } catch (err) {
    throw new Error(`Cannot access path "${abs}": ${(err as Error).message}`);
  }

  if (info.isFile()) {
    return [abs];
  }

  if (!info.isDirectory()) {
    throw new Error(`Path "${abs}" is neither a file nor a directory`);
  }

  const files = await fg('**/*.{js,jsx,ts,tsx}', {
    cwd: abs,
    ignore: ALWAYS_IGNORED,
    absolute: false,
    dot: false,
  });

  if (files.length > MAX_FILES) {
    process.stderr.write(
      `Warning: found ${files.length} files, truncating to ${MAX_FILES}. Consider narrowing the scan path.\n`
    );
    files.splice(MAX_FILES);
  }

  const gitignoreFilters = await loadGitignores(abs);

  const filtered =
    gitignoreFilters.length > 0 ? files.filter((f) => !isGitignored(f, gitignoreFilters)) : files;

  return filtered.sort().map((f) => join(abs, f));
}
