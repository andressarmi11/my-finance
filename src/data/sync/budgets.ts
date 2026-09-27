/**
 * Conciliar los presupuestos de los dos lados.
 *
 * Tiene reglas propias, distintas del resto de las entidades, por algo que
 * dice el propio esquema: la tabla de Postgres declara
 * `unique (user_id, category_id, year, month)`. O sea que la identidad de
 * un presupuesto NO es su id, sino de qué categoría y de qué mes es.
 *
 * Eso importa porque los ids se generan en el dispositivo. Dos teléfonos
 * que pongan presupuesto a "Hogar" en septiembre sin haber sincronizado
 * antes generan dos ids distintos para la MISMA fila; subir el segundo por
 * id no crearía otra fila, chocaría contra ese unique y el sync entero
 * fallaría con un error de Postgres.
 *
 * Por eso se empareja por clave natural y gana el más nuevo, pero el id
 * que sobrevive es siempre el de la nube: es el único con el que los dos
 * dispositivos pueden coincidir.
 *
 * No hay lápidas porque no hay forma de borrar un presupuesto en la app —
 * se edita el monto y ya. Si algún día se puede borrar, hará falta una.
 */
import type { Budget } from '@/domain/types';
import { masNuevo } from './masNuevo';

/** La identidad real de un presupuesto, según el unique de Postgres. */
export function clavePresupuesto(b: Pick<Budget, 'categoryId' | 'year' | 'month'>): string {
  return `${b.categoryId}|${b.year}|${b.month}`;
}

export interface PlanPresupuestos {
  /** Filas a escribir en Dexie. */
  guardarLocal: Budget[];
  /** Filas a subir a Supabase. */
  subir: Budget[];
  /** Ids locales que quedaron huérfanos al adoptar el id de la nube. */
  borrarLocal: string[];
}

export function conciliarPresupuestos(locales: Budget[], remotos: Budget[]): PlanPresupuestos {
  const porClaveRemota = new Map(remotos.map((b) => [clavePresupuesto(b), b]));
  const porClaveLocal = new Map(locales.map((b) => [clavePresupuesto(b), b]));

  const plan: PlanPresupuestos = { guardarLocal: [], subir: [], borrarLocal: [] };

  for (const [clave, remoto] of porClaveRemota) {
    const local = porClaveLocal.get(clave);

    if (!local) {
      plan.guardarLocal.push(remoto);
      continue;
    }

    if (masNuevo(remoto.updatedAt, local.updatedAt)) {
      plan.guardarLocal.push(remoto);
      // El local pierde; si además tenía otro id, su fila sobra.
      if (local.id !== remoto.id) plan.borrarLocal.push(local.id);
      continue;
    }

    // Gana el local, pero viaja con el id de la nube: subirlo con el suyo
    // reventaría contra unique(user_id, category_id, year, month).
    const ganador: Budget = { ...local, id: remoto.id };
    plan.subir.push(ganador);
    if (local.id !== remoto.id) {
      plan.guardarLocal.push(ganador);
      plan.borrarLocal.push(local.id);
    }
  }

  // Lo que solo existe acá todavía no ha viajado nunca.
  for (const [clave, local] of porClaveLocal) {
    if (!porClaveRemota.has(clave)) plan.subir.push(local);
  }

  return plan;
}
