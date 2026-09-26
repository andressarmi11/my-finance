# Fase 1 — Design Tokens v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar `src/styles/tokens.css` con un sistema de tokens iOS 18 nativo (SF Pro, colores del sistema, springs, materiales, shadows) manteniendo backward-compat con call sites existentes (mismos nombres `--step-N`, `--q10`, `--surface`, etc.).

**Architecture:** Change único a un archivo CSS. Todas las pantallas actuales adoptan automáticamente los nuevos valores porque usan `var(--x)`. Sin tocar componentes React. Cero riesgo de romper lógica; único riesgo es visual (que es el objetivo).

**Tech Stack:** CSS custom properties. Sin dependencies nuevas. SF Pro Rounded viene con iOS/macOS por default — no requiere `@font-face`.

**Spec:** [`docs/superpowers/specs/2026-09-17-visual-ux-overhaul-mobile-design.md`](../specs/2026-09-17-visual-ux-overhaul-mobile-design.md) (Sección "Fase 1 — Design tokens v2").

## Global Constraints

- **Backward-compat obligatoria**: los tokens actuales (`--step-0`, `--step-3`, `--q10`, `--surface`, `--paper`, `--font-ui`, `--font-figures`, `--radius-s/m/l`) DEBEN seguir existiendo con nombres idénticos, aunque sus valores cambien. Renombrar rompe 81 call sites en `src/`.
- **Dark mode paridad**: cualquier token nuevo del modo claro debe tener su equivalente en `prefers-color-scheme: dark` y en `[data-theme='dark']` (ambos bloques existen y deben mantenerse en paridad).
- **iOS 15.4+ baseline**: el proyecto ya usa `body:has([role="dialog"])` (`src/styles/index.css:47`), así que asumimos Safari 15.4 mínimo. Podemos usar `color-mix()`, `backdrop-filter`, `env(safe-area-*)` sin fallback.
- **Font stack sin @font-face**: SF Pro y SF Pro Rounded están disponibles nativamente en iOS/macOS. En desktop web no-Apple caen al fallback (system-ui). No importamos fuentes externas.
- **No tocar componentes React**: este plan cambia únicamente `src/styles/tokens.css`. Cualquier ajuste a componentes es scope de Fases 2-5.
- **Todos los tests actuales deben pasar** sin modificaciones (104 unit + 8 E2E).

---

### Task 1: Reemplazar tokens.css con sistema iOS 18

**Files:**
- Modify: `src/styles/tokens.css` (reemplazo completo)

**Interfaces:**
- Consumes: nada (primer task del plan).
- Produces: variables CSS que serán consumidas por Fases 2-5. Los nombres retro-compatibles siguen funcionando:
  - `--paper`, `--surface`, `--surface-sunken` (backgrounds)
  - `--text`, `--text-muted`, `--text-faint` (colores de texto)
  - `--line`, `--line-strong` (bordes)
  - `--q10`, `--q10-soft`, `--q25`, `--q25-soft` (acentos de quincena)
  - `--positive`, `--positive-soft`, `--committed`, `--danger`, `--danger-soft` (semánticos)
  - `--font-ui`, `--font-figures` (font stacks)
  - `--step--1` .. `--step-4` (escala tipográfica antigua)
  - `--gap-xs` .. `--gap-xl` (spacing)
  - `--radius-s`, `--radius-m`, `--radius-l` (radios)
  - `--safe-top`, `--safe-bottom`, `--tap` (misceláneos)
- Produces también variables nuevas para Fases 2-5:
  - Escala de grises iOS: `--gray-50` .. `--gray-950`
  - Escala tipográfica iOS: `--text-xs`, `--text-sm`, `--text-base`, `--text-md`, `--text-lg`, `--text-xl`, `--text-2xl`, `--text-3xl`
  - Materiales: `--material-thin`, `--material-regular`
  - Motion: `--ease-spring-out`, `--ease-spring-in-out`, `--dur-fast`, `--dur-med`, `--dur-slow`
  - Radios: `--radius-xl` (nuevo)
  - Elevación: `--shadow-1`, `--shadow-2`, `--shadow-3`
  - Line-heights: `--lh-tight`, `--lh-normal`, `--lh-loose`
  - Colores extra iOS: `--warning`, `--warning-soft`

- [ ] **Step 1: Leer el estado actual del archivo**

Run: `cat src/styles/tokens.css`

Expected: ver el archivo actual (99 líneas). Confirma que se van a reemplazar TODOS los valores de `:root`, del `@media (prefers-color-scheme: dark)`, y del `[data-theme='dark']`.

- [ ] **Step 2: Escribir el nuevo tokens.css completo**

Reemplazar el archivo con este contenido exacto (copia literal):

```css
/* ---------------------------------------------------------------
   My Finance — sistema visual v2 (iOS 18 native)
   Identidad: la app se organiza por QUINCENAS, así que cada quincena
   tiene su propio color, ahora alineado a los SystemColors de iOS.
     Quincena del 10 -> SystemBlue (#007AFF)
     Quincena del 25 -> SystemOrange (#FF9500)
   Tipografía: SF Pro Text (UI) + SF Pro Rounded (números), nativa en
   iOS/macOS, sin @font-face. Fallback a system-ui en desktop no-Apple.
   Motion: springs iOS (--ease-spring-out).
   Retro-compat: los nombres `--step-N`, `--q10`, `--surface`, etc.
   siguen existiendo — call sites de Fases 1-12 no se rompen.
----------------------------------------------------------------- */

:root {
  /* ────────────── Grises iOS System (light) ────────────── */
  --gray-50:  #F2F2F7;
  --gray-100: #E5E5EA;
  --gray-200: #D1D1D6;
  --gray-300: #C7C7CC;
  --gray-400: #AEAEB2;
  --gray-500: #8E8E93;
  --gray-600: #636366;
  --gray-700: #48484A;
  --gray-800: #3A3A3C;
  --gray-900: #2C2C2E;
  --gray-950: #1C1C1E;

  /* ────────────── Backgrounds / superficies ────────────── */
  --paper: #F2F2F7;              /* iOS grouped background */
  --surface: #FFFFFF;            /* card / row surface */
  --surface-sunken: #E5E5EA;     /* input / sunken sections */

  /* ────────────── Texto ────────────── */
  --text: #000000;               /* iOS label */
  --text-muted: #3C3C43;         /* iOS secondaryLabel base (con .6 alpha en iOS; aquí sólido) */
  --text-faint: #8E8E93;         /* iOS tertiaryLabel */

  /* ────────────── Líneas ────────────── */
  --line: #E5E5EA;
  --line-strong: #C7C7CC;

  /* ────────────── Acentos de quincena (iOS SystemColors) ────────────── */
  --q10: #007AFF;                /* SystemBlue */
  --q10-soft: #E5F0FF;
  --q25: #FF9500;                /* SystemOrange */
  --q25-soft: #FFF3E0;

  /* ────────────── Semánticos (iOS SystemColors) ────────────── */
  --positive: #34C759;           /* SystemGreen */
  --positive-soft: #E3F9E7;
  --committed: #AF52DE;          /* SystemPurple */
  --danger: #FF3B30;             /* SystemRed */
  --danger-soft: #FFE5E3;
  --warning: #FFCC00;            /* SystemYellow (nuevo) */
  --warning-soft: #FFF9DB;       /* nuevo */

  /* ────────────── Tipografía ────────────── */
  --font-ui: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, 'Segoe UI', Roboto, sans-serif;
  --font-figures: 'SF Pro Rounded', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;

  /* Escala vieja (retro-compat) — valores ajustados a iOS */
  --step--1: 0.8125rem;          /* 13px */
  --step-0:  0.9375rem;          /* 15px — body */
  --step-1:  1.0625rem;          /* 17px — headline iOS */
  --step-2:  1.25rem;            /* 20px — title3 iOS */
  --step-3:  2.125rem;           /* 34px — largeTitle iOS */
  --step-4:  2.75rem;            /* 44px — display */

  /* Escala nueva iOS text styles */
  --text-xs:   0.75rem;          /* 12px */
  --text-sm:   0.8125rem;        /* 13px */
  --text-base: 0.9375rem;        /* 15px */
  --text-md:   1.0625rem;        /* 17px */
  --text-lg:   1.25rem;          /* 20px */
  --text-xl:   1.5rem;           /* 24px */
  --text-2xl:  2.125rem;         /* 34px */
  --text-3xl:  2.75rem;          /* 44px */

  /* Line-heights */
  --lh-tight: 1.15;
  --lh-normal: 1.4;
  --lh-loose: 1.55;

  /* ────────────── Spacing (sin cambios, se mantiene) ────────────── */
  --gap-xs: 0.25rem;
  --gap-s:  0.5rem;
  --gap-m:  0.875rem;
  --gap-l:  1.25rem;
  --gap-xl: 2rem;

  /* ────────────── Radios (levemente más grandes, iOS 18) ────────────── */
  --radius-s:  12px;             /* era 10 */
  --radius-m:  18px;             /* era 16 */
  --radius-l:  24px;             /* era 22 */
  --radius-xl: 32px;             /* nuevo */

  /* ────────────── Materiales (nuevos) ────────────── */
  --material-thin: color-mix(in srgb, #FFFFFF 72%, transparent);
  --material-regular: color-mix(in srgb, #FFFFFF 90%, transparent);

  /* ────────────── Motion (nuevos) ────────────── */
  --ease-spring-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-spring-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-fast: 120ms;
  --dur-med:  240ms;
  --dur-slow: 360ms;

  /* ────────────── Elevación (nuevas) ────────────── */
  --shadow-1: 0 1px 2px rgb(0 0 0 / 0.04), 0 1px 4px rgb(0 0 0 / 0.03);
  --shadow-2: 0 2px 8px rgb(0 0 0 / 0.06), 0 4px 16px rgb(0 0 0 / 0.04);
  --shadow-3: 0 6px 20px rgb(0 0 0 / 0.10);

  /* ────────────── Misc ────────────── */
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --tap: 44px;
}

/* ────────────── Dark mode (auto por preferencia del sistema) ────────────── */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    /* Grises iOS Dark */
    --gray-50:  #1C1C1E;
    --gray-100: #2C2C2E;
    --gray-200: #3A3A3C;
    --gray-300: #48484A;
    --gray-400: #636366;
    --gray-500: #8E8E93;
    --gray-600: #AEAEB2;
    --gray-700: #C7C7CC;
    --gray-800: #D1D1D6;
    --gray-900: #E5E5EA;
    --gray-950: #F2F2F7;

    /* Backgrounds */
    --paper: #000000;              /* iOS Dark grouped background */
    --surface: #1C1C1E;
    --surface-sunken: #2C2C2E;

    /* Texto */
    --text: #FFFFFF;
    --text-muted: #EBEBF5;
    --text-faint: #8E8E93;

    /* Líneas */
    --line: #38383A;
    --line-strong: #48484A;

    /* Acentos (versiones más brillantes de iOS Dark) */
    --q10: #0A84FF;
    --q10-soft: #1B2B47;
    --q25: #FF9F0A;
    --q25-soft: #3E2A0F;

    /* Semánticos */
    --positive: #30D158;
    --positive-soft: #0D2F17;
    --committed: #BF5AF2;
    --danger: #FF453A;
    --danger-soft: #3A0F0C;
    --warning: #FFD60A;
    --warning-soft: #3A2E00;

    /* Materiales en dark */
    --material-thin: color-mix(in srgb, #1C1C1E 72%, transparent);
    --material-regular: color-mix(in srgb, #1C1C1E 90%, transparent);

    /* Elevación en dark: sombras más sutiles + borde brillante opcional */
    --shadow-1: 0 1px 2px rgb(0 0 0 / 0.30);
    --shadow-2: 0 2px 8px rgb(0 0 0 / 0.40);
    --shadow-3: 0 6px 20px rgb(0 0 0 / 0.50);
  }
}

/* ────────────── Dark mode (forzado por [data-theme='dark']) ────────────── */
:root[data-theme='dark'] {
  --gray-50:  #1C1C1E;
  --gray-100: #2C2C2E;
  --gray-200: #3A3A3C;
  --gray-300: #48484A;
  --gray-400: #636366;
  --gray-500: #8E8E93;
  --gray-600: #AEAEB2;
  --gray-700: #C7C7CC;
  --gray-800: #D1D1D6;
  --gray-900: #E5E5EA;
  --gray-950: #F2F2F7;

  --paper: #000000;
  --surface: #1C1C1E;
  --surface-sunken: #2C2C2E;

  --text: #FFFFFF;
  --text-muted: #EBEBF5;
  --text-faint: #8E8E93;

  --line: #38383A;
  --line-strong: #48484A;

  --q10: #0A84FF;
  --q10-soft: #1B2B47;
  --q25: #FF9F0A;
  --q25-soft: #3E2A0F;

  --positive: #30D158;
  --positive-soft: #0D2F17;
  --committed: #BF5AF2;
  --danger: #FF453A;
  --danger-soft: #3A0F0C;
  --warning: #FFD60A;
  --warning-soft: #3A2E00;

  --material-thin: color-mix(in srgb, #1C1C1E 72%, transparent);
  --material-regular: color-mix(in srgb, #1C1C1E 90%, transparent);

  --shadow-1: 0 1px 2px rgb(0 0 0 / 0.30);
  --shadow-2: 0 2px 8px rgb(0 0 0 / 0.40);
  --shadow-3: 0 6px 20px rgb(0 0 0 / 0.50);
}
```

Aplicá el reemplazo completo del archivo. Cualquier contenido anterior se sobreescribe.

- [ ] **Step 3: Correr typecheck para confirmar que no rompe TypeScript**

Run: `npm run typecheck`

Expected: exit 0 sin errores. Los tokens son CSS, TypeScript no los ve, pero se verifica que la app compila en general.

- [ ] **Step 4: Correr unit tests para confirmar cero regresiones lógicas**

Run: `npm run test`

Expected: `18 passed (18) · Tests 104 passed (104)`. Los tests unitarios no tocan CSS, deben pasar idénticos.

- [ ] **Step 5: Correr E2E tests para confirmar que las pantallas siguen funcionando**

Run: `CI=1 npm run test:e2e -- --project=chromium --reporter=line`

Expected: `8 passed`. Los E2E verifican textos e interacciones, no colores, así que deben pasar. Si algún test falla porque cambió la posición visual de algo (ej. `getByText` con `.first()` que ahora resuelve distinto), es una señal de que hay que investigar.

- [ ] **Step 6: Correr build de producción para confirmar que Vite empaqueta bien**

Run: `npm run build`

Expected: build sin errores, `dist/` generado. Vite hace tree-shake automático de CSS no usado; los nuevos tokens que aún no se referencian pueden quedar en el bundle final (aceptable, son ~2KB gzipped).

- [ ] **Step 7: Levantar dev server y verificar visualmente en Safari/Chrome**

Run: `npm run dev` en background.

Después abrir `http://localhost:5173/step-up/` en Safari (macOS o iPhone en la LAN) y verificar:
- Los colores azul y naranja de las quincenas se ven más vibrantes que antes (era indigo apagado + ocre; ahora SystemBlue + SystemOrange).
- La tipografía de los números (`.figures`) se ve redondeada — es SF Pro Rounded en Apple. En Chrome no-Apple cae al fallback.
- El dashboard con datos de ejemplo se sigue viendo consistente (rows, spacing, chips). Nada se ve "roto".
- Al alternar entre modo claro y oscuro del sistema, ambos se ven correctos.

Si algo se ve mal (contraste bajo, elemento con hardcoded color que ahora choca con los nuevos), documentar y pausar antes del commit.

Detener el dev server con `Ctrl+C` cuando termine la verificación (o dejarlo corriendo si vas a seguir revisando).

- [ ] **Step 8: Commit**

```bash
git add src/styles/tokens.css
git commit -m "$(cat <<'EOF'
feat(tokens): sistema visual v2 alineado a iOS 18

- SF Pro Text + SF Pro Rounded (nativos en iOS/macOS)
- Colores iOS SystemColors: SystemBlue para Q10, SystemOrange para Q25
- Escala de grises iOS System (12 pasos, light + dark)
- Nuevos tokens: --text-xs..3xl, --material-thin/regular, --ease-spring-out,
  --dur-fast/med/slow, --shadow-1/2/3, --radius-xl, --lh-tight/normal/loose,
  --warning + --warning-soft
- Retro-compat: --step-N, --q10, --surface, etc. mantienen sus nombres
- Dark mode con valores oficiales de iOS Dark

Ningún componente React modificado (Fases 2-5 los consumirán después).
EOF
)"
```

- [ ] **Step 9: Push a main (deploya automático a GitHub Pages)**

Run: `git push origin main`

Expected: push exitoso. Dispara los workflows CI + Deploy to GitHub Pages en GitHub Actions.

- [ ] **Step 10: Verificar que los workflows pasan**

Run:
```bash
sleep 5 && gh run list --repo andressarmi11/step-up --limit 2 --json databaseId,name,status,conclusion
```

Después esperar a que ambos terminen:
```bash
RUN_ID=$(gh run list --repo andressarmi11/step-up --workflow "Deploy to GitHub Pages" --limit 1 --json databaseId --jq '.[0].databaseId')
until [ "$(gh run view $RUN_ID --repo andressarmi11/step-up --json status --jq .status)" = "completed" ]; do sleep 8; done
gh run view $RUN_ID --repo andressarmi11/step-up --json conclusion --jq .conclusion
```

Expected: `success` en Deploy y CI. Si CI falla, es porque algún E2E rompió por el cambio visual — investigar y arreglar el test (probablemente selector demasiado específico), luego re-push.

- [ ] **Step 11: Verificar en el iPhone real**

Con la PWA ya instalada del deploy anterior, cerrala del multitasking y volvela a abrir. El service worker actualiza automático pero puede tardar unos segundos.

Expected en iPhone:
- Los números (`Sobrante del mes`, montos en próximos pagos) se ven en SF Pro Rounded (más suaves, redondeados) en vez de Instrument Sans.
- Los acentos de quincena son azul iOS (Q10) y naranja iOS (Q25) más vibrantes.
- Todo el resto sigue funcionando idéntico.

Si algo se ve mal en el iPhone y bien en desktop, es probable que sea `-webkit-font-smoothing` o `backdrop-filter` — dejar nota en el commit siguiente para debug en Fase 2.

---

## Self-Review

**Spec coverage:** La sección "Fase 1 — Design tokens v2" del spec cubre 6 áreas de tokens:
1. Tipografía — ✅ implementada en Step 2 (font stacks + escala nueva + retro-compat + line-heights).
2. Colores — ✅ (SystemColors, grises iOS 12 pasos, dark mode oficial).
3. Materiales — ✅ (--material-thin, --material-regular con color-mix).
4. Motion — ✅ (--ease-spring-out, --ease-spring-in-out, --dur-*).
5. Radios — ✅ (nuevos valores + --radius-xl).
6. Elevación — ✅ (--shadow-1/2/3, atenuados en dark).

**Placeholder scan:** No hay TBDs, TODOs ni "handle appropriately". El código completo del `tokens.css` está inline literalmente en el Step 2.

**Type consistency:** No hay tipos TypeScript porque el cambio es puramente CSS. Los nombres de variables CSS son cadenas — verificado que los retro-compat (`--step--1`, `--step-0`, ..., `--step-4`, `--q10`, `--q10-soft`, `--q25`, `--q25-soft`, `--positive`, `--positive-soft`, `--committed`, `--danger`, `--danger-soft`, `--font-ui`, `--font-figures`, `--paper`, `--surface`, `--surface-sunken`, `--text`, `--text-muted`, `--text-faint`, `--line`, `--line-strong`, `--gap-xs/s/m/l/xl`, `--radius-s/m/l`, `--safe-top`, `--safe-bottom`, `--tap`) están todos presentes en el nuevo archivo con sus mismos nombres.

**Riesgos identificados:**
- El cambio de `--radius-s` de 10→12px afecta visualmente cada chip/button/card. Es intencional (rounder = más iOS 18) pero puede sentirse fuerte al ver por primera vez. Aceptado como parte del rediseño.
- SF Pro Rounded no está en Windows/Linux desktop — cae al fallback system-ui. Aceptable porque el sub-proyecto A es mobile-first (desktop es sub-proyecto B).
- `color-mix()` para materiales requiere Safari 16.2+ (funciona en iPhones modernos; en desktop viejos puede no hacer blur pero no rompe la app).

Sin issues bloqueantes. Plan listo para ejecutar.

---

## Después de completar este plan

Cuando Fase 1 esté verificada en producción (iPhone real), volvemos a escribir un plan similar para:

- **Fase 2** — Chrome (TabBar iOS con material blur + Screen headers colapsables + long-press del FAB).
- **Fase 3** — TransactionForm rediseñado con keypad in-app + smart-fill autónomo (aprende del historial).
- **Fase 4** — Dashboard con hero refinado + chip único "Por pagar" + "Disponible ahora" con info-icon.
- **Fase 5** — Movimientos, Calendario, Tarjeta, Análisis rediseñado (barras stacked + pie clickable), Ajustes.

Cada uno se escribe cuando la fase anterior está estable, para incorporar aprendizaje incremental.
