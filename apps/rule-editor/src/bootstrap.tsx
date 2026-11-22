import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Running on its own (npx nx serve <remote>): load the full stylesheet and theme
// that the shell normally provides.
import '@rule-studio/ui/styles/global.css';
import { applyTheme, readThemePreference } from '@rule-studio/ui';
import { App } from './App';

applyTheme(readThemePreference());

const container = document.getElementById('root');
if (!container) throw new Error('#root element not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
