import { Layout } from '@/components/Layout';
import { useSettings } from '@/hooks/useSettings';
import { useUsers, useMilkDelivered, useMilkReceived, useInvoices, useMembers } from '@/hooks/useData';
import { generateMonthOptions, monthKey, monthLabel as monthLabelAr } from '@/lib/calculations';
import { adminCreateUser } from '@/lib/adminCreateUser';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useState, useRef, useEffect } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Settings,
  Users,
  Shield,
  Plus,
  Upload,
  Loader2,
  Save,
  Trash2,
  DollarSign,
  Database,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { Role } from '@/lib/types';

const RECORD_MONTH_OPTIONS = generateMonthOptions(24);

export default function SettingsPage() {
  const { settings, loading: settingsLoading, updateSettings } = useSettings();
  const { data: users, loading: usersLoading, update: updateUser, remove: removeUser } = useUsers();
  const { data: deliveries, remove: removeDelivery } = useMilkDelivered();
  const { data: milkReceived, remove: removeMilkReceived } = useMilkReceived();
  const { data: invoices, remove: removeInvoice } = useInvoices();
  const { data: members } = useMembers();
  const { toast } = useToast();

  // ── Data management state ──
  const [recordType, setRecordType] = useState<'deliveries' | 'invoices' | 'received'>('deliveries');
  const [recordMonth, setRecordMonth] = useState(monthKey(new Date().toISOString().slice(0, 10)));

  // ── Confirm dialog state ──
  type PendingDelete =
    | { type: 'delivery'; id: string; label: string }
    | { type: 'received'; id: string; label: string }
    | { type: 'invoice'; id: string; label: string }
    | { type: 'user'; id: string; label: string };
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const memberName = (id: string) => members.find((m) => m.id === id)?.fullName || 'غير معروف';

  const filteredDeliveries = deliveries
    .filter((d) => monthKey(d.date) === recordMonth)
    .sort((a, b) => b.date.localeCompare(a.date));

  const filteredReceived = milkReceived
    .filter((r) => monthKey(r.date) === recordMonth)
    .sort((a, b) => b.date.localeCompare(a.date));

  const filteredInvoices = invoices
    .filter((inv) => inv.month === recordMonth)
    .sort((a, b) => memberName(a.memberId).localeCompare(memberName(b.memberId), 'ar'));

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.type === 'delivery') {
        await removeDelivery(pendingDelete.id);
        toast({ title: 'تم الحذف', description: 'تم حذف التسليم بنجاح.' });
      } else if (pendingDelete.type === 'received') {
        await removeMilkReceived(pendingDelete.id);
        toast({ title: 'تم الحذف', description: 'تم حذف سجل الحليب المستلم بنجاح.' });
      } else if (pendingDelete.type === 'invoice') {
        await removeInvoice(pendingDelete.id);
        toast({ title: 'تم الحذف', description: 'تم حذف الفاتورة بنجاح.' });
      } else if (pendingDelete.type === 'user') {
        await removeUser(pendingDelete.id);
        toast({ title: 'تم الحذف', description: 'تم حذف المستخدم بنجاح.' });
      }
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'خطأ', description: (err as Error).message });
    } finally {
      setPendingDelete(null);
    }
  };

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings Form State
  const [coopName, setCoopName] = useState('');
  const [currency, setCurrency] = useState('MAD');
  const [phone, setPhone] = useState('');
  const [milkPurchasePrice, setMilkPurchasePrice] = useState('4.2');
  const [milkSellPrice, setMilkSellPrice] = useState('4.5');

  useEffect(() => {
    if (!settingsLoading && settings) {
      setCoopName(settings.coopName || '');
      setCurrency(settings.currency || 'MAD');
      setPhone(settings.phone || '');
      setMilkPurchasePrice(String(settings.milkPurchasePrice ?? 4.2));
      setMilkSellPrice(String(settings.milkSellPrice ?? 4.5));
    }
  }, [settingsLoading, settings]);

  // User Form State
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'collector' as Role,
  });

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await updateSettings({
        coopName,
        currency,
        phone,
        milkPurchasePrice: Number(milkPurchasePrice) || 4.2,
        milkSellPrice: Number(milkSellPrice) || 4.5,
      });
      toast({ title: 'تم الحفظ', description: 'تم حفظ الإعدادات بنجاح.' });
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'خطأ', description: (err as Error).message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      if (settings?.logoUrl) {
        try {
          await deleteObject(ref(storage, settings.logoUrl));
        } catch {}
      }
      const storageRef = ref(storage, `logos/coop-logo-${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateSettings({ logoUrl: url });
      toast({ title: 'تم', description: 'تم تحديث شعار التعاونية.' });
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل رفع الشعار.' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteUser = (userId: string) => {
    const user = users?.find((u) => u.id === userId);
    setPendingDelete({
      type: 'user',
      id: userId,
      label: user?.displayName || user?.email || 'المستخدم',
    });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingUser(true);
    try {
      await adminCreateUser(userForm.email, userForm.password, userForm.displayName, userForm.role);
      toast({ title: 'تم', description: 'تم إنشاء المستخدم بنجاح.' });
      setIsUserDialogOpen(false);
      setUserForm({ email: '', password: '', displayName: '', role: 'collector' });
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'خطأ', description: (err as Error).message });
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: Role) => {
    try {
      await updateUser(userId, { role: newRole });
      toast({ title: 'تم التحديث', description: 'تم تحديث صلاحية المستخدم.' });
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'خطأ', description: (err as Error).message });
    }
  };

  if (settingsLoading)
    return (
      <Layout>
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );

  const currencyLabel = currency === 'MAD' ? 'درهم' : currency;

  return (
    <Layout>
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          الإعدادات <Settings className="h-6 w-6 text-muted-foreground" />
        </h2>
        <p className="text-muted-foreground mt-1">إدارة معلومات التعاونية وحسابات المستخدمين</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="general" className="gap-1.5">
            <Settings className="h-4 w-4" /> عام
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="h-4 w-4" /> المستخدمون
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-1.5">
            <Database className="h-4 w-4" /> السجلات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-2 focus-visible:outline-none">
      <div className="grid lg:grid-cols-2 gap-6">
        {/* ── General Settings ── */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>المعلومات العامة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="flex-shrink-0">
                  {settings?.logoUrl ? (
                    <img
                      src={settings.logoUrl}
                      alt="Logo"
                      className="h-24 w-24 object-contain rounded-lg border bg-muted/20"
                    />
                  ) : (
                    <div className="h-24 w-24 rounded-lg border bg-muted/20 flex items-center justify-center">
                      <Shield className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="gap-2"
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    تغيير الشعار
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="coopName">اسم التعاونية</Label>
                  <Input
                    id="coopName"
                    value={coopName}
                    onChange={(e) => setCoopName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="currency">العملة</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger dir="ltr">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MAD">MAD (درهم)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">رقم الهاتف (الواتساب)</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      dir="ltr"
                      className="text-right"
                    />
                  </div>
                </div>
                <Button onClick={handleSaveSettings} disabled={isSaving} className="w-full gap-2">
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  حفظ التغييرات
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Milk Prices ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                أسعار الحليب
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purchasePrice">ثمن الشراء ({currencyLabel}/لتر)</Label>
                  <Input
                    id="purchasePrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={milkPurchasePrice}
                    onChange={(e) => setMilkPurchasePrice(e.target.value)}
                    dir="ltr"
                    className="text-right font-mono"
                    placeholder="4.20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sellPrice">ثمن البيع للشركة ({currencyLabel}/لتر)</Label>
                  <Input
                    id="sellPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={milkSellPrice}
                    onChange={(e) => setMilkSellPrice(e.target.value)}
                    dir="ltr"
                    className="text-right font-mono"
                    placeholder="4.50"
                  />
                </div>
              </div>
              <Button onClick={handleSaveSettings} disabled={isSaving} className="w-full gap-2">
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                حفظ الأسعار
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
        </TabsContent>

        <TabsContent value="users" className="mt-2 focus-visible:outline-none">
        {/* ── User Management ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                المستخدمين <Users className="h-5 w-5" />
              </CardTitle>
              <CardDescription>إدارة حسابات وصلاحيات الولوج</CardDescription>
            </div>
            <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> مستخدم جديد
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>إنشاء حساب مستخدم</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>الاسم الكامل</Label>
                    <Input
                      required
                      value={userForm.displayName}
                      onChange={(e) => setUserForm({ ...userForm, displayName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>البريد الإلكتروني</Label>
                    <Input
                      required
                      type="email"
                      dir="ltr"
                      className="text-right"
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>كلمة المرور</Label>
                    <Input
                      required
                      type="password"
                      dir="ltr"
                      className="text-right"
                      minLength={6}
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الصلاحية</Label>
                    <Select
                      value={userForm.role}
                      onValueChange={(v: Role) => setUserForm({ ...userForm, role: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="collector">جامع حليب (مكلف بالاستلام)</SelectItem>
                        <SelectItem value="accountant">محاسب (مكلف بالميزانية)</SelectItem>
                        <SelectItem value="admin">مدير (صلاحيات كاملة)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={isCreatingUser}>
                    {isCreatingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : 'إنشاء الحساب'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المستخدم</TableHead>
                    <TableHead>البريد</TableHead>
                    <TableHead>الصلاحية</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                        جاري التحميل...
                      </TableCell>
                    </TableRow>
                  ) : users?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                        لا يوجد مستخدمين
                      </TableCell>
                    </TableRow>
                  ) : (
                    users?.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.displayName || 'بدون اسم'}
                        </TableCell>
                        <TableCell className="text-xs font-mono" dir="ltr">
                          {user.email}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(val: Role) => handleRoleChange(user.id, val)}
                          >
                            <SelectTrigger className="h-8 text-xs border-0 bg-muted/20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">
                                <Badge
                                  variant="outline"
                                  className="bg-primary/10 text-primary border-primary/20 mr-2"
                                >
                                  مدير
                                </Badge>
                              </SelectItem>
                              <SelectItem value="accountant">
                                <Badge
                                  variant="outline"
                                  className="bg-amber-500/10 text-amber-600 border-amber-500/20 mr-2"
                                >
                                  محاسب
                                </Badge>
                              </SelectItem>
                              <SelectItem value="collector">
                                <Badge
                                  variant="outline"
                                  className="bg-blue-500/10 text-blue-600 border-blue-500/20 mr-2"
                                >
                                  جامع حليب
                                </Badge>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteUser(user.id)}
                            title="حذف المستخدم"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="data" className="mt-2 focus-visible:outline-none">
      {/* ── Data Management (delete records) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            إدارة السجلات <Database className="h-5 w-5" />
          </CardTitle>
          <CardDescription>
            حذف تسليمات الشركات أو الحليب المستلم أو الفواتير الشهرية — استخدم بحذر، لا يمكن التراجع عن الحذف
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1.5 w-48">
              <Label className="text-xs text-muted-foreground">نوع السجل</Label>
              <Select value={recordType} onValueChange={(v: 'deliveries' | 'invoices' | 'received') => setRecordType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deliveries">تسليمات الشركات</SelectItem>
                  <SelectItem value="received">الحليب المستلم</SelectItem>
                  <SelectItem value="invoices">الفواتير الشهرية</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 w-48">
              <Label className="text-xs text-muted-foreground">الشهر</Label>
              <Select value={recordMonth} onValueChange={setRecordMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECORD_MONTH_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            {recordType === 'deliveries' ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الشركة</TableHead>
                    <TableHead>الكمية (لتر)</TableHead>
                    <TableHead>الثمن/لتر</TableHead>
                    <TableHead>الإجمالي</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeliveries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                        لا توجد تسليمات لهذا الشهر
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDeliveries.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono text-xs">{d.date}</TableCell>
                        <TableCell className="font-medium">{d.companyName}</TableCell>
                        <TableCell className="font-mono">{d.quantityLiters}</TableCell>
                        <TableCell className="font-mono">{d.pricePerLiter.toFixed(2)}</TableCell>
                        <TableCell className="font-mono font-semibold">
                          {(d.quantityLiters * d.pricePerLiter).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => setPendingDelete({ type: 'delivery', id: d.id, label: d.companyName })}
                            title="حذف التسليم"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            ) : recordType === 'received' ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>المنخرط</TableHead>
                    <TableHead>الكمية (لتر)</TableHead>
                    <TableHead>السعر/لتر</TableHead>
                    <TableHead>الدهن %</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceived.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                        لا توجد سجلات حليب مستلم لهذا الشهر
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredReceived.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.date}</TableCell>
                        <TableCell className="font-medium">{memberName(r.memberId)}</TableCell>
                        <TableCell className="font-mono">{r.quantityLiters}</TableCell>
                        <TableCell className="font-mono">{r.pricePerLiter != null ? r.pricePerLiter.toFixed(2) : '—'}</TableCell>
                        <TableCell className="font-mono">{r.fat != null ? r.fat : '—'}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => setPendingDelete({ type: 'received', id: r.id, label: `${memberName(r.memberId)} — ${r.date}` })}
                            title="حذف سجل الحليب المستلم"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المنخرط</TableHead>
                    <TableHead>الشهر</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                        لا توجد فواتير لهذا الشهر
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInvoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{memberName(inv.memberId)}</TableCell>
                        <TableCell className="font-mono text-xs">{monthLabelAr(inv.month)}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              inv.paid
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                            }
                          >
                            {inv.paid ? 'مدفوع' : 'غير مدفوع'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => setPendingDelete({ type: 'invoice', id: inv.id, label: memberName(inv.memberId) })}
                            title="حذف الفاتورة"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>

      {/* ── Confirm Delete Dialog ── */}
      <ConfirmDialog
        open={!!pendingDelete}
        title={
          pendingDelete?.type === 'delivery'
            ? 'حذف التسليم'
            : pendingDelete?.type === 'invoice'
              ? 'حذف الفاتورة'
              : pendingDelete?.type === 'received'
                ? 'حذف الحليب المستلم'
                : 'حذف المستخدم'
        }
        description={
          pendingDelete?.type === 'delivery'
            ? `هل أنت متأكد من حذف تسليم "${pendingDelete.label}"؟ لا يمكن التراجع عن هذا الإجراء.`
            : pendingDelete?.type === 'invoice'
              ? `هل أنت متأكد من حذف فاتورة "${pendingDelete?.label}"؟ سيتم فقدان حالة الدفع لهذا الشهر.`
              : pendingDelete?.type === 'received'
                ? `هل أنت متأكد من حذف حليب مستلم "${pendingDelete?.label}"؟ لا يمكن التراجع عن هذا الإجراء.`
                : `هل أنت متأكد من حذف المستخدم "${pendingDelete?.label}"؟`
        }
        confirmLabel="حذف"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </Layout>
  );
}
