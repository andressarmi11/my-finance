import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { Screen } from '@/components/ui/Screen';
import { localRepository } from '@/data/local/localRepository';
import { useLanguage } from '@/i18n/language';
import { exportBackupJSON, exportBackupXLSX, exportTransactionsCSV, parseBackupFile, importBackup, type BackupPreview } from '@/data/backup/exportImport';
import type { Backup } from '@/data/backup/schema';
import type { Settings } from '@/domain/types';
import { CURRENCIES, currencySample } from '@/domain/money/currencies';
import { ImportPreviewSheet } from './ImportPreviewSheet';
import { CloudSection } from './CloudSection';
import { AutomationSection } from './AutomationSection';
import { NotificationsSection } from '@/features/notifications/NotificationsSection';

const THEMES: Array<{ value: Settings['theme']; label: string }> = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

export function SettingsScreen() {
  const settings = useLiveQuery(() => localRepository.getSettings(), []);
  const { language, setLanguage, t } = useLanguage();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importState, setImportState] = useState<
    { status: 'idle' } | { status: 'error'; message: string } | { status: 'preview'; backup: Backup; preview: BackupPreview }
  >({ status: 'idle' });
  const [busy, setBusy] = useState<string | null>(null);

  if (!settings) return null;

  function patch(partial: Partial<Settings>) {
    void localRepository.saveSettings({ ...settings!, ...partial });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const result = parseBackupFile(text);
    if (!result.success) {
      setImportState({ status: 'error', message: result.error });
      return;
    }
    setImportState({ status: 'preview', backup: result.backup, preview: result.preview });
  }

  async function confirmImport() {
    if (importState.status !== 'preview') return;
    setBusy('import');
    try {
      await importBackup(importState.backup);
      setImportState({ status: 'idle' });
    } finally {
      setBusy(null);
    }
  }

  async function handleExportJSON() {
    setBusy('json');
    try { await exportBackupJSON(); } finally { setBusy(null); }
  }
  async function handleExportXLSX() {
    setBusy('xlsx');
    try {
      await exportBackupXLSX();
    } finally {
      setBusy(null);
    }
  }

  async function handleExportCSV() {
    setBusy('csv');
    try { await exportTransactionsCSV(); } finally { setBusy(null); }
  }

  return (
    <Screen title={t('settings.title')} subtitle="Tu cuenta, moneda y quincenas">
      <section style={sectionStyle}>
        <h2 style={sectionTitle}>{t('settings.yourName')}</h2>
        <input
          defaultValue={settings.displayName}
          onBlur={(e) => patch({ displayName: e.target.value.trim() })}
          placeholder="Como quieres que te llamemos"
          aria-label="Tu nombre"
          maxLength={40}
          style={{
            width: '100%', minHeight: 'var(--tap)', padding: '0 14px',
            borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)',
            background: 'var(--surface)', color: 'var(--text)', fontSize: 16,
          }}
        />
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitle}>{t('settings.language')}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {([['es', 'Español'], ['en', 'English']] as const).map(([code, name]) => (
            <button
              key={code}
              type="button"
              onClick={() => setLanguage(code)}
              aria-pressed={language === code}
              lang={code}
              style={segmentStyle(language === code)}
            >
              {name}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '8px 0 0' }}>
          {t('settings.languageNote')}
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitle}>{t('settings.theme')}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {THEMES.map((t) => (
            <button key={t.value} type="button" onClick={() => patch({ theme: t.value })} aria-pressed={settings.theme === t.value} style={segmentStyle(settings.theme === t.value)}>
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitle}>{t('settings.currency')}</h2>
        {/* Picker, not two text fields: typing 'cop' and 'es_CO' by hand
            broke the formatting of the whole app without saying why. */}
        <div style={{ display: 'grid', gap: 6 }}>
          {CURRENCIES.map((c) => {
            const isActive = settings.currency === c.code;
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => patch({ currency: c.code, locale: c.locale })}
                aria-pressed={isActive}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  minHeight: 'var(--tap)', padding: '0 14px', borderRadius: 'var(--radius-s)',
                  border: `1px solid ${isActive ? 'var(--q10)' : 'var(--line)'}`,
                  background: isActive ? 'var(--q10-soft)' : 'var(--surface)',
                  color: 'var(--text)', cursor: 'pointer', fontSize: 'var(--text-base)',
                }}
              >
                <span style={{ flex: 1, textAlign: 'left', fontWeight: isActive ? 600 : 400 }}>{c.label}</span>
                <span className="figures" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{currencySample(c)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitle}>{t('settings.howYouGetPaid')}</h2>
        <Row label="Te entra la plata">
          <div style={{ display: 'flex', gap: 6 }}>
            {([
              { label: 'Dos veces al mes', biweekly: true },
              { label: 'Una vez al mes', biweekly: false },
            ]).map((option) => {
              const isActive = (settings.payDays.length > 1) === option.biweekly;
              return (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => patch({
                    // Monthly starts on day 1, the calendar month:
                    // inheriting the first pay-period day would shift the month without
                    // the user having asked for it. The day gets adjusted right below.
                    payDays: option.biweekly ? [10, 25] : [1],
                  })}
                  style={{
                    minHeight: 'var(--tap)', padding: '0 12px',
                    borderRadius: 'var(--radius-s)',
                    border: `1.5px solid ${isActive ? 'var(--q10)' : 'var(--line)'}`,
                    background: isActive ? 'var(--q10-soft)' : 'var(--surface)',
                    color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </Row>

        {settings.payDays.length > 1 ? (
          <>
            <Row label="Primera empieza el día">
              <NumberInput
                value={settings.payDays[0] ?? 10}
                onCommit={(v) => patch({ payDays: [v, settings.payDays[1] ?? 25] })}
              />
            </Row>
            <Row label="Segunda empieza el día">
              <NumberInput
                value={settings.payDays[1] ?? 25}
                onCommit={(v) => patch({ payDays: [settings.payDays[0] ?? 10, v] })}
              />
            </Row>
          </>
        ) : (
          <Row label="Tu mes empieza el día">
            <NumberInput
              value={settings.payDays[0] ?? 1}
              onCommit={(v) => patch({ payDays: [v] })}
            />
          </Row>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitle}>Recordatorios</h2>
        <Row label="Avisar con">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <NumberInput value={settings.reminderDefaultDaysBefore} min={0} onCommit={(v) => patch({ reminderDefaultDaysBefore: v })} />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>día(s) antes</span>
          </div>
        </Row>
      </section>

      <section style={{ ...sectionStyle, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={sectionTitle}>{t('settings.organize')}</h2>
        <NavLink to="/ajustes/categorias" label={t('categories.title')} />
        <NavLink to="/ajustes/metodos" label={t('methods.title')} />
        <NavLink to="/ajustes/recurrentes" label={t('action.newRecurring')} />
        <NavLink to="/ajustes/presupuestos" label={t('budgets.title')} />
        <NavLink to="/legal" label={t('settings.legal')} />
      </section>

      <CloudSection />
      <AutomationSection />
      <NotificationsSection />

      <section style={sectionStyle}>
        <h2 style={sectionTitle}>{t('settings.yourData')}</h2>
        <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 12px' }}>
          {t('settings.exportAnytime')}
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button type="button" onClick={handleExportJSON} disabled={busy === 'json'} style={secondaryButtonStyle}>
            {busy === 'json' ? t('settings.exporting') : t('settings.exportJSON')}
          </button>
          <button type="button" onClick={handleExportCSV} disabled={busy === 'csv'} style={secondaryButtonStyle}>
            {busy === 'csv' ? t('settings.exporting') : t('settings.exportCSV')}
          </button>
        </div>
        <button type="button" onClick={handleExportXLSX} disabled={busy === 'xlsx'} style={{ ...secondaryButtonStyle, width: '100%', marginBottom: 8 }}>
          {busy === 'xlsx' ? t('settings.buildingExcel') : t('settings.exportExcel')}
        </button>
        <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 12px' }}>
          El Excel es para leer y analizar: trae una hoja por cada cosa, con
          nombres en vez de códigos. Para <strong>restaurar</strong> usa el JSON.
        </p>
        <button type="button" onClick={() => fileInputRef.current?.click()} style={{ ...secondaryButtonStyle, width: '100%' }}>
          {t('settings.import')}
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileChange} style={{ display: 'none' }} />
        {importState.status === 'error' && (
          <p style={{ color: 'var(--danger-text)', fontSize: 12, marginTop: 8 }}>{importState.message}</p>
        )}
      </section>

      {importState.status === 'preview' && (
        <ImportPreviewSheet
          preview={importState.preview}
          onConfirm={confirmImport}
          onCancel={() => setImportState({ status: 'idle' })}
        />
      )}
    </Screen>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 }}>
      <span style={{ fontSize: 14, color: 'var(--text)' }}>{label}</span>
      {children}
    </div>
  );
}

function NavLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 'var(--tap)', padding: '0 14px', borderRadius: 'var(--radius-s)', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', textDecoration: 'none', fontWeight: 600 }}>
      {label}
      <span aria-hidden style={{ color: 'var(--text-faint)' }}>›</span>
    </Link>
  );
}

function NumberInput({ value, onCommit, min = 1, max = 31 }: { value: number; onCommit: (v: number) => void; min?: number; max?: number }) {
  const [text, setText] = useState(String(value));
  return (
    <input
      type="number" inputMode="numeric" min={min} max={max} value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const n = Math.min(max, Math.max(min, Number(text) || value));
        setText(String(n));
        if (n !== value) onCommit(n);
      }}
      className="figures"
      style={smallInputStyle}
    />
  );
}

const sectionStyle: React.CSSProperties = { marginBottom: 'var(--gap-xl)' };
const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 10px' };
const smallInputStyle: React.CSSProperties = { width: 72, minHeight: 36, padding: '0 8px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--text)', textAlign: 'right', fontSize: 14 };
function segmentStyle(active: boolean): React.CSSProperties {
  return { flex: 1, minHeight: 'var(--tap)', borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)', background: active ? 'var(--text)' : 'var(--surface)', color: active ? 'var(--surface)' : 'var(--text)', fontWeight: 600, cursor: 'pointer' };
}
const secondaryButtonStyle: React.CSSProperties = { flex: 1, minHeight: 44, borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' };
