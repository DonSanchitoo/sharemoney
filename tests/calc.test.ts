import { describe, expect, it } from 'vitest';
import { computeBalances, defaultSplit, settle, splitError, splitShares } from '../src/lib/calc';
import { distribute, parseAmount, amountToInput } from '../src/lib/money';
import { bestRentPayer, computeRent, sharesFromIncomes } from '../src/lib/rent';
import { uuidFrom, token } from '../src/lib/ids';
import { guessCategory } from '../src/lib/guess';
import { parseShareLink } from '../src/lib/router';
import type { ExpenseData, Item, MemberData, RentLine } from '../src/lib/types';

const exp = (data: Partial<ExpenseData>): Item<ExpenseData> => ({
  id: Math.random().toString(36),
  projectId: 'p',
  type: 'expense',
  data: { kind: 'expense', title: '', amount: 0, currency: 'EUR', payer: 'a', date: '2026-11-08', split: { mode: 'equal', parts: {} }, ...data },
});

describe('montants', () => {
  it('lit les saisies françaises', () => {
    expect(parseAmount('4,44')).toBe(444);
    expect(parseAmount('1 234,5')).toBe(123450);
    expect(parseAmount('12.3')).toBe(1230);
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('abc')).toBe(0);
    expect(amountToInput(444)).toBe('4,44');
    expect(amountToInput(1200)).toBe('12');
  });

  it('répartit sans perdre un centime', () => {
    const d = distribute(1000, { a: 1, b: 1, c: 1 });
    expect(d.a + d.b + d.c).toBe(1000);
    expect(Math.max(d.a, d.b, d.c) - Math.min(d.a, d.b, d.c)).toBe(1);
    const n = distribute(-1000, { a: 1, b: 2 });
    expect(n.a + n.b).toBe(-1000);
    expect(distribute(500, { a: 0, b: 0 })).toEqual({ a: 0, b: 0 });
  });
});

describe('dépenses de groupe', () => {
  it('calcule soldes et remboursements', () => {
    const list = [
      exp({ amount: 9000, payer: 'a', split: { mode: 'equal', parts: { a: 1, b: 1, c: 1 } } }),
      exp({ amount: 3000, payer: 'b', split: { mode: 'equal', parts: { a: 1, b: 1, c: 1 } } }),
    ];
    const r = computeBalances(list, ['a', 'b', 'c']);
    expect(r.total).toBe(12000);
    expect(r.balance).toEqual({ a: 5000, b: -1000, c: -4000 });
    const t = settle(r.balance);
    expect(t).toEqual([
      { from: 'c', to: 'a', amount: 4000 },
      { from: 'b', to: 'a', amount: 1000 },
    ]);
  });

  it('gère remboursements, rentrées, parts et devises', () => {
    const list = [
      exp({ amount: 10000, payer: 'a', split: { mode: 'shares', parts: { a: 2, b: 1, c: 1 } } }),
      exp({ kind: 'transfer', amount: 2500, payer: 'b', to: 'a' }),
      exp({ kind: 'income', amount: 3000, payer: 'c', split: { mode: 'equal', parts: { a: 1, b: 1, c: 1 } } }),
      exp({ amount: 1000, currency: 'USD', rate: 0.9, payer: 'c', split: { mode: 'equal', parts: { a: 1, b: 1 } } }),
    ];
    const r = computeBalances(list, ['a', 'b', 'c']);
    const sum = Object.values(r.balance).reduce((s, v) => s + v, 0);
    expect(sum).toBe(0);
    expect(r.total).toBe(10900);
    expect(r.balance.a).toBe(10000 - 5000 - 2500 + 1000 - 450);
  });

  it('valide les répartitions', () => {
    expect(splitError(1000, { mode: 'amounts', parts: { a: 400, b: 500 } })).toMatch(/reste/);
    expect(splitError(1000, { mode: 'amounts', parts: { a: 500, b: 500 } })).toBeNull();
    expect(splitError(1000, { mode: 'percent', parts: { a: 30, b: 60 } })).toMatch(/90/);
    expect(splitError(1000, { mode: 'equal', parts: {} })).toMatch(/au moins/);
    expect(splitShares(1000, { mode: 'percent', parts: { a: 25, b: 75 } })).toEqual({ a: 250, b: 750 });
  });

  it('exclut les personnes fêtées et applique les parts par défaut', () => {
    const m = (id: string, data: Partial<MemberData>): Item<MemberData> => ({ id, projectId: 'p', type: 'member', data: { name: id, ...data } });
    expect(defaultSplit([m('a', {}), m('b', { honoree: true }), m('c', {})])).toEqual({ mode: 'equal', parts: { a: 1, c: 1 } });
    expect(defaultSplit([m('a', { weight: 2 }), m('b', {})])).toEqual({ mode: 'shares', parts: { a: 2, b: 1 } });
  });

  it('arrondit les remboursements à l’unité si demandé', () => {
    expect(settle({ a: 1234, b: -1234 }, 100)).toEqual([{ from: 'b', to: 'a', amount: 1200 }]);
  });
});

describe('loyer', () => {
  const line = (l: Partial<RentLine>): RentLine => ({ id: Math.random().toString(36), label: '', amount: 0, kind: 'expense', person: 'a', ...l });

  it('reproduit le calcul de l’artefact d’origine', () => {
    const month = {
      lines: [
        line({ label: 'Loyer', amount: 72000, person: 'b', rent: true }),
        line({ label: 'EDF', amount: 8500, person: 'a' }),
        line({ label: 'Eau', amount: 444, person: 'a' }),
        line({ label: 'APL', amount: 20600, kind: 'aid', person: 'a' }),
      ],
      shares: { a: 50, b: 50 },
    };
    const r = computeRent(month, ['a', 'b']);
    expect(r.net).toBe(60344);
    expect(r.share).toEqual({ a: 30172, b: 30172 });
    expect(r.transfers).toEqual([{ from: 'a', to: 'b', amount: 41828 }]);
    const alt = bestRentPayer(month, ['a', 'b']);
    expect(alt?.person).toBe('a');
    expect(alt?.moved).toBe(30172 - 0);
  });

  it('gère trois colocataires, parts inégales et lignes partielles', () => {
    const month = {
      lines: [
        line({ amount: 90000, person: 'a', rent: true }),
        line({ amount: 1500, person: 'b', split: ['b', 'c'] }),
      ],
      shares: { a: 40, b: 30, c: 30 },
    };
    const r = computeRent(month, ['a', 'b', 'c']);
    expect(r.share).toEqual({ a: 36000, b: 27000 + 750, c: 27000 + 750 });
    expect(Object.values(r.balance).reduce((s, v) => s + v, 0)).toBe(0);
  });

  it('calcule des parts au prorata des revenus', () => {
    expect(sharesFromIncomes({ a: 300000, b: 100000 })).toEqual({ a: 75, b: 25 });
  });
});

describe('utilitaires', () => {
  it('génère des identifiants stables et des jetons', () => {
    expect(uuidFrom('x')).toBe(uuidFrom('x'));
    expect(uuidFrom('x')).not.toBe(uuidFrom('y'));
    expect(uuidFrom('abc')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(token()).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('devine la catégorie avec les accents', () => {
    const all = ['restaurant', 'fuel', 'groceries', 'lodging', 'flight', 'drinks'];
    expect(guessCategory('Café du coin', all)).toBe('restaurant');
    expect(guessCategory('Plein essence', all)).toBe('fuel');
    expect(guessCategory('Courses Lidl', all)).toBe('groceries');
    expect(guessCategory('Hôtel', all)).toBe('lodging');
    expect(guessCategory('Bières', all)).toBe('drinks');
    expect(guessCategory('Barbecue', all)).toBeUndefined();
  });

  it('reconnaît les liens collés', () => {
    expect(parseShareLink('https://x.github.io/sharemoney/#/join/abcdefghijklmnopqrstuv')).toEqual({ kind: 'join', token: 'abcdefghijklmnopqrstuv' });
    expect(parseShareLink('https://x/#/k/abcdefghijklmnopqrstuv')).toEqual({ kind: 'keyring', token: 'abcdefghijklmnopqrstuv' });
    expect(parseShareLink('nope')).toBeNull();
  });
});
