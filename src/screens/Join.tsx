import { useEffect, useState } from 'preact/hooks';
import { toast } from '../components/toast';
import { Avatar, Empty, Logo, TopBar } from '../components/ui';
import { uuid } from '../lib/ids';
import { colorFor } from '../lib/presets';
import { go } from '../lib/router';
import { addToken, db, itemsOf, meOf, projectByToken, putItem, setMe, setPrefs } from '../lib/store';
import { missingTokens, syncEnabled, syncNow, syncState } from '../lib/sync';
import type { GroupData, MemberData, RentData } from '../lib/types';

export function JoinScreen({ token }: { token: string }) {
  const [tried, setTried] = useState(false);
  const [name, setName] = useState(db.value.prefs.name || '');
  const valid = /^[A-Za-z0-9_-]{16,64}$/.test(token || '');

  useEffect(() => {
    if (!valid) return;
    addToken(token);
    void syncNow().then(() => setTried(true));
  }, [token]);

  const p = valid ? projectByToken(token) : undefined;
  const destination = (id: string, kind: string) => {
    if (kind === 'rent') {
      setPrefs({ rentId: id, tab: 'rent' });
      go('rent', true);
    } else {
      setPrefs({ tab: 'projects' });
      go('p/' + id, true);
    }
  };

  // Déjà identifié dans ce projet : on y va directement.
  useEffect(() => {
    if (p && !p.deleted && meOf(p.id)) destination(p.id, p.kind);
  }, [p?.id]);

  const head = <TopBar onBack={() => go('projects', true)} backLabel="Accueil" title="Invitation" />;

  if (!valid) {
    return (
      <div class="page has-topbar">
        {head}
        <Empty icon="🔗" title="Lien invalide" />
      </div>
    );
  }
  if (!syncEnabled) {
    return (
      <div class="page has-topbar">
        {head}
        <Empty icon="☁️" title="Synchronisation non configurée">
          <p>Cette version de l’app n’est reliée à aucun serveur, impossible de rejoindre un projet partagé.</p>
        </Empty>
      </div>
    );
  }
  if (!p) {
    const missing = missingTokens.value.has(token);
    const offline = syncState.value.status === 'offline';
    return (
      <div class="page has-topbar">
        {head}
        <Empty icon={tried && (missing || offline) ? (offline ? '📡' : '🔍') : '⏳'} title={!tried ? 'Ouverture de l’invitation…' : offline ? 'Hors ligne' : missing ? 'Projet introuvable' : 'Chargement…'}>
          {tried && offline && <p>Connecte-toi à internet pour rejoindre ce projet.</p>}
          {tried && missing && <p>Le lien est incorrect ou le projet a été supprimé.</p>}
          {tried && (
            <button type="button" class="btn" onClick={() => void syncNow()}>
              Réessayer
            </button>
          )}
        </Empty>
      </div>
    );
  }
  if (p.deleted) {
    return (
      <div class="page has-topbar">
        {head}
        <Empty icon="🗑️" title="Ce projet a été supprimé" />
      </div>
    );
  }

  const members = itemsOf<MemberData>(p.id, 'member').filter((m) => !m.data.archived);
  const data = p.data as GroupData & RentData;

  function pick(id: string) {
    setMe(p!.id, id);
    const m = members.find((x) => x.id === id);
    if (m && !db.value.prefs.name) setPrefs({ name: m.data.name });
    toast(`Bienvenue ${m?.data.name || ''} !`);
    destination(p!.id, p!.kind);
  }

  function addMe() {
    const n = name.trim();
    if (!n) return toast('Indique ton prénom', { tone: 'warn' });
    const id = uuid();
    putItem<MemberData>(p!.id, 'member', { name: n, color: colorFor(id) }, id);
    if (!db.value.prefs.name) setPrefs({ name: n });
    pick(id);
  }

  return (
    <div class="page has-topbar">
      {head}
      <section class="panel">
        <div class="project-hero">
          <Logo emoji={data.emoji} color={data.color || '#0f6b5c'} image={data.image} size={60} />
          <div>
            <p class="eyebrow">Tu es invité·e à rejoindre</p>
            <h1>{data.name || 'Projet'}</h1>
          </div>
        </div>
      </section>
      {members.length > 0 && (
        <section class="panel">
          <h2>Qui es-tu ?</h2>
          <div class="stack tight">
            {members.map((m) => (
              <button type="button" class="btn block" style={{ justifyContent: 'flex-start' }} key={m.id} onClick={() => pick(m.id)}>
                <Avatar name={m.data.name} id={m.id} color={m.data.color} size={28} />
                {m.data.name}
              </button>
            ))}
          </div>
        </section>
      )}
      <section class="panel">
        <h2>{members.length ? 'Je ne suis pas dans la liste' : 'Ton prénom'}</h2>
        <div class="row gap">
          <input type="text" placeholder="Prénom" value={name} onInput={(e) => setName(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && addMe()} />
          <button type="button" class="btn primary" onClick={addMe}>
            Rejoindre
          </button>
        </div>
      </section>
    </div>
  );
}
