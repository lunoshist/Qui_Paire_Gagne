/**
 * Chargement du catalogue de cartes côté client.
 *
 * Le manifeste est servi (pipeline TASK-008) à `/catalog/manifest.json` et les
 * illustrations à `/catalog/images/<file>`. On le charge une seule fois (cache
 * module) et on expose un hook `useCatalog()` + des helpers de résolution.
 *
 * Robustesse : si le manifeste est indisponible (offline, tests jsdom), les
 * composants dégradent en affichant le libellé/sujet de la carte.
 */

import { useEffect, useState } from 'react';

/** Une entrée de carte telle qu'exploitée par le client (affichage). */
export interface CatalogEntry {
  id: string;
  subject: string;
  file: string;
}

interface ManifestCard {
  id: string;
  subject?: string;
  file?: string;
}
interface Manifest {
  cards?: ManifestCard[];
}

/** Table id → entrée. `null` = pas encore chargé. */
export type CatalogMap = Map<string, CatalogEntry>;

let cache: CatalogMap | null = null;
let inflight: Promise<CatalogMap> | null = null;

/** URL publique d'une image à partir de son `file` (« images/xxx.jpg »). */
export function catalogImageUrl(file: string): string {
  return `/catalog/${file}`;
}

/** Charge (et met en cache) le manifeste. Ne rejette jamais : renvoie une map vide en cas d'échec. */
export function loadCatalog(): Promise<CatalogMap> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch('/catalog/manifest.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Manifest;
      const map: CatalogMap = new Map();
      for (const c of data.cards ?? []) {
        if (!c.id) continue;
        map.set(c.id, {
          id: c.id,
          subject: c.subject ?? c.id,
          file: c.file ?? '',
        });
      }
      cache = map;
      return map;
    } catch {
      // Dégradation silencieuse : les composants afficheront le sujet/id.
      cache = new Map();
      return cache;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Hook : renvoie la table du catalogue (vide tant que non chargée). */
export function useCatalog(): CatalogMap {
  const [map, setMap] = useState<CatalogMap>(() => cache ?? new Map());
  useEffect(() => {
    let alive = true;
    void loadCatalog().then((m) => {
      if (alive) setMap(m);
    });
    return () => {
      alive = false;
    };
  }, []);
  return map;
}

/** Sujet lisible d'une carte (repli : l'id). */
export function cardSubject(catalog: CatalogMap, id: string): string {
  return catalog.get(id)?.subject ?? id;
}

/** URL d'image d'une carte, ou `null` si inconnue (repli visuel). */
export function cardImage(catalog: CatalogMap, id: string): string | null {
  const file = catalog.get(id)?.file;
  return file ? catalogImageUrl(file) : null;
}
