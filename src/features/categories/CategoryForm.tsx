import { useT } from '@/i18n/language';
import { useState } from 'react';
import type { Category } from '@/domain/types';
import { CategoryIcon, SELECTABLE_ICONS, type IconName } from '@/components/ui/CategoryIcon';
import { Segmented } from '@/components/ui/Segmented';
import { DEFAULT_CATEGORIES } from '@/domain/seed/defaultCategories';
import { categoryColor } from '@/domain/seed/categoryColor';
import { fill } from '@/lib/dateLabels';
import { BottomSheet, SheetTopBar } from '@/features/settings/ui';

// The names live in components/ui/CategoryIcon.tsx: a single registry.
// The palette is the seeded categories' one, only the twelve with a --cat-*
// token ("Otros" is grey on purpose, not a colour to pick). The hex is what
// gets STORED (portable, see categoryColor.ts); the swatch is PAINTED with
// the matching token so it follows the theme.
const PALETTE = DEFAULT_CATEGORIES
  .map((c) => ({ stored: c.color, painted: categoryColor(c) }))
  .filter((p) => p.painted.startsWith('var('));
const COLORS = PALETTE.map((p) => p.stored);
const paint = (stored: string) => PALETTE.find((p) => p.stored.toUpperCase() === stored.toUpperCase())?.painted ?? stored;

/** The ten shown first (redesign §9f); "Más íconos" opens the rest. */
const FEATURED: IconName[] = ['food', 'home', 'transport', 'health', 'entertainment', 'shopping', 'education', 'pets', 'salary', 'other'];

/**
 * Nueva / editar categoría (redesign §9f): a big preview of the avatar with
 * the name under it, Gasto | Ingreso, the 12 colours in a grid of 6 and
 * 10 icons in a grid of 5. Same fields and the same Category it always
 * saved.
 */
export function CategoryForm({
  existing, nextSortOrder, onSave, onCancel, onDelete }: {
  existing: Category | null;
  nextSortOrder: number;
  onSave: (category: Category) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const t = useT();
  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState<string>(existing?.icon ?? FEATURED[0]!);
  const [color, setColor] = useState(existing?.color ?? COLORS[0]!);
  const [kind, setKind] = useState<Category['kind']>(existing?.kind ?? 'expense');
  const [allIcons, setAllIcons] = useState(() => !!existing && !FEATURED.includes(existing.icon as IconName));
  const [touched, setTouched] = useState(false);

  const canSave = name.trim().length > 0;
  const painted = paint(color);
  const icons = allIcons ? SELECTABLE_ICONS : FEATURED;

  function handleSubmit() {
    setTouched(true);
    if (!canSave) return;
    onSave({
      id: existing?.id ?? crypto.randomUUID(),
      name: name.trim(),
      icon,
      color,
      kind,
      // The real date gets stamped by localRepository.saveCategory; here it's
      // enough to satisfy the type.
      updatedAt: existing?.updatedAt ?? '',
      isArchived: existing?.isArchived ?? false,
      sortOrder: existing?.sortOrder ?? nextSortOrder,
    });
  }

  const title = existing ? t('categories.editOne') : t('categories.newOneTitle');
  // "Ambos" only when the category already is: new ones pick one side.
  const kinds: Array<{ value: Category['kind']; label: string }> = [
    { value: 'expense', label: t('set.kindExpense') },
    { value: 'income', label: t('set.kindIncome') },
    ...(existing?.kind === 'both' ? [{ value: 'both' as const, label: t('set.kindBoth') }] : []),
  ];

  return (
    <BottomSheet label={title} onClose={onCancel} zIndex={50}>
      <SheetTopBar title={title} onCancel={onCancel} onSave={handleSubmit} canSave={canSave} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '18px 0 6px' }}>
        <span aria-hidden style={{
          width: 64, height: 64, borderRadius: 20, display: 'grid', placeItems: 'center',
          background: `color-mix(in srgb, ${painted} 16%, var(--surface))`, color: painted,
        }}>
          <CategoryIcon icon={icon} size={30} />
        </span>
        <input
          id="cat-nombre"
          autoFocus
          aria-label={t('form.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('set.categoryNamePlaceholder')}
          maxLength={40}
          style={{
            width: '100%', textAlign: 'center', border: 'none', background: 'none', outline: 'none',
            color: 'var(--text)', fontSize: 20, fontWeight: 700, minHeight: 'var(--tap)',
          }}
        />
        {touched && !name.trim() && <p style={{ margin: 0, fontSize: 12, color: 'var(--danger-text)' }}>{t('categories.giveItAName')}</p>}
      </div>

      <Segmented inset label={t('set.appliesTo')} value={kind} onChange={setKind} options={kinds} />

      <h3 style={sectionTitle}>{t('set.color')}</h3>
      <div role="group" aria-label={t('set.color')} style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, justifyItems: 'center' }}>
        {COLORS.map((c, i) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-pressed={color.toUpperCase() === c.toUpperCase()}
            aria-label={fill(t('set.colorN'), { n: i + 1 })}
            style={{
              width: 32, height: 32, borderRadius: 16, padding: 0, cursor: 'pointer', background: paint(c),
              border: `3px solid ${color.toUpperCase() === c.toUpperCase() ? 'var(--text)' : 'transparent'}`,
            }}
          />
        ))}
      </div>

      <h3 style={sectionTitle}>{t('categories.icon')}</h3>
      <div role="group" aria-label={t('categories.icon')} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
        {icons.map((i) => {
          const active = icon === i;
          return (
            <button key={i} type="button" onClick={() => setIcon(i)} aria-pressed={active} aria-label={i}
              style={{
                height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', cursor: 'pointer',
                border: `1.5px solid ${active ? painted : 'var(--line)'}`,
                background: active ? `color-mix(in srgb, ${painted} 18%, var(--surface))` : 'var(--paper)',
                color: active ? painted : 'var(--text-muted)',
              }}>
              <CategoryIcon icon={i} size={20} />
            </button>
          );
        })}
      </div>
      {!allIcons && (
        <button type="button" onClick={() => setAllIcons(true)} style={{ marginTop: 8, width: '100%', minHeight: 40, border: 'none', background: 'none', color: 'var(--q10-text)', fontWeight: 600, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
          {t('set.moreIcons')}
        </button>
      )}

      {existing && onDelete && (
        <button type="button" onClick={onDelete} style={{ width: '100%', minHeight: 44, marginTop: 16, borderRadius: 14, border: 'none', background: 'var(--surface-sunken)', color: 'var(--danger-text)', fontWeight: 600, cursor: 'pointer' }}>
          {t('categories.archive')}
        </button>
      )}
    </BottomSheet>
  );
}

const sectionTitle: React.CSSProperties = { fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-faint)', margin: '18px 2px 10px' };
