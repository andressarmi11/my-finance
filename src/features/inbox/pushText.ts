/**
 * What the "a transaction arrived" notification says (BANDEJA.md, 3a): what
 * the app understood — amount and merchant — not "something arrived".
 *
 * Runs on the server: the ingest Edge Function imports a bundle of this file
 * (supabase/functions/ingest/pushText.gen.js, `npm run build:push-text`), so
 * the text is read by the SAME parser as the app, never a copy in Deno.
 * Hence no React and nothing that needs the browser here.
 */
import { formatMoney } from '@/domain/money/format';
import { parseUtterance } from '@/domain/nlp/parse';
import { TEXTS, type TextKey } from '@/i18n/texts';

export type PushLanguage = 'es' | 'en';

function fill(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), template);
}

export function pushText(text: string, opts: {
  today: string;
  language: PushLanguage;
  /** The user's main currency: the amount is written in it unless the text names another. */
  currency: string;
  /** Entries waiting, this one included. */
  pending: number;
}): { title: string; body: string } {
  const dict = TEXTS[opts.language] as Record<TextKey, string>;
  const t = (key: TextKey) => dict[key] ?? TEXTS.es[key];
  const parsed = parseUtterance(text, opts.today);
  const income = parsed.type === 'income';
  const concept = parsed.concept.trim();

  let what: string;
  if (parsed.amount == null) {
    what = concept
      ? fill(t(income ? 'inbox.pushIncomeNoAmount' : 'inbox.pushNoAmount'), { concept })
      : t('inbox.pushUnreadable');
  } else {
    const amount = formatMoney(parsed.amount, parsed.currency ?? opts.currency);
    what = concept
      ? fill(t(income ? 'inbox.pushIncome' : 'inbox.pushExpense'), { amount, concept })
      : fill(t(income ? 'inbox.pushIncomeNoConcept' : 'inbox.pushExpenseNoConcept'), { amount });
  }
  const tap = opts.pending > 1 ? fill(t('inbox.pushTapMany'), { n: opts.pending }) : t('inbox.pushTapOne');
  return { title: 'Step up', body: `${what}\n${tap}` };
}
