#!/usr/bin/env bun

import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { extractEffects } from './extract.ts';
import { formatJson } from './format/json.ts';
import { formatMarkdown } from './format/markdown.ts';
import { scanFiles } from './scan.ts';
import type { Effect, ScanResult } from './types.ts';

const USAGE = `Usage: efkt [path] [--json | --md]

Arguments:
  path       Directory or file to scan (default: ./)

Options:
  --json     Output as JSON
  --md       Output as Markdown
  --help     Show this help message
  --version  Print version`;

function fatal(message: string): never {
  process.stderr.write(`efkt: ${message}\n`);
  process.exit(1);
}

async function readVersion(): Promise<string> {
  const pkgPath = resolve(import.meta.dir, '../package.json');
  const pkg = await Bun.file(pkgPath).json();
  return pkg.version;
}

interface ParsedArgs {
  path: string;
  format: 'json' | 'md' | null;
  help: boolean;
  version: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  let path = './';
  let json = false;
  let md = false;
  let help = false;
  let version = false;

  for (const arg of argv) {
    switch (arg) {
      case '--json':
        json = true;
        break;
      case '--md':
        md = true;
        break;
      case '--help':
        help = true;
        break;
      case '--version':
        version = true;
        break;
      default:
        if (!arg.startsWith('-')) path = arg;
    }
  }

  if (json && md) {
    fatal('cannot use both --json and --md');
  }

  return {
    path,
    format: json ? 'json' : md ? 'md' : null,
    help,
    version,
  };
}

async function promptFormat(): Promise<'json' | 'md'> {
  const options = ['Markdown', 'JSON'] as const;
  let selected = 0;

  function render(initial: boolean) {
    const lineCount = options.length + 1;
    if (!initial) {
      process.stderr.write(`\x1b[${lineCount}A`);
    }
    let out = `\x1b[2K? Output format: (Use arrow keys)\n`;
    for (let i = 0; i < options.length; i++) {
      const prefix = i === selected ? '\x1b[36m>\x1b[0m ' : '  ';
      out += `\x1b[2K${prefix}${options[i]}\n`; // fix: always include \n so line count is consistent
    }
    process.stderr.write(out);
  }

  return new Promise<'json' | 'md'>((res) => {
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    render(true);

    function cleanup() {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
    }

    function onData(data: Buffer) {
      const key = data.toString();

      if (key === '\x03') {
        cleanup();
        process.stderr.write('\n');
        process.exit(130);
      }

      if (key === '\x1b[A') {
        selected = selected > 0 ? selected - 1 : options.length - 1;
        render(false);
        return;
      }

      if (key === '\x1b[B') {
        selected = selected < options.length - 1 ? selected + 1 : 0;
        render(false);
        return;
      }

      if (key === '\r' || key === '\n') {
        cleanup();
        process.stderr.write('\n');
        res(selected === 0 ? 'md' : 'json');
      }
    }

    stdin.on('data', onData);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }

  if (args.version) {
    process.stdout.write(`${await readVersion()}\n`);
    process.exit(0);
  }

  try {
    await stat(resolve(args.path));
  } catch {
    fatal(`path does not exist: ${args.path}`);
  }

  let format = args.format;
  if (!format) {
    if (process.stdin.isTTY) {
      format = await promptFormat();
    } else {
      fatal('no output format specified (use --json or --md)');
    }
  }

  const files = await scanFiles(args.path);

  if (files.length === 0) {
    process.stderr.write('warning: no .js/.jsx/.ts/.tsx files found\n');
  }

  const allEffects: Effect[] = [];
  for (const file of files) {
    const absFile = resolve(file);
    const effects = await extractEffects(absFile, file);
    allEffects.push(...effects);
  }

  if (files.length > 0 && allEffects.length === 0) {
    process.stderr.write('0 effects found.\n');
  }

  const result: ScanResult = {
    scannedAt: new Date().toISOString(),
    root: args.path,
    totalFiles: files.length,
    totalEffects: allEffects.length,
    effects: allEffects,
  };

  process.stdout.write(format === 'json' ? formatJson(result) : formatMarkdown(result));
}

main();
