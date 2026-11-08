import type { Category, GroupData, Modules, ProjectType, TicketMode } from './types';

const C = (id: string, label: string, icon: string): Category => ({ id, label, icon });

export const CATEGORY_CATALOG: Record<string, Category> = {
  flight: C('flight', 'Avion', '✈️'),
  transport: C('transport', 'Transport', '🚆'),
  lodging: C('lodging', 'Hébergement', '🏨'),
  restaurant: C('restaurant', 'Restaurant', '🍽️'),
  groceries: C('groceries', 'Courses', '🛒'),
  drinks: C('drinks', 'Boissons', '🍻'),
  activities: C('activities', 'Activités', '🎟️'),
  carRental: C('carRental', 'Location voiture', '🚙'),
  fuel: C('fuel', 'Carburant', '⛽'),
  toll: C('toll', 'Péage / parking', '🅿️'),
  delivery: C('delivery', 'Livraison', '🛵'),
  shopping: C('shopping', 'Shopping', '🛍️'),
  gift: C('gift', 'Cadeau', '🎁'),
  decoration: C('decoration', 'Déco', '🎈'),
  venue: C('venue', 'Salle / terrain', '🏟️'),
  catering: C('catering', 'Traiteur', '🥘'),
  energy: C('energy', 'Énergie', '💡'),
  internet: C('internet', 'Internet / abonnements', '📶'),
  household: C('household', 'Maison / ménage', '🧽'),
  maintenance: C('maintenance', 'Entretien / réparation', '🔧'),
  insurance: C('insurance', 'Assurance', '🛡️'),
  equipment: C('equipment', 'Matériel', '🎒'),
  fees: C('fees', 'Licence / inscription', '🎫'),
  health: C('health', 'Santé', '💊'),
  other: C('other', 'Autre', '📦'),
};

export const MODULES: { key: keyof Modules; label: string; icon: string; description: string }[] = [
  { key: 'multiCurrency', label: 'Plusieurs devises', icon: '💱', description: 'Saisir en $, £, ¥… avec conversion automatique.' },
  { key: 'tickets', label: 'Billets', icon: '🎫', description: 'Avion, train, bus : horaires, références, passagers.' },
  { key: 'lodging', label: 'Hébergements', icon: '🏨', description: 'Adresses, dates d’arrivée et de départ, réservations.' },
  { key: 'plan', label: 'Programme', icon: '🗓️', description: 'Planning jour par jour, avec billets et hébergements.' },
  { key: 'list', label: 'Liste partagée', icon: '✅', description: 'Check-list, qui apporte quoi, courses, tâches.' },
  { key: 'budget', label: 'Budget', icon: '🎯', description: 'Budget global et par catégorie, avec alertes.' },
  { key: 'recurring', label: 'Récurrentes', icon: '🔁', description: 'Dépenses qui reviennent chaque mois ou semaine.' },
  { key: 'pot', label: 'Cagnotte', icon: '🐷', description: 'Objectif à atteindre et contributions de chacun.' },
  { key: 'fuel', label: 'Carburant', icon: '⛽', description: 'Calcul du plein selon km, consommation et prix.' },
];

export interface Preset {
  type: ProjectType;
  label: string;
  short: string;
  emoji: string;
  color: string;
  description: string;
  categories: string[];
  modules: Partial<Modules>;
  listTitle: string;
  listSeed?: string[];
  dates: 'range' | 'single' | 'none';
  placeLabel?: string;
  namePlaceholder: string;
  honoree?: boolean;
}

export const PRESETS: Preset[] = [
  {
    type: 'trip', label: 'Vacances / voyage', short: 'Voyage', emoji: '✈️', color: '#2f7fd8',
    description: 'Billets, hébergements, programme, devises étrangères.',
    categories: ['flight', 'transport', 'lodging', 'restaurant', 'groceries', 'activities', 'carRental', 'fuel', 'toll', 'shopping', 'other'],
    modules: { tickets: true, lodging: true, plan: true, list: true, budget: true, multiCurrency: true, fuel: true },
    listTitle: 'Check-list valise',
    listSeed: ['Passeports / cartes d’identité', 'Chargeurs et batterie', 'Adaptateur de prise', 'Trousse à pharmacie', 'Assurance voyage'],
    dates: 'range', placeLabel: 'Destination', namePlaceholder: 'Lisbonne 2027',
  },
  {
    type: 'weekend', label: 'Week-end', short: 'Week-end', emoji: '🏕️', color: '#3c9a5f',
    description: 'Location, courses, covoiturage et ce qu’il faut emporter.',
    categories: ['lodging', 'groceries', 'restaurant', 'drinks', 'transport', 'fuel', 'toll', 'activities', 'other'],
    modules: { lodging: true, plan: true, list: true, fuel: true },
    listTitle: 'À emporter', dates: 'range', placeLabel: 'Lieu', namePlaceholder: 'Week-end à la mer',
  },
  {
    type: 'meal', label: 'Repas / soirée', short: 'Repas', emoji: '🍽️', color: '#e07a2f',
    description: 'Courses, boissons, et qui apporte quoi.',
    categories: ['groceries', 'drinks', 'restaurant', 'delivery', 'decoration', 'other'],
    modules: { list: true },
    listTitle: 'Qui apporte quoi', listSeed: ['Apéro', 'Plat', 'Dessert', 'Boissons', 'Pain'],
    dates: 'single', placeLabel: 'Lieu', namePlaceholder: 'Raclette chez Léa',
  },
  {
    type: 'coloc', label: 'Colocation / maison', short: 'Coloc', emoji: '🛋️', color: '#8a5cd1',
    description: 'Courses communes, abonnements, dépenses récurrentes.',
    categories: ['groceries', 'household', 'energy', 'internet', 'maintenance', 'insurance', 'other'],
    modules: { recurring: true, list: true, budget: true },
    listTitle: 'Liste de courses', dates: 'none', namePlaceholder: 'Appart rue Voltaire',
  },
  {
    type: 'event', label: 'Événement', short: 'Événement', emoji: '🎉', color: '#d6457a',
    description: 'EVG/EVJF, anniversaire, mariage : personne fêtée exclue des frais.',
    categories: ['venue', 'catering', 'drinks', 'decoration', 'gift', 'activities', 'lodging', 'transport', 'other'],
    modules: { lodging: true, plan: true, list: true, budget: true, pot: true },
    listTitle: 'Tâches', dates: 'range', placeLabel: 'Lieu', namePlaceholder: 'EVG de Tom', honoree: true,
  },
  {
    type: 'gift', label: 'Cadeau commun / cagnotte', short: 'Cadeau', emoji: '🎁', color: '#c9a227',
    description: 'Objectif, contributions et idées de cadeau.',
    categories: ['gift', 'decoration', 'other'],
    modules: { pot: true, list: true },
    listTitle: 'Idées cadeau', dates: 'single', namePlaceholder: 'Cadeau de départ de Julie', honoree: true,
  },
  {
    type: 'car', label: 'Voiture / covoiturage', short: 'Voiture', emoji: '🚗', color: '#4a6a86',
    description: 'Carburant, péages, entretien et assurance partagés.',
    categories: ['fuel', 'toll', 'maintenance', 'insurance', 'carRental', 'other'],
    modules: { fuel: true, recurring: true, budget: true },
    listTitle: 'À faire', dates: 'none', namePlaceholder: 'Clio partagée',
  },
  {
    type: 'sport', label: 'Sport / activité régulière', short: 'Sport', emoji: '⚽', color: '#1f9e8f',
    description: 'Location de terrain, matériel, licences.',
    categories: ['venue', 'equipment', 'fees', 'drinks', 'transport', 'other'],
    modules: { recurring: true, list: true },
    listTitle: 'Matériel', dates: 'none', namePlaceholder: 'Five du jeudi',
  },
  {
    type: 'other', label: 'Autre', short: 'Projet', emoji: '💼', color: '#6b7280',
    description: 'Projet libre, à configurer comme tu veux.',
    categories: ['groceries', 'restaurant', 'transport', 'activities', 'shopping', 'other'],
    modules: { list: true },
    listTitle: 'Liste', dates: 'range', namePlaceholder: 'Mon projet',
  },
];

export function preset(type: ProjectType | undefined): Preset {
  return PRESETS.find((p) => p.type === type) || PRESETS[PRESETS.length - 1];
}

export const NO_MODULES: Modules = {
  multiCurrency: false, tickets: false, lodging: false, plan: false, list: false,
  budget: false, recurring: false, pot: false, fuel: false,
};

export function presetData(type: ProjectType, name: string, currency = 'EUR'): GroupData {
  const p = preset(type);
  return {
    name,
    emoji: p.emoji,
    color: p.color,
    type,
    currency,
    categories: p.categories.map((id) => ({ ...CATEGORY_CATALOG[id] })),
    modules: { ...NO_MODULES, ...p.modules },
    listTitle: p.listTitle,
    options: { roundTransfers: false, archived: false },
    createdAt: new Date().toISOString(),
  };
}

export const LOGO_EMOJIS = [
  '✈️', '🏖️', '🏝️', '⛰️', '🏕️', '🗺️', '🧳', '🚗', '🚆', '⛵', '🏔️', '🎿',
  '🍽️', '🍕', '🍣', '🍻', '🍷', '🥂', '☕', '🧀', '🎉', '🎂', '💍', '🎁',
  '🏠', '🛋️', '🛒', '⚽', '🎾', '🏀', '🚴', '🏄', '🎮', '🎬', '🎤', '🎸',
  '🐶', '👶', '📚', '💼', '🌍', '🗼', '🏰', '🌴', '❄️', '☀️', '❤️', '⭐',
];

export const LOGO_COLORS = ['#0f6b5c', '#2f7fd8', '#3c9a5f', '#e07a2f', '#8a5cd1', '#d6457a', '#c9a227', '#4a6a86', '#1f9e8f', '#c2410c', '#6b7280', '#111827'];

export const MEMBER_COLORS = ['#0f6b5c', '#2f7fd8', '#d6457a', '#e07a2f', '#8a5cd1', '#3c9a5f', '#c9a227', '#c2410c', '#1f9e8f', '#4a6a86', '#9f1239', '#4d7c0f'];

export function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return MEMBER_COLORS[h % MEMBER_COLORS.length];
}

export const TICKET_MODES: { mode: TicketMode; label: string; icon: string }[] = [
  { mode: 'plane', label: 'Avion', icon: '✈️' },
  { mode: 'train', label: 'Train', icon: '🚆' },
  { mode: 'bus', label: 'Bus', icon: '🚌' },
  { mode: 'boat', label: 'Bateau', icon: '⛴️' },
  { mode: 'car', label: 'Voiture', icon: '🚗' },
  { mode: 'other', label: 'Autre', icon: '🎫' },
];
