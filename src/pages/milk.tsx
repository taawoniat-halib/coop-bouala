import { Layout } from '@/components/Layout';
import { useMilkReceived, useMilkDelivered, useMembers, usePrices } from '@/hooks/useData';
import { useAuth } from '@/hooks/useAuth';
import { useState, useMemo, useEffect } from 'react';
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
import { Plus, Trash2, ArrowUpRight, ArrowDownRight, Coins, CalendarDays } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/hooks/useSettings';
import { monthKey } from '@/lib/calculations';
import { MilkPrintDialog } from '@/components/MilkPrintDialog';
import { TransportPrintDialog } from '@/components/TransportPrintDialog';

export default function Milk() {
  const { data: receipts, add: addReceipt, remove: removeReceipt } = useMilkReceived();
  const { data: deliveries, add: addDelivery, remove: removeDelivery } = useMilkDelivered();
  const { data: prices, add: addPrice, update: updatePrice } = usePrices();
  const { data: members } = useMembers();
  const { settings } = useSettings();
  const { appUser } = useAuth();
  const { toast } = useToast();

  const today = format(new Date(), 'yyyy-MM-dd');
  const [activeTab, setActiveTab] = useState('received');
  const [dateFilter, setDateFilter] = useState(today);
  const currency = settings?.currency === 'MAD' ? 'درهم' : settings?.currency;

  const [receiptForm, setReceiptForm] = useState({
    memberId: '',
    pricePerLiter: '',
    transportCost: '',
    date: today,
    quantityLiters: '',
    fat: '',
    notes: '',
  });
  const [deliveryForm, setDeliveryForm] = useState({
    date: today,
    companyName: '',
    quantityLiters: '',
    pricePerLiter: '',
    notes: '',
  });
  const [priceForm, setPriceForm] = useState({
    month: monthKey(today),
    pricePerLiter: '',
  });
  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false);

  const currentMonthPrice = dateFilter
    ? prices.find((p) => p.month === monthKey(dateFilter))?.pricePerLiter || 0
    : 0;

  useEffect(() => {
    if (appUser?.memberId) {
      setReceiptForm((prev) => ({ ...prev, memberId: appUser.memberId! }));
    }
  }, [appUser?.memberId]);

  useEffect(() => {
    if (currentMonthPrice) {
      setReceiptForm((prev) => ({ ...prev, pricePerLiter: String(currentMonthPrice) }));
    }
  }, [currentMonthPrice]);

  useEffect(() => {
    if (dateFilter) {
      setReceiptForm((prev) => ({ ...prev, date: dateFilter }));
      setDeliveryForm((prev) => ({ ...prev, date: dateFilter }));
    }
  }, [dateFilter]);

  const activeMembers = members.filter((m) => m.active);
  const isCollectorWithMember = !!(appUser?.memberId && appUser.role === 'collector');
  const isAdmin = appUser?.role === 'admin';

  const filteredReceipts = useMemo(() => {
    if (!dateFilter) return [];
    return receipts.filter((r) => r.date === dateFilter);
  }, [receipts, dateFilter]);

  const filteredDeliveries = useMemo(() => {
    if (!dateFilter) return [];
    return deliveries.filter((d) => d.date === dateFilter);
  }, [deliveries, dateFilter]);

  const handleReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptForm.memberId) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'يجب اختيار المنخرط' });
      return;
    }
    try {
      await addReceipt({
        memberId: receiptForm.memberId,
        pricePerLiter: receiptForm.pricePerLiter ? Number(receiptForm.pricePerLiter) : undefined,
        transportCost: receiptForm.transportCost ? Number(receiptForm.transportCost) : undefined,
        date: receiptForm.date,
        quantityLiters: Number(receiptForm.quantityLiters),
        fat: receiptForm.fat ? Number(receiptForm.fat) : undefined,
        notes: receiptForm.notes,
      });
      toast({ title: 'تم', description: 'تم تسجيل استلام الحليب بنجاح.' });
      setReceiptForm((prev) => ({
        ...prev,
        memberId: isCollectorWithMember ? prev.memberId : '',
        pricePerLiter: currentMonthPrice ? String(currentMonthPrice) : '',
        transportCost: '',
        quantityLiters: '',
        fat: '',
        notes: '',
      }));
      setDateFilter(receiptForm.date);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: err.message });
    }
  };

  const handleDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDelivery({
        date: deliveryForm.date,
        companyName: deliveryForm.companyName,
        quantityLiters: Number(deliveryForm.quantityLiters),
        pricePerLiter: Number(deliveryForm.pricePerLiter),
        notes: deliveryForm.notes,
      });
      toast({ title: 'تم', description: 'تم تسجيل تسليم الحليب بنجاح.' });
      setDeliveryForm((prev) => ({ ...prev, quantityLiters: '', notes: '' }));
      setDateFilter(deliveryForm.date);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: err.message });
    }
  };

  const handlePriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const existing = prices.find((p) => p.month === priceForm.month);
      const val = Number(priceForm.pricePerLiter);
      if (existing) {
        await updatePrice(existing.id, { pricePerLiter: val });
      } else {
        await addPrice({ month: priceForm.month, pricePerLiter: val });
      }
      toast({ title: 'تم', description: 'تم تحديد ثمن الحليب للشهر بنجاح.' });
      setIsPriceDialogOpen(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: err.message });
    }
  };

  const getMemberName = (id: string) => members.find((m) => m.id === id)?.fullName || 'غير معروف';
  const dateLabel = dateFilter ? format(new Date(dateFilter + 'T00:00:00'), 'dd/MM/yyyy') : '—';
  const formDateLabel = (d: string) => (d ? format(new Date(d + 'T00:00:00'), 'dd/MM/yyyy') : '—');

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">إدارة الحليب</h2>
          <p className="text-muted-foreground mt-1">تسجيل الاستلام من المنخرطين والتسليم للشركات</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={dateFilter}
              max={today}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-auto"
            />
          </div>
          <Dialog open={isPriceDialogOpen} onOpenChange={setIsPriceDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="gap-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
              >
                <Coins className="h-4 w-4" />
                ثمن الشهر: {currentMonthPrice ? `${currentMonthPrice} ${currency}` : 'غير محدد'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>تحديد ثمن شراء الحليب من المنخرطين</DialogTitle>
              </DialogHeader>
              <form onSubmit={handlePriceSubmit} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>الشهر</Label>
                  <Input
                    type="month"
                    value={priceForm.month}
                    onChange={(e) => setPriceForm({ ...priceForm, month: e.target.value })}
                    required
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label>الثمن للتر الواحد ({currency})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceForm.pricePerLiter}
                    onChange={(e) => setPriceForm({ ...priceForm, pricePerLiter: e.target.value })}
                    required
                    dir="ltr"
                    className="text-right"
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full">
                    حفظ الثمن
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 max-w-md h-12">
          <TabsTrigger value="received" className="gap-2 text-base">
            <ArrowDownRight className="h-4 w-4" /> استلام (منخرطون)
          </TabsTrigger>
          <TabsTrigger value="delivered" className="gap-2 text-base">
            <ArrowUpRight className="h-4 w-4" /> تسليم (شركات)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-1 rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 className="font-semibold text-lg mb-1 flex items-center gap-2 border-b pb-2">
                <Plus className="h-5 w-5 text-primary" /> تسجيل استلام جديد
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                التاريخ:{' '}
                <span className="font-semibold text-foreground">
                  {formDateLabel(receiptForm.date)}
                </span>
              </p>
              <form onSubmit={handleReceiptSubmit} className="space-y-4">
                {isAdmin && (
                  <div className="space-y-2">
                    <Label>تاريخ الاستلام</Label>
                    <Input
                      type="date"
                      value={receiptForm.date}
                      max={today}
                      onChange={(e) => setReceiptForm({ ...receiptForm, date: e.target.value })}
                      dir="ltr"
                    />
                  </div>
                )}
                {isCollectorWithMember ? (
                  <div className="space-y-2">
                    <Label>المنخرط</Label>
                    <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium">
                      {getMemberName(receiptForm.memberId)}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>المنخرط</Label>
                    <Select
                      value={receiptForm.memberId}
                      onValueChange={(val) => setReceiptForm({ ...receiptForm, memberId: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر المنخرط" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeMembers.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>
                    ثمن اللتر ({currency}) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    dir="ltr"
                    className="text-right font-mono"
                    value={receiptForm.pricePerLiter}
                    onChange={(e) =>
                      setReceiptForm({ ...receiptForm, pricePerLiter: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>ثمن النقل الإجمالي ({currency})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    dir="ltr"
                    className="text-right font-mono"
                    value={receiptForm.transportCost}
                    onChange={(e) =>
                      setReceiptForm({ ...receiptForm, transportCost: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>
                      الكمية (لتر) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      required
                      dir="ltr"
                      className="text-right font-mono text-lg"
                      value={receiptForm.quantityLiters}
                      onChange={(e) =>
                        setReceiptForm({ ...receiptForm, quantityLiters: e.target.value })
                      }
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>نسبة الدهن %</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      dir="ltr"
                      className="text-right font-mono"
                      value={receiptForm.fat}
                      onChange={(e) => setReceiptForm({ ...receiptForm, fat: e.target.value })}
                      placeholder="0.0"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>ملاحظات</Label>
                  <Input
                    value={receiptForm.notes}
                    onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })}
                    placeholder="ملاحظات اختيارية..."
                  />
                </div>
                <Button type="submit" className="w-full gap-2">
                  <Plus className="h-4 w-4" /> تسجيل الاستلام
                </Button>
              </form>
            </div>

            <div className="md:col-span-2 rounded-xl border border-border bg-card overflow-hidden shadow-sm flex flex-col">
              <div className="p-4 border-b border-border bg-muted/20 flex justify-between items-center flex-wrap gap-3">
                <div>
                  <h3 className="font-semibold">سجل الاستلام ليوم {dateLabel}</h3>
                  <div className="text-sm font-medium bg-primary/10 text-primary px-3 py-1 rounded-full mt-2 inline-block">
                    المجموع: {filteredReceipts.reduce((sum, r) => sum + r.quantityLiters, 0).toLocaleString()} لتر
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <MilkPrintDialog
                    receipts={filteredReceipts}
                    dateLabel={dateLabel}
                    getMemberName={getMemberName}
                    currency={currency || ''}
                  />
                  <TransportPrintDialog
                    receipts={filteredReceipts}
                    dateLabel={dateLabel}
                    getMemberName={getMemberName}
                    currency={currency || ''}
                  />
                </div>
              </div>
              <div className="overflow-x-auto flex-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المنخرط</TableHead>
                      <TableHead>الكمية</TableHead>
                      <TableHead>الثمن/لتر</TableHead>
                      <TableHead>الدهن %</TableHead>
                      <TableHead>ثمن النقل</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReceipts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          لا يوجد استلامات ليوم {dateLabel}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredReceipts.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{getMemberName(r.memberId)}</TableCell>
                          <TableCell className="font-mono font-bold text-primary">
                            {r.quantityLiters} لتر
                          </TableCell>
                          <TableCell className="font-mono text-emerald-700 font-semibold">
                            {r.pricePerLiter ? `${r.pricePerLiter} ${currency}` : '—'}
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {r.fat ? `${r.fat}%` : '—'}
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {r.transportCost ? `${r.transportCost} ${currency}` : '—'}
                          </TableCell>
                          <TableCell className="text-left">
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeReceipt(r.id)}
                                className="h-8 w-8 hover:bg-destructive/10 text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="delivered" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-1 rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 className="font-semibold text-lg mb-1 flex items-center gap-2 border-b pb-2">
                <Plus className="h-5 w-5 text-emerald-600" /> تسجيل تسليم جديد
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                التاريخ:{' '}
                <span className="font-semibold text-foreground">
                  {formDateLabel(deliveryForm.date)}
                </span>
              </p>
              <form onSubmit={handleDeliverySubmit} className="space-y-4">
                {isAdmin && (
                  <div className="space-y-2">
                    <Label>تاريخ التسليم</Label>
                    <Input
                      type="date"
                      value={deliveryForm.date}
                      max={today}
                      onChange={(e) => setDeliveryForm({ ...deliveryForm, date: e.target.value })}
                      dir="ltr"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>
                    اسم الشركة <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={deliveryForm.companyName}
                    onChange={(e) =>
                      setDeliveryForm({ ...deliveryForm, companyName: e.target.value })
                    }
                    placeholder="مثال: شركة دانون"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الكمية (لتر)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      required
                      dir="ltr"
                      className="text-right font-mono text-lg"
                      value={deliveryForm.quantityLiters}
                      onChange={(e) =>
                        setDeliveryForm({ ...deliveryForm, quantityLiters: e.target.value })
                      }
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الثمن للتر</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      dir="ltr"
                      className="text-right font-mono"
                      value={deliveryForm.pricePerLiter}
                      onChange={(e) =>
                        setDeliveryForm({ ...deliveryForm, pricePerLiter: e.target.value })
                      }
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>ملاحظات</Label>
                  <Input
                    value={deliveryForm.notes}
                    onChange={(e) => setDeliveryForm({ ...deliveryForm, notes: e.target.value })}
                    placeholder="ملاحظات اختيارية..."
                  />
                </div>
                <Button type="submit" className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="h-4 w-4" /> تسجيل التسليم
                </Button>
              </form>
            </div>

            <div className="md:col-span-2 rounded-xl border border-border bg-card overflow-hidden shadow-sm flex flex-col">
              <div className="p-4 border-b border-border bg-muted/20 flex justify-between items-center">
                <h3 className="font-semibold">سجل التسليم ليوم {dateLabel}</h3>
                <div className="text-sm font-medium bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-full">
                  المجموع: {filteredDeliveries.reduce((sum, d) => sum + d.quantityLiters, 0).toLocaleString()} لتر
                </div>
              </div>
              <div className="overflow-x-auto flex-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الشركة</TableHead>
                      <TableHead>الكمية</TableHead>
                      <TableHead>الثمن للتر</TableHead>
                      <TableHead>المبلغ الإجمالي</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDeliveries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          لا يوجد تسليمات ليوم {dateLabel}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDeliveries.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.companyName}</TableCell>
                          <TableCell className="font-mono font-bold text-emerald-600">
                            {d.quantityLiters} لتر
                          </TableCell>
                          <TableCell className="font-mono">
                            {d.pricePerLiter} {currency}
                          </TableCell>
                          <TableCell className="font-mono font-bold bg-muted/30">
                            {(d.quantityLiters * d.pricePerLiter).toLocaleString()} {currency}
                          </TableCell>
                          <TableCell className="text-left">
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeDelivery(d.id)}
                                className="h-8 w-8 hover:bg-destructive/10 text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
