# Security policy

Step up is a personal-finance app: a security problem here can expose
someone's money data. Thank you for taking the time to report one.

## Reporting a vulnerability

**Do not open a public issue.** Report it privately through GitHub:
**Security → Report a vulnerability** on this repository. Only the
maintainer sees it.

Please include what you found, how to reproduce it, and what an attacker
could do with it. You'll get an answer as soon as possible; a fix is
prioritised over new features.

## Scope

- The web app published at https://andressarmi11.github.io/step-up/
- The code in this repository, including the Supabase migrations and edge
  functions under `supabase/`

The Supabase anon key and the VAPID and Turnstile public keys in the built
app are public by design — access to data is enforced by Row Level Security
on every table, not by hiding them. Reports about those keys being visible
are out of scope unless they lead to access to someone else's data.
