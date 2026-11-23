import { Navigate, Route, Routes } from 'react-router';
import { EmptyState, Spinner } from '@rule-studio/ui';
import { useAuth } from './auth/auth-context';
import { LoginPage } from './pages/login-page';
import { RequireAuth } from './pages/require-auth';
import { ShellLayout } from './pages/shell-layout';
import { RemoteSlot } from './remote-slot';
import { SECTIONS, type Section } from './navigation';

function SectionPage({ section }: { section: Section }) {
  const { session } = useAuth();
  const host = session.getHost();
  if (!host) return null;
  if (!host.can(section.permission)) {
    return (
      <EmptyState
        title="You don't have access to this page"
        description="Ask an admin if you think you should."
      />
    );
  }
  // The key gives each remote, for each user, its own slot. Without the remote in
  // it, React would reuse one slot for every route (same type, same place) and
  // keep showing the first remote it loaded after the URL changed.
  return (
    <RemoteSlot
      key={`${section.remote}:${host.user.id}`}
      alias={section.remote}
      name={section.remoteName}
      host={host}
    />
  );
}

export function App({ demoPassword = '' }: { demoPassword?: string }) {
  const { state } = useAuth();

  // Until the first refresh answers, we don't know if the user is signed in.
  // Showing the login page now would flash it at signed-in users on every reload.
  if (state.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Loading Rule Studio" />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={<LoginPage demoPassword={demoPassword} />}
      />
      <Route
        element={
          <RequireAuth>
            <ShellLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to={SECTIONS[0].path} replace />} />
        {/* "/*": each remote owns every path below its section (spec 005). */}
        {SECTIONS.map((section) => (
          <Route
            key={section.path}
            path={`${section.path}/*`}
            element={<SectionPage section={section} />}
          />
        ))}
        <Route
          path="*"
          element={
            <EmptyState
              title="Page not found"
              description="Pick a section from the menu."
            />
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
