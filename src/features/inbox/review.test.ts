import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { interpretText } from '@/domain/nlp/interpret';
import type { InboxEntry } from '@/data/supabase/inbox';
import { LanguageProvider } from '@/i18n/language';
import { InboxSheet } from './InboxSheet';
import { ago, bankFromText, bulkable, buildDraft, sourceOf, toTransaction, type Edits } from './review';

const TODAY = '2026-09-30';
const ctx = { today: TODAY, mainCurrency: 'COP', knownCurrencies: ['COP', 'USD'] };
const entry = (id: string, text: string, origen = 'sms'): InboxEntry => ({ id, text, origen, createdAt: '2026-09-30T12:00:00Z' });
const draft = (e: InboxEntry, edits: Edits = {}) => buildDraft(e, interpretText(e.text, TODAY, {
  conceptIndex: [], categoryIds: ['cat-alimentacion', 'cat-transporte'], methodRows: [], defaultMethodId: null,
}), edits, ctx);

const LUNCH = entry('a', 'Bancolombia: Compraste $500.000,00 en RESTAURANTE EL CIELO con tu T.Deb *4521');
const NO_AMOUNT = entry('d', 'Bancolombia: Compra aprobada en UBER.');
const FUTURE = entry('c', 'Bancolombia: Se programó un débito automático de $44.900 a NETFLIX.COM para el 05/10/2026.');
const INCOME = entry('b', 'Nequi: Recibiste $120.000 de JUAN PEREZ.', 'atajo');

describe('buildDraft', () => {
  it('a whole message is complete, paid today, and green', () => {
    const d = draft(LUNCH);
    expect(d).toMatchObject({ amount: 500_000, complete: true, status: 'paid', hint: 'ok', source: 'sms', bank: 'Bancolombia' });
  });

  it('without an amount it is red and incomplete', () => {
    const d = draft(NO_AMOUNT);
    expect(d).toMatchObject({ amount: null, missing: 'amount', complete: false, hint: 'missing' });
  });

  it('typing the missing amount completes it, and the hint says the user wrote it', () => {
    const d = draft(NO_AMOUNT, { amount: 18_000 });
    expect(d).toMatchObject({ amount: 18_000, missing: null, complete: true, hint: 'typed', originallyMissing: 'amount' });
  });

  it('dated ahead: scheduled (pending) and blue', () => {
    expect(draft(FUTURE)).toMatchObject({ date: '2026-10-05', status: 'pending', hint: 'future' });
  });

  it('the user can move it to today: then it happened', () => {
    expect(draft(FUTURE, { date: TODAY })).toMatchObject({ status: 'paid', hint: 'ok' });
  });

  it('an emptied concept turns it red', () => {
    expect(draft(LUNCH, { concept: '  ' })).toMatchObject({ missing: 'concept', complete: false });
  });
});

describe('bulkable — "Anotar los N completos"', () => {
  it('never takes one that came in incomplete, even after it was typed', () => {
    const drafts = [draft(LUNCH), draft(INCOME), draft(NO_AMOUNT, { amount: 18_000 }), draft(NO_AMOUNT)];
    expect(bulkable(drafts, 'COP').map((d) => d.entry.id)).toEqual(['a', 'b']);
  });

  it('leaves foreign-currency ones for one-by-one review', () => {
    expect(bulkable([draft(LUNCH, { currency: 'USD' }), draft(INCOME)], 'COP').map((d) => d.entry.id)).toEqual(['b']);
  });
});

describe('toTransaction', () => {
  const base = { id: 't1', now: '2026-09-30T12:00:00Z', methods: [], mainCurrency: 'COP', fxRate: 1 };

  it('uses the edited values and keeps the trace', () => {
    const tx = toTransaction(draft(NO_AMOUNT, { amount: 18_000, categoryId: 'cat-transporte' }), base)!;
    expect(tx).toMatchObject({ amount: 18_000, categoryId: 'cat-transporte', status: 'paid', source: 'sms', sourceLabel: 'Bancolombia' });
  });

  it('refuses an incomplete one', () => {
    expect(toTransaction(draft(NO_AMOUNT), base)).toBeNull();
  });

  it('converts a foreign amount and keeps the original', () => {
    const tx = toTransaction(draft(LUNCH, { currency: 'USD', amount: 20 }), { ...base, fxRate: 4000 })!;
    expect(tx).toMatchObject({ amount: 80_000, currency: 'USD', originalAmount: 20, fxRate: 4000 });
  });
});

describe('small helpers', () => {
  it('reads the source and the bank', () => {
    expect(sourceOf('dictado')).toBe('dictation');
    expect(sourceOf('lo-que-sea')).toBe('atajo');
    expect(bankFromText('Nequi: Recibiste')).toBe('Nequi');
    expect(bankFromText('gasté 20 mil')).toBeNull();
  });

  it('says how long ago', () => {
    const now = Date.parse('2026-09-30T13:00:00Z');
    expect(ago('2026-09-30T12:59:40Z', now)).toEqual({ n: 0, unit: 'now' });
    expect(ago('2026-09-30T12:54:00Z', now)).toEqual({ n: 6, unit: 'min' });
    expect(ago('2026-09-30T11:00:00Z', now)).toEqual({ n: 2, unit: 'h' });
  });
});

describe('InboxSheet', () => {
  beforeAll(() => { vi.stubGlobal('navigator', { language: 'es-CO' }); });

  function render(edits: Edits = {}, e = NO_AMOUNT, bulkCount = 0): string {
    return renderToStaticMarkup(createElement(LanguageProvider, null, createElement(InboxSheet, {
      current: draft(e, edits), position: 1, total: 4, doneCount: 0, recorded: 0, discarded: 0, bulkCount,
      busy: false, fx: { status: 'same' }, mainCurrency: 'COP', quickCurrencies: undefined, payDays: [10, 25],
      categories: [], methods: [], today: TODAY,
      onPatch: () => {}, onAccept: () => {}, onDiscard: () => {}, onAcceptAll: () => {}, onClose: () => {},
    })));
  }
  const acceptButton = (html: string) => html.match(/<button[^>]*>Anotar<\/button>/)?.[0] ?? '';

  it('a missing amount turns "Anotar" off, and typing it turns it on', () => {
    expect(acceptButton(render())).toContain('disabled');
    expect(render()).toContain('No pude leer el monto');
    expect(acceptButton(render({ amount: 18_000 }))).not.toContain('disabled');
    expect(render({ amount: 18_000 })).toContain('Monto escrito por ti');
  });

  it('a future one says "Programar" and why it does not count today', () => {
    const html = render({}, FUTURE);
    expect(html).toContain('Programar');
    expect(html).toContain('Se agenda como pendiente y no cuenta hoy');
  });

  it('offers "Anotar los N" only with two or more complete', () => {
    expect(render({}, LUNCH, 1)).not.toContain('que están completos');
    expect(render({}, LUNCH, 3)).toContain('Anotar los 3 que están completos');
  });

  it('shows the position and the source line', () => {
    const html = render({}, LUNCH);
    expect(html).toContain('1 de 4');
    expect(html).toMatch(/SMS · Bancolombia · /);
  });
});
