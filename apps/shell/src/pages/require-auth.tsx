import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../auth/auth-context';

// Sends signed-out users to /login, remembering where they were going.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status !== 'signedIn') {
    const returnTo = location.pathname + location.search + location.hash;
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }
  return children;
}
