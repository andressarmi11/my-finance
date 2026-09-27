/**
 * Starting payment methods. Only two by default: Debit (the default) and
 * Credit card, with cutoff/payment configurable from day one even though
 * the initial value is 15/2.
 */
import type { PaymentMethod } from '../types';

export const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'pm-debito', type: 'debit', name: 'Débito', isDefault: true, updatedAt: '' },
  {
    id: 'pm-tc', type: 'credit', name: 'Tarjeta de crédito', isDefault: false,
    cutoffDay: 15, paymentDay: 2, updatedAt: '',
  },
];
