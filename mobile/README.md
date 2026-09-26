# Step up — app nativa (Flutter)

Port nativo de la app web que vive en la raíz del repo. Comparten el mismo
Supabase, el mismo esquema y la misma lógica de negocio.

## Estado

| Capa | Estado |
|---|---|
| `lib/domain/` — fechas, quincenas, ciclo de TC, recurrentes, totales, plata | ✅ portada |
| `lib/data/` — SQLite local, con lápidas de borrado | ✅ |
| `lib/features/dashboard/` — pantalla de inicio | ✅ |
| Movimientos, formulario de captura, configuración inicial | ⬜ siguiente |
| Sync con Supabase | ⬜ después |

86 tests, `flutter analyze` limpio.

## Correr los tests

```bash
cd mobile
flutter test       # 86 tests, no necesita Xcode ni simulador
flutter analyze    # sin warnings
```

---

## Correr en el simulador

```bash
cd mobile
flutter run
```

Si hay varios destinos, elegí uno:

```bash
flutter devices                 # lista lo conectado
flutter run -d "iPhone 18 Pro"  # o el id largo que imprime
```

Mientras corre: `r` recarga en caliente, `R` reinicia la app, `q` sale.

**Para ver la ventana del simulador:** abrí Xcode y andá al menú
**Xcode → Open Developer Tool → Simulator**. En esta máquina `open -a
Simulator` no funciona: Xcode 27 no dejó el `Simulator.app` suelto donde
solía estar, así que el menú de Xcode es el camino. `flutter run` anda
igual aunque la ventana no esté abierta — arranca el simulador por debajo.

Para capturar la pantalla sin abrir nada:

```bash
xcrun simctl io booted screenshot captura.png
```

### Si el simulador no aparece

```bash
flutter doctor            # iOS tiene que estar en verde
xcrun simctl list runtimes   # tiene que listar al menos un iOS
```

Si no hay runtimes: `xcodebuild -downloadPlatform iOS` (son varios GB y
tarda; no imprime nada mientras baja).

---

## Instalarla en tu iPhone

Se puede con un Apple ID normal y gratis, con una limitación importante
que conviene saber antes de empezar: **la app deja de abrir a los 7 días**
y hay que volver a instalarla. Es una regla de Apple para cuentas
gratuitas, no algo del proyecto. Con el Apple Developer Program (US$99 al
año) dura un año y además podés instalarla por TestFlight sin cable.

### Una sola vez

1. Abrí el proyecto en Xcode:

   ```bash
   open mobile/ios/Runner.xcworkspace
   ```

   Ojo: el `.xcworkspace`, no el `.xcodeproj`.

2. **Xcode → Settings → Accounts → +** y agregá tu Apple ID.

3. En el panel de la izquierda elegí **Runner**, pestaña
   **Signing & Capabilities**:
   - marcá **Automatically manage signing**
   - en **Team** elegí tu nombre (*Personal Team*)
   - si se queja del **Bundle Identifier**, cambiá `com.mrunknown.myFinance`
     por otro: tiene que ser único en todo el mundo, así que agregale algo
     tuyo.

4. En el iPhone, activá el modo desarrollador:
   **Ajustes → Privacidad y seguridad → Modo de desarrollador → activar**.
   Pide reiniciar el teléfono.

### Cada vez que quieras instalarla

5. Conectá el iPhone por cable, desbloqueado. La primera vez el teléfono
   pregunta si confiás en el computador: decí que sí.

6. ```bash
   cd mobile
   flutter devices          # ahora aparece tu iPhone
   flutter run -d "<tu iPhone>"
   ```

   (O el botón ▶ de Xcode, da lo mismo.)

7. La primera vez el iPhone se niega a abrirla porque el certificado es
   tuyo y no de la App Store. Andá a
   **Ajustes → General → VPN y gestión de dispositivos**, tocá tu Apple ID
   y **Confiar**.

Listo: queda en la pantalla de inicio como "Step up", y funciona sin
cable y sin internet.

### Cuando deje de abrir (a los 7 días)

Reconectá el cable y volvé a correr `flutter run -d "<tu iPhone>"`. Los
datos **no se pierden**: siguen en la base de la app.

---

## Ojo: esta app todavía no sincroniza

La nativa guarda todo en el teléfono y punto. Todavía no habla con
Supabase, así que **no comparte datos con la app web**. Eso es lo
siguiente en la lista. Mientras tanto, la que sincroniza entre
dispositivos es la web (ver [docs/CUENTA.md](../docs/CUENTA.md)).

Y arranca con movimientos de ejemplo, porque el formulario para agregar
todavía no existe.

## Por qué el dominio se portó primero

Es lo único que se traduce casi literal y lo único que ya estaba probado:
funciones puras sobre fechas y enteros, sin UI ni base de datos. Portarlo
primero significa que cuando lleguen las pantallas, la parte que de verdad
puede equivocarse con la plata de alguien ya tiene 75 tests encima.

## Paridad con la app web

Hay un punto donde las dos apps podrían divergir en silencio: **el formato
de la plata**. Los datos CLDR de Dart no son los mismos que los del
navegador (es-PE agrupa distinto, es-CO pone el símbolo del otro lado,
es-ES no agrupa 4 dígitos). Por eso ninguna de las dos usa el formateador
de moneda de su plataforma: las dos tienen la misma tabla explícita, y las
dos la verifican con los mismos siete casos.

- `mobile/lib/domain/money/format.dart`
- `src/domain/money/format.ts`

Si cambiás una, el test de la otra falla. Es a propósito.
