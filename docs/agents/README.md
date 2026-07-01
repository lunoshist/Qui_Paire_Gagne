# Briefs des sous-agents builders

Un sous-agent = **une seule tâche précise** + une **Definition of Done vérifiable**.
Un fichier par tâche, nommé `NNN-slug.md`. Le tracker crée le brief avant de dispatcher,
puis y consigne le résultat et la vérification au retour.

## Modèle de brief
```md
# TASK-NNN · <titre>

- **Statut** : à faire | dispatché | livré | vérifié | rejeté
- **Date** : AAAA-MM-JJ
- **Dépend de** : TASK-... (ou —)

## Objectif (une seule tâche)
<phrase unique et précise>

## Contexte utile
<liens vers docs/ pertinents, contraintes, fichiers concernés>

## Definition of Done (vérifiable)
- [ ] critère 1 (observable / testable)
- [ ] critère 2
- [ ] ...

## Livrables attendus
<fichiers/artefacts précis>

## Résultat (rempli au retour)
<ce qui a été produit, écarts, vérification effectuée par le tracker>
```
