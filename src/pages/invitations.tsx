import { Layout } from '@/components/Layout';
import { useMembers } from '@/hooks/useData';
import { useSettings } from '@/hooks/useSettings';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MessageCircle, Search, Users, Send, CheckSquare, Square } from 'lucide-react';
import { shareOnWhatsApp } from '@/lib/exportUtils';
import { useToast } from '@/hooks/use-toast';

export default function InvitationsPage() {
  const { data: members, loading } = useMembers();
  const { settings } = useSettings();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [messageTemplate, setMessageTemplate] = useState(
    `مرحباً {اسم_المنخرط}،\nتدعوكم ${settings?.coopName || 'تعاونية كوب بوعلا'} للتواصل معنا.\nشكراً لتعاونكم.`,
  );

  const activeMembers = useMemo(() => members.filter((m) => m.active), [members]);

  const filteredMembers = useMemo(() => {
    if (!search) return activeMembers;
    const lower = search.toLowerCase();
    return activeMembers.filter((m) => m.fullName.toLowerCase().includes(lower));
  }, [activeMembers, search]);

  const membersWithPhone = useMemo(() => filteredMembers.filter((m) => m.phone), [filteredMembers]);

  const allSelectedOnPage =
    filteredMembers.length > 0 && filteredMembers.every((m) => selectedIds.has(m.id));

  const toggleAll = () => {
    if (allSelectedOnPage) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredMembers.forEach((m) => next.delete(m.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredMembers.forEach((m) => next.add(m.id));
        return next;
      });
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedMembers = useMemo(
    () => members.filter((m) => selectedIds.has(m.id)),
    [members, selectedIds],
  );

  const handleSendAll = () => {
    const withPhone = selectedMembers.filter((m) => m.phone);
    if (withPhone.length === 0) {
      toast({
        variant: 'destructive',
        title: 'لا يوجد أرقام هاتف',
        description: 'لا يوجد أرقام واتساب للمنخرطين المحددين.',
      });
      return;
    }
    let sent = 0;
    for (const member of withPhone) {
      const msg = messageTemplate.replace('{اسم_المنخرط}', member.fullName);
      shareOnWhatsApp(msg, member.phone);
      sent++;
    }
    toast({ title: 'تم الإرسال', description: `تم فتح واتساب لـ ${sent} منخرط.` });
  };

  const handleSendOne = (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    if (!member?.phone) {
      toast({
        variant: 'destructive',
        title: 'لا يوجد هاتف',
        description: 'هذا المنخرط ليس لديه رقم هاتف.',
      });
      return;
    }
    const msg = messageTemplate.replace('{اسم_المنخرط}', member.fullName);
    shareOnWhatsApp(msg, member.phone);
  };

  return (
    <Layout>
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          الدعوات <MessageCircle className="h-6 w-6 text-muted-foreground" />
        </h2>
        <p className="text-muted-foreground mt-1">إرسال رسائل واتساب للمنخرطين</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── Member selection ── */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    المنخرطون ({activeMembers.length})
                  </CardTitle>
                  <CardDescription>
                    {selectedIds.size > 0
                      ? `${selectedIds.size} منخرط محدد`
                      : 'اختر منخرطاً أو أكثر لإرسال الرسالة إليهم'}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={toggleAll}>
                  {allSelectedOnPage ? (
                    <>
                      <Square className="h-4 w-4" /> إلغاء التحديد
                    </>
                  ) : (
                    <>
                      <CheckSquare className="h-4 w-4" /> تحديد الكل
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="البحث بالاسم..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-9"
                />
              </div>

              <div className="max-h-[420px] overflow-y-auto space-y-1 rounded-lg border border-border p-2">
                {loading ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">جاري التحميل...</p>
                ) : filteredMembers.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">لا يوجد منخرطون</p>
                ) : (
                  filteredMembers.map((member) => (
                    <div
                      key={member.id}
                      className={`flex items-center gap-3 rounded-md px-3 py-2.5 cursor-pointer transition-colors ${
                        selectedIds.has(member.id) ? 'bg-primary/10' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => toggleOne(member.id)}
                    >
                      <Checkbox
                        checked={selectedIds.has(member.id)}
                        onCheckedChange={() => toggleOne(member.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{member.fullName}</p>
                        {member.phone ? (
                          <p className="text-xs text-muted-foreground font-mono" dir="ltr">
                            {member.phone}
                          </p>
                        ) : (
                          <p className="text-xs text-destructive/60">لا يوجد رقم هاتف</p>
                        )}
                      </div>
                      {member.phone && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          title="إرسال إليه وحده"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendOne(member.id);
                          }}
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {filteredMembers.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {membersWithPhone.length} من أصل {filteredMembers.length} لديهم رقم هاتف
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Message & send ── */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>الرسالة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>نص الرسالة</Label>
                <Textarea
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  rows={7}
                  className="resize-none text-sm"
                  placeholder="اكتب رسالتك هنا..."
                />
              </div>

              {selectedIds.size > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">المحددون:</p>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {selectedMembers.map((m) => (
                      <Badge
                        key={m.id}
                        variant="secondary"
                        className="text-xs cursor-pointer"
                        onClick={() => toggleOne(m.id)}
                      >
                        {m.fullName} ×
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Button
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={selectedIds.size === 0}
                onClick={handleSendAll}
              >
                <MessageCircle className="h-4 w-4" />
                إرسال عبر واتساب
                {selectedIds.size > 0 && (
                  <Badge
                    variant="secondary"
                    className="mr-1 text-xs bg-white/20 text-white border-0"
                  >
                    {selectedIds.size}
                  </Badge>
                )}
              </Button>

            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
