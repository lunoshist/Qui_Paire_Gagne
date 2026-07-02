/**
 * Micro-routeur (History API) — pas de dépendance externe.
 * Deux routes seulement : `/` (Accueil) et `/room/:code` (Salle d'attente).
 */

import { useCallback, useEffect, useState } from 'react';

export type Route = { name: 'home' } | { name: 'room'; code: string };

/** Analyse un pathname en route connue (fallback = home). */
export function parseRoute(pathname: string): Route {
  const m = pathname.match(/^\/room\/([A-Za-z]{4})\/?$/);
  if (m) return { name: 'room', code: m[1].toUpperCase() };
  return { name: 'home' };
}

/** Hook de routage : route courante + `navigate(path)` (push History). */
export function useRoute(): { route: Route; navigate: (path: string) => void } {
  const [pathname, setPathname] = useState(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/',
  );

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((path: string) => {
    window.history.pushState({}, '', path);
    setPathname(path);
  }, []);

  return { route: parseRoute(pathname), navigate };
}
