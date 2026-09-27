/**
 * Tipos del dominio. Esta carpeta NO importa React ni Supabase.
 *
 * Reglas duras:
 *  - El dinero es siempre un entero (pesos). Nunca float.
 *  - Las fechas de negocio son strings 'YYYY-MM-DD', nunca Date con hora.
 *    Esto evita que una compra del 15 a las 11pm caiga en el ciclo equivocado
 *    por zona horaria (Colombia = UTC-5).
 */

export type ISODate = string; // 'YYYY-MM-DD'
export type Id = string;

export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'paid' | 'pending' | 'scheduled' | 'cancelled';
export type PaymentMethodType = 'debit' | 'credit' | 'cash' | 'transfer';
export type Frequency = 'monthly' | 'biweekly' | 'weekly' | 'yearly';

/** Ej: '2026-09-Q1' (quincena del 10) | '2026-09-Q2' (quincena del 25) */
export type QuincenaKey = string;

export interface Settings {
  id: 'singleton';
  /** Como quiere que lo llamemos. Vacio = no preguntado todavia. */
  displayName: string;
  currency: string; // 'COP'
  locale: string; // 'es-CO'
  /**
   * Los dias del mes en que entra plata.
   *
   * EL NUMERO DE DIAS ES EL MODO: uno = te pagan una vez al mes, dos =
   * quincenal. No hay un campo aparte que diga "mensual" o "quincenal" y
   * pueda contradecir a esta lista.
   *
   * Antes era una tupla fija de dos (quincenaStartDays), que es justo lo
   * que impedia el modo mensual. Ver domain/periodo/periodo.ts.
   */
  diasDePago: number[];
  defaultPaymentMethodId: Id | null;
  reminderDefaultDaysBefore: number;
  theme: 'system' | 'light' | 'dark';
  /** ISO datetime de cuando termino la configuracion inicial. null = mostrarla. */
  onboardedAt: string | null;
  /**
   * Cuando se guardo por ultima vez. Lo necesita la sincronizacion: sin
   * esto, bajar de la nube pisaba lo local a ciegas y borraba la
   * configuracion inicial recien hecha en cada login.
   */
  updatedAt: string;
}

export interface Category {
  id: Id;
  name: string;
  icon: string;
  color: string;
  kind: 'expense' | 'income' | 'both';
  isArchived: boolean;
  sortOrder: number;
  /**
   * Cuando se guardo por ultima vez. Lo necesita la sincronizacion: sin
   * esto, bajar de la nube pisaba lo local a ciegas y cada edicion se
   * deshacia sola en el siguiente ciclo (que siempre empieza por bajar).
   * Vacio = nunca se guardo, y pierde contra cualquier fecha real.
   */
  updatedAt: string;
}

export interface PaymentMethod {
  id: Id;
  type: PaymentMethodType;
  name: string;
  /**
   * HEREDADO — no escribir. La fuente de verdad del metodo por defecto es
   * Settings.defaultPaymentMethodId; este campo solo sobrevive como ultimo
   * eslabon del ?? para quien nunca toco ese ajuste (ver
   * TransactionsScreen: settings.defaultPaymentMethodId ?? find(isDefault)).
   * Tener dos lugares donde vive "el por defecto" ya hacia que una casilla
   * que escribiera aca pareciera no hacer nada.
   */
  isDefault: boolean;
  /** Solo si type === 'credit'. Configurables, nunca hardcodeados. */
  cutoffDay?: number; // 15
  paymentDay?: number; // 2
  /** Cupo total en pesos enteros. Solo si type === 'credit'. */
  creditLimit?: number;
  /**
   * Cuando se guardo por ultima vez. Lo necesita la sincronizacion: sin
   * esto, bajar de la nube pisaba lo local a ciegas y cada edicion se
   * deshacia sola en el siguiente ciclo (que siempre empieza por bajar).
   * Vacio = nunca se guardo, y pierde contra cualquier fecha real.
   */
  updatedAt: string;
}

export interface Transaction {
  id: Id;
  type: TransactionType;
  concept: string;
  amount: number; // pesos enteros
  date: ISODate; // fecha de la compra / del ingreso
  categoryId: Id | null;
  paymentMethodId: Id | null;
  status: TransactionStatus;
  notes?: string;

  /** Derivados de TC, persistidos para que cambiar el corte no reescriba la historia. */
  cycleCutoffDate?: ISODate;
  cyclePaymentDate?: ISODate;

  /**
   * Compra diferida. Las N cuotas son N transacciones que comparten grupo;
   * el id de cada una es `${installmentGroupId}:cuota-${n}`, determinista,
   * para que la lapida de borrado sepa cual murio (mismo razonamiento que
   * occurrenceId en data/local/materialize.ts).
   */
  installmentGroupId?: Id;
  /** 1..N */
  installmentNumber?: number;
  /** N */
  installmentCount?: number;
  /**
   * Cuando se hizo la COMPRA. Distinta de `date` a partir de la cuota 2.
   * Existe para el cupo: un diferido bloquea el cupo entero el dia de la
   * compra, no cuota a cuota (ver credit-card/disponible.ts).
   */
  purchaseDate?: ISODate;

  /** null = se calcula por fecha. Con valor = el usuario lo movio a mano. */
  quincenaKey: QuincenaKey | null;

  /** Trazabilidad de recurrencia. UNIQUE(recurringRuleId, periodKey) en la DB. */
  recurringRuleId?: Id;
  periodKey?: string; // '2026-09'

  createdAt: string;
  updatedAt: string;
}

export interface RecurringRule {
  id: Id;
  name: string;
  type: TransactionType;
  amount: number;
  categoryId: Id | null;
  paymentMethodId: Id | null;
  frequency: Frequency;
  dayOfMonth?: number;
  dayOfWeek?: number;
  startDate: ISODate;
  endDate?: ISODate;
  isActive: boolean;
  /**
   * Cuando se guardo por ultima vez. Lo necesita la sincronizacion: sin
   * esto, bajar de la nube pisaba lo local a ciegas y cada edicion se
   * deshacia sola en el siguiente ciclo (que siempre empieza por bajar).
   * Vacio = nunca se guardo, y pierde contra cualquier fecha real.
   */
  updatedAt: string;
}

export interface Budget {
  id: Id;
  categoryId: Id;
  year: number;
  month: number; // 1-12
  amount: number;
  /**
   * Lo estampa el repositorio al guardar. Sin esto no habia forma de
   * sincronizarlos: el last-write-wins necesita saber cual de las dos
   * copias es la reciente. Vacio = nunca se guardo, y pierde.
   */
  updatedAt: string;
}

export interface Reminder {
  id: Id;
  transactionId: Id;
  remindAt: string; // ISO datetime
  status: 'scheduled' | 'sent' | 'dismissed' | 'failed';
  sentAt?: string;
  /**
   * Igual que en Budget: sin esto no se pueden sincronizar. Hace falta
   * porque el servidor los marca 'sent' y ese cambio tiene que poder
   * ganarle a la copia local sin que la local lo pise de vuelta.
   */
  updatedAt: string;
}
