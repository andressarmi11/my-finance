import { IconCheck, IconCreditCardOff } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { MonthNav, monthName } from '@/components/ui/MonthNav';
import { db } from '@/data/db';
import { localRepository, DEFAULT_SETTINGS } from '@/data/local/localRepository';
import { seedDemoTransactions } from '@/data/local/demoData';
import { ensureMonthMaterialized } from '@/data/local/materialize';
import { formatMoney } from '@/domain/money/format';
import { CategoryAvatar } from '@/components/ui/CategoryIcon';
import { categoryColor, COLOR_SIN_CATEGORIA } from '@/domain/seed/categoryColor';
import { calcularBalanceMes } from '@/domain/periodo/balance';
import { calculateMonthFlow } from '@/domain/totals/available';
import { calculatePorPagar } from '@/domain/totals/porPagar';
import { saldosSinPagar } from '@/domain/credit-card/disponible';
import { calcularPeriodo, periodosDelMes } from '@/domain/periodo/periodo';
import { conPeriodoResuelto } from '@/domain/periodo/resolve';
import { shiftMonth } from '@/domain/dates';
import { formatShortDate } from '@/lib/formatShortDate';
import { todayISO, nowISO } from '@/lib/todayISO';
import { selectUpcoming, upcomingTotals, relevantDate } from './upcoming';
import { AnimatedNumber } from './AnimatedNumber';
import { PorPagarSheet } from './PorPagarSheet';
import { haptic } from '@/lib/haptic';
import type { Transaction } from '@/domain/types';
import { VACIO } from '@/lib/vacio';


export function DashboardScreen() {
  const navigate = useNavigate();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [porPagarOpen, setPorPagarOpen] = useState(false);

  const today = todayISO();
  const [todayYear, todayMonth] = today.split('-').map(Number) as [number, number];

  // Mes visible. Arranca en el actual; las flechas lo mueven. Todo lo de
  // abajo (flujo, quincenas, proximos) se recalcula sobre ESTE mes.
  const [cursor, setCursor] = useState({ y: todayYear, m: todayMonth });
  const { y: year, m: month } = cursor;
  const isCurrentMonth = year === todayYear && month === todayMonth;

  // Los recurrentes solo estan materializados ~3 meses adelante. Al mirar
  // un mes fuera de esa ventana hay que crearlos, si no el mes sale vacio
  // aunque la regla no tenga fecha limite.
  useEffect(() => { void ensureMonthMaterialized(year, month); }, [year, month]);

  const settings = useLiveQuery(() => localRepository.getSettings(), []) ?? DEFAULT_SETTINGS;
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? VACIO;
  const categories = useLiveQuery(() => localRepository.listCategories(), []) ?? VACIO;
  const paymentMethods = useLiveQuery(() => localRepository.listPaymentMethods(), []) ?? VACIO;
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const resolved = useMemo(
    () => conPeriodoResuelto(transactions, settings.diasDePago),
    [transactions, settings.diasDePago],
  );

  // Tantas claves como periodos tenga el mes: dos si te pagan quincenal,
  // una si te pagan una vez al mes. Pedir Q1 y Q2 a mano dejaba fuera
  // movimientos —y reventaba— en cuanto los periodos no eran dos.
  const monthKeys = useMemo(
    () => periodosDelMes(year, month, settings.diasDePago),
    [year, month, settings.diasDePago],
  );

  // Por el periodo de CARGO, no el de registro: estos cuatro numeros —
  // flujo, falta pagar, proximos — responden "cuanta plata se mueve este
  // mes", y una compra con tarjeta se mueve el dia que se paga el extracto,
  // no el dia que la hiciste. Ver domain/periodo/resolve.ts.
  const monthTransactions = useMemo(
    () => resolved.filter((t) => monthKeys.includes(t.resolvedCargoKey)),
    [resolved, monthKeys],
  );

  // Con los días de pago: sin ellos cae en el valor por defecto [10, 25] y
  // dibuja DOS periodos aunque te paguen una vez al mes — el segundo, vacío.
  const monthBalance = useMemo(
    () => calcularBalanceMes(resolved, year, month, settings.diasDePago),
    [resolved, year, month, settings.diasDePago],
  );
  const flow = useMemo(() => calculateMonthFlow(monthTransactions), [monthTransactions]);

  // Conjuntos disjuntos: un gasto con tarjeta cuenta UNA vez, en tarjeta.
  // Antes los tres filtros se solapaban y el chip mostraba un conteo
  // inflado al lado de un total correcto. Ver domain/totals/porPagar.ts.
  const porPagar = useMemo(() => calculatePorPagar(monthTransactions), [monthTransactions]);

  // Saldos de tarjeta que ya vencieron y siguen sin marcarse pagados.
  // Mira TODO el historial, no el mes: lo que se olvido de pagar en junio
  // sigue comiendo cupo hoy, y es justo lo que nadie recuerda solo.
  const vencidos = useMemo(
    () => saldosSinPagar(paymentMethods, transactions, today),
    [paymentMethods, transactions, today],
  );

  // Proximos: la MISMA lista del mes que alimenta el hero, para que
  // "falta pagar" de arriba y "esperas gastar" de abajo coincidan.
  const upcoming = useMemo(() => selectUpcoming(monthTransactions, 8), [monthTransactions]);
  const totals = useMemo(() => upcomingTotals(monthTransactions), [monthTransactions]);

  // Quincena activa: se la pregunta al dominio en vez de recalcularla.
  // La cuenta a mano (`dia < quincenaStartDays[1] ? 0 : 1`) estaba MAL los
  // primeros ~9 días de cada mes: el 3 de septiembre marcaba la quincena
  // del 10 de septiembre, cuando la que sigue viva es la del 25 de AGOSTO
  // — que es justo la que cruza el cambio de mes, el caso que el dominio
  // ya modela y tiene testeado.
  const claveHoy = useMemo(
    () => calcularPeriodo(today, settings.diasDePago).key,
    [today, settings.diasDePago],
  );
  const activeQuincenaIdx = monthKeys.indexOf(claveHoy);
  const heroTintVar = activeQuincenaIdx === 1 ? '--q25-soft' : '--q10-soft';
  const heroAccentVar = activeQuincenaIdx === 1 ? '--q25' : '--q10';

  async function handleLoadDemo() {
    setLoadingDemo(true);
    try {
      await seedDemoTransactions();
    } finally {
      setLoadingDemo(false);
    }
  }

  async function toggleTxPaid(tx: Transaction) {
    haptic('medium');
    await localRepository.saveTransaction({
      ...tx,
      status: tx.status === 'paid' ? 'pending' : 'paid',
      updatedAt: nowISO(),
    });
  }

  const nav = (
    <MonthNav
      label={`${monthName(month)} ${year}`}
      onPrev={() => setCursor((c) => shiftMonth(c.y, c.m, -1))}
      onNext={() => setCursor((c) => shiftMonth(c.y, c.m, 1))}
      onToday={isCurrentMonth ? undefined : () => setCursor({ y: todayYear, m: todayMonth })}
    />
  );

  if (transactions.length === 0) {
    return (
      <Screen title={settings.displayName ? `Hola, ${settings.displayName}` : 'Inicio'} subtitle={`${monthName(month)} ${year}`}>
        <EmptyState
          title="Todavía no hay movimientos"
          body="Registra tu primer gasto o ingreso, o carga datos de ejemplo para ver el dashboard funcionando."
          action={{ label: loadingDemo ? 'Cargando...' : 'Cargar datos de ejemplo', onClick: handleLoadDemo }}
        />
      </Screen>
    );
  }

  return (
    <Screen title={settings.displayName ? `Hola, ${settings.displayName}` : 'Inicio'} right={nav}>
      {/* Solo si hay algo que avisar. Que todo este al dia no es noticia
          — misma regla que SyncIndicator. */}
      {vencidos.length > 0 && (
        <button
          type="button"
          onClick={() => navigate('/tarjeta')}
          style={{
            width: '100%', textAlign: 'left', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'var(--danger-soft)',
            border: '1px solid color-mix(in srgb, var(--danger) 30%, var(--line))',
            borderRadius: 'var(--radius-m)', padding: '12px 14px', marginBottom: 12,
          }}
        >
          <IconCreditCardOff size={22} stroke={1.75} aria-hidden style={{ flex: 'none' }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--danger-text)' }}>
              {vencidos.length === 1 ? 'Un saldo sin pagar' : `${vencidos.length} saldos sin pagar`}
            </span>
            <span style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {vencidos.length === 1
                ? `${vencidos[0]!.tarjeta.name} · venció el ${formatShortDate(vencidos[0]!.paymentDate).day} ${formatShortDate(vencidos[0]!.paymentDate).month}`
                : 'Márcalos para liberar cupo'}
            </span>
          </span>
          <span className="figures" style={{ flex: 'none', fontWeight: 700, color: 'var(--danger-text)' }}>
            {formatMoney(vencidos.reduce((a, v) => a + v.total, 0))}
          </span>
        </button>
      )}

      {/* Hero: como termina el mes si todo se cumple. */}
      <div
        style={{
          background: `color-mix(in srgb, var(${heroTintVar}) 65%, var(--surface))`,
          border: `1px solid color-mix(in srgb, var(${heroAccentVar}) 20%, var(--line))`,
          borderRadius: 'var(--radius-l)',
          padding: '20px 20px 16px',
          marginBottom: 12,
          boxShadow: 'var(--shadow-1)',
        }}
      >
        <p style={{ margin: '0 0 6px', fontSize: 'var(--text-sm)', color: `var(${heroAccentVar})`, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
          Te queda este mes
        </p>
        <AnimatedNumber
          value={monthBalance.sobrante}
          format={(n) => formatMoney(n)}
          className="figures"
          style={{
            display: 'block',
            fontSize: 'var(--text-3xl)',
            fontWeight: 700,
            lineHeight: 'var(--lh-tight)',
            letterSpacing: '-0.022em',
            color: monthBalance.sobrante >= 0 ? 'var(--text)' : 'var(--danger-text)',
          }}
        />
        <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          Ingresos menos gastos del mes, contando lo pagado y lo que falta.
        </p>

        {/* Los cuatro numeros que lo componen. Ninguno puede ser negativo. */}
        <div
          style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1,
            marginTop: 14, borderRadius: 'var(--radius-s)', overflow: 'hidden',
            background: `color-mix(in srgb, var(${heroAccentVar}) 12%, var(--line))`,
          }}
        >
          <FlowCell label="Ya recibiste" value={flow.recibido} tone="positive" />
          <FlowCell label="Falta recibir" value={flow.porRecibir} tone="positive-soft" />
          <FlowCell label="Ya pagaste" value={flow.pagado} tone="plain" />
          <FlowCell label="Falta pagar" value={flow.porPagar} tone="danger-soft" />
        </div>
      </div>

      {/* Un recuadro por periodo: dos si te pagan quincenal, uno si una vez al mes. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${monthBalance.periodos.length}, 1fr)`,
          gap: 10,
          marginBottom: 14,
        }}
      >
        {monthBalance.periodos.map((p, i) => (
          <PeriodoCard
            key={p.key}
            label={etiquetaPeriodo(settings.diasDePago, i, month)}
            restante={p.restante}
            colorVar={i % 2 === 1 ? '--q25' : '--q10'}
            softVar={i % 2 === 1 ? '--q25-soft' : '--q10-soft'}
            isActive={activeQuincenaIdx === i}
          />
        ))}
      </div>

      {porPagar.count > 0 && (
        <button
          type="button"
          onClick={() => setPorPagarOpen(true)}
          style={{
            width: '100%', background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 'var(--radius-m)', padding: '14px 16px', marginBottom: 20,
            cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center',
            gap: 12, color: 'var(--text)', boxShadow: 'var(--shadow-1)',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>
              Desglose de lo que falta pagar
            </div>
            <div className="figures" style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
              {porPagar.count} · {formatMoney(porPagar.monto)}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)', marginTop: 2 }}>
              {porPagar.pendientes.length} pendiente{porPagar.pendientes.length !== 1 ? 's' : ''} · {porPagar.programados.length} programado{porPagar.programados.length !== 1 ? 's' : ''} · {porPagar.enTarjeta.length} en tarjeta
            </div>
          </div>
          <span style={{ color: 'var(--text-faint)', fontSize: 22 }}>›</span>
        </button>
      )}

      {/* Proximos movimientos DEL MES visible: ingresos y gastos. */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 0 10px' }}>
        <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, margin: 0, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Falta este mes
        </h2>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
          {monthName(month).toLowerCase()}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <ExpectCard label="Esperas recibir" value={totals.income} color="var(--positive)" sign="+" />
        <ExpectCard label="Esperas gastar" value={totals.expense} color="var(--danger)" sign="−" />
      </div>

      {upcoming.length === 0 ? (
        <p style={{ color: 'var(--text-faint)', fontSize: 'var(--text-sm)' }}>
          Nada pendiente en {monthName(month).toLowerCase()}. 🎉
        </p>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-m)', overflow: 'hidden' }}>
          {upcoming.map((tx, idx) => {
            const cat = tx.categoryId ? categoryById.get(tx.categoryId) : undefined;
            const { day, month: monthLabel } = formatShortDate(relevantDate(tx));
            const isIncome = tx.type === 'income';
            const isPaid = tx.status === 'paid';
            const isLate = isCurrentMonth && relevantDate(tx) < today;
            return (
              <div
                key={tx.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderBottom: idx < upcoming.length - 1 ? '1px solid var(--line)' : 'none',
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleTxPaid(tx)}
                  aria-pressed={isPaid}
                  aria-label={isIncome ? 'Marcar como recibido' : 'Marcar como pagado'}
                  style={{
                    width: 28, height: 28, minWidth: 28, borderRadius: 14, flex: 'none',
                    border: `1.5px solid ${isPaid ? 'var(--positive)' : 'var(--line-strong)'}`,
                    background: isPaid ? 'var(--positive)' : 'transparent',
                    color: isPaid ? '#fff' : 'transparent',
                    display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: 14,
                    transition: 'all var(--dur-fast) var(--ease-spring-out)',
                  }}
                >
                  <IconCheck size={15} stroke={2.5} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/movimientos')}
                  style={{
                    flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none',
                    padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text)',
                  }}
                >
                  <CategoryAvatar
                    icon={cat?.icon ?? (isIncome ? 'salary' : 'other')}
                    color={cat ? categoryColor(cat) : COLOR_SIN_CATEGORIA}
                    size={36}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--text-md)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.concept}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: isLate ? 'var(--danger-text)' : 'var(--text-muted)' }}>
                      {isLate ? 'venció ' : ''}{day} {monthLabel}
                    </div>
                  </div>
                </button>
                <span
                  className="figures"
                  style={{ fontWeight: 600, fontSize: 'var(--text-md)', color: isIncome ? 'var(--positive-text)' : 'var(--text)' }}
                >
                  {isIncome ? '+ ' : ''}{formatMoney(tx.amount)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate('/movimientos')}
        style={{ marginTop: 16, width: '100%', minHeight: 44, borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 'var(--text-base)' }}
      >
        Ver todos los movimientos
      </button>

      {porPagarOpen && (
        <PorPagarSheet porPagar={porPagar} onClose={() => setPorPagarOpen(false)} />
      )}
    </Screen>
  );
}

function FlowCell({ label, value, tone }: { label: string; value: number; tone: 'positive' | 'positive-soft' | 'plain' | 'danger-soft' }) {
  const color =
    tone === 'positive' ? 'var(--positive)'
    : tone === 'positive-soft' ? 'color-mix(in srgb, var(--positive) 70%, var(--text-muted))'
    : tone === 'danger-soft' ? 'color-mix(in srgb, var(--danger) 70%, var(--text-muted))'
    : 'var(--text)';
  return (
    <div style={{ background: 'var(--surface)', padding: '10px 12px' }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div className="figures" style={{ fontSize: 'var(--text-md)', fontWeight: 700, color }}>{formatMoney(value)}</div>
    </div>
  );
}

function ExpectCard({ label, value, color, sign }: { label: string; value: number; color: string; sign: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-m)', padding: '12px 14px' }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      <div className="figures" style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: value > 0 ? color : 'var(--text-faint)' }}>
        {value > 0 ? `${sign} ` : ''}{formatMoney(value)}
      </div>
    </div>
  );
}

/**
 * Como se llama un periodo en el recuadro. Con dos o mas dias de pago es la
 * palabra que la persona ya usa; con uno solo, decir "quincena" seria
 * mentira, asi que se nombra el mes —o desde cuando empieza, si su mes no
 * es el del calendario.
 */
function etiquetaPeriodo(dias: number[], indice: number, mes: number): string {
  if (dias.length > 1) return `Quincena del ${dias[indice]}`;
  const dia = dias[0] ?? 1;
  if (dia === 1) {
    const n = monthName(mes);
    return n.charAt(0).toUpperCase() + n.slice(1);
  }
  return `Desde el ${dia}`;
}

function PeriodoCard({ label, restante, colorVar, softVar, isActive }: {
  label: string; restante: number; colorVar: string; softVar: string; isActive: boolean;
}) {
  return (
    <div
      style={{
        background: `var(${softVar})`,
        borderRadius: 'var(--radius-m)',
        padding: '14px 16px',
        border: isActive ? `2px solid var(${colorVar})` : '2px solid transparent',
        position: 'relative',
      }}
    >
      {isActive && (
        <span
          aria-label="Periodo activo"
          style={{
            position: 'absolute', top: 8, right: 10, width: 6, height: 6,
            borderRadius: 3, background: `var(${colorVar})`,
          }}
        />
      )}
      <p style={{ margin: '0 0 6px', fontSize: 'var(--text-xs)', fontWeight: 700, color: `var(${colorVar})`, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
        {label}
      </p>
      <p className="figures" style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700, color: restante >= 0 ? 'var(--text)' : 'var(--danger-text)' }}>
        {formatMoney(restante)}
      </p>
    </div>
  );
}
