# Tarjetas de crédito múltiples, con cupo y disponible

**Fecha:** 2026-09-26
**Estado:** diseño aprobado, pendiente de plan de implementación
**Spec 1 de 4** — ver "Contexto de la secuencia" al final.

---

## Qué se quiere y por qué

Hoy la app asume **una** tarjeta de crédito. El usuario tiene varias, con
días de corte distintos, y quiere:

1. Crear cuantas tarjetas necesite, cada una con su nombre.
2. Que cada una tenga su propio día de corte y su propio día de pago.
3. Ver el cupo de cada tarjeta y cuánto le queda disponible.

Éxito = el usuario puede registrar una compra eligiendo cuál de sus
tarjetas usó, y la app calcula la fecha de pago con los días de **esa**
tarjeta, no con unos genéricos.

**Decisiones del usuario que fijan el alcance:**

- El disponible sale de sus propios movimientos: `cupo − compras sin
  pagar`. Se libera cuando marca el ciclo como pagado. No se escribe el
  saldo a mano ni se integra con ningún banco.
- Las compras a cuotas **sí** se quieren, pero son la spec 2. Esta spec
  asume que toda compra cae entera en el extracto de su ciclo, que es
  como funciona hoy.

---

## Lo que YA funciona y no hay que reconstruir

Esto se verificó leyendo el código, no asumiendo. Es la parte más
importante de la spec: **varias tarjetas ya las soporta todo menos la
UI.**

| Capa | Estado | Evidencia |
|---|---|---|
| Modelo de dominio | Listo | `src/domain/types.ts:69-84` — `cutoffDay`/`paymentDay` son por instancia, comentados como "configurables, nunca hardcodeados" |
| Cálculo del ciclo | Listo | Los 4 call sites de producción pasan los días del método elegido: `TransactionForm.tsx:119,171`, `QuickEntrySheet.tsx:106`, `InboxSheet.tsx:65`, `materialize.ts:90`. Los `15, 2` de `cycle.ts:26-29` son solo fallback de firma |
| Repositorio local y remoto | Listo | `localRepository.ts:76-78` (upsert genérico), `supabaseRepository.ts:75` |
| Esquema Postgres | Listo | `0001_init.sql:37-48` — sin unique sobre `type`; nada impide N filas por usuario |
| Índices Dexie | Listo | `db.ts:19` — `'id, type'`, índice no único |
| Sync y borrado con lápida | Listo | `tombstones.ts:12` ya lista `paymentMethods` como entidad borrable |
| Export / import | Listo | `backup/schema.ts:55-63` valida un array sin límite |
| Formularios que ELIGEN tarjeta | Listo | Ya iteran toda la lista: `TransactionForm.tsx:107-115`, `QuickEntrySheet.tsx:47`, `InboxSheet.tsx:37`, `RecurringRuleForm.tsx:104-110` |

**Conclusión:** si mañana existieran tres tarjetas en la base, sus ciclos
se calcularían correctamente hoy mismo. El trabajo es de UI, más dos
goteras reales (secciones D y E).

---

## A. Modelo y migración

Un solo campo nuevo en `PaymentMethod` (`src/domain/types.ts`):

```ts
/** Cupo total en pesos enteros. Solo si type === 'credit'. */
creditLimit?: number;
```

**Opcional a propósito.** Las tarjetas que ya existen quedan sin cupo y
la app no muestra disponible hasta que el usuario lo llene. Cero
migración de datos, cero backfill, nada que romper.

Archivos a tocar:

- `src/domain/types.ts` — el campo.
- `src/data/supabase/mappers.ts:72-86` — mapeo ↔ `credit_limit`.
- `src/data/backup/schema.ts:55-63` — campo opcional, para que los
  backups viejos sigan importando sin error.
- `supabase/migrations/0007_credit_limit.sql` — `alter table
  payment_methods add column credit_limit bigint;` (la última migración
  existente es `0006_inbox.sql`).

Dexie no necesita índice nuevo: nadie va a consultar por cupo.

**Dinero en enteros**, como todo en esta app (`types.ts:1-9`). Nunca
float.

---

## B. El dominio del cupo

Archivo nuevo: `src/domain/credit-card/disponible.ts`. Función pura, sin
React ni Dexie, como todo `src/domain/`.

```ts
export interface Disponible {
  cupo: number;
  usado: number;
  /** cupo − usado. Negativo = sobrecupo. */
  disponible: number;
}

export function calcularDisponible(
  tarjeta: PaymentMethod,
  transacciones: Transaction[],
  hoy: ISODate,
): Disponible | null;
```

Devuelve `null` cuando la tarjeta no tiene `creditLimit`: no hay
disponible que mostrar, y devolver `{cupo: 0}` sería mentir.

`usado` suma las transacciones que cumplen **todas**:

- `paymentMethodId === tarjeta.id`
- `type === 'expense'`
- `status !== 'paid'` y `status !== 'cancelled'`
- `date <= hoy`

### Por qué el filtro de fecha

Sin él hay una gotera real. `materialize.ts:102` materializa las reglas
recurrentes con `status: 'pending'` hasta unos 3 meses adelante. Una
suscripción mensual cargada a la tarjeta aparecería como cupo consumido
por compras **que todavía no se han hecho**, y el disponible de hoy
saldría más bajo de lo que es.

Una compra futura no consume cupo. El filtro lo dice explícito.

### Por qué no hay entidad "extracto"

"Marcar el ciclo como pagado" = poner `status: 'paid'` a los movimientos
de ese ciclo. Ese estado ya existe (`TransactionStatus` en
`types.ts:15`) y la acción masiva de marcar pagados ya está construida
en `TransactionsScreen.tsx:182-194`.

Una entidad `CardStatement` nueva traería su propia tabla, su propio
sync, su propio borrado y su propia posibilidad de desincronizarse del
estado de las transacciones. No compra nada que `status` no dé ya.

### Sobrecupo

`disponible` puede ser negativo y se muestra así, en rojo. Recortarlo a
cero escondería justo el dato que importa. Sigue la convención de la
app: `--danger-text` para números que se leen (ver `tokens.css`, la nota
sobre colores de texto).

---

## C. UI: gestión de tarjetas

Feature nueva `src/features/payment-methods/`, siguiendo el patrón que
`src/features/categories/` ya estableció: una lista, y un formulario en
hoja modal.

- **Lista** de todos los métodos de pago, agrupados o marcados por tipo.
  Cada tarjeta de crédito muestra su disponible si tiene cupo.
- **Formulario**: nombre, tipo, y —solo si el tipo es crédito— día de
  corte, día de pago y cupo.
- **Botón de agregar.**
- Ids con `crypto.randomUUID()`. **Nunca slugs fijos**: la PK en Postgres
  es `(user_id, id)` desde `0004_text_ids_and_profile.sql:41-52`, y un id
  repetido entre usuarios o entre dispositivos colisiona.

Se llega desde Ajustes.

**Esto reemplaza** la sección "Tarjeta de crédito" de
`SettingsScreen.tsx:190-209`, que hoy hace
`paymentMethods.find(m => m.type === 'credit')` (`:24-25`) y edita a
ciegas la primera tarjeta que encuentre. Con dos tarjetas, esa sección
edita una al azar sin decir cuál.

---

## D. Borrado seguro

`deletePaymentMethod` existe en las tres capas (`repository.ts:19`,
`localRepository.ts:78`, `supabaseRepository.ts:75`) pero **ningún
componente lo llama**: es código muerto desde la UI.

Al exponerlo hay que cerrar una asimetría: Postgres ya hace
`on delete set null` sobre `transactions.payment_method_id` y
`recurring_rules.payment_method_id` (`0001_init.sql:59,86`), pero el
borrado local **no limpia nada**, así que quedan referencias colgando en
IndexedDB hasta el siguiente ciclo de sync.

`localRepository.deletePaymentMethod` pasa a poner `paymentMethodId =
null` en las transacciones y reglas que apuntaban a esa tarjeta, antes de
borrarla.

Hay precedente directo: `deleteTransaction` (`localRepository.ts:105-111`)
ya tuvo que cascadear a mano hacia `reminders`, con un comentario
explicando que Dexie obliga a hacerlo explícito.

**La UI confirma** diciendo cuántos movimientos quedarán sin método. No
se bloquea el borrado: los movimientos sobreviven sin método y la UI ya
tolera `paymentMethod: undefined` (`TransactionRow.tsx:21,39` omite el
nombre y no revienta).

---

## D-bis. El método por defecto tiene dos fuentes de verdad

Hay que resolverlo aquí porque el formulario de la sección C es el primer
sitio donde el usuario podría decir "esta es mi tarjeta principal".

Hoy conviven:

- `Settings.defaultPaymentMethodId` (`types.ts:39`)
- `PaymentMethod.isDefault` (`types.ts:72`)

y la cadena real de resolución está en `TransactionsScreen.tsx:464`:

```ts
settings.defaultPaymentMethodId ?? paymentMethods.find((m) => m.isDefault)?.id ?? null
```

Nada las mantiene en sincronía y nada impide que dos métodos tengan
`isDefault: true`. Si el formulario nuevo trajera una casilla "por
defecto" que escribiera solo `isDefault`, **parecería no hacer nada**:
`Settings` gana siempre.

**Decisión: `Settings.defaultPaymentMethodId` es la única fuente de
verdad.** El formulario escribe solo ese campo. `isDefault` queda como
dato heredado de la semilla (`defaultPaymentMethods.ts:9`) y su lectura
sobrevive únicamente como último eslabón del `??`, para no romper a quien
nunca haya tocado el ajuste.

No se borra la columna: está en Postgres y en el esquema de backup, y
quitarla pediría migración a cambio de nada. Se documenta como heredada
en `types.ts` para que nadie vuelva a escribirla.

---

## E. CreditCardScreen con varias tarjetas

Hoy la pantalla junta en un solo `Set` los ids de **todas** las tarjetas
de crédito (`CreditCardScreen.tsx:21-24`), filtra sus transacciones a un
único arreglo (`:25-28`) y las agrupa solo por `cyclePaymentDate`
(`groupByCycle.ts:17-37`).

Con dos tarjetas eso mezcla compras de ambas en el mismo timeline de
ciclos, y las filas (`:59-70`) ni siquiera dicen de qué tarjeta es cada
una. La pantalla deja de servir justo cuando más falta hace.

Cambia a: **agrupar por tarjeta primero, ciclo adentro.** Cada tarjeta
encabeza con su nombre y su disponible; dentro van sus ciclos con su
total, y el botón de "marcar este ciclo como pagado" de la sección B.

`groupByCycle` gana la dimensión de tarjeta. Es la pieza que decide si
esta pantalla funciona o no con N tarjetas.

---

## E-bis. Saldos sin pagar, en el inicio

El cupo de la sección B depende de que el usuario marque los ciclos como
pagados. Si no lo hace, el disponible se desvía en silencio y nadie se
entera. Así que la app tiene que recordárselo donde sí mira todos los
días: el dashboard.

Función nueva, junto a `calcularDisponible`:

```ts
export interface SaldoSinPagar {
  tarjeta: PaymentMethod;
  paymentDate: ISODate;
  total: number;
  count: number;
}

/** Ciclos cuya fecha de pago YA pasó y siguen sin marcarse pagados. */
export function saldosSinPagar(
  tarjetas: PaymentMethod[],
  transacciones: Transaction[],
  hoy: ISODate,
): SaldoSinPagar[];
```

Vencidos primero, del más viejo al más nuevo: el que lleva más tiempo sin
pagar es el que más urge.

En el dashboard aparece como una tarjeta de aviso —solo si hay algo que
avisar, nunca vacía— con el total y cuántos ciclos, que lleva a
`CreditCardScreen` para marcarlos. Sigue la regla que el repo ya aplica
en `SyncIndicator.tsx:11-13`: que algo funcione no es noticia, solo se
muestra lo que pide acción.

**No se reutiliza `porPagar`**: ese mira el mes en curso y mezcla
pendientes, programados y tarjeta. Este mira hacia atrás, solo tarjeta y
solo vencido. Son preguntas distintas.

---

## F. Pruebas

Lo no trivial lleva prueba; lo obvio no.

**`disponible.test.ts`** (la matemática, es donde puede haber un error
silencioso de plata):

- una compra futura materializada NO consume cupo (la gotera de la
  sección B);
- las compras pagadas liberan cupo;
- las canceladas nunca contaron;
- el sobrecupo devuelve negativo, no cero;
- tarjeta sin `creditLimit` devuelve `null`;
- las compras de OTRA tarjeta no se cuentan.

**`groupByCycle`**: dos tarjetas con cortes distintos no se cruzan, y
cada ciclo suma solo lo suyo.

**Un e2e**: crear una segunda tarjeta con corte distinto, registrar un
gasto en ella, y verificar que su fecha de pago y su disponible son los
suyos y no los de la primera.

---

## Entrega

Tres tajadas, cada una desplegable sola:

1. **Modelo + dominio** — el campo, la migración, `calcularDisponible` y
   sus pruebas. No cambia nada visible todavía.
2. **UI de gestión** — la feature nueva, el reemplazo de la sección de
   Ajustes, y el borrado seguro.
3. **Pantalla de tarjetas** — `groupByCycle` por tarjeta y el botón de
   marcar ciclo pagado.

---

## Fuera de alcance, a propósito

- **Intereses y mora.** La app no modela deuda financiera y meterlo aquí
  la convertiría en otra cosa.
- **Saldo real del banco.** No hay integración bancaria; el disponible
  sale de los movimientos que el usuario registra.
- **Compras a cuotas (diferidos).** Es la spec 2, ya aprobada, y se
  modelará como transacciones materializadas copiando el patrón de
  `recurringRuleId` + `periodKey` con índice único (`db.ts:38`).

---

## Contexto de la secuencia

Cuatro subsistemas independientes, una spec cada uno, en este orden:

1. **Tarjetas múltiples + cupo** ← esta spec
2. **Diferidos a N cuotas** — 12 cuotas = 12 transacciones
   materializadas, para que balance, cupo y análisis sigan funcionando
   sin cambios.
3. **Filtros** — por tipo y estado, y granularidad en Análisis. Incluye
   un arreglo pendiente: `periodAggregate.ts:127` filtra por `t.date`
   crudo, así que Análisis todavía cuenta las compras con tarjeta en la
   fecha de compra en vez de la de pago — el mismo bug que se arregló en
   el dashboard el 2026-09-26 (commit `95e91ce`), que sobrevive ahí.
4. **Exportar a xlsx** — backup completo, una hoja por entidad. Hay
   precedente para cargar la librería con `import()` dinámico dentro de
   una función async (`supabase/client.ts:24-32`) y así no engordar el
   bundle inicial de la PWA. El helper `download()`
   (`exportImport.ts:5-15`) hoy solo acepta texto y habrá que
   generalizarlo a binario.
