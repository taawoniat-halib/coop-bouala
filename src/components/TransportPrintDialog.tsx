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

interface TransportPrintDialogProps {
  receipts: Receipt[];
  dateLabel: string;
  getMemberName: (id: string) => string;
  currency: string;
}

export function TransportPrintDialog({
  receipts,
  dateLabel,
  getMemberName,
  currency,
}: TransportPrintDialogProps) {
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
          <title>طباعة سجل تكاليف النقل</title>
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
              border-bottom: 2px solid #d97706;
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
              background-color: #fef3c7;
              border: 1px solid #ddd;
              padding: 10px;
              text-align: right;
              font-weight: bold;
              color: #d97706;
            }
            td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: right;
            }
            tr:nth-child(even) {
              background-color: #fffbeb;
            }
            .total-row {
              background-color: #fed7aa;
              font-weight: bold;
            }
            .total-transport {
              font-size: 16px;
              text-align: center;
              margin-top: 20px;
              padding: 15px;
              background-color: #fef3c7;
              border-radius: 5px;
              color: #d97706;
              font-weight: bold;
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
            <h2>🚚 سجل تكاليف النقل</h2>
            <div class="date-info">التاريخ: ${dateLabel}</div>
            ${printContent}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const receiptWithTransport = receipts.filter((r) => r.transportCost && r.transportCost > 0);
  const totalTransport = receiptWithTransport.reduce((sum, r) => sum + (r.transportCost || 0), 0);

  const handleWhatsApp = () => {
    const lines = [
      `*سجل تكاليف النقل — ${dateLabel}*`,
      '',
      ...receiptWithTransport.map(
        (r) => `${getMemberName(r.memberId)}: ${r.transportCost?.toFixed(2)} ${currency}`,
      ),
      '',
      `إجمالي النقل: ${totalTransport.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`,
    ];
    shareOnWhatsApp(lines.join('\n'));
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 print-btn-transport border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100">
          <Printer className="h-4 w-4" /> طباعة النقل
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>معاينة قبل الطباعة - سجل تكاليف النقل</DialogTitle>
        </DialogHeader>

        <div ref={printRef} className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المنخرط</TableHead>
                  <TableHead>الكمية (لتر)</TableHead>
                  <TableHead>ثمن النقل ({currency})</TableHead>
                  <TableHead>الملاحظات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receiptWithTransport.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      لا توجد تكاليف نقل لهذا اليوم
                    </TableCell>
                  </TableRow>
                ) : (
                  receiptWithTransport.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{getMemberName(r.memberId)}</TableCell>
                      <TableCell className="font-mono">{r.quantityLiters}</TableCell>
                      <TableCell className="font-mono font-bold text-amber-700">
                        {r.transportCost?.toFixed(2)} {currency}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.notes || '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {receiptWithTransport.length > 0 && (
            <div className="bg-amber-50 p-4 rounded-md border border-amber-200">
              <div className="font-bold text-lg text-amber-700">
                إجمالي النقل: {totalTransport.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline">إلغاء</Button>
          <Button
            onClick={handleWhatsApp}
            variant="outline"
            className="gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
            disabled={receiptWithTransport.length === 0}
          >
            <Send className="h-4 w-4" /> إرسال عبر واتساب
          </Button>
          <Button 
            onClick={handlePrint} 
            className="gap-2 bg-amber-600 hover:bg-amber-700"
            disabled={receiptWithTransport.length === 0}
          >
            <Printer className="h-4 w-4" /> طباعة الآن
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
