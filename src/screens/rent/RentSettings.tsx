import { useState } from 'preact/hooks';
import { InviteSheet } from '../../components/share';
import { confirmDialog, toast } from '../../components/toast';
import { Avatar, Field, Icon, TopBar } from '../../components/ui';
import { monthKey } from '../../lib/date';
import { uuid } from '../../lib/ids';
import { colorFor } from '../../lib/presets';
import { back, go } from '../../lib/router';
import { deleteItem, deleteProjectForAll, leaveProject, meOf, patchItem, putItem, rentProjects, setMe, setPrefs, updateProject } from '../../lib/store';
import type { RentData, RentMemberData, RentMonthData } from '../../lib/types';
import { currentHousehold, equalShares, useHousehold } from './common';

const HOME_EMOJIS = ['🏠', '🏡', '🏢', '🏘️', '🛋️', '🏰', '⛺', '🏖️'];

export function RentSettings() {
  const p = currentHousehold();
  const [newName, setNewName] = useState('');
  const [invite, setInvite] = useState(false);
  if (!p) {
    go('rent', true);
    return null;
  }
  const hh = useHousehold(p);
  const me = meOf(p.id);
  const active = hh.members.filter((m) => !m.data.archived);

  function addPerson() {
    const name = newName.trim();
    if (!name) return;
    const id = uuid();
    putItem<RentMemberData>(p!.id, 'member', { name, color: colorFor(id) }, id);
    // Le mois en cours repasse à parts égales avec la nouvelle personne.
    const cur = hh.months.find((m) => m.data.month === monthKey());
    if (cur) {
      putItem<RentMonthData>(p!.id, 'month', { ...cur.data, shares: equalShares([...active.map((m) => m.id), id]) }, cur.id);
      toast(`${name} ajouté·e, parts du mois remises à égalité`);
    }
    setNewName('');
  }

  async function removePerson(id: string, name: string) {
    const used = hh.months.some((m) => m.data.lines.some((l) => l.person === id) || (m.data.shares?.[id] ?? 0) > 0);
    if (used) {
      if (!(await confirmDialog({ title: `Retirer ${name} ?`, message: 'Ses mois passés restent dans l’historique. Les prochains mois seront sans cette personne.', confirm: 'Retirer' }))) return;
      patchItem<RentMemberData>(id, { archived: true });
    } else {
      if (!(await confirmDialog({ title: `Supprimer ${name} ?`, confirm: 'Supprimer', danger: true }))) return;
      deleteItem(id);
    }
  }

  async function leave() {
    if (!(await confirmDialog({ title: 'Retirer ce logement de tes appareils ?', message: 'Les autres personnes le gardent. Tu pourras revenir avec le lien d’invitation.', confirm: 'Retirer', danger: true }))) return;
    leaveProject(p!.id);
    setPrefs({ rentId: undefined });
    go('rent', true);
  }

  async function destroy() {
    if (!(await confirmDialog({ title: 'Supprimer pour tout le monde ?', message: 'Le logement et tout son historique disparaissent pour toutes les personnes invitées.', confirm: 'Supprimer', danger: true }))) return;
    deleteProjectForAll(p!.id);
    leaveProject(p!.id);
    setPrefs({ rentId: undefined });
    go('rent', true);
  }

  const others = rentProjects.value.filter((x) => x.id !== p.id);

  return (
    <div class="page has-topbar">
      <TopBar onBack={() => back('rent')} backLabel="Loyer" title="Logement" />

      <section class="panel">
        <Field label="Nom du logement" for="hh-n">
          <input id="hh-n" type="text" value={p.data.name} onInput={(e) => updateProject<RentData>(p.id, { name: e.currentTarget.value })} />
        </Field>
        <div class="chips">
          {HOME_EMOJIS.map((e) => (
            <button type="button" key={e} class={'chip' + (p.data.emoji === e ? ' on' : '')} onClick={() => updateProject<RentData>(p.id, { emoji: e })}>
              {e}
            </button>
          ))}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>Personnes</h2>
          <button type="button" class="btn small soft" onClick={() => setInvite(true)}>
            <Icon name="userPlus" size={16} /> Inviter
          </button>
        </div>
        {active.map((m) => (
          <div class="row gap" key={m.id}>
            <Avatar name={m.data.name} id={m.id} color={m.data.color} />
            <input type="text" value={m.data.name} aria-label="Prénom" onInput={(e) => patchItem<RentMemberData>(m.id, { name: e.currentTarget.value })} />
            <button type="button" class={'chip' + (me === m.id ? ' on' : '')} onClick={() => setMe(p.id, m.id)} aria-pressed={me === m.id}>
              {me === m.id ? 'C’est moi' : 'Moi ?'}
            </button>
            <button type="button" class="btn icon-only" aria-label={'Retirer ' + m.data.name} onClick={() => removePerson(m.id, m.data.name)}>
              <Icon name="trash" size={18} />
            </button>
          </div>
        ))}
        <div class="row gap">
          <input type="text" placeholder="Ajouter une personne" value={newName} onInput={(e) => setNewName(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && addPerson()} />
          <button type="button" class="btn" onClick={addPerson} disabled={!newName.trim()}>
            Ajouter
          </button>
        </div>
        {hh.members.some((m) => m.data.archived) && (
          <p class="hint">
            Anciens : {hh.members.filter((m) => m.data.archived).map((m) => m.data.name).join(', ')}.{' '}
            <button
              type="button"
              class="link-btn"
              style={{ padding: 0, fontSize: 'inherit' }}
              onClick={() => hh.members.filter((m) => m.data.archived).forEach((m) => patchItem<RentMemberData>(m.id, { archived: false }))}
            >
              Réactiver
            </button>
          </p>
        )}
      </section>

      <section class="panel">
        <h2>Mes logements</h2>
        {others.map((o) => (
          <button type="button" class="btn block" style={{ justifyContent: 'flex-start' }} key={o.id} onClick={() => { setPrefs({ rentId: o.id }); go('rent', true); }}>
            {(o.data as RentData).emoji} Passer à « {(o.data as RentData).name} »
          </button>
        ))}
        <button type="button" class="btn dashed" onClick={() => go('rent/new')}>
          <Icon name="plus" size={16} /> Créer ou rejoindre un autre logement
        </button>
      </section>

      <section class="panel danger-zone">
        <button type="button" class="btn block" onClick={leave}>
          Retirer de mes appareils
        </button>
        <button type="button" class="btn danger block" onClick={destroy}>
          <Icon name="trash" size={18} /> Supprimer pour tout le monde
        </button>
      </section>
      <InviteSheet open={invite} onClose={() => setInvite(false)} token={p.token} name={p.data.name} what="ton logement" />
    </div>
  );
}
