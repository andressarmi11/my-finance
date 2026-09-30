import { IconMoon } from '@tabler/icons-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Navigate } from 'react-router-dom';
import { useBreakpoint } from '@/app/useBreakpoint';
import { Screen } from '@/components/ui/Screen';
import { localRepository } from '@/data/local/localRepository';
import { useT } from '@/i18n/language';
import type { TextKey } from '@/i18n/texts';
import type { Settings } from '@/domain/types';
import { NavBarSection } from './NavBarSection';
import { useSettingsBack } from './ui';

type Theme = Settings['theme'];

const THEMES: Array<{ value: Theme; label: TextKey; note: TextKey; bg: string; ink: string; card: string }> = [
  {
    value: 'system', label: 'settings.themeSystem', note: 'set.themeNoteSystem',
    // Split diagonally: half light, half dark, like the phone's own setting.
    bg: 'linear-gradient(135deg, var(--thumb-light-paper) 50%, var(--thumb-dark-paper) 50%)',
    ink: 'var(--thumb-mid-ink)', card: 'var(--thumb-mid-card)',
  },
  {
    value: 'light', label: 'settings.themeLight', note: 'set.themeNoteLight',
    bg: 'var(--thumb-light-paper)', ink: 'var(--thumb-light-ink)', card: 'var(--thumb-light-card)',
  },
  {
    value: 'dark', label: 'settings.themeDark', note: 'set.themeNoteDark',
    bg: 'var(--thumb-dark-paper)', ink: 'var(--thumb-dark-ink)', card: 'var(--thumb-dark-card)',
  },
];

/**
 * Tema y barra (redesign §9e, BARRA.md): on a phone or tablet its own screen
 * under Ajustes — the three themes, then how see-through the tab bar is.
 * Everything applies at once: useTheme writes data-theme on <html>, and the
 * bar reads --nav-* from src/lib/navBar.ts. On desktop there's no tab bar:
 * the theme lives in the Idioma y tema panel.
 */
export function ThemeScreen() {
  const t = useT();
  const back = useSettingsBack();
  const desktop = useBreakpoint() === 'desktop';
  const settings = useLiveQuery(() => localRepository.getSettings(), []);
  if (desktop) return <Navigate to="/ajustes/preferencias" replace />;
  if (!settings) return null;
  return (
    <Screen title={t('settings.themeAndBar')} subtitle={t('set.themeInstant')} back={back}>
      <ThemeOptions settings={settings} />
      <NavBarSection />
    </Screen>
  );
}

/** The three thumbnails and the note: the sheet on the phone, a card on desktop. */
export function ThemeOptions({ settings }: { settings: Settings }) {
  const t = useT();
  const current = THEMES.find((x) => x.value === settings.theme) ?? THEMES[0]!;

  function choose(theme: Theme) {
    void localRepository.saveSettings({ ...settings, theme });
  }

  return (
    <>
      <div role="group" aria-label={t('settings.theme')} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {THEMES.map((th) => {
          const active = th.value === settings.theme;
          return (
            <button
              key={th.value}
              type="button"
              aria-pressed={active}
              onClick={() => choose(th.value)}
              style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
            >
              <span aria-hidden style={{
                display: 'block', width: '100%', aspectRatio: '3 / 4', borderRadius: 18, padding: 4, boxSizing: 'border-box',
                border: `2px solid ${active ? 'var(--q10)' : 'var(--line)'}`,
              }}>
                <span style={{
                  display: 'flex', flexDirection: 'column', gap: 5, width: '100%', height: '100%', borderRadius: 13,
                  background: th.bg, padding: '10px 8px', boxSizing: 'border-box', overflow: 'hidden',
                  border: '1px solid var(--line)',
                }}>
                  <span style={{ height: 6, width: '50%', borderRadius: 3, background: th.ink, opacity: 0.5 }} />
                  <span style={{ height: 12, width: '78%', borderRadius: 4, background: th.ink }} />
                  <span style={{ flex: 1, borderRadius: 8, background: th.card }} />
                  <span style={{ height: 14, borderRadius: 7, background: th.card }} />
                </span>
              </span>
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: active ? 'var(--text)' : 'var(--text-muted)' }}>
                {t(th.label)}
              </span>
            </button>
          );
        })}
      </div>
      <div style={{
        marginTop: 18, padding: 14, display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--paper)', borderRadius: 16,
      }}>
        <span aria-hidden style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--q10-soft)', color: 'var(--q10)', display: 'grid', placeItems: 'center', flex: 'none' }}>
          <IconMoon size={18} stroke={1.9} />
        </span>
        <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)', lineHeight: 1.45 }}>{t(current.note)}</span>
      </div>
    </>
  );
}

/** "Listo": closes a sheet whose choices already applied. */
export function DoneButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        marginTop: 16, width: '100%', height: 50, borderRadius: 16, border: 'none',
        background: 'var(--surface-sunken)', color: 'var(--text)', fontWeight: 600,
        fontSize: 'var(--text-md)', cursor: 'pointer',
      }}
    >
      {t('set.done')}
    </button>
  );
}
