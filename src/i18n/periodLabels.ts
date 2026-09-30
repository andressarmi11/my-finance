/**
 * Period labels, outside React.
 *
 * "Quincena del 10" is built in pure functions —groupByPeriodo, and the
 * dashboard header— which aren't components and can't use a
 * hook. They're read from the same module state as the months.
 *
 * In English you don't say "fortnight": what this names is the period between
 * two payroll payments, and "pay period" is what it's called. Translating it
 * literally would have been correct and incomprehensible at the same time.
 */
let currentLanguage: 'es' | 'en' = 'es';

export function setPeriodLabelLanguage(language: 'es' | 'en'): void {
  currentLanguage = language;
}

/**
 * "Quincena del" / "Pay period" — followed by the day: "Pay period 25", as
 * the prototype writes it. It fits wherever the Spanish does.
 */
export function payPeriodLabel(): string {
  return currentLanguage === 'en' ? 'Pay period' : 'Quincena del';
}

/** For someone who gets paid once a month and not on the 1st. */
export function monthFromLabel(): string {
  return currentLanguage === 'en' ? 'Month from the' : 'Mes desde el';
}
