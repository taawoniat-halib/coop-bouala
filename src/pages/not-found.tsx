import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div
      className="flex min-h-[100dvh] w-full items-center justify-center bg-background p-4 font-sans"
      dir="rtl"
    >
      <div className="flex flex-col items-center gap-6 text-center max-w-sm">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>
        <div>
          <h1 className="text-6xl font-extrabold text-muted-foreground/40 mb-2">404</h1>
          <h2 className="text-xl font-bold text-foreground mb-2">الصفحة غير موجودة</h2>
          <p className="text-sm text-muted-foreground">
            الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/">
            <Home className="h-4 w-4" />
            العودة إلى الرئيسية
          </Link>
        </Button>
      </div>
    </div>
  );
}
