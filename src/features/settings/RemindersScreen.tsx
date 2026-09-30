import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/components/ui/Screen';
import { localRepository } from '@/data/local/localRepository';
import { NotificationsSection } from '@/features/notifications/NotificationsSection';
import { useT } from '@/i18n/language';
import { ReminderRuleEditor } from '@/features/notifications/ReminderRuleEditor';
import { generalReminderRule } from '@/domain/reminders/schedule';
import { SettingsGroup, noteStyle, useSettingsBack } from './ui';
import { fill } from '@/lib/dateLabels';
import { monthName } from '@/components/ui/MonthNav';
import { todayISO } from '@/lib/todayISO';

/**
 * Recordatorios (redesign §9e/§9f): the switch for this device (push) and
 * the general rule (Settings.reminder, v2): N days before at a time, or the
 * same day. The editor shows what the notification looks like.
 */
export function RemindersScreen() {
  const t = useT();
  const back = useSettingsBack();
  const settings = useLiveQuery(() => localRepository.getSettings(), []);
  if (!settings) return null;

  return (
    <Screen title={t('settings.reminders')} subtitle={t('set.remindersIntro')} back={back}>
      <SettingsGroup>
        <NotificationsSection />
      </SettingsGroup>

      {/* §9f "Recordatorios v2": days before at a time, or the same day
          (hours/minutes before, or at an exact time), with a live preview.
          The legacy days field is kept in step for older clients. */}
      <ReminderRuleEditor
        value={generalReminderRule(settings)}
        onChange={(reminder) => void localRepository.saveSettings({
          ...settings,
          reminder,
          ...(reminder.mode === 'days' ? { reminderDefaultDaysBefore: reminder.days } : {}),
        })}
      />
      <p style={{ ...noteStyle, marginTop: 10 }}>
        {generalReminderRule(settings).mode === 'sameDay'
          ? t('set.remindersNoteSameDay')
          : fill(t('set.remindersNote'), { month: monthName((Number(todayISO().slice(5, 7)) % 12) + 1) })}
      </p>
    </Screen>
  );
}
