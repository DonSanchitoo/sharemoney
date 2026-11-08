export type Kind = 'rent' | 'group' | 'keyring';

export interface Project<D = any> {
  id: string;
  token: string;
  kind: Kind;
  data: D;
  deleted?: boolean;
  updatedAt?: string;
}

export interface Item<D = any> {
  id: string;
  projectId: string;
  type: string;
  data: D;
  deleted?: boolean;
  updatedAt?: string;
}

/* ---------- Projets de groupe ---------- */

export type ProjectType = 'trip' | 'weekend' | 'meal' | 'coloc' | 'event' | 'gift' | 'car' | 'sport' | 'other';

export interface Category {
  id: string;
  label: string;
  icon: string;
}

export interface Modules {
  multiCurrency: boolean;
  tickets: boolean;
  lodging: boolean;
  plan: boolean;
  list: boolean;
  budget: boolean;
  recurring: boolean;
  pot: boolean;
  fuel: boolean;
}

export interface GroupData {
  name: string;
  emoji: string;
  color: string;
  image?: string;
  type: ProjectType;
  currency: string;
  description?: string;
  place?: string;
  startDate?: string;
  endDate?: string;
  categories: Category[];
  modules: Modules;
  listTitle?: string;
  budget?: { total?: number; perCategory?: Record<string, number> };
  pot?: { target?: number; holder?: string; label?: string };
  fuel?: { consumption?: number; price?: number };
  options: {
    roundTransfers?: boolean;
    archived?: boolean;
  };
  createdAt?: string;
}

export interface MemberData {
  name: string;
  color?: string;
  weight?: number; // parts par défaut (couple = 2, enfant = 0,5…)
  honoree?: boolean; // personne fêtée : exclue des dépenses par défaut
  archived?: boolean;
}

export type SplitMode = 'equal' | 'shares' | 'amounts' | 'percent';
export type ExpenseKind = 'expense' | 'transfer' | 'income';

export interface ExpenseData {
  kind: ExpenseKind;
  title: string;
  amount: number; // centimes dans la devise de la dépense
  currency: string;
  rate?: number; // 1 unité de devise = rate unités de devise projet
  payer: string; // dépense : qui a payé ; transfert : qui donne ; rentrée : qui reçoit
  to?: string; // transfert : qui reçoit
  date: string;
  category?: string;
  split: { mode: SplitMode; parts: Record<string, number> };
  note?: string;
  receipts?: string[];
  link?: { type: 'ticket' | 'lodging' | 'recurring'; id: string };
  pot?: boolean;
  createdBy?: string;
}

export type TicketMode = 'plane' | 'train' | 'bus' | 'boat' | 'car' | 'other';

export interface TicketData {
  mode: TicketMode;
  from: string;
  to: string;
  departure?: string; // YYYY-MM-DDTHH:mm
  arrival?: string;
  carrier?: string;
  number?: string;
  reference?: string;
  seat?: string;
  passengers: string[];
  price?: number;
  currency?: string;
  payer?: string;
  expenseId?: string;
  receipts?: string[];
  note?: string;
}

export interface LodgingData {
  name: string;
  address?: string;
  checkIn?: string;
  checkOut?: string;
  reference?: string;
  url?: string;
  phone?: string;
  guests: string[];
  price?: number;
  currency?: string;
  payer?: string;
  expenseId?: string;
  receipts?: string[];
  note?: string;
}

export interface PlanData {
  date: string;
  time?: string;
  title: string;
  place?: string;
  note?: string;
  url?: string;
}

export interface ListItemData {
  text: string;
  done?: boolean;
  assignee?: string;
  order?: number;
}

export interface RecurringData {
  title: string;
  amount: number;
  payer: string;
  category?: string;
  frequency: 'monthly' | 'weekly';
  participants?: string[];
  lastAdded?: string;
}

/* ---------- Loyer ---------- */

export interface RentData {
  name: string;
  emoji: string;
  currency: string;
  createdAt?: string;
}

export interface RentMemberData {
  name: string;
  color?: string;
  archived?: boolean;
}

export interface RentLine {
  id: string;
  label: string;
  amount: number;
  kind: 'expense' | 'aid';
  person: string; // dépense : qui paie ; aide : qui la reçoit
  split?: string[] | null; // null = tout le monde
  rent?: boolean; // ligne « loyer » : sert à la suggestion de qui le vire
}

export interface RentMonthData {
  month: string; // YYYY-MM
  lines: RentLine[];
  shares: Record<string, number>; // % par personne
  done?: Record<string, boolean>; // "from>to" → virement fait
  note?: string;
}

/* ---------- Trousseau (multi-appareils) ---------- */

export interface MembershipData {
  token: string;
  projectId?: string;
  kind?: Kind;
  memberId?: string;
}
