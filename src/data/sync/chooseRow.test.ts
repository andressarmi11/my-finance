import { describe, expect, it } from 'vitest';
import { chooseRow, newerThanLocal } from './syncService';

const cat = (name: string, updatedAt: string) => ({ id: 'cat-hogar', name, updatedAt });

describe('elegirFila', () => {
  it('THE BUG: renaming a category no longer undoes itself', () => {
    // Real sequence, with a single device and with internet:
    //   the user renames "Hogar" -> "Casa" (saved only locally)
    //   the sync cycle starts by PULLING, and the cloud still says "Hogar"
    // Before, the pull did a blind bulkPut and "Casa" died right there.
    const local = cat('Casa', '2026-09-18T20:00:00Z');
    const remoteRow = cat('Hogar', '2026-09-18T19:00:00Z');
    expect(chooseRow(local, remoteRow).name).toBe('Casa');
  });

  it('a change made on another device does come in', () => {
    const local = cat('Hogar', '2026-09-18T19:00:00Z');
    const remoteRow = cat('Casa', '2026-09-18T20:00:00Z');
    expect(chooseRow(local, remoteRow).name).toBe('Casa');
  });

  it('a row that does not exist locally comes in as-is', () => {
    expect(chooseRow(undefined, cat('Hogar', 'T')).name).toBe('Hogar');
  });

  it('old rows with no date lose: the migration is free', () => {
    // Anyone who already had the app has rows with no updatedAt. The
    // remote row wins, which is exactly the behavior before the fix.
    const local = cat('vieja', '');
    const remoteRow = cat('nube', '2026-09-18T19:00:00Z');
    expect(chooseRow(local, remoteRow).name).toBe('nube');
  });

  it('tie: the local one stays, since that is what the user is looking at', () => {
    const t = '2026-09-18T20:00:00Z';
    expect(chooseRow(cat('local', t), cat('nube', t)).name).toBe('local');
  });
});

describe('newerThanLocal', () => {
  const row = (id: string, updatedAt: string) => ({ id, updatedAt });
  it('brings only the rows the cloud has newer, or that are missing here', async () => {
    const local = new Map([
      ['same', row('same', '2026-09-30T10:00:00.000Z')],
      ['old', row('old', '2026-09-01T00:00:00.000Z')],
    ]);
    const remote = [
      row('same', '2026-09-30T10:00:00+00:00'),
      row('old', '2026-09-20T00:00:00.000Z'),
      row('new', '2026-09-20T00:00:00.000Z'),
    ];
    const got = await newerThanLocal(remote, async (id) => local.get(id));
    expect(got.map((r) => r.id)).toEqual(['old', 'new']);
  });
});
