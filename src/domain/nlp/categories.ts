/**
 * Category guess by keyword.
 *
 * This is the FLOOR, not the ceiling: it's only used while the concept
 * index (domain/inference) hasn't learned anything about that concept
 * yet. As soon as the user saves "almuerzo" once with a different
 * category, the index takes over and this table stops having an
 * opinion. That's why it can afford to be crude.
 *
 * The ids are the ones from defaultCategories.ts. If the user deleted
 * that category during onboarding, the caller detects it and doesn't
 * use it.
 */
import { normalizeText } from './numbers';

const WORDS: Array<{ categoryId: string; keywords: string[] }> = [
  { categoryId: 'cat-alimentacion', keywords: [
    'almuerzo', 'comida', 'mercado', 'restaurante', 'cafe', 'desayuno', 'cena',
    'domicilio', 'rappi', 'exito', 'd1', 'ara', 'olimpica', 'carulla', 'jumbo',
    'panaderia', 'supermercado', 'pizza', 'hamburguesa', 'almorzar', 'tienda',
  ] },
  { categoryId: 'cat-transporte', keywords: [
    'uber', 'taxi', 'gasolina', 'bus', 'transmilenio', 'parqueadero', 'peaje',
    'didi', 'cabify', 'pasaje', 'metro', 'combustible', 'lavada', 'monteria',
  ] },
  { categoryId: 'cat-suscripciones', keywords: [
    'netflix', 'spotify', 'disney', 'hbo', 'max', 'youtube', 'icloud', 'prime',
    'suscripcion', 'plan celular', 'chatgpt',
  ] },
  { categoryId: 'cat-entretenimiento', keywords: [
    'cine', 'bar', 'concierto', 'teatro', 'fiesta', 'salida', 'cerveza',
    'discoteca', 'juego', 'videojuego',
  ] },
  { categoryId: 'cat-hogar', keywords: [
    'arriendo', 'administracion', 'internet', 'wifi', 'aseo', 'muebles',
    'ferreteria', 'homecenter', 'hogar',
  ] },
  { categoryId: 'cat-servicios', keywords: [
    'luz', 'agua', 'gas', 'energia', 'celular', 'factura', 'recibo', 'epm',
    'acueducto', 'telefono', 'claro', 'movistar', 'tigo',
  ] },
  { categoryId: 'cat-salud', keywords: [
    'drogueria', 'farmacia', 'medico', 'eps', 'medicina', 'odontologo',
    'cruz verde', 'locatel', 'gimnasio', 'gym', 'consulta',
  ] },
  { categoryId: 'cat-compras', keywords: [
    'ropa', 'zapatos', 'amazon', 'mercadolibre', 'falabella', 'zara', 'regalo',
    'tecnologia', 'celular nuevo', 'compra',
  ] },
  { categoryId: 'cat-educacion', keywords: [
    'curso', 'universidad', 'matricula', 'libro', 'semestre', 'colegio', 'clase',
  ] },
  { categoryId: 'cat-deudas', keywords: ['cuota', 'prestamo', 'credito', 'deuda'] },
  { categoryId: 'cat-ahorro', keywords: ['ahorro', 'ahorre', 'cdt', 'inversion'] },
];

/**
 * Suggested category for a text, or null if no word matches.
 * The longest match wins: "plan celular" before "celular".
 */
export function guessCategory(text: string): string | null {
  const t = normalizeText(text);
  let best: { categoryId: string; length: number } | null = null;

  for (const { categoryId, keywords } of WORDS) {
    for (const key of keywords) {
      // Word boundary so "max" doesn't match inside "maxima".
      const re = new RegExp(`(^|\\s)${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
      if (re.test(t) && (!best || key.length > best.length)) {
        best = { categoryId, length: key.length };
      }
    }
  }
  return best?.categoryId ?? null;
}
