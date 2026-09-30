import { useContext, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen, SettingsPanelContext } from '@/components/ui/Screen';
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
  const inPanel = useContext(SettingsPanelContext);

  if (!settings) return null;
  const cloud = isSupabaseConfigured() && !!session;
  const email = session?.user.email ?? '';

  const nameInput = (
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
      style={inPanel ? {
        width: '100%', height: 44, borderRadius: 12, border: '1px solid var(--line-strong)', background: 'var(--paper)',
        color: 'var(--text)', fontSize: 15, padding: '0 12px', outline: 'none',
      } : { width: '100%', height: 50, border: 'none', background: 'none', outline: 'none', color: 'var(--text)', fontSize: 16 }}
    />
  );

  // Desktop (prototype 2c): the profile as a card beside the account's, and
  // signing out as a strip under both.
  if (inPanel) {
    const box: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 22 };
    return (
      <Screen title={t('set.profile')} back={back} hideTitle panelFree>
        <div style={{ display: 'grid', gridTemplateColumns: cloud ? '1fr 1fr' : 'minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
          <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Avatar name={settings.displayName} size={64} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 20, fontWeight: 700 }}>{settings.displayName || '—'}</span>
                <span style={{ display: 'block', fontSize: 14, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {cloud ? email : t('set.localOnlyShort')}
                </span>
              </span>
            </div>
            <label htmlFor="perfil-nombre" style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', margin: '0 2px 6px' }}>{t('settings.yourName')}</span>
              {nameInput}
            </label>
            {!cloud && <p style={{ ...noteStyle, margin: 0 }}>{t('cloud.localOnly')}</p>}
          </div>
          {cloud && (
            <div style={box}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t('set.account')}</h2>
              <p style={{ margin: '2px 0 14px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45 }}>{t('cloud.sameDataAnywhere')}</p>
              <SettingsGroup style={{ marginTop: 0 }}>
                <CloudSection />
                <SettingsRow label={t('set.changePassword')} to="/ajustes/cuenta/contrasena" />
              </SettingsGroup>
            </div>
          )}
          {cloud && (
            <div style={{ ...box, padding: '18px 22px', gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: 15 }}>{t('cloud.signOut')}</span>
                <span style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)' }}>{t('set.dataStaysInAccount')}</span>
              </span>
              <button
                type="button"
                onClick={() => setLogout(true)}
                style={{
                  height: 40, padding: '0 18px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: 'color-mix(in srgb, var(--danger) 16%, transparent)', color: 'var(--danger-text)', fontWeight: 700, fontSize: 14,
                }}
              >
                {t('cloud.signOut')}
              </button>
            </div>
          )}
        </div>
        {logout && <LogoutSheet email={email} onClose={() => setLogout(false)} />}
      </Screen>
    );
  }

  return (
    <Screen title={t('set.profile')} back={back} hideTitle>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '6px 0 8px' }}>
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
        {nameInput}
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
