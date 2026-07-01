# Catalogue de cartes (brouillon de stratégie)

_MàJ : 2026-07-01. Statut : stratégie à affiner en Phase 1, exécution en Phase 3._

## Principe fondateur
Le catalogue n'est **pas** une simple banque d'images : c'est un **système** = images **+ métadonnées**
permettant de composer des **tirages de 11 cartes volontairement ambigus**. Sans ambiguïté, les paires
deviennent évidentes → le jeu de consensus s'effondre. C'est la pièce la plus structurante du projet.

## Style (acté D-002)
Illustrations **détaillées et évocatrices, style Dixit** (surréaliste/onirique, plusieurs lectures possibles).
Pas de pictos simples. Richesse visuelle = fonctionnelle (empêche l'association unique évidente).

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

## Étapes (Phase 3)
- [ ] Fixer outil + budget (D-006).
- [ ] Lot pilote (~15–30 images) → valider style + taggabilité + rendu d'un vrai tirage de 11.
- [ ] Production du catalogue complet.
- [ ] Tagging / métadonnées (agent vision + curation).
- [ ] Implémentation de l'algo de tirage + jeu de tests d'ambiguïté.
