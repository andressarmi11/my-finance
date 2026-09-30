import type { BackupPreview } from '@/data/backup/exportImport';
import { useDialogo } from '@/components/ui/useDialogo';
import { useT } from '@/i18n/language';

export function ImportPreviewSheet({ preview, onConfirm, onCancel }: {
  preview: BackupPreview;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();

  const dialogRef = useDialogo(onCancel);
  return (
    <div
      ref={dialogRef}
      role="dialog" aria-label={t('import.confirmLabel')}
      style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, black 40%, transparent)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }}
      onClick={onCancel}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, margin: '0 auto', background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '10px 20px calc(var(--safe-bottom) + 20px)' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '4px auto 16px' }} />
        <p style={{ fontWeight: 700, margin: '0 0 6px' }}>{t('import.contains')}</p>
        <ul style={{ margin: '0 0 12px', paddingLeft: 18, color: 'var(--text-muted)', fontSize: 14 }}>
          <li>{preview.transactions} {t('set.importTransactions')}</li>
          <li>{preview.categories} {t('import.categories')}</li>
          <li>{preview.paymentMethods} {t('import.paymentMethods')}</li>
          <li>{preview.recurringRules} {t('import.recurringRules')}</li>
          <li>{preview.budgets} {t('set.importBudgets')}</li>
        </ul>
        <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-s)', padding: 12, marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--danger-text)' }}>
            {t('set.importThis')} <strong>{t('import.replacesEverything')}</strong> {t('import.cannotUndo')}
          </p>
        </div>
        <button type="button" onClick={onConfirm} style={{ width: '100%', minHeight: 48, borderRadius: 'var(--radius-s)', border: 'none', background: 'var(--danger)', color: 'var(--on-accent)', fontWeight: 700, fontSize: 16, cursor: 'pointer', marginBottom: 10 }}>
          {t('import.confirmReplace')}
        </button>
        <button type="button" onClick={onCancel} style={{ width: '100%', minHeight: 44, borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>
          {t('action.cancel')}
        </button>
      </div>
    </div>
  );
}
