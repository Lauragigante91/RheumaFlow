/**
 * LabImportFromImageDialog
 *
 * OCR + deterministic parser — zero AI, zero server calls.
 * Flow: upload/paste image → Tesseract.js in-browser → editable OCR text
 *       → extractLabValues parser → checkbox preview → confirmed save.
 */
import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Upload, Camera, Clipboard, Loader2, X, CheckCircle2,
  AlertTriangle, ShieldCheck, RefreshCw, FlaskConical, Check, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { extractLabValues } from "../../lib/labValueExtractor";
import { extractTextFromPdf } from "../../lib/pdfLabExtractor";
import { labExamsApi } from "../../lib/api";
import ItalianDatePicker from "../shared/ItalianDatePicker";

// ── Key mapping: extractor key → DB key ──────────────────────────────────────
// After the canonical-key alignment (Fix B), most keys are identical between
// labValueExtractor.js and labPanels.js. Only keep mappings that differ.
const KEY_MAP = {
  cpk:       "ck",      // extractor uses cpk; panels/grid use ck
  uric_acid: "urato",   // extractor uses uric_acid; panels/grid use urato
};
function mapKey(k) { return KEY_MAP[k] || k; }

// ── Panel display names ───────────────────────────────────────────────────────
const PANEL_LABELS = {
  fase_acuta:    "Fase acuta (VES, PCR…)",
  emocromo:      "Emocromo",
  complemento:   "Complemento (C3, C4)",
  funzione:      "Funzione organi / chimica",
  urine:         "Urine",
  elettroforesi: "Elettroforesi",
};

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  if (!status) return null;
  if (status === "high")
    return <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">↑ ALTO</span>;
  if (status === "low")
    return <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">↓ BASSO</span>;
  return <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">✓ ok</span>;
}

// ── Main dialog ───────────────────────────────────────────────────────────────
// ── Format confirmed values as plain text (for narrative text areas) ──────────
function buildLabText(confirmed, editValues, date) {
  const byPanel = {};
  for (const r of confirmed) {
    const ev  = editValues[r.id];
    const val = parseFloat(String(ev?.value ?? "").replace(",", "."));
    if (isNaN(val)) continue;
    const unit = ev?.unit || r.unit || "";
    if (!byPanel[r.panel]) byPanel[r.panel] = [];
    byPanel[r.panel].push({ label: r.label, value: val, unit, status: r.status });
  }
  const PANEL_IT = {
    fase_acuta:    "Flogosi",
    emocromo:      "Emocromo",
    complemento:   "Complemento",
    funzione:      "Funzione d'organo",
    urine:         "Urine",
    elettroforesi: "Elettroforesi",
    autoanticorpi: "Autoanticorpi",
  };
  const dateStr = date ? ` (${date})` : "";
  return Object.entries(byPanel).map(([panel, items]) => {
    const label = PANEL_IT[panel] || panel;
    const vals  = items.map(i => {
      const flag = i.status === "high" ? " ↑" : i.status === "low" ? " ↓" : "";
      return `${i.label} ${i.value} ${i.unit}${flag}`.trim();
    }).join(", ");
    return `${label}${dateStr}: ${vals}`;
  }).join("\n");
}

export default function LabImportFromImageDialog({ open, onOpenChange, patient, onImported, onTextGenerated }) {
  const inputRef = useRef(null);
  const dropRef  = useRef(null);

  const [step, setStep]               = useState("idle"); // idle | ocr | review
  const [source, setSource]           = useState("image"); // "image" | "pdf"
  const [imageUrl, setImageUrl]       = useState(null);
  const [imageFile, setImageFile]     = useState(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrConfidence, setOcrConfidence] = useState(null);
  const [ocrText, setOcrText]         = useState("");
  const [results, setResults]         = useState([]);
  const [checked, setChecked]         = useState({});
  const [editValues, setEditValues]   = useState({});
  const [date, setDate]               = useState("");
  const [saving, setSaving]           = useState(false);
  const [dragging, setDragging]       = useState(false);

  const reset = () => {
    setStep("idle");
    setSource("image");
    setImageUrl(null);
    setImageFile(null);
    setOcrProgress(0);
    setOcrConfidence(null);
    setOcrText("");
    setResults([]);
    setChecked({});
    setEditValues({});
    setDate("");
    setSaving(false);
  };

  const handleClose = (v) => { if (!v) reset(); onOpenChange(v); };

  // ── Load file (image or PDF) ──────────────────────────────────────────────
  const loadFile = useCallback((file) => {
    if (!file) return;
    if (file.type === "application/pdf" || file.name?.toLowerCase().endsWith(".pdf")) {
      setImageFile(file);
      setImageUrl(null);
      setSource("pdf");
      setStep("idle");
    } else if (file.type.startsWith("image/")) {
      setImageFile(file);
      setImageUrl(URL.createObjectURL(file));
      setSource("image");
      setStep("idle");
    } else {
      toast.error("Seleziona un'immagine (PNG, JPG, WEBP) o un file PDF");
    }
  }, []);

  const onFilePick = (e) => {
    const f = e.target.files?.[0];
    if (f) loadFile(f);
    e.target.value = "";
  };

  // ── Clipboard paste button ────────────────────────────────────────────────
  const pasteFromClipboard = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imgType = item.types.find(t => t.startsWith("image/"));
        if (imgType) {
          const blob = await item.getType(imgType);
          loadImage(new File([blob], "clipboard.png", { type: imgType }));
          return;
        }
      }
      toast.error("Nessuna immagine negli appunti. Premi Ctrl+V dopo aver copiato uno screenshot.");
    } catch {
      toast.error("Impossibile leggere gli appunti. Usa il pulsante «Scegli file».");
    }
  };

  // ── Drag & drop ───────────────────────────────────────────────────────────
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const onDragOver  = (e) => { e.preventDefault(); setDragging(true); };
    const onDragLeave = () => setDragging(false);
    const onDrop      = (e) => {
      e.preventDefault(); setDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) loadFile(f);
    };
    el.addEventListener("dragover",  onDragOver);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop",      onDrop);
    return () => {
      el.removeEventListener("dragover",  onDragOver);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("drop",      onDrop);
    };
  }, [loadFile]);

  // ── Global Ctrl+V paste ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (step !== "idle") return;
      const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith("image/"));
      if (item) {
        const blob = item.getAsFile();
        if (blob) loadFile(blob);
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [open, step, loadFile]);

  // ── Parse OCR text with extractLabValues ──────────────────────────────────
  const parseText = useCallback((text) => {
    const extracted = extractLabValues(text);
    // Deduplicate by key — keep highest-confidence match (first found)
    const seen = new Set();
    const unique = extracted.filter(r => {
      if (seen.has(r.key)) return false;
      seen.add(r.key);
      return true;
    });
    setResults(unique);

    const initChecked = {};
    const initValues  = {};
    for (const r of unique) {
      initChecked[r.id] = true;
      const displayVal  = r.normalizedValue ?? r.value;
      const displayUnit = r.normalizedUnit  ?? r.unit;
      initValues[r.id]  = {
        value: displayVal != null ? String(displayVal) : "",
        unit:  displayUnit || "",
      };
    }
    setChecked(initChecked);
    setEditValues(initValues);
  }, []);

  // ── Run Tesseract.js OCR ──────────────────────────────────────────────────
  const runOcr = async () => {
    if (!imageFile) return;
    setStep("ocr");
    setOcrProgress(0);
    try {
      // Dynamic import so Tesseract doesn't bloat the main bundle
      const Tesseract = (await import("tesseract.js")).default;
      const { data } = await Tesseract.recognize(
        imageFile,
        "ita+eng",
        {
          logger: (m) => {
            if (m.status === "recognizing text") {
              setOcrProgress(Math.round((m.progress || 0) * 100));
            }
          },
        }
      );
      const text = data.text || "";
      const conf  = Math.round(data.confidence ?? 0);
      setOcrText(text);
      setOcrConfidence(conf);
      parseText(text);
      setDate(new Date().toISOString().slice(0, 10));
      setStep("review");

      if (conf < 60) {
        toast.warning(`OCR completato con confidenza bassa (${conf}%) — verifica i valori prima di salvare.`, { duration: 6000 });
      }
    } catch (err) {
      toast.error("OCR fallito: " + (err?.message || "errore sconosciuto"));
      setStep("idle");
    }
  };

  // ── Run PDF text extraction ───────────────────────────────────────────────
  const runPdfExtract = async () => {
    if (!imageFile) return;
    setStep("ocr");
    setOcrProgress(0);
    try {
      const text = await extractTextFromPdf(imageFile, setOcrProgress);
      setOcrText(text);
      setOcrConfidence(null); // PDF text is reliable — no OCR confidence
      parseText(text);
      setDate(new Date().toISOString().slice(0, 10));
      setStep("review");
    } catch (err) {
      toast.error("Estrazione PDF fallita: " + (err?.message || "errore sconosciuto"));
      setStep("idle");
    }
  };

  const reAnalyze = () => parseText(ocrText);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const hasSymbol   = (r) => /[<>]/.test(r.sourceText || "");
  const isLowConf   = (r) => (ocrConfidence != null && ocrConfidence < 60) || hasSymbol(r);
  const isAltered   = (r) => r.status === "high" || r.status === "low";

  const grouped = useMemo(() => {
    const g = {};
    for (const r of results) {
      if (!g[r.panel]) g[r.panel] = [];
      g[r.panel].push(r);
    }
    return g;
  }, [results]);

  const checkedCount = Object.values(checked).filter(Boolean).length;

  // ── Save confirmed values ─────────────────────────────────────────────────
  const save = async () => {
    if (!date) { toast.error("Seleziona la data del prelievo"); return; }
    const confirmed = results.filter(r => checked[r.id]);
    if (confirmed.length === 0) { toast.error("Seleziona almeno un valore da salvare"); return; }

    // Group by panel using DB-compatible keys
    const byPanel = {};
    for (const r of confirmed) {
      const ev  = editValues[r.id];
      const raw = String(ev?.value ?? "").replace(",", ".");
      const num = parseFloat(raw);
      if (isNaN(num)) continue;
      const panelKey = r.panel;
      if (!byPanel[panelKey]) byPanel[panelKey] = {};
      byPanel[panelKey][mapKey(r.key)] = { value: num, unit: ev?.unit || r.unit || "" };
    }

    setSaving(true);
    try {
      let panels = 0;
      for (const [panel, values] of Object.entries(byPanel)) {
        if (Object.keys(values).length === 0) continue;
        await labExamsApi.create({ patient_id: patient.id, date, panel, values });
        panels++;
      }
      toast.success(`Importati ${confirmed.length} valori da ${panels} pannelli`);
      if (onTextGenerated) {
        const txt = buildLabText(confirmed, editValues, date);
        if (txt) onTextGenerated(txt);
      }
      reset();
      onOpenChange(false);
      if (onImported) onImported();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore durante il salvataggio");
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading font-black tracking-tight flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#0A2540]" />
            Importa esami da foto o PDF
            <span className="ml-auto text-[10px] font-normal text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> 100% locale · no AI
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* ══ Step: idle — upload zone ══════════════════════════════════════ */}
        {step === "idle" && (
          <div className="space-y-4">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
              className="hidden"
              onChange={onFilePick}
            />

            {!imageFile ? (
              /* Drop zone */
              <div
                ref={dropRef}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                  dragging ? "border-indigo-400 bg-indigo-50" : "border-gray-300 bg-gray-50/50 hover:border-gray-400"
                }`}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="font-heading font-bold text-base mb-1">Carica uno screenshot o un PDF</p>
                <p className="text-xs text-gray-500 mb-4">
                  PNG · JPG · WEBP · PDF · trascina qui · oppure <kbd className="bg-gray-100 border border-gray-300 rounded px-1 py-0.5 text-[11px]">Ctrl+V</kbd> per incollare un'immagine
                </p>
                <div className="flex justify-center gap-2" onClick={e => e.stopPropagation()}>
                  <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                    <Upload className="w-3.5 h-3.5 mr-1.5" /> Scegli file
                  </Button>
                  <Button variant="outline" size="sm" onClick={pasteFromClipboard}>
                    <Clipboard className="w-3.5 h-3.5 mr-1.5" /> Incolla dagli appunti
                  </Button>
                </div>
                <p className="text-[10px] text-gray-400 mt-4">
                  Elaborazione locale nel browser — nessun dato (nomi, valori) inviato a server esterni
                </p>
              </div>
            ) : source === "pdf" ? (
              /* PDF preview + run button */
              <div className="space-y-3">
                <div className="flex items-center gap-4 rounded-xl border border-blue-200 bg-blue-50/50 p-5">
                  <FileText className="w-12 h-12 text-blue-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-800 truncate">{imageFile.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {(imageFile.size / 1024).toFixed(0)} KB · PDF
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); reset(); }}
                    className="ml-auto bg-white hover:bg-gray-50 border border-gray-300 rounded-full p-1.5 shadow-sm flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                </div>
                <Button
                  onClick={runPdfExtract}
                  className="w-full bg-[#0A2540] text-white hover:bg-[#051626]"
                >
                  <FlaskConical className="w-4 h-4 mr-2" /> Estrai valori dal PDF
                </Button>
                <p className="text-[10px] text-center text-gray-400">
                  Il testo viene estratto localmente — nome e cognome del paziente vengono ignorati
                </p>
              </div>
            ) : (
              /* Image preview + run button */
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 max-h-72">
                  <img src={imageUrl} alt="Referto caricato" className="w-full max-h-72 object-contain" />
                  <button
                    onClick={(e) => { e.stopPropagation(); reset(); }}
                    className="absolute top-2 right-2 bg-white/90 hover:bg-white border border-gray-300 rounded-full p-1.5 shadow-sm"
                  >
                    <X className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                </div>
                <Button
                  onClick={runOcr}
                  className="w-full bg-[#0A2540] text-white hover:bg-[#051626]"
                >
                  <FlaskConical className="w-4 h-4 mr-2" /> Avvia OCR ed estrai valori
                </Button>
                <p className="text-[10px] text-center text-gray-400">
                  Potrebbe richiedere 5–20 secondi — elaborazione locale, nessun dato inviato
                </p>
              </div>
            )}
          </div>
        )}

        {/* ══ Step: ocr — progress ═════════════════════════════════════════ */}
        {step === "ocr" && (
          <div className="py-10 flex flex-col items-center gap-4">
            {source === "image" && imageUrl && (
              <div className="rounded-xl overflow-hidden border border-gray-200 w-full max-h-40">
                <img src={imageUrl} alt="In elaborazione" className="w-full max-h-40 object-contain opacity-50" />
              </div>
            )}
            {source === "pdf" && (
              <div className="flex items-center gap-3 text-blue-600">
                <FileText className="w-8 h-8" />
                <span className="text-sm font-semibold text-gray-700 truncate max-w-xs">{imageFile?.name}</span>
              </div>
            )}
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-sm font-semibold text-gray-800">
              {source === "pdf" ? "Estrazione testo dal PDF in corso…" : "Riconoscimento testo OCR in corso…"}
            </p>
            <div className="w-full max-w-xs bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${ocrProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">{ocrProgress}% — elaborazione locale, nessun dato inviato a server esterni</p>
          </div>
        )}

        {/* ══ Step: review — OCR text + extracted values ═══════════════════ */}
        {step === "review" && (
          <div className="space-y-4">

            {/* Global OCR confidence warning — solo per immagini, non per PDF */}
            {source === "image" && ocrConfidence != null && ocrConfidence < 70 && (
              <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                <span>
                  <strong>Qualità OCR bassa ({ocrConfidence}%).</strong> Verifica attentamente ogni valore prima di salvare.
                  Per risultati migliori usa un'immagine più nitida o ad alta risoluzione.
                </span>
              </div>
            )}

            {/* Collapsible OCR text box */}
            <details className="border border-gray-200 rounded-lg overflow-hidden">
              <summary className="flex items-center gap-2 px-3 py-2 bg-gray-50 cursor-pointer select-none text-xs font-semibold text-gray-600 uppercase tracking-widest hover:bg-gray-100">
                <span className="flex-1">Testo OCR grezzo</span>
                <span className="font-normal text-gray-400 normal-case">clicca per modificare e ri-analizzare</span>
              </summary>
              <div className="p-3 space-y-2">
                <textarea
                  value={ocrText}
                  onChange={e => setOcrText(e.target.value)}
                  rows={6}
                  className="w-full text-xs font-mono border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:border-indigo-400 bg-gray-50"
                  spellCheck={false}
                  placeholder="Testo estratto dall'OCR…"
                />
                <Button variant="outline" size="sm" onClick={reAnalyze} className="text-xs gap-1.5">
                  <RefreshCw className="w-3 h-3" /> Ri-analizza testo modificato
                </Button>
              </div>
            </details>

            {/* Summary bar */}
            <div className={`flex items-center justify-between p-3 rounded-lg flex-wrap gap-2 ${
              results.length > 0 ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"
            }`}>
              <div className={`flex items-center gap-2 text-sm ${results.length > 0 ? "text-emerald-900" : "text-amber-900"}`}>
                {results.length > 0 ? (
                  <><CheckCircle2 className="w-4 h-4" />
                    <strong>{results.length}</strong> valori riconosciuti ·{" "}
                    <strong>{checkedCount}</strong> selezionati per il salvataggio
                  </>
                ) : (
                  <><AlertTriangle className="w-4 h-4" />
                    Nessun valore riconosciuto — modifica il testo OCR e ri-analizza
                  </>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => { setStep("idle"); }}>
                <X className="w-3.5 h-3.5 mr-1" /> Nuova immagine
              </Button>
            </div>

            {/* Date picker */}
            <div>
              <label className="text-xs uppercase tracking-[0.15em] text-gray-500 block mb-1 font-semibold">
                Data prelievo *
              </label>
              <ItalianDatePicker value={date} onChange={setDate} />
            </div>

            {/* ── Values list grouped by panel ─────────────────────────── */}
            {results.length > 0 && (
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-[0.12em] text-gray-500 font-semibold">
                  Valori riconosciuti — deseleziona quelli da escludere
                </p>

                {Object.entries(grouped).map(([panel, items]) => (
                  <div key={panel} className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Panel header */}
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-gray-600 flex-1">
                        {PANEL_LABELS[panel] || panel}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {items.filter(r => checked[r.id]).length} / {items.length}
                      </Badge>
                    </div>

                    {/* Value rows */}
                    <div className="divide-y divide-gray-100">
                      {items.map((r) => {
                        const ev         = editValues[r.id] || {};
                        const isChecked  = !!checked[r.id];
                        const lowConf    = isLowConf(r);
                        const altered    = isAltered(r);
                        const sym        = hasSymbol(r);
                        const hasConv    = r.normalizedValue != null && r.normalizedValue !== r.value;

                        return (
                          <div
                            key={r.id}
                            className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors ${
                              !isChecked  ? "opacity-40 bg-gray-50" :
                              sym         ? "bg-amber-50/60" :
                              lowConf     ? "bg-amber-50/40" :
                              altered     ? "bg-red-50/30" : ""
                            }`}
                          >
                            {/* Checkbox */}
                            <button
                              type="button"
                              onClick={() => setChecked(prev => ({ ...prev, [r.id]: !prev[r.id] }))}
                              className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                                isChecked ? "bg-[#0A2540] border-[#0A2540]" : "border-gray-300 bg-white"
                              }`}
                            >
                              {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                            </button>

                            {/* Label */}
                            <span className="text-xs font-semibold text-gray-800 w-32 flex-shrink-0 leading-tight">
                              {r.label}
                            </span>

                            {/* Editable value */}
                            <input
                              type="text"
                              value={ev.value ?? ""}
                              onChange={e => setEditValues(prev => ({
                                ...prev,
                                [r.id]: { ...prev[r.id], value: e.target.value },
                              }))}
                              disabled={!isChecked}
                              className="w-20 text-xs border border-gray-200 rounded px-2 py-1 text-right font-mono focus:outline-none focus:border-indigo-400 disabled:bg-gray-100 disabled:text-gray-400"
                            />

                            {/* Unit */}
                            <span className="text-[11px] text-gray-500 w-24 flex-shrink-0 truncate">
                              {ev.unit || r.unit}
                            </span>

                            {/* Badges */}
                            <div className="flex items-center gap-1 flex-wrap flex-1">
                              <StatusBadge status={r.status} />

                              {hasConv && (
                                <span className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                                  conv. da {r.unit}
                                </span>
                              )}

                              {sym && (
                                <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5" /> &lt;&gt; verificare manualmente
                                </span>
                              )}

                              {lowConf && !sym && (
                                <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5" /> controllare manualmente
                                </span>
                              )}
                            </div>

                            {/* Source snippet */}
                            <span
                              className="text-[10px] text-gray-400 max-w-[90px] truncate hidden xl:block font-mono"
                              title={`${source === "pdf" ? "PDF" : "OCR"}: «${r.sourceText}»`}
                            >
                              «{r.sourceText}»
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer actions */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <Button variant="outline" onClick={reset}>
                <X className="w-4 h-4 mr-1.5" /> Ricomincia
              </Button>
              <Button
                onClick={save}
                disabled={saving || checkedCount === 0}
                className="bg-[#0A2540] text-white hover:bg-[#051626]"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvataggio…</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4 mr-2" /> Salva {checkedCount} valori confermati</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
