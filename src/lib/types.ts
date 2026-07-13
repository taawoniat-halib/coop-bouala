export type Role = 'admin' | 'collector' | 'accountant';

export interface AppUser {
  uid: string;
  email: string;
  displayName?: string;
  role: Role;
  createdAt: number;
  /** Set when this login belongs to a member, links back to their record. */
  memberId?: string;
  /** Legacy: set on older logins created for a transporter. No longer created going forward. */
  transporterId?: string;
}

export interface Settings {
  coopName: string;
  logoUrl?: string;
  currency: string; // MAD
  phone?: string;
  address?: string;
  /** ثمن شراء لتر الحليب من الفلاحين */
  milkPurchasePrice?: number; // default 4.2
  /** ثمن بيع لتر الحليب للشركة */
  milkSellPrice?: number; // default 4.5
}

export interface Member {
  id: string;
  fullName: string;
  cin?: string;
  phone?: string;
  address?: string;
  active: boolean;
  /** الناقل المرتبط بهذا الفلاح */
  transporterId?: string;
  createdAt: number;
}

export interface Transporter {
  id: string;
  fullName: string;
  phone?: string;
  vehicle?: string;
  costPerLiter: number;
  active: boolean;
  createdAt: number;
}

export interface Price {
  id: string;
  month: string; // YYYY-MM
  pricePerLiter: number;
  createdAt: number;
}

export interface MilkReceived {
  id: string;
  memberId: string;
  transporterId?: string; // legacy — kept for backward compat
  pricePerLiter?: number; // price per liter for this specific delivery (overrides monthly price)
  transportCost?: number; // total transport cost for the whole delivery
  date: string; // YYYY-MM-DD
  quantityLiters: number;
  fat?: number;
  notes?: string;
  createdAt: number;
}

export interface MilkDelivered {
  id: string;
  date: string; // YYYY-MM-DD
  companyName: string;
  quantityLiters: number;
  pricePerLiter: number;
  notes?: string;
  createdAt: number;
}

export interface Income {
  id: string;
  date: string;
  label: string;
  amount: number;
  category?: string;
  notes?: string;
  createdAt: number;
}

export interface Expense {
  id: string;
  date: string;
  label: string;
  amount: number;
  category?: string;
  notes?: string;
  createdAt: number;
}

export interface Invoice {
  id: string; // `${memberId}_${month}`
  memberId: string;
  month: string; // YYYY-MM
  paid: boolean;
  paidAt?: number;
  createdAt: number;
}
