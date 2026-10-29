'use client';

import ReactDOM from 'react-dom';
import { createRoot, Root } from 'react-dom/client';

/**
 * Polyfill ReactDOM.render and unmountComponentAtNode for React 19 compatibility
 * with third-party libraries (like Onairos SDK) that still call legacy ReactDOM.render.
 */
if (typeof window !== 'undefined') {
  const containerRoots = new WeakMap<Element | DocumentFragment, Root>();

  const renderPolyfill = function (
    element: React.ReactNode,
    container: Element | DocumentFragment,
    callback?: () => void
  ) {
    let root = containerRoots.get(container);
    if (!root) {
      root = createRoot(container);
      containerRoots.set(container, root);
    }
    root.render(element);
    if (callback) {
      queueMicrotask(callback);
    }
  };

  const unmountPolyfill = function (container: Element | DocumentFragment) {
    const root = containerRoots.get(container);
    if (root) {
      root.unmount();
      containerRoots.delete(container);
      return true;
    }
    return false;
  };

  const targets = [
    ReactDOM as any,
    (ReactDOM as any)?.default,
    (window as any).ReactDOM,
    (window as any).ReactDOM?.default,
  ].filter(Boolean);

  for (const target of targets) {
    if (!target.render) {
      try {
        target.render = renderPolyfill;
      } catch (e) {
        // ignore if non-configurable
      }
    }
    if (!target.unmountComponentAtNode) {
      try {
        target.unmountComponentAtNode = unmountPolyfill;
      } catch (e) {
        // ignore if non-configurable
      }
    }
  }

  // Ensure window.ReactDOM exists globally as well
  if (!(window as any).ReactDOM) {
    (window as any).ReactDOM = ReactDOM;
  }

  console.log('✅ [React19Polyfill] ReactDOM.render polyfill installed on all targets');
}

export {};
