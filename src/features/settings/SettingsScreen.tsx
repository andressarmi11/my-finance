import { useState } from 'react';
import { generalReminderRule } from '@/domain/reminders/schedule';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  IconBell, IconBolt, IconCalendar, IconChartBar, IconChevronRight, IconCoin, IconCreditCard,
  IconDatabase, IconFileText, IconLogout, IconMoon, IconRepeat, IconTag, IconWorld,
} from '@tabler/icons-react';
import { Screen } from '@/components/ui/Screen';
import { localRepository } from '@/data/local/localRepository';
import { db } from '@/data/db';
import { isSupabaseConfigured } from '@/data/supabase/client';
import { useSession } from '@/features/auth/useSession';
import { useLanguage } from '@/i18n/language';
import type { TextKey } from '@/i18n/texts';
import { fill } from '@/lib/dateLabels';
import { todayISO } from '@/lib/todayISO';
import type { Settings } from '@/domain/types';
import { SettingsGroup, SettingsRow } from './ui';
import { LanguageSheet } from './LanguageSheet';
import { ThemeSheet } from './ThemeSheet';
import { LogoutSheet } from './LogoutSheet';

const THEME_LABEL: Record<Settings['theme'], TextKey> = {
  system: 'settings.themeSystem',
  light: 'settings.themeLight',
  dark: 'settings.themeDark',
};

const ICON = { size: 17, stroke: 1.9 } as const;

/**
 * Settings as an iOS-style grouped list (redesign §7). Every row opens its
 * own screen (ajustes/*) or a sheet (language, theme, sign out); the logic
 * behind each one is the section that used to be expanded here.
 */
export function SettingsScreen() {
  const { language, t } = useLanguage();
  const { session } = useSession();
  const settings = useLiveQuery(() => localRepository.getSettings(), []);
  const [year, month] = todayISO().split('-').map(Number) as [number, number];
  const counts = useLiveQuery(async () => ({
    categories: (await db.categories.toArray()).filter((c) => !c.isArchived).length,
    methods: await db.paymentMethods.count(),
    recurring: await db.recurringRules.count(),
    budgets: (await localRepository.listBudgets(year, month)).filter((b) => b.amount > 0).length,
  }), [year, month]);
  const [sheet, setSheet] = useState<'language' | 'theme' | 'logout' | null>(null);

  if (!settings) return null;

  const cloud = isSupabaseConfigured() && !!session;
  const name = settings.displayName.trim();
  const payValue = settings.payDays.length > 1
    ? fill(t('set.payDaysTwo'), { a: settings.payDays[0]!, b: settings.payDays[1]! })
    : fill(t('set.payDaysOne'), { a: settings.payDays[0] ?? 1 });
  const rule = generalReminderRule(settings);
  const days = rule.days;
  const reminderValue = rule.mode === 'sameDay' || days === 0 ? t('set.sameDay')
    : days === 1 ? t('set.oneDayBefore') : fill(t('set.nDaysBefore'), { n: days });

  return (
    <Screen title={t('settings.title')}>
      <Link
        to="/ajustes/cuenta"
        aria-label={fill(t('set.profileOf'), { name: name || t('set.profile') })}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: 14, textDecoration: 'none',
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)',
          color: 'var(--text)',
        }}
      >
        <Avatar name={name} size={46} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 700, fontSize: 'var(--text-md)' }}>{name || t('set.profile')}</span>
          <span style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cloud ? session!.user.email : t('set.localOnlyShort')}
          </span>
          {cloud && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--text-faint)', marginTop: 2 }}>
              <span aria-hidden style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--positive)' }} />
              {t('cloud.syncedOk')}
            </span>
          )}
        </span>
        <IconChevronRight aria-hidden size={18} stroke={1.75} style={{ color: 'var(--text-faint)' }} />
      </Link>

      <SettingsGroup title={t('set.preferences')}>
        <SettingsRow icon={<IconWorld {...ICON} />} tint="var(--q10)" label={t('settings.language')}
          value={language === 'en' ? 'English' : 'Español'} onClick={() => setSheet('language')} />
        <SettingsRow icon={<IconMoon {...ICON} />} tint="var(--cat-servicios)" label={t('settings.theme')}
          value={t(THEME_LABEL[settings.theme])} onClick={() => setSheet('theme')} />
        <SettingsRow icon={<IconCoin {...ICON} />} tint="var(--positive)" label={t('settings.currency')}
          value={settings.currency} to="/ajustes/moneda" />
      </SettingsGroup>

      <SettingsGroup title={t('set.yourMoney')}>
        <SettingsRow icon={<IconCalendar {...ICON} />} tint="var(--q25)" label={t('settings.howYouGetPaid')}
          value={payValue} to="/ajustes/pagos" />
        <SettingsRow icon={<IconBell {...ICON} />} tint="var(--danger)" label={t('settings.reminders')}
          value={reminderValue} to="/ajustes/recordatorios" />
      </SettingsGroup>

      <SettingsGroup title={t('settings.organize')}>
        <SettingsRow icon={<IconTag {...ICON} />} tint="var(--cat-hogar)" label={t('categories.title')}
          value={counts ? String(counts.categories) : ''} to="/ajustes/categorias" />
        <SettingsRow icon={<IconCreditCard {...ICON} />} tint="var(--q10)" label={t('methods.title')}
          value={counts ? String(counts.methods) : ''} to="/ajustes/metodos" />
        <SettingsRow icon={<IconRepeat {...ICON} />} tint="var(--cat-suscripciones)" label={t('recurring.title')}
          value={counts ? String(counts.recurring) : ''} to="/ajustes/recurrentes" />
        <SettingsRow icon={<IconChartBar {...ICON} />} tint="var(--cat-entretenimiento)" label={t('budgets.title')}
          value={counts ? (counts.budgets ? String(counts.budgets) : t('set.none')) : ''} to="/ajustes/presupuestos" />
      </SettingsGroup>

      <SettingsGroup title={t('set.advanced')}>
        <SettingsRow icon={<IconBolt {...ICON} />} tint="var(--q25)" label={t('set.shortcuts')} to="/ajustes/atajos" />
        <SettingsRow icon={<IconDatabase {...ICON} />} tint="var(--text-muted)" label={t('settings.yourData')}
          value={t('set.exportImport')} to="/ajustes/datos" />
        <SettingsRow icon={<IconFileText {...ICON} />} tint="var(--text-muted)" label={t('settings.legal')} to="/legal" />
      </SettingsGroup>

      {cloud && (
        <SettingsGroup>
          <SettingsRow icon={<IconLogout {...ICON} />} tint="var(--danger)" label={t('cloud.signOut')} danger
            chevron={false} onClick={() => setSheet('logout')} />
        </SettingsGroup>
      )}

      <p className="figures" style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-faint)', margin: '22px 0 0' }}>
        Step up v{import.meta.env.VITE_APP_VERSION as string} · © 2026
      </p>

      {sheet === 'language' && <LanguageSheet onClose={() => setSheet(null)} />}
      {sheet === 'theme' && <ThemeSheet settings={settings} onClose={() => setSheet(null)} />}
      {sheet === 'logout' && <LogoutSheet email={session?.user.email ?? ''} onClose={() => setSheet(null)} />}
    </Screen>
  );
}

/** Initial in a --q10 disc: the profile card (46px) and the profile screen (84px). */
export function Avatar({ name, size }: { name: string; size: number }) {
  const initial = name.trim().charAt(0).toUpperCase() || '·';
  return (
    <span aria-hidden style={{
      width: size, height: size, borderRadius: size / 2, flex: 'none', display: 'grid', placeItems: 'center',
      background: 'var(--q10-soft)', color: 'var(--q10-text)', fontWeight: 700, fontSize: Math.round(size * 0.4),
    }}>
      {initial}
    </span>
  );
}
