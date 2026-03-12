## efkt

Extract `useEffect` hooks from React codebases in one shot. `efkt` scans your project, finds every `useEffect` call, and prints a structured report you can feed into other tools or review by hand.

### Installation

```bash
pnpm install -g @alwalxed/efkt
```

### Usage

```sh
efkt [path] [--json | --md]
```

- **path**: directory or file to scan (defaults to `./`).
- **--json**: output a JSON object describing all effects.
- **--md**: output a Markdown report.
- **--help**: print usage and exit `0`.
- **--version**: print the version from `package.json` and exit `0`.

If neither `--json` nor `--md` is passed and stdin is a TTY, `efkt` prompts once for the format. If stdin is not a TTY and no format flag is given, it prints an error to stderr and exits `1`.

### Output structure

The JSON output groups effects by behavioral category, ordered from highest to lowest likelihood of causing issues:

```json
{
  "scannedAt": "2026-03-12T10:10:29.619Z",
  "root": "./src",
  "totalFiles": 836,
  "totalEffects": 179,
  "effects": {
    "noDeps_noCleanup": [],
    "noDeps_withCleanup": [],
    "deps_noCleanup": [],
    "deps_withCleanup": [],
    "emptyDeps_noCleanup": [],
    "emptyDeps_withCleanup": [],
    "other": []
  }
}
```

| Category                | Dependency array    | Cleanup |
| :---------------------- | :------------------ | :------ |
| `noDeps_noCleanup`      | absent              | no      |
| `noDeps_withCleanup`    | absent              | yes     |
| `deps_noCleanup`        | `[dep1, dep2, ...]` | no      |
| `deps_withCleanup`      | `[dep1, dep2, ...]` | yes     |
| `emptyDeps_noCleanup`   | `[]`                | no      |
| `emptyDeps_withCleanup` | `[]`                | yes     |
| `other`                 | unclassifiable      | —       |

Each effect entry has the shape:

```json
{
  "file": "./src/App.tsx",
  "component": "App",
  "startLine": 12,
  "endLine": 18,
  "body": "...",
  "deps": ["value"],
  "hasCleanup": false
}
```

### Examples

```sh
# List all effects missing a dependency array
efkt --json | jq '.effects.noDeps_noCleanup'

# Count effects per category
efkt --json | jq '.effects | map_values(length)'

# Write a Markdown report
efkt src/ --md > effects.md

# Scan a single file
efkt src/components/Auth.tsx --json
```

### Behavior

- Scans `**/*.{js,jsx,ts,tsx}` under the given path.
- Detects `useEffect` calls that use arrow function callbacks.
- Always ignores `node_modules/`, `dist/`, `build/`, `out/`, `coverage/`, `.next/`, `.turbo/`, `.git/`.
- Respects `.gitignore` rules at the root and in nested directories.
- On success (including "no files" or "0 effects found"), exits `0` and writes a complete result to stdout.
- On any error, writes a message to stderr, exits `1`, and writes nothing to stdout.
