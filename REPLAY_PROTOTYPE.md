# Prototype de replay candidat

Branche de test issue du Build #134 validé.

Le replay visuel ne reconstruit plus un rapport à partir des données : il enregistre progressivement les **pages réellement affichées pendant la passation** sous forme de diapositives PNG figées. Au moment exact où le candidat affiche sa page **Résultats**, ces captures sont réunies avec les données de session dans une archive autonome stockée dans `Documents/SEB EvalPro/parcours`.

Chaque nouvelle archive est un dossier indépendant contenant :

- `manifest.json` : candidat, date, Build utilisé, données de contrôle, ordre des pages, empreintes SHA-256 ;
- `slides/` : captures PNG des pages du parcours dans l’état où elles ont été remplies.

Cette structure est volontairement indépendante de la version courante de SEB EvalPro. Si un exercice du Build #134 disparaît dans une version future, le replay reste possible car l’archive possède sa propre représentation figée de la page historique.

Le replay est réservé à l’administrateur, permet de choisir l’archive à rejouer, affiche clairement le Build utilisé et fonctionne strictement en **lecture seule** : aucune modification des réponses et aucun recalcul des réponses, scores ou bilan.

Les archives créées par le premier prototype « rapport » restent reconnues comme archives historiques, mais sont signalées comme ne contenant pas de diapositives visuelles autonomes.

Disposition de la barre administrateur : actions de consultation à gauche (`Résultats stagiaires`, `Rejouer un parcours`, `Bilan`, `Retour à l’évaluation` selon le contexte) ; actions de session à droite (`Fermer cette session`, `Verrouiller`).
