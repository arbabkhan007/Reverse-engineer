import { useEffect, useState } from 'react';

/** Tiny hash router: no dependencies, works from any static host. */
export function navigate(path: string): void {
  if (window.location.hash === `#${path}`) return;
  window.location.hash = path;
}

export function useRoute(): { path: string; parts: string[]; query: URLSearchParams } {
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || '/');

  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash.slice(1) || '/');
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const [pathname, search] = hash.split('?');
  const query = new URLSearchParams(search ?? '');
  const parts = (pathname ?? '/').split('/').filter(Boolean);
  return { path: pathname ?? '/', parts, query };
}
