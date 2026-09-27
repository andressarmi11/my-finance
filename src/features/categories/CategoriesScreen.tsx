import { useT } from '@/i18n/language';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/components/ui/Screen';
import { localRepository } from '@/data/local/localRepository';
import { db } from '@/data/db';
import { formatMoney } from '@/domain/money/format';
import { calculateSpendByCategory } from '@/domain/totals/byCategory';
import { categoryColor } from '@/domain/seed/categoryColor';
import { CategoryAvatar } from '@/components/ui/CategoryIcon';
import type { Category } from '@/domain/types';
import { CategoryForm } from './CategoryForm';
import { EMPTY } from '@/lib/empty';

export function CategoriesScreen() {
  const t = useT();
  const navigate = useNavigate();
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
    <Screen title={t('categories.title')}>
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16, background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
      >
        ← {t('nav.backToSettings')}
      </button>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-m)', padding: '4px 14px', marginBottom: 16 }}>
        {visibleRows.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setEditing(c)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--line)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <CategoryAvatar icon={c.icon} color={categoryColor(c)} size={36} />
            <span style={{ flex: 1, fontWeight: 600 }}>{c.name}</span>
            <span className="figures" style={{ color: 'var(--text-muted)' }}>
              {formatMoney(spendByCategory.get(c.id) ?? 0)}
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setCreating(true)}
        style={{ width: '100%', minHeight: 'var(--tap)', borderRadius: 'var(--radius-s)', border: '1px dashed var(--line-strong)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}
      >
        + Nueva categoría
      </button>

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
