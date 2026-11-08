import { useState } from 'preact/hooks';
import { InstallHint, SyncBadge } from '../components/chrome';
import { toast } from '../components/toast';
import { Empty, Icon, Logo } from '../components/ui';
import { computeBalances } from '../lib/calc';
import { fmtRange } from '../lib/date';
import { fmt, fmtSigned } from '../lib/money';
import { preset } from '../lib/presets';
import { go, parseShareLink } from '../lib/router';
import { groupProjects, itemsOf, meOf } from '../lib/store';
import type { ExpenseData, GroupData, Project } from '../lib/types';

function ProjectCard({ p }: { p: Project<GroupData> }) {
  const members = itemsOf(p.id, 'member');
  const expenses = itemsOf<ExpenseData>(p.id, 'expense');
  const r = computeBalances(expenses, members.map((m) => m.id));
  const me = meOf(p.id);
  const mine = me ? r.balance[me] || 0 : null;
  const d = p.data;
  const sub = [preset(d.type).short, fmtRange(d.startDate, d.endDate) || d.place, `${members.length} pers.`].filter(Boolean).join(' · ');
  return (
    <button type="button" class="project-card" onClick={() => go('p/' + p.id)}>
      <Logo emoji={d.emoji} color={d.color} image={d.image} size={48} />
      <div class="li-main">
        <div class="li-title">{d.name || 'Sans nom'}</div>
        <div class="li-sub">{sub}</div>
      </div>
      <div class="li-end">
        <div class="strong">{fmt(r.total, d.currency)}</div>
        {mine != null && Math.abs(mine) >= 1 && <div class={'li-sub ' + (mine > 0 ? 'pos' : 'neg')}>{fmtSigned(mine, d.currency)}</div>}
      </div>
    </button>
  );
}

export function ProjectsScreen() {
  const [link, setLink] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const all = groupProjects.value as Project<GroupData>[];
  const active = all.filter((p) => !p.data.options?.archived).sort((a, b) => (b.data.createdAt || '').localeCompare(a.data.createdAt || ''));
  const archived = all.filter((p) => p.data.options?.archived);

  function join() {
    const parsed = parseShareLink(link);
    if (!parsed) return toast('Lien non reconnu', { tone: 'warn' });
    if (parsed.kind === 'keyring') return go('k/' + parsed.token);
    setLink('');
    go('join/' + parsed.token);
  }

  return (
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Projets</h1>
          <p class="sub">Vacances, repas, coloc, événements…</p>
        </div>
        <button type="button" class="btn primary" onClick={() => go('new')}>
          <Icon name="plus" size={18} /> Nouveau
        </button>
      </div>
      <div class="row between">
        <SyncBadge />
        <button type="button" class="btn ghost small" onClick={() => setShowJoin(!showJoin)}>
          <Icon name="link" size={16} /> J’ai un lien
        </button>
      </div>
      {showJoin && (
        <div class="row gap">
          <input type="url" placeholder="Colle le lien d’invitation" value={link} onInput={(e) => setLink(e.currentTarget.value)} />
          <button type="button" class="btn" onClick={join}>
            Rejoindre
          </button>
        </div>
      )}
      <InstallHint />
      {active.length === 0 ? (
        <section class="panel">
          <Empty icon="🧳" title="Aucun projet pour l’instant">
            <p>Crée un projet pour des vacances, un repas, un cadeau commun… puis invite les autres avec un lien.</p>
            <button type="button" class="btn primary" onClick={() => go('new')}>
              Créer un projet
            </button>
          </Empty>
        </section>
      ) : (
        <div class="stack">
          {active.map((p) => (
            <ProjectCard p={p} key={p.id} />
          ))}
        </div>
      )}
      {archived.length > 0 && (
        <details>
          <summary>Projets archivés ({archived.length})</summary>
          <div class="stack" style={{ marginTop: 12 }}>
            {archived.map((p) => (
              <ProjectCard p={p} key={p.id} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
