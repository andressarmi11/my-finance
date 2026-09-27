import { IconArrowBackUp } from '@tabler/icons-react';
import { haptic } from '@/lib/haptic';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Nombre del mes 1-12. Devuelve '' fuera de rango en vez de undefined. */
export function monthName(m: number): string {
  return MONTH_NAMES[m - 1] ?? '';
}

/**
 * Navegador de mes: ‹ Septiembre 2026 › y, si te alejaste, un boton Hoy.
 * Lo usan Inicio, Movimientos y Calendario.
 *
 * Existe porque materialize.ts crea recurrentes hasta 95 dias adelante:
 * sin una ventana de mes, las listas mezclaban diciembre con hoy y
 * ordenadas descendente mostraban el futuro primero. Acotar al mes
 * arregla el orden y de paso deja mirar meses pasados.
 *
 * El boton Hoy es EXPLICITO y no el label. Antes volver al mes actual se
 * hacia tocando la etiqueta, que solo cambiaba de color al alejarte: la
 * funcion existia pero nadie podia adivinarla, y despues de avanzar un
 * año a punta de flechas volver era un castigo. Un affordance invisible
 * es lo mismo que no tenerlo.
 */
export function MonthNav({ label, onPrev, onNext, onToday }: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  /** undefined = ya estás en el mes actual; el botón "Hoy" se oculta. */
  onToday?: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Arrow dir="prev" onClick={onPrev} />
      <span
        style={{
          minHeight: 'var(--tap)', display: 'grid', placeItems: 'center', padding: '0 4px',
          color: 'var(--text-muted)', fontSize: 'var(--text-sm)', fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <Arrow dir="next" onClick={onNext} />
      {onToday && (
        <button
          type="button"
          onClick={() => { haptic('light'); onToday(); }}
          aria-label="Volver al mes actual"
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            minHeight: 32, marginLeft: 2, padding: '0 9px 0 7px',
            borderRadius: 999, border: '1px solid var(--q10)',
            background: 'var(--q10-soft)', color: 'var(--q10-text)',
            fontSize: 'var(--text-sm)', fontWeight: 700, cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <IconArrowBackUp size={15} stroke={2.2} aria-hidden />
          Hoy
        </button>
      )}
    </div>
  );
}

function Arrow({ dir, onClick }: { dir: 'prev' | 'next'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={() => { haptic('light'); onClick(); }}
      aria-label={dir === 'prev' ? 'Mes anterior' : 'Mes siguiente'}
      style={{
        width: 'var(--tap)', height: 'var(--tap)', display: 'grid', placeItems: 'center',
        border: 'none', background: 'none', color: 'var(--q10-text)', fontSize: 20,
        cursor: 'pointer', borderRadius: 'var(--radius-s)',
      }}
    >
      {dir === 'prev' ? '‹' : '›'}
    </button>
  );
}
