import { lazy } from 'react';
import axe from 'axe-core';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { HostProps } from '@rule-studio/host';
import { App } from './App';
import { AuthProvider } from './auth/auth-context';
import { createAuthSession } from './auth/session';
import { createFakeApi, PASSWORD } from './test/fake-api';

// No real remotes in unit tests: each "remote" just reports the host it got.
vi.mock('./mf', () => ({
  lazyProvider: (alias: string) =>
    lazy(async () => ({
      default: ({ host }: HostProps) => (
        <p>
          {alias} remote for {host.user.displayName} ({host.user.role}), can
          publish: {String(host.can('ruleset:publish'))}
        </p>
      ),
    })),
  resetProvider: vi.fn(),
}));

function CurrentPath() {
  const location = useLocation();
  return <output aria-label="current path">{location.pathname}</output>;
}

async function renderApp(
  url: string,
  server = createFakeApi(),
  demoPassword = '',
) {
  const session = createAuthSession({ fetch: server.fetch });
  await session.start();
  render(
    <MemoryRouter initialEntries={[url]}>
      <AuthProvider session={session}>
        <App demoPassword={demoPassword} />
        <CurrentPath />
      </AuthProvider>
    </MemoryRouter>,
  );
  return { server, session, user: userEvent.setup() };
}

const path = () =>
  screen.getByRole('status', { name: 'current path' }).textContent;

describe('routing and sign-in', () => {
  it('sends a signed-out visitor to the login page', async () => {
    await renderApp('/simulator');
    expect(
      await screen.findByRole('heading', { name: 'Sign in to Rule Studio' }),
    ).toBeInTheDocument();
    expect(path()).toBe('/login');
  });

  it('returns the user to the page they wanted after signing in', async () => {
    const { user } = await renderApp('/simulator');
    await user.type(screen.getByLabelText('Email'), 'editor@rulestudio.dev');
    await user.type(screen.getByLabelText('Password'), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText(/simulator remote for Demo editor/),
    ).toBeInTheDocument();
    expect(path()).toBe('/simulator');
  });

  it('keeps a signed-in user signed in across a reload', async () => {
    await renderApp(
      '/dashboard',
      createFakeApi({ signedInAs: 'admin@rulestudio.dev' }),
    );
    expect(
      await screen.findByText(/dashboard remote for Demo admin/),
    ).toBeInTheDocument();
  });

  it('shows the same message for a wrong password and an unknown email', async () => {
    const { user } = await renderApp('/login');
    for (const email of ['editor@rulestudio.dev', 'nobody@rulestudio.dev']) {
      await user.clear(screen.getByLabelText('Email'));
      await user.clear(screen.getByLabelText('Password'));
      await user.type(screen.getByLabelText('Email'), email);
      await user.type(screen.getByLabelText('Password'), 'wrong-password');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Invalid email or password.',
      );
    }
    expect(path()).toBe('/login');
  });

  it('explains rate limiting', async () => {
    const server = createFakeApi();
    server.rateLimited = true;
    const { user } = await renderApp('/login', server);
    await user.type(screen.getByLabelText('Email'), 'editor@rulestudio.dev');
    await user.type(screen.getByLabelText('Password'), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many sign-in attempts',
    );
  });

  it('checks the form before sending anything', async () => {
    const { user, server } = await renderApp('/login');
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      await screen.findByText('Enter a valid email address.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(server.calls).not.toContain('POST /api/auth/login');
  });

  it('disables the button while signing in', async () => {
    const server = createFakeApi();
    let release!: () => void;
    server.loginGate = new Promise((resolve) => (release = resolve));
    const { user } = await renderApp('/login', server);
    await user.type(screen.getByLabelText('Email'), 'viewer@rulestudio.dev');
    await user.type(screen.getByLabelText('Password'), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
    release();
    expect(await screen.findByText(/rule-editor remote/)).toBeInTheDocument();
  });

  it('signs in with a demo button', async () => {
    const { user } = await renderApp('/login', createFakeApi(), PASSWORD);
    await user.click(
      screen.getByRole('button', { name: 'Sign in as demo viewer' }),
    );
    expect(
      await screen.findByText(
        /rule-editor remote for Demo viewer \(VIEWER\), can publish: false/,
      ),
    ).toBeInTheDocument();
  });

  it('has an accessible login page', async () => {
    await renderApp('/login', createFakeApi(), PASSWORD);
    await screen.findByRole('heading', {
      level: 1,
      name: 'Sign in to Rule Studio',
    });
    // Contrast is checked from the tokens in libs/ui; jsdom computes no styles.
    const results = await axe.run(document.body, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });

  it('hides the demo buttons when no demo password is configured', async () => {
    await renderApp('/login');
    expect(
      screen.queryByRole('button', { name: /demo/ }),
    ).not.toBeInTheDocument();
  });

  it('sends a signed-in user away from the login page', async () => {
    await renderApp(
      '/login',
      createFakeApi({ signedInAs: 'viewer@rulestudio.dev' }),
    );
    expect(await screen.findByText(/rule-editor remote/)).toBeInTheDocument();
    expect(path()).toBe('/rulesets');
  });
});

describe('signed-in layout', () => {
  it('shows the navigation and the user, and signs out', async () => {
    const { user, server } = await renderApp(
      '/rulesets',
      createFakeApi({ signedInAs: 'editor@rulestudio.dev' }),
    );
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Rulesets', 'Simulator', 'Dashboard']);
    expect(within(nav).getByRole('link', { name: 'Rulesets' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await user.click(
      screen.getByRole('button', { name: 'Account: Demo editor' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));

    expect(
      await screen.findByRole('heading', { name: 'Sign in to Rule Studio' }),
    ).toBeInTheDocument();
    expect(server.calls).toContain('POST /api/auth/logout');
  });

  it('shows the right remote when moving between sections', async () => {
    const { user } = await renderApp(
      '/simulator',
      createFakeApi({ signedInAs: 'viewer@rulestudio.dev' }),
    );
    await screen.findByText(/simulator remote/);
    await user.click(screen.getByRole('link', { name: 'Rulesets' }));
    expect(await screen.findByText(/rule-editor remote/)).toBeInTheDocument();
    expect(screen.queryByText(/simulator remote/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(await screen.findByText(/dashboard remote/)).toBeInTheDocument();
  });

  it('goes to the login page when the session ends mid-use', async () => {
    const server = createFakeApi({ signedInAs: 'viewer@rulestudio.dev' });
    const { session } = await renderApp('/dashboard', server);
    await screen.findByText(/dashboard remote/);

    server.expireAccessToken();
    server.cookieFor = null;
    await session.api.get('/api/rulesets').catch(() => undefined);

    expect(
      await screen.findByRole('heading', { name: 'Sign in to Rule Studio' }),
    ).toBeInTheDocument();
  });

  it('shows "not found" for an unknown page', async () => {
    await renderApp(
      '/nope',
      createFakeApi({ signedInAs: 'viewer@rulestudio.dev' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument();
  });
});
