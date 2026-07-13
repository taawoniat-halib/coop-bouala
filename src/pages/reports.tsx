import { Layout } from '@/components/Layout';
import {
  useMembers,
  useMilkReceived,
  useTransporters,
  usePrices,
  useMilkDelivered,
  useInvoices,
} from '@/hooks/useData';
import { useSettings } from '@/hooks/useSettings';
import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  computeMemberMonthlyStatements,
  deliveredByCompany,
  computeMonthlyStockBalance,
  monthKey,
  priceForMonth,
  monthLabel,
  generateMonthOptions,
} from '@/lib/calculations';
import { printFarmerInvoice, printCompanyInvoice, exportToPdf, exportToExcel, shareOnWhatsApp, buildFarmerWhatsAppMessage } from '@/lib/exportUtils';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Printer,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  Search,
  Download,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from '@/components/ui/command';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const MONTH_OPTIONS = generateMonthOptions(24);

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
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [printingMemberId, setPrintingMemberId] = useState<string | null>(null);

  // Advanced report state
  const [selectedFarmerIdReport, setSelectedFarmerIdReport] = useState('');

  const currency = settings?.currency === 'MAD' ? 'درهم' : (settings?.currency ?? 'درهم');
  const milkPurchasePrice = settings?.milkPurchasePrice ?? 4.2;
  const milkSellPrice = settings?.milkSellPrice ?? 4.5;

  const memberStatements = useMemo(
    () =>
      computeMemberMonthlyStatements(
        members,
        receipts,
        transporters,
        prices,
        monthFilter,
        milkPurchasePrice,
        milkSellPrice,
      )
        .filter((st) => st.totalLiters > 0)
        .sort((a, b) => b.totalLiters - a.totalLiters),
    [members, receipts, transporters, prices, monthFilter, milkPurchasePrice, milkSellPrice],
  );

  const allMembersSorted = useMemo(
    () =>
      [...members]
        .filter((m) => m.active)
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar')),
    [members],
  );

  const companyDeliveries = useMemo(
    () => deliveredByCompany(deliveries, monthFilter).sort((a, b) => b.liters - a.liters),
    [deliveries, monthFilter],
  );

  const stockBalance = useMemo(
    () => computeMonthlyStockBalance(receipts, deliveries, monthFilter),
    [receipts, deliveries, monthFilter],
  );

  const totalMembersNet = memberStatements.reduce((s, st) => s + st.netAmount, 0);
  const totalCompanyAmount = companyDeliveries.reduce((s, d) => s + d.amount, 0);

  /** Receipts for the selected month (used by the farmer report) */
  const monthReceiptsForFarmer = useMemo(
    () => receipts.filter((r) => monthKey(r.date) === monthFilter),
    [receipts, monthFilter],
  );

  /** Individual farmer monthly report */
  const farmerReport = useMemo(() => {
    if (!selectedFarmerIdReport) return null;
    const member = members.find((m) => m.id === selectedFarmerIdReport);
    if (!member) return null;
    const farmerReceipts = monthReceiptsForFarmer.filter(
      (r) => r.memberId === selectedFarmerIdReport,
    );
    const totalLiters = farmerReceipts.reduce((s, r) => s + r.quantityLiters, 0);
    const transportCost = farmerReceipts.reduce((s, r) => s + (r.transportCost ?? 0), 0);
    const monthPrice = priceForMonth(prices, monthFilter);
    const grossAmount = farmerReceipts.reduce(
      (s, r) => s + r.quantityLiters * (r.pricePerLiter ?? monthPrice),
      0,
    );
    const netAmount = grossAmount - transportCost;
    const purchaseValue = totalLiters * milkPurchasePrice;
    const sellValue = totalLiters * milkSellPrice;
    const profit = sellValue - purchaseValue - transportCost;
    return {
      member,
      totalLiters,
      transportCost,
      grossAmount,
      netAmount,
      purchaseValue,
      sellValue,
      profit,
      farmerReceipts,
    };
  }, [
    selectedFarmerIdReport,
    members,
    monthReceiptsForFarmer,
    prices,
    monthFilter,
    milkPurchasePrice,
    milkSellPrice,
  ]);

  const getInvoicePaid = (memberId: string) =>
    invoices.some((inv) => inv.memberId === memberId && inv.month === monthFilter && inv.paid);

  const toggleInvoicePaid = async (memberId: string) => {
    const invoiceId = `${memberId}_${monthFilter}`;
    setTogglingId(invoiceId);
    try {
      await setDoc(
        doc(db, 'invoices', invoiceId),
        {
          id: invoiceId,
          memberId,
          month: monthFilter,
          paid: !getInvoicePaid(memberId),
          paidAt: !getInvoicePaid(memberId) ? Date.now() : null,
          createdAt: Date.now(),
        },
        { merge: true },
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handlePrintFarmerInvoice = async (st: (typeof memberStatements)[0]) => {
    const member = members.find((m) => m.id === st.memberId);
    const farmerReceipts = receipts.filter(
      (r) => r.memberId === st.memberId && monthKey(r.date) === monthFilter,
    );
    await printFarmerInvoice({
      farmerName: st.memberName,
      farmerPhone: member?.phone,
      farmerCin: member?.cin,
      month: monthFilter,
      receipts: farmerReceipts,
      monthlyPricePerLiter: priceForMonth(prices, monthFilter),
      coopName: settings?.coopName || 'تعاونية كوب بوعلا',
      coopPhone: settings?.phone,
      coopAddress: settings?.address,
      logoUrl: settings?.logoUrl,
      currency,
      paid: getInvoicePaid(st.memberId),
      invoiceSeq: memberStatements.findIndex(s => s.memberId === st.memberId) + 1,
    });
  };

  const handlePrintByMemberId = async (memberId: string, memberName: string) => {
    setPrintingMemberId(memberId);
    setInvoiceDialogOpen(false);
    try {
      const member = members.find((m) => m.id === memberId);
      const farmerReceipts = receipts.filter(
        (r) => r.memberId === memberId && monthKey(r.date) === monthFilter,
      );
      const st = memberStatements.find((s) => s.memberId === memberId);
      const seq = st ? memberStatements.findIndex(s => s.memberId === memberId) + 1 : undefined;
      await printFarmerInvoice({
        farmerName: memberName,
        farmerPhone: member?.phone,
        farmerCin: member?.cin,
        month: monthFilter,
        receipts: farmerReceipts,
        monthlyPricePerLiter: st?.pricePerLiter ?? priceForMonth(prices, monthFilter),
        coopName: settings?.coopName || 'تعاونية كوب بوعلا',
        coopPhone: settings?.phone,
        coopAddress: settings?.address,
        logoUrl: settings?.logoUrl,
        currency,
        paid: st ? getInvoicePaid(memberId) : false,
        invoiceSeq: seq,
      });
    } finally {
      setPrintingMemberId(null);
    }
  };

  const handleShareStatement = (st: (typeof memberStatements)[0]) => {
    const member = members.find((m) => m.id === st.memberId);
    const phone = member?.phone || settings?.phone;
    const message = buildFarmerWhatsAppMessage({
      farmerName: st.memberName,
      month: monthFilter,
      totalLiters: st.totalLiters,
      pricePerLiter: st.pricePerLiter,
      grossAmount: st.grossAmount,
      transportCost: st.transportCost,
      netAmount: st.netAmount,
      currency,
      coopName: settings?.coopName || 'تعاونية كوب بوعلا',
      paid: getInvoicePaid(st.memberId),
    });
    shareOnWhatsApp(message, phone);
  };

  const handleShareFarmerReport = () => {
    if (!farmerReport) return;
    const member = farmerReport.member;
    const phone = member.phone || settings?.phone;
    const message = `مرحباً ${member.fullName}،\nكشف حساب — ${monthLabel(monthFilter)} — ${settings?.coopName || 'التعاونية'}:\n• مجموع اللترات: ${farmerReport.totalLiters.toFixed(1)} لتر\n• مبلغ النقل المخصوم: ${farmerReport.transportCost.toFixed(2)} ${currency}\n• الصافي الإجمالي: ${farmerReport.netAmount.toFixed(2)} ${currency}\n• قيمة شراء الحليب: ${farmerReport.purchaseValue.toFixed(2)} ${currency}\n• قيمة بيع الحليب: ${farmerReport.sellValue.toFixed(2)} ${currency}\nشكراً.`;
    shareOnWhatsApp(message, phone);
  };

  const handlePrintCompanyInvoice = async (companyName: string) => {
    const companyDeliveriesRaw = deliveries.filter(
      (d) => d.companyName === companyName && monthKey(d.date) === monthFilter,
    );
    await printCompanyInvoice({
      companyName,
      month: monthFilter,
      deliveries: companyDeliveriesRaw,
      coopName: settings?.coopName || 'تعاونية كوب بوعلا',
      coopPhone: settings?.phone,
      coopAddress: settings?.address,
      logoUrl: settings?.logoUrl,
      currency,
      invoiceSeq: companyDeliveries.findIndex((c) => c.companyName === companyName) + 1,
    });
  };

  // ── Export helpers ──
  const handleExportMembersPdf = () => {
    exportToPdf(
      `مستحقات المنخرطين — ${monthLabel(monthFilter)}`,
      [
        { header: 'المنخرط', key: 'name' },
        { header: 'الكمية (ل)', key: 'liters' },
        { header: 'الثمن/ل', key: 'price' },
        { header: 'الإجمالي', key: 'gross' },
        { header: 'النقل', key: 'transport' },
        { header: 'الصافي', key: 'net' },
      ],
      memberStatements.map((st) => ({
        name: st.memberName,
        liters: st.totalLiters,
        price: st.pricePerLiter.toFixed(2),
        gross: st.grossAmount.toFixed(2),
        transport: st.transportCost.toFixed(2),
        net: `${st.netAmount.toFixed(2)} ${currency}`,
      })),
      `مستحقات-${monthFilter}`,
    );
  };

  const handleExportMembersExcel = () => {
    exportToExcel(
      `مستحقات ${monthLabel(monthFilter)}`,
      [
        { header: 'المنخرط', key: 'name' },
        { header: 'الكمية (لتر)', key: 'liters' },
        { header: 'الثمن/لتر', key: 'price' },
        { header: 'الإجمالي', key: 'gross' },
        { header: 'اقتطاع النقل', key: 'transport' },
        { header: 'الصافي', key: 'net' },
      ],
      memberStatements.map((st) => ({
        name: st.memberName,
        liters: st.totalLiters,
        price: st.pricePerLiter.toFixed(2),
        gross: st.grossAmount.toFixed(2),
        transport: st.transportCost.toFixed(2),
        net: st.netAmount.toFixed(2),
      })),
      `مستحقات-${monthFilter}`,
    );
  };

  const handleExportFarmerPdf = () => {
    if (!farmerReport) return;
    exportToPdf(
      `تقرير المنخرط: ${farmerReport.member.fullName} — ${monthLabel(monthFilter)}`,
      [
        { header: 'البيان', key: 'label' },
        { header: 'القيمة', key: 'value' },
      ],
      [
        { label: 'اسم المنخرط', value: farmerReport.member.fullName },
        { label: 'اسم المركز', value: settings?.coopName || '' },
        { label: 'الشهر', value: monthLabel(monthFilter) },
        { label: 'مجموع اللترات', value: `${farmerReport.totalLiters.toFixed(1)} ل` },
        {
          label: 'مبلغ النقل المخصوم',
          value: `${farmerReport.transportCost.toFixed(2)} ${currency}`,
        },
        { label: 'الصافي الإجمالي', value: `${farmerReport.netAmount.toFixed(2)} ${currency}` },
        {
          label: 'قيمة شراء الحليب',
          value: `${farmerReport.purchaseValue.toFixed(2)} ${currency}`,
        },
        { label: 'قيمة بيع الحليب', value: `${farmerReport.sellValue.toFixed(2)} ${currency}` },
      ],
      `تقرير-${farmerReport.member.fullName}-${monthFilter}`,
    );
  };

  const handleExportFarmerExcel = () => {
    if (!farmerReport) return;
    exportToExcel(
      `تقرير ${farmerReport.member.fullName}`,
      [
        { header: 'التاريخ', key: 'date' },
        { header: 'الكمية (ل)', key: 'qty' },
        { header: 'الثمن/ل', key: 'price' },
        { header: 'النقل', key: 'transport' },
      ],
      farmerReport.farmerReceipts.map((r) => ({
        date: r.date,
        qty: r.quantityLiters,
        price: r.pricePerLiter ?? priceForMonth(prices, monthFilter),
        transport: r.transportCost ?? 0,
      })),
      `تقرير-${farmerReport.member.fullName}-${monthFilter}`,
    );
  };

  return (
    <Layout>
      {/* ── Farmer search & print dialog ── */}
      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="max-w-md p-0 gap-0" dir="rtl">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-4 w-4" />
              طباعة فاتورة منخرط — {monthFilter}
            </DialogTitle>
            <DialogDescription className="text-xs">
              ابحث عن المنخرط باسمه أو جزء منه ثم اضغط عليه لطباعة فاتورته
            </DialogDescription>
          </DialogHeader>
          <Command className="border-t rounded-none" dir="rtl">
            <CommandInput placeholder="ابحث عن منخرط..." className="h-10" />
            <CommandList className="max-h-72">
              <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                لا يوجد منخرط بهذا الاسم
              </CommandEmpty>
              {allMembersSorted.map((m) => {
                const hasData = memberStatements.some((st) => st.memberId === m.id);
                const isPrinting = printingMemberId === m.id;
                return (
                  <CommandItem
                    key={m.id}
                    value={m.fullName}
                    onSelect={() => handlePrintByMemberId(m.id, m.fullName)}
                    className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isPrinting ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                      ) : (
                        <Printer className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate font-medium">{m.fullName}</span>
                    </div>
                    {hasData ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200"
                      >
                        لديه بيانات
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        لا بيانات هذا الشهر
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">الفواتير والكشوفات</h2>
          <p className="text-muted-foreground mt-1">
            مستحقات المنخرطين، تسليمات الشركات، وكشف حساب منخرط
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium text-muted-foreground">الشهر</Label>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="members">مستحقات المنخرطين</TabsTrigger>
          <TabsTrigger value="companies">تسليمات الشركات</TabsTrigger>
          <TabsTrigger value="advanced">كشف حساب منخرط</TabsTrigger>
        </TabsList>

        {/* ─── TAB: MEMBERS ─── */}
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle>مستحقات المنخرطين — {monthFilter}</CardTitle>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleExportMembersPdf}
                  >
                    <FileText className="h-3.5 w-3.5" /> PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleExportMembersExcel}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                    onClick={() => setInvoiceDialogOpen(true)}
                  >
                    <Search className="h-4 w-4" />
                    بحث عن منخرط
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المنخرط</TableHead>
                      <TableHead>الكمية (ل)</TableHead>
                      <TableHead>الثمن/ل</TableHead>
                      <TableHead>الإجمالي</TableHead>
                      <TableHead>اقتطاع النقل</TableHead>
                      <TableHead>الصافي</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead></TableHead>
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
                    ) : (
                      memberStatements.map((st) => {
                        const paid = getInvoicePaid(st.memberId);
                        const invoiceId = `${st.memberId}_${monthFilter}`;
                        const isToggling = togglingId === invoiceId;
                        return (
                          <TableRow
                            key={st.memberId}
                            className={paid ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''}
                          >
                            <TableCell className="font-medium">{st.memberName}</TableCell>
                            <TableCell className="font-mono">
                              {st.totalLiters.toLocaleString()}
                            </TableCell>
                            <TableCell className="font-mono">
                              {st.pricePerLiter.toFixed(2)}
                            </TableCell>
                            <TableCell className="font-mono">
                              {st.grossAmount.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </TableCell>
                            <TableCell className="font-mono text-destructive">
                              {st.transportCost > 0
                                ? st.transportCost.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })
                                : '—'}
                            </TableCell>
                            <TableCell className="font-mono font-bold text-primary">
                              {st.netAmount.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{' '}
                              {currency}
                            </TableCell>
                            <TableCell>
                              {paid ? (
                                <Badge
                                  variant="outline"
                                  className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1 whitespace-nowrap"
                                >
                                  <CheckCircle2 className="h-3 w-3" /> مدفوع
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1 whitespace-nowrap"
                                >
                                  <XCircle className="h-3 w-3" /> غير مدفوع
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="gap-1.5 h-8 bg-primary hover:bg-primary/90 text-primary-foreground whitespace-nowrap"
                                  onClick={() => handlePrintFarmerInvoice(st)}
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                  فاتورة
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleInvoicePaid(st.memberId)}
                                  disabled={isToggling}
                                  className={
                                    paid
                                      ? 'h-8 text-xs whitespace-nowrap'
                                      : 'h-8 text-xs whitespace-nowrap border-emerald-600 text-emerald-600 hover:bg-emerald-50'
                                  }
                                >
                                  {isToggling ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : paid ? (
                                    'إلغاء الدفع'
                                  ) : (
                                    'تحديد كمدفوع'
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleShareStatement(st)}
                                  title="مشاركة عبر واتساب"
                                >
                                  <Send className="h-3.5 w-3.5 text-emerald-600" />
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
                          {memberStatements
                            .reduce((s, st) => s + st.totalLiters, 0)
                            .toLocaleString()}
                        </TableCell>
                        <TableCell></TableCell>
                        <TableCell className="font-mono">
                          {memberStatements
                            .reduce((s, st) => s + st.grossAmount, 0)
                            .toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                        </TableCell>
                        <TableCell className="font-mono text-destructive">
                          {memberStatements
                            .reduce((s, st) => s + st.transportCost, 0)
                            .toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                        </TableCell>
                        <TableCell className="font-mono text-primary">
                          {totalMembersNet.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          {currency}
                        </TableCell>
                        <TableCell colSpan={2}>
                          <span className="text-xs text-muted-foreground font-normal">
                            {memberStatements.filter((st) => getInvoicePaid(st.memberId)).length}/
                            {memberStatements.length} مدفوع
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
                {
                  label: 'حليب مسلَّم',
                  value: stockBalance.deliveredLiters,
                  color: 'text-emerald-600',
                },
                {
                  label: 'الفرق',
                  value: stockBalance.balanceLiters,
                  color: stockBalance.balanceLiters >= 0 ? 'text-amber-600' : 'text-destructive',
                },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="pt-4 text-center">
                    <div className={`text-2xl font-bold font-mono ${s.color}`}>
                      {s.value.toLocaleString()} ل
                    </div>
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
                      ) : (
                        companyDeliveries.map((d) => (
                          <TableRow key={d.companyName}>
                            <TableCell className="font-medium">{d.companyName}</TableCell>
                            <TableCell className="font-mono font-bold text-emerald-600">
                              {d.liters.toLocaleString()}
                            </TableCell>
                            <TableCell className="font-mono font-bold">
                              {d.amount.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{' '}
                              {currency}
                            </TableCell>
                            <TableCell className="text-left">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 h-7 text-xs border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground"
                                onClick={() => handlePrintCompanyInvoice(d.companyName)}
                              >
                                <Printer className="h-3 w-3" />
                                فاتورة
                              </Button>
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
                            {totalCompanyAmount.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{' '}
                            {currency}
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── TAB: ADVANCED ─── */}
        <TabsContent value="advanced">
          <div className="space-y-6">
            {/* ── Individual farmer report ── */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle>التقرير الشهري للمنخرط</CardTitle>
                  {farmerReport && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={handleExportFarmerPdf}
                      >
                        <FileText className="h-3.5 w-3.5" /> PDF
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={handleExportFarmerExcel}
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={handleShareFarmerReport}
                      >
                        <Send className="h-3.5 w-3.5" /> واتساب
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-w-sm">
                  <Label>اختر المنخرط</Label>
                  <Select value={selectedFarmerIdReport} onValueChange={setSelectedFarmerIdReport}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="اختر منخرطاً..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allMembersSorted.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {farmerReport && (
                  <div className="space-y-4 pt-2">
                    {/* Summary card */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        {
                          label: 'اسم المنخرط',
                          value: farmerReport.member.fullName,
                          highlight: false,
                        },
                        { label: 'اسم المركز', value: settings?.coopName || '—', highlight: false },
                        {
                          label: 'مجموع اللترات',
                          value: `${farmerReport.totalLiters.toFixed(1)} ل`,
                          highlight: true,
                        },
                        {
                          label: 'مبلغ النقل المخصوم',
                          value: `${farmerReport.transportCost.toFixed(2)} ${currency}`,
                          highlight: false,
                        },
                        {
                          label: 'الصافي الإجمالي',
                          value: `${farmerReport.netAmount.toFixed(2)} ${currency}`,
                          highlight: true,
                        },
                        {
                          label: 'قيمة شراء الحليب',
                          value: `${farmerReport.purchaseValue.toFixed(2)} ${currency}`,
                          highlight: false,
                        },
                        {
                          label: 'قيمة بيع الحليب',
                          value: `${farmerReport.sellValue.toFixed(2)} ${currency}`,
                          highlight: false,
                        },
                        {
                          label: 'الربح المتوقع',
                          value: `${farmerReport.profit.toFixed(2)} ${currency}`,
                          highlight: false,
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className={`rounded-lg border p-3 ${item.highlight ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/20'}`}
                        >
                          <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                          <p
                            className={`font-bold text-sm font-mono ${item.highlight ? 'text-primary' : ''}`}
                          >
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Receipts detail table */}
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>التاريخ</TableHead>
                            <TableHead>الكمية (ل)</TableHead>
                            <TableHead>الثمن/ل</TableHead>
                            <TableHead>الإجمالي</TableHead>
                            <TableHead>النقل</TableHead>
                            <TableHead>الصافي</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {farmerReport.farmerReceipts
                            .slice()
                            .sort((a, b) => a.date.localeCompare(b.date))
                            .map((r) => {
                              const price = r.pricePerLiter ?? priceForMonth(prices, monthFilter);
                              const gross = r.quantityLiters * price;
                              const transport = r.transportCost ?? 0;
                              return (
                                <TableRow key={r.id}>
                                  <TableCell className="font-mono text-sm" dir="ltr">
                                    {r.date}
                                  </TableCell>
                                  <TableCell className="font-mono">
                                    {r.quantityLiters.toFixed(1)}
                                  </TableCell>
                                  <TableCell className="font-mono">{price.toFixed(2)}</TableCell>
                                  <TableCell className="font-mono">{gross.toFixed(2)}</TableCell>
                                  <TableCell className="font-mono text-destructive">
                                    {transport > 0 ? transport.toFixed(2) : '—'}
                                  </TableCell>
                                  <TableCell className="font-mono font-semibold text-primary">
                                    {(gross - transport).toFixed(2)}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {selectedFarmerIdReport && !farmerReport && (
                  <p className="text-center py-8 text-muted-foreground">
                    لا توجد بيانات لهذا المنخرط في الفترة المحددة
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
