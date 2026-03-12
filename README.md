<div align="center">

# efkt

**Scan, categorize, and export every `useEffect` in your React project.**

[![npm version](https://img.shields.io/npm/v/@alwalxed/efkt?style=flat-square)](https://www.npmjs.com/package/@alwalxed/efkt)
[![npm downloads](https://img.shields.io/npm/dm/@alwalxed/efkt?style=flat-square)](https://www.npmjs.com/package/@alwalxed/efkt)
[![license](https://img.shields.io/github/license/alwalxed/efkt?style=flat-square)](./LICENSE)

</div>

---

`efkt` is a lightweight CLI that parses your React codebase, classifies every `useEffect` by dependency shape and cleanup pattern, and outputs clean **JSON** or **Markdown**, ready for code audits, LLM review, or sharing with your team.

## Features

- Scans `.js`, `.jsx`, `.ts`, `.tsx` files via fast AST parsing
- Classifies effects into 6 categories (untracked, reactive, once × plain/cleanup)
- Outputs structured **JSON** or human-readable **Markdown**
- Optional comment stripping from effect bodies
- Filter to a single category or cap total results with `--limit`
- Respects `.gitignore` files found anywhere in the scanned tree
- Always skips `node_modules`, `dist`, `build`, `out`, `coverage`, `.next`, `.turbo`, `.git`
- Caps scan at 10,000 files with a stderr warning (prevents runaway scans)

## Installation

```bash
pnpm add -g @alwalxed/efkt
# or
npm install -g @alwalxed/efkt
# or
yarn global add @alwalxed/efkt
```

## Usage

```
efkt [path] [options]
```

Omitting `[path]` defaults to `./`. Running without `--json` or `--md` in a TTY launches an interactive prompt. In non-TTY contexts (pipes, CI) a format flag is required — omitting it exits with an error.

### Options

| Flag                 | Description                                                          |
| -------------------- | -------------------------------------------------------------------- |
| `--json`             | Output structured JSON _(mutually exclusive with `--md`)_            |
| `--md`               | Output Markdown report _(mutually exclusive with `--json`)_          |
| `--limit <n>`        | Cap total effects to `n`, ordered: untracked → reactive → once       |
| `--case <group.sub>` | Filter to one category, e.g. `untracked.plain` or `reactive.cleanup` |
| `--strip-comments`   | Strip `//` and `/* */` comments from effect bodies                   |
| `--help`             | Show help and exit                                                   |
| `--version`          | Show version and exit                                                |

### Effect Categories

Effects are classified by two axes: **dependency array shape** and **presence of a cleanup `return`**.

| Category            | Deps      | Cleanup | Risk                  |
| ------------------- | --------- | ------- | --------------------- |
| `untracked.plain`   | absent    | ✗       | 🔴 High, likely stale |
| `untracked.cleanup` | absent    | ✓       | 🟠 Medium, High       |
| `reactive.plain`    | `[…deps]` | ✗       | 🟡 Medium             |
| `reactive.cleanup`  | `[…deps]` | ✓       | 🟢 Recommended        |
| `once.plain`        | `[]`      | ✗       | 🟡 Low, Medium        |
| `once.cleanup`      | `[]`      | ✓       | 🟢 Usually safe       |

## JSON Output Shape

When using `--json`, the top-level envelope always contains:

```json
{
  "scannedAt": "2026-03-13T10:00:00.000Z",
  "root": "./src",
  "totalFiles": 42,
  "totalEffects": 17,
  "effects": {
    "untracked": { "plain": [...], "cleanup": [...] },
    "reactive":  { "plain": [...], "cleanup": [...] },
    "once":      { "plain": [...], "cleanup": [...] }
  }
}
```

Each effect object contains `file`, `component`, `startLine`, `endLine`, `body`, `raw`, `deps`, and `hasCleanup`.

## Examples

```bash
# Inspect the most dangerous effects
efkt --json | jq '.effects.untracked.plain'

# Count effects per subcategory
efkt --json | jq '.effects | to_entries[] | "\(.key): plain=\(.value.plain | length) cleanup=\(.value.cleanup | length)"'

# Only reactive effects with cleanup, under src/
efkt src/ --json --case reactive.cleanup

# Generate a Markdown report (great for LLM review or PRs)
efkt src/ --md --strip-comments > effects-report.md

# Analyze a single file
efkt src/components/Auth.tsx --json

# Cap output in large repos
efkt ./src --json --limit 25

# Copy report to clipboard (macOS)
efkt ./src --md | pbcopy
```

## How It Works

1. Recursively finds `.js/.jsx/.ts/.tsx` files, skipping common build/output dirs (`node_modules`, `dist`, `.next`, etc.) and respecting any `.gitignore` files in the tree (capped at 10,000 files)
2. Parses each file with a fast AST parser
3. Locates every `useEffect` call and inspects its arguments:
   - **No second arg** → `untracked`
   - **`[]`** → `once`
   - **`[…deps]`** → `reactive`
   - **Return function present** → `cleanup` variant
4. Extracts body, dependencies, file path, line number, and component context
5. Serializes to JSON or Markdown

## Contributing

`efkt` is intentionally small and focused. If you have ideas for meaningful improvements — better categorization, ignore patterns, richer context extraction — open an issue or send a clean PR.

Please keep PRs scoped and avoid adding heavy dependencies.

## License

[MIT](./LICENSE)
