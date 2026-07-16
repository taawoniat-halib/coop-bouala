import type {
  Member,
  MilkReceived,
  MilkDelivered,
  Income,
  Expense,
  Transporter,
  Price,
} from './types';

/** YYYY-MM key from a YYYY-MM-DD date string. */
export const monthKey = (date: string) => date.slice(0, 7);
/** YYYY key from a YYYY-MM-DD date string. */
const yearKey = (date: string) => date.slice(0, 4);

/** Price per liter that applied in a given month, or 0 if not set. */
export function priceForMonth(prices: Price[], month: string): number {
  return prices.find((p) => p.month === month)?.pricePerLiter ?? 0;
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

// ─── Month / date label utilities ───────────────────────────────────────────

export const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو',
  'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر',
];

export const MONTH_NAMES_AR_SHORT = [
  'ينا', 'فبر', 'مار', 'أبر', 'ماي', 'يون',
  'يول', 'غشت', 'شتن', 'أكت', 'نون', 'دجن',
];

/** "شهر سنة" بالعربية — مثلاً "ماي 2025" */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  const idx = parseInt(m, 10) - 1;
  const name = Number.isNaN(idx) || idx < 0 || idx > 11 ? 'شهر غير مصنف' : MONTH_NAMES_AR[idx];
  return `${name} ${y ?? ''}`.trim();
}

/** اسم الشهر المختصر بالعربية — مثلاً "ماي" */
export function monthShortLabel(month: string): string {
  const [, m] = month.split('-');
  const idx = parseInt(m, 10) - 1;
  return Number.isNaN(idx) || idx < 0 || idx > 11 ? '؟؟' : MONTH_NAMES_AR_SHORT[idx];
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
