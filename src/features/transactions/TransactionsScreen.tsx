import { useEffect, useMemo, useState } from 'react';
import { useDialogo } from '@/components/ui/useDialogo';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { MonthNav, monthName } from '@/components/ui/MonthNav';
import { db } from '@/data/db';
import { localRepository, DEFAULT_SETTINGS } from '@/data/local/localRepository';
import { borrarDiferido, crearDiferido } from '@/data/local/diferidos';
import { seedDemoTransactions } from '@/data/local/demoData';
import { ensureMonthMaterialized } from '@/data/local/materialize';
import { maybeScheduleReminder } from '@/features/notifications/scheduleReminder';
import { formatMoney } from '@/domain/money/format';
import { periodosDelMes } from '@/domain/periodo/periodo';
import { conPeriodoResuelto } from '@/domain/periodo/resolve';
import { shiftMonth } from '@/domain/dates';
import { todayISO } from '@/lib/todayISO';
import { interpretarTexto } from '@/domain/nlp/interpretar';
import type { Transaction } from '@/domain/types';
import { groupByPeriodo } from './groupByPeriodo';
import { aplicarFiltros, type FiltroEstado, type FiltroTipo } from './filtros';
import { TransactionRow } from './TransactionRow';
import { TransactionForm, type Prefill } from './TransactionForm';
import { VACIO } from '@/lib/vacio';


export function TransactionsScreen() {
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [prefill, setPrefill] = useState<Prefill | undefined>();
  const [query, setQuery] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  // null = no estamos seleccionando. Un Set vacio = modo seleccion, sin nada
  // elegido todavia. modify
  const [seleccion, setSeleccion] = useState<Set<string> | null>(null);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const today = todayISO();
  const [todayYear, todayMonth] = today.split('-').map(Number) as [number, number];
  const [cursor, setCursor] = useState({ y: todayYear, m: todayMonth });
  const isCurrentMonth = cursor.y === todayYear && cursor.m === todayMonth;

  // Ver DashboardScreen: el mes que se mira tiene que tener sus
  // instancias recurrentes creadas, aunque sea de dentro de dos años.
  useEffect(() => { void ensureMonthMaterialized(cursor.y, cursor.m); }, [cursor]);

  const settings = useLiveQuery(() => localRepository.getSettings(), []) ?? DEFAULT_SETTINGS;
  const categories = useLiveQuery(() => localRepository.listCategories(), []) ?? VACIO;
  const paymentMethods = useLiveQuery(() => localRepository.listPaymentMethods(), []) ?? VACIO;
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? VACIO;
  // Lo que la app aprendió: el enlace del Atajo también tiene que usarlo.
  //
  // SIN `?? VACIO` a propósito, al revés que los de arriba. useLiveQuery
  // devuelve undefined mientras carga y [] cuando cargó y no hay nada;
  // colapsar los dos en [] hace imposible distinguir "todavía no sé lo que
  // aprendí" de "no he aprendido nada". El efecto de abajo necesita esa
  // diferencia: si corre antes de tiempo con [], propone la categoría de la
  // tabla de palabras clave y se pierde justo lo aprendido.
  const conceptIndex = useLiveQuery(() => db.conceptIndex.toArray(), []);

  // Abrir el form desde una URL. Dos formas, ambas para Atajos de iOS:
  //
  //   campo por campo:
  //     /movimientos?nuevo=1&tipo=ingreso&monto=3000000&concepto=Sueldo
  //   en español, que la app interpreta:
  //     /movimientos?texto=gasté 45 mil en el almuerzo
  //     /movimientos?texto=<el SMS del banco entero>
  //
  // La segunda existe porque armar la URL campo por campo obliga al Atajo
  // a sacar el monto con una expresión regular, y el formato del SMS lo
  // decide el banco. Mandando el texto crudo, quien interpreta es la app —
  // que además ya sabe qué categoría le pusiste la última vez.
  useEffect(() => {
    const texto = params.get('texto') ?? params.get('sms');
    if (params.get('nuevo') !== '1' && !texto) return;

    // Esperar a que Dexie devuelva los metodos de pago antes de consumir
    // la URL. El efecto corre en el primer render, cuando useLiveQuery
    // todavia no resolvio y `paymentMethods` es []; si borrabamos los
    // params ahi, `metodoPorTipo` devolvia null y la segunda pasada —esta
    // vez con los metodos cargados— ya no encontraba nada en la URL.
    // Se notaba justo donde mas duele: un Atajo de iOS abriendo la app en
    // frio dejaba el gasto sin metodo de pago, sin forma de recuperarlo.
    if (paymentMethods.length === 0) return;
    // Y esperar también a lo aprendido, por lo mismo: si el efecto corre
    // antes de que Dexie conteste, el índice llega vacío y la categoría que
    // el usuario ya había corregido se pierde en silencio. Se notaba como
    // una intermitencia: a veces el Atajo acertaba y a veces no.
    if (conceptIndex === undefined) return;

    let nuevo: Prefill;
    if (texto) {
      // Misma interpretación que la entrada rápida y la bandeja. Antes acá
      // se usaba solo la tabla de palabras clave, así que lo que el usuario
      // le había corregido a la app se ignoraba al entrar por el Atajo.
      const { parsed: leido, categoryId, paymentMethodId } = interpretarTexto(texto, todayISO(), {
        conceptIndex,
        idsCategorias: categories.map((c) => c.id),
        metodos: paymentMethods,
        metodoPorDefecto: settings.defaultPaymentMethodId ?? null,
      });
      nuevo = {
        type: leido.type,
        concept: leido.concept || undefined,
        amountText: leido.amount != null ? String(leido.amount) : undefined,
        date: leido.date,
        categoryId,
        paymentMethodId,
        markPaidNow: leido.yaOcurrio,
      };
    } else {
      nuevo = {
        type: params.get('tipo') === 'ingreso' ? 'income' : 'expense',
        concept: params.get('concepto') ?? undefined,
        amountText: (params.get('monto') ?? '').replace(/[^0-9]/g, '') || undefined,
        date: params.get('fecha') ?? undefined,
        markPaidNow: params.get('pagado') === '1' ? true : undefined,
      };
    }

    setEditing(null);
    setPrefill(nuevo);
    setFormOpen(true);
    const next = new URLSearchParams(params);
    for (const k of ['nuevo', 'tipo', 'monto', 'concepto', 'fecha', 'pagado', 'texto', 'sms']) next.delete(k);
    setParams(next, { replace: true });
  }, [params, setParams, paymentMethods, categories, conceptIndex, settings]);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const methodById = useMemo(() => new Map(paymentMethods.map((m) => [m.id, m])), [paymentMethods]);

  // Buscar mira TODO el historial; sin búsqueda, la lista se acota al mes
  // visible. Sin ese tope, los recurrentes materializados a +95 días
  // aparecían arriba de todo y enterraban lo de esta semana.
  const searching = query.trim().length > 0;

  const visible = useMemo(() => {
    const enVentana = searching
      ? transactions.filter((t) => t.concept.toLowerCase().includes(query.trim().toLowerCase()))
      // Tantas claves como periodos tenga el mes. Pedir Q1 y Q2 a mano dejaba
      // fuera movimientos en cuanto los periodos no fueran exactamente dos.
      : conPeriodoResuelto(transactions, settings.diasDePago)
          .filter((t) => periodosDelMes(cursor.y, cursor.m, settings.diasDePago).includes(t.resolvedQuincenaKey));
    return aplicarFiltros(enVentana, filtroTipo, filtroEstado);
  }, [transactions, query, searching, cursor, settings.diasDePago, filtroTipo, filtroEstado]);

  const groups = useMemo(
    () => groupByPeriodo(visible, settings.diasDePago, transactions),
    [visible, settings.diasDePago, transactions],
  );

  const monthTotal = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of visible) {
      if (t.status === 'cancelled') continue;
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    }
    return { income, expense, count: visible.length };
  }, [visible]);

  const enSeleccion = seleccion !== null;

  function alternarSeleccion(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /** Los movimientos elegidos, en el orden en que se ven. */
  const elegidos = useMemo(
    () => (seleccion ? visible.filter((t) => seleccion.has(t.id)) : []),
    [seleccion, visible],
  );

  async function marcarElegidosPagados() {
    setAplicando(true);
    try {
      const ahora = new Date().toISOString();
      for (const tx of elegidos) {
        if (tx.status === 'paid') continue; // ya estaba; no le movemos la fecha
        await localRepository.saveTransaction({ ...tx, status: 'paid', updatedAt: ahora });
      }
      setSeleccion(null);
    } finally {
      setAplicando(false);
    }
  }

  async function borrarElegidos() {
    setAplicando(true);
    try {
      for (const tx of elegidos) await localRepository.deleteTransaction(tx.id);
      setConfirmarBorrado(false);
      setSeleccion(null);
    } finally {
      setAplicando(false);
    }
  }

  async function togglePaid(tx: Transaction) {
    await localRepository.saveTransaction({
      ...tx,
      status: tx.status === 'paid' ? 'pending' : 'paid',
      updatedAt: new Date().toISOString(),
    });
  }

  async function handleSave(tx: Transaction, diferido?: { cuotas: number; valorCuota?: number }) {
    if (diferido && diferido.cuotas > 1) {
      const metodo = tx.paymentMethodId ? paymentMethods.find((m) => m.id === tx.paymentMethodId) : undefined;
      await crearDiferido(tx, diferido.cuotas, metodo, diferido.valorCuota);
      closeForm();
      return;
    }
    await localRepository.saveTransaction(tx);
    void maybeScheduleReminder(tx, settings).catch((e: unknown) => {
      console.error('No se pudo programar el recordatorio en la nube:', e);
    });
    closeForm();
  }

  /** Borrar una cuota borra el diferido entero: uno con un hueco en la
   *  cuota 7 no significa nada, y descuadra el cupo en silencio. */
  async function handleDelete() {
    if (!editing) return;
    await borrarDiferido(editing);
    closeForm();
  }

  async function handleDuplicate() {
    if (!editing) return;
    const now = new Date().toISOString();
    await localRepository.saveTransaction({
      ...editing,
      id: crypto.randomUUID(),
      status: 'pending',
      quincenaKey: null,
      createdAt: now,
      updatedAt: now,
    });
    closeForm();
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setPrefill(undefined);
  }

  async function handleLoadDemo() {
    setLoadingDemo(true);
    try {
      await seedDemoTransactions();
    } finally {
      setLoadingDemo(false);
    }
  }

  const nav = (
    <MonthNav
      label={`${monthName(cursor.m).slice(0, 3)} ${cursor.y}`}
      onPrev={() => setCursor((c) => shiftMonth(c.y, c.m, -1))}
      onNext={() => setCursor((c) => shiftMonth(c.y, c.m, 1))}
      onToday={isCurrentMonth ? undefined : () => setCursor({ y: todayYear, m: todayMonth })}
    />
  );

  const refDialogo = useDialogo(() => setConfirmarBorrado(false), confirmarBorrado);
  return (
    <Screen
      title={enSeleccion ? `${elegidos.length} seleccionado${elegidos.length === 1 ? '' : 's'}` : 'Movimientos'}
      right={enSeleccion ? (
        <button type="button" onClick={() => setSeleccion(null)} style={botonTexto}>Cancelar</button>
      ) : (searching ? undefined : nav)}
    >
      {transactions.length > 0 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar en todo el historial…"
          type="search"
          style={{
            width: '100%', minHeight: 'var(--tap)', padding: '0 14px', marginBottom: 'var(--gap-m)',
            borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)',
            background: 'var(--surface)', color: 'var(--text)', fontSize: 16,
          }}
        />
      )}

      {transactions.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--gap-m)', overflowX: 'auto', paddingBottom: 2 }}>
          <Chip activo={filtroTipo === 'todos' && filtroEstado === 'todos'}
            onClick={() => { setFiltroTipo('todos'); setFiltroEstado('todos'); }}>Todos</Chip>
          <Chip activo={filtroTipo === 'expense'} onClick={() => setFiltroTipo(filtroTipo === 'expense' ? 'todos' : 'expense')}>Gastos</Chip>
          <Chip activo={filtroTipo === 'income'} onClick={() => setFiltroTipo(filtroTipo === 'income' ? 'todos' : 'income')}>Ingresos</Chip>
          <Chip activo={filtroEstado === 'pendientes'} onClick={() => setFiltroEstado(filtroEstado === 'pendientes' ? 'todos' : 'pendientes')}>Pendientes</Chip>
          <Chip activo={filtroEstado === 'pagados'} onClick={() => setFiltroEstado(filtroEstado === 'pagados' ? 'todos' : 'pagados')}>Pagados</Chip>
        </div>
      )}

      {/* Resumen del mes visible — contexto antes de la lista.
          En dos lineas y no una: a lo ancho de un iPhone, el conteo, los dos
          montos y el boton no caben juntos — "8 movimientos" se partia en
          dos y los numeros quedaban apretados contra el borde. */}
      {!searching && transactions.length > 0 && (
        <div
          style={{
            padding: '10px 14px', marginBottom: 'var(--gap-m)',
            background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-m)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {monthTotal.count} movimiento{monthTotal.count !== 1 ? 's' : ''}
            </span>
            {!enSeleccion && (
              <button type="button" onClick={() => setSeleccion(new Set())} style={botonTexto}>
                Seleccionar
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 'var(--text-md)', fontWeight: 700, marginTop: 2 }}>
            <span className="figures" style={{ color: 'var(--positive-text)' }}>+ {formatMoney(monthTotal.income)}</span>
            <span className="figures" style={{ color: 'var(--danger-text)' }}>− {formatMoney(monthTotal.expense)}</span>
          </div>
        </div>
      )}

      {transactions.length === 0 ? (
        <EmptyState
          title="Sin movimientos"
          body="Registra tu primer gasto con el botón +, o carga datos de ejemplo para ver cómo se ve la app funcionando."
          action={{ label: loadingDemo ? 'Cargando...' : 'Cargar datos de ejemplo', onClick: handleLoadDemo }}
        />
      ) : groups.length === 0 ? (
        <EmptyState
          title={searching ? 'Sin resultados' : 'Mes vacío'}
          body={searching
            ? `Nada coincide con "${query}".`
            : `No hay movimientos en ${monthName(cursor.m).toLowerCase()} ${cursor.y}.`}
        />
      ) : (
        groups.map((group) => (
          <section key={group.key} style={{ marginBottom: 'var(--gap-l)' }}>
            <div
              style={{
                // Superficie neutra, no un bloque teñido: el color de la
                // quincena vive en el punto y la etiqueta. Tenir el area
                // entera hacia que el fondo compitiera con los montos, que
                // son lo que se viene a leer.
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-m)',
                padding: '12px 14px 4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: `var(${group.colorVar})` }} />
                <span style={{ fontWeight: 700, fontSize: 13, color: `var(${group.colorVar})` }}>{group.label}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{group.rangeLabel}</span>
              </div>

              {group.transactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  category={tx.categoryId ? categoryById.get(tx.categoryId) : undefined}
                  paymentMethod={tx.paymentMethodId ? methodById.get(tx.paymentMethodId) : undefined}
                  onTogglePaid={() => togglePaid(tx)}
                  onOpen={() => { setEditing(tx); setFormOpen(true); }}
                  seleccionado={seleccion?.has(tx.id)}
                  onSeleccionar={enSeleccion ? () => alternarSeleccion(tx.id) : undefined}
                />
              ))}

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 8px' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Restante</span>
                <span className="figures" style={{ fontWeight: 700, color: group.balance.restante >= 0 ? 'var(--positive-text)' : 'var(--danger-text)' }}>
                  {formatMoney(group.balance.restante)}
                </span>
              </div>
            </div>
          </section>
        ))
      )}

      {enSeleccion && (
        <div
          role="toolbar"
          aria-label="Acciones sobre lo seleccionado"
          style={{
            position: 'fixed', left: 0, right: 0,
            // Justo encima del tab bar (61px) y su safe area.
            bottom: 'calc(var(--safe-bottom) + 61px)',
            zIndex: 45, display: 'flex', gap: 8,
            padding: '10px 16px',
            background: 'var(--surface)',
            borderTop: '1px solid var(--line)',
            boxShadow: '0 -2px 12px rgb(0 0 0 / 0.08)',
          }}
        >
          <button
            type="button"
            onClick={marcarElegidosPagados}
            disabled={elegidos.length === 0 || aplicando}
            style={accionStyle(elegidos.length > 0 && !aplicando, 'var(--positive)', 'var(--positive-text)')}
          >
            Marcar pagados
          </button>
          <button
            type="button"
            onClick={() => setConfirmarBorrado(true)}
            disabled={elegidos.length === 0 || aplicando}
            style={accionStyle(elegidos.length > 0 && !aplicando, 'var(--danger)', 'var(--danger-text)')}
          >
            Eliminar
          </button>
        </div>
      )}

      {confirmarBorrado && (
        <div
      ref={refDialogo}
          role="dialog"
          aria-label="Confirmar eliminación"
          onClick={() => setConfirmarBorrado(false)}
          style={{
            position: 'fixed', inset: 0, background: 'color-mix(in srgb, black 40%, transparent)',
            display: 'flex', alignItems: 'flex-end', zIndex: 70,
            animation: 'fadeIn var(--dur-fast) var(--ease-spring-out)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 560, margin: '0 auto', background: 'var(--surface)',
              borderRadius: '20px 20px 0 0', padding: '10px 20px calc(var(--safe-bottom) + 20px)',
              animation: 'slideUp var(--dur-med) var(--ease-spring-out)',
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '4px auto 16px' }} />
            <h2 style={{ margin: '0 0 6px', fontSize: 'var(--text-lg)', fontWeight: 700 }}>
              ¿Eliminar {elegidos.length} movimiento{elegidos.length === 1 ? '' : 's'}?
            </h2>
            <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 'var(--text-base)', lineHeight: 'var(--lh-normal)' }}>
              Suman {formatMoney(elegidos.reduce((a, t) => a + t.amount, 0))}. Esto no se puede deshacer,
              y también desaparecen de tus otros dispositivos.
            </p>
            <button
              type="button"
              onClick={borrarElegidos}
              disabled={aplicando}
              style={{
                width: '100%', minHeight: 48, borderRadius: 'var(--radius-s)', border: 'none',
                background: 'var(--danger)', color: '#fff', fontWeight: 700, fontSize: 16,
                cursor: aplicando ? 'not-allowed' : 'pointer', marginBottom: 8,
              }}
            >
              {aplicando ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmarBorrado(false)}
              style={{
                width: '100%', minHeight: 44, borderRadius: 'var(--radius-s)', border: 'none',
                background: 'var(--surface-sunken)', color: 'var(--text)', fontWeight: 600,
                fontSize: 'var(--text-base)', cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {formOpen && (
        <TransactionForm
          existing={editing}
          prefill={editing ? undefined : prefill}
          categories={categories}
          paymentMethods={paymentMethods}
          defaultPaymentMethodId={settings.defaultPaymentMethodId ?? paymentMethods.find((m) => m.isDefault)?.id ?? null}
          onSave={handleSave}
          onDelete={editing ? handleDelete : undefined}
          onDuplicate={editing ? handleDuplicate : undefined}
          onCancel={closeForm}
        />
      )}
    </Screen>
  );
}

const botonTexto: React.CSSProperties = {
  border: 'none', background: 'none', color: 'var(--q10-text)',
  fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer',
  minHeight: 'var(--tap)', padding: '0 4px',
};

/**
 * El borde usa el color de identidad y el TEXTO su variante -text. No es
 * un capricho: el verde y el rojo de iOS sobre blanco dan 2.2:1 y 3.5:1,
 * por debajo del 4.5:1 que necesita un texto para leerse.
 */
function accionStyle(activo: boolean, borde: string, texto: string): React.CSSProperties {
  return {
    flex: 1, minHeight: 'var(--tap)', borderRadius: 'var(--radius-s)',
    border: `1px solid ${activo ? borde : 'var(--line)'}`,
    background: 'var(--surface)',
    color: activo ? texto : 'var(--text-faint)',
    fontWeight: 600, fontSize: 'var(--text-base)',
    cursor: activo ? 'pointer' : 'not-allowed',
  };
}

/** Chip de filtro. Alterna: volver a tocarlo lo apaga. */
function Chip({ activo, onClick, children }: {
  activo: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      style={{
        flex: 'none', minHeight: 34, padding: '0 14px', borderRadius: 999,
        border: `1px solid ${activo ? 'var(--q10)' : 'var(--line-strong)'}`,
        background: activo ? 'var(--q10)' : 'var(--surface)',
        color: activo ? '#fff' : 'var(--text)',
        fontWeight: 600, fontSize: 'var(--text-sm)', cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}
