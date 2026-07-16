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

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // RTL direction for Arabic content (set at workbook view level)
  workbook.Workbook = workbook.Workbook || {};
  workbook.Workbook.Views = workbook.Workbook.Views || [{}];
  workbook.Workbook.Views[0].RTL = true;

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${fileName}.xlsx`,
  );
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
