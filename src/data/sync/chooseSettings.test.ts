import { describe, expect, it } from 'vitest';
import { chooseSettings } from './syncService';
import type { Settings } from '@/domain/types';

function s(overrides: Partial<Settings>): Settings {
  return {
    id: 'singleton', displayName: '', currency: 'COP', locale: 'es-CO',
    payDays: [10, 25], defaultPaymentMethodId: null,
    reminderDefaultDaysBefore: 1, theme: 'system', onboardedAt: null,
    updatedAt: '', ...overrides,
  };
}

describe('elegirSettings', () => {
  it('with nothing local, keeps the remote one', () => {
    const remoteRow = s({ displayName: 'Andrés', updatedAt: '2026-09-18T10:00:00Z' });
    expect(chooseSettings(undefined, remoteRow)).toBe(remoteRow);
  });

  it('the newest one wins', () => {
    const old = s({ displayName: 'viejo', updatedAt: '2026-09-01T00:00:00Z' });
    const nuevo = s({ displayName: 'nuevo', updatedAt: '2026-09-18T00:00:00Z' });
    expect(chooseSettings(old, nuevo).displayName).toBe('nuevo');
    expect(chooseSettings(nuevo, old).displayName).toBe('nuevo');
  });

  it('THE BUG: the cloud with no row does not overwrite settings just configured', () => {
    // What supabaseRepository returns when there is no row yet.
    const emptyCloud = s({ updatedAt: '', onboardedAt: null });
    const justConfigured = s({
      displayName: 'Andrés',
      onboardedAt: '2026-09-18T12:00:00Z',
      updatedAt: '2026-09-18T12:00:00Z',
    });
    const chosen = chooseSettings(justConfigured, emptyCloud);
    expect(chosen.onboardedAt).toBe('2026-09-18T12:00:00Z');
    expect(chosen.displayName).toBe('Andrés');
  });

  it('an old remote row also does not overwrite the new local one', () => {
    // The real state the account ended up in: the cloud stored
    // onboarded_at as null on the first login, before setup was finished.
    const cloudWithNull = s({ onboardedAt: null, updatedAt: '2026-09-18T18:09:43Z' });
    const local = s({ onboardedAt: '2026-09-18T19:00:00Z', updatedAt: '2026-09-18T19:00:00Z' });
    expect(chooseSettings(local, cloudWithNull).onboardedAt).not.toBeNull();
  });

  it('an invalid local date does not block the remote one', () => {
    const local = s({ updatedAt: 'no-es-fecha' });
    const remoteRow = s({ displayName: 'nube', updatedAt: '2026-09-18T00:00:00Z' });
    expect(chooseSettings(local, remoteRow).displayName).toBe('nube');
  });

  it('tie: the local one stays, since that is what the user is looking at', () => {
    const t = '2026-09-18T12:00:00Z';
    const local = s({ displayName: 'local', updatedAt: t });
    const remoteRow = s({ displayName: 'nube', updatedAt: t });
    expect(chooseSettings(local, remoteRow).displayName).toBe('local');
  });
});
