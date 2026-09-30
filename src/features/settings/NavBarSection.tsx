import { useLiveQuery } from 'dexie-react-hooks';
import type { CSSProperties } from 'react';
import { CategoryAvatar } from '@/components/ui/CategoryIcon';
import { TABS } from '@/components/ui/TabBar';
import { db } from '@/data/db';
import { localRepository } from '@/data/local/localRepository';
import { formatMoney } from '@/domain/money/format';
import { categoryColor, UNCATEGORIZED_COLOR } from '@/domain/seed/categoryColor';
import { useT } from '@/i18n/language';
import type { TextKey } from '@/i18n/texts';
import { EMPTY } from '@/lib/empty';
import {
  applyPreset, clampOpacity, NAV_BAR_MIN, navBarVars, presetOf, useNavBar, type NavPreset,
} from '@/lib/navBar';
import { Switch } from './ui';

const PRESETS: Array<{ key: NavPreset; label: TextKey }> = [
  { key: 'solid', label: 'navBar.solid' },
  { key: 'translucent', label: 'navBar.translucent' },
  { key: 'glass', label: 'navBar.glass' },
];

/** The note under the controls, by what the opacity amounts to. */
export function navBarNote(opacity: number): TextKey {
  return opacity >= 100 ? 'navBar.noteSolid' : opacity <= 55 ? 'navBar.noteGlass' : 'navBar.noteTranslucent';
}

/** "Cristal", or "63 %" for a slider value between the shortcuts: the Ajustes row's value. */
export function useNavBarLabel(): string {
  const t = useT();
  const [nav] = useNavBar();
  const preset = presetOf(nav.opacity);
  return preset ? t(PRESETS.find((p) => p.key === preset)!.label) : `${nav.opacity}%`;
}

/**
 * "Barra de navegación" under the themes (BARRA.md 5a): a 150 px preview
 * with rows passing behind the bar, Sólida / Translúcida / Cristal, the
 * opacity slider (15–100 %), whether the + goes glass too, and a note.
 * Every change is saved (localStorage) and the real bar follows at once.
 */
export function NavBarSection() {
  const t = useT();
  const [nav, setNav] = useNavBar();
  const preset = presetOf(nav.opacity);
  // The preview draws the same variables the real bar reads, from this value.
  const vars = navBarVars(nav) as CSSProperties;

  const recent = useLiveQuery(() => db.transactions.orderBy('date').reverse().limit(4).toArray(), []) ?? EMPTY;
  const categories = useLiveQuery(() => localRepository.listCategories(), []) ?? EMPTY;
  const byId = new Map(categories.map((c) => [c.id, c]));
  const rows = recent.length > 0
    ? recent.map((tx) => {
        const cat = tx.categoryId ? byId.get(tx.categoryId) : undefined;
        return {
          id: tx.id, name: tx.concept, icon: cat?.icon ?? (tx.type === 'income' ? 'salary' : 'other'),
          color: cat ? categoryColor(cat) : UNCATEGORIZED_COLOR,
          amount: `${tx.type === 'income' ? '+ ' : ''}${formatMoney(tx.amount)}`, income: tx.type === 'income',
        };
      })
    : categories.slice(0, 4).map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: categoryColor(c), amount: '', income: false }));

  return (
    <section aria-labelledby="navbar-title">
      <h2 id="navbar-title" style={{ margin: '26px 6px 8px', fontSize: 13, fontWeight: 600, color: 'var(--text-faint)' }}>
        {t('navBar.title')}
      </h2>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 14 }}>
        <div
          role="img"
          aria-label={t('navBar.preview')}
          data-testid="navbar-preview"
          style={{ ...vars, position: 'relative', height: 150, borderRadius: 14, overflow: 'hidden', background: 'var(--paper)' }}
        >
          <div aria-hidden style={{ position: 'absolute', inset: 0, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CategoryAvatar icon={r.icon} color={r.color} size={30} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                <span className="figures" style={{ fontSize: 14, fontWeight: 700, color: r.income ? 'var(--positive-text)' : 'var(--text)' }}>{r.amount}</span>
              </div>
            ))}
          </div>
          <div aria-hidden style={{ position: 'absolute', left: 10, right: 10, bottom: 10, display: 'flex', gap: 8 }}>
            <div
              style={{
                flex: 1, height: 46, borderRadius: 23, padding: 3, boxSizing: 'border-box',
                display: 'grid', gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
                background: 'var(--nav-bg)', backdropFilter: 'var(--nav-filter)', WebkitBackdropFilter: 'var(--nav-filter)',
                border: '1px solid var(--nav-border)', boxShadow: 'var(--nav-shadow)',
              }}
            >
              {TABS.map((tab, i) => (
                <span
                  key={tab.to}
                  style={{
                    borderRadius: 20, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 600,
                    background: i === 0 ? 'var(--nav-active)' : 'transparent',
                    color: i === 0 ? 'var(--text)' : 'var(--nav-ink)',
                  }}
                >
                  {t(tab.key)}
                </span>
              ))}
            </div>
            <span
              style={{
                width: 46, height: 46, borderRadius: 23, flex: 'none', display: 'grid', placeItems: 'center', boxSizing: 'border-box',
                background: 'var(--fab-bg)', color: 'var(--fab-color)', border: '1px solid var(--fab-border)',
                backdropFilter: 'var(--fab-filter)', WebkitBackdropFilter: 'var(--fab-filter)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </span>
          </div>
        </div>

        <div
          role="group"
          aria-label={t('navBar.style')}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', background: 'var(--paper)', borderRadius: 12, padding: 3, marginTop: 14 }}
        >
          {PRESETS.map((p) => {
            const on = preset === p.key;
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={on}
                onClick={() => setNav(applyPreset(nav, p.key))}
                style={{
                  height: 34, border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                  background: on ? 'var(--line-strong)' : 'transparent', color: on ? 'var(--text)' : 'var(--text-faint)',
                }}
              >
                {t(p.label)}
              </button>
            );
          })}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <span style={{ fontSize: 14, flex: 'none' }}>{t('navBar.opacity')}</span>
          <input
            type="range"
            min={NAV_BAR_MIN}
            max={100}
            step={1}
            value={nav.opacity}
            onChange={(e) => setNav({ ...nav, opacity: clampOpacity(Number(e.target.value)) })}
            aria-label={t('navBar.opacity')}
            aria-valuetext={`${nav.opacity}%`}
            style={{ flex: 1, minWidth: 0, accentColor: 'var(--q10)' }}
          />
          <span className="figures" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', width: 42, textAlign: 'right' }}>
            {nav.opacity}%
          </span>
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14 }}>{t('navBar.fabGlass')}</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>{t('navBar.fabGlassSub')}</span>
          </span>
          <Switch on={nav.fabGlass} onChange={(fabGlass) => setNav({ ...nav, fabGlass })} label={t('navBar.fabGlass')} />
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '12px 0 0', lineHeight: 1.45 }}>
          {t(navBarNote(nav.opacity))}
        </p>
      </div>
    </section>
  );
}
