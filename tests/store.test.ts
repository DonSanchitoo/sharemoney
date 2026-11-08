import { describe, expect, it } from 'vitest';
import {
  applyRemote,
  clearPending,
  collectPending,
  createProject,
  db,
  dropKeyring,
  ensureKeyring,
  keyringProject,
  leaveProject,
  putItem,
  reconcileKeyring,
  resetDevice,
  setMe,
  switchKeyring,
  type DB,
} from '../src/lib/store';
import type { Item, Project } from '../src/lib/types';

/** Faux serveur qui reproduit sm_push / sm_pull (dernier écrit gagne, accès par jeton). */
function fakeServer() {
  const projects: Record<string, Project> = {};
  const items: Record<string, Item> = {};
  let clock = 0;
  const ts = () => new Date(Date.UTC(2026, 0, 1) + ++clock * 1000).toISOString();
  return {
    projects,
    items,
    sync() {
      for (let round = 0; round < 2; round++) {
        const pend = collectPending();
        const tokens = db.value.tokens;
        for (const p of pend.projects) {
          if (!tokens.includes(p.token)) continue;
          const cur = projects[p.id];
          if (cur && cur.token !== p.token) continue;
          projects[p.id] = { ...p, updatedAt: ts() };
        }
        for (const it of pend.items) {
          const p = projects[it.projectId];
          if (!p || !tokens.includes(p.token)) continue;
          items[it.id] = { ...it, updatedAt: ts() };
        }
        clearPending(pend.snap);
        const found = Object.values(projects).filter((p) => db.value.tokens.includes(p.token));
        applyRemote({
          projects: found,
          items: Object.values(items).filter((i) => found.some((p) => p.id === i.projectId)),
          cursors: {},
          missing: db.value.tokens.filter((t) => !found.some((p) => p.token === t)),
        });
        reconcileKeyring();
      }
    },
  };
}

async function newDevice() {
  await resetDevice();
  ensureKeyring();
}

describe('trousseau multi-appareils', () => {
  it('retrouve les projets et l’identité sur un second appareil', async () => {
    const server = fakeServer();

    // Appareil A : un projet de groupe, « moi » = Alice.
    await newDevice();
    const group = createProject('group', { name: 'Vacances' });
    const alice = putItem(group.id, 'member', { name: 'Alice' });
    setMe(group.id, alice);
    server.sync();
    const deviceA: DB = db.value;
    const keyA = deviceA.keyring!;

    // Appareil B : un logement créé localement, puis on colle la clé de A.
    await newDevice();
    const rent = createProject('rent', { name: 'Appart' });
    server.sync();
    const oldKey = switchKeyring(keyA)!;
    server.sync();
    expect(keyringProject()?.token).toBe(keyA);
    dropKeyring(oldKey);
    reconcileKeyring();
    server.sync();

    expect(db.value.tokens).toContain(group.token);
    expect(db.value.tokens).toContain(rent.token);
    expect(db.value.tokens).not.toContain(oldKey);
    expect(db.value.me[group.id]).toBe(alice);
    const deviceB: DB = db.value;

    // Retour sur A : le logement créé sur B apparaît.
    db.value = deviceA;
    server.sync();
    expect(db.value.tokens).toContain(rent.token);

    // A retire le logement : B le perd aussi à la synchro suivante.
    leaveProject(rent.id);
    server.sync();
    expect(db.value.tokens).not.toContain(rent.token);
    db.value = deviceB;
    server.sync();
    expect(db.value.tokens).not.toContain(rent.token);
    expect(db.value.tokens).toContain(group.token);
  });

  it('refuse les écritures sans le bon jeton', async () => {
    const server = fakeServer();
    await newDevice();
    const p = createProject('group', { name: 'Secret' });
    server.sync();
    await newDevice();
    // Un appareil qui ne connaît pas le jeton ne voit rien et n'écrit rien.
    putItem(p.id, 'expense', { title: 'pirate' });
    server.sync();
    expect(Object.values(server.items).some((i) => (i.data as { title?: string }).title === 'pirate')).toBe(false);
    expect(Object.values(db.value.projects).some((x) => x.id === p.id)).toBe(false);
  });
});
