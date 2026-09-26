import { useId } from 'react';

/**
 * La marca: tres escalones que suben. Es literal ("Step up") y al mismo
 * tiempo el gráfico de barras de cualquier app de plata — el mismo dibujo
 * dice "escalera" y dice "esto crece", que es justo lo que la app promete.
 *
 * Los dos primeros escalones van en el azul de quincena y el último en el
 * naranja: son los DOS colores con los que la app ya separa la quincena del
 * 10 de la del 25 (ver tokens.css), así que la marca no estrena paleta, usa
 * la que el usuario ya aprendió.
 *
 * Es SVG inline y no un .png: escala a cualquier tamaño sin verse borroso,
 * sigue el modo oscuro solo (lee los tokens) y no agrega un archivo más que
 * pedir por red. Los .png de public/icons — que sí hacen falta, porque el
 * manifest y iOS no aceptan SVG — se generan de acá con
 * `node scripts/generar-iconos.mjs`.
 */
export function Logo({ size = 24, tile = false, title }: {
  size?: number;
  /** Versión "ícono de app": los escalones calados sobre un cuadro azul. */
  tile?: boolean;
  /** Si va acompañado del texto "Step up", dejalo vacío: es decorativo. */
  title?: string;
}) {
  const gid = useId();
  const a11y = title
    ? ({ role: 'img' as const, 'aria-label': title })
    : ({ 'aria-hidden': true as const, focusable: 'false' as const });

  // Tres barras de ancho igual y altura creciente (+5 cada una), apoyadas en
  // la misma línea de piso. El salto constante es lo que se lee como escalón;
  // si las alturas fueran arbitrarias sería un gráfico cualquiera.
  const escalones = (colores: [string, string, string]) => (
    <>
      <rect x="2"  y="13" width="6" height="8"  rx="2" fill={colores[0]} />
      <rect x="9"  y="8"  width="6" height="13" rx="2" fill={colores[1]} />
      <rect x="16" y="3"  width="6" height="18" rx="2" fill={colores[2]} />
    </>
  );

  if (!tile) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...a11y}>
        {escalones(['var(--q10)', 'var(--q10)', 'var(--q25)'])}
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" {...a11y}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0A84FF" />
          <stop offset="1" stopColor="#0051D5" />
        </linearGradient>
      </defs>
      {/* rx 14 de 64 ≈ el redondeo de un ícono de iOS */}
      <rect width="64" height="64" rx="14" fill={`url(#${gid})`} />
      {/* El glifo de 24 centrado y a escala 1.6 deja el aire que pide Apple. */}
      <g transform="translate(12.8 12.8) scale(1.6)">
        {escalones(['#FFFFFF', '#FFFFFF', '#FFB340'])}
      </g>
    </svg>
  );
}
