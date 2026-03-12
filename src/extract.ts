import { readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';
import type { NodePath } from '@babel/traverse';
import _traverse from '@babel/traverse';
import type {
  ArrowFunctionExpression,
  CallExpression,
  File,
  FunctionExpression,
  Node,
  Statement,
} from '@babel/types';
import type { Effect } from './types.ts';

const traverse: typeof _traverse =
  typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: typeof _traverse }).default;

type EffectCallback = ArrowFunctionExpression | FunctionExpression;

export async function extractEffects(filePath: string, displayPath: string): Promise<Effect[]> {
  let source: string;
  try {
    source = await readFile(filePath, 'utf-8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`warning: could not read ${displayPath}: ${msg}\n`);
    return [];
  }

  let ast: File;
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
    CallExpression(path: NodePath<CallExpression>) {
      if (!isUseEffectCall(path.node)) return;

      const args = path.node.arguments;
      if (args.length === 0) return;

      const callback = args[0];

      if (
        !callback ||
        (callback.type !== 'ArrowFunctionExpression' && callback.type !== 'FunctionExpression')
      ) {
        return;
      }

      const loc = path.node.loc;
      if (!loc) return;

      const effectCallback = callback as EffectCallback;

      effects.push({
        file: displayPath,
        component: resolveComponent(path),
        startLine: loc.start.line,
        endLine: loc.end.line,
        body: extractBody(effectCallback, source),
        deps: extractDeps(args[1] as Node | undefined, source),
        hasCleanup: hasReturnStatement(effectCallback),
      });
    },
  });

  return effects;
}

function isUseEffectCall(node: CallExpression): boolean {
  const { callee } = node;

  if (callee.type === 'Identifier') {
    return callee.name === 'useEffect';
  }

  if (
    callee.type === 'MemberExpression' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'useEffect' &&
    !callee.computed
  ) {
    return true;
  }

  return false;
}

function resolveComponent(path: NodePath): string | null {
  let current = path.parentPath;

  while (current) {
    const node = current.node;

    if (node.type === 'FunctionDeclaration' && node.id?.name) {
      return node.id.name;
    }

    if (
      node.type === 'ExportDefaultDeclaration' &&
      node.declaration.type === 'FunctionDeclaration' &&
      node.declaration.id?.name
    ) {
      return node.declaration.id.name;
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

function extractBody(arrow: EffectCallback, source: string): string {
  const { body } = arrow;

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

function hasReturnStatement(arrow: EffectCallback): boolean {
  const { body } = arrow;
  if (body.type !== 'BlockStatement') return false;
  return statementsHaveReturn(body.body);
}

function statementsHaveReturn(stmts: Statement[]): boolean {
  for (const stmt of stmts) {
    if (stmt.type === 'ReturnStatement') return true;

    if (stmt.type === 'BlockStatement' && statementsHaveReturn(stmt.body)) return true;

    if (stmt.type === 'IfStatement') {
      if (stmt.consequent.type === 'BlockStatement' && statementsHaveReturn(stmt.consequent.body))
        return true;
      if (stmt.consequent.type === 'ReturnStatement') return true;
      if (stmt.alternate) {
        if (stmt.alternate.type === 'BlockStatement' && statementsHaveReturn(stmt.alternate.body))
          return true;
        if (stmt.alternate.type === 'ReturnStatement') return true;
      }
    }

    if (stmt.type === 'TryStatement') {
      if (statementsHaveReturn(stmt.block.body)) return true;
      if (stmt.handler && statementsHaveReturn(stmt.handler.body.body)) return true;
      if (stmt.finalizer && statementsHaveReturn(stmt.finalizer.body)) return true;
    }

    if (
      (stmt.type === 'ForStatement' ||
        stmt.type === 'ForInStatement' ||
        stmt.type === 'ForOfStatement' ||
        stmt.type === 'WhileStatement' ||
        stmt.type === 'DoWhileStatement') &&
      stmt.body.type === 'BlockStatement' &&
      statementsHaveReturn(stmt.body.body)
    ) {
      return true;
    }

    if (stmt.type === 'SwitchStatement') {
      for (const sc of stmt.cases) {
        if (statementsHaveReturn(sc.consequent)) return true;
      }
    }
  }

  return false;
}
