import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, KeyRound } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import logo from '@/assets/logo.png';

function mapFirebaseError(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    case 'auth/too-many-requests':
      return 'تم تجاوز عدد المحاولات المسموح بها. يرجى المحاولة مجدداً بعد قليل.';
    case 'auth/network-request-failed':
      return 'تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.';
    case 'auth/user-disabled':
      return 'تم تعطيل هذا الحساب. يرجى التواصل مع المسؤول.';
    default:
      return 'حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.';
  }
}

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot password dialog state
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const { signIn, appUser } = useAuth();
  const [, setLocation] = useLocation();

  // FIX: use useEffect for redirect instead of calling setLocation during render
  useEffect(() => {
    if (appUser) {
      setLocation(appUser.role === 'admin' ? '/' : '/milk');
    }
  }, [appUser, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      setError(mapFirebaseError(code));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetMessage(null);
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMessage('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-email') {
        setResetError('لم يتم العثور على حساب بهذا البريد الإلكتروني.');
      } else {
        setResetError('حدث خطأ. يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  if (appUser) return null;

  return (
    <div
      className="flex min-h-[100dvh] w-full items-center justify-center bg-background p-4 font-sans"
      dir="rtl"
    >
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary/10">
            <img src={logo} alt="شعار التعاونية" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">تعاونية كوب بوعلا</h1>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="mr-2 text-sm font-medium">{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="text-left"
              dir="ltr"
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">كلمة المرور</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="text-left"
              dir="ltr"
              disabled={isSubmitting}
            />
          </div>
          <div className="text-left">
            <button
              type="button"
              onClick={() => {
                setResetEmail(email);
                setResetMessage(null);
                setResetError(null);
                setResetDialogOpen(true);
              }}
              className="text-xs text-primary hover:underline"
            >
              نسيت كلمة المرور؟
            </button>
          </div>
          <Button type="submit" className="w-full mt-4" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'تسجيل الدخول'}
          </Button>
        </form>
      </div>

      {/* ── Forgot Password Dialog ── */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              إعادة تعيين كلمة المرور
            </DialogTitle>
            <DialogDescription>
              أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة تعيين كلمة المرور.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordReset} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reset-email">البريد الإلكتروني</Label>
              <Input
                id="reset-email"
                type="email"
                dir="ltr"
                className="text-left"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                disabled={resetLoading}
                placeholder="name@example.com"
              />
            </div>
            {resetError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="mr-2 text-sm">{resetError}</AlertDescription>
              </Alert>
            )}
            {resetMessage && (
              <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700">
                <AlertDescription className="text-sm">{resetMessage}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button type="submit" className="w-full" disabled={resetLoading}>
                {resetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'إرسال الرابط'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
