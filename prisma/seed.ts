import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import bcrypt from "bcryptjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { encryptFile } from "../src/lib/security/crypto";
import { OFFICIAL_LINKS } from "../src/lib/official-links-data";
import { CATEGORY_CATALOG } from "../src/lib/categories";
import { PLANS, type PlanId, type QuotaType } from "../src/lib/quota/plans";
import { windowFor } from "../src/lib/quota/periods";

const db = new PrismaClient();
const PASSWORD = "Klerio2026!";
const GB = 1024 ** 3;
const STORAGE_ROOT = path.resolve(process.cwd(), "storage");

function dayOf(date: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", day: "numeric" }).format(date));
}

async function makePdf(title: string, lines: string[]): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawText("RÉPUBLIQUE FRANÇAISE — document de démonstration", {
    x: 50,
    y: 790,
    size: 9,
    font,
    color: rgb(0.4, 0.45, 0.55)
  });
  page.drawText(title, { x: 50, y: 748, size: 18, font: bold, color: rgb(0.1, 0.15, 0.25) });
  page.drawLine({ start: { x: 50, y: 730 }, end: { x: 545, y: 730 }, thickness: 1, color: rgb(0.8, 0.83, 0.88) });
  let y = 700;
  for (const line of lines) {
    const wrapped = line.match(/.{1,85}(\s|$)/g) ?? [line];
    for (const part of wrapped) {
      page.drawText(part.trim(), { x: 50, y, size: 11, font, color: rgb(0.15, 0.18, 0.25) });
      y -= 18;
    }
    y -= 6;
  }
  page.drawText("Document fictif généré pour la démonstration Klerio.", {
    x: 50,
    y: 55,
    size: 9,
    font,
    color: rgb(0.5, 0.55, 0.6)
  });
  return Buffer.from(await pdf.save());
}

async function createDemoDocument(input: {
  userId: string;
  groupId: string | null;
  categorySlug: string;
  title: string;
  lines: string[];
  dueInDays?: number;
  visibility?: "private" | "family";
  tags?: string[];
  ocrText?: string;
}) {
  const exists = await db.document.findFirst({ where: { ownerId: input.userId, title: input.title } });
  if (exists) return { id: exists.id, sizeBytes: exists.sizeBytes };

  const bytes = await makePdf(input.title, input.lines);
  const encrypted = encryptFile(bytes);
  const key = `documents/seed/${randomUUID()}.bin`;
  const full = path.resolve(STORAGE_ROOT, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, encrypted.ciphertext, { mode: 0o600 });
  const category = await db.category.findFirst({ where: { slug: input.categorySlug, ownerId: null } });
  const dueDate = input.dueInDays !== undefined ? new Date(Date.now() + input.dueInDays * 86400000) : null;

  const doc = await db.document.create({
    data: {
      ownerId: input.userId,
      groupId: input.groupId,
      categoryId: category?.id ?? null,
      title: input.title,
      originalName: `${input.title.replace(/[^\w-]+/g, "_")}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: bytes.length,
      pageCount: 1,
      storageKey: key,
      wrappedKey: encrypted.wrappedKey,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      tags: JSON.stringify(input.tags ?? []),
      visibility: input.visibility ?? "private",
      dueDate,
      ocrText: input.ocrText ?? input.lines.join("\n")
    }
  });
  await db.scan.create({
    data: { userId: input.userId, documentId: doc.id, pageCount: 1, sizeBytes: bytes.length, source: "import" }
  });
  return { id: doc.id, sizeBytes: bytes.length };
}

async function ensureUser(input: {
  email: string;
  name: string;
  planId: PlanId;
  interval?: "monthly" | "yearly";
  anchorDay?: number;
}) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await db.user.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      name: input.name,
      passwordHash,
      emailVerifiedAt: new Date(),
      onboardingDone: true
    },
    update: { name: input.name, passwordHash, deletedAt: null }
  });
  const anchorDay = input.anchorDay ?? 15;
  const win = windowFor("monthly", new Date(), anchorDay);
  await db.subscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      planId: input.planId,
      billingInterval: input.interval ?? "monthly",
      status: "active",
      anchorDay,
      currentPeriodStart: win.start,
      currentPeriodEnd: win.end
    },
    update: {
      planId: input.planId,
      billingInterval: input.interval ?? "monthly",
      status: "active",
      anchorDay,
      currentPeriodStart: win.start,
      currentPeriodEnd: win.end,
      cancelAtPeriodEnd: false
    }
  });
  await db.storageAccount.upsert({
    where: { ownerType_ownerId: { ownerType: "user", ownerId: user.id } },
    create: {
      ownerType: "user",
      ownerId: user.id,
      usedBytes: 0,
      limitBytes: PLANS[input.planId].storageBytes,
      state: "normal"
    },
    update: { limitBytes: PLANS[input.planId].storageBytes }
  });
  return user;
}

async function setCounter(input: {
  ownerType: "user" | "group";
  ownerId: string;
  type: QuotaType;
  used: number;
  limit: number;
  periodicity: "lifetime" | "monthly" | "weekly";
  anchorDay: number;
}) {
  const win = windowFor(input.periodicity, new Date(), input.anchorDay);
  await db.quotaCounter.upsert({
    where: {
      ownerType_ownerId_type_periodKey: {
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        type: input.type,
        periodKey: win.key
      }
    },
    create: {
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      type: input.type,
      periodKey: win.key,
      used: input.used,
      limit: input.limit,
      periodStart: win.start,
      periodEnd: win.end
    },
    update: {}
  });
}

async function ensureWallet(ownerType: "user" | "group", ownerId: string, balance: number) {
  const wallet = await db.creditWallet.upsert({
    where: { ownerType_ownerId: { ownerType, ownerId } },
    create: { ownerType, ownerId, balance },
    update: {}
  });
  if (wallet.balance === 0 && balance > 0) {
    await db.creditWallet.update({ where: { id: wallet.id }, data: { balance } });
    await db.creditTransaction.create({
      data: { walletId: wallet.id, delta: balance, reason: "credits_demo" }
    });
  }
  return wallet;
}

async function main() {
  if (process.env.VERCEL) {
    throw new Error(
      "Le seed de démonstration est désactivé sur Vercel : il écrit des fichiers de test en local. Lancez-le depuis votre machine avec DATABASE_URL/DIRECT_URL de production si nécessaire."
    );
  }
  if (process.env.S3_BUCKET || process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "Le seed de démonstration crée des fichiers locaux. Lancez-le sans stockage objet configuré, ou créez les comptes de démonstration sans documents."
    );
  }
  console.log("→ Klerio : initialisation de la démonstration");

  for (const plan of Object.values(PLANS)) {
    await db.plan.upsert({
      where: { id: plan.id },
      create: {
        id: plan.id,
        name: plan.name,
        priceMonthly: plan.priceMonthlyCents,
        priceYearly: plan.priceYearlyCents,
        storageBytes: plan.storageBytes,
        maxMembers: plan.maxMembers,
        features: JSON.stringify(plan.features),
        sortOrder: plan.id === "standard" ? 0 : plan.id === "pro" ? 1 : 2
      },
      update: {
        name: plan.name,
        priceMonthly: plan.priceMonthlyCents,
        priceYearly: plan.priceYearlyCents,
        storageBytes: plan.storageBytes,
        maxMembers: plan.maxMembers,
        features: JSON.stringify(plan.features)
      }
    });
  }

  for (const category of CATEGORY_CATALOG) {
    const existing = await db.category.findFirst({ where: { slug: category.slug, ownerId: null } });
    if (!existing) {
      await db.category.create({
        data: { slug: category.slug, label: category.label, icon: category.icon, isSystem: true }
      });
    }
  }

  for (const link of OFFICIAL_LINKS) {
    await db.officialLink.upsert({
      where: { slug: link.slug },
      create: {
        slug: link.slug,
        label: link.label,
        url: link.url,
        domain: link.domain,
        category: link.category,
        description: link.description,
        verifiedAt: new Date(link.verifiedAt)
      },
      update: {
        label: link.label,
        url: link.url,
        domain: link.domain,
        category: link.category,
        description: link.description
      }
    });
  }

  const demo = await ensureUser({ email: "demo@klerio.fr", name: "Nadia Lefèvre", planId: "standard" });
  const pro = await ensureUser({ email: "pro@klerio.fr", name: "Samir Benali", planId: "pro" });
  const familyAdmin = await ensureUser({ email: "famille@klerio.fr", name: "Claire Martin", planId: "family" });
  const familyMember = await ensureUser({ email: "membre@klerio.fr", name: "Léo Martin", planId: "standard" });

  // Groupe famille de démonstration
  let group = await db.familyGroup.findFirst({ where: { adminId: familyAdmin.id } });
  if (!group) {
    group = await db.familyGroup.create({
      data: {
        name: "Famille Martin",
        adminId: familyAdmin.id,
        planId: "family",
        storageLimitBytes: PLANS.family.storageBytes,
        quotaPolicy: "shared"
      }
    });
  }
  await db.familyMember.upsert({
    where: { userId: familyAdmin.id },
    create: { groupId: group.id, userId: familyAdmin.id, role: "admin" },
    update: { groupId: group.id, role: "admin" }
  });
  await db.familyMember.upsert({
    where: { userId: familyMember.id },
    create: { groupId: group.id, userId: familyMember.id, role: "member", storageLimitBytes: null },
    update: { groupId: group.id, role: "member" }
  });
  await db.storageAccount.upsert({
    where: { ownerType_ownerId: { ownerType: "group", ownerId: group.id } },
    create: {
      ownerType: "group",
      ownerId: group.id,
      usedBytes: 0,
      limitBytes: PLANS.family.storageBytes,
      state: "normal"
    },
    update: { limitBytes: PLANS.family.storageBytes }
  });

  // Quotas de démonstration (uniquement créés s'ils n'existent pas)
  await setCounter({ ownerType: "user", ownerId: demo.id, type: "scan_pages", used: 6, limit: 20, periodicity: "lifetime", anchorDay: 15 });
  await setCounter({ ownerType: "user", ownerId: demo.id, type: "deep_analysis_pages", used: 1, limit: 20, periodicity: "monthly", anchorDay: 15 });
  await setCounter({ ownerType: "user", ownerId: demo.id, type: "explanations", used: 3, limit: 10, periodicity: "monthly", anchorDay: 15 });
  await setCounter({ ownerType: "user", ownerId: demo.id, type: "email_generations", used: 0, limit: 3, periodicity: "weekly", anchorDay: 15 });

  await setCounter({ ownerType: "user", ownerId: pro.id, type: "scan_pages", used: 37, limit: 100, periodicity: "monthly", anchorDay: 15 });
  await setCounter({ ownerType: "user", ownerId: pro.id, type: "deep_analysis_pages", used: 4, limit: 100, periodicity: "monthly", anchorDay: 15 });
  await setCounter({ ownerType: "user", ownerId: pro.id, type: "explanations", used: 23, limit: 300, periodicity: "monthly", anchorDay: 15 });
  await setCounter({ ownerType: "user", ownerId: pro.id, type: "email_generations", used: 6, limit: 30, periodicity: "weekly", anchorDay: 15 });
  await setCounter({ ownerType: "user", ownerId: pro.id, type: "assisted_fills", used: 2, limit: 20, periodicity: "monthly", anchorDay: 15 });
  await setCounter({ ownerType: "user", ownerId: pro.id, type: "ai_sorting", used: 18, limit: 500, periodicity: "monthly", anchorDay: 15 });

  await setCounter({ ownerType: "user", ownerId: familyAdmin.id, type: "scan_pages", used: 20, limit: 100, periodicity: "monthly", anchorDay: 15 });
  await setCounter({ ownerType: "user", ownerId: familyMember.id, type: "scan_pages", used: 12, limit: 100, periodicity: "monthly", anchorDay: 15 });
  await setCounter({ ownerType: "group", ownerId: group.id, type: "deep_analysis_pages", used: 8, limit: 500, periodicity: "monthly", anchorDay: 15 });
  await setCounter({ ownerType: "group", ownerId: group.id, type: "explanations", used: 95, limit: 1000, periodicity: "monthly", anchorDay: 15 });
  await setCounter({ ownerType: "group", ownerId: group.id, type: "email_generations", used: 3, limit: 60, periodicity: "weekly", anchorDay: 15 });
  await setCounter({ ownerType: "group", ownerId: group.id, type: "assisted_fills", used: 1, limit: 100, periodicity: "monthly", anchorDay: 15 });
  await setCounter({ ownerType: "group", ownerId: group.id, type: "ai_sorting", used: 14, limit: 1500, periodicity: "monthly", anchorDay: 15 });

  // Documents de démonstration
  const demoDoc1 = await createDemoDocument({
    userId: demo.id,
    groupId: null,
    categorySlug: "impots",
    title: "Avis d'imposition 2025",
    lines: [
      "Madame, Monsieur,",
      "Après vérification de votre situation fiscale, nous vous informons que votre avis d'imposition 2025 est disponible.",
      "Montant à payer : 0,00 €",
      "Date limite de réponse : 15 décembre 2026.",
      "Vous pouvez consulter votre situation sur impots.gouv.fr."
    ],
    dueInDays: 48,
    tags: ["impôts", "2025"],
    ocrText: "Avis d'imposition 2025. Montant à payer : 0,00 €. Date limite de réponse : 15 décembre 2026. Consultez impots.gouv.fr."
  });
  await createDemoDocument({
    userId: demo.id,
    groupId: null,
    categorySlug: "sante",
    title: "Attestation de droits Ameli",
    lines: [
      "Votre attestation de droits à l'assurance maladie est valable jusqu'au 31 décembre 2026.",
      "Elle confirme votre prise en charge à 100 % au titre de la affection de longue durée.",
      "Pour toute question, connectez-vous à ameli.fr."
    ]
  });

  const proDoc1 = await createDemoDocument({
    userId: pro.id,
    groupId: null,
    categorySlug: "banque",
    title: "Offre de prêt immobilier",
    lines: [
      "Madame, Monsieur,",
      "Nous avons le plaisir de vous adresser l'offre de prêt immobilier pour votre projet au 14 rue de l'Espérance.",
      "Montant du prêt : 185 000,00 € sur 25 ans.",
      "Date limite d'acceptation : 12 novembre 2026.",
      "Ce document est un contrat complexe : faites-vous accompagner avant signature."
    ],
    dueInDays: 15,
    tags: ["prêt", "banque"],
    ocrText: "Offre de prêt immobilier. Montant 185 000,00 € sur 25 ans. Date limite d'acceptation 12 novembre 2026."
  });
  await createDemoDocument({
    userId: pro.id,
    groupId: null,
    categorySlug: "impots",
    title: "Courrier impôts — taxe d'habitation",
    lines: [
      "Madame, Monsieur,",
      "Nous vous informons d'une démarche à effectuer concernant votre logement situé 14 rue de l'Espérance.",
      "Aucun montant n'est à payer à ce jour.",
      "Date limite : 15 décembre 2026.",
      "Rendez-vous sur impots.gouv.fr pour déclarer la situation de votre logement."
    ],
    dueInDays: 48,
    tags: ["impôts", "logement"],
    ocrText: "Démarche à effectuer concernant votre logement. Aucun montant à payer. Date limite 15 décembre 2026. impots.gouv.fr"
  });
  await createDemoDocument({
    userId: pro.id,
    groupId: null,
    categorySlug: "assurance",
    title: "Contrat d'assurance habitation",
    lines: [
      "Conditions générales et particulières du contrat d'assurance habitation.",
      "Les exclusions de garantie sont détaillées à l'article 12.",
      "En cas de sinistre, déclarez-le sous 5 jours ouvrés.",
      "Ce contrat contient des clauses complexes : une analyse approfondie est recommandée."
    ],
    tags: ["assurance", "contrat"],
    ocrText: "Contrat d'assurance habitation. Exclusions article 12. Déclaration de sinistre sous 5 jours ouvrés."
  });
  await createDemoDocument({
    userId: pro.id,
    groupId: null,
    categorySlug: "travail",
    title: "Attestation de salaire septembre",
    lines: [
      "Attestation de salaire pour le mois de septembre 2026.",
      "Salaire net imposable : 2 340,00 €.",
      "Employeur : Société Exemple, SIRET 123 456 789 00012.",
      "Document établi pour faire valoir vos droits."
    ],
    tags: ["salaire", "travail"]
  });

  const famDoc1 = await createDemoDocument({
    userId: familyAdmin.id,
    groupId: group.id,
    categorySlug: "famille",
    title: "Attestation de scolarité de Léo",
    lines: [
      "Le collège Jean Moulin atteste que Léo Martin est inscrit en classe de 4e pour l'année scolaire 2026-2027.",
      "Cette attestation peut être utilisée pour les démarches administratives.",
      "Fait à Paris, le 1er octobre 2026."
    ],
    visibility: "family",
    tags: ["scolarité", "enfant"],
    ocrText: "Attestation de scolarité de Léo Martin, 4e, année 2026-2027."
  });
  await createDemoDocument({
    userId: familyAdmin.id,
    groupId: group.id,
    categorySlug: "logement",
    title: "Quittance de loyer octobre",
    lines: [
      "Quittance de loyer pour la période du 1er au 31 octobre 2026.",
      "Loyer hors charges : 950,00 €. Charges : 120,00 €.",
      "Bailleur : SCI Exemple. Locataire : Claire Martin.",
      "Paiement reçu le 3 octobre 2026."
    ],
    tags: ["loyer"],
    ocrText: "Quittance de loyer octobre 2026. Loyer 950,00 €, charges 120,00 €."
  });
  const famDoc3 = await createDemoDocument({
    userId: familyMember.id,
    groupId: group.id,
    categorySlug: "travail",
    title: "Contrat de stage de Léo",
    lines: [
      "Convention de stage entre l'établissement scolaire et l'entreprise Exemple.",
      "Période : du 5 au 30 janvier 2027.",
      "L'élève est couvert par l'assurance de l'établissement.",
      "Ce document doit être signé par le représentant légal."
    ],
    tags: ["stage"],
    ocrText: "Convention de stage du 5 au 30 janvier 2027."
  });

  // Stockage utilisé
  const demoBytes = demoDoc1.sizeBytes;
  const proBytes = proDoc1.sizeBytes;
  console.log("  documents créés", { demoBytes, proBytes, famDoc: famDoc1.sizeBytes, famDoc3: famDoc3.sizeBytes });

  const allDemoDocs = await db.document.aggregate({ where: { ownerId: demo.id }, _sum: { sizeBytes: true } });
  const allProDocs = await db.document.aggregate({ where: { ownerId: pro.id }, _sum: { sizeBytes: true } });
  const allFamilyDocs = await db.document.aggregate({
    where: { groupId: group.id },
    _sum: { sizeBytes: true }
  });
  await db.storageAccount.updateMany({
    where: { ownerType: "user", ownerId: demo.id },
    data: { usedBytes: allDemoDocs._sum.sizeBytes ?? 0 }
  });
  await db.storageAccount.updateMany({
    where: { ownerType: "user", ownerId: pro.id },
    data: { usedBytes: allProDocs._sum.sizeBytes ?? 0 }
  });
  await db.storageAccount.updateMany({
    where: { ownerType: "group", ownerId: group.id },
    data: { usedBytes: allFamilyDocs._sum.sizeBytes ?? 0 }
  });

  await ensureWallet("user", pro.id, 40);
  await ensureWallet("group", group.id, 100);
  await ensureWallet("user", demo.id, 0);

  // Rappels
  const existingReminders = await db.reminder.count();
  if (existingReminders === 0) {
    await db.reminder.createMany({
      data: [
        {
          userId: demo.id,
          title: "Vérifier mon avis d'imposition",
          notes: "Ouvrir impots.gouv.fr et vérifier la situation du logement.",
          dueAt: new Date(Date.now() + 5 * 86400000),
          channels: JSON.stringify(["in_app", "email"]),
          advanceDays: JSON.stringify([1])
        },
        {
          userId: pro.id,
          title: "Répondre à l'offre de prêt",
          notes: "Relire les conditions et demander un délai si nécessaire.",
          dueAt: new Date(Date.now() + 12 * 86400000),
          channels: JSON.stringify(["in_app"]),
          advanceDays: JSON.stringify([7, 1])
        },
        {
          userId: familyAdmin.id,
          groupId: group.id,
          visibility: "family",
          title: "Signer la convention de stage de Léo",
          notes: "À faire avant le 5 janvier.",
          dueAt: new Date(Date.now() + 20 * 86400000),
          channels: JSON.stringify(["in_app"]),
          advanceDays: JSON.stringify([3])
        }
      ]
    });
  }

  await db.notification.createMany({
    data: [
      {
        userId: pro.id,
        title: "Bienvenue sur Klerio",
        body: "Votre coffre-fort est prêt. Commencez par scanner un document.",
        channel: "in_app",
        status: "sent",
        sentAt: new Date()
      }
    ]
  });

  await db.invoice.upsert({
    where: { stripeInvoiceId: "demo-invoice-pro" },
    create: {
      userId: pro.id,
      stripeInvoiceId: "demo-invoice-pro",
      number: "KLERIO-2026-0001",
      amountCents: 799,
      taxCents: 133,
      currency: "eur",
      status: "paid",
      hostedUrl: null,
      pdfUrl: null,
      createdAt: new Date(Date.now() - 15 * 86400000)
    },
    update: {}
  });

  console.log("✓ Démonstration prête");
  console.log("  demo@klerio.fr / Klerio2026!  (Standard)");
  console.log("  pro@klerio.fr / Klerio2026!   (Pro, 40 crédits)");
  console.log("  famille@klerio.fr / Klerio2026! (Pro Famille, admin)");
  console.log("  membre@klerio.fr / Klerio2026!  (membre du groupe)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
