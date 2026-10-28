# Design system Klerio

## Intention

Klerio doit donner l'impression d'un **bureau calme**, pas d'un tableau de bord bancaire. On privilégie :
- des phrases courtes, un ton rassurant, zéro jargon ;
- de grandes zones cliquables (44 px minimum) ;
- un contraste élevé et un mode sombre complet ;
- une seule action principale par écran ;
- la transparence des quotas, jamais de coût caché.

## Palette

| Rôle | Clair | Sombre | Usage |
|---|---|---|---|
| Fond | `#f6f4ee` (sable) | `#0d111c` | Ambiance chaleureuse, moins clinique que le blanc pur |
| Surface | `#ffffff` | `#161c2c` | Cartes |
| Encre | `#161c2c` | `#f7f8fb` | Texte principal |
| Encre secondaire | `#607095` | `#b9c1d4` | Texte d'aide |
| Marque | `#1e5754` / `#2f8880` | `#7cc2b8` | Boutons, liens, accents |
| Action | `#fb5f12` | `#ffad71` | Crédits, alertes douces, scan |
| Succès | `#059669` | `#6ee7b7` | Sécurité, confirmations |
| Alerte | `#d97706` | `#fcd34d` | Vigilance, quota 80 % |
| Danger | `#dc2626` | `#fca5a5` | Arnaque, suppression |

Le vert profond est la couleur de la confiance ; l'orange est réservé à ce qui attire l'œil (crédits, action). Le rouge n'est utilisé que pour les risques réels.

## Typographie

- Pile système : `Atkinson Hyperlegible`, puis `Segoe UI`, `system-ui`. Aucune police distante : chargement instantané et bonne lisibilité.
- Titres : graisse 800/900, interlettrage serré (`tracking-tight`), taille fluide 3xl → 4xl.
- Corps : 14–16 px, interligne 1.6–1.75.
- Libellés : 12 px, majuscules, interlettrage large pour les sections.
- Les textes longs sont limités à ~65 caractères par ligne.

## Composants

- **Cartes** (`card`) : rayon 20 px, bord discret, ombre très douce.
- **Boutons** : hauteur 44 px, rayon 12 px, trois niveaux (primaire, secondaire, fantôme). Jamais de bouton icône seul sans `aria-label`.
- **Badges** : état, quota, famille, risque. Couleur + texte, jamais la couleur seule.
- **Barres de progression** : associées à un texte « X / Y », `role="progressbar"`.
- **Alertes** : titre + phrase d'action, ton adapté, jamais d'alarme sans solution.
- **Champs** : libellé au-dessus, aide en dessous, erreur en rouge avec `role="alert"`.
- **Navigation** : sidebar sur desktop, barre basse à 5 entrées sur mobile, scan au centre.
- **Assistant** : onglets, aperçu du quota avant action, résultat en cartes (résumé, arnaque, actions, dates, montants, lien officiel).

## Accessibilité

- Cible WCAG 2.2 AA : contrastes vérifiés, focus visible (`ring-4`), navigation clavier, libellés explicites.
- `prefers-reduced-motion` désactive les animations.
- Le mode sombre est piloté par une classe et mémorisé ; aucun flash au chargement.
- Les tableaux ont des `caption` masquées ; les icônes décoratives sont `aria-hidden`.
- Le langage est simplifié (FALC) : phrases courtes, pas de double négation, pas d'abréviation non expliquée.
- Les montants et dates sont formatés en français, fuseau Europe/Paris.

## Écrans clés

1. **Accueil** : une phrase de réassurance, trois portes d'entrée, compteurs, rappels, derniers documents.
2. **Scan** : deux gros boutons (photo / import), pages réordonnables, coût visible, bouton unique d'enregistrement.
3. **Coffre** : barre de stockage permanente, recherche, filtres, corbeille expliquée.
4. **Assistant** : le quota est affiché avant chaque action ; l'arnaque a sa propre carte ; le lien officiel est identifié comme vérifié.
5. **Quotas** : tous les compteurs, reset, historique, distinction incluse/crédits.
6. **Paiement** : récapitulatif des conséquences, prix TTC, confirmation explicite, mode démo clairement signalé.
7. **Famille** : pool, consommation par membre, politique de quotas, limites optionnelles, confidentialité expliquée.

## Ton éditorial

- « Vos documents restent vos documents. »
- « Rien ne part sans votre accord. »
- « Vous pouvez attendre, utiliser des crédits ou changer de forfait. »
- « Ce document est complexe : faites-vous accompagner. »
- Jamais : « optimal », « solution », « process », « il suffit de ».

## Écarts assumés avec les maquettes de référence

Les maquettes jointes (Simplio) inspiraient un ton apaisant et des cartes colorées. Klerio reprend ces principes mais s'en distingue par :
- une palette sable/vert profond/orange, plus sobre ;
- une navigation plus courte (9 entrées) ;
- un vocabulaire de marque propre (« la paperasse, en clair ») ;
- des écrans de quota et de paiement plus explicites, conformes au brief.
