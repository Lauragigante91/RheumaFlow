/**
 * ImportVisitPdfModal.jsx
 *
 * Thin bridge: PDF → de-identificazione → testo clinico → ImportVisitFromTextModal.
 *
 * PRINCIPIO ARCHITETTURALE:
 *   Il rawText estratto dal PDF non viene MAI salvato nello stato del componente.
 *   Prima di qualsiasi operazione downstream, i dati anagrafici vengono rimossi
 *   da pdfDeidentifier.stripDemographics(). Solo il testo de-identificato
 *   viene mostrato all'utente e passato alla pipeline clinica.
 *
 *   Il collegamento al paziente avviene tramite patient_id interno, mai
 *   leggendo l'identità dal PDF.
 *
 * Props:
 *   open, onClose        — controllo dialog
 *   onTextExtracted(obj) — callback con { text, detectedDate } quando
 *                          l'utente conferma il testo de-identificato
 *
 * Props mantenute per retro-compatibilità firma (non usate):
 *   patientId, patient, onSaved, onTextImported
 */

import React, { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { toast } from "sonner";
import {
  Upload, FileText, Loader2, ChevronRight, AlertTriangle,
  Calendar, ShieldCheck,
} from "lucide-react";
import { extractTextFromPdf } from "../../lib/pdfLabExtractor";
import { stripDemographics } from "../../lib/pdfDeidentifier";

// ── Etichette sezioni cliniche (display) ─────────────────────────────────────
const SECTION_COLORS = {
  raccordo:             "bg-purple-100 text-purple-700",
  terapia_domiciliare:  "bg-indigo-100 text-indigo-700",
  esami_pregressi:      "bg-emerald-100 text-emerald-700",
  laboratorio:          "bg-emerald-100 text-emerald-700",
  anamnesi_fisiologica: "bg-sky-100 text-sky-700",
  anamnesi_familiare:   "bg-sky-100 text-sky-700",
  anamnesi_intervallare:"bg-blue-100 text-blue-700",
  visita_odierna:       "bg-blue-100 text-blue-700",
  comorbidita:          "bg-orange-100 text-orange-700",
  allergie:             "bg-rose-100 text-rose-700",
  conclusioni:          "bg-gray-100 text-gray-700",
  indicazioni:          "bg-amber-100 text-amber-700",
  ho_richiesto:         "bg-teal-100 text-teal-700",
  strumentali:          "bg-cyan-100 text-cyan-700",
};

// ── Rileva la data di visita dal testo già de-identificato ───────────────────
// Eseguito DOPO la de-identificazione per evitare di catturare la data di nascita.
// Strategia: cerca prima il pattern esplicito "Data e ora di refertazione:" (ovunque
// nel testo), poi fallback alla prima data nei primi 800 char del corpo clinico.
function detectVisitDate(cleanText) {
  // 1. Pattern esplicito "Data e ora di refertazione: DD/MM/YYYY"
  const refM = cleanText.match(
    /[Dd]ata\s+e\s+ora\s+di\s+refertazione\s*:\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/
  );
  if (refM) {
    const [, dd, mm, yyyy] = refM;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  // 2. Prima data nei primi 800 char del testo clinico
  const snippet = cleanText.slice(0, 800);
  const m = snippet.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return new Date().toISOString().slice(0, 10);
}

// ── Componente principale ─────────────────────────────────────────────────────
export default function ImportVisitPdfModal({
  open,
  onClose,
  // eslint-disable-next-line no-unused-vars
  patientId, patient, onSaved, onTextImported,
  onTextExtracted,
}) {
  const [step, setStep]               = useState("upload");
  const [loading, setLoading]         = useState(false);
  const [progress, setProgress]       = useState(0);
  // INVARIANTE: extractedText contiene SOLO testo de-identificato. Mai rawText.
  const [extractedText, setExtractedText]       = useState("");
  const [detectedDate, setDetectedDate]         = useState("");
  const [dateAutoDetected, setDateAutoDetected] = useState(false);
  const [removedCount, setRemovedCount]         = useState(0);
  const [sectionsFound, setSectionsFound]       = useState([]);
  const [dragging, setDragging]                 = useState(false);
  const fileRef = useRef();

  const reset = useCallback(() => {
    setStep("upload");
    setLoading(false);
    setProgress(0);
    setExtractedText("");
    setDetectedDate("");
    setDateAutoDetected(false);
    setRemovedCount(0);
    setSectionsFound([]);
    setDragging(false);
  }, []);

  const handleClose = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  const processFile = useCallback(async (file) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Seleziona un file PDF");
      return;
    }
    setLoading(true);
    setProgress(0);
    try {
      // 1. Estrazione testo dal PDF (locale, nessun server)
      const rawText = await extractTextFromPdf(file, (pct) => setProgress(pct));

      // 2. De-identificazione immediata — rawText non viene mai salvato nello stato
      const { cleanText, removedCount: removed, sectionsFound: sections } =
        stripDemographics(rawText);

      if (!cleanText || cleanText.trim().length < 30) {
        toast.warning(
          "Il PDF potrebbe essere un'immagine scansionata. Il testo estratto è molto breve.",
          { duration: 6000 }
        );
      }

      // ── LOG ① de-identificazione ─────────────────────────────────────────
      console.log("[PDF-IMPORT] ① stripDemographics →", {
        removed,
        sections: sections.map(s => s.key),
        textLength: cleanText.length,
        textPreview: cleanText.slice(0, 300),
      });

      // 3. Data di visita rilevata dal testo GIÀ de-identificato
      //    (evita di catturare date di nascita che erano nel testo grezzo)
      const date = detectVisitDate(cleanText);
      const autoDetected = /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}/.test(cleanText.slice(0, 800));

      // ── LOG ② data rilevata ───────────────────────────────────────────────
      console.log("[PDF-IMPORT] ② detectedDate →", date, "| autoDetected:", autoDetected);

      // 4. Salva solo il testo de-identificato
      setExtractedText(cleanText);
      setDetectedDate(date);
      setDateAutoDetected(autoDetected);
      setRemovedCount(removed);
      setSectionsFound(sections);
      setStep("preview");
    } catch (e) {
      toast.error("Errore nell'estrazione del testo dal PDF: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleProceed = useCallback(() => {
    if (!extractedText.trim()) {
      toast.error("Nessun testo da importare");
      return;
    }
    onTextExtracted?.({ text: extractedText, detectedDate });
    handleClose();
  }, [extractedText, detectedDate, onTextExtracted, handleClose]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-gray-800">
            <FileText className="w-5 h-5 text-indigo-500" />
            Importa da PDF
          </DialogTitle>
        </DialogHeader>

        {/* ── STEP 1: Upload ─────────────────────────────────────────────── */}
        {step === "upload" && (
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              dragging
                ? "border-indigo-400 bg-indigo-50"
                : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
            }`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]); }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => processFile(e.target.files[0])}
            />
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                <p className="text-sm text-gray-500">Estrazione e de-identificazione in corso…</p>
                <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-400 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload className="w-10 h-10 text-gray-300" />
                <p className="text-sm font-medium text-gray-600">Trascina qui il referto PDF</p>
                <p className="text-xs text-gray-400">oppure clicca per selezionare il file</p>
                <div className="mt-2 flex flex-col gap-1 text-left text-xs text-gray-400 max-w-xs mx-auto">
                  <span>✓ Estrazione locale — nessun dato inviato al server</span>
                  <span>✓ Anagrafica rimossa automaticamente prima dell'analisi</span>
                  <span>✓ Pipeline identica a "Importa da lettera"</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Testo de-identificato ──────────────────────────────── */}
        {step === "preview" && (
          <div className="space-y-3">

            {/* Data visita */}
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-500 font-medium">Data visita:</span>
              <input
                type="date"
                value={detectedDate}
                onChange={(e) => { setDetectedDate(e.target.value); setDateAutoDetected(false); }}
                className="border border-gray-300 rounded px-2 py-0.5 text-sm"
              />
              {dateAutoDetected && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                  ✓ rilevata dal referto
                </span>
              )}
            </div>

            {/* Banner de-identificazione */}
            <div className={`flex items-start gap-2 rounded-lg p-3 text-xs ${
              removedCount > 0
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-gray-50 border border-gray-200 text-gray-500"
            }`}>
              <ShieldCheck className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <div>
                {removedCount > 0 ? (
                  <span>
                    <strong>{removedCount}</strong> elemento/i anagrafici rimossi automaticamente
                    (nome, CF, data di nascita, email).
                    Il testo sottostante è già de-identificato.
                  </span>
                ) : (
                  <span>
                    Nessun dato anagrafico rilevato con pattern automatici.
                    Verifica manualmente il testo prima di procedere.
                  </span>
                )}
              </div>
            </div>

            {/* Sezioni cliniche riconosciute */}
            {sectionsFound.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Sezioni cliniche riconosciute
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sectionsFound.map((s) => (
                    <span
                      key={s.key}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        SECTION_COLORS[s.key] || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {s.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Textarea — mostra SOLO il testo de-identificato */}
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Testo de-identificato — modificabile prima dell'analisi
              </p>
              <textarea
                className="w-full h-64 text-xs font-mono border border-gray-200 rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700 bg-white"
                value={extractedText}
                onChange={(e) => setExtractedText(e.target.value)}
                placeholder="Testo de-identificato estratto dal PDF…"
              />
            </div>

            {/* Warning testo breve */}
            {extractedText.trim().length < 100 && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  Il testo estratto è molto breve. Il PDF potrebbe essere
                  un'immagine scansionata (OCR non supportato) o avere un
                  formato non standard.
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className="flex justify-between items-center pt-2 border-t">
          <div className="text-xs text-gray-400">
            {step === "preview" && extractedText && (
              <span>{extractedText.trim().split(/\s+/).length} parole</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Annulla
            </Button>
            {step === "upload" && !loading && (
              <Button onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                Seleziona PDF
              </Button>
            )}
            {step === "preview" && (
              <Button
                onClick={handleProceed}
                disabled={!extractedText.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <ChevronRight className="w-4 h-4 mr-2" />
                Analizza e importa
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
