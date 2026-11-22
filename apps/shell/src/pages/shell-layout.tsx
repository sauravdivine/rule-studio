import { NavLink, Outlet, useNavigate } from 'react-router';
import { LogOut } from 'lucide-react';
import {
  AppShell,
  Badge,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ThemeToggle,
} from '@rule-studio/ui';
import { useAuth } from '../auth/auth-context';
import { visibleSections } from '../navigation';

const ROLE_LABEL = {
  VIEWER: 'Viewer',
  EDITOR: 'Editor',
  ADMIN: 'Admin',
} as const;

export function ShellLayout() {
  const { session, state } = useAuth();
  const navigate = useNavigate();
  const host = session.getHost();
  if (state.status !== 'signedIn' || !host) return null; // RequireAuth handles this

  const { user } = state;
  return (
    <AppShell
      brand="Rule Studio"
      nav={visibleSections(host.can).map((section) => (
        <NavLink
          key={section.path}
          to={section.path}
          className={({ isActive }) =>
            cn(
              'rounded-md px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              isActive && 'bg-accent text-accent-foreground',
            )
          }
        >
          {section.label}
        </NavLink>
      ))}
      actions={
        <>
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Account: ${user.displayName}`}
              >
                {user.displayName}
                <Badge variant="neutral">{ROLE_LABEL[user.role]}</Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={async () => {
                  await session.logout();
                  navigate('/login', { replace: true });
                }}
              >
                <LogOut aria-hidden="true" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    >
      <Outlet />
    </AppShell>
  );
}
