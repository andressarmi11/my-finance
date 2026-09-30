import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/components/ui/Screen';
import { localRepository } from '@/data/local/localRepository';
import { isSupabaseConfigured } from '@/data/supabase/client';
import { useSession } from '@/features/auth/useSession';
import { useT } from '@/i18n/language';
import { Avatar } from './SettingsScreen';
import { CloudSection } from './CloudSection';
import { LogoutSheet } from './LogoutSheet';
import { SettingsGroup, SettingsRow, card, noteStyle, useSettingsBack } from './ui';

/**
 * Perfil (redesign §9e), opened from the profile card: the name the app
 * greets you with on Inicio (settings.displayName), the account's sync
 * (CloudSection: "Sincronizar ahora"), "Cambiar contraseña" and sign out.
 * Without an account only the name is here.
 */
export function ProfileScreen() {
  const t = useT();
  const back = useSettingsBack();
  const { session } = useSession();
  const settings = useLiveQuery(() => localRepository.getSettings(), []);
  const [logout, setLogout] = useState(false);

  if (!settings) return null;
  const cloud = isSupabaseConfigured() && !!session;
  const email = session?.user.email ?? '';

  return (
    <Screen title={t('set.profile')} back={back}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '0 0 8px' }}>
        <Avatar name={settings.displayName} size={84} />
        <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginTop: 6 }}>{settings.displayName || '—'}</span>
        <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)' }}>{cloud ? email : t('set.localOnlyShort')}</span>
      </div>

      <div style={{ margin: '22px 6px 8px' }}>
        <label htmlFor="perfil-nombre" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-faint)' }}>
          {t('settings.yourName')}
        </label>
      </div>
      <div style={{ ...card, padding: '0 14px' }}>
        <input
          id="perfil-nombre"
          // Keyed on the saved value so a sync that changes it refreshes the field.
          key={settings.displayName}
          defaultValue={settings.displayName}
          onBlur={(e) => {
            const name = e.target.value.trim();
            if (name !== settings.displayName) void localRepository.saveSettings({ ...settings, displayName: name });
          }}
          placeholder={t('settings.namePlaceholder')}
          maxLength={40}
          style={{ width: '100%', height: 50, border: 'none', background: 'none', outline: 'none', color: 'var(--text)', fontSize: 16 }}
        />
      </div>
      <p style={noteStyle}>{t('set.nameNote')}</p>

      {cloud ? (
        <>
          <SettingsGroup title={t('set.account')} note={t('cloud.sameDataAnywhere')}>
            <CloudSection />
            <SettingsRow label={t('set.changePassword')} to="/ajustes/cuenta/contrasena" />
          </SettingsGroup>
          <button
            type="button"
            onClick={() => setLogout(true)}
            style={{
              marginTop: 22, width: '100%', height: 50, borderRadius: 16, border: 'none', background: 'var(--surface)',
              color: 'var(--danger-text)', fontWeight: 600, fontSize: 'var(--text-md)', cursor: 'pointer',
            }}
          >
            {t('cloud.signOut')}
          </button>
        </>
      ) : (
        <p style={{ ...noteStyle, marginTop: 22 }}>{t('cloud.localOnly')}</p>
      )}

      {logout && <LogoutSheet email={email} onClose={() => setLogout(false)} />}
    </Screen>
  );
}
