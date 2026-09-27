# Step up — native app (Flutter)

Native port of the web app that lives at the repo root. They share the
same Supabase project, the same schema, and the same business logic.

## Status

| Layer | Status |
|---|---|
| `lib/domain/` — dates, pay periods, card cycle, recurring items, totals, money | ported |
| `lib/data/` — local SQLite, with deletion tombstones | done |
| `lib/features/dashboard/` — home screen | done |
| Transactions, entry form, initial setup | next |
| Supabase sync | later |

86 tests, clean `flutter analyze`.

## Running the tests

```bash
cd mobile
flutter test       # 86 tests, needs neither Xcode nor a simulator
flutter analyze    # no warnings
```

---

## Running on the simulator

```bash
cd mobile
flutter run
```

If there are several targets, pick one:

```bash
flutter devices                 # lista lo conectado
flutter run -d "iPhone 18 Pro"  # or the long id it prints
```

While it's running: `r` hot-reloads, `R` restarts the app, `q` quits.

**To see the simulator window:** open Xcode and go to the menu
**Xcode → Open Developer Tool → Simulator**. On this machine `open -a
Simulator` doesn't work: Xcode 27 no longer leaves `Simulator.app`
loose where it used to be, so the Xcode menu is the way to go.
`flutter run` still works even if the window isn't open — it starts
the simulator in the background.

To capture the screen without opening anything:

```bash
xcrun simctl io booted screenshot captura.png
```

### If the simulator doesn't show up

```bash
flutter doctor            # iOS has to be green
xcrun simctl list runtimes   # has to list at least one iOS
```

If there are no runtimes: `xcodebuild -downloadPlatform iOS` (it's
several GB and takes a while; it prints nothing while downloading).

---

## Installing it on your iPhone

You can do this with a regular, free Apple ID, with one important
limitation worth knowing before you start: **the app stops opening
after 7 days** and you have to reinstall it. That's an Apple rule for
free accounts, not something about the project. With the Apple
Developer Program (US$99/year) it lasts a year and you can also
install it over TestFlight without a cable.

### One time only

1. Open the project in Xcode:

   ```bash
   open mobile/ios/Runner.xcworkspace
   ```

   Note: the `.xcworkspace`, not the `.xcodeproj`.

2. **Xcode → Settings → Accounts → +** and add your Apple ID.

3. In the left panel choose **Runner**, **Signing & Capabilities** tab:
   - check **Automatically manage signing**
   - under **Team** choose your name (*Personal Team*)
   - if it complains about the **Bundle Identifier**, change
     `com.mrunknown.myFinance` to something else: it has to be unique
     worldwide, so add something of your own to it.

4. On the iPhone, turn on developer mode:
   **Settings → Privacy & Security → Developer Mode → turn on**.
   It asks you to restart the phone.

### Every time you want to install it

5. Connect the iPhone by cable, unlocked. The first time, the phone
   asks whether you trust the computer: say yes.

6. ```bash
   cd mobile
   flutter devices          # your iPhone now shows up
   flutter run -d "<tu iPhone>"
   ```

   (Or Xcode's ▶ button, same thing.)

7. The first time, the iPhone refuses to open it because the
   certificate is yours and not the App Store's. Go to
   **Settings → General → VPN & Device Management**, tap your Apple ID
   and **Trust**.

Done: it ends up on the home screen as "Step up", and works without a
cable and without internet.

### When it stops opening (after 7 days)

Reconnect the cable and run `flutter run -d "<tu iPhone>"` again.
The data **isn't lost**: it's still in the app's database.

---

## Note: this app doesn't sync yet

The native one saves everything on the phone, period. It doesn't talk
to Supabase yet, so **it doesn't share data with the web app**. That's
next on the list. In the meantime, the one that syncs across devices
is the web app (see [docs/CUENTA.md](../docs/CUENTA.md)).

And it starts with sample transactions, because the form for adding
new ones doesn't exist yet.

## Why the domain layer was ported first

It's the only thing that translates almost literally and the only
thing that was already tested: pure functions over dates and
integers, with no UI and no database. Porting it first means that once
the screens arrive, the part that can actually get someone's money
wrong already has 75 tests behind it.

## Parity with the web app

There's one place where the two apps could quietly diverge:
**money formatting**. Dart's CLDR data isn't the same as the
browser's (es-PE groups digits differently, es-CO puts the symbol on
the other side, es-ES doesn't group 4-digit numbers). That's why
neither app uses its platform's currency formatter: both have the same
explicit table, and both verify it with the same seven test cases.

- `mobile/lib/domain/money/format.dart`
- `src/domain/money/format.ts`

If you change one, the other one's test fails. That's on purpose.
