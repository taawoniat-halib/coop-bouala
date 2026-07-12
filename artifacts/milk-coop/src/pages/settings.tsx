import { Layout } from '@/components/Layout';
import { useSettings } from '@/hooks/useSettings';
import { useUsers } from '@/hooks/useData';
import { adminCreateUser } from '@/lib/adminCreateUser';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useState, useRef } from 'react';
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Settings, Users, Shield, Plus, Upload, Loader2, Save, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { Role } from '@/lib/types';

export default function SettingsPage() {
  const { settings, loading: settingsLoading, updateSettings } = useSettings();
  const { data: users, loading: usersLoading, update: updateUser, remove: removeUser } = useUsers();
  const { toast } = useToast();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Settings Form State
  const [coopName, setCoopName] = useState('');
  const [currency, setCurrency] = useState('');
  const [phone, setPhone] = useState('');
  
  // Initialize form when settings load
  useState(() => {
    if (!settingsLoading && settings) {
      setCoopName(settings.coopName || '');
      setCurrency(settings.currency || 'MAD');
      setPhone(settings.phone || '');
    }
  });

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
      await updateSettings({ coopName, currency, phone });
      toast({ title: 'تم الحفظ', description: 'تم حفظ الإعدادات بنجاح.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `logos/coop-logo-${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateSettings({ logoUrl: url });
      toast({ title: 'تم', description: 'تم تحديث شعار التعاونية.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل رفع الشعار.' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;
    try {
      await removeUser(userId);
      toast({ title: 'تم الحذف', description: 'تم حذف المستخدم بنجاح.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: err.message });
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingUser(true);
    try {
      await adminCreateUser(userForm.email, userForm.password, userForm.displayName, userForm.role);
      toast({ title: 'تم', description: 'تم إنشاء المستخدم بنجاح.' });
      setIsUserDialogOpen(false);
      setUserForm({ email: '', password: '', displayName: '', role: 'collector' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: err.message });
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: Role) => {
    try {
      await updateUser(userId, { role: newRole });
      toast({ title: 'تم التحديث', description: 'تم تحديث صلاحية المستخدم.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: err.message });
    }
  };

  if (settingsLoading) return <Layout><div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></Layout>;

  return (
    <Layout>
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          الإعدادات <Settings className="h-6 w-6 text-muted-foreground" />
        </h2>
        <p className="text-muted-foreground mt-1">إدارة معلومات التعاونية وحسابات المستخدمين</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle>المعلومات العامة</CardTitle>
            <CardDescription>معلومات التعاونية التي تظهر في التقارير</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0">
                {settings?.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="h-24 w-24 object-contain rounded-lg border bg-muted/20" />
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
                  accept="image/*"
            className="hidden" 
                  accept="image/png, image/jpeg, image/webp" 
                  onChange={handleLogoUpload}
                />
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="gap-2"
                >
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  تغيير الشعار
                </Button>
                <p className="text-xs text-muted-foreground mt-2">يفضل استخدام صورة مربعة (PNG أو JPG)</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="coopName">اسم التعاونية</Label>
                <Input 
                  id="coopName" 
                  defaultValue={settings?.coopName || ''} 
                  onChange={(e) => setCoopName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">العملة</Label>
                  <Select defaultValue={settings?.currency || 'MAD'} onValueChange={setCurrency}>
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
                    defaultValue={settings?.phone || ''} 
                    onChange={(e) => setPhone(e.target.value)}
                    dir="ltr"
                    className="text-right"
                  />
                </div>
              </div>
              <Button onClick={handleSaveSettings} disabled={isSaving} className="w-full gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ التغييرات
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* User Management */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">المستخدمين <Users className="h-5 w-5" /></CardTitle>
              <CardDescription>إدارة حسابات وصلاحيات الولوج</CardDescription>
            </div>
            <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> مستخدم جديد
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>إنشاء حساب مستخدم</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>الاسم الكامل</Label>
                    <Input required value={userForm.displayName} onChange={e => setUserForm({ ...userForm, displayName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>البريد الإلكتروني</Label>
                    <Input required type="email" dir="ltr" className="text-right" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>كلمة المرور</Label>
                    <Input required type="password" dir="ltr" className="text-right" minLength={6} value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>الصلاحية</Label>
                    <Select value={userForm.role} onValueChange={(v: Role) => setUserForm({ ...userForm, role: v })}>
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
                    <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                  ) : users?.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">لا يوجد مستخدمين</TableCell></TableRow>
                  ) : (
                    users?.map(user => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.displayName || 'بدون اسم'}</TableCell>
                        <TableCell className="text-xs font-mono" dir="ltr">{user.email}</TableCell>
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
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 mr-2">مدير</Badge>
                              </SelectItem>
                              <SelectItem value="accountant">
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 mr-2">محاسب</Badge>
                              </SelectItem>
                              <SelectItem value="collector">
                                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 mr-2">جامع حليب</Badge>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
