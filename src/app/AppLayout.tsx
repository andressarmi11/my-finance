import { Outlet } from 'react-router-dom';
import { TabBar } from '@/components/ui/TabBar';
import { InstallBanner } from '@/components/ui/InstallBanner';
import { InboxBanner } from '@/features/inbox/InboxBanner';
import { SyncIndicator } from '@/components/ui/SyncIndicator';
import { Logo } from '@/components/ui/Logo';
import { AuthGate } from '@/features/auth/AuthGate';
import { OnboardingGate } from '@/features/onboarding/OnboardingGate';
import { useCloudSync } from '@/data/sync/useCloudSync';
import { useMoneyFormat } from './useMoneyFormat';
import { useTheme } from './useTheme';

/**
 * Orden de las capas, y por que ese orden:
 *   AuthGate       — sin sesion no hay nada que mostrar.
 *   useCloudSync   — baja los datos de la cuenta ANTES de decidir nada mas.
 *   OnboardingGate — solo pregunta la configuracion inicial si, despues de
 *                    bajar, sigue sin haberla. Si no, un telefono nuevo
 *                    volveria a preguntar nombre y moneda cada vez.
 */
export function AppLayout() {
  useTheme();
  return (
    <AuthGate>
      <AppShell />
    </AuthGate>
  );
}

function AppShell() {
  const { estado, error, primeraHecha, sincronizar } = useCloudSync();
  useMoneyFormat();

  return (
    <OnboardingGate esperando={!primeraHecha}>
      {/* 100dvh, no 100%: en iOS el alto en % se resuelve contra el viewport
          grande e ignora que la barra de Safari aparece y desaparece, asi que
          pantallas cortas quedaban sin scroll y con la barra de abajo flotando
          por encima del toolbar. dvh sigue el viewport real. */}
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <BrandBar />
        <main
          style={{
            flex: 1,
            // El safe-area de arriba ya lo absorbe BrandBar, que va pegada.
            paddingTop: 'var(--gap-l)',
            // 61 barra + 14 + 56 FAB + aire: nada queda debajo del tab bar ni del +.
            paddingBottom: 'calc(var(--safe-bottom) + 148px)',
          }}
        >
          <InstallBanner />
          <InboxBanner />
          <Outlet />
        </main>
        <TabBar />
        <SyncIndicator estado={estado} error={error} onReintentar={() => void sincronizar(true)} />
      </div>
    </OnboardingGate>
  );
}

/**
 * Barra de marca. Es el patrón de iOS: una barra fina y translúcida que
 * siempre dice dónde estás parado, y debajo el large title de cada pantalla
 * (Screen.tsx), que sí cambia. Sin ella el nombre de la app solo se veía al
 * iniciar sesión y después desaparecía.
 *
 * sticky y no fixed: cuando el teclado achica el viewport, fixed se queda
 * flotando sobre el contenido; sticky se va con el scroll del documento.
 * Se come el --safe-top para que el blur llegue hasta el notch en vez de
 * dejar una franja del fondo arriba.
 */
function BrandBar() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        // Por encima del contenido y del tab bar (40), por debajo de los
        // modales (50-70): una hoja abierta tiene que taparla.
        zIndex: 30,
        paddingTop: 'var(--safe-top)',
        background: 'color-mix(in srgb, var(--paper) 78%, transparent)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <div
        style={{
          maxWidth: 560,
          margin: '0 auto',
          height: 48,
          padding: '0 var(--gap-l)',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
        }}
      >
        <Logo size={22} />
        <span
          className="figures"
          style={{
            fontSize: 'var(--text-md)',
            fontWeight: 700,
            letterSpacing: '-0.015em',
            color: 'var(--text)',
          }}
        >
          Step up
        </span>
      </div>
    </header>
  );
}
