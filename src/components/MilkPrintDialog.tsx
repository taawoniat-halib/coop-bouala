import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Printer, Send, X } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { shareOnWhatsApp } from '@/lib/exportUtils';

interface Receipt {
  id: string;
  memberId: string;
  date: string;
  quantityLiters: number;
  pricePerLiter?: number;
  fat?: number;
  transportCost?: number;
  notes?: string;
}

interface MilkPrintDialogProps {
  receipts: Receipt[];
  dateLabel: string;
  getMemberName: (id: string) => string;
  currency: string;
  coopName?: string;
}

export function MilkPrintDialog({
  receipts,
  dateLabel,
  getMemberName,
  currency,
  coopName = 'تعاونية كوب بوعلا',
}: MilkPrintDialogProps) {
  const [open, setOpen] = useState(false);
  const totalQuantity = receipts.reduce((sum, r) => sum + r.quantityLiters, 0);
  const totalGross = receipts.reduce(
    (sum, r) => sum + (r.pricePerLiter ? r.quantityLiters * r.pricePerLiter : 0),
    0,
  );
  const totalTransport = receipts.reduce((sum, r) => sum + (r.transportCost ?? 0), 0);

  const handlePrint = () => {
    const printedOn = new Date().toLocaleDateString('ar-MA-u-nu-latn', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    const rowsHtml = receipts
      .sort((a, b) => getMemberName(a.memberId).localeCompare(getMemberName(b.memberId), 'ar'))
      .map((r, i) => {
        const gross = r.pricePerLiter ? r.quantityLiters * r.pricePerLiter : 0;
        return `
        <tr class="${i % 2 === 1 ? 'even' : ''}">
          <td class="name">${getMemberName(r.memberId)}</td>
          <td class="num bold">${r.quantityLiters.toLocaleString('fr-MA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
          <td class="num">${r.pricePerLiter ? r.pricePerLiter.toFixed(2) : '—'}</td>
          <td class="num">${r.fat ? r.fat + '%' : '—'}</td>
          <td class="num red">${r.transportCost ? r.transportCost.toFixed(2) : '—'}</td>
          <td class="num green">${gross > 0 ? gross.toFixed(2) : '—'}</td>
          <td class="notes">${r.notes || ''}</td>
        </tr>`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>سجل استلام الحليب — ${dateLabel}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, 'Segoe UI', sans-serif; font-size: 11px; color: #111; background: #fff; padding: 16px 18px; direction: rtl; }
  @page { size: A4; margin: 1cm; }

  .hdr { display:flex; align-items:center; justify-content:space-between; border-bottom:2.5px solid #15803d; padding-bottom:8px; margin-bottom:10px; }
  .hdr-title { font-size:15px; font-weight:800; color:#15803d; }
  .hdr-sub { font-size:10px; color:#555; margin-top:2px; }
  .hdr-date { font-size:10px; color:#333; text-align:left; }

  table { width:100%; border-collapse:collapse; margin-bottom:10px; font-size:10.5px; }
  thead tr { background:#15803d; color:#fff; }
  thead th { padding:7px 5px; text-align:center; font-weight:700; }
  th.name { text-align:right; padding-right:8px; }
  tbody td { padding:6px 5px; border-bottom:1px solid #e5e7eb; text-align:center; vertical-align:middle; }
  td.name { text-align:right; padding-right:8px; font-weight:500; }
  td.num { font-family: 'Courier New', monospace; }
  td.bold { font-weight:700; }
  td.red { color:#dc2626; }
  td.green { color:#15803d; font-weight:700; }
  td.notes { font-size:9.5px; color:#666; text-align:right; }
  tr.even { background:#f9fafb; }

  .summary { background:#dcfce7; border:1.5px solid #15803d; border-radius:8px; padding:10px 16px; display:flex; gap:24px; justify-content:center; align-items:center; margin-bottom:10px; flex-wrap:wrap; }
  .sum-item { text-align:center; }
  .sum-label { font-size:9px; color:#555; margin-bottom:2px; }
  .sum-val { font-size:15px; font-weight:800; color:#15803d; font-family:'Courier New',monospace; }

  .footer { text-align:center; font-size:9px; color:#aaa; border-top:1px solid #e5e7eb; padding-top:6px; margin-top:4px; }
  @media print { body { padding:4px; } }
</style>
</head>
<body>
<div class="hdr">
  <div>
    <div class="hdr-title">${coopName}</div>
    <div class="hdr-sub">سجل استلام الحليب — ${dateLabel}</div>
  </div>
  <div class="hdr-date">طُبع: ${printedOn}<br>عدد المنخرطين: ${receipts.length}</div>
</div>

<table>
  <thead>
    <tr>
      <th class="name">المنخرط</th>
      <th>الكمية (ل)</th>
      <th>الثمن/ل</th>
      <th>الدهن%</th>
      <th>ثمن النقل</th>
      <th>الإجمالي (${currency === 'MAD' ? 'درهم' : (currency || 'درهم')})</th>
      <th>ملاحظات</th>
    </tr>
  </thead>
  <tbody>
    ${rowsHtml}
    <tr style="background:#dcfce7;font-weight:800;border-top:2px solid #15803d;">
      <td class="name">المجموع</td>
      <td class="num bold">${totalQuantity.toLocaleString('fr-MA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
      <td></td>
      <td></td>
      <td class="num red">${totalTransport > 0 ? totalTransport.toFixed(2) : '—'}</td>
      <td class="num green">${totalGross > 0 ? totalGross.toFixed(2) : '—'}</td>
      <td></td>
    </tr>
  </tbody>
</table>

<div class="summary">
  <div class="sum-item">
    <div class="sum-label">إجمالي الكمية</div>
    <div class="sum-val">${totalQuantity.toLocaleString('fr-MA', { minimumFractionDigits: 1 })} لتر</div>
  </div>
  ${totalGross > 0 ? `
  <div class="sum-item">
    <div class="sum-label">إجمالي المبلغ</div>
    <div class="sum-val">${totalGross.toFixed(2)} ${currency === 'MAD' ? 'DH' : (currency || 'DH')}</div>
  </div>` : ''}
  ${totalTransport > 0 ? `
  <div class="sum-item">
    <div class="sum-label">إجمالي النقل</div>
    <div class="sum-val" style="color:#dc2626">${totalTransport.toFixed(2)} ${currency === 'MAD' ? 'DH' : (currency || 'DH')}</div>
  </div>` : ''}
</div>

<div class="footer">
  ${coopName} — سجل استلام الحليب اليومي — ${dateLabel}<br>
  طُبع بتاريخ ${printedOn}
</div>
</body></html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      alert('⚠️ تم حجب النافذة المنبثقة.\nيرجى السماح بالنوافذ المنبثقة لهذا الموقع ثم المحاولة مجدداً.');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    const printOnce = () => { if (!(win as unknown as Record<string, unknown>).__p) { (win as unknown as Record<string, unknown>).__p = true; win.print(); } };
    win.onload = () => setTimeout(printOnce, 350);
    setTimeout(() => { if (!win.closed) printOnce(); }, 1500);
  };

  const handleWhatsApp = () => {
    const lines = [
      `🥛 *سجل استلام الحليب — ${dateLabel}*`,
      '',
      ...receipts
        .sort((a, b) => getMemberName(a.memberId).localeCompare(getMemberName(b.memberId), 'ar'))
        .map(
          (r) =>
            `• ${getMemberName(r.memberId)}: *${r.quantityLiters} لتر*${
              r.pricePerLiter
                ? ` — ${(r.quantityLiters * r.pricePerLiter).toFixed(2)} ${currency === 'MAD' ? 'درهم' : (currency || 'درهم')}`
                : ''
            }`,
        ),
      '',
      `📦 *إجمالي الكمية: ${totalQuantity.toLocaleString('fr-MA', { minimumFractionDigits: 1 })} لتر*`,
    ];
    shareOnWhatsApp(lines.join('\n'));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <Printer className="h-4 w-4" /> طباعة سجل اليوم
      </Button>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" />
            معاينة سجل الحليب — {dateLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-x-auto rounded-lg border">
          <Table className="text-sm">
            <TableHeader>
              <TableRow className="bg-primary hover:bg-primary">
                <TableHead className="text-primary-foreground">المنخرط</TableHead>
                <TableHead className="text-primary-foreground text-center">الكمية (ل)</TableHead>
                <TableHead className="text-primary-foreground text-center">الثمن/ل</TableHead>
                <TableHead className="text-primary-foreground text-center">الدهن %</TableHead>
                <TableHead className="text-primary-foreground text-center">ثمن النقل</TableHead>
                <TableHead className="text-primary-foreground text-center">الإجمالي</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts
                .sort((a, b) => getMemberName(a.memberId).localeCompare(getMemberName(b.memberId), 'ar'))
                .map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{getMemberName(r.memberId)}</TableCell>
                    <TableCell className="font-mono font-bold text-center">
                      {r.quantityLiters.toFixed(1)}
                    </TableCell>
                    <TableCell className="font-mono text-center">
                      {r.pricePerLiter ? r.pricePerLiter.toFixed(2) : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-center">
                      {r.fat ? `${r.fat}%` : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-center text-destructive">
                      {r.transportCost ? r.transportCost.toFixed(2) : '—'}
                    </TableCell>
                    <TableCell className="font-mono font-bold text-center text-primary">
                      {r.pricePerLiter
                        ? (r.quantityLiters * r.pricePerLiter).toFixed(2)
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              <TableRow className="bg-emerald-50 border-t-2 border-primary font-bold">
                <TableCell>المجموع</TableCell>
                <TableCell className="font-mono text-center font-bold text-blue-700">
                  {totalQuantity.toLocaleString('fr-MA', { minimumFractionDigits: 1 })} ل
                </TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="font-mono text-center text-destructive">
                  {totalTransport > 0 ? totalTransport.toFixed(2) : '—'}
                </TableCell>
                <TableCell className="font-mono text-center font-bold text-primary">
                  {totalGross > 0 ? totalGross.toFixed(2) : '—'}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200 text-center">
          <span className="text-2xl font-bold font-mono text-emerald-700">
            {totalQuantity.toLocaleString('fr-MA', { minimumFractionDigits: 1 })} لتر
          </span>
          <p className="text-xs text-muted-foreground mt-1">إجمالي الكمية المستلمة اليوم</p>
        </div>

        <DialogFooter className="flex gap-2 flex-row-reverse">
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" /> طباعة الآن
          </Button>
          <Button
            onClick={handleWhatsApp}
            variant="outline"
            className="gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
          >
            <Send className="h-4 w-4" /> إرسال عبر واتساب
          </Button>
          <Button onClick={() => setOpen(false)} variant="ghost" className="gap-2">
            <X className="h-4 w-4" /> إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
