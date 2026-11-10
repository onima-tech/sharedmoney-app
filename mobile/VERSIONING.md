# Version Management Guide

## Overview

`mobile/version.json` is the only version Expo builds read. `mobile/app.config.js` loads `version` and `buildNumber` from it (`expo.version`, iOS `buildNumber`, Android `versionCode`). `.github/workflows/pr-version-bump.yml` bumps that file on eligible pull requests and sets `LATEST_VERSION` in `supabase/functions/_shared/version-config.ts`.

`mobile/package.json` `"version"` is not read by builds and can lag `version.json`. `mobile/app.json` does not set `expo.version` or `ios.buildNumber`; `app.config.js` supplies both, and leaving those static fields out does not change the resolved Expo config. Local `npm run version:patch`, `version:minor`, and `version:major` still rewrite `package.json` and `app.json` via `mobile/scripts/version.js`; `pr-version-bump.yml` does not. Do not treat those files as the app version.

## Version Format

- **Version**: Semantic versioning (MAJOR.MINOR.PATCH)
  - Example: `1.0.0`
- **Build Number**: Incremental integer for each build
  - Example: `1`

## Quick Start

### View Current Version

```bash
npm run version:show
```

### Bump Version

```bash
# Patch release (bug fixes)
npm run version:patch    # 1.0.0 → 1.0.1

# Minor release (new features)
npm run version:minor     # 1.0.0 → 1.1.0

# Major release (breaking changes)
npm run version:major     # 1.0.0 → 2.0.0
```

## How It Works

1. **Version file**: `mobile/version.json` is the single source of truth
2. **Expo config**: `app.config.js` reads `version.json` when the config is evaluated. The version is not copied into `app.config.js`.
3. **Build numbers**: Incremented by `pr-version-bump.yml` and by `npm run version:*`
4. **Unread mirrors**: `package.json` `"version"` is not read by builds. `app.json` omits `expo.version` and `ios.buildNumber` because `app.config.js` overrides them. `scripts/version.js` still rewrites both files on patch/minor/major bumps; the PR workflow does not.

## CI/CD Automation

### Pull request version bump

`.github/workflows/pr-version-bump.yml` runs on pull request `opened`, `synchronize`, `reopened`, and `ready_for_review`.

It does **not** run for draft PRs, or when the title starts with `chore`, `docs`, or `ci`. Pushes to `main` do not increment the build. `.github/workflows/auto-increment-build.yml` is not in this repo.

When the workflow runs, it reads `mobile/version.json` from `origin/main`, bumps the marketing version from the PR title (`feat` → minor, a breaking `!` → major, otherwise patch), sets `buildNumber` to main's build plus one, and commits `mobile/version.json` plus `LATEST_VERSION` in `supabase/functions/_shared/version-config.ts`. It does not update `package.json` or `app.json`.

Fork PRs cannot receive that push. Update `mobile/version.json` locally (`npm run version:build`, or `version:patch` / `version:minor` / `version:major`) and commit it.

## OTA vs store version bumps

`runtimeVersion` follows the `appVersion` policy (`mobile/version.json` →
`expo.version`). An OTA only reaches users already on that marketing version.

- **JS/asset-only fix:** do **not** bump `version.json`. Publish with
  `.github/workflows/publish-ota.yml` (or `eas update --channel …`).
- **Store release:** bump as below, then cut binaries with the release-mobile
  skill. A version bump creates a new runtime; existing users stay on the old
  runtime until they install the new store binary.

See `mobile/EXPO_PUBLISH.md` for eligibility, publish, verify, and rollback.

## Release Workflow

### For Bug Fixes (Patch)
```bash
npm run version:patch
git add mobile/version.json
git commit -m "chore: bump version to 1.0.1"
git tag v1.0.1
git push origin main --tags
```

### For New Features (Minor)
```bash
npm run version:minor
git add mobile/version.json
git commit -m "chore: bump version to 1.1.0"
git tag v1.1.0
git push origin main --tags
```

### For Breaking Changes (Major)
```bash
npm run version:major
git add mobile/version.json
git commit -m "chore: bump version to 2.0.0"
git tag v2.0.0
git push origin main --tags
```

`npm run version:patch`, `version:minor`, and `version:major` also rewrite `mobile/package.json` and `mobile/app.json`. Builds ignore those fields. Commit them only to leave a clean worktree, or discard the edits. `npm run version:build` writes `mobile/version.json` only.

## Files that matter

Builds and the PR workflow use:

- `mobile/version.json` — marketing version and build number
- `mobile/app.config.js` — reads `version.json` at config evaluation (`expo.version`, iOS `buildNumber`, Android `versionCode`)
- `supabase/functions/_shared/version-config.ts` — `LATEST_VERSION`, updated by `pr-version-bump.yml`

Not read by Expo builds:

- `mobile/package.json` `"version"` (left as a package manifest field; it is not the store version)
- `mobile/app.json` — `expo.version` and `ios.buildNumber` are omitted. `app.config.js` overrides them when present, and the public Expo config is the same without them.

## Build Numbers

- Build numbers always increment (never decrease)
- Each version bump increments the build number
- Used by iOS (`CFBundleVersion`) and Android (`versionCode`)
- Required for app store submissions

## Troubleshooting

### Pull request did not bump version.json

`pr-version-bump.yml` skips draft PRs and titles that start with `chore`, `docs`, or `ci`. A skipped job is not a failed build increment. The title must start with `feat`, `fix`, `chore`, `docs`, or `refactor` (optional scope and `!`).

There is no workflow that increments the build on every push to `main`.

If the check failed on a fork, commit `mobile/version.json` yourself. The workflow cannot push to a fork.

### Version file corrupted

**Symptoms:**
- Build fails with "Invalid version.json"
- App won't start
- Version script errors

**Solution:**
```bash
# Option 1: Restore from git
git checkout mobile/version.json

# Option 2: Manually fix
cat > mobile/version.json << EOF
{
  "version": "1.0.0",
  "buildNumber": 1
}
EOF

# Option 3: Use version script to validate
npm run version:show
```

### Invalid version format error

**Error:** `Invalid version format: "1.0"`

**Cause:** Version must be exactly `MAJOR.MINOR.PATCH` format

**Solution:**
```bash
# Fix version format
npm run version:patch  # This will fix and increment
```

### Fork PR cannot be updated by CI

**Error:** `This workflow cannot push to forked repositories.`

Commit `mobile/version.json` on the fork yourself:

```bash
cd mobile
npm run version:build
git add version.json
git commit -m "chore: manual build increment"
git push
```

### Dry-run mode

Test version changes without modifying files:

```bash
node scripts/version.js patch --dry-run
node scripts/version.js build --dry-run
```

## Notes

- Change the app version in `mobile/version.json`, or let `pr-version-bump.yml` rewrite it on an eligible PR
- `package.json` and `app.json` version fields are not the store version
- Use semantic versioning (MAJOR.MINOR.PATCH)
- Tag releases with git tags for tracking
- Version file is validated on read/write
- Atomic file writes prevent corruption
- Production builds fail if version.json is missing/invalid
