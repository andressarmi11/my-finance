import { Link } from 'react-router-dom';
import { useT } from '@/i18n/language';
import { SLUGS, type LegalSlug } from './documents';

const DOC_KEY: Record<LegalSlug, Parameters<ReturnType<typeof useT>>[0]> = {
  aviso: 'legal.notice',
  privacidad: 'legal.privacy',
  terminos: 'legal.terms',
  cookies: 'legal.cookies',
  propiedad: 'legal.property',
};

/**
 * The legal links, at the foot of the whole app.
 *
 * Always visible and not tucked away in Settings: that's where people look
 * for them and, for terms and privacy, that's where they belong — they have
 * to be reachable without navigating a menu.
 *
 * It sits INSIDE the scrolling content, not fixed: a fixed footer on a
 * phone eats usable screen height for the whole session for something
 * that's read once.
 */
export function LegalFooter() {
  const t = useT();
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        maxWidth: 560,
        margin: '0 auto',
        padding: 'var(--gap-xl) var(--gap-l) 0',
        borderTop: '1px solid var(--line)',
        marginTop: 'var(--gap-xl)',
      }}
    >
      <nav
        aria-label={t('legal.title')}
        style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginBottom: 10 }}
      >
        {SLUGS.map((slug) => (
          <Link
            key={slug}
            to={`/legal/${slug}`}
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-faint)',
              textDecoration: 'none',
            }}
          >
            {t(DOC_KEY[slug])}
          </Link>
        ))}
      </nav>
      <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
        © {year} Step up
      </p>
    </footer>
  );
}
