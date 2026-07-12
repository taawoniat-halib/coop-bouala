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
  import {
    exportToPdf, exportToExcel, printPage, shareOnWhatsApp, printFarmerInvoice,
  } from '@/lib/exportUtils';
  import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  } from '@/components/ui/table';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
  import {
    FileText, Printer, FileSpreadsheet, Download, Send,
    Calendar, CheckCircle2, XCircle, Loader2,
  } from 'lucide-react';
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

    const memberStatements = useMemo(() => {
      return computeMemberMonthlyStatements(members, receipts, transporters, prices, monthFilter)
        .filter(st => st.totalLiters > 0)
        .sort((a, b) => b.totalLiters - a.totalLiters);
    }, [members, receipts, transporters, prices, monthFilter]);

    const companyDeliveries = useMemo(() => {
      return deliveredByCompany(deliveries, monthFilter).sort((a, b) => b.liters - a.liters);
    }, [deliveries, monthFilter]);

    const stockBalance = useMemo(() => {
      return computeMonthlyStockBalance(receipts, deliveries, monthFilter);
    }, [receipts, deliveries, monthFilter]);

    const totalMembersNet = memberStatements.reduce((sum, st) => sum + st.netAmount, 0);
    const totalCompanyAmount = companyDeliveries.reduce((sum, d) => sum + d.amount, 0);

    const getInvoicePaid = (memberId: string) =>
      invoices.some(inv => inv.memberId === memberId && inv.month === monthFilter && inv.paid);

    const toggleInvoicePaid = async (memberId: string) => {
      const invoiceId = `${memberId}_${monthFilter}`;
      setTogglingId(invoiceId);
      try {
        const currentPaid = getInvoicePaid(memberId);
        await setDoc(doc(db, 'invoices', invoiceId), {
          id: invoiceId, memberId, month: monthFilter,
          paid: !currentPaid, paidAt: !currentPaid ? Date.now() : null,
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

    const handleExportMembersPdf = () => {
      exportToPdf(
        `مستحقات الفلاحين - ${monthFilter}`,
        [
          { header: 'الفلاح', key: 'memberName' },
          { header: 'الكمية (لتر)', key: 'totalLiters' },
          { header: 'الثمن/لتر', key: 'pricePerLiter' },
          { header: 'الاجمالي', key: 'grossAmount' },
          { header: 'اقتطاع النقل', key: 'transportCost' },
          { header: 'الصافي', key: 'netAmount' },
        ],
        memberStatements.map(st => ({
          ...st,
          netAmount: `${st.netAmount.toFixed(2)} ${currency}`,
          transportCost: `${st.transportCost.toFixed(2)} ${currency}`,
          grossAmount: `${st.grossAmount.toFixed(2)} ${currency}`,
          pricePerLiter: `${st.pricePerLiter} ${currency}`,
        })),
        `member-statements-${monthFilter}`,
      );
    };

    const handleExportMembersExcel = () => {
      exportToExcel(
        'المستحقات',
        [
          { header: 'الفلاح', key: 'memberName' },
          { header: 'الكمية (لتر)', key: 'totalLiters' },
          { header: 'الثمن/لتر', key: 'pricePerLiter' },
          { header: 'المبلغ الإجمالي', key: 'grossAmount' },
          { header: 'اقتطاع النقل', key: 'transportCost' },
          { header: 'المبلغ الصافي', key: 'netAmount' },
        ],
        memberStatements,
        `member-statements-${monthFilter}`,
      );
    };

    const handleShareStatement = (st: typeof memberStatements[0]) => {
      const member = members.find(m => m.id === st.memberId);
      const phone = member?.phone || settings?.phone;
      const message = `مرحباً ${st.memberName}،
  تفاصيل حسابك لشهر ${monthFilter} لدى ${settings?.coopName}:
  - الكمية المسلمة: ${st.totalLiters} لتر
  - ثمن اللتر: ${st.pricePerLiter} ${currency}
  - المبلغ الإجمالي: ${st.grossAmount.toFixed(2)} ${currency}
  - اقتطاع النقل: ${st.transportCost.toFixed(2)} ${currency}
  -----------------
  المبلغ الصافي المستحق: ${st.netAmount.toFixed(2)} ${currency}
  شكراً لثقتكم.`;
      shareOnWhatsApp(message, phone);
    };

    return (
      <Layout>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">التقارير</h2>
            <p className="text-muted-foreground mt-1">مستحقات الفلاحين وملخصات التسليم الشهري</p>
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

          {/* ─── MEMBERS TAB ─── */}
          <TabsContent value="members">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <CardTitle>مستحقات الفلاحين — {monthFilter}</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={printPage} className="gap-1">
                      <Printer className="h-3.5 w-3.5" /> طباعة الصفحة
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportMembersExcel} className="gap-1">
                      <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportMembersPdf} className="gap-1">
                      <Download className="h-3.5 w-3.5" /> PDF ملخص
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الفلاح</TableHead>
                        <TableHead>الكمية (لتر)</TableHead>
                        <TableHead>الثمن/لتر</TableHead>
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
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            لا توجد بيانات لهذا الشهر
                          </TableCell>
                        </TableRow>
                      ) : (
                        memberStatements.map(st => {
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
                                <div className="flex items-center gap-1">
                                  {/* Print individual farmer invoice */}
                                  <Button variant="outline" size="sm"
                                    className="h-7 gap-1 text-xs border-primary/30 text-primary hover:bg-primary/5"
                                    onClick={() => handlePrintFarmerInvoice(st)}
                                    title="طباعة فاتورة الفلاح">
                                    <Printer className="h-3.5 w-3.5" /> فاتورة
                                  </Button>
                                  <Button
                                    variant={paid ? 'outline' : 'default'}
                                    size="sm"
                                    onClick={() => toggleInvoicePaid(st.memberId)}
                                    disabled={isToggling}
                                    className={paid
                                      ? 'text-xs h-7 whitespace-nowrap'
                                      : 'text-xs h-7 bg-emerald-600 hover:bg-emerald-700 whitespace-nowrap'}>
                                    {isToggling ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : paid ? 'إلغاء الدفع' : 'تحديد كمدفوع'}
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                    onClick={() => handleShareStatement(st)} title="مشاركة عبر واتساب">
                                    <Send className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
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
                              {memberStatements.filter(st => getInvoicePaid(st.memberId)).length} / {memberStatements.length} مدفوع
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

          {/* ─── COMPANIES TAB ─── */}
          <TabsContent value="companies">
            <div className="space-y-6">
              {/* Stock balance summary */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'حليب مستلم', value: stockBalance.receivedLiters, color: 'text-blue-600' },
                  { label: 'حليب مسلَّم', value: stockBalance.deliveredLiters, color: 'text-emerald-600' },
                  { label: 'الفرق', value: stockBalance.balanceLiters, color: stockBalance.balanceLiters >= 0 ? 'text-amber-600' : 'text-destructive' },
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
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <CardTitle>تسليمات الشركات — {monthFilter}</CardTitle>
                    <Button variant="outline" size="sm" onClick={printPage} className="gap-1">
                      <Printer className="h-3.5 w-3.5" /> طباعة
                    </Button>
                  </div>
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
                        ) : (
                          companyDeliveries.map(d => (
                            <TableRow key={d.companyName}>
                              <TableCell className="font-medium">{d.companyName}</TableCell>
                              <TableCell className="font-mono font-bold text-emerald-600">
                                {d.liters.toLocaleString()}
                              </TableCell>
                              <TableCell className="font-mono font-bold">
                                {d.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
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
  