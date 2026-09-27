# Native app (Flutter) and iPhone emulator — status and decision

> **Update:** the port has started. Xcode is already installed and the
> domain layer has been ported with its 75 tests in `mobile/`. See
> [mobile/README.md](../mobile/README.md) for the status and how to run
> it. What follows below is the original decision and it still
> explains the reasoning behind the order of work.

Request: *"create an app I can install directly on my phone [...]
download an emulator to see it directly here [...] I think the best
option is Flutter"*.

Here's what was done, what wasn't, and why.

## What was done

**Installing on the iPhone: already works, without Flutter.** The
project is a complete PWA (`vite-plugin-pwa`, manifest, service
worker, icons, `apple-mobile-web-app-*`). On the iPhone: open the URL
in Safari → **Share** → **Add to Home Screen**. It ends up as an app:
its own icon, full screen with no Safari toolbar, works without
internet (everything lives in IndexedDB), and the Shortcuts URLs
(`docs/ATAJOS_IOS.md`) open it directly instead of the browser.

**Seeing it on an iPhone from here:**

```bash
npm run preview:iphone            # ventana WebKit, iPhone 14 Pro, interactiva
npm run preview:iphone -- --shots # solo capturas en preview-shots/
```

It starts the dev server on its own if none is running, and shuts it
down when the window closes. If you already have one on 5199, it
reuses it.

WebKit is the same engine as iOS Safari, with the iPhone's viewport,
user-agent, and safe-area. For a web app, seeing this is seeing the
app.

**Seeing it on your real iPhone**, which is better than any emulator:
`npm run dev -- --host` prints a network URL; open it from your phone
while on the same WiFi.

## What was NOT done, and why

**The iOS emulator is blocked by something I can't do myself.** It
requires the full Xcode (~17 GB) from the Mac App Store, with your
Apple ID. On this Mac only the Command Line Tools are installed:

```
$ xcode-select -p
/Library/Developer/CommandLineTools
$ xcrun simctl list devices
xcrun: error: unable to find utility "simctl", not a developer tool
```

Without Xcode there's no Simulator, with or without Flutter. And even
if it were installed, a Simulator is a macOS app: it can't be embedded
inside this terminal for you to interact with here.

**The Flutter port wasn't started.** It's not laziness about the
toolchain (`brew install --cask flutter` takes ~10 minutes): it's that
the port rewrites the one thing in this project that's already
proven. Today there are 123 unit tests and 20 E2E tests covering pay
periods, card cycles, recurring items, budgets, concept inference, and
Supabase sync. None of that carries over to Dart: it gets rewritten
from scratch, with no tests, and the initial result is strictly worse
than what's already running.

Flutter is worth it when something the web on iOS can't provide is
needed: home-screen widgets, Face ID, reliable local push
notifications, reading SMS. Of that list, the only thing you asked
for — **logging income without opening the app** — is already solved
with Shortcuts, which can also read the bank's SMS, something a
third-party app can't do on iOS.

## If you still want the port

It's your call and it doesn't need to be re-argued; just start knowing
the size of it:

```bash
brew install --cask flutter
# Xcode: install it yourself from the Mac App Store (~17 GB, asks for your Apple ID)
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -runFirstLaunch
flutter doctor            # debe quedar todo en verde
flutter create --org com.anfe --platforms=ios,android my_finance_app
```

Port order that preserves the value: first `lib/domain/` (dates, pay
period, card, recurring items, totals) **with its tests ported one by
one** — they're pure functions, they translate almost literally and
they're the app's core. Only after that, the screens. The data layer
(Dexie → `sqflite` or `drift`) and the Supabase sync are last and most
expensive.
