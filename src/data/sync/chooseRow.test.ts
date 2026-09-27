import { describe, expect, it } from 'vitest';
import { elegirFila } from './syncService';

const cat = (name: string, updatedAt: string) => ({ id: 'cat-hogar', name, updatedAt });

describe('elegirFila', () => {
  it('EL BUG: renombrar una categoría ya no se deshace solo', () => {
    // Secuencia real, con un solo dispositivo y con internet:
    //   el usuario renombra "Hogar" -> "Casa" (se guarda solo en local)
    //   el ciclo de sync empieza BAJANDO, y la nube todavía dice "Hogar"
    // Antes el pull hacía bulkPut ciego y "Casa" moría ahí.
    const local = cat('Casa', '2026-09-18T20:00:00Z');
    const remota = cat('Hogar', '2026-09-18T19:00:00Z');
    expect(elegirFila(local, remota).name).toBe('Casa');
  });

  it('un cambio hecho en otro dispositivo sí entra', () => {
    const local = cat('Hogar', '2026-09-18T19:00:00Z');
    const remota = cat('Casa', '2026-09-18T20:00:00Z');
    expect(elegirFila(local, remota).name).toBe('Casa');
  });

  it('una fila que no existe local entra tal cual', () => {
    expect(elegirFila(undefined, cat('Hogar', 'T')).name).toBe('Hogar');
  });

  it('las filas viejas sin fecha pierden: la migración es gratis', () => {
    // Quien ya tenía la app tiene filas sin updatedAt. Gana lo remoto,
    // que es exactamente el comportamiento anterior al arreglo.
    const local = cat('vieja', '');
    const remota = cat('nube', '2026-09-18T19:00:00Z');
    expect(elegirFila(local, remota).name).toBe('nube');
  });

  it('empate: se queda lo local, que es lo que el usuario está viendo', () => {
    const t = '2026-09-18T20:00:00Z';
    expect(elegirFila(cat('local', t), cat('nube', t)).name).toBe('local');
  });
});
