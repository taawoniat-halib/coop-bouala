import { Layout } from '@/components/Layout';
import { useMembers, useTransporters } from '@/hooks/useData';
import { useAuth } from '@/hooks/useAuth';
import { useState, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit2, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Member } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { adminCreateUser } from '@/lib/adminCreateUser';

export default function Members() {
  const { data: members, loading, add, update, remove } = useMembers();
  const { data: transporters } = useTransporters();
  const { appUser } = useAuth();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();
  const isAdmin = appUser?.role === 'admin';

  const [formData, setFormData] = useState({
    fullName: '',
    cin: '',
    phone: '',
    address: '',
    active: true,
    transporterId: '',
    debt: '',
    createAccount: false,
    email: '',
    password: '',
  });

  const filteredMembers = useMemo(() => {
    if (!search) return members;
    const lower = search.toLowerCase();
    return members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(lower) || (m.cin && m.cin.toLowerCase().includes(lower)),
    );
  }, [members, search]);

  const transporterById = useMemo(
    () => new Map(transporters.map((t) => [t.id, t])),
    [transporters],
  );

  const activeTransporters = useMemo(() => transporters.filter((t) => t.active), [transporters]);

  const handleOpenDialog = (member?: Member) => {
    if (member) {
      setEditingId(member.id);
      setFormData({
        fullName: member.fullName,
        cin: member.cin || '',
        phone: member.phone || '',
        address: member.address || '',
        active: member.active,
        transporterId: member.transporterId || '',
        debt: member.debt != null ? String(member.debt) : '',
        createAccount: false,
        email: '',
        password: '',
      });
    } else {
      setEditingId(null);
      setFormData({
        fullName: '',
        cin: '',
        phone: '',
        address: '',
        active: true,
        transporterId: '',
        debt: '',
        createAccount: false,
        email: '',
        password: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedCin = formData.cin.trim();
    if (trimmedCin) {
      const duplicate = members.find(
        (m) => m.id !== editingId && (m.cin || '').trim() === trimmedCin,
      );
      if (duplicate) {
        toast({
          variant: 'destructive',
          title: 'رقم بطاقة مكرر',
          description: `رقم البطاقة الوطنية هذا مسجّل بالفعل لدى "${duplicate.fullName}".`,
        });
        return;
      }
    }

    const payload: Omit<Member, 'id' | 'createdAt'> = {
      fullName: formData.fullName,
      cin: formData.cin,
      phone: formData.phone,
      address: formData.address,
      active: formData.active,
      ...(formData.transporterId ? { transporterId: formData.transporterId } : {}),
      debt: formData.debt !== '' ? Number(formData.debt) : 0,
    };
    try {
      if (editingId) {
        await update(editingId, payload);
        toast({ title: 'تم التحديث', description: 'تم تحديث بيانات المنخرط بنجاح.' });
      } else {
        const docRef = await add(payload);
        if (formData.createAccount) {
          await adminCreateUser(formData.email, formData.password, formData.fullName, 'collector', {
            memberId: docRef.id,
          });
        }
        toast({ title: 'تمت الإضافة', description: 'تمت إضافة المنخرط بنجاح.' });
      }
      setIsDialogOpen(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: err.message });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا المنخرط؟')) {
      try {
        await remove(id);
        toast({ title: 'تم الحذف', description: 'تم حذف المنخرط بنجاح.' });
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'خطأ', description: err.message });
      }
    }
  };

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">المنخرطون</h2>
          <p className="text-muted-foreground mt-1">
            إدارة المنخرطين وأعضاء التعاونية ({members.length})
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="gap-2 text-base px-5 py-2.5">
              <Plus className="h-5 w-5" />
              إضافة منخرط جديد
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'تعديل بيانات المنخرط' : 'إضافة منخرط جديد'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">الاسم الكامل *</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cin">رقم البطاقة الوطنية</Label>
                  <Input
                    id="cin"
                    value={formData.cin}
                    dir="ltr"
                    className="text-right"
                    onChange={(e) => setFormData({ ...formData, cin: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">رقم الهاتف</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    dir="ltr"
                    className="text-right"
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">العنوان</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="debt">الديون المستحقة (درهم)</Label>
                <Input
                  id="debt"
                  type="number"
                  min="0"
                  step="0.01"
                  dir="ltr"
                  placeholder="0.00"
                  value={formData.debt}
                  onChange={(e) => setFormData({ ...formData, debt: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  تُخصم تلقائياً من الصافي الشهري في التقارير
                </p>
              </div>

              {/* ── Transporter selection ── */}
              <div className="space-y-2">
                <Label htmlFor="transporter">الناقل</Label>
                <Select
                  value={formData.transporterId || '__none__'}
                  onValueChange={(val) =>
                    setFormData({ ...formData, transporterId: val === '__none__' ? '' : val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الناقل..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— بدون ناقل —</SelectItem>
                    {activeTransporters.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.fullName}
                        {t.costPerLiter > 0 && (
                          <span className="text-muted-foreground text-xs mr-2">
                            ({t.costPerLiter.toFixed(2)} د/ل)
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <Label htmlFor="active">منخرط</Label>
              </div>

              {!editingId && isAdmin && (
                <div className="space-y-4 border-t border-border pt-4 mt-2">
                  <div className="flex items-center gap-3">
                    <Switch
                      id="createAccount"
                      checked={formData.createAccount}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, createAccount: checked })
                      }
                    />
                    <Label htmlFor="createAccount">إنشاء حساب دخول للمنخرط</Label>
                  </div>
                  {formData.createAccount && (
                    <>
                      <div className="space-y-2">
                        <Label>البريد الإلكتروني</Label>
                        <Input
                          type="email"
                          value={formData.email}
                          dir="ltr"
                          className="text-right"
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required={formData.createAccount}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>كلمة المرور</Label>
                        <Input
                          type="password"
                          minLength={6}
                          value={formData.password}
                          dir="ltr"
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          required={formData.createAccount}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              <DialogFooter className="pt-4">
                <Button type="submit" className="w-full">
                  حفظ
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20">
          <div className="relative max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="البحث بالاسم أو رقم البطاقة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>الاسم الكامل</TableHead>
                <TableHead>رقم البطاقة</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>الناقل</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    جاري التحميل...
                  </TableCell>
                </TableRow>
              ) : filteredMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    لا يوجد منخرطون. اضغط "إضافة منخرط جديد" للبدء.
                  </TableCell>
                </TableRow>
              ) : (
                filteredMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.fullName}</TableCell>
                    <TableCell className="font-mono text-sm" dir="ltr">
                      {member.cin || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-sm" dir="ltr">
                      {member.phone || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {member.transporterId
                        ? transporterById.get(member.transporterId)?.fullName || '—'
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {member.active ? (
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1"
                        >
                          <CheckCircle2 className="h-3 w-3" /> منخرط
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-destructive/10 text-destructive border-destructive/20 gap-1"
                        >
                          <XCircle className="h-3 w-3" /> غير منخرط
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(member)}
                          className="h-8 w-8"
                          title="تعديل"
                        >
                          <Edit2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(member.id)}
                            className="h-8 w-8 hover:bg-destructive/10"
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </Layout>
  );
}
