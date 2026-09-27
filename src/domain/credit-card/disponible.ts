/**
 * Cupo y disponible de una tarjeta, y los saldos que quedaron sin pagar.
 *
 * El disponible sale de los propios movimientos, no de un saldo que el
 * usuario escriba a mano ni de una integracion bancaria: cupo menos lo
 * comprado que todavia no esta marcado como pagado.
 *
 * Eso implica que el numero depende de que el usuario marque los ciclos
 * como pagados. Por eso existe saldosSinPagar() y por eso el dashboard lo
 * muestra: si nadie recuerda marcar, el disponible se desvia en silencio.
 */
import type { ISODate, PaymentMethod, Transaction } from '../types';

export interface Disponible {
  cupo: number;
  usado: number;
  /** cupo - usado. Negativo = sobrecupo, y se muestra asi. */
  disponible: number;
}

/**
 * `null` cuando la tarjeta no tiene cupo configurado: no hay disponible
 * que mostrar, y devolver cupo 0 seria mentir.
 *
 * Solo cuenta compras con fecha <= hoy. Sin ese filtro las recurrentes
 * —que materialize.ts siembra con status 'pending' hasta unos tres meses
 * adelante— apareceran como cupo consumido por compras que todavia no se
 * han hecho. Una compra futura no consume cupo.
 */
export function calcularDisponible(
  tarjeta: PaymentMethod,
  transacciones: Transaction[],
  hoy: ISODate,
): Disponible | null {
  if (tarjeta.creditLimit === undefined) return null;

  let usado = 0;
  for (const tx of transacciones) {
    if (!consumeCupo(tx, tarjeta.id, hoy)) continue;
    usado += tx.amount;
  }

  return { cupo: tarjeta.creditLimit, usado, disponible: tarjeta.creditLimit - usado };
}

function consumeCupo(tx: Transaction, tarjetaId: string, hoy: ISODate): boolean {
  return (
    tx.paymentMethodId === tarjetaId &&
    tx.type === 'expense' &&
    tx.status !== 'paid' &&
    tx.status !== 'cancelled' &&
    // purchaseDate y no date: una compra diferida bloquea el cupo entero
    // el dia que la pasas, no cuota a cuota — es lo que hace el banco. La
    // cuota 7 tiene fecha futura pero su compra ya ocurrio. El ?? deja
    // intacto todo lo que no es diferido.
    (tx.purchaseDate ?? tx.date) <= hoy
  );
}

export interface SaldoSinPagar {
  tarjeta: PaymentMethod;
  paymentDate: ISODate;
  total: number;
  count: number;
}

/**
 * Los ciclos cuya fecha de pago YA paso y siguen sin marcarse pagados.
 *
 * No reutiliza domain/totals/porPagar.ts a proposito: aquel mira el mes en
 * curso y mezcla pendientes, programados y tarjeta. Este mira hacia atras,
 * solo tarjeta y solo vencido. Son preguntas distintas.
 *
 * Ordenados del mas viejo al mas nuevo: el que lleva mas tiempo sin pagar
 * es el que mas urge.
 */
export function saldosSinPagar(
  tarjetas: PaymentMethod[],
  transacciones: Transaction[],
  hoy: ISODate,
): SaldoSinPagar[] {
  const porTarjeta = new Map(tarjetas.map((t) => [t.id, t]));
  // Una tarjeta y un ciclo identifican el saldo; dos tarjetas pueden pagar
  // el mismo dia y no deben sumarse en una sola fila.
  const acumulado = new Map<string, SaldoSinPagar>();

  for (const tx of transacciones) {
    const vencimiento = tx.cyclePaymentDate;
    if (!vencimiento || vencimiento > hoy) continue;
    if (tx.type !== 'expense' || tx.status === 'paid' || tx.status === 'cancelled') continue;

    const tarjeta = tx.paymentMethodId ? porTarjeta.get(tx.paymentMethodId) : undefined;
    if (!tarjeta) continue;

    const clave = `${tarjeta.id}|${vencimiento}`;
    const previo = acumulado.get(clave);
    if (previo) {
      previo.total += tx.amount;
      previo.count += 1;
    } else {
      acumulado.set(clave, { tarjeta, paymentDate: vencimiento, total: tx.amount, count: 1 });
    }
  }

  return [...acumulado.values()].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
}
