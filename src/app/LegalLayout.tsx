import { Outlet } from 'react-router-dom';
import { useTheme } from './useTheme';
import { LegalFooter } from '@/features/legal/LegalFooter';

/**
 * Envoltura minima para las paginas legales.
 *
 * No usa AppLayout porque AppLayout trae AuthGate y OnboardingGate, y estas
 * paginas tienen que ser legibles sin cuenta y sin haber terminado la
 * configuracion inicial. Tampoco lleva TabBar: no son parte de la app, son
 * documentos.
 *
 * Si conserva useTheme: un documento en modo claro cuando el telefono esta
 * en oscuro deslumbra de noche.
 */
export function LegalLayout() {
  useTheme();
  return (
    <div
      style={{
        minHeight: '100dvh',
        paddingTop: 'calc(var(--safe-top) + var(--gap-l))',
        paddingBottom: 'calc(var(--safe-bottom) + var(--gap-xl))',
      }}
    >
      <Outlet />
      <LegalFooter />
    </div>
  );
}
