import { describe, expect, it } from 'vitest';
import { interpretarTexto, type ContextoUsuario } from './interpretar';
import { parseUtterance } from './parse';
import { normalize, type ConceptIndexEntry } from '../inference/conceptInference';
import type { PaymentMethod } from '../types';

const HOY = '2026-09-18';

const debito: PaymentMethod = {
  id: 'pm-debito', type: 'debit', name: 'Débito', isDefault: true, updatedAt: '',
};
const tarjeta: PaymentMethod = {
  id: 'pm-credito', type: 'credit', name: 'Tarjeta', isDefault: false,
  cutoffDay: 15, paymentDay: 5, updatedAt: '',
};

function ctx(over: Partial<ContextoUsuario> = {}): ContextoUsuario {
  return {
    conceptIndex: [],
    idsCategorias: ['cat-alimentacion', 'cat-transporte', 'cat-trabajo', 'cat-hogar'],
    metodos: [debito, tarjeta],
    metodoPorDefecto: 'pm-debito',
    ...over,
  };
}

/** Una entrada de historial para el concepto que el parser saque de `texto`. */
function aprendido(texto: string, categoryId: string, paymentMethodId: string | null = null): ConceptIndexEntry {
  const concepto = parseUtterance(texto, HOY).concept;
  return {
    id: normalize(concepto), displayName: concepto, categoryId, paymentMethodId,
    count: 3, lastUsedAt: '2026-09-01T00:00:00Z',
  };
}

describe('interpretarTexto — lo aprendido le gana a la tabla de palabras clave', () => {
  const TEXTO = 'mercado 45 mil';

  it('sin historial usa lo que sugieren las palabras clave', () => {
    const r = interpretarTexto(TEXTO, HOY, ctx());
    expect(r.parsed.amount).toBe(45_000);
    expect(r.categoryId).toBe(r.parsed.categoryIdSugerida);
    expect(r.vieneDeAprendizaje).toBe(false);
  });

  it('con historial, la categoría corregida por el usuario gana', () => {
    const r = interpretarTexto(TEXTO, HOY, ctx({
      conceptIndex: [aprendido(TEXTO, 'cat-trabajo')],
    }));
    expect(r.categoryId).toBe('cat-trabajo');
    expect(r.vieneDeAprendizaje).toBe(true);
    // Y de verdad estamos pisando otra cosa, no coincidiendo por casualidad.
    expect(r.parsed.categoryIdSugerida).not.toBe('cat-trabajo');
  });

  it('una categoría aprendida que ya se borró no se propone', () => {
    const r = interpretarTexto(TEXTO, HOY, ctx({
      conceptIndex: [aprendido(TEXTO, 'cat-que-ya-no-existe')],
      idsCategorias: ['cat-alimentacion'],
    }));
    expect(r.categoryId).not.toBe('cat-que-ya-no-existe');
    expect(r.vieneDeAprendizaje).toBe(false);
  });
});

describe('interpretarTexto — el método de pago', () => {
  it('lo que el texto dice explícitamente manda sobre lo aprendido', () => {
    const r = interpretarTexto('almuerzo 20 mil con la tarjeta', HOY, ctx({
      conceptIndex: [aprendido('almuerzo 20 mil con la tarjeta', 'cat-alimentacion', 'pm-debito')],
    }));
    expect(r.paymentMethodId).toBe('pm-credito');
  });

  it('sin nada explícito, usa lo aprendido antes que el de siempre', () => {
    const r = interpretarTexto('almuerzo 20 mil', HOY, ctx({
      conceptIndex: [aprendido('almuerzo 20 mil', 'cat-alimentacion', 'pm-credito')],
    }));
    expect(r.paymentMethodId).toBe('pm-credito');
  });

  it('sin texto ni historial, cae en el método por defecto', () => {
    const r = interpretarTexto('almuerzo 20 mil', HOY, ctx());
    expect(r.paymentMethodId).toBe('pm-debito');
  });
});
