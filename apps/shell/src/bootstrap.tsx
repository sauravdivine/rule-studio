import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
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

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider session={session}>
        <App demoPassword={__DEMO_PASSWORD__} />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
