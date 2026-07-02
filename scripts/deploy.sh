#!/bin/bash
# Déploiement complet en une commande : régénère le manifeste depuis catalog/images/,
# build le client (avec le catalogue), déploie le front (Pages) ET le serveur (Worker).
# Prérequis : `npx wrangler login` déjà fait une fois. Usage : ./scripts/deploy.sh
set -e
cd "$(dirname "$0")/.."

echo "1/4 · Régénération du manifeste depuis catalog/images/…"
# rafraîchit la provenance committée (pour la CI, qui n'a pas le pool local)
cp catalog/pool/rf/_sources.jsonl catalog/sources.jsonl 2>/dev/null || true
node scripts/build-manifest.mjs

echo "2/4 · Build du client (recopie du catalogue)…"
npm run build --workspace client

echo "3/4 · Déploiement du front (Cloudflare Pages)…"
npx wrangler pages deploy client/dist --project-name qui-paire-gagne --branch main --commit-dirty=true

echo "4/4 · Déploiement du serveur (Worker + Durable Object)…"
( cd server && npx wrangler deploy )

echo ""
echo "✅ Déployé → https://qui-paire-gagne.pages.dev"
echo "   (pense à committer catalog/images + manifest si tu veux versionner ta curation)"
