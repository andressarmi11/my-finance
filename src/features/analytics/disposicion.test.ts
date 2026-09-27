import { beforeEach, describe, expect, it } from 'vitest';

/* El entorno de vitest es 'node' (ver vite.config.ts), asi que no hay
   localStorage. Se simula aca en vez de sumar jsdom como dependencia por
   un solo archivo de prueba. */
const almacen = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => almacen.get(k) ?? null,
  setItem: (k: string, v: string) => { almacen.set(k, v); },
  removeItem: (k: string) => { almacen.delete(k); },
  clear: () => { almacen.clear(); },
  key: (i: number) => [...almacen.keys()][i] ?? null,
  get length() { return almacen.size; },
};

beforeEach(() => almacen.clear());

import { alternarOculto, leerDisposicion, mover, ORDEN_POR_DEFECTO, type GraficoId } from './disposicion';

describe('mover', () => {
  const orden: GraficoId[] = ['balance-categoria', 'presupuestos', 'distribucion'];

  it('sube un gráfico una posición', () => {
    expect(mover(orden, 'presupuestos', -1)).toEqual(['presupuestos', 'balance-categoria', 'distribucion']);
  });

  it('baja un gráfico una posición', () => {
    expect(mover(orden, 'presupuestos', 1)).toEqual(['balance-categoria', 'distribucion', 'presupuestos']);
  });

  it('el primero no puede subir ni el último bajar', () => {
    expect(mover(orden, 'balance-categoria', -1)).toEqual(orden);
    expect(mover(orden, 'distribucion', 1)).toEqual(orden);
  });

  it('no revienta con un id que no está', () => {
    expect(mover(orden, 'debito-credito', -1)).toEqual(orden);
  });
});

describe('alternarOculto', () => {
  it('oculta y vuelve a mostrar', () => {
    const uno = alternarOculto([], 'distribucion');
    expect(uno).toEqual(['distribucion']);
    expect(alternarOculto(uno, 'distribucion')).toEqual([]);
  });
});

describe('leerDisposicion', () => {
  it('sin nada guardado devuelve el orden de fábrica', () => {
    localStorage.clear();
    expect(leerDisposicion().orden).toEqual(ORDEN_POR_DEFECTO);
  });

  /* El caso que importa al evolucionar la app: alguien acomodó su orden
     hace meses y despues se agrego un grafico nuevo. Sin reconciliar, ese
     grafico quedaria invisible para siempre. */
  it('agrega al final los gráficos que no estaban cuando se guardó', () => {
    localStorage.setItem('step-up:analisis-disposicion',
      JSON.stringify({ orden: ['distribucion', 'balance-categoria'], ocultos: [] }));
    const { orden } = leerDisposicion();
    expect(orden.slice(0, 2)).toEqual(['distribucion', 'balance-categoria']);
    expect(orden).toHaveLength(ORDEN_POR_DEFECTO.length);
    expect(new Set(orden)).toEqual(new Set(ORDEN_POR_DEFECTO));
  });

  it('descarta ids que ya no existen', () => {
    localStorage.setItem('step-up:analisis-disposicion',
      JSON.stringify({ orden: ['fantasma', 'presupuestos'], ocultos: ['otro-fantasma'] }));
    const d = leerDisposicion();
    expect(d.orden).not.toContain('fantasma');
    expect(d.ocultos).toEqual([]);
  });

  it('un JSON corrupto no rompe la pantalla', () => {
    localStorage.setItem('step-up:analisis-disposicion', '{roto');
    expect(leerDisposicion().orden).toEqual(ORDEN_POR_DEFECTO);
  });
});
