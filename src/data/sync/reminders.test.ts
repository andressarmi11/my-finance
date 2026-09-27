import { describe, expect, it } from 'vitest';
import { remindersToUpload } from './reminders';
import type { Reminder } from '@/domain/types';

function r(over: Partial<Reminder> = {}): Reminder {
  return {
    id: 't1', transactionId: 't1', remindAt: '2026-09-16T09:00:00.000Z',
    status: 'scheduled', updatedAt: '2026-09-15T08:00:00.000Z',
    ...over,
  };
}

const ALIVE = new Set(['t1', 't2']);

describe('recordatoriosASubir — the orphan filter', () => {
  /**
   * The case that matters: in Postgres reminders.transaction_id has an FK
   * to transactions(id). Uploading the reminder of a deleted transaction
   * doesn't fail quietly on its own, it takes down the entire push and
   * with it everything else queued behind it.
   */
  it('does not upload the reminder of a transaction that no longer exists', () => {
    const orphan = r({ id: 'borrado', transactionId: 'borrado' });
    expect(remindersToUpload([orphan], [], ALIVE)).toEqual([]);
  });

  it('an orphan does not drag down the healthy ones alongside it', () => {
    const healthy = r({ id: 't1', transactionId: 't1' });
    const orphan = r({ id: 'x', transactionId: 'x' });
    expect(remindersToUpload([orphan, healthy], [], ALIVE)).toEqual([healthy]);
  });

  it('with no live transactions, uploads nothing', () => {
    expect(remindersToUpload([r()], [], new Set())).toEqual([]);
  });
});

describe('recordatoriosASubir — who wins', () => {
  it('uploads the one that is not in the cloud yet', () => {
    const nuevo = r({ id: 't2', transactionId: 't2' });
    expect(remindersToUpload([nuevo], [], ALIVE)).toEqual([nuevo]);
  });

  it('uploads the local one if it is newer', () => {
    const local = r({ updatedAt: '2026-09-20T00:00:00.000Z' });
    const remoteRow = r({ updatedAt: '2026-09-01T00:00:00.000Z' });
    expect(remindersToUpload([local], [remoteRow], ALIVE)).toEqual([local]);
  });

  /**
   * Important for notifications: the server marks it 'sent' when it sends
   * it. If the local one uploaded its 'scheduled' status again, the
   * notification would go out a second time.
   */
  it('does NOT overwrite the newer status the server set', () => {
    const local = r({ status: 'scheduled', updatedAt: '2026-09-01T00:00:00.000Z' });
    const remoteRow = r({ status: 'sent', updatedAt: '2026-09-20T00:00:00.000Z' });
    expect(remindersToUpload([local], [remoteRow], ALIVE)).toEqual([]);
  });

  it('a local one with no date never beats a real one', () => {
    const local = r({ updatedAt: '' });
    const remoteRow = r({ status: 'sent' });
    expect(remindersToUpload([local], [remoteRow], ALIVE)).toEqual([]);
  });

  it('but a local one with no date does upload if there is nothing on the other side', () => {
    const local = r({ updatedAt: '' });
    expect(remindersToUpload([local], [], ALIVE)).toEqual([local]);
  });
});
