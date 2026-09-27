/**
 * A SHARED empty array, for useLiveQuery's `?? []`.
 *
 * `useLiveQuery(...) ?? EMPTY` looks harmless, but it creates a new array on
 * every render while Dexie hasn't resolved. That array goes in as a
 * dependency of the useMemos below, so its identity changes on its own and
 * the memos recompute without anything having changed. With a shared
 * constant the identity is stable and the memo does what it promises.
 */
export const EMPTY: never[] = [];
