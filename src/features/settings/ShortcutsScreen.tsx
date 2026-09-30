import { Screen } from '@/components/ui/Screen';
import { useT } from '@/i18n/language';
import type { TextKey } from '@/i18n/texts';
import { AutomationSection, SHORTCUTS_GUIDE_URL } from './AutomationSection';
import { SettingsGroup, useSettingsBack } from './ui';

const STEPS: TextKey[] = ['set.shortcutStep1', 'set.shortcutStep2', 'set.shortcutStep3'];

/**
 * Atajos de iOS (redesign §9d): the key card (AutomationSection), how to
 * build the Shortcut in three steps, and the full guide.
 */
export function ShortcutsScreen() {
  const t = useT();
  const back = useSettingsBack();
  return (
    <Screen title={t('set.shortcuts')} subtitle={t('set.shortcutsIntro')} back={back}>
      <AutomationSection />

      <SettingsGroup title={t('set.howToBuild')}>
        {STEPS.map((key, i) => (
          <div key={key} style={{ display: 'flex', gap: 12, padding: '12px 14px' }}>
            <span aria-hidden style={{
              width: 24, height: 24, borderRadius: 12, background: 'var(--q10-soft)', color: 'var(--q10-text)',
              fontWeight: 700, fontSize: 'var(--text-sm)', display: 'grid', placeItems: 'center', flex: 'none',
            }}>
              {i + 1}
            </span>
            <span style={{ fontSize: 'var(--text-base)', lineHeight: 1.45 }}>{t(key)}</span>
          </div>
        ))}
      </SettingsGroup>

      <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: '12px 6px 0' }}>
        {t('set.fullGuide')}{' '}
        <a href={SHORTCUTS_GUIDE_URL} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
          docs/ATAJOS_IOS.md
        </a>
      </p>
    </Screen>
  );
}
