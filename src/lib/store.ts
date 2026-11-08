import { signal, computed } from '@preact/signals';
import { get, set } from 'idb-keyval';
import { token as newToken, uuid, uuidFrom } from './ids';
import type { Item, Kind, MembershipData, Project } from './types';

export interface Prefs {
  name: string;
  theme: 'auto' | 'light' | 'dark';
  tab: 'rent' | 'projects';
  rentId?: string;
  lastCurrency?: Record<string, string>;
  installHintClosed?: boolean;
}

export interface DB {
  v: 1;
  projects: Record<string, Project>;
  items: Record<string, Item>;
  tokens: string[];
  cursors: Record<string, string>;
  pendingP: Record<string, true>;
  pendingI: Record<string, true>;
  pendingR: Record<string, string>;
  me: Record<string, string>;
  keyring?: string;
  prefs: Prefs;
  lastSync?: number;
}

const KEY = 'sharemoney-db-v1';

function emptyDB(): DB {
  return {
    v: 1,
    projects: {},
    items: {},
    tokens: [],
    cursors: {},
    pendingP: {},
    pendingI: {},
    pendingR: {},
    me: {},
    prefs: { name: '', theme: 'auto', tab: 'rent' },
  };
}

export const db = signal<DB>(emptyDB());

/* ---------- Persistance locale (IndexedDB, repli localStorage) ---------- */

let persistTimer: ReturnType<typeof setTimeout> | undefined;
let idbOk = true;

async function persistNow() {
  const snapshot = db.value;
  try {
    if (idbOk) await set(KEY, snapshot);
    else localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    idbOk = false;
    try {
      localStorage.setItem(KEY, JSON.stringify(snapshot));
    } catch {
      /* stockage indisponible : on garde la mémoire */
    }
  }
}

function schedulePersist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persistNow, 250);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    clearTimeout(persistTimer);
    void persistNow();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      clearTimeout(persistTimer);
      void persistNow();
    }
  });
}

export async function initStore(): Promise<void> {
  let saved: DB | undefined;
  try {
    saved = await get<DB>(KEY);
  } catch {
    idbOk = false;
  }
  if (!saved) {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) saved = JSON.parse(raw);
    } catch {
      /* rien */
    }
  }
  if (saved && saved.v === 1) db.value = { ...emptyDB(), ...saved, prefs: { ...emptyDB().prefs, ...saved.prefs } };
}

/* ---------- Écouteur de modifications locales (branché par sync.ts) ---------- */

let onChange: () => void = () => {};
export function setChangeListener(fn: () => void) {
  onChange = fn;
}

function commit(next: Partial<DB>, local = true) {
  db.value = { ...db.value, ...next };
  schedulePersist();
  if (local) onChange();
}

/* ---------- Lecture ---------- */

const EMPTY: Item[] = [];

export const index = computed(() => {
  const by: Record<string, Record<string, Item[]>> = {};
  for (const it of Object.values(db.value.items)) {
    if (it.deleted) continue;
    ((by[it.projectId] ??= {})[it.type] ??= []).push(it);
  }
  return by;
});

export function itemsOf<T = any>(projectId: string | undefined, type: string): Item<T>[] {
  if (!projectId) return EMPTY as Item<T>[];
  return (index.value[projectId]?.[type] ?? EMPTY) as Item<T>[];
}

export function getProject<T = any>(id: string | undefined): Project<T> | undefined {
  return id ? (db.value.projects[id] as Project<T> | undefined) : undefined;
}

export function projectByToken(tok: string): Project | undefined {
  return Object.values(db.value.projects).find((p) => p.token === tok);
}

export const myProjects = computed(() => {
  const toks = new Set(db.value.tokens);
  return Object.values(db.value.projects).filter((p) => toks.has(p.token) && !p.deleted);
});

export const groupProjects = computed(() => myProjects.value.filter((p) => p.kind === 'group'));
export const rentProjects = computed(() => myProjects.value.filter((p) => p.kind === 'rent'));

export function meOf(projectId: string | undefined): string | undefined {
  return projectId ? db.value.me[projectId] : undefined;
}

export const pendingCount = computed(
  () => Object.keys(db.value.pendingP).length + Object.keys(db.value.pendingI).length + Object.keys(db.value.pendingR).length
);

/* ---------- Écriture ---------- */

export function setPrefs(patch: Partial<Prefs>) {
  commit({ prefs: { ...db.value.prefs, ...patch } }, false);
}

export function createProject<T>(kind: Kind, data: T): Project<T> {
  const p: Project<T> = { id: uuid(), token: newToken(), kind, data };
  commit({
    projects: { ...db.value.projects, [p.id]: p },
    tokens: [...db.value.tokens, p.token],
    pendingP: { ...db.value.pendingP, [p.id]: true },
  });
  if (kind !== 'keyring') addMembership(p);
  return p;
}

export function updateProject<T>(id: string, patch: Partial<T>) {
  const p = db.value.projects[id];
  if (!p) return;
  commit({
    projects: { ...db.value.projects, [id]: { ...p, data: { ...p.data, ...patch } } },
    pendingP: { ...db.value.pendingP, [id]: true },
  });
}

export function deleteProjectForAll(id: string) {
  const p = db.value.projects[id];
  if (!p) return;
  commit({
    projects: { ...db.value.projects, [id]: { ...p, deleted: true } },
    pendingP: { ...db.value.pendingP, [id]: true },
  });
}

export function putItem<T>(projectId: string, type: string, data: T, id: string = uuid()): string {
  const prev = db.value.items[id];
  const it: Item<T> = { id, projectId, type, data, deleted: false, updatedAt: prev?.updatedAt };
  commit({
    items: { ...db.value.items, [id]: it },
    pendingI: { ...db.value.pendingI, [id]: true },
  });
  return id;
}

export function patchItem<T>(id: string, patch: Partial<T>) {
  const it = db.value.items[id];
  if (!it) return;
  putItem(it.projectId, it.type, { ...it.data, ...patch }, id);
}

export function deleteItem(id: string) {
  const it = db.value.items[id];
  if (!it) return;
  commit({
    items: { ...db.value.items, [id]: { ...it, deleted: true } },
    pendingI: { ...db.value.pendingI, [id]: true },
  });
}

export function setMe(projectId: string, memberId: string) {
  commit({ me: { ...db.value.me, [projectId]: memberId } }, false);
  const p = db.value.projects[projectId];
  if (p) addMembership(p);
}

export function addToken(tok: string) {
  if (db.value.tokens.includes(tok)) return;
  commit({ tokens: [...db.value.tokens, tok] }, false);
}

/** Retire un projet de cet appareil (et de tes autres appareils via le trousseau). */
export function leaveProject(id: string) {
  const p = db.value.projects[id];
  if (!p) return;
  const kp = keyringProject();
  if (kp) {
    const mid = uuidFrom(kp.id + ':' + p.token);
    if (db.value.items[mid]) deleteItem(mid);
  }
  dropLocal(p.token);
}

function dropLocal(tok: string) {
  const p = projectByToken(tok);
  const items = { ...db.value.items };
  const projects = { ...db.value.projects };
  const pendingI = { ...db.value.pendingI };
  const pendingP = { ...db.value.pendingP };
  const me = { ...db.value.me };
  const cursors = { ...db.value.cursors };
  if (p) {
    for (const it of Object.values(items)) {
      if (it.projectId === p.id) {
        delete items[it.id];
        delete pendingI[it.id];
      }
    }
    delete projects[p.id];
    delete pendingP[p.id];
    delete me[p.id];
  }
  delete cursors[tok];
  commit({ items, projects, pendingI, pendingP, me, cursors, tokens: db.value.tokens.filter((t) => t !== tok) }, false);
}

/* ---------- Synchronisation : fusion des données distantes ---------- */

export interface PullResult {
  projects: Project[];
  items: Item[];
  cursors: Record<string, string | null>;
  missing: string[];
}

export function applyRemote(res: PullResult) {
  const s = db.value;
  const projects = { ...s.projects };
  const items = { ...s.items };
  const cursors = { ...s.cursors };
  for (const p of res.projects || []) if (!s.pendingP[p.id]) projects[p.id] = p;
  for (const it of res.items || []) if (!s.pendingI[it.id]) items[it.id] = it;
  for (const [t, c] of Object.entries(res.cursors || {})) if (c) cursors[t] = c;
  commit({ projects, items, cursors, lastSync: Date.now() }, false);
}

export function collectPending() {
  const s = db.value;
  const projects = Object.keys(s.pendingP).map((id) => s.projects[id]).filter(Boolean);
  const items = Object.keys(s.pendingI).map((id) => s.items[id]).filter(Boolean);
  const snap = new Map<string, string>();
  for (const p of projects) snap.set('p:' + p.id, JSON.stringify(p));
  for (const it of items) snap.set('i:' + it.id, JSON.stringify(it));
  return { projects, items, snap };
}

export function clearPending(snap: Map<string, string>) {
  const s = db.value;
  const pendingP = { ...s.pendingP };
  const pendingI = { ...s.pendingI };
  for (const [key, json] of snap) {
    const [kind, id] = [key.slice(0, 1), key.slice(2)];
    if (kind === 'p' && s.projects[id] && JSON.stringify(s.projects[id]) === json) delete pendingP[id];
    if (kind === 'i' && s.items[id] && JSON.stringify(s.items[id]) === json) delete pendingI[id];
    if (kind === 'p' && !s.projects[id]) delete pendingP[id];
    if (kind === 'i' && !s.items[id]) delete pendingI[id];
  }
  commit({ pendingP, pendingI }, false);
}

export function setPendingReceipts(pendingR: Record<string, string>) {
  commit({ pendingR }, false);
}

/* ---------- Trousseau : retrouver ses projets sur tous ses appareils ---------- */

export function keyringProject(): Project | undefined {
  const t = db.value.keyring;
  return t ? projectByToken(t) : undefined;
}

export function ensureKeyring() {
  if (db.value.keyring && keyringProject()) return;
  if (db.value.keyring && !keyringProject()) return; // en attente de téléchargement
  const p = createProject('keyring', { createdAt: new Date().toISOString() });
  commit({ keyring: p.token }, false);
  reconcileKeyring();
}

function addMembership(p: Project) {
  const kp = keyringProject();
  if (!kp || p.kind === 'keyring') return;
  const id = uuidFrom(kp.id + ':' + p.token);
  const data: MembershipData = { token: p.token, projectId: p.id, kind: p.kind, memberId: db.value.me[p.id] };
  const prev = db.value.items[id];
  if (prev && !prev.deleted && JSON.stringify(prev.data) === JSON.stringify(data)) return;
  putItem(kp.id, 'membership', data, id);
}

/** Fusionne la liste locale des projets avec celle du trousseau (dans les deux sens). */
export function reconcileKeyring() {
  const kp = keyringProject();
  if (!kp) return;
  const all = Object.values(db.value.items).filter((it) => it.projectId === kp.id && it.type === 'membership');
  const byToken = new Map(all.map((it) => [(it.data as MembershipData).token, it]));

  // Projets retirés depuis un autre appareil.
  for (const it of all) {
    const m = it.data as MembershipData;
    if (it.deleted && db.value.tokens.includes(m.token) && !db.value.pendingI[it.id]) dropLocal(m.token);
  }
  // Projets rejoints depuis un autre appareil.
  const me = { ...db.value.me };
  let changedMe = false;
  for (const it of all) {
    if (it.deleted) continue;
    const m = it.data as MembershipData;
    if (!db.value.tokens.includes(m.token)) addToken(m.token);
    if (m.projectId && m.memberId && !me[m.projectId]) {
      me[m.projectId] = m.memberId;
      changedMe = true;
    }
  }
  if (changedMe) commit({ me }, false);
  // Projets de cet appareil absents du trousseau.
  for (const tok of db.value.tokens) {
    if (tok === kp.token || byToken.has(tok)) continue;
    const p = projectByToken(tok);
    if (p?.kind === 'keyring') continue;
    if (p) addMembership(p);
    else putItem(kp.id, 'membership', { token: tok } as MembershipData, uuidFrom(kp.id + ':' + tok));
  }
  // Compléter les adhésions (id du projet, membre choisi).
  for (const it of all) {
    if (it.deleted) continue;
    const m = it.data as MembershipData;
    const p = projectByToken(m.token);
    if (p && (m.projectId !== p.id || (db.value.me[p.id] && m.memberId !== db.value.me[p.id]))) addMembership(p);
  }
}

/** Utilise le trousseau d'un autre appareil : l'ancien est fusionné dedans. */
export function switchKeyring(tok: string): string | undefined {
  const old = db.value.keyring;
  if (old === tok) return old;
  addToken(tok);
  commit({ keyring: tok }, false);
  return old;
}

export function dropKeyring(tok: string) {
  dropLocal(tok);
}

export function resetDevice() {
  db.value = emptyDB();
  return persistNow();
}
