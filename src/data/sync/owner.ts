import { db } from '../db';

/**
 * De quién son los datos que están guardados en ESTE dispositivo.
 *
 * La app es offline-first: Dexie es la fuente de verdad y la nube es una
 * copia. Eso abre un hueco que no existe en una app normal — cerrar sesión
 * borra el token de Supabase, pero no borra IndexedDB. Si después entra
 * otra cuenta en el mismo navegador, el push toma TODAS las filas locales
 * y las sube estampadas con el user_id de quien esté logueado ahora. No es
 * solo que la segunda persona vea los movimientos de la primera: quedan
 * copiados dentro de su cuenta, en la nube, para siempre.
 *
 * La marca vive en IndexedDB y no en localStorage a propósito: tiene que
 * morir junto con los datos que describe. En localStorage se puede limpiar
 * por separado, y una marca ausente frente a datos presentes se leería como
 * "nadie es dueño de esto" — justo el caso que abre la fuga.
 *
 * Esta marca NO se sincroniza. Es una propiedad del dispositivo.
 */
const CLAVE_DUENO = 'dueno';

export interface MetaFila {
  id: string;
  valor: string;
}

/**
 * ¿Hay que borrar lo local antes de dejar entrar a `entrante`?
 *
 * - Sin marca previa: NO. Es alguien que usó la app sin cuenta y ahora se
 *   registra; sus propios datos tienen que sobrevivir al primer login.
 * - Misma persona: NO. Es el caso normal.
 * - Otra persona: SÍ. Lo de la cuenta anterior no puede entrar acá.
 */
export function debeLimpiar(previo: string | null, entrante: string): boolean {
  return previo !== null && previo !== entrante;
}

export async function duenoLocal(): Promise<string | null> {
  const fila = await db.meta.get(CLAVE_DUENO);
  return fila?.valor ?? null;
}

/** Vacía todo rastro de la cuenta anterior, incluidas las lápidas. */
export async function limpiarDatosLocales(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}

/**
 * Se llama en cada login, ANTES de sincronizar. Devuelve true si hubo que
 * limpiar, para que quien llama sepa que la pantalla cambió bajo sus pies.
 */
export async function asegurarDueno(entrante: string): Promise<boolean> {
  const previo = await duenoLocal();
  const limpiar = debeLimpiar(previo, entrante);
  if (limpiar) await limpiarDatosLocales();
  await db.meta.put({ id: CLAVE_DUENO, valor: entrante });
  return limpiar;
}
