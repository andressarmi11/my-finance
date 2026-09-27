# Compras diferidas a N cuotas

**Fecha:** 2026-09-26
**Estado:** diseño aprobado
**Spec 2 de 4** — depende de la spec 1 (tarjetas múltiples + cupo), ya
implementada en el commit `57ad542`.

---

## Qué se quiere y por qué

En Colombia se difiere mucho. Una nevera de 1.200.000 a 12 cuotas no entra
entera en el extracto del mes: entran 12 cargos de ~100.000, uno por mes.
Hoy la app mete la compra completa en el extracto de su ciclo, lo que
infla ese mes y deja vacíos los once siguientes.

Éxito = registrar la compra una vez, eligiendo el número de cuotas, y que
la app reparta la plata en los extractos que corresponden.

**Decisiones del usuario que fijan el alcance:**

- Una compra diferida consume el **cupo completo el día de la compra**, no
  cuota a cuota. Es lo que hace el banco.
- El usuario puede **escribir el valor de la cuota** cuando el banco cobra
  interés. La app no modela tasas.
- Cada cuota **se lista en el mes que toca pagarla**, rotulada
  "cuota 3 de 12".

---

## Por qué esto NO necesita materialización

`src/data/local/materialize.ts` existe porque una regla recurrente es
**infinita**: hay que decidir hasta dónde expandirla, volver a expandir al
navegar de mes (`ensureMonthMaterialized`), no pisar lo que el usuario ya
editó, y esquivar lo que borró.

Un diferido es **finito y se conoce entero el día de la compra**. Las N
cuotas se crean de una sola vez y nunca hay que volver. Nada de ventanas,
nada de re-expansión, ninguna función `ensure`.

Lo que sí se copia de ese archivo es lo importante: **el id determinista.**
`occurrenceId()` construye `"${ruleId}:${periodKey}"` en vez de un UUID, y
el comentario explica por qué — con id aleatorio la lápida de borrado no
sabía a qué ocurrencia pertenecía, así que borrabas "Arriendo septiembre" y
volvía a nacer en el siguiente arranque.

Para cuotas: `"${grupoId}:cuota-3"`.

**Consecuencia: no se toca Dexie.** El id es la clave primaria y eso ya
impide duplicados. No hace falta índice nuevo ni subir de la versión 4.

---

## A. Modelo

Cuatro campos opcionales en `Transaction` (`src/domain/types.ts`):

```ts
/** Diferido: el plan de cuotas al que pertenece esta cuota. */
installmentGroupId?: Id;
/** 1..N */
installmentNumber?: number;
/** N */
installmentCount?: number;
/**
 * Cuándo se hizo la COMPRA. Distinta de `date` a partir de la cuota 2.
 * Existe para el cupo (sección D).
 */
purchaseDate?: ISODate;
```

`purchaseDate` se guarda en vez de derivarse porque `calcularDisponible`
es una función pura que recibe transacciones sueltas: para saber si la
compra ya ocurrió tendría que buscar la cuota 1 del grupo, o sea un join
O(n²) dentro de la suma del cupo. Un campo lo evita.

Archivos a tocar:

- `src/domain/types.ts` — los campos.
- `src/data/supabase/mappers.ts` — mapeo ↔ `installment_group_id`,
  `installment_number`, `installment_count`, `purchase_date`.
- `src/data/backup/schema.ts` — opcionales, para que los backups viejos
  sigan importando.
- `supabase/migrations/0008_diferidos.sql`.

---

## B. El dominio del reparto

`src/domain/credit-card/diferido.ts`, función pura:

```ts
export interface Cuota {
  numero: number;
  amount: number;
  date: ISODate;
  cycleCutoffDate: ISODate;
  cyclePaymentDate: ISODate;
}

export function expandirDiferido(
  purchaseDate: ISODate,
  total: number,
  cuotas: number,
  cutoffDay?: number,
  paymentDay?: number,
  /** Si el banco cobra interés, el valor real de cada cuota. */
  valorCuota?: number,
): Cuota[];
```

### Reparto y redondeo

`base = Math.floor(total / cuotas)`, y **el resto va a la primera cuota.**

Invariante duro: `sum(cuotas) === total`, siempre. Con 1.000.000 a 3 →
333.334 + 333.333 + 333.333. Si el resto se repartiera "como caiga", la
suma de las cuotas dejaría de ser la compra y el cupo quedaría descuadrado
por unos pesos que nadie sabría de dónde salieron.

El dinero es entero en toda la app (`types.ts:1-9`); acá es donde eso
importa de verdad.

### Interés

Si viene `valorCuota`, **todas** las cuotas valen eso y la suma supera al
total. Esa diferencia *es* el interés. La app no calcula tasas ni
amortización: el usuario copia lo que le dijo el banco.

### Fechas

La cuota N es la fecha de compra corrida N−1 meses, con `clampDay`: una
compra el 31 de enero pone su segunda cuota el 28 de febrero.

### Ciclos

Cada cuota pasa por `calculateCreditCardCycle` **con su propia fecha**. No
hace falta aritmética especial de ciclos: sale bien solo.

Verificado a mano — compra el 20 de septiembre, corte 15, pago 2:

| Cuota | Fecha | Corte | Paga |
|---|---|---|---|
| 1 | 20 sep | 15 oct | 2 nov |
| 2 | 20 oct | 15 nov | 2 dic |
| 3 | 20 nov | 15 dic | 2 ene |

Consecutivas, como debe ser.

### Casos borde

- `cuotas <= 1` devuelve una sola cuota: no es un diferido, y quien llama
  debe guardar una transacción normal sin los campos de la sección A.

---

## C. Creación

En `TransactionForm`, si el método es de crédito aparece un campo
**Cuotas** (por defecto 1). Con más de 1 se muestra el valor calculado de
cada cuota, **editable** (es el `valorCuota` de la sección B).

Al guardar con cuotas > 1 se crean N transacciones en un solo `bulkPut`,
todas con `status: 'pending'` — coherente con lo que ya se corrigió en la
spec 1: una compra con tarjeta no está pagada el día que la pasas.

`src/data/local/diferidos.ts` arma el lote. Ids:
`grupoId = crypto.randomUUID()`, y cada cuota `${grupoId}:cuota-${n}`.

### El concepto se guarda limpio

Se guarda `"Nevera"`, **no** `"Nevera 3/12"`. El número vive en
`installmentNumber`, y el rótulo se arma al pintar.

Razón concreta: `localRepository.saveTransaction` alimenta el
`conceptIndex` que hace el autocompletado del formulario. Doce conceptos
distintos ("Nevera 1/12", "Nevera 2/12"…) envenenarían ese índice y el
smart-fill dejaría de reconocer "Nevera".

---

## D. Cupo

Un cambio de una línea en `calcularDisponible`
(`src/domain/credit-card/disponible.ts`):

```diff
-    tx.date <= hoy
+    (tx.purchaseDate ?? tx.date) <= hoy
```

Una nevera a 12 cuotas comprada hoy consume el cupo **completo** hoy, y lo
libera cuota a cuota a medida que se marcan pagadas. Es lo que hace el
banco: bloquea todo al pasar la tarjeta.

El `?? tx.date` deja intacto todo lo que no es diferido, incluida la
protección de la spec 1 contra las recurrentes materializadas a futuro.

---

## E. Borrado

Borrar una cuota borra **el diferido completo**, con confirmación que dice
cuántas son. Un diferido con un hueco en la cuota 7 no significa nada, y
dejar al usuario borrarlas de a una es una forma silenciosa de descuadrar
el cupo.

Cada cuota se borra con su propia lápida, para que el borrado viaje entre
dispositivos (ver `src/data/sync/tombstones.ts`).

Editar una cuota suelta sí se permite: es lo que haces cuando pagas una.

---

## F. Presentación

`TransactionRow` agrega "· cuota 3 de 12" a la línea de metadatos, donde
ya vive "se paga el X".

---

## G. Pruebas

**`diferido.test.ts`** — es aritmética de plata, que es donde un error no
hace ruido:

- la suma de las cuotas es exactamente el total (el caso que atrapa el
  error de redondeo);
- el resto cae en la primera cuota;
- las fechas de pago salen consecutivas mes a mes;
- `valorCuota` manual manda sobre el reparto;
- una compra el 31 se clampea en los meses cortos;
- `cuotas = 1` no arma un diferido.

**Cupo**: un diferido consume el total el día de la compra, no cuota a
cuota; y al marcar una cuota pagada libera solo esa.

**E2E**: crear una compra a 3 cuotas, ver los 3 movimientos en 3 meses
distintos con su rótulo, y ver el cupo bajar por el total completo.

---

## Entrega

Dos tajadas:

1. **Modelo + dominio** — campos, migración, `expandirDiferido` y el
   cambio del cupo, con sus pruebas. Nada visible todavía.
2. **UI** — el campo de cuotas en el formulario, el rótulo en la lista y
   el borrado en grupo.

---

## Fuera de alcance, a propósito

- **Tasas de interés y amortización.** El usuario escribe el valor de la
  cuota; la app no calcula ni guarda tasas.
- **Abonos a capital** y pagos anticipados del diferido.
- **Diferir una regla recurrente.** Una suscripción mensual no se difiere.

---

## Contexto de la secuencia

1. ~~Tarjetas múltiples + cupo~~ — hecho (`57ad542`).
2. **Diferidos a N cuotas** ← esta spec
3. **Filtros** — por tipo y estado, y granularidad en Análisis. Incluye un
   arreglo pendiente: `periodAggregate.ts:127` filtra por `t.date` crudo,
   así que Análisis todavía cuenta las compras con tarjeta en la fecha de
   compra en vez de la de pago. Con diferidos esa inconsistencia se agrava:
   Análisis vería 12 cuotas repartidas pero por fecha de registro, no de
   cargo.
4. **Exportar a xlsx** — backup completo, una hoja por entidad.
