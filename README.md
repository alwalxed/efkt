## efkt

Most codebases abuse `useEffect`. This tool scans your React project, finds every `useEffect` call, and prints a structured report you can review by hand or feed straight into an LLM to surface the worst offenders fast.

### Installation

```bash
pnpm install -g @alwalxed/efkt
```

### Usage

```sh
efkt [path] [--json | --md] [--limit <number>]
```

- **path**: directory or file to scan (defaults to `./`).
- **--json**: output a JSON object describing all effects.
- **--md**: output a Markdown report.
- **--limit**: cap the number of effects included in the output (also affects `totalEffects`).
- **--help**: print usage and exit `0`.
- **--version**: print the version from `package.json` and exit `0`.

If neither `--json` nor `--md` is passed and stdin is a TTY, `efkt` prompts once for the format. If stdin is not a TTY and no format flag is given, it prints an error to stderr and exits `1`.

### Output structure

The JSON output groups effects by behavioral category, ordered from highest to lowest likelihood of causing issues:

```json
{
  "scannedAt": "<ISO 8601 timestamp>",
  "root": "./src",
  "totalFiles": 836,
  "totalEffects": 179,
  "effects": {
    "noDeps_noCleanup": [],
    "noDeps_withCleanup": [],
    "deps_noCleanup": [],
    "deps_withCleanup": [],
    "emptyDeps_noCleanup": [],
    "emptyDeps_withCleanup": []
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

# Copy to clipboard
efkt ./src --md | pbcopy
```

### Behavior

- Scans `**/*.{js,jsx,ts,tsx}` under the given path.
- Detects `useEffect` calls that use arrow function or regular function callbacks.
- Always ignores `node_modules/`, `dist/`, `build/`, `out/`, `coverage/`, `.next/`, `.turbo/`, `.git/`.
- Respects `.gitignore` rules at the root and in nested directories.
- On success (including "no files" or "0 effects found"), exits `0` and writes a complete result to stdout.
- On any error, writes a message to stderr, exits `1`, and writes nothing to stdout.
