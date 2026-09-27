/**
 * Filtros de la lista: tipo y estado.
 *
 * Son PRESENTACION, no dominio: acotan lo que se lista y no tocan el
 * balance del encabezado. Si el filtro cambiara ese numero, elegir "Gastos"
 * mostraria un restante negativo que no existe — el restante de una
 * quincena es el de la quincena, no el de lo que dejaste visible.
 */
import type { Transaction } from '@/domain/types';

export type FiltroTipo = 'todos' | 'expense' | 'income';
export type FiltroEstado = 'todos' | 'pendientes' | 'pagados';

/**
 * "Pendientes" incluye los PROGRAMADOS.
 *
 * TransactionStatus tiene cuatro valores y el codigo los agrupaba de dos
 * formas distintas segun el archivo: porPagar.ts separa pending de
 * scheduled pero los suma juntos, upcoming.ts los funde, available.ts solo
 * mira si es paid. Un filtro obliga a elegir una, y se elige la que ya
 * usan dos de los tres y la que significa para el usuario: "lo que falta".
 *
 * `cancelled` no aparece bajo NINGUN filtro: un movimiento cancelado no es
 * ni pendiente ni pagado.
 */
export function aplicarFiltros<T extends Transaction>(
  transacciones: T[],
  tipo: FiltroTipo,
  estado: FiltroEstado,
): T[] {
  if (tipo === 'todos' && estado === 'todos') return transacciones;

  return transacciones.filter((tx) => {
    if (tipo !== 'todos' && tx.type !== tipo) return false;
    if (estado === 'pagados') return tx.status === 'paid';
    if (estado === 'pendientes') return tx.status === 'pending' || tx.status === 'scheduled';
    return true;
  });
}
