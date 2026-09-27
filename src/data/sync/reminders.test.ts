import { describe, expect, it } from 'vitest';
import { recordatoriosASubir } from './recordatorios';
import type { Reminder } from '@/domain/types';

function r(over: Partial<Reminder> = {}): Reminder {
  return {
    id: 't1', transactionId: 't1', remindAt: '2026-09-16T09:00:00.000Z',
    status: 'scheduled', updatedAt: '2026-09-15T08:00:00.000Z',
    ...over,
  };
}

const VIVOS = new Set(['t1', 't2']);

describe('recordatoriosASubir — el filtro de huérfanos', () => {
  /**
   * El caso importante: en Postgres reminders.transaction_id tiene FK a
   * transactions(id). Subir el recordatorio de un movimiento borrado no
   * falla solo, tumba el push entero y con él todo lo que venía detrás.
   */
  it('no sube el recordatorio de un movimiento que ya no existe', () => {
    const huerfano = r({ id: 'borrado', transactionId: 'borrado' });
    expect(recordatoriosASubir([huerfano], [], VIVOS)).toEqual([]);
  });

  it('un huérfano no arrastra a los sanos que van con él', () => {
    const sano = r({ id: 't1', transactionId: 't1' });
    const huerfano = r({ id: 'x', transactionId: 'x' });
    expect(recordatoriosASubir([huerfano, sano], [], VIVOS)).toEqual([sano]);
  });

  it('sin movimientos vivos no sube nada', () => {
    expect(recordatoriosASubir([r()], [], new Set())).toEqual([]);
  });
});

describe('recordatoriosASubir — quién gana', () => {
  it('sube el que todavía no está en la nube', () => {
    const nuevo = r({ id: 't2', transactionId: 't2' });
    expect(recordatoriosASubir([nuevo], [], VIVOS)).toEqual([nuevo]);
  });

  it('sube el local si es más nuevo', () => {
    const local = r({ updatedAt: '2026-09-20T00:00:00.000Z' });
    const remoto = r({ updatedAt: '2026-09-01T00:00:00.000Z' });
    expect(recordatoriosASubir([local], [remoto], VIVOS)).toEqual([local]);
  });

  /**
   * Importante para las notificaciones: el servidor marca 'sent' cuando la
   * manda. Si el local volviera a subir su 'scheduled', la notificación se
   * enviaría otra vez.
   */
  it('NO pisa el estado más nuevo que puso el servidor', () => {
    const local = r({ status: 'scheduled', updatedAt: '2026-09-01T00:00:00.000Z' });
    const remoto = r({ status: 'sent', updatedAt: '2026-09-20T00:00:00.000Z' });
    expect(recordatoriosASubir([local], [remoto], VIVOS)).toEqual([]);
  });

  it('un local sin fecha nunca le gana a uno real', () => {
    const local = r({ updatedAt: '' });
    const remoto = r({ status: 'sent' });
    expect(recordatoriosASubir([local], [remoto], VIVOS)).toEqual([]);
  });

  it('pero un local sin fecha sí se sube si allá no hay nada', () => {
    const local = r({ updatedAt: '' });
    expect(recordatoriosASubir([local], [], VIVOS)).toEqual([local]);
  });
});
