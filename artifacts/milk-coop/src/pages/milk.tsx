import { Layout } from '@/components/Layout';
import { useMilkReceived, useMilkDelivered, useMembers, useTransporters, usePrices } from '@/hooks/useData';
import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Droplets, ArrowUpRight, ArrowDownRight, Coins } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/hooks/useSettings';
import { monthKey } from '@/lib/calculations';

export default function Milk() {
  const { data: receipts, add: addReceipt, remove: removeReceipt } = useMilkReceived();
  const { data: deliveries, add: addDelivery, remove: removeDelivery } = useMilkDelivered();
  const { data: prices, add: addPrice, update: updatePrice } = usePrices();
  const { data: members } = useMembers();
  const { data: transporters } = useTransporters();
  const { settings } = useSettings();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('received');
  const [dateFilter, setDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'));
  const currency = settings?.currency === 'MAD' ? 'درهم' : settings?.currency;

  const [receiptForm, setReceiptForm] = useState({
    memberId: '',
    transporterId: 'none',
    date: format(new Date(), 'yyyy-MM-dd'),
    quantityLiters: '',
    fat: '',
    notes: ''
  });

  const [deliveryForm, setDeliveryForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    companyName: '',
    quantityLiters: '',
    pricePerLiter: '',
    notes: ''
  });

  const [priceForm, setPriceForm] = useState({
    month: monthKey(format(new Date(), 'yyyy-MM-dd')),
    pricePerLiter: ''
  });
  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false);

  const activeMembers = members.filter(m => m.active);
  const activeTransporters = transporters.filter(t => t.active);

  const filteredReceipts = useMemo(() => {
    return receipts.filter(r => r.date === dateFilter);
  }, [receipts, dateFilter]);

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter(d => d.date === dateFilter);
  }, [deliveries, dateFilter]);

  const handleReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptForm.memberId) return toast({ variant: 'destructive', title: 'خطأ', description: 'يجب اختيار العضو' });
    
    try {
      await addReceipt({
        memberId: receiptForm.memberId,
        transporterId: receiptForm.transporterId === 'none' ? undefined : receiptForm.transporterId,
        date: receiptForm.date,
        quantityLiters: Number(receiptForm.quantityLiters),
        fat: receiptForm.fat ? Number(receiptForm.fat) : undefined,
        notes: receiptForm.notes
      });
      toast({ title: 'تم', description: 'تم تسجيل استلام الحليب بنجاح.' });
      setReceiptForm(prev => ({ ...prev, memberId: '', quantityLiters: '', fat: '', notes: '' }));
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
        notes: deliveryForm.notes
      });
      toast({ title: 'تم', description: 'تم تسجيل تسليم الحليب بنجاح.' });
      setDeliveryForm(prev => ({ ...prev, quantityLiters: '', notes: '' }));
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: err.message });
    }
  };

  const handlePriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const existing = prices.find(p => p.month === priceForm.month);
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

  const getMemberName = (id: string) => members.find(m => m.id === id)?.fullName || 'غير معروف';
  const getTransporterName = (id?: string) => {
    if (!id) return 'تسليم مباشر';
    return transporters.find(t => t.id === id)?.fullName || 'غير معروف';
  };

  const currentMonthPrice = prices.find(p => p.month === monthKey(dateFilter))?.pricePerLiter || 0;

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">إدارة الحليب</h2>
          <p className="text-muted-foreground mt-1">تسجيل الاستلام من الأعضاء والتسليم للشركات</p>
        </div>
        <div className="flex items-center gap-3">
          <Input 
            type="date" 
            value={dateFilter} 
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-auto"
          />
          <Dialog open={isPriceDialogOpen} onOpenChange={setIsPriceDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10">
                <Coins className="h-4 w-4" />
                ثمن الشهر: {currentMonthPrice ? `${currentMonthPrice} ${currency}` : 'غير محدد'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>تحديد ثمن شراء الحليب من الأعضاء</DialogTitle>
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
                  <Button type="submit" className="w-full">حفظ الثمن</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 max-w-md h-12">
          <TabsTrigger value="received" className="gap-2 text-base">
            <ArrowDownRight className="h-4 w-4" /> استلام (أعضاء)
          </TabsTrigger>
          <TabsTrigger value="delivered" className="gap-2 text-base">
            <ArrowUpRight className="h-4 w-4" /> تسليم (شركات)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-1 rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 border-b pb-2">
                <Plus className="h-5 w-5 text-primary" /> تسجيل استلام جديد
              </h3>
              <form onSubmit={handleReceiptSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>العضو</Label>
                  <Select value={receiptForm.memberId} onValueChange={(val) => setReceiptForm({ ...receiptForm, memberId: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر العضو" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeMembers.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>الناقل (اختياري)</Label>
                  <Select value={receiptForm.transporterId} onValueChange={(val) => setReceiptForm({ ...receiptForm, transporterId: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="تسليم مباشر" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">تسليم مباشر (بدون ناقل)</SelectItem>
                      {activeTransporters.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.fullName} - {t.vehicle}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الكمية (لتر)</Label>
                    <Input 
                      type="number" step="0.5" min="0" required dir="ltr" className="text-right font-mono text-lg"
                      value={receiptForm.quantityLiters} 
                      onChange={(e) => setReceiptForm({ ...receiptForm, quantityLiters: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الدهون % (اختياري)</Label>
                    <Input 
                      type="number" step="0.1" min="0" dir="ltr" className="text-right font-mono"
                      value={receiptForm.fat} 
                      onChange={(e) => setReceiptForm({ ...receiptForm, fat: e.target.value })}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full mt-2">تسجيل الاستلام</Button>
              </form>
            </div>

            <div className="md:col-span-2 rounded-xl border border-border bg-card overflow-hidden shadow-sm flex flex-col">
              <div className="p-4 border-b border-border bg-muted/20 flex justify-between items-center">
                <h3 className="font-semibold">سجل الاستلام ليوم {format(new Date(dateFilter), 'dd/MM/yyyy')}</h3>
                <div className="text-sm font-medium bg-primary/10 text-primary px-3 py-1 rounded-full">
                  المجموع: {filteredReceipts.reduce((sum, r) => sum + r.quantityLiters, 0).toLocaleString()} لتر
                </div>
              </div>
              <div className="overflow-x-auto flex-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>العضو</TableHead>
                      <TableHead>الناقل</TableHead>
                      <TableHead>الكمية</TableHead>
                      <TableHead>الدهون</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReceipts.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا يوجد سجلات لهذا اليوم</TableCell></TableRow>
                    ) : (
                      filteredReceipts.map(r => (
                        <TableRow key={r.id} className="group">
                          <TableCell className="font-medium">{getMemberName(r.memberId)}</TableCell>
                          <TableCell className="text-muted-foreground">{getTransporterName(r.transporterId)}</TableCell>
                          <TableCell className="font-mono font-bold text-primary">{r.quantityLiters} لتر</TableCell>
                          <TableCell className="font-mono">{r.fat ? `${r.fat}%` : '-'}</TableCell>
                          <TableCell className="text-left">
                            <Button variant="ghost" size="icon" onClick={() => removeReceipt(r.id)} className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 border-b pb-2">
                <Plus className="h-5 w-5 text-emerald-500" /> تسجيل تسليم للشركات
              </h3>
              <form onSubmit={handleDeliverySubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>اسم الشركة</Label>
                  <Input 
                    required 
                    value={deliveryForm.companyName} 
                    onChange={(e) => setDeliveryForm({ ...deliveryForm, companyName: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الكمية (لتر)</Label>
                    <Input 
                      type="number" step="0.5" min="0" required dir="ltr" className="text-right font-mono text-lg"
                      value={deliveryForm.quantityLiters} 
                      onChange={(e) => setDeliveryForm({ ...deliveryForm, quantityLiters: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الثمن / لتر</Label>
                    <Input 
                      type="number" step="0.01" min="0" required dir="ltr" className="text-right font-mono"
                      value={deliveryForm.pricePerLiter} 
                      onChange={(e) => setDeliveryForm({ ...deliveryForm, pricePerLiter: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>ملاحظات</Label>
                  <Input 
                    value={deliveryForm.notes} 
                    onChange={(e) => setDeliveryForm({ ...deliveryForm, notes: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700">تسجيل التسليم</Button>
              </form>
            </div>

            <div className="md:col-span-2 rounded-xl border border-border bg-card overflow-hidden shadow-sm flex flex-col">
              <div className="p-4 border-b border-border bg-muted/20 flex justify-between items-center">
                <h3 className="font-semibold">سجل التسليم ليوم {format(new Date(dateFilter), 'dd/MM/yyyy')}</h3>
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
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا يوجد تسليمات لهذا اليوم</TableCell></TableRow>
                    ) : (
                      filteredDeliveries.map(d => (
                        <TableRow key={d.id} className="group">
                          <TableCell className="font-medium">{d.companyName}</TableCell>
                          <TableCell className="font-mono font-bold text-emerald-600">{d.quantityLiters} لتر</TableCell>
                          <TableCell className="font-mono">{d.pricePerLiter} {currency}</TableCell>
                          <TableCell className="font-mono font-bold bg-muted/30">
                            {(d.quantityLiters * d.pricePerLiter).toLocaleString()} {currency}
                          </TableCell>
                          <TableCell className="text-left">
                            <Button variant="ghost" size="icon" onClick={() => removeDelivery(d.id)} className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
