# Qui Paire Gagne — Version en ligne · Orientation agent

> Adaptation web multijoueur temps réel du jeu de société **« Qui Paire Gagne »**
> (Stephen Glenn, Le Scorpion Masqué, 2015).
> Ce fichier est le **POINT D'ENTRÉE** de tout agent (fresh ou non) travaillant sur ce projet.

## ⚠️ Continuité de session — RÈGLE N°1
La session de l'agent peut être **coupée ou perdue à tout moment**. Toute information importante
(contexte, choix, avancement, résultats des sous-agents) **DOIT être consignée dans `docs/`**,
jamais uniquement dans le contexte de conversation. Objectif : un agent fresh reprend le projet
de façon **transparente** en lisant les fichiers ci-dessous, sans rien redemander.

## 📖 Ordre de lecture pour (re)prendre le projet
1. **`docs/state.md`** — OÙ ON EN EST MAINTENANT. À lire en PREMIER, toujours. Phase courante,
   fait / en cours / prochaine action, blocages, questions ouvertes.
2. `docs/brief.md` — le projet, les règles du jeu, la vision produit, le mode de fonctionnement.
3. `docs/decisions.md` — journal des décisions (quoi + pourquoi + date), append-only.
4. `docs/roadmap.md` — le plan complet (phases → tâches) avec le statut de chaque tâche.
5. `docs/architecture.md`, `docs/design-ux.md`, `docs/catalog.md` — docs de fond,
   créés/complétés au fil des phases de réflexion (peuvent ne pas exister encore).
6. `docs/agents/` — briefs des sous-agents builders (1 tâche + Definition of Done chacun).

## ✍️ Règles de tenue des docs (obligatoires pour l'agent tracker)
- Après **toute** avancée ou décision : mettre à jour `docs/state.md` (source de vérité vivante),
  et ajouter une entrée dans `docs/decisions.md` si c'est un choix structurant.
- `docs/roadmap.md` : cocher `- [x]` les tâches finies, marquer 🔄 celles en cours, laisser `- [ ]` le reste.
- À chaque dispatch de sous-agent : créer/mettre à jour son brief dans `docs/agents/`, y consigner
  le résultat et la vérification une fois revenu.
- Formats machine-lisibles : cases à cocher, statuts explicites, **dates absolues (AAAA-MM-JJ)**.
- Écrire **dense et factuel**. Ces docs servent la reprise par un agent, pas la lecture humaine.

## 👥 Rôles
- **Tracker (agent principal)** : produit le plan, découpe, dispatche les sous-agents, vérifie,
  intègre, et **tient les docs à jour**.
- **Builders (sous-agents)** : reçoivent **une seule tâche précise + une Definition of Done
  vérifiable**. Un brief = un fichier dans `docs/agents/`.

## Repère rapide
- Le jeu : 3–8 joueurs, 11 photos/manche, 5 paires + 1 « pomme pourrie », 4 manches. Jeu de
  **consensus / association d'idées** (deviner les paires que feront les autres), pas de memory.
- Références d'expérience visées : skribbl, Gartic Phone, Codenames, Make It Meme, GeoGuessr.
- Contraintes dures : **temps réel multijoueur**, **hébergement gratuit ET disponible 24/24**,
  responsive (mobile + desktop).
