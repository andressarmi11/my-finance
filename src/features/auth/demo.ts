/**
 * Sample months for the desktop sign-in preview (§9h). Fictitious on
 * purpose: there's no session yet, so nothing of the user's may show here.
 * `month` is 0-based (6 = July) so the name follows the interface language.
 */
export interface DemoMonth {
  month: number;
  /** "Te queda" — the big number. */
  left: number;
  /** "Ya recibiste". */
  received: number;
  /** "Falta pagar". */
  toPay: number;
}

export const DEMO_MONTHS: readonly DemoMonth[] = [
  { month: 6, left: 2_140_500, received: 6_800_000, toPay: 410_000 },
  { month: 7, left: 865_300, received: 5_200_000, toPay: 1_230_400 },
  { month: 8, left: 1_320_750, received: 7_450_000, toPay: 96_000 },
  { month: 9, left: 3_015_200, received: 9_100_000, toPay: 540_800 },
];

/** Every how long the preview moves to the next month. */
export const DEMO_ROTATE_MS = 3400;
