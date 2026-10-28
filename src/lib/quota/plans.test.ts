import { describe, expect, it } from "vitest";
import { PLANS, CREDIT_VALUE_CENTS, AUTOFILL_CREDIT_COST, formatBytes, formatPrice, storageRatio } from "./plans";

describe("catalogue des forfaits", () => {
  it("conserve les valeurs du brief", () => {
    expect(PLANS.standard.quotas.scan_pages.limit).toBe(20);
    expect(PLANS.standard.quotas.scan_pages.periodicity).toBe("lifetime");
    expect(PLANS.standard.quotas.deep_analysis_pages.limit).toBe(20);
    expect(PLANS.standard.quotas.deep_analysis_pages.periodicity).toBe("monthly");
    expect(PLANS.standard.quotas.email_generations.limit).toBe(3);
    expect(PLANS.standard.quotas.email_generations.periodicity).toBe("weekly");
    expect(PLANS.standard.priceMonthlyCents).toBe(0);
    expect(PLANS.standard.storageBytes).toBe(10 * 1024 ** 3);
    expect(PLANS.pro.priceMonthlyCents).toBe(799);
    expect(PLANS.pro.priceYearlyCents).toBe(7990);
    expect(PLANS.family.priceMonthlyCents).toBe(1299);
    expect(PLANS.family.priceYearlyCents).toBe(12990);
    expect(PLANS.family.storageBytes).toBe(50 * 1024 ** 3);
    expect(PLANS.family.maxMembers).toBe(5);
  });

  it("interdit les crédits au forfait Standard", () => {
    expect(PLANS.standard.creditsEnabled).toBe(false);
    expect(PLANS.pro.creditsEnabled).toBe(true);
    expect(PLANS.family.creditsEnabled).toBe(true);
  });

  it("garde un quota de scan individuel en famille", () => {
    expect(PLANS.family.quotas.scan_pages.perMember).toBe(true);
    expect(PLANS.family.quotas.scan_pages.scope).toBe("user");
    expect(PLANS.family.quotas.explanations.scope).toBe("group");
  });

  it("expose un barème de crédits cohérent", () => {
    expect(CREDIT_VALUE_CENTS).toBe(10);
    expect(AUTOFILL_CREDIT_COST).toBe(30);
    expect(PLANS.pro.quotas.explanations.creditUnitCost).toBe(3);
    expect(PLANS.pro.quotas.deep_analysis_pages.creditUnitCost).toBe(6);
  });

  it("formate les prix et les octets", () => {
    expect(formatPrice(0)).toBe("0 €");
    expect(formatPrice(799)).toContain("7,99");
    expect(formatBytes(10 * 1024 ** 3)).toContain("Go");
    expect(storageRatio(5, 10)).toBe(0.5);
    expect(storageRatio(20, 10)).toBe(1);
  });
});
