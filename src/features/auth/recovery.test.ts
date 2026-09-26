import { describe, expect, it } from 'vitest';
import { esUrlDeRecuperacion } from './recovery';

const BASE = 'https://andressarmi11.github.io/step-up/';

describe('esUrlDeRecuperacion', () => {
  it('reconoce el flujo implícito, con el token en el fragmento', () => {
    expect(esUrlDeRecuperacion(
      `${BASE}#access_token=abc&expires_in=3600&refresh_token=xyz&token_type=bearer&type=recovery`,
    )).toBe(true);
  });

  it('reconoce el flujo PKCE, con type en el query', () => {
    expect(esUrlDeRecuperacion(`${BASE}?code=abc&type=recovery`)).toBe(true);
  });

  it('no confunde el enlace de confirmar correo con el de recuperar', () => {
    expect(esUrlDeRecuperacion(`${BASE}#access_token=abc&type=signup`)).toBe(false);
    expect(esUrlDeRecuperacion(`${BASE}#access_token=abc&type=magiclink`)).toBe(false);
  });

  it('una URL normal de la app no activa el modo', () => {
    expect(esUrlDeRecuperacion(BASE)).toBe(false);
    expect(esUrlDeRecuperacion(`${BASE}movimientos?nuevo=1&tipo=ingreso`)).toBe(false);
  });

  it('no explota con basura', () => {
    expect(esUrlDeRecuperacion('no-es-una-url')).toBe(false);
    expect(esUrlDeRecuperacion('')).toBe(false);
  });
});
