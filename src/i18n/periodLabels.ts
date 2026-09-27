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
 * "Quincena del" / "From the" — followed by the day.
 *
 * In English it's kept short on purpose: "Pay period from the 10" would wrap
 * onto two lines on the dashboard card and push the amount out of
 * view. In context —a period card, a group header— "From
 * the 10" reads fine and fits wherever the Spanish fits.
 */
export function payPeriodLabel(): string {
  return currentLanguage === 'en' ? 'From the' : 'Quincena del';
}

/** For someone who gets paid once a month and not on the 1st. */
export function monthFromLabel(): string {
  return currentLanguage === 'en' ? 'Month from the' : 'Mes desde el';
}
