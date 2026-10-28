import "server-only";
import { db } from "@/lib/db";
import { OFFICIAL_LINKS, isOfficialDomain } from "./official-links-data";

export async function getOfficialLinks() {
  return db.officialLink.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { label: "asc" }] });
}

export async function getOfficialLinkBySlug(slug: string | null | undefined) {
  if (!slug) return null;
  return db.officialLink.findFirst({ where: { slug, active: true } });
}

/** Ne fait jamais confiance à une URL produite par un modèle. */
export async function safeOfficialLink(slug: string | null | undefined) {
  const link = await getOfficialLinkBySlug(slug);
  if (!link) return null;
  try {
    const url = new URL(link.url);
    if (!isOfficialDomain(url.hostname)) return null;
    return link;
  } catch {
    return null;
  }
}

export async function seedOfficialLinks(): Promise<void> {
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
        verifiedAt: new Date(link.verifiedAt),
        active: true
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
}
