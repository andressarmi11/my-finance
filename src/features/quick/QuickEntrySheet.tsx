import { CategoryAvatar, CategoryIcon } from '@/components/ui/CategoryIcon';
import { relativeDayLabel } from '@/components/ui/MiniCalendar';
import { fill } from '@/lib/dateLabels';
import { UNCATEGORIZED_COLOR } from '@/domain/seed/categoryColor';
import { IconMicrophone, IconPlayerStopFilled } from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDialogo } from '@/components/ui/useDialogo';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { localRepository, DEFAULT_SETTINGS } from '@/data/local/localRepository';
import { calculateCreditCardCycle } from '@/domain/credit-card/cycle';
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
import { CURRENCIES, convert, formatMoneyIn, quickCurrencyList } from '@/lib/currencies';
import { useFxRate } from '@/lib/fxRates';
import { FxLine } from '@/features/transactions/TransactionForm';

const EXAMPLES = [
  'gasté 45 mil en el almuerzo',
  'pagué 20 dólares de netflix con tarjeta',
  'uber 18 mil en efectivo',
  'me entraron 300 mil',
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
  const fx = useFxRate(currency, mainCurrency);
  const fxRate = fx.status === 'same' ? 1 : fx.status === 'ready' ? fx.rate : null;
  const amount = parsed.amount != null && fxRate != null ? convert(parsed.amount, fxRate) : null;

  // Whatever the user picks here wins over what was proposed.
  const categoryId = categoriaElegida !== undefined ? categoriaElegida : read.categoryId;


  const canSubmit = amount != null && amount > 0 && parsed.concept.length > 0;

  // The card's pieces, in the interface's language (describeParsed stays
  // as it is for its other callers; only its facts are reused here).
  const chosenCat = cats.find((c) => c.id === categoryId);
  const chosenMethodRow = methodRows.find((m) => m.id === paymentMethodId);
  const missing = parsed.amount == null ? t('quick.missingAmount') : !parsed.concept ? t('quick.missingConcept') : null;
  const note = chosenCat
    ? fill(read.fromLearning && categoryId === read.categoryId ? t('quick.putInLearned') : t('quick.putIn'), { category: chosenCat.name })
    : parsed.concept ? t('quick.noCategory') : null;
  const dayWord = (iso: string) => {
    const label = relativeDayLabel(iso, today, t);
    // "hoy", "ayer" mid-sentence; a date ("3 Oct") keeps its capital.
    return /^\d/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1);
  };

  function resetCorrections() {
    setCategoriaElegida(undefined);
    setChosenCurrency(undefined);
    setChosenMethod(undefined);
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
          borderRadius: '28px 28px 0 0', padding: '10px 16px calc(var(--safe-bottom) + 26px)',
          maxHeight: '92vh', overflowY: 'auto',
          animation: 'slideUp var(--dur-med) var(--ease-spring-out)',
        }}
      >
        <div style={{ width: 36, height: 5, borderRadius: 3, background: 'var(--handle)', margin: '0 auto 8px' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
          <button type="button" onClick={onClose} style={{ ...textButton, justifySelf: 'start' }}>{t('action.cancel')}</button>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t('quick.tellTheApp')}</h2>
          <span />
        </div>

        {/* The mic is the main action: big and centred, with what to do under it. */}
        {hasDictation() && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '18px 0 12px' }}>
            <button
              type="button"
              onClick={dictate}
              aria-label={escuchando ? t('quick.stopListening') : t('quick.dictate')}
              aria-pressed={escuchando}
              style={{
                width: 72, height: 72, borderRadius: 36, border: 'none', display: 'grid', placeItems: 'center',
                background: escuchando ? 'var(--danger)' : 'var(--q10)',
                color: 'var(--on-accent)', cursor: 'pointer',
                boxShadow: escuchando
                  ? '0 0 0 10px color-mix(in srgb, var(--danger) 18%, transparent)'
                  : '0 8px 24px color-mix(in srgb, var(--q10) 30%, transparent)',
                transition: 'all 0.25s',
              }}
            >
              {escuchando
                ? <IconPlayerStopFilled size={28} aria-hidden />
                : <IconMicrophone size={30} stroke={2} aria-hidden />}
            </button>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {escuchando ? t('quick.listening') : t('quick.tapToSpeak')}
            </span>
          </div>
        )}

        <input
          ref={inputRef}
          value={text}
          onChange={(e) => { setTexto(e.target.value); resetCorrections(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) void save(); }}
          placeholder={t('quick.placeholder')}
          aria-label={t('quick.whatHappened')}
          autoFocus
          style={{
            width: '100%', height: 46, padding: '0 14px', marginTop: hasDictation() ? 0 : 14,
            borderRadius: 14, border: '1px solid var(--line-strong)', outline: 'none',
            background: 'var(--paper)', color: 'var(--text)', fontSize: 16,
          }}
        />

        {/* Examples until there's something typed: then the card takes their place. */}
        {!understood && <div
          role="group"
          aria-label={t('quick.forExample')}
          className="noscroll"
          style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', margin: '8px -16px 0', padding: '0 16px' }}
        >
          {EXAMPLES.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => { setTexto(e); resetCorrections(); }}
              style={{
                flex: 'none', height: 30, padding: '0 12px', borderRadius: 15, whiteSpace: 'nowrap',
                border: 'none', background: 'var(--surface-sunken)',
                color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
              }}
            >
              {e}
            </button>
          ))}
        </div>}

        {/* What the app understood, before anything is saved: the row it
            will become (prototype 1a). */}
        {understood && (
          <section
            aria-label={t('quick.understood')}
            style={{ marginTop: 14, background: 'var(--paper)', borderRadius: 18, padding: '12px 14px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CategoryAvatar
                icon={chosenCat?.icon ?? (parsed.type === 'income' ? 'salary' : 'other')}
                color={chosenCat ? categoryColor(chosenCat) : UNCATEGORIZED_COLOR}
                size={38}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {parsed.concept || chosenCat?.name || (parsed.type === 'income' ? t('quick.income') : t('quick.expense'))}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[chosenCat?.name ?? (parsed.type === 'income' ? t('quick.income') : t('quick.expense')), dayWord(parsed.date), chosenMethodRow?.name]
                    .filter(Boolean).join(' · ')}
                </span>
              </span>
              {parsed.amount != null && (
                <span className="figures" style={{ flex: 'none', fontWeight: 700, fontSize: 16, color: parsed.type === 'income' ? 'var(--positive-text)' : 'var(--text)' }}>
                  {parsed.type === 'income' ? '+ ' : ''}{formatMoneyIn(parsed.amount, currency)}
                </span>
              )}
            </div>
            {isForeign && <div style={{ marginTop: 6 }}><FxLine fx={fx} amount={amount} main={mainCurrency} align="left" compact /></div>}
            {(missing || note) && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: missing ? 'var(--danger-text)' : 'var(--text-muted)' }}>
                {missing ?? note}
              </p>
            )}
          </section>
        )}

        {/* The same chips as the full sheet, to correct it in place. */}
        {understood && parsed.concept && (
          <>
            <div style={{ height: 14 }} />
            <CurrencyChips
              value={currency}
              quick={quickCurrencyList(mainCurrency, settings.quickCurrencies)}
              onChange={setChosenCurrency}
            />
            <div className="noscroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -16px 12px', padding: '0 16px' }}>
              {visibleCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { haptic('light'); setCategoriaElegida(c.id); }}
                  aria-pressed={categoryId === c.id}
                  style={{
                    flex: 'none', display: 'flex', alignItems: 'center', gap: 6,
                    height: 36, padding: '0 12px 0 8px', borderRadius: 18,
                    border: `1px solid ${categoryId === c.id ? categoryColor(c) : 'var(--line)'}`,
                    background: categoryId === c.id ? `color-mix(in srgb, ${categoryColor(c)} 18%, var(--surface))` : 'var(--paper)',
                    color: 'var(--text)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ display: 'flex', color: categoryColor(c) }}><CategoryIcon icon={c.icon} size={16} /></span>{c.name}
                </button>
              ))}
            </div>
            <MethodPicker inset methods={visibleMethods} value={paymentMethodId} onChange={setChosenMethod} />
          </>
        )}

        {error && <p role="alert" style={{ margin: '0 0 12px', fontSize: 'var(--text-sm)', color: 'var(--danger-text)' }}>{error}</p>}
        {stored && <p role="status" style={{ margin: '0 0 12px', fontSize: 'var(--text-sm)', color: 'var(--positive-text)', fontWeight: 600 }}>{stored}</p>}

        {understood && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
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
              height: 48, borderRadius: 14, border: 'none',
              background: canSubmit ? 'var(--q10)' : 'var(--surface-sunken)',
              color: canSubmit ? 'var(--on-accent)' : 'var(--text-faint)',
              fontWeight: 700, fontSize: 15, cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {t('action.save')}
          </button>
        </div>
        )}
      </div>
    </div>
  );
}

const textButton: React.CSSProperties = {
  minHeight: 'var(--tap)', padding: '0 2px', border: 'none', background: 'none',
  color: 'var(--q10-text)', fontSize: 16, cursor: 'pointer',
};

const secondary: React.CSSProperties = {
  height: 48, borderRadius: 14, border: '1px solid var(--line-strong)',
  background: 'transparent', color: 'var(--text)', fontWeight: 600, cursor: 'pointer',
  fontSize: 15,
};
