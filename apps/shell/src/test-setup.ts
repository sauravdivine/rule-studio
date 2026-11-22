import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

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
