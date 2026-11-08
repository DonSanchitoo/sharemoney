import { useState } from 'preact/hooks';
import { CurrencySelect, LogoPicker } from '../../components/LogoPicker';
import { InviteSheet } from '../../components/share';
import { confirmDialog, toast } from '../../components/toast';
import { AmountInput, Avatar, Empty, Field, Icon, NumberInput, Switch, TopBar } from '../../components/ui';
import { uuid } from '../../lib/ids';
import { CATEGORY_CATALOG, colorFor, MODULES, PRESETS, preset } from '../../lib/presets';
import { back, go } from '../../lib/router';
import { deleteItem, deleteProjectForAll, leaveProject, patchItem, putItem, setMe, updateProject } from '../../lib/store';
import type { GroupData, MemberData, Modules, ProjectType } from '../../lib/types';
import { useGroup, type Group } from './common';

export function ProjectSettings({ projectId }: { projectId: string }) {
  const g = useGroup(projectId);
  if (!g.p) return <Empty icon="🔍" title="Projet introuvable" />;
  return <SettingsBody g={g as Group} />;
}

function SettingsBody({ g }: { g: Group }) {
  const p = g.p;
  const d = p.data;
  const pr = preset(d.type);
  const [invite, setInvite] = useState(false);
  const [newMember, setNewMember] = useState('');
  const [newCat, setNewCat] = useState({ icon: '🏷️', label: '' });
  const upd = (patch: Partial<GroupData>) => updateProject<GroupData>(p.id, patch);
  const ro = !!d.options?.archived;
  const used = new Set(g.expenses.flatMap((e) => [e.data.payer, e.data.to, ...Object.keys(e.data.split?.parts || {})]).filter(Boolean) as string[]);

  function addMember() {
    const name = newMember.trim();
    if (!name) return;
    const id = uuid();
    putItem<MemberData>(p.id, 'member', { name, color: colorFor(id) }, id);
    setNewMember('');
  }

  async function removeMember(id: string, name: string) {
    if (used.has(id)) {
      if (!(await confirmDialog({ title: `Archiver ${name} ?`, message: 'Cette personne apparaît dans des dépenses : elle reste dans l’historique mais ne sera plus proposée.', confirm: 'Archiver' }))) return;
      patchItem<MemberData>(id, { archived: true });
    } else {
      if (!(await confirmDialog({ title: `Retirer ${name} ?`, confirm: 'Retirer', danger: true }))) return;
      deleteItem(id);
    }
  }

  async function changeType(type: ProjectType) {
    if (type === d.type) return;
    const next = preset(type);
    const apply = await confirmDialog({
      title: `Passer en « ${next.label} » ?`,
      message: 'Les catégories et outils de ce type seront ajoutés. Rien n’est supprimé.',
      confirm: 'Changer',
    });
    if (!apply) return;
    const cats = [...d.categories];
    for (const id of next.categories) if (!cats.some((c) => c.id === id)) cats.push({ ...CATEGORY_CATALOG[id] });
    const modules = { ...d.modules };
    for (const [k, v] of Object.entries(next.modules)) if (v) modules[k as keyof Modules] = true;
    upd({ type, categories: cats, modules, listTitle: d.listTitle || next.listTitle });
  }

  function addCategory() {
    const label = newCat.label.trim();
    if (!label) return;
    upd({ categories: [...d.categories, { id: 'c' + uuid().slice(0, 8), label, icon: newCat.icon || '🏷️' }] });
    setNewCat({ icon: '🏷️', label: '' });
  }

  async function leave() {
    if (!(await confirmDialog({ title: 'Retirer ce projet de tes appareils ?', message: 'Les autres le gardent. Tu pourras revenir avec le lien.', confirm: 'Retirer', danger: true }))) return;
    leaveProject(p.id);
    go('projects', true);
  }

  async function destroy() {
    if (!(await confirmDialog({ title: 'Supprimer pour tout le monde ?', message: 'Le projet, ses dépenses et ses photos disparaissent pour toutes les personnes invitées.', confirm: 'Supprimer', danger: true }))) return;
    deleteProjectForAll(p.id);
    leaveProject(p.id);
    go('projects', true);
    toast('Projet supprimé');
  }

  const budget = d.budget || {};
  const missingCatalog = Object.values(CATEGORY_CATALOG).filter((c) => !d.categories.some((x) => x.id === c.id));

  return (
    <div class="page has-topbar">
      <TopBar onBack={() => back('p/' + p.id)} backLabel={d.name} title="Réglages" />

      {ro && (
        <div class="banner info">
          <Icon name="archive" size={18} /> Projet archivé : réactive-le en bas de page pour le modifier.
        </div>
      )}

      <fieldset disabled={ro} style={{ border: 0, padding: 0, margin: 0, display: 'contents' }}>
        <section class="panel">
          <Field label="Nom" for="ps-name">
            <input id="ps-name" type="text" value={d.name} onInput={(e) => upd({ name: e.currentTarget.value })} />
          </Field>
          <LogoPicker emoji={d.emoji} color={d.color} image={d.image} onChange={(v) => upd(v)} />
          <Field label="Description" for="ps-desc">
            <textarea id="ps-desc" value={d.description || ''} placeholder="Infos utiles pour tout le monde" onInput={(e) => upd({ description: e.currentTarget.value })} />
          </Field>
        </section>

        <section class="panel">
          <h2>Type et dates</h2>
          <Field label="Type de projet" for="ps-type">
            <select id="ps-type" value={d.type} onChange={(e) => void changeType(e.currentTarget.value as ProjectType)}>
              {PRESETS.map((x) => (
                <option value={x.type} key={x.type}>
                  {x.emoji} {x.label}
                </option>
              ))}
            </select>
          </Field>
          {pr.dates !== 'none' && (
            <div class="grid2">
              <Field label={pr.dates === 'single' ? 'Date' : 'Début'}>
                <input type="date" value={d.startDate || ''} onInput={(e) => upd({ startDate: e.currentTarget.value || undefined })} />
              </Field>
              {pr.dates === 'range' && (
                <Field label="Fin">
                  <input type="date" value={d.endDate || ''} min={d.startDate} onInput={(e) => upd({ endDate: e.currentTarget.value || undefined })} />
                </Field>
              )}
            </div>
          )}
          <Field label={pr.placeLabel || 'Lieu'}>
            <input type="text" value={d.place || ''} onInput={(e) => upd({ place: e.currentTarget.value || undefined })} />
          </Field>
          <Field label="Devise principale" hint={g.expenses.length ? 'Attention : les montants déjà saisis ne sont pas convertis.' : undefined}>
            <CurrencySelect value={d.currency} onChange={(currency) => upd({ currency })} />
          </Field>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>Participants</h2>
            <button type="button" class="btn small soft" onClick={() => setInvite(true)}>
              <Icon name="userPlus" size={16} /> Inviter
            </button>
          </div>
          <p class="hint">Parts : 2 pour un couple, 0,5 pour un enfant… utilisées par défaut dans les nouvelles dépenses.{pr.honoree ? ' « Fêté·e » : exclu·e des dépenses par défaut.' : ''}</p>
          {g.members
            .filter((m) => !m.data.archived)
            .map((m) => (
              <div class="stack tight" key={m.id} style={{ paddingBottom: 10, borderBottom: '1px solid var(--line)' }}>
                <div class="row gap">
                  <Avatar name={m.data.name} id={m.id} color={m.data.color} />
                  <input type="text" value={m.data.name} aria-label="Prénom" onInput={(e) => patchItem<MemberData>(m.id, { name: e.currentTarget.value })} />
                  <button type="button" class="btn icon-only" aria-label={'Retirer ' + m.data.name} onClick={() => removeMember(m.id, m.data.name)}>
                    <Icon name="trash" size={18} />
                  </button>
                </div>
                <div class="row gap wrap">
                  <button type="button" class={'chip' + (g.me === m.id ? ' on' : '')} aria-pressed={g.me === m.id} onClick={() => setMe(p.id, m.id)}>
                    {g.me === m.id ? 'C’est moi' : 'C’est moi ?'}
                  </button>
                  <span class="small muted">Parts</span>
                  <NumberInput style={{ width: 90 }} value={m.data.weight ?? 1} aria-label={'Parts de ' + m.data.name} onValue={(weight) => patchItem<MemberData>(m.id, { weight: weight > 0 ? weight : 1 })} />
                  {(pr.honoree || m.data.honoree) && (
                    <button type="button" class={'chip' + (m.data.honoree ? ' soft-on' : '')} aria-pressed={!!m.data.honoree} onClick={() => patchItem<MemberData>(m.id, { honoree: !m.data.honoree })}>
                      🎉 Fêté·e
                    </button>
                  )}
                </div>
              </div>
            ))}
          <div class="row gap">
            <input type="text" placeholder="Ajouter quelqu’un" value={newMember} onInput={(e) => setNewMember(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && addMember()} />
            <button type="button" class="btn" onClick={addMember} disabled={!newMember.trim()}>
              Ajouter
            </button>
          </div>
          {g.members.some((m) => m.data.archived) && (
            <details>
              <summary>Archivés ({g.members.filter((m) => m.data.archived).length})</summary>
              <div class="stack tight" style={{ marginTop: 8 }}>
                {g.members
                  .filter((m) => m.data.archived)
                  .map((m) => (
                    <div class="row between" key={m.id}>
                      <span>{m.data.name}</span>
                      <button type="button" class="btn small" onClick={() => patchItem<MemberData>(m.id, { archived: false })}>
                        Réactiver
                      </button>
                    </div>
                  ))}
              </div>
            </details>
          )}
        </section>

        <section class="panel">
          <h2>Outils</h2>
          {MODULES.map((mod) => (
            <Switch
              key={mod.key}
              checked={d.modules[mod.key]}
              onChange={(v) => upd({ modules: { ...d.modules, [mod.key]: v } })}
              label={`${mod.icon} ${mod.label}`}
              hint={mod.description}
            />
          ))}
          {d.modules.list && (
            <Field label="Nom de la liste">
              <input type="text" value={d.listTitle || ''} placeholder={pr.listTitle} onInput={(e) => upd({ listTitle: e.currentTarget.value })} />
            </Field>
          )}
        </section>

        {d.modules.budget && (
          <section class="panel" id="budget">
            <h2>Budget</h2>
            <Field label="Budget total" hint="Laisse vide pour ne pas suivre de budget global.">
              <AmountInput value={budget.total || 0} currency={d.currency} onValue={(total) => upd({ budget: { ...budget, total: total || undefined } })} />
            </Field>
            <span class="label">Par catégorie</span>
            {d.categories.map((c) => (
              <div class="row gap" key={c.id}>
                <span class="grow">
                  {c.icon} {c.label}
                </span>
                <AmountInput
                  style={{ width: 140 }}
                  value={budget.perCategory?.[c.id] || 0}
                  currency={d.currency}
                  aria-label={'Budget ' + c.label}
                  onValue={(v) => {
                    const per = { ...(budget.perCategory || {}) };
                    if (v) per[c.id] = v;
                    else delete per[c.id];
                    upd({ budget: { ...budget, perCategory: per } });
                  }}
                />
              </div>
            ))}
          </section>
        )}

        <section class="panel">
          <h2>Catégories</h2>
          <div class="chips">
            {d.categories.map((c) => (
              <span class="chip" key={c.id}>
                {c.icon} {c.label}
                <button
                  type="button"
                  class="link-btn"
                  style={{ padding: '0 0 0 4px' }}
                  aria-label={'Retirer ' + c.label}
                  onClick={() => upd({ categories: d.categories.filter((x) => x.id !== c.id) })}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          {missingCatalog.length > 0 && (
            <details>
              <summary>Ajouter une catégorie existante</summary>
              <div class="chips" style={{ marginTop: 8 }}>
                {missingCatalog.map((c) => (
                  <button type="button" class="chip" key={c.id} onClick={() => upd({ categories: [...d.categories, { ...c }] })}>
                    + {c.icon} {c.label}
                  </button>
                ))}
              </div>
            </details>
          )}
          <div class="row gap">
            <input type="text" style={{ width: 64, textAlign: 'center' }} value={newCat.icon} aria-label="Emoji" onInput={(e) => setNewCat({ ...newCat, icon: e.currentTarget.value })} />
            <input type="text" placeholder="Nouvelle catégorie" value={newCat.label} onInput={(e) => setNewCat({ ...newCat, label: e.currentTarget.value })} onKeyDown={(e) => e.key === 'Enter' && addCategory()} />
            <button type="button" class="btn" onClick={addCategory} disabled={!newCat.label.trim()}>
              Créer
            </button>
          </div>
        </section>
      </fieldset>

      <section class="panel">
        <h2>Partage</h2>
        <button type="button" class="btn primary" onClick={() => setInvite(true)}>
          <Icon name="share" size={18} /> Lien d’invitation
        </button>
        <Switch checked={!!d.options?.archived} onChange={(v) => upd({ options: { ...d.options, archived: v } })} label="Archiver le projet" hint="Lecture seule pour tout le monde, rangé en bas de la liste." />
      </section>

      <section class="panel danger-zone">
        <button type="button" class="btn block" onClick={leave}>
          Retirer de mes appareils
        </button>
        <button type="button" class="btn danger block" onClick={destroy}>
          <Icon name="trash" size={18} /> Supprimer pour tout le monde
        </button>
      </section>
      <InviteSheet open={invite} onClose={() => setInvite(false)} token={p.token} name={d.name} />
    </div>
  );
}
