# Step up

A personal finance app built around pay periods (quincenas — the two
paydays most Colombian salaries run on, the 1st–15th and the 16th–end
of month) and Colombian pesos. It answers three questions in three
seconds: how much do I have left in the pay period starting on the
10th, how much in the one starting on the 25th, and how much for the
month.

Works fully without any account or setup — everything lives on your
device. Installable as a PWA on iPhone. Cloud backup and push
notifications are optional (see below).

## Getting started

```bash
git clone https://github.com/<tu-usuario>/step-up.git
cd step-up
npm install
npm run dev
```

Open `http://localhost:5173/step-up/` and tap "Load sample data" to
see the app working right away.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run preview` | Serves the production build locally |
| `npm run test` | 209 unit tests (Vitest) |
| `npm run test:e2e` | 17 end-to-end flows (Playwright), on Chromium and mobile Safari |
| `npm run preview:iphone` | Opens the app on a simulated iPhone (WebKit); starts the dev server only. `-- --shots` leaves screenshots in `preview-shots/` |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit (includes `typecheck:e2e` separately for `e2e/`) |

## Documentation

| File | What it's for |
|---|---|
| [docs/USER_MANUAL.md](docs/USER_MANUAL.md) | How to use each screen |
| [docs/CUENTA.md](docs/CUENTA.md) | Account, cross-device sync, and Supabase setup |
| [docs/ATAJOS_IOS.md](docs/ATAJOS_IOS.md) | Dictating expenses, and automating from bank SMS with Shortcuts |
| [mobile/README.md](mobile/README.md) | Native Flutter app: port status and how to run it |
| [docs/APP_NATIVA.md](docs/APP_NATIVA.md) | Why PWA-first, and the order of the Flutter port |
| [DEPLOYMENT.md](DEPLOYMENT.md) | From this code to your iPhone, step by step |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How it's put together internally |
| [docs/FINANCIAL_LOGIC.md](docs/FINANCIAL_LOGIC.md) | How every number is calculated |
| [docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md) | How push reminders work |
| [docs/TESTING.md](docs/TESTING.md) | What's tested and how to run it |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Code style guide |
| [CHANGELOG.md](CHANGELOG.md) | Change history by phase |
| [docs/CONTEXT.md](docs/CONTEXT.md) | Memory of decisions across development sessions |

## Stack

React 18 + strict TypeScript + Vite · Dexie (IndexedDB) · Supabase
(Postgres + Auth + Edge Functions, optional) · Recharts · Vitest +
Playwright · vite-plugin-pwa.

## Status

All 17 phases of the original roadmap are complete. See `CHANGELOG.md`
for the detail on each one and `TODO.md` for the optional improvements
still open (real-time multi-device sync, more filters in the
transaction list, savings goals).
