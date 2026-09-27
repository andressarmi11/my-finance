import { useNavigate, useParams } from 'react-router-dom';
import { IconChevronRight } from '@tabler/icons-react';
import { Screen } from '@/components/ui/Screen';
import { useLanguage } from '@/i18n/language';
import { useT } from '@/i18n/language';
import { UPDATED, documentsFor, SLUGS, type LegalSlug } from './documents';

const TITLE_KEY: Record<LegalSlug, 'legal.notice' | 'legal.privacy' | 'legal.terms' | 'legal.cookies' | 'legal.property'> = {
  aviso: 'legal.notice',
  privacidad: 'legal.privacy',
  terminos: 'legal.terms',
  cookies: 'legal.cookies',
  propiedad: 'legal.property',
};

/** The index: the five documents. */
export function LegalIndexScreen() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const docs = documentsFor(language);

  return (
    <Screen title={t('legal.title')} subtitle={t('legal.subtitle')}>
      <BackLink onClick={() => navigate(-1)} text={t('nav.backToSettings')} />

      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-m)', padding: '2px 14px' }}>
        {SLUGS.map((slug, i) => (
          <button
            key={slug}
            type="button"
            onClick={() => navigate(`/legal/${slug}`)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 0', background: 'none', border: 'none',
              borderBottom: i < SLUGS.length - 1 ? '1px solid var(--line)' : 'none',
              cursor: 'pointer', textAlign: 'left', color: 'var(--text)',
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 600 }}>{t(TITLE_KEY[slug])}</span>
              <span style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--text-faint)' }}>
                {docs[slug].entrada}
              </span>
            </span>
            <IconChevronRight size={18} stroke={1.75} color="var(--text-faint)" aria-hidden />
          </button>
        ))}
      </div>

      <p style={{ marginTop: 16, fontSize: 'var(--text-sm)', color: 'var(--text-faint)' }}>
        {t('legal.updated')}: {UPDATED}
      </p>
    </Screen>
  );
}

/** A single document. */
export function LegalDocScreen() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { language, t } = useLanguage();

  const isValid = (s: string | undefined): s is LegalSlug =>
    !!s && (SLUGS as string[]).includes(s);

  if (!isValid(slug)) {
    return (
      <Screen title={t('legal.title')}>
        <BackLink onClick={() => navigate('/legal')} text={t('legal.title')} />
        <p style={{ color: 'var(--text-muted)' }}>{t('legal.notFound')}</p>
      </Screen>
    );
  }

  const doc = documentsFor(language)[slug];

  return (
    <Screen title={doc.title}>
      <BackLink onClick={() => navigate('/legal')} text={t('legal.title')} />

      <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: 'var(--text-md)' }}>
        {doc.entrada}
      </p>

      {/* Capped reading width: a legal text at 100% width on a phone is
          readable, but on a tablet it goes past 80 characters per line and
          becomes tiring to follow. */}
      <article style={{ maxWidth: '62ch' }}>
        {doc.bloques.map((bloque, i) => (
          <section key={i} style={{ marginBottom: 24 }}>
            {bloque.h && (
              <h2 style={{
                margin: '0 0 8px', fontSize: 'var(--text-md)', fontWeight: 700,
                letterSpacing: '-0.01em',
              }}>
                {bloque.h}
              </h2>
            )}
            {bloque.p?.map((parrafo, j) => (
              <p key={j} style={{
                margin: '0 0 10px', fontSize: 'var(--text-base)',
                lineHeight: 1.6, color: 'var(--text-muted)',
              }}>
                {parrafo}
              </p>
            ))}
            {bloque.ul && (
              <ul style={{
                margin: '0 0 10px', paddingLeft: 18, fontSize: 'var(--text-base)',
                lineHeight: 1.6, color: 'var(--text-muted)',
              }}>
                {bloque.ul.map((item, j) => (
                  <li key={j} style={{ marginBottom: 6 }}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </article>

      <p style={{ marginTop: 4, fontSize: 'var(--text-sm)', color: 'var(--text-faint)' }}>
        {t('legal.updated')}: {UPDATED}
      </p>
    </Screen>
  );
}

function BackLink({ onClick, text }: { onClick: () => void; text: string }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        marginBottom: 16, background: 'none', border: 'none',
        color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', padding: 0,
      }}
    >
      ← {text || t('nav.back')}
    </button>
  );
}
