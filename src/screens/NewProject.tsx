import { useState } from 'preact/hooks';
import { CurrencySelect, LogoPicker } from '../components/LogoPicker';
import { toast } from '../components/toast';
import { Field, Icon, TopBar } from '../components/ui';
import { todayISO } from '../lib/date';
import { uuid } from '../lib/ids';
import { colorFor, PRESETS, preset, presetData } from '../lib/presets';
import { back, go } from '../lib/router';
import { createProject, db, putItem, setMe, setPrefs } from '../lib/store';
import type { GroupData, ListItemData, MemberData, ProjectType } from '../lib/types';

export function NewProject() {
  const [type, setType] = useState<ProjectType | null>(null);
  const [name, setName] = useState('');
  const [logo, setLogo] = useState<{ emoji: string; color: string; image?: string }>({ emoji: '', color: '' });
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [place, setPlace] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [myName, setMyName] = useState(db.value.prefs.name || '');
  const [others, setOthers] = useState<string[]>(['']);

  if (!type) {
    return (
      <div class="page has-topbar">
        <TopBar onBack={() => back('projects')} backLabel="Projets" title="Nouveau projet" />
        <p class="muted">Quel type de projet ? Chaque type arrive avec ses catégories et ses outils, que tu peux modifier ensuite.</p>
        <div class="type-grid">
          {PRESETS.map((pr) => (
            <button
              type="button"
              class="type-card"
              key={pr.type}
              onClick={() => {
                setType(pr.type);
                setLogo({ emoji: pr.emoji, color: pr.color });
                if (pr.dates === 'single') setStart(todayISO());
              }}
            >
              <span class="type-emoji">{pr.emoji}</span>
              <strong>{pr.label}</strong>
              <small>{pr.description}</small>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const pr = preset(type);

  function create() {
    const n = name.trim() || pr.namePlaceholder;
    const me = myName.trim();
    if (!me) return toast('Indique ton prénom', { tone: 'warn' });
    const data: GroupData = {
      ...presetData(type!, n, currency),
      emoji: logo.emoji,
      color: logo.color,
      image: logo.image,
      place: place.trim() || undefined,
      startDate: pr.dates !== 'none' ? start || undefined : undefined,
      endDate: pr.dates === 'range' ? end || undefined : undefined,
    };
    const p = createProject<GroupData>('group', data);
    const meId = uuid();
    putItem<MemberData>(p.id, 'member', { name: me, color: colorFor(meId) }, meId);
    for (const o of others.map((x) => x.trim()).filter(Boolean)) {
      const id = uuid();
      putItem<MemberData>(p.id, 'member', { name: o, color: colorFor(id) }, id);
    }
    (pr.listSeed || []).forEach((text, i) => putItem<ListItemData>(p.id, 'list', { text, order: i }));
    setMe(p.id, meId);
    if (!db.value.prefs.name) setPrefs({ name: me });
    go('p/' + p.id + '/expenses/invite', true);
  }

  return (
    <div class="page has-topbar">
      <TopBar onBack={() => setType(null)} backLabel="Type" title={pr.label} actions={<button type="button" class="link-btn strong" onClick={create}>Créer</button>} />
      <section class="panel">
        <Field label="Nom du projet" for="np-name">
          <input id="np-name" type="text" placeholder={pr.namePlaceholder} value={name} onInput={(e) => setName(e.currentTarget.value)} />
        </Field>
        <LogoPicker emoji={logo.emoji} color={logo.color} image={logo.image} onChange={(v) => setLogo({ ...logo, ...v })} />
      </section>
      <section class="panel">
        {pr.dates === 'range' && (
          <div class="grid2">
            <Field label="Début" for="np-start">
              <input id="np-start" type="date" value={start} onInput={(e) => setStart(e.currentTarget.value)} />
            </Field>
            <Field label="Fin" for="np-end">
              <input id="np-end" type="date" value={end} min={start} onInput={(e) => setEnd(e.currentTarget.value)} />
            </Field>
          </div>
        )}
        {pr.dates === 'single' && (
          <Field label="Date" for="np-date">
            <input id="np-date" type="date" value={start} onInput={(e) => setStart(e.currentTarget.value)} />
          </Field>
        )}
        {pr.placeLabel && (
          <Field label={pr.placeLabel} for="np-place">
            <input id="np-place" type="text" value={place} onInput={(e) => setPlace(e.currentTarget.value)} />
          </Field>
        )}
        <Field label="Devise principale" for="np-cur" hint={pr.modules.multiCurrency ? 'Les dépenses en devise étrangère seront converties automatiquement.' : undefined}>
          <CurrencySelect id="np-cur" value={currency} onChange={setCurrency} />
        </Field>
      </section>
      <section class="panel">
        <h2>Participants</h2>
        <Field label="Ton prénom" for="np-me">
          <input id="np-me" type="text" value={myName} onInput={(e) => setMyName(e.currentTarget.value)} />
        </Field>
        <div class="field">
          <span class="label">Les autres (optionnel, ils peuvent s’ajouter eux-mêmes via le lien)</span>
          <div class="stack tight">
            {others.map((o, i) => (
              <div class="row gap" key={i}>
                <input
                  type="text"
                  placeholder="Prénom"
                  value={o}
                  aria-label={'Participant ' + (i + 1)}
                  onInput={(e) => {
                    const next = others.map((x, j) => (j === i ? e.currentTarget.value : x));
                    if (i === others.length - 1 && e.currentTarget.value) next.push('');
                    setOthers(next);
                  }}
                />
                {others.length > 1 && o && (
                  <button type="button" class="btn icon-only" aria-label="Retirer" onClick={() => setOthers(others.filter((_, j) => j !== i))}>
                    <Icon name="x" size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
      <button type="button" class="btn primary block" onClick={create}>
        Créer le projet
      </button>
    </div>
  );
}
