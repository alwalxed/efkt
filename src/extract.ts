import { readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';
import type { Node, NodePath } from '@babel/traverse';
import _traverse from '@babel/traverse';
import type { Effect } from './types.ts';

const traverse: typeof _traverse =
  typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: typeof _traverse }).default;

export async function extractEffects(filePath: string, displayPath: string): Promise<Effect[]> {
  let source: string;
  try {
    source = await readFile(filePath, 'utf-8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`warning: could not read ${displayPath}: ${msg}\n`);
    return [];
  }

  let ast: import('@babel/types').File;
  try {
    ast = parse(source, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`warning: could not parse ${displayPath}: ${msg}\n`);
    return [];
  }

  const effects: Effect[] = [];

  traverse(ast, {
    CallExpression(path: NodePath<import('@babel/types').CallExpression>) {
      const callee = path.node.callee;
      if (callee.type !== 'Identifier' || callee.name !== 'useEffect') return;

      const args = path.node.arguments;
      if (args.length === 0) return;

      const callback = args[0];
      if (!callback || callback.type !== 'ArrowFunctionExpression') return;

      const loc = path.node.loc;
      if (!loc) return;

      effects.push({
        file: displayPath,
        component: resolveComponent(path),
        startLine: loc.start.line,
        endLine: loc.end.line,
        body: extractBody(callback, source),
        deps: extractDeps(args[1], source),
        hasCleanup: hasReturnStatement(callback),
      });
    },
  });

  return effects;
}

function resolveComponent(path: NodePath): string | null {
  let current = path.parentPath;

  while (current) {
    const node = current.node;

    if (node.type === 'FunctionDeclaration' && node.id?.name) {
      return node.id.name;
    }

    if (
      node.type === 'VariableDeclarator' &&
      node.id?.type === 'Identifier' &&
      node.init &&
      (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression')
    ) {
      return node.id.name;
    }

    current = current.parentPath;
  }

  return null;
}

function extractBody(arrow: Node, source: string): string {
  const body = (arrow as import('@babel/types').ArrowFunctionExpression).body;

  if (body.type !== 'BlockStatement') {
    if (body.start != null && body.end != null) {
      return source.slice(body.start, body.end).trim();
    }
    return '';
  }

  if (body.body.length === 0) return '';

  const first = body.body[0];
  const last = body.body[body.body.length - 1];
  if (!first || !last || first.start == null || last.end == null) return '';

  return source.slice(first.start, last.end).trim();
}

function extractDeps(arg: Node | undefined, source: string): string[] | null {
  if (!arg || arg.type !== 'ArrayExpression') return null;

  return arg.elements.map((el) => {
    if (!el || el.start == null || el.end == null) return '';
    return source.slice(el.start, el.end);
  });
}

function hasReturnStatement(arrow: Node): boolean {
  const body = (arrow as import('@babel/types').ArrowFunctionExpression).body;
  if (body.type !== 'BlockStatement') return false;

  for (const stmt of body.body) {
    if (stmt.type === 'ReturnStatement') return true;
  }
  return false;
}
