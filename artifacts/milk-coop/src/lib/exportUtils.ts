import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export interface ExportColumn {
  header: string;
  key: string;
}

/** Opens the browser print dialog for the current page (used for print buttons). */
export function printPage() {
  window.print();
}

/**
 * Exports rows to a PDF with a title and table. RTL Arabic text in jsPDF's
 * default fonts does not shape connected letters, so numeric/latin columns
 * render cleanly; Arabic labels still display (unconnected glyphs) which is
 * an accepted tradeoff for a client-only PDF export.
 */
export function exportToPdf(
  title: string,
  columns: ExportColumn[],
  rows: Record<string, string | number>[],
  fileName: string,
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
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, string | number>[],
  fileName: string,
) {
  const worksheet = XLSX.utils.json_to_sheet(
    rows.map((row) =>
      Object.fromEntries(columns.map((c) => [c.header, row[c.key] ?? ''])),
    ),
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `${fileName}.xlsx`);
}

/** Builds a wa.me share link with a pre-filled message, opened in a new tab. */
export function buildWhatsAppShareUrl(message: string, phone?: string) {
  const encoded = encodeURIComponent(message);
  return phone
    ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

export function shareOnWhatsApp(message: string, phone?: string) {
  window.open(buildWhatsAppShareUrl(message, phone), '_blank');
}
