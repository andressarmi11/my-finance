# Automatizar con Atajos de iOS

Cómo meter gastos e ingresos desde el iPhone sin abrir la app y navegar
hasta el formulario.

## Lo primero: por qué un enlace no alcanza

Un Atajo que abre un enlace `https://…` **cae en Safari**, no en la app
instalada — iOS no sabe meter una URL dentro de una web app de la pantalla
de inicio. Y Safari tiene su propio almacenamiento, así que el gasto queda
del lado equivocado.

Por eso hay un camino que **no abre un enlace**: el Atajo manda el texto a
tu bandeja, y la app te lo muestra para confirmar. Para el SMS del banco
es mejor que abrir algo: no te interrumpe, no cambia de app, no pide nada.
Y si además quieres que se abra la app, el Atajo la abre con la acción
**Abrir app** — que sí entiende las web apps instaladas.

Necesitas tener cuenta ([CUENTA.md](CUENTA.md)): la bandeja va con tu
cuenta, no con el navegador.

---

## La forma corta: mandarle la frase y que la app entienda

```
https://andressarmi11.github.io/step-up/movimientos?texto=TU%20FRASE
```

La app interpreta español: saca el monto, la fecha, el método de pago y
el concepto, y propone categoría. No hace falta que el Atajo arme nada.

| Le mandas | Entiende |
|---|---|
| `gasté 45 mil en el almuerzo` | Gasto, $45.000, Almuerzo, hoy, Alimentación |
| `pagué 120 mil de mercado con la tarjeta` | Gasto, $120.000, Mercado, Tarjeta de crédito |
| `me llegaron 2 millones de nómina` | Ingreso, $2.000.000, Nómina |
| `gasté 20 mil en uber ayer` | Gasto, $20.000, Uber, ayer, Transporte |
| `cuarenta y cinco mil en cine` | Gasto, $45.000, Cine, Entretenimiento |

Entiende montos como los dice la gente: `45000`, `45.000`, `45 mil`,
`45k`, `45 lucas`, `cuarenta y cinco mil`, `1.2 millones`,
`dos millones y medio`.

**Y aprende.** Si corriges la categoría una vez, la próxima vez que
menciones ese mismo concepto ya sale bien — sale de tu historial, no de
una lista fija.

---

## La forma larga: campo por campo

Si prefieres que el Atajo arme cada dato:

```
https://andressarmi11.github.io/step-up/movimientos?nuevo=1&tipo=ingreso
```

| Parámetro   | Qué hace                                   | Valores                  |
|-------------|--------------------------------------------|--------------------------|
| `nuevo=1`   | Abre el formulario vacío.                   | `1`                      |
| `tipo`      | Si no lo pones, gasto.                      | `ingreso` \| `gasto`     |
| `monto`     | Opcional. Solo dígitos.                     | `3000000`                |
| `concepto`  | Opcional, codificado para URL.              | `Sueldo`, `Mercado%20D1` |
| `fecha`     | Opcional. Si no la pones, hoy.              | `2026-09-18`             |
| `pagado=1`  | Lo marca como ya recibido / ya pagado.      | `1`                      |

**El enlace de arriba no lleva monto a propósito**: el Atajo lo pega al
final. Si prefieres que la app pregunte, no mandes `monto` y el
formulario se abre listo para escribirlo.

> El formulario se abre lleno y tú tocas **Guardar**. Ese toque es a
> propósito: un Atajo que lee un SMS del banco puede sacar mal el monto, y
> un registro de plata escrito sin que nadie lo mire es peor que teclearlo.

---

## Atajo 1 — Dictar un gasto

El más útil, y son tres pasos:

1. **Atajos** → **+**.
2. Agrega **Dictar texto** (Idioma: Español).
3. Agrega **Texto** y pega, poniendo la variable de *Texto dictado* al final:

   ```
   https://andressarmi11.github.io/step-up/movimientos?texto=[Texto dictado]
   ```

4. Agrega **Abrir URLs** con ese texto.
5. Nómbralo **Anotar gasto**.

Ahora dices *"Oye Siri, anotar gasto"*, hablas normal, y la app abre el
formulario ya lleno.

También funciona desde el widget de Atajos o con el **Toque en la parte
trasera** (Ajustes → Accesibilidad → Tocar → Toque en la parte trasera).

> Dentro de la app también puedes hablar: el botón **+** → **Contarle a la
> app** tiene micrófono. Ahí no hace falta Atajos.

**Variante que abre la app instalada** (en vez de Safari): en lugar de
*Abrir URLs*, usa **Obtener contenido de la URL** con la dirección de
dictado que copiaste de Ajustes, arrastrando al final la variable *Texto
dictado*. Después agrega **Abrir app** → *Step up*. El movimiento ya
está esperándote en la bandeja.

---

## Atajo 2 — Desde el SMS del banco, sin abrir nada

**Lo que iOS sí permite y lo que no.** Ninguna app puede leer tus mensajes:
iOS no lo expone, ni a las apps ni a los Atajos. Lo único posible es una
**automatización que se dispara cuando llega un mensaje** y recibe ese
mensaje. Es automático a partir de ahí, pero el disparador es la llegada
del SMS, no una app leyendo tu bandeja.

### Antes: saca tu clave

La clave sale de **Step up**, o sea de tu propia app — no de Atajos ni
del panel de Supabase.

1. Abre <https://andressarmi11.github.io/step-up/> (o el ícono de la
   pantalla de inicio, si ya la instalaste).
2. Inicia sesión con tu correo y contraseña.
3. Pestaña **Ajustes**, la última de la barra de abajo.
4. Baja hasta **Automatizaciones (Atajos)** — queda debajo de *Tu cuenta*.
5. Toca **Generar clave**.

Se muestra **una sola vez**. No copies solo la clave: copia la
**dirección completa**, que ya la trae adentro y termina en `&texto=`.
Hay un botón para cada Atajo (SMS y dictado).

```
https://…/functions/v1/ingest?origen=sms&token=mf_TU_CLAVE&texto=
```

Esa clave sirve **solo** para dejar texto en tu bandeja: no lee tus
movimientos, no lee tu configuración, no borra nada. Si se te filtra, lo
peor que puede pasar es que te escriban basura en la bandeja, que vas a
ver antes de confirmar. Generar una nueva anula la anterior.

### La automatización

1. Atajos → pestaña **Automatización** → **+** → **Mensaje**.
2. **Remitente**: el número o nombre corto de tu banco.
   **Contiene**: una palabra que salga siempre (`Compra`, `Pagaste`,
   `Recibiste`).
3. Acciones:
   - **Obtener texto del input** (el cuerpo del mensaje).
   - **Obtener contenido de la URL**: pega la dirección que copiaste y
     **arrastra al final la variable *Texto*** del paso anterior.

     Eso es todo: no toques método, ni cuerpo, ni campos JSON. La acción
     viene en GET por defecto y así está bien.
4. Activa **Ejecutar inmediatamente**.

Listo. El Atajo no abre nada. La próxima vez que abras la app te aparece
arriba **"1 movimiento llegó solo"**, lo revisas y lo anotas de un toque.

**No hace falta ninguna expresión regular**: le pasas el SMS crudo y la app
lo interpreta. Ya reconoce las formas típicas:

```
Bancolombia le informa Compra por $145.000 en EXITO 18/09/2026 14:32
Nequi: Pagaste $12.500 a RAPPI
Bancolombia: Recibiste $2.800.000 por NOMINA
```

Saca el monto, el comercio, la fecha del mensaje, y si fue compra o abono.
El nombre del banco no queda como concepto.

> El toque de confirmación es a propósito: el monto lo escribió tu banco
> con un formato que puede cambiar sin avisar. Un registro de plata que
> entra sin que nadie lo mire es peor que teclearlo.

### Si quieres que además se abra la app

Agrega al final del Atajo la acción **Abrir app** y elegí *Step up*.
Esa acción sí entiende las web apps instaladas en la pantalla de inicio
(no así los enlaces). La app abre con el movimiento ya esperándote en la
bandeja.

Si *Step up* no aparece en la lista, es que todavía no la instalaste:
Safari → **Compartir** → **Agregar a inicio**.

## ¿Y no hay un enlace que instale el Atajo solo?

Corto: no del todo, y conviene saber por qué antes de buscarlo.

- **Los enlaces de iCloud** (`icloud.com/shortcuts/…`) los genera la app
  Atajos desde un dispositivo con sesión de iCloud. No se pueden fabricar
  desde afuera.
- **Un archivo `.shortcut`** sí se puede fabricar, pero iOS solo importa
  los que no vienen firmados por Apple si activas *Atajos no fiables*, y
  eso cambia según la versión de iOS. No tengo un iPhone para probarlo, así
  que no te voy a mandar un archivo diciendo que funciona sin haberlo
  visto funcionar.
- **Las automatizaciones personales** (la del SMS) **no se pueden compartir
  ni importar**, punto. Es una decisión de Apple: un atajo que se dispara
  solo al recibir un mensaje tiene que armarlo el dueño del teléfono. Ni
  yo ni nadie puede mandártela hecha.

Por eso el esfuerzo se fue a que armarlo a mano sea corto: la app te da la
dirección **ya con tu clave adentro**, y en el Atajo queda una sola acción
con una sola pegada.

---

## Atajo 3 — Gasto fijo de un toque

Para lo que gastas siempre igual:

```
https://andressarmi11.github.io/step-up/movimientos?texto=pasaje%2012%20mil
```

Un solo paso **Abrir URLs**. Ponlo como widget y es un toque.

---

## Por qué no usa inteligencia artificial

La interpretación corre **en tu teléfono, sin conexión y sin costo**. No
hay modelo de lenguaje ni llamada a ninguna API.

Es a propósito: para plata, una interpretación que puede cambiar sola
entre dos ejecuciones no es lo que uno quiere. Y la clave de una API no
puede vivir en el código de una web pública sin quedar expuesta.

Lo que la app aprende, lo aprende de **tu** historial: cada vez que
guardas, recuerda qué categoría y qué método le pusiste a ese concepto.

Si algún día la lista de frases se queda corta, el camino sería una Edge
Function de Supabase que hable con un modelo — la clave queda del lado del
servidor. Tiene costo por uso y necesita internet; por eso no es el
arranque.
