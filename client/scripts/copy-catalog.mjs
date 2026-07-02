/**
 * Pipeline d'assets du catalogue (TASK-008).
 *
 * Recopie `catalog/manifest.json` + `catalog/images/` (racine du monorepo) dans
 * `client/public/catalog/`, d'où Vite les sert à `/catalog/manifest.json` et
 * `/catalog/images/<file>` (dev via `public/`, prod copié dans `dist/` au build,
 * puis servi par Cloudflare Pages).
 *
 * Branché sur `predev` ET `prebuild` (cf. client/package.json) : le catalogue
 * grandira, le script recopie simplement le dossier courant à chaque fois.
 *
 * Idempotent : purge la cible avant de recopier (pas d'images orphelines).
 */

import { cp, mkdir, rm, access, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const SRC_CATALOG = resolve(REPO_ROOT, 'catalog');
const SRC_MANIFEST = resolve(SRC_CATALOG, 'manifest.json');
const SRC_IMAGES = resolve(SRC_CATALOG, 'images');
const DEST_CATALOG = resolve(HERE, '..', 'public', 'catalog');

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(SRC_MANIFEST))) {
    console.error(`[copy-catalog] introuvable : ${SRC_MANIFEST}`);
    process.exit(1);
  }

  // Purge + recréation de la cible (évite les fichiers orphelins).
  await rm(DEST_CATALOG, { recursive: true, force: true });
  await mkdir(DEST_CATALOG, { recursive: true });

  await cp(SRC_MANIFEST, resolve(DEST_CATALOG, 'manifest.json'));

  let nbImages = 0;
  if (await exists(SRC_IMAGES)) {
    await cp(SRC_IMAGES, resolve(DEST_CATALOG, 'images'), { recursive: true });
    // Compte informatif des fichiers copiés (best-effort).
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(resolve(DEST_CATALOG, 'images'));
    for (const e of entries) {
      const s = await stat(resolve(DEST_CATALOG, 'images', e));
      if (s.isFile()) nbImages++;
    }
  }

  console.log(`[copy-catalog] catalogue copié → ${DEST_CATALOG} (${nbImages} image(s)).`);
}

main().catch((err) => {
  console.error('[copy-catalog] échec :', err);
  process.exit(1);
});
