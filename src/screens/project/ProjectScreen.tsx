import { useEffect, useState } from 'preact/hooks';
import { SyncBadge } from '../../components/chrome';
import { InviteSheet } from '../../components/share';
import { Avatar, Empty, Icon, Logo, PersonChips, TopBar } from '../../components/ui';
import { fmtRange } from '../../lib/date';
import { fmt, fmtSigned } from '../../lib/money';
import { preset } from '../../lib/presets';
import { back, go } from '../../lib/router';
import { setMe } from '../../lib/store';
import { missingTokens, syncState } from '../../lib/sync';
import { budgetAlerts } from './budget';
import { useGroup, type Group } from './common';
import { ExpensesTab } from './Expenses';
import { BalancesTab } from './Balances';
import { StatsTab } from './Stats';
import { TicketsTab } from './Tickets';
import { LodgingTab } from './Lodging';
import { PlanTab } from './Plan';
import { ListTab } from './ListTab';
import { RecurringTab } from './Recurring';
import { PotTab } from './Pot';

export function ProjectScreen({ projectId, tab, extra }: { projectId: string; tab?: string; extra?: string }) {
  const g = useGroup(projectId);
  const [invite, setInvite] = useState(extra === 'invite');
  useEffect(() => {
    if (extra === 'invite') go(`p/${projectId}/${tab || 'expenses'}`, true);
  }, [extra]);

  if (!g.p) {
    const loading = syncState.value.status === 'syncing';
    return (
      <div class="page has-topbar">
        <TopBar onBack={() => back('projects')} backLabel="Projets" />
        <Empty icon={loading ? '⏳' : '🔍'} title={loading ? 'Chargement…' : 'Projet introuvable'}>
          {!loading && <p>Il a peut-être été supprimé ou retiré de cet appareil.</p>}
        </Empty>
      </div>
    );
  }
  if (g.p.deleted || missingTokens.value.has(g.p.token)) {
    return (
      <div class="page has-topbar">
        <TopBar onBack={() => back('projects')} backLabel="Projets" />
        <Empty icon="🗑️" title="Ce projet a été supprimé" />
      </div>
    );
  }

  const gr = g as Group;
  const d = g.p.data;
  const m = d.modules;
  const tabs: { key: string; label: string }[] = [
    { key: 'expenses', label: 'Dépenses' },
    { key: 'balances', label: 'Équilibre' },
    { key: 'stats', label: m.budget ? 'Budget & stats' : 'Stats' },
    ...(m.tickets ? [{ key: 'tickets', label: 'Billets' }] : []),
    ...(m.lodging ? [{ key: 'lodging', label: 'Hébergements' }] : []),
    ...(m.plan ? [{ key: 'plan', label: 'Programme' }] : []),
    ...(m.list ? [{ key: 'list', label: d.listTitle || 'Liste' }] : []),
    ...(m.recurring ? [{ key: 'recurring', label: 'Récurrentes' }] : []),
    ...(m.pot ? [{ key: 'pot', label: 'Cagnotte' }] : []),
  ];
  const current = tabs.find((t) => t.key === tab)?.key || 'expenses';
  const mine = g.me ? g.report.balance[g.me] || 0 : null;
  const alerts = m.budget ? budgetAlerts(gr) : [];
  const sub = [preset(d.type).label, fmtRange(d.startDate, d.endDate), d.place].filter(Boolean).join(' · ');
  const showFab = !g.readOnly && ['expenses', 'balances', 'stats'].includes(current);

  return (
    <div class="page has-topbar">
      <TopBar
        onBack={() => back('projects')}
        backLabel="Projets"
        title={d.name}
        actions={
          <>
            <button type="button" class="icon-btn" aria-label="Inviter" onClick={() => setInvite(true)}>
              <Icon name="userPlus" />
            </button>
            <button type="button" class="icon-btn" aria-label="Réglages du projet" onClick={() => go(`p/${projectId}/settings`)}>
              <Icon name="sliders" />
            </button>
          </>
        }
      />
      <div class="project-hero">
        <Logo emoji={d.emoji} color={d.color} image={d.image} size={60} />
        <div class="grow">
          <h1>{d.name}</h1>
          <p class="muted small">{sub}</p>
          <div class="row gap" style={{ marginTop: 6 }}>
            <div class="avatars">
              {g.people.slice(0, 6).map((x) => (
                <Avatar key={x.id} name={x.name} id={x.id} color={x.color} size={26} />
              ))}
            </div>
            <span class="small muted">{g.people.length} pers.</span>
            <SyncBadge />
          </div>
        </div>
      </div>
      {d.description && <p class="muted">{d.description}</p>}
      {g.readOnly && (
        <div class="banner info">
          <Icon name="archive" size={18} /> Projet archivé : lecture seule. Réactive-le dans les réglages pour le modifier.
        </div>
      )}

      {!g.me && g.people.length > 0 && (
        <section class="panel accent">
          <p class="strong">Qui es-tu dans ce projet ?</p>
          <PersonChips people={g.people} value="" onChange={(id: string) => setMe(projectId, id)} />
          <p class="hint">Ça sert à afficher ce que tu dois ou ce qu’on te doit.</p>
        </section>
      )}

      <div class="hero-stats">
        <div class="stat">
          <span class="k">Total dépensé</span>
          <span class="v">{fmt(g.report.total, d.currency)}</span>
        </div>
        <button type="button" class="stat" style={{ textAlign: 'left' }} onClick={() => go(`p/${projectId}/balances`, true)}>
          <span class="k">{mine == null ? 'Équilibre' : mine > 0.5 ? 'On te doit' : mine < -0.5 ? 'Tu dois' : 'Tu es à jour'}</span>
          <span class={'v ' + (mine == null ? '' : mine > 0.5 ? 'pos' : mine < -0.5 ? 'neg' : '')}>
            {mine == null ? '—' : fmtSigned(mine, d.currency).replace(/^[+−]/, '')}
          </span>
        </button>
      </div>

      {alerts.slice(0, 2).map((a) => (
        <div class={'banner ' + a.level} key={a.key}>
          {a.level === 'over' ? '⚠️' : '🔔'} {a.text}
        </div>
      ))}

      <nav class="tabs" aria-label="Sections du projet">
        {tabs.map((t) => (
          <button type="button" key={t.key} class={current === t.key ? 'on' : ''} onClick={() => go(`p/${projectId}/${t.key}`, true)}>
            {t.label}
          </button>
        ))}
      </nav>

      {current === 'expenses' && <ExpensesTab g={gr} />}
      {current === 'balances' && <BalancesTab g={gr} />}
      {current === 'stats' && <StatsTab g={gr} />}
      {current === 'tickets' && <TicketsTab g={gr} />}
      {current === 'lodging' && <LodgingTab g={gr} />}
      {current === 'plan' && <PlanTab g={gr} />}
      {current === 'list' && <ListTab g={gr} />}
      {current === 'recurring' && <RecurringTab g={gr} />}
      {current === 'pot' && <PotTab g={gr} />}

      {showFab && (
        <button type="button" class="fab" aria-label="Ajouter une dépense" onClick={() => go(`p/${projectId}/e/new`)}>
          <Icon name="plus" size={28} />
        </button>
      )}
      <InviteSheet open={invite} onClose={() => setInvite(false)} token={g.p.token} name={d.name} />
    </div>
  );
}
