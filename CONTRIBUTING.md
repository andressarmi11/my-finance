# Contributing (the project's style guide)

This is a personal project, but these rules exist so that you (or someone
else) can pick it up again in six months without having to re-read all the
code first.

## The non-negotiable rule: `domain/` doesn't know React exists

Anything that is a business rule or a calculation goes in `src/domain/`, as
a pure function: same arguments, same result, always. Never `new Date()`
without taking the date as a parameter, never an `import` from React, Dexie
or Supabase. That's what lets the tests run in under 4 seconds without
starting anything up.

If you're writing a calculation inside a `.tsx` component, that's the sign
it belongs in `domain/`.

## Folder structure

```
src/
  domain/       pure logic, with its tests next to it (*.test.ts)
  data/         Dexie (local), Supabase (cloud), sync, backup
  features/     one folder per screen/feature
  components/ui/ pieces reused across screens
  app/          router, layout, theme
  lib/          small utilities with no category of their own (UI dates, etc.)
```

A new calculation goes in `domain/<topic>/`. A new component used by a
single screen goes in `features/<screen>/`. Something reused in 3+ screens
goes in `components/ui/`.

## Before a commit

```bash
npm run typecheck
npm run typecheck:e2e   # if you touched anything in e2e/
npm run lint
npm run test
npm run build
```

All of them have to pass clean. There are no informal exceptions along the
lines of "I'll fix it later" — this project's `CHANGELOG.md` documents more
than one real case where running this caught a bug (or a badly written
test) before it reached production.

## Adding a new domain function

1. Write the function in `domain/<topic>/file.ts`, with a comment
   explaining the *why*, not just the what.
2. Write `file.test.ts` next to it, covering at least: the normal case, an
   edge case (boundary date, zero, empty list), and where it applies, a
   case that crosses a month/year.
3. Run `npm run test` before wiring it into any component.

## Commit messages

No strict format like Conventional Commits — but do describe **what
changed**, not "fixes" or "various changes". If you fixed a bug you found
by running the tests, say so — that's useful information for the
`CHANGELOG.md`.

## Branches

For a one-person project, working directly on `main` is fine as long as
every commit passes the list above. If you want to try something large
without committing to it, use a branch and open a PR to yourself — CI runs
either way.
