import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
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
    } catch {}
  }

  return filters;
}

function isGitignored(filePath: string, filters: GitignoreFilter[]): boolean {
  for (const { dir, ig } of filters) {
    if (dir === '' || filePath.startsWith(`${dir}/`)) {
      const rel = dir === '' ? filePath : filePath.slice(dir.length + 1);
      if (ig.ignores(rel)) return true;
    }
  }
  return false;
}

export async function scanFiles(root: string): Promise<string[]> {
  const abs = resolve(root);
  const info = await stat(abs);

  if (info.isFile()) {
    return [root];
  }

  const files = await fg('**/*.{js,jsx,ts,tsx}', {
    cwd: abs,
    ignore: ALWAYS_IGNORED,
    absolute: false,
    dot: false,
  });

  const gitignoreFilters = await loadGitignores(abs);

  const filtered =
    gitignoreFilters.length > 0 ? files.filter((f) => !isGitignored(f, gitignoreFilters)) : files;

  const trailing = root.endsWith('/') ? root : `${root}/`;
  return filtered.sort().map((f) => trailing + f);
}
