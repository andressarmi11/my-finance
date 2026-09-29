import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

/**
 * The service worker's push handler (public/push-sw.js), run against a fake
 * worker scope. Headless Chromium refuses notification permission, so an
 * end-to-end test can't see the notification; this checks the one thing
 * that was missing — that a push is turned into showNotification.
 */
function loadWorker() {
  const listeners: Record<string, (event: unknown) => void> = {};
  const showNotification = vi.fn(async () => {});
  const self = {
    addEventListener: (type: string, fn: (event: unknown) => void) => { listeners[type] = fn; },
    registration: { showNotification },
    clients: { matchAll: vi.fn(async () => []), openWindow: vi.fn(async () => null) },
  };
  const code = readFileSync(new URL('../../public/push-sw.js', import.meta.url), 'utf8');
  new Function('self', code)(self);
  return { listeners, showNotification, self };
}

function pushEvent(data: unknown) {
  let waited: Promise<unknown> | undefined;
  return {
    event: {
      data: data === undefined ? null : {
        json: () => (typeof data === 'string' ? JSON.parse(data) : data),
        text: () => String(data),
      },
      waitUntil: (p: Promise<unknown>) => { waited = p; },
    },
    done: () => waited,
  };
}

describe('push-sw.js', () => {
  it('shows the reminder the server sent', async () => {
    const { listeners, showNotification } = loadWorker();
    const { event, done } = pushEvent({ title: 'Step up', body: 'Recuerda: Arriendo — $1.500.000' });
    listeners.push!(event);
    await done();
    expect(showNotification).toHaveBeenCalledWith('Step up', expect.objectContaining({ body: 'Recuerda: Arriendo — $1.500.000' }));
  });

  it('still shows something when the payload is not JSON', async () => {
    const { listeners, showNotification } = loadWorker();
    const { event, done } = pushEvent('texto plano');
    listeners.push!(event);
    await done();
    expect(showNotification).toHaveBeenCalledWith('Step up', expect.objectContaining({ body: 'texto plano' }));
  });

  it('tapping the notification opens the app', async () => {
    const { listeners, self } = loadWorker();
    let waited: Promise<unknown> | undefined;
    listeners.notificationclick!({ notification: { close: vi.fn() }, waitUntil: (p: Promise<unknown>) => { waited = p; } });
    await waited;
    expect(self.clients.openWindow).toHaveBeenCalled();
  });
});
