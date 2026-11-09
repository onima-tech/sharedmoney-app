# Version Management Guide

## Overview

SharedMoney uses a centralized version management system. The version is stored in `version.json` and automatically synced to `app.config.js` and `package.json`.

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

1. **Version File**: `mobile/version.json` is the single source of truth
2. **Auto-Sync**: `app.config.js` reads from `version.json` automatically
3. **Build Numbers**: Automatically incremented when you bump version
4. **Package.json**: Version script also updates `package.json` for consistency

## CI/CD Automation

### Automatic Build Number Increment

Build numbers are **automatically incremented** when you push to the `main` branch.

**How it works:**
- Push any code change to `main`
- CI/CD detects the push
- Build number increments automatically (1 → 2 → 3...)
- Version stays the same unless manually bumped

**Skip auto-increment:**
- Add `[skip ci]` or `[skip build]` to your commit message
- Example: `git commit -m "docs: update README [skip ci]"`

**Manual version bumps:**
- When you run `npm run version:patch/minor/major`, CI/CD detects the manual change and skips auto-increment
- Manual bumps increment both version AND build number

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
git add mobile/version.json mobile/package.json
git commit -m "chore: bump version to 1.0.1"
git tag v1.0.1
git push origin main --tags
```

### For New Features (Minor)
```bash
npm run version:minor
git add mobile/version.json mobile/package.json
git commit -m "chore: bump version to 1.1.0"
git tag v1.1.0
git push origin main --tags
```

### For Breaking Changes (Major)
```bash
npm run version:major
git add mobile/version.json mobile/package.json
git commit -m "chore: bump version to 2.0.0"
git tag v2.0.0
git push origin main --tags
```

### Regular Development (Build Number Only)
```bash
# Just push to main - build number increments automatically!
git add .
git commit -m "feat: add new feature"
git push origin main

# CI/CD automatically:
# - Increments build number
# - Commits: "ci: auto-increment build number to X [skip ci]"
# - Pushes back to main
```

## Files Modified

When you run a version command, these files are updated:
- `mobile/version.json` - Version and build number
- `mobile/package.json` - Version (for consistency)

The `app.config.js` reads from `version.json` at build time, so no manual update needed.

## Build Numbers

- Build numbers always increment (never decrease)
- Each version bump increments the build number
- Used by iOS (`CFBundleVersion`) and Android (`versionCode`)
- Required for app store submissions

## Troubleshooting

### Build number not incrementing

**Check GitHub Actions:**
- Go to GitHub Actions tab
- Check if workflow ran successfully
- Look for errors in the logs

**Common issues:**
- Workflow file not in `.github/workflows/` directory
- Commit message contains `[skip ci]` or `[skip build]`
- Version file was manually updated in the same commit
- Workflow file itself was changed (triggers are ignored)

**Solution:**
```bash
# Check workflow file exists
ls -la .github/workflows/auto-increment-build.yml

# Check recent commits
git log --oneline -5

# Manually trigger by making a small change and pushing
echo "# test" >> README.md
git add README.md
git commit -m "test: trigger build increment"
git push origin main
```

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

### CI/CD push failures

**Error:** `Failed to push after 3 attempts`

**Causes:**
- Network issues
- Merge conflicts
- Permission problems

**Solution:**
```bash
# Check git status
git status

# Pull latest and resolve conflicts
git pull origin main

# Manually increment if needed
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

- Version is synced automatically - don't edit manually
- Build numbers increment automatically
- Use semantic versioning (MAJOR.MINOR.PATCH)
- Tag releases with git tags for tracking
- Version file is validated on read/write
- Atomic file writes prevent corruption
- Production builds fail if version.json is missing/invalid
