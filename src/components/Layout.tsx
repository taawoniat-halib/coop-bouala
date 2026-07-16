import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import {
  LayoutDashboard,
  Users,
  Droplets,
  Calculator,
  FileText,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  Truck,
  ChevronRight,
  MessageCircle,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { Role } from '@/lib/types';
import defaultLogo from '@/assets/logo.png';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { ThemeToggle } from '@/components/ThemeToggle';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: Role[];
}

const navItems: NavItem[] = [
  { href: '/', label: 'لوحة القيادة', icon: LayoutDashboard, roles: ['admin', 'accountant'] },
  { href: '/members', label: 'المنخرطون', icon: Users, roles: ['admin', 'collector'] },
  { href: '/milk', label: 'الحليب', icon: Droplets, roles: ['admin', 'collector', 'accountant'] },
  { href: '/transporters', label: 'الناقلون', icon: Truck, roles: ['admin'] },
  { href: '/budget', label: 'الميزانية', icon: Calculator, roles: ['admin', 'accountant'] },
  { href: '/reports', label: 'التقرير السنوي', icon: FileText, roles: ['admin', 'accountant'] },
  { href: '/monthly-report', label: 'التقرير الشهري', icon: BarChart3, roles: ['admin', 'accountant'] },
  { href: '/invitations', label: 'الدعوات', icon: MessageCircle, roles: ['admin'] },
  { href: '/settings', label: 'الإعدادات', icon: SettingsIcon, roles: ['admin'] },
];

function roleLabel(role?: Role): string {
  if (role === 'admin') return 'مدير';
  if (role === 'accountant') return 'محاسب';
  return 'جامع الحليب';
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { appUser, signOut } = useAuth();
  const { settings } = useSettings();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const filteredNavItems = navItems.filter((item) =>
    appUser ? item.roles.includes(appUser.role) : false,
  );

  // Show back button on all pages except home
  const showBackButton = location !== '/';

  const NavLinks = () => (
    <nav className="flex flex-col gap-1 p-4">
      {filteredNavItems.map((item) => {
        const isActive = location === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground',
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
      <Button
        variant="ghost"
        className="mt-4 flex w-full items-center justify-start gap-3 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => signOut()}
      >
        <LogOut className="h-5 w-5" />
        <span>تسجيل الخروج</span>
      </Button>
    </nav>
  );

  return (
    <div className="flex min-h-[100dvh] w-full bg-background font-sans" dir="rtl">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden w-64 flex-col border-l border-border bg-card md:flex">
        <div className="flex h-16 items-center border-b border-border px-6">
          <img
            src={settings?.logoUrl || defaultLogo}
            alt={settings?.coopName || 'شعار التعاونية'}
            className="h-8 w-8 object-contain ml-3 rounded-full"
          />
          <h1 className="text-lg font-bold text-foreground truncate">
            {settings?.coopName || 'تعاونية كوب بوعلا'}
          </h1>
        </div>
        <OfflineIndicator />
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div className="flex flex-col overflow-hidden flex-1">
              <span className="truncate text-sm font-medium">
                {appUser?.displayName || appUser?.email}
              </span>
              <span className="text-xs text-muted-foreground">{roleLabel(appUser?.role)}</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* ── Mobile header ── menu button on RIGHT, logo on LEFT (RTL) ── */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 md:hidden">
          {/* Menu button — first child → appears on the RIGHT in RTL flex */}
          <div className="flex items-center gap-2">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="القائمة">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64 p-0">
                <SheetTitle className="sr-only">القائمة الرئيسية</SheetTitle>
                <div className="flex h-16 items-center border-b border-border px-6">
                  <span className="text-lg font-bold">القائمة</span>
                </div>
                <NavLinks />
              </SheetContent>
            </Sheet>
            {/* Back button — shown on all pages except home */}
            {showBackButton && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="رجوع"
                onClick={() => window.history.back()}
                className="text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}
            <OfflineIndicator compact />
          </div>

          {/* Logo + name — second child → appears on the LEFT in RTL flex */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <h1 className="text-base font-bold truncate leading-tight">
                {settings?.coopName || 'تعاونية كوب بوعلا'}
              </h1>
              {appUser?.displayName && (
                <span className="text-xs text-muted-foreground truncate">
                  {appUser.displayName} · {roleLabel(appUser?.role)}
                </span>
              )}
            </div>
            <img
              src={settings?.logoUrl || defaultLogo}
              alt={settings?.coopName || 'شعار التعاونية'}
              className="h-8 w-8 object-contain rounded-full"
            />
            <ThemeToggle />
          </div>
        </header>

        {/* Desktop back button bar */}
        {showBackButton && (
          <div className="hidden md:flex items-center px-8 pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground hover:text-foreground -mr-2"
              onClick={() => window.history.back()}
            >
              <ChevronRight className="h-4 w-4" />
              رجوع
            </Button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
