import { Link } from 'react-router-dom';
import { useT } from '@/i18n/idioma';
import { SLUGS, type SlugLegal } from './documentos';

const CLAVE: Record<SlugLegal, Parameters<ReturnType<typeof useT>>[0]> = {
  aviso: 'legal.aviso',
  privacidad: 'legal.privacidad',
  terminos: 'legal.terminos',
  cookies: 'legal.cookies',
  propiedad: 'legal.propiedad',
};

/**
 * Los enlaces legales, al pie de toda la app.
 *
 * Siempre visibles y no escondidos en Ajustes: es donde la gente los busca
 * y, para terminos y privacidad, es donde deben estar — tienen que
 * alcanzarse sin navegar un menu.
 *
 * Va DENTRO del contenido que hace scroll, no fijo: un pie fijo en un
 * telefono se come alto util de pantalla toda la sesion para algo que se
 * consulta una vez.
 */
export function LegalFooter() {
  const t = useT();
  const anio = new Date().getFullYear();

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
        aria-label={t('legal.titulo')}
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
            {t(CLAVE[slug])}
          </Link>
        ))}
      </nav>
      <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
        © {anio} Step up
      </p>
    </footer>
  );
}
