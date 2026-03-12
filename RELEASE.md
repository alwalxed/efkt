# Release guide

## Steps

1. Start from a **clean working tree** with **CI passing**.
2. **Build** — `bun run build`
3. **Bump version** — `npm version patch` (or `minor` / `major`)
   - Creates a new commit and a git tag (e.g. `v0.1.0`). Do this *before* publish so the tag matches the published version.
4. **Publish** — `npm publish --access=public`
   - Scoped package (`@alwalxed/efkt`) requires `--access=public` (correct spelling).
5. **Push** — `git push origin main --tags`
   - Pushes the version-bump commit and the new tag. If you see "Everything up-to-date", you likely skipped step 3.
