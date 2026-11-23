import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import './styles.css';
import { App } from './App';
import { AuthProvider } from './auth/auth-context';
import { createAuthSession } from './auth/session';

const container = document.getElementById('root');
if (!container) throw new Error('#root element not found');

// One session for the page. Started here, outside React, so it runs exactly
// once, before the first render (StrictMode would run an effect twice).
const session = createAuthSession();
void session.start();

// A data router (createBrowserRouter) rather than <BrowserRouter>: the same
// routes, declared in App, but it also enables useBlocker, which the rule
// editor uses to warn about unsaved changes (spec 005). One catch-all route
// renders App, whose <Routes> do the matching as before.
const router = createBrowserRouter([
  {
    path: '*',
    element: (
      <AuthProvider session={session}>
        <App demoPassword={__DEMO_PASSWORD__} />
      </AuthProvider>
    ),
  },
]);

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
