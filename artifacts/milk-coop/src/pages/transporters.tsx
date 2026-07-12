import { Layout } from '@/components/Layout';
import { useTransporters } from '@/hooks/useData';
import { useSettings } from '@/hooks/useSettings';
import { useState, useMemo } from 'react';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit2, Trash2, CheckCircle2, XCircle, Truck } from 'lucide-react';
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
import type { Transporter } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export default function Transporters() {
  const { data: transporters, loading, add, update, remove } = useTransporters();
  const { settings } = useSettings();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();
  const currency = settings?.currency === 'MAD' ? 'درهم' : settings?.currency;

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    vehicle: '',
    costPerLiter: '',
    active: true,
  });

  const filteredTransporters = useMemo(() => {
    if (!search) return transporters;
    const lower = search.toLowerCase();
    return transporters.filter(
      (t) => t.fullName.toLowerCase().includes(lower) || 
             (t.vehicle && t.vehicle.toLowerCase().includes(lower))
    );
  }, [transporters, search]);

  const handleOpenDialog = (transporter?: Transporter) => {
    if (transporter) {
      setEditingId(transporter.id);
      setFormData({
        fullName: transporter.fullName,
        phone: transporter.phone || '',
        vehicle: transporter.vehicle || '',
        costPerLiter: String(transporter.costPerLiter),
        active: transporter.active,
      });
    } else {
      setEditingId(null);
      setFormData({
        fullName: '',
        phone: '',
        vehicle: '',
        costPerLiter: '',
        active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      fullName: formData.fullName,
      phone: formData.phone,
      vehicle: formData.vehicle,
      costPerLiter: Number(formData.costPerLiter) || 0,
      active: formData.active,
    };

    try {
      if (editingId) {
        await update(editingId, payload);
        toast({ title: 'تم التحديث', description: 'تم تحديث بيانات الناقل بنجاح.' });
      } else {
        await add(payload);
        toast({ title: 'تمت الإضافة', description: 'تمت إضافة الناقل بنجاح.' });
      }
      setIsDialogOpen(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: err.message });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الناقل؟')) {
      try {
        await remove(id);
        toast({ title: 'تم الحذف', description: 'تم حذف الناقل بنجاح.' });
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'خطأ', description: err.message });
      }
    }
  };

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            الناقلون <Truck className="h-6 w-6 text-muted-foreground" />
          </h2>
          <p className="text-muted-foreground mt-1">إدارة ناقلي الحليب وتكلفة النقل ({transporters.length})</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              إضافة ناقل
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'تعديل ناقل' : 'إضافة ناقل جديد'}</DialogTitle>
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
                  <Label htmlFor="phone">رقم الهاتف</Label>
                  <Input 
                    id="phone" 
                    value={formData.phone} 
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    dir="ltr"
                    className="text-right"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicle">نوع / رقم العربة</Label>
                  <Input 
                    id="vehicle" 
                    value={formData.vehicle} 
                    onChange={(e) => setFormData({ ...formData, vehicle: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="costPerLiter">تكلفة النقل للتر الواحد ({currency}) *</Label>
                <Input 
                  id="costPerLiter" 
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.costPerLiter} 
                  onChange={(e) => setFormData({ ...formData, costPerLiter: e.target.value })}
                  required
                  dir="ltr"
                  className="text-right font-mono"
                />
              </div>
              <div className="flex items-center space-x-2 space-x-reverse pt-2">
                <Switch 
                  id="active" 
                  checked={formData.active} 
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <Label htmlFor="active">حالة الناقل (نشط)</Label>
              </div>

              <DialogFooter className="pt-4">
                <Button type="submit" className="w-full">حفظ</Button>
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
              placeholder="البحث بالاسم أو العربة..." 
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
                <TableHead>العربة</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>تكلفة النقل / لتر</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-left">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    جاري التحميل...
                  </TableCell>
                </TableRow>
              ) : filteredTransporters.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    لا يوجد ناقلون.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransporters.map((transporter) => (
                  <TableRow key={transporter.id} className="group">
                    <TableCell className="font-medium">{transporter.fullName}</TableCell>
                    <TableCell>{transporter.vehicle || '-'}</TableCell>
                    <TableCell className="font-mono text-sm" dir="ltr">{transporter.phone || '-'}</TableCell>
                    <TableCell className="font-mono">
                      {transporter.costPerLiter.toFixed(2)} {currency}
                    </TableCell>
                    <TableCell>
                      {transporter.active ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1 pr-1">
                          <CheckCircle2 className="h-3 w-3" /> نشط
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1 pr-1">
                          <XCircle className="h-3 w-3" /> غير نشط
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-left">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(transporter)} className="h-8 w-8">
                          <Edit2 className="h-4 w-4 text-muted-foreground hover:text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(transporter.id)} className="h-8 w-8 hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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
