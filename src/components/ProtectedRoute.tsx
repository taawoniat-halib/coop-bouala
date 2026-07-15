import type { ReactNode } from 'react';
import { Redirect } from 'wouter';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { Role } from '@/lib/types';

/**
 * Gates a route behind Firebase auth, optionally restricted to a set of
 * roles.
 * - Shows a centered spinner while auth state is loading (instead of blank flash).
 * - Redirects to /sign-in when unauthenticated.
 * - Redirects to role's home page when the role doesn't match.
 */
export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { appUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!appUser) return <Redirect to="/sign-in" />;

  if (roles && !roles.includes(appUser.role)) {
    return <Redirect to={appUser.role === 'admin' ? '/' : '/milk'} />;
  }

  return <>{children}</>;
}
