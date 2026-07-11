import { where, orderBy } from 'firebase/firestore';
import { useCollection } from './useCollection';
import type {
  Member,
  Transporter,
  Price,
  MilkReceived,
  MilkDelivered,
  Income,
  Expense,
  AppUser,
} from '@/lib/types';

export const useMembers = () => useCollection<Member>('members');
export const useTransporters = () => useCollection<Transporter>('transporters');
export const usePrices = () => useCollection<Price>('prices');
export const useMilkReceived = () =>
  useCollection<MilkReceived>('milk_received', [orderBy('date', 'desc')]);
export const useMilkDelivered = () =>
  useCollection<MilkDelivered>('milk_delivered', [orderBy('date', 'desc')]);
export const useIncomes = () =>
  useCollection<Income>('incomes', [orderBy('date', 'desc')]);
export const useExpenses = () =>
  useCollection<Expense>('expenses', [orderBy('date', 'desc')]);
/** Admin-only: manage user accounts + roles. */
export const useUsers = () => useCollection<AppUser & { id: string }>('users');

/** Milk received for a single member, newest first. */
export const useMemberMilkReceived = (memberId: string) =>
  useCollection<MilkReceived>('milk_received', [
    where('memberId', '==', memberId),
    orderBy('date', 'desc'),
  ]);
