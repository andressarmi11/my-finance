/**
 * Money amounts written the way a person says or types them.
 *
 * Covers what shows up in dictation and in Colombian bank SMS:
 *   "45000"  "45.000"  "$ 45.000"  "45 mil"  "45k"  "45 lucas"
 *   "cuarenta y cinco mil"  "un millon"  "1.2 millones"  "dos millones y medio"
 *
 * Returns whole pesos, like the rest of the domain.
 */

const UNIDADES: Record<string, number> = {
  cero: 0, un: 1, one: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21,
  veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70,
  ochenta: 80, noventa: 90,
};

const HUNDREDS: Record<string, number> = {
  cien: 100, ciento: 100, doscientos: 200, trescientos: 300,
  cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700,
  ochocientos: 800, novecientos: 900,
};

/** 'mil'/'millon' multiply whatever's accumulated to their left. */
const SCALES: Record<string, number> = {
  mil: 1_000,
  miles: 1_000,
  millon: 1_000_000,
  millones: 1_000_000,
  // Colombian colloquialisms: "45 lucas", "dos palos".
  luca: 1_000,
  lucas: 1_000,
  palo: 1_000_000,
  palos: 1_000_000,
};

/** Strips accents and lowercases, without touching digits or separators. */
export function normalizeText(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * A number written in digits: '45.000', '45,000', '1.2', '45'.
 *
 * Separators are ambiguous and have to be decided: in Colombia the dot
 * is a thousands separator, but "1.2 millones" uses the dot as a
 * decimal point. The rule is the size of the last group — three digits
 * means thousands, anything else means decimal.
 */
function digitsToNumber(raw: string): number | null {
  const clean = raw.replace(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(clean)) return null;

  const separators = clean.match(/[.,]/g) ?? [];
  if (separators.length === 0) return Number(clean);

  const last = clean.lastIndexOf(separators[separators.length - 1]!);
  const queue = clean.slice(last + 1);

  // Final group of 3 digits with more than one separator => all are thousands.
  if (queue.length === 3) return Number(clean.replace(/[.,]/g, ''));
  // Otherwise, the last separator is decimal.
  const integer = clean.slice(0, last).replace(/[.,]/g, '');
  return Number(`${integer || '0'}.${queue}`);
}

/** Loose words to a number: ['cuarenta','y','cinco','mil'] -> 45000 */
function wordsToNumber(words: string[]): number | null {
  let total = 0;
  let partial = 0;
  let sawSomething = false;

  for (const p of words) {
    if (p === 'y') continue;
    if (p === 'medio' || p === 'media') {
      // "dos millones y medio": medio applies to the last scale used.
      continue;
    }
    if (p in UNIDADES) {
      partial += UNIDADES[p]!;
      sawSomething = true;
    } else if (p in HUNDREDS) {
      partial += HUNDREDS[p]!;
      sawSomething = true;
    } else if (p in SCALES) {
      const scale = SCALES[p]!;
      // "mil" alone, with nothing before it, is worth 1000.
      total += (partial === 0 ? 1 : partial) * scale;
      partial = 0;
      sawSomething = true;
    } else {
      return null;
    }
  }
  if (!sawSomething) return null;
  return total + partial;
}

export interface FoundAmount {
  value: number;
  /** The piece of text that produced it, so it can be stripped from the concept. */
  text: string;
}

/**
 * Finds the first amount in the text. Returns null if there is none.
 */
export function findAmount(originalText: string): FoundAmount | null {
  const text = normalizeText(originalText);

  // 0. A figure after "$" is the amount, whatever came before it: in a bank
  // SMS "recibiste una transferencia ... por $300,000.00" the old first-match
  // read "una" or an account number (*7145) instead.
  const dollar = /\$\s{0,2}(\d[\d.,]{0,20})\s*(millon(?:es)?|mil(?:es)?|k)?/.exec(text);
  if (dollar) {
    const base = digitsToNumber(dollar[1]!.replace(/[.,]$/, ''));
    if (base !== null) {
      const scale = dollar[2];
      const value = scale === 'k' ? base * 1_000 : scale ? base * (SCALES[scale] ?? 1) : base;
      return { value: Math.round(value), text: dollar[0]!.trim() };
    }
  }

  // 1. Digits, with an optional scale: "45.000", "$45.000", "45 mil", "1.2 millones", "45k"
  // The alternatives go from LONGEST to shortest on purpose: regex
  // alternation is ordered, so having 'mil' before 'millones' made
  // '2 millones' match 'mil' and give 2,000.
  const withDigits = /\$?\s*(\d[\d.,]*)\s*(millon(?:es)?|milesimo|mil(?:es)?|luca(?:s)?|palo(?:s)?|k)?(\s+y\s+medio)?/i;
  const m = withDigits.exec(text);
  if (m) {
    const base = digitsToNumber(m[1]!);
    if (base !== null) {
      let value = base;
      const scale = m[2];
      if (scale === 'k') value = base * 1_000;
      else if (scale) value = base * (SCALES[scale] ?? 1);
      if (m[3]) value += (scale ? (SCALES[scale] ?? (scale === 'k' ? 1000 : 1)) : 1) / 2;
      return { value: Math.round(value), text: m[0]!.trim() };
    }
  }

  // 2. Fully in words: "cuarenta y cinco mil", "dos millones y medio"
  const tokens = text.split(/\s+/);
  for (let start = 0; start < tokens.length; start++) {
    // Bounded window: a figure spoken in Spanish never goes past about
    // eight words ("doscientos cuarenta y cinco mil quinientos"). Without
    // a cap this was O(n^3) over the whole text, and 2000 characters of
    // number words took ~380 ms per call — which multiplies across every
    // inbox entry, on every render.
    for (let end = Math.min(tokens.length, start + 8); end > start; end--) {
      const chunk = tokens.slice(start, end);
      // At least one scale or number; avoids capturing lone "y"s.
      if (!chunk.some((p) => p in UNIDADES || p in HUNDREDS || p in SCALES)) continue;
      const value = wordsToNumber(chunk);
      // "una transferencia", "un pago": an article, not the amount 1.
      const onlyArticle = chunk.every((p) => p === 'un' || p === 'una' || p === 'uno' || p === 'y');
      if (value !== null && value > 0 && !onlyArticle) {
        const half = chunk.includes('medio') || chunk.includes('media');
        const usedScale = chunk.find((p) => p in SCALES);
        const extra = half && usedScale ? (SCALES[usedScale]! / 2) : 0;
        return { value: Math.round(value + extra), text: chunk.join(' ') };
      }
    }
  }

  return null;
}
