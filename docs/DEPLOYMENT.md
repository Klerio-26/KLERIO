# Déploiement et exploitation

## Option A — VPS / Docker

```bash
cp .env.example .env
# renseigner les secrets, PostgreSQL, S3, Stripe, Anthropic, VAPID
docker compose up -d db
npm ci
npx prisma migrate deploy
npm run db:seed               # démo locale
npm run build && npm start
```

Ou avec l'image fournie :

```bash
docker build -t klerio .
docker run -d --name klerio -p 3000:3000 --env-file .env klerio
```

En production, configurez **S3** : le volume local ne doit servir qu'au développement. Prévoir un reverse proxy TLS.

## Option B — Vercel (PostgreSQL + S3)

1. **Créer la base** : Vercel → Storage → Marketplace → PostgreSQL (Neon) ou Supabase. Récupérer l'URL **poolée** (`DATABASE_URL`) et l'URL **directe/non poolée** (`DIRECT_URL`).
2. **Créer le stockage** : S3 AWS `eu-west-3`, Scaleway, OVH ou Cloudflare R2 (UE). Créer un bucket privé et des clés limitées à ce bucket.
3. **Variables** : les ajouter dans Project → Settings → Environment Variables (Production + Preview). Voir la liste ci-dessous.
4. **Déployer** : Vercel utilise `vercel-build`, qui exécute `prisma generate && prisma migrate deploy && next build`.
5. **Compte initial** : le seed de démonstration est désactivé sur Vercel (il écrit des fichiers locaux). Créez le premier compte via `/register`. **Ne lancez pas le seed de démonstration contre la base de production** : ses documents seraient stockés localement et resteraient inaccessibles. Les comptes de démonstration ne concernent que le développement local.
6. **Cron** : `vercel.json` déclare `/api/cron/reminders` une fois par jour (07:00 UTC, compatible Hobby). Vercel ajoute automatiquement `Authorization: Bearer $CRON_SECRET` si la variable existe. Sur Pro, vous pouvez passer à `0 * * * *` pour un envoi horaire.
7. **Région** : `vercel.json` force `cdg1` (Paris) pour rester dans l'UE.
8. **Limites** : Vercel limite le corps des requêtes à 4,5 Mo ; l'upload est plafonné à 4 Mo. Pour de gros PDF, ajoutez un upload direct S3 par presigned URL.
9. **OCR** : Tesseract écrit son modèle dans `/tmp` (perdu à froid) et peut dépasser les limites de temps sur Hobby. Pour une charge réelle, utilisez un service OCR dédié.

## Variables d'environnement

### Obligatoires

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | URL PostgreSQL poolée utilisée par Prisma à l'exécution. |
| `DIRECT_URL` | URL PostgreSQL directe (non poolée) utilisée par `prisma migrate deploy`. |
| `APP_URL` | URL publique du site, utilisée pour les liens d'invitation et les redirections Stripe (ex. `https://app.klerio.fr`). |
| `SESSION_SECRET` | Secret de signature/aléa des sessions (32+ caractères). |
| `KLERIO_MASTER_KEY` | Clé maître AES-256 (32 octets base64) qui protège les clés de fichiers du coffre. |
| `CRON_SECRET` | Secret qui protège `/api/cron/reminders` ; Vercel Cron l'envoie automatiquement. |
| `S3_REGION` | Région du bucket (doit être dans l'UE, ex. `eu-west-3`). |
| `S3_BUCKET` | Nom du bucket privé qui stocke les fichiers chiffrés. |
| `S3_ACCESS_KEY_ID` | Clé d'accès S3 limitée au bucket. |
| `S3_SECRET_ACCESS_KEY` | Secret de la clé d'accès S3. |

### Recommandées / optionnelles

| Variable | Rôle |
|---|---|
| `S3_ENDPOINT` | Endpoint S3 personnalisé (Scaleway, OVH, R2, MinIO) ; vide pour AWS. |
| `S3_FORCE_PATH_STYLE` | `true` pour les fournisseurs S3 nécessitant le path-style (MinIO, certains R2). |
| `AI_PROVIDER` | `auto` (IA si clé), `anthropic` (force) ou `mock` (démo locale). |
| `ANTHROPIC_API_KEY` | Active l'analyse, les courriers, la traduction et le remplissage via Claude. |
| `ANTHROPIC_MODEL` | Identifiant du modèle Claude utilisé. |
| `STRIPE_SECRET_KEY` | Active Stripe (Checkout, portail, factures). |
| `STRIPE_WEBHOOK_SECRET` | Vérifie la signature des webhooks Stripe. |
| `STRIPE_PRICE_PRO_MONTHLY` | Identifiant du prix Stripe Pro mensuel. |
| `STRIPE_PRICE_PRO_YEARLY` | Identifiant du prix Stripe Pro annuel. |
| `STRIPE_PRICE_FAMILY_MONTHLY` | Identifiant du prix Stripe Pro Famille mensuel. |
| `STRIPE_PRICE_FAMILY_YEARLY` | Identifiant du prix Stripe Pro Famille annuel. |
| `EMAIL_PROVIDER` | Fournisseur e-mail ; `console` en développement. |
| `EMAIL_FROM` | Expéditeur des e-mails transactionnels. |
| `DEV_ALLOW_SIMULATION` | Autorise les changements d'offre/crédits simulés ; **`false` en production**. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Clé publique VAPID pour les notifications push. |
| `VAPID_PRIVATE_KEY` | Clé privée VAPID pour envoyer les push. |
| `STORAGE_DIR` | Dossier local de développement uniquement ; inutile sur Vercel. |

> `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET` et `KLERIO_MASTER_KEY` sont lus au build et à l'exécution. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` est injectée côté client au build : la modifier impose un redéploiement.

## Cron

Appeler toutes les heures :

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://app.klerio.fr/api/cron/reminders
```

Le cron :
- envoie les rappels du jour, les alertes anticipées et les push ;
- crée les notifications in-app et e-mail ;
- fait avancer les rappels récurrents ;
- purge la corbeille arrivée à 30 jours.

Sur Vercel : `vercel.json` avec un cron quotidien (07:00 UTC), ou un service externe (cron-job.org, GitHub Actions) pour un rythme horaire. Protéger par `CRON_SECRET`.

## Stripe

1. Créer les produits/prix : Pro mensuel, Pro annuel, Famille mensuel, Famille annuel.
2. Renseigner `STRIPE_PRICE_*`.
3. Webhook : `https://app.klerio.fr/api/stripe/webhook`, événements :
   - `checkout.session.completed`
   - `customer.subscription.created|updated|deleted`
   - `invoice.paid|payment_failed`
4. Renseigner `STRIPE_WEBHOOK_SECRET`.
5. Tester avec `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
6. Vérifier la TVA, les factures et le portail client.

Le mode démonstration (`DEV_ALLOW_SIMULATION=true`) doit être **désactivé** en production.

## IA

- `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`.
- Vérifier le DPA, la non-utilisation des données pour l'entraînement et la politique de rétention.
- Surveiller les coûts : la table `AiRequest` stocke le coût estimé, les tokens et le quota débité.
- Les prompts sont versionnés dans `src/lib/ai/prompts.ts`; toute modification doit être testée sur des documents fictifs.

## Sauvegardes

- PostgreSQL : sauvegarde quotidienne chiffrée, rétention 30 jours, test de restauration mensuel.
- Stockage objet : versioning + réplication dans une seconde zone UE.
- Clé maître `KLERIO_MASTER_KEY` : conserver dans un coffre-fort de secrets, **jamais** dans le dépôt. Prévoir une procédure de rotation et de ré-chiffrement.
- Tester la restauration avant l'ouverture au public.

## Supervision

- `/api/health` : sonde de disponibilité.
- Alertes : erreurs 5xx, échecs de webhook, files de cron, taux de fallback IA, taux d'échec OCR.
- Journal d'audit : consulter les actions `account.*`, `billing.*`, `family.*`, `document.purge`.
- Rate limiting : remplacer la mémoire par Redis en multi-instances.

## Plan de lancement

1. **Bêta fermée** (20–50 personnes) : parcours scan, coffre, explication, rappels. Mesurer le taux de complétion et les erreurs OCR.
2. **Bêta famille** : invitations, confidentialité, départ d'un membre, quotas partagés.
3. **Paiement réel** en mode test puis en production, avec un panel de prix et de moyens de paiement.
4. **Ouverture** : CGU/CGV validées, AIPD signée, support et procédure de violation de données prêtes.
5. **Après lancement** : OCR de meilleure qualité, détection de perspective, envoi postal partenaire, OAuth Apple/Google.

## Checklist de mise en production

- [ ] `NODE_ENV=production`, `DEV_ALLOW_SIMULATION=false`
- [ ] `SESSION_SECRET` et `KLERIO_MASTER_KEY` générés, stockés hors dépôt
- [ ] PostgreSQL + S3 UE, DPA signés
- [ ] TLS, HSTS, sauvegardes testées
- [ ] Stripe live + webhook + TVA
- [ ] Cron horaire + supervision
- [ ] Mentions, CGU, CGV, confidentialité validées par un juriste
- [ ] AIPD et registre des traitements
- [ ] Procédure de violation de données (72 h)
- [ ] Liens officiels revus
- [ ] Tests E2E et test de charge
