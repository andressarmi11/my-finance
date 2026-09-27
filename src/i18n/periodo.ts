/**
 * Las etiquetas de periodo, fuera de React.
 *
 * "Quincena del 10" se arma en funciones puras —groupByPeriodo, y el
 * encabezado del dashboard— que no son componentes y no pueden usar un
 * hook. Se leen del mismo estado de modulo que los meses.
 *
 * En ingles no se dice "fortnight": lo que nombra esto es el periodo entre
 * dos pagos de nomina, y "pay period" es como se llama. Traducirlo literal
 * habria sido correcto y a la vez incomprensible.
 */
let idiomaActual: 'es' | 'en' = 'es';

export function setIdiomaDePeriodo(idioma: 'es' | 'en'): void {
  idiomaActual = idioma;
}

/**
 * "Quincena del" / "From the" — le sigue el dia.
 *
 * En ingles se queda corto a proposito: "Pay period from the 10" se partia
 * en dos lineas en la tarjeta del dashboard y empujaba el monto fuera de
 * vista. En contexto —una tarjeta de periodo, un encabezado de grupo— "From
 * the 10" se entiende y cabe donde el español cabe.
 */
export function etiquetaQuincena(): string {
  return idiomaActual === 'en' ? 'From the' : 'Quincena del';
}

/** Para quien cobra una vez al mes y no el día 1. */
export function etiquetaMesDesde(): string {
  return idiomaActual === 'en' ? 'Month from the' : 'Mes desde el';
}
