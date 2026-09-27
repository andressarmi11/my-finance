/**
 * Interpretar un texto libre ("mercado 45 mil con la tarjeta") y decidir
 * qué categoría y qué método proponer.
 *
 * Existe porque esto se hacía en tres lugares — la entrada rápida, la
 * bandeja y el enlace del Atajo — y el tercero lo hacía distinto: usaba
 * solo la tabla de palabras clave y nunca miraba lo aprendido. O sea que
 * corregías "Uber" a otra categoría, la app lo aprendía, y al entrar por
 * el Atajo volvía a proponer la de siempre. Con una sola función los tres
 * caminos aprenden igual.
 */
import { parseUtterance, type Parsed } from './parse';
import { categoriaFinal, metodoPorTipo } from './resolve';
import { inferFromConcept, type ConceptIndexEntry, type InferenceResult } from '../inference/conceptInference';
import type { Id, ISODate, PaymentMethod } from '../types';

export interface ContextoUsuario {
  /** Lo que la app ya aprendió de los guardados anteriores. */
  conceptIndex: ConceptIndexEntry[];
  /** Ids de las categorías que existen HOY: una aprendida que se borró no sirve. */
  idsCategorias: Id[];
  metodos: PaymentMethod[];
  metodoPorDefecto: Id | null;
}

export interface Interpretacion {
  parsed: Parsed;
  categoryId: Id | null;
  paymentMethodId: Id | null;
  aprendida: InferenceResult | null;
  /** La categoría salió del historial, no de la tabla de palabras clave. */
  vieneDeAprendizaje: boolean;
}

export function interpretarTexto(texto: string, hoy: ISODate, ctx: ContextoUsuario): Interpretacion {
  const parsed = parseUtterance(texto, hoy);

  // Se le pasa null como base a propósito: interesa saber si el historial
  // dice algo por sí solo, no confirmar lo que ya veníamos suponiendo.
  const aprendida = parsed.concept
    ? inferFromConcept(parsed.concept, ctx.conceptIndex, { categoryId: null, paymentMethodId: null })
    : null;

  // Lo aprendido primero, la tabla de palabras clave como piso.
  const categoryId = categoriaFinal(aprendida?.categoryId ?? null, parsed.categoryIdSugerida, ctx.idsCategorias);

  // El método que el texto nombra gana ("con la tarjeta" es explícito);
  // después lo aprendido, y al final el de siempre.
  const paymentMethodId =
    metodoPorTipo(ctx.metodos, parsed.metodo)
    ?? aprendida?.paymentMethodId
    ?? ctx.metodoPorDefecto
    ?? ctx.metodos.find((m) => m.isDefault)?.id
    ?? null;

  return {
    parsed,
    categoryId,
    paymentMethodId,
    aprendida,
    vieneDeAprendizaje: Boolean(aprendida?.source) && categoryId === aprendida?.categoryId,
  };
}
