import jsPDF from 'jspdf';
  import autoTable from 'jspdf-autotable';
  import * as XLSX from 'xlsx';
  import { saveAs } from 'file-saver';

  export interface ExportColumn { header: string; key: string; }

  export function printPage() { window.print(); }

  export function exportToPdf(
    title: string, columns: ExportColumn[],
    rows: Record<string, string | number>[], fileName: string,
  ) {
    const docPdf = new jsPDF();
    docPdf.setFontSize(14);
    docPdf.text(title, 14, 15);
    autoTable(docPdf, {
      startY: 22,
      head: [columns.map((c) => c.header)],
      body: rows.map((row) => columns.map((c) => String(row[c.key] ?? ''))),
      styles: { font: 'helvetica', fontSize: 9 },
      headStyles: { fillColor: [37, 99, 235] },
    });
    docPdf.save(`${fileName}.pdf`);
  }

  export function exportToExcel(
    sheetName: string, columns: ExportColumn[],
    rows: Record<string, string | number>[], fileName: string,
  ) {
    const worksheet = XLSX.utils.json_to_sheet(
      rows.map((row) => Object.fromEntries(columns.map((c) => [c.header, row[c.key] ?? '']))),
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `${fileName}.xlsx`);
  }

  export function buildWhatsAppShareUrl(message: string, phone?: string) {
    const encoded = encodeURIComponent(message);
    return phone ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  }

  export function shareOnWhatsApp(message: string, phone?: string) {
    window.open(buildWhatsAppShareUrl(message, phone), '_blank');
  }

  // ── Professional Arabic invoice for a farmer ─────────────────────────

  export interface FarmerInvoiceReceipt {
    date: string; // YYYY-MM-DD
    quantityLiters: number;
    pricePerLiter?: number;
    transportCost?: number;
    fat?: number;
    notes?: string;
  }

  export interface FarmerInvoiceData {
    farmerName: string;
    month: string; // YYYY-MM
    receipts: FarmerInvoiceReceipt[];
    monthlyPricePerLiter: number;
    coopName: string;
    logoUrl?: string;
    currency: string;
  }

  const MONTH_NAMES_AR = [
    'يناير','فبراير','مارس','أبريل','ماي','يونيو',
    'يوليوز','غشت','شتنبر','أكتوبر','نونبر','دجنبر',
  ];

  function fmt(n: number, dec = 2) {
    return n.toLocaleString('fr-MA', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  /** Convert a remote image URL to a base64 data-URL so it can be embedded
   *  in a detached print window without relying on cross-origin network timing. */
  async function urlToBase64(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      // If fetch fails (e.g. CORS), return empty string → logo hidden gracefully
      return '';
    }
  }

  export async function printFarmerInvoice(data: FarmerInvoiceData): Promise<void> {
    const { farmerName, month, receipts, monthlyPricePerLiter, coopName, logoUrl, currency } = data;

    // ── Pre-load logo as base64 so it renders correctly in the print window ──
    let logoBase64 = '';
    if (logoUrl) {
      logoBase64 = await urlToBase64(logoUrl);
    }

    const sorted = [...receipts].sort((a, b) => a.date.localeCompare(b.date));
    const rows = sorted.map(r => {
      const price = r.pricePerLiter ?? monthlyPricePerLiter;
      const gross = r.quantityLiters * price;
      const transport = r.transportCost ?? 0;
      const net = gross - transport;
      const day = r.date.split('-')[2];
      return { day, qty: r.quantityLiters, price, gross, transport, net, fat: r.fat, notes: r.notes || '' };
    });

    const totalQty = rows.reduce((s, r) => s + r.qty, 0);
    const totalGross = rows.reduce((s, r) => s + r.gross, 0);
    const totalTransport = rows.reduce((s, r) => s + r.transport, 0);
    const totalNet = rows.reduce((s, r) => s + r.net, 0);

    const [year, monthNum] = month.split('-');
    const monthLabel = `${MONTH_NAMES_AR[parseInt(monthNum) - 1]} ${year}`;

    const rowsHtml = rows.length === 0
      ? `<tr><td colspan="7" style="text-align:center;padding:20px;color:#888;">لا توجد استلامات مسجلة لهذا الشهر</td></tr>`
      : rows.map(r => `
        <tr>
          <td>${r.day}</td>
          <td class="num">${fmt(r.qty, 1)}</td>
          <td class="num">${fmt(r.price)}</td>
          <td class="num">${fmt(r.gross)}</td>
          <td class="num deduct">${r.transport > 0 ? fmt(r.transport) : '—'}</td>
          <td class="num net">${fmt(r.net)}</td>
          <td class="note">${r.fat !== undefined ? r.fat + '%' : ''} ${r.notes}</td>
        </tr>
      `).join('');

    // Use base64 logo so the image is embedded and loads instantly
    const logoHtml = logoBase64
      ? `<img src="${logoBase64}" alt="logo" class="logo" />`
      : '';

    const printedOn = new Date().toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric' });

    const html = `<!DOCTYPE html>
  <html dir="rtl" lang="ar">
  <head>
    <meta charset="UTF-8">
    <title>كشف حساب — ${farmerName} — ${month}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, Tahoma, sans-serif; font-size: 13px; color: #111; background: #fff; padding: 24px; direction: rtl; }
      .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #166534; padding-bottom: 14px; margin-bottom: 18px; }
      .logo { width: 70px; height: 70px; object-fit: contain; border-radius: 10px; }
      .coop-name { font-size: 24px; font-weight: bold; color: #166534; }
      .invoice-title { font-size: 13px; color: #666; margin-top: 4px; }
      .meta { display: flex; justify-content: space-between; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px 20px; margin-bottom: 18px; }
      .meta-item label { font-size: 11px; color: #555; display: block; margin-bottom: 3px; }
      .meta-item span { font-size: 16px; font-weight: bold; color: #166534; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 12px; }
      thead tr { background: #166534; color: white; }
      thead th { padding: 9px 7px; text-align: center; font-weight: bold; }
      tbody tr:nth-child(even) { background: #f9fafb; }
      tbody td { padding: 8px 7px; text-align: center; border-bottom: 1px solid #e5e7eb; }
      .num { font-family: 'Courier New', monospace; }
      .net { font-weight: bold; color: #166534; }
      .deduct { color: #dc2626; }
      .note { font-size: 11px; color: #666; text-align: right; }
      .totals-row { background: #dcfce7 !important; font-weight: bold; border-top: 2px solid #166534; }
      .totals-row td { padding: 10px 7px; }
      .summary { border: 2px solid #166534; border-radius: 10px; padding: 16px 24px; margin-bottom: 24px; background: #f0fdf4; text-align: center; }
      .net-label { font-size: 13px; color: #555; margin-bottom: 6px; }
      .net-amount { font-size: 32px; font-weight: bold; color: #166534; }
      .signatures { display: flex; justify-content: space-between; margin-top: 32px; gap: 48px; }
      .sig-box { flex: 1; text-align: center; border-top: 1px solid #999; padding-top: 10px; font-size: 12px; color: #555; line-height: 2.5; }
      .footer { text-align: center; font-size: 10px; color: #aaa; margin-top: 24px; border-top: 1px solid #eee; padding-top: 10px; }
      @media print { body { padding: 8px; } @page { margin: 1cm; size: A4; } }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <div class="coop-name">${coopName}</div>
        <div class="invoice-title">كشف حساب استلام الحليب</div>
      </div>
      ${logoHtml}
    </div>

    <div class="meta">
      <div class="meta-item"><label>الفلاح</label><span>${farmerName}</span></div>
      <div class="meta-item"><label>الشهر</label><span>${monthLabel}</span></div>
      <div class="meta-item"><label>مجموع الكمية</label><span>${fmt(totalQty, 1)} لتر</span></div>
      <div class="meta-item"><label>عدد التسليمات</label><span>${rows.length} يوم</span></div>
    </div>

    <table>
      <thead>
        <tr>
          <th>اليوم</th><th>الكمية (ل)</th><th>الثمن/ل</th>
          <th>الإجمالي</th><th>اقتطاع النقل</th><th>الصافي</th><th>ملاحظات</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        ${rows.length > 0 ? `<tr class="totals-row">
          <td>المجموع</td>
          <td class="num">${fmt(totalQty, 1)}</td>
          <td></td>
          <td class="num">${fmt(totalGross)}</td>
          <td class="num deduct">${totalTransport > 0 ? fmt(totalTransport) : '—'}</td>
          <td class="num net">${fmt(totalNet)}</td>
          <td></td>
        </tr>` : ''}
      </tbody>
    </table>

    <div class="summary">
      <div class="net-label">المبلغ الصافي المستحق للفلاح</div>
      <div class="net-amount">${fmt(totalNet)} ${currency}</div>
    </div>

    <div class="signatures">
      <div class="sig-box">توقيع الفلاح<br><br><br>${farmerName}</div>
      <div class="sig-box">ختم وتوقيع التعاونية<br><br><br>${coopName}</div>
    </div>

    <div class="footer">طُبع بتاريخ ${printedOn}</div>
  </body>
  </html>`;

    const win = window.open('', '_blank', 'width=900,height=750');
    if (!win) {
      alert('⚠️ تم حجب النافذة المنبثقة من طرف المتصفح.\nيرجى السماح بالنوافذ المنبثقة لهذا الموقع ثم المحاولة مجدداً.');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    // Wait for the document to fully render before triggering print
    win.onload = () => {
      setTimeout(() => win.print(), 300);
    };
    // Fallback: if onload already fired (some browsers), use a longer delay
    setTimeout(() => {
      if (!win.closed) {
        // Only call print if onload hasn't already triggered it
        // Using a flag via the window object
        if (!(win as any).__printed) {
          (win as any).__printed = true;
          win.print();
        }
      }
    }, 1500);
  }
