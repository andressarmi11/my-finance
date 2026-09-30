## [Unreleased] — Redesign v4, phase 8: sign-in

Plan and checklist: `docs/rediseno/REDISENO.md` (§12, phase 8; §9f "Login y
registro", §9g 2d, §9h).

### Changed
- Sign-in screen (§9f), same auth logic (password sign-in, sign-up,
  `resetPasswordForEmail`, `translateError`, captcha token): left-aligned,
  no card; the 60px 1c logo tile; a big title per mode ("Hola de nuevo",
  "Crea tu cuenta", "Recupera tu contraseña") and a subtitle; the shared
  `Segmented` control for "Ya tengo cuenta | Crear cuenta" (still
  `aria-pressed`; the sign-up submit is now "Crear mi cuenta" so no two
  controls share a name); fields with the label above and a mail/lock icon;
  an eye button to show or hide the password; "¿Olvidaste tu contraseña?"
  right-aligned; the footer "Tus datos viven en tu teléfono y se respaldan
  en tu cuenta. Sin anuncios ni rastreo."
- The primary button stays disabled (grey) until the form is valid: a
  well-formed email, plus a password to sign in, or — to sign up — a
  password of at least 8 characters and the accepted terms.
- Turnstile renders with `appearance: 'interaction-only'`, inside a discreet
  row ("Verificación de seguridad lista · Cloudflare") that shows
  "Verificando…" until the token arrives.
- The recovery-link notice is translated (it was Spanish-only).

### Added
- Sign-up: a 4-segment strength meter and a required "Acepto los Términos y
  la Política de privacidad" checkbox, linking to `/legal/terminos` and
  `/legal/privacidad` (opened in a new tab so the form isn't lost).
- `components/ui/PasswordStrength`: `passwordStrength(pw)` → 0 empty ·
  1 "Muy corta" (< 8) · 2 "Débil" · 3 "Buena" · 4 "Fuerte", scored by length
  ≥ 12 and how many of lowercase/uppercase/digits/symbols it mixes; the
  `<PasswordStrength value>` meter (`role="meter"`).
- Desktop (≥ 1100px) split screen (§9g 2d, §9h): a brand panel with a
  typewriter headline ("Tu plata," + "quincena a quincena." ↔ "mes a mes.";
  "paycheck by paycheck." ↔ "month by month." in English; 80ms per letter,
  2s hold, 40ms deleting, blinking 4px cursor), a preview of Inicio's number
  on **sample data** labelled "Datos de ejemplo" that rotates every 3.4s
  through the four `DEMO_MONTHS` (`features/auth/demo.ts`) with
  `AnimatedNumber` (700ms, ease-out cubic), and three points (offline,
  privacy, no tracking). The form sits on the right at 400px. With
  `prefers-reduced-motion`, the first phrase is shown fixed and the card
  doesn't rotate. Phones and tablets get the form only.

### Tests
- Unit: `passwordStrength` levels.
- E2E updated: 28 (exact "Contraseña" label and "Entrar" button, now that
  the eye button is named "Mostrar contraseña"). New: 45 (tabs switch the
  title and never share a name with the submit button; sign-up disabled
  until email + password + terms; eye toggle; sign-in validity; forgot
  password sends the link with the captcha token; desktop split panel with
  "Datos de ejemplo", rotation and typewriter at 1280px; reduced motion;
  English). It runs in the `cloud-sync` project (the only build with the
  sign-in screen): `CLOUD_SYNC` in `playwright.config.ts` now also matches
  `login-redesign`.
