import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { TEXTS, type TextKey } from './texts';
import { setShortMonthNames } from '@/lib/formatShortDate';
import { setMonthNames } from '@/components/ui/MonthNav';
import { setPeriodLabelLanguage } from './periodLabels';

export type Language = 'es' | 'en';

const STORAGE_KEY = 'step-up:language';
/** What the key used to be called. Read as a fallback so nobody's choice is
 *  forgotten by a rename; the next change writes the current key. */
const LEGACY_STORAGE_KEY = 'step-up:idioma';

/**
 * Interface language.
 *
 * It lives in localStorage and NOT in Settings —which does get synced— on
 * purpose: language is a device preference, not an account one. Someone
 * might want the app in English at work and in Spanish on their phone,
 * and forcing a single language everywhere would be deciding for them.
 *
 * What does NOT change with the language: the currency and the amount
 * format. Those come from Settings.currency because they're a property of
 * your money, not of the language you read it in — a Colombian who
 * switches the app to English still has pesos.
 */
function initialLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (stored === 'es' || stored === 'en') return stored;
  } catch { /* private mode or storage blocked */ }
  // From the browser, if it's understood. When in doubt, Spanish: it's the
  // language the app is designed around (pay periods, pesos, dictation in Spanish).
  return typeof navigator !== 'undefined' && navigator.language?.startsWith('en') ? 'en' : 'es';
}

interface LanguageContextValue {
  language: Language;
  setLanguage: (i: Language) => void;
  /** Translates a key. If it's missing in the active language, it falls back to Spanish. */
  t: (key: TextKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Module-level mirror of the active language, and a translate function that
 * doesn't need a hook.
 *
 * ErrorBoundary is a class component — it cannot call useT() — and it still
 * has to say something the reader understands. Same approach as
 * setMonthNames and setMoneyLocale: the provider keeps this in step, and
 * anything outside the React tree reads it.
 */
let currentLanguage: Language = 'es';

export function translate(key: TextKey): string {
  return TEXTS[currentLanguage][key] ?? TEXTS.es[key] ?? key;
}

/** Every module-level language table, switched together. */
function syncModuleLanguage(language: Language): void {
  currentLanguage = language;
  setShortMonthNames(language);
  setMonthNames(language);
  setPeriodLabelLanguage(language);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  // The module-level tables (month names, period labels, translate()) switch
  // DURING this render, before the children render — not in an effect, which
  // runs after them. From an effect, a screen already on show (Analytics'
  // period label) rendered once with the new t() and the old month names,
  // and nothing re-rendered it afterwards. Idempotent: it only does
  // anything when the language actually changed.
  if (currentLanguage !== language) syncModuleLanguage(language);

  useEffect(() => {
    // lang on the <html>: screen readers use it to pick a voice
    // and the browser to hyphenate. Without this, a screen reader would read
    // English with Spanish phonetics.
    document.documentElement.lang = language === 'en' ? 'en' : 'es-CO';
  }, [language]);

  const setLanguage = useCallback((i: Language) => {
    setLanguageState(i);
    try { localStorage.setItem(STORAGE_KEY, i); } catch { /* no-op */ }
  }, []);

  const t = useCallback(
    (key: TextKey) => TEXTS[language][key] ?? TEXTS.es[key] ?? key,
    [language],
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage used outside LanguageProvider');
  return ctx;
}

/** Shortcut for when only translating is needed. */
export function useT(): (key: TextKey) => string {
  return useLanguage().t;
}
