import { toast } from '../../components/toast';
import { Avatar, Empty, Icon } from '../../components/ui';
import { settle } from '../../lib/calc';
import { todayISO } from '../../lib/date';
import { fmt, fmtSigned } from '../../lib/money';
import { appUrl } from '../../lib/router';
import { shareLink } from '../../lib/share';
import { putItem, updateProject } from '../../lib/store';
import type { ExpenseData, GroupData } from '../../lib/types';
import { memberName, type Group } from './common';

export function BalancesTab({ g }: { g: Group }) {
  const d = g.p.data;
  const cur = d.currency;
  const round = !!d.options?.roundTransfers;
  const r = g.report;
  const transfers = settle(r.balance, round ? 100 : 1);
  const ids = g.members.filter((m) => !m.data.archived || Math.abs(r.balance[m.id] || 0) >= 1).map((m) => m.id);
  const max = Math.max(1, ...ids.map((id) => Math.abs(r.balance[id] || 0)));

  if (!g.expenses.length) return <section class="panel"><Empty icon="⚖️" title="Rien à équilibrer pour l’instant" /></section>;

  function markPaid(from: string, to: string, amount: number) {
    putItem<ExpenseData>(g.p.id, 'expense', {
      kind: 'transfer',
      title: 'Remboursement',
      amount,
      currency: cur,
      rate: 1,
      payer: from,
      to,
      date: todayISO(),
      split: { mode: 'equal', parts: {} },
      createdBy: g.me,
    });
    toast(`Remboursement de ${fmt(amount, cur)} enregistré`);
  }

  return (
    <>
      <section class="panel">
        <div class="panel-head">
          <h2>Remboursements</h2>
          <button
            type="button"
            class={'chip' + (round ? ' soft-on' : '')}
            aria-pressed={round}
            onClick={() => updateProject<GroupData>(g.p.id, { options: { ...d.options, roundTransfers: !round } })}
          >
            Arrondir à l’unité
          </button>
        </div>
        {transfers.length === 0 ? (
          <p class="muted">Tout le monde est à jour 🎉</p>
        ) : (
          <div class="stack">
            {transfers.map((t) => {
              const meInvolved = t.from === g.me || t.to === g.me;
              return (
                <div class="stack tight" key={t.from + t.to} style={{ paddingBottom: 10, borderBottom: '1px solid var(--line)' }}>
                  <div class="row gap">
                    <Avatar name={g.names[t.from] || '?'} id={t.from} size={30} />
                    <span class="grow">
                      <strong>{memberName(g.names, t.from, g.me)}</strong> {t.from === g.me ? 'dois' : 'doit'} à <strong>{memberName(g.names, t.to, g.me)}</strong>
                    </span>
                    <strong class="mid-amount" style={{ fontSize: '1.15rem' }}>{fmt(t.amount, cur)}</strong>
                  </div>
                  {!g.readOnly && (
                    <div class="row gap wrap">
                      <button type="button" class="btn small soft" onClick={() => markPaid(t.from, t.to, t.amount)}>
                        <Icon name="check" size={16} /> Marquer remboursé
                      </button>
                      {meInvolved && (
                        <button
                          type="button"
                          class="btn small ghost"
                          onClick={() => {
                            const other = t.from === g.me ? t.to : t.from;
                            const text =
                              t.to === g.me
                                ? `Salut ${g.names[other]}, pour « ${d.name} » tu me dois ${fmt(t.amount, cur)}. Le détail :`
                                : `Salut ${g.names[other]}, pour « ${d.name} » je te dois ${fmt(t.amount, cur)}. Le détail :`;
                            void shareLink(d.name, text, appUrl('join/' + g.p.token));
                          }}
                        >
                          <Icon name="share" size={16} /> {t.to === g.me ? 'Relancer' : 'Prévenir'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p class="hint">Nombre de virements réduit au minimum.{round ? ' Montants arrondis : un petit écart peut rester.' : ''}</p>
      </section>

      <section class="panel">
        <h2>Soldes</h2>
        <div class="stack tight">
          {ids.map((id) => {
            const v = r.balance[id] || 0;
            const w = (Math.abs(v) / max) * 100;
            return (
              <div key={id}>
                <div class="balance-line">
                  <span>{memberName(g.names, id, g.me)}</span>
                  <strong class={'num ' + (v > 0.5 ? 'pos' : v < -0.5 ? 'neg' : 'muted')}>{fmtSigned(v, cur)}</strong>
                </div>
                <div class="balance-row" aria-hidden="true">
                  <div class="half left">{v < -0.5 && <span style={{ width: w + '%' }} />}</div>
                  <div class="half right">{v > 0.5 && <span style={{ width: w + '%' }} />}</div>
                </div>
              </div>
            );
          })}
        </div>
        <p class="hint">Positif : on lui doit de l’argent. Négatif : doit en rendre.</p>
      </section>

      <section class="panel">
        <h2>Qui a payé quoi</h2>
        <div class="scroll-x">
          <table>
            <thead>
              <tr>
                <th />
                <th>A payé</th>
                <th>Sa part</th>
                <th>Solde</th>
              </tr>
            </thead>
            <tbody>
              {ids.map((id) => (
                <tr key={id}>
                  <td>{memberName(g.names, id, g.me)}</td>
                  <td>{fmt(r.paid[id] || 0, cur)}</td>
                  <td>{fmt(r.consumed[id] || 0, cur)}</td>
                  <td class={(r.balance[id] || 0) > 0.5 ? 'pos' : (r.balance[id] || 0) < -0.5 ? 'neg' : ''}>{fmtSigned(r.balance[id] || 0, cur)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td>{fmt(r.total, cur)}</td>
                <td>{fmt(Object.values(r.consumed).reduce((s, v) => s + v, 0), cur)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <p class="hint">« Sa part » = ce que la personne a consommé. Les remboursements déjà faits sont pris en compte dans le solde.</p>
      </section>
    </>
  );
}
