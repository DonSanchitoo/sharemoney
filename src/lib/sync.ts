import { signal } from '@preact/signals';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { del, get, set } from 'idb-keyval';
import config from '../../supabase.config.json';
import { uuid } from './ids';
import {
  applyRemote,
  clearPending,
  collectPending,
  db,
  ensureKeyring,
  getProject,
  reconcileKeyring,
  setChangeListener,
  setPendingReceipts,
  type PullResult,
} from './store';

export const syncEnabled = Boolean(config.url && config.key);

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error' | 'disabled';
export const syncState = signal<{ status: SyncStatus; error?: string }>({ status: syncEnabled ? 'idle' : 'disabled' });
/** Jetons inconnus du serveur lors de la dernière synchro (lien invalide ou projet supprimé). */
export const missingTokens = signal<Set<string>>(new Set());

let clientPromise: Promise<SupabaseClient> | null = null;
function sb(): Promise<SupabaseClient> {
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(config.url, config.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  );
  return clientPromise;
}

const OVERLAP_MS = 15_000;
function since(cursor: string | undefined): string | null {
  if (!cursor) return null;
  const t = Date.parse(cursor);
  return isFinite(t) ? new Date(t - OVERLAP_MS).toISOString() : null;
}

async function pull() {
  const tokens = db.value.tokens;
  if (!tokens.length) return;
  const client = await sb();
  const p_req = tokens.map((t) => ({ t, s: since(db.value.cursors[t]) }));
  const { data, error } = await client.rpc('sm_pull', { p_req });
  if (error) throw error;
  const res = data as PullResult;
  applyRemote(res);
  missingTokens.value = new Set(res.missing || []);
}

async function push(): Promise<string[]> {
  const pend = collectPending();
  if (!pend.projects.length && !pend.items.length) return [];
  const client = await sb();
  const tokens = db.value.tokens;
  const strip = <T extends { updatedAt?: string }>(o: T) => {
    const { updatedAt: _u, ...rest } = o;
    return rest;
  };
  // Les projets d'abord (les éléments en dépendent), puis les éléments par paquets.
  const chunks: { projects: unknown[]; items: unknown[] }[] = [{ projects: pend.projects.map(strip), items: [] }];
  for (let i = 0; i < pend.items.length; i += 500) chunks.push({ projects: [], items: pend.items.slice(i, i + 500).map(strip) });
  for (const c of chunks) {
    if (!c.projects.length && !c.items.length) continue;
    const { error } = await client.rpc('sm_push', { p_tokens: tokens, p_projects: c.projects, p_items: c.items });
    if (error) throw error;
  }
  clearPending(pend.snap);
  return Array.from(new Set([...pend.projects.map((p) => p.id), ...pend.items.map((i) => i.projectId)]));
}

/* ---------- Photos ---------- */

async function pushReceipts() {
  const pending = { ...db.value.pendingR };
  const ids = Object.keys(pending);
  if (!ids.length) return;
  const client = await sb();
  for (const id of ids) {
    const p = getProject(pending[id]);
    const data = await get<string>('r:' + id);
    if (!p || !data) {
      delete pending[id];
      continue;
    }
    const { data: ok, error } = await client.rpc('sm_receipt_put', { p_token: p.token, p_project: p.id, p_id: id, p_data: data });
    if (error) throw error;
    if (ok !== false) delete pending[id];
  }
  setPendingReceipts(pending);
}

export async function saveReceipt(projectId: string, dataUrl: string): Promise<string> {
  const id = uuid();
  await set('r:' + id, dataUrl);
  setPendingReceipts({ ...db.value.pendingR, [id]: projectId });
  requestSync();
  return id;
}

export async function loadReceipt(id: string, projectId: string): Promise<string | null> {
  const local = await get<string>('r:' + id).catch(() => undefined);
  if (local) return local;
  const p = getProject(projectId);
  if (!p || !syncEnabled) return null;
  const client = await sb();
  const { data, error } = await client.rpc('sm_receipt_get', { p_token: p.token, p_ids: [id] });
  if (error || !Array.isArray(data) || !data[0]) return null;
  const url = (data[0] as { data: string }).data;
  await set('r:' + id, url).catch(() => {});
  return url;
}

export async function deleteReceipt(id: string, projectId: string) {
  await del('r:' + id).catch(() => {});
  if (db.value.pendingR[id]) {
    const pending = { ...db.value.pendingR };
    delete pending[id];
    setPendingReceipts(pending);
    return;
  }
  const p = getProject(projectId);
  if (!p || !syncEnabled) return;
  try {
    const client = await sb();
    await client.rpc('sm_receipt_del', { p_token: p.token, p_id: id });
  } catch {
    /* sans gravité */
  }
}

/* ---------- Temps réel : on prévient les autres qu'il y a du nouveau ---------- */

const channels = new Map<string, RealtimeChannel>();

async function refreshChannels() {
  const client = await sb();
  const wanted = new Set(
    db.value.tokens.map((t) => Object.values(db.value.projects).find((p) => p.token === t)?.id).filter(Boolean) as string[]
  );
  for (const [id, ch] of channels) {
    if (!wanted.has(id)) {
      void client.removeChannel(ch);
      channels.delete(id);
    }
  }
  for (const id of wanted) {
    if (channels.has(id)) continue;
    const ch = client
      .channel('sm-' + id, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'changed' }, () => requestSync(250))
      .subscribe();
    channels.set(id, ch);
  }
}

function notify(projectIds: string[]) {
  for (const id of projectIds) {
    const ch = channels.get(id);
    if (ch) void ch.send({ type: 'broadcast', event: 'changed', payload: {} }).catch(() => {});
  }
}

/* ---------- Orchestration ---------- */

let chain: Promise<void> = Promise.resolve();
let timer: ReturnType<typeof setTimeout> | undefined;

async function doSync() {
  if (!syncEnabled) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    syncState.value = { status: 'offline' };
    return;
  }
  syncState.value = { status: 'syncing' };
  try {
    const changed = await push();
    await pushReceipts();
    await pull();
    reconcileKeyring();
    // La réconciliation peut créer des adhésions à envoyer.
    const more = await push();
    if (more.length) await pull();
    void refreshChannels().catch(() => {});
    notify([...changed, ...more]);
    syncState.value = { status: 'idle' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
    const offline = /fetch|network|load failed/i.test(msg);
    syncState.value = { status: offline ? 'offline' : 'error', error: msg };
  }
}

export function syncNow(): Promise<void> {
  clearTimeout(timer);
  chain = chain.then(doSync, doSync);
  return chain;
}

export function requestSync(delay = 600) {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

export function startSync() {
  ensureKeyring();
  setChangeListener(() => requestSync());
  if (!syncEnabled) return;
  void syncNow();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestSync(100);
  });
  window.addEventListener('online', () => requestSync(100));
  window.addEventListener('offline', () => (syncState.value = { status: 'offline' }));
  setInterval(() => {
    if (document.visibilityState === 'visible') requestSync(0);
  }, 45_000);
}
