/**
 * Una ocurrencia recurrente con DOS ids es la misma ocurrencia.
 *
 * El bug que arregla, visto en produccion:
 *
 *   transactions.bulkPut(): 13 of 150 operations failed.
 *   ConstraintError: Unable to add key to index '[recurringRuleId+periodKey]'
 *
 * Hasta el 2026-09-18 (commit 7c68272) las instancias recurrentes nacian
 * con crypto.randomUUID(). Desde entonces su id ES su identidad:
 * `${ruleId}:${periodKey}` (ver occurrenceId en data/local/materialize.ts).
 * Las filas viejas siguen en Postgres con el id aleatorio, y localmente
 * materialize ya creo la misma ocurrencia con el id determinista.
 *
 * Al bajar, las dos quieren el mismo par (recurringRuleId, periodKey), que
 * en Dexie es un indice UNICO. La fila remota lo viola, bulkPut lanza, y
 * como esa llamada esta al final del pull, MUERE EL CICLO DE SYNC ENTERO:
 * no se sube nada y el error vuelve en cada intento.
 *
 * Postgres nunca tuvo las dos: su unique es
 * (user_id, recurring_rule_id, period_key) y habria rechazado la segunda.
 * Alla quedo SOLO la vieja, y aca quedo SOLO la nueva. El choque aparece
 * al juntarlas en el pull — y como el push va despues, la version con id
 * determinista nunca llegaba a subir para resolverlo sola.
 *
 * Por eso el plan no alcanza con elegir una: hay que BORRAR la otra con
 * lapida, para que el borrado viaje y los dos lados converjan al mismo id.
 *
 * Esta funcion es pura para poder probarla sin IndexedDB ni red.
 */
import { masNuevo } from './masNuevo';
import type { Transaction } from '@/domain/types';

export interface PlanOcurrencias {
  /** Las filas que si pueden entrar, ya sin pares repetidos. */
  aGuardar: Transaction[];
  /** Ids que hay que borrar (con lapida): son la otra cara de un duplicado. */
  aBorrar: string[];
}

/** El par identifica la ocurrencia. Sin par, no es una ocurrencia. */
function par(tx: Transaction): string | null {
  if (!tx.recurringRuleId || !tx.periodKey) return null;
  return `${tx.recurringRuleId}|${tx.periodKey}`;
}

/**
 * El id que materialize.ts va a seguir recreando. Gana siempre, aunque el
 * contenido mas nuevo venga de la otra fila: si conservaramos el aleatorio,
 * el siguiente arranque volveria a crear el determinista y a chocar.
 */
function idDeterminista(tx: Transaction): string {
  return `${tx.recurringRuleId}:${tx.periodKey}`;
}

export function conciliarOcurrencias(
  remotas: Transaction[],
  locales: Transaction[],
): PlanOcurrencias {
  // Las que no son ocurrencias pasan derecho: son la enorme mayoria y no
  // tienen forma de chocar (su par tiene undefined y no se indexa).
  const aGuardar: Transaction[] = [];
  const porPar = new Map<string, Transaction>();
  const idsVistos = new Map<string, Set<string>>();

  const registrar = (tx: Transaction) => {
    const clave = par(tx);
    if (clave === null) return false;
    const ids = idsVistos.get(clave) ?? new Set<string>();
    ids.add(tx.id);
    idsVistos.set(clave, ids);
    const previa = porPar.get(clave);
    if (!previa || masNuevo(tx.updatedAt, previa.updatedAt)) porPar.set(clave, tx);
    return true;
  };

  for (const tx of remotas) {
    if (!registrar(tx)) aGuardar.push(tx);
  }
  // Las locales solo aportan su id al conteo de duplicados y su contenido a
  // la pelea por el mas nuevo. No se re-guardan si ganan: ya estan.
  const paresRemotos = new Set([...porPar.keys()]);
  for (const tx of locales) {
    const clave = par(tx);
    if (clave !== null && paresRemotos.has(clave)) registrar(tx);
  }

  const aBorrar: string[] = [];
  for (const [clave, ganadora] of porPar) {
    const canonico = idDeterminista(ganadora);
    // El contenido mas nuevo, pero siempre bajo el id determinista.
    aGuardar.push(ganadora.id === canonico ? ganadora : { ...ganadora, id: canonico });
    for (const id of idsVistos.get(clave) ?? []) {
      if (id !== canonico) aBorrar.push(id);
    }
  }

  return { aGuardar, aBorrar };
}
