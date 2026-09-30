import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBreakpoint } from '@/app/useBreakpoint';
import type { Draft } from './review';
import { InboxPanel } from './InboxPanel';
import { InboxSheet } from './InboxSheet';
import { InboxToast } from './InboxToast';
import { useInboxReview } from './useInboxReview';

interface InboxContextValue {
  /** Signed in with the cloud: the inbox exists. */
  enabled: boolean;
  /** What's waiting, newest first, with the user's corrections applied. */
  items: Draft[];
  /** The review is open (the sidebar item lights up). */
  open: boolean;
  /** Opens the review, on `id` or on the first one. */
  openAt: (id?: string) => void;
  /** Transactions just recorded from the inbox: the table tints them for a few seconds. */
  fresh: ReadonlySet<string>;
}

const InboxContext = createContext<InboxContextValue>({
  enabled: false, items: [], open: false, openAt: () => {}, fresh: new Set(),
});

export function useInboxContext(): InboxContextValue {
  return useContext(InboxContext);
}

/**
 * The inbox (BANDEJA.md, BANDEJA-WEB.md). Lives above the routes so the
 * header button, the sidebar item, the "Por revisar" card and a
 * notification's ?revisar=<id> all open the same review, and its undo toast
 * outlives it. A phone or tablet gets the bottom sheet, a desktop the side
 * panel; both draw useInboxReview.
 */
export function InboxProvider({ children }: { children: ReactNode }) {
  const review = useInboxReview();
  const desktop = useBreakpoint() === 'desktop';
  const [params, setParams] = useSearchParams();
  const { enabled, loaded, items, open, openAt, fresh } = review;

  // A notification's deep link: /?revisar=<id>. Waits for the first load;
  // an entry already reviewed elsewhere just opens the list.
  const wanted = params.get('revisar');
  useEffect(() => {
    if (!wanted || !loaded) return;
    if (enabled && items.length > 0) openAt(items.some((d) => d.entry.id === wanted) ? wanted : undefined);
    const next = new URLSearchParams(params);
    next.delete('revisar');
    setParams(next, { replace: true });
  }, [wanted, loaded, enabled, items, openAt, params, setParams]);

  const value = useMemo(() => ({ enabled, items, open, openAt, fresh }), [enabled, items, open, openAt, fresh]);

  return (
    <InboxContext.Provider value={value}>
      {children}
      {open && enabled && (desktop ? <InboxPanel review={review} /> : <InboxSheet review={review} />)}
      {enabled && <InboxToast toast={review.toast} sheetOpen={open} onUndo={() => void review.undo()} />}
    </InboxContext.Provider>
  );
}
