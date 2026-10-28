import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .catch(null);

export const scamSignalSchema = z.object({
  label: z.string().max(120),
  detail: z.string().max(400).optional().default("")
});

export const scamSchema = z.object({
  score: z.number().min(0).max(100).default(0),
  level: z.enum(["low", "medium", "high"]).default("low"),
  signals: z.array(scamSignalSchema).max(10).default([]),
  recommendation: z.string().max(600).default("Restez prudent et vérifiez l'expéditeur."),
  confidence: z.number().min(0).max(1).default(0.5)
});

export const analysisSchema = z.object({
  documentType: z.string().max(120).default("Courrier administratif"),
  categorySlug: z.string().max(60).default("autre"),
  title: z.string().max(160).default("Document analysé"),
  summary: z.string().max(2000).default(""),
  keyPoints: z.array(z.string().max(400)).max(10).default([]),
  actions: z
    .array(
      z.object({
        title: z.string().max(200),
        detail: z.string().max(800).default(""),
        dueDate: isoDate.optional().default(null),
        mandatory: z.boolean().default(false)
      })
    )
    .max(10)
    .default([]),
  dates: z
    .array(
      z.object({
        label: z.string().max(120),
        date: isoDate.optional().default(null)
      })
    )
    .max(10)
    .default([]),
  amounts: z
    .array(
      z.object({
        label: z.string().max(120),
        amount: z.number().finite().default(0),
        currency: z.string().max(8).default("EUR")
      })
    )
    .max(10)
    .default([]),
  risks: z.array(z.string().max(400)).max(10).default([]),
  scam: scamSchema.default({
    score: 0,
    level: "low",
    signals: [],
    recommendation: "Restez prudent et vérifiez l'expéditeur.",
    confidence: 0.5
  }),
  officialLinkSlug: z.string().max(80).nullable().default(null),
  needsDeepAnalysis: z.boolean().default(false),
  disclaimer: z.string().max(800).default(""),
  confidence: z.number().min(0).max(1).default(0.6)
});

export const emailSchema = z.object({
  subject: z.string().max(200).default(""),
  body: z.string().max(6000).default(""),
  tone: z.string().max(60).default("courtois"),
  warnings: z.array(z.string().max(300)).max(8).default([])
});

export const translationSchema = z.object({
  detectedLanguage: z.string().max(60).default("inconnue"),
  translatedText: z.string().max(12_000).default(""),
  notes: z.array(z.string().max(300)).max(8).default([])
});

export const fillSchema = z.object({
  fields: z
    .array(
      z.object({
        key: z.string().max(80),
        label: z.string().max(160),
        value: z.string().max(400).nullable().default(null),
        question: z.string().max(300).nullable().default(null),
        confidence: z.number().min(0).max(1).default(0.5)
      })
    )
    .max(30)
    .default([]),
  missing: z.array(z.string().max(200)).max(20).default([]),
  steps: z.array(z.string().max(400)).max(15).default([]),
  officialLinkSlug: z.string().max(80).nullable().default(null),
  disclaimer: z.string().max(800).default("")
});

export const detectionSchema = z.object({
  documentType: z.string().max(120),
  categorySlug: z.string().max(60),
  needsDeepAnalysis: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(400),
  estimatedPages: z.number().int().min(1).max(200).default(1)
});

export type AnalysisResult = z.infer<typeof analysisSchema>;
export type EmailDraft = z.infer<typeof emailSchema>;
export type TranslationResult = z.infer<typeof translationSchema>;
export type FillResult = z.infer<typeof fillSchema>;
export type DetectionResult = z.infer<typeof detectionSchema>;
