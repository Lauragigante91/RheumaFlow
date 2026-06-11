/**
 * ImportMultiPdfModal.jsx
 *
 * Multi-PDF import bridge.
 * Each PDF is processed independently: extract → de-identify → detect date.
 * Produces an array of document objects, one per PDF — exactly equivalent
 * to "lettere multiple" blocks in the text import flow.
 *
 * Principio: non un parser PDF separato, non concatenazione cieca.
 * Il PDF è solo un modo diverso per produrre gli stessi input del flusso lettere.
 *
 * Props:
 *   open, onClose
 *   onMultiExtracted([{id, text, date, filename}]) — array di documenti pronti per il parser
 */

import React, { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { toast } from "sonner";
import {
  Upload, FileText, Loader2, ChevronRight, AlertTriangle,
  Calendar, ShieldCheck, X, ChevronDown, ChevronUp, Files,
} from "lucide-react";
import { extractTextFromPdf } from "../../lib/pdfLabExtractor";
import { stripDemographics } from "../../lib/pdfDeidentifier";

// ── Data detection (same logic as ImportVisitPdfModal) ───────────────────────
function detectVisitDate(cleanText) {
  const refM = cleanText.match(
    /[Dd]ata\s+e\s+ora\s+di\s+refertazione\s*:\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/
  );
  if (refM) {
    const [, dd, mm, yyyy] = refM;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const snippet = cleanText.slice(0, 800);
  const m = snippet.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return new Date().toISOString().slice(0, 10);
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status, error }) {
  if (status === "pending")    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">In attesa</span>;
  if (status === "processing") return <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium flex items-center gap-1"><Loader2 className="w-2.5 h-2.5 animate-spin" />Elaborazione…</span>;
  if (status === "done")       return <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium">✓ Pronto</span>;
  if (status === "error")      return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-medium" title={error}>✗ Errore</span>;
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ImportMultiPdfModal({ open, onClose, onMultiExtracted }) {
  const [items, setItems]         = useState([]); // {id, name, status, text, date, removedCount, error}
  const [dragging, setDragging]   = useState(false);
  const [expanded, setExpanded]   = useState(new Set()); // ids with expanded text preview
  const fileRef = useRef();

  const allDone   = items.length > 0 && items.every(i => i.status === "done" || i.status === "error");
  const doneCount = items.filter(i => i.status === "done").length;
  const anyProcessing = items.some(i => i.status === "processing");

  // ── Reset on close ────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    setItems([]);
    setExpanded(new Set());
    setDragging(false);
    onClose();
  }, [onClose]);

  // ── Process a single file (updates item status reactively) ────────────────
  async function processItem(itemId, file) {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, status: "processing" } : it));
    try {
      const rawText = await extractTextFromPdf(file, () => {});
      const { cleanText, removedCount } = stripDemographics(rawText);
      const date = detectVisitDate(cleanText);
      setItems(prev => prev.map(it => it.id === itemId
        ? { ...it, status: "done", text: cleanText, date, removedCount }
        : it
      ));
    } catch (e) {
      setItems(prev => prev.map(it => it.id === itemId
        ? { ...it, status: "error", error: e?.message || "Errore estrazione" }
        : it
      ));
    }
  }

  // ── Add files (validate, create items, process sequentially) ─────────────
  const addFiles = useCallback(async (files) => {
    const validFiles = Array.from(files).filter(
      f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (!validFiles.length) {
      toast.error("Seleziona solo file PDF");
      return;
    }

    const newItems = validFiles.map(f => ({
      id: crypto.randomUUID(),
      name: f.name,
      file: f,
      status: "pending",
      text: "", date: "", removedCount: 0, error: null,
    }));

    setItems(prev => [...prev, ...newItems]);

    // Process each PDF sequentially so progress updates are visible
    for (const item of newItems) {
      await processItem(item.id, item.file);
    }
  }, []); // eslint-disable-line

  // ── Update date for a single item ─────────────────────────────────────────
  function updateDate(id, date) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, date } : it));
  }

  function updateText(id, text) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, text } : it));
  }

  function removeItem(id) {
    setItems(prev => prev.filter(it => it.id !== id));
    setExpanded(prev => { const n = new Set(prev); n.delete(id); return n; });
  }

  function toggleExpanded(id) {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  // ── Proceed — pass docs to caller ─────────────────────────────────────────
  function handleProceed() {
    const docs = items
      .filter(it => it.status === "done" && it.text.trim().length >= 10)
      .map(it => ({
        id:       it.id,
        text:     it.text,
        date:     it.date,
        filename: it.name,
      }));

    if (!docs.length) {
      toast.error("Nessun documento valido da importare (testo insufficiente)");
      return;
    }

    onMultiExtracted(docs);
    handleClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-gray-800">
            <Files className="w-5 h-5 text-indigo-500" />
            Importa più PDF
          </DialogTitle>
        </DialogHeader>

        {/* ── Upload zone ─────────────────────────────────────────────────── */}
        <div
          className={`border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-colors ${
            dragging
              ? "border-indigo-400 bg-indigo-50"
              : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
          }`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
          />
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">
              {items.length === 0 ? "Trascina qui i PDF o clicca per selezionarli" : "Aggiungi altri PDF"}
            </p>
            <p className="text-xs text-gray-400">Ogni PDF viene elaborato separatamente — mai concatenati</p>
            <div className="mt-1 flex flex-col gap-1 text-left text-xs text-gray-400 max-w-xs mx-auto">
              <span>✓ Estrazione locale — nessun dato inviato al server</span>
              <span>✓ Anagrafica rimossa automaticamente prima dell'analisi</span>
              <span>✓ Ogni PDF → un documento separato nella pipeline multi-visita</span>
            </div>
          </div>
        </div>

        {/* ── File list ───────────────────────────────────────────────────── */}
        {items.length > 0 && (
          <div className="space-y-2 mt-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Documenti ({items.length}) — {doneCount} pronti
              </p>
              {anyProcessing && (
                <span className="text-[10px] text-blue-500 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Elaborazione in corso…
                </span>
              )}
            </div>

            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
              {items.map(item => (
                <div
                  key={item.id}
                  className={`rounded-lg border p-3 space-y-2 transition-colors ${
                    item.status === "done"  ? "border-green-200 bg-green-50/40" :
                    item.status === "error" ? "border-red-200 bg-red-50/30" :
                    "border-gray-200 bg-gray-50"
                  }`}
                >
                  {/* Row: filename + status + date + actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className={`w-4 h-4 flex-shrink-0 ${
                      item.status === "done" ? "text-green-600" :
                      item.status === "error" ? "text-red-400" : "text-gray-400"
                    }`} />
                    <span className="text-xs font-medium text-gray-700 flex-1 min-w-0 truncate" title={item.name}>
                      {item.name}
                    </span>
                    <StatusBadge status={item.status} error={item.error} />

                    {item.status === "done" && (
                      <>
                        {item.removedCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center gap-0.5 flex-shrink-0">
                            <ShieldCheck className="w-2.5 h-2.5" /> {item.removedCount} rimossi
                          </span>
                        )}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <input
                            type="date"
                            value={item.date}
                            onChange={e => updateDate(item.id, e.target.value)}
                            className="border border-gray-200 rounded px-1.5 py-0.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
                            onClick={e => e.stopPropagation()}
                          />
                        </div>
                        <button
                          onClick={() => toggleExpanded(item.id)}
                          className="text-[10px] text-gray-500 hover:text-indigo-600 flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-indigo-50 flex-shrink-0"
                        >
                          Testo {expanded.has(item.id)
                            ? <ChevronUp className="w-3 h-3" />
                            : <ChevronDown className="w-3 h-3" />}
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-0.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 flex-shrink-0"
                      title="Rimuovi"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Error message */}
                  {item.status === "error" && item.error && (
                    <div className="flex items-start gap-1.5 text-xs text-red-600">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      {item.error}
                    </div>
                  )}

                  {/* Expanded text preview */}
                  {item.status === "done" && expanded.has(item.id) && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-400 font-medium">
                        Testo de-identificato ({item.text.trim().split(/\s+/).length} parole) — modificabile
                      </p>
                      <textarea
                        value={item.text}
                        onChange={e => updateText(item.id, e.target.value)}
                        rows={6}
                        className="w-full text-xs font-mono border border-gray-200 rounded-md p-2 resize-y focus:outline-none focus:ring-1 focus:ring-indigo-300 text-gray-700 bg-white"
                      />
                      {item.text.trim().length < 100 && (
                        <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded p-2">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                          Testo molto breve. Il PDF potrebbe essere un'immagine scansionata.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex justify-between items-center pt-2 border-t">
          <div className="text-xs text-gray-400">
            {allDone && doneCount > 0 && (
              <span>{doneCount} document{doneCount === 1 ? "o pronto" : "i pronti"} per l'analisi</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={anyProcessing}>
              Annulla
            </Button>
            <Button
              onClick={handleProceed}
              disabled={doneCount === 0 || anyProcessing}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <ChevronRight className="w-4 h-4 mr-2" />
              Analizza {doneCount > 0 ? `${doneCount} document${doneCount === 1 ? "o" : "i"}` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
