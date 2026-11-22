import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { AuthSession, SessionState } from './session';

// A React context is fine here: it never leaves the shell's own bundle.
// Remotes get auth through the `host` prop instead (spec 002).
const AuthContext = createContext<AuthSession | null>(null);

export function AuthProvider({
  session,
  children,
}: {
  session: AuthSession;
  children: ReactNode;
}) {
  return (
    <AuthContext.Provider value={session}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): { session: AuthSession; state: SessionState } {
  const session = useContext(AuthContext);
  if (!session) throw new Error('useAuth() must be used inside <AuthProvider>');
  const state = useSyncExternalStore(session.subscribe, session.getState);
  return { session, state };
}
