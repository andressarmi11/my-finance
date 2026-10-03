import { useNavBarStyle } from '@/lib/navBar';
import { useT } from '@/i18n/language';
import { useEffect, useState } from 'react';
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
  // The prototype's own icon paths (a house, three bars, two sliders).
  { to: '/', key: 'nav.home', icon: 'M5 12l-2 0l9 -9l9 9l-2 0 M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7' },
  { to: '/analisis', key: 'nav.analytics', icon: 'M5 20V11M12 20V4M19 20v-7' },
  { to: '/ajustes', key: 'nav.settings', icon: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4' },
] as const;

/**
 * iOS sometimes leaves fixed elements where they were when the page gets
 * shorter under the thumb (marking the last "Falta este mes" while scrolled
 * down): the pill floats well above the bottom until the next scroll.
 * Re-setting the scroll once the page shrinks makes Safari place them again.
 */
function useFixedBarResync(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    let last = root.scrollHeight;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      const height = root.scrollHeight;
      if (height < last) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const max = Math.max(0, root.scrollHeight - window.innerHeight);
          window.scrollTo(window.scrollX, Math.min(window.scrollY, max));
        });
      }
      last = height;
    });
    observer.observe(document.body);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [enabled]);
}

export function TabBar() {
  const t = useT();
  const [quickOpen, setQuickOpen] = useState(false);
  // 760–1099px: the same tabs as a 72px rail on the left, the + on top.
  const rail = useBreakpoint() === 'tablet';
  // Keeps --nav-* / --fab-* in step with Ajustes → Tema y barra.
  useNavBarStyle();
  useFixedBarResync(!rail);

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
          background: active ? (rail ? 'var(--line-strong)' : 'var(--nav-active)') : 'transparent',
          color: active ? 'var(--text)' : rail ? 'var(--text-faint)' : 'var(--nav-ink)',
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
            // Sólida / Translúcida / Cristal (BARRA.md): src/lib/navBar.ts.
            background: 'var(--nav-bg)',
            backdropFilter: 'var(--nav-filter)',
            WebkitBackdropFilter: 'var(--nav-filter)',
            border: '1px solid var(--nav-border)',
            boxShadow: 'var(--nav-shadow)',
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
        // Solid --q10, or the bar's glass when "Botón + también transparente".
        border: '1px solid var(--fab-border)',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--fab-bg)',
        color: 'var(--fab-color)',
        backdropFilter: 'var(--fab-filter)',
        WebkitBackdropFilter: 'var(--fab-filter)',
        cursor: 'pointer',
        boxShadow: 'var(--fab-shadow)',
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
          borderRadius: '28px 28px 0 0',
          padding: '10px 16px calc(var(--safe-bottom) + 20px)',
          animation: 'slideUp var(--dur-med) var(--ease-spring-out)',
        }}
      >
        <div style={{ width: 36, height: 5, borderRadius: 3, background: 'var(--handle)', margin: '0 auto 12px' }} />
        {/* Prototype 1a: each action in its own colour, the same paths. */}
        <ActionRow
          icon="M9 5a3 3 0 0 1 3 -3a3 3 0 0 1 3 3v5a3 3 0 0 1 -3 3a3 3 0 0 1 -3 -3z M5 10a7 7 0 0 0 14 0 M8 21l8 0 M12 17l0 4"
          tone="var(--q10)"
          first
          label={t('action.tellIt')}
          sub={t('action.tellItSub')}
          onClick={() => onSelect('hablar')}
        />
        <ActionRow
          icon="M3 7l6 6l4 -4l8 8 M21 10l0 7l-7 0"
          tone="var(--danger)"
          label={t('action.newExpense')}
          sub={t('action.newExpenseSub')}
          onClick={() => onSelect('gasto')}
        />
        <ActionRow
          icon="M3 17l6 -6l4 4l8 -8 M14 7l7 0l0 7"
          tone="var(--positive)"
          label={t('action.newIncome')}
          sub={t('action.newIncomeSub')}
          onClick={() => onSelect('ingreso')}
        />
        <ActionRow
          icon="M4 12v-3a3 3 0 0 1 3 -3h13m-3 -3l3 3l-3 3 M20 12v3a3 3 0 0 1 -3 3h-13m3 3l-3 -3l3 -3"
          tone="var(--q25)"
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
            minHeight: 50,
            borderRadius: 16,
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

function ActionRow({ icon, tone, label, sub, onClick, first = false }: {
  icon: string; tone: string; label: string; sub: string; onClick: () => void; first?: boolean;
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
        gap: 14,
        padding: '12px 6px',
        background: 'none',
        border: 'none',
        borderTop: first ? 'none' : '1px solid var(--line)',
        cursor: 'pointer',
        textAlign: 'left',
        color: 'var(--text)',
      }}
    >
      <span
        aria-hidden
        style={{
          flex: 'none', width: 42, height: 42, borderRadius: 13, display: 'grid', placeItems: 'center',
          background: `color-mix(in srgb, ${tone} 13%, transparent)`, color: tone,
        }}
      >
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d={icon} />
        </svg>
      </span>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontSize: 16, fontWeight: 600 }}>{label}</span>
        <span style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)' }}>{sub}</span>
      </span>
      <span aria-hidden style={{ color: 'var(--text-dim)', fontSize: 18 }}>›</span>
    </button>
  );
}
