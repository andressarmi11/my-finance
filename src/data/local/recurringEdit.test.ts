import { describe, expect, it } from 'vitest';
import src from './recurringEdit.ts?raw';

/**
 * No fake-indexeddb in this repo, so this guards the bug statically: a Dexie
 * transaction that reads a table missing from its list throws NotFoundError.
 */
describe('recurringEdit transaction tables', () => {
  it('the transaction body and the helpers it calls only touch listed tables', () => {
    const listed = /db\.transaction\('rw', \[([^\]]+)\]/.exec(src)![1]!.match(/db\.(\w+)/g)!.map((x) => x.slice(3));
    const body = src.slice(src.indexOf("db.transaction('rw'"));
    const helpers = src.slice(src.indexOf('async function occurrencesOf'), src.indexOf('export async function previewRuleSave'));
    const used = new Set([...(body + helpers).matchAll(/\bdb\.(\w+)/g)].map((m) => m[1]!));
    used.delete('transaction');
    for (const t of used) expect(listed, `db.${t} used inside the transaction`).toContain(t);
  });
});
