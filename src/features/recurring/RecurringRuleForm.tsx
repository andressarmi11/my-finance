import { IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { useDialogo } from '@/components/ui/useDialogo';
import type { Category, Frequency, PaymentMethod, RecurringRule, TransactionType } from '@/domain/types';
import { parseMoney } from '@/domain/money/format';
import { todayISO } from '@/lib/todayISO';
import { Field, FieldGroup } from '@/components/ui/Field';

const FREQUENCIES: Array<{ value: Frequency; label: string }> = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'biweekly', label: 'Quincenal' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'yearly', label: 'Anual' },
];

export function RecurringRuleForm({
  existing, categories, paymentMethods, onSave, onCancel, onDelete,
}: {
  existing: RecurringRule | null;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  onSave: (rule: RecurringRule) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [type, setType] = useState<TransactionType>(existing?.type ?? 'expense');
  const [name, setName] = useState(existing?.name ?? '');
  const [amountText, setAmountText] = useState(existing ? String(existing.amount) : '');
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(existing?.paymentMethodId ?? paymentMethods[0]?.id ?? null);
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? 'monthly');
  const [dayOfMonth, setDayOfMonth] = useState(existing?.dayOfMonth ?? 1);
  const [startDate, setStartDate] = useState(existing?.startDate ?? todayISO());
  const [hasEnd, setHasEnd] = useState(Boolean(existing?.endDate));
  const [endDate, setEndDate] = useState(existing?.endDate ?? '');
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [touched, setTouched] = useState(false);

  const amount = parseMoney(amountText);
  const canSave = name.trim().length > 0 && amount !== null && amount > 0 && !!startDate;
  const needsDayOfMonth = frequency === 'monthly';

  function handleSubmit() {
    setTouched(true);
    if (!canSave || amount === null) return;
    onSave({
      id: existing?.id ?? crypto.randomUUID(),
      name: name.trim(),
      type,
      amount,
      categoryId,
      paymentMethodId,
      frequency,
      dayOfMonth: needsDayOfMonth ? dayOfMonth : undefined,
      startDate,
      endDate: hasEnd && endDate ? endDate : undefined,
      isActive,
      // La fecha real la estampa localRepository.saveRecurringRule.
      updatedAt: existing?.updatedAt ?? '',
    });
  }

  const refDialogo = useDialogo(onCancel);
  return (
    <div
      ref={refDialogo}
      role="dialog"
      aria-label={existing ? 'Editar recurrente' : 'Nuevo recurrente'}
      style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, black 40%, transparent)', display: 'flex', alignItems: 'flex-end', zIndex: 50 }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 560, margin: '0 auto', background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '10px 20px calc(var(--safe-bottom) + 20px)', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '4px auto 12px' }} />

        {/* Cerrar VISIBLE. Antes solo se podia salir tocando el fondo o con
            Escape: en un telefono no hay Escape, y el fondo visible es una
            franja angosta arriba de una hoja que ocupa casi toda la
            pantalla. Abrir esto por error era quedarse adentro. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancelar"
            style={{
              width: 32, height: 32, borderRadius: 16, border: 'none', display: 'grid',
              placeItems: 'center', background: 'var(--surface-sunken)',
              color: 'var(--text-muted)', cursor: 'pointer', flex: 'none',
            }}
          >
            <IconX size={17} stroke={2.2} aria-hidden />
          </button>
          <span style={{ fontWeight: 700, fontSize: 'var(--text-md)' }}>
            {existing ? 'Editar recurrente' : 'Nuevo recurrente'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {(['expense', 'income'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setType(t)} aria-pressed={type === t} style={segmentStyle(type === t)}>
              {t === 'expense' ? 'Gasto fijo' : 'Ingreso recurrente'}
            </button>
          ))}
        </div>

        <Field label="Nombre" htmlFor="rr-nombre">
          <input id="rr-nombre" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Arriendo" style={inputStyle} />
        </Field>
        {touched && !name.trim() && <p style={errorText}>Ponle un nombre.</p>}

        <Field label="Valor" htmlFor="rr-valor">
          <input id="rr-valor" value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="$ 0" inputMode="numeric" className="figures" style={inputStyle} />
        </Field>
        {touched && (amount === null || amount <= 0) && <p style={errorText}>Ingresa un valor válido.</p>}

        <FieldGroup label="Categoría" id="rr-categoria" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
          {categories.filter((c) => c.kind === 'both' || c.kind === type).map((c) => (
            <button key={c.id} type="button" onClick={() => setCategoryId(c.id)} aria-pressed={categoryId === c.id}
              style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 6, minHeight: 'var(--tap)', padding: '0 12px', borderRadius: 999, border: `1.5px solid ${categoryId === c.id ? c.color : 'var(--line)'}`, background: categoryId === c.id ? `color-mix(in srgb, ${c.color} 16%, var(--surface))` : 'var(--surface)', color: categoryId === c.id ? c.color : 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <span aria-hidden>{c.icon}</span>{c.name}
            </button>
          ))}
        </FieldGroup>

        <FieldGroup label="Método de pago" id="rr-metodo" style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {paymentMethods.map((m) => (
            <button key={m.id} type="button" onClick={() => setPaymentMethodId(m.id)} aria-pressed={paymentMethodId === m.id} style={segmentStyle(paymentMethodId === m.id)}>
              {m.name}
            </button>
          ))}
        </FieldGroup>

        <FieldGroup label="Frecuencia" id="rr-frecuencia" style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {FREQUENCIES.map((f) => (
            <button key={f.value} type="button" onClick={() => setFrequency(f.value)} aria-pressed={frequency === f.value} style={segmentStyle(frequency === f.value)}>
              {f.label}
            </button>
          ))}
        </FieldGroup>

        {needsDayOfMonth && (
          <>
            <Field label="Día del mes" htmlFor="rr-dia">
              <input
                id="rr-dia"
                type="number" min={1} max={31} value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                style={inputStyle}
              />
            </Field>
          </>
        )}

        <Field label="Empieza el" htmlFor="rr-inicio">
          <input id="rr-inicio" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
        </Field>

        <button
          type="button"
          onClick={() => setHasEnd((v) => !v)}
          aria-pressed={hasEnd}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 'var(--tap)', padding: '0 4px', marginBottom: hasEnd ? 8 : 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}
        >
          <span>Tiene fecha de fin</span>
          <ToggleDot on={hasEnd} />
        </button>
        {hasEnd && (
          <input aria-label="Fecha de fin" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
        )}

        <button
          type="button"
          onClick={() => setIsActive((v) => !v)}
          aria-pressed={isActive}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 'var(--tap)', padding: '0 4px', margin: '4px 0 20px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}
        >
          <span>Activo</span>
          <ToggleDot on={isActive} activeColor="var(--positive)" />
        </button>

        <button type="button" onClick={handleSubmit} disabled={!canSave} style={saveButtonStyle(canSave)}>Guardar</button>

        {existing && onDelete && (
          <button type="button" onClick={onDelete} style={{ width: '100%', minHeight: 44, marginTop: 10, borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--danger-text)', fontWeight: 600, cursor: 'pointer' }}>
            Eliminar regla
          </button>
        )}
      </div>
    </div>
  );
}

function ToggleDot({ on, activeColor = 'var(--text)' }: { on: boolean; activeColor?: string }) {
  return (
    <span aria-hidden style={{ width: 44, height: 26, borderRadius: 13, background: on ? activeColor : 'var(--surface-sunken)', border: '1px solid var(--line)', position: 'relative' }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 21 : 2, width: 20, height: 20, borderRadius: 10, background: '#fff', boxShadow: '0 1px 3px rgb(0 0 0/.3)' }} />
    </span>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', minHeight: 'var(--tap)', padding: '0 12px', marginBottom: 14, borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--text)', fontSize: 16 };
const errorText: React.CSSProperties = { margin: '-10px 0 10px', fontSize: 12, color: 'var(--danger-text)' };
function segmentStyle(active: boolean): React.CSSProperties {
  return { flex: 1, minHeight: 'var(--tap)', borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)', background: active ? 'var(--text)' : 'var(--surface)', color: active ? 'var(--surface)' : 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 13 };
}
function saveButtonStyle(enabled: boolean): React.CSSProperties {
  return { width: '100%', minHeight: 48, borderRadius: 'var(--radius-s)', border: 'none', background: enabled ? 'var(--text)' : 'var(--surface-sunken)', color: enabled ? 'var(--surface)' : 'var(--text-faint)', fontWeight: 700, fontSize: 16, cursor: enabled ? 'pointer' : 'not-allowed' };
}
