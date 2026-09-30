import { IconCheck } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/components/ui/Screen';
import { localRepository } from '@/data/local/localRepository';
import { CURRENCIES as OPTIONS, currencySample } from '@/domain/money/currencies';
import { CURRENCIES as ORDER, DEFAULT_QUICK_CURRENCIES, flagOf } from '@/lib/currencies';

// The prototype's order: the three everyone uses first (COP, USD, EUR).
const CURRENCIES = ORDER.map((o) => OPTIONS.find((c) => c.code === o.code)).filter((c) => c !== undefined);
import { useLanguage } from '@/i18n/language';
import { fill } from '@/lib/dateLabels';
import { SettingsGroup, noteStyle, rowStyle, useSettingsBack } from './ui';

const MAX_QUICK = 3;

/**
 * Moneda (redesign §9e). "Principal": the currency every amount is stored
 * and added up in (a picker, not two text fields: typing 'cop' and 'es_CO'
 * by hand broke the formatting of the whole app without saying why).
 * "Monedas rápidas": up to 3 chips the new-transaction sheet shows before
 * "Más" (settings.quickCurrencies).
 */
export function CurrencyScreen() {
  const { language, t } = useLanguage();
  const back = useSettingsBack();
  const settings = useLiveQuery(() => localRepository.getSettings(), []);
  if (!settings) return null;

  const quick = settings.quickCurrencies?.length ? settings.quickCurrencies : DEFAULT_QUICK_CURRENCIES;
  const names = language === 'en' ? safeDisplayNames() : null;

  function toggleQuick(code: string) {
    const on = quick.includes(code);
    if (!on && quick.length >= MAX_QUICK) return;
    // At least one: an empty list would silently fall back to the default three.
    if (on && quick.length === 1) return;
    const next = on ? quick.filter((c) => c !== code) : [...quick, code];
    void localRepository.saveSettings({ ...settings!, quickCurrencies: next });
  }

  return (
    <Screen title={t('settings.currency')} subtitle={t('set.currencyIntro')} back={back}>
      <SettingsGroup title={t('set.mainCurrency')} cardClassName="currency-main">
        {CURRENCIES.map((c) => {
          const active = settings.currency === c.code;
          return (
            <button
              key={c.code}
              type="button"
              aria-pressed={active}
              onClick={() => void localRepository.saveSettings({ ...settings, currency: c.code, locale: c.locale })}
              style={{ ...rowStyle, minHeight: 54 }}
            >
              <span aria-hidden style={{ fontSize: 22, lineHeight: 1, flex: 'none' }}>{flagOf(c.code)}</span>
              <span style={{ flex: 1, padding: '8px 0' }}>
                <span style={{ display: 'block', fontSize: 16 }}>
                  {names?.of(c.code) ?? c.label}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>
                  {c.code} · {currencySample(c)}
                </span>
              </span>
              <IconCheck aria-hidden size={20} stroke={2.6} style={{ color: 'var(--q10)', opacity: active ? 1 : 0, flex: 'none' }} />
            </button>
          );
        })}
      </SettingsGroup>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '22px 6px 8px' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-faint)' }}>{t('set.quickCurrencies')}</h2>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
          {fill(t('set.quickCount'), { n: quick.length, max: MAX_QUICK })}
        </span>
      </div>
      <div role="group" aria-label={t('set.quickCurrencies')} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {CURRENCIES.map((c) => {
          const on = quick.includes(c.code);
          const full = !on && quick.length >= MAX_QUICK;
          return (
            <button
              key={c.code}
              type="button"
              aria-pressed={on}
              aria-disabled={full}
              onClick={() => toggleQuick(c.code)}
              style={{
                height: 38, padding: '0 14px 0 10px', borderRadius: 19, display: 'flex', alignItems: 'center', gap: 6,
                border: `1px solid ${on ? 'var(--q10)' : 'var(--line-strong)'}`,
                background: on ? 'var(--q10-soft)' : 'var(--paper)',
                color: 'var(--text)',
                fontWeight: 700, fontSize: 13, cursor: full ? 'not-allowed' : 'pointer',
                opacity: full ? 0.45 : 1,
              }}
            >
              <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>{flagOf(c.code)}</span>{c.code}
            </button>
          );
        })}
      </div>
      <p style={noteStyle}>{t('set.quickNote')}</p>
    </Screen>
  );
}

function safeDisplayNames(): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames(['en'], { type: 'currency' });
  } catch {
    return null;
  }
}
