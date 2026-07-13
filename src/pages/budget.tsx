import { Layout } from '@/components/Layout';
import { useIncomes, useExpenses } from '@/hooks/useData';
import { useSettings } from '@/hooks/useSettings';
import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowUpRight, ArrowDownRight, Plus, Trash2, Calculator, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { monthKey } from '@/lib/calculations';

export default function Budget() {
  const { data: incomes, add: addIncome, remove: removeIncome } = useIncomes();
  const { data: expenses, add: addExpense, remove: removeExpense } = useExpenses();
  const { settings } = useSettings();
  const { toast } = useToast();

  const [monthFilter, setMonthFilter] = useState(monthKey(format(new Date(), 'yyyy-MM-dd')));
  const [isIncomeDialogOpen, setIsIncomeDialogOpen] = useState(false);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);

  const currency = settings?.currency === 'MAD' ? 'درهم' : settings?.currency;

  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    label: '',
    amount: '',
    category: '',
    notes: '',
  });

  const filteredIncomes = useMemo(
    () => incomes.filter((i) => monthKey(i.date) === monthFilter),
    [incomes, monthFilter],
  );
  const filteredExpenses = useMemo(
    () => expenses.filter((e) => monthKey(e.date) === monthFilter),
    [expenses, monthFilter],
  );

  const totalIncome = filteredIncomes.reduce((s, i) => s + i.amount, 0);
  const totalExpense = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const balance = totalIncome - totalExpense;

  const handleIncomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addIncome({
        date: form.date,
        label: form.label,
        amount: Number(form.amount),
        category: form.category,
        notes: form.notes,
      });
      toast({ title: 'تم', description: 'تمت إضافة المدخول بنجاح.' });
      setForm({
        date: format(new Date(), 'yyyy-MM-dd'),
        label: '',
        amount: '',
        category: '',
        notes: '',
      });
      setIsIncomeDialogOpen(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: err.message });
    }
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addExpense({
        date: form.date,
        label: form.label,
        amount: Number(form.amount),
        category: form.category,
        notes: form.notes,
      });
      toast({ title: 'تم', description: 'تمت إضافة المصروف بنجاح.' });
      setForm({
        date: format(new Date(), 'yyyy-MM-dd'),
        label: '',
        amount: '',
        category: '',
        notes: '',
      });
      setIsExpenseDialogOpen(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: err.message });
    }
  };

  const allTransactions = [
    ...filteredIncomes.map((i) => ({ ...i, type: 'income' as const })),
    ...filteredExpenses.map((e) => ({ ...e, type: 'expense' as const })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            الميزانية <Calculator className="h-6 w-6 text-muted-foreground" />
          </h2>
          <p className="text-muted-foreground mt-1">إدارة المداخيل والمصاريف للتعاونية</p>
        </div>
        <div className="flex items-center gap-3 bg-card border border-border p-1 rounded-md">
          <Calendar className="h-4 w-4 text-muted-foreground ml-2" />
          <Input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="border-0 bg-transparent h-8 w-auto focus-visible:ring-0"
            dir="ltr"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col justify-center">
          <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-emerald-500" /> إجمالي المداخيل
          </div>
          <div className="text-3xl font-bold font-mono text-emerald-600" dir="ltr">
            {totalIncome.toLocaleString()} {currency}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col justify-center">
          <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
            <ArrowDownRight className="h-4 w-4 text-destructive" /> إجمالي المصاريف
          </div>
          <div className="text-3xl font-bold font-mono text-destructive" dir="ltr">
            {totalExpense.toLocaleString()} {currency}
          </div>
        </div>
        <div
          className={`rounded-xl border p-6 shadow-sm flex flex-col justify-center ${balance >= 0 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-destructive/30 bg-destructive/5'}`}
        >
          <div className="text-sm font-medium text-muted-foreground mb-2">
            الرصيد الصافي (للشهر)
          </div>
          <div
            className={`text-3xl font-bold font-mono ${balance >= 0 ? 'text-emerald-600' : 'text-destructive'}`}
            dir="ltr"
          >
            {balance > 0 ? '+' : ''}
            {balance.toLocaleString()} {currency}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
        <h3 className="text-base font-semibold">سجل العمليات</h3>

        <div className="flex gap-2">
          <Dialog open={isIncomeDialogOpen} onOpenChange={setIsIncomeDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                <Plus className="h-4 w-4" /> مدخول جديد
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إضافة مدخول</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleIncomeSubmit} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>التاريخ</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>البيان / الوصف</Label>
                  <Input
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>المبلغ ({currency})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    dir="ltr"
                    className="text-right"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">
                  حفظ المدخول
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <Plus className="h-4 w-4" /> مصروف جديد
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إضافة مصروف</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleExpenseSubmit} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>التاريخ</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>البيان / الوصف</Label>
                  <Input
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>المبلغ ({currency})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    dir="ltr"
                    className="text-right"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" variant="destructive" className="w-full">
                  حفظ المصروف
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>التاريخ</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>البيان</TableHead>
              <TableHead>المبلغ</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  لا توجد عمليات في هذا الشهر
                </TableCell>
              </TableRow>
            ) : (
              allTransactions.map((tx) => (
                <TableRow key={tx.id} className="group">
                  <TableCell className="font-mono text-sm">
                    {format(new Date(tx.date), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>
                    {tx.type === 'income' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded text-xs">
                        <ArrowUpRight className="h-3 w-3" /> مدخول
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-destructive bg-destructive/10 px-2 py-0.5 rounded text-xs">
                        <ArrowDownRight className="h-3 w-3" /> مصروف
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{tx.label}</TableCell>
                  <TableCell
                    className={`font-mono font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-destructive'}`}
                  >
                    {tx.type === 'income' ? '+' : '-'}
                    {tx.amount.toLocaleString()} {currency}
                  </TableCell>
                  <TableCell className="text-left">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        tx.type === 'income' ? removeIncome(tx.id) : removeExpense(tx.id)
                      }
                      className="h-8 w-8 hover:bg-destructive/10 text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Layout>
  );
}
