import { Suspense, lazy } from 'react';
import { Navigate, createBrowserRouter, useLocation } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { translate } from '@/i18n/language';
import { LegalLayout } from './LegalLayout';
import { ErrorBoundary } from './ErrorBoundary';
import { DashboardScreen } from '@/features/dashboard/DashboardScreen';
import { TransactionsScreen } from '@/features/transactions/TransactionsScreen';
import { LegalRedirect, PreferencesScreen, SettingsIndex, SettingsLayout } from '@/features/settings/SettingsLayout';
import { ProfileScreen } from '@/features/settings/ProfileScreen';
import { ChangePasswordScreen } from '@/features/settings/ChangePasswordScreen';
import { CurrencyScreen } from '@/features/settings/CurrencyScreen';
import { PayDaysScreen } from '@/features/settings/PayDaysScreen';
import { RemindersScreen } from '@/features/settings/RemindersScreen';
import { ShortcutsScreen } from '@/features/settings/ShortcutsScreen';
import { DataScreen } from '@/features/settings/DataScreen';
import { CategoriesScreen } from '@/features/categories/CategoriesScreen';
import { PaymentMethodsScreen } from '@/features/payment-methods/PaymentMethodsScreen';
import { RecurringRulesScreen } from '@/features/recurring/RecurringRulesScreen';
import { CreditCardScreen } from '@/features/credit-card/CreditCardScreen';
import { BudgetsScreen } from '@/features/budgets/BudgetsScreen';
import { LegalDocScreen, LegalIndexScreen, LegalPanelScreen } from '@/features/legal/LegalScreen';
import { useBreakpoint } from './useBreakpoint';

// Recharts is heavy (~500kb) and only this screen needs it: it's split off
// into its own chunk so it doesn't bloat the app's initial load.
const AnalyticsScreen = lazy(() =>
  import('@/features/analytics/AnalyticsScreen').then((m) => ({ default: m.AnalyticsScreen })),
);

/**
 * On desktop Movimientos is already on screen, embedded in Inicio (§9g), so
 * /movimientos lands there — keeping the query, so ?nuevo=1, ?tipo=ingreso,
 * ?texto= and ?vista=calendario (iOS Shortcuts, the + menu, old links) still
 * do what they did.
 */
function MovimientosRoute() {
  const desktop = useBreakpoint() === 'desktop';
  const { search } = useLocation();
  if (desktop) return <Navigate to={{ pathname: '/', search }} replace />;
  return <TransactionsScreen />;
}

function LazyFallback() {
  return <div style={{ padding: 'var(--gap-l)', color: 'var(--text-faint)' }}>{translate('home.loading')}</div>;
}

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <ErrorBoundary><AppLayout /></ErrorBoundary>,
      children: [
        { index: true, element: <DashboardScreen /> },
        { path: 'movimientos', element: <MovimientosRoute /> },
        // The calendar is a view of Movimientos now. The old path stays so
        // bookmarks and notifications that point to it keep working.
        { path: 'calendario', element: <Navigate to="/movimientos?vista=calendario" replace /> },
        { path: 'analisis', element: <ErrorBoundary><Suspense fallback={<LazyFallback />}><AnalyticsScreen /></Suspense></ErrorBoundary> },
        {
          // Settings sub-screens (redesign §7): each a thin wrapper around the
          // section that used to be expanded on the long Settings page. On a
          // phone each one is pushed; on desktop SettingsLayout shows them in
          // the right-hand panel beside the list (§9g 2c).
          path: 'ajustes',
          element: <SettingsLayout />,
          children: [
            { index: true, element: <SettingsIndex /> },
            { path: 'cuenta', element: <ProfileScreen /> },
            { path: 'cuenta/contrasena', element: <ChangePasswordScreen /> },
            { path: 'preferencias', element: <PreferencesScreen /> },
            { path: 'moneda', element: <CurrencyScreen /> },
            { path: 'pagos', element: <PayDaysScreen /> },
            { path: 'recordatorios', element: <RemindersScreen /> },
            { path: 'atajos', element: <ShortcutsScreen /> },
            { path: 'datos', element: <DataScreen /> },
            { path: 'categorias', element: <CategoriesScreen /> },
            { path: 'metodos', element: <PaymentMethodsScreen /> },
            { path: 'recurrentes', element: <RecurringRulesScreen /> },
            { path: 'presupuestos', element: <BudgetsScreen /> },
            { path: 'legal', element: <LegalRedirect><LegalPanelScreen /></LegalRedirect> },
            { path: 'legal/:slug', element: <LegalRedirect><LegalPanelScreen /></LegalRedirect> },
          ],
        },
        { path: 'tarjeta', element: <CreditCardScreen /> },
      ],
    },
    // Legal lives OUTSIDE AppLayout, i.e. outside AuthGate and
    // OnboardingGate, on purpose: the terms and the privacy policy
    // need to be readable BEFORE creating an account. Putting them behind
    // login is asking someone to accept something they can't see.
    {
      path: '/legal',
      element: <ErrorBoundary><LegalLayout /></ErrorBoundary>,
      children: [
        { index: true, element: <LegalIndexScreen /> },
        { path: ':slug', element: <LegalDocScreen /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
