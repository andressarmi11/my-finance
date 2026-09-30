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
import { CurrencyChips } from '@/components/ui/CurrencyChips';
import { MethodPicker } from '@/components/ui/MethodPicker';
import { fill } from '@/lib/dateLabels';
import { CURRENCIES, convert, formatRate, parseRate, quickCurrencyList, rememberRate, suggestedRate } from '@/lib/currencies';

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
  // Corrections to what was understood. undefined = take what the text says.
  const [chosenCurrency, setChosenCurrency] = useState<string | undefined>(undefined);
  const [chosenMethod, setChosenMethod] = useState<string | undefined>(undefined);
  const [fxRateText, setFxRateText] = useState('');
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
  const { parsed } = read;
  const paymentMethodId = chosenMethod ?? read.paymentMethodId;

  // Currency: what the user picked, else what the text named, else the main one.
  const mainCurrency = settings.currency;
  const currency = chosenCurrency ?? (parsed.currency && CURRENCIES.some((c) => c.code === parsed.currency) ? parsed.currency : mainCurrency);
  const isForeign = currency !== mainCurrency;
  const suggested = suggestedRate(currency, mainCurrency);
  const fxRate = isForeign ? (fxRateText ? parseRate(fxRateText) : suggested) : 1;
  const amount = parsed.amount != null && fxRate != null ? convert(parsed.amount, fxRate) : null;

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

  const canSubmit = amount != null && amount > 0 && parsed.concept.length > 0;

  function resetCorrections() {
    setCategoriaElegida(undefined);
    setChosenCurrency(undefined);
    setChosenMethod(undefined);
    setFxRateText('');
  }

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
    if (!canSubmit || parsed.amount == null || amount == null || fxRate == null) return;
    const method = methodRows.find((m) => m.id === paymentMethodId);
    const cycle = method?.type === 'credit'
      ? calculateCreditCardCycle(parsed.date, method.cutoffDay, method.paymentDay)
      : null;

    const now = nowISO();
    const tx: Transaction = {
      id: crypto.randomUUID(),
      type: parsed.type,
      concept: parsed.concept,
      amount,
      ...(isForeign ? { currency, originalAmount: parsed.amount, fxRate } : {}),
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
    if (isForeign) rememberRate(currency, mainCurrency, fxRate);
    haptic('medium');
    setSaved(t('quick.savedAs')
      .replace('{amount}', formatMoney(amount))
      .replace('{concept}', parsed.concept));
    setTexto('');
    resetCorrections();
    setTimeout(() => setSaved(null), 2600);
    inputRef.current?.focus();
  }

  const visibleCategories = cats.filter(
    (c) => c.kind === 'both' || c.kind === parsed.type,
  );
  const visibleMethods = methodRows.filter((m) => parsed.type !== 'income' || m.type !== 'credit');
  const understood = text.trim().length > 0;

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
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '4px auto 8px' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: 6 }}>
          <button type="button" onClick={onClose} style={{ ...textButton, justifySelf: 'start' }}>{t('action.close')}</button>
          <h2 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 700 }}>{t('quick.title')}</h2>
          <span />
        </div>
        <p style={{ margin: '0 0 14px', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          {t('quick.subtitle')}
        </p>

        {/* The mic is the main action: big and centred. */}
        {hasDictation() && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <button
              type="button"
              onClick={dictate}
              aria-label={escuchando ? t('quick.stopListening') : t('quick.dictate')}
              aria-pressed={escuchando}
              style={{
                width: 72, height: 72, borderRadius: 36, border: 'none', display: 'grid', placeItems: 'center',
                background: escuchando ? 'var(--danger)' : 'var(--q10)',
                color: 'var(--on-accent)', cursor: 'pointer',
                boxShadow: `0 10px 30px color-mix(in srgb, ${escuchando ? 'var(--danger)' : 'var(--q10)'} 35%, transparent)`,
                animation: escuchando ? 'fadeIn 0.6s ease-in-out infinite alternate' : undefined,
              }}
            >
              {escuchando
                ? <IconPlayerStopFilled size={30} aria-hidden />
                : <IconMicrophone size={32} stroke={1.9} aria-hidden />}
            </button>
            {escuchando && (
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--q10-text)', fontWeight: 600 }}>{t('quick.listening')}</span>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          value={text}
          onChange={(e) => { setTexto(e.target.value); resetCorrections(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) void save(); }}
          placeholder={EXAMPLES[0]}
          aria-label={t('quick.whatHappened')}
          autoFocus
          style={{
            width: '100%', minHeight: 'var(--tap)', padding: '0 14px', marginBottom: 12,
            borderRadius: 14, border: '1px solid var(--line-strong)',
            background: 'var(--surface-sunken)', color: 'var(--text)', fontSize: 16,
          }}
        />

        {!understood && (
          <div role="group" aria-label={t('quick.forExample')} style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, marginBottom: 14 }}>
            {EXAMPLES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setTexto(e)}
                style={{
                  flex: 'none', minHeight: 34, padding: '0 12px', borderRadius: 999, whiteSpace: 'nowrap',
                  border: '1px solid var(--line-strong)', background: 'transparent',
                  color: 'var(--text-muted)', fontSize: 'var(--text-sm)', cursor: 'pointer',
                }}
              >
                “{e}”
              </button>
            ))}
          </div>
        )}

        {/* "Entendí": the parser's reading, before anything is saved. */}
        {understood && (
          <div
            style={{
              background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 16,
              padding: '12px 14px', marginBottom: 12,
            }}
          >
            <p style={{ margin: '0 0 4px', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--q10-text)' }}>{t('quick.understood')}</p>
            <p style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 600 }}>{desc.summary}</p>
            {isForeign && (
              <p className="figures" style={{ margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                <span>
                  {parsed.amount != null ? `${formatMoney(parsed.amount, currency)} ${currency}` : ''}
                  {amount != null ? ` ${fill(t('form.fxApprox'), { amount: formatMoney(amount, mainCurrency), main: mainCurrency })}` : ''}
                </span>
                <span aria-hidden>·</span>
                <span>{t('form.fxRate')}</span>
                <input
                  value={fxRateText || (suggested ? formatRate(suggested) : '')}
                  onChange={(e) => setFxRateText(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 12))}
                  inputMode="decimal"
                  aria-label={fill(t('form.fxRateLabel'), { main: mainCurrency, currency })}
                  style={{
                    width: 76, minHeight: 30, padding: '0 8px', borderRadius: 8, textAlign: 'center',
                    border: '1px solid var(--line-strong)', background: 'var(--surface-sunken)', color: 'var(--text)',
                    fontSize: 16, fontWeight: 600,
                  }}
                />
              </p>
            )}
            {desc.missing && (
              <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)', color: 'var(--danger-text)' }}>{desc.missing}</p>
            )}
            {desc.note && !desc.missing && (
              <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{desc.note}</p>
            )}
          </div>
        )}

        {/* The same chips as the full sheet, to correct it in place. */}
        {understood && parsed.concept && (
          <>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 12 }}>
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
            <CurrencyChips
              value={currency}
              quick={quickCurrencyList(mainCurrency, settings.quickCurrencies)}
              onChange={(code) => { setChosenCurrency(code); setFxRateText(''); }}
            />
            <MethodPicker methods={visibleMethods} value={paymentMethodId} onChange={setChosenMethod} />
          </>
        )}

        {error && <p role="alert" style={{ margin: '0 0 12px', fontSize: 'var(--text-sm)', color: 'var(--danger-text)' }}>{error}</p>}
        {stored && <p role="status" style={{ margin: '0 0 12px', fontSize: 'var(--text-sm)', color: 'var(--positive-text)', fontWeight: 600 }}>{stored}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={() => onAdjust(text)}
            disabled={!understood}
            style={secondary}
          >
            {t('quick.adjust')}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!canSubmit}
            style={{
              flex: 1, minHeight: 48, borderRadius: 14, border: 'none',
              background: canSubmit ? 'var(--q10)' : 'var(--surface-sunken)',
              color: canSubmit ? 'var(--on-accent)' : 'var(--text-faint)',
              fontWeight: 700, fontSize: 16, cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {t('action.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

const textButton: React.CSSProperties = {
  minHeight: 'var(--tap)', padding: '0 2px', border: 'none', background: 'none',
  color: 'var(--q10-text)', fontSize: 'var(--text-md)', cursor: 'pointer',
};

const secondary: React.CSSProperties = {
  flex: 1, minHeight: 48, borderRadius: 14, border: '1px solid var(--line-strong)',
  background: 'transparent', color: 'var(--text)', fontWeight: 600, cursor: 'pointer',
  fontSize: 'var(--text-base)',
};
