import { Layout } from '@/components/Layout';
import {
  useMembers,
  useMilkReceived,
  useTransporters,
  usePrices,
  useIncomes,
  useExpenses,
  useMilkDelivered,
} from '@/hooks/useData';
import { useSettings } from '@/hooks/useSettings';
import { useState, useMemo, useId } from 'react';
import { format } from 'date-fns';
import { monthKey, priceForMonth } from '@/lib/calculations';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { exportToExcel } from '@/lib/exportUtils';
import { Printer, FileText, FileSpreadsheet, Plus, Trash2, BarChart3, Calendar } from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────
const MONTHS_AR = [
  'يناير','فبراير','مارس','أبريل','ماي','يونيو',
  'يوليوز','غشت','شتنبر','أكتوبر','نونبر','دجنبر',
];
const MONTHS_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];

function monthLabelAr(month: string) {
  const [y, m] = month.split('-');
  return `${MONTHS_AR[parseInt(m) - 1]} ${y}`;
}
function monthLabelFr(month: string) {
  const [y, m] = month.split('-');
  return `${MONTHS_FR[parseInt(m) - 1]} ${y}`;
}
function generateMonthOptions(count = 24) {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    opts.push({ value, label: monthLabelAr(value) });
  }
  return opts;
}
const MONTH_OPTIONS = generateMonthOptions(36);

function fmtN(n: number, dec = 1): string {
  if (n === 0) return '';
  return n.toLocaleString('fr-MA', { minimumFractionDigits: 0, maximumFractionDigits: dec });
}
function fmtM(n: number, dec = 2): string {
  if (n === 0) return '—';
  return n.toLocaleString('fr-MA', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function currSym(c?: string) {
  return c === 'MAD' || c === 'درهم' ? 'درهم' : (c ?? 'درهم');
}

// ── Types ──────────────────────────────────────────────────────────────────
interface ExtraExpense { id: string; label: string; amount: number }

interface MemberRow {
  seq: number;
  memberId: string;
  memberName: string;
  days: Map<number, number>;      // day-of-month → liters
  period1: number;                // days 1-15
  period2: number;                // days 16-end
  total: number;
  price: number;
  period1Value: number;
  period2Value: number;
  totalValue: number;
  transport: number;
  net: number;
  notes: string;
}

interface TransporterRow {
  name: string;
  members: string[];
  totalLiters: number;
  costPerLiter: number;
  totalCost: number;
}

// ── PDF helper ─────────────────────────────────────────────────────────────
async function urlToBase64(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch { return ''; }
}

function openWindow(html: string) {
  const win = window.open('', '_blank', 'width=1100,height=800');
  if (!win) {
    alert('⚠️ تم حجب النافذة المنبثقة.\nيرجى السماح بالنوافذ المنبثقة ثم المحاولة مجدداً.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  const printOnce = () => { if (!(win as any).__p) { (win as any).__p = true; win.print(); } };
  win.onload = () => setTimeout(printOnce, 400);
  setTimeout(() => { if (!win.closed) printOnce(); }, 1800);
}

// ── Main component ─────────────────────────────────────────────────────────
export default function MonthlyReport() {
  const idPrefix = useId();
  const { data: members } = useMembers();
  const { data: receipts } = useMilkReceived();
  const { data: transporters } = useTransporters();
  const { data: prices } = usePrices();
  const { data: incomes } = useIncomes();
  const { data: expenses } = useExpenses();
  const { data: deliveries } = useMilkDelivered();
  const { settings } = useSettings();

  const [monthFilter, setMonthFilter] = useState(monthKey(format(new Date(), 'yyyy-MM-dd')));
  const [extraExpenses, setExtraExpenses] = useState<ExtraExpense[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');

  const currency = currSym(settings?.currency);

  // ── Derived: days in month ──
  const daysInMonth = useMemo(() => {
    const [y, m] = monthFilter.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }, [monthFilter]);
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  // ── Receipts for this month ──
  const monthReceipts = useMemo(
    () => receipts.filter((r) => monthKey(r.date) === monthFilter),
    [receipts, monthFilter],
  );

  // ── Monthly price per liter ──
  const monthPrice = useMemo(() => priceForMonth(prices, monthFilter), [prices, monthFilter]);

  // ── Transporter lookup ──
  const transporterById = useMemo(
    () => new Map(transporters.map((t) => [t.id, t])),
    [transporters],
  );

  // ── Member rows ──
  const memberRows = useMemo((): MemberRow[] => {
    // Only members that have at least one receipt this month
    const memberIds = new Set(monthReceipts.map((r) => r.memberId));
    const relevantMembers = members
      .filter((m) => memberIds.has(m.id))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'));

    return relevantMembers.map((member, idx) => {
      const mReceipts = monthReceipts.filter((r) => r.memberId === member.id);

      // Build daily map
      const dayMap = new Map<number, number>();
      for (const r of mReceipts) {
        const day = parseInt(r.date.split('-')[2]);
        dayMap.set(day, (dayMap.get(day) ?? 0) + r.quantityLiters);
      }

      // Period sums
      let period1 = 0;
      let period2 = 0;
      for (const [d, liters] of dayMap) {
        if (d <= 15) period1 += liters;
        else period2 += liters;
      }
      const total = period1 + period2;

      // Price
      const grossAmount = mReceipts.reduce(
        (s, r) => s + r.quantityLiters * (r.pricePerLiter ?? monthPrice),
        0,
      );
      const effectivePrice = total > 0 ? grossAmount / total : monthPrice;

      // Period values using effective price
      const period1Value = period1 * effectivePrice;
      const period2Value = period2 * effectivePrice;
      const totalValue = period1Value + period2Value;

      // Transport cost
      const transport = mReceipts.reduce((s, r) => {
        if (r.transportCost !== undefined) return s + r.transportCost;
        const tid = member.transporterId ?? r.transporterId;
        const tp = tid ? transporterById.get(tid) : undefined;
        return s + r.quantityLiters * (tp?.costPerLiter ?? 0);
      }, 0);

      // Notes (aggregate)
      const notes = mReceipts
        .map((r) => r.notes)
        .filter(Boolean)
        .join(' | ');

      return {
        seq: idx + 1,
        memberId: member.id,
        memberName: member.fullName,
        days: dayMap,
        period1,
        period2,
        total,
        price: effectivePrice,
        period1Value,
        period2Value,
        totalValue,
        transport,
        net: totalValue - transport,
        notes,
      };
    });
  }, [monthReceipts, members, transporterById, monthPrice]);

  // ── Daily column totals ──
  const dailyTotals = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of memberRows) {
      for (const [d, liters] of row.days) {
        map.set(d, (map.get(d) ?? 0) + liters);
      }
    }
    return map;
  }, [memberRows]);

  // ── Grand totals ──
  const grandPeriod1 = useMemo(() => memberRows.reduce((s, r) => s + r.period1, 0), [memberRows]);
  const grandPeriod2 = useMemo(() => memberRows.reduce((s, r) => s + r.period2, 0), [memberRows]);
  const grandTotal = useMemo(() => memberRows.reduce((s, r) => s + r.total, 0), [memberRows]);
  const grandPeriod1Val = useMemo(() => memberRows.reduce((s, r) => s + r.period1Value, 0), [memberRows]);
  const grandPeriod2Val = useMemo(() => memberRows.reduce((s, r) => s + r.period2Value, 0), [memberRows]);
  const grandTotalVal = useMemo(() => memberRows.reduce((s, r) => s + r.totalValue, 0), [memberRows]);
  const grandTransport = useMemo(() => memberRows.reduce((s, r) => s + r.transport, 0), [memberRows]);
  const grandNet = useMemo(() => memberRows.reduce((s, r) => s + r.net, 0), [memberRows]);

  // ── Transporter summary ──
  const transporterRows = useMemo((): TransporterRow[] => {
    const map = new Map<
      string,
      { name: string; members: Set<string>; totalLiters: number; costPerLiter: number; totalCost: number }
    >();

    for (const row of memberRows) {
      const member = members.find((m) => m.id === row.memberId);
      const tid = member?.transporterId;
      if (!tid) continue;
      const tp = transporterById.get(tid);
      if (!tp) continue;
      if (!map.has(tid)) {
        map.set(tid, { name: tp.fullName, members: new Set(), totalLiters: 0, costPerLiter: tp.costPerLiter, totalCost: 0 });
      }
      const entry = map.get(tid)!;
      entry.members.add(row.memberName);
      entry.totalLiters += row.total;
      entry.totalCost += row.transport;
    }

    return Array.from(map.values()).map((e) => ({
      name: e.name,
      members: Array.from(e.members),
      totalLiters: e.totalLiters,
      costPerLiter: e.costPerLiter,
      totalCost: e.totalCost,
    }));
  }, [memberRows, members, transporterById]);

  // ── Financial summary ──
  const monthIncomes = useMemo(
    () => incomes.filter((i) => monthKey(i.date) === monthFilter),
    [incomes, monthFilter],
  );
  const monthExpenses = useMemo(
    () => expenses.filter((e) => monthKey(e.date) === monthFilter),
    [expenses, monthFilter],
  );
  const monthDeliveryIncome = useMemo(
    () =>
      deliveries
        .filter((d) => monthKey(d.date) === monthFilter)
        .reduce((s, d) => s + d.quantityLiters * d.pricePerLiter, 0),
    [deliveries, monthFilter],
  );
  const totalOtherIncome = monthIncomes.reduce((s, i) => s + i.amount, 0);
  const totalFirebaseExpenses = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const totalExtraExpenses = extraExpenses.reduce((s, e) => s + e.amount, 0);
  const totalIncome = monthDeliveryIncome + totalOtherIncome;
  const totalExpenses = totalFirebaseExpenses + totalExtraExpenses + grandTransport;
  const budgetBalance = totalIncome - totalExpenses - grandNet;

  // ── Add extra expense ──
  function addExtra() {
    const amt = parseFloat(newAmount);
    if (!newLabel.trim() || isNaN(amt) || amt <= 0) return;
    setExtraExpenses((prev) => [...prev, { id: `${idPrefix}-${Date.now()}`, label: newLabel.trim(), amount: amt }]);
    setNewLabel('');
    setNewAmount('');
  }
  function removeExtra(id: string) {
    setExtraExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  // ── PDF ──
  async function handlePrintPdf(printOnly = false) {
    const logoBase64 = settings?.logoUrl ? await urlToBase64(settings.logoUrl) : '';
    const logoHtml = logoBase64 ? `<img src="${logoBase64}" alt="logo" class="logo" />` : '';
    const coopName = settings?.coopName ?? 'تعاونية كوب بوعلا';
    const now = new Date();
    const printedAr = now.toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric' });
    const printedFr = now.toLocaleDateString('fr-MA', { year: 'numeric', month: 'long', day: 'numeric' });

    // build day headers
    const dayHeaders = days
      .map((d) => {
        const isP2Start = d === 16;
        return `${isP2Start ? '<th class="sep">' : '<th>'}${d}</th>`;
      })
      .join('');

    // build member rows
    const membersHtml = memberRows.map((row) => {
      const daysCells = days
        .map((d) => {
          const v = row.days.get(d);
          const isP2Start = d === 16;
          const cls = isP2Start ? ' class="sep"' : '';
          return `<td${cls}>${v ? fmtN(v, 1) : ''}</td>`;
        })
        .join('');
      return `<tr>
        <td>${row.seq}</td>
        <td class="col-name">${row.memberName}</td>
        ${daysCells}
        <td class="col-period">${fmtN(row.period1, 1)}</td>
        <td class="sep col-period">${fmtN(row.period2, 1)}</td>
        <td class="col-total">${fmtN(row.total, 1)}</td>
        <td class="col-val">${fmtM(row.period1Value)}</td>
        <td class="col-val">${fmtM(row.period2Value)}</td>
        <td class="col-val">${fmtM(row.totalValue)}</td>
        <td class="col-transport">${row.transport > 0 ? fmtM(row.transport) : '—'}</td>
        <td class="col-net">${fmtM(row.net)}</td>
        <td class="col-notes">${row.notes}</td>
      </tr>`;
    }).join('');

    // build daily totals row
    const dailyTotalCells = days
      .map((d) => {
        const v = dailyTotals.get(d) ?? 0;
        const isP2Start = d === 16;
        const cls = isP2Start ? ' class="sep"' : '';
        return `<td${cls}><strong>${v > 0 ? fmtN(v, 1) : ''}</strong></td>`;
      })
      .join('');

    // transporter rows
    const tpHtml = transporterRows.length > 0 ? `
      <h3 style="margin-top:10px;font-size:9px;font-weight:800;color:#1e40af;border-bottom:1px solid #93c5fd;padding-bottom:3px;">جدول تكاليف النقل — Coûts de transport</h3>
      <table class="small-table">
        <thead><tr><th>الناقل</th><th>عدد المنخرطين</th><th>مجموع اللترات</th><th>التكلفة/ل</th><th>التكلفة الإجمالية</th></tr></thead>
        <tbody>
          ${transporterRows.map(tp => `<tr>
            <td class="col-name">${tp.name}</td>
            <td>${tp.members.length}</td>
            <td>${fmtN(tp.totalLiters, 1)}</td>
            <td>${fmtM(tp.costPerLiter)}</td>
            <td><strong>${fmtM(tp.totalCost)}</strong></td>
          </tr>`).join('')}
          <tr class="total-row"><td colspan="4"><strong>الإجمالي</strong></td><td><strong>${fmtM(grandTransport)}</strong></td></tr>
        </tbody>
      </table>` : '';

    // extra + firebase expenses for PDF
    const allExpHtml = [
      ...monthExpenses.map(e => `<tr><td class="col-name">${e.label}</td><td>${fmtM(e.amount)}</td></tr>`),
      ...extraExpenses.map(e => `<tr><td class="col-name">${e.label} (إضافي)</td><td>${fmtM(e.amount)}</td></tr>`),
      `<tr class="total-row"><td>إجمالي المصاريف الأخرى</td><td><strong>${fmtM(totalFirebaseExpenses + totalExtraExpenses)}</strong></td></tr>`,
    ].join('');

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>التقرير الشهري — ${monthLabelAr(monthFilter)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, 'Segoe UI', sans-serif; font-size: 7px; color: #111; background: #fff; padding: 6px; }
  @page { size: A4 landscape; margin: 0.4cm; }
  /* Header */
  .hdr { display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid #15803d; padding-bottom:5px; margin-bottom:6px; }
  .logo { width:48px; height:48px; object-fit:contain; border-radius:6px; }
  .hdr-center { text-align:center; }
  .hdr-title { font-size:12px; font-weight:800; color:#15803d; }
  .hdr-sub { font-size:8px; color:#555; margin-top:2px; }
  .hdr-right { text-align:right; font-size:7.5px; color:#333; line-height:1.6; }
  /* Main table */
  table { width:100%; border-collapse:collapse; margin-bottom:6px; font-size:6.5px; }
  th { background:#15803d; color:#fff; padding:2.5px 1.5px; text-align:center; font-size:6px; border:1px solid #0f7130; white-space:nowrap; }
  td { padding:2px 1.5px; text-align:center; border:1px solid #d1d5db; }
  tr:nth-child(even) td { background:#f9fafb; }
  .total-row td { background:#dcfce7 !important; font-weight:700; border-top:2px solid #15803d; font-size:7px; }
  .subtotal-row td { background:#dbeafe !important; font-weight:700; font-size:7px; }
  .col-name { text-align:right; padding-right:3px; font-size:7px; min-width:70px; }
  .col-period { background:#dbeafe !important; font-weight:700; }
  .total-row .col-period { background:#bbf7d0 !important; }
  .col-total { background:#fef9c3 !important; font-weight:700; }
  .total-row .col-total { background:#bbf7d0 !important; }
  .col-val { background:#fef3c7 !important; font-size:6.5px; }
  .total-row .col-val { background:#bbf7d0 !important; }
  .col-transport { color:#dc2626; font-size:6.5px; }
  .col-net { color:#15803d; font-weight:700; font-size:7px; }
  .col-notes { font-size:6px; text-align:right; padding-right:2px; max-width:50px; }
  th.sep, td.sep { border-right:2px solid #6b7280 !important; }
  /* summary / financial */
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px; }
  .small-table { font-size:7px; }
  .fin-row td:first-child { text-align:right; padding-right:4px; }
  .fin-row.highlight td { font-weight:700; background:#dcfce7 !important; font-size:8px; color:#15803d; }
  h3 { font-size:9px; font-weight:800; color:#15803d; margin:6px 0 3px; border-bottom:1px solid #86efac; padding-bottom:2px; }
  .footer { margin-top:8px; text-align:center; font-size:7px; color:#999; border-top:1px solid #e5e7eb; padding-top:4px; }
  @media print { body { padding:2px; } @page { size: A4 landscape; margin: 0.4cm; } }
</style>
</head>
<body>

<div class="hdr">
  ${logoHtml}
  <div class="hdr-center">
    <div class="hdr-title">${coopName}</div>
    <div class="hdr-sub">التقرير الشهري الشامل — Rapport mensuel complet</div>
    <div class="hdr-sub" style="font-size:9px;font-weight:700;color:#15803d;">${monthLabelAr(monthFilter)} | ${monthLabelFr(monthFilter)}</div>
  </div>
  <div class="hdr-right">
    <div>طُبع بتاريخ: ${printedAr}</div>
    <div>Imprimé le ${printedFr}</div>
    <div>عدد المنخرطين: <strong>${memberRows.length}</strong></div>
    <div>ثمن اللتر: <strong>${fmtM(monthPrice)} ${currency}/ل</strong></div>
  </div>
</div>

<h3>جدول الحليب التفصيلي — Tableau détaillé du lait</h3>
<div style="overflow-x:auto;">
<table>
  <thead>
    <tr>
      <th rowspan="2">#</th>
      <th rowspan="2" class="col-name">الاسم الكامل</th>
      ${days.map(d => `<th${d === 16 ? ' class="sep"' : ''}>${d}</th>`).join('')}
      <th class="col-period">ف1<br><small>1-15</small></th>
      <th class="sep col-period">ف2<br><small>16+</small></th>
      <th class="col-total">مجموع<br>اللترات</th>
      <th class="col-val">قيمة ف1<br><small>(${currency})</small></th>
      <th class="col-val">قيمة ف2<br><small>(${currency})</small></th>
      <th class="col-val">الإجمالي<br><small>(${currency})</small></th>
      <th>النقل<br><small>(${currency})</small></th>
      <th class="col-net">الصافي<br><small>(${currency})</small></th>
      <th class="col-notes">ملاحظات</th>
    </tr>
  </thead>
  <tbody>
    ${membersHtml}
    <tr class="total-row">
      <td colspan="2"><strong>مجموع اليوم</strong></td>
      ${dailyTotalCells}
      <td class="col-period"><strong>${fmtN(grandPeriod1, 1)}</strong></td>
      <td class="sep col-period"><strong>${fmtN(grandPeriod2, 1)}</strong></td>
      <td class="col-total"><strong>${fmtN(grandTotal, 1)}</strong></td>
      <td class="col-val"><strong>${fmtM(grandPeriod1Val)}</strong></td>
      <td class="col-val"><strong>${fmtM(grandPeriod2Val)}</strong></td>
      <td class="col-val"><strong>${fmtM(grandTotalVal)}</strong></td>
      <td><strong style="color:#dc2626;">${fmtM(grandTransport)}</strong></td>
      <td class="col-net"><strong>${fmtM(grandNet)}</strong></td>
      <td></td>
    </tr>
  </tbody>
</table>
</div>

<div class="two-col">
  <div>
    ${tpHtml}
    ${(monthExpenses.length > 0 || extraExpenses.length > 0) ? `
    <h3 style="margin-top:10px;">المصاريف الأخرى — Autres dépenses</h3>
    <table class="small-table">
      <thead><tr><th>البيان</th><th>المبلغ (${currency})</th></tr></thead>
      <tbody>${allExpHtml}</tbody>
    </table>` : ''}
  </div>
  <div>
    <h3>الملخص المالي الشهري — Bilan financier mensuel</h3>
    <table class="small-table">
      <thead><tr><th>البيان</th><th>المبلغ (${currency})</th></tr></thead>
      <tbody>
        <tr class="fin-row"><td>مجموع اللترات المستلمة</td><td>${fmtN(grandTotal, 1)} لتر</td></tr>
        <tr class="fin-row"><td>قيمة شراء الحليب (إجمالي المستحقات)</td><td><strong>${fmtM(grandTotalVal)}</strong></td></tr>
        <tr class="fin-row"><td>إجمالي اقتطاعات النقل</td><td style="color:#dc2626"><strong>- ${fmtM(grandTransport)}</strong></td></tr>
        <tr class="fin-row"><td>الصافي المدفوع للمنخرطين</td><td><strong>${fmtM(grandNet)}</strong></td></tr>
        <tr><td colspan="2" style="border:0;height:4px;"></td></tr>
        <tr class="fin-row"><td>مداخيل بيع الحليب للشركات</td><td>${fmtM(monthDeliveryIncome)}</td></tr>
        <tr class="fin-row"><td>مداخيل أخرى (من الميزانية)</td><td>${fmtM(totalOtherIncome)}</td></tr>
        <tr class="fin-row highlight"><td>إجمالي المداخيل</td><td>${fmtM(totalIncome)}</td></tr>
        <tr><td colspan="2" style="border:0;height:4px;"></td></tr>
        <tr class="fin-row"><td>إجمالي تكاليف النقل</td><td style="color:#dc2626">${fmtM(grandTransport)}</td></tr>
        <tr class="fin-row"><td>مصاريف أخرى</td><td style="color:#dc2626">${fmtM(totalFirebaseExpenses + totalExtraExpenses)}</td></tr>
        <tr class="fin-row highlight"><td>إجمالي المصاريف</td><td style="color:#dc2626">${fmtM(totalExpenses)}</td></tr>
        <tr><td colspan="2" style="border:0;height:4px;"></td></tr>
        <tr class="fin-row highlight" style="font-size:9px;"><td>الرصيد النهائي</td><td style="color:${budgetBalance >= 0 ? '#15803d' : '#dc2626'}">${fmtM(budgetBalance)}</td></tr>
      </tbody>
    </table>
  </div>
</div>

<div class="footer">
  ${coopName} — التقرير الشهري الرسمي — Rapport mensuel officiel<br>
  طُبع بتاريخ ${printedAr} | Imprimé le ${printedFr}
</div>

</body></html>`;

    openWindow(html);
  }

  // ── Excel export ──
  async function handleExportExcel() {
    // Sheet 1: main grid
    const dayKeys = days.map((d) => `d${d}`);
    const gridCols = [
      { header: '#', key: 'seq' },
      { header: 'الاسم الكامل', key: 'name' },
      ...days.map((d) => ({ header: String(d), key: `d${d}` })),
      { header: 'الفترة 1 (1-15)', key: 'p1' },
      { header: 'الفترة 2 (16-آخر)', key: 'p2' },
      { header: 'مجموع اللترات', key: 'total' },
      { header: `قيمة الفترة 1 (${currency})`, key: 'p1v' },
      { header: `قيمة الفترة 2 (${currency})`, key: 'p2v' },
      { header: `الإجمالي (${currency})`, key: 'totalv' },
      { header: `النقل (${currency})`, key: 'transport' },
      { header: `الصافي (${currency})`, key: 'net' },
      { header: 'ملاحظات', key: 'notes' },
    ];
    const gridRows = [
      ...memberRows.map((row) => {
        const r: Record<string, string | number> = {
          seq: row.seq,
          name: row.memberName,
          p1: row.period1,
          p2: row.period2,
          total: row.total,
          p1v: row.period1Value,
          p2v: row.period2Value,
          totalv: row.totalValue,
          transport: row.transport,
          net: row.net,
          notes: row.notes,
        };
        days.forEach((d) => { r[`d${d}`] = row.days.get(d) ?? ''; });
        return r;
      }),
      // Totals row
      (() => {
        const r: Record<string, string | number> = {
          seq: '',
          name: 'المجموع',
          p1: grandPeriod1,
          p2: grandPeriod2,
          total: grandTotal,
          p1v: grandPeriod1Val,
          p2v: grandPeriod2Val,
          totalv: grandTotalVal,
          transport: grandTransport,
          net: grandNet,
          notes: '',
        };
        days.forEach((d) => { r[`d${d}`] = dailyTotals.get(d) ?? ''; });
        return r;
      })(),
    ];

    // Sheet 2: financial summary
    const finCols = [{ header: 'البيان', key: 'label' }, { header: `المبلغ (${currency})`, key: 'value' }];
    const finRows = [
      { label: 'مجموع اللترات المستلمة', value: grandTotal },
      { label: 'قيمة شراء الحليب (إجمالي)', value: grandTotalVal },
      { label: 'إجمالي اقتطاعات النقل', value: grandTransport },
      { label: 'الصافي المدفوع للمنخرطين', value: grandNet },
      { label: 'مداخيل بيع الحليب للشركات', value: monthDeliveryIncome },
      { label: 'مداخيل أخرى', value: totalOtherIncome },
      { label: 'إجمالي المداخيل', value: totalIncome },
      { label: 'إجمالي تكاليف النقل', value: grandTransport },
      { label: 'مصاريف أخرى', value: totalFirebaseExpenses + totalExtraExpenses },
      { label: 'إجمالي المصاريف', value: totalExpenses },
      { label: 'الرصيد النهائي', value: budgetBalance },
    ];

    // Use the existing exportToExcel for sheet 1 (library only supports one sheet per call)
    // We'll export grid sheet
    await exportToExcel(
      `تقرير ${monthLabelAr(monthFilter)}`,
      gridCols,
      gridRows,
      `تقرير-شهري-${monthFilter}`,
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <Layout>
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" />
            التقارير الشهرية
          </h2>
          <p className="text-muted-foreground mt-1">
            تقرير إجمالي شامل لإنتاج الحليب والمالية الشهرية
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium text-muted-foreground whitespace-nowrap">الشهر</Label>
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

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'مجموع اللترات', value: `${grandTotal.toLocaleString('fr-MA', { maximumFractionDigits: 1 })} ل`, color: 'text-blue-600' },
          { label: 'إجمالي المستحقات', value: `${grandTotalVal.toLocaleString('fr-MA', { maximumFractionDigits: 2 })} ${currency}`, color: 'text-amber-600' },
          { label: 'اقتطاعات النقل', value: `${grandTransport.toLocaleString('fr-MA', { maximumFractionDigits: 2 })} ${currency}`, color: 'text-red-600' },
          { label: 'الصافي النهائي', value: `${grandNet.toLocaleString('fr-MA', { maximumFractionDigits: 2 })} ${currency}`, color: 'text-emerald-600' },
        ].map((card) => (
          <Card key={card.label} className="shadow-sm">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
              <p className={`text-xl font-bold font-mono ${card.color}`} dir="ltr">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Export buttons ── */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button onClick={() => handlePrintPdf()} className="gap-2 bg-emerald-700 hover:bg-emerald-800">
          <FileText className="h-4 w-4" /> تصدير PDF
        </Button>
        <Button variant="outline" onClick={() => handlePrintPdf(true)} className="gap-2">
          <Printer className="h-4 w-4" /> طباعة
        </Button>
        <Button variant="outline" onClick={handleExportExcel} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" /> تصدير Excel
        </Button>
      </div>

      {/* ── Main grid table ── */}
      <Card className="mb-6 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            جدول الحليب التفصيلي — {monthLabelAr(monthFilter)}
            {monthPrice > 0 && (
              <span className="text-sm font-normal text-muted-foreground mr-2">
                (ثمن اللتر: {monthPrice.toFixed(2)} {currency})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {memberRows.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              لا توجد بيانات حليب مسجلة لهذا الشهر
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-xs whitespace-nowrap">
                <TableHeader>
                  <TableRow className="bg-primary hover:bg-primary">
                    <TableHead className="text-primary-foreground sticky right-0 bg-primary z-10 min-w-[28px] text-center">#</TableHead>
                    <TableHead className="text-primary-foreground sticky right-[28px] bg-primary z-10 min-w-[120px]">الاسم</TableHead>
                    {days.map((d) => (
                      <TableHead
                        key={d}
                        className={`text-primary-foreground text-center min-w-[32px] w-[32px] px-1 ${d === 16 ? 'border-r-2 border-r-white/40' : ''}`}
                      >
                        {d}
                      </TableHead>
                    ))}
                    <TableHead className="text-primary-foreground text-center bg-blue-700 min-w-[52px] border-r-2 border-r-white/40">ف1</TableHead>
                    <TableHead className="text-primary-foreground text-center bg-blue-700 min-w-[52px]">ف2</TableHead>
                    <TableHead className="text-primary-foreground text-center bg-amber-600 min-w-[60px]">مجموع ل</TableHead>
                    <TableHead className="text-primary-foreground text-center bg-amber-700 min-w-[68px]">قيمة ف1</TableHead>
                    <TableHead className="text-primary-foreground text-center bg-amber-700 min-w-[68px]">قيمة ف2</TableHead>
                    <TableHead className="text-primary-foreground text-center bg-amber-800 min-w-[72px]">الإجمالي</TableHead>
                    <TableHead className="text-primary-foreground text-center bg-red-700 min-w-[64px]">النقل</TableHead>
                    <TableHead className="text-primary-foreground text-center bg-emerald-700 min-w-[72px]">الصافي</TableHead>
                    <TableHead className="text-primary-foreground text-center min-w-[80px]">ملاحظات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberRows.map((row, ri) => (
                    <TableRow key={row.memberId} className={ri % 2 === 1 ? 'bg-muted/30' : ''}>
                      <TableCell className="sticky right-0 bg-background z-10 text-center font-mono text-[10px] px-1">{row.seq}</TableCell>
                      <TableCell className="sticky right-[28px] bg-background z-10 font-medium">{row.memberName}</TableCell>
                      {days.map((d) => {
                        const v = row.days.get(d);
                        return (
                          <TableCell
                            key={d}
                            className={`text-center px-1 font-mono ${v ? 'text-blue-700 font-medium' : 'text-muted-foreground/30'} ${d === 16 ? 'border-r-2 border-r-muted-foreground/30' : ''}`}
                          >
                            {v ? fmtN(v, 1) : ''}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center bg-blue-50 font-semibold font-mono border-r-2 border-r-muted-foreground/30">
                        {fmtN(row.period1, 1) || '—'}
                      </TableCell>
                      <TableCell className="text-center bg-blue-50 font-semibold font-mono">
                        {fmtN(row.period2, 1) || '—'}
                      </TableCell>
                      <TableCell className="text-center bg-amber-50 font-bold font-mono">
                        {fmtN(row.total, 1)}
                      </TableCell>
                      <TableCell className="text-center bg-amber-50/70 font-mono text-[10px]">
                        {fmtM(row.period1Value)}
                      </TableCell>
                      <TableCell className="text-center bg-amber-50/70 font-mono text-[10px]">
                        {fmtM(row.period2Value)}
                      </TableCell>
                      <TableCell className="text-center bg-amber-100 font-semibold font-mono text-[10px]">
                        {fmtM(row.totalValue)}
                      </TableCell>
                      <TableCell className="text-center font-mono text-red-600 text-[10px]">
                        {row.transport > 0 ? fmtM(row.transport) : '—'}
                      </TableCell>
                      <TableCell className="text-center bg-emerald-50 font-bold font-mono text-emerald-700">
                        {fmtM(row.net)}
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground max-w-[80px] truncate">
                        {row.notes || ''}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* ── Totals row ── */}
                  <TableRow className="bg-emerald-100 border-t-2 border-primary font-bold">
                    <TableCell className="sticky right-0 bg-emerald-100 z-10" colSpan={2}>
                      مجموع اليوم
                    </TableCell>
                    {days.map((d) => {
                      const v = dailyTotals.get(d) ?? 0;
                      return (
                        <TableCell
                          key={d}
                          className={`text-center font-bold font-mono text-[10px] ${d === 16 ? 'border-r-2 border-r-muted-foreground/30' : ''}`}
                        >
                          {v > 0 ? fmtN(v, 1) : ''}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center bg-blue-200 font-bold font-mono border-r-2 border-r-muted-foreground/30">{fmtN(grandPeriod1, 1)}</TableCell>
                    <TableCell className="text-center bg-blue-200 font-bold font-mono">{fmtN(grandPeriod2, 1)}</TableCell>
                    <TableCell className="text-center bg-amber-200 font-bold font-mono">{fmtN(grandTotal, 1)}</TableCell>
                    <TableCell className="text-center bg-amber-100 font-bold font-mono text-[10px]">{fmtM(grandPeriod1Val)}</TableCell>
                    <TableCell className="text-center bg-amber-100 font-bold font-mono text-[10px]">{fmtM(grandPeriod2Val)}</TableCell>
                    <TableCell className="text-center bg-amber-200 font-bold font-mono text-[10px]">{fmtM(grandTotalVal)}</TableCell>
                    <TableCell className="text-center font-bold font-mono text-red-700">{fmtM(grandTransport)}</TableCell>
                    <TableCell className="text-center bg-emerald-200 font-bold font-mono text-emerald-800">{fmtM(grandNet)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Bottom section: 2 columns ── */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">

        {/* ── Transport table ── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">تكاليف النقل لكل ناقل</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {transporterRows.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">لا يوجد ناقلون مرتبطون بمنخرطين هذا الشهر</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الناقل</TableHead>
                    <TableHead className="text-center">المنخرطون</TableHead>
                    <TableHead className="text-center">اللترات</TableHead>
                    <TableHead className="text-center">الت/ل</TableHead>
                    <TableHead className="text-center">الإجمالي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transporterRows.map((tp) => (
                    <TableRow key={tp.name}>
                      <TableCell className="font-medium">{tp.name}</TableCell>
                      <TableCell className="text-center">{tp.members.length}</TableCell>
                      <TableCell className="text-center font-mono">{fmtN(tp.totalLiters, 1)}</TableCell>
                      <TableCell className="text-center font-mono text-xs">{tp.costPerLiter.toFixed(2)}</TableCell>
                      <TableCell className="text-center font-bold font-mono text-red-600">{fmtM(tp.totalCost)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-emerald-50 border-t-2 border-primary font-bold">
                    <TableCell colSpan={4}>الإجمالي</TableCell>
                    <TableCell className="text-center font-bold font-mono text-red-700">{fmtM(grandTransport)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* ── Financial summary ── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">الملخص المالي الشهري</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {[
                { label: 'مجموع اللترات المستلمة', val: `${fmtN(grandTotal, 1)} لتر`, cls: '' },
                { label: 'إجمالي مستحقات المنخرطين', val: `${fmtM(grandTotalVal)} ${currency}`, cls: '' },
                { label: 'اقتطاعات النقل', val: `- ${fmtM(grandTransport)} ${currency}`, cls: 'text-red-600' },
                { label: 'الصافي المدفوع للمنخرطين', val: `${fmtM(grandNet)} ${currency}`, cls: 'font-bold' },
              ].map((item) => (
                <div key={item.label} className="flex justify-between border-b pb-1 last:border-0">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className={`font-mono ${item.cls}`}>{item.val}</span>
                </div>
              ))}
              <div className="border-t-2 pt-2 mt-1 space-y-2">
                {[
                  { label: 'مداخيل بيع الحليب للشركات', val: `${fmtM(monthDeliveryIncome)} ${currency}`, cls: 'text-emerald-600' },
                  { label: 'مداخيل أخرى (ميزانية)', val: `${fmtM(totalOtherIncome)} ${currency}`, cls: 'text-emerald-600' },
                  { label: 'إجمالي المداخيل', val: `${fmtM(totalIncome)} ${currency}`, cls: 'font-bold text-emerald-700' },
                  { label: 'إجمالي المصاريف', val: `${fmtM(totalExpenses)} ${currency}`, cls: 'font-bold text-red-600' },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between border-b pb-1 last:border-0">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className={`font-mono ${item.cls}`}>{item.val}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-1 border-t-2 border-primary">
                  <span className="font-bold text-base">الرصيد النهائي</span>
                  <span className={`font-bold font-mono text-base ${budgetBalance >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {budgetBalance >= 0 ? '+' : ''}{budgetBalance.toLocaleString('fr-MA', { maximumFractionDigits: 2 })} {currency}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Extra expenses ── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">مصاريف إضافية في التقرير</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="البيان (مثل: الكهرباء، العمال...)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="المبلغ"
              type="number"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              className="w-36"
              dir="ltr"
              onKeyDown={(e) => { if (e.key === 'Enter') addExtra(); }}
            />
            <Button onClick={addExtra} className="gap-1 shrink-0">
              <Plus className="h-4 w-4" /> إضافة
            </Button>
          </div>
          {/* Firebase expenses for the month */}
          {monthExpenses.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-2">المصاريف المسجلة في الميزانية لهذا الشهر:</p>
              <div className="space-y-1">
                {monthExpenses.map((e) => (
                  <div key={e.id} className="flex justify-between items-center text-sm bg-muted/40 rounded px-3 py-1.5">
                    <span>{e.label}</span>
                    <span className="font-mono text-red-600">{e.amount.toLocaleString('fr-MA', { maximumFractionDigits: 2 })} {currency}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Ad-hoc extra expenses */}
          {extraExpenses.length > 0 && (
            <div className="space-y-1">
              {extraExpenses.map((e) => (
                <div key={e.id} className="flex justify-between items-center text-sm bg-blue-50 rounded px-3 py-1.5">
                  <span>{e.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-red-600">{e.amount.toLocaleString('fr-MA', { maximumFractionDigits: 2 })} {currency}</span>
                    <button onClick={() => removeExtra(e.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {extraExpenses.length === 0 && monthExpenses.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              لا توجد مصاريف مسجلة. أضف مصاريف الكهرباء والعمال والصيانة...
            </p>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
