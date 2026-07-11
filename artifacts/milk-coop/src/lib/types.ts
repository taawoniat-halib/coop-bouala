export type Role = 'admin' | 'collector' | 'accountant';

export interface AppUser {
  uid: string;
  email: string;
  displayName?: string;
  role: Role;
  createdAt: number;
}

export interface Settings {
  coopName: string;
  logoUrl?: string;
  currency: string; // MAD
  phone?: string; // used as default WhatsApp share target
  address?: string;
}

export interface Member {
  id: string;
  fullName: string;
  cin?: string;
  phone?: string;
  address?: string;
  active: boolean;
  createdAt: number;
}

export interface Transporter {
  id: string;
  fullName: string;
  phone?: string;
  vehicle?: string;
  costPerLiter: number; // used to compute individual transport cost
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
  transporterId?: string;
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
