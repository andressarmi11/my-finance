/**
 * Smoke test without a DOM: the editor isn't mounted anywhere yet (phase 6
 * mounts it), so this is what proves it renders both modes and the preview.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '@/i18n/language';
import type { ReminderRule } from '@/domain/types';
import { ReminderRuleEditor } from './ReminderRuleEditor';

function render(value: ReminderRule): string {
  return renderToStaticMarkup(
    createElement(LanguageProvider, null, createElement(ReminderRuleEditor, { value, onChange: () => {} })),
  );
}

// The provider picks the language from navigator; pin Spanish, the reference.
beforeAll(() => { vi.stubGlobal('navigator', { language: 'es-CO' }); });

const base: ReminderRule = { mode: 'days', days: 1, time: '09:00', sameDay: { kind: 'hours', value: 1 } };

describe('ReminderRuleEditor', () => {
  it('days mode: segmented, day stepper, time and the preview', () => {
    const html = render(base);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('9:00 a. m.');
    expect(html).toContain('GYM vence mañana');
    expect(html).toContain('Salud · Débito');
    expect(html).not.toContain('type="radio"');
    expect(html).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it('same-day mode: the four radios, the chosen one checked', () => {
    const html = render({ ...base, mode: 'sameDay', sameDay: { kind: 'minutes', value: 30 } });
    expect(html.match(/type="radio"/g)).toHaveLength(4);
    expect(html).toContain('Minutos antes');
    expect(html).toContain('A una hora exacta');
    expect(html).toContain('8:00 a. m.'); // the "at" stepper's default
    expect(html).toContain('GYM vence en 30 min');
    expect(html.match(/checked=""/g)).toHaveLength(1);
  });

  it('the selected stepper shows the value it was given', () => {
    expect(render({ ...base, mode: 'sameDay', sameDay: { kind: 'minutes', value: 45 } })).toContain('>45<');
    expect(render({ ...base, mode: 'sameDay', sameDay: { kind: 'hours', value: 5 } })).toContain('>5<');
    expect(render({ ...base, mode: 'sameDay', sameDay: { kind: 'at', value: '06:30' } })).toContain('6:30 a. m.');
  });

  it('preview follows the rule', () => {
    expect(render({ ...base, days: 3, time: '18:30' })).toContain('GYM vence en 3 días');
    expect(render({ ...base, mode: 'sameDay', sameDay: { kind: 'at', value: '07:00' } })).toContain('GYM vence hoy');
    expect(render({ ...base, mode: 'sameDay', sameDay: { kind: 'hours', value: 2 } })).toContain('GYM vence en 2 horas');
  });
});
