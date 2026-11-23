import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
// Running on its own (npx nx serve <remote>): load the full stylesheet and theme
// that the shell normally provides.
import '@rule-studio/ui/styles/global.css';
import { applyTheme, readThemePreference } from '@rule-studio/ui';
import { createTestHost } from '@rule-studio/host/testing';
import { App } from './App';

applyTheme(readThemePreference());

const container = document.getElementById('root');
if (!container) throw new Error('#root element not found');

// No shell, so no sign-in: a demo editor with no API (screens that load data
// show their error state). Inside the shell, the real host comes from the
// signed-in session. The routes mirror the shell's: the editor lives under /rulesets.
const router = createBrowserRouter([
  { path: '/rulesets/*', element: <App host={createTestHost('EDITOR')} /> },
  { path: '*', element: <Navigate to="/rulesets" replace /> },
]);

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
