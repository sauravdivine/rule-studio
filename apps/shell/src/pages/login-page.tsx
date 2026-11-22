import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import {
  zLoginRequest,
  type LoginRequest,
  type Role,
} from '@rule-studio/shared-types';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  ThemeToggle,
} from '@rule-studio/ui';
import { useAuth } from '../auth/auth-context';
import { loginErrorMessage } from '../auth/session';
import { safeReturnPath } from '../navigation';

const DEMO_USERS: Array<{ role: Role; label: string; email: string }> = [
  { role: 'VIEWER', label: 'Viewer', email: 'viewer@rulestudio.dev' },
  { role: 'EDITOR', label: 'Editor', email: 'editor@rulestudio.dev' },
  { role: 'ADMIN', label: 'Admin', email: 'admin@rulestudio.dev' },
];

export function LoginPage({ demoPassword }: { demoPassword: string }) {
  const { session, state } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = safeReturnPath(params.get('returnTo'));
  const [error, setError] = useState<string | null>(null);

  // The same Zod schema the API validates with, generated from the contract.
  const form = useForm<LoginRequest>({
    resolver: zodResolver(zLoginRequest),
    defaultValues: { email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  async function signIn(values: LoginRequest) {
    setError(null);
    try {
      await session.login(values.email, values.password);
      navigate(returnTo, { replace: true });
    } catch (e) {
      setError(loginErrorMessage(e));
    }
  }

  if (state.status === 'signedIn') {
    return <Navigate to={returnTo} replace />;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <main className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle as="h1" className="text-xl">
              Sign in to Rule Studio
            </CardTitle>
            <CardDescription>
              Write, test and publish decision rules.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <form
              className="grid gap-4"
              noValidate
              onSubmit={form.handleSubmit(signIn)}
            >
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <FormField
                label="Email"
                error={errors.email && 'Enter a valid email address.'}
              >
                <Input
                  type="email"
                  autoComplete="username"
                  {...form.register('email')}
                />
              </FormField>
              <FormField
                label="Password"
                error={errors.password && 'Enter your password.'}
              >
                <Input
                  type="password"
                  autoComplete="current-password"
                  {...form.register('password')}
                />
              </FormField>
              <Button type="submit" loading={isSubmitting}>
                Sign in
              </Button>
            </form>

            {demoPassword && (
              <section
                aria-labelledby="demo-heading"
                className="grid gap-2 border-t pt-4"
              >
                <h2 id="demo-heading" className="text-sm font-medium">
                  Try a demo account
                </h2>
                <div className="grid grid-cols-3 gap-2">
                  {DEMO_USERS.map((demo) => (
                    <Button
                      key={demo.role}
                      variant="outline"
                      size="sm"
                      disabled={isSubmitting}
                      aria-label={`Sign in as demo ${demo.label.toLowerCase()}`}
                      onClick={() => {
                        form.setValue('email', demo.email);
                        form.setValue('password', demoPassword);
                        void form.handleSubmit(signIn)();
                      }}
                    >
                      {demo.label}
                    </Button>
                  ))}
                </div>
              </section>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
