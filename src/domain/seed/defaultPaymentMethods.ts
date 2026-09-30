/**
 * Starting payment methods: Debit (the default), Credit card —with
 * cutoff/payment configurable from day one even though the initial value is
 * 15/2— and Cash, so the new-transaction sheet can offer Débito | Crédito |
 * Efectivo out of the box (redesign §9b).
 */
import type { PaymentMethod } from '../types';

export const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'pm-debito', type: 'debit', name: 'Débito', isDefault: true, updatedAt: '' },
  {
    id: 'pm-tc', type: 'credit', name: 'Tarjeta de crédito', isDefault: false,
    cutoffDay: 15, paymentDay: 2, updatedAt: '',
  },
  { id: 'pm-efectivo', type: 'cash', name: 'Efectivo', isDefault: false, updatedAt: '' },
];
