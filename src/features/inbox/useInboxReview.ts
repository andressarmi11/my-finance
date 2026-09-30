import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { localRepository, DEFAULT_SETTINGS } from '@/data/local/localRepository';
import { closeEntry, reopenEntry } from '@/data/supabase/inbox';
import { interpretText } from '@/domain/nlp/interpret';
import { formatMoney } from '@/domain/money/format';
import { CURRENCIES } from '@/lib/currencies';
import { useFxRate } from '@/lib/fxRates';
import { haptic } from '@/lib/haptic';
import { EMPTY } from '@/lib/empty';
import { fill } from '@/lib/dateLabels';
import { nowISO, todayISO } from '@/lib/todayISO';
import { useT } from '@/i18n/language';
import { bulkable, buildDraft, moveIndex, toTransaction, type Draft, type Edits } from './review';
import { useInbox } from './useInbox';

export interface InboxToastState {
  message: string;
  undo?: () => Promise<void>;
}

const TOAST_MS = 5_000;
/** How long a just-recorded row stays tinted in the Movimientos table. */
const FRESH_MS = 6_000;

/**
 * Everything the review needs, whatever draws it (BANDEJA.md, BANDEJA-WEB.md):
 * the phone's InboxSheet and the desktop's InboxPanel share it.
 *
 *  - items: what's waiting, newest first, with the user's corrections.
 *  - idx / move / goTo: where you are; moving never decides anything.
 *  - edits: per entry id, so what you typed survives moving away and back.
 *  - accept / discard / acceptAll / undo: resolving, with a 5 s undo.
 *
 * Resolving closes the entry on the server right away and "Deshacer" puts
 * it back (reopenEntry) and deletes what was recorded: if the app closes
 * during the 5 s, nothing is left half done or recorded twice.
 */
export function useInboxReview() {
  const t = useT();
  const { enabled, loaded, pending, reload } = useInbox();

  const settings = useLiveQuery(() => localRepository.getSettings(), []) ?? DEFAULT_SETTINGS;
  const cats = useLiveQuery(() => localRepository.listCategories(), []) ?? EMPTY;
  const methods = useLiveQuery(() => localRepository.listPaymentMethods(), []) ?? EMPTY;
  const conceptIndex = useLiveQuery(() => db.conceptIndex.toArray(), []) ?? EMPTY;

  const [edits, setEdits] = useState<Record<string, Edits>>({});
  // Resolved here and not yet gone from the server's list: hidden meanwhile.
  const [resolved, setResolved] = useState<ReadonlySet<string>>(new Set());
  const [done, setDone] = useState<Array<{ id: string; outcome: 'done' | 'discarded' }>>([]);
  const [open, setOpen] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<InboxToastState | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const today = todayISO();
  const main = settings.currency;
  const items = useMemo(() => {
    if (!enabled) return [];
    const categoryIds = cats.map((c) => c.id);
    const known = CURRENCIES.map((c) => c.code);
    return [...pending]
      .filter((e) => !resolved.has(e.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((e) => buildDraft(e, interpretText(e.text, today, {
        conceptIndex, categoryIds, methodRows: methods, defaultMethodId: settings.defaultPaymentMethodId ?? null,
      }), edits[e.id] ?? {}, { today, mainCurrency: main, knownCurrencies: known }));
  }, [enabled, pending, resolved, edits, cats, methods, conceptIndex, settings.defaultPaymentMethodId, today, main]);

  const idx = Math.max(0, items.findIndex((d) => d.entry.id === currentId));
  const current = items[idx] ?? null;
  const fx = useFxRate(current?.currency ?? main, main);
  const fxRate = fx.status === 'same' ? 1 : fx.status === 'ready' ? fx.rate : null;

  const flash = useCallback((next: InboxToastState) => {
    clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const openAt = useCallback((id?: string) => {
    setCurrentId(id ?? null);
    setOpen(true);
  }, []);

  /** Jumps to the i-th waiting entry (queue click, progress segment). */
  const goTo = useCallback((i: number) => {
    const target = items[moveIndex(i, 0, items.length)];
    if (target) setCurrentId(target.entry.id);
  }, [items]);

  /** One back or ahead, without deciding anything. Stops at the ends. */
  const move = useCallback((delta: number) => {
    const target = items[moveIndex(idx, delta, items.length)];
    if (target) setCurrentId(target.entry.id);
  }, [items, idx]);

  function close() {
    setOpen(false);
    // A finished round starts over next time; an unfinished one keeps its count.
    if (items.length === 0) setDone([]);
  }

  function what(d: Draft): string {
    return d.amount != null ? `${d.concept} ${formatMoney(d.amount, d.currency)}` : d.concept;
  }

  /** Moves on to the one after `id` (or the one before, at the end). */
  function advanceFrom(id: string) {
    const at = items.findIndex((d) => d.entry.id === id);
    const next = items[at + 1] ?? items[at - 1] ?? null;
    setCurrentId(next?.entry.id ?? null);
  }

  function markResolved(ids: string[], outcome: 'done' | 'discarded') {
    setResolved((s) => new Set([...s, ...ids]));
    setDone((list) => [...list, ...ids.map((id) => ({ id, outcome }))]);
  }

  function markFresh(txIds: string[]) {
    setFresh((s) => new Set([...s, ...txIds]));
    setTimeout(() => setFresh((s) => new Set([...s].filter((id) => !txIds.includes(id)))), FRESH_MS);
  }

  /** Puts entries back as they were: pending, nothing recorded, on screen. */
  async function restore(ids: string[], txIds: string[]) {
    await Promise.all(ids.map((id) => reopenEntry(id)));
    for (const txId of txIds) await localRepository.deleteTransaction(txId);
    setResolved((s) => new Set([...s].filter((id) => !ids.includes(id))));
    setDone((list) => list.filter((d) => !ids.includes(d.id)));
    setCurrentId(ids[0] ?? null);
    setOpen(true);
    await reload();
  }

  async function record(d: Draft): Promise<string | null> {
    const tx = toTransaction(d, { id: crypto.randomUUID(), now: nowISO(), methods, mainCurrency: main, fxRate: d.currency === main ? 1 : fxRate });
    if (!tx) return null;
    await closeEntry(d.entry.id, 'done');
    await localRepository.saveTransaction(tx);
    return tx.id;
  }

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch {
      flash({ message: t('inbox.failed') });
    } finally {
      setBusy(false);
      void reload();
    }
  }

  const foreignReady = !current || current.currency === main || fx.status === 'ready';
  const canAccept = Boolean(current?.complete) && foreignReady && !busy;

  const accept = () => {
    const d = current;
    if (!d || !canAccept) return;
    void run(async () => {
      const txId = await record(d);
      if (!txId) return;
      haptic('medium');
      advanceFrom(d.entry.id);
      markResolved([d.entry.id], 'done');
      markFresh([txId]);
      flash({
        message: fill(t(d.status === 'pending' ? 'inbox.toastScheduled' : 'inbox.toastRecorded'), { what: what(d) }),
        undo: () => restore([d.entry.id], [txId]),
      });
    });
  };

  const discard = () => {
    const d = current;
    if (!d || busy) return;
    void run(async () => {
      await closeEntry(d.entry.id, 'discarded');
      haptic('light');
      advanceFrom(d.entry.id);
      markResolved([d.entry.id], 'discarded');
      flash({
        message: fill(t('inbox.toastDiscarded'), { what: what(d) }),
        undo: () => restore([d.entry.id], []),
      });
    });
  };

  const complete = bulkable(items, main);
  const acceptAll = () => {
    if (complete.length < 2 || busy) return;
    void run(async () => {
      const ids: string[] = [];
      const txIds: string[] = [];
      for (const d of complete) {
        const txId = await record(d);
        if (!txId) continue;
        ids.push(d.entry.id);
        txIds.push(txId);
      }
      haptic('medium');
      const rest = items.filter((d) => !ids.includes(d.entry.id));
      setCurrentId(rest[0]?.entry.id ?? null);
      markResolved(ids, 'done');
      markFresh(txIds);
      flash({
        message: fill(t('inbox.toastBulk'), { n: ids.length }),
        undo: () => restore(ids, txIds),
      });
    });
  };

  const patch = (change: Edits) => {
    if (!current) return;
    const id = current.entry.id;
    setEdits((all) => ({ ...all, [id]: { ...all[id], ...change } }));
  };

  async function undo() {
    const u = toast?.undo;
    clearTimeout(toastTimer.current);
    setToast(null);
    if (u) await run(u);
  }

  const recorded = done.filter((d) => d.outcome === 'done').length;

  return {
    enabled, loaded, open, items, idx, current,
    doneCount: done.length, recorded, discarded: done.length - recorded,
    bulkCount: complete.length, busy, canAccept, fx, toast, fresh,
    mainCurrency: main, quickCurrencies: settings.quickCurrencies, payDays: settings.payDays,
    categories: cats, methods, today,
    openAt, close, move, goTo, patch, accept, discard, acceptAll, undo,
  };
}

export type InboxReview = ReturnType<typeof useInboxReview>;
