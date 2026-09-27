import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { localRepository } from '@/data/local/localRepository';
import { OnboardingScreen } from './OnboardingScreen';
import { Logo } from '@/components/ui/Logo';

/**
 * Muestra la configuracion inicial la primera vez y nunca mas.
 *
 * `esperando` lo pone AppShell mientras baja los datos de la cuenta: sin
 * eso, un dispositivo nuevo preguntaria nombre y moneda otra vez durante
 * el segundo que tarda el primer sync.
 */
export function OnboardingGate({ esperando, children }: { esperando: boolean; children: ReactNode }) {
  const settings = useLiveQuery(() => localRepository.getSettings(), []);

  /**
   * Se conserva la ultima configuracion conocida.
   *
   * useLiveQuery devuelve undefined mientras vuelve a consultar, y eso pasa
   * ante CUALQUIER escritura en Dexie — por ejemplo la materializacion de
   * recurrentes que corre al arrancar. Sin esto, ese instante renderizaba
   * <Cargando/>, desmontaba OnboardingScreen y con ella su estado local:
   * estabas en el paso 3 y volvias al 1, con el nombre ya escrito.
   *
   * Solo cubre el hueco entre consultas; la primera vez `settings` si es
   * undefined de verdad y la pantalla de carga aparece como debe.
   */
  // Ajuste de estado DURANTE el render, no en un useEffect: el efecto
  // corre despues de pintar, asi que llegaba un render tarde y el hueco
  // —justo el que hay que tapar— seguia desmontando la pantalla. React
  // soporta llamar al setter del propio componente en render: reintenta
  // antes de confirmar nada.
  const [ultimaConocida, setUltimaConocida] = useState(settings);
  if (settings && settings !== ultimaConocida) setUltimaConocida(settings);
  const vigente = settings ?? ultimaConocida;

  /**
   * Una vez que la configuracion inicial esta EN PANTALLA, ya no se quita.
   *
   * `esperando` se vuelve true cada vez que arranca un ciclo de sync, no
   * solo el primero. Sin este cerrojo, un sync disparado a mitad del
   * proceso —al volver a la pestaña, por ejemplo— mostraba <Cargando/>,
   * desmontaba OnboardingScreen y con ella el paso en que ibas: volvias al
   * primero con el nombre ya escrito.
   *
   * Lo que `esperando` si protege se conserva: en un dispositivo nuevo,
   * ANTES de mostrar nada, se espera a que baje la cuenta para no volver a
   * preguntar nombre y moneda.
   */
  const faltaConfigurar = !!vigente && vigente.onboardedAt === null;
  const [yaSeMostro, setYaSeMostro] = useState(false);
  if (faltaConfigurar && !yaSeMostro) setYaSeMostro(true);

  if (!vigente) return <Cargando />;
  if (esperando && !yaSeMostro) return <Cargando />;
  if (faltaConfigurar) return <OnboardingScreen settings={vigente} />;
  return <>{children}</>;
}

function Cargando() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', color: 'var(--text-faint)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <Logo size={44} tile />
        </div>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>Trayendo tus datos…</p>
      </div>
    </div>
  );
}
