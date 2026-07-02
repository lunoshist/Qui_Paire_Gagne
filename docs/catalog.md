# Catalogue de cartes (brouillon de stratégie)

_MàJ : 2026-07-01. Statut : stratégie à affiner en Phase 1, exécution en Phase 3._

## Principe fondateur
Le catalogue n'est **pas** une simple banque d'images : c'est un **système** = images **+ métadonnées**
permettant de composer des **tirages de 11 cartes volontairement ambigus**. Sans ambiguïté, les paires
deviennent évidentes → le jeu de consensus s'effondre. C'est la pièce la plus structurante du projet.

## Style (RÉVISÉ 2026-07-02 — voir D-011 ; ancien « Dixit » ABANDONNÉ)
**⚠️ PAS de style Dixit / surréaliste / onirique.** Le pilote v1 (dreamy, sujets composites flous) a été rejeté :
sujets illisibles → aucune association possible. Direction correcte :
- **Un concept/objet central CLAIR et immédiatement reconnaissable** par carte (ex. une ambulance ; des chiffres
  à la craie sur un tableau noir ; un parapluie rouge). On doit identifier le sujet au premier coup d'œil.
- **Contexte/arrière-plan lisible** (souvent assez épuré) qui soutient la lecture ET ajoute des attributs associables.
- Les associations viennent des **attributs d'un sujet net** : objet, **formes**, **couleurs dominantes**,
  **contexte**, concepts évoqués (ex. ambulance → urgence/médical/transport/rouge/sirène).
- **VARIÉTÉ obligatoire** sur tout le catalogue : concepts, ambiances (joyeux, calme, dramatique, froid, nocturne…),
  contextes, formes, palettes. Ne PAS tout uniformiser dans une seule ambiance.
- Ni pictos simples (D-002), ni scènes surréalistes ambiguës. Richesse détaillée MAIS lisible.
- Médium (illustration nette vs photo réaliste) : **à trancher via pilote v2** (test A/B).

## Génération (acté D-002 + D-006 : coût minimal/gratuit)
- **Outil principal** : **Cloudflare Workers AI** (Flux schnell / SDXL) — free tier, même écosystème que
  l'hébergement, quasi zéro coût. Rendu illustratif correct (Flux schnell = bon compromis vitesse/qualité).
- **Lot pilote** : possible via générateur gratuit sans clé (ex. **Pollinations**, basé Flux) pour valider
  vite le style avant production.
- Repli qualité si besoin : Flux via crédits gratuits fal.ai/Together, SDXL local si GPU dispo.
- Nécessite un **style cohérent** (prompt maître / seed) sur toute la collection.
- **Passe de curation** obligatoire (qualité + « taggabilité » : une bonne carte doit être associable de
  plusieurs façons, ni trop vide ni trop littérale).
- Production **par petits lots** (contrainte gratuité → débit limité).

## Schéma de métadonnées (par carte) — proposition
```
Card {
  id, imageUrl,
  concepts: [str],        // ex: "voyage", "solitude", "nuit", "clé", "enfance"
  couleurDominante: [str],// ex: "bleu", "rouge"
  categorie: str,         // objet | animal | personnage | lieu | scène abstraite ...
  ambiance: [str],        // ex: "joyeux", "inquiétant", "onirique"
  formes: [str],          // ex: "rond", "vertical", "spirale"
  cadre/décor: str
}
```
Ces tags alimentent l'algo de tirage. (Le tagging peut être fait par un agent vision au moment de la curation.)

## Algo de tirage « ambiguïté contrôlée » — spécification
Tirer 11 cartes **non purement au hasard**. But : un ensemble où **beaucoup d'appariements se valent**, sans
paire triviale ni carte isolée → le consensus redevient un vrai pari.

**Graphe d'association** : entre 2 cartes, un lien pondéré = nombre/poids de tags partagés
(concept > ambiance > couleur ≈ forme). « Partenaire plausible » = lien ≥ seuil.

**Critères d'un bon tirage de 11** :
- **Degré** : chaque carte a idéalement **2–4 partenaires plausibles** (ni 0 = carte isolée/évidente à isoler
  en pomme pourrie, ni ~10 = tout se vaut, aucune discrimination).
- **Pas de paire écrasante** : aucune paire au lien si fort qu'elle est « obligatoire » pour tous.
- **Structure** : viser plusieurs petits *clusters* thématiques qui se **chevauchent** (une carte peut appartenir
  à 2 lectures) → ambiguïté *structurée*, pas bruit uniforme.
- **Pas de quasi-doublons** visuels/conceptuels.

**Procédure** (côté serveur, au `dealing`) :
1. Échantillonner K ensembles candidats de 11 (semi-guidés : piocher 2–3 clusters qui se recouvrent + compléments).
2. **Scorer** chaque candidat : `score = f(degré moyen, variance des degrés, absence de paire écrasante,
   connexité, diversité catégories)`.
3. Retenir le meilleur ; mémoriser le tirage dans l'état de la room.
- **Tests** : jeu de cas mesurant la distribution des degrés et l'absence de paire dominante sur N tirages.

## Volume
Jeu original ≈ 300 images. Cible pour la rejouabilité : **≥ 150–300 illustrations** de qualité.
Générer par lots ; commencer par un lot pilote pour valider le style avant de produire en masse.

## Production multi-sources (D-012)
3 sources choisies **au cas par cas par sujet** :
- **Illustration IA** (Pollinations/Flux) — médium par défaut.
- **Réaliste IA** — quand un rendu réaliste sert mieux le sujet.
- **Libre de droit** — Openverse, filtre **CC0/PDM** (domaine public, pas d'attribution requise). Testé OK
  (résultats + URL + licence + provider). Fallback : Wikimedia Commons.

**Méthode** : pour chaque sujet, rassembler plusieurs candidats (illustration IA + libre de droit) → **QC visuel
par le tracker** (choix du meilleur médium, rejet des défauts) → tagging → entrée dans le manifeste.

**QC — rejeter** : défauts anatomiques/objets incohérents (ex. parapluie à double toile, fil de téléphone dans le
vide), dépictions inexactes (spécificité culturelle : ambulance FR/EU), sujets illisibles, **sujets basés sur
texte/chiffres** (rendu IA médiocre → éviter le concept, ex. « tableau de chiffres »).

## Manifeste (`catalog/manifest.json`) — source de vérité du catalogue
```
Card {
  id, subject, file,                        // fichier dans catalog/images/
  source: 'ai-illustration'|'ai-realistic'|'royalty-free',
  license?, attribution?: {creator, sourceUrl, provider},   // requis si royalty-free
  tags: { concepts[], couleursDominantes[], categorie, ambiance[], formes[] }
}
```
Le manifeste alimente l'affichage ET l'algo de tirage. Assets committés dans `catalog/images/`.

## Étapes (Phase 3)
- [x] Outil + direction validés (D-006, D-011, D-012).
- [x] Pilotes v1 (rejeté) et v2 (validé) → direction « concept central clair + variété + multi-sources ».
- [ ] 🔄 Lot de production #1 (candidats IA + libre de droit) → QC tracker → manifeste (en cours).
- [ ] Production du reste du catalogue par lots (viser ≥100 cartes jouables).
- [ ] Tagging / métadonnées + `manifest.json`.
- [ ] Implémentation de l'algo de tirage + tests d'ambiguïté.
