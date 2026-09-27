import { describe, expect, it } from 'vitest';
import { debeLimpiar } from './dueno';

/**
 * La tabla de decisión completa. El caso que importa es el tercero: sin
 * él, los movimientos de una persona terminaban subidos a la cuenta de
 * otra que usara el mismo navegador.
 */
describe('debeLimpiar — de quién son los datos de este dispositivo', () => {
  it('sin marca previa NO borra: es quien usó la app sin cuenta y ahora se registra', () => {
    expect(debeLimpiar(null, 'ana')).toBe(false);
  });

  it('la misma persona volviendo a entrar NO borra', () => {
    expect(debeLimpiar('ana', 'ana')).toBe(false);
  });

  it('otra persona SÍ borra', () => {
    expect(debeLimpiar('ana', 'beto')).toBe(true);
  });

  it('distingue ids parecidos: no alcanza con que empiecen igual', () => {
    expect(debeLimpiar('user-1', 'user-10')).toBe(true);
    expect(debeLimpiar('user-10', 'user-1')).toBe(true);
  });

  it('la cadena vacía es una marca válida, no un "no hay marca"', () => {
    // Si se tratara como ausente, un id vacío adoptaría datos ajenos.
    expect(debeLimpiar('', 'ana')).toBe(true);
  });
});
