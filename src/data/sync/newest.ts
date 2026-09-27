/**
 * Cual de dos marcas de tiempo gana en un last-write-wins.
 *
 * Vive aparte para que syncService y las reglas de conciliacion de cada
 * entidad la compartan sin importarse entre si.
 */
export function masNuevo(a: string, b: string): boolean {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  // Una fecha vacia o invalida nunca gana: es lo que devuelve la nube
  // cuando todavia no hay fila, y lo que tiene una fila local que nunca
  // se guardo.
  if (Number.isNaN(ta)) return false;
  if (Number.isNaN(tb)) return true;
  return ta > tb;
}
