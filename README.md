<<<<<<< HEAD
# KLERIO
=======
# Klerio â€” la paperasse, en clair

Application web responsive (PWA) qui aide les particuliers Ã  **scanner, ranger, comprendre et traiter** leurs documents administratifs, sans stress et sans se faire arnaquer.

> DÃ©monstration produit complÃ¨te : les parcours, le moteur de quotas, la facturation simulÃ©e et les garde-fous sont rÃ©ellement implÃ©mentÃ©s. Les pages lÃ©gales sont des brouillons Ã  faire valider par un juriste.

---

## 1. DÃ©marrage rapide

PrÃ©requis : **Node.js 20+** (testÃ© avec Node 24), npm, et **PostgreSQL** (Docker fourni).

```bash
npm install
cp .env.example .env        # Windows : copy .env.example .env
docker compose up -d db     # PostgreSQL local (port 5432)
npm run setup               # gÃ©nÃ¨re Prisma, applique les migrations, charge la dÃ©mo
npm run dev                 # http://localhost:3000
```

Le fichier `.env` de ce dÃ©pÃ´t contient dÃ©jÃ  des secrets **de dÃ©veloppement** gÃ©nÃ©rÃ©s. Ne les rÃ©utilisez jamais en production.

> **Vercel** : la base est PostgreSQL et les documents doivent aller sur un stockage objet S3 (rÃ©gion UE). Voir [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). Le stockage local et SQLite ne sont plus utilisÃ©s.

### Comptes de dÃ©monstration (dÃ©veloppement local uniquement)

| Compte | Mot de passe | Profil |
|---|---|---|
| `demo@klerio.fr` | `Klerio2026!` | Standard, quotas entamÃ©s |
| `pro@klerio.fr` | `Klerio2026!` | Pro, 40 crÃ©dits, documents et rappels |
| `famille@klerio.fr` | `Klerio2026!` | Pro Famille, administrateur |
| `membre@klerio.fr` | `Klerio2026!` | Membre du groupe famille |

### Scripts

```bash
npm run dev          # serveur de dÃ©veloppement
npm run build        # build de production
npm run start        # serveur de production
npm test             # tests unitaires (moteur de quotas, crypto, redaction, IA locale)
npm run typecheck    # TypeScript strict
npm run db:reset     # rÃ©initialise et recharge la dÃ©mo (destructif)
npm run db:seed      # recharge les donnÃ©es de dÃ©monstration
```

Cron de rappels (Ã  appeler toutes les heures) :

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders
```

Il envoie les rappels dus, les alertes anticipÃ©es, et purge la corbeille arrivÃ©e Ã  Ã©chÃ©ance.

---

## 2. Ce qui est implÃ©mentÃ©

### Scan â†’ PDF
- Capture camÃ©ra (`getUserMedia`) **ou** import multi-images, avec repli sur l'appareil photo natif mobile.
- Recadrage automatique des bords blancs, redimensionnement, contraste/luminositÃ©, assemblage A4 avec `pdf-lib` **cÃ´tÃ© client**.
- Comptage des pages affichÃ© **avant** l'enregistrement, avec le quota restant et l'option crÃ©dits.
- DÃ©bit uniquement Ã  la validation du PDF ; Ã©chec = aucun dÃ©bit ; doublon = remboursement automatique.
- Le PDF est crÃ©Ã© localement et reste tÃ©lÃ©chargeable mÃªme si le coffre est plein.

### Coffre-fort
- Chiffrement **enveloppe AES-256-GCM** : une clÃ© alÃ©atoire par fichier, chiffrÃ©e par la clÃ© maÃ®tre.
- Stockage objet Vercel Blob privÃ© (rÃ©gion `fra1`) ou S3 compatible UE en production ; repli local en dÃ©veloppement.
- CatÃ©gories systÃ¨me + catÃ©gories personnalisÃ©es, tags, Ã©chÃ©ances, recherche plein texte (titre, tags, texte extrait).
- AperÃ§u PDF/image servi uniquement Ã  une session autorisÃ©e, export, corbeille 30 jours, suppression dÃ©finitive.
- DÃ©duplication par empreinte SHA-256 pour un mÃªme propriÃ©taire.
- Stockage : compteur sÃ©parÃ©, alertes 80/90/100 %, blocage des Ã©critures Ã  100 %, lecture seule aprÃ¨s downgrade, jamais de suppression automatique.

### Assistant IA
- Analyse standard et analyse approfondie, avec **type dÃ©tectÃ© et quota affichÃ© avant consommation**.
- DÃ©tection d'arnaque : urgence artificielle, demande de paiement, donnÃ©es sensibles, menace, liens hors domaines officiels. Score, confiance, recommandation.
- GÃ©nÃ©ration de courriers (rÃ©clamation, contestation, demande, relance) avec ton, avertissements, copie et ouverture dans la messagerie.
- Traduction **gratuite et sans quota** (FR + EN/ES/PT/AR/TR).
- Remplissage assistÃ© (quota) et remplissage automatique (30 crÃ©dits), toujours avec rÃ©capitulatif et **sans soumission**.
- Aucune URL inventÃ©e : le modÃ¨le ne choisit qu'un `slug` dans la base `official_links`, et seuls les domaines vÃ©rifiÃ©s sont acceptÃ©s.
- Mode dÃ©monstration local sans clÃ© Anthropic : heuristiques dÃ©terministes, aucun document n'est envoyÃ©.

### Famille
- Jusqu'Ã  5 personnes, documents privÃ©s par dÃ©faut, partage explicite document par document.
- L'administrateur voit les volumes et les rappels familiaux, **jamais le contenu privÃ©**.
- Pool de 50 Go, limite individuelle optionnelle, quotas IA partagÃ©s ou rÃ©partis Ã  parts Ã©gales.
- Invitations nominatives signÃ©es (jeton hachÃ©, 7 jours), dÃ©part avec dÃ©tachement des documents et rÃ©conciliation du stockage personnel.

### Facturation
- Standard / Pro / Pro Famille, mensuel ou annuel, prix TTC.
- CrÃ©dits 2 â‚¬ Ã  20 â‚¬ (1 crÃ©dit = 0,10 â‚¬), portefeuille et transactions sÃ©parÃ©s des quotas.
- RÃ©capitulatif des consÃ©quences avant changement d'offre (quotas, stockage, prorata, lecture seule).
- Stripe Checkout, Customer Portal, webhooks signÃ©s et idempotents.
- **Mode dÃ©monstration** sans Stripe : upgrade, achat de crÃ©dits et rÃ©siliation simulÃ©s, aucun dÃ©bit.

### Compte, sÃ©curitÃ©, RGPD
- Sessions opaques en base (jeton hachÃ©), cookie HttpOnly/SameSite, rÃ©vocation.
- Mot de passe bcrypt (12 tours), politique de complexitÃ©, rate limiting.
- 2FA TOTP (compatible Google Authenticator), activation/dÃ©sactivation, secret affichÃ© et URI otpauth.
- Journal d'audit, consentements, export JSON complet, suppression de compte avec anonymisation et purge diffÃ©rÃ©e.
- Masquage des donnÃ©es sensibles dans les logs, en-tÃªtes de sÃ©curitÃ©, CSP sur les fichiers.

---

## 3. Architecture

```
src/
  app/
    (auth)/                 # connexion, inscription
    app/                    # espace privÃ© (URL /app)
      scan/ vault/ assistant/ reminders/ family/ billing/ quota/ account/ official-links/
    family/join/            # acceptation d'invitation
    legal/[slug]/           # mentions, CGU, CGV, confidentialitÃ© (brouillons)
    api/
      ai/[action]/          # preview, analyze, email, translate, fill, classify
      documents/            # upload, tÃ©lÃ©chargement chiffrÃ©
      account/export/       # export RGPD
      stripe/               # checkout + webhook
      cron/reminders/       # rappels + purge corbeille
  components/               # UI, scanner, assistant, formulaires
  lib/
    quota/                  # moteur pur + service DB (cÅ“ur du produit)
    auth/ security/ storage/ ai/ billing/
    db.ts env.ts family.ts reminders.ts official-links*.ts
prisma/
  schema.prisma             # modÃ¨le de donnÃ©es
  seed.ts                   # dÃ©mo complÃ¨te
```

DÃ©tails : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) et [`docs/DESIGN.md`](docs/DESIGN.md).

### Choix techniques et Ã©carts assumÃ©s

| Sujet | Choix | Pourquoi |
|---|---|---|
| Base de donnÃ©es | **PostgreSQL** (Vercel Postgres / Neon, Supabase, ou Docker en local) | Compatible serverless, migrations Prisma versionnÃ©es, pooler + connexion directe. |
| Stockage | **Vercel Blob privÃ© (fra1)** ou S3 compatible UE ; local en dÃ©veloppement | Vercel n'a pas de systÃ¨me de fichiers persistant. PrioritÃ© : S3 si `S3_BUCKET`, sinon Vercel Blob si `BLOB_STORE_ID`, sinon local. |
| Auth | Maison (bcrypt + sessions en base + TOTP) | ContrÃ´le total du cycle de session, des audits et de la 2FA. OAuth Apple/Google est prÃ©vu mais non branchÃ© faute de clÃ©s. |
| IA sans clÃ© | Moteur local dÃ©terministe | Tous les parcours restent testables ; les quotas sont rÃ©ellement dÃ©bitÃ©s. |
| OCR | **Tesseract.js cÃ´tÃ© serveur** (`/api/ocr`) + saisie manuelle | OCR franÃ§ais gratuit, sans quota. Le premier appel tÃ©lÃ©charge le modÃ¨le (~15 Mo) dans `storage/ocr-cache`. |
| Push | **Web Push rÃ©el** (`web-push`, VAPID) | Abonnements par appareil, envoi depuis le cron, nettoyage des endpoints expirÃ©s. L'e-mail reste en console tant qu'aucun fournisseur n'est branchÃ©. |
| Envoi postal | Non implÃ©mentÃ© | DÃ©cision de cadrage : e-mail gÃ©nÃ©rÃ©, l'utilisateur envoie. Pas de LRAR. |
| Remplissage automatique | PrÃ©pare et guide, **ne soumet pas** | Ã‰vite tout mandat implicite et respecte Â« l'IA ne soumet jamais sans validation Â». |

### Base de donnÃ©es et migrations

Le schÃ©ma Prisma cible **PostgreSQL**. En local :

```bash
docker compose up -d db
npx prisma migrate deploy      # applique prisma/migrations
npm run db:seed                # donnÃ©es de dÃ©monstration
```

En production, `npm run vercel-build` exÃ©cute `prisma generate`, `prisma migrate deploy`, puis `next build`. Les migrations sont versionnÃ©es dans `prisma/migrations/`.

`DATABASE_URL` peut Ãªtre une URL poolÃ©e (Neon/Vercel Postgres). `DIRECT_URL` doit pointer vers la connexion **non poolÃ©e**, utilisÃ©e par les migrations.

### Variables d'environnement

Voir `.env.example` pour le dÃ©tail. Les variables sont listÃ©es une par une dans [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md#variables-denvironnement).

---

## 4. Moteur de quotas

Le module `src/lib/quota/` est volontairement **pur et testable** :

- `plans.ts` : catalogue des forfaits, limites, pÃ©riodicitÃ©s, coÃ»ts en crÃ©dits. Source de vÃ©ritÃ© unique.
- `periods.ts` : fenÃªtres mensuelles (jour anniversaire), hebdomadaires (lundi 00h00 Europe/Paris), Ã  vie. GÃ¨re les mois courts et l'heure d'Ã©tÃ©.
- `engine.ts` : dÃ©cisions pures (`decideQuota`, `decideStorage`, `applyDowngrade`, `resolveQuotaOwner`).
- `service.ts` : chargement de l'Ã©tat, transactions atomiques, dÃ©bit inclus â†’ crÃ©dits, remboursement, stockage, journal IA.

RÃ¨gles clÃ©s :

1. **Aucun dÃ©bit partiel** : si le quota inclus ne suffit pas, l'action est bloquÃ©e tant que l'utilisateur n'a pas acceptÃ© les crÃ©dits.
2. **Inclus d'abord, crÃ©dits ensuite**, jamais l'inverse.
3. **Deux compteurs distincts** : `QuotaCounter` et `CreditWallet` + `CreditTransaction`.
4. **Pas de report** des quotas mensuels/hebdomadaires ; seuls les 20 scans Standard sont Ã  vie.
5. **Famille** : scans individuels, autres quotas en pool ou rÃ©partis ; stockage et crÃ©dits au niveau du groupe.
6. **Stockage** : normal â†’ alerte 80 â†’ critique 90 â†’ plein 100 â†’ lecture seule aprÃ¨s downgrade (60 j), jamais de suppression.
7. **Toute dÃ©cision renvoie un message franÃ§ais** et des alternatives (attendre, crÃ©dits, upgrade, libÃ©rer de la place).

Tests : `src/lib/quota/engine.test.ts` (20 cas, dont changements d'heure, 31 fÃ©vrier, crÃ©dits, famille, downgrade).

---

## 5. SÃ©curitÃ© et conformitÃ©

- Chiffrement TLS en production + AES-256-GCM au repos, clÃ© par fichier.
- Aucun document utilisÃ© pour l'entraÃ®nement ; les appels IA n'envoient que le texte utile.
- Logs : masquage e-mail, tÃ©lÃ©phone, IBAN, NIR, carte.
- Rate limiting sur inscription, connexion, upload, tÃ©lÃ©chargement, IA.
- Audit des actions sensibles (connexion, documents, famille, facturation, suppression).
- Export RGPD et suppression avec anonymisation.
- Pages lÃ©gales gÃ©nÃ©rÃ©es en **brouillon** : mentions, CGU, CGV, confidentialitÃ©. Une AIPD reste Ã  rÃ©aliser avant lancement.

### Avant une mise en production rÃ©elle

- [ ] Faire relire les documents juridiques par un juriste.
- [ ] RÃ©aliser l'AIPD (documents administratifs, IA, sous-traitants).
- [ ] HÃ©berger en UE et signer les DPA (hÃ©bergeur, S3, Anthropic, Stripe, e-mail).
- [ ] VÃ©rifier PostgreSQL (pooler + direct) et appliquer les migrations.
- [ ] Configurer le stockage S3 UE et tester upload/aperÃ§u/suppression.
- [ ] Configurer Stripe (produits, TVA, webhook), tester les Ã©vÃ©nements en mode test.
- [ ] Brancher un fournisseur e-mail rÃ©el.
- [ ] Ajouter la dÃ©tection de perspective et l'analyse des PDF importÃ©s.
- [ ] Mettre en place un vrai rate limiting distribuÃ© (Redis) et un WAF.
- [ ] Sauvegardes chiffrÃ©es, tests de restauration, supervision et alertes.
- [ ] VÃ©rifier les liens officiels et planifier leur revue.
- [ ] Tests E2E Playwright sur les parcours critiques.

---

## 6. Limites connues de cette livraison

- L'OCR (Tesseract) fonctionne, mais le premier appel tÃ©lÃ©charge le modÃ¨le de langue et peut prendre quelques dizaines de secondes. Sur Vercel, le cache va dans `/tmp` et est perdu Ã  froid ; prÃ©voyez un service OCR dÃ©diÃ© pour une charge rÃ©elle.
- Vercel limite le corps des requÃªtes Ã  4,5 Mo : la limite d'upload est ramenÃ©e Ã  **4 Mo** sur Vercel. Pour des PDF plus volumineux, branchez un upload direct S3 (presigned URL).
- La dÃ©tection de perspective complÃ¨te (quatre coins) n'est pas encore implÃ©mentÃ©e : le recadrage dÃ©tecte la zone utile, pas la dÃ©formation.
- Les notifications push rÃ©elles nÃ©cessitent une PWA installÃ©e, un contexte HTTPS et les clÃ©s VAPID. L'e-mail Ã©crit dans la console tant que `EMAIL_PROVIDER` reste sur `console`.
- Les OAuth Apple/Google ne sont pas branchÃ©s (pas de clÃ©s) ; l'email/mot de passe et la 2FA le sont.
- Le remplissage automatique prÃ©pare un rÃ©capitulatif mais ne soumet aucun formulaire.
- La dÃ©monstration Stripe ne dÃ©bite rien ; le mode rÃ©el nÃ©cessite les identifiants de prix.
- Les PDF de dÃ©monstration sont volontairement minuscules (texte uniquement).

---

## 7. Licence

Projet de dÃ©monstration. Les marques et contenus tiers appartiennent Ã  leurs propriÃ©taires.
>>>>>>> a39aa7b (First version)

