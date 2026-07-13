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
import { monthKey, priceForMonth, monthLabel as monthLabelAr, monthLabelFr, generateMonthOptions } from '@/lib/calculations';
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
const MONTH_OPTIONS = generateMonthOptions(36);

// Format liters (empty string when 0)
function fmtL(n: number): string {
  if (n === 0) return '';
  return n.toLocaleString('fr-MA', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}
// Format money (dash when 0)
function fmtM(n: number): string {
  if (n === 0) return '—';
  return n.toLocaleString('fr-MA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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
  days: Map<number, number>;   // day-of-month → liters
  period1Liters: number;       // days 1-15 total liters
  period2Liters: number;       // days 16-end total liters
  totalLiters: number;
  pricePerLiter: number;
  period1Value: number;        // period1Liters × price
  period2Value: number;        // period2Liters × price
  totalValue: number;          // totalLiters × price (الإجمالي بالدرهم)
  transport: number;           // النقل
  debt: number;                // الديون (currently 0 — no debt field in schema)
  deduction: number;           // خصم النقل = transport + debt
  net: number;                 // الباقي الصافي = totalValue - deduction
  notes: string;
}

interface TransporterRow {
  name: string;
  memberCount: number;
  totalLiters: number;
  costPerLiter: number;
  totalCost: number;
}

// ── PDF/Print helper ───────────────────────────────────────────────────────
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

function openPrintWindow(html: string) {
  const win = window.open('', '_blank', 'width=1200,height=850');
  if (!win) {
    alert('⚠️ تم حجب النافذة المنبثقة.\nيرجى السماح بالنوافذ المنبثقة لهذا الموقع ثم المحاولة مجدداً.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  const printOnce = () => { if (!(win as any).__p) { (win as any).__p = true; win.print(); } };
  win.onload = () => setTimeout(printOnce, 400);
  setTimeout(() => { if (!win.closed) printOnce(); }, 2000);
}

// ── Main component ─────────────────────────────────────────────────────────
export default function MonthlyReport() {
  const uid = useId();
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

  // ── Days in month ──
  const daysInMonth = useMemo(() => {
    const [y, m] = monthFilter.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }, [monthFilter]);

  // Days 1-15 and 16-end
  const days1to15 = useMemo(() => Array.from({ length: 15 }, (_, i) => i + 1), []);
  const days16toEnd = useMemo(
    () => Array.from({ length: daysInMonth - 15 }, (_, i) => i + 16),
    [daysInMonth],
  );

  // ── Receipts for this month ──
  const monthReceipts = useMemo(
    () => receipts.filter((r) => monthKey(r.date) === monthFilter),
    [receipts, monthFilter],
  );

  // ── Monthly price ──
  const monthPrice = useMemo(() => priceForMonth(prices, monthFilter), [prices, monthFilter]);

  // ── Transporter lookup ──
  const transporterById = useMemo(
    () => new Map(transporters.map((t) => [t.id, t])),
    [transporters],
  );

  // ── Member rows ──
  const memberRows = useMemo((): MemberRow[] => {
    const ids = new Set(monthReceipts.map((r) => r.memberId));
    const relevant = members
      .filter((m) => ids.has(m.id))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'));

    return relevant.map((member, idx) => {
      const mRec = monthReceipts.filter((r) => r.memberId === member.id);

      // Build daily map
      const dayMap = new Map<number, number>();
      for (const r of mRec) {
        const day = parseInt(r.date.split('-')[2]);
        dayMap.set(day, (dayMap.get(day) ?? 0) + r.quantityLiters);
      }

      // Period liters
      let p1 = 0;
      let p2 = 0;
      for (const [d, liters] of dayMap) {
        if (d <= 15) p1 += liters;
        else p2 += liters;
      }
      const total = p1 + p2;

      // Effective price per liter
      const grossRaw = mRec.reduce(
        (s, r) => s + r.quantityLiters * (r.pricePerLiter ?? monthPrice),
        0,
      );
      const effectivePrice = total > 0 ? grossRaw / total : monthPrice;

      // Values
      const p1Value = p1 * effectivePrice;
      const p2Value = p2 * effectivePrice;
      const totalValue = p1Value + p2Value;

      // Transport (النقل)
      const transport = mRec.reduce((s, r) => {
        if (r.transportCost !== undefined) return s + r.transportCost;
        const tid = member.transporterId ?? r.transporterId;
        const tp = tid ? transporterById.get(tid) : undefined;
        return s + r.quantityLiters * (tp?.costPerLiter ?? 0);
      }, 0);

      // Debts (الديون) — no field in schema yet, always 0
      const debt = 0;
      const deduction = transport + debt;
      const net = totalValue - deduction;

      // Notes
      const notes = mRec.map((r) => r.notes).filter(Boolean).join(' | ');

      return {
        seq: idx + 1,
        memberId: member.id,
        memberName: member.fullName,
        days: dayMap,
        period1Liters: p1,
        period2Liters: p2,
        totalLiters: total,
        pricePerLiter: effectivePrice,
        period1Value: p1Value,
        period2Value: p2Value,
        totalValue,
        transport,
        debt,
        deduction,
        net,
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
  const G = useMemo(() => ({
    p1: memberRows.reduce((s, r) => s + r.period1Liters, 0),
    p2: memberRows.reduce((s, r) => s + r.period2Liters, 0),
    total: memberRows.reduce((s, r) => s + r.totalLiters, 0),
    p1Val: memberRows.reduce((s, r) => s + r.period1Value, 0),
    p2Val: memberRows.reduce((s, r) => s + r.period2Value, 0),
    totalVal: memberRows.reduce((s, r) => s + r.totalValue, 0),
    transport: memberRows.reduce((s, r) => s + r.transport, 0),
    debt: 0,
    deduction: memberRows.reduce((s, r) => s + r.deduction, 0),
    net: memberRows.reduce((s, r) => s + r.net, 0),
  }), [memberRows]);

  // ── Transporter summary ──
  const transporterRows = useMemo((): TransporterRow[] => {
    const map = new Map<string, { name: string; members: Set<string>; totalLiters: number; costPerLiter: number; totalCost: number }>();
    for (const row of memberRows) {
      const member = members.find((m) => m.id === row.memberId);
      const tid = member?.transporterId;
      if (!tid) continue;
      const tp = transporterById.get(tid);
      if (!tp) continue;
      if (!map.has(tid)) {
        map.set(tid, { name: tp.fullName, members: new Set(), totalLiters: 0, costPerLiter: tp.costPerLiter, totalCost: 0 });
      }
      const e = map.get(tid)!;
      e.members.add(row.memberName);
      e.totalLiters += row.totalLiters;
      e.totalCost += row.transport;
    }
    return Array.from(map.values()).map((e) => ({
      name: e.name,
      memberCount: e.members.size,
      totalLiters: e.totalLiters,
      costPerLiter: e.costPerLiter,
      totalCost: e.totalCost,
    }));
  }, [memberRows, members, transporterById]);

  // ── Financial summary ──
  const monthIncomes = useMemo(() => incomes.filter((i) => monthKey(i.date) === monthFilter), [incomes, monthFilter]);
  const monthExpenses = useMemo(() => expenses.filter((e) => monthKey(e.date) === monthFilter), [expenses, monthFilter]);
  const deliveryIncome = useMemo(
    () => deliveries.filter((d) => monthKey(d.date) === monthFilter).reduce((s, d) => s + d.quantityLiters * d.pricePerLiter, 0),
    [deliveries, monthFilter],
  );
  const otherIncome = monthIncomes.reduce((s, i) => s + i.amount, 0);
  const firebaseExpenses = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const extraExpensesTotal = extraExpenses.reduce((s, e) => s + e.amount, 0);
  const totalIncome = deliveryIncome + otherIncome;
  const totalExpenses = firebaseExpenses + extraExpensesTotal + G.transport;
  const finalBalance = totalIncome - totalExpenses - G.net;

  // ── Extra expense handlers ──
  function addExtra() {
    const amt = parseFloat(newAmount);
    if (!newLabel.trim() || isNaN(amt) || amt <= 0) return;
    setExtraExpenses((p) => [...p, { id: `${uid}-${Date.now()}`, label: newLabel.trim(), amount: amt }]);
    setNewLabel('');
    setNewAmount('');
  }
  function removeExtra(id: string) {
    setExtraExpenses((p) => p.filter((e) => e.id !== id));
  }

  // ── PDF generation ──
  async function handlePdf() {
    const logoBase64 = settings?.logoUrl ? await urlToBase64(settings.logoUrl) : '';
    const logoHtml = logoBase64 ? `<img src="${logoBase64}" alt="logo" class="logo" />` : '';
    const coopName = settings?.coopName ?? 'تعاونية كوب بوعلا';
    const now = new Date();
    const printedAr = now.toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric' });
    const printedFr = now.toLocaleDateString('fr-MA', { year: 'numeric', month: 'long', day: 'numeric' });

    // Build member rows HTML for PDF
    const membersHtml = memberRows.map((row) => {
      const d1 = days1to15.map((d) => {
        const v = row.days.get(d);
        return `<td>${v ? fmtL(v) : ''}</td>`;
      }).join('');
      const d2 = days16toEnd.map((d) => {
        const v = row.days.get(d);
        return `<td>${v ? fmtL(v) : ''}</td>`;
      }).join('');

      return `<tr>
        <td class="seq">${row.seq}</td>
        <td class="name">${row.memberName}</td>
        ${d1}
        <td class="p1">${fmtL(row.period1Liters)}</td>
        ${d2}
        <td class="p2">${fmtL(row.period2Liters)}</td>
        <td class="tot">${fmtL(row.totalLiters)}</td>
        <td class="val">${fmtM(row.period1Value)}</td>
        <td class="val">${fmtM(row.period2Value)}</td>
        <td class="val tot">${fmtM(row.totalValue)}</td>
        <td class="transport">${row.transport > 0 ? fmtM(row.transport) : ''}</td>
        <td class="debt">${row.debt > 0 ? fmtM(row.debt) : ''}</td>
        <td class="deduct">${row.deduction > 0 ? fmtM(row.deduction) : ''}</td>
        <td class="net">${fmtM(row.net)}</td>
        <td class="notes">${row.notes}</td>
      </tr>`;
    }).join('');

    // Daily totals row
    const dt1 = days1to15.map((d) => {
      const v = dailyTotals.get(d) ?? 0;
      return `<td><strong>${v > 0 ? fmtL(v) : ''}</strong></td>`;
    }).join('');
    const dt2 = days16toEnd.map((d) => {
      const v = dailyTotals.get(d) ?? 0;
      return `<td><strong>${v > 0 ? fmtL(v) : ''}</strong></td>`;
    }).join('');

    // Transport table HTML
    const tpHtml = transporterRows.length > 0 ? `
    <h3>جدول الناقلين — Coûts de transport</h3>
    <table class="small">
      <thead><tr><th>الناقل</th><th>المنخرطون</th><th>مجموع اللترات</th><th>التكلفة/ل</th><th>الإجمالي (${currency})</th></tr></thead>
      <tbody>
        ${transporterRows.map(tp => `<tr>
          <td class="name">${tp.name}</td>
          <td>${tp.memberCount}</td>
          <td>${fmtL(tp.totalLiters)}</td>
          <td>${fmtM(tp.costPerLiter)}</td>
          <td class="net">${fmtM(tp.totalCost)}</td>
        </tr>`).join('')}
        <tr class="grand"><td colspan="4"><strong>الإجمالي</strong></td><td><strong>${fmtM(G.transport)}</strong></td></tr>
      </tbody>
    </table>` : '';

    // Expenses HTML
    const allExpHtml = [
      ...monthExpenses.map(e => `<tr><td class="name">${e.label}</td><td class="val">${fmtM(e.amount)}</td></tr>`),
      ...extraExpenses.map(e => `<tr><td class="name">${e.label}</td><td class="val">${fmtM(e.amount)}</td></tr>`),
    ].join('');

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>التقرير الشهري — ${monthLabelAr(monthFilter)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, 'Segoe UI', sans-serif; font-size: 6.5px; color: #111; background: #fff; padding: 4px 5px; direction: rtl; }
  @page { size: A4 landscape; margin: 0.3cm; }

  /* ── Header ── */
  .hdr { display:flex; align-items:center; justify-content:space-between; border-bottom:2.5px solid #15803d; padding-bottom:5px; margin-bottom:6px; }
  .logo { width:50px; height:50px; object-fit:contain; border-radius:5px; }
  .hdr-center { text-align:center; }
  .hdr-title { font-size:13px; font-weight:800; color:#15803d; }
  .hdr-subtitle { font-size:8px; color:#555; margin-top:2px; }
  .hdr-month { font-size:11px; font-weight:800; color:#15803d; margin-top:3px; }
  .hdr-info { font-size:7px; color:#333; line-height:1.7; text-align:left; }
  .hdr-info strong { color:#15803d; }

  /* ── Main table ── */
  table { width:100%; border-collapse:collapse; margin-bottom:5px; }
  th { background:#15803d; color:#fff; padding:2px 1px; text-align:center; font-size:6px; border:0.5px solid #0f7130; white-space:nowrap; vertical-align:middle; }
  td { padding:1.5px 1px; text-align:center; border:0.5px solid #ccc; font-size:6.5px; vertical-align:middle; }
  tr:nth-child(even) td { background:#f9fafb; }

  td.name, th.name { text-align:right; padding-right:3px; min-width:68px; font-size:6.5px; }
  td.seq { font-weight:700; min-width:14px; }
  td.p1, td.p2 { background:#dbeafe !important; font-weight:700; min-width:24px; }
  td.tot { background:#fef9c3 !important; font-weight:700; }
  td.val { background:#fef3c7 !important; min-width:36px; }
  td.tot.val { background:#fbbf24 !important; font-weight:700; }
  td.transport { color:#dc2626; min-width:30px; }
  td.debt { color:#b45309; min-width:26px; }
  td.deduct { color:#991b1b; font-weight:700; min-width:30px; }
  td.net { color:#15803d; font-weight:700; font-size:7px; min-width:38px; }
  td.notes { font-size:5.5px; text-align:right; padding-right:2px; min-width:40px; }

  tr.grand td { background:#dcfce7 !important; font-weight:800; border-top:2px solid #15803d; font-size:7px; }
  tr.grand td.p1, tr.grand td.p2 { background:#93c5fd !important; }
  tr.grand td.tot { background:#fde68a !important; }
  tr.grand td.val { background:#fcd34d !important; }
  tr.grand td.tot.val { background:#f59e0b !important; }
  tr.grand td.net { color:#15803d; font-size:7.5px; }

  /* ── Section separator ── */
  .sep-line { border-top:2.5px solid #6b7280; }

  /* ── Small tables (transport, financial) ── */
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px; }
  table.small th { font-size:6.5px; }
  table.small td { font-size:6.5px; }
  h3 { font-size:8.5px; font-weight:800; color:#15803d; margin:6px 0 3px; border-bottom:1px solid #86efac; padding-bottom:2px; }

  /* Financial summary */
  .fin-row td:first-child { text-align:right; padding-right:4px; }
  .fin-highlight td { background:#dcfce7 !important; font-weight:800; font-size:8px; }
  .fin-highlight.red td { background:#fee2e2 !important; color:#dc2626; }
  .fin-final td { background:#15803d !important; color:#fff !important; font-size:10px; font-weight:900; border-top:2px solid #064e3b; }

  .footer { margin-top:8px; text-align:center; font-size:6.5px; color:#999; border-top:1px solid #e5e7eb; padding-top:4px; }
  @media print { body { padding: 2px; } @page { size: A4 landscape; margin: 0.3cm; } }
</style>
</head>
<body>

<div class="hdr">
  ${logoHtml}
  <div class="hdr-center">
    <div class="hdr-title">${coopName}</div>
    <div class="hdr-subtitle">التقرير الشهري الشامل — Rapport mensuel complet</div>
    <div class="hdr-month">${monthLabelAr(monthFilter)} | ${monthLabelFr(monthFilter)}</div>
  </div>
  <div class="hdr-info">
    <div>مجموع اللترات: <strong>${fmtL(G.total)} لتر</strong></div>
    <div>ثمن اللتر الواحد: <strong>${monthPrice.toFixed(2)} ${currency}</strong></div>
    <div>عدد المنخرطين: <strong>${memberRows.length}</strong></div>
    <div>طُبع: ${printedAr}</div>
    <div>Imprimé le ${printedFr}</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th rowspan="2" class="seq">#</th>
      <th rowspan="2" class="name">الاسم الكامل</th>
      ${days1to15.map(d => `<th>${d}</th>`).join('')}
      <th rowspan="2" class="p1">مج<br>ف1<br><small>1-15</small></th>
      ${days16toEnd.map(d => `<th>${d}</th>`).join('')}
      <th rowspan="2" class="p2">مج<br>ف2<br><small>16+</small></th>
      <th rowspan="2" class="tot">مجموع<br>اللترات</th>
      <th rowspan="2" class="val">15-1<br><small>(${currency})</small></th>
      <th rowspan="2" class="val">15-2<br><small>(${currency})</small></th>
      <th rowspan="2" class="val tot">الإجمالي<br><small>(${currency})</small></th>
      <th rowspan="2">النقل<br><small>(${currency})</small></th>
      <th rowspan="2">الديون<br><small>(${currency})</small></th>
      <th rowspan="2">خصم<br>النقل</th>
      <th rowspan="2" class="net">الباقي<br>الصافي</th>
      <th rowspan="2" class="notes">ملاحظات</th>
    </tr>
    <tr></tr>
  </thead>
  <tbody>
    ${membersHtml}
    <tr class="grand">
      <td colspan="2"><strong>مجموع اليوم / الإجمالي</strong></td>
      ${dt1}
      <td class="p1"><strong>${fmtL(G.p1)}</strong></td>
      ${dt2}
      <td class="p2"><strong>${fmtL(G.p2)}</strong></td>
      <td class="tot"><strong>${fmtL(G.total)}</strong></td>
      <td class="val"><strong>${fmtM(G.p1Val)}</strong></td>
      <td class="val"><strong>${fmtM(G.p2Val)}</strong></td>
      <td class="val tot"><strong>${fmtM(G.totalVal)}</strong></td>
      <td class="transport"><strong>${G.transport > 0 ? fmtM(G.transport) : '—'}</strong></td>
      <td class="debt">—</td>
      <td class="deduct"><strong>${G.deduction > 0 ? fmtM(G.deduction) : '—'}</strong></td>
      <td class="net"><strong>${fmtM(G.net)}</strong></td>
      <td></td>
    </tr>
  </tbody>
</table>

<div class="two-col">
  <div>
    ${tpHtml}
    ${(monthExpenses.length > 0 || extraExpenses.length > 0) ? `
    <h3>المصاريف الأخرى — Autres dépenses</h3>
    <table class="small">
      <thead><tr><th class="name">البيان</th><th>المبلغ (${currency})</th></tr></thead>
      <tbody>
        ${allExpHtml}
        <tr class="grand"><td><strong>الإجمالي</strong></td><td><strong>${fmtM(firebaseExpenses + extraExpensesTotal)}</strong></td></tr>
      </tbody>
    </table>` : ''}
  </div>
  <div>
    <h3>الملخص المالي الشهري — Bilan financier mensuel</h3>
    <table class="small">
      <thead><tr><th class="name">البيان</th><th>المبلغ (${currency})</th></tr></thead>
      <tbody>
        <tr><td class="name">مجموع اللترات المستلمة</td><td>${fmtL(G.total)} لتر</td></tr>
        <tr><td class="name">إجمالي مستحقات المنخرطين (الإجمالي DH)</td><td>${fmtM(G.totalVal)}</td></tr>
        <tr><td class="name">اقتطاع النقل</td><td style="color:#dc2626">- ${G.transport > 0 ? fmtM(G.transport) : '0'}</td></tr>
        <tr class="fin-highlight"><td>الصافي المدفوع للمنخرطين</td><td>${fmtM(G.net)}</td></tr>
        <tr><td colspan="2" style="border:0;height:3px"></td></tr>
        <tr><td class="name">مداخيل بيع الحليب للشركات</td><td>${fmtM(deliveryIncome) === '—' ? '0' : fmtM(deliveryIncome)}</td></tr>
        <tr><td class="name">مداخيل أخرى</td><td>${fmtM(otherIncome) === '—' ? '0' : fmtM(otherIncome)}</td></tr>
        <tr class="fin-highlight"><td>إجمالي المداخيل</td><td>${fmtM(totalIncome) === '—' ? '0' : fmtM(totalIncome)}</td></tr>
        <tr><td colspan="2" style="border:0;height:3px"></td></tr>
        <tr><td class="name">تكاليف النقل</td><td style="color:#dc2626">${G.transport > 0 ? fmtM(G.transport) : '0'}</td></tr>
        <tr><td class="name">مصاريف أخرى</td><td style="color:#dc2626">${fmtM(firebaseExpenses + extraExpensesTotal) === '—' ? '0' : fmtM(firebaseExpenses + extraExpensesTotal)}</td></tr>
        <tr class="fin-highlight red"><td>إجمالي المصاريف</td><td>${fmtM(totalExpenses) === '—' ? '0' : fmtM(totalExpenses)}</td></tr>
        <tr class="fin-final"><td><strong>الرصيد النهائي</strong></td><td><strong>${finalBalance >= 0 ? '+' : ''}${finalBalance.toLocaleString('fr-MA', { maximumFractionDigits: 1 })}</strong></td></tr>
      </tbody>
    </table>
  </div>
</div>

<div class="footer">
  ${coopName} — التقرير الشهري الرسمي — ${monthLabelAr(monthFilter)}<br>
  طُبع بتاريخ ${printedAr} | Imprimé le ${printedFr}
</div>

</body></html>`;

    openPrintWindow(html);
  }

  // ── Excel export ──
  async function handleExcel() {
    const cols = [
      { header: '#', key: 'seq' },
      { header: 'الاسم الكامل', key: 'name' },
      ...days1to15.map((d) => ({ header: String(d), key: `d${d}` })),
      { header: 'مجموع ف1 (لتر)', key: 'p1' },
      ...days16toEnd.map((d) => ({ header: String(d), key: `d${d}` })),
      { header: 'مجموع ف2 (لتر)', key: 'p2' },
      { header: 'مجموع اللترات', key: 'total' },
      { header: `قيمة ف1 (${currency})`, key: 'p1v' },
      { header: `قيمة ف2 (${currency})`, key: 'p2v' },
      { header: `الإجمالي (${currency})`, key: 'totalv' },
      { header: `النقل (${currency})`, key: 'transport' },
      { header: `الديون (${currency})`, key: 'debt' },
      { header: `خصم النقل (${currency})`, key: 'deduction' },
      { header: `الباقي الصافي (${currency})`, key: 'net' },
      { header: 'ملاحظات', key: 'notes' },
    ];

    const allDays = [...days1to15, ...days16toEnd];

    const rows = [
      ...memberRows.map((row) => {
        const r: Record<string, string | number> = {
          seq: row.seq,
          name: row.memberName,
          p1: row.period1Liters,
          p2: row.period2Liters,
          total: row.totalLiters,
          p1v: row.period1Value,
          p2v: row.period2Value,
          totalv: row.totalValue,
          transport: row.transport,
          debt: row.debt,
          deduction: row.deduction,
          net: row.net,
          notes: row.notes,
        };
        allDays.forEach((d) => { r[`d${d}`] = row.days.get(d) ?? ''; });
        return r;
      }),
      // Grand totals row
      (() => {
        const r: Record<string, string | number> = {
          seq: '',
          name: 'الإجمالي',
          p1: G.p1,
          p2: G.p2,
          total: G.total,
          p1v: G.p1Val,
          p2v: G.p2Val,
          totalv: G.totalVal,
          transport: G.transport,
          debt: G.debt,
          deduction: G.deduction,
          net: G.net,
          notes: '',
        };
        allDays.forEach((d) => { r[`d${d}`] = dailyTotals.get(d) ?? ''; });
        return r;
      })(),
    ];

    await exportToExcel(`تقرير ${monthLabelAr(monthFilter)}`, cols, rows, `تقرير-شهري-${monthFilter}`);
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
            تقرير إجمالي شامل — {monthLabelAr(monthFilter)}
            {monthPrice > 0 && <span className="mr-2">· ثمن اللتر: <span className="font-semibold text-foreground">{monthPrice.toFixed(2)} {currency}</span></span>}
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
          { label: 'مجموع اللترات', val: `${fmtL(G.total) || '0'} لتر`, color: 'text-blue-600' },
          { label: 'الإجمالي بالدرهم', val: `${G.totalVal.toLocaleString('fr-MA', { maximumFractionDigits: 1 })} ${currency}`, color: 'text-amber-700' },
          { label: 'خصم النقل', val: `${G.deduction > 0 ? G.deduction.toLocaleString('fr-MA', { maximumFractionDigits: 1 }) : '0'} ${currency}`, color: 'text-red-600' },
          { label: 'الباقي الصافي', val: `${G.net.toLocaleString('fr-MA', { maximumFractionDigits: 1 })} ${currency}`, color: 'text-emerald-700' },
        ].map((card) => (
          <Card key={card.label} className="shadow-sm">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
              <p className={`text-xl font-bold font-mono ${card.color}`} dir="ltr">{card.val}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Export buttons ── */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button onClick={handlePdf} className="gap-2 bg-emerald-700 hover:bg-emerald-800">
          <FileText className="h-4 w-4" /> تصدير PDF
        </Button>
        <Button variant="outline" onClick={handlePdf} className="gap-2">
          <Printer className="h-4 w-4" /> طباعة
        </Button>
        <Button variant="outline" onClick={handleExcel} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" /> تصدير Excel
        </Button>
      </div>

      {/* ── Main table ── */}
      <Card className="mb-6 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            جدول الحليب التفصيلي — {monthLabelAr(monthFilter)}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {memberRows.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              لا توجد بيانات حليب مسجلة لهذا الشهر
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-[11px] whitespace-nowrap">
                <TableHeader>
                  <TableRow className="bg-primary hover:bg-primary">
                    <TableHead className="text-primary-foreground text-center sticky right-0 bg-primary z-20 w-8">#</TableHead>
                    <TableHead className="text-primary-foreground sticky right-8 bg-primary z-20 min-w-[130px]">الاسم الكامل</TableHead>
                    {/* Period 1: days 1-15 */}
                    {days1to15.map((d) => (
                      <TableHead key={d} className="text-primary-foreground text-center w-8 px-1 min-w-[28px]">{d}</TableHead>
                    ))}
                    {/* Period 1 sum */}
                    <TableHead className="text-primary-foreground text-center bg-blue-700 px-1 min-w-[44px] border-r-2 border-r-white/30">
                      مج.ف1<br/><span className="text-[9px]">1-15</span>
                    </TableHead>
                    {/* Period 2: days 16-end */}
                    {days16toEnd.map((d) => (
                      <TableHead key={d} className={`text-primary-foreground text-center w-8 px-1 min-w-[28px] ${d === 16 ? 'border-r-2 border-r-white/30' : ''}`}>{d}</TableHead>
                    ))}
                    {/* Period 2 sum */}
                    <TableHead className="text-primary-foreground text-center bg-blue-700 px-1 min-w-[44px] border-r-2 border-r-white/30">
                      مج.ف2<br/><span className="text-[9px]">16+</span>
                    </TableHead>
                    {/* Totals */}
                    <TableHead className="text-primary-foreground text-center bg-amber-600 px-1 min-w-[52px]">مجموع<br/>اللترات</TableHead>
                    <TableHead className="text-primary-foreground text-center bg-amber-700 px-1 min-w-[60px]">15-1<br/><span className="text-[9px]">({currency})</span></TableHead>
                    <TableHead className="text-primary-foreground text-center bg-amber-700 px-1 min-w-[60px]">15-2<br/><span className="text-[9px]">({currency})</span></TableHead>
                    <TableHead className="text-primary-foreground text-center bg-amber-800 px-1 min-w-[66px]">الإجمالي<br/><span className="text-[9px]">({currency})</span></TableHead>
                    <TableHead className="text-primary-foreground text-center bg-red-700 px-1 min-w-[56px]">النقل<br/><span className="text-[9px]">({currency})</span></TableHead>
                    <TableHead className="text-primary-foreground text-center bg-orange-700 px-1 min-w-[52px]">الديون<br/><span className="text-[9px]">({currency})</span></TableHead>
                    <TableHead className="text-primary-foreground text-center bg-red-800 px-1 min-w-[56px]">خصم<br/>النقل</TableHead>
                    <TableHead className="text-primary-foreground text-center bg-emerald-700 px-1 min-w-[64px]">الباقي<br/>الصافي</TableHead>
                    <TableHead className="text-primary-foreground text-center px-1 min-w-[72px]">ملاحظات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberRows.map((row, ri) => (
                    <TableRow key={row.memberId} className={ri % 2 === 1 ? 'bg-muted/30' : ''}>
                      <TableCell className="sticky right-0 bg-background z-10 text-center font-bold text-[10px] px-1">{row.seq}</TableCell>
                      <TableCell className="sticky right-8 bg-background z-10 font-medium">{row.memberName}</TableCell>
                      {/* Days 1-15 */}
                      {days1to15.map((d) => {
                        const v = row.days.get(d);
                        return (
                          <TableCell key={d} className={`text-center px-1 font-mono ${v ? 'text-blue-700 font-medium' : 'text-muted-foreground/20'}`}>
                            {v ? fmtL(v) : ''}
                          </TableCell>
                        );
                      })}
                      {/* Period 1 sum */}
                      <TableCell className="text-center bg-blue-100 font-bold font-mono border-r-2 border-r-muted-foreground/30 text-blue-800">
                        {fmtL(row.period1Liters) || '—'}
                      </TableCell>
                      {/* Days 16-end */}
                      {days16toEnd.map((d) => {
                        const v = row.days.get(d);
                        return (
                          <TableCell key={d} className={`text-center px-1 font-mono ${d === 16 ? 'border-r-2 border-r-muted-foreground/20' : ''} ${v ? 'text-blue-700 font-medium' : 'text-muted-foreground/20'}`}>
                            {v ? fmtL(v) : ''}
                          </TableCell>
                        );
                      })}
                      {/* Period 2 sum */}
                      <TableCell className="text-center bg-blue-100 font-bold font-mono border-r-2 border-r-muted-foreground/30 text-blue-800">
                        {fmtL(row.period2Liters) || '—'}
                      </TableCell>
                      {/* Grand total liters */}
                      <TableCell className="text-center bg-amber-50 font-bold font-mono text-amber-900">
                        {fmtL(row.totalLiters)}
                      </TableCell>
                      {/* Values */}
                      <TableCell className="text-center bg-amber-50/60 font-mono text-[10px]">{fmtM(row.period1Value)}</TableCell>
                      <TableCell className="text-center bg-amber-50/60 font-mono text-[10px]">{fmtM(row.period2Value)}</TableCell>
                      <TableCell className="text-center bg-amber-100 font-bold font-mono text-[10px] text-amber-900">{fmtM(row.totalValue)}</TableCell>
                      {/* Transport, debt, deduction, net */}
                      <TableCell className="text-center font-mono text-red-600 text-[10px]">
                        {row.transport > 0 ? fmtM(row.transport) : ''}
                      </TableCell>
                      <TableCell className="text-center font-mono text-orange-700 text-[10px]">
                        {row.debt > 0 ? fmtM(row.debt) : ''}
                      </TableCell>
                      <TableCell className="text-center font-bold font-mono text-red-800 text-[10px]">
                        {row.deduction > 0 ? fmtM(row.deduction) : ''}
                      </TableCell>
                      <TableCell className="text-center bg-emerald-50 font-bold font-mono text-emerald-700">
                        {fmtM(row.net)}
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground max-w-[80px] truncate">
                        {row.notes}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* ── Grand totals row ── */}
                  <TableRow className="bg-emerald-100 border-t-2 border-primary font-bold">
                    <TableCell className="sticky right-0 bg-emerald-100 z-10 text-center" />
                    <TableCell className="sticky right-8 bg-emerald-100 z-10 font-bold text-xs">مجموع اليوم</TableCell>
                    {days1to15.map((d) => {
                      const v = dailyTotals.get(d) ?? 0;
                      return (
                        <TableCell key={d} className="text-center font-bold font-mono text-[10px]">
                          {v > 0 ? fmtL(v) : ''}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center bg-blue-200 font-bold font-mono text-blue-900 border-r-2 border-r-muted-foreground/30">{fmtL(G.p1)}</TableCell>
                    {days16toEnd.map((d) => {
                      const v = dailyTotals.get(d) ?? 0;
                      return (
                        <TableCell key={d} className={`text-center font-bold font-mono text-[10px] ${d === 16 ? 'border-r-2 border-r-muted-foreground/20' : ''}`}>
                          {v > 0 ? fmtL(v) : ''}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center bg-blue-200 font-bold font-mono text-blue-900 border-r-2 border-r-muted-foreground/30">{fmtL(G.p2)}</TableCell>
                    <TableCell className="text-center bg-amber-200 font-bold font-mono text-amber-900">{fmtL(G.total)}</TableCell>
                    <TableCell className="text-center bg-amber-100 font-bold font-mono text-[10px]">{fmtM(G.p1Val)}</TableCell>
                    <TableCell className="text-center bg-amber-100 font-bold font-mono text-[10px]">{fmtM(G.p2Val)}</TableCell>
                    <TableCell className="text-center bg-amber-200 font-bold font-mono text-amber-900">{fmtM(G.totalVal)}</TableCell>
                    <TableCell className="text-center font-bold font-mono text-red-700">{G.transport > 0 ? fmtM(G.transport) : '—'}</TableCell>
                    <TableCell className="text-center font-mono text-orange-700">—</TableCell>
                    <TableCell className="text-center font-bold font-mono text-red-800">{G.deduction > 0 ? fmtM(G.deduction) : '—'}</TableCell>
                    <TableCell className="text-center bg-emerald-200 font-bold font-mono text-emerald-800">{fmtM(G.net)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Bottom section ── */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">

        {/* Transporter table */}
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
                    <TableHead className="text-center">التكلفة/ل</TableHead>
                    <TableHead className="text-center">الإجمالي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transporterRows.map((tp) => (
                    <TableRow key={tp.name}>
                      <TableCell className="font-medium">{tp.name}</TableCell>
                      <TableCell className="text-center">{tp.memberCount}</TableCell>
                      <TableCell className="text-center font-mono">{fmtL(tp.totalLiters)}</TableCell>
                      <TableCell className="text-center font-mono text-xs">{tp.costPerLiter.toFixed(2)}</TableCell>
                      <TableCell className="text-center font-bold font-mono text-red-600">{fmtM(tp.totalCost)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-emerald-50 border-t-2 border-primary font-bold">
                    <TableCell colSpan={4}>الإجمالي</TableCell>
                    <TableCell className="text-center font-bold font-mono text-red-700">{fmtM(G.transport)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Financial summary */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">الملخص المالي الشهري</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 text-sm">
              {[
                { label: 'مجموع اللترات', val: `${fmtL(G.total) || '0'} لتر`, cls: '' },
                { label: 'الإجمالي بالدرهم', val: `${G.totalVal.toLocaleString('fr-MA', { maximumFractionDigits: 1 })} ${currency}`, cls: '' },
                { label: 'خصم النقل', val: `- ${G.transport.toLocaleString('fr-MA', { maximumFractionDigits: 1 })} ${currency}`, cls: 'text-red-600' },
                { label: 'الباقي الصافي للمنخرطين', val: `${G.net.toLocaleString('fr-MA', { maximumFractionDigits: 1 })} ${currency}`, cls: 'font-bold text-emerald-700' },
              ].map((item) => (
                <div key={item.label} className="flex justify-between border-b pb-1 last:border-0">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className={`font-mono ${item.cls}`}>{item.val}</span>
                </div>
              ))}
              <div className="border-t-2 pt-2 space-y-1.5">
                {[
                  { label: 'مداخيل بيع الحليب', val: `${deliveryIncome.toLocaleString('fr-MA', { maximumFractionDigits: 1 })} ${currency}`, cls: 'text-emerald-600' },
                  { label: 'مداخيل أخرى', val: `${otherIncome.toLocaleString('fr-MA', { maximumFractionDigits: 1 })} ${currency}`, cls: 'text-emerald-600' },
                  { label: 'إجمالي المداخيل', val: `${totalIncome.toLocaleString('fr-MA', { maximumFractionDigits: 1 })} ${currency}`, cls: 'font-bold text-emerald-700' },
                  { label: 'إجمالي المصاريف', val: `${totalExpenses.toLocaleString('fr-MA', { maximumFractionDigits: 1 })} ${currency}`, cls: 'font-bold text-red-600' },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between border-b pb-1 last:border-0">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className={`font-mono ${item.cls}`}>{item.val}</span>
                  </div>
                ))}
                <div className={`flex justify-between pt-2 border-t-2 border-primary rounded px-3 py-2 ${finalBalance >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <span className="font-bold text-base">الرصيد النهائي</span>
                  <span className={`font-bold font-mono text-lg ${finalBalance >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {finalBalance >= 0 ? '+' : ''}{finalBalance.toLocaleString('fr-MA', { maximumFractionDigits: 1 })} {currency}
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
              placeholder="البيان (الكهرباء، العمال، الصيانة...)"
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

          {monthExpenses.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-2">مصاريف مسجلة في الميزانية لهذا الشهر:</p>
              <div className="space-y-1">
                {monthExpenses.map((e) => (
                  <div key={e.id} className="flex justify-between text-sm bg-muted/40 rounded px-3 py-1.5">
                    <span>{e.label}</span>
                    <span className="font-mono text-red-600">{e.amount.toLocaleString('fr-MA', { maximumFractionDigits: 2 })} {currency}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
            <p className="text-sm text-muted-foreground text-center py-3">
              لا توجد مصاريف. يمكنك إضافة الكهرباء والعمال والصيانة وغيرها...
            </p>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
