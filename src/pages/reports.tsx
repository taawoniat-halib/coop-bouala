import { Layout } from '@/components/Layout';
import {
  useMembers,
  useMilkReceived,
  useMilkDelivered,
  useIncomes,
  useExpenses,
  usePrices,
  useTransporters,
} from '@/hooks/useData';
import { useSettings } from '@/hooks/useSettings';
import { useState, useMemo } from 'react';
import {
  monthKey,
  monthLabel as monthLabelAr,
  MONTH_NAMES_AR,
  MONTH_NAMES_AR_SHORT,
  priceForMonth,
} from '@/lib/calculations';
import { exportToPdf, exportToExcel, printPage, shareOnWhatsApp } from '@/lib/exportUtils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Printer,
  FileText,
  FileSpreadsheet,
  Send,
  Search,
  BarChart3,
  Loader2,
  Droplets,
  TrendingUp,
  TrendingDown,
  Wallet,
  Filter,
  Calendar,
  Users,
  PieChart as PieChartIcon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
} from 'recharts';

// ─────────────────────────────────────────────────────────────────────────────
// Coop Bouala — Annual interactive report (dynamic year selection)
// The user picks any year; the report is built entirely from data recorded
// in the application for that year. By default it shows the current year.
// ─────────────────────────────────────────────────────────────────────────────

const PURPLE = '#800070';
const PURPLE_DARK = '#5a005a';
const ROW_ALT = '#F0F6FF';
const CELL_EMPTY = '#FFF0F0';
const TOTAL_BG = '#D4EDDA';
const INCOME_TOTAL_BG = '#C8E6C9';
const EXPENSE_TOTAL_BG = '#FFCDD2';
const SURPLUS_BG = '#FFF3CD';
const BALANCE_BG = '#D1C4E9';
const DANGER = '#C62828';
const SUCCESS = '#1B5E20';
const TEXT_DARK = '#1a1a1a';

const EXPENSE_PALETTE = ['#800070', '#4a90d9', '#ff6b35', '#28a745', '#ffc107', '#dc3545', '#17a2b8', '#6f42c1'];

/** Returns an array of year strings derived from all data sources plus the
 *  current year, sorted descending. This populates the year selector so the
 *  user can pick any year that has data (or the current year). */
function availableYears(
  milkReceived: { date: string }[],
  milkDelivered: { date: string }[],
  incomes: { date: string }[],
  expenses: { date: string }[],
  members: { createdAt?: unknown }[],
): string[] {
  const set = new Set<string>();
  const currentYear = String(new Date().getFullYear());
  set.add(currentYear);
  const extract = (d?: string) => {
    if (d && /^\d{4}/.test(d)) set.add(d.slice(0, 4));
  };
  milkReceived.forEach((r) => extract(r.date));
  milkDelivered.forEach((d) => extract(d.date));
  incomes.forEach((i) => extract(i.date));
  expenses.forEach((e) => extract(e.date));
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

function fmtL(n: number): string {
  if (!n || n === 0) return '';
  return n.toLocaleString('fr-MA', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}
function fmtM(n: number): string {
  if (!n || n === 0) return '—';
  return n.toLocaleString('fr-MA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function currSym(c?: string): string {
  return c === 'MAD' || c === 'درهم' ? 'درهم' : c ?? 'درهم';
}

function HeaderStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white/15 rounded-lg p-3 text-center backdrop-blur-sm">
      <div className="flex items-center justify-center gap-1.5 text-xs opacity-90 mb-1">
        {icon}
        {label}
      </div>
      <div className="font-mono text-lg md:text-xl font-bold">{value}</div>
    </div>
  );
}

interface MemberAnnualRow {
  seq: number;
  memberId: string;
  name: string;
  /** liters per month 0..11 */
  monthlyLiters: number[];
  /** attendance present-day count per month */
  monthlyDays: number[];
  /** notes per month */
  monthlyNotes: (string | undefined)[];
  totalLiters: number;
  totalDays: number;
}

interface MonthSummary {
  monthKey: string;
  monthLabel: string;
  income: number;
  expense: number;
  surplus: number;
  litersSold: number;
  litersReceived: number;
  /** running balance after this month */
  balance: number;
}

/** Pre-canned financial line items matching the prompt's summary block. */
interface FinanceLine {
  key: string;
  label: string;
  type: 'income' | 'expense';
  /** monthKey -> amount */
  values: Record<string, number>;
}

export default function Reports() {
  const { settings, loading: settingsLoading } = useSettings();
  const { data: members, loading: membersLoading } = useMembers();
  const { data: milkReceived, loading: mrLoading } = useMilkReceived();
  const { data: milkDelivered, loading: mdLoading } = useMilkDelivered();
  const { data: incomes, loading: incLoading } = useIncomes();
  const { data: expenses, loading: expLoading } = useExpenses();
  const { data: prices, loading: pricesLoading } = usePrices();
  const { data: transporters, loading: trLoading } = useTransporters();

  const loading =
    settingsLoading ||
    membersLoading ||
    mrLoading ||
    mdLoading ||
    incLoading ||
    expLoading ||
    pricesLoading ||
    trLoading;

  // ── Year selection ──────────────────────────────────────────────────────
  // Default to the current year; the user can switch to any other year.
  const currentYearStr = String(new Date().getFullYear());
  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);

  // Build the list of selectable years from all data + current year.
  const years = useMemo(
    () =>
      availableYears(
        milkReceived ?? [],
        milkDelivered ?? [],
        incomes ?? [],
        expenses ?? [],
        members ?? [],
      ),
    [milkReceived, milkDelivered, incomes, expenses, members],
  );

  // MONTH_KEYS are derived from the selected year (e.g. YYYY-01 … YYYY-12)
  const MONTH_KEYS = useMemo(
    () => MONTH_NAMES_AR.map((_, i) => `${selectedYear}-${String(i + 1).padStart(2, '0')}`),
    [selectedYear],
  );

  // Filters
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState<string>('all'); // 'all' or {year}-MM
  const [sortKey, setSortKey] = useState<'seq' | 'name' | 'total'>('seq');

  // Reset month filter whenever the year changes (avoid stale month keys).
  const yearPrefix = `${selectedYear}-`;

  // ── Annual member rows (for selected year) ──────────────────────────────
  const memberRows: MemberAnnualRow[] = useMemo(() => {
    if (!members) return [];
    return members
      .map((m, idx) => {
        const monthlyLiters = new Array(12).fill(0) as number[];
        const monthlyDays = new Array(12).fill(0) as number[];
        const monthlyNotes = new Array(12).fill(undefined) as (string | undefined)[];
        (milkReceived ?? [])
          .filter((r) => r.memberId === m.id && r.date.startsWith(yearPrefix))
          .forEach((r) => {
            const mi = parseInt(r.date.slice(5, 7), 10) - 1;
            if (mi < 0 || mi > 11) return;
            monthlyLiters[mi] += r.quantityLiters;
            monthlyDays[mi] += 1;
            if (r.notes && !monthlyNotes[mi]) monthlyNotes[mi] = r.notes;
          });
        const totalLiters = monthlyLiters.reduce((a, b) => a + b, 0);
        const totalDays = monthlyDays.reduce((a, b) => a + b, 0);
        return {
          seq: idx + 1,
          memberId: m.id,
          name: m.fullName,
          monthlyLiters,
          monthlyDays,
          monthlyNotes,
          totalLiters,
          totalDays,
        };
      })
      .sort((a, b) => a.seq - b.seq);
  }, [members, milkReceived, yearPrefix]);

  // ── Month summaries (income / expense / surplus / balance) ──────────────
  const monthSummaries: MonthSummary[] = useMemo(() => {
    const arr: MonthSummary[] = MONTH_KEYS.map((mk) => {
      const inc = (incomes ?? [])
        .filter((i) => monthKey(i.date) === mk)
        .reduce((s, i) => s + (Number(i.amount) || 0), 0);
      const exp = (expenses ?? [])
        .filter((e) => monthKey(e.date) === mk)
        .reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const litersSold = (milkDelivered ?? [])
        .filter((d) => monthKey(d.date) === mk)
        .reduce((s, d) => s + d.quantityLiters, 0);
      const litersReceived = (milkReceived ?? [])
        .filter((r) => monthKey(r.date) === mk)
        .reduce((s, r) => s + r.quantityLiters, 0);
      return {
        monthKey: mk,
        monthLabel: monthLabelAr(mk),
        income: inc,
        expense: exp,
        surplus: inc - exp,
        litersSold,
        litersReceived,
        balance: 0,
      };
    });
    let running = 0;
    arr.forEach((m) => {
      running += m.surplus;
      m.balance = running;
    });
    return arr;
  }, [incomes, expenses, milkDelivered, milkReceived, MONTH_KEYS]);

  // ── Financial summary lines (canned categories) ─────────────────────────
  const financeLines: FinanceLine[] = useMemo(() => {
    const lines: FinanceLine[] = [
      { key: 'sell15_1', label: 'بيع الحليب 15/1', type: 'income', values: {} },
      { key: 'sell15_2', label: 'بيع الحليب 15/2', type: 'income', values: {} },
      { key: 'bad_milk', label: 'حليب غير صالح', type: 'income', values: {} },
      { key: 'buy15_1', label: 'شراء الحليب 15/1', type: 'expense', values: {} },
      { key: 'buy15_2', label: 'شراء الحليب 15/2', type: 'expense', values: {} },
      { key: 'labor', label: 'اليد العاملة', type: 'expense', values: {} },
      { key: 'electricity', label: 'الكهرباء', type: 'expense', values: {} },
      { key: 'transport_mustapha', label: 'نقل مصطفى', type: 'expense', values: {} },
      { key: 'camion_coop', label: 'تعاونية الكامون', type: 'expense', values: {} },
    ];

    // Map income/expense records to categories by label keywords.
    const classify = (label: string): string | null => {
      const l = label.toLowerCase();
      if (/بيع|vente|sale|sell/.test(label)) {
        if (/15\/2|15-2|15 2|partie 2|2\/2|الحصة 2|الثانية/.test(label)) return 'sell15_2';
        return 'sell15_1';
      }
      if (/غير صالح|non conforme|spoil|rebut|pert/.test(label)) return 'bad_milk';
      if (/شراء|achat|buy|purchase/.test(label)) {
        if (/15\/2|15-2|15 2|partie 2|2\/2|الحصة 2|الثانية/.test(label)) return 'buy15_2';
        return 'buy15_1';
      }
      if (/يد عاملة|main d|labour|labor|salaire|أجور|رواتب/.test(label)) return 'labor';
      if (/كهرباء|électricité|electric|électric/.test(label)) return 'electricity';
      if (/مصطفى|mustapha|mustafa/.test(label)) return 'transport_mustapha';
      if (/كامون|camion|transport|نقل/.test(label)) return 'camion_coop';
      return null;
    };

    (incomes ?? []).forEach((i) => {
      const cat = classify(i.label || '');
      if (!cat) return;
      const mk = monthKey(i.date);
      if (!mk.startsWith(yearPrefix)) return;
      const line = lines.find((l) => l.key === cat);
      if (line) line.values[mk] = (line.values[mk] || 0) + (Number(i.amount) || 0);
    });
    (expenses ?? []).forEach((e) => {
      const cat = classify(e.label || '');
      if (!cat) return;
      const mk = monthKey(e.date);
      if (!mk.startsWith(yearPrefix)) return;
      const line = lines.find((l) => l.key === cat);
      if (line) line.values[mk] = (line.values[mk] || 0) + (Number(e.amount) || 0);
    });

    // Fallback: derive milk buy/sell from milk_received / milk_delivered when
    // no matching income/expense records exist, using configured prices.
    const purchasePrice = settings.milkPurchasePrice ?? 4.2;
    const sellPrice = settings.milkSellPrice ?? 4.5;
    MONTH_KEYS.forEach((mk) => {
      const buyLine = lines.find((l) => l.key === 'buy15_1');
      const sellLine = lines.find((l) => l.key === 'sell15_1');
      if (buyLine && buyLine.values[mk] === undefined) {
        const liters = (milkReceived ?? [])
          .filter((r) => monthKey(r.date) === mk)
          .reduce((s, r) => s + r.quantityLiters, 0);
        if (liters > 0) buyLine.values[mk] = +(liters * purchasePrice).toFixed(1);
      }
      if (sellLine && sellLine.values[mk] === undefined) {
        const liters = (milkDelivered ?? [])
          .filter((d) => monthKey(d.date) === mk)
          .reduce((s, d) => s + d.quantityLiters, 0);
        if (liters > 0) sellLine.values[mk] = +(liters * sellPrice).toFixed(1);
      }
    });

    return lines;
  }, [incomes, expenses, milkReceived, milkDelivered, settings, MONTH_KEYS, yearPrefix]);

  // ── Aggregated totals ───────────────────────────────────────────────────
  const totalLitersYear = memberRows.reduce((s, r) => s + r.totalLiters, 0);
  const yearPrice = priceForMonth(prices ?? [], `${selectedYear}-01`) || settings.milkPurchasePrice || 4.2;
  const totalIncome = monthSummaries.reduce((s, m) => s + m.income, 0);
  const totalExpense = monthSummaries.reduce((s, m) => s + m.expense, 0);
  const totalSurplus = totalIncome - totalExpense;
  const finalBalance = monthSummaries.length ? monthSummaries[monthSummaries.length - 1].balance : 0;
  const activeMembers = memberRows.filter((r) => r.totalLiters > 0).length;

  // ── Filtered + sorted rows for display ──────────────────────────────────
  const filteredRows = useMemo(() => {
    let rows = memberRows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    }
    if (monthFilter !== 'all') {
      const mi = parseInt(monthFilter.slice(5, 7), 10) - 1;
      rows = rows.filter((r) => r.monthlyLiters[mi] > 0);
    }
    const sorted = [...rows];
    if (sortKey === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    else if (sortKey === 'total') sorted.sort((a, b) => b.totalLiters - a.totalLiters);
    else sorted.sort((a, b) => a.seq - b.seq);
    return sorted;
  }, [memberRows, search, monthFilter, sortKey]);

  // ── Chart data ──────────────────────────────────────────────────────────
  const productionChartData = MONTH_NAMES_AR_SHORT.map((label, i) => ({
    name: label,
    'الإنتاج (لتر)': monthSummaries[i]?.litersReceived || 0,
  }));

  const incomeExpenseChartData = MONTH_NAMES_AR_SHORT.map((label, i) => ({
    name: label,
    'الدخل': +(monthSummaries[i]?.income || 0).toFixed(1),
    'المصاريف': +(monthSummaries[i]?.expense || 0).toFixed(1),
  }));

  const expensePieData = financeLines
    .filter((l) => l.type === 'expense')
    .map((l) => ({
      name: l.label,
      value: Object.values(l.values).reduce((a, b) => a + (b || 0), 0),
    }))
    .filter((d) => d.value > 0);

  // ── Export handlers ─────────────────────────────────────────────────────
  const handleExportPdf = () => {
    const columns = [
      { header: '#', key: 'seq' },
      { header: 'الاسم الكامل', key: 'name' },
      ...MONTH_NAMES_AR_SHORT.map((m, i) => ({ header: m, key: `m${i}` })),
      { header: 'المجموع (لتر)', key: 'total' },
    ];
    const rows = filteredRows.map((r) => {
      const o: Record<string, string | number> = { seq: r.seq, name: r.name, total: fmtL(r.totalLiters) };
      r.monthlyLiters.forEach((v, i) => (o[`m${i}`] = fmtL(v)));
      return o;
    });
    exportToPdf(`تقرير تعاونية ${settings.coopName || 'كوب بوعلا'} — ${selectedYear}`, columns, rows, `report-${selectedYear}`);
  };

  const handleExportExcel = async () => {
    const columns = [
      { header: '#', key: 'seq' },
      { header: 'الاسم الكامل', key: 'name' },
      ...MONTH_NAMES_AR_SHORT.map((m, i) => ({ header: m, key: `m${i}` })),
      { header: 'المجموع (لتر)', key: 'total' },
    ];
    const rows = filteredRows.map((r) => {
      const o: Record<string, string | number> = { seq: r.seq, name: r.name, total: r.totalLiters };
      r.monthlyLiters.forEach((v, i) => (o[`m${i}`] = v));
      return o;
    });
    await exportToExcel(`تقرير ${selectedYear}`, columns, rows, `report-${selectedYear}`);
  };

  const handleWhatsApp = () => {
    const msg =
      `📊 تقرير تعاونية ${settings.coopName || 'كوب بوعلا'} — ${selectedYear}\n` +
      `الجماعة: بني زروال\n` +
      `عدد الأعضاء النشطين: ${activeMembers}\n` +
      `مجموع اللترات: ${fmtL(totalLitersYear)} لتر\n` +
      `ثمن اللتر: ${fmtM(yearPrice)} ${currSym(settings.currency)}\n\n` +
      `💰 الملخص المالي:\n` +
      `الدخل: ${fmtM(totalIncome)} ${currSym(settings.currency)}\n` +
      `المصاريف: ${fmtM(totalExpense)} ${currSym(settings.currency)}\n` +
      `الفائض: ${fmtM(totalSurplus)} ${currSym(settings.currency)}\n` +
      `الرصيد الإجمالي: ${fmtM(finalBalance)} ${currSym(settings.currency)}`;
    shareOnWhatsApp(msg);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          className="rounded-2xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${PURPLE} 0%, ${PURPLE_DARK} 100%)` }}
        >
          <div className="relative z-10 text-center">
            <h1 className="text-2xl md:text-3xl font-black mb-2">
              📊 {settings.coopName || 'تعاونية كوب بوعلا'}
            </h1>
            <p className="opacity-90 text-sm md:text-base">جماعة بني زروال — التقرير السنوي {selectedYear}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
              <HeaderStat label="مجموع اللترات" value={`${fmtL(totalLitersYear)} لتر`} icon={<Droplets className="h-4 w-4" />} />
              <HeaderStat label="ثمن اللتر" value={`${fmtM(yearPrice)} ${currSym(settings.currency)}`} icon={<Wallet className="h-4 w-4" />} />
              <HeaderStat label="الأعضاء النشطون" value={`${activeMembers}`} icon={<Filter className="h-4 w-4" />} />
              <HeaderStat
                label="الرصيد الإجمالي"
                value={`${fmtM(finalBalance)} ${currSym(settings.currency)}`}
                icon={finalBalance >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              />
            </div>
          </div>
        </div>

        {/* ── Year selector + Export bar ─────────────────────────────────── */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-3 bg-card border border-border rounded-lg p-1 pl-3">
            <Calendar className="h-5 w-5 text-primary" />
            <Label className="text-sm font-medium whitespace-nowrap">السنة:</Label>
            <Select value={selectedYear} onValueChange={(v) => { setSelectedYear(v); setMonthFilter('all'); }}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Button variant="outline" onClick={printPage} className="gap-2">
              <Printer className="h-4 w-4" /> طباعة
            </Button>
            <Button variant="outline" onClick={handleExportPdf} className="gap-2">
              <FileText className="h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" onClick={handleExportExcel} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
            <Button onClick={handleWhatsApp} className="gap-2">
              <Send className="h-4 w-4" /> واتساب
            </Button>
          </div>
        </div>
        {/* ── Tabbed sections ── */}
        <Tabs defaultValue="data" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-2">
            <TabsTrigger value="data" className="gap-1.5">
              <Users className="h-4 w-4" /> البيانات والفلاتر
            </TabsTrigger>
            <TabsTrigger value="charts" className="gap-1.5">
              <BarChart3 className="h-4 w-4" /> الرسوم البيانية
            </TabsTrigger>
            <TabsTrigger value="finance" className="gap-1.5">
              <Wallet className="h-4 w-4" /> الملخص المالي
            </TabsTrigger>
          </TabsList>

          <TabsContent value="data" className="space-y-6 mt-2 focus-visible:outline-none">

        {/* ── Filters ────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-5 w-5" /> الفلاتر
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">بحث في الأسماء</Label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ابحث باسم العضو..."
                    className="pr-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">فلترة حسب الشهر</Label>
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأشهر</SelectItem>
                    {MONTH_NAMES_AR.map((m, i) => (
                      <SelectItem key={i} value={`${selectedYear}-${String(i + 1).padStart(2, '0')}`}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">ترتيب حسب</Label>
                <Select value={sortKey} onValueChange={(v) => setSortKey(v as typeof sortKey)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seq">التسلسل</SelectItem>
                    <SelectItem value="name">الاسم</SelectItem>
                    <SelectItem value="total">إجمالي اللترات</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Main data grid ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5" /> سجل الأعضاء والإنتاج الشهري {selectedYear}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow style={{ background: PURPLE }}>
                    <TableHead className="text-white sticky right-0 z-20 min-w-[50px] text-center" style={{ background: PURPLE }}>
                      #
                    </TableHead>
                    <TableHead className="text-white sticky right-[50px] z-20 min-w-[180px]" style={{ background: PURPLE }}>
                      الاسم الكامل
                    </TableHead>
                    {MONTH_NAMES_AR_SHORT.map((m) => (
                      <TableHead key={m} className="text-white text-center min-w-[70px]">
                        {m}
                      </TableHead>
                    ))}
                    <TableHead className="text-white text-center min-w-[90px]">المجموع (لتر)</TableHead>
                    <TableHead className="text-white text-center min-w-[70px]">أيام الحضور</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={15} className="text-center py-8 text-muted-foreground">
                        لا توجد بيانات لسنة {selectedYear}. ابدأ بتسجيل استلام الحليب من صفحة «الحليب».
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((r, ri) => (
                      <TableRow
                        key={r.memberId}
                        style={{ background: ri % 2 === 1 ? ROW_ALT : undefined }}
                      >
                        <TableCell className="font-mono text-center sticky right-0 z-10" style={{ background: ri % 2 === 1 ? ROW_ALT : 'inherit' }}>
                          {r.seq}
                        </TableCell>
                        <TableCell className="font-medium sticky right-[50px] z-10" style={{ background: ri % 2 === 1 ? ROW_ALT : 'inherit' }}>
                          {r.name}
                        </TableCell>
                        {r.monthlyLiters.map((v, i) => (
                          <TableCell
                            key={i}
                            className="font-mono text-center"
                            style={{ background: v === 0 ? CELL_EMPTY : undefined }}
                          >
                            {v === 0 ? (
                              <span style={{ color: '#999' }}>—</span>
                            ) : (
                              <span style={{ color: TEXT_DARK }}>{fmtL(v)}</span>
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="font-mono text-center font-semibold" style={{ background: TOTAL_BG, color: TEXT_DARK }}>
                          {fmtL(r.totalLiters)}
                        </TableCell>
                        <TableCell className="font-mono text-center">{r.totalDays}</TableCell>
                      </TableRow>
                    ))
                  )}
                  {/* Footer totals row */}
                  {filteredRows.length > 0 && (
                    <TableRow style={{ background: TOTAL_BG, fontWeight: 700 }}>
                      <TableCell className="font-bold text-center sticky right-0 z-10" style={{ background: TOTAL_BG, color: TEXT_DARK }}>
                        —
                      </TableCell>
                      <TableCell className="font-bold sticky right-[50px] z-10" style={{ background: TOTAL_BG, color: TEXT_DARK }}>
                        المجموع الكلي
                      </TableCell>
                      {MONTH_KEYS.map((mk, i) => {
                        const monthTotal = (milkReceived ?? [])
                          .filter((r) => monthKey(r.date) === mk)
                          .reduce((s, r) => s + r.quantityLiters, 0);
                        return (
                          <TableCell key={i} className="font-mono text-center font-bold" style={{ color: TEXT_DARK }}>
                            {fmtL(monthTotal)}
                          </TableCell>
                        );
                      })}
                      <TableCell className="font-mono text-center font-bold" style={{ color: TEXT_DARK }}>{fmtL(totalLitersYear)}</TableCell>
                      <TableCell className="font-mono text-center font-bold" style={{ color: TEXT_DARK }}>
                        {filteredRows.reduce((s, r) => s + r.totalDays, 0)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground p-3">
              الخلايا الفارغة (باللون الأحمر الفاتح) تعني عدم تسجيل استلام في ذلك الشهر.
            </p>
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="charts" className="space-y-6 mt-2 focus-visible:outline-none">

        {/* ── Charts ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">📈 الإنتاج الشهري للحليب (لتر)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={productionChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RTooltip />
                    <Line
                      type="monotone"
                      dataKey="الإنتاج (لتر)"
                      stroke={PURPLE}
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">📊 مقارنة الدخل والمصاريف الشهرية</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={incomeExpenseChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RTooltip />
                    <Legend />
                    <Bar dataKey="الدخل" fill={SUCCESS} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="المصاريف" fill={DANGER} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {expensePieData.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">🥧 توزيع المصاريف حسب الفئة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expensePieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={(e) => `${e.name}: ${fmtM(e.value)}`}
                      >
                        {expensePieData.map((_, i) => (
                          <Cell key={i} fill={EXPENSE_PALETTE[i % EXPENSE_PALETTE.length]} />
                        ))}
                      </Pie>
                      <RTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        </TabsContent>

        <TabsContent value="finance" className="space-y-6 mt-2 focus-visible:outline-none">

        {/* ── Financial summary block ────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wallet className="h-5 w-5" /> الملخص المالي السنوي {selectedYear}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow style={{ background: PURPLE }}>
                    <TableHead className="text-white sticky right-0 z-20" style={{ background: PURPLE }}>البيان</TableHead>
                    {MONTH_NAMES_AR_SHORT.map((m) => (
                      <TableHead key={m} className="text-white text-center min-w-[80px]">{m}</TableHead>
                    ))}
                    <TableHead className="text-white text-center min-w-[100px]">المجموع</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {financeLines.map((line, li) => {
                    const lineTotal = Object.values(line.values).reduce((a, b) => a + (b || 0), 0);
                    return (
                      <TableRow key={line.key} style={{ background: li % 2 === 1 ? ROW_ALT : undefined }}>
                        <TableCell className="font-medium sticky right-0 z-10" style={{ background: li % 2 === 1 ? ROW_ALT : 'inherit' }}>
                          <span className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={line.type === 'income' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}
                            >
                              {line.type === 'income' ? 'دخل' : 'مصروف'}
                            </Badge>
                            {line.label}
                          </span>
                        </TableCell>
                        {MONTH_KEYS.map((mk) => {
                          const v = line.values[mk] || 0;
                          return (
                            <TableCell
                              key={mk}
                              className="font-mono text-center"
                              style={{ background: v === 0 ? CELL_EMPTY : undefined, color: v === 0 ? '#aaa' : TEXT_DARK }}
                            >
                              {v === 0 ? '—' : fmtM(v)}
                            </TableCell>
                          );
                        })}
                        <TableCell className="font-mono text-center font-semibold" style={{ background: TOTAL_BG, color: TEXT_DARK }}>
                          {fmtM(lineTotal)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Income totals row */}
                  <TableRow style={{ background: INCOME_TOTAL_BG, fontWeight: 800 }}>
                    <TableCell className="font-bold sticky right-0 z-10" style={{ background: INCOME_TOTAL_BG, color: TEXT_DARK }}>مجموع الدخل</TableCell>
                    {monthSummaries.map((m) => (
                      <TableCell key={m.monthKey} className="font-mono text-center font-bold" style={{ background: INCOME_TOTAL_BG, color: SUCCESS }}>
                        {fmtM(m.income)}
                      </TableCell>
                    ))}
                    <TableCell className="font-mono text-center font-bold" style={{ background: INCOME_TOTAL_BG, color: SUCCESS }}>
                      {fmtM(totalIncome)}
                    </TableCell>
                  </TableRow>
                  {/* Expense totals row */}
                  <TableRow style={{ background: EXPENSE_TOTAL_BG, fontWeight: 800 }}>
                    <TableCell className="font-bold sticky right-0 z-10" style={{ background: EXPENSE_TOTAL_BG, color: TEXT_DARK }}>مجموع المصاريف</TableCell>
                    {monthSummaries.map((m) => (
                      <TableCell key={m.monthKey} className="font-mono text-center font-bold" style={{ background: EXPENSE_TOTAL_BG, color: DANGER }}>
                        {fmtM(m.expense)}
                      </TableCell>
                    ))}
                    <TableCell className="font-mono text-center font-bold" style={{ background: EXPENSE_TOTAL_BG, color: DANGER }}>
                      {fmtM(totalExpense)}
                    </TableCell>
                  </TableRow>
                  {/* Surplus row */}
                  <TableRow style={{ background: SURPLUS_BG, fontWeight: 800 }}>
                    <TableCell className="font-bold sticky right-0 z-10" style={{ background: SURPLUS_BG, color: TEXT_DARK }}>الفائض</TableCell>
                    {monthSummaries.map((m) => (
                      <TableCell
                        key={m.monthKey}
                        className="font-mono text-center font-bold"
                        style={{ color: m.surplus >= 0 ? SUCCESS : DANGER, background: SURPLUS_BG }}
                      >
                        {fmtM(m.surplus)}
                      </TableCell>
                    ))}
                    <TableCell
                      className="font-mono text-center font-bold"
                      style={{ color: totalSurplus >= 0 ? SUCCESS : DANGER, background: SURPLUS_BG }}
                    >
                      {fmtM(totalSurplus)}
                    </TableCell>
                  </TableRow>
                  {/* Running balance row */}
                  <TableRow style={{ background: BALANCE_BG, fontWeight: 800 }}>
                    <TableCell className="font-bold sticky right-0 z-10" style={{ background: BALANCE_BG, color: TEXT_DARK }}>الرصيد الإجمالي</TableCell>
                    {monthSummaries.map((m) => (
                      <TableCell
                        key={m.monthKey}
                        className="font-mono text-center font-bold"
                        style={{ color: m.balance >= 0 ? SUCCESS : DANGER, background: BALANCE_BG }}
                      >
                        {fmtM(m.balance)}
                      </TableCell>
                    ))}
                    <TableCell
                      className="font-mono text-center font-bold"
                      style={{ color: finalBalance >= 0 ? SUCCESS : DANGER, background: BALANCE_BG }}
                    >
                      {fmtM(finalBalance)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        </TabsContent>
        </Tabs>

        {/* ── Footer note ────────────────────────────────────────────────── */}
        <div className="text-center py-4 text-sm text-muted-foreground">
          <p>تم إنشاء هذا التقرير خصيصاً لتعاونية {settings.coopName || 'كوب بوعلا'} — جماعة بني زروال</p>
          <p className="mt-1">📅 السنة المالية: {selectedYear} | 👥 عدد الأعضاء النشطين: {activeMembers}</p>
        </div>
      </div>
    </Layout>
  );
}
