import { describe, expect, it } from 'vitest';
import { conciliarOcurrencias } from './ocurrenciasDuplicadas';
import type { Transaction } from '@/domain/types';

function tx(over: Partial<Transaction>): Transaction {
  return {
    id: 'x', type: 'expense', concept: 'Arriendo', amount: 1_500_000,
    date: '2026-09-01', categoryId: null, paymentMethodId: null, status: 'pending',
    quincenaKey: null, createdAt: '', updatedAt: '2026-09-01T00:00:00.000Z', ...over,
  };
}

/**
 * El fallo real reportado en produccion:
 *
 *   transactions.bulkPut(): 13 of 150 operations failed.
 *   ConstraintError: Unable to add key to index '[recurringRuleId+periodKey]'
 *
 * La misma ocurrencia recurrente existe con DOS ids: el UUID aleatorio de
 * antes del 2026-09-18 (que sigue en la nube) y el determinista que
 * materialize.ts crea ahora. El indice unico de Dexie las rechaza, bulkPut
 * lanza, y muere el ciclo de sync entero.
 */
describe('conciliarOcurrencias — dos ids para la misma ocurrencia', () => {
  const PAR = { recurringRuleId: 'regla-1', periodKey: '2026-09' };

  it('no deja pasar la fila remota que chocaria con una local del mismo par', () => {
    const local = [tx({ id: 'regla-1:2026-09', ...PAR })];
    const remoto = [tx({ id: 'uuid-viejo-aleatorio', ...PAR })];

    const plan = conciliarOcurrencias(remoto, local);
    expect(plan.aGuardar.map((t) => t.id)).not.toContain('uuid-viejo-aleatorio');
  });

  it('gana el id determinista, porque es el que materialize va a recrear', () => {
    const local = [tx({ id: 'regla-1:2026-09', ...PAR, amount: 100 })];
    const remoto = [tx({ id: 'uuid-viejo', ...PAR, amount: 999, updatedAt: '2026-09-20T00:00:00.000Z' })];

    const plan = conciliarOcurrencias(remoto, local);
    const ganador = plan.aGuardar.find((t) => t.recurringRuleId === 'regla-1');
    expect(ganador?.id).toBe('regla-1:2026-09');
    // ...pero con el contenido mas nuevo, que venia en la fila remota.
    expect(ganador?.amount).toBe(999);
  });

  it('el id perdedor se marca para borrar, o revive en el siguiente ciclo', () => {
    const local = [tx({ id: 'regla-1:2026-09', ...PAR })];
    const remoto = [tx({ id: 'uuid-viejo', ...PAR })];

    expect(conciliarOcurrencias(remoto, local).aBorrar).toEqual(['uuid-viejo']);
  });

  it('si lo local es mas nuevo, el contenido local se conserva', () => {
    const local = [tx({ id: 'regla-1:2026-09', ...PAR, amount: 777, updatedAt: '2026-09-25T00:00:00.000Z' })];
    const remoto = [tx({ id: 'uuid-viejo', ...PAR, amount: 111, updatedAt: '2026-09-01T00:00:00.000Z' })];

    const ganador = conciliarOcurrencias(remoto, local).aGuardar.find((t) => t.recurringRuleId === 'regla-1');
    expect(ganador?.amount).toBe(777);
  });

  it('dos filas remotas del mismo par tampoco pueden pasar juntas', () => {
    const plan = conciliarOcurrencias(
      [tx({ id: 'a', ...PAR }), tx({ id: 'b', ...PAR, updatedAt: '2026-09-30T00:00:00.000Z' })],
      [],
    );
    const delPar = plan.aGuardar.filter((t) => t.recurringRuleId === 'regla-1');
    expect(delPar).toHaveLength(1);
    // Se guarda bajo el id determinista, asi que MUEREN LAS DOS viejas: si
    // sobreviviera cualquiera de ellas, volveria a chocar en el proximo ciclo.
    expect(delPar[0]!.id).toBe('regla-1:2026-09');
    expect(plan.aBorrar.sort()).toEqual(['a', 'b']);
  });
});

describe('conciliarOcurrencias — lo que NO debe tocar', () => {
  it('los movimientos normales pasan intactos, aunque sean muchos', () => {
    const remoto = Array.from({ length: 50 }, (_, i) => tx({ id: `n-${i}` }));
    const plan = conciliarOcurrencias(remoto, []);
    expect(plan.aGuardar).toHaveLength(50);
    expect(plan.aBorrar).toEqual([]);
  });

  /* En Postgres NULL != NULL, asi que mil movimientos sin regla conviven
     bajo el unique. En IndexedDB una clave compuesta con undefined no se
     indexa. Ninguno de los dos choca — y esta funcion no debe inventar un
     choque donde no lo hay. */
  it('mil movimientos sin regla no se consideran duplicados entre si', () => {
    const remoto = Array.from({ length: 1000 }, (_, i) => tx({ id: `n-${i}` }));
    expect(conciliarOcurrencias(remoto, []).aBorrar).toEqual([]);
  });

  it('ocurrencias de reglas o periodos distintos no se pisan', () => {
    const remoto = [
      tx({ id: 'r1:2026-09', recurringRuleId: 'r1', periodKey: '2026-09' }),
      tx({ id: 'r1:2026-10', recurringRuleId: 'r1', periodKey: '2026-10' }),
      tx({ id: 'r2:2026-09', recurringRuleId: 'r2', periodKey: '2026-09' }),
    ];
    const plan = conciliarOcurrencias(remoto, []);
    expect(plan.aGuardar).toHaveLength(3);
    expect(plan.aBorrar).toEqual([]);
  });

  it('una fila a medias (regla sin periodo) no se trata como ocurrencia', () => {
    const remoto = [
      tx({ id: 'a', recurringRuleId: 'r1' }),
      tx({ id: 'b', recurringRuleId: 'r1' }),
    ];
    expect(conciliarOcurrencias(remoto, []).aBorrar).toEqual([]);
  });
});
