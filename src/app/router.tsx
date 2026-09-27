import { Suspense, lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { LegalLayout } from './LegalLayout';
import { ErrorBoundary } from './ErrorBoundary';
import { DashboardScreen } from '@/features/dashboard/DashboardScreen';
import { TransactionsScreen } from '@/features/transactions/TransactionsScreen';
import { CalendarScreen } from '@/features/calendar/CalendarScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { CategoriesScreen } from '@/features/categories/CategoriesScreen';
import { PaymentMethodsScreen } from '@/features/payment-methods/PaymentMethodsScreen';
import { RecurringRulesScreen } from '@/features/recurring/RecurringRulesScreen';
import { CreditCardScreen } from '@/features/credit-card/CreditCardScreen';
import { BudgetsScreen } from '@/features/budgets/BudgetsScreen';
import { LegalDocScreen, LegalIndexScreen } from '@/features/legal/LegalScreen';

// Recharts es pesado (~500kb) y solo lo necesita esta pantalla: se separa
// en su propio chunk para no inflar la carga inicial de la app.
const AnalyticsScreen = lazy(() =>
  import('@/features/analytics/AnalyticsScreen').then((m) => ({ default: m.AnalyticsScreen })),
);

function LazyFallback() {
  return <div style={{ padding: 'var(--gap-l)', color: 'var(--text-faint)' }}>Cargando…</div>;
}

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <ErrorBoundary><AppLayout /></ErrorBoundary>,
      children: [
        { index: true, element: <DashboardScreen /> },
        { path: 'movimientos', element: <TransactionsScreen /> },
        { path: 'calendario', element: <CalendarScreen /> },
        { path: 'analisis', element: <ErrorBoundary><Suspense fallback={<LazyFallback />}><AnalyticsScreen /></Suspense></ErrorBoundary> },
        { path: 'ajustes', element: <SettingsScreen /> },
        { path: 'ajustes/categorias', element: <CategoriesScreen /> },
        { path: 'ajustes/metodos', element: <PaymentMethodsScreen /> },
        { path: 'ajustes/recurrentes', element: <RecurringRulesScreen /> },
        { path: 'tarjeta', element: <CreditCardScreen /> },
        { path: 'ajustes/presupuestos', element: <BudgetsScreen /> },
      ],
    },
    // Lo legal va FUERA de AppLayout, o sea fuera de AuthGate y de
    // OnboardingGate, a proposito: los terminos y la politica de privacidad
    // tienen que poder leerse ANTES de crear una cuenta. Tenerlos detras
    // del login es pedirle a alguien que acepte algo que no puede ver.
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
