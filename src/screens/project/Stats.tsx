import { useState } from 'preact/hooks';
import { toast } from '../../components/toast';
import { Empty, Gauge, Icon } from '../../components/ui';
import { addDays, daysBetween, fmtDate, todayISO } from '../../lib/date';
import { fmt } from '../../lib/money';
import { go } from '../../lib/router';
import { budgetAlerts } from './budget';
import { categoryOf, memberName, type Group } from './common';

export function StatsTab({ g }: { g: Group }) {
  const d = g.p.data;
  const cur = d.currency;
  const r = g.report;
  const [day, setDay] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function exportAs(kind: 'csv' | 'pdf') {
    setExporting(true);
    try {
      const mod = await import('../../lib/export');
      if (kind === 'csv') await mod.exportCSV(g);
      else await mod.exportPDF(g);
    } catch (e) {
      toast('Export impossible : ' + (e instanceof Error ? e.message : ''), { tone: 'error' });
    } finally {
      setExporting(false);
    }
  }

  const exportPanel = (
    <section class="panel">
      <h2>Exporter</h2>
      <div class="row gap">
        <button type="button" class="btn grow" disabled={exporting} onClick={() => exportAs('csv')}>
          <Icon name="download" size={18} /> CSV (Excel)
        </button>
        <button type="button" class="btn grow" disabled={exporting} onClick={() => exportAs('pdf')}>
          <Icon name="download" size={18} /> PDF
        </button>
      </div>
    </section>
  );

  const budget = d.modules.budget ? <BudgetPanel g={g} /> : null;
  if (!r.total) {
    return (
      <>
        {budget}
        <section class="panel">
          <Empty icon="📊" title="Pas encore de chiffres" />
        </section>
        {g.expenses.length > 0 && exportPanel}
      </>
    );
  }

  const cats = Object.entries(r.byCategory).sort((a, b) => b[1] - a[1]);
  const maxCat = cats[0]?.[1] || 1;
  const consumers = g.members.map((m) => ({ id: m.id, v: r.consumed[m.id] || 0 })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const maxCons = consumers[0]?.v || 1;

  // Dépenses par jour, sur la période du projet ou celle des dépenses.
  const dates = Object.keys(r.byDay).sort();
  const start = d.startDate && d.startDate <= dates[0] ? d.startDate : dates[0];
  let end = d.endDate && d.endDate >= dates[dates.length - 1] ? d.endDate : dates[dates.length - 1];
  if (daysBetween(start, end) > 60) end = dates[dates.length - 1];
  const span = Math.max(1, daysBetween(start, end) + 1);
  const days = span <= 62 ? Array.from({ length: span }, (_, i) => addDays(start, i)) : [];
  const maxDay = Math.max(1, ...days.map((x) => r.byDay[x] || 0));
  const activePeople = g.people.length || 1;
  const nExpenses = g.expenses.filter((e) => e.data.kind === 'expense').length;
  const elapsed = Math.max(1, Math.min(span, daysBetween(start, todayISO()) + 1));

  return (
    <>
      {budget}
      <div class="stat-grid">
        <div class="stat">
          <span class="v">{fmt(r.total, cur)}</span>
          <span class="k">Total · {nExpenses} dépense{nExpenses > 1 ? 's' : ''}</span>
        </div>
        <div class="stat">
          <span class="v">{fmt(Math.round(r.total / activePeople), cur)}</span>
          <span class="k">Par personne ({activePeople})</span>
        </div>
        {span > 1 && (
          <div class="stat">
            <span class="v">{fmt(Math.round(r.total / elapsed), cur)}</span>
            <span class="k">Par jour</span>
          </div>
        )}
        {g.me && (
          <div class="stat">
            <span class="v">{fmt(r.consumed[g.me] || 0, cur)}</span>
            <span class="k">Ma part</span>
          </div>
        )}
      </div>

      <section class="panel">
        <h2>Par catégorie</h2>
        <div class="bars">
          {cats.map(([id, v]) => {
            const c = categoryOf(g.p, id);
            return (
              <div class="bar-row" key={id}>
                <span class="bar-label">
                  <span aria-hidden="true">{c.icon}</span>
                  <span>{c.label}</span>
                </span>
                <span class="bar-value">
                  {fmt(v, cur)} <span class="muted small">· {Math.round((v / r.total) * 100)} %</span>
                </span>
                <div class="bar-track" aria-hidden="true">
                  <span style={{ width: (v / maxCat) * 100 + '%' }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {days.length > 1 && (
        <section class="panel">
          <div class="panel-head">
            <h2>Par jour</h2>
            <span class="small muted num">{day ? `${fmtDate(day)} : ${fmt(r.byDay[day] || 0, cur)}` : 'Touche une barre'}</span>
          </div>
          <div class="vbars" role="img" aria-label="Dépenses par jour">
            {days.map((x, i) => (
              <button
                type="button"
                key={x}
                class={'vbar' + (day === x ? ' on' : '')}
                style={{ background: 'none', border: 0, padding: 0 }}
                title={`${fmtDate(x)} : ${fmt(r.byDay[x] || 0, cur)}`}
                onClick={() => setDay(day === x ? null : x)}
              >
                <span style={{ height: ((r.byDay[x] || 0) / maxDay) * 100 + '%' }} />
                <small>{days.length <= 10 || i % Math.ceil(days.length / 8) === 0 ? fmtDate(x, { day: 'numeric' }) : ' '}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      <section class="panel">
        <h2>Part de chacun</h2>
        <div class="bars">
          {consumers.map((x) => (
            <div class="bar-row" key={x.id}>
              <span class="bar-label">
                <span>{memberName(g.names, x.id, g.me)}</span>
              </span>
              <span class="bar-value">{fmt(x.v, cur)}</span>
              <div class="bar-track" aria-hidden="true">
                <span style={{ width: (x.v / maxCons) * 100 + '%' }} />
              </div>
            </div>
          ))}
        </div>
      </section>
      {exportPanel}
    </>
  );
}

function BudgetPanel({ g }: { g: Group }) {
  const d = g.p.data;
  const cur = d.currency;
  const b = d.budget || {};
  const per = Object.entries(b.perCategory || {}).filter(([, v]) => v > 0);
  const alerts = budgetAlerts(g);
  if (!b.total && !per.length) {
    return (
      <section class="panel">
        <h2>Budget</h2>
        <p class="muted">Fixe un budget global ou par catégorie : la jauge et les alertes apparaîtront ici et à chaque dépense.</p>
        {!g.readOnly && (
          <button type="button" class="btn soft" onClick={() => go(`p/${g.p.id}/settings`)}>
            Définir un budget
          </button>
        )}
      </section>
    );
  }
  return (
    <section class="panel">
      <div class="panel-head">
        <h2>Budget</h2>
        {!g.readOnly && (
          <button type="button" class="btn ghost small" onClick={() => go(`p/${g.p.id}/settings`)}>
            Modifier
          </button>
        )}
      </div>
      {b.total ? (
        <div class="stack tight">
          <div class="balance-line">
            <strong>Total</strong>
            <span class="num">
              {fmt(g.report.total, cur)} / {fmt(b.total, cur)}
            </span>
          </div>
          <Gauge value={g.report.total} max={b.total} />
          <p class="hint">
            {g.report.total <= b.total ? `Reste ${fmt(b.total - g.report.total, cur)}` : `Dépassement de ${fmt(g.report.total - b.total, cur)}`}
            {g.people.length > 1 ? ` · ${fmt(Math.round(b.total / g.people.length), cur)} prévus par personne` : ''}
          </p>
        </div>
      ) : null}
      {per.map(([cat, v]) => {
        const c = categoryOf(g.p, cat);
        const spent = g.report.byCategory[cat] || 0;
        return (
          <div class="stack tight" key={cat}>
            <div class="balance-line">
              <span>
                {c.icon} {c.label}
              </span>
              <span class="num">
                {fmt(spent, cur)} / {fmt(v, cur)}
              </span>
            </div>
            <Gauge value={spent} max={v} />
          </div>
        );
      })}
      {alerts.length === 0 && <p class="hint">✅ Tout est dans les clous.</p>}
    </section>
  );
}
