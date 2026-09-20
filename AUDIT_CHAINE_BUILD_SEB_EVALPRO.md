# Audit de la chaîne de build SEB EvalPro — 20/09/2026

## Référence auditée

- Branche : `test-plateaux-candidats`
- Base de départ : Build #87 — commit `90278efa15925aa40739d732b579f3515b4bb502`
- Chaîne observée : 59 scripts dans `prepare:web` + 13 scripts complémentaires dans le workflow, soit 72 exécutions autour d'un build.

## Conclusion

La quantité de scripts n'est pas à elle seule le problème. La majorité des scripts d'exercices ne touchent qu'aux pages QCM et portent encore des corrections fonctionnelles validées. Ils ne doivent pas être supprimés sans comparaison fonctionnelle complète.

Les blocages #82 à #86 provenaient d'un petit groupe de scripts cœur qui modifient ou contrôlent `src/main.js` / `src/preload.js` avec des ancres historiques trop rigides.

## Scripts cœur à surveiller

- `scripts/priority-fixes.js`
- `scripts/candidate-replay-prototype.js`
- `scripts/build147-admin-workability-fix.js`
- `scripts/admin-mode-ui-polish.js`
- `scripts/candidate-autonomous-final.js`
- `scripts/build96-fixes.js` (barre Admin / numéro de build)
- `scripts/replay-page3-paronymes-fix.js` (preload + replay)

## Actions réalisées

1. L'ancien système global « Résultats stagiaires » est retiré de `priority-fixes.js`.
   - plus de bouton global `seb-evalpro-results`;
   - plus de dialogue global ;
   - plus de handlers `admin:list-results` / `admin:open-result`;
   - seul le nouveau flux Résultats par dossier candidat est accepté.

2. Les scripts Replay et Admin qui avaient bloqué les builds #82 à #86 ont été rendus compatibles avec la nouvelle architecture sans réactiver les anciens comportements.

3. `candidate-autonomous-final.js` devient le garde final des invariants actuels :
   - un candidat = un dossier ;
   - consolidation non destructive des doublons ;
   - Résultats par candidat uniquement ;
   - aucun ancien flux Résultats global ;
   - bouton Fermer cette session disponible en Admin ;
   - bouton Fermer les résultats ;
   - prérequis Microsoft Visual C++ x64 présent dans le Setup ;
   - diagnostic IA explicite si le runtime Windows manque.

## Scripts conservés

Les scripts de correction d'exercices (QCM, dictée, briques, tri, calculatrice, planning, paronymes, résultats de pages, etc.) restent dans la chaîne. Plusieurs utilisent encore des remplacements textuels, mais ils ciblent des pages fonctionnelles validées et leur suppression sans comparaison pourrait réintroduire des régressions.

## Règle pour la suite

- Ne plus ajouter un nouveau script historique pour chaque correction si le comportement peut être corrigé directement dans le fichier source.
- Préférer les tests bloquants ciblés aux remplacements textuels fondés sur une forme exacte ancienne.
- Toute évolution de `main.js` ou `preload.js` doit être compatible avec les scripts cœur ci-dessus avant de déclencher un build.
- Aucun ancien stockage global Résultats/Bilans ne doit redevenir une source opérationnelle. Les anciens emplacements ne servent qu'à la migration de sécurité.
- Ne jamais supprimer un script d'exercice sans vérifier que son résultat est déjà intégré durablement dans la source ou couvert par un test équivalent.


## Script retiré de la chaîne après audit

- `scripts/result-docx-style-fix.js` est conservé uniquement comme historique, mais n'est plus exécuté par `prepare:web`.
- Il appartenait à l'ancien flux global « Résultats stagiaires » et produisait automatiquement un second Word `Resultat_...`.
- Le résultat officiel est maintenant la page Résultats enregistrée dans le dossier candidat, ouverte en lecture seule.
- La rubrique « Document Word du bilan » n'affiche désormais que les fichiers `Evaluation_....doc/docx`.
