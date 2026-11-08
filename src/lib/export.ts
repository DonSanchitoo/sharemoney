import { baseAmount, settle, splitShares } from './calc';
import { fmtDate, fmtRange, todayISO } from './date';
import { fmt } from './money';
import { preset } from './presets';
import { shareFile } from './share';
import type { Group } from '../screens/project/common';
import { categoryOf, memberName } from '../screens/project/common';

const KIND: Record<string, string> = { expense: 'Dépense', transfer: 'Remboursement', income: 'Rentrée' };

function slug(s: string): string {
  return (
    s
      .replace(/œ/gi, 'oe')
      .replace(/æ/gi, 'ae')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'projet'
  );
}

const num = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

/** CSV au format Excel français : séparateur « ; », virgule décimale, BOM UTF-8. */
export async function exportCSV(g: Group) {
  const d = g.p.data;
  const ids = g.members.map((m) => m.id);
  const head = ['Date', 'Type', 'Titre', 'Catégorie', 'Payé par / De', 'À', 'Montant', 'Devise', 'Taux', `Montant (${d.currency})`, ...ids.map((id) => `Part ${g.names[id]}`), 'Note'];
  const rows = g.expenses
    .slice()
    .sort((a, b) => a.data.date.localeCompare(b.data.date))
    .map((it) => {
      const e = it.data;
      const v = baseAmount(e);
      const shares = e.kind === 'transfer' ? {} : splitShares(v, e.split);
      return [
        e.date,
        KIND[e.kind],
        e.title,
        e.kind === 'expense' ? categoryOf(g.p, e.category).label : '',
        g.names[e.payer] || '',
        e.kind === 'transfer' ? g.names[e.to || ''] || '' : '',
        num(e.amount),
        e.currency,
        String(e.rate ?? 1).replace('.', ','),
        num(v),
        ...ids.map((id) => (shares[id] ? num(shares[id]) : '')),
        (e.note || '').replace(/\s+/g, ' '),
      ];
    });
  const r = g.report;
  const summary = [[], ['Bilan'], ['Personne', 'A payé', 'Sa part', 'Solde'], ...ids.map((id) => [g.names[id], num(r.paid[id] || 0), num(r.consumed[id] || 0), num(r.balance[id] || 0)])];
  const transfers = settle(r.balance);
  if (transfers.length) summary.push([], ['Remboursements à faire'], ...transfers.map((t) => [`${g.names[t.from]} → ${g.names[t.to]}`, num(t.amount)]));
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = '﻿' + [head, ...rows, ...summary].map((row) => row.map(esc).join(';')).join('\r\n');
  await shareFile(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${slug(d.name)}-${todayISO()}.csv`, d.name);
}

/** Les polices standard du PDF ne couvrent que le Latin-1 (+ €) : on retire emojis et espaces fines. */
function pdfText(s: string): string {
  return s
    .replace(/[  ]/g, ' ')
    .replace(/[→]/g, '->')
    .replace(/[−]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[^ -ÿ€Œœ\n]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export async function exportPDF(g: Group) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const d = g.p.data;
  const cur = d.currency;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const accent: [number, number, number] = [15, 107, 92];
  const m = 40;
  let y = m;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(pdfText(d.name) || 'Projet', m, y + 10);
  y += 30;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  const sub = [preset(d.type).label, fmtRange(d.startDate, d.endDate), d.place, `${g.people.length} participants`, `édité le ${new Date().toLocaleDateString('fr-FR')}`].filter(Boolean).join(' · ');
  doc.text(pdfText(sub), m, y);
  y += 24;
  doc.setTextColor(20);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(pdfText(`Total des dépenses : ${fmt(g.report.total, cur)}`), m, y);
  y += 12;

  const r = g.report;
  const ids = g.members.filter((x) => !x.data.archived || Math.abs(r.balance[x.id] || 0) >= 1 || (r.paid[x.id] || 0) > 0).map((x) => x.id);
  const table = (title: string, head: string[], body: string[][], opts: Record<string, unknown> = {}) => {
    y += 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(title, m, y);
    autoTable(doc, {
      startY: y + 8,
      head: [head],
      body,
      margin: { left: m, right: m },
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: accent, textColor: 255 },
      alternateRowStyles: { fillColor: [244, 247, 246] },
      ...opts,
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  };

  table(
    'Bilan par personne',
    ['Personne', 'A payé', 'Sa part', 'Solde'],
    ids.map((id) => [pdfText(g.names[id]), pdfText(fmt(r.paid[id] || 0, cur)), pdfText(fmt(r.consumed[id] || 0, cur)), pdfText(fmt(r.balance[id] || 0, cur))]),
    { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } } }
  );

  const transfers = settle(r.balance, d.options?.roundTransfers ? 100 : 1);
  if (transfers.length) {
    table(
      'Remboursements à faire',
      ['De', 'À', 'Montant'],
      transfers.map((t) => [pdfText(g.names[t.from]), pdfText(g.names[t.to]), pdfText(fmt(t.amount, cur))]),
      { columnStyles: { 2: { halign: 'right' } } }
    );
  }

  const cats = Object.entries(r.byCategory).sort((a, b) => b[1] - a[1]);
  if (cats.length) {
    table(
      'Par catégorie',
      ['Catégorie', 'Montant', 'Part'],
      cats.map(([c, v]) => [pdfText(categoryOf(g.p, c).label), pdfText(fmt(v, cur)), Math.round((v / (r.total || 1)) * 100) + ' %']),
      { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } } }
    );
  }

  table(
    'Détail des opérations',
    ['Date', 'Titre', 'Par', 'Montant'],
    g.expenses
      .slice()
      .sort((a, b) => a.data.date.localeCompare(b.data.date))
      .map((it) => {
        const e = it.data;
        const who = e.kind === 'transfer' ? `${memberName(g.names, e.payer)} -> ${memberName(g.names, e.to)}` : memberName(g.names, e.payer);
        const amount = fmt(baseAmount(e), cur) + (e.currency !== cur ? ` (${fmt(e.amount, e.currency)})` : '');
        return [fmtDate(e.date, { day: '2-digit', month: '2-digit', year: 'numeric' }), pdfText((e.kind !== 'expense' ? KIND[e.kind] + ' : ' : '') + e.title), pdfText(who), pdfText(amount)];
      }),
    { columnStyles: { 3: { halign: 'right' } } }
  );

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`ShareMoney · ${i}/${pages}`, doc.internal.pageSize.getWidth() - m, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
  }
  await shareFile(doc.output('blob'), `${slug(d.name)}-${todayISO()}.pdf`, d.name);
}
