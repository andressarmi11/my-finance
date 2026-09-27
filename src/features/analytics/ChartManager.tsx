import { useT } from '@/i18n/idioma';
import { useState } from 'react';
import {
  IconArrowDown, IconArrowUp, IconEye, IconEyeOff, IconLayoutGrid, IconX,
} from '@tabler/icons-react';
import { useDialogo } from '@/components/ui/useDialogo';
import {
  alternarOculto, guardarDisposicion, mover, ORDEN_POR_DEFECTO,
  type Disposicion, type GraficoId,
} from './disposicion';

/**
 * Elegir que graficos se ven y en que orden.
 *
 * Flechas y no arrastrar: un drag-and-drop en una lista corta dentro de
 * una hoja modal en movil es fragil —compite con el scroll de la hoja y
 * con el gesto de cerrarla— y ademas no es alcanzable con teclado ni con
 * lector de pantalla. Dos botones por fila hacen lo mismo, funcionan en
 * cualquier entrada y no hay nada que se pueda soltar en el lugar
 * equivocado.
 */
export function GestorDeGraficos({ disposicion, titulos, onCambiar }: {
  disposicion: Disposicion;
  titulos: Record<GraficoId, string>;
  onCambiar: (d: Disposicion) => void;
}) {
  const t = useT();
  const [abierto, setAbierto] = useState(false);
  const refDialogo = useDialogo(() => setAbierto(false), abierto);

  const ocultosCount = disposicion.ocultos.length;

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        style={{
          width: '100%', minHeight: 'var(--tap)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 8, marginBottom: 14,
          borderRadius: 'var(--radius-s)', border: '1px dashed var(--line-strong)',
          background: 'var(--surface)', color: 'var(--text-muted)',
          fontWeight: 600, fontSize: 'var(--text-sm)', cursor: 'pointer',
        }}
      >
        <IconLayoutGrid size={17} stroke={1.75} aria-hidden />
        {t('analisis.organizar')}
        {ocultosCount > 0 && (
          <span style={{ color: 'var(--text-faint)' }}>· {ocultosCount} {ocultosCount === 1 ? t('analisis.oculto') : t('analisis.ocultos')}</span>
        )}
      </button>
    );
  }

  return (
    <div
      ref={refDialogo}
      role="dialog"
      aria-label={t('analisis.organizar')}
      style={{
        position: 'fixed', inset: 0, background: 'color-mix(in srgb, black 40%, transparent)',
        display: 'flex', alignItems: 'flex-end', zIndex: 60,
      }}
      onClick={() => setAbierto(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, margin: '0 auto', background: 'var(--surface)',
          borderRadius: '20px 20px 0 0', padding: '10px 20px calc(var(--safe-bottom) + 20px)',
          maxHeight: '85vh', overflowY: 'auto',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '4px auto 12px' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            aria-label={t('accion.cerrar')}
            style={{
              width: 32, height: 32, borderRadius: 16, border: 'none', display: 'grid',
              placeItems: 'center', background: 'var(--surface-sunken)',
              color: 'var(--text-muted)', cursor: 'pointer', flex: 'none',
            }}
          >
            <IconX size={17} stroke={2.2} aria-hidden />
          </button>
          <span style={{ fontWeight: 700, fontSize: 'var(--text-md)' }}>{t('analisis.organizar')}</span>
        </div>

        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {disposicion.orden.map((id, i) => {
            const oculto = disposicion.ocultos.includes(id);
            return (
              <li
                key={id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0',
                  borderBottom: '1px solid var(--line)', opacity: oculto ? 0.55 : 1,
                }}
              >
                <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 'var(--text-base)' }}>
                  {titulos[id]}
                </span>

                <IconBtn
                  label={`${t('analisis.subir')} ${titulos[id]}`}
                  disabled={i === 0}
                  onClick={() => onCambiar({ ...disposicion, orden: mover(disposicion.orden, id, -1) })}
                >
                  <IconArrowUp size={17} stroke={2} />
                </IconBtn>
                <IconBtn
                  label={`${t('analisis.bajar')} ${titulos[id]}`}
                  disabled={i === disposicion.orden.length - 1}
                  onClick={() => onCambiar({ ...disposicion, orden: mover(disposicion.orden, id, 1) })}
                >
                  <IconArrowDown size={17} stroke={2} />
                </IconBtn>
                <IconBtn
                  label={`${oculto ? t('analisis.mostrar') : t('analisis.ocultar')} ${titulos[id]}`}
                  onClick={() => onCambiar({ ...disposicion, ocultos: alternarOculto(disposicion.ocultos, id) })}
                >
                  {oculto
                    ? <IconEyeOff size={17} stroke={1.9} color="var(--text-faint)" />
                    : <IconEye size={17} stroke={1.9} />}
                </IconBtn>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => {
            const base = { orden: ORDEN_POR_DEFECTO, ocultos: [] };
            guardarDisposicion(base);
            onCambiar(base);
          }}
          style={{
            width: '100%', minHeight: 'var(--tap)', marginTop: 14,
            borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)',
            background: 'var(--surface)', color: 'var(--text-muted)',
            fontWeight: 600, cursor: 'pointer',
          }}
        >
          {t('analisis.ordenOriginal')}
        </button>
      </div>
    </div>
  );
}

function IconBtn({ label, onClick, disabled, children }: {
  label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        width: 36, height: 36, flex: 'none', display: 'grid', placeItems: 'center',
        borderRadius: 10, border: '1px solid var(--line)',
        background: 'var(--surface)',
        color: disabled ? 'var(--line-strong)' : 'var(--text-muted)',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}
