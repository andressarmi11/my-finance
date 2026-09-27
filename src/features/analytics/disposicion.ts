/**
 * Que graficos se ven en Analisis, y en que orden.
 *
 * Vive en localStorage y no en Settings —que si se sincroniza— por lo
 * mismo que el idioma: es una preferencia de como MIRAS la app en este
 * dispositivo, no un dato de tu plata. En una tablet puedes querer otro
 * orden que en el telefono.
 *
 * Las claves se guardan por id y no por indice: agregar un grafico nuevo
 * en el futuro no desordena lo que el usuario ya acomodo, y un id que ya
 * no exista simplemente se ignora al leer.
 */
export type GraficoId =
  | 'balance-categoria'
  | 'presupuestos'
  | 'distribucion'
  | 'ingresos-gastos'
  | 'fijos-variables'
  | 'debito-credito';

export interface Grafico {
  id: GraficoId;
  titulo: string;
}

/** El orden de fabrica. Presupuestos va justo despues del balance. */
export const ORDEN_POR_DEFECTO: GraficoId[] = [
  'balance-categoria',
  'presupuestos',
  'distribucion',
  'ingresos-gastos',
  'fijos-variables',
  'debito-credito',
];

const CLAVE = 'step-up:analisis-disposicion';

export interface Disposicion {
  orden: GraficoId[];
  ocultos: GraficoId[];
}

const VACIA: Disposicion = { orden: ORDEN_POR_DEFECTO, ocultos: [] };

/**
 * Lee lo guardado y lo RECONCILIA con los graficos que existen hoy:
 * descarta ids desconocidos y agrega al final los que aparecieron despues
 * de que el usuario guardo. Sin esto, agregar un grafico nuevo lo dejaria
 * invisible para quien ya hubiera tocado el orden alguna vez.
 */
export function leerDisposicion(): Disposicion {
  let guardada: Partial<Disposicion> | null = null;
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (crudo) guardada = JSON.parse(crudo) as Partial<Disposicion>;
  } catch { /* storage bloqueado o JSON corrupto: se usa el de fabrica */ }
  if (!guardada) return VACIA;

  const conocidos = new Set<string>(ORDEN_POR_DEFECTO);
  const orden = (guardada.orden ?? []).filter((id): id is GraficoId => conocidos.has(id));
  for (const id of ORDEN_POR_DEFECTO) {
    if (!orden.includes(id)) orden.push(id);
  }
  const ocultos = (guardada.ocultos ?? []).filter((id): id is GraficoId => conocidos.has(id));
  return { orden, ocultos };
}

export function guardarDisposicion(d: Disposicion): void {
  try { localStorage.setItem(CLAVE, JSON.stringify(d)); } catch { /* no-op */ }
}

/** Mueve un grafico una posicion arriba o abajo. Los bordes no se mueven. */
export function mover(orden: GraficoId[], id: GraficoId, delta: -1 | 1): GraficoId[] {
  const i = orden.indexOf(id);
  const destino = i + delta;
  if (i === -1 || destino < 0 || destino >= orden.length) return orden;
  const copia = [...orden];
  [copia[i], copia[destino]] = [copia[destino]!, copia[i]!];
  return copia;
}

export function alternarOculto(ocultos: GraficoId[], id: GraficoId): GraficoId[] {
  return ocultos.includes(id) ? ocultos.filter((o) => o !== id) : [...ocultos, id];
}
