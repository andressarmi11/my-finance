import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { IconMicrophone, IconPlayerStopFilled } from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDialogo } from '@/components/ui/useDialogo';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { localRepository, DEFAULT_SETTINGS } from '@/data/local/localRepository';
import { calculateCreditCardCycle } from '@/domain/credit-card/cycle';
import { describeParsed } from '@/domain/nlp/describe';
import { interpretText } from '@/domain/nlp/interpret';
import { formatMoney } from '@/domain/money/format';
import type { Transaction } from '@/domain/types';
import { categoryColor } from '@/domain/seed/categoryColor';
import { listen, hasDictation, type Recognizer } from '@/lib/speech';
import { haptic } from '@/lib/haptic';
import { nowISO, todayISO } from '@/lib/todayISO';
import { EMPTY } from '@/lib/empty';
import { useT } from '@/i18n/language';

const EXAMPLES = [
  'gasté 45 mil en el almuerzo',
  'pagué 120 mil de mercado con la tarjeta',
  'me llegaron 2 millones de nómina',
  'gasté 20 mil en uber ayer',
];

/**
 * Telling the app what happened, by speaking or typing, in one line.
 *
 * Everything it understands comes from domain/nlp: deterministic and
 * offline. What it learns comes from the user's history — if they correct
 * the category here, next time they say that same concept it comes out
 * right, because saving updates the concept index.
 */
export function QuickEntrySheet({ onClose, onAdjust }: {
  onClose: () => void;
  /** Opens the full form with what's already been understood. */
  onAdjust: (text: string) => void;
}) {
  const t = useT();
  const [text, setTexto] = useState('');
  const [escuchando, setEscuchando] = useState(false);
  const [error, setError] = useState('');
  const [stored, setSaved] = useState<string | null>(null);
  const [categoriaElegida, setCategoriaElegida] = useState<string | null | undefined>(undefined);
  const recRef = useRef<Recognizer | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const settings = useLiveQuery(() => localRepository.getSettings(), []) ?? DEFAULT_SETTINGS;
  const cats = useLiveQuery(() => localRepository.listCategories(), []) ?? EMPTY;
  const methodRows = useLiveQuery(() => localRepository.listPaymentMethods(), []) ?? EMPTY;
  const conceptIndex = useLiveQuery(() => db.conceptIndex.toArray(), []) ?? EMPTY;

  const today = todayISO();
  // Same interpretation as the inbox and the Shortcut link.
  const read = useMemo(
    () => interpretText(text, today, {
      conceptIndex,
      categoryIds: cats.map((c) => c.id),
      methodRows,
      defaultMethodId: settings.defaultPaymentMethodId ?? null,
    }),
    [text, today, conceptIndex, cats, methodRows, settings.defaultPaymentMethodId],
  );
  const { parsed, paymentMethodId } = read;

  // Whatever the user picks here wins over what was proposed.
  const categoryId = categoriaElegida !== undefined ? categoriaElegida : read.categoryId;

  const desc = describeParsed(parsed, {
    today,
    categoryId,
    cats,
    paymentMethodId,
    methodRows,
    learned: read.fromLearning && categoryId === read.categoryId,
  });

  const canSubmit = parsed.amount != null && parsed.amount > 0 && parsed.concept.length > 0;

  useEffect(() => () => recRef.current?.stop(), []);

  function dictate() {
    setError('');
    if (escuchando) {
      recRef.current?.stop();
      return;
    }
    haptic('light');
    setEscuchando(true);
    const rec = listen({
      lang: settings.locale || 'es-CO',
      onText: (t) => setTexto(t),
      onError: (m) => { setError(m); setEscuchando(false); },
      onEnd: () => setEscuchando(false),
    });
    if (!rec) {
      setEscuchando(false);
      setError(t('quick.noDictation'));
      inputRef.current?.focus();
      return;
    }
    recRef.current = rec;
  }

  async function save() {
    if (!canSubmit || parsed.amount == null) return;
    const method = methodRows.find((m) => m.id === paymentMethodId);
    const cycle = method?.type === 'credit'
      ? calculateCreditCardCycle(parsed.date, method.cutoffDay, method.paymentDay)
      : null;

    const now = nowISO();
    const tx: Transaction = {
      id: crypto.randomUUID(),
      type: parsed.type,
      concept: parsed.concept,
      amount: parsed.amount,
      date: parsed.date,
      categoryId,
      paymentMethodId,
      // If it already happened, it happened: what you say out loud is something you did.
      status: parsed.yaOcurrio ? 'paid' : 'pending',
      quincenaKey: null,
      cycleCutoffDate: cycle?.cycleCutoff,
      cyclePaymentDate: cycle?.paymentDate,
      createdAt: now,
      updatedAt: now,
    };
    await localRepository.saveTransaction(tx);
    haptic('medium');
    setSaved(t('quick.savedAs')
      .replace('{amount}', formatMoney(parsed.amount))
      .replace('{concept}', parsed.concept));
    setTexto('');
    setCategoriaElegida(undefined);
    setTimeout(() => setSaved(null), 2600);
    inputRef.current?.focus();
  }

  const visibleCategories = cats.filter(
    (c) => c.kind === 'both' || c.kind === parsed.type,
  );

  const dialogRef = useDialogo(onClose);
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label={t('quick.tellTheApp')}
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

        <h2 style={{ margin: '0 0 4px', fontSize: 'var(--text-lg)', fontWeight: 700 }}>{t('quick.title')}</h2>
        <p style={{ margin: '0 0 14px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          {t('quick.subtitle')}
        </p>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => { setTexto(e.target.value); setCategoriaElegida(undefined); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) void save(); }}
            placeholder={EXAMPLES[0]}
            aria-label={t('quick.whatHappened')}
            autoFocus
            style={{
              flex: 1, minWidth: 0, minHeight: 'var(--tap)', padding: '0 14px',
              borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)',
              background: 'var(--surface)', color: 'var(--text)', fontSize: 16,
            }}
          />
          {hasDictation() && (
            <button
              type="button"
              onClick={dictate}
              aria-label={escuchando ? 'Dejar de escuchar' : 'Dictar'}
              aria-pressed={escuchando}
              style={{
                width: 48, height: 48, flex: 'none', borderRadius: 24, border: 'none',
                background: escuchando ? 'var(--danger)' : 'var(--q10)',
                color: 'var(--on-accent)', fontSize: 20, cursor: 'pointer',
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

        {text.trim().length > 0 && (
          <div
            style={{
              background: 'var(--surface-sunken)', borderRadius: 'var(--radius-m)',
              padding: '12px 14px', marginBottom: 12,
            }}
          >
            <p style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 600 }}>{desc.summary}</p>
            {desc.missing && (
              <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)', color: 'var(--danger-text)' }}>{desc.missing}</p>
            )}
            {desc.note && !desc.missing && (
              <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{desc.note}</p>
            )}
          </div>
        )}

        {text.trim().length > 0 && parsed.concept && (
          <>
            <p style={{ margin: '0 0 6px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              {t('form.category')}
            </p>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
              {visibleCategories.map((c) => (
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
                  <CategoryIcon icon={c.icon} size={15} />{c.name}
                </button>
              ))}
            </div>
          </>
        )}

        {text.trim().length === 0 && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ margin: '0 0 8px', fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>Por ejemplo:</p>
            {EXAMPLES.map((e) => (
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
        {stored && <p role="status" style={{ margin: '0 0 12px', fontSize: 'var(--text-sm)', color: 'var(--positive-text)', fontWeight: 600 }}>{stored}</p>}

        <button
          type="button"
          onClick={save}
          disabled={!canSubmit}
          style={{
            width: '100%', minHeight: 48, borderRadius: 'var(--radius-s)', border: 'none',
            background: canSubmit ? 'var(--q10)' : 'var(--surface-sunken)',
            color: canSubmit ? 'var(--on-accent)' : 'var(--text-faint)',
            fontWeight: 700, fontSize: 16, cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          Guardar
        </button>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            type="button"
            onClick={() => onAdjust(text)}
            disabled={text.trim().length === 0}
            style={secondary}
          >
            Ajustar todo
          </button>
          <button type="button" onClick={onClose} style={secondary}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

const secondary: React.CSSProperties = {
  flex: 1, minHeight: 44, borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)',
  background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer',
  fontSize: 'var(--text-base)',
};
