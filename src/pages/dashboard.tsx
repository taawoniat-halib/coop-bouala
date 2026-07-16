import { Layout } from '@/components/Layout';
import {
  useMilkReceived,
  useMilkDelivered,
  useIncomes,
  useExpenses,
  useMembers,
  useTransporters,
  usePrices,
} from '@/hooks/useData';
import { computeDashboardSummary, monthKey, monthShortLabel } from '@/lib/calculations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Droplets,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  BadgeDollarSign,
  Scale,
  LayoutDashboard,
  BarChart3,
  Trophy,
} from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { useSettings } from '@/hooks/useSettings';
import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

export default function Dashboard() {
  const { data: receipts,   loading: l1 } = useMilkReceived();
  const { data: deliveries, loading: l2 } = useMilkDelivered();
  const { data: incomes,    loading: l3 } = useIncomes();
  const { data: expenses,   loading: l4 } = useExpenses();
  const { data: members,    loading: l5 } = useMembers();
  const { data: transporters, loading: l6 } = useTransporters();
  const { data: prices } = usePrices();
  const { settings } = useSettings();

  const loading = l1 || l2 || l3 || l4 || l5 || l6;

  const today = format(new Date(), 'yyyy-MM-dd');
  const currentMonth = monthKey(today);
  const currency = settings?.currency === 'MAD' ? 'درهم' : (settings?.currency ?? 'درهم');

  // ── Monthly stock & profit ────────────────────────────────────────────────
  const monthlyStock = useMemo(() => {
    const received = receipts
      .filter(r => monthKey(r.date) === currentMonth)
      .reduce((s, r) => s + r.quantityLiters, 0);
    const delivered = deliveries
      .filter(d => monthKey(d.date) === currentMonth)
      .reduce((s, d) => s + d.quantityLiters, 0);
    return { received, delivered, remaining: received - delivered };
  }, [receipts, deliveries, currentMonth]);

  const monthlyFinance = useMemo(() => {
    const revenue = deliveries
      .filter(d => monthKey(d.date) === currentMonth)
      .reduce((s, d) => s + d.quantityLiters * d.pricePerLiter, 0);

    const monthPrice = prices.find(p => p.month === currentMonth)?.pricePerLiter ?? 0;
    const farmerCost = receipts
      .filter(r => monthKey(r.date) === currentMonth)
      .reduce((s, r) => s + r.quantityLiters * (r.pricePerLiter ?? monthPrice), 0);

    const transportCost = receipts
      .filter(r => monthKey(r.date) === currentMonth)
      .reduce((s, r) => s + (r.transportCost ?? 0), 0);

    const otherExpenses = expenses
      .filter(e => monthKey(e.date) === currentMonth)
      .reduce((s, e) => s + e.amount, 0);

    const otherIncome = incomes
      .filter(i => monthKey(i.date) === currentMonth)
      .reduce((s, i) => s + i.amount, 0);

    const totalCosts = farmerCost + transportCost + otherExpenses;
    const totalRevenue = revenue + otherIncome;
    const profit = totalRevenue - totalCosts;

    return { revenue, farmerCost, transportCost, otherExpenses, otherIncome, totalCosts, totalRevenue, profit };
  }, [receipts, deliveries, incomes, expenses, prices, currentMonth]);

  // ── Trends: last 6 months ─────────────────────────────────────────────────
  const trendData = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) months.push(format(subMonths(now, i), 'yyyy-MM'));
    return months.map(month => {
      const liters = receipts.filter(r => monthKey(r.date) === month).reduce((s,r)=>s+r.quantityLiters,0);
      const income = incomes.filter(i => monthKey(i.date) === month).reduce((s,i)=>s+i.amount,0);
      const expense = expenses.filter(e => monthKey(e.date) === month).reduce((s,e)=>s+e.amount,0);
      return { month, label: monthShortLabel(month), liters, income, expense };
    });
  }, [receipts, incomes, expenses]);

  // ── Top farmers this month ────────────────────────────────────────────────
  const topFarmers = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of receipts) {
      if (monthKey(r.date) !== currentMonth) continue;
      totals.set(r.memberId, (totals.get(r.memberId) ?? 0) + r.quantityLiters);
    }
    const memberById = new Map(members.map(m => [m.id, m]));
    return Array.from(totals.entries())
      .map(([id, liters]) => ({ name: memberById.get(id)?.fullName ?? '—', liters }))
      .sort((a, b) => b.liters - a.liters)
      .slice(0, 5);
  }, [receipts, members, currentMonth]);

  if (loading) {
    return (
      <Layout>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4,5,6].map(i => (
            <Card key={i} className="animate-pulse"><CardHeader className="h-24 bg-muted/50" /></Card>
          ))}
        </div>
      </Layout>
    );
  }

  const summary = computeDashboardSummary(receipts, incomes, expenses, members, transporters, today);

  return (
    <Layout>
      {/* ── Header ── */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight">لوحة القيادة</h2>
        <p className="text-muted-foreground mt-1">{format(new Date(), 'EEEE، dd/MM/yyyy')} — شهر {currentMonth}</p>
      </div>

      {/* ── Tabs: progressive disclosure ── */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="overview" className="gap-1.5 py-2.5 text-xs sm:text-sm">
            <LayoutDashboard className="h-4 w-4" /> نظرة عامة
          </TabsTrigger>
          <TabsTrigger value="finance" className="gap-1.5 py-2.5 text-xs sm:text-sm">
            <BadgeDollarSign className="h-4 w-4" /> الملخص المالي
          </TabsTrigger>
          <TabsTrigger value="charts" className="gap-1.5 py-2.5 text-xs sm:text-sm">
            <BarChart3 className="h-4 w-4" /> الرسوم والترتيب
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Overview (quick stats + stock) ── */}
        <TabsContent value="overview">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-4">
            <Card className="border-blue-500/20 bg-blue-500/5">
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">حليب اليوم</CardTitle>
                <Droplets className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{summary.todayLiters.toLocaleString('fr-MA')} <span className="text-sm font-normal">لتر</span></p>
              </CardContent>
            </Card>

            <Card className="border-indigo-500/20 bg-indigo-500/5">
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">مستلم هذا الشهر</CardTitle>
                <ArrowDownRight className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{monthlyStock.received.toLocaleString('fr-MA')} <span className="text-sm font-normal">لتر</span></p>
              </CardContent>
            </Card>

            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">مسلَّم للشركات</CardTitle>
                <ArrowUpRight className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{monthlyStock.delivered.toLocaleString('fr-MA')} <span className="text-sm font-normal">لتر</span></p>
              </CardContent>
            </Card>

            <Card className={monthlyStock.remaining >= 0 ? 'border-amber-500/20 bg-amber-500/5' : 'border-destructive/20 bg-destructive/5'}>
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">المخزون المتبقي</CardTitle>
                <Package className={`h-4 w-4 ${monthlyStock.remaining >= 0 ? 'text-amber-500' : 'text-destructive'}`} />
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${monthlyStock.remaining >= 0 ? '' : 'text-destructive'}`}>
                  {monthlyStock.remaining.toLocaleString('fr-MA')} <span className="text-sm font-normal">لتر</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">مستلم − مسلَّم</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
            <Card className="border-primary/20">
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">عدد المنخرطين</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{summary.activeMembers} <span className="text-sm font-normal">منخرط</span></p>
              </CardContent>
            </Card>
            <Card className="border-primary/20">
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">الناقلون</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{summary.activeTransporters} <span className="text-sm font-normal">ناقل</span></p>
              </CardContent>
            </Card>
            <Card className="border-primary/20">
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">حليب السنة</CardTitle>
                <Droplets className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{summary.yearLiters.toLocaleString('fr-MA')} <span className="text-sm font-normal">لتر</span></p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Tab 2: Financial summary ── */}
        <TabsContent value="finance">
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" /> الملخص المالي — شهر {currentMonth}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-lg bg-emerald-500/10 p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">مبيعات الشركات</p>
                  <p className="text-lg font-bold text-emerald-600 font-mono">
                    {monthlyFinance.revenue.toLocaleString('fr-MA',{minimumFractionDigits:2,maximumFractionDigits:2})}
                  </p>
                  <p className="text-xs text-muted-foreground">{currency}</p>
                </div>
                <div className="rounded-lg bg-red-500/10 p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">مستحقات المنخرطين</p>
                  <p className="text-lg font-bold text-red-600 font-mono">
                    {monthlyFinance.farmerCost.toLocaleString('fr-MA',{minimumFractionDigits:2,maximumFractionDigits:2})}
                  </p>
                  <p className="text-xs text-muted-foreground">{currency}</p>
                </div>
                <div className="rounded-lg bg-orange-500/10 p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">مصاريف النقل + أخرى</p>
                  <p className="text-lg font-bold text-orange-600 font-mono">
                    {(monthlyFinance.transportCost + monthlyFinance.otherExpenses).toLocaleString('fr-MA',{minimumFractionDigits:2,maximumFractionDigits:2})}
                  </p>
                  <p className="text-xs text-muted-foreground">{currency}</p>
                </div>
                <div className={`rounded-lg p-3 text-center ${monthlyFinance.profit >= 0 ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                  <p className="text-xs text-muted-foreground mb-1">الربح الصافي</p>
                  <p className={`text-lg font-bold font-mono ${monthlyFinance.profit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {monthlyFinance.profit.toLocaleString('fr-MA',{minimumFractionDigits:2,maximumFractionDigits:2})}
                  </p>
                  <p className="text-xs text-muted-foreground">{currency}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 3: Charts + leaderboard ── */}
        <TabsContent value="charts">
          <div className="grid gap-4 md:grid-cols-3 mb-4">
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">الحليب المستلم — آخر 6 أشهر (لتر)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top:4, right:8, left:-20, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} reversed />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => [`${v.toLocaleString('fr-MA')} لتر`, 'الكمية']} labelFormatter={l=>`شهر ${l}`} contentStyle={{direction:'rtl',fontSize:12}} />
                      <Area type="monotone" dataKey="liters" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-1">
                  <Trophy className="h-4 w-4 text-amber-500" /> أعلى منخرطي هذا الشهر
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topFarmers.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-4">لا توجد بيانات</p>
                ) : (
                  <ul className="space-y-2">
                    {topFarmers.map((f, i) => (
                      <li key={f.name} className="flex items-center gap-2">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-700' : i === 2 ? 'bg-amber-700/30 text-amber-800' : 'bg-muted text-muted-foreground'}`}>
                          {i + 1}
                        </span>
                        <span className="flex-1 truncate text-sm font-medium">{f.name}</span>
                        <span className="font-mono text-sm text-muted-foreground" dir="ltr">{f.liters.toLocaleString('fr-MA')} ل</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">المداخيل مقابل المصاريف — آخر 6 أشهر</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} margin={{ top:4, right:8, left:-16, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} reversed />
                    <YAxis tick={{ fontSize: 11 }} width={48} />
                    <Tooltip
                      formatter={(v: number, name) => [`${v.toLocaleString('fr-MA')} ${currency}`, name === 'income' ? 'المداخيل' : 'المصاريف']}
                      labelFormatter={l=>`شهر ${l}`}
                      contentStyle={{ direction: 'rtl', fontSize: 12 }}
                    />
                    <Legend formatter={v => v === 'income' ? 'المداخيل' : 'المصاريف'} wrapperStyle={{ direction: 'rtl', fontSize: 12 }} />
                    <Bar dataKey="income" fill="#10b981" radius={[4,4,0,0]} />
                    <Bar dataKey="expense" fill="#ef4444" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
