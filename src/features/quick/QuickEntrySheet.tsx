import { IconMicrophone, IconPlayerStopFilled } from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDialogo } from '@/components/ui/useDialogo';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { localRepository, DEFAULT_SETTINGS } from '@/data/local/localRepository';
import { calculateCreditCardCycle } from '@/domain/credit-card/cycle';
import { describir } from '@/domain/nlp/describe';
import { interpretarTexto } from '@/domain/nlp/interpretar';
import { formatMoney } from '@/domain/money/format';
import type { Transaction } from '@/domain/types';
import { categoryColor } from '@/domain/seed/categoryColor';
import { escuchar, hayDictado, type Reconocedor } from '@/lib/speech';
import { haptic } from '@/lib/haptic';
import { nowISO, todayISO } from '@/lib/todayISO';
import { VACIO } from '@/lib/vacio';

const EJEMPLOS = [
  'gasté 45 mil en el almuerzo',
  'pagué 120 mil de mercado con la tarjeta',
  'me llegaron 2 millones de nómina',
  'gasté 20 mil en uber ayer',
];

/**
 * Contarle a la app lo que pasó, hablando o escribiendo, en una línea.
 *
 * Todo lo que entiende sale de domain/nlp: determinístico y sin conexión.
 * Lo que aprende sale del historial del usuario — si corrige la categoría
 * acá, la próxima vez que diga ese mismo concepto ya sale bien, porque
 * guardar actualiza el índice de conceptos.
 */
export function QuickEntrySheet({ onClose, onAjustar }: {
  onClose: () => void;
  /** Abre el formulario completo con lo ya entendido. */
  onAjustar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState('');
  const [escuchando, setEscuchando] = useState(false);
  const [error, setError] = useState('');
  const [guardado, setGuardado] = useState<string | null>(null);
  const [categoriaElegida, setCategoriaElegida] = useState<string | null | undefined>(undefined);
  const recRef = useRef<Reconocedor | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const settings = useLiveQuery(() => localRepository.getSettings(), []) ?? DEFAULT_SETTINGS;
  const categorias = useLiveQuery(() => localRepository.listCategories(), []) ?? VACIO;
  const metodos = useLiveQuery(() => localRepository.listPaymentMethods(), []) ?? VACIO;
  const conceptIndex = useLiveQuery(() => db.conceptIndex.toArray(), []) ?? VACIO;

  const hoy = todayISO();
  // Misma interpretación que la bandeja y el enlace del Atajo.
  const leido = useMemo(
    () => interpretarTexto(texto, hoy, {
      conceptIndex,
      idsCategorias: categorias.map((c) => c.id),
      metodos,
      metodoPorDefecto: settings.defaultPaymentMethodId ?? null,
    }),
    [texto, hoy, conceptIndex, categorias, metodos, settings.defaultPaymentMethodId],
  );
  const { parsed, paymentMethodId } = leido;

  // Lo que el usuario elija acá manda por encima de lo propuesto.
  const categoryId = categoriaElegida !== undefined ? categoriaElegida : leido.categoryId;

  const desc = describir(parsed, {
    hoy,
    categoryId,
    categorias,
    paymentMethodId,
    metodos,
    aprendida: leido.vieneDeAprendizaje && categoryId === leido.categoryId,
  });

  const puedeGuardar = parsed.amount != null && parsed.amount > 0 && parsed.concept.length > 0;

  useEffect(() => () => recRef.current?.stop(), []);

  function dictar() {
    setError('');
    if (escuchando) {
      recRef.current?.stop();
      return;
    }
    haptic('light');
    setEscuchando(true);
    const rec = escuchar({
      lang: settings.locale || 'es-CO',
      onTexto: (t) => setTexto(t),
      onError: (m) => { setError(m); setEscuchando(false); },
      onFin: () => setEscuchando(false),
    });
    if (!rec) {
      setEscuchando(false);
      setError('Este navegador no deja dictar. Escríbelo y funciona igual.');
      inputRef.current?.focus();
      return;
    }
    recRef.current = rec;
  }

  async function guardar() {
    if (!puedeGuardar || parsed.amount == null) return;
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
      // Si ya pasó, ya pasó: lo que uno cuenta hablando es algo que hizo.
      status: parsed.yaOcurrio ? 'paid' : 'pending',
      quincenaKey: null,
      cycleCutoffDate: ciclo?.cycleCutoff,
      cyclePaymentDate: ciclo?.paymentDate,
      createdAt: ahora,
      updatedAt: ahora,
    };
    await localRepository.saveTransaction(tx);
    haptic('medium');
    setGuardado(`Anotado: ${formatMoney(parsed.amount)} en ${parsed.concept}.`);
    setTexto('');
    setCategoriaElegida(undefined);
    setTimeout(() => setGuardado(null), 2600);
    inputRef.current?.focus();
  }

  const categoriasVisibles = categorias.filter(
    (c) => c.kind === 'both' || c.kind === parsed.type,
  );

  const refDialogo = useDialogo(onClose);
  return (
    <div
      ref={refDialogo}
      role="dialog"
      aria-label="Contale a la app"
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
          maxHeight: '92vh', overflowY: 'auto',
          animation: 'slideUp var(--dur-med) var(--ease-spring-out)',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '4px auto 14px' }} />

        <h2 style={{ margin: '0 0 4px', fontSize: 'var(--text-lg)', fontWeight: 700 }}>Cuéntame</h2>
        <p style={{ margin: '0 0 14px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          Dilo como te salga. Yo lo acomodo.
        </p>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <input
            ref={inputRef}
            value={texto}
            onChange={(e) => { setTexto(e.target.value); setCategoriaElegida(undefined); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && puedeGuardar) void guardar(); }}
            placeholder={EJEMPLOS[0]}
            aria-label="Qué pasó"
            autoFocus
            style={{
              flex: 1, minWidth: 0, minHeight: 'var(--tap)', padding: '0 14px',
              borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)',
              background: 'var(--surface)', color: 'var(--text)', fontSize: 16,
            }}
          />
          {hayDictado() && (
            <button
              type="button"
              onClick={dictar}
              aria-label={escuchando ? 'Dejar de escuchar' : 'Dictar'}
              aria-pressed={escuchando}
              style={{
                width: 48, height: 48, flex: 'none', borderRadius: 24, border: 'none',
                background: escuchando ? 'var(--danger)' : 'var(--q10)',
                color: '#fff', fontSize: 20, cursor: 'pointer',
                animation: escuchando ? 'fadeIn 0.6s ease-in-out infinite alternate' : undefined,
              }}
            >
              {escuchando
                ? <IconPlayerStopFilled size={26} aria-hidden />
                : <IconMicrophone size={26} stroke={1.9} aria-hidden />}
            </button>
          )}
        </div>

        {escuchando && (
          <p style={{ margin: '0 0 12px', fontSize: 'var(--text-sm)', color: 'var(--q10-text)', fontWeight: 600 }}>
            Te escucho…
          </p>
        )}

        {texto.trim().length > 0 && (
          <div
            style={{
              background: 'var(--surface-sunken)', borderRadius: 'var(--radius-m)',
              padding: '12px 14px', marginBottom: 12,
            }}
          >
            <p style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 600 }}>{desc.resumen}</p>
            {desc.falta && (
              <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)', color: 'var(--danger-text)' }}>{desc.falta}</p>
            )}
            {desc.nota && !desc.falta && (
              <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{desc.nota}</p>
            )}
          </div>
        )}

        {texto.trim().length > 0 && parsed.concept && (
          <>
            <p style={{ margin: '0 0 6px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Categoría
            </p>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
              {categoriasVisibles.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { haptic('light'); setCategoriaElegida(c.id); }}
                  aria-pressed={categoryId === c.id}
                  style={{
                    flex: 'none', display: 'flex', alignItems: 'center', gap: 6,
                    minHeight: 'var(--tap)', padding: '0 12px', borderRadius: 999,
                    border: `1.5px solid ${categoryId === c.id ? categoryColor(c) : 'var(--line)'}`,
                    background: categoryId === c.id ? `color-mix(in srgb, ${categoryColor(c)} 16%, var(--surface))` : 'var(--surface)',
                    color: categoryId === c.id ? categoryColor(c) : 'var(--text)',
                    fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  <span aria-hidden>{c.icon}</span>{c.name}
                </button>
              ))}
            </div>
          </>
        )}

        {texto.trim().length === 0 && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ margin: '0 0 8px', fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>Por ejemplo:</p>
            {EJEMPLOS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setTexto(e)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', marginBottom: 6,
                  minHeight: 40, padding: '8px 12px', borderRadius: 'var(--radius-s)',
                  border: '1px solid var(--line)', background: 'var(--surface)',
                  color: 'var(--text-muted)', fontSize: 'var(--text-sm)', cursor: 'pointer',
                }}
              >
                “{e}”
              </button>
            ))}
          </div>
        )}

        {error && <p role="alert" style={{ margin: '0 0 12px', fontSize: 'var(--text-sm)', color: 'var(--danger-text)' }}>{error}</p>}
        {guardado && <p role="status" style={{ margin: '0 0 12px', fontSize: 'var(--text-sm)', color: 'var(--positive-text)', fontWeight: 600 }}>{guardado}</p>}

        <button
          type="button"
          onClick={guardar}
          disabled={!puedeGuardar}
          style={{
            width: '100%', minHeight: 48, borderRadius: 'var(--radius-s)', border: 'none',
            background: puedeGuardar ? 'var(--q10)' : 'var(--surface-sunken)',
            color: puedeGuardar ? '#fff' : 'var(--text-faint)',
            fontWeight: 700, fontSize: 16, cursor: puedeGuardar ? 'pointer' : 'not-allowed',
          }}
        >
          Guardar
        </button>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            type="button"
            onClick={() => onAjustar(texto)}
            disabled={texto.trim().length === 0}
            style={secundario}
          >
            Ajustar todo
          </button>
          <button type="button" onClick={onClose} style={secundario}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

const secundario: React.CSSProperties = {
  flex: 1, minHeight: 44, borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)',
  background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer',
  fontSize: 'var(--text-base)',
};
