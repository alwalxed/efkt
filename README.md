## efkt

Extract `useEffect` hooks from React codebases in one shot. `efkt` scans your project, finds every `useEffect` call, and prints a structured report you can feed into other tools or review by hand.

### Installation

```sh
bun install -g efkt
```

`efkt` runs on Bun. Make sure [Bun](https://bun.sh) is installed before using the global npm package.

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

### Examples

```sh
# JSON for further processing
efkt --json | jq '.effects[] | select(.deps == null)'

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
