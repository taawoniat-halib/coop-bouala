import { Layout } from '@/components/Layout';
import {
  useMilkReceived,
  useIncomes,
  useExpenses,
  useMembers,
  useTransporters,
} from '@/hooks/useData';
import { computeDashboardSummary, monthKey } from '@/lib/calculations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Droplets,
  Users,
  Truck,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
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

const MONTH_NAMES_AR_SHORT = [
  'ينا',
  'فبر',
  'مار',
  'أبر',
  'ماي',
  'يون',
  'يول',
  'غشت',
  'شتن',
  'أكت',
  'نون',
  'دجن',
];

function shortMonthLabel(month: string) {
  const [, m] = month.split('-');
  return MONTH_NAMES_AR_SHORT[parseInt(m, 10) - 1];
}

export default function Dashboard() {
  const { data: receipts, loading: l1 } = useMilkReceived();
  const { data: incomes, loading: l2 } = useIncomes();
  const { data: expenses, loading: l3 } = useExpenses();
  const { data: members, loading: l4 } = useMembers();
  const { data: transporters, loading: l5 } = useTransporters();
  const { settings } = useSettings();

  const loading = l1 || l2 || l3 || l4 || l5;

  // ── Trends: last 6 months of liters received + income/expense (hooks must
  // run unconditionally, so these are computed before the loading check). ──
  const trendData = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      months.push(format(subMonths(now, i), 'yyyy-MM'));
    }
    return months.map((month) => {
      const liters = receipts
        .filter((r) => monthKey(r.date) === month)
        .reduce((sum, r) => sum + r.quantityLiters, 0);
      const income = incomes
        .filter((i) => monthKey(i.date) === month)
        .reduce((sum, i) => sum + i.amount, 0);
      const expense = expenses
        .filter((e) => monthKey(e.date) === month)
        .reduce((sum, e) => sum + e.amount, 0);
      return { month, label: shortMonthLabel(month), liters, income, expense };
    });
  }, [receipts, incomes, expenses]);

  const topFarmers = useMemo(() => {
    const currentMonth = monthKey(format(new Date(), 'yyyy-MM-dd'));
    const totals = new Map<string, number>();
    for (const r of receipts) {
      if (monthKey(r.date) !== currentMonth) continue;
      totals.set(r.memberId, (totals.get(r.memberId) ?? 0) + r.quantityLiters);
    }
    const memberById = new Map(members.map((m) => [m.id, m]));
    return Array.from(totals.entries())
      .map(([memberId, liters]) => ({ name: memberById.get(memberId)?.fullName ?? '—', liters }))
      .sort((a, b) => b.liters - a.liters)
      .slice(0, 5);
  }, [receipts, members]);

  if (loading) {
    return (
      <Layout>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-muted/50" />
            </Card>
          ))}
        </div>
      </Layout>
    );
  }

  const today = format(new Date(), 'yyyy-MM-dd');
  const summary = computeDashboardSummary(
    receipts,
    incomes,
    expenses,
    members,
    transporters,
    today,
  );
  const currency = settings.currency === 'MAD' ? 'درهم' : settings.currency;

  const statCards = [
    {
      title: 'حليب اليوم',
      value: `${summary.todayLiters.toLocaleString()} لتر`,
      icon: Droplets,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'حليب الشهر',
      value: `${summary.monthLiters.toLocaleString()} لتر`,
      icon: Droplets,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'مداخيل الشهر',
      value: `${summary.monthIncome.toLocaleString()} ${currency}`,
      icon: ArrowUpRight,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      title: 'مصاريف الشهر',
      value: `${summary.monthExpense.toLocaleString()} ${currency}`,
      icon: ArrowDownRight,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
    {
      title: 'الرصيد الشهري',
      value: `${summary.monthBalance.toLocaleString()} ${currency}`,
      icon: DollarSign,
      color: summary.monthBalance >= 0 ? 'text-emerald-500' : 'text-destructive',
      bgColor: summary.monthBalance >= 0 ? 'bg-emerald-500/10' : 'bg-destructive/10',
    },
    {
      title: 'الأعضاء النشطين',
      value: summary.activeMembers.toLocaleString(),
      icon: Users,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: 'الناقلين النشطين',
      value: summary.activeTransporters.toLocaleString(),
      icon: Truck,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
    },
    {
      title: 'حليب السنة',
      value: `${summary.yearLiters.toLocaleString()} لتر`,
      icon: Droplets,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
  ];

  return (
    <Layout>
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight">نظرة عامة</h2>
        <p className="text-muted-foreground mt-1">ملخص نشاط التعاونية لليوم والشهر الحالي.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${stat.bgColor}`}
                >
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono tracking-tight" dir="ltr">
                  {stat.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">اتجاه استلام الحليب — آخر 6 أشهر</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="litersFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} reversed />
                  <YAxis tick={{ fontSize: 12 }} width={48} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toLocaleString()} لتر`, 'الكمية']}
                    labelFormatter={(label) => `شهر ${label}`}
                    contentStyle={{ direction: 'rtl', fontSize: 13 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="liters"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#litersFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-amber-500" />
              أفضل 5 فلاحين هذا الشهر
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topFarmers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                لا توجد بيانات استلام لهذا الشهر بعد.
              </p>
            ) : (
              <ul className="space-y-3">
                {topFarmers.map((f, i) => (
                  <li key={f.name} className="flex items-center gap-3">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        i === 0
                          ? 'bg-amber-500/15 text-amber-600'
                          : i === 1
                            ? 'bg-slate-400/15 text-slate-500'
                            : i === 2
                              ? 'bg-orange-500/15 text-orange-600'
                              : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate text-sm font-medium">{f.name}</span>
                    <span className="font-mono text-sm text-muted-foreground" dir="ltr">
                      {f.liters.toLocaleString()} ل
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">المداخيل مقابل المصاريف — آخر 6 أشهر</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} reversed />
                <YAxis tick={{ fontSize: 12 }} width={48} />
                <Tooltip
                  formatter={(value: number, name) => [
                    `${value.toLocaleString()} ${currency}`,
                    name === 'income' ? 'المداخيل' : 'المصاريف',
                  ]}
                  labelFormatter={(label) => `شهر ${label}`}
                  contentStyle={{ direction: 'rtl', fontSize: 13 }}
                />
                <Legend
                  formatter={(value) => (value === 'income' ? 'المداخيل' : 'المصاريف')}
                  wrapperStyle={{ direction: 'rtl', fontSize: 12 }}
                />
                <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </Layout>
  );
}
