import { IconCurrencyDollar, IconMicrophone, IconRepeat, IconTrendingDown, type IconProps } from '@tabler/icons-react';
import { useEffect, useState, type ComponentType } from 'react';
import { useDialogo } from '@/components/ui/useDialogo';
import { NavLink, useNavigate } from 'react-router-dom';
import { QuickEntrySheet } from '@/features/quick/QuickEntrySheet';
import { haptic } from '@/lib/haptic';

const TABS = [
  { to: '/', label: 'Inicio', icon: 'M3 10.5 12 3l9 7.5V21H3z' },
  { to: '/movimientos', label: 'Movimientos', icon: 'M4 7h16M4 12h16M4 17h10' },
  { to: '/calendario', label: 'Calendario', icon: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4' },
  { to: '/analisis', label: 'Análisis', icon: 'M5 20V10M12 20V4M19 20v-7' },
  { to: '/ajustes', label: 'Ajustes', icon: 'M4 7h16M4 17h16M9 7v0M15 17v0' },
] as const;

export function TabBar() {
  const navigate = useNavigate();
  const [longPressOpen, setLongPressOpen] = useState(false);
  const [hablarOpen, setHablarOpen] = useState(false);
  const [fabHidden, setFabHidden] = useState(false);

  // FAB se esconde al scrollear hacia abajo, aparece al scrollear hacia
  // arriba. Umbral pequeño para evitar flicker con micro-scrolls.
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        if (Math.abs(delta) > 6) {
          if (delta > 0 && y > 40) setFabHidden(true);
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
        aria-label="Navegación principal"
        style={{
          position: 'fixed',
          insetInline: 0,
          bottom: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          alignItems: 'center',
          // Opaca a proposito: con --material-thin (blanco 72%) el
          // contenido se leia a traves de la barra y no se sabia donde
          // empezaba. El blur solo se nota si hay soporte, pero el color
          // de abajo ya es solido.
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
              {tab.label}
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
          onAjustar={(texto) => {
            setHablarOpen(false);
            // El formulario completo lo vuelve a interpretar: una sola
            // definición de qué significa la frase, no dos.
            navigate(`/movimientos?texto=${encodeURIComponent(texto)}`);
          }}
        />
      )}
    </>
  );
}

/**
 * El "+" no es una pestaña: es una acción. Flota SOBRE el tab bar, no
 * dentro — con bottom pequeño se comía la pestaña central (Calendario).
 * Va a la DERECHA, no centrado: centrado se le sentaba encima de la fila
 * del medio de la lista y tapaba concepto y monto.
 * Tap abre menú rápido con Gasto/Ingreso/Recurrente.
 */
function AddButton({ onClick, hidden }: { onClick: () => void; hidden?: boolean }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type="button"
      aria-label="Agregar movimiento"
      // La acción va en onClick, no en onPointerUp. Los eventos de puntero
      // solo llegan con dedo o ratón: con el teclado (Enter/Espacio) y con
      // VoiceOver —que activa mandando un click— este botón no hacía
      // absolutamente nada, y es el botón principal de la app. Los pointer
      // se quedan solo con el efecto visual de hundido.
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

  const refDialogo = useDialogo(onClose);
  return (
    <div
      ref={refDialogo}
      role="dialog"
      aria-label="Acción rápida"
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
          label="Contarle a la app"
          sub="Habla o escribe: “gasté 45 mil en el almuerzo”"
          onClick={() => onSelect('hablar')}
        />
        <ActionRow
          icono={IconTrendingDown}
          label="Nuevo gasto"
          sub="Rápido, con el método por defecto"
          onClick={() => onSelect('gasto')}
        />
        <ActionRow
          icono={IconCurrencyDollar}
          label="Nuevo ingreso"
          sub="Sueldo, freelance, ventas…"
          onClick={() => onSelect('ingreso')}
        />
        <ActionRow
          icono={IconRepeat}
          label="Nuevo recurrente"
          sub="Renta, servicios, suscripciones…"
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
