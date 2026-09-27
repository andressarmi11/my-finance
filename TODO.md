# TODO

## The 17 phases of the original roadmap are complete
See CHANGELOG.md for the detail of each one.

## Optional improvements for later (none block anything current)
- [ ] Real-time multi-device sync (today it's manual, on demand, from
      Settings → Cloud)
- [ ] Filters on the Transactions list by category/method/date range
      (today there's only text search)
- [ ] Savings goals, net worth, multiple accounts/cards — the data model
      is already designed to support it without breaking anything
- [ ] E2E tests for the notifications Edge Function (today it's tested
      with the `curl` in docs/NOTIFICATIONS.md)
- [ ] Run the E2E tests in an environment with access to
      `cdn.playwright.dev`, to confirm them locally before the first push
      (they run fine on GitHub Actions)

## Technical notes for whoever picks this project up
- `node_modules` has to live on a local disk during development, not on a
  network mount — see docs/CONTEXT.md if that doesn't make sense otherwise.
- Before adding up or grouping transactions by period, run them through
  `withResolvedPeriods()` (`domain/period/resolve.ts`).
- Any new calculation goes in `domain/`, with its tests next to it — see
  CONTRIBUTING.md.
