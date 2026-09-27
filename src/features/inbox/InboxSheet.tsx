import { IconBolt, IconMessage, IconMicrophone, type IconProps } from '@tabler/icons-react';
import type { ComponentType } from 'react';
import { useMemo, useState } from 'react';
import { useDialogo } from '@/components/ui/useDialogo';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { localRepository, DEFAULT_SETTINGS } from '@/data/local/localRepository';
import { cerrarEntrada, type EntradaBandeja } from '@/data/supabase/inbox';
import { calculateCreditCardCycle } from '@/domain/credit-card/cycle';
import { describir } from '@/domain/nlp/describe';
import { interpretarTexto } from '@/domain/nlp/interpretar';
import type { Transaction } from '@/domain/types';
import { haptic } from '@/lib/haptic';
import { nowISO, todayISO } from '@/lib/todayISO';
import { VACIO } from '@/lib/vacio';

const ICONO_ORIGEN: Record<string, ComponentType<IconProps>> = {
  sms: IconMessage,
  dictado: IconMicrophone,
  atajo: IconBolt,
};

/**
 * Lo que llegó solo, esperando un toque.
 *
 * Confirmar en vez de guardar directo es a propósito: lo que entra acá lo
 * escribió un banco, no el usuario. Un monto mal leído que se guarda sin
 * que nadie lo mire es peor que teclearlo.
 */
export function InboxSheet({ entradas, onClose, onCambio }: {
  entradas: EntradaBandeja[];
  onClose: () => void;
  onCambio: () => void;
}) {
  const [procesando, setProcesando] = useState<string | null>(null);

  const settings = useLiveQuery(() => localRepository.getSettings(), []) ?? DEFAULT_SETTINGS;
  const categorias = useLiveQuery(() => localRepository.listCategories(), []) ?? VACIO;
  const metodos = useLiveQuery(() => localRepository.listPaymentMethods(), []) ?? VACIO;
  const conceptIndex = useLiveQuery(() => db.conceptIndex.toArray(), []) ?? VACIO;
  const hoy = todayISO();
  const idsCategorias = useMemo(() => categorias.map((c) => c.id), [categorias]);

  function interpretar(entrada: EntradaBandeja) {
    // Misma interpretación que la entrada rápida y el enlace del Atajo.
    const { parsed, categoryId, paymentMethodId, vieneDeAprendizaje } = interpretarTexto(entrada.texto, hoy, {
      conceptIndex,
      idsCategorias,
      metodos,
      metodoPorDefecto: settings.defaultPaymentMethodId ?? null,
    });
    const desc = describir(parsed, {
      hoy, categoryId, categorias, paymentMethodId, metodos,
      aprendida: vieneDeAprendizaje,
    });
    return { parsed, categoryId, paymentMethodId, desc };
  }

  async function anotar(entrada: EntradaBandeja) {
    const { parsed, categoryId, paymentMethodId } = interpretar(entrada);
    if (parsed.amount == null || !parsed.concept) return;

    setProcesando(entrada.id);
    try {
      const metodo = metodos.find((m) => m.id === paymentMethodId);
      const ciclo = metodo?.type === 'credit'
        ? calculateCreditCardCycle(parsed.date, metodo.cutoffDay, metodo.paymentDay)
        : null;
      const ahora = nowISO();
      const tx: Transaction = {
        id: crypto.randomUUID(),
        type: parsed.type,
        concept: parsed.concept,
        amount: parsed.amount,
        date: parsed.date,
        categoryId,
        paymentMethodId,
        status: parsed.yaOcurrio ? 'paid' : 'pending',
        quincenaKey: null,
        cycleCutoffDate: ciclo?.cycleCutoff,
        cyclePaymentDate: ciclo?.paymentDate,
        createdAt: ahora,
        updatedAt: ahora,
      };
      await localRepository.saveTransaction(tx);
      await cerrarEntrada(entrada.id, 'done');
      haptic('medium');
      onCambio();
    } finally {
      setProcesando(null);
    }
  }

  async function descartar(entrada: EntradaBandeja) {
    setProcesando(entrada.id);
    try {
      await cerrarEntrada(entrada.id, 'discarded');
      haptic('light');
      onCambio();
    } finally {
      setProcesando(null);
    }
  }

  const refDialogo = useDialogo(onClose);
  return (
    <div
      ref={refDialogo}
      role="dialog"
      aria-label="Por confirmar"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'color-mix(in srgb, black 40%, transparent)',
        display: 'flex', alignItems: 'flex-end', zIndex: 60,
        animation: 'fadeIn var(--dur-fast) var(--ease-spring-out)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, margin: '0 auto', background: 'var(--surface)',
          borderRadius: '20px 20px 0 0', padding: '10px 20px calc(var(--safe-bottom) + 20px)',
          maxHeight: '88vh', overflowY: 'auto',
          animation: 'slideUp var(--dur-med) var(--ease-spring-out)',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '4px auto 14px' }} />
        <h2 style={{ margin: '0 0 4px', fontSize: 'var(--text-lg)', fontWeight: 700 }}>Llegaron solos</h2>
        <p style={{ margin: '0 0 16px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          Revisa el monto antes de anotarlo. Lo escribió tu banco, no tú.
        </p>

        {entradas.length === 0 && (
          <p style={{ color: 'var(--text-faint)', fontSize: 'var(--text-sm)' }}>Nada pendiente.</p>
        )}

        {entradas.map((e) => {
          const { parsed, desc } = interpretar(e);
          const completo = parsed.amount != null && parsed.concept.length > 0;
          const ocupado = procesando === e.id;
          return (
            <div
              key={e.id}
              style={{
                border: '1px solid var(--line)', borderRadius: 'var(--radius-m)',
                padding: '12px 14px', marginBottom: 10, background: 'var(--surface)',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 6 }}>
                {(() => { const I = ICONO_ORIGEN[e.origen] ?? IconBolt; return <I size={17} stroke={1.75} aria-hidden />; })()}
                <span style={{ flex: 1, fontSize: 'var(--text-md)', fontWeight: 600 }}>{desc.resumen}</span>
              </div>
              {desc.falta && (
                <p style={{ margin: '0 0 6px', fontSize: 'var(--text-sm)', color: 'var(--danger-text)' }}>
                  {desc.falta} No pude sacarlo del mensaje.
                </p>
              )}
              {desc.nota && !desc.falta && (
                <p style={{ margin: '0 0 6px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{desc.nota}</p>
              )}
              <details style={{ marginBottom: 10 }}>
                <summary style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)', cursor: 'pointer' }}>
                  Ver el mensaje original
                </summary>
                <p style={{ margin: '6px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', wordBreak: 'break-word' }}>
                  {e.texto}
                </p>
              </details>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => anotar(e)}
                  disabled={!completo || ocupado}
                  style={{
                    flex: 1, minHeight: 44, borderRadius: 'var(--radius-s)', border: 'none',
                    background: completo ? 'var(--q10)' : 'var(--surface-sunken)',
                    color: completo ? '#fff' : 'var(--text-faint)',
                    fontWeight: 700, cursor: completo ? 'pointer' : 'not-allowed',
                    fontSize: 'var(--text-base)',
                  }}
                >
                  {ocupado ? '…' : 'Anotar'}
                </button>
                <button
                  type="button"
                  onClick={() => descartar(e)}
                  disabled={ocupado}
                  style={{
                    flex: 'none', minWidth: 110, minHeight: 44, borderRadius: 'var(--radius-s)',
                    border: '1px solid var(--line-strong)', background: 'var(--surface)',
                    color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer',
                    fontSize: 'var(--text-base)',
                  }}
                >
                  Descartar
                </button>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%', marginTop: 8, minHeight: 44, borderRadius: 'var(--radius-s)',
            border: 'none', background: 'var(--surface-sunken)', color: 'var(--text)',
            fontWeight: 600, fontSize: 'var(--text-base)', cursor: 'pointer',
          }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
