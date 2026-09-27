/**
 * The colour a category is PAINTED with, which isn't the same as the one
 * that gets STORED.
 *
 * The database stores a portable hex, because that row travels to Postgres
 * and is also read by the native app, which doesn't understand CSS. But a
 * fixed hex doesn't adapt to dark mode: category colours need to gain
 * luminosity on a black background to keep their contrast.
 *
 * The way out: categories that ship by default are painted with their token
 * (`var(--cat-hogar)`), which already carries a light and a dark variant;
 * ones the user created or customized use the stored hex as-is. That way
 * the data stays portable and the screen stays readable.
 */
import type { Category } from '../types';

/** Ids of the seeded categories that have a token of their own. */
const WITH_TOKEN = new Set([
  'cat-hogar', 'cat-alimentacion', 'cat-transporte', 'cat-entretenimiento',
  'cat-viajes', 'cat-salud', 'cat-suscripciones', 'cat-compras',
  'cat-educacion', 'cat-servicios', 'cat-deudas', 'cat-ahorro',
]);

/** 'cat-hogar' -> 'var(--cat-hogar)' */
export function categoryColor(category: Pick<Category, 'id' | 'color'> | null | undefined): string {
  if (!category) return 'var(--text-faint)';
  if (WITH_TOKEN.has(category.id)) return `var(--${category.id.replace(/^cat-/, 'cat-')})`;
  return category.color;
}

/** For 'Others' and 'No category', which aren't a real category. */
export const UNCATEGORIZED_COLOR = 'var(--text-faint)';
