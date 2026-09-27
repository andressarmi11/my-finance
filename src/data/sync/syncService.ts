/**
 * Sincronizacion entre IndexedDB (fuente de verdad offline) y Supabase.
 *
 * Estrategia: last-write-wins por updatedAt, mas lapidas para los
 * borrados (sin ellas, el dispositivo que todavia tiene la fila la
 * resucita en el siguiente push — ver tombstones.ts).
 *
 * Orden de un ciclo completo:
 *   1. bajar lapidas remotas y aplicarlas aca
 *   2. bajar filas y quedarse con las mas nuevas que las locales
 *   3. subir las lapidas locales y borrar esas filas alla
 *   4. subir las filas locales mas nuevas que las remotas
 *
 * Las lapidas van ANTES que las filas en cada direccion: si no, se sube
 * una fila y acto seguido se borra, o peor, se baja una fila que ya
 * estaba borrada.
 */
import { db } from '../db';
import { supabaseRepository } from '../supabase/supabaseRepository';
import { applyRemoteDeletions, listRemoteTombstones, saveRemoteTombstones } from '../supabase/deletions';
import { listRemoteBudgets, saveRemoteBudgets } from '../supabase/budgets';
import { deletedIdsOf, makeTombstone, mergeTombstones, type Tombstone } from './tombstones';
import { conciliarPresupuestos } from './presupuestos';
import { recordatoriosASubir } from './recordatorios';
import { masNuevo as newer } from './masNuevo';
import { conciliarOcurrencias } from './ocurrenciasDuplicadas';
import type { Settings, Transaction } from '@/domain/types';

export interface SyncResult {
  pushed: number;
  pulled: number;
  deleted: number;
}

/**
 * Cual de las dos configuraciones se queda.
 *
 * Existe porque el bug mas molesto de la app salio justo de no tener esto:
 * bajar de la nube hacia `db.settings.put(remoto)` a ciegas. En el primer
 * login la nube todavia no tiene fila, el repositorio devolvia valores por
 * defecto (onboardedAt = null), eso pisaba lo local y despues se subia —
 * asi que en CADA login volvia a pedir nombre, moneda y categorias, aunque
 * ya se hubieran configurado.
 *
 * Las transacciones ya se resolvian por updatedAt; los Settings no tenian
 * con que compararse.
 */
/**
 * Cual de las dos copias de una fila se queda. Misma regla que
 * elegirSettings, separada para poder probarla sin base de datos.
 */
export function elegirFila<T extends { updatedAt: string }>(local: T | undefined, remota: T): T {
  if (!local) return remota;
  return newer(remota.updatedAt, local.updatedAt) ? remota : local;
}

/**
 * De cada fila remota, se queda la que gane contra su copia local. Las que
 * ganan localmente se devuelven tal cual estan aca, asi el bulkPut que
 * viene despues no las cambia.
 */
async function conservarMasNuevo<T extends { id: string; updatedAt: string }>(
  remotas: T[],
  buscarLocal: (id: string) => Promise<T | undefined>,
): Promise<T[]> {
  const resultado: T[] = [];
  for (const remota of remotas) {
    resultado.push(elegirFila(await buscarLocal(remota.id), remota));
  }
  return resultado;
}

export function elegirSettings(local: Settings | undefined, remoto: Settings): Settings {
  if (!local) return remoto;
  return newer(remoto.updatedAt, local.updatedAt) ? remoto : local;
}

/** Aplica localmente los borrados que vienen de otro dispositivo. */
async function applyTombstonesLocally(tombstones: Tombstone[]): Promise<number> {
  if (tombstones.length === 0) return 0;
  const tabla = {
    transactions: db.transactions,
    categories: db.categories,
    paymentMethods: db.paymentMethods,
    recurringRules: db.recurringRules,
  } as const;

  let borrados = 0;
  for (const t of tombstones) {
    const existe = await tabla[t.entity].get(t.entityId);
    if (existe) {
      await tabla[t.entity].delete(t.entityId);
      // Igual que localRepository.deleteTransaction: el recordatorio se va
      // con su movimiento, aunque el borrado venga de otro dispositivo.
      if (t.entity === 'transactions') {
        await db.reminders.where('transactionId').equals(t.entityId).delete();
      }
      borrados += 1;
    }
  }
  return borrados;
}

export async function pullCloudToLocal(): Promise<SyncResult> {
  const remoteTombstones = await listRemoteTombstones();
  const localTombstones = await db.deletions.toArray();
  const todas = mergeTombstones(localTombstones, remoteTombstones);
  await db.deletions.bulkPut(todas);
  const deleted = await applyTombstonesLocally(remoteTombstones);

  const [remoteTx, categories, methods, rules, settings, remoteBudgets, remoteReminders] = await Promise.all([
    supabaseRepository.listTransactions(),
    supabaseRepository.listCategories(),
    supabaseRepository.listPaymentMethods(),
    supabaseRepository.listRecurringRules(),
    supabaseRepository.getSettings(),
    listRemoteBudgets(),
    supabaseRepository.listReminders(),
  ]);

  // Nada que este borrado vuelve a entrar, venga de donde venga.
  const borradoTx = deletedIdsOf(todas, 'transactions');
  const borradoCat = deletedIdsOf(todas, 'categories');
  const borradoPm = deletedIdsOf(todas, 'paymentMethods');
  const borradoRr = deletedIdsOf(todas, 'recurringRules');

  // Se queda el mas nuevo de cada lado, igual que con las transacciones.
  //
  // Antes esto era un bulkPut ciego, y el efecto NO era solo perder un
  // cambio hecho sin conexion: como el ciclo siempre empieza bajando y
  // guardar no dispara una subida, renombrar una categoria, archivarla,
  // cambiar el dia de corte de una tarjeta o apagar una regla recurrente
  // se deshacia SOLO en el siguiente visibilitychange, con un unico
  // dispositivo y con internet. Una fila sin updatedAt da NaN y pierde,
  // que es el comportamiento viejo: la migracion sale gratis.
  await db.categories.bulkPut(
    await conservarMasNuevo(categories.filter((c) => !borradoCat.has(c.id)), (id) => db.categories.get(id)),
  );
  await db.paymentMethods.bulkPut(
    await conservarMasNuevo(methods.filter((m) => !borradoPm.has(m.id)), (id) => db.paymentMethods.get(id)),
  );
  await db.recurringRules.bulkPut(
    await conservarMasNuevo(rules.filter((r) => !borradoRr.has(r.id)), (id) => db.recurringRules.get(id)),
  );
  await db.settings.put(elegirSettings(await db.settings.get('singleton'), settings));

  // Presupuestos: se emparejan por categoria+mes, no por id — ver
  // presupuestos.ts. Van DESPUES de las categorias porque en Postgres
  // apuntan a ellas con una FK.
  const planPresupuestos = conciliarPresupuestos(await db.budgets.toArray(), remoteBudgets);
  if (planPresupuestos.borrarLocal.length > 0) await db.budgets.bulkDelete(planPresupuestos.borrarLocal);
  if (planPresupuestos.guardarLocal.length > 0) await db.budgets.bulkPut(planPresupuestos.guardarLocal);

  // Recordatorios: last-write-wins por id a secas, sin las vueltas de los
  // presupuestos, porque su id ES el del movimiento — dos dispositivos
  // generan el mismo. Bajarlos importa para que el 'sent' que pone el
  // servidor al enviar la notificacion no lo pise de vuelta esta copia.
  const recordatoriosVivos = remoteReminders.filter((r) => !borradoTx.has(r.transactionId));
  const recordatoriosAGuardar = await conservarMasNuevo(recordatoriosVivos, (id) => db.reminders.get(id));
  if (recordatoriosAGuardar.length > 0) await db.reminders.bulkPut(recordatoriosAGuardar);

  const localAll = await db.transactions.toArray();

  // Una ocurrencia recurrente con dos ids es la MISMA ocurrencia, y el par
  // (recurringRuleId, periodKey) es un indice unico en Dexie: dejar pasar
  // las dos hacia bulkPut lanzaba ConstraintError y, como esta llamada es
  // la ultima del pull, moria el ciclo entero. Ver ocurrenciasDuplicadas.ts.
  const plan = conciliarOcurrencias(
    remoteTx.filter((tx) => !borradoTx.has(tx.id)),
    localAll,
  );

  if (plan.aBorrar.length > 0) {
    const ahora = new Date().toISOString();
    await db.transactions.bulkDelete(plan.aBorrar);
    // Con lapida: sin ella el otro dispositivo, que todavia tiene la fila
    // con el id viejo, la vuelve a subir y el choque regresa.
    await db.deletions.bulkPut(plan.aBorrar.map((id) => makeTombstone('transactions', id, ahora)));
  }

  const localById = new Map(localAll.map((t) => [t.id, t]));
  const toPut: Transaction[] = [];
  for (const tx of plan.aGuardar) {
    const local = localById.get(tx.id);
    if (!local || newer(tx.updatedAt, local.updatedAt)) toPut.push(tx);
  }
  if (toPut.length > 0) await guardarTolerante(toPut);

  return {
    pushed: 0,
    pulled: toPut.length + planPresupuestos.guardarLocal.length + recordatoriosAGuardar.length,
    deleted,
  };
}

export async function pushLocalToCloud(): Promise<SyncResult> {
  // 1. Los borrados primero: subir la lápida y borrar allá.
  const tombstones = await db.deletions.toArray();
  await saveRemoteTombstones(tombstones);
  await applyRemoteDeletions(tombstones);

  const borradoTx = deletedIdsOf(tombstones, 'transactions');
  const borradoCat = deletedIdsOf(tombstones, 'categories');
  const borradoPm = deletedIdsOf(tombstones, 'paymentMethods');
  const borradoRr = deletedIdsOf(tombstones, 'recurringRules');

  const [localTx, remoteTx, categories, methods, rules, settings, localBudgets, remoteBudgets, localReminders, remoteReminders] = await Promise.all([
    db.transactions.toArray(),
    supabaseRepository.listTransactions(),
    db.categories.toArray(),
    db.paymentMethods.toArray(),
    db.recurringRules.toArray(),
    db.settings.get('singleton'),
    db.budgets.toArray(),
    listRemoteBudgets(),
    db.reminders.toArray(),
    supabaseRepository.listReminders(),
  ]);

  // Categorías y métodos antes que transacciones: las FK de Postgres
  // rechazan una transacción cuya categoría todavía no existe allá.
  for (const c of categories.filter((c) => !borradoCat.has(c.id))) await supabaseRepository.saveCategory(c);
  for (const m of methods.filter((m) => !borradoPm.has(m.id))) await supabaseRepository.savePaymentMethod(m);
  for (const r of rules.filter((r) => !borradoRr.has(r.id))) await supabaseRepository.saveRecurringRule(r);
  if (settings) await supabaseRepository.saveSettings(settings);

  // Presupuestos: despues de las categorias, que es a donde apunta su FK, y
  // solo los que ganan por fecha. Se salta el presupuesto cuya categoria fue
  // borrada: la FK lo rechazaria y tumbaria el push entero.
  const planPresupuestos = conciliarPresupuestos(localBudgets, remoteBudgets);
  await saveRemoteBudgets(planPresupuestos.subir.filter((b) => !borradoCat.has(b.categoryId)));

  const remoteById = new Map(remoteTx.map((t) => [t.id, t]));
  let pushed = 0;
  for (const tx of localTx) {
    if (borradoTx.has(tx.id)) continue;
    const remote = remoteById.get(tx.id);
    if (!remote || newer(tx.updatedAt, remote.updatedAt)) {
      await supabaseRepository.saveTransaction(tx);
      pushed += 1;
    }
  }

  // Recordatorios AL FINAL: su FK apunta a transactions, asi que el
  // movimiento tiene que existir ya alla. Ver recordatorios.ts para por que
  // se filtran los huerfanos.
  const vivos = new Set(localTx.filter((t) => !borradoTx.has(t.id)).map((t) => t.id));
  for (const r of recordatoriosASubir(localReminders, remoteReminders, vivos)) {
    await supabaseRepository.saveReminder(r);
    pushed += 1;
  }

  return { pushed: pushed + planPresupuestos.subir.length, pulled: 0, deleted: tombstones.length };
}

export async function syncBidirectional(): Promise<SyncResult> {
  const pull = await pullCloudToLocal();
  const push = await pushLocalToCloud();
  return { pushed: push.pushed, pulled: pull.pulled, deleted: pull.deleted };
}

/**
 * Una fila mala no puede matar el ciclo de sync.
 *
 * bulkPut lanza si CUALQUIER fila viola un indice, y como el pull termina
 * aca, un solo choque dejaba al usuario sin sincronizar nada —ni bajar ni
 * subir— y repitiendo el mismo error en cada intento.
 *
 * conciliarOcurrencias ya quita el caso conocido; esto es el cinturon por
 * si aparece otro. Mismo criterio que el bulkAdd de materialize.ts: se
 * reintenta fila por fila y se registra lo que no entro, en vez de perder
 * las 149 que si estaban bien.
 */
async function guardarTolerante(filas: Transaction[]): Promise<void> {
  try {
    await db.transactions.bulkPut(filas);
  } catch {
    let fallidas = 0;
    for (const fila of filas) {
      try {
        await db.transactions.put(fila);
      } catch {
        fallidas += 1;
      }
    }
    if (fallidas > 0) {
      console.warn(`Sync: ${fallidas} de ${filas.length} movimientos no se pudieron guardar localmente.`);
    }
  }
}
