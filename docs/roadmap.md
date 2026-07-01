# Roadmap — plan de construction détaillé

> _MàJ : 2026-07-01._ Légende : `- [ ]` à faire · `🔄` en cours · `- [x]` fait.
> La **Phase 1 (réflexion produit & design) se fait AVANT tout code** — exigence du commanditaire.
> Chaque tâche codée sera dispatchée à un sous-agent avec 1 tâche + Definition of Done (`docs/agents/`).

## Phase 0 — Cadrage & continuité ✅
- [x] Recherche des règles officielles du jeu (2026-07-01)
- [x] Brief projet (`docs/brief.md`)
- [x] Système de consignation (`AGENTS.md`, `docs/`)
- [x] Réponses aux 3 questions structurantes → décisions D-002/003/004 actées
- [ ] Recouper la règle de scoring avec le livret officiel (PDF) — confirmer D-003

## Phase 1 — Réflexion produit & design (AVANT tout code)
Docs concernés : `architecture.md`, `design-ux.md`, `catalog.md` (déjà amorcés en brouillon).
- [x] **Archi** : Cloudflare DO free tier vérifié + stack figée (D-005). Contrainte : frugalité des messages.
- [x] **Archi** : front figé (React+Vite+TS + dnd-kit + Motion) — dans D-005
- [x] **Data** : modèle d'état de room + machine à états (`architecture.md`)
- [x] **Data** : protocole client↔serveur (messages) + règle de secret des soumissions (`architecture.md`)
- [x] **Catalogue** : schéma de métadonnées + spéc de l'**algo de tirage ambigu** + critères (`catalog.md`)
- [x] **Design** : direction visuelle actée (D-007, fun/coloré) — `design-ux.md`
- [x] **UX** : flow écran par écran + wireframes basse fidélité (`design-ux.md`)
- [x] **UX** : drag & drop + tap-to-pair + états/feedback (`design-ux.md`)
- [x] **UX** : storyboard de la révélation + tempos configurables (D-008) (`design-ux.md`)
- [x] **Catalogue** : outil de génération acté (D-006, Cloudflare Workers AI / Flux schnell)
- [ ] 🔄 **Découpage** : transformer tout ça en lots de tâches builders (briefs + DoD) ← PROCHAINE ÉTAPE

## Phase 2 — Fondations techniques
- [x] **TASK-001** Setup repo/outillage + monorepo (client/server/shared) + écho WS local (vérifié 2026-07-01)
- [x] **TASK-002** `shared/` : contrat complet (protocole + modèle d'état) + **score pur, 33 tests** (vérifié 2026-07-01)
- [ ] 🔄 **TASK-003** Serveur : Durable Object « room » (lobby : create/join/settings/start) + broadcasts d'état
- [ ] **TASK-004** Squelette client : routing, store WS synchronisé, écrans Accueil + Salle d'attente (design system de base)
- [ ] Déploiement automatique (Cloudflare Pages + Workers) — *nécessite compte Cloudflare*

## Phase 3 — Catalogue de cartes
- [ ] Lot pilote (~15–30 images) → valider style + rendu d'un vrai tirage de 11
- [ ] Production du catalogue complet (≥150–300 illustrations)
- [ ] Tagging / métadonnées (agent vision + curation)
- [ ] Hébergement des images (R2 / assets) + optimisation (formats, tailles, lazy)
- [ ] Implémentation + tests de l'algo de tirage (ambiguïté contrôlée)

## Phase 4 — Boucle de jeu
- [ ] Accueil + création/rejoindre salle (pseudo, avatar, code/lien)
- [ ] Salle d'attente : liste joueurs, réglages hôte, garde-fou ≥3, lancement
- [ ] Manche : distribution des 11 cartes, drag&drop/tap-to-pair, sablier, soumission (secrète)
- [ ] Résolution serveur : correspondances + scoring (solo=0, unanime=0, pomme pourrie×2)
- [ ] Révélation animée (selon storyboard Phase 1)
- [ ] Scoreboard manche + cumul, enchaînement des manches, écran de victoire

## Phase 5 — Polish & fiabilité
- [ ] Responsive complet + soin tactile (mobile)
- [ ] Déconnexions/reconnexions, bascule d'hôte, joueur qui quitte en cours
- [ ] Sons, animations, micro-interactions, peaufinage du feel
- [ ] Tests bout-en-bout multi-joueurs (plusieurs onglets/appareils)
- [ ] Déploiement final + **vérification disponibilité 24/24** (pas de cold start)

## Dépendances clés
- Phase 4 (boucle de jeu) dépend de : archi validée (P1/P2) + catalogue jouable (P3, au moins pilote).
- La génération du catalogue (P3) peut démarrer en parallèle de P2 dès que D-006 est tranchée.
