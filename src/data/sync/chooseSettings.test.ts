import { describe, expect, it } from 'vitest';
import { elegirSettings } from './syncService';
import type { Settings } from '@/domain/types';

function s(overrides: Partial<Settings>): Settings {
  return {
    id: 'singleton', displayName: '', currency: 'COP', locale: 'es-CO',
    diasDePago: [10, 25], defaultPaymentMethodId: null,
    reminderDefaultDaysBefore: 1, theme: 'system', onboardedAt: null,
    updatedAt: '', ...overrides,
  };
}

describe('elegirSettings', () => {
  it('sin nada local, se queda con lo remoto', () => {
    const remoto = s({ displayName: 'Andrés', updatedAt: '2026-09-18T10:00:00Z' });
    expect(elegirSettings(undefined, remoto)).toBe(remoto);
  });

  it('gana el más nuevo', () => {
    const viejo = s({ displayName: 'viejo', updatedAt: '2026-09-01T00:00:00Z' });
    const nuevo = s({ displayName: 'nuevo', updatedAt: '2026-09-18T00:00:00Z' });
    expect(elegirSettings(viejo, nuevo).displayName).toBe('nuevo');
    expect(elegirSettings(nuevo, viejo).displayName).toBe('nuevo');
  });

  it('EL BUG: la nube sin fila no pisa la configuración inicial recién hecha', () => {
    // Lo que devuelve supabaseRepository cuando todavía no hay fila.
    const nubeVacia = s({ updatedAt: '', onboardedAt: null });
    const recienConfigurado = s({
      displayName: 'Andrés',
      onboardedAt: '2026-09-18T12:00:00Z',
      updatedAt: '2026-09-18T12:00:00Z',
    });
    const elegido = elegirSettings(recienConfigurado, nubeVacia);
    expect(elegido.onboardedAt).toBe('2026-09-18T12:00:00Z');
    expect(elegido.displayName).toBe('Andrés');
  });

  it('una fila remota vieja tampoco pisa lo local nuevo', () => {
    // El estado real en el que quedó la cuenta: la nube guardó onboarded_at
    // null en el primer login, antes de que se completara la configuración.
    const nubeConNull = s({ onboardedAt: null, updatedAt: '2026-09-18T18:09:43Z' });
    const local = s({ onboardedAt: '2026-09-18T19:00:00Z', updatedAt: '2026-09-18T19:00:00Z' });
    expect(elegirSettings(local, nubeConNull).onboardedAt).not.toBeNull();
  });

  it('una fecha local inválida no bloquea lo remoto', () => {
    const local = s({ updatedAt: 'no-es-fecha' });
    const remoto = s({ displayName: 'nube', updatedAt: '2026-09-18T00:00:00Z' });
    expect(elegirSettings(local, remoto).displayName).toBe('nube');
  });

  it('empate: se queda lo local, que es lo que el usuario está viendo', () => {
    const t = '2026-09-18T12:00:00Z';
    const local = s({ displayName: 'local', updatedAt: t });
    const remoto = s({ displayName: 'nube', updatedAt: t });
    expect(elegirSettings(local, remoto).displayName).toBe('local');
  });
});
