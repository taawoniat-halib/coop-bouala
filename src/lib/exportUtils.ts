import { MONTH_NAMES_AR, MONTH_NAMES_FR, monthLabel as monthAr, monthLabelFr as monthFr } from '@/lib/calculations';

export interface ExportColumn { header: string; key: string; }

export function printPage() { window.print(); }

export function exportToPdf(
  title: string,
  columns: ExportColumn[],
  rows: Record<string, string | number>[],
  _fileName: string,
) {
  const theadHtml = columns.map((c) => `<th>${c.header}</th>`).join('');
  const tbodyHtml = rows
    .map(
      (row) =>
        `<tr>${columns.map((c) => `<td>${row[c.key] ?? ''}</td>`).join('')}</tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #111; background: #fff; padding: 24px 20px; direction: rtl; }
  h2 { font-size: 16px; font-weight: 800; color: #15803d; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 2px solid #15803d; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead tr { background: #15803d; color: #fff; }
  thead th { padding: 9px 8px; text-align: center; font-weight: 700; }
  tbody tr:nth-child(even) { background: #f9fafb; }
  tbody td { padding: 7px 8px; text-align: center; border-bottom: 1px solid #e5e7eb; }
  tfoot tr { background: #dcfce7; font-weight: 700; border-top: 2px solid #15803d; }
  tfoot td { padding: 9px 8px; text-align: center; }
  .footer { margin-top: 14px; text-align: center; font-size: 10px; color: #aaa; border-top: 1px solid #e5e7eb; padding-top: 8px; }
  @media print { body { padding: 6px; } @page { margin: 1cm; size: A4; } }
</style>
</head>
<body>
<h2>${title}</h2>
<table>
  <thead><tr>${theadHtml}</tr></thead>
  <tbody>${tbodyHtml}</tbody>
</table>
<div class="footer">تعاونية كوب بوعلا — طُبع بتاريخ ${new Date().toLocaleDateString('ar-MA-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    alert('⚠️ تم حجب النافذة المنبثقة.\nيرجى السماح بالنوافذ المنبثقة لهذا الموقع ثم المحاولة مجدداً.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  const printOnce = () => { if (!(win as any).__p) { (win as any).__p = true; win.print(); } };
  win.onload = () => setTimeout(printOnce, 300);
  setTimeout(() => { if (!win.closed) printOnce(); }, 1200);
}

export async function exportToExcel(
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, string | number>[],
  fileName: string,
) {
  const [XLSX, { saveAs }] = await Promise.all([import('xlsx'), import('file-saver')]);

  // aoa_to_sheet guarantees the header row even when rows is empty
  const headerRow = columns.map((c) => c.header);
  const dataRows = rows.map((row) => columns.map((c) => row[c.key] ?? ''));
  const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);

  // Column widths (auto-size: at least 12, up to 30 chars)
  worksheet['!cols'] = columns.map((c) => ({
    wch: Math.min(30, Math.max(12, c.header.length + 4)),
  }));

  // RTL direction for Arabic content
  worksheet['!sheetView'] = [{ rightToLeft: true }] as object[];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `${fileName}.xlsx`);
}

export function buildWhatsAppShareUrl(message: string, phone?: string) {
  const encoded = encodeURIComponent(message);
  return phone
    ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

export function shareOnWhatsApp(message: string, phone?: string) {
  window.open(buildWhatsAppShareUrl(message, phone), '_blank');
}

// ─── Shared helpers ──────────────────────────────────────────────

function currencyLabel(currency: string) {
  return currency === 'MAD' || currency === 'درهم' ? 'DH' : currency;
}
function fmt(n: number, dec = 2) {
  return n.toLocaleString('fr-MA', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
async function urlToBase64(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch { return ''; }
}

/** Shared invoice CSS */
const INVOICE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px;
    color: #111; background: #fff; padding: 20px;
  }
  /* ── Header ── */
  .inv-header {
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 3px solid #15803d; padding-bottom: 12px; margin-bottom: 14px;
  }
  .logo { width: 68px; height: 68px; object-fit: contain; border-radius: 8px; }
  .coop-block { text-align: right; }
  .coop-name { font-size: 20px; font-weight: 800; color: #15803d; direction: rtl; }
  .coop-name-fr { font-size: 11px; color: #555; direction: ltr; margin-top: 1px; }
  .coop-meta { font-size: 10.5px; color: #555; margin-top: 4px; direction: rtl; }
  .inv-num-block { text-align: center; }
  .inv-label { font-size: 11px; color: #888; }
  .inv-num { font-size: 22px; font-weight: 800; color: #15803d; direction: ltr; }
  .inv-date { font-size: 10px; color: #777; margin-top: 3px; }
  /* ── Info row ── */
  .info-row {
    display: flex; gap: 12px; margin-bottom: 14px;
  }
  .info-box {
    flex: 1; border: 1px solid #d1fae5; border-radius: 8px;
    padding: 10px 14px; background: #f0fdf4;
  }
  .info-box.right-box { text-align: right; direction: rtl; }
  .info-box-title {
    font-size: 10px; font-weight: 700; color: #15803d;
    text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px;
    border-bottom: 1px solid #bbf7d0; padding-bottom: 4px;
  }
  .info-row-item { margin-bottom: 3px; font-size: 11.5px; color: #333; }
  .info-row-item strong { color: #111; }
  /* ── Period badge ── */
  .period-badge {
    display: inline-block; background: #15803d; color: white;
    font-size: 11px; font-weight: 700; border-radius: 20px;
    padding: 3px 14px; margin-bottom: 14px;
  }
  /* ── Table ── */
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11.5px; }
  thead tr { background: #15803d; color: #fff; }
  thead th { padding: 8px 6px; text-align: center; font-weight: 700; }
  tbody tr:nth-child(even) { background: #f9fafb; }
  tbody td { padding: 7px 6px; text-align: center; border-bottom: 1px solid #e5e7eb; }
  td.num { font-family: 'Courier New', monospace; }
  td.net { font-weight: 700; color: #15803d; font-family: 'Courier New', monospace; }
  td.deduct { color: #dc2626; font-family: 'Courier New', monospace; }
  tr.total-row { background: #dcfce7 !important; font-weight: 700; border-top: 2px solid #15803d; }
  tr.total-row td { padding: 9px 6px; }
  /* ── Net summary ── */
  .net-summary {
    border: 2px solid #15803d; border-radius: 10px;
    background: #f0fdf4; padding: 14px 20px;
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 14px;
  }
  .net-detail { font-size: 11px; color: #555; line-height: 1.8; direction: rtl; text-align: right; }
  .net-main { text-align: center; }
  .net-label-ar { font-size: 13px; font-weight: 700; color: #15803d; direction: rtl; }
  .net-label-fr { font-size: 10px; color: #777; }
  .net-amount { font-size: 30px; font-weight: 900; color: #15803d; direction: ltr; margin-top: 4px; }
  /* ── Status badge ── */
  .status-badge {
    display: inline-block; border-radius: 20px; padding: 4px 16px;
    font-size: 12px; font-weight: 700; margin-bottom: 14px;
  }
  .status-paid { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
  .status-pending { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
  /* ── Signatures ── */
  .sig-row {
    display: flex; gap: 20px; margin-top: 10px; margin-bottom: 14px;
  }
  .sig-box {
    flex: 1; border: 1px dashed #d1d5db; border-radius: 8px;
    padding: 10px 14px; min-height: 70px; position: relative;
    direction: rtl; text-align: right;
  }
  .sig-title { font-size: 10px; font-weight: 700; color: #555; margin-bottom: 4px; }
  /* ── Footer ── */
  .footer {
    text-align: center; font-size: 9.5px; color: #aaa;
    border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 4px;
  }
  @media print {
    body { padding: 6px; }
    @page { margin: 1cm; size: A4; }
  }
`;

function openInvoiceWindow(html: string, title: string) {
  const win = window.open('', '_blank', 'width=920,height=780');
  if (!win) {
    alert('⚠️ تم حجب النافذة المنبثقة.\nيرجى السماح بالنوافذ المنبثقة لهذا الموقع ثم المحاولة مجدداً.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  const printOnce = () => { if (!(win as any).__p) { (win as any).__p = true; win.print(); } };
  win.onload = () => setTimeout(printOnce, 350);
  setTimeout(() => { if (!win.closed) printOnce(); }, 1600);
}

// ═══════════════════════════════════════════════════════════════
// FARMER / MEMBER INVOICE
// ═══════════════════════════════════════════════════════════════

export interface FarmerInvoiceReceipt {
  date: string;
  quantityLiters: number;
  pricePerLiter?: number;
  transportCost?: number;
  fat?: number;
  notes?: string;
}

export interface FarmerInvoiceData {
  farmerName: string;
  farmerPhone?: string;
  farmerCin?: string;
  month: string;
  receipts: FarmerInvoiceReceipt[];
  monthlyPricePerLiter: number;
  coopName: string;
  coopPhone?: string;
  coopAddress?: string;
  logoUrl?: string;
  currency: string;
  paid?: boolean;
  invoiceSeq?: number;
  /** الديون المخصومة من صافي هذا الشهر */
  debt?: number;
}

export async function printFarmerInvoice(data: FarmerInvoiceData): Promise<void> {
  const {
    farmerName, farmerPhone, farmerCin, month, receipts,
    monthlyPricePerLiter, coopName, coopPhone, coopAddress,
    logoUrl, currency, paid, invoiceSeq, debt = 0,
  } = data;

  const logoBase64 = logoUrl ? await urlToBase64(logoUrl) : '';
  const curr = currencyLabel(currency);
  const [year, monthNum] = month.split('-');
  const seq = invoiceSeq ?? parseInt(monthNum);
  const invoiceNo = `FA-${year}-${monthNum}-${String(seq).padStart(3,'0')}`;

  const sorted = [...receipts].sort((a, b) => a.date.localeCompare(b.date));
  const rows = sorted.map((r) => {
    const price = r.pricePerLiter ?? monthlyPricePerLiter;
    const gross = r.quantityLiters * price;
    const transport = r.transportCost ?? 0;
    return { day: r.date.split('-')[2], qty: r.quantityLiters, price, gross, transport, net: gross - transport, fat: r.fat, notes: r.notes || '' };
  });

  const totalQty = rows.reduce((s, r) => s + r.qty, 0);
  const totalGross = rows.reduce((s, r) => s + r.gross, 0);
  const totalTransport = rows.reduce((s, r) => s + r.transport, 0);
  // FIX: خصم الديون من الصافي النهائي
  const totalNetBeforeDebt = rows.reduce((s, r) => s + r.net, 0);
  const totalNet = totalNetBeforeDebt - debt;

  const printedOn = new Date().toLocaleDateString('ar-MA-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
  const printedOnFr = new Date().toLocaleDateString('fr-MA', { year: 'numeric', month: 'long', day: 'numeric' });

  const rowsHtml = rows.length === 0
    ? `<tr><td colspan="6" style="text-align:center;padding:18px;color:#888;">لا توجد عمليات تسليم مسجلة هذا الشهر</td></tr>`
    : rows.map(r => `
        <tr>
          <td>${r.day}</td>
          <td class="num">${fmt(r.qty, 1)}</td>
          <td class="num">${fmt(r.price)}</td>
          <td class="num">${fmt(r.gross)}</td>
          <td class="num deduct">${r.transport > 0 ? fmt(r.transport) : '—'}</td>
          <td class="num net">${fmt(r.net)}</td>
        </tr>`).join('');

  const logoHtml = logoBase64 ? `<img src="${logoBase64}" alt="logo" class="logo" />` : '';
  const statusBadge = paid
    ? `<span class="status-badge status-paid">✓ مدفوع — Payé</span>`
    : `<span class="status-badge status-pending">⏳ في انتظار الأداء — En attente</span>`;

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><title>فاتورة — ${farmerName} — ${month}</title>
<style>${INVOICE_CSS}</style></head>
<body>

<div class="inv-header">
  <div class="inv-num-block">
    <div class="inv-label">رقم الفاتورة / N° Facture</div>
    <div class="inv-num">${invoiceNo}</div>
    <div class="inv-date">طُبعت بتاريخ: ${printedOn}</div>
    <div class="inv-date">Imprimé le ${printedOnFr}</div>
  </div>
  <div class="coop-block">
    <div class="coop-name">${coopName}</div>
    ${coopPhone ? `<div class="coop-meta">📞 ${coopPhone}</div>` : ''}
    ${coopAddress ? `<div class="coop-meta">📍 ${coopAddress}</div>` : ''}
  </div>
  ${logoHtml}
</div>

<div class="info-row">
  <div class="info-box right-box" style="flex:1.4">
    <div class="info-box-title">بيانات المنخرط — Agriculteur</div>
    <div class="info-row-item"><strong>الاسم / Nom :</strong> ${farmerName}</div>
    ${farmerCin ? `<div class="info-row-item"><strong>ب.ت.و / CIN :</strong> ${farmerCin}</div>` : ''}
    ${farmerPhone ? `<div class="info-row-item"><strong>الهاتف / Tél :</strong> ${farmerPhone}</div>` : ''}
  </div>
  <div class="info-box right-box" style="flex:1">
    <div class="info-box-title">بيانات الفاتورة — Détails</div>
    <div class="info-row-item"><strong>الشهر / Mois :</strong> ${monthAr(month)}</div>
    <div class="info-row-item"><strong>عدد التسليمات :</strong> ${rows.length} يوم</div>
    <div class="info-row-item"><strong>إجمالي الكمية :</strong> ${fmt(totalQty, 1)} لتر</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>اليوم<br><small>Jour</small></th>
      <th>الكمية (ل)<br><small>Qté (L)</small></th>
      <th>الثمن/ل<br><small>Prix/L</small></th>
      <th>الإجمالي<br><small>Brut</small></th>
      <th>اقتطاع النقل<br><small>Transport</small></th>
      <th>الصافي<br><small>Net</small></th>
    </tr>
  </thead>
  <tbody>
    ${rowsHtml}
    ${rows.length > 0 ? `
    <tr class="total-row">
      <td>المجموع<br><small>Total</small></td>
      <td class="num">${fmt(totalQty, 1)} ل</td>
      <td></td>
      <td class="num">${fmt(totalGross)} ${curr}</td>
      <td class="num deduct">${totalTransport > 0 ? fmt(totalTransport) + ' ' + curr : '—'}</td>
      <td class="num net">${fmt(totalNetBeforeDebt)} ${curr}</td>
    </tr>
    ${debt > 0 ? `
    <tr style="background:#fff7ed;">
      <td colspan="5" style="text-align:right;padding:6px 8px;color:#b45309;font-size:11px;">
        <strong>خصم الديون المستحقة / Déduction dettes :</strong>
      </td>
      <td class="num deduct">- ${fmt(debt)} ${curr}</td>
    </tr>
    <tr style="background:#dcfce7;font-weight:800;">
      <td colspan="5" style="text-align:right;padding:7px 8px;color:#15803d;">
        <strong>الصافي بعد خصم الديون / Net après déduction :</strong>
      </td>
      <td class="num net" style="font-size:13px;">${fmt(totalNet)} ${curr}</td>
    </tr>` : ''}` : ''}
  </tbody>
</table>

<div class="net-summary">
  <div class="net-detail">
    <div>الإجمالي الخام: <strong>${fmt(totalGross)} ${curr}</strong></div>
    ${totalTransport > 0 ? `<div>اقتطاع النقل: <strong style="color:#dc2626">- ${fmt(totalTransport)} ${curr}</strong></div>` : ''}
    ${debt > 0 ? `<div>الديون المخصومة: <strong style="color:#b45309">- ${fmt(debt)} ${curr}</strong></div>` : ''}
    <div style="margin-top:4px;border-top:1px solid #bbf7d0;padding-top:4px">
      عدد أيام التسليم: <strong>${rows.length}</strong>
    </div>
  </div>
  <div class="net-main">
    <div class="net-label-ar">المبلغ الصافي المستحق</div>
    <div class="net-label-fr">Montant net dû à l'agriculteur</div>
    <div class="net-amount">${fmt(totalNet)} ${curr}</div>
  </div>
</div>

${statusBadge}

<div class="sig-row">
  <div class="sig-box">
    <div class="sig-title">إمضاء المنخرط / Signature agriculteur</div>
  </div>
  <div class="sig-box">
    <div class="sig-title">إمضاء المسؤول / Signature responsable</div>
  </div>
  <div class="sig-box">
    <div class="sig-title">الختم / Cachet</div>
  </div>
</div>

<div class="footer">
  ${coopName} — وثيقة مالية رسمية — Document financier officiel<br>
  طُبعت بتاريخ ${printedOn} | Imprimé le ${printedOnFr}
</div>

</body></html>`;

  openInvoiceWindow(html, `فاتورة-${farmerName}-${month}`);
}

// ═══════════════════════════════════════════════════════════════
// COMPANY DELIVERY INVOICE
// ═══════════════════════════════════════════════════════════════

export interface CompanyDeliveryRow {
  date: string;
  quantityLiters: number;
  pricePerLiter: number;
  notes?: string;
}

export interface CompanyInvoiceData {
  companyName: string;
  month: string;
  deliveries: CompanyDeliveryRow[];
  coopName: string;
  coopPhone?: string;
  coopAddress?: string;
  logoUrl?: string;
  currency: string;
  invoiceSeq?: number;
}

export async function printCompanyInvoice(data: CompanyInvoiceData): Promise<void> {
  const { companyName, month, deliveries, coopName, coopPhone, coopAddress, logoUrl, currency, invoiceSeq } = data;

  const logoBase64 = logoUrl ? await urlToBase64(logoUrl) : '';
  const curr = currencyLabel(currency);
  const [year, monthNum] = month.split('-');
  const seq = invoiceSeq ?? parseInt(monthNum);
  const invoiceNo = `LIV-${year}-${monthNum}-${String(seq).padStart(3,'0')}`;

  const sorted = [...deliveries].sort((a, b) => a.date.localeCompare(b.date));
  const rows = sorted.map(d => ({
    day: d.date.split('-')[2],
    qty: d.quantityLiters,
    price: d.pricePerLiter,
    amount: d.quantityLiters * d.pricePerLiter,
    notes: d.notes || '',
  }));

  const totalQty = rows.reduce((s, r) => s + r.qty, 0);
  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);

  const printedOn = new Date().toLocaleDateString('ar-MA-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
  const printedOnFr = new Date().toLocaleDateString('fr-MA', { year: 'numeric', month: 'long', day: 'numeric' });
  const logoHtml = logoBase64 ? `<img src="${logoBase64}" alt="logo" class="logo" />` : '';

  const rowsHtml = rows.length === 0
    ? `<tr><td colspan="5" style="text-align:center;padding:18px;color:#888;">لا توجد تسليمات مسجلة هذا الشهر</td></tr>`
    : rows.map(r => `
        <tr>
          <td>${r.day}</td>
          <td class="num">${fmt(r.qty, 1)}</td>
          <td class="num">${fmt(r.price)}</td>
          <td class="num net">${fmt(r.amount)}</td>
          <td style="font-size:10px;color:#555">${r.notes}</td>
        </tr>`).join('');

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><title>فاتورة تسليم — ${companyName} — ${month}</title>
<style>${INVOICE_CSS}</style></head>
<body>

<div class="inv-header">
  <div class="inv-num-block">
    <div class="inv-label">رقم وصل التسليم / N° Bon de livraison</div>
    <div class="inv-num">${invoiceNo}</div>
    <div class="inv-date">طُبعت بتاريخ: ${printedOn}</div>
    <div class="inv-date">Imprimé le ${printedOnFr}</div>
  </div>
  <div class="coop-block">
    <div class="coop-name">${coopName}</div>
    <div class="coop-name-fr">Fournisseur / المورد</div>
    ${coopPhone ? `<div class="coop-meta">📞 ${coopPhone}</div>` : ''}
    ${coopAddress ? `<div class="coop-meta">📍 ${coopAddress}</div>` : ''}
  </div>
  ${logoHtml}
</div>

<div class="info-row">
  <div class="info-box right-box" style="flex:1.4">
    <div class="info-box-title">الشركة المستلمة — Société réceptrice</div>
    <div class="info-row-item"><strong>الاسم / Raison sociale :</strong> ${companyName}</div>
    <div class="info-row-item"><strong>نوع العملية :</strong> تسليم حليب</div>
  </div>
  <div class="info-box right-box" style="flex:1">
    <div class="info-box-title">بيانات الفاتورة — Détails</div>
    <div class="info-row-item"><strong>الشهر / Mois :</strong> ${monthAr(month)}</div>
    <div class="info-row-item"><strong>عدد التسليمات :</strong> ${rows.length} يوم</div>
    <div class="info-row-item"><strong>إجمالي الكمية :</strong> ${fmt(totalQty, 1)} لتر</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>اليوم<br><small>Jour</small></th>
      <th>الكمية (ل)<br><small>Quantité (L)</small></th>
      <th>الثمن/ل<br><small>Prix/L</small></th>
      <th>المبلغ<br><small>Montant</small></th>
      <th>ملاحظات<br><small>Remarques</small></th>
    </tr>
  </thead>
  <tbody>
    ${rowsHtml}
    ${rows.length > 0 ? `
    <tr class="total-row">
      <td>المجموع / Total</td>
      <td class="num">${fmt(totalQty, 1)} ل</td>
      <td class="num">${rows.length > 0 ? fmt(totalAmount / totalQty) : '—'}</td>
      <td class="num net">${fmt(totalAmount)} ${curr}</td>
      <td></td>
    </tr>` : ''}
  </tbody>
</table>

<div class="net-summary">
  <div class="net-detail">
    <div>إجمالي اللترات: <strong>${fmt(totalQty, 1)} لتر</strong></div>
    <div>عدد أيام التسليم: <strong>${rows.length}</strong></div>
    <div style="margin-top:4px">متوسط الثمن: <strong>${rows.length > 0 ? fmt(totalAmount / totalQty) : '—'} ${curr}/ل</strong></div>
  </div>
  <div class="net-main">
    <div class="net-label-ar">المبلغ الإجمالي المستحق</div>
    <div class="net-label-fr">Montant total dû à la coopérative</div>
    <div class="net-amount">${fmt(totalAmount)} ${curr}</div>
  </div>
</div>

<div class="sig-row">
  <div class="sig-box">
    <div class="sig-title">إمضاء المسؤول عن التعاونية / Signature coopérative</div>
  </div>
  <div class="sig-box">
    <div class="sig-title">إمضاء مسؤول الشركة / Signature société</div>
  </div>
  <div class="sig-box">
    <div class="sig-title">الختم / Cachet</div>
  </div>
</div>

<div class="footer">
  ${coopName} — وثيقة مالية رسمية — Document financier officiel<br>
  طُبعت بتاريخ ${printedOn} | Imprimé le ${printedOnFr}
</div>

</body></html>`;

  openInvoiceWindow(html, `فاتورة-تسليم-${companyName}-${month}`);
}

// ═══════════════════════════════════════════════════════════════
// WHATSAPP MESSAGE BUILDER — professional formatted text
// ═══════════════════════════════════════════════════════════════

export function buildFarmerWhatsAppMessage(opts: {
  farmerName: string;
  month: string;
  totalLiters: number;
  pricePerLiter: number;
  grossAmount: number;
  transportCost: number;
  netAmount: number;
  currency: string;
  coopName: string;
  paid: boolean;
}) {
  const { farmerName, month, totalLiters, pricePerLiter, grossAmount, transportCost, netAmount, currency, coopName, paid } = opts;
  const curr = currency === 'درهم' || currency === 'MAD' ? 'درهم' : currency;
  const [year, monthNum] = month.split('-');
  const monthName = MONTH_NAMES_AR[parseInt(monthNum) - 1];
  const status = paid ? '✅ تم الأداء' : '⏳ في انتظار الأداء';

  return [
    `🥛 *${coopName}*`,
    `📋 كشف حساب شهر ${monthName} ${year}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `👤 المنخرط: *${farmerName}*`,
    ``,
    `📦 الكمية المسلمة: *${totalLiters.toFixed(1)} لتر*`,
    `💰 الثمن: *${pricePerLiter.toFixed(2)} ${curr}/ل*`,
    `🔢 الإجمالي الخام: *${grossAmount.toFixed(2)} ${curr}*`,
    transportCost > 0 ? `🚛 اقتطاع النقل: *- ${transportCost.toFixed(2)} ${curr}*` : null,
    `━━━━━━━━━━━━━━━━━━━━`,
    `✨ *الصافي المستحق: ${netAmount.toFixed(2)} ${curr}*`,
    `📌 الحالة: ${status}`,
    ``,
    `شكراً على ثقتكم 🙏`,
  ].filter(l => l !== null).join('\n');
}