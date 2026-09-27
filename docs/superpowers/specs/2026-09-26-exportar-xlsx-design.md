# Exportar a Excel (.xlsx)

**Fecha:** 2026-09-26
**Estado:** diseño aprobado
**Spec 4 de 4.**

---

## Qué se quiere

Un botón que baje todo en formato Excel: **una hoja por entidad**, para
archivar el año y para abrirlo y sumar cosas a mano.

---

## Advertencia que define el diseño

**Este .xlsx no se puede volver a importar.**

Para que sea útil en Excel hay que poner nombres donde el modelo tiene
ids: la categoría "Alimentación" en vez de `cat-alimentacion`, "Visa
Bancolombia" en vez de un UUID, "Pagado" en vez de `paid`. Eso lo vuelve
legible y lo vuelve irreversible: no hay forma fiable de volver del nombre
al id.

La ruta de restauración sigue siendo el **JSON**, que ya existe y sí es
reversible (`importBackup` + `BackupSchema`). El xlsx es para **leer y
analizar**, y eso se dice en la pantalla, no solo acá.

---

## A. La librería

`write-excel-file` (4.1.1). Comparado antes de elegir:

| Paquete | Tamaño sin comprimir | Problema |
|---|---|---|
| `exceljs` 4.4.0 | 21,8 MB | Lee y escribe; no necesitamos leer |
| `xlsx` (SheetJS) 0.18.5 | 7,5 MB | La versión de npm es la vieja con CVEs; las corregidas solo están en su CDN |
| **`write-excel-file` 4.1.1** | **1,8 MB** | Solo escribe — que es justo lo único que hace falta |

### Carga diferida, obligatoria

La app es una PWA offline-first que se instala en el iPhone, y el bundle
ya tiene un `chunkSizeWarningLimit: 600` y un chunk de Analytics de ~400 kB.
Una librería de Excel no puede entrar en la carga inicial para una acción
que se usa una vez al mes.

Se carga con `import()` dinámico **dentro de la función async**, copiando
`src/data/supabase/client.ts:24-32`, que ya hace exactamente eso con
`@supabase/supabase-js`. No es `React.lazy`: no es una pantalla, es una
acción bajo demanda.

---

## B. `download()` tiene que aceptar binario

`src/data/backup/exportImport.ts:5-15` recibe `content: string`. Un xlsx
son bytes. Se generaliza a `BlobPart`, que cubre string y `Uint8Array` sin
tocar a los dos llamadores que ya existen (JSON y CSV).

---

## C. Las siete hojas

Una por entidad del `BackupSchema` (`src/data/backup/schema.ts:120-130`):

1. **Movimientos** — fecha, tipo, concepto, categoría, método, estado,
   valor, se paga el, cuota, notas.
2. **Categorías** — nombre, ícono, aplica a, archivada.
3. **Métodos de pago** — nombre, tipo, corte, pago, cupo.
4. **Presupuestos** — año, mes, categoría, monto.
5. **Recurrentes** — nombre, tipo, valor, frecuencia, día, categoría,
   método, activa, desde, hasta.
6. **Recordatorios** — movimiento, cuándo, estado.
7. **Configuración** — nombre, moneda, días de pago, tema.

### Reglas de formato

- **Montos: número**, no texto. Con formato de moneda, para que Excel los
  sume. Meterlos como `"$ 1.200.000"` los volvería inertes, que es el
  error clásico de estas exportaciones — y el CSV actual ya lo comete al
  revés, volcando el número crudo sin formato (`exportImport.ts:44`).
- **Fechas: fecha**, no texto, por lo mismo.
- **Estados en español**: `paid` → "Pagado", `pending` → "Pendiente",
  `scheduled` → "Programado", `cancelled` → "Cancelado".
- **Cuotas**: "3 de 12" en su propia columna, no pegado al concepto.
- Ids resueltos a nombres; si el id no existe (una tarjeta borrada), la
  celda queda vacía en vez de mostrar el UUID.

---

## D. Dónde se dispara

Un tercer botón en Ajustes → Tus datos, junto a "Exportar JSON" y
"Exportar CSV" (`SettingsScreen.tsx:238-242`), con el mismo estado `busy`.
Debajo, la nota de que para restaurar se usa el JSON.

---

## E. Pruebas

El valor está en la **transformación**, no en el zip: que el xlsx sea un
zip válido lo garantiza la librería, y probarlo sería probar la librería.

Lo que sí se prueba, con `filasDeMovimientos()` y hermanas extraídas como
funciones puras:

- los ids se resuelven a nombres, y una categoría borrada deja la celda
  vacía en vez de un UUID;
- los estados salen traducidos;
- los montos salen como número, no como texto;
- las cuotas salen como "3 de 12";
- los cancelados **sí** se exportan (es un archivo, no un balance).

Un e2e que dispare la descarga y verifique que el archivo llega con el
nombre y el tipo correctos.

---

## Fuera de alcance

- **Importar desde xlsx.** La restauración es por JSON.
- Gráficos o tablas dinámicas dentro del archivo.
- Elegir qué hojas exportar: van las siete.
