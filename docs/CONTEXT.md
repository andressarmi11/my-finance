# Contexto del proyecto

> Este archivo se lee al **iniciar cada fase**. Es la memoria entre sesiones.

## Qué es
App personal de finanzas para Colombia (COP). Reemplaza una hoja de Excel
organizada por quincenas. MVP local-first completo (Fases 1-12); Supabase,
notificaciones, E2E y documentación final quedan en las Fases 13-17.

## Reglas de negocio que no se negocian

1. **Quincenas del 10 y del 25**, configurables. La quincena del 25 cruza
   el cambio de mes y termina el día 9 del mes siguiente (confirmado y
   testeado contra el Excel real del usuario).
2. **Tarjeta de crédito híbrida**: cada compra se ve individual con su
   propio día de pago, y también agregada por ciclo (`groupByCycle`) — el
   equivalente calculado de "Pago compras TC" del Excel.
3. **Corte y pago de TC configurables**, editable desde Ajustes. Cambiar
   el valor no reescribe compras ya hechas (guardan su fecha de pago
   original en `cyclePaymentDate`).
4. **Tres restantes visibles**: quincena del 10, quincena del 25, y
   sobrante del mes (= suma de los dos restantes).
5. **Dinero = entero. Fechas de negocio = string 'YYYY-MM-DD'.** Nunca
   `Date` con hora en `domain/` — todo pasa por `domain/dates.ts` (kernel
   sobre epoch UTC).
6. **Cero cálculos en JSX.** Todo vive en `src/domain/`, sin React ni Dexie.
7. **Presupuestos informan, nunca bloquean.**
8. **Una regla recurrente nunca se duplica**: protegido por el índice
   único `[recurringRuleId+periodKey]` en Dexie, no solo por la lógica de
   `expandRecurringRule`.

## Arquitectura (recordatorio)
```
UI (React)  ->  hooks  ->  domain (TS puro)  ->  Repository (interfaz)
                                                   |- LocalRepository (Dexie) — Fases 1-12
                                                   |- SupabaseRepository — Fase 13
```

## Decisiones tomadas
- Local-first (IndexedDB) en fases 1-12. Supabase entra en la Fase 13, y
  con el repo público en GitHub Pages, **Auth deja de ser opcional**: sin
  login, la `anon key` pública expondría una tabla legible por cualquiera.
- GitHub Pages con repo público. `base: '/step-up/'` en vite.config.ts.
- Notificaciones: no existen notificaciones locales programadas en Safari
  iOS. El scheduler vive en el servidor (pg_cron -> Edge Function -> Web
  Push), pendiente de implementar en la Fase 14.
- Recharts (para Análisis) se separó en su propio chunk con `React.lazy`:
  pesa ~115kB gzip y no debe entrar en la carga inicial de la app.

## Estado
Fases 1-12 terminadas y verificadas en este entorno: 91/91 tests,
typecheck limpio, lint limpio, build de producción exitoso, PWA instalable
(manifest + service worker generados). Siguiente: Fase 13 (Supabase).

Nota de infraestructura: en este entorno de trabajo, `node_modules` debe
vivir en disco local (no en el mount de red de `/mnt/user-data/outputs`),
o `npm install` se cuelga o corrompe paquetes. El proyecto se desarrolla en
`/home/claude/work/step-up` y se copia a outputs sin `node_modules` al
final de cada tanda de fases. Esto no afecta al usuario: en su máquina o en
GitHub Actions, `node_modules` corre sobre disco normal sin este problema.
