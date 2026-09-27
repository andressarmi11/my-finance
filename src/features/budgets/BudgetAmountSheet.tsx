import { useState } from 'react';
import { useDialogo } from '@/components/ui/useDialogo';
import { parseMoney } from '@/domain/money/format';
import type { Category } from '@/domain/types';

export function BudgetAmountSheet({ category, currentAmount, onSave, onCancel }: {
  category: Category;
  currentAmount: number;
  onSave: (amount: number) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(currentAmount > 0 ? String(currentAmount) : '');
  const amount = parseMoney(text);
  const canSave = amount !== null && amount >= 0;

  const dialogRef = useDialogo(onCancel);
  return (
    <div
      ref={dialogRef}
      role="dialog" aria-label={`Presupuesto de ${category.name}`}
      style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, black 40%, transparent)', display: 'flex', alignItems: 'flex-end', zIndex: 50 }}
      onClick={onCancel}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, margin: '0 auto', background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '10px 20px calc(var(--safe-bottom) + 20px)' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '4px auto 16px' }} />
        <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, margin: '0 0 14px' }}>
          <span aria-hidden>{category.icon}</span>{category.name}
        </p>
        <label htmlFor="presupuesto-monto" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 6px' }}>
          Presupuesto mensual
        </label>
        <input
          id="presupuesto-monto"
          autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="$ 0" inputMode="numeric" className="figures"
          style={{ width: '100%', minHeight: 'var(--tap)', padding: '0 12px', marginBottom: 16, borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--text)', fontSize: 18 }}
        />
        <button
          type="button"
          onClick={() => amount !== null && onSave(amount)}
          disabled={!canSave}
          style={{ width: '100%', minHeight: 48, borderRadius: 'var(--radius-s)', border: 'none', background: canSave ? 'var(--text)' : 'var(--surface-sunken)', color: canSave ? 'var(--surface)' : 'var(--text-faint)', fontWeight: 700, fontSize: 16, cursor: canSave ? 'pointer' : 'not-allowed' }}
        >
          Guardar
        </button>
      </div>
    </div>
  );
}
