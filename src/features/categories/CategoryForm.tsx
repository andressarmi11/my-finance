import { useT } from '@/i18n/language';
import { useState } from 'react';
import { useDialogo } from '@/components/ui/useDialogo';
import type { Category } from '@/domain/types';
import { Field, FieldGroup } from '@/components/ui/Field';
import { CategoryIcon, SELECTABLE_ICONS } from '@/components/ui/CategoryIcon';
import { DEFAULT_CATEGORIES } from '@/domain/seed/defaultCategories';
import { categoryColor } from '@/domain/seed/categoryColor';

// The names live in components/ui/CategoryIcon.tsx: a single registry.
// The palette is the seeded categories' one (the twelve --cat-* tokens). The
// hex is what gets STORED (portable, see categoryColor.ts); the swatch is
// PAINTED with the matching token so it follows the theme.
const PALETTE = DEFAULT_CATEGORIES.map((c) => ({ stored: c.color, painted: categoryColor(c) }));
const COLORS = PALETTE.map((p) => p.stored);
const paint = (stored: string) => PALETTE.find((p) => p.stored.toUpperCase() === stored.toUpperCase())?.painted ?? stored;

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
  const [icon, setIcon] = useState<string>(existing?.icon ?? SELECTABLE_ICONS[0]!);
  const [color, setColor] = useState(existing?.color ?? COLORS[0]!);
  const [kind, setKind] = useState<Category['kind']>(existing?.kind ?? 'expense');
  const [touched, setTouched] = useState(false);

  const canSave = name.trim().length > 0;

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

  const dialogRef = useDialogo(onCancel);
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label={existing ? t('categories.editOne') : t('categories.newOneTitle')}
      style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, black 40%, transparent)', display: 'flex', alignItems: 'flex-end', zIndex: 50 }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 560, margin: '0 auto', background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '10px 20px calc(var(--safe-bottom) + 20px)', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '4px auto 16px' }} />

        <Field label={t('form.name')} htmlFor="cat-nombre">
          <input id="cat-nombre" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Mascotas" style={inputStyle} />
        </Field>
        {touched && !name.trim() && <p style={{ margin: '-10px 0 10px', fontSize: 12, color: 'var(--danger-text)' }}>{t('categories.giveItAName')}</p>}

        <FieldGroup label={t('categories.icon')} id="cat-icono" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {SELECTABLE_ICONS.map((i) => (
            <button key={i} type="button" onClick={() => setIcon(i)} aria-pressed={icon === i} aria-label={i}
              style={{
                width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center',
                border: `1.5px solid ${icon === i ? paint(color) : 'var(--line)'}`,
                background: icon === i ? `color-mix(in srgb, ${paint(color)} 16%, var(--surface))` : 'var(--surface)',
                color: icon === i ? paint(color) : 'var(--text-muted)', cursor: 'pointer',
              }}>
              <CategoryIcon icon={i} size={20} />
            </button>
          ))}
        </FieldGroup>

        <FieldGroup label="Color" id="cat-color" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-pressed={color === c} aria-label={`Color ${c}`}
              style={{ width: 30, height: 30, borderRadius: 15, background: paint(c), border: color === c ? '3px solid var(--text)' : '1px solid var(--line)', cursor: 'pointer' }} />
          ))}
        </FieldGroup>

        <FieldGroup label="Aplica a" id="cat-aplica" style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {(['expense', 'income', 'both'] as const).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} style={segmentStyle(kind === k)}>
              {k === 'expense' ? 'Gastos' : k === 'income' ? 'Ingresos' : 'Ambos'}
            </button>
          ))}
        </FieldGroup>

        <button type="button" onClick={handleSubmit} disabled={!canSave} style={saveButtonStyle(canSave)}>{t('action.save')}</button>

        {existing && onDelete && (
          <button type="button" onClick={onDelete} style={{ width: '100%', minHeight: 44, marginTop: 10, borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--danger-text)', fontWeight: 600, cursor: 'pointer' }}>
            {t('categories.archive')}
          </button>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', minHeight: 'var(--tap)', padding: '0 12px', marginBottom: 14, borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--text)', fontSize: 16 };
function segmentStyle(active: boolean): React.CSSProperties {
  return { flex: 1, minHeight: 'var(--tap)', borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)', background: active ? 'var(--text)' : 'var(--surface)', color: active ? 'var(--surface)' : 'var(--text)', fontWeight: 600, cursor: 'pointer' };
}
function saveButtonStyle(enabled: boolean): React.CSSProperties {
  return { width: '100%', minHeight: 48, borderRadius: 'var(--radius-s)', border: 'none', background: enabled ? 'var(--text)' : 'var(--surface-sunken)', color: enabled ? 'var(--surface)' : 'var(--text-faint)', fontWeight: 700, fontSize: 16, cursor: enabled ? 'pointer' : 'not-allowed' };
}
