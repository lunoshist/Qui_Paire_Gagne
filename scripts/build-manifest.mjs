#!/usr/bin/env node
/**
 * Génère catalog/manifest.json à partir des images présentes dans catalog/images/.
 * - id       = nom de fichier sans extension
 * - concept  = nom sans suffixe "-NN" (tirets -> espaces) ; découpé en mots pour des tags supplémentaires
 * - source/licence/attribution : récupérés depuis catalog/pool/rf/_sources.jsonl (images libres de droit),
 *   sinon conservés depuis le manifeste existant, sinon "ai-illustration" par défaut.
 * - tags : on PRÉSERVE les tags riches déjà présents dans le manifeste existant pour un id donné ;
 *   sinon tags.concepts dérivés du nom (enrichissement vision = tâche ultérieure).
 * Écrit aussi catalog/CREDITS.md (attribution des images sous licence CC-BY).
 *
 * Usage : node scripts/build-manifest.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMAGES_DIR = join(ROOT, 'catalog', 'images');
const MANIFEST = join(ROOT, 'catalog', 'manifest.json');
const SOURCES = join(ROOT, 'catalog', 'pool', 'rf', '_sources.jsonl');
const CREDITS = join(ROOT, 'catalog', 'CREDITS.md');

// 1) Provenance des images libres de droit (basename -> meta)
const prov = new Map();
if (existsSync(SOURCES)) {
  for (const line of readFileSync(SOURCES, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const m = JSON.parse(line);
      prov.set(basename(m.file), m);
    } catch {
      /* ligne corrompue ignorée */
    }
  }
}

// 2) Manifeste existant (pour préserver les tags riches déjà faits)
const prevById = new Map();
if (existsSync(MANIFEST)) {
  try {
    for (const c of JSON.parse(readFileSync(MANIFEST, 'utf8')).cards ?? []) prevById.set(c.id, c);
  } catch {
    /* manifeste illisible : on repart de zéro */
  }
}

const STOP = new Set(['the', 'a', 'an', 'of', 'and']);
function conceptTags(id) {
  const base = id.replace(/-\d+$/, ''); // enlève le suffixe -NN
  const phrase = base.replace(/-/g, ' ').trim();
  const words = phrase.split(' ').filter((w) => w.length > 2 && !STOP.has(w));
  return [...new Set([phrase, ...words])];
}

const files = readdirSync(IMAGES_DIR)
  .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
  .sort();
const cards = [];
const credits = [];

for (const file of files) {
  const id = basename(file, extname(file));
  const prev = prevById.get(id);
  const p = prov.get(file);

  let source, license, attribution;
  if (p) {
    source = 'royalty-free';
    license = p.license
      ? `${p.license}${p.license_version ? ' ' + p.license_version : ''}`
      : undefined;
    attribution = {
      creator: p.creator || null,
      sourceUrl: p.source_url || null,
      provider: p.provider || null,
    };
    if (p.license && p.license.toLowerCase().startsWith('by')) {
      credits.push(
        `- **${id}** — ${p.title || ''} par ${p.creator || 'inconnu'} (${license}) — ${p.source_url || ''}`,
      );
    }
  } else {
    source = prev?.source || 'ai-illustration';
    license = prev?.license;
    attribution = prev?.attribution;
  }

  const tags =
    prev && prev.tags && Array.isArray(prev.tags.concepts) && prev.tags.concepts.length
      ? prev.tags
      : {
          concepts: conceptTags(id),
          couleursDominantes: [],
          categorie: '',
          ambiance: [],
          formes: [],
        };

  const card = { id, subject: tags.concepts?.[0] || id, file: `images/${file}`, source, tags };
  if (license) card.license = license;
  if (attribution && (attribution.creator || attribution.sourceUrl)) card.attribution = attribution;
  cards.push(card);
}

const manifest = {
  version: 2,
  updated: new Date().toISOString().slice(0, 10),
  note: 'Généré par scripts/build-manifest.mjs depuis catalog/images/. Tags concepts dérivés du nom ; enrichissement (couleurs/catégorie/ambiance) à venir. Provenance/licence embarquée pour les images libres de droit.',
  count: cards.length,
  cards,
};
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');

const credHeader =
  '# Crédits & licences des images\n\n' +
  'Images sous CC0 / domaine public : aucune attribution requise.\n' +
  'Images sous CC-BY (attribution requise) ci-dessous :\n\n';
writeFileSync(
  CREDITS,
  credHeader + (credits.length ? credits.join('\n') : '(aucune pour l’instant)') + '\n',
);

const byLicense = cards.reduce((a, c) => ((a[c.source] = (a[c.source] || 0) + 1), a), {});
console.log(`manifest.json généré : ${cards.length} cartes`, byLicense);
console.log(`CREDITS.md : ${credits.length} images CC-BY à créditer`);
