# Step Up — notes for Claude

## Versioning (always)

- Semantic Versioning in `package.json` (`npm version X.Y.Z --no-git-tag-version`,
  which also updates `package-lock.json`). The app shows it in Ajustes and the
  legal pages (`VITE_APP_VERSION`, from vite.config.ts).
  - PATCH (1.4.0 → 1.4.1): fixes only.
  - MINOR (1.4.x → 1.5.0): new features, backwards compatible.
  - MAJOR (→ 2.0.0): breaks existing data, sync or flows.
- Every PR that changes the app bumps the version and adds its entry to
  `CHANGELOG.md` under the new version with the date: `## [1.4.1] — YYYY-MM-DD`.
  Test-only or docs-only PRs don't bump.

## Every change

- Its own branch and PR to `main`; merge when CI is green.
- `npm run typecheck && npm run lint && npm test && npm run test:e2e` green.
- New text goes in `src/i18n/texts.ts`, Spanish and English.
- Update the e2e when behaviour changes; never delete tests.
- If `src/features/inbox/pushText.ts` or the `inbox.push*` texts change,
  regenerate `supabase/functions/ingest/pushText.gen.js`
  (`node scripts/build-push-text.mjs`) and the Edge Function has to be redeployed.
