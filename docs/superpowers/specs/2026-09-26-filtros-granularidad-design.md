# Filtros por tipo y estado, y granularidad en Análisis

**Fecha:** 2026-09-26
**Estado:** diseño aprobado
**Spec 3 de 4.**

---

## Qué se quiere

Poder filtrar los movimientos por tipo (gasto/ingreso) y por estado
(pendiente/pagado), y ver los agregados con distinta ventana temporal:
quincenal, mensual, trimestral o anual.

**Decisión del usuario que fija el alcance:** trimestral y anual viven en
**Análisis**, no en la lista. La lista sigue navegando por mes, que es la
realidad de los pagos; Análisis es donde se hace la pregunta "¿cuánto
gasté este trimestre?".

---

## A. El bug que esta spec arrastra

`src/features/analytics/periodAggregate.ts:127`:

```ts
return transactions.filter((t) => t.date >= from && t.date <= to);
```

Filtra por la fecha de **registro**. Una compra con tarjeta del 20 de
septiembre que se paga el 2 de noviembre cuenta como gasto de septiembre,
igual que antes del arreglo del dashboard (commit `95e91ce`). El bug se
arregló en el balance y sobrevivió acá.

Con diferidos se nota más: las doce cuotas de una nevera aparecen por su
fecha de registro, no por la de cargo.

### La función ya existe

`src/features/dashboard/upcoming.ts:15-17`:

```ts
/** La fecha que importa: la de pago de la TC si existe, si no la del movimiento. */
export function relevantDate(tx: Transaction): string {
  return tx.cyclePaymentDate ?? tx.date;
}
```

No hay que inventar nada: hay que darle **un solo hogar**. Sube a
`src/domain/periodo/fechaDeCargo.ts` y la usan Análisis y el dashboard.

Ojo con la distinción que ya está escrita en `domain/periodo/resolve.ts`:

- **registro** (`tx.date`) → dónde se lista.
- **cargo** (`cyclePaymentDate ?? date`) → de dónde sale la plata.

Análisis mide plata, así que va por cargo. `resolverPeriodoDeCargo` no
sirve acá porque devuelve una clave de periodo de pago, y Análisis trabaja
con rangos de calendario: lo que hace falta es la **fecha**, no la clave.

---

## B. Granularidad

`Range` pasa de `'mes' | 'trimestre' | 'año'` a incluir `'quincena'`.

`rangeBounds()` gana una rama: mes, trimestre y año siguen siendo
**calendario puro**; quincena sale de `calcularPeriodo(hoy, diasDePago)`,
o sea del periodo de pago del usuario.

Son dos ejes distintos y la spec lo asume a propósito en vez de
disimularlo: no existe "trimestre de quincenas" y no se inventa. La
función recibe `diasDePago` solo para la rama de quincena.

`rangeBounds` pasa a necesitar `diasDePago`, así que `AnalyticsScreen`
tiene que leer `settings` — hoy no lo hace.

---

## C. Filtros de tipo y estado

Van en `TransactionsScreen`, sobre la lista ya acotada al mes.

- **Tipo**: Todos / Gastos / Ingresos.
- **Estado**: Todos / Pendientes / Pagados.

### "Pendiente" incluye los programados

`TransactionStatus` tiene `paid | pending | scheduled | cancelled`, y hoy
el código trata `pending` y `scheduled` de dos formas distintas según el
archivo:

- `domain/totals/porPagar.ts:43-44` los separa en dos grupos, pero los
  suma juntos en el total.
- `features/dashboard/upcoming.ts:20` los funde: `pending || scheduled`.
- `domain/totals/available.ts:36` solo mira si es `paid` o no.

Un filtro obliga a elegir. Se elige **"Pendientes" = `pending` +
`scheduled`**, que es lo que ya hacen dos de los tres y lo que significa
para el usuario ("lo que falta"). `cancelled` nunca aparece bajo ningún
filtro: un movimiento cancelado no es ni pendiente ni pagado.

El filtro es **presentación**, no dominio: acota lo que se lista y no
toca el balance del encabezado. El restante de una quincena es el de la
quincena, no el de lo que dejaste visible — si el filtro cambiara ese
número, "Gastos" haría ver un restante negativo falso.

---

## D. Pruebas

- `rangeBounds`: los cuatro rangos; que quincena siga a `diasDePago` y no
  al calendario; que en modo mensual (un solo día de pago) no devuelva
  media quincena.
- `filterByRange`: una compra con tarjeta cae en el rango de su fecha de
  **pago**, no de compra (el bug de la sección A).
- Filtros de lista: que "Pendientes" incluya `scheduled` y que
  `cancelled` no salga en ninguno.
- E2E: filtrar por Ingresos deja solo ingresos, y el restante del
  encabezado no se mueve.

---

## Fuera de alcance

- Filtro por categoría o por tarjeta (el buscador ya cubre por texto).
- Filtros en Análisis: esa pantalla ya separa ingresos de gastos
  visualmente.
- Trimestre o año en la lista de movimientos.
