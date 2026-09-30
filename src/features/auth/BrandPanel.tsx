import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { IconCheck } from '@tabler/icons-react';
import { Logo } from '@/components/ui/Logo';
import { AnimatedNumber } from '@/features/dashboard/AnimatedNumber';
import { useLanguage } from '@/i18n/language';
import type { TextKey } from '@/i18n/texts';
import { DEMO_MONTHS, DEMO_ROTATE_MS } from './demo';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

/**
 * The left half of the desktop sign-in (§9g 2d, §9h): the brand, a headline
 * that types itself, a preview of Inicio's number and three promises.
 *
 * The preview runs on SAMPLE data and says so: there's no session yet, so
 * nothing of the user's could be shown — and inventing it without a label
 * would read as someone else's account.
 */
export function BrandPanel() {
  const { t, language } = useLanguage();
  const words = useMemo(() => [t('login.phrase1'), t('login.phrase2')], [t]);

  return (
    <aside
      style={{
        background: 'color-mix(in srgb, var(--surface) 50%, var(--paper))',
        borderRight: '1px solid var(--line)',
        padding: '56px 64px', display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Logo size={44} tile />
        <span style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em' }}>Step up</span>
      </div>
      <div style={{ flex: 1, minHeight: 32 }} />

      <h2 style={{ margin: 0, fontSize: 48, lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.035em', maxWidth: 480 }}>
        {t('login.headline')}
        <br />
        {/* Keyed by language so a switch starts over with the new words. */}
        <Typewriter key={language} words={words} />
      </h2>
      <p style={{ margin: '14px 0 0', fontSize: 17, color: 'var(--text-muted)', maxWidth: 440, lineHeight: 1.5 }}>
        {t('login.pitch')}
      </p>

      <DemoCard />

      <ul style={{ listStyle: 'none', margin: '32px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {POINTS.map(([title, body]) => (
          <li key={title} style={{ display: 'flex', gap: 12 }}>
            <span
              aria-hidden
              style={{
                width: 22, height: 22, borderRadius: 11, flex: 'none', marginTop: 1,
                display: 'grid', placeItems: 'center', background: 'var(--q10-soft)', color: 'var(--q10)',
              }}
            >
              <IconCheck size={12} stroke={3} />
            </span>
            <span>
              <span style={{ display: 'block', fontWeight: 600, fontSize: 15 }}>{t(title)}</span>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)' }}>{t(body)}</span>
            </span>
          </li>
        ))}
      </ul>
      <div style={{ flex: 1, minHeight: 32 }} />
      {/* The documents, readable before having an account. */}
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-faint)' }}>
        © 2026 Step up
        {LEGAL_LINKS.map(([slug, key]) => (
          <span key={slug}>
            {' · '}
            <Link to={`/legal/${slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>{t(key)}</Link>
          </span>
        ))}
      </p>
    </aside>
  );
}

const LEGAL_LINKS: ReadonlyArray<[string, TextKey]> = [
  ['aviso', 'legal.notice'],
  ['privacidad', 'legal.privacy'],
  ['terminos', 'legal.terms'],
];

const POINTS: ReadonlyArray<[TextKey, TextKey]> = [
  ['login.offlineTitle', 'login.offlineBody'],
  ['login.privateTitle', 'login.privateBody'],
  ['login.noTrackingTitle', 'login.noTrackingBody'],
];

const TYPE_MS = 80;
const DELETE_MS = 40;
const HOLD_MS = 2000;
const SWITCH_MS = 350;

/**
 * Types a phrase, holds it, deletes it and types the next one. It starts
 * with the first phrase already written, so the headline reads whole at
 * first sight. Screen readers get the first phrase, fixed: a live
 * letter-by-letter headline would be noise.
 */
function Typewriter({ words }: { words: string[] }) {
  const [reduced] = useState(prefersReducedMotion);
  const [state, setState] = useState({ w: 0, n: words[0]!.length, deleting: false });

  useEffect(() => {
    if (reduced) return;
    const word = words[state.w]!;
    let delay = state.deleting ? DELETE_MS : TYPE_MS;
    if (!state.deleting && state.n === word.length) delay = HOLD_MS;
    if (state.deleting && state.n === 0) delay = SWITCH_MS;
    const id = window.setTimeout(() => {
      setState((p) => {
        const current = words[p.w]!;
        if (!p.deleting && p.n === current.length) return { ...p, deleting: true };
        if (p.deleting && p.n === 0) return { w: (p.w + 1) % words.length, n: 0, deleting: false };
        return { ...p, n: p.n + (p.deleting ? -1 : 1) };
      });
    }, delay);
    return () => window.clearTimeout(id);
  }, [state, words, reduced]);

  const visible = reduced ? words[0]! : words[state.w]!.slice(0, state.n);
  return (
    <span style={{ color: 'var(--q10)' }}>
      <span style={srOnly}>{words[0]}</span>
      <span aria-hidden data-testid="typewriter">
        {visible}
        {!reduced && (
          <span
            style={{
              display: 'inline-block', width: 4, height: '0.85em', marginLeft: 4, verticalAlign: '-0.06em',
              borderRadius: 2, background: 'var(--q10)', animation: 'blink 1s steps(1) infinite',
            }}
          />
        )}
      </span>
    </span>
  );
}

const money = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const figure = (n: number) => money.format(Math.round(n));

/** Inicio's "te queda" card, cycling through four made-up months. */
function DemoCard() {
  const { t, language } = useLanguage();
  const [reduced] = useState(prefersReducedMotion);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % DEMO_MONTHS.length), DEMO_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [reduced]);

  const demo = DEMO_MONTHS[i]!;
  const monthName = new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-CO', { month: 'long' })
    .format(new Date(2026, demo.month, 1));
  const month = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  return (
    <section
      aria-label={t('login.sampleData')}
      style={{
        marginTop: 32, maxWidth: 420, padding: 20,
        background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
        <span style={{ flex: 1 }}>{t('login.leftIn').replace('{month}', month)}</span>
        <span
          style={{
            fontSize: 11, fontWeight: 600, color: 'var(--text-faint)',
            border: '1px solid var(--line-strong)', borderRadius: 8, padding: '1px 7px',
          }}
        >
          {t('login.sampleData')}
        </span>
      </div>
      {/* "$ 2.140.500" in one size and colour, as in the prototype. */}
      <div className="figures" style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
        <span style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1 }}>$</span>
        <AnimatedNumber
          value={demo.left}
          duration={700}
          format={figure}
          style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1 }}
        />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <Stat label={t('login.received')} value={demo.received} color="var(--positive-text)" />
        <Stat label={t('login.toPay')} value={demo.toPay} color="var(--danger-text)" />
      </div>
    </section>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span style={{ flex: 1, background: 'var(--paper)', borderRadius: 12, padding: '10px 12px' }}>
      <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
      <span className="figures" style={{ display: 'block', fontWeight: 700, color }}>$ {figure(value)}</span>
    </span>
  );
}

const srOnly: CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
};
