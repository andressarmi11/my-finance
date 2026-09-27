import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { formatCompact, formatMoney } from '@/domain/money/format';
import { categoryColor } from '@/domain/seed/categoryColor';
import { calculateBudgetStatus } from '@/domain/budget/status';
import type { Budget, Category, Transaction } from '@/domain/types';

/**
 * Presupuestos en columnas verticales: la columna gris ES el presupuesto y
 * lo que se llena desde abajo ES lo gastado. Un tanque por categoria.
 *
 * Vertical y no la barra horizontal de la pantalla de Presupuestos, a
 * proposito: aqui la pregunta no es "cuanto me queda en Alimentacion" sino
 * "cual de todas se me esta llenando". Puestas en fila, la altura relativa
 * se compara de un vistazo, que es justo lo que una lista de barras
 * horizontales apiladas no deja hacer.
 *
 * Solo aparecen las categorias CON presupuesto. Dibujar columnas vacias
 * para las que no tienen seria llenar el grafico de ruido; definirlos
 * sigue siendo cosa de Ajustes.
 */
export function BudgetColumns({ categories, budgets, transactions, mesPrefijo }: {
  categories: Category[];
  budgets: Budget[];
  transactions: Transaction[];
  /** 'YYYY-MM' del mes que se está mirando. */
  mesPrefijo: string;
}) {
  const porCategoria = new Map(categories.map((c) => [c.id, c]));

  const gastadoPorCategoria = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== 'expense' || tx.status === 'cancelled') continue;
    if (!tx.categoryId || !tx.date.startsWith(mesPrefijo)) continue;
    gastadoPorCategoria.set(tx.categoryId, (gastadoPorCategoria.get(tx.categoryId) ?? 0) + tx.amount);
  }

  const columnas = budgets
    .filter((b) => b.amount > 0 && porCategoria.has(b.categoryId))
    .map((b) => {
      const categoria = porCategoria.get(b.categoryId)!;
      const gastado = gastadoPorCategoria.get(b.categoryId) ?? 0;
      const estado = calculateBudgetStatus(gastado, b.amount).state;
      return {
        categoria,
        gastado,
        presupuesto: b.amount,
        proporcion: gastado / b.amount,
        estado,
      };
    })
    // Lo mas lleno primero: es lo que hay que mirar.
    .sort((a, b) => b.proporcion - a.proporcion);

  if (columnas.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-faint)' }}>
        Todavía no has puesto presupuestos. Se definen en Ajustes → Presupuestos, y aparecen aquí.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
      {columnas.map((c) => {
        const lleno = Math.min(1, c.proporcion);
        const excedido = c.proporcion > 1;
        const color = excedido ? 'var(--danger)' : c.estado === 'warning' ? 'var(--q25)' : 'var(--positive)';
        const pct = Math.round(c.proporcion * 100);
        return (
          <div
            key={c.categoria.id}
            title={`${c.categoria.name}: ${formatMoney(c.gastado)} de ${formatMoney(c.presupuesto)}`}
            style={{ flex: 'none', width: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
          >
            <span
              className="figures"
              style={{
                fontSize: 'var(--text-xs)', fontWeight: 700,
                color: excedido ? 'var(--danger-text)' : 'var(--text-muted)',
              }}
            >
              {pct}%
            </span>

            <div
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${c.categoria.name}, ${pct}% del presupuesto`}
              style={{
                position: 'relative', width: '100%', height: 96,
                borderRadius: 10, background: 'var(--surface-sunken)',
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  position: 'absolute', left: 0, right: 0, bottom: 0,
                  height: `${lleno * 100}%`,
                  // Rayado cuando se paso. Una columna llena se ve igual al
                  // 100% que al 125%, y esa es justo la diferencia que
                  // importa. Es el mismo lenguaje que la barra horizontal
                  // de Presupuestos: rayas = exceso.
                  background: excedido
                    ? `repeating-linear-gradient(135deg, ${color} 0 5px, color-mix(in srgb, ${color} 55%, transparent) 5px 10px)`
                    : color,
                  transition: 'height var(--dur-med, 240ms) var(--ease-spring-out, ease-out)',
                }}
              />
            </div>

            <span style={{ color: categoryColor(c.categoria), lineHeight: 0 }}>
              <CategoryIcon icon={c.categoria.icon} size={17} />
            </span>
            <span
              className="figures"
              style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}
            >
              {formatCompact(c.presupuesto)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
