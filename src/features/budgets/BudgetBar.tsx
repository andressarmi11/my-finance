import { formatMoney } from '@/domain/money/format';

/**
 * La barra de presupuesto: la pista gris ES lo presupuestado y el relleno
 * ES lo gastado. Se lee sin leyenda, porque el vacio significa "lo que te
 * queda" — la misma metafora de un tanque.
 *
 * Tres decisiones que no son cosmeticas:
 *
 * 1. Al superar el presupuesto la barra NO se queda clavada en 100%. Se
 *    parte: el tramo hasta el tope queda en el color de estado y el exceso
 *    se dibuja aparte, rayado. Una barra llena al 100% se ve igual con un
 *    1% de exceso que con un 80%, y esa es justo la diferencia que
 *    importa.
 * 2. Hay una marca de "hoy" en la barra: donde deberias ir si gastaras
 *    parejo en el mes. Sin ella, un 60% gastado no dice nada — depende de
 *    si es dia 5 o dia 25.
 * 3. El texto dice cuanto QUEDA, no cuanto se gasto. Es la pregunta que
 *    la persona vino a hacerse.
 */
export function BudgetBar({ gastado, presupuestado, estado, progresoDelMes }: {
  gastado: number;
  presupuestado: number;
  estado: 'ok' | 'warning' | 'exceeded';
  /** 0..1 — que tan avanzado va el mes. Dibuja la marca de ritmo. */
  progresoDelMes?: number;
}) {
  const color = COLOR_ESTADO[estado];
  const proporcion = presupuestado > 0 ? gastado / presupuestado : 0;
  const dentro = Math.min(1, proporcion);
  const excedido = Math.max(0, proporcion - 1);
  // El exceso se muestra hasta un tope: pasado el doble, la barra ya dijo
  // todo lo que tenia que decir y estirarla solo encoge el resto.
  const anchoExceso = Math.min(excedido, 1);
  const queda = presupuestado - gastado;

  return (
    <>
      <div
        role="progressbar"
        aria-valuenow={Math.round(proporcion * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${Math.round(proporcion * 100)}% del presupuesto`}
        style={{
          position: 'relative',
          display: 'flex',
          height: 10,
          borderRadius: 5,
          background: 'var(--surface-sunken)',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            width: `${dentro * 100}%`,
            background: color,
            transition: 'width var(--dur-med, 240ms) var(--ease-spring-out, ease-out)',
          }}
        />
        {anchoExceso > 0 && (
          <span
            style={{
              width: `${anchoExceso * 100}%`,
              // Rayado: el exceso no es "mas presupuesto", es otra cosa.
              backgroundImage: `repeating-linear-gradient(135deg, ${color} 0 4px, color-mix(in srgb, ${color} 45%, transparent) 4px 8px)`,
            }}
          />
        )}

        {/* Sin marca de ritmo si ya te pasaste: ahi la pregunta ya no es
            "voy a buen ritmo" sino "cuanto me pase", y la marca cae dentro
            del tramo rayado donde solo agrega ruido. */}
        {estado !== 'exceeded' && progresoDelMes !== undefined && progresoDelMes > 0 && progresoDelMes < 1 && (
          <span
            aria-hidden
            title="Dónde deberías ir hoy"
            style={{
              position: 'absolute',
              left: `${progresoDelMes * 100}%`,
              top: -2,
              bottom: -2,
              width: 2,
              borderRadius: 1,
              background: 'var(--surface)',
              boxShadow: '0 0 0 1px color-mix(in srgb, var(--text) 35%, transparent)',
            }}
          />
        )}
      </div>

      <p style={{ margin: '7px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
        {queda >= 0 ? (
          <>Te quedan <strong style={{ color: 'var(--text)' }}>{formatMoney(queda)}</strong></>
        ) : (
          <span style={{ color: 'var(--danger-text)' }}>
            Te pasaste por <strong>{formatMoney(Math.abs(queda))}</strong>
          </span>
        )}
      </p>
    </>
  );
}

const COLOR_ESTADO: Record<'ok' | 'warning' | 'exceeded', string> = {
  ok: 'var(--positive)',
  warning: 'var(--q25)',
  exceeded: 'var(--danger)',
};
