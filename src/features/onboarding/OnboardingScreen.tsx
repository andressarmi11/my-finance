import { useState } from 'react';
import { localRepository } from '@/data/local/localRepository';
import { db } from '@/data/db';
import { CURRENCIES, currencySample } from '@/domain/money/currencies';
import { DEFAULT_CATEGORIES } from '@/domain/seed/defaultCategories';
import { setMoneyLocale, formatMoney } from '@/domain/money/format';
import { haptic } from '@/lib/haptic';
import { requestSync } from '@/data/sync/useCloudSync';
import type { Settings } from '@/domain/types';
import { categoryColor } from '@/domain/seed/categoryColor';

const STEPS = ['nombre', 'moneda', 'quincenas', 'categorias'] as const;
type Step = typeof STEPS[number];

/**
 * Initial setup: four questions, one per screen.
 *
 * It only asks what changes how the app looks from the first second
 * (name, currency, pay-period days, categories). Everything else has a
 * reasonable default and gets changed later in Settings — a long
 * questionnaire before being able to use anything is the fastest way to
 * make someone close the app.
 */
export function OnboardingScreen({ settings }: { settings: Settings }) {
  const [step, setPaso] = useState(0);
  const [name, setNombre] = useState(settings.displayName);
  const [moneda, setMoneda] = useState(settings.currency);
  // The LENGTH of this list is the mode: one = you get paid once a month, two =
  // biweekly. There's no separate field that could contradict it.
  const [payDays, setDias] = useState<number[]>(settings.payDays);
  const [chosen, setElegidas] = useState<Set<string>>(() => new Set(DEFAULT_CATEGORIES.map((c) => c.id)));
  const [saving, setGuardando] = useState(false);

  const currentStep: Step = STEPS[step] ?? 'nombre';
  const chosenCurrency = CURRENCIES.find((c) => c.code === moneda) ?? CURRENCIES[0]!;

  const canContinue =
    currentStep === 'nombre' ? name.trim().length > 0
    : currentStep === 'categorias' ? chosen.size > 0
    : true;

  async function finish() {
    setGuardando(true);
    try {
      await localRepository.saveSettings({
        ...settings,
        displayName: name.trim(),
        currency: chosenCurrency.code,
        locale: chosenCurrency.locale,
        payDays: payDays,
        onboardedAt: new Date().toISOString(),
      });
      // Categories are already seeded: the ones not chosen get removed.
      // Via deleteCategory and not db.categories.delete, so the deletion
      // leaves a tombstone and travels to the other devices.
      const all = await db.categories.toArray();
      for (const c of all) {
        if (!chosen.has(c.id)) await localRepository.deleteCategory(c.id);
      }
      setMoneyLocale(chosenCurrency.locale, chosenCurrency.code);
      haptic('medium');
      // Push NOW. Automatic sync already did its push on entry, i.e. before
      // this settings object existed; if we wait for the next one, just
      // closing the tab is enough for it to never reach the cloud and the
      // next device to ask everything again.
      requestSync();
    } finally {
      setGuardando(false);
    }
  }

  function next() {
    haptic('light');
    if (step < STEPS.length - 1) setPaso(step + 1);
    else void finish();
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', padding: 'calc(var(--safe-top) + 24px) var(--gap-l) calc(var(--safe-bottom) + 20px)' }}>
      <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column' }}>

        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }} aria-hidden>
          {STEPS.map((p, i) => (
            <span
              key={p}
              style={{
                flex: 1, height: 4, borderRadius: 2,
                background: i <= step ? 'var(--q10)' : 'var(--line)',
                transition: 'background var(--dur-med) var(--ease-spring-out)',
              }}
            />
          ))}
        </div>

        <div style={{ flex: 1 }}>
          {currentStep === 'nombre' && (
            <Question title="¿Cómo quieres que te llamemos?" help="Aparece en el saludo del inicio. Nada más.">
              <input
                autoFocus value={name} onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre" aria-label="Tu nombre" maxLength={40}
                onKeyDown={(e) => { if (e.key === 'Enter' && canContinue) next(); }}
                style={{
                  width: '100%', minHeight: 52, padding: '0 16px', borderRadius: 'var(--radius-m)',
                  border: '1px solid var(--line-strong)', background: 'var(--surface)',
                  color: 'var(--text)', fontSize: 18,
                }}
              />
            </Question>
          )}

          {currentStep === 'moneda' && (
            <Question title="¿En qué moneda manejas tu plata?" help="Cambia cómo se escribe cada cifra en toda la app.">
              <div style={{ display: 'grid', gap: 8 }}>
                {CURRENCIES.map((c) => (
                  <button
                    key={c.code} type="button"
                    onClick={() => { haptic('light'); setMoneda(c.code); }}
                    aria-pressed={moneda === c.code}
                    style={optionStyle(moneda === c.code)}
                  >
                    <span style={{ flex: 1, textAlign: 'left' }}>
                      <span style={{ display: 'block', fontWeight: 600 }}>{c.label}</span>
                      <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{c.code}</span>
                    </span>
                    <span className="figures" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{currencySample(c)}</span>
                  </button>
                ))}
              </div>
            </Question>
          )}

          {currentStep === 'quincenas' && (
            <Question
              title="¿Cada cuánto te entra la plata?"
              help="La app agrupa tus gastos entre un pago y el siguiente. Se puede cambiar después en Ajustes."
            >
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <PayOption
                  title="Dos veces al mes"
                  detalle="Quincenal"
                  isActive={payDays.length > 1}
                  onClick={() => setDias((d) => (d.length > 1 ? d : [10, 25]))}
                />
                <PayOption
                  title="Una vez al mes"
                  detalle="Mensual"
                  isActive={payDays.length === 1}
                  // Starts on day 1, the calendar month. Keeping the
                  // first pay-period day (10 by default) would shift the month
                  // without the user having asked for it: "once a month" almost
                  // always means "the normal month". If they get paid on another day, they
                  // change it right below.
                  onClick={() => setDias((d) => (d.length === 1 ? d : [1]))}
                />
              </div>

              {payDays.length > 1 ? (
                <>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <DayInput label="Primer pago" value={payDays[0] ?? 10} onChange={(v) => setDias([v, payDays[1] ?? 25])} />
                    <DayInput label="Segundo pago" value={payDays[1] ?? 25} onChange={(v) => setDias([payDays[0] ?? 10, v])} />
                  </div>
                  <p style={{ marginTop: 16, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                    Quedaría: quincena del {Math.min(...payDays)} y quincena del {Math.max(...payDays)}.
                  </p>
                </>
              ) : (
                <>
                  <DayInput label="Día de pago" value={payDays[0] ?? 1} onChange={(v) => setDias([v])} />
                  <p style={{ marginTop: 16, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                    {payDays[0] === 1
                      ? 'Tu mes va del 1 al último día, como el calendario.'
                      : `Tu mes va del ${payDays[0]} de un mes al ${(payDays[0] ?? 1) - 1} del siguiente.`}
                  </p>
                </>
              )}
            </Question>
          )}

          {currentStep === 'categorias' && (
            <Question title="¿Cuáles categorías usas?" help="Quita las que no. Puedes agregar más después en Ajustes.">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {DEFAULT_CATEGORIES.map((c) => {
                  const isActive = chosen.has(c.id);
                  return (
                    <button
                      key={c.id} type="button"
                      onClick={() => {
                        haptic('light');
                        setElegidas((prev) => {
                          const next = new Set(prev);
                          if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                          return next;
                        });
                      }}
                      aria-pressed={isActive}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        minHeight: 'var(--tap)', padding: '0 14px', borderRadius: 999,
                        border: `1.5px solid ${isActive ? categoryColor(c) : 'var(--line)'}`,
                        background: isActive ? `color-mix(in srgb, ${categoryColor(c)} 16%, var(--surface))` : 'var(--surface)',
                        color: isActive ? categoryColor(c) : 'var(--text-faint)',
                        fontSize: 'var(--text-base)', fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      <span aria-hidden>{c.icon}</span>{c.name}
                    </button>
                  );
                })}
              </div>
              <p style={{ marginTop: 14, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                {chosen.size} selectedIds · ejemplo: {formatMoney(125_000, chosenCurrency.code)}
              </p>
            </Question>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          {step > 0 && (
            <button type="button" onClick={() => setPaso(step - 1)} style={{ ...buttonStyle, flex: 'none', width: 100, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line-strong)' }}>
              Atrás
            </button>
          )}
          <button type="button" onClick={next} disabled={!canContinue || saving} style={{ ...buttonStyle, opacity: canContinue ? 1 : 0.5 }}>
            {saving ? 'Guardando…' : step === STEPS.length - 1 ? 'Empezar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Question({ title, help, children }: { title: string; help: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.022em' }}>{title}</h1>
      <p style={{ margin: '0 0 22px', color: 'var(--text-muted)', fontSize: 'var(--text-base)', lineHeight: 'var(--lh-normal)' }}>{help}</p>
      {children}
    </div>
  );
}

/**
 * "Once a month" or "twice a month". It's asked this way, based on how the
 * person gets paid, and not with the bare words "monthly" and "biweekly": nobody
 * picks a grouping mode, they pick how they get paid.
 */
function PayOption({ title, detalle, isActive, onClick }: {
  title: string; detalle: string; isActive: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => { haptic('light'); onClick(); }}
      aria-pressed={isActive}
      style={{
        flex: 1, minHeight: 'var(--tap)', padding: '12px 14px',
        borderRadius: 'var(--radius-s)',
        border: `2px solid ${isActive ? 'var(--q10)' : 'var(--line)'}`,
        background: isActive ? 'var(--q10-soft)' : 'var(--surface)',
        color: 'var(--text)', cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span style={{ display: 'block', fontWeight: 700, fontSize: 'var(--text-sm)' }}>{title}</span>
      <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
        {detalle}
      </span>
    </button>
  );
}

function DayInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ flex: 1 }}>
      <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}
      </span>
      <input
        type="number" min={1} max={31} value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(31, Math.max(1, Math.trunc(n))));
        }}
        className="figures"
        style={{
          width: '100%', minHeight: 52, padding: '0 16px', borderRadius: 'var(--radius-m)',
          border: '1px solid var(--line-strong)', background: 'var(--surface)',
          color: 'var(--text)', fontSize: 20, fontWeight: 700, textAlign: 'center',
        }}
      />
    </label>
  );
}

function optionStyle(isActive: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
    minHeight: 56, padding: '0 16px', borderRadius: 'var(--radius-m)',
    border: `1.5px solid ${isActive ? 'var(--q10)' : 'var(--line)'}`,
    background: isActive ? 'var(--q10-soft)' : 'var(--surface)',
    color: 'var(--text)', cursor: 'pointer', fontSize: 'var(--text-base)',
    transition: 'all var(--dur-fast) var(--ease-spring-out)',
  };
}

const buttonStyle: React.CSSProperties = {
  flex: 1, minHeight: 52, borderRadius: 'var(--radius-m)', border: 'none',
  background: 'var(--q10)', color: '#fff', fontWeight: 700, fontSize: 17, cursor: 'pointer',
};
