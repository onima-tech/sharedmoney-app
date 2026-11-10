---
name: release-mobile
description: >-
  Release the ShareMoney Expo mobile app (Android + iOS) from latest origin/main
  via EAS production builds and submit to Play internal / TestFlight.
  Use when the user asks to release mobile, ship an Android/iOS app store build,
  cut a mobile release, bump and submit from main, or run the EAS production
  release for ShareMoney.
---

# Release mobile (from origin/main)

Ship Android + iOS from **latest `origin/main`**, not a stale WIP branch. Build
the store artifacts locally first, then use EAS only to submit/release those
local artifacts to Play/TestFlight. Use the GitHub Actions cloud-build workflow
only as a fallback after local build prerequisites are missing and the user
explicitly agrees.

## Store vs OTA

Decide **before** bumping `version.json` or building binaries:

- **OTA** (`.github/workflows/publish-ota.yml`, default channel `preview`):
  JS/asset-only changes for users already on the live store marketing version.
  Do **not** bump `mobile/version.json`. Devices download on launch and apply
  on the next cold start. See `mobile/EXPO_PUBLISH.md`.
- **Store release** (this skill): new/changed native modules, Expo SDK,
  config plugins, permissions, icons/splash, push native config, New
  Architecture, or a new marketing version.

OTA only reaches binaries built with `checkAutomatically: ON_LOAD` whose
`appVersion` matches `mobile/version.json` at publish time. Older marketing
versions need a store update (or the HTTP 426 force-upgrade path).

## Identifiers

| | |
| --- | --- |
| Android package | `com.vaibhavarora.sharemoney` |
| iOS bundle | `com.vaibhavarora.sharemoney` |
| Expo | `share-money` / `share-money` (`app.config.js` owner/slug) |
| EAS project | `afddb7db-3d7d-46da-a1b5-0d6e4b4374ce` |
| ASC app id | `6755923591` (`mobile/eas.json` → `submit.*.ios.ascAppId`) |

## Checklist

```
Release progress:
- [ ] 1. Inspect git (mods, stashes, .aab/.ipa) — do not destroy stashes
- [ ] 2. Fetch origin/main; branch release/mobile-X.Y.Z from it
- [ ] 3. Decide / apply marketing version bump
- [ ] 4. Draft release notes for TestFlight + Play
- [ ] 5. Quality gate (install, TypeScript, expo-doctor, config)
- [ ] 6. Build local Android `.aab`
- [ ] 7. Build local iOS `.ipa`
- [ ] 8. Submit/release local artifacts with `eas submit --path`
- [ ] 9. Add and verify release notes in Play Console and App Store Connect
- [ ] 10. Report artifact paths, submission status, notes, and manual follow-ups
```

## 1. Inspect worktree

```bash
git status
git stash list
git branch -vv
ls -la mobile/build-*.aab mobile/build-*.ipa mobile/*.aab mobile/*.ipa 2>/dev/null || true
```

- Note local mods, untracked build artifacts, and stashes.
- In zsh, use `setopt null_glob` first or `find mobile -maxdepth 1 ...`; plain
  unmatched globs error before `2>/dev/null`.
- **Never drop/pop stashes** unless the user asks. Leave unrelated stashes alone.
- Prior `build-*.aab` / `build-*.ipa` may be moved aside (e.g. `/tmp/…`) so new
  artifacts are unambiguous; do not delete without asking.

## 2. Release branch from latest main

```bash
git fetch origin main
git checkout -B release/mobile-X.Y.Z origin/main
```

Replace `X.Y.Z` with the **target marketing version**. Do not release from a
feature/WIP branch that is behind `origin/main`.

## 3. Versioning

Sources of truth:

- Effective Expo config: `mobile/app.config.js`.
- Marketing version and build number: `mobile/version.json` only.
  `mobile/app.config.js` reads it. `.github/workflows/pr-version-bump.yml`
  bumps it on eligible pull requests.
- `mobile/package.json` `"version"` is not read by builds and can lag.
  `mobile/app.json` omits `expo.version` and `ios.buildNumber`; `app.config.js`
  sets both from `version.json`. Local `npm run version:patch`, `version:minor`,
  and `version:major` still rewrite those files; the PR workflow does not.
  Do not ship from those numbers.
- Keep root and mobile lockfiles in sync when dependencies change.
- Android `versionCode` / iOS `buildNumber`: from `mobile/version.json`
  through `app.config.js`; `mobile/eas.json` does **not** use remote
  `appVersionSource` in the current repo.

Bump marketing patch when needed:

```bash
cd mobile && npm run version:patch
```

- If main already has the bump (e.g. via a feature PR / CI bump job), skip the
  commit and use that version for the branch name.
- If you bump on the release branch: commit with HEREDOC (repo style), push,
  open/merge PR as needed. Example subject:
  `chore(mobile): bump version to X.Y.Z`
- **Never** force-push, skip hooks, or update git config.
- Confirm with `cd mobile && npx expo config --type public`; check
  `expo.version`, `ios.buildNumber`, and `android.versionCode`.

## 4. Release notes

Draft concise user-facing notes before building, sourced from the PR(s) being
released and any hotfix context from the user.

Recommended local scratch file:

```bash
cat > /tmp/sharemoney-mobile-release-notes.txt <<'EOF'
Monthly pending balance reminders are now available, helping groups follow up
on open balances more easily.
EOF
```

Guidelines:

- Keep notes factual and user-facing; avoid PR numbers, implementation details,
  or promotional language.
- Android Play release notes are limited to 500 Unicode characters per language.
  Use `<en-US>...</en-US>` if entering notes manually in Play Console.
- Treat release notes as a **required release step**, not a manual follow-up.
  EAS Submit uploads binaries but does not reliably add notes to either store.
  After each successful submission, add the drafted text in the relevant store
  console and verify the saved text is visible before declaring the release complete.
- Android: open Play Console in the in-app browser, go to the submitted track
  and version code, enter the English (US) release notes, save them, and verify
  the saved notes. `--profile production` and `--profile internal` both land on
  the Play internal track, so update that internal release. Update the public
  production release only after `eas submit --profile store`. Do not claim
  notes were added merely because the AAB upload succeeded.
- iOS: after App Store Connect finishes processing the upload, open the build in
  TestFlight, populate **What to Test** with the drafted notes, save, and verify
  the saved text. If Apple processing has not completed, wait or report the
  precise pending state and keep the browser open for handoff.
- If browser authentication, permissions, or a store-side validation blocks the
  edit, stop and report the blocker. Never silently downgrade the requirement to
  a suggested manual task. Do not use `eas submit --what-to-test` by default;
  add TestFlight notes in App Store Connect instead.

## 5. Quality gate

From `mobile/`:

```bash
npm ci
npx tsc --noEmit
npx expo-doctor
npx expo config --type public
```

Fix failures before building. As of 2026-08-02, `mobile/package.json` does not
declare `lint`, `typecheck`, or unit-test scripts; use the commands above unless
the repo adds package scripts. Existing `npm audit` findings are not fixed by the
release flow unless the user asks.

## 6. Local build prerequisites

Local builds are the default release path. Verify these before building:

```bash
cd mobile
npx eas-cli@latest whoami
test -f .env.production || test -f /Users/vaibhavarora/ShareMoney2/mobile/.env.production
xcodebuild -version
java -version
find . -maxdepth 1 -type f \( -name 'build-*.aab' -o -name 'build-*.ipa' -o -name '*.aab' -o -name '*.ipa' \) -print
```

- Use remote EAS signing credentials during local builds when available.
- Source production env before every local build. If the release worktree lacks
  `mobile/.env.production`, use `/Users/vaibhavarora/ShareMoney2/mobile/.env.production`.
- Move old artifacts aside instead of overwriting them silently.
- Abort and fix if `npx expo config --type public` shows `expo-dev-client` in
  the production plugin list. Production binaries must not include dev-client.

## 7. Build local artifacts

Use deterministic artifact names with marketing version and build number:

```bash
cd mobile
VERSION=$(node -p "require('./version.json').version")
BUILD=$(node -p "require('./version.json').buildNumber")
ENV_FILE=".env.production"
[ -f "$ENV_FILE" ] || ENV_FILE="/Users/vaibhavarora/ShareMoney2/mobile/.env.production"

set -a
source "$ENV_FILE"
set +a
export EXPO_PUBLIC_DEFAULT_CURRENCY="${EXPO_PUBLIC_DEFAULT_CURRENCY:-INR}"
export EAS_BUILD=true

npx eas-cli@latest build \
  --platform android \
  --profile production \
  --local \
  --non-interactive \
  --clear-cache \
  --output "./build-${VERSION}-${BUILD}.aab"

npx eas-cli@latest build \
  --platform ios \
  --profile production \
  --local \
  --non-interactive \
  --clear-cache \
  --output "./build-${VERSION}-${BUILD}.ipa"
```

- Build Android first. It validates env, Expo config, JS bundling, and Android
  credentials faster than iOS.
- If a build is interrupted or fails after generating a temp native directory,
  clean the temp output/artifact and rerun from the release branch.
- Do not submit artifacts built from a dirty worktree unless the dirty files are
  only untracked final `.aab`/`.ipa` outputs.

## 8. Submit/release with EAS, then apply release notes

Submit only the local artifacts. Do not rebuild in EAS cloud during submit:

```bash
cd mobile
VERSION=$(node -p "require('./version.json').version")
BUILD=$(node -p "require('./version.json').buildNumber")
AAB="./build-${VERSION}-${BUILD}.aab"
IPA="./build-${VERSION}-${BUILD}.ipa"

test -f "$AAB"
test -f "$IPA"

npx eas-cli@latest submit \
  --platform android \
  --profile production \
  --path "$AAB" \
  --non-interactive \
  --wait

npx eas-cli@latest submit \
  --platform ios \
  --profile production \
  --path "$IPA" \
  --non-interactive \
  --wait
```

- Android `--profile production` submits to the Play **internal** track.
  `mobile/eas.json` sets `submit.production.android.track` to `internal`
  because EAS selects the `production` submit profile by default when it
  exists. `--profile internal` is the same internal track. Only
  `eas submit --profile store` targets the public Play production track, and
  only after an internal release has been reviewed. See `mobile/RELEASE.md`.
- iOS `production` uploads to App Store Connect/TestFlight. Apple processing,
  beta review, and App Store review can continue after EAS submit returns
  success. Do not pass `--what-to-test` by default; EAS treats changelog
  submission as an Enterprise-only feature on some accounts.
- If submit fails after a valid local artifact is produced, rerun only
  `eas submit --path`; do not rebuild unless the artifact itself is invalid.

### Mandatory store-note application

Once both submissions finish, use the in-app browser to apply the notes drafted
in Step 4. Prefer a store API or CLI only when it explicitly supports editing
the required note field; otherwise use the browser UI.

1. **Play Console:** choose the exact submitted track and version code, enter
   the English (US) notes, save, then re-open the release details and confirm
   the text persisted.
2. **App Store Connect:** wait for the exact iOS build to finish processing,
   choose it in TestFlight, enter **What to Test**, save, then re-open it and
   confirm the text persisted.
3. Record the store URLs and the exact note text in the final report. If either
   store cannot be updated, report it as a release blocker with the precise
   state and leave the relevant browser tab open for the user.

## 9. Fallback cloud workflow

Use `.github/workflows/deploy-mobile.yml` only when local builds are impossible
and the user agrees to fall back to cloud builds:

```bash
gh workflow run deploy-mobile.yml \
  --ref release/mobile-X.Y.Z \
  -f platform=all \
  -f submit=true \
  -f submit_profile=internal \
  -f create_github_release=false \
  -f git_ref=release/mobile-X.Y.Z
gh run watch <run-id> --interval 30 --exit-status
```

## 10. Report

Return:

- Marketing version + Android `versionCode` + iOS `buildNumber`
- Local artifact paths and file sizes
- EAS submission status for Android and iOS
- Play internal + TestFlight / ASC links when available
- Release notes text, store URLs, and explicit verification that it was applied
  to the submitted Android track and TestFlight build
- Manual follow-ups: Apple processing, device smoke-test (sign-in, sync,
  Spend widget), **Submit for Review** / promote beyond internal remain manual

## Docs (read when stuck)

- `mobile/eas.json` — profiles + submit config
- `mobile/app.config.js` and `mobile/version.json` — effective Expo versioning
- `.github/workflows/deploy-mobile.yml` — fallback cloud build/submit workflow
- `.github/workflows/submit-mobile.yml` — retry existing EAS build submission
