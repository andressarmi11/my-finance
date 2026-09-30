import { useLanguage } from '@/i18n/language';
import { IconBuildingBank, IconCash, IconCreditCard } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/components/ui/Screen';
import { localRepository } from '@/data/local/localRepository';
import { db } from '@/data/db';
import { formatMoney } from '@/domain/money/format';
import { calculateAvailableCredit } from '@/domain/credit-card/availableCredit';
import type { PaymentMethod } from '@/domain/types';
import { DashedButton, SettingsGroup, rowStyle, useSettingsBack } from '@/features/settings/ui';
import { PaymentMethodForm } from './PaymentMethodForm';
import { todayISO } from '@/lib/todayISO';
import { fill } from '@/lib/dateLabels';
import { EMPTY } from '@/lib/empty';
import type { TextKey } from '@/i18n/texts';

const TYPE_LABEL: Record<PaymentMethod['type'], TextKey> = {
  debit: 'methods.debit', credit: 'methods.credit', cash: 'methods.cash', transfer: 'methods.transfer',
};

/** Icon and tint per type: bank, card, banknotes. */
const TYPE_LOOK: Record<PaymentMethod['type'], { icon: typeof IconCreditCard; color: string }> = {
  debit: { icon: IconBuildingBank, color: 'var(--q10)' },
  transfer: { icon: IconBuildingBank, color: 'var(--q10)' },
  credit: { icon: IconCreditCard, color: 'var(--q25)' },
  cash: { icon: IconCash, color: 'var(--positive)' },
};

/**
 * Métodos de pago (redesign §9f): one row per method with its type icon,
 * "Por defecto" on the default one, "Crédito · corte 15, paga el 2" and, for a
 * card with a limit, the bar of how much of it is used (creditLimit, 0007).
 */
const TYPE_ORDER = ['debit', 'credit', 'cash', 'transfer'];

/** "15" / "15th": the prototype's English writes the days as ordinals. */
function ordinalDay(day: number, language: string): string {
  if (language !== 'en') return String(day);
  const s = day % 100 >= 11 && day % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[day % 10] ?? 'th';
  return `${day}${s}`;
}

export function PaymentMethodsScreen() {
  const { t, language } = useLanguage();
  const back = useSettingsBack();
  const methods = useLiveQuery(() => localRepository.listPaymentMethods(), []) ?? EMPTY;
  // Debit, credit, cash (prototype order); within a type, as stored.
  const sortedMethods = useMemo(
    () => [...methods].sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)),
    [methods],
  );
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? EMPTY;
  const settings = useLiveQuery(() => localRepository.getSettings(), []);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [creating, setCreating] = useState(false);
  const today = todayISO();
  const defaultId = settings?.defaultPaymentMethodId ?? methods.find((m) => m.isDefault)?.id ?? null;

  const usageByMethod = useMemo(() => {
    const account = new Map<string, number>();
    for (const tx of transactions) {
      if (!tx.paymentMethodId) continue;
      account.set(tx.paymentMethodId, (account.get(tx.paymentMethodId) ?? 0) + 1);
    }
    return account;
  }, [transactions]);

  async function handleSave(method: PaymentMethod, useAsDefault: boolean) {
    await localRepository.savePaymentMethod(method);
    if (settings) {
      const wasDefault = defaultId === method.id;
      if (useAsDefault && !wasDefault) await localRepository.saveSettings({ ...settings, defaultPaymentMethodId: method.id });
      if (!useAsDefault && wasDefault) await localRepository.saveSettings({ ...settings, defaultPaymentMethodId: null });
    }
    setEditing(null);
    setCreating(false);
  }

  async function handleDelete() {
    if (!editing) return;
    await localRepository.deletePaymentMethod(editing.id);
    if (settings && settings.defaultPaymentMethodId === editing.id) {
      await localRepository.saveSettings({ ...settings, defaultPaymentMethodId: null });
    }
    setEditing(null);
  }

  return (
    <Screen title={t('methods.title')} subtitle={t('set.methodsIntro')} back={back}>
      {methods.length > 0 && (
        <SettingsGroup style={{ marginTop: 0 }}>
          {sortedMethods.map((m) => {
            const credit = m.type === 'credit' ? calculateAvailableCredit(m, transactions, today) : null;
            const look = TYPE_LOOK[m.type];
            const Icon = look.icon;
            const usedPct = credit && credit.cupo > 0 ? Math.min(100, Math.max(0, (credit.used / credit.cupo) * 100)) : 0;
            return (
              <button key={m.id} type="button" onClick={() => setEditing(m)} style={{ ...rowStyle, alignItems: 'flex-start', padding: '12px 14px' }}>
                <span aria-hidden style={{
                  width: 38, height: 38, borderRadius: 12, flex: 'none', display: 'grid', placeItems: 'center',
                  background: `color-mix(in srgb, ${look.color} 14%, var(--surface))`, color: look.color,
                }}>
                  <Icon size={20} stroke={1.8} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                    {m.id === defaultId && (
                      <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, color: 'var(--q10-text)', background: 'var(--q10-soft)', padding: '2px 7px', borderRadius: 8 }}>
                        {t('set.defaultTag')}
                      </span>
                    )}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                    {t(TYPE_LABEL[m.type])}
                    {' · '}
                    {m.type === 'credit'
                      ? (m.cutoffDay && m.paymentDay
                        ? fill(t('methods.cycleShort'), { cutoff: ordinalDay(m.cutoffDay, language), payment: ordinalDay(m.paymentDay, language) })
                        : '')
                      : t(m.type === 'cash' ? 'methods.subCash' : m.type === 'transfer' ? 'methods.subTransfer' : 'methods.subDebit')}
                  </span>
                  {credit && (
                    <>
                      <span aria-hidden style={{ display: 'block', height: 6, borderRadius: 3, background: 'var(--line)', marginTop: 10, overflow: 'hidden' }}>
                        <span style={{ display: 'block', height: '100%', width: `${usedPct}%`, background: credit.available < 0 ? 'var(--danger)' : 'var(--q25)', borderRadius: 3 }} />
                      </span>
                      <span className="figures" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 5 }}>
                        <span>{fill(t('set.usedAmount'), { amount: formatMoney(credit.used) })}</span>
                        <span>{fill(t('set.limitAmount'), { amount: formatMoney(credit.cupo) })}</span>
                      </span>
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </SettingsGroup>
      )}

      <DashedButton onClick={() => setCreating(true)}>{t('cards.newMethod')}</DashedButton>

      {(editing || creating) && (
        <PaymentMethodForm
          existing={editing}
          isDefault={!!editing && editing.id === defaultId}
          relatedTransactions={editing ? usageByMethod.get(editing.id) ?? 0 : 0}
          onSave={handleSave}
          onDelete={editing ? handleDelete : undefined}
          onCancel={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </Screen>
  );
}
