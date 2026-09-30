import { useT } from '@/i18n/language';
import { IconCurrencyDollar, IconMicrophone, IconRepeat, IconTrendingDown, type IconProps } from '@tabler/icons-react';
import { useState, type ComponentType } from 'react';
import { useDialogo } from '@/components/ui/useDialogo';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { QuickEntrySheet } from '@/features/quick/QuickEntrySheet';
import { haptic } from '@/lib/haptic';
import { useBreakpoint } from '@/app/useBreakpoint';

/**
 * Three tabs (redesign §2). Movimientos hangs from Inicio and the calendar
 * is a view of Movimientos, so neither needs a tab of its own. Exported
 * so the desktop sidebar can reuse the same list.
 */
export const TABS = [
  // The KEY is stored, not the text: the text depends on the active language.
  { to: '/', key: 'nav.home', icon: 'M3 10.5 12 3l9 7.5V21H3z' },
  { to: '/analisis', key: 'nav.analytics', icon: 'M5 20V10M12 20V4M19 20v-7' },
  { to: '/ajustes', key: 'nav.settings', icon: 'M4 7h16M4 17h16M9 7v0M15 17v0' },
] as const;

export function TabBar() {
  const t = useT();
  const [quickOpen, setQuickOpen] = useState(false);
  // 760–1099px: the same tabs as a 72px rail on the left, the + on top.
  const rail = useBreakpoint() === 'tablet';

  // The + is always visible (it used to hide on scroll down): it's the main
  // action, and the pill it sits next to doesn't cover the content anyway.
  // It still hides while a dialog is open (index.css, by its aria-label).
  const { pathname } = useLocation();

  const tabs = TABS.map((tab) => (
    <NavLink
      key={tab.to}
      to={tab.to}
      end={tab.to === '/'}
      onClick={() => {
        if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
      style={({ isActive }) => {
        // Movimientos hangs from Inicio: it keeps Inicio lit.
        const active = isActive || (tab.to === '/' && pathname.startsWith('/movimientos'));
        return {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          borderRadius: rail ? 16 : 27,
          ...(rail ? { width: 60, height: 58 } : {}),
          textDecoration: 'none',
          background: active ? 'var(--line-strong)' : 'transparent',
          color: active ? 'var(--text)' : 'var(--text-faint)',
          fontSize: rail ? 10.5 : 11,
          fontWeight: 600,
          transition: 'background var(--dur-fast) var(--ease-spring-out), color var(--dur-fast) var(--ease-spring-out)',
        };
      }}
    >
      <svg width={rail ? 22 : 23} height={rail ? 22 : 23} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d={tab.icon}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {t(tab.key)}
    </NavLink>
  ));

  const add = (
    <AddButton
      size={rail ? 48 : undefined}
      onClick={() => {
        haptic('light');
        setQuickOpen(true);
      }}
    />
  );

  return (
    <>
      {rail ? (
        // Tablet: a rail down the left edge, the + first so the main action
        // is still the easiest thing to reach.
        <div
          data-testid="tab-rail"
          style={{
            position: 'fixed', top: 0, bottom: 0, left: 0, width: 72, zIndex: 40,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
            padding: 'calc(var(--safe-top) + 18px) 0 18px',
            background: 'var(--paper)', borderRight: '1px solid var(--line)',
          }}
        >
          {add}
          <nav
            aria-label={t('nav.mainNavigation')}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
          >
            {tabs}
          </nav>
        </div>
      ) : (
      /* A floating pill plus the + as its sibling, not a full-width bar:
          the content shows around it and the main action sits on the same
          line as the tabs, where the thumb already is. */
      <div
        style={{
          position: 'fixed',
          left: 14,
          right: 14,
          bottom: 'calc(var(--safe-bottom) + 12px)',
          display: 'flex',
          gap: 10,
          zIndex: 40,
          maxWidth: 560,
          marginInline: 'auto',
        }}
      >
        <nav
          aria-label={t('nav.mainNavigation')}
          style={{
            flex: 1,
            height: 'var(--tabbar-h)',
            borderRadius: 31,
            padding: 4,
            display: 'grid',
            gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
            background: 'color-mix(in srgb, var(--surface) 88%, transparent)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--line-strong)',
            boxShadow: 'var(--shadow-3)',
          }}
        >
          {tabs}
        </nav>
        {add}
      </div>
      )}
      <QuickActions open={quickOpen} onClose={() => setQuickOpen(false)} />
    </>
  );
}

/**
 * The menu behind the + (Contarle a la app / Gasto / Ingreso / Recurrente)
 * and what each option does. Exported so the desktop header's "Nuevo
 * movimiento" opens exactly the same menu — as a centred dialog there,
 * like every sheet on wide screens.
 */
export function QuickActions({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [hablarOpen, setHablarOpen] = useState(false);
  return (
    <>
      {open && (
        <QuickActionSheet
          onClose={onClose}
          onSelect={(action) => {
            onClose();
            if (action === 'hablar') setHablarOpen(true);
            else if (action === 'gasto') navigate('/movimientos?nuevo=1');
            else if (action === 'ingreso') navigate('/movimientos?nuevo=1&tipo=ingreso');
            else if (action === 'recurrente') navigate('/ajustes/recurrentes?nuevo=1');
          }}
        />
      )}
      {hablarOpen && (
        <QuickEntrySheet
          onClose={() => setHablarOpen(false)}
          onAdjust={(text) => {
            setHablarOpen(false);
            // The full form re-interprets it: a single
            // definition of what the phrase means, not two.
            navigate(`/movimientos?texto=${encodeURIComponent(text)}`);
          }}
        />
      )}
    </>
  );
}

/**
 * The "+" isn't a tab: it's an action. It sits NEXT TO the tab pill, a
 * 62px circle on the same line, so it never covers the list above it.
 * Tap opens a quick menu with Speak/Expense/Income/Recurring. It still
 * hides on scroll down (see TabBar) — index.css also hides it while a
 * dialog is open, by its aria-label.
 */
function AddButton({ onClick, hidden, size }: { onClick: () => void; hidden?: boolean; size?: number }) {
  const t = useT();
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type="button"
      aria-label={t('action.addTransaction')}
      className="fab-add"
      // The action lives in onClick, not onPointerUp. Pointer events
      // only arrive with a finger or mouse: with the keyboard (Enter/Space) and
      // with VoiceOver —which activates by sending a click— this button did
      // absolutely nothing, and it's the app's main button. The pointer
      // handlers are left with just the visual pressed-down effect.
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        flex: 'none',
        transform: `scale(${hidden ? 0 : pressed ? 0.94 : 1})`,
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? 'none' : 'auto',
        width: size ?? 'var(--tabbar-h)',
        height: size ?? 'var(--tabbar-h)',
        borderRadius: size ? size / 2 : 31,
        border: 'none',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--q10)',
        color: 'var(--on-accent)',
        cursor: 'pointer',
        boxShadow: '0 10px 30px color-mix(in srgb, var(--q10) 35%, transparent)',
        transition: 'transform var(--dur-med) var(--ease-spring-out), opacity var(--dur-med) var(--ease-spring-out)',
        touchAction: 'none',
      }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function QuickActionSheet({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (action: 'hablar' | 'gasto' | 'ingreso' | 'recurrente') => void;
}) {
  const t = useT();
  const dialogRef = useDialogo(onClose);
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label={t('action.quickAction')}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'color-mix(in srgb, black 40%, transparent)',
        display: 'flex',
        alignItems: 'flex-end',
        zIndex: 60,
        animation: 'fadeIn var(--dur-fast) var(--ease-spring-out)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          margin: '0 auto',
          background: 'var(--surface)',
          borderRadius: '20px 20px 0 0',
          padding: '10px 16px calc(var(--safe-bottom) + 16px)',
          animation: 'slideUp var(--dur-med) var(--ease-spring-out)',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '4px auto 12px' }} />
        <ActionRow
          icono={IconMicrophone}
          label={t('action.tellIt')}
          sub={t('action.tellItSub')}
          onClick={() => onSelect('hablar')}
        />
        <ActionRow
          icono={IconTrendingDown}
          label={t('action.newExpense')}
          sub={t('action.newExpenseSub')}
          onClick={() => onSelect('gasto')}
        />
        <ActionRow
          icono={IconCurrencyDollar}
          label={t('action.newIncome')}
          sub={t('action.newIncomeSub')}
          onClick={() => onSelect('ingreso')}
        />
        <ActionRow
          icono={IconRepeat}
          label={t('action.newRecurring')}
          sub={t('action.newRecurringSub')}
          onClick={() => onSelect('recurrente')}
        />
        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: 8,
            minHeight: 48,
            borderRadius: 'var(--radius-s)',
            border: 'none',
            background: 'var(--surface-sunken)',
            color: 'var(--text)',
            fontWeight: 600,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          {t('action.cancel')}
        </button>
      </div>
    </div>
  );
}

function ActionRow({ icono: Icono, label, sub, onClick }: {
  icono: ComponentType<IconProps>; label: string; sub: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic('light');
        onClick();
      }}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 8px',
        background: 'none',
        border: 'none',
        borderBottom: '1px solid var(--line)',
        cursor: 'pointer',
        textAlign: 'left',
        color: 'var(--text)',
      }}
    >
      <span
        aria-hidden
        style={{
          flex: 'none', width: 40, height: 40, borderRadius: 12, display: 'grid',
          placeItems: 'center', background: 'var(--surface-sunken)', color: 'var(--text)',
        }}
      >
        <Icono size={21} stroke={1.75} />
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{sub}</div>
      </div>
      <span style={{ color: 'var(--text-faint)', fontSize: 20 }}>›</span>
    </button>
  );
}
