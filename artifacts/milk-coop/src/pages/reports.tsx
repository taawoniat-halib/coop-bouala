import { Layout } from '@/components/Layout';
  import {
    useMembers, useMilkReceived, useTransporters, usePrices,
    useMilkDelivered, useInvoices,
  } from '@/hooks/useData';
  import { useSettings } from '@/hooks/useSettings';
  import { useState, useMemo } from 'react';
  import { format } from 'date-fns';
  import {
    computeMemberMonthlyStatements, deliveredByCompany,
    computeMonthlyStockBalance, monthKey, priceForMonth,
  } from '@/lib/calculations';
  import { printFarmerInvoice } from '@/lib/exportUtils';
  import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  } from '@/components/ui/table';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
  import { Printer, Calendar, CheckCircle2, XCircle, Loader2, Send } from 'lucide-react';
  import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
  import { Badge } from '@/components/ui/badge';
  import { doc, setDoc } from 'firebase/firestore';
  import { db } from '@/lib/firebase';

  export default function Reports() {
    const { data: members } = useMembers();
    const { data: receipts } = useMilkReceived();
    const { data: transporters } = useTransporters();
    const { data: prices } = usePrices();
    const { data: deliveries } = useMilkDelivered();
    const { data: invoices } = useInvoices();
    const { settings } = useSettings();

    const [monthFilter, setMonthFilter] = useState(monthKey(format(new Date(), 'yyyy-MM-dd')));
    const [activeTab, setActiveTab] = useState('members');
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const currency = settings?.currency === 'MAD' ? 'درهم' : settings?.currency ?? 'درهم';

    const memberStatements = useMemo(() =>
      computeMemberMonthlyStatements(members, receipts, transporters, prices, monthFilter)
        .filter(st => st.totalLiters > 0)
        .sort((a, b) => b.totalLiters - a.totalLiters),
      [members, receipts, transporters, prices, monthFilter]
    );

    const companyDeliveries = useMemo(() =>
      deliveredByCompany(deliveries, monthFilter).sort((a, b) => b.liters - a.liters),
      [deliveries, monthFilter]
    );

    const stockBalance = useMemo(() =>
      computeMonthlyStockBalance(receipts, deliveries, monthFilter),
      [receipts, deliveries, monthFilter]
    );

    const totalMembersNet = memberStatements.reduce((s, st) => s + st.netAmount, 0);
    const totalCompanyAmount = companyDeliveries.reduce((s, d) => s + d.amount, 0);

    const getInvoicePaid = (memberId: string) =>
      invoices.some(inv => inv.memberId === memberId && inv.month === monthFilter && inv.paid);

    const toggleInvoicePaid = async (memberId: string) => {
      const invoiceId = `${memberId}_${monthFilter}`;
      setTogglingId(invoiceId);
      try {
        await setDoc(doc(db, 'invoices', invoiceId), {
          id: invoiceId, memberId, month: monthFilter,
          paid: !getInvoicePaid(memberId),
          paidAt: !getInvoicePaid(memberId) ? Date.now() : null,
          createdAt: Date.now(),
        }, { merge: true });
      } finally { setTogglingId(null); }
    };

    const handlePrintFarmerInvoice = (st: typeof memberStatements[0]) => {
      const farmerReceipts = receipts.filter(
        r => r.memberId === st.memberId && monthKey(r.date) === monthFilter
      );
      printFarmerInvoice({
        farmerName: st.memberName,
        month: monthFilter,
        receipts: farmerReceipts,
        monthlyPricePerLiter: priceForMonth(prices, monthFilter),
        coopName: settings?.coopName || 'تعاونية كوب بوعلا',
        logoUrl: settings?.logoUrl,
        currency,
      });
    };

    const handleShareStatement = (st: typeof memberStatements[0]) => {
      const member = members.find(m => m.id === st.memberId);
      const phone = member?.phone || settings?.phone;
      const message = `مرحباً ${st.memberName}،
  تفاصيل حسابك لشهر ${monthFilter} لدى ${settings?.coopName}:
  - الكمية: ${st.totalLiters} لتر | الثمن: ${st.pricePerLiter} ${currency}/ل
  - الإجمالي: ${st.grossAmount.toFixed(2)} | النقل: ${st.transportCost.toFixed(2)}
  - الصافي المستحق: ${st.netAmount.toFixed(2)} ${currency}
  شكراً.`;
      const url = phone
        ? `https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    };

    return (
      <Layout>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">التقارير</h2>
            <p className="text-muted-foreground mt-1">مستحقات الفلاحين وتسليمات الشركات</p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input type="month" value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-auto" dir="ltr" />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="members">مستحقات الفلاحين</TabsTrigger>
            <TabsTrigger value="companies">تسليمات الشركات</TabsTrigger>
          </TabsList>

          {/* ─── TAB: MEMBERS ─── */}
          <TabsContent value="members">
            <Card>
              <CardHeader>
                <CardTitle>مستحقات الفلاحين — {monthFilter}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  اضغط <strong>فاتورة</strong> في صف الفلاح لطباعة كشف حسابه الشهري التفصيلي.
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الفلاح</TableHead>
                        <TableHead>الكمية (ل)</TableHead>
                        <TableHead>الثمن/ل</TableHead>
                        <TableHead>الإجمالي</TableHead>
                        <TableHead>اقتطاع النقل</TableHead>
                        <TableHead>الصافي</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {memberStatements.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                            لا توجد بيانات لهذا الشهر
                          </TableCell>
                        </TableRow>
                      ) : memberStatements.map(st => {
                        const paid = getInvoicePaid(st.memberId);
                        const invoiceId = `${st.memberId}_${monthFilter}`;
                        const isToggling = togglingId === invoiceId;
                        return (
                          <TableRow key={st.memberId}
                            className={paid ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''}>
                            <TableCell className="font-medium">{st.memberName}</TableCell>
                            <TableCell className="font-mono">{st.totalLiters.toLocaleString()}</TableCell>
                            <TableCell className="font-mono">{st.pricePerLiter.toFixed(2)}</TableCell>
                            <TableCell className="font-mono">
                              {st.grossAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="font-mono text-destructive">
                              {st.transportCost > 0
                                ? st.transportCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                : '—'}
                            </TableCell>
                            <TableCell className="font-mono font-bold text-primary">
                              {st.netAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                            </TableCell>
                            <TableCell>
                              {paid ? (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1 whitespace-nowrap">
                                  <CheckCircle2 className="h-3 w-3" /> مدفوع
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1 whitespace-nowrap">
                                  <XCircle className="h-3 w-3" /> غير مدفوع
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {/* ── Print individual farmer invoice in new window ── */}
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="gap-1.5 h-8 bg-primary hover:bg-primary/90 text-primary-foreground whitespace-nowrap"
                                  onClick={() => handlePrintFarmerInvoice(st)}
                                  title="طباعة فاتورة هذا الفلاح في نافذة جديدة">
                                  <Printer className="h-3.5 w-3.5" />
                                  فاتورة
                                </Button>
                                <Button
                                  variant={paid ? 'outline' : 'outline'}
                                  size="sm"
                                  onClick={() => toggleInvoicePaid(st.memberId)}
                                  disabled={isToggling}
                                  className={paid
                                    ? 'h-8 text-xs whitespace-nowrap'
                                    : 'h-8 text-xs whitespace-nowrap border-emerald-600 text-emerald-600 hover:bg-emerald-50'}>
                                  {isToggling ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : paid ? 'إلغاء الدفع' : 'تحديد كمدفوع'}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8"
                                  onClick={() => handleShareStatement(st)} title="مشاركة عبر واتساب">
                                  <Send className="h-3.5 w-3.5 text-emerald-600" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {memberStatements.length > 0 && (
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell>المجموع</TableCell>
                          <TableCell className="font-mono">
                            {memberStatements.reduce((s, st) => s + st.totalLiters, 0).toLocaleString()}
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell className="font-mono">
                            {memberStatements.reduce((s, st) => s + st.grossAmount, 0)
                              .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="font-mono text-destructive">
                            {memberStatements.reduce((s, st) => s + st.transportCost, 0)
                              .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="font-mono text-primary">
                            {totalMembersNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                          </TableCell>
                          <TableCell colSpan={2}>
                            <span className="text-xs text-muted-foreground font-normal">
                              {memberStatements.filter(st => getInvoicePaid(st.memberId)).length}/{memberStatements.length} مدفوع
                            </span>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── TAB: COMPANIES ─── */}
          <TabsContent value="companies">
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'حليب مستلم', value: stockBalance.receivedLiters, color: 'text-blue-600' },
                  { label: 'حليب مسلَّم', value: stockBalance.deliveredLiters, color: 'text-emerald-600' },
                  { label: 'الفرق', value: stockBalance.balanceLiters,
                    color: stockBalance.balanceLiters >= 0 ? 'text-amber-600' : 'text-destructive' },
                ].map(s => (
                  <Card key={s.label}>
                    <CardContent className="pt-4 text-center">
                      <div className={`text-2xl font-bold font-mono ${s.color}`}>{s.value.toLocaleString()} ل</div>
                      <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>تسليمات الشركات — {monthFilter}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>الشركة</TableHead>
                          <TableHead>الكمية (لتر)</TableHead>
                          <TableHead>المبلغ الإجمالي</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {companyDeliveries.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                              لا توجد تسليمات لهذا الشهر
                            </TableCell>
                          </TableRow>
                        ) : companyDeliveries.map(d => (
                          <TableRow key={d.companyName}>
                            <TableCell className="font-medium">{d.companyName}</TableCell>
                            <TableCell className="font-mono font-bold text-emerald-600">
                              {d.liters.toLocaleString()}
                            </TableCell>
                            <TableCell className="font-mono font-bold">
                              {d.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                            </TableCell>
                          </TableRow>
                        ))}
                        {companyDeliveries.length > 0 && (
                          <TableRow className="bg-muted/50 font-bold">
                            <TableCell>المجموع</TableCell>
                            <TableCell className="font-mono">
                              {companyDeliveries.reduce((s, d) => s + d.liters, 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="font-mono text-primary">
                              {totalCompanyAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </Layout>
    );
  }
  