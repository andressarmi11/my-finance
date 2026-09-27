/**
 * Autonomous inference of category + payment method from a
 * transaction's concept. Learns from history: every `saveTransaction`
 * updates the index, and every time the form opens it queries it.
 *
 * Normalised exact match (case + accent + punctuation insensitive) →
 *   confidence 'exact'. Prefix match with a minimum of 3 chars →
 *   'prefix'. No match → 'fallback' (uses the provided default).
 */

export interface ConceptIndexEntry {
  id: string;            // conceptKey (normalised)
  displayName: string;   // last casing used by the user
  categoryId: string | null;
  paymentMethodId: string | null;
  count: number;
  lastUsedAt: string;    // ISO
}

export interface InferenceResult {
  categoryId: string | null;
  paymentMethodId: string | null;
  confidence: 'exact' | 'prefix' | 'fallback';
  source: ConceptIndexEntry | null;
}

/** Normalises a concept for matching: lowercase, no accents, no
 *  punctuation, collapsed whitespace. "Café Con Leche!" → "cafe con leche". */
export function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ');
}

export function inferFromConcept(
  text: string,
  index: ConceptIndexEntry[],
  fallback: { categoryId: string | null; paymentMethodId: string | null },
): InferenceResult {
  const key = normalize(text);
  if (!key) return { ...fallback, confidence: 'fallback', source: null };

  const exact = index.find((e) => e.id === key);
  if (exact) {
    return {
      categoryId: exact.categoryId,
      paymentMethodId: exact.paymentMethodId,
      confidence: 'exact',
      source: exact,
    };
  }

  if (key.length >= 3) {
    const prefix = index
      .filter((e) => e.id.startsWith(key))
      .sort((a, b) => b.count - a.count || b.lastUsedAt.localeCompare(a.lastUsedAt))[0];
    if (prefix) {
      return {
        categoryId: prefix.categoryId,
        paymentMethodId: prefix.paymentMethodId,
        confidence: 'prefix',
        source: prefix,
      };
    }
  }

  return { ...fallback, confidence: 'fallback', source: null };
}

/** Top-N most recent concepts (for "suggestion" chips). */
export function topRecents(index: ConceptIndexEntry[], n = 5): ConceptIndexEntry[] {
  return [...index]
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
    .slice(0, n);
}
