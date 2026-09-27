/**
 * Categorias iniciales. Configurables despues: esto es solo el punto de
 * partida la primera vez que se abre la app.
 *
 * Los colores salen del sistema generado en tokens.css (doce tonos OKLCH
 * equiespaciados, sin chocar entre si ni con los colores de quincena o de
 * estado). Aca se guarda el HEX del modo claro y no el token, porque esta
 * fila viaja a Postgres y la lee la app nativa, que no entiende CSS.
 * Quien PINTA decide el color real: ver domain/seed/categoryColor.ts.
 *
 * `icon` es el NOMBRE de un icono de Tabler, no un emoji ni un componente:
 * esta columna viaja a Postgres y la lee tambien la app en Flutter. La
 * traduccion a componente vive en components/ui/CategoryIcon.tsx, que
 * ademas sigue entendiendo los emojis que guardaba la v2.
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
