import { describe, expect, it } from 'vitest';
import { clavePresupuesto, conciliarPresupuestos } from './presupuestos';
import type { Budget } from '@/domain/types';

function p(over: Partial<Budget> = {}): Budget {
  return {
    id: 'b1', categoryId: 'cat-hogar', year: 2026, month: 9, amount: 500_000,
    updatedAt: '2026-09-18T10:00:00.000Z',
    ...over,
  };
}

describe('clavePresupuesto', () => {
  it('es categoría + año + mes, que es lo que Postgres declara único', () => {
    expect(clavePresupuesto(p())).toBe('cat-hogar|2026|9');
  });

  it('distingue meses y categorías', () => {
    expect(clavePresupuesto(p({ month: 10 }))).not.toBe(clavePresupuesto(p()));
    expect(clavePresupuesto(p({ categoryId: 'cat-salud' }))).not.toBe(clavePresupuesto(p()));
  });
});

describe('conciliarPresupuestos — lo básico', () => {
  it('sin nada en ningún lado no hace nada', () => {
    expect(conciliarPresupuestos([], [])).toEqual({ guardarLocal: [], subir: [], borrarLocal: [] });
  });

  it('lo que solo está en la nube se baja', () => {
    const remoto = p({ id: 'r1' });
    const plan = conciliarPresupuestos([], [remoto]);
    expect(plan.guardarLocal).toEqual([remoto]);
    expect(plan.subir).toEqual([]);
  });

  it('lo que solo está acá se sube', () => {
    const local = p({ id: 'l1' });
    const plan = conciliarPresupuestos([local], []);
    expect(plan.subir).toEqual([local]);
    expect(plan.guardarLocal).toEqual([]);
  });
});

describe('conciliarPresupuestos — quién gana', () => {
  it('gana el más nuevo aunque esté en la nube', () => {
    const local = p({ id: 'x', amount: 100, updatedAt: '2026-09-01T00:00:00.000Z' });
    const remoto = p({ id: 'x', amount: 900, updatedAt: '2026-09-20T00:00:00.000Z' });
    const plan = conciliarPresupuestos([local], [remoto]);
    expect(plan.guardarLocal).toEqual([remoto]);
    expect(plan.subir).toEqual([]);
  });

  it('gana el más nuevo aunque sea el de acá', () => {
    const local = p({ id: 'x', amount: 900, updatedAt: '2026-09-20T00:00:00.000Z' });
    const remoto = p({ id: 'x', amount: 100, updatedAt: '2026-09-01T00:00:00.000Z' });
    const plan = conciliarPresupuestos([local], [remoto]);
    expect(plan.subir).toEqual([local]);
    expect(plan.guardarLocal).toEqual([]);
  });

  it('una fila local sin fecha no le gana a una real', () => {
    const local = p({ id: 'x', amount: 1, updatedAt: '' });
    const remoto = p({ id: 'x', amount: 900 });
    expect(conciliarPresupuestos([local], [remoto]).guardarLocal).toEqual([remoto]);
  });
});

/**
 * El caso que obliga a emparejar por categoría+mes y no por id: dos
 * teléfonos que ponen presupuesto al mismo mes sin haber sincronizado
 * generan ids distintos para la MISMA fila. Subir el segundo por su id no
 * crearía otra fila, chocaría contra unique(user_id, category_id, year,
 * month) y tumbaría el sync entero.
 */
describe('conciliarPresupuestos — dos dispositivos, ids distintos', () => {
  const local = p({ id: 'id-del-telefono', amount: 900, updatedAt: '2026-09-20T00:00:00.000Z' });
  const remoto = p({ id: 'id-del-portatil', amount: 100, updatedAt: '2026-09-01T00:00:00.000Z' });

  it('se reconocen como la misma fila pese al id distinto', () => {
    const plan = conciliarPresupuestos([local], [remoto]);
    // Una sola fila, no dos.
    expect(plan.subir).toHaveLength(1);
    expect(plan.guardarLocal).toHaveLength(1);
  });

  it('gana el monto más nuevo, pero viaja con el id de la nube', () => {
    const plan = conciliarPresupuestos([local], [remoto]);
    expect(plan.subir[0]).toMatchObject({ id: 'id-del-portatil', amount: 900 });
  });

  it('el id local huérfano se borra, para no dejar la fila duplicada acá', () => {
    const plan = conciliarPresupuestos([local], [remoto]);
    expect(plan.borrarLocal).toEqual(['id-del-telefono']);
    expect(plan.guardarLocal[0]).toMatchObject({ id: 'id-del-portatil', amount: 900 });
  });

  it('si gana la nube, también se limpia el id local que sobra', () => {
    const plan = conciliarPresupuestos(
      [p({ id: 'id-del-telefono', amount: 900, updatedAt: '2026-09-01T00:00:00.000Z' })],
      [p({ id: 'id-del-portatil', amount: 100, updatedAt: '2026-09-20T00:00:00.000Z' })],
    );
    expect(plan.guardarLocal).toEqual([p({ id: 'id-del-portatil', amount: 100, updatedAt: '2026-09-20T00:00:00.000Z' })]);
    expect(plan.borrarLocal).toEqual(['id-del-telefono']);
  });

  it('con el mismo id no se borra nada', () => {
    const plan = conciliarPresupuestos(
      [p({ id: 'x', amount: 900, updatedAt: '2026-09-20T00:00:00.000Z' })],
      [p({ id: 'x', amount: 100 })],
    );
    expect(plan.borrarLocal).toEqual([]);
  });
});

describe('conciliarPresupuestos — varios meses y categorías a la vez', () => {
  it('cada mes y cada categoría se resuelve por separado', () => {
    const locales = [
      p({ id: 'l1', categoryId: 'cat-hogar', month: 9, amount: 100, updatedAt: '2026-09-20T00:00:00.000Z' }),
      p({ id: 'l2', categoryId: 'cat-hogar', month: 10, amount: 200 }),
      p({ id: 'l3', categoryId: 'cat-salud', month: 9, amount: 300 }),
    ];
    const remotos = [
      p({ id: 'r1', categoryId: 'cat-hogar', month: 9, amount: 999, updatedAt: '2026-09-01T00:00:00.000Z' }),
    ];
    const plan = conciliarPresupuestos(locales, remotos);

    // Septiembre de Hogar: gana el local (más nuevo), con el id remoto.
    expect(plan.subir).toContainEqual(expect.objectContaining({ id: 'r1', amount: 100 }));
    // Los otros dos nunca viajaron: se suben tal cual.
    expect(plan.subir).toContainEqual(locales[1]);
    expect(plan.subir).toContainEqual(locales[2]);
    expect(plan.subir).toHaveLength(3);
  });
});
