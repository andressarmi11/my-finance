import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/i18n/language';
import { InboxSheet } from './InboxSheet';

// No component-test setup in the repo, so this renders to a string: enough to
// prove the future-dated pill and button, which is what the design changes.
function render(text: string): string {
  const entry = { id: 'e1', text, origen: 'sms', createdAt: '2026-01-01T00:00:00Z' };
  return renderToStaticMarkup(
    createElement(LanguageProvider, null, createElement(InboxSheet, { entradas: [entry], onClose: () => {}, onCambio: () => {} })),
  );
}

describe('InboxSheet', () => {
  // Node reports en-US; the assertions below are in Spanish.
  beforeAll(() => { vi.stubGlobal('navigator', { language: 'es-CO' }); });

  it('shows the Scheduled pill, the note and "Programar" for a future date', () => {
    const html = render('gasté 45 mil en almuerzo mañana');
    expect(html).toContain('Programado ·');
    expect(html).toContain('No se descuenta hoy: queda pendiente para el');
    expect(html).toMatch(/aria-label="Programar .* para el /);
  });

  it('keeps "Anotar" and no pill for something that already happened', () => {
    const html = render('gasté 45 mil en almuerzo hoy');
    expect(html).toContain('Anotar');
    expect(html).not.toContain('Programado');
  });
});
