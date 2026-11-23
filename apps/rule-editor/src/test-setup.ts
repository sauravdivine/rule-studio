import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// findBy… waits up to 3 s (default 1 s), for slow CI machines and parallel runs.
configure({ asyncUtilTimeout: 3000 });

// jsdom is not a browser. Fill in the few APIs Radix (menus) and the theme code use.
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }) as MediaQueryList;
window.ResizeObserver ??= class {
  observe = () => undefined;
  unobserve = () => undefined;
  disconnect = () => undefined;
};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => undefined;
Element.prototype.scrollIntoView ??= () => undefined;

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
