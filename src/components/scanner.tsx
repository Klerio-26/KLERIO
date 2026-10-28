"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  FileText,
  ImagePlus,
  Loader2,
  RefreshCw,
  ScanLine,
  Trash2,
  UploadCloud,
  X
} from "lucide-react";
import { Alert, Badge, Card } from "@/components/ui";
import { formatBytes } from "@/lib/quota/plans";

interface Page {
  id: string;
  dataUrl: string;
  bytes: number;
  width: number;
  height: number;
  name: string;
}

interface QuotaAlternative {
  code: string;
  label: string;
  detail: string;
}

interface Decision {
  allowed: boolean;
  message: string;
  includedRemaining: number;
  includedLimit: number;
  includedUsed: number;
  creditsCost: number;
  creditBalance: number;
  alternatives: QuotaAlternative[];
}

export function Scanner({
  categories,
  scan,
  credits,
  creditsEnabled,
  isFamily,
  resetLabel,
  maxUploadBytes
}: {
  categories: Array<{ id: string; label: string }>;
  scan: { used: number; limit: number; remaining: number; periodicity: string; resetLabel: string };
  credits: number;
  creditsEnabled: boolean;
  isFamily: boolean;
  resetLabel: string;
  maxUploadBytes: number;
}) {
  const router = useRouter();
  const [pages, setPages] = useState<Page[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [allowCredits, setAllowCredits] = useState(false);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<"private" | "family">("private");
  const [ocrText, setOcrText] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const pageCount = pages.length;
  const remaining = scan.remaining;
  const neededCredits = Math.max(0, pageCount - remaining) * 1;
  const canUseCredits = creditsEnabled && credits >= neededCredits && neededCredits > 0;
  const exceeds = pageCount > remaining;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  useEffect(() => {
    if (!cameraOn) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (video && stream) {
      video.srcObject = stream;
      void video.play().catch(() => undefined);
    }
  }, [cameraOn]);

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      setCameraError("La caméra n'est pas accessible. Utilisez « Importer » ou vérifiez les autorisations.");
    }
  }

  function captureFromVideo() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    void addDataUrl(canvas.toDataURL("image/jpeg", 0.92), "Photo caméra");
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy("Préparation des images…");
    setError(null);
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        setError("Seules les images sont acceptées ici. Pour un PDF, importez-le depuis le coffre-fort.");
        continue;
      }
      try {
        const dataUrl = await readAndEnhance(file);
        await addDataUrl(dataUrl, file.name);
      } catch {
        setError(`Impossible de lire « ${file.name} ». Essayez une photo JPEG ou PNG.`);
      }
    }
    setBusy(null);
  }

  async function addDataUrl(dataUrl: string, name: string) {
    const size = Math.round((dataUrl.length * 3) / 4);
    const dimensions = await imageSize(dataUrl);
    setPages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        dataUrl,
        bytes: size,
        width: dimensions.width,
        height: dimensions.height,
        name
      }
    ]);
  }

  function removePage(id: string) {
    setPages((prev) => prev.filter((p) => p.id !== id));
  }

  function movePage(index: number, direction: -1 | 1) {
    setPages((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function runOcr() {
    if (pages.length === 0) return;
    setOcrBusy(true);
    setOcrError(null);
    setOcrStatus("Préparation du moteur OCR…");
    const parts: string[] = [];
    try {
      for (let index = 0; index < pages.length; index += 1) {
        setOcrStatus(`Lecture de la page ${index + 1} sur ${pages.length}…`);
        const blob = await (await fetch(pages[index].dataUrl)).blob();
        const form = new FormData();
        form.set("image", new File([blob], `page-${index + 1}.jpg`, { type: blob.type || "image/jpeg" }));
        const response = await fetch("/api/ocr", { method: "POST", body: form });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? "OCR indisponible.");
        const text = String(data.text ?? "").trim();
        if (text) parts.push(`--- Page ${index + 1} ---\n${text}`);
      }
      if (parts.length === 0) {
        setOcrError("Aucun texte n'a été reconnu. La photo est peut-être trop floue : reprenez-la ou saisissez le texte.");
      } else {
        setOcrText(parts.join("\n\n"));
        setOcrStatus("Texte extrait. Vérifiez-le avant l'analyse IA.");
      }
    } catch (error) {
      setOcrError(
        error instanceof Error
          ? error.message
          : "L'OCR est indisponible. Vous pouvez saisir le texte à la main."
      );
      setOcrStatus(null);
    } finally {
      setOcrBusy(false);
    }
  }

  async function buildPdf(): Promise<Blob> {
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    pdf.setTitle(title || `Scan Klerio ${new Date().toLocaleDateString("fr-FR")}`);
    pdf.setCreator("Klerio");
    pdf.setProducer("Klerio — scan et PDF");
    const A4 = { width: 595.28, height: 841.89 };
    const margin = 24;
    for (const page of pages) {
      const jpgBytes = dataUrlToBytes(page.dataUrl);
      const image = await pdf.embedJpg(jpgBytes);
      const pdfPage = pdf.addPage([A4.width, A4.height]);
      const maxW = A4.width - margin * 2;
      const maxH = A4.height - margin * 2;
      const scale = Math.min(maxW / image.width, maxH / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      pdfPage.drawImage(image, {
        x: (A4.width - w) / 2,
        y: (A4.height - h) / 2,
        width: w,
        height: h
      });
    }
    const bytes = await pdf.save();
    return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  }

  async function upload() {
    if (pages.length === 0) {
      setError("Ajoutez au moins une page.");
      return;
    }
    if (exceeds && (!allowCredits || !canUseCredits)) {
      setError("Votre quota de scan est insuffisant. Choisissez une option ci-dessous.");
      return;
    }
    setBusy("Assemblage du PDF…");
    setError(null);
    try {
      const blob = await buildPdf();
      if (blob.size > maxUploadBytes) {
        const maxMb = Math.floor(maxUploadBytes / (1024 * 1024));
        setError(
          `Le PDF fait ${formatBytes(blob.size)} et dépasse la limite de ${maxMb} Mo de cet environnement. Réduisez le nombre de pages ou la qualité des photos, puis réessayez.`
        );
        setBusy(null);
        return;
      }
      setBusy("Envoi sécurisé et chiffrement…");
      const form = new FormData();
      const safeTitle = title.trim() || `Scan du ${new Date().toLocaleDateString("fr-FR")}`;
      form.set("file", new File([blob], `${safeTitle.replace(/[^\w-]+/g, "_")}.pdf`, { type: "application/pdf" }));
      form.set("title", safeTitle);
      form.set("categoryId", categoryId);
      form.set("dueDate", dueDate);
      form.set("tags", tags);
      form.set("source", "camera");
      form.set("visibility", visibility);
      form.set("ocrText", ocrText);
      if (allowCredits) form.set("allowCredits", "1");

      const response = await fetch("/api/documents", { method: "POST", body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload.decision) {
          setDecision(payload.decision as Decision);
          setError(payload.error ?? "Quota insuffisant.");
        } else {
          setError(payload.error ?? "L'enregistrement a échoué.");
        }
        setBusy(null);
        return;
      }
      setBusy("Terminé !");
      router.push(`/app/vault/${payload.documentId}?nouveau=1`);
      router.refresh();
    } catch {
      setError("L'enregistrement a échoué. Vérifiez votre connexion et réessayez.");
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-4">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold">1. Ajoutez les pages</h2>
              <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
                Prenez une photo ou importez des images. Klerio recadre les bords et améliore la lisibilité.
              </p>
            </div>
            <Badge tone={exceeds ? "danger" : "brand"}>
              {pageCount} page{pageCount > 1 ? "s" : ""}
            </Badge>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button type="button" className="btn-primary flex-col gap-1 py-4" onClick={startCamera} disabled={Boolean(busy)}>
              <Camera className="h-6 w-6" aria-hidden="true" />
              <span>Prendre une photo</span>
            </button>
            <button type="button" className="btn-secondary flex-col gap-1 py-4" onClick={() => fileRef.current?.click()} disabled={Boolean(busy)}>
              <ImagePlus className="h-6 w-6" aria-hidden="true" />
              <span>Importer des images</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(event) => {
                void handleFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>
          <p className="hint mt-3">
            Astuce : posez le document à plat, avec de la lumière, et cadrez les quatre coins. Jusqu'à 20 pages par
            envoi.
          </p>

          {cameraError && <Alert tone="warning" title="Caméra indisponible">{cameraError}</Alert>}

          {cameraOn && (
            <div className="mt-4 overflow-hidden rounded-xl bg-ink-950">
              <video ref={videoRef} playsInline muted className="max-h-[420px] w-full object-contain" aria-label="Aperçu caméra" />
              <div className="flex items-center justify-between gap-2 p-3">
                <button type="button" className="btn-ghost text-white hover:bg-white/10" onClick={stopCamera}>
                  <X className="h-4 w-4" aria-hidden="true" /> Fermer
                </button>
                <button type="button" className="btn-accent" onClick={captureFromVideo}>
                  <Camera className="h-4 w-4" aria-hidden="true" /> Capturer la page
                </button>
              </div>
            </div>
          )}
        </Card>

        {pages.length > 0 && (
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Pages ({pages.length})</h2>
              <span className="text-xs text-ink-500 dark:text-ink-400">
                {formatBytes(pages.reduce((sum, p) => sum + p.bytes, 0))}
              </span>
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {pages.map((page, index) => (
                <li key={page.id} className="group relative overflow-hidden rounded-xl border border-ink-200 dark:border-ink-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={page.dataUrl} alt={`Page ${index + 1}`} className="aspect-[3/4] w-full bg-ink-100 object-cover dark:bg-ink-800" />
                  <span className="absolute left-1.5 top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-ink-950/80 px-1.5 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-ink-950/75 p-1 text-white">
                    <button
                      type="button"
                      onClick={() => movePage(index, -1)}
                      disabled={index === 0}
                      className="grid h-8 w-8 place-items-center rounded disabled:opacity-30"
                      aria-label={`Déplacer la page ${index + 1} à gauche`}
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removePage(page.id)}
                      className="grid h-8 w-8 place-items-center rounded hover:bg-white/15"
                      aria-label={`Supprimer la page ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePage(index, 1)}
                      disabled={index === pages.length - 1}
                      className="grid h-8 w-8 place-items-center rounded disabled:opacity-30"
                      aria-label={`Déplacer la page ${index + 1} à droite`}
                    >
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" className="btn-secondary text-xs" onClick={runOcr} disabled={ocrBusy}>
                {ocrBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
                {ocrBusy ? "Lecture en cours…" : "Lire le texte des pages (OCR)"}
              </button>
              {ocrStatus && <span className="text-xs text-ink-500 dark:text-ink-400">{ocrStatus}</span>}
            </div>
            {ocrError && <div className="mt-2"><Alert tone="warning" title="OCR indisponible">{ocrError}</Alert></div>}
            <p className="hint mt-2">
              Le PDF final sera assemblé au format A4, dans cet ordre. L'OCR est gratuit et n'ajoute aucun quota.
            </p>
          </Card>
        )}

        <Card>
          <h2 className="font-bold">2. Décrivez le document</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label htmlFor="title" className="label">Nom du document</label>
              <input
                id="title"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex. Facture d'électricité de septembre"
                maxLength={160}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="category" className="label">Catégorie</label>
                <select id="category" className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Classer plus tard</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="dueDate" className="label">Échéance <span className="font-normal text-ink-400">(facultatif)</span></label>
                <input id="dueDate" type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label htmlFor="tags" className="label">Mots-clés <span className="font-normal text-ink-400">(facultatif)</span></label>
              <input id="tags" className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="loyer, 2026, assurance" />
            </div>
            {isFamily && (
              <label className="flex items-start gap-2.5 rounded-xl border border-ink-200 p-3 text-sm dark:border-ink-800">
                <input type="checkbox" checked={visibility === "family"} onChange={(e) => setVisibility(e.target.checked ? "family" : "private")} className="mt-0.5" />
                <span>
                  <strong>Partager avec ma famille.</strong> Par défaut, ce document reste privé. L'administrateur ne
                  peut pas le voir sans ce partage.
                </span>
              </label>
            )}
            <details className="rounded-xl border border-ink-200 p-3 dark:border-ink-800">
              <summary className="cursor-pointer text-sm font-semibold">Ajouter le texte du document (pour l'IA)</summary>
              <label htmlFor="ocrText" className="label mt-3">Texte reconnu ou recopié</label>
              <textarea
                id="ocrText"
                className="textarea"
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
                placeholder="Collez ici le texte si vous voulez que Klerio l'analyse. Sinon, vous pourrez le faire plus tard."
              />
              <p className="hint mt-1">
                Utilisez « Lire le texte des pages » ci-dessus, ou collez le texte. Il reste dans votre coffre chiffré
                et n'est jamais utilisé pour entraîner un modèle.
              </p>
            </details>
          </div>
        </Card>
      </div>

      <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card className="border-brand-200 bg-brand-50/50 dark:border-brand-900 dark:bg-brand-950/20">
          <h2 className="font-bold">3. Vérifiez le coût</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt>Pages à enregistrer</dt>
              <dd className="font-bold">{pageCount}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Quota restant</dt>
              <dd className="font-bold">{remaining} / {scan.limit}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Après envoi</dt>
              <dd className={exceeds ? "font-bold text-red-600 dark:text-red-400" : "font-bold text-brand-700 dark:text-brand-300"}>
                {Math.max(0, remaining - pageCount)} restantes
              </dd>
            </div>
          </dl>
          <p className="hint mt-2">
            {scan.periodicity === "lifetime"
              ? "Ce quota de 20 pages est cumulatif à vie : il ne se réinitialise jamais."
              : `Renouvellement ${resetLabel}.`}
          </p>

          {exceeds && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="flex items-center gap-2 font-bold">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Quota insuffisant
              </p>
              <p className="mt-1">
                Il manque {pageCount - remaining} page{pageCount - remaining > 1 ? "s" : ""}. Rien n'est débité pour
                l'instant.
              </p>
              {canUseCredits ? (
                <label className="mt-3 flex items-start gap-2">
                  <input type="checkbox" checked={allowCredits} onChange={(e) => setAllowCredits(e.target.checked)} className="mt-0.5" />
                  <span>
                    J'accepte d'utiliser <strong>{neededCredits} crédits</strong> (solde : {credits}). Aucun abonnement ne
                    sera modifié.
                  </span>
                </label>
              ) : (
                <ul className="mt-2 space-y-1 text-xs">
                  {scan.periodicity === "lifetime" ? (
                    <li>• Ce quota de 20 pages ne se réinitialise jamais : passez à Pro pour continuer.</li>
                  ) : (
                    <li>• Attendre le renouvellement ({resetLabel})</li>
                  )}
                  <li>• Passer à un forfait supérieur</li>
                  {creditsEnabled && <li>• Acheter des crédits (solde actuel : {credits})</li>}
                </ul>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4">
              <Alert tone="danger" title="Impossible de continuer">{error}</Alert>
            </div>
          )}

          {decision && (
            <div className="mt-4 space-y-2 rounded-xl border border-ink-200 bg-white p-3 text-sm dark:border-ink-700 dark:bg-ink-900">
              <p className="font-bold">Votre quota est atteint.</p>
              <p className="text-ink-600 dark:text-ink-300">{decision.message}</p>
              <div className="flex flex-wrap gap-2">
                {decision.alternatives.map((alt) => (
                  <span key={alt.code} className="chip" title={alt.detail}>
                    {alt.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            className="btn-primary mt-4 w-full"
            onClick={upload}
            disabled={Boolean(busy) || pages.length === 0 || (exceeds && !(canUseCredits && allowCredits))}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UploadCloud className="h-4 w-4" aria-hidden="true" />}
            {busy ?? "Enregistrer dans mon coffre"}
          </button>
          <p className="hint mt-2 text-center">
            Le PDF est créé sur votre appareil. Il est chiffré avant d'être stocké. Taille maximale :{" "}
            {Math.floor(maxUploadBytes / (1024 * 1024))} Mo par envoi.
          </p>
        </Card>

        <Card>
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">
              <ScanLine className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold">Le scan reste possible même à 100 % de stockage</p>
              <p className="mt-1 text-xs text-ink-600 dark:text-ink-300">
                Vous pouvez toujours créer un PDF et le télécharger localement. Seul l'enregistrement dans le coffre
                est bloqué quand il est plein.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Traitement d'image côté client                                      */
/* ------------------------------------------------------------------ */

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image illisible"));
    img.src = dataUrl;
  });
}

async function imageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  const img = await loadImage(dataUrl);
  return { width: img.width, height: img.height };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Lecture impossible"));
    reader.readAsDataURL(file);
  });
}

/**
 * Amélioration simple et honnête :
 *  - redimensionnement maximal 2000 px ;
 *  - détection de la zone utile (bords non blancs) et recadrage ;
 *  - contraste et luminosité légèrement renforcés, sans dénaturer le document.
 * La détection de perspective complète viendra avec le module de vision avancé.
 */
async function readAndEnhance(file: File): Promise<string> {
  const raw = await readFileAsDataUrl(file);
  const img = await loadImage(raw);
  const maxSide = 2000;
  const baseScale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const baseW = Math.round(img.width * baseScale);
  const baseH = Math.round(img.height * baseScale);

  const base = document.createElement("canvas");
  base.width = baseW;
  base.height = baseH;
  const baseCtx = base.getContext("2d");
  if (!baseCtx) throw new Error("Canvas indisponible");
  baseCtx.drawImage(img, 0, 0, baseW, baseH);

  let crop = { x: 0, y: 0, w: baseW, h: baseH };
  try {
    const pixels = baseCtx.getImageData(0, 0, baseW, baseH);
    const data = pixels.data;
    let minX = baseW;
    let minY = baseH;
    let maxX = 0;
    let maxY = 0;
    const threshold = 242;
    for (let y = 0; y < baseH; y += 2) {
      for (let x = 0; x < baseW; x += 2) {
        const i = (y * baseW + x) * 4;
        const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (luminance < threshold) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX > minX && maxY > minY) {
      const marginX = Math.round((maxX - minX) * 0.03);
      const marginY = Math.round((maxY - minY) * 0.03);
      const x = Math.max(0, minX - marginX);
      const y = Math.max(0, minY - marginY);
      const w = Math.min(baseW - x, maxX - minX + marginX * 2);
      const h = Math.min(baseH - y, maxY - minY + marginY * 2);
      if (w > baseW * 0.25 && h > baseH * 0.25) crop = { x, y, w, h };
    }
  } catch {
    /* getImageData peut échouer : on garde l'image entière */
  }

  const out = document.createElement("canvas");
  out.width = crop.w;
  out.height = crop.h;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");
  ctx.filter = "contrast(1.12) brightness(1.03) saturate(0.92)";
  ctx.drawImage(base, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
  return out.toDataURL("image/jpeg", 0.88);
}
