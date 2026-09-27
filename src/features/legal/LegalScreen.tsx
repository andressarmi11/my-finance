import { useNavigate, useParams } from 'react-router-dom';
import { IconChevronRight } from '@tabler/icons-react';
import { Screen } from '@/components/ui/Screen';
import { useIdioma } from '@/i18n/idioma';
import { useT } from '@/i18n/idioma';
import { ACTUALIZADO, documentosDe, SLUGS, type SlugLegal } from './documentos';

const CLAVE_TITULO: Record<SlugLegal, 'legal.aviso' | 'legal.privacidad' | 'legal.terminos' | 'legal.cookies' | 'legal.propiedad'> = {
  aviso: 'legal.aviso',
  privacidad: 'legal.privacidad',
  terminos: 'legal.terminos',
  cookies: 'legal.cookies',
  propiedad: 'legal.propiedad',
};

/** El índice: los cinco documentos. */
export function LegalIndexScreen() {
  const navigate = useNavigate();
  const { idioma, t } = useIdioma();
  const docs = documentosDe(idioma);

  return (
    <Screen title={t('legal.titulo')} subtitle={t('legal.subtitulo')}>
      <Volver onClick={() => navigate(-1)} texto={t('nav.volverAjustes')} />

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
              <span style={{ display: 'block', fontWeight: 600 }}>{t(CLAVE_TITULO[slug])}</span>
              <span style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--text-faint)' }}>
                {docs[slug].entrada}
              </span>
            </span>
            <IconChevronRight size={18} stroke={1.75} color="var(--text-faint)" aria-hidden />
          </button>
        ))}
      </div>

      <p style={{ marginTop: 16, fontSize: 'var(--text-sm)', color: 'var(--text-faint)' }}>
        {t('legal.actualizado')}: {ACTUALIZADO}
      </p>
    </Screen>
  );
}

/** Un documento. */
export function LegalDocScreen() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { idioma, t } = useIdioma();

  const esValido = (s: string | undefined): s is SlugLegal =>
    !!s && (SLUGS as string[]).includes(s);

  if (!esValido(slug)) {
    return (
      <Screen title={t('legal.titulo')}>
        <Volver onClick={() => navigate('/legal')} texto={t('legal.titulo')} />
        <p style={{ color: 'var(--text-muted)' }}>{t('legal.noEncontrado')}</p>
      </Screen>
    );
  }

  const doc = documentosDe(idioma)[slug];

  return (
    <Screen title={doc.titulo}>
      <Volver onClick={() => navigate('/legal')} texto={t('legal.titulo')} />

      <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: 'var(--text-md)' }}>
        {doc.entrada}
      </p>

      {/* Ancho de lectura acotado: un texto legal a 100% del ancho en un
          telefono es legible, pero en tablet pasa de 80 caracteres por
          linea y se vuelve cansado de seguir. */}
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
        {t('legal.actualizado')}: {ACTUALIZADO}
      </p>
    </Screen>
  );
}

function Volver({ onClick, texto }: { onClick: () => void; texto: string }) {
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
      ← {texto || t('nav.volver')}
    </button>
  );
}
