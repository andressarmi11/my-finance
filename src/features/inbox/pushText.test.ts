import { describe, expect, it } from 'vitest';
import { pushText } from './pushText';

const base = { today: '2026-09-30', currency: 'COP', pending: 1 } as const;

describe('pushText (BANDEJA.md, 3a)', () => {
  it('says what it understood: amount and merchant', () => {
    const { title, body } = pushText('Bancolombia: Compraste $500.000,00 en RESTAURANTE EL CIELO con tu T.Deb *4521', { ...base, language: 'es' });
    expect(title).toBe('Step up');
    expect(body).toMatch(/^Gasto de \$ 500\.000 en /);
    expect(body).toContain('Toca para revisarlo antes de anotarlo.');
  });

  it('without an amount, says so', () => {
    const { body } = pushText('Bancolombia: Compra aprobada en UBER con tu tarjeta.', { ...base, language: 'es' });
    expect(body).toMatch(/No pude leer el monto\./);
    expect(body).not.toMatch(/\$/);
  });

  it('in English, and grouped when several are waiting', () => {
    const { body } = pushText('Nequi: Recibiste $120.000 de JUAN PEREZ.', { ...base, language: 'en', pending: 4 });
    expect(body).toMatch(/^Income of \$ 120\.000 from /);
    expect(body).toContain('4 to review. Tap to see them.');
  });

  it('the committed bundle for the Edge Function says the same (npm run build:push-text)', async () => {
    // Behaviour, not bytes: a text elsewhere in the dictionary changing must
    // not force a rebuild; the parser or a push text changing must.
    // @ts-expect-error generated plain JS, no types
    const bundled = (await import('../../../supabase/functions/ingest/pushText.gen.js')) as { pushText: typeof pushText };
    const samples = [
      'Bancolombia: Compraste $500.000,00 en RESTAURANTE EL CIELO con tu T.Deb *4521',
      'Bancolombia: Compra aprobada en UBER.',
      'Nequi: Recibiste $120.000 de JUAN PEREZ.',
      'gasté 20 dólares en efectivo en un taxi',
      'Bancolombia: Se programó un débito automático de $44.900 a NETFLIX.COM para el 05/10/2026.',
      '???',
    ];
    for (const text of samples) {
      for (const language of ['es', 'en'] as const) {
        for (const pending of [1, 3]) {
          const opts = { ...base, language, pending };
          expect(bundled.pushText(text, opts), `${text} / ${language} — run npm run build:push-text`).toEqual(pushText(text, opts));
        }
      }
    }
  });
});
