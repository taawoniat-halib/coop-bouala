import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import NotFound from '@/pages/not-found';
import SignIn from '@/pages/sign-in';
import Dashboard from '@/pages/dashboard';
import SettingsPage from '@/pages/settings';
import Members from '@/pages/members';
import Milk from '@/pages/milk';
import Budget from '@/pages/budget';
import Reports from '@/pages/reports';
import { AuthProvider } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/components/ProtectedRoute';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/sign-in" component={SignIn} />
      <Route path="/">
        <ProtectedRoute roles={['admin']}>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute roles={['admin']}>
          <SettingsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/members">
        <ProtectedRoute roles={['admin']}>
          <Members />
        </ProtectedRoute>
      </Route>
        </ProtectedRoute>
      </Route>
      <Route path="/milk">
        <ProtectedRoute roles={['admin', 'collector', 'accountant']}>
          <Milk />
        </ProtectedRoute>
      </Route>
      <Route path="/budget">
        <ProtectedRoute roles={['admin']}>
          <Budget />
        </ProtectedRoute>
      </Route>
      <Route path="/reports">
        <ProtectedRoute roles={['admin']}>
          <Reports />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
