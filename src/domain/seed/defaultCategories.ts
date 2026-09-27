/**
 * Starting categories. Configurable afterwards: this is only the starting
 * point the first time the app is opened.
 *
 * The colours come from the system generated in tokens.css (twelve evenly
 * spaced OKLCH hues, clashing neither with each other nor with the pay
 * period or status colours). What's stored here is the light-mode HEX and
 * not the token, because this row travels to Postgres and is read by the
 * native app, which doesn't understand CSS. Whoever PAINTS decides the real
 * colour: see domain/seed/categoryColor.ts.
 *
 * `icon` is the NAME of a Tabler icon, not an emoji and not a component:
 * this column travels to Postgres and is also read by the Flutter app. The
 * translation into a component lives in components/ui/CategoryIcon.tsx,
 * which also still understands the emojis v2 used to store.
 */
import type { Category } from '../types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-hogar', name: 'Hogar', icon: 'home', color: '#C24976', kind: 'both', isArchived: false, sortOrder: 0, updatedAt: '' },
  { id: 'cat-alimentacion', name: 'Alimentación', icon: 'food', color: '#C25600', kind: 'expense', isArchived: false, sortOrder: 1, updatedAt: '' },
  { id: 'cat-transporte', name: 'Transporte', icon: 'transport', color: '#907A00', kind: 'expense', isArchived: false, sortOrder: 2, updatedAt: '' },
  { id: 'cat-entretenimiento', name: 'Entretenimiento', icon: 'entertainment', color: '#6D8700', kind: 'expense', isArchived: false, sortOrder: 3, updatedAt: '' },
  { id: 'cat-viajes', name: 'Viajes', icon: 'travel', color: '#00976D', kind: 'expense', isArchived: false, sortOrder: 4, updatedAt: '' },
  { id: 'cat-salud', name: 'Salud', icon: 'health', color: '#009691', kind: 'expense', isArchived: false, sortOrder: 5, updatedAt: '' },
  { id: 'cat-suscripciones', name: 'Suscripciones', icon: 'subscriptions', color: '#0090AF', kind: 'expense', isArchived: false, sortOrder: 6, updatedAt: '' },
  { id: 'cat-compras', name: 'Compras', icon: 'shopping', color: '#0088C6', kind: 'expense', isArchived: false, sortOrder: 7, updatedAt: '' },
  { id: 'cat-educacion', name: 'Educación', icon: 'education', color: '#6C6AD5', kind: 'expense', isArchived: false, sortOrder: 8, updatedAt: '' },
  { id: 'cat-servicios', name: 'Servicios', icon: 'utilities', color: '#8B5FC9', kind: 'expense', isArchived: false, sortOrder: 9, updatedAt: '' },
  { id: 'cat-deudas', name: 'Deudas', icon: 'debt', color: '#A355B4', kind: 'expense', isArchived: false, sortOrder: 10, updatedAt: '' },
  { id: 'cat-ahorro', name: 'Ahorro', icon: 'savings', color: '#B54D98', kind: 'both', isArchived: false, sortOrder: 11, updatedAt: '' },
  { id: 'cat-otros', name: 'Otros', icon: 'other', color: '#6C727F', kind: 'both', isArchived: false, sortOrder: 12, updatedAt: '' },
];
