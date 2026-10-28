<<<<<<< HEAD
# KLERIO
=======
# Klerio — la paperasse, en clair

Application web responsive (PWA) qui aide les particuliers à **scanner, ranger, comprendre et traiter** leurs documents administratifs, sans stress et sans se faire arnaquer.

> Démonstration produit complète : les parcours, le moteur de quotas, la facturation simulée et les garde-fous sont réellement implémentés. Les pages légales sont des brouillons à faire valider par un juriste.

---

## 1. Démarrage rapide

Prérequis : **Node.js 20+** (testé avec Node 24), npm, et **PostgreSQL** (Docker fourni).

```bash
npm install
cp .env.example .env        # Windows : copy .env.example .env
docker compose up -d db     # PostgreSQL local (port 5432)
npm run setup               # génère Prisma, applique les migrations, charge la démo
npm run dev                 # http://localhost:3000
```

Le fichier `.env` de ce dépôt contient déjà des secrets **de développement** générés. Ne les réutilisez jamais en production.

> **Vercel** : la base est PostgreSQL et les documents doivent aller sur un stockage objet S3 (région UE). Voir [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). Le stockage local et SQLite ne sont plus utilisés.

### Comptes de démonstration (développement local uniquement)

| Compte | Mot de passe | Profil |
|---|---|---|
| `demo@klerio.fr` | `Klerio2026!` | Standard, quotas entamés |
| `pro@klerio.fr` | `Klerio2026!` | Pro, 40 crédits, documents et rappels |
| `famille@klerio.fr` | `Klerio2026!` | Pro Famille, administrateur |
| `membre@klerio.fr` | `Klerio2026!` | Membre du groupe famille |

### Scripts

```bash
npm run dev          # serveur de développement
npm run build        # build de production
npm run start        # serveur de production
npm test             # tests unitaires (moteur de quotas, crypto, redaction, IA locale)
npm run typecheck    # TypeScript strict
npm run db:reset     # réinitialise et recharge la démo (destructif)
npm run db:seed      # recharge les données de démonstration
```

Cron de rappels (à appeler toutes les heures) :

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders
```

Il envoie les rappels dus, les alertes anticipées, et purge la corbeille arrivée à échéance.

---

## 2. Ce qui est implémenté

### Scan → PDF
- Capture caméra (`getUserMedia`) **ou** import multi-images, avec repli sur l'appareil photo natif mobile.
- Recadrage automatique des bords blancs, redimensionnement, contraste/luminosité, assemblage A4 avec `pdf-lib` **côté client**.
- Comptage des pages affiché **avant** l'enregistrement, avec le quota restant et l'option crédits.
- Débit uniquement à la validation du PDF ; échec = aucun débit ; doublon = remboursement automatique.
- Le PDF est créé localement et reste téléchargeable même si le coffre est plein.

### Coffre-fort
- Chiffrement **enveloppe AES-256-GCM** : une clé aléatoire par fichier, chiffrée par la clé maître.
- Stockage objet S3 (région UE) en production ; repli local en développement. Adaptateur compatible AWS S3, Scaleway, OVH, MinIO, Cloudflare R2.
- Catégories système + catégories personnalisées, tags, échéances, recherche plein texte (titre, tags, texte extrait).
- Aperçu PDF/image servi uniquement à une session autorisée, export, corbeille 30 jours, suppression définitive.
- Déduplication par empreinte SHA-256 pour un même propriétaire.
- Stockage : compteur séparé, alertes 80/90/100 %, blocage des écritures à 100 %, lecture seule après downgrade, jamais de suppression automatique.

### Assistant IA
- Analyse standard et analyse approfondie, avec **type détecté et quota affiché avant consommation**.
- Détection d'arnaque : urgence artificielle, demande de paiement, données sensibles, menace, liens hors domaines officiels. Score, confiance, recommandation.
- Génération de courriers (réclamation, contestation, demande, relance) avec ton, avertissements, copie et ouverture dans la messagerie.
- Traduction **gratuite et sans quota** (FR + EN/ES/PT/AR/TR).
- Remplissage assisté (quota) et remplissage automatique (30 crédits), toujours avec récapitulatif et **sans soumission**.
- Aucune URL inventée : le modèle ne choisit qu'un `slug` dans la base `official_links`, et seuls les domaines vérifiés sont acceptés.
- Mode démonstration local sans clé Anthropic : heuristiques déterministes, aucun document n'est envoyé.

### Famille
- Jusqu'à 5 personnes, documents privés par défaut, partage explicite document par document.
- L'administrateur voit les volumes et les rappels familiaux, **jamais le contenu privé**.
- Pool de 50 Go, limite individuelle optionnelle, quotas IA partagés ou répartis à parts égales.
- Invitations nominatives signées (jeton haché, 7 jours), départ avec détachement des documents et réconciliation du stockage personnel.

### Facturation
- Standard / Pro / Pro Famille, mensuel ou annuel, prix TTC.
- Crédits 2 € à 20 € (1 crédit = 0,10 €), portefeuille et transactions séparés des quotas.
- Récapitulatif des conséquences avant changement d'offre (quotas, stockage, prorata, lecture seule).
- Stripe Checkout, Customer Portal, webhooks signés et idempotents.
- **Mode démonstration** sans Stripe : upgrade, achat de crédits et résiliation simulés, aucun débit.

### Compte, sécurité, RGPD
- Sessions opaques en base (jeton haché), cookie HttpOnly/SameSite, révocation.
- Mot de passe bcrypt (12 tours), politique de complexité, rate limiting.
- 2FA TOTP (compatible Google Authenticator), activation/désactivation, secret affiché et URI otpauth.
- Journal d'audit, consentements, export JSON complet, suppression de compte avec anonymisation et purge différée.
- Masquage des données sensibles dans les logs, en-têtes de sécurité, CSP sur les fichiers.

---

## 3. Architecture

```
src/
  app/
    (auth)/                 # connexion, inscription
    app/                    # espace privé (URL /app)
      scan/ vault/ assistant/ reminders/ family/ billing/ quota/ account/ official-links/
    family/join/            # acceptation d'invitation
    legal/[slug]/           # mentions, CGU, CGV, confidentialité (brouillons)
    api/
      ai/[action]/          # preview, analyze, email, translate, fill, classify
      documents/            # upload, téléchargement chiffré
      account/export/       # export RGPD
      stripe/               # checkout + webhook
      cron/reminders/       # rappels + purge corbeille
  components/               # UI, scanner, assistant, formulaires
  lib/
    quota/                  # moteur pur + service DB (cœur du produit)
    auth/ security/ storage/ ai/ billing/
    db.ts env.ts family.ts reminders.ts official-links*.ts
prisma/
  schema.prisma             # modèle de données
  seed.ts                   # démo complète
```

Détails : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) et [`docs/DESIGN.md`](docs/DESIGN.md).

### Choix techniques et écarts assumés

| Sujet | Choix | Pourquoi |
|---|---|---|
| Base de données | **PostgreSQL** (Vercel Postgres / Neon, Supabase, ou Docker en local) | Compatible serverless, migrations Prisma versionnées, pooler + connexion directe. |
| Stockage | **S3 compatible, région UE** en production ; local en développement | Vercel n'a pas de système de fichiers persistant. L'adaptateur S3 est sélectionné automatiquement si `S3_BUCKET` est renseigné. |
| Auth | Maison (bcrypt + sessions en base + TOTP) | Contrôle total du cycle de session, des audits et de la 2FA. OAuth Apple/Google est prévu mais non branché faute de clés. |
| IA sans clé | Moteur local déterministe | Tous les parcours restent testables ; les quotas sont réellement débités. |
| OCR | **Tesseract.js côté serveur** (`/api/ocr`) + saisie manuelle | OCR français gratuit, sans quota. Le premier appel télécharge le modèle (~15 Mo) dans `storage/ocr-cache`. |
| Push | **Web Push réel** (`web-push`, VAPID) | Abonnements par appareil, envoi depuis le cron, nettoyage des endpoints expirés. L'e-mail reste en console tant qu'aucun fournisseur n'est branché. |
| Envoi postal | Non implémenté | Décision de cadrage : e-mail généré, l'utilisateur envoie. Pas de LRAR. |
| Remplissage automatique | Prépare et guide, **ne soumet pas** | Évite tout mandat implicite et respecte « l'IA ne soumet jamais sans validation ». |

### Base de données et migrations

Le schéma Prisma cible **PostgreSQL**. En local :

```bash
docker compose up -d db
npx prisma migrate deploy      # applique prisma/migrations
npm run db:seed                # données de démonstration
```

En production, `npm run vercel-build` exécute `prisma generate`, `prisma migrate deploy`, puis `next build`. Les migrations sont versionnées dans `prisma/migrations/`.

`DATABASE_URL` peut être une URL poolée (Neon/Vercel Postgres). `DIRECT_URL` doit pointer vers la connexion **non poolée**, utilisée par les migrations.

### Variables d'environnement

Voir `.env.example` pour le détail. Les variables sont listées une par une dans [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md#variables-denvironnement).

---

## 4. Moteur de quotas

Le module `src/lib/quota/` est volontairement **pur et testable** :

- `plans.ts` : catalogue des forfaits, limites, périodicités, coûts en crédits. Source de vérité unique.
- `periods.ts` : fenêtres mensuelles (jour anniversaire), hebdomadaires (lundi 00h00 Europe/Paris), à vie. Gère les mois courts et l'heure d'été.
- `engine.ts` : décisions pures (`decideQuota`, `decideStorage`, `applyDowngrade`, `resolveQuotaOwner`).
- `service.ts` : chargement de l'état, transactions atomiques, débit inclus → crédits, remboursement, stockage, journal IA.

Règles clés :

1. **Aucun débit partiel** : si le quota inclus ne suffit pas, l'action est bloquée tant que l'utilisateur n'a pas accepté les crédits.
2. **Inclus d'abord, crédits ensuite**, jamais l'inverse.
3. **Deux compteurs distincts** : `QuotaCounter` et `CreditWallet` + `CreditTransaction`.
4. **Pas de report** des quotas mensuels/hebdomadaires ; seuls les 20 scans Standard sont à vie.
5. **Famille** : scans individuels, autres quotas en pool ou répartis ; stockage et crédits au niveau du groupe.
6. **Stockage** : normal → alerte 80 → critique 90 → plein 100 → lecture seule après downgrade (60 j), jamais de suppression.
7. **Toute décision renvoie un message français** et des alternatives (attendre, crédits, upgrade, libérer de la place).

Tests : `src/lib/quota/engine.test.ts` (20 cas, dont changements d'heure, 31 février, crédits, famille, downgrade).

---

## 5. Sécurité et conformité

- Chiffrement TLS en production + AES-256-GCM au repos, clé par fichier.
- Aucun document utilisé pour l'entraînement ; les appels IA n'envoient que le texte utile.
- Logs : masquage e-mail, téléphone, IBAN, NIR, carte.
- Rate limiting sur inscription, connexion, upload, téléchargement, IA.
- Audit des actions sensibles (connexion, documents, famille, facturation, suppression).
- Export RGPD et suppression avec anonymisation.
- Pages légales générées en **brouillon** : mentions, CGU, CGV, confidentialité. Une AIPD reste à réaliser avant lancement.

### Avant une mise en production réelle

- [ ] Faire relire les documents juridiques par un juriste.
- [ ] Réaliser l'AIPD (documents administratifs, IA, sous-traitants).
- [ ] Héberger en UE et signer les DPA (hébergeur, S3, Anthropic, Stripe, e-mail).
- [ ] Vérifier PostgreSQL (pooler + direct) et appliquer les migrations.
- [ ] Configurer le stockage S3 UE et tester upload/aperçu/suppression.
- [ ] Configurer Stripe (produits, TVA, webhook), tester les événements en mode test.
- [ ] Brancher un fournisseur e-mail réel.
- [ ] Ajouter la détection de perspective et l'analyse des PDF importés.
- [ ] Mettre en place un vrai rate limiting distribué (Redis) et un WAF.
- [ ] Sauvegardes chiffrées, tests de restauration, supervision et alertes.
- [ ] Vérifier les liens officiels et planifier leur revue.
- [ ] Tests E2E Playwright sur les parcours critiques.

---

## 6. Limites connues de cette livraison

- L'OCR (Tesseract) fonctionne, mais le premier appel télécharge le modèle de langue et peut prendre quelques dizaines de secondes. Sur Vercel, le cache va dans `/tmp` et est perdu à froid ; prévoyez un service OCR dédié pour une charge réelle.
- Vercel limite le corps des requêtes à 4,5 Mo : la limite d'upload est ramenée à **4 Mo** sur Vercel. Pour des PDF plus volumineux, branchez un upload direct S3 (presigned URL).
- La détection de perspective complète (quatre coins) n'est pas encore implémentée : le recadrage détecte la zone utile, pas la déformation.
- Les notifications push réelles nécessitent une PWA installée, un contexte HTTPS et les clés VAPID. L'e-mail écrit dans la console tant que `EMAIL_PROVIDER` reste sur `console`.
- Les OAuth Apple/Google ne sont pas branchés (pas de clés) ; l'email/mot de passe et la 2FA le sont.
- Le remplissage automatique prépare un récapitulatif mais ne soumet aucun formulaire.
- La démonstration Stripe ne débite rien ; le mode réel nécessite les identifiants de prix.
- Les PDF de démonstration sont volontairement minuscules (texte uniquement).

---

## 7. Licence

Projet de démonstration. Les marques et contenus tiers appartiennent à leurs propriétaires.
>>>>>>> a39aa7b (First version)
