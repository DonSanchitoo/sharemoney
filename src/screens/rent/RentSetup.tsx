import { useState } from 'preact/hooks';
import { InstallHint } from '../../components/chrome';
import { toast } from '../../components/toast';
import { AmountInput, Field, Icon } from '../../components/ui';
import { monthKey } from '../../lib/date';
import { uuid } from '../../lib/ids';
import { colorFor } from '../../lib/presets';
import { go, parseShareLink } from '../../lib/router';
import { createProject, db, putItem, rentProjects, setMe, setPrefs } from '../../lib/store';
import type { RentData, RentLine, RentMemberData, RentMonthData } from '../../lib/types';
import { equalShares, monthId } from './common';

export function RentSetup() {
  const hasOther = rentProjects.value.length > 0;
  const [name, setName] = useState(hasOther ? 'Autre logement' : 'Mon logement');
  const [people, setPeople] = useState<string[]>([db.value.prefs.name || 'Moi', '']);
  const [rent, setRent] = useState(72000);
  const [apl, setApl] = useState(20600);
  const [link, setLink] = useState('');

  function create() {
    const names = people.map((p) => p.trim()).filter(Boolean);
    if (names.length < 1) {
      toast('Ajoute au moins une personne', { tone: 'warn' });
      return;
    }
    const p = createProject<RentData>('rent', { name: name.trim() || 'Mon logement', emoji: '🏠', currency: 'EUR', createdAt: new Date().toISOString() });
    const ids = names.map((n) => {
      const id = uuid();
      putItem<RentMemberData>(p.id, 'member', { name: n, color: colorFor(id) }, id);
      return id;
    });
    const a = ids[0];
    const b = ids[1] || ids[0];
    const lines: RentLine[] = [
      { id: uuid(), label: 'Loyer', amount: rent, kind: 'expense', person: b, rent: true },
      { id: uuid(), label: 'Électricité', amount: 0, kind: 'expense', person: a },
      { id: uuid(), label: 'Eau', amount: 0, kind: 'expense', person: a },
      { id: uuid(), label: 'APL', amount: apl, kind: 'aid', person: a },
    ];
    const key = monthKey();
    putItem<RentMonthData>(p.id, 'month', { month: key, lines, shares: equalShares(ids), done: {} }, monthId(p.id, key));
    setMe(p.id, a);
    if (!db.value.prefs.name && names[0] !== 'Moi') setPrefs({ name: names[0] });
    setPrefs({ rentId: p.id });
    go('rent', true);
    toast('Logement créé');
  }

  function join() {
    const parsed = parseShareLink(link);
    if (!parsed || parsed.kind !== 'join') {
      toast('Lien non reconnu', { tone: 'warn' });
      return;
    }
    go('join/' + parsed.token);
  }

  return (
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Partage du loyer</h1>
          <p class="sub">Loyer, aides et charges du mois, partagés entre colocataires. Un état par mois, archivé.</p>
        </div>
      </div>
      {!hasOther && <InstallHint />}

      <section class="panel">
        <h2>Créer {hasOther ? 'un autre' : 'mon'} logement</h2>
        <Field label="Nom" for="hh-name">
          <input id="hh-name" type="text" value={name} onInput={(e) => setName(e.currentTarget.value)} />
        </Field>
        <div class="field">
          <span class="label">Personnes</span>
          <div class="stack tight">
            {people.map((n, i) => (
              <div class="row gap" key={i}>
                <input
                  type="text"
                  value={n}
                  placeholder={i === 0 ? 'Ton prénom' : 'Prénom'}
                  aria-label={'Personne ' + (i + 1)}
                  onInput={(e) => setPeople(people.map((x, j) => (j === i ? e.currentTarget.value : x)))}
                />
                {people.length > 1 && (
                  <button type="button" class="btn icon-only" aria-label="Retirer" onClick={() => setPeople(people.filter((_, j) => j !== i))}>
                    <Icon name="x" size={18} />
                  </button>
                )}
              </div>
            ))}
            <button type="button" class="btn dashed small" onClick={() => setPeople([...people, ''])}>
              <Icon name="plus" size={16} /> Ajouter une personne
            </button>
          </div>
        </div>
        <div class="grid2">
          <Field label="Loyer mensuel">
            <AmountInput value={rent} onValue={setRent} />
          </Field>
          <Field label="APL (si tu en as)">
            <AmountInput value={apl} onValue={setApl} />
          </Field>
        </div>
        <p class="hint">Tu pourras tout ajuster ensuite : qui paie quoi, charges, parts de chacun.</p>
        <button type="button" class="btn primary block" onClick={create}>
          Créer le logement
        </button>
      </section>

      <section class="panel">
        <h2>Rejoindre un logement</h2>
        <p class="hint">Ton ou ta colocataire t’a envoyé un lien ? Colle-le ici.</p>
        <div class="row gap">
          <input type="url" placeholder="Lien d’invitation" value={link} onInput={(e) => setLink(e.currentTarget.value)} />
          <button type="button" class="btn" onClick={join}>
            Rejoindre
          </button>
        </div>
      </section>
    </div>
  );
}
