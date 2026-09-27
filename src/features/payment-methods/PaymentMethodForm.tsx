import { useT } from '@/i18n/idioma';
import { useState } from 'react';
import { useDialogo } from '@/components/ui/useDialogo';
import { Field, FieldGroup } from '@/components/ui/Field';
import { parseMoney } from '@/domain/money/format';
import type { PaymentMethod, PaymentMethodType } from '@/domain/types';

const TIPOS: Array<{ id: PaymentMethodType; label: string }> = [
  { id: 'debit', label: 'Débito' },
  { id: 'credit', label: 'Crédito' },
  { id: 'cash', label: 'Efectivo' },
  { id: 'transfer', label: 'Transfer.' },
];

/**
 * Alta y edicion de un metodo de pago. El corte, el pago y el cupo solo
 * aparecen si el tipo es credito: son los tres campos que hacen que una
 * tarjeta sea SUYA y no una copia de la primera.
 *
 * No hay casilla de "por defecto" a proposito. Ese dato vive en
 * Settings.defaultPaymentMethodId, no aca — PaymentMethod.isDefault quedo
 * como campo heredado (ver domain/types.ts). Una casilla que escribiera
 * isDefault pareceria no hacer nada, porque Settings gana el ??.
 */
export function PaymentMethodForm({
  existing, onSave, onCancel, onDelete, movimientosAsociados }: {
  existing: PaymentMethod | null;
  onSave: (method: PaymentMethod) => void;
  onCancel: () => void;
  onDelete?: () => void;
  /** Cuantos movimientos quedarian sin metodo si se borra. */
  movimientosAsociados: number;
}) {
  const t = useT();
  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<PaymentMethodType>(existing?.type ?? 'credit');
  const [cutoffDay, setCutoffDay] = useState(String(existing?.cutoffDay ?? 15));
  const [paymentDay, setPaymentDay] = useState(String(existing?.paymentDay ?? 2));
  const [cupo, setCupo] = useState(existing?.creditLimit ? String(existing.creditLimit) : '');
  const [touched, setTouched] = useState(false);

  const esCredito = type === 'credit';
  const corte = Number(cutoffDay);
  const pago = Number(paymentDay);
  const diasValidos = !esCredito || (esDiaDelMes(corte) && esDiaDelMes(pago));
  const canSave = name.trim().length > 0 && diasValidos;

  function handleSubmit() {
    setTouched(true);
    if (!canSave) return;
    const limite = parseMoney(cupo);
    onSave({
      // crypto.randomUUID y nunca un slug fijo: la PK en Postgres es
      // (user_id, id), y un id repetido entre dispositivos colisiona.
      id: existing?.id ?? crypto.randomUUID(),
      type,
      name: name.trim(),
      isDefault: existing?.isDefault ?? false,
      ...(esCredito
        ? { cutoffDay: corte, paymentDay: pago, ...(limite && limite > 0 ? { creditLimit: limite } : {}) }
        : {}),
      // La fecha real la estampa localRepository; aca basta con el tipo.
      updatedAt: existing?.updatedAt ?? '',
    });
  }

  const refDialogo = useDialogo(onCancel);
  return (
    <div
      ref={refDialogo}
      role="dialog"
      aria-label={existing ? 'Editar método de pago' : 'Nuevo método de pago'}
      style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, black 40%, transparent)', display: 'flex', alignItems: 'flex-end', zIndex: 50 }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 560, margin: '0 auto', background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '10px 20px calc(var(--safe-bottom) + 20px)', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '4px auto 16px' }} />

        <Field label={t('form.nombre')} htmlFor="pm-nombre">
          <input id="pm-nombre" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Visa Bancolombia" style={inputStyle} />
        </Field>
        {touched && !name.trim() && <p style={errorStyle}>Ponle un nombre para distinguirla.</p>}

        <FieldGroup label="Tipo" id="pm-tipo" style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {TIPOS.map((t) => (
            <button key={t.id} type="button" onClick={() => setType(t.id)} aria-pressed={type === t.id} style={segmentStyle(type === t.id)}>
              {t.label}
            </button>
          ))}
        </FieldGroup>

        {esCredito && (
          <>
            <div style={{ display: 'flex', gap: 10 }}>
              <Field label="Día de corte" htmlFor="pm-corte">
                <input id="pm-corte" type="number" inputMode="numeric" min={1} max={31} value={cutoffDay}
                  onChange={(e) => setCutoffDay(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Día de pago" htmlFor="pm-pago">
                <input id="pm-pago" type="number" inputMode="numeric" min={1} max={31} value={paymentDay}
                  onChange={(e) => setPaymentDay(e.target.value)} style={inputStyle} />
              </Field>
            </div>
            {touched && !diasValidos && <p style={errorStyle}>El corte y el pago van entre 1 y 31.</p>}

            <Field label="Cupo (opcional)" htmlFor="pm-cupo">
              <input id="pm-cupo" inputMode="numeric" value={cupo} onChange={(e) => setCupo(e.target.value)}
                placeholder="$ 0" style={inputStyle} />
            </Field>
            <p style={hintStyle}>
              Si lo pones, la app te muestra cuánto te queda disponible. Se libera cuando marcas el ciclo como pagado.
            </p>
          </>
        )}

        <button type="button" onClick={handleSubmit} disabled={!canSave} style={saveButtonStyle(canSave)}>{t('accion.guardar')}</button>

        {existing && onDelete && (
          <>
            <button type="button" onClick={onDelete} style={deleteButtonStyle}>{t('accion.eliminar')}</button>
            {movimientosAsociados > 0 && (
              <p style={hintStyle}>
                {movimientosAsociados} {movimientosAsociados === 1 ? 'movimiento quedará' : 'movimientos quedarán'} sin
                método de pago. No se borran: la plata se gastó igual.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function esDiaDelMes(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 31;
}

const inputStyle: React.CSSProperties = { width: '100%', minHeight: 'var(--tap)', padding: '0 12px', marginBottom: 14, borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--text)', fontSize: 16 };
const errorStyle: React.CSSProperties = { margin: '-10px 0 10px', fontSize: 12, color: 'var(--danger-text)' };
const hintStyle: React.CSSProperties = { margin: '-6px 0 14px', fontSize: 12, color: 'var(--text-faint)' };
const deleteButtonStyle: React.CSSProperties = { width: '100%', minHeight: 44, marginTop: 10, marginBottom: 8, borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--danger-text)', fontWeight: 600, cursor: 'pointer' };
function segmentStyle(active: boolean): React.CSSProperties {
  return { flex: 1, minHeight: 'var(--tap)', borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)', background: active ? 'var(--text)' : 'var(--surface)', color: active ? 'var(--surface)' : 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 14 };
}
function saveButtonStyle(enabled: boolean): React.CSSProperties {
  return { width: '100%', minHeight: 48, borderRadius: 'var(--radius-s)', border: 'none', background: enabled ? 'var(--text)' : 'var(--surface-sunken)', color: enabled ? 'var(--surface)' : 'var(--text-faint)', fontWeight: 700, fontSize: 16, cursor: enabled ? 'pointer' : 'not-allowed' };
}
