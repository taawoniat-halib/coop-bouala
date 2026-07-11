import { Layout } from '@/components/Layout';
import { useMilkReceived, useIncomes, useExpenses, useMembers, useTransporters } from '@/hooks/useData';
import { computeDashboardSummary } from '@/lib/calculations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Droplets, Users, Truck, ArrowUpRight, ArrowDownRight, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { useSettings } from '@/hooks/useSettings';

export default function Dashboard() {
  const { data: receipts, loading: l1 } = useMilkReceived();
  const { data: incomes, loading: l2 } = useIncomes();
  const { data: expenses, loading: l3 } = useExpenses();
  const { data: members, loading: l4 } = useMembers();
  const { data: transporters, loading: l5 } = useTransporters();
  const { settings } = useSettings();

  const loading = l1 || l2 || l3 || l4 || l5;

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
  const summary = computeDashboardSummary(receipts, incomes, expenses, members, transporters, today);
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
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${stat.bgColor}`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono tracking-tight" dir="ltr">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </Layout>
  );
}
