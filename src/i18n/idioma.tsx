import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { TEXTOS, type ClaveTexto } from './textos';
import { setMesesLocales } from '@/lib/formatShortDate';

export type Idioma = 'es' | 'en';

const CLAVE_GUARDADA = 'step-up:idioma';

/**
 * Idioma de la interfaz.
 *
 * Vive en localStorage y NO en Settings —que si se sincroniza— a proposito:
 * el idioma es una preferencia del dispositivo, no de la cuenta. Alguien
 * puede querer la app en ingles en el trabajo y en español en su telefono,
 * y forzar un solo idioma en todos lados seria decidir por el.
 *
 * Lo que NO cambia con el idioma: la moneda y el formato de los montos.
 * Esos salen de Settings.currency porque son una propiedad de tu plata, no
 * del idioma en que la lees — un colombiano que pone la app en ingles
 * sigue teniendo pesos.
 */
function idiomaInicial(): Idioma {
  try {
    const guardado = localStorage.getItem(CLAVE_GUARDADA);
    if (guardado === 'es' || guardado === 'en') return guardado;
  } catch { /* modo privado o storage bloqueado */ }
  // Del navegador, si se entiende. Ante la duda, español: es el idioma en
  // que esta pensada la app (quincenas, pesos, el dictado en español).
  return typeof navigator !== 'undefined' && navigator.language?.startsWith('en') ? 'en' : 'es';
}

interface Contexto {
  idioma: Idioma;
  setIdioma: (i: Idioma) => void;
  /** Traduce una clave. Si falta en el idioma activo, cae al español. */
  t: (clave: ClaveTexto) => string;
}

const IdiomaContext = createContext<Contexto | null>(null);

export function IdiomaProvider({ children }: { children: ReactNode }) {
  const [idioma, setIdiomaEstado] = useState<Idioma>(idiomaInicial);

  useEffect(() => {
    // lang en el <html>: lo usan los lectores de pantalla para elegir voz
    // y el navegador para la division silabica. Sin esto, un lector leeria
    // el ingles con fonetica española.
    document.documentElement.lang = idioma === 'en' ? 'en' : 'es-CO';
    setMesesLocales(idioma);
  }, [idioma]);

  const setIdioma = useCallback((i: Idioma) => {
    setIdiomaEstado(i);
    try { localStorage.setItem(CLAVE_GUARDADA, i); } catch { /* no-op */ }
  }, []);

  const t = useCallback(
    (clave: ClaveTexto) => TEXTOS[idioma][clave] ?? TEXTOS.es[clave] ?? clave,
    [idioma],
  );

  const valor = useMemo(() => ({ idioma, setIdioma, t }), [idioma, setIdioma, t]);
  return <IdiomaContext.Provider value={valor}>{children}</IdiomaContext.Provider>;
}

export function useIdioma(): Contexto {
  const ctx = useContext(IdiomaContext);
  if (!ctx) throw new Error('useIdioma fuera de IdiomaProvider');
  return ctx;
}

/** Atajo para cuando solo hace falta traducir. */
export function useT(): (clave: ClaveTexto) => string {
  return useIdioma().t;
}
