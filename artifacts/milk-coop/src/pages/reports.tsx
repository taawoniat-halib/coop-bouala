import { Layout } from '@/components/Layout';
import { 
  useMembers, 
  useMilkReceived, 
  useTransporters, 
  usePrices,
  useMilkDelivered
} from '@/hooks/useData';
import { useSettings } from '@/hooks/useSettings';
import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { 
  computeMemberMonthlyStatements, 
  deliveredByCompany, 
  monthKey 
} from '@/lib/calculations';
import { 
  exportToPdf, 
  exportToExcel, 
  printPage, 
  shareOnWhatsApp 
} from '@/lib/exportUtils';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Printer, FileSpreadsheet, Download, Send, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Reports() {
  const { data: members } = useMembers();
  const { data: receipts } = useMilkReceived();
  const { data: transporters } = useTransporters();
  const { data: prices } = usePrices();
  const { data: deliveries } = useMilkDelivered();
  const { settings } = useSettings();
  
  const [monthFilter, setMonthFilter] = useState(monthKey(format(new Date(), 'yyyy-MM-dd')));
  const [activeTab, setActiveTab] = useState('members');
  const currency = settings?.currency === 'MAD' ? 'درهم' : settings?.currency;

  const memberStatements = useMemo(() => {
    return computeMemberMonthlyStatements(members, receipts, transporters, prices, monthFilter)
      .filter(st => st.totalLiters > 0)
      .sort((a, b) => b.totalLiters - a.totalLiters);
  }, [members, receipts, transporters, prices, monthFilter]);

  const companyDeliveries = useMemo(() => {
    return deliveredByCompany(deliveries, monthFilter)
      .sort((a, b) => b.liters - a.liters);
  }, [deliveries, monthFilter]);

  const totalMembersNet = memberStatements.reduce((sum, st) => sum + st.netAmount, 0);
  const totalCompanyAmount = companyDeliveries.reduce((sum, d) => sum + d.amount, 0);

  const handleExportMembersPdf = () => {
    exportToPdf(
      `مستحقات الاعضاء - ${monthFilter}`,
      [
        { header: 'الصافي', key: 'netAmount' },
        { header: 'اقتطاع النقل', key: 'transportCost' },
        { header: 'الاجمالي', key: 'grossAmount' },
        { header: 'الثمن/لتر', key: 'pricePerLiter' },
        { header: 'الكمية (لتر)', key: 'totalLiters' },
        { header: 'العضو', key: 'memberName' },
      ],
      memberStatements.map(st => ({
        ...st,
        netAmount: `${st.netAmount.toFixed(2)} ${currency}`,
        transportCost: `${st.transportCost.toFixed(2)} ${currency}`,
        grossAmount: `${st.grossAmount.toFixed(2)} ${currency}`,
        pricePerLiter: `${st.pricePerLiter} ${currency}`
      })),
      `member-statements-${monthFilter}`
    );
  };

  const handleExportMembersExcel = () => {
    exportToExcel(
      'المستحقات',
      [
        { header: 'العضو', key: 'memberName' },
        { header: 'الكمية (لتر)', key: 'totalLiters' },
        { header: 'الثمن/لتر', key: 'pricePerLiter' },
        { header: 'المبلغ الإجمالي', key: 'grossAmount' },
        { header: 'اقتطاع النقل', key: 'transportCost' },
        { header: 'المبلغ الصافي', key: 'netAmount' },
      ],
      memberStatements,
      `member-statements-${monthFilter}`
    );
  };

  const handleShareStatement = (st: any) => {
    const member = members.find(m => m.id === st.memberId);
    const phone = member?.phone || settings?.phone;
    
    const message = `مرحباً ${st.memberName}،
تفاصيل حسابك لشهر ${monthFilter} لدى ${settings?.coopName}:
- الكمية المسلمة: ${st.totalLiters} لتر
- ثمن اللتر: ${st.pricePerLiter} ${currency}
- المبلغ الإجمالي: ${st.grossAmount.toFixed(2)} ${currency}
- اقتطاع النقل: ${st.transportCost.toFixed(2)} ${currency}
-----------------
المبلغ الصافي: ${st.netAmount.toFixed(2)} ${currency}

شكراً لتعاملكم معنا.`;

    shareOnWhatsApp(message, phone);
  };

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            التقارير <FileText className="h-6 w-6 text-muted-foreground" />
          </h2>
          <p className="text-muted-foreground mt-1">كشوفات الأعضاء وتفاصيل التسليم الشهري</p>
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="members" className="text-base px-6">مستحقات الأعضاء</TabsTrigger>
          <TabsTrigger value="companies" className="text-base px-6">مبيعات الشركات</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg font-bold">
              إجمالي المستحقات: {totalMembersNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleExportMembersExcel} className="gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel
              </Button>
              <Button variant="outline" onClick={handleExportMembersPdf} className="gap-2">
                <Download className="h-4 w-4 text-destructive" /> PDF
              </Button>
              <Button variant="outline" onClick={printPage} className="gap-2">
                <Printer className="h-4 w-4" /> طباعة
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>العضو</TableHead>
                  <TableHead>الكمية (لتر)</TableHead>
                  <TableHead>الثمن للتر</TableHead>
                  <TableHead>المبلغ الإجمالي</TableHead>
                  <TableHead className="text-destructive">اقتطاع النقل</TableHead>
                  <TableHead className="text-emerald-600 font-bold">المبلغ الصافي</TableHead>
                  <TableHead className="text-left print:hidden">مراسلة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberStatements.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا يوجد مستحقات لهذا الشهر</TableCell></TableRow>
                ) : (
                  memberStatements.map(st => (
                    <TableRow key={st.memberId}>
                      <TableCell className="font-medium">{st.memberName}</TableCell>
                      <TableCell className="font-mono">{st.totalLiters}</TableCell>
                      <TableCell className="font-mono">{st.pricePerLiter} {currency}</TableCell>
                      <TableCell className="font-mono">{st.grossAmount.toFixed(2)}</TableCell>
                      <TableCell className="font-mono text-destructive">{st.transportCost.toFixed(2)}</TableCell>
                      <TableCell className="font-mono font-bold text-emerald-600 bg-emerald-500/5">{st.netAmount.toFixed(2)} {currency}</TableCell>
                      <TableCell className="text-left print:hidden">
                        <Button variant="ghost" size="sm" onClick={() => handleShareStatement(st)} className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10">
                          <Send className="h-4 w-4 ml-2" /> إرسال
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="companies" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="bg-muted/20 border-b">
                <CardTitle className="text-lg">مداخيل الشركات للشهر</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الشركة</TableHead>
                      <TableHead>الكمية (لتر)</TableHead>
                      <TableHead className="text-left">المبلغ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companyDeliveries.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">لا توجد تسليمات للشركات في هذا الشهر</TableCell></TableRow>
                    ) : (
                      companyDeliveries.map(c => (
                        <TableRow key={c.companyName}>
                          <TableCell className="font-medium">{c.companyName}</TableCell>
                          <TableCell className="font-mono">{c.liters.toLocaleString()}</TableCell>
                          <TableCell className="text-left font-mono font-bold text-primary">
                            {c.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                    {companyDeliveries.length > 0 && (
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell>المجموع</TableCell>
                        <TableCell className="font-mono">{companyDeliveries.reduce((s, c) => s + c.liters, 0).toLocaleString()}</TableCell>
                        <TableCell className="text-left font-mono text-primary">
                          {totalCompanyAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-primary text-lg">الخلاصة المالية للشهر</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center border-b border-primary/10 pb-2">
                  <span className="text-muted-foreground">مداخيل الشركات (مبيعات):</span>
                  <span className="font-mono font-bold text-lg">{totalCompanyAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}</span>
                </div>
                <div className="flex justify-between items-center border-b border-primary/10 pb-2">
                  <span className="text-muted-foreground">مستحقات الأعضاء (مشتريات):</span>
                  <span className="font-mono font-bold text-lg text-destructive">{totalMembersNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="font-bold">الهامش الإجمالي التقريبي:</span>
                  <span className={`font-mono font-bold text-2xl ${totalCompanyAmount - totalMembersNet >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                    {(totalCompanyAmount - totalMembersNet).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  * هذا الهامش لا يشمل المصاريف والمداخيل الأخرى المسجلة في قسم الميزانية.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
