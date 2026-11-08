import { db, pendingCount, setPrefs } from '../lib/store';
import { go, route } from '../lib/router';
import { syncEnabled, syncNow, syncState } from '../lib/sync';
import { Icon } from './ui';

export function TabBar() {
  const r = route.value[0] || db.value.prefs.tab;
  const tabs = [
    { key: 'rent', label: 'Loyer', icon: 'home', path: 'rent' },
    { key: 'projects', label: 'Projets', icon: 'grid', path: 'projects' },
    { key: 'settings', label: 'Réglages', icon: 'sliders', path: 'settings' },
  ];
  const active = r === 'p' || r === 'new' ? 'projects' : r;
  return (
    <nav class="tabbar" aria-label="Navigation principale">
      {tabs.map((t) => (
        <button
          type="button"
          class={active === t.key ? 'on' : ''}
          aria-current={active === t.key ? 'page' : undefined}
          onClick={() => {
            if (t.key === 'rent' || t.key === 'projects') setPrefs({ tab: t.key });
            go(t.path);
          }}
        >
          <Icon name={t.icon} size={24} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

/** Pastille d'état de synchro (en haut des écrans principaux). */
export function SyncBadge() {
  if (!syncEnabled) return null;
  const s = syncState.value.status;
  const pending = pendingCount.value;
  const label =
    s === 'syncing' ? 'Synchro…' : s === 'offline' ? 'Hors ligne' : s === 'error' ? 'Erreur de synchro' : pending ? `${pending} en attente` : 'À jour';
  return (
    <button type="button" class={'sync-badge ' + s} onClick={() => void syncNow()} title={syncState.value.error || label}>
      <Icon name={s === 'offline' || s === 'error' ? 'cloudOff' : 'cloud'} size={16} />
      <span>{label}</span>
    </button>
  );
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches;
}

export function InstallHint() {
  if (db.value.prefs.installHintClosed || isStandalone() || !isIOS()) return null;
  return (
    <div class="install-hint">
      <div>
        <strong>Installe l’app sur ton écran d’accueil</strong>
        <p>
          Touche <Icon name="share" size={16} /> Partager puis « Sur l’écran d’accueil ». Ensuite, dans Réglages, colle ta clé
          personnelle pour retrouver tes projets dans l’app.
        </p>
      </div>
      <button type="button" class="icon-btn" aria-label="Masquer" onClick={() => setPrefs({ installHintClosed: true })}>
        <Icon name="x" size={18} />
      </button>
    </div>
  );
}
