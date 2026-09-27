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
 * Category icons, from Tabler.
 *
 * Why a registry of NAMES instead of the component directly: Category.icon
 * is a text column that travels to Postgres and is also read by the
 * native Flutter app (see mobile/). A React component doesn't fit there. It
 * stores 'home' and here it resolves to <IconHome/>.
 *
 * And why the emoji map: up to v2 the column stored '🏠'. Rows that already
 * exist —the user's and any old backup's— still have an emoji. Translating
 * them at render time avoids a data migration that could fail halfway
 * and leave categories without an icon.
 */
export type IconName =
  | 'home' | 'food' | 'transport' | 'entertainment' | 'travel' | 'health'
  | 'subscriptions' | 'shopping' | 'education' | 'utilities' | 'debt'
  | 'savings' | 'other' | 'salary' | 'gift' | 'sports' | 'pets' | 'kids'
  | 'phone' | 'bank' | 'card' | 'cash' | 'bill' | 'furniture' | 'growth';

const ICON_REGISTRY: Record<IconName, ComponentType<IconProps>> = {
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

/** What v2 used to store. Translated at render time, without touching the database. */
const FROM_EMOJI: Record<string, IconName> = {
  '🏠': 'home', '🍽️': 'food', '🍽': 'food', '🚗': 'transport',
  '🎬': 'entertainment', '✈️': 'travel', '✈': 'travel', '💊': 'health',
  '🔁': 'subscriptions', '🛍️': 'shopping', '🛍': 'shopping',
  '🎓': 'education', '💡': 'utilities', '💳': 'debt', '🐷': 'savings',
  '✳️': 'other', '✳': 'other', '📱': 'phone', '🎁': 'gift',
  '⚽': 'sports', '🐾': 'pets', '👶': 'kids', '💰': 'salary',
  '💵': 'cash', '🏦': 'bank', '🪑': 'furniture', '📈': 'growth',
  '🎂': 'gift',
};

export function resolveIcon(stored: string | undefined): IconName {
  if (!stored) return 'other';
  if (stored in ICON_REGISTRY) return stored as IconName;
  return FROM_EMOJI[stored] ?? 'other';
}

/**
 * Stroke 1.75 instead of the default 2: next to a heavy numeral, the
 * thin line is what makes the number the thing that gets read first.
 */
export function CategoryIcon({ icon, size = 20, color, stroke = 1.75 }: {
  icon: string | undefined;
  size?: number;
  color?: string;
  stroke?: number;
}) {
  const Icon = ICON_REGISTRY[resolveIcon(icon)];
  return <Icon size={size} stroke={stroke} color={color ?? 'currentColor'} aria-hidden />;
}

/** What the category form's picker offers. */
export const SELECTABLE_ICONS: IconName[] = [
  'home', 'food', 'transport', 'entertainment', 'travel', 'health',
  'subscriptions', 'shopping', 'education', 'utilities', 'debt', 'savings',
  'salary', 'gift', 'sports', 'pets', 'kids', 'phone', 'bank', 'cash',
  'bill', 'furniture', 'growth', 'other',
];

/**
 * The icon inside a disc tinted with its category's color.
 *
 * It's what gives structure to a transaction list: the disc marks
 * the vertical rhythm and the color lets you identify the category at a
 * glance, without having to read. The loose emoji that used to be there did
 * neither — it didn't align and its color was whatever the emoji's was.
 *
 * The color goes at 14% for the background and 100% for the stroke: the
 * category token is calculated for >=3:1 against the surface (see tokens.css),
 * so the icon reads even when the disc is faint.
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
