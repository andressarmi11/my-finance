import {
  IconApps, IconArmchair, IconBolt, IconBuildingBank, IconBus,
  IconCash, IconCreditCard, IconDeviceMobile, IconDeviceTv, IconDog,
  IconGift, IconHeartbeat, IconHome, IconMoodKid, IconPigMoney, IconPlane,
  IconReceipt, IconRepeat, IconSchool, IconShoppingBag, IconSoccerField,
  IconToolsKitchen2, IconTrendingUp, IconWallet,
  type IconProps,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';

/**
 * Iconos de categoria, de Tabler.
 *
 * Por que un registro de NOMBRES y no el componente directo: Category.icon
 * es una columna de texto que viaja a Postgres y que tambien lee la app
 * nativa en Flutter (ver mobile/). Un componente de React no cabe ahi. Se
 * guarda 'home' y aca se resuelve a <IconHome/>.
 *
 * Y por que el mapa de emojis: hasta v2 la columna guardaba '🏠'. Las
 * filas que ya existen —las del usuario y las de cualquier backup viejo—
 * siguen teniendo emoji. Traducirlas al pintar evita una migracion de
 * datos que podria fallar a medias y dejar categorias sin icono.
 */
export type IconoNombre =
  | 'home' | 'food' | 'transport' | 'entertainment' | 'travel' | 'health'
  | 'subscriptions' | 'shopping' | 'education' | 'utilities' | 'debt'
  | 'savings' | 'other' | 'salary' | 'gift' | 'sports' | 'pets' | 'kids'
  | 'phone' | 'bank' | 'card' | 'cash' | 'bill' | 'furniture' | 'growth';

const REGISTRO: Record<IconoNombre, ComponentType<IconProps>> = {
  home: IconHome,
  food: IconToolsKitchen2,
  transport: IconBus,
  entertainment: IconDeviceTv,
  travel: IconPlane,
  health: IconHeartbeat,
  subscriptions: IconRepeat,
  shopping: IconShoppingBag,
  education: IconSchool,
  utilities: IconBolt,
  debt: IconCreditCard,
  savings: IconPigMoney,
  other: IconApps,
  salary: IconWallet,
  gift: IconGift,
  sports: IconSoccerField,
  pets: IconDog,
  kids: IconMoodKid,
  phone: IconDeviceMobile,
  bank: IconBuildingBank,
  card: IconCreditCard,
  cash: IconCash,
  bill: IconReceipt,
  furniture: IconArmchair,
  growth: IconTrendingUp,
};

/** Lo que guardaba v2. Se traduce al pintar, sin tocar la base. */
const DESDE_EMOJI: Record<string, IconoNombre> = {
  '🏠': 'home', '🍽️': 'food', '🍽': 'food', '🚗': 'transport',
  '🎬': 'entertainment', '✈️': 'travel', '✈': 'travel', '💊': 'health',
  '🔁': 'subscriptions', '🛍️': 'shopping', '🛍': 'shopping',
  '🎓': 'education', '💡': 'utilities', '💳': 'debt', '🐷': 'savings',
  '✳️': 'other', '✳': 'other', '📱': 'phone', '🎁': 'gift',
  '⚽': 'sports', '🐾': 'pets', '👶': 'kids', '💰': 'salary',
  '💵': 'cash', '🏦': 'bank', '🪑': 'furniture', '📈': 'growth',
  '🎂': 'gift',
};

export function resolverIcono(guardado: string | undefined): IconoNombre {
  if (!guardado) return 'other';
  if (guardado in REGISTRO) return guardado as IconoNombre;
  return DESDE_EMOJI[guardado] ?? 'other';
}

/**
 * Trazo 1.75 y no el 2 por defecto: al lado de un numeral pesado, la
 * linea fina es lo que hace que el numero sea lo que se lee primero.
 */
export function CategoryIcon({ icon, size = 20, color, stroke = 1.75 }: {
  icon: string | undefined;
  size?: number;
  color?: string;
  stroke?: number;
}) {
  const Componente = REGISTRO[resolverIcono(icon)];
  return <Componente size={size} stroke={stroke} color={color ?? 'currentColor'} aria-hidden />;
}

/** Lo que ofrece el selector del formulario de categoria. */
export const ICONOS_ELEGIBLES: IconoNombre[] = [
  'home', 'food', 'transport', 'entertainment', 'travel', 'health',
  'subscriptions', 'shopping', 'education', 'utilities', 'debt', 'savings',
  'salary', 'gift', 'sports', 'pets', 'kids', 'phone', 'bank', 'cash',
  'bill', 'furniture', 'growth', 'other',
];

/**
 * El icono dentro de un disco teñido con el color de su categoria.
 *
 * Es lo que le da estructura a una lista de movimientos: el disco marca
 * el ritmo vertical y el color deja identificar la categoria de un
 * vistazo, sin tener que leer. El emoji suelto que habia antes no hacia
 * ninguna de las dos cosas — no se alineaba y su color era el del emoji.
 *
 * El color va al 14% de fondo y al 100% en el trazo: el token de
 * categoria esta calculado para >=3:1 sobre superficie (ver tokens.css),
 * asi que el icono se lee aunque el disco sea tenue.
 */
export function CategoryAvatar({ icon, color, size = 38 }: {
  icon: string | undefined;
  color: string;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      style={{
        flex: 'none',
        width: size,
        height: size,
        borderRadius: size / 2.6,
        display: 'grid',
        placeItems: 'center',
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        color,
      }}
    >
      <CategoryIcon icon={icon} size={Math.round(size * 0.52)} />
    </span>
  );
}
