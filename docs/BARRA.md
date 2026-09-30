# Step up — Transparencia de la barra de navegación

> **Para la sesión que implementa esto:** es un cambio acotado. No toques nada más del rediseño. Prototipo: `docs/barra/Step Up Barra.dc.html` (5a interactivo, con botones ES/EN; 5b notas). Archivos principales: `src/components/ui/TabBar.tsx`, `src/features/settings/` (pantalla de tema), `src/styles/tokens.css` y `src/i18n/texts.ts`.

## Qué cambia

- **Ajustes → "Tema y barra"** (antes "Tema"). El valor a la derecha muestra, por ejemplo, "Oscuro · Cristal". Debajo de los 3 temas va la sección **"Barra de navegación"**:
  - Vista previa de 150 px con filas de ejemplo y la barra encima, que cambia en vivo.
  - Segmentado **Sólida / Translúcida / Cristal**. Son atajos que ponen la opacidad en 100 / 88 / 40.
  - Slider **Opacidad** de 15 a 100 %. Si se mueve a un valor que no es de un atajo, ningún segmento queda activo.
  - Toggle **"Botón + también transparente"**. Cristal lo enciende y Sólida lo apaga.
  - Una nota de una línea según el modo.
- `Settings.navBar = { opacity: number; fabGlass: boolean }`, por defecto `{ opacity: 88, fabGlass: false }`. Se guarda en `localStorage` como el tema: se aplica antes de pintar y no se sincroniza.
- CSS (TabBar):
  - `background: color-mix(in srgb, var(--surface) <opacity>%, transparent)`.
  - Opacidad 100 → sin `backdrop-filter`.
  - Entre 56 y 99 → `blur(20px) saturate(140%)`.
  - 55 o menos (**Cristal**) → `blur(26px) saturate(180%)`, borde `rgba(255,255,255,.14)` (claro: `rgba(0,0,0,.08)`) y `box-shadow: inset 0 1px 0 rgba(255,255,255,.10), 0 10px 30px rgba(0,0,0,.35)`.
  - La pestaña activa usa `color-mix(--line-strong, max(opacity,60)%)`.
  - FAB con `fabGlass`: el mismo fondo y borde que la barra y el ícono en `--q10`. Sin `fabGlass`: `--q10` sólido.
- Se exponen como variables en `:root` (`--nav-bg`, `--nav-filter`, `--nav-border`, `--nav-shadow`) para que el sidebar de escritorio no se vea afectado (allí no aplica).
- Accesibilidad: con `prefers-reduced-transparency: reduce`, forzar 100 %. Los labels de las pestañas mantienen `--text` / `--text-muted` con contraste AA sobre el peor caso (contenido blanco detrás en claro).
- i18n: "Barra de navegación / Navigation bar", "Sólida / Solid", "Translúcida / Translucent", "Cristal / Glass", "Opacidad / Opacity", "Botón + también transparente / Make the + button transparent too".

## Textos (ES / EN)

Todas las claves van en `src/i18n/texts.ts`. No debe quedar ningún texto suelto en los componentes.

| Clave | ES | EN |
|---|---|---|
| `settings.themeAndBar` | Tema y barra | Theme & bar |
| `navBar.title` | Barra de navegación | Navigation bar |
| `navBar.solid` | Sólida | Solid |
| `navBar.translucent` | Translúcida | Translucent |
| `navBar.glass` | Cristal | Glass |
| `navBar.opacity` | Opacidad | Opacity |
| `navBar.fabGlass` | Botón + también transparente | Make the + button transparent too |
| `navBar.fabGlassSub` | Si lo apagas, el + queda de color sólido. | If off, the + stays a solid color. |
| `navBar.noteSolid` | Sólida: no deja ver nada detrás. Es la más legible. | Solid: nothing shows through. The most readable. |
| `navBar.noteTranslucent` | Translúcida: un poco de lo que hay detrás, casi sin afectar la lectura. | Translucent: a hint of what's behind, barely affects reading. |
| `navBar.noteGlass` | Cristal: se ve lo que hay detrás, con desenfoque. Los íconos mantienen el contraste. | Glass: what's behind shows through, blurred. Icons keep their contrast. |

- El slider lleva `aria-label={t('navBar.opacity')}` y `aria-valuetext="{n}%"`.
- El toggle es un `role="switch"` con `aria-checked`.
- Ampliar el e2e `27-english-has-no-spanish` para que abra Ajustes → Tema y barra en inglés.

## Tareas

1. `Settings.navBar = { opacity, fabGlass }` + persistencia en `localStorage`, aplicada antes de pintar (igual que el tema).
2. Hook `useNavBarStyle()` que devuelve las variables CSS según la opacidad, el tema y `prefers-reduced-transparency`.
3. `TabBar.tsx` y `AddButton` leen `--nav-bg`, `--nav-filter`, `--nav-border` y `--nav-shadow` (y los `--fab-*` cuando `fabGlass` está activo).
4. En la pantalla de tema: la sección "Barra de navegación" con vista previa, segmentado, slider, toggle y nota. Cambiar la fila de Ajustes a "Tema y barra" con el valor "Oscuro · Cristal".
5. i18n: las claves de la tabla anterior.
6. Tests:
   - Unitario del hook: 100 → sin filtro, 88 → blur 20, 40 → cristal; con reduced-transparency → 100.
   - e2e `42-navbar-transparency`: elegir Cristal → la barra tiene `backdrop-filter` → recargar y sigue igual.

## Checklist

- [x] Ajuste guardado y aplicado antes de pintar
- [x] Sólida / Translúcida / Cristal + slider + toggle del +
- [x] Vista previa en vivo
- [x] Tema claro y oscuro correctos
- [x] `prefers-reduced-transparency` → sólida
- [x] ES/EN completos
- [x] `npm run typecheck && npm run lint && npm test && npm run test:e2e` en verde

## Notas de la implementación

- La lógica vive en `src/lib/navBar.ts`: `navBarVars()` (pura, con tests), `readNavBar` / `saveNavBar` (localStorage, clave `stepup.navBar`), `applyNavBar()` (se llama en `main.tsx` antes del primer render) y los hooks `useNavBar()` / `useNavBarStyle()`. No va en `Settings` de Dexie porque ese se sincroniza y este ajuste es del dispositivo.
- Los colores que cambian con el tema son tokens (`--nav-glass-border`, `--nav-glass-highlight`, `--nav-glass-drop` en `tokens.css`), así que `navBarVars` no necesita saber si es claro u oscuro.
- En móvil, "Tema" pasó de hoja a pantalla (`/ajustes/tema`, como el prototipo 5a). En escritorio no hay barra: la ruta lleva al panel de Idioma y tema.
- En Cristal las pestañas inactivas usan `--text-muted` en vez de `--text-faint`, para mantener el contraste sobre lo que se ve detrás.
- Se mantiene la tarjeta de nota del tema que ya existía debajo de los tres temas.
- `prefers-reduced-transparency` fuerza Sólida; Playwright no puede emularlo, así que lo cubre el test unitario.
