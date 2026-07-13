import type { ReactNode } from 'react';
import { Redirect } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import type { Role } from '@/lib/types';

/**
 * Gates a route behind Firebase auth, optionally restricted to a set of
 * roles. Shows nothing while auth state is loading, redirects to /sign-in
 * when unauthenticated, and to / when the role doesn't match.
 */
export function ProtectedRoute({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: Role[];
}) {
  const { appUser, loading } = useAuth();

  if (loading) return null;
  if (!appUser) return <Redirect to="/sign-in" />;
  if (roles && !roles.includes(appUser.role)) {
    // Send the user back to whichever landing page they're actually
    // allowed to see, instead of the fixed "/" (which admins-only can
    // reach and would otherwise loop for everyone else).
    return <Redirect to={appUser.role === 'admin' ? '/' : '/milk'} />;
  }

  return <>{children}</>;
}
