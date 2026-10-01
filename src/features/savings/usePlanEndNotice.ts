import { useEffect } from 'react';
import { useActivePlan } from '@/data/local/savingsPlans';
import { useT } from '@/i18n/language';
import { todayISO } from '@/lib/todayISO';

const KEY = 'stepup.planEndNotified';

/**
 * The plan ended (PRESUPUESTOS-Y-AHORRO.md, "Al llegar endDate"): one
 * notification, the first time the app opens after the end date, if the
 * user already allowed notifications. Análisis shows "¿Renovar o terminar?"
 * either way. Local on purpose: a server push would need a new job for a
 * date only this device has to look at.
 */
export function usePlanEndNotice(): void {
  const plan = useActivePlan();
  const t = useT();
  useEffect(() => {
    if (!plan || plan.endDate >= todayISO()) return;
    let notified: string | null = null;
    try { notified = localStorage.getItem(KEY); } catch { /* private mode */ }
    if (notified === plan.id) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try { localStorage.setItem(KEY, plan.id); } catch { /* private mode: may repeat, harmless */ }
    const title = t('save.endNotifTitle');
    const body = t('save.endNotifBody');
    void navigator.serviceWorker?.ready
      .then((reg) => reg.showNotification(title, { body, tag: `plan-end-${plan.id}`, data: { url: 'analisis' } }))
      .catch(() => { /* no service worker: the notice in Análisis is enough */ });
  }, [plan, t]);
}
