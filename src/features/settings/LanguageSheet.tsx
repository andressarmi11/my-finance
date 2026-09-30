import { IconCheck } from '@tabler/icons-react';
import { useLanguage, type Language } from '@/i18n/language';
import { BottomSheet, SettingsGroup, noteStyle, rowStyle } from './ui';
import { DoneButton } from './ThemeSheet';

const LANGUAGES: Array<{ code: Language; badge: string; name: string; region: string }> = [
  { code: 'es', badge: 'ES', name: 'Español', region: 'Español (Colombia)' },
  { code: 'en', badge: 'EN', name: 'English', region: 'English (US)' },
];

/**
 * Idioma (redesign §9e): two rows with a --q10 check. It applies at once
 * and the sheet stays open, so the change can be seen before closing.
 * The names are always in their own language: someone who can't read the
 * current one still finds theirs.
 */
export function LanguageSheet({ onClose }: { onClose: () => void }) {
  const { language, setLanguage, t } = useLanguage();
  return (
    <BottomSheet label={t('settings.language')} onClose={onClose}>
      <h2 style={{ margin: '0 0 4px', fontSize: 'var(--text-xl)', fontWeight: 700 }}>{t('settings.language')}</h2>
      <SettingsGroup style={{ marginTop: 14 }}>
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            lang={l.code}
            aria-pressed={language === l.code}
            onClick={() => setLanguage(l.code)}
            style={{ ...rowStyle, minHeight: 56 }}
          >
            <span aria-hidden style={{
              width: 34, height: 34, borderRadius: 10, background: 'var(--surface-sunken)', display: 'grid',
              placeItems: 'center', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', flex: 'none',
            }}>
              {l.badge}
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 'var(--text-md)' }}>{l.name}</span>
              <span aria-hidden style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{l.region}</span>
            </span>
            <IconCheck aria-hidden size={20} stroke={2.6} style={{ color: 'var(--q10)', opacity: language === l.code ? 1 : 0 }} />
          </button>
        ))}
      </SettingsGroup>
      <p style={noteStyle}>{t('settings.languageNote')}</p>
      <DoneButton onClick={onClose} />
    </BottomSheet>
  );
}
