import { describe, expect, it } from "vitest";
import { PLANS } from "./plans";
import { decideQuota, computeStorageState, decideStorage, applyDowngrade, resolveQuotaOwner } from "./engine";
import { weeklyWindow, monthlyWindow, partsInTimeZone, isoWeek, LIFETIME_END } from "./periods";

const pro = PLANS.pro;
const standard = PLANS.standard;
const family = PLANS.family;

describe("fenêtres de quota", () => {
  it("calcule une semaine du lundi 00h00 au lundi suivant, heure de Paris", () => {
    const now = new Date("2026-10-28T09:00:00.000Z");
    const w = weeklyWindow(now);
    expect(w.key).toBe("2026-W44");
    expect(w.start.toISOString()).toBe("2026-10-25T23:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-11-01T23:00:00.000Z");
  });

  it("gère le passage à l'heure d'été", () => {
    const w = weeklyWindow(new Date("2026-03-30T10:00:00.000Z"));
    expect(w.start.toISOString()).toBe("2026-03-29T22:00:00.000Z");
  });

  it("calcule un cycle mensuel sur le jour anniversaire", () => {
    const w = monthlyWindow(new Date("2026-10-28T12:00:00.000Z"), 15);
    const start = partsInTimeZone(w.start);
    const end = partsInTimeZone(w.end);
    expect(w.key).toBe("2026-10");
    expect([start.day, start.hour, start.month]).toEqual([15, 0, 10]);
    expect([end.day, end.hour, end.month]).toEqual([15, 0, 11]);
  });

  it("ramène le 31 au dernier jour du mois (février)", () => {
    const w = monthlyWindow(new Date("2026-03-15T12:00:00.000Z"), 31);
    const start = partsInTimeZone(w.start);
    const end = partsInTimeZone(w.end);
    expect(w.key).toBe("2026-02");
    expect([start.day, start.month]).toEqual([28, 2]);
    expect([end.day, end.month]).toEqual([31, 3]);
  });

  it("bascule sur le mois précédent avant le jour anniversaire", () => {
    const w = monthlyWindow(new Date("2026-01-10T12:00:00.000Z"), 15);
    expect(w.key).toBe("2025-12");
  });

  it("calcule les semaines ISO à cheval sur deux années", () => {
    expect(isoWeek(2026, 1, 1)).toEqual({ year: 2026, week: 1 });
    expect(isoWeek(2027, 1, 1)).toEqual({ year: 2026, week: 53 });
  });
});

describe("décision de quota inclus", () => {
  it("autorise et calcule le reste", () => {
    const d = decideQuota({
      plan: pro,
      definition: pro.quotas.scan_pages,
      usage: { used: 40, limit: 100, periodKey: "2026-10", resetAt: new Date("2026-11-15T00:00:00Z") },
      creditBalance: 0,
      quantity: 3
    });
    expect(d.allowed).toBe(true);
    expect(d.fromIncluded).toBe(3);
    expect(d.creditsCost).toBe(0);
    expect(d.includedRemainingAfter).toBe(57);
    expect(d.message).toContain("3 pages");
  });

  it("ne débite jamais partiellement sans consentement", () => {
    const d = decideQuota({
      plan: pro,
      definition: pro.quotas.scan_pages,
      usage: { used: 99, limit: 100, periodKey: "2026-10", resetAt: new Date("2026-11-15T00:00:00Z") },
      creditBalance: 50,
      quantity: 3
    });
    expect(d.allowed).toBe(false);
    expect(d.fromIncluded).toBe(0);
    expect(d.reason).toBe("credits_required");
    expect(d.alternatives.map((a) => a.code)).toContain("wait");
    expect(d.alternatives.map((a) => a.code)).toContain("credits");
  });

  it("utilise les crédits seulement avec consentement explicite", () => {
    const d = decideQuota({
      plan: pro,
      definition: pro.quotas.explanations,
      usage: { used: 299, limit: 300, periodKey: "2026-10", resetAt: new Date("2026-11-15T00:00:00Z") },
      creditBalance: 100,
      allowCredits: true,
      quantity: 3
    });
    expect(d.allowed).toBe(true);
    expect(d.fromIncluded).toBe(1);
    expect(d.fromCredits).toBe(2);
    expect(d.creditsCost).toBe(6);
    expect(d.requiresExplicitConsent).toBe(true);
    expect(d.message).toContain("6 crédits");
  });

  it("bloque si le solde de crédits est insuffisant", () => {
    const d = decideQuota({
      plan: pro,
      definition: pro.quotas.explanations,
      usage: { used: 300, limit: 300, periodKey: "2026-10", resetAt: new Date("2026-11-15T00:00:00Z") },
      creditBalance: 2,
      allowCredits: true,
      quantity: 1
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("credits_insufficient");
    expect(d.alternatives.map((a) => a.code)).toContain("buy_credits");
  });

  it("interdit le remplissage assisté au forfait Standard", () => {
    const d = decideQuota({
      plan: standard,
      definition: standard.quotas.assisted_fills,
      usage: { used: 0, limit: 0, periodKey: "2026-10", resetAt: new Date("2026-11-01T00:00:00Z") },
      creditBalance: 0,
      quantity: 1
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("quota_excluded");
    expect(d.message).toContain("Pro");
    expect(d.alternatives.some((a) => a.code === "upgrade")).toBe(true);
  });

  it("ne propose pas de crédits sur le forfait Standard", () => {
    const d = decideQuota({
      plan: standard,
      definition: standard.quotas.scan_pages,
      usage: { used: 20, limit: 20, periodKey: "lifetime", resetAt: LIFETIME_END },
      creditBalance: 0,
      quantity: 1
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("included_exhausted");
    expect(d.alternatives.map((a) => a.code)).not.toContain("credits");
    expect(d.message).toContain("jamais");
  });

  it("gère un quota familial mutualisé ou individuel", () => {
    const pooled = resolveQuotaOwner({
      planId: "family",
      definition: family.quotas.explanations,
      userId: "u1",
      groupId: "g1",
      familyPolicy: "shared"
    });
    expect(pooled).toEqual({ ownerType: "group", ownerId: "g1" });

    const perMember = resolveQuotaOwner({
      planId: "family",
      definition: family.quotas.explanations,
      userId: "u1",
      groupId: "g1",
      familyPolicy: "per_member"
    });
    expect(perMember).toEqual({ ownerType: "user", ownerId: "u1" });

    const scan = resolveQuotaOwner({
      planId: "family",
      definition: family.quotas.scan_pages,
      userId: "u1",
      groupId: "g1",
      familyPolicy: "shared"
    });
    expect(scan.ownerType).toBe("user");
  });
});

describe("stockage", () => {
  const GB = 1024 ** 3;

  it("applique les seuils 80 / 90 / 100 %", () => {
    expect(computeStorageState(7 * GB, 10 * GB)).toBe("normal");
    expect(computeStorageState(8 * GB, 10 * GB)).toBe("warning");
    expect(computeStorageState(9 * GB, 10 * GB)).toBe("critical");
    expect(computeStorageState(10 * GB, 10 * GB)).toBe("full");
  });

  it("bloque l'écriture quand le coffre est plein, sans supprimer", () => {
    const d = decideStorage({
      usedBytes: 9.9 * GB,
      limitBytes: 10 * GB,
      incomingBytes: 0.2 * GB,
      planId: "standard"
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("full");
    expect(d.alternatives.map((a) => a.code)).toContain("free_space");
    expect(d.message).toContain("restent consultables");
  });

  it("autorise avec alerte à 90 %", () => {
    const d = decideStorage({ usedBytes: 9 * GB, limitBytes: 10 * GB, incomingBytes: 0.1 * GB });
    expect(d.allowed).toBe(true);
    expect(d.state).toBe("critical");
    expect(d.message).toContain("91");
  });

  it("bloque en lecture seule après downgrade, avec délai de grâce", () => {
    const grace = new Date("2027-01-01T00:00:00Z");
    const d = decideStorage({
      usedBytes: 12 * GB,
      limitBytes: 10 * GB,
      incomingBytes: 100,
      readOnly: true,
      graceEndsAt: grace
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("read_only");
    expect(d.message).toContain("lecture seule");
  });

  it("respecte une limite individuelle fixée par l'administrateur", () => {
    const d = decideStorage({
      usedBytes: 20 * GB,
      limitBytes: 50 * GB,
      incomingBytes: 1 * GB,
      memberUsedBytes: 5 * GB,
      memberLimitBytes: 5 * GB
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("member_limit");
  });

  it("passe en lecture seule sans rien supprimer lors d'un downgrade", () => {
    const now = new Date("2026-10-28T00:00:00Z");
    const r = applyDowngrade({ usedBytes: 12 * GB, newLimitBytes: 10 * GB, now });
    expect(r.readOnly).toBe(true);
    expect(r.graceEndsAt?.toISOString()).toBe("2026-12-27T00:00:00.000Z");
    expect(r.state).toBe("read_only");
  });

  it("ne passe pas en lecture seule si les données tiennent", () => {
    const r = applyDowngrade({ usedBytes: 9 * GB, newLimitBytes: 10 * GB });
    expect(r.readOnly).toBe(false);
  });
});
