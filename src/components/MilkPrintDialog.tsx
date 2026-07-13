import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Printer, Send } from 'lucide-react';
import { useRef } from 'react';
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
}

export function MilkPrintDialog({
  receipts,
  dateLabel,
  getMemberName,
  currency,
}: MilkPrintDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!printRef.current) return;

    const printWindow = window.open('', '', 'height=600,width=800');
    if (!printWindow) return;

    const printContent = printRef.current.innerHTML;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>طباعة سجل استلام الحليب</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: Arial, sans-serif;
              direction: rtl;
              padding: 20px;
              background: white;
            }
            .print-container {
              max-width: 900px;
              margin: 0 auto;
            }
            h2 {
              text-align: center;
              margin-bottom: 10px;
              font-size: 24px;
              border-bottom: 2px solid #333;
              padding-bottom: 10px;
            }
            .date-info {
              text-align: center;
              margin-bottom: 20px;
              font-size: 14px;
              color: #666;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th {
              background-color: #f0f0f0;
              border: 1px solid #ddd;
              padding: 10px;
              text-align: right;
              font-weight: bold;
            }
            td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: right;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .total-row {
              background-color: #e8f4f8;
              font-weight: bold;
            }
            .total-quantity {
              font-size: 16px;
              text-align: center;
              margin-top: 20px;
              padding: 15px;
              background-color: #f0f0f0;
              border-radius: 5px;
            }
            @media print {
              body {
                padding: 0;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            <h2>📋 سجل استلام الحليب من المنخرطين</h2>
            <div class="date-info">التاريخ: ${dateLabel}</div>
            ${printContent}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();

    // أنتظر قليلاً لتحميل المحتوى
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const totalQuantity = receipts.reduce((sum, r) => sum + r.quantityLiters, 0);

  const handleWhatsApp = () => {
    const lines = [
      `*سجل استلام الحليب من المنخرطين — ${dateLabel}*`,
      '',
      ...receipts.map(
        (r) =>
          `${getMemberName(r.memberId)}: ${r.quantityLiters} لتر${
            r.pricePerLiter ? ` — ${(r.quantityLiters * r.pricePerLiter).toFixed(2)} ${currency}` : ''
          }`,
      ),
      '',
      `إجمالي الكمية: ${totalQuantity.toLocaleString('fr-MA')} لتر`,
    ];
    shareOnWhatsApp(lines.join('\n'));
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 print-btn-milk">
          <Printer className="h-4 w-4" /> طباعة الحليب
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>معاينة قبل الطباعة - سجل الحليب التفصيلي</DialogTitle>
        </DialogHeader>

        <div ref={printRef} className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المنخرط</TableHead>
                  <TableHead>الكمية (لتر)</TableHead>
                  <TableHead>الثمن/لتر ({currency})</TableHead>
                  <TableHead>الدهن %</TableHead>
                  <TableHead>ثمن النقل ({currency})</TableHead>
                  <TableHead>الإجمالي ({currency})</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{getMemberName(r.memberId)}</TableCell>
                    <TableCell className="font-mono font-bold">{r.quantityLiters}</TableCell>
                    <TableCell className="font-mono">
                      {r.pricePerLiter ? r.pricePerLiter.toFixed(2) : '—'}
                    </TableCell>
                    <TableCell className="font-mono">{r.fat ? `${r.fat}%` : '—'}</TableCell>
                    <TableCell className="font-mono">
                      {r.transportCost ? r.transportCost.toFixed(2) : '—'}
                    </TableCell>
                    <TableCell className="font-mono font-bold">
                      {r.pricePerLiter
                        ? (r.quantityLiters * r.pricePerLiter).toFixed(2)
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
            <div className="font-bold text-lg">إجمالي الكمية: {totalQuantity.toLocaleString('fr-MA')} لتر</div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline">إلغاء</Button>
          <Button
            onClick={handleWhatsApp}
            variant="outline"
            className="gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
          >
            <Send className="h-4 w-4" /> إرسال عبر واتساب
          </Button>
          <Button onClick={handlePrint} className="gap-2 bg-primary">
            <Printer className="h-4 w-4" /> طباعة الآن
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
