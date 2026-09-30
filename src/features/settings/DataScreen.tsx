import { useRef, useState } from 'react';
import { IconDownload, IconUpload } from '@tabler/icons-react';
import { Screen } from '@/components/ui/Screen';
import { useT } from '@/i18n/language';
import type { TextKey } from '@/i18n/texts';
import {
  exportBackupJSON, exportBackupXLSX, exportTransactionsCSV, importBackup, parseBackupFile, type BackupPreview,
} from '@/data/backup/exportImport';
import type { Backup } from '@/data/backup/schema';
import { ImportPreviewSheet } from './ImportPreviewSheet';
import { SettingsGroup, noteStyle, rowStyle, useSettingsBack } from './ui';

type Kind = 'json' | 'csv' | 'xlsx';

const EXPORTS: Array<{ kind: Kind; label: TextKey; sub: TextKey; badge: string; tint: string; run: () => Promise<unknown> }> = [
  { kind: 'json', label: 'settings.exportJSON', sub: 'set.exportJsonSub', badge: '{ }', tint: 'var(--q10)', run: exportBackupJSON },
  { kind: 'csv', label: 'settings.exportCSV', sub: 'set.exportCsvSub', badge: 'CSV', tint: 'var(--positive)', run: exportTransactionsCSV },
  { kind: 'xlsx', label: 'settings.exportExcel', sub: 'set.exportXlsxSub', badge: 'XLS', tint: 'var(--positive)', run: exportBackupXLSX },
];

/**
 * Tus datos (redesign §9e): "Exportar" (JSON, CSV, Excel, each with what
 * it's for) and "Restaurar" (import a JSON backup, confirmed with
 * ImportPreviewSheet because it replaces everything). The export and
 * import logic is the one Settings always had.
 */
export function DataScreen() {
  const t = useT();
  const back = useSettingsBack();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<Kind | 'import' | null>(null);
  const [importState, setImportState] = useState<
    { status: 'idle' } | { status: 'error'; message: string } | { status: 'preview'; backup: Backup; preview: BackupPreview }
  >({ status: 'idle' });

  async function run(kind: Kind, fn: () => Promise<unknown>) {
    setBusy(kind);
    try { await fn(); } finally { setBusy(null); }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const result = parseBackupFile(await file.text());
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

  return (
    <Screen title={t('settings.yourData')} subtitle={t('settings.exportAnytime')} back={back}>
      <SettingsGroup title={t('set.export')}>
        {EXPORTS.map((x) => (
          <button key={x.kind} type="button" disabled={busy === x.kind} onClick={() => run(x.kind, x.run)} style={{ ...rowStyle, minHeight: 58 }}>
            <Badge tint={x.tint}>{x.badge}</Badge>
            <span style={{ flex: 1, padding: '8px 0' }}>
              <span style={{ display: 'block', fontSize: 'var(--text-md)' }}>
                {busy === x.kind ? (x.kind === 'xlsx' ? t('settings.buildingExcel') : t('settings.exporting')) : t(x.label)}
              </span>
              <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{t(x.sub)}</span>
            </span>
            <IconDownload aria-hidden size={20} stroke={2} style={{ color: 'var(--q10)', flex: 'none' }} />
          </button>
        ))}
      </SettingsGroup>

      <SettingsGroup title={t('set.restore')} note={t('set.excelVsJson')}>
        <button type="button" onClick={() => fileInputRef.current?.click()} style={{ ...rowStyle, minHeight: 58 }}>
          <Badge tint="var(--q25)"><IconUpload size={18} stroke={2} /></Badge>
          <span style={{ flex: 1, padding: '8px 0' }}>
            <span style={{ display: 'block', fontSize: 'var(--text-md)' }}>{t('settings.import')}</span>
            <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{t('set.importSub')}</span>
          </span>
        </button>
      </SettingsGroup>
      <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileChange} style={{ display: 'none' }} />
      {importState.status === 'error' && (
        <p role="alert" style={{ ...noteStyle, color: 'var(--danger-text)' }}>{importState.message}</p>
      )}

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

function Badge({ tint, children }: { tint: string; children: React.ReactNode }) {
  return (
    <span aria-hidden style={{
      width: 34, height: 34, borderRadius: 10, background: 'var(--surface-sunken)', color: tint, flex: 'none',
      display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700,
    }}>
      {children}
    </span>
  );
}
