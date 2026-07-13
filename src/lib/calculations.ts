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
  /** الديون المخصومة من صافي المنخرط هذا الشهر */
  debt: number;
  netAmount: number;
  /** قيمة شراء الحليب (liters × milkPurchasePrice من الإعدادات) */
  purchaseValue: number;
  /** قيمة بيع الحليب (liters × milkSellPrice من الإعدادات) */
  sellValue: number;
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
  milkPurchasePrice = 4.2,
  milkSellPrice = 4.5,
): MemberMonthlyStatement[] {
  const monthPrice = priceForMonth(prices, month);
  const transporterById = new Map(transporters.map((t) => [t.id, t]));

  return members.map((member) => {
    const memberReceipts = receipts.filter(
      (r) => r.memberId === member.id && monthKey(r.date) === month,
    );
    const totalLiters = memberReceipts.reduce((sum, r) => sum + r.quantityLiters, 0);
    // Each receipt may have its own pricePerLiter; fall back to monthly price
    const grossAmount = memberReceipts.reduce((sum, r) => {
      return sum + r.quantityLiters * (r.pricePerLiter ?? monthPrice);
    }, 0);
    const effectivePrice = totalLiters > 0 ? grossAmount / totalLiters : monthPrice;
    const transportCost = memberReceipts.reduce((sum, r) => {
      if (r.transportCost !== undefined) {
        return sum + r.transportCost;
      }
      // Legacy: compute from member's linked transporter or receipt's transporterId
      const tid = member.transporterId ?? r.transporterId;
      const transporter = tid ? transporterById.get(tid) : undefined;
      return sum + r.quantityLiters * (transporter?.costPerLiter ?? 0);
    }, 0);

    const debt = member.debt ?? 0;
    return {
      memberId: member.id,
      memberName: member.fullName,
      month,
      totalLiters,
      pricePerLiter: effectivePrice,
      grossAmount,
      transportCost,
      debt,
      netAmount: grossAmount - transportCost - debt,
      purchaseValue: totalLiters * milkPurchasePrice,
      sellValue: totalLiters * milkSellPrice,
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

export interface MonthlyStockBalance {
  receivedLiters: number;
  deliveredLiters: number;
  balanceLiters: number;
}

export function computeMonthlyStockBalance(
  receipts: MilkReceived[],
  deliveries: MilkDelivered[],
  month: string,
): MonthlyStockBalance {
  const receivedLiters = receipts
    .filter((r) => monthKey(r.date) === month)
    .reduce((sum, r) => sum + r.quantityLiters, 0);
  const deliveredLiters = deliveries
    .filter((d) => monthKey(d.date) === month)
    .reduce((sum, d) => sum + d.quantityLiters, 0);
  return {
    receivedLiters,
    deliveredLiters,
    balanceLiters: receivedLiters - deliveredLiters,
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

// ─── Month / date label utilities ───────────────────────────────────────────

export const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو',
  'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر',
];

export const MONTH_NAMES_AR_SHORT = [
  'ينا', 'فبر', 'مار', 'أبر', 'ماي', 'يون',
  'يول', 'غشت', 'شتن', 'أكت', 'نون', 'دجن',
];

export const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

/** "شهر سنة" بالعربية — مثلاً "ماي 2025" */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${MONTH_NAMES_AR[parseInt(m, 10) - 1]} ${y}`;
}

/** "Mois Année" بالفرنسية — مثلاً "Mai 2025" */
export function monthLabelFr(month: string): string {
  const [y, m] = month.split('-');
  return `${MONTH_NAMES_FR[parseInt(m, 10) - 1]} ${y}`;
}

/** اسم الشهر المختصر بالعربية — مثلاً "ماي" */
export function monthShortLabel(month: string): string {
  const [, m] = month.split('-');
  return MONTH_NAMES_AR_SHORT[parseInt(m, 10) - 1];
}

/** آخر N شهراً كـ {value, label}، من الأحدث للأقدم */
export function generateMonthOptions(count = 24): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    options.push({ value, label: monthLabel(value) });
  }
  return options;
}
