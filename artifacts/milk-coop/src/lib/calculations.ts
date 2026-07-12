import type {
  Member,
  MilkReceived,
  MilkDelivered,
  Income,
  Expense,
  Price,
  Transporter,
} from './types';

/** YYYY-MM key from a YYYY-MM-DD date string. */
export const monthKey = (date: string) => date.slice(0, 7);
/** YYYY key from a YYYY-MM-DD date string. */
export const yearKey = (date: string) => date.slice(0, 4);

/** Price per liter that applied in a given month, or 0 if not set. */
export function priceForMonth(prices: Price[], month: string): number {
  return prices.find((p) => p.month === month)?.pricePerLiter ?? 0;
}

export interface MemberMonthlyStatement {
  memberId: string;
  memberName: string;
  month: string;
  totalLiters: number;
  pricePerLiter: number;
  grossAmount: number;
  transportCost: number;
  netAmount: number;
}

/**
 * Computes each member's net pay for a month.
 * Transport cost uses the new per-receipt transportCost field (cost per liter)
 * with a fallback to the legacy transporter lookup for old records.
 */
export function computeMemberMonthlyStatements(
  members: Member[],
  receipts: MilkReceived[],
  transporters: Transporter[],
  prices: Price[],
  month: string,
): MemberMonthlyStatement[] {
  const monthPrice = priceForMonth(prices, month);
  const transporterById = new Map(transporters.map((t) => [t.id, t]));

  return members.map((member) => {
    const memberReceipts = receipts.filter(
      (r) => r.memberId === member.id && monthKey(r.date) === month,
    );
    const totalLiters = memberReceipts.reduce(
      (sum, r) => sum + r.quantityLiters,
      0,
    );
    // Each receipt may have its own pricePerLiter; fall back to monthly price
    const grossAmount = memberReceipts.reduce((sum, r) => {
      return sum + r.quantityLiters * (r.pricePerLiter ?? monthPrice);
    }, 0);
    const effectivePrice = totalLiters > 0 ? grossAmount / totalLiters : monthPrice;
    const transportCost = memberReceipts.reduce((sum, r) => {
      if (r.transportCost !== undefined) {
        // transportCost is the total cost for the whole delivery
        return sum + r.transportCost;
      }
      // Legacy: compute from transporter costPerLiter
      const transporter = r.transporterId
        ? transporterById.get(r.transporterId)
        : undefined;
      return sum + r.quantityLiters * (transporter?.costPerLiter ?? 0);
    }, 0);
    return {
      memberId: member.id,
      memberName: member.fullName,
      month,
      totalLiters,
      pricePerLiter: effectivePrice,
      grossAmount,
      transportCost,
      netAmount: grossAmount - transportCost,
    };
  });
}

export interface DashboardSummary {
  todayLiters: number;
  monthLiters: number;
  yearLiters: number;
  monthIncome: number;
  monthExpense: number;
  monthBalance: number;
  activeMembers: number;
  activeTransporters: number;
}

export function computeDashboardSummary(
  receipts: MilkReceived[],
  incomes: Income[],
  expenses: Expense[],
  members: Member[],
  transporters: Transporter[],
  today: string,
): DashboardSummary {
  const month = monthKey(today);
  const year = yearKey(today);

  const todayLiters = receipts
    .filter((r) => r.date === today)
    .reduce((sum, r) => sum + r.quantityLiters, 0);
  const monthLiters = receipts
    .filter((r) => monthKey(r.date) === month)
    .reduce((sum, r) => sum + r.quantityLiters, 0);
  const yearLiters = receipts
    .filter((r) => yearKey(r.date) === year)
    .reduce((sum, r) => sum + r.quantityLiters, 0);

  const monthIncome = incomes
    .filter((i) => monthKey(i.date) === month)
    .reduce((sum, i) => sum + i.amount, 0);
  const monthExpense = expenses
    .filter((e) => monthKey(e.date) === month)
    .reduce((sum, e) => sum + e.amount, 0);

  return {
    todayLiters,
    monthLiters,
    yearLiters,
    monthIncome,
    monthExpense,
    monthBalance: monthIncome - monthExpense,
    activeMembers: members.filter((m) => m.active).length,
    activeTransporters: transporters.filter((t) => t.active).length,
  };
}

/** Total liters delivered to companies grouped by company, for a month. */
export function deliveredByCompany(
  deliveries: MilkDelivered[],
  month: string,
): { companyName: string; liters: number; amount: number }[] {
  const filtered = deliveries.filter((d) => monthKey(d.date) === month);
  const map = new Map<string, { liters: number; amount: number }>();
  for (const d of filtered) {
    const entry = map.get(d.companyName) ?? { liters: 0, amount: 0 };
    entry.liters += d.quantityLiters;
    entry.amount += d.quantityLiters * d.pricePerLiter;
    map.set(d.companyName, entry);
  }
  return Array.from(map.entries()).map(([companyName, v]) => ({
    companyName,
    ...v,
  }));
}
