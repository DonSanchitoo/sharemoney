import { signal } from '@preact/signals';

/** Routage par ancre (#/…) : compatible GitHub Pages sans configuration serveur. */
function parse(): string[] {
  const h = location.hash.replace(/^#\/?/, '');
  return h ? h.split('/').map(decodeURIComponent) : [];
}

export const route = signal<string[]>(typeof location !== 'undefined' ? parse() : []);

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    route.value = parse();
    window.scrollTo(0, 0);
  });
}

let depth = 0;

export function go(path: string, replace = false) {
  const hash = '#/' + path.replace(/^\/+/, '');
  if (location.hash === hash) return;
  if (replace) {
    history.replaceState(null, '', hash);
    route.value = parse();
    window.scrollTo(0, 0);
  } else {
    depth++;
    location.hash = hash;
  }
}

/** Retour arrière : historique si on a navigué dans l'app, sinon chemin de repli. */
export function back(fallback: string) {
  if (depth > 0) {
    depth--;
    history.back();
  } else {
    go(fallback, true);
  }
}

export function appUrl(path: string): string {
  const base = location.href.split('#')[0];
  return base + '#/' + path;
}

/** Extrait un jeton d'un lien collé (lien d'invitation, clé de trousseau ou jeton brut). */
export function parseShareLink(input: string): { kind: 'join' | 'keyring'; token: string } | null {
  const s = input.trim();
  const m = s.match(/#\/(join|k)\/([A-Za-z0-9_-]{16,64})/);
  if (m) return { kind: m[1] === 'k' ? 'keyring' : 'join', token: m[2] };
  if (/^[A-Za-z0-9_-]{16,64}$/.test(s)) return { kind: 'join', token: s };
  return null;
}
