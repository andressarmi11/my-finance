import { useT } from '@/i18n/language';
import { IconCurrencyDollar, IconMicrophone, IconRepeat, IconTrendingDown, type IconProps } from '@tabler/icons-react';
import { useEffect, useState, type ComponentType } from 'react';
import { useDialogo } from '@/components/ui/useDialogo';
import { NavLink, useNavigate } from 'react-router-dom';
import { QuickEntrySheet } from '@/features/quick/QuickEntrySheet';
import { haptic } from '@/lib/haptic';

const TABS = [
  // The KEY is stored, not the text: the text depends on the active language.
  { to: '/', key: 'nav.home', icon: 'M3 10.5 12 3l9 7.5V21H3z' },
  { to: '/movimientos', key: 'nav.transactions', icon: 'M4 7h16M4 12h16M4 17h10' },
  { to: '/calendario', key: 'nav.calendar', icon: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4' },
  { to: '/analisis', key: 'nav.analytics', icon: 'M5 20V10M12 20V4M19 20v-7' },
  { to: '/ajustes', key: 'nav.settings', icon: 'M4 7h16M4 17h16M9 7v0M15 17v0' },
] as const;

export function TabBar() {
  const navigate = useNavigate();
  const t = useT();
  const [longPressOpen, setLongPressOpen] = useState(false);
  const [hablarOpen, setHablarOpen] = useState(false);
  const [fabHidden, setFabHidden] = useState(false);

  // FAB hides when scrolling down, appears when scrolling back
  // up. Small threshold to avoid flicker from micro-scrolls.
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        // Only hide it when there is a real list to get out of the way
        // of. The FAB hides so it stops covering content you are reading;
        // on a page that barely scrolls there is nothing to uncover, and
        // hiding it there only takes away the main action.
        //
        // This is not hypothetical: adding the legal footer made short
        // screens scrollable by a couple of hundred pixels, and since a
        // hidden FAB also sets pointer-events: none, the + button became
        // unclickable after the smallest scroll.
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        if (Math.abs(delta) > 6) {
          if (delta > 0 && y > 40 && scrollable > 320) setFabHidden(true);
          else setFabHidden(false);
          lastY = y;
        }
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <nav
        aria-label={t('nav.mainNavigation')}
        style={{
          position: 'fixed',
          insetInline: 0,
          bottom: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          alignItems: 'center',
          // Opaque on purpose: with --material-thin (72% white) the
          // content showed through the bar and you couldn't tell where
          // it started. The blur is only noticeable when supported, but the
          // color underneath is already solid.
          background: 'var(--surface)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          boxShadow: '0 -1px 12px rgb(0 0 0 / 0.06)',
          borderTop: '1px solid var(--line)',
          paddingBottom: 'var(--safe-bottom)',
          zIndex: 40,
        }}
      >
        <AddButton
          hidden={fabHidden}
          onClick={() => {
            haptic('light');
            setLongPressOpen(true);
          }}
        />
        {TABS.map((tab) => (
          <div key={tab.to} style={{ display: 'contents' }}>
            <NavLink
              to={tab.to}
              end={tab.to === '/'}
              onClick={() => {
                if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              style={({ isActive }) => ({
                minHeight: 'var(--tap)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                padding: '8px 0 10px',
                textDecoration: 'none',
                color: isActive ? 'var(--q10)' : 'var(--text-faint)',
                fontSize: 10,
                fontWeight: isActive ? 600 : 500,
                transition: 'color var(--dur-fast) var(--ease-spring-out)',
              })}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d={tab.icon}
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {t(tab.key)}
            </NavLink>
          </div>
        ))}
      </nav>
      {longPressOpen && (
        <QuickActionSheet
          onClose={() => setLongPressOpen(false)}
          onSelect={(action) => {
            setLongPressOpen(false);
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
 * The "+" isn't a tab: it's an action. It floats ABOVE the tab bar, not
 * inside it — with a small bottom offset it ate into the middle tab (Calendar).
 * It sits on the RIGHT, not centered: centered it sat right on top of the
 * middle row of the list and covered the description and amount.
 * Tap opens a quick menu with Expense/Income/Recurring.
 */
function AddButton({ onClick, hidden }: { onClick: () => void; hidden?: boolean }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type="button"
      aria-label="Agregar movimiento"
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
        position: 'absolute',
        right: 16,
        bottom: 'calc(100% + 14px)',
        transform: `scale(${hidden ? 0 : pressed ? 0.94 : 1})`,
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? 'none' : 'auto',
        width: 56,
        height: 56,
        borderRadius: 28,
        border: 'none',
        background: 'var(--q10)',
        color: '#fff',
        fontSize: 28,
        fontWeight: 400,
        lineHeight: 1,
        cursor: 'pointer',
        boxShadow: 'var(--shadow-3)',
        transition: 'transform var(--dur-med) var(--ease-spring-out), opacity var(--dur-med) var(--ease-spring-out)',
        touchAction: 'none',
      }}
    >
      +
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
          Cancelar
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
