import { useEffect, useMemo, useRef, useState } from 'react';
import { useDialogo } from '@/components/ui/useDialogo';
import { useLiveQuery } from 'dexie-react-hooks';
import { calculateCreditCardCycle } from '@/domain/credit-card/cycle';
import { formatMoney, parseMoney } from '@/domain/money/format';
import type { Category, PaymentMethod, Transaction, TransactionType } from '@/domain/types';
import { nowISO, todayISO } from '@/lib/todayISO';
import { formatShortDate } from '@/lib/formatShortDate';
import { db } from '@/data/db';
import { inferFromConcept, topRecents, normalize, type ConceptIndexEntry } from '@/domain/inference/conceptInference';
import { categoryColor } from '@/domain/seed/categoryColor';
import { haptic } from '@/lib/haptic';
import { Field, FieldGroup } from '@/components/ui/Field';
import { VACIO } from '@/lib/vacio';

function shortDate(iso: string): string {
  const { day, month } = formatShortDate(iso);
  return `${day} ${month}`;
}

export interface TransactionFormValue {
  type: TransactionType;
  concept: string;
  amountText: string;
  date: string;
  categoryId: string | null;
  paymentMethodId: string | null;
  markPaidNow: boolean;
}

/** Valores con los que se puede abrir el form. Los manda el TabBar o una URL
 *  (`?nuevo=1&tipo=ingreso&monto=...`), que es como entra el Atajo de iOS. */
export interface Prefill {
  type: TransactionType;
  concept?: string;
  amountText?: string;
  date?: string;
  markPaidNow?: boolean;
  categoryId?: string | null;
  paymentMethodId?: string | null;
}

function initialValue(
  existing: Transaction | null,
  prefill: Prefill | undefined,
  defaultPaymentMethodId: string | null,
): TransactionFormValue {
  if (existing) {
    return {
      type: existing.type,
      concept: existing.concept,
      amountText: String(existing.amount),
      date: existing.date,
      categoryId: existing.categoryId,
      paymentMethodId: existing.paymentMethodId,
      markPaidNow: existing.status === 'paid',
    };
  }
  const date = prefill?.date ?? todayISO();
  return {
    type: prefill?.type ?? 'expense',
    concept: prefill?.concept ?? '',
    amountText: prefill?.amountText ?? '',
    date,
    categoryId: prefill?.categoryId ?? null,
    paymentMethodId: prefill?.paymentMethodId ?? defaultPaymentMethodId,
    // Un movimiento con fecha de hoy o anterior ya ocurrió: se marca hecho.
    // Antes todo entraba como 'pendiente', lo que inflaba "por pagar" y
    // dejaba los ingresos fuera de lo recibido.
    markPaidNow: prefill?.markPaidNow ?? date <= todayISO(),
  };
}

/**
 * Form rediseñado (Fase 3):
 *   - El monto grande ES el input (un solo campo, no display + caja).
 *   - Chips de conceptos recientes (top 5): tap → autofill TODO.
 *   - Al escribir concepto, inferencia autónoma de categoría + método
 *     desde el historial (debounce 200ms).
 *   - Tipo y valores iniciales vienen de `prefill` (o del existente).
 */
export function TransactionForm({
  existing, prefill, categories, paymentMethods, defaultPaymentMethodId,
  onSave, onDelete, onDuplicate, onCancel,
}: {
  existing: Transaction | null;
  prefill?: Prefill;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  defaultPaymentMethodId: string | null;
  onSave: (tx: Transaction) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<TransactionFormValue>(() =>
    initialValue(existing, prefill, defaultPaymentMethodId),
  );
  const [touched, setTouched] = useState(false);
  const [inferredKey, setInferredKey] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  const conceptIndex = useLiveQuery(() => db.conceptIndex.toArray(), []) ?? VACIO;
  const recents = useMemo(() => topRecents(conceptIndex, 5), [conceptIndex]);

  const amount = parseMoney(value.amountText);
  const selectedMethod = paymentMethods.find((m) => m.id === value.paymentMethodId);
  const isCredit = selectedMethod?.type === 'credit';
  const isIncome = value.type === 'income';

  // Métodos disponibles: en ingresos, no mostrar TC (no tiene sentido cobrar ingresos por tarjeta).
  const availableMethods = useMemo(
    () => paymentMethods.filter((m) => !isIncome || m.type !== 'credit'),
    [paymentMethods, isIncome],
  );

  /**
   * Una compra con tarjeta NO esta pagada el dia que la pasas: la debes
   * hasta que pagues el extracto. El default de markPaidNow ("con fecha de
   * hoy o anterior, ya ocurrio") vale para efectivo y debito, pero con
   * tarjeta hacia que toda compra naciera 'paid' — y entonces el cupo
   * disponible nunca se movia y el grupo "en tarjeta" de porPagar.ts
   * quedaba siempre vacio.
   *
   * Solo aplica al crear: si estas editando algo que ya marcaste pagado, tu
   * decision manda.
   */
  const creditoPrevio = useRef<boolean | null>(null);
  useEffect(() => {
    if (!existing && isCredit && creditoPrevio.current !== true) {
      setValue((v) => ({ ...v, markPaidNow: false }));
    }
    creditoPrevio.current = isCredit;
  }, [isCredit, existing]);

  const paymentPreview = useMemo(() => {
    if (!isCredit || !value.date) return null;
    const cycle = calculateCreditCardCycle(value.date, selectedMethod?.cutoffDay, selectedMethod?.paymentDay);
    return cycle.paymentDate;
  }, [isCredit, value.date, selectedMethod]);

  // Smart-fill: al escribir concepto, inferir categoría + método (200ms debounce).
  // Sólo si el user no editó manualmente los chips (i.e. está en un match previo).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const key = normalize(value.concept);
      if (!key || key === inferredKey) return;
      const result = inferFromConcept(
        value.concept,
        conceptIndex,
        {
          categoryId: value.categoryId,
          paymentMethodId: value.paymentMethodId,
        },
      );
      if (result.confidence !== 'fallback' && result.source) {
        // Sólo autofill si los slots actuales están vacíos o son del match previo.
        setValue((v) => ({
          ...v,
          categoryId: v.categoryId ?? result.categoryId,
          paymentMethodId: v.paymentMethodId ?? result.paymentMethodId,
        }));
        setInferredKey(key);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value.concept, conceptIndex]);

  function applyRecent(entry: ConceptIndexEntry) {
    haptic('light');
    setValue((v) => ({
      ...v,
      concept: entry.displayName,
      categoryId: entry.categoryId,
      paymentMethodId: entry.paymentMethodId,
    }));
    setInferredKey(entry.id);
  }

  const canSave = value.concept.trim().length > 0 && amount !== null && amount > 0 && !!value.date;

  function handleSubmit() {
    setTouched(true);
    if (!canSave || amount === null) return;

    const now = nowISO();
    const cycle = isCredit ? calculateCreditCardCycle(value.date, selectedMethod?.cutoffDay, selectedMethod?.paymentDay) : null;

    const tx: Transaction = {
      id: existing?.id ?? crypto.randomUUID(),
      type: value.type,
      concept: value.concept.trim(),
      amount,
      date: value.date,
      categoryId: value.categoryId,
      paymentMethodId: value.paymentMethodId,
      status: value.markPaidNow ? 'paid' : (existing?.status === 'scheduled' ? 'scheduled' : 'pending'),
      notes: existing?.notes,
      quincenaKey: existing?.quincenaKey ?? null,
      cycleCutoffDate: cycle?.cycleCutoff,
      cyclePaymentDate: cycle?.paymentDate,
      recurringRuleId: existing?.recurringRuleId,
      periodKey: existing?.periodKey,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    haptic('medium');
    onSave(tx);
  }

  const headerLabel = existing
    ? isIncome ? 'Editar ingreso' : 'Editar gasto'
    : isIncome ? 'Nuevo ingreso' : 'Nuevo gasto';

  const refDialogo = useDialogo(onCancel);
  return (
    <div
      ref={refDialogo}
      role="dialog"
      aria-label={existing ? 'Editar movimiento' : 'Agregar movimiento'}
      style={{
        position: 'fixed', inset: 0, background: 'color-mix(in srgb, black 40%, transparent)',
        display: 'flex', alignItems: 'flex-end', zIndex: 50,
        animation: 'fadeIn var(--dur-fast) var(--ease-spring-out)',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, margin: '0 auto', background: 'var(--surface)',
          borderRadius: '20px 20px 0 0', padding: '10px 20px calc(var(--safe-bottom) + 20px)',
          maxHeight: '92vh', overflowY: 'auto',
          animation: 'slideUp var(--dur-med) var(--ease-spring-out)',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '4px auto 8px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancelar"
            style={{
              width: 32, height: 32, borderRadius: 16, border: 'none',
              background: 'var(--surface-sunken)', color: 'var(--text-muted)',
              fontSize: 18, cursor: 'pointer',
            }}
          >
            ✕
          </button>
          <span
            style={{
              fontSize: 'var(--text-sm)', fontWeight: 700,
              padding: '4px 10px', borderRadius: 12,
              background: isIncome ? 'var(--positive-soft)' : 'var(--surface-sunken)',
              color: isIncome ? 'var(--positive-text)' : 'var(--text-muted)',
              letterSpacing: '0.02em', textTransform: 'uppercase',
            }}
          >
            {headerLabel}
          </span>
        </div>

        {/* El número grande ES el campo. Antes había un display decorativo
            arriba y un input chico debajo: dos cosas mostrando lo mismo. */}
        <input
          value={value.amountText ? formatMoney(Number(value.amountText)) : ''}
          onChange={(e) => setValue((v) => ({ ...v, amountText: e.target.value.replace(/[^0-9]/g, '').slice(0, 12) }))}
          placeholder="$ 0"
          inputMode="numeric"
          enterKeyHint="next"
          autoFocus={!existing}
          aria-label="Valor"
          className="figures"
          style={{
            width: '100%', border: 'none', background: 'none', outline: 'none',
            textAlign: 'center', margin: '12px 0 4px', padding: 0,
            fontSize: 'var(--text-3xl)', fontWeight: 700, letterSpacing: '-0.022em', lineHeight: 1.1,
            color: isIncome ? 'var(--positive-text)' : (amount && amount > 0 ? 'var(--text)' : 'var(--text-faint)'),
          }}
        />
        <p style={{ margin: '0 0 14px', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
          {isIncome ? 'Cuánto entra' : 'Cuánto sale'}
        </p>
        {touched && (amount === null || amount <= 0) && <p style={errorText}>Ingresa un valor válido.</p>}

        {/* Chips de recientes — solo cuando NO editás y hay historial */}
        {!existing && recents.length > 0 && (
          <>
            <FieldGroup label="Usar reciente" id="tx-recientes" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
              {recents.map((r) => {
                const cat = r.categoryId ? categories.find((c) => c.id === r.categoryId) : null;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => applyRecent(r)}
                    style={{
                      flex: 'none', display: 'flex', alignItems: 'center', gap: 6,
                      minHeight: 'var(--tap)', padding: '0 14px', borderRadius: 999,
                      border: '1px solid var(--line-strong)',
                      background: 'var(--surface)', color: 'var(--text)',
                      fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {cat && <span aria-hidden>{cat.icon}</span>}
                    <span>{r.displayName}</span>
                  </button>
                );
              })}
            </FieldGroup>
          </>
        )}

        <Field label="Concepto" htmlFor="tx-concepto">
        <input
          id="tx-concepto"
          value={value.concept}
          onChange={(e) => setValue((v) => ({ ...v, concept: e.target.value }))}
          placeholder="Ej. Restaurante"
          style={inputStyle}
        />
        </Field>
        {touched && !value.concept.trim() && <p style={errorText}>Escribe qué es.</p>}

        <FieldGroup label="Categoría" id="tx-categoria" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
          {categories.filter((c) => c.kind === 'both' || c.kind === value.type).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setValue((v) => ({ ...v, categoryId: c.id }))}
              aria-pressed={value.categoryId === c.id}
              style={{
                flex: 'none', display: 'flex', alignItems: 'center', gap: 6,
                minHeight: 'var(--tap)', padding: '0 12px', borderRadius: 999,
                border: `1.5px solid ${value.categoryId === c.id ? categoryColor(c) : 'var(--line)'}`,
                background: value.categoryId === c.id ? `color-mix(in srgb, ${categoryColor(c)} 16%, var(--surface))` : 'var(--surface)',
                color: value.categoryId === c.id ? categoryColor(c) : 'var(--text)',
                fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all var(--dur-fast) var(--ease-spring-out)',
              }}
            >
              <span aria-hidden>{c.icon}</span>{c.name}
            </button>
          ))}
        </FieldGroup>

        <FieldGroup label="Método de pago" id="tx-metodo" style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {availableMethods.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setValue((v) => ({ ...v, paymentMethodId: m.id }))}
              aria-pressed={value.paymentMethodId === m.id}
              style={segmentStyle(value.paymentMethodId === m.id)}
            >
              {m.name}
            </button>
          ))}
        </FieldGroup>
        {isCredit && paymentPreview && (
          <p style={{ margin: '0 0 14px', fontSize: 'var(--text-sm)', color: 'var(--q25-text)', fontWeight: 600 }}>
            Se paga el {shortDate(paymentPreview)}
          </p>
        )}

        <Field label="Fecha" htmlFor="tx-fecha">
          <input
            id="tx-fecha"
            type="date"
            value={value.date}
            onChange={(e) => setValue((v) => ({ ...v, date: e.target.value }))}
            style={inputStyle}
          />
        </Field>

        <button
          type="button"
          onClick={() => setValue((v) => ({ ...v, markPaidNow: !v.markPaidNow }))}
          aria-pressed={value.markPaidNow}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            minHeight: 'var(--tap)', padding: '0 4px', margin: '10px 0 20px', background: 'none',
            border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 'var(--text-base)',
          }}
        >
          <span>{isIncome ? 'Ya lo recibiste' : isCredit ? 'Ya pagaste el extracto' : 'Ya está pagado'}</span>
          <span
            aria-hidden
            style={{
              width: 44, height: 26, borderRadius: 13, background: value.markPaidNow ? 'var(--positive)' : 'var(--surface-sunken)',
              border: '1px solid var(--line)', position: 'relative', transition: 'background var(--dur-fast)',
            }}
          >
            <span style={{
              position: 'absolute', top: 2, left: value.markPaidNow ? 21 : 2, width: 20, height: 20,
              borderRadius: 10, background: '#fff', boxShadow: '0 1px 3px rgb(0 0 0/.3)', transition: 'left var(--dur-fast) var(--ease-spring-out)',
            }} />
          </span>
        </button>

        <button type="button" onClick={handleSubmit} disabled={!canSave} style={saveButtonStyle(canSave)}>
          Guardar
        </button>

        {existing && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {onDuplicate && (
              <button type="button" onClick={onDuplicate} style={secondaryButtonStyle}>Duplicar</button>
            )}
            {onDelete && (
              <button type="button" onClick={onDelete} style={{ ...secondaryButtonStyle, color: 'var(--danger-text)' }}>
                Eliminar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', minHeight: 'var(--tap)', padding: '0 12px', marginBottom: 14,
  borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: 16,
};
const errorText: React.CSSProperties = { margin: '-10px 0 10px', fontSize: 'var(--text-xs)', color: 'var(--danger-text)' };

function segmentStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, minWidth: 90, minHeight: 'var(--tap)', borderRadius: 'var(--radius-s)',
    border: '1px solid var(--line-strong)', background: active ? 'var(--text)' : 'var(--surface)',
    color: active ? 'var(--surface)' : 'var(--text)', fontWeight: 600, cursor: 'pointer',
    fontSize: 'var(--text-base)',
    transition: 'all var(--dur-fast) var(--ease-spring-out)',
  };
}
function saveButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    width: '100%', minHeight: 48, borderRadius: 'var(--radius-s)', border: 'none',
    background: enabled ? 'var(--q10)' : 'var(--surface-sunken)',
    color: enabled ? '#fff' : 'var(--text-faint)',
    fontWeight: 700, fontSize: 16, cursor: enabled ? 'pointer' : 'not-allowed',
    transition: 'background var(--dur-fast) var(--ease-spring-out)',
  };
}
const secondaryButtonStyle: React.CSSProperties = {
  flex: 1, minHeight: 44, borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)',
  background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer',
  fontSize: 'var(--text-base)',
};
