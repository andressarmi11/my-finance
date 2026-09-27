import { useLiveQuery } from 'dexie-react-hooks';
import { localRepository } from '@/data/local/localRepository';
import { setMoneyLocale } from '@/domain/money/format';

/**
 * Connects the currency chosen in settings with formatMoney().
 *
 * It's applied DURING render, not in a useEffect: children format
 * money in their own render and an effect would arrive a frame late — you'd
 * see a flicker from "$" to "€" when switching currency. It's idempotent, so
 * repeating it on every render costs nothing.
 */
export function useMoneyFormat() {
  const settings = useLiveQuery(() => localRepository.getSettings(), []);
  if (settings) setMoneyLocale(settings.locale, settings.currency);
  return settings;
}
