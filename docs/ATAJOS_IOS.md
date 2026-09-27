# Automating with iOS Shortcuts

How to log expenses and income from the iPhone without opening the app
and navigating to the form.

## First things first: why a link isn't enough

A Shortcut that opens an `https://…` link **lands in Safari**, not in
the installed app — iOS doesn't know how to route a URL into a web app
on the home screen. And Safari has its own storage, so the expense
ends up on the wrong side.

That's why there's a path that **doesn't open a link**: the Shortcut
sends the text to your inbox, and the app shows it to you for
confirmation. For bank SMS this is better than opening anything: it
doesn't interrupt you, doesn't switch apps, doesn't ask for anything.
And if you also want the app to open, the Shortcut opens it with the
**Open App** action — which does understand installed web apps.

You need to have an account ([CUENTA.md](CUENTA.md)): the inbox is
tied to your account, not to the browser.

---

## The short way: send it the phrase and let the app understand it

```
https://andressarmi11.github.io/step-up/movimientos?texto=TU%20FRASE
```

The app interprets Spanish: it pulls out the amount, the date, the
payment method, and the description, and suggests a category. The
Shortcut doesn't need to build anything.

| You send it | It understands |
|---|---|
| `gasté 45 mil en el almuerzo` | Expense, $45,000, Lunch, today, Food |
| `pagué 120 mil de mercado con la tarjeta` | Expense, $120,000, Groceries, Credit card |
| `me llegaron 2 millones de nómina` | Income, $2,000,000, Payroll |
| `gasté 20 mil en uber ayer` | Expense, $20,000, Uber, yesterday, Transportation |
| `cuarenta y cinco mil en cine` | Expense, $45,000, Movies, Entertainment |

It understands amounts the way people actually say them: `45000`,
`45.000`, `45 mil`, `45k`, `45 lucas`, `cuarenta y cinco mil`,
`1.2 millones`, `dos millones y medio`.

**And it learns.** If you correct the category once, the next time you
mention that same description it already comes out right — it comes
from your own history, not a fixed list.

---

## The long way: field by field

If you'd rather have the Shortcut build each value itself:

```
https://andressarmi11.github.io/step-up/movimientos?nuevo=1&tipo=ingreso
```

| Parameter   | What it does                                | Values                   |
|-------------|----------------------------------------------|--------------------------|
| `nuevo=1`   | Opens the empty form.                        | `1`                      |
| `tipo`      | If you don't set it, expense.                | `ingreso` \| `gasto`     |
| `monto`     | Optional. Digits only.                       | `3000000`                |
| `concepto`  | Optional, URL-encoded.                       | `Sueldo`, `Mercado%20D1` |
| `fecha`     | Optional. If you don't set it, today.        | `2026-09-18`             |
| `pagado=1`  | Marks it as already received / already paid. | `1`                      |

**The link above deliberately doesn't carry an amount**: the Shortcut
appends it at the end. If you'd rather the app ask for it, don't send
`monto` and the form opens ready for you to type it.

> The form opens pre-filled and you tap **Save**. That tap is
> deliberate: a Shortcut reading a bank SMS can misread the amount,
> and a money entry written with nobody looking at it is worse than
> typing it yourself.

---

## Shortcut 1 — Dictate an expense

The most useful one, and it's three steps:

1. **Shortcuts** → **+**.
2. Add **Dictate Text** (Language: Spanish).
3. Add **Text** and paste, putting the *Dictated Text* variable at the end:

   ```
   https://andressarmi11.github.io/step-up/movimientos?texto=[Dictated Text]
   ```

4. Add **Open URLs** with that text.
5. Name it **Log expense**.

Now you say *"Hey Siri, log expense"*, talk normally, and the app opens
the form already filled in.

It also works from the Shortcuts widget or with **Back Tap** (Settings
→ Accessibility → Touch → Back Tap).

> Inside the app you can also speak: the **+** button → **Tell the
> app** has a microphone. No Shortcuts needed there.

**Variant that opens the installed app** (instead of Safari): instead
of *Open URLs*, use **Get Contents of URL** with the dictation address
you copied from Settings, dragging the *Dictated Text* variable to the
end. Then add **Open App** → *Step up*. The transaction is already
waiting for you in the inbox.

---

## Shortcut 2 — From the bank's SMS, without opening anything

**What iOS actually allows and what it doesn't.** No app can read your
messages: iOS doesn't expose that, not to apps and not to Shortcuts.
The only thing possible is an **automation that triggers when a
message arrives** and receives that message. It's automatic from
there on, but the trigger is the SMS arriving, not an app reading your
inbox.

### Before that: get your key

The key comes from **Step up**, meaning your own app — not from
Shortcuts or the Supabase panel.

1. Open <https://andressarmi11.github.io/step-up/> (or the home screen
   icon, if you've already installed it).
2. Sign in with your email and password.
3. **Settings** tab, the last one on the bottom bar.
4. Scroll down to **Automations (Shortcuts)** — it's below *Your
   account*.
5. Tap **Generate key**.

It's shown **only once**. Don't just copy the key: copy the
**full address**, which already has it built in and ends in `&texto=`.
There's a button for each Shortcut (SMS and dictation).

```
https://…/functions/v1/ingest?origen=sms&token=mf_TU_CLAVE&texto=
```

That key is **only** useful for dropping text into your inbox: it
doesn't read your transactions, doesn't read your settings, doesn't
delete anything. If it leaks, the worst that can happen is someone
writes junk into your inbox, which you'll see before confirming it.
Generating a new one invalidates the previous one.

### The automation

1. Shortcuts → **Automation** tab → **+** → **Message**.
2. **Sender**: your bank's number or short name.
   **Contains**: a word that always shows up (`Compra`, `Pagaste`,
   `Recibiste`).
3. Actions:
   - **Get Text from Input** (the message body).
   - **Get Contents of URL**: paste the address you copied and
     **drag the *Text* variable** from the previous step to the end.

     That's it: don't touch the method, the body, or any JSON fields.
     The action defaults to GET and that's correct.
4. Turn on **Run Immediately**.

Done. The Shortcut opens nothing. The next time you open the app
you'll see **"1 transaction arrived on its own"** at the top, you
review it and log it with one tap.

**No regular expression needed**: you pass it the raw SMS and the app
interprets it. It already recognizes the typical formats:

```
Bancolombia le informa Compra por $145.000 en EXITO 18/09/2026 14:32
Nequi: Pagaste $12.500 a RAPPI
Bancolombia: Recibiste $2.800.000 por NOMINA
```

It pulls out the amount, the merchant, the date from the message, and
whether it was a purchase or a deposit. The bank's name doesn't end up
as the description.

> The confirmation tap is deliberate: the amount was written by your
> bank in a format that can change without notice. A money entry that
> goes in without anyone looking at it is worse than typing it
> yourself.

### If you also want the app to open

Add the **Open App** action at the end of the Shortcut and pick *Step
up*. That action does understand web apps installed on the home
screen (links don't). The app opens with the transaction already
waiting for you in the inbox.

If *Step up* doesn't show up in the list, you haven't installed it
yet: Safari → **Share** → **Add to Home Screen**.

## And is there no link that installs the Shortcut on its own?

Short answer: not really, and it's worth knowing why before looking
for one.

- **iCloud links** (`icloud.com/shortcuts/…`) are generated by the
  Shortcuts app from a device with an iCloud session. They can't be
  manufactured from outside.
- **A `.shortcut` file** can actually be manufactured, but iOS only
  imports unsigned ones (not signed by Apple) if you enable *Allow
  Untrusted Shortcuts*, and that changes depending on the iOS version.
  I don't have an iPhone to test it on, so I'm not going to hand you a
  file claiming it works without having seen it work.
- **Personal automations** (the SMS one) **can't be shared or
  imported**, period. It's an Apple decision: a shortcut that only
  triggers on receiving a message has to be built by the phone's
  owner. Neither I nor anyone else can send it to you pre-built.

That's why the effort went into making the manual setup short: the app
gives you the address **already with your key inside**, and the
Shortcut ends up with a single action and a single paste.

---

## Shortcut 3 — One-tap fixed expense

For things you always spend the same amount on:

```
https://andressarmi11.github.io/step-up/movimientos?texto=pasaje%2012%20mil
```

A single **Open URLs** step. Set it as a widget and it's one tap.

---

## Why it doesn't use artificial intelligence

The interpretation runs **on your phone, offline and at no cost**.
There's no language model and no API call.

That's deliberate: for money, an interpretation that can change on its
own between two runs isn't what you want. And an API key can't live in
the code of a public website without being exposed.

What the app learns, it learns from **your** history: every time you
save, it remembers which category and which method you used for that
description.

If someday the list of phrases falls short, the path forward would be
a Supabase Edge Function that talks to a model — the key stays on the
server side. It has a per-use cost and needs internet; that's why it's
not the starting point.
