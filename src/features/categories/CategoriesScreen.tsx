import { useT } from '@/i18n/language';
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/components/ui/Screen';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { localRepository } from '@/data/local/localRepository';
import { db } from '@/data/db';
import { formatMoney } from '@/domain/money/format';
import { calculateSpendByCategory } from '@/domain/totals/byCategory';
import { categoryColor } from '@/domain/seed/categoryColor';
import type { Category } from '@/domain/types';
import { DashedButton, SettingsGroup, rowStyle, useSettingsBack } from '@/features/settings/ui';
import { CategoryForm } from './CategoryForm';
import { EMPTY } from '@/lib/empty';

/**
 * Categorías (redesign §9d): avatar, name and all-time total, and a dashed
 * "+ Nueva categoría". Tapping one opens CategoryForm to edit or archive it.
 */
export function CategoriesScreen() {
  const t = useT();
  const back = useSettingsBack();
  const categories = useLiveQuery(() => localRepository.listCategories(), []) ?? EMPTY;
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? EMPTY;
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);

  const spendByCategory = useMemo(() => {
    const totals = calculateSpendByCategory(transactions);
    return new Map(totals.map((t) => [t.categoryId, t.amount]));
  }, [transactions]);

  const visibleRows = categories.filter((c) => !c.isArchived);

  async function handleSave(category: Category) {
    await localRepository.saveCategory(category);
    setEditing(null);
    setCreating(false);
  }

  async function handleArchive() {
    if (!editing) return;
    await localRepository.saveCategory({ ...editing, isArchived: true });
    setEditing(null);
  }

  return (
    <Screen title={t('categories.title')} subtitle={t('set.categoriesIntro')} back={back}>
      {visibleRows.length > 0 && (
        <SettingsGroup style={{ marginTop: 0 }}>
          {visibleRows.map((c) => {
            const color = categoryColor(c);
            const total = spendByCategory.get(c.id) ?? 0;
            return (
              <button key={c.id} type="button" onClick={() => setEditing(c)} style={{ ...rowStyle, padding: '10px 14px' }}>
                <span aria-hidden style={{
                  width: 36, height: 36, borderRadius: 12, flex: 'none', display: 'grid', placeItems: 'center',
                  background: `color-mix(in srgb, ${color} 16%, var(--surface))`, color,
                }}>
                  <CategoryIcon icon={c.icon} size={19} />
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-md)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                <span className="figures" style={{ fontSize: 'var(--text-base)', color: total ? 'var(--text-muted)' : 'var(--text-faint)' }}>
                  {formatMoney(total)}
                </span>
              </button>
            );
          })}
        </SettingsGroup>
      )}

      <DashedButton onClick={() => setCreating(true)}>{t('categories.newOne')}</DashedButton>

      {(editing || creating) && (
        <CategoryForm
          existing={editing}
          nextSortOrder={categories.length}
          onSave={handleSave}
          onDelete={editing ? handleArchive : undefined}
          onCancel={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </Screen>
  );
}
