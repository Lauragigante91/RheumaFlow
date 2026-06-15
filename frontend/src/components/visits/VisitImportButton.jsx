import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Loader2, FileText, Check, AlertCircle, ScanSearch, ChevronDown, ChevronUp, ChevronRight, FileSearch, Calendar, Pencil, Trash2, Plus, RotateCcw, Layers, X } from "lucide-react";
import { toast } from "sonner";
import { patientsApi, assessmentsApi, scleroProfileApi, therapiesApi, labExamsApi, diseaseProfileApi, clinicalEventsApi } from "../../lib/api";
import { parseVisitText } from "../../lib/visitTextParser";
import { applyOneDraft } from "../../lib/importApply";
import { reconcileDrafts, ITEM_STATUS, STATUS_META, draftSummaryStats } from "../../lib/visitReconciler";
import SelectableTextBlock from "../shared/SelectableTextBlock";
import SectionReviewPanel from "./SectionReviewPanel";
import LabValueReviewPanel from "./LabValueReviewPanel";
import { LAB_REVIEW_TRUSTED_UNITS } from "../../lib/labValueExtractor";

const SAMPLE = `Visita ambulatoriale del 15/02/2026.
Paziente: Mario Rossi, 58 anni, M.
Diagnosi: Artrite reumatoide sieropositiva.
Esame: 6 articolazioni dolenti (TJC), 4 tumefatte (SJC). DAS28-CRP 4.2 (alta attività). VAS-PtGA 50/100.
Esami: VES 32, PCR 18 mg/L, RF positivo, anti-CCP positivo.
Terapia in corso: Methotrexate 15 mg/sett s.c., Acido folico 5 mg, Prednisone 5 mg/die.`;

// ── Module-level constants & helpers ─────────────────────────────────────────

const DEFAULT_SELECTED = {
  patient: true,
  assessments: true,
  therapies: true,
  lab_exams: true,
  sclero_profile: true,
  ra_profile: true,
  spa_profile: true,
  sle_profile: true,
  instrumental_findings: true,
  exam_imaging: true,
  visit_sections: true,
  requested_tests: true,
  profilo_generale: true,
  comorbidita: true,
  intolleranze: true,
  raccordo_events: true,
};

export default function VisitImportButton({ patient, onImported, open: externalOpen, onOpenChange, visitType = "follow_up", initialText, initialDate, initialMultiBlocks }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = externalOpen !== undefined;
  const open = controlled ? externalOpen : internalOpen;
  const setOpen = controlled
    ? (v) => onOpenChange?.(v)
    : setInternalOpen;
  const [text, setText] = useState("");
  // Hint data visita da PDF (usato se parseVisitText non trova la data nel testo)
  const [initialDateHint, setInitialDateHint] = useState("");
  const [step, setStep] = useState("input");
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [applying, setApplying] = useState(false);
  const [selected, setSelected] = useState(DEFAULT_SELECTED);

  // ── Multi-visit mode state ────────────────────────────────────────────────
  const [mode, setMode] = useState("single");
  const [multiBlocks, setMultiBlocks] = useState([
    { id: 1, date: "", text: "", visitType: "follow_up" },
    { id: 2, date: "", text: "", visitType: "follow_up" },
  ]);
  const [multiExtracted, setMultiExtracted] = useState([]);
  const [multiApplyProgress, setMultiApplyProgress] = useState(null);

  // Pre-fill testo (e hint data) quando il modal si apre con testo da PDF
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open && initialText) {
      setText(initialText);
      setInitialDateHint(initialDate || "");
    }
  }, [open]);

  // Pre-popola blocchi multi da PDF (quando si apre con PDF già estratti)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open && initialMultiBlocks?.length > 0) {
      setMode("multi");
      setMultiBlocks(initialMultiBlocks.map((doc, i) => ({
        id:              doc.id || Date.now() + i,
        date:            doc.date || "",
        text:            doc.text || "",
        visitType:       "follow_up",
        source_filename: doc.filename || null,
      })));
    }
  }, [open]); // eslint-disable-line

  const reset = () => {
    setText("");
    setInitialDateHint("");
    setExtracted(null);
    setLoading(false);
    setApplying(false);
    setStep("input");
    setMode("single");
    setMultiBlocks([{ id: 1, date: "", text: "", visitType: "follow_up" }, { id: 2, date: "", text: "", visitType: "follow_up" }]);
    setMultiExtracted([]);
    setMultiApplyProgress(null);
  };

  const close = () => {
    setOpen(false);
    setTimeout(reset, 200);
  };

  // ── Editable draft builder ───────────────────────────────────────────────────
  function buildEditableDraft(ext) {
    if (!ext) return null;
    const stamp = (arr) => (arr || []).map((item, i) => ({ ...item, _id: i, _skip: false }));
    return {
      ...ext,
      therapies:             stamp(ext.therapies),
      lab_exams:             stamp(ext.lab_exams),
      lab_review_items:      (ext.lab_review_items || []).map((item, i) => ({ ...item, _id: i })),
      assessments:           stamp(ext.assessments),
      instrumental_findings: stamp(ext.instrumental_findings),
      exam_imaging:          stamp(ext.exam_imaging),
      requested_tests:       [...(ext.requested_tests || [])],
      visit_sections:        { ...(ext.visit_sections  || {}) },
      profilo_generale:      ext.profilo_generale ? { ...ext.profilo_generale } : null,
      raccordo_events:       (ext.raccordo_events || []).map((item, i) => ({ ...item, _id: item._id ?? i })),
      comorbidita:           (ext.comorbidita || []).map((item, i) => ({
        _id: i,
        _skip: false,
        text: typeof item === "string" ? item : String(item),
      })),
      intolleranze:          (ext.intolleranze || []).map((item, i) => ({
        _id: i,
        _skip: false,
        drug:   (item && item.drug)   ? item.drug   : "",
        reason: (item && item.reason) ? item.reason : "",
      })),
    };
  }

  const parse = () => {
    if (text.trim().length < 30) {
      toast.error("Inserisci almeno 30 caratteri di testo della visita");
      return;
    }
    setLoading(true);
    try {
      const res = parseVisitText(text);
      const draft = buildEditableDraft(res.extracted);
      // Se il parser ha usato RE3 (last resort, data storica) o non ha trovato la
      // data, e abbiamo un hint affidabile dai metadati PDF, lo usiamo al suo posto.
      // RE0/RE1/RE2 sono confidenti e non vengono sovrascritti dall'hint.
      const todayIso = new Date().toISOString().slice(0, 10);
      const isWeakDate = !draft.visit_date || draft.visit_date === todayIso || res._dateSource === "RE3";
      if (initialDateHint && isWeakDate) {
        const oldParserDate = draft.visit_date;
        console.log(`[DATE OVERRIDE] parser=${oldParserDate} (source=${res._dateSource}), hint=${initialDateHint} → applico hint`);
        if (res._trace) res._trace.push(`[DATE OVERRIDE] source=${res._dateSource} → applico hint PDF`);
        draft.visit_date = initialDateHint;
      }
      // POST sanitized trace (metadata only) to backend workflow logs — dev only
      if (process.env.NODE_ENV !== "production" && res._trace?.length) {
        fetch("/api/debug/parse-trace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trace: res._trace }),
        }).catch(() => {});
      }
      setExtracted(draft);
      setStep(draft._parse_review ? "section_review" : "extracted_review");
      const raw = res.extracted;
      const total =
        (raw.assessments?.length || 0) +
        (raw.therapies?.length || 0) +
        (raw.lab_exams?.reduce((s, e) => s + (e.results?.length || 0), 0) || 0) +
        (raw.instrumental_findings?.length || 0) +
        (raw.exam_imaging?.length || 0);
      if (total === 0) {
        toast.warning("Nessun dato riconosciuto. Prova ad aggiungere score, farmaci o valori di laboratorio.");
      } else {
        toast.success(`Rilevati ${total} elementi. Verifica e conferma.`);
      }
    } catch (e) {
      toast.error("Errore durante l'elaborazione locale. Riprovare.");
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!extracted || !patient) return;
    setApplying(true);
    const { updates, errors } = await applyOneDraft(extracted, patient, selected, visitType);
    setApplying(false);
    if (errors.length === 0) {
      toast.success(`Importazione completata (${updates} sezioni aggiornate)`);
      close();
      onImported?.();
    } else if (updates > 0) {
      toast.warning(`${updates} sezioni importate, ${errors.length} errori — vedi console`);
      errors.forEach((msg) => toast.error(msg, { duration: 8000 }));
    } else {
      errors.forEach((msg) => toast.error(msg, { duration: 8000 }));
    }
  };

  // ── Multi-visit parsing (async — fetches existing data, runs reconciler) ─────
  const parseMulti = async () => {
    for (let i = 0; i < multiBlocks.length; i++) {
      const b = multiBlocks[i];
      if (!b.date) {
        toast.error(`Visita ${i + 1}: inserisci la data.`);
        return;
      }
      if (b.text.trim().length < 30) {
        toast.error(`Visita ${i + 1}: inserisci almeno 30 caratteri di testo.`);
        return;
      }
    }
    setLoading(true);
    try {
      // 1. Parse each block locally (synchronous, no network)
      const rawResults = multiBlocks.map((block, i) => {
        const res = parseVisitText(block.text);
        const draft = buildEditableDraft(res.extracted);
        draft.visit_date      = block.date;
        draft.visit_type      = block.visitType || "follow_up";
        draft.source_filename = block.source_filename || null;
        if (process.env.NODE_ENV !== "production") {
          console.log(`[import multi][PDF ${i + 1}] eventi raccordo prodotti dal parser:`, (draft.raccordo_events || []).length);
        }
        return { block, draft };
      });

      // 2. Fetch existing patient data for reconciliation
      let existingData = { therapies: [], assessments: [], lab_exams: [], disease_profiles: {}, sclero_profile: null, clinical_events: [] };
      if (patient?.id) {
        try {
          const [thRes, assRes, labRes, raRes, spaRes, sleRes, scleroRes, ceRes] = await Promise.allSettled([
            therapiesApi.listByPatient(patient.id),
            assessmentsApi.listByPatient(patient.id),
            labExamsApi.listByPatient(patient.id),
            diseaseProfileApi.get(patient.id, "ra").catch(() => null),
            diseaseProfileApi.get(patient.id, "spa").catch(() => null),
            diseaseProfileApi.get(patient.id, "sle").catch(() => null),
            scleroProfileApi.get(patient.id).catch(() => null),
            clinicalEventsApi.list(patient.id),
          ]);
          existingData = {
            therapies:        thRes.status    === "fulfilled" ? (thRes.value    || []) : [],
            assessments:      assRes.status   === "fulfilled" ? (assRes.value   || []) : [],
            lab_exams:        labRes.status   === "fulfilled" ? (labRes.value   || []) : [],
            disease_profiles: {
              ra:  raRes.status  === "fulfilled" ? raRes.value  : null,
              spa: spaRes.status === "fulfilled" ? spaRes.value : null,
              sle: sleRes.status === "fulfilled" ? sleRes.value : null,
            },
            sclero_profile: scleroRes.status === "fulfilled" ? scleroRes.value : null,
            clinical_events: ceRes.status === "fulfilled" ? (ceRes.value || []) : [],
          };
        } catch (_) { /* continue without existing data */ }
      }

      // 3. Run reconciler across all drafts
      const rawDrafts        = rawResults.map(r => r.draft);
      const reconciledDrafts = reconcileDrafts(rawDrafts, existingData);

      if (process.env.NODE_ENV !== "production") {
        const evNew  = reconciledDrafts.reduce((s, d) => s + (d.raccordo_events || []).filter(e => e.event_type && !e._skip).length, 0);
        const evSkip = reconciledDrafts.reduce((s, d) => s + (d.raccordo_events || []).filter(e => e._skip).length, 0);
        console.log(`[import multi][merge] eventi raccordo dopo deduplica: ${evNew} nuovi, ${evSkip} duplicati ignorati`);
      }

      // 4. Build final results array
      const results = rawResults.map(({ block }, i) => {
        const draft = reconciledDrafts[i];
        const fmt   = block.date.split("-").reverse().join("/");
        const stats = draftSummaryStats(draft);
        return {
          id:       block.id,
          date:     block.date,
          visitType: block.visitType || "follow_up",
          label:    `Visita ${i + 1} — ${fmt}`,
          draft,
          included: true,
          selected: { ...DEFAULT_SELECTED },
          total:    stats.toSave,
          stats,
        };
      });

      setMultiExtracted(results);
      setStep("multi_review");

      const conflicts = results.reduce((s, r) => s + (r.stats?.conflicts || 0), 0);
      const grand     = results.reduce((s, r) => s + r.total, 0);
      if (conflicts > 0) {
        toast.warning(`${results.length} visite analizzate — ${conflicts} conflitti da verificare prima di importare.`);
      } else {
        toast.success(`${results.length} visite analizzate — ${grand} nuovi elementi pronti per l'importazione.`);
      }
    } catch (e) {
      toast.error("Errore durante l'elaborazione. Riprovare.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ── Multi-visit save ──────────────────────────────────────────────────────
  const applyMulti = async () => {
    if (!patient) return;
    // Ordina per data crescente: il documento più recente viene applicato per
    // ultimo e i suoi valori sovrascrivono quelli dei documenti precedenti nella
    // schermata generale ("latest chronological wins").
    const toApply = multiExtracted
      .filter(v => v.included !== false)
      .slice()
      .sort((a, b) => {
        const da = a.date || a.draft?.visit_date || "";
        const db = b.date || b.draft?.visit_date || "";
        return da.localeCompare(db);
      });
    if (toApply.length === 0) {
      toast.warning("Nessuna visita selezionata per l'importazione.");
      return;
    }
    setApplying(true);
    let totalUpdates = 0;
    const allErrors = [];
    // Mantieni riferimento aggiornato al paziente: ogni draft successivo
    // deve vedere i valori scritti dal draft precedente (non la snapshot iniziale).
    let currentPatient = patient;
    for (let i = 0; i < toApply.length; i++) {
      const v = toApply[i];
      setMultiApplyProgress({ current: i + 1, total: toApply.length, label: v.label });
      const vType = v.draft.visit_type || v.visitType || visitType;
      const { updates, errors } = await applyOneDraft(v.draft, currentPatient, v.selected, vType, v.draft.source_filename || null);
      totalUpdates += updates;
      allErrors.push(...errors);
      // Ricarica paziente tra un draft e il successivo — evita riferimento stale
      // che causa sovrascrittura cieca dei campi già aggiornati dal draft precedente.
      if (i < toApply.length - 1) {
        try { currentPatient = await patientsApi.get(patient.id); } catch (_) {}
      }
    }
    setApplying(false);
    setMultiApplyProgress(null);
    if (allErrors.length === 0) {
      toast.success(`${toApply.length} visite importate (${totalUpdates} sezioni aggiornate)`);
      close();
      onImported?.();
    } else if (totalUpdates > 0) {
      toast.warning(`${totalUpdates} sezioni importate, ${allErrors.length} errori — vedi console`);
      allErrors.forEach(msg => toast.error(msg, { duration: 8000 }));
    } else {
      allErrors.forEach(msg => toast.error(msg, { duration: 8000 }));
    }
  };

  return (
    <>
      {!controlled && (
        <Button
          onClick={() => setOpen(true)}
          variant="outline"
          className="border-teal-300 text-teal-700 hover:bg-teal-50"
          data-testid="visit-import-btn"
        >
          <FileSearch className="w-4 h-4 mr-2" /> Importa da testo visita
        </Button>
      )}

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto" data-testid="visit-import-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSearch className="w-5 h-5 text-teal-600" /> Importa visita da testo
            </DialogTitle>
          </DialogHeader>

          {step === "input" ? (
            <div className="space-y-4">
              {/* Mode toggle */}
              <div className="flex gap-1.5 p-1 bg-gray-100 rounded-lg w-fit">
                <button
                  type="button"
                  onClick={() => setMode("single")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    mode === "single"
                      ? "bg-white text-[#0A2540] shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Visita singola
                </button>
                <button
                  type="button"
                  onClick={() => setMode("multi")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    mode === "multi"
                      ? "bg-white text-[#0A2540] shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Più visite
                </button>
              </div>

              {mode === "single" ? (
                <>
                  <div className="text-sm text-gray-600">
                    Incolla il testo della visita. Il parser locale estrarrà diagnosi, terapie,
                    esami ed indici clinimetrici. Potrai modificare ogni dato prima di confermare.
                  </div>
                  <div className="flex items-start gap-1.5 text-[10px] text-teal-700 bg-teal-50 border border-teal-200 rounded-md px-2.5 py-1.5">
                    <ScanSearch className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <span>
                      Elaborazione <strong>100% locale</strong> — nessun dato inviato a servizi esterni.
                      Zero costi aggiuntivi.
                    </span>
                  </div>
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={SAMPLE}
                    className="min-h-[280px] font-mono text-xs"
                    data-testid="visit-import-textarea"
                  />
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setText(SAMPLE)}
                      className="text-xs text-gray-500 hover:text-[#0A2540] underline"
                      type="button"
                    >
                      Usa testo esempio
                    </button>
                    <span className="text-xs text-gray-400">{text.length} caratteri</span>
                  </div>
                </>
              ) : (
                <MultiVisitInput blocks={multiBlocks} onChange={setMultiBlocks} />
              )}
            </div>
          ) : step === "multi_review" ? (
            <MultiVisitWizard
              visitResults={multiExtracted}
              onUpdate={setMultiExtracted}
              onApply={applyMulti}
              applying={applying}
              applyProgress={multiApplyProgress}
            />
          ) : step === "section_review" ? (
            <SectionReviewPanel
              parseReview={extracted._parse_review}
              extracted={extracted}
              onUpdate={setExtracted}
            />
          ) : (
            <ExtractedReview
              extracted={extracted}
              onUpdate={setExtracted}
              selected={selected}
              setSelected={setSelected}
              originalText={text}
              patient={patient}
            />
          )}

          <DialogFooter className="gap-2">
            {step === "input" ? (
              <>
                <Button variant="outline" onClick={close}>Annulla</Button>
                {mode === "single" ? (
                  <Button
                    onClick={parse}
                    disabled={loading || text.trim().length < 30}
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                    data-testid="visit-parse-btn"
                  >
                    {loading
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Elaborazione...</>
                      : <><ScanSearch className="w-4 h-4 mr-2" /> Estrai dati</>}
                  </Button>
                ) : (
                  <Button
                    onClick={parseMulti}
                    disabled={loading || multiBlocks.length === 0}
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                    data-testid="visit-parse-multi-btn"
                  >
                    {loading
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Elaborazione...</>
                      : <><Layers className="w-4 h-4 mr-2" /> Analizza tutte le visite</>}
                  </Button>
                )}
              </>
            ) : step === "multi_review" ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setStep("input")}
                  disabled={applying}
                >
                  ← Modifica testo
                </Button>
              </>
            ) : step === "section_review" ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => { setExtracted(null); setStep("input"); }}
                >
                  ← Modifica testo
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStep("extracted_review")}
                >
                  Salta
                </Button>
                <Button
                  onClick={() => setStep("extracted_review")}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  Avanti →
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => { setExtracted(null); setStep("input"); }}>
                  Modifica testo
                </Button>
                <Button
                  onClick={apply}
                  disabled={applying}
                  className="bg-[#0A2540] hover:bg-[#051626] text-white"
                  data-testid="visit-apply-btn"
                >
                  {applying
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvataggio...</>
                    : <><Check className="w-4 h-4 mr-2" /> Conferma importazione</>}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function fmtIso(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function ExtractedReview({ extracted, onUpdate, selected, setSelected, originalText, patient }) {
  const [showOriginal, setShowOriginal] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const visitDateIso = extracted.visit_date || today;
  const visitDateFmt = fmtIso(visitDateIso);
  const dateIsToday = visitDateIso === today;

  // Counts exclude _skip items for arrays
  const liveCount = (arr) => (arr || []).filter(x => !x._skip).length;
  const totalSkipped = (arr) => (arr || []).filter(x => x._skip).length;

  const sections = [
    { key: "patient",               label: "Anagrafica + Diagnosi",               count: extracted.patient ? Object.values(extracted.patient).filter(Boolean).length : 0 },
    { key: "assessments",           label: "Indici clinimetrici",                  count: liveCount(extracted.assessments), skipped: totalSkipped(extracted.assessments) },
    { key: "therapies",             label: "Terapie",                              count: liveCount(extracted.therapies), skipped: totalSkipped(extracted.therapies) },
    { key: "lab_exams",             label: "Esami di laboratorio",                 count: liveCount(extracted.lab_exams), skipped: totalSkipped(extracted.lab_exams) },
    { key: "lab_review_items",      label: "Lab — Da revisionare",                 count: (extracted.lab_review_items || []).length, badge: "revisione" },
    { key: "sclero_profile",        label: "Profilo Sclerodermia",                 count: extracted.sclero_profile ? Object.values(extracted.sclero_profile).filter((v) => v && Object.keys(v || {}).length > 0).length : 0 },
    { key: "ra_profile",            label: "Profilo AR (sieromarker)",             count: extracted.ra_profile ? Object.keys(extracted.ra_profile).length : 0 },
    { key: "spa_profile",           label: "Profilo SpA (manifestazioni)",         count: extracted.spa_profile ? Object.keys(extracted.spa_profile).length : 0 },
    { key: "sle_profile",           label: "Profilo LES (sierologico)",            count: extracted.sle_profile ? (Object.keys(extracted.sle_profile.antibodies || {}).length + Object.keys(extracted.sle_profile).filter(k => k !== "antibodies").length) : 0 },
    { key: "instrumental_findings", label: "Esami strumentali (archivio)",         count: liveCount(extracted.instrumental_findings), skipped: totalSkipped(extracted.instrumental_findings), badge: "archivio" },
    { key: "exam_imaging",          label: "Esami in visione (Esami/Imaging)",     count: liveCount(extracted.exam_imaging), skipped: totalSkipped(extracted.exam_imaging), badge: "visita" },
    { key: "visit_sections",        label: "Raccordo / Anamnesi / EO / Esami", count: Math.max(1, extracted.visit_sections ? Object.values(extracted.visit_sections).filter(Boolean).length : 0), badge: "visita bozza" },
    { key: "requested_tests",       label: "Esami richiesti (Piano visita)",       count: (extracted.requested_tests || []).length, badge: "piano" },
    { key: "profilo_generale",      label: "Profilo generale paziente",            count: extracted.profilo_generale ? Object.values(extracted.profilo_generale).filter(Boolean).length : 0, badge: "paziente" },
    { key: "comorbidita",           label: "Comorbidità",                          count: liveCount(extracted.comorbidita), skipped: totalSkipped(extracted.comorbidita) },
    { key: "intolleranze",          label: "Intolleranze / Allergie",               count: liveCount(extracted.intolleranze), skipped: totalSkipped(extracted.intolleranze) },
    { key: "raccordo_events",       label: "Cronologia raccordo",                  count: liveCount(extracted.raccordo_events), skipped: totalSkipped(extracted.raccordo_events), badge: "timeline" },
  ];

  const withData    = sections.filter(s => s.count > 0 || (s.skipped || 0) > 0);
  const withoutData = sections.filter(s => s.count === 0 && !(s.skipped > 0));

  return (
    <div className="space-y-4" data-testid="visit-review">
      {/* Banner: verifica dati */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-900 text-sm">
        <Pencil className="w-4 h-4 flex-shrink-0 text-blue-500" />
        <span>
          <strong>Verifica i dati prima di confermare.</strong> Modifica, elimina o deseleziona ogni sezione.
          Nessun dato viene salvato finché non premi <em>Conferma importazione</em>.
        </span>
      </div>

      {/* Visit date banner */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${dateIsToday ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"}`}>
        <Calendar className="w-4 h-4 flex-shrink-0" />
        <span>
          Data visita: <strong>{visitDateFmt}</strong>
          {dateIsToday && <span className="ml-2 text-xs font-normal text-amber-600">(data odierna — non trovata nella lettera)</span>}
        </span>
      </div>

      {extracted.summary && (
        <div className="p-3 bg-teal-50 border border-teal-200 rounded-md text-sm text-teal-900">
          <div className="font-semibold text-xs uppercase tracking-[0.15em] mb-1 flex items-center gap-1">
            <ScanSearch className="w-3 h-3" /> Riepilogo estrazione
          </div>
          {extracted.summary}
        </div>
      )}

      <div className="space-y-2">
        {withData.map((s) => {
          const isOpen = s.infoOnly ? true : selected[s.key];
          return (
            <Card key={s.key} className={`border p-4 ${s.infoOnly ? "border-amber-200 bg-amber-50/50" : isOpen ? "border-[#0A2540] bg-white" : "border-gray-200 bg-gray-50"}`}>
              <label className={`flex items-center justify-between ${s.infoOnly ? "cursor-default" : "cursor-pointer"}`}>
                <div className="flex items-center gap-3">
                  {!s.infoOnly && (
                    <input
                      type="checkbox"
                      checked={selected[s.key]}
                      onChange={(e) => setSelected({ ...selected, [s.key]: e.target.checked })}
                      className="w-4 h-4 accent-[#0A2540]"
                      data-testid={`visit-section-${s.key}`}
                    />
                  )}
                  {s.infoOnly && <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                  <div>
                    <div className="font-heading font-bold text-sm tracking-tight text-[#0A2540] flex items-center gap-1.5">
                      {s.key === "instrumental_findings" && <ScanSearch className="w-3.5 h-3.5 text-teal-600" />}
                      {s.label}
                      {s.badge && (
                        <span className="text-[9px] font-normal uppercase tracking-widest px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                          {s.badge}
                        </span>
                      )}
                      {s.infoOnly && (
                        <span className="text-[9px] font-normal uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          solo lettura
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1.5">
                      <span>{s.count} {s.count === 1 ? "elemento" : "elementi"}</span>
                      {(s.skipped || 0) > 0 && (
                        <span className="text-red-400">· {s.skipped} {s.skipped === 1 ? "escluso" : "esclusi"}</span>
                      )}
                    </div>
                  </div>
                </div>
              </label>
              {isOpen && (
                <div className="mt-3 text-xs text-gray-600 pl-7">
                  <EditableSectionContent
                    section={s.key}
                    extracted={extracted}
                    onUpdate={onUpdate}
                  />
                </div>
              )}
            </Card>
          );
        })}

        {withoutData.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 py-1 select-none list-none">
              <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
              {withoutData.length} sezioni senza dati estratti
            </summary>
            <div className="mt-1 space-y-1 pl-4">
              {withoutData.map((s) => (
                <div key={s.key} className="text-xs text-gray-400 py-0.5 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />
                  {s.label} — nessun dato
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="text-xs text-gray-500 italic flex items-start gap-1.5">
        <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
        Il parser locale usa regole e dizionari: rivedi sempre i valori prima di applicarli. I dati estratti aggiungono nuove valutazioni e terapie; il profilo SSc viene unito a quello esistente.
      </div>

      {originalText && (
        <div className="border border-dashed border-gray-300 rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => setShowOriginal((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <span className="flex items-center gap-1.5 font-medium">
              <ScanSearch className="w-3.5 h-3.5 text-teal-600" />
              Testo originale — seleziona per archiviare direttamente
            </span>
            {showOriginal
              ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
          </button>
          {showOriginal && (
            <div className="px-3 pb-3 pt-1 bg-gray-50 border-t border-dashed border-gray-200">
              <p className="text-[10px] text-teal-700 mb-2">
                Seleziona una porzione di testo per archiviarla direttamente in Esami strumentali o come Nota clinica.
              </p>
              <SelectableTextBlock
                text={originalText}
                patient={patient}
                patientId={patient?.id}
                visitDate={new Date().toISOString().slice(0, 10)}
                paragraphClass="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-mono"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Editable sub-components for the import draft review ─────────────────────

function TherapyItemRow({ therapy, onChange, onSkip }) {
  const [editing, setEditing] = useState(false);

  if (therapy._skip) {
    return (
      <li className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-red-100 bg-red-50/60">
        <span className="line-through text-[11px] text-gray-400 flex-1 truncate">{therapy.drug_name}</span>
        <button type="button" onClick={() => onChange({ ...therapy, _skip: false })}
          className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5 flex-shrink-0">
          <RotateCcw className="w-2.5 h-2.5" /> Ripristina
        </button>
      </li>
    );
  }

  return (
    <li className="rounded border border-gray-100 bg-white px-2.5 py-2">
      {editing ? (
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <input autoFocus
              className="flex-1 text-xs border border-teal-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-400"
              value={therapy.drug_name}
              onChange={e => onChange({ ...therapy, drug_name: e.target.value })}
              placeholder="Nome farmaco" />
            <input
              className="w-24 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
              value={therapy.dose || ""}
              onChange={e => onChange({ ...therapy, dose: e.target.value || null })}
              placeholder="Dose" />
          </div>
          <div className="flex gap-1.5 items-center">
            <input
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
              value={therapy.frequency || ""}
              onChange={e => onChange({ ...therapy, frequency: e.target.value || null })}
              placeholder="Frequenza (es. 1×/die)" />
            <select
              className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none"
              value={therapy.status}
              onChange={e => onChange({ ...therapy, status: e.target.value })}>
              <option value="active">Terapia attiva</option>
              <option value="discontinued">Pregressa / sospesa</option>
            </select>
            <button type="button" onClick={() => setEditing(false)}
              className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 px-2 py-1 rounded bg-teal-50 border border-teal-200 flex-shrink-0">
              ✓ Fatto
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-teal-700 text-[11px]">{therapy.drug_name}</span>
              {therapy.dose && <span className="text-gray-600 text-[11px]">{therapy.dose}</span>}
              {therapy.frequency && <span className="text-gray-400 text-[10px]">· {therapy.frequency}</span>}
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                therapy.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
              }`}>
                {therapy.status === "active" ? "attiva" : "pregressa"}
              </span>
            </div>
            {therapy.status === "discontinued" && therapy.discontinuation_reason && (
              <div className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-0.5">
                <span className="font-medium">Motivo:</span> {therapy.discontinuation_reason}
              </div>
            )}
            {therapy._statusReason && therapy.status === "discontinued" && (
              <div className="text-[10px] text-blue-500 mt-0.5">{therapy._statusReason}</div>
            )}
            {therapy.source_fragment && (
              <div className="text-[10px] text-gray-400 italic mt-0.5 truncate" title={therapy.source_fragment}>
                «{therapy.source_fragment}»
              </div>
            )}
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
            <button type="button" onClick={() => setEditing(true)} title="Modifica"
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-[#0A2540] transition-colors">
              <Pencil className="w-3 h-3" />
            </button>
            <button type="button" onClick={onSkip} title="Escludi da importazione"
              className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function TherapyEditor({ therapies, onChange }) {
  return (
    <ul className="space-y-1.5">
      {therapies.map((t, i) => (
        <TherapyItemRow
          key={t._id ?? i}
          therapy={t}
          onChange={updated => onChange(therapies.map((x, j) => j === i ? updated : x))}
          onSkip={() => onChange(therapies.map((x, j) => j === i ? { ...x, _skip: true } : x))}
        />
      ))}
    </ul>
  );
}

const VS_LABELS = {
  raccordo:    "Raccordo anamnestico",
  anamnesi:    "Anamnesi intervallare",
  esame_obj:   "Esame obiettivo",
  conclusioni: "Conclusioni",
  indicazioni: "Indicazioni",
  labs_text:   "Esami / Imaging (testo)",
};

function VisitSectionsEditor({ sections, onChange }) {
  return (
    <div className="space-y-3">
      {Object.entries(VS_LABELS).map(([k, label]) => {
        const isLabsText = k === "labs_text";
        if (!isLabsText && !sections[k] && sections[k] !== "") return null;
        return (
          <div key={k}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#0A2540] mb-1">{label}</div>
            <textarea
              className="w-full text-xs border border-gray-200 rounded px-2.5 py-1.5 min-h-[58px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-teal-400 resize-y bg-white"
              value={sections[k] || ""}
              placeholder={isLabsText ? "Incolla qui gli esami portati in visione (es. > EE 02/2026: ...). Verranno salvati nel campo Esami/Imaging della visita." : undefined}
              onChange={e => onChange({ ...sections, [k]: e.target.value })}
            />
          </div>
        );
      })}
    </div>
  );
}

const PG_LABELS = {
  anamnesi_fisiologica: "Anamnesi fisiologica",
  anamnesi_familiare:   "Anamnesi familiare",
  comorbidita_apr:      "Comorbidità / APR",
  terapia_domiciliare:  "Terapia domiciliare",
  allergie:             "Allergie / Intolleranze",
};

function ProfiloGeneraleEditor({ pg, onChange }) {
  return (
    <div className="space-y-3">
      {Object.entries(PG_LABELS).map(([k, label]) => {
        if (!pg[k] && pg[k] !== "") return null;
        return (
          <div key={k}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#0A2540] mb-1">{label}</div>
            <textarea
              className="w-full text-xs border border-gray-200 rounded px-2.5 py-1.5 min-h-[48px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-teal-400 resize-y bg-white"
              value={pg[k] || ""}
              onChange={e => onChange({ ...pg, [k]: e.target.value })}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── PatientEditor ─────────────────────────────────────────────────────────────
function PatientEditor({ patient, onChange }) {
  if (!patient) return null;
  const field = (k, label, type = "text") => (
    <div key={k} className="flex flex-col gap-0.5">
      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</label>
      {k === "sesso" ? (
        <select
          className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"
          value={patient[k] || ""}
          onChange={e => onChange({ ...patient, [k]: e.target.value || null })}>
          <option value="">—</option>
          <option value="M">M</option>
          <option value="F">F</option>
        </select>
      ) : (
        <input
          type={type}
          className="text-xs border border-gray-200 rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-teal-400"
          value={patient[k] != null ? patient[k] : ""}
          onChange={e => {
            const val = type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : (e.target.value || null);
            onChange({ ...patient, [k]: val });
          }}
        />
      )}
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
      <div className="col-span-2">{field("diagnosi", "Diagnosi principale")}</div>
      {field("sesso", "Sesso")}
      {field("eta", "Età (anni)", "number")}
      {field("peso_kg", "Peso (kg)", "number")}
    </div>
  );
}

// ── LabExamExpander ───────────────────────────────────────────────────────────
function LabExamExpander({ exams, onChange }) {
  const [expanded, setExpanded] = useState({});
  if (!exams || exams.length === 0) return <p className="text-xs text-gray-400 italic">Nessun esame rilevato</p>;
  return (
    <div className="space-y-2">
      {exams.map((exam, i) => {
        const isOpen = !!expanded[i];
        const results = exam.results || [];
        const activeResults = results.filter(r => !r._skip);
        const category = exam.category || exam.panel || "Lab";
        const date = exam.date ? fmtIso(exam.date) : null;
        const toggleResult = (ri, skip) => {
          const updated = [...exams];
          updated[i] = {
            ...exam,
            results: results.map((r, j) => j === ri ? { ...r, _skip: skip } : r),
          };
          // If all results skipped, mark the whole exam skipped
          const allSkipped = updated[i].results.every(r => r._skip);
          updated[i]._skip = allSkipped;
          onChange(updated);
        };
        return (
          <div key={exam._id ?? i} className={`rounded border text-[11px] ${exam._skip ? "border-red-100 bg-red-50/60 opacity-60" : "border-gray-100 bg-white"}`}>
            <div className="flex items-center gap-2 px-2.5 py-1.5">
              <button type="button"
                className="flex-1 flex items-center gap-1.5 text-left min-w-0"
                onClick={() => setExpanded(prev => ({ ...prev, [i]: !isOpen }))}>
                <span className={`transition-transform text-gray-400 text-[10px] ${isOpen ? "rotate-90" : ""}`}>▶</span>
                <span className={`font-semibold ${exam._skip ? "line-through text-gray-400" : "text-[#0A2540]"}`}>{category}</span>
                {date && <span className="text-gray-400">· {date}</span>}
                <span className="ml-auto text-gray-400 font-normal">{activeResults.length}/{results.length} valori</span>
              </button>
              {exam._skip ? (
                <button type="button" onClick={() => onChange(exams.map((x, j) => j === i ? { ...x, _skip: false, results: (x.results||[]).map(r=>({...r,_skip:false})) } : x))}
                  className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5 flex-shrink-0">
                  <RotateCcw className="w-2.5 h-2.5" /> Ripristina
                </button>
              ) : (
                <button type="button" onClick={() => onChange(exams.map((x, j) => j === i ? { ...x, _skip: true } : x))}
                  title="Escludi tutto il pannello" className="p-0.5 text-gray-400 hover:text-red-500 rounded transition-colors flex-shrink-0">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
            {isOpen && (
              <ul className="border-t border-gray-100 divide-y divide-gray-50">
                {results.map((r, ri) => (
                  <li key={ri} className={`flex items-center gap-2 px-3 py-1 ${r._skip ? "opacity-50" : ""}`}>
                    <span className={`flex-1 min-w-0 ${r._skip ? "line-through text-gray-400" : "text-gray-700"}`}>
                      <span className="font-medium">{r.name}</span>
                      {r.value != null && <span className="text-gray-500"> {r.value}{r.unit ? ` ${r.unit}` : ""}</span>}
                      {r.qualitative && <span className="text-gray-400"> ({r.qualitative})</span>}
                      {r.status && r.status !== "normal" && (
                        <span className={`ml-1 text-[9px] font-bold px-1 rounded ${r.status === "high" || r.status === "critical" ? "text-red-600 bg-red-50" : r.status === "low" ? "text-blue-600 bg-blue-50" : "text-amber-600 bg-amber-50"}`}>
                          {r.status}
                        </span>
                      )}
                    </span>
                    {r._skip ? (
                      <button type="button" onClick={() => toggleResult(ri, false)}
                        className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5 flex-shrink-0">
                        <RotateCcw className="w-2.5 h-2.5" />
                      </button>
                    ) : (
                      <button type="button" onClick={() => toggleResult(ri, true)}
                        className="p-0.5 text-gray-400 hover:text-red-500 rounded transition-colors flex-shrink-0">
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── ScleroProfileEditor ───────────────────────────────────────────────────────
const SCLERO_SECTION_LABELS = {
  cutaneous: "Cute",
  antibody:  "Anticorpi",
  vascular:  "Vascolare",
  ild:       "ILD",
  pah:       "PAH",
  gi:        "GI",
  msk:       "MSK",
};

const SCLERO_FIELD_LABELS = {
  subset:                "Sottotipo",
  mrss_score:            "mRSS",
  sclerodactyly:         "Sclerodattilia",
  telangiectasias:       "Teleangectasie",
  puffy_fingers:         "Dita gonfie",
  scl70:                 "Anti-Scl70",
  aca:                   "Anti-centromero",
  rnap3:                 "Anti-RNAP III",
  pm_scl:                "Anti-PM-Scl",
  th_to:                 "Anti-Th/To",
  u1rnp:                 "Anti-U1-RNP",
  raynaud:               "Raynaud",
  raynaud_onset_year:    "Esordio Raynaud",
  digital_ulcers:        "Ulcere digitali",
  capillaroscopy_pattern:"Pattern capillaroscopia",
  capillaroscopy_date:   "Data capillaroscopia",
  pitting_scars:         "Pitting scars",
  present:               "Presente",
  hrct_pattern:          "Pattern HRCT",
  dysphagia:             "Disfagia",
  arthritis:             "Artrite",
  myositis:              "Miosite",
  rvsp:                  "RVSP",
};

function ScleroProfileEditor({ profile, onChange }) {
  if (!profile) return null;
  const sections = ["cutaneous", "antibody", "vascular", "ild", "pah", "gi", "msk"];
  return (
    <div className="space-y-3">
      {sections.map(sec => {
        const data = profile[sec];
        if (!data || typeof data !== "object" || Object.keys(data).length === 0) return null;
        return (
          <div key={sec}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#0A2540] mb-1.5">
              {SCLERO_SECTION_LABELS[sec] || sec}
            </div>
            <div className="space-y-1">
              {Object.entries(data).map(([k, v]) => {
                const label = SCLERO_FIELD_LABELS[k] || k;
                return (
                  <div key={k} className="flex items-center gap-2 px-2 py-1 rounded border border-gray-100 bg-white">
                    <span className="text-[11px] text-gray-600 flex-1">{label}</span>
                    <span className="text-[11px] font-medium text-[#0A2540]">
                      {typeof v === "boolean" ? (v ? "sì" : "no") : String(v)}
                    </span>
                    <button type="button"
                      onClick={() => {
                        const updatedSec = { ...data };
                        delete updatedSec[k];
                        onChange({ ...profile, [sec]: updatedSec });
                      }}
                      title="Rimuovi campo"
                      className="p-0.5 text-gray-300 hover:text-red-500 rounded transition-colors flex-shrink-0">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {typeof profile.subtype === "string" && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#0A2540] mb-1">Sottotipo</div>
          <div className="flex items-center gap-2 px-2 py-1 rounded border border-gray-100 bg-white">
            <span className="text-[11px] flex-1">{profile.subtype}</span>
            <button type="button"
              onClick={() => { const { subtype, ...rest } = profile; onChange(rest); }}
              className="p-0.5 text-gray-300 hover:text-red-500 rounded transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DeletableList({ items, getLabel, onChange }) {
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={item._id ?? i}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded border text-[11px] ${
            item._skip ? "border-red-100 bg-red-50/60 opacity-60" : "border-gray-100 bg-white"
          }`}>
          <span className={`flex-1 ${item._skip ? "line-through text-gray-400" : "text-gray-700"}`}>
            {getLabel(item)}
          </span>
          {item._skip ? (
            <button type="button" onClick={() => onChange(items.map((x, j) => j === i ? { ...x, _skip: false } : x))}
              className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5 flex-shrink-0">
              <RotateCcw className="w-2.5 h-2.5" /> Ripristina
            </button>
          ) : (
            <button type="button" onClick={() => onChange(items.map((x, j) => j === i ? { ...x, _skip: true } : x))}
              title="Escludi" className="p-0.5 text-gray-400 hover:text-red-500 rounded transition-colors flex-shrink-0">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function RequestedTestsEditor({ tests, onChange }) {
  const [newTest, setNewTest] = useState("");
  return (
    <div className="space-y-1.5">
      <ul className="space-y-1">
        {tests.map((t, i) => (
          <li key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-gray-100 bg-white text-[11px]">
            <span className="flex-1">{t}</span>
            <button type="button" onClick={() => onChange(tests.filter((_, j) => j !== i))}
              className="p-0.5 text-gray-400 hover:text-red-500 rounded transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-1.5 pt-0.5">
        <input
          className="flex-1 text-xs border border-gray-200 rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-teal-400"
          value={newTest}
          onChange={e => setNewTest(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && newTest.trim()) {
              onChange([...tests, newTest.trim()]);
              setNewTest("");
            }
          }}
          placeholder="Aggiungi esame richiesto…" />
        <button type="button"
          onClick={() => { if (newTest.trim()) { onChange([...tests, newTest.trim()]); setNewTest(""); } }}
          className="text-xs px-2 py-1 rounded bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 flex items-center gap-1">
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ── RaccordoEventsEditor — full inline editing ────────────────────────────────
const RACCORDO_EVENT_CONFIG = {
  disease_onset:       { label: "Esordio malattia",    cls: "bg-blue-100 text-blue-800 border-blue-200" },
  manifestation_onset: { label: "Manifestazione",       cls: "bg-purple-100 text-purple-800 border-purple-200" },
  therapy_start:       { label: "Inizio terapia",       cls: "bg-green-100 text-green-800 border-green-200" },
  therapy_stop:        { label: "Sospensione terapia",  cls: "bg-red-100 text-red-800 border-red-200" },
  therapy_switch:      { label: "Switch terapia",       cls: "bg-orange-100 text-orange-800 border-orange-200" },
  dose_spacing:        { label: "Spacing",              cls: "bg-teal-100 text-teal-800 border-teal-200" },
  remission:           { label: "Remissione",           cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  flare:               { label: "Riacutizzazione",      cls: "bg-amber-100 text-amber-800 border-amber-200" },
};

const CONFIDENCE_CONFIG = {
  high:   { label: "alta",   cls: "bg-green-50 text-green-700 border-green-200" },
  medium: { label: "media",  cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  low:    { label: "bassa",  cls: "bg-red-50 text-red-700 border-red-200" },
};

function fmtRaccordoDate(ev) {
  if (!ev.date_value) return "data sconosciuta";
  const d = new Date(ev.date_value + "T00:00:00Z");
  if (ev.date_precision === "year") return String(d.getUTCFullYear());
  if (ev.date_precision === "month_year") {
    return d.toLocaleDateString("it-IT", { month: "short", year: "numeric", timeZone: "UTC" });
  }
  return d.toLocaleDateString("it-IT", { timeZone: "UTC" });
}

const EVENT_TYPES_OPTIONS = [
  { value: "disease_onset",       label: "Esordio malattia" },
  { value: "manifestation_onset", label: "Esordio manifestazione" },
  { value: "therapy_start",       label: "Inizio terapia" },
  { value: "therapy_stop",        label: "Sospensione terapia" },
  { value: "therapy_switch",      label: "Switch terapia" },
  { value: "dose_spacing",        label: "Spacing dose" },
  { value: "dose_reduction",      label: "Riduzione dose" },
  { value: "remission",           label: "Remissione" },
  { value: "flare",               label: "Riacutizzazione" },
  { value: "comorbidity_onset",   label: "Comorbidità" },
  { value: "adverse_event",       label: "Evento avverso" },
];

const DATE_PRECISION_OPTIONS = [
  { value: "year",       label: "Anno" },
  { value: "month_year", label: "Mese/Anno" },
  { value: "exact",      label: "Data esatta" },
];

function RaccordoEventItemEditor({ ev, origIdx, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const update = (field, value) => onChange({ ...ev, [field]: value });
  const cfg  = RACCORDO_EVENT_CONFIG[ev.event_type] || { label: ev.event_type || "—", cls: "bg-gray-100 text-gray-700 border-gray-200" };
  const conf = CONFIDENCE_CONFIG[ev.confidence]    || CONFIDENCE_CONFIG.medium;

  return (
    <div className={`rounded border text-xs transition-all ${ev._skip ? "opacity-50 border-red-100 bg-red-50/30" : "border-gray-200 bg-white"}`}>
      <div className="flex items-center gap-2 p-2">
        <input
          type="checkbox"
          checked={!ev._skip}
          onChange={() => update("_skip", !ev._skip)}
          className="accent-blue-600 flex-shrink-0"
        />
        <span className={`inline-block border rounded px-1.5 py-0.5 font-medium text-[10px] flex-shrink-0 ${cfg.cls}`}>{cfg.label}</span>
        <span className="text-gray-600 font-medium flex-shrink-0">{fmtRaccordoDate(ev)}</span>
        {ev.drug_name && <span className="text-gray-800 font-semibold truncate">{ev.drug_name}</span>}
        {ev.inferred_by === "anaphora" && (
          <span className="border rounded px-1 py-0.5 bg-orange-50 text-orange-700 border-orange-200 text-[9px] flex-shrink-0">⚠ anafora</span>
        )}
        <span className={`border rounded px-1 py-0.5 text-[9px] flex-shrink-0 ${conf.cls}`}>{conf.label}</span>
        <button
          type="button"
          onClick={() => setExpanded(x => !x)}
          className="ml-auto p-0.5 text-gray-400 hover:text-gray-700 flex-shrink-0"
          title={expanded ? "Chiudi editor" : "Modifica"}
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-2.5 space-y-2 bg-gray-50/60">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Tipo evento</label>
              <select
                value={ev.event_type || ""}
                onChange={e => update("event_type", e.target.value)}
                className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white"
              >
                {EVENT_TYPES_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Confidenza</label>
              <select
                value={ev.confidence || "medium"}
                onChange={e => update("confidence", e.target.value)}
                className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white"
              >
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Bassa</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Data (ISO)</label>
              <input
                type="date"
                value={ev.date_value || ""}
                onChange={e => update("date_value", e.target.value || null)}
                className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Precisione data</label>
              <select
                value={ev.date_precision || "year"}
                onChange={e => update("date_precision", e.target.value)}
                className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white"
              >
                {DATE_PRECISION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Data (testo originale)</label>
              <input
                type="text"
                value={ev.date_text || ""}
                onChange={e => update("date_text", e.target.value || null)}
                placeholder="es. dal 2009"
                className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Farmaco</label>
              <input
                type="text"
                value={ev.drug_name || ""}
                onChange={e => update("drug_name", e.target.value || null)}
                placeholder="es. Adalimumab"
                className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Manifestazione</label>
            <input
              type="text"
              value={ev.manifestation || ""}
              onChange={e => update("manifestation", e.target.value || null)}
              placeholder="es. manifestazioni psoriasiche cutanee"
              className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white"
            />
          </div>
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Dettaglio</label>
            <input
              type="text"
              value={ev.detail || ""}
              onChange={e => update("detail", e.target.value || null)}
              placeholder="es. in monoterapia, spacing a 3 settimane"
              className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white"
            />
          </div>
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Motivo</label>
            <input
              type="text"
              value={ev.reason || ""}
              onChange={e => update("reason", e.target.value || null)}
              placeholder="es. inefficacia, tossicità, focolaio pneumonico"
              className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white"
            />
          </div>
          {ev.source_text && (
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Testo sorgente (sola lettura)</label>
              <p className="text-[10px] text-gray-500 italic leading-snug bg-white border border-gray-100 rounded px-2 py-1 whitespace-pre-wrap">
                {ev.source_text}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RaccordoEventsEditor({ events, onChange }) {
  const selectAll   = () => onChange(events.map(e => ({ ...e, _skip: false })));
  const deselectAll = () => onChange(events.map(e => ({ ...e, _skip: true })));
  const addNew = () => onChange([...events, {
    _id: Date.now(), _skip: false,
    event_type: "disease_onset", date_value: null, date_text: null,
    date_precision: "year", date_approximate: false,
    drug_name: null, drug_canonical: null, drug_category: null,
    manifestation: null, body_system: null, detail: null, reason: null,
    source_text: null, confidence: "medium", inferred_by: null,
    parser_version: "manual", source_section: "raccordo",
  }]);

  if (events.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-400 italic">Nessun evento rilevato nel raccordo anamnestico.</p>
        <button type="button" onClick={addNew} className="text-xs text-green-600 hover:underline">+ Aggiungi evento</button>
      </div>
    );
  }

  // Split into dated (sortable on timeline) and undated (anamnesi senza data)
  const dated   = events.map((e, i) => ({ ev: e, i })).filter(({ ev }) =>  ev.date_value);
  const undated = events.map((e, i) => ({ ev: e, i })).filter(({ ev }) => !ev.date_value);

  dated.sort((a, b) => a.ev.date_value.localeCompare(b.ev.date_value));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-gray-500">{events.filter(e => !e._skip).length}/{events.length} selezionati</span>
        <button type="button" onClick={selectAll}   className="text-xs text-blue-600 hover:underline">Seleziona tutti</button>
        <span className="text-gray-300">·</span>
        <button type="button" onClick={deselectAll} className="text-xs text-gray-500 hover:underline">Deseleziona tutti</button>
        <span className="text-gray-300">·</span>
        <button type="button" onClick={addNew}      className="text-xs text-green-600 hover:underline">+ Aggiungi</button>
      </div>

      {/* ── Dated events ────────────────────────────────────────────────────── */}
      {dated.length > 0 && (
        <div className="space-y-1.5">
          {dated.map(({ ev, i }) => (
            <RaccordoEventItemEditor
              key={ev._id ?? i}
              ev={ev}
              origIdx={i}
              onChange={updated => onChange(events.map((e, j) => j === i ? updated : e))}
            />
          ))}
        </div>
      )}

      {/* ── Undated events ──────────────────────────────────────────────────── */}
      {undated.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1 flex-shrink-0">
              Eventi senza data ({undated.length})
            </span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          <p className="text-[10px] text-gray-400 italic">
            Non verranno posizionati sulla timeline datata — salvati come eventi anamnestici senza collocazione temporale.
          </p>
          {undated.map(({ ev, i }) => (
            <RaccordoEventItemEditor
              key={ev._id ?? i}
              ev={ev}
              origIdx={i}
              onChange={updated => onChange(events.map((e, j) => j === i ? updated : e))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ComorbidityEditor({ items, onChange }) {
  const [newText, setNewText] = useState("");
  const addItem = () => {
    if (!newText.trim()) return;
    onChange([...items, { _id: Date.now(), _skip: false, text: newText.trim() }]);
    setNewText("");
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-xs text-gray-500">{items.filter(x => !x._skip).length}/{items.length} selezionate</span>
      </div>
      {items.map((item, i) => (
        <div
          key={item._id ?? i}
          className={`flex items-center gap-2 p-1.5 rounded border text-xs ${item._skip ? "opacity-50 border-red-100 bg-red-50/30" : "border-gray-200 bg-white"}`}
        >
          <input
            type="checkbox"
            checked={!item._skip}
            onChange={() => onChange(items.map((x, j) => j === i ? { ...x, _skip: !x._skip } : x))}
            className="accent-blue-600 flex-shrink-0"
          />
          <input
            type="text"
            value={item.text}
            onChange={e => onChange(items.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
            disabled={item._skip}
            className={`flex-1 min-w-0 text-xs bg-transparent border-0 outline-none ${item._skip ? "line-through text-gray-400" : "text-gray-700"}`}
          />
          <button
            type="button"
            onClick={() => onChange(items.map((x, j) => j === i ? { ...x, _skip: !x._skip } : x))}
            className={`flex-shrink-0 text-[10px] ${item._skip ? "text-blue-600 hover:underline" : "text-gray-400 hover:text-red-500"}`}
          >
            {item._skip ? "ripristina" : "escludi"}
          </button>
        </div>
      ))}
      <div className="flex gap-1 mt-1.5">
        <input
          type="text"
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addItem()}
          placeholder="Aggiungi comorbidità…"
          className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 bg-white"
        />
        <button
          type="button"
          onClick={addItem}
          className="text-xs px-2 py-1 rounded border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600"
        >+</button>
      </div>
    </div>
  );
}

function IntolleranzeEditor({ items, onChange }) {
  const [newDrug, setNewDrug]     = useState("");
  const [newReason, setNewReason] = useState("");
  const addItem = () => {
    if (!newDrug.trim()) return;
    onChange([...items, { _id: Date.now(), _skip: false, drug: newDrug.trim(), reason: newReason.trim() || null }]);
    setNewDrug("");
    setNewReason("");
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-xs text-gray-500">{items.filter(x => !x._skip).length}/{items.length} selezionate</span>
      </div>
      {items.map((item, i) => (
        <div
          key={item._id ?? i}
          className={`flex items-start gap-2 p-1.5 rounded border text-xs ${item._skip ? "opacity-50 border-red-100 bg-red-50/30" : "border-gray-200 bg-white"}`}
        >
          <input
            type="checkbox"
            checked={!item._skip}
            onChange={() => onChange(items.map((x, j) => j === i ? { ...x, _skip: !x._skip } : x))}
            className="accent-blue-600 flex-shrink-0 mt-0.5"
          />
          <div className="flex-1 min-w-0 grid grid-cols-2 gap-1">
            <input
              type="text"
              value={item.drug || ""}
              onChange={e => onChange(items.map((x, j) => j === i ? { ...x, drug: e.target.value } : x))}
              disabled={item._skip}
              placeholder="Farmaco"
              className={`text-xs border border-gray-100 rounded px-1.5 py-0.5 ${item._skip ? "line-through text-gray-400 bg-gray-50" : "text-gray-800 font-medium bg-white"}`}
            />
            <input
              type="text"
              value={item.reason || ""}
              onChange={e => onChange(items.map((x, j) => j === i ? { ...x, reason: e.target.value || null } : x))}
              disabled={item._skip}
              placeholder="Motivo (opz.)"
              className={`text-xs border border-gray-100 rounded px-1.5 py-0.5 ${item._skip ? "text-gray-400 bg-gray-50" : "text-gray-600 bg-white"}`}
            />
          </div>
          <button
            type="button"
            onClick={() => onChange(items.map((x, j) => j === i ? { ...x, _skip: !x._skip } : x))}
            className={`flex-shrink-0 text-[10px] mt-0.5 ${item._skip ? "text-blue-600 hover:underline" : "text-gray-400 hover:text-red-500"}`}
          >
            {item._skip ? "ripristina" : "escludi"}
          </button>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-1 mt-1.5">
        <input
          type="text"
          value={newDrug}
          onChange={e => setNewDrug(e.target.value)}
          placeholder="Nuovo farmaco…"
          className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
        />
        <div className="flex gap-1">
          <input
            type="text"
            value={newReason}
            onChange={e => setNewReason(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addItem()}
            placeholder="Motivo (opz.)"
            className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 bg-white"
          />
          <button
            type="button"
            onClick={addItem}
            className="text-xs px-2 py-1 rounded border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600"
          >+</button>
        </div>
      </div>
    </div>
  );
}

function EditableSectionContent({ section, extracted, onUpdate }) {
  switch (section) {
    case "patient":
      return (
        <PatientEditor
          patient={extracted.patient || {}}
          onChange={p => onUpdate({ ...extracted, patient: p })}
        />
      );
    case "sclero_profile":
      return (
        <ScleroProfileEditor
          profile={extracted.sclero_profile || {}}
          onChange={p => onUpdate({ ...extracted, sclero_profile: p })}
        />
      );
    case "therapies":
      return (
        <TherapyEditor
          therapies={extracted.therapies || []}
          onChange={t => onUpdate({ ...extracted, therapies: t })}
        />
      );
    case "visit_sections":
      return (
        <VisitSectionsEditor
          sections={extracted.visit_sections || {}}
          onChange={s => onUpdate({ ...extracted, visit_sections: s })}
        />
      );
    case "profilo_generale":
      return (
        <ProfiloGeneraleEditor
          pg={extracted.profilo_generale || {}}
          onChange={pg => onUpdate({ ...extracted, profilo_generale: pg })}
        />
      );
    case "raccordo_events":
      return (
        <RaccordoEventsEditor
          events={extracted.raccordo_events || []}
          onChange={evs => onUpdate({ ...extracted, raccordo_events: evs })}
        />
      );
    case "comorbidita":
      return (
        <ComorbidityEditor
          items={extracted.comorbidita || []}
          onChange={items => onUpdate({ ...extracted, comorbidita: items })}
        />
      );
    case "intolleranze":
      return (
        <IntolleranzeEditor
          items={extracted.intolleranze || []}
          onChange={items => onUpdate({ ...extracted, intolleranze: items })}
        />
      );
    case "requested_tests":
      return (
        <RequestedTestsEditor
          tests={extracted.requested_tests || []}
          onChange={t => onUpdate({ ...extracted, requested_tests: t })}
        />
      );
    case "assessments":
      return (
        <DeletableList
          items={extracted.assessments || []}
          getLabel={a => `${a.index_type || "?"}${a.score != null ? ` = ${a.score}` : ""}${a.interpretation ? ` · ${a.interpretation}` : ""}${a.date ? ` (${fmtIso(a.date)})` : ""}`}
          onChange={items => onUpdate({ ...extracted, assessments: items })}
        />
      );
    case "lab_exams":
      return (
        <LabExamExpander
          exams={extracted.lab_exams || []}
          onChange={items => onUpdate({ ...extracted, lab_exams: items })}
        />
      );
    case "lab_review_items": {
      const handleRevConfirm = (item, { value, unit } = {}) => {
        const newReview  = (extracted.lab_review_items || []).filter(r => !(r.key === item.key && r.date === item.date));
        let   newExams   = [...(extracted.lab_exams || [])];
        const finalValue = value != null ? value : item.proposed_value;
        const finalUnit  = unit  != null ? unit  : (item.proposed_unit || "");
        if (finalValue != null || item.qualitative) {
          const idx = newExams.findIndex(e => e.date === item.date);
          const r = { name: item.label, param_key: item.key, panel: item.panel || "custom" };
          if (finalValue != null) { r.value = String(finalValue); r.unit = finalUnit; }
          if (item.qualitative) r.qualitative = item.qualitative;
          if (item.status) r.status = item.status;
          if (idx >= 0) {
            newExams[idx] = { ...newExams[idx], results: [...(newExams[idx].results || []), r] };
          } else {
            newExams.push({ _id: newExams.length, _skip: false, date: item.date, results: [r] });
          }
        }
        onUpdate({ ...extracted, lab_review_items: newReview, lab_exams: newExams });
      };
      const handleRevConfirmMany = (itemsToConfirm) => {
        if (!itemsToConfirm || itemsToConfirm.length === 0) return;
        const keyDate   = new Set(itemsToConfirm.map(it => `${it.key}|${it.date}`));
        const newReview = (extracted.lab_review_items || []).filter(r => !keyDate.has(`${r.key}|${r.date}`));
        const newExams  = (extracted.lab_exams || []).map(e => ({ ...e, results: [...(e.results || [])] }));
        for (const item of itemsToConfirm) {
          const finalValue = item.proposed_value;
          const finalUnit  = item.proposed_unit || LAB_REVIEW_TRUSTED_UNITS[item.key] || "";
          if (finalValue == null && !item.qualitative) continue;
          const r = { name: item.label, param_key: item.key, panel: item.panel || "custom" };
          if (finalValue != null) { r.value = String(finalValue); r.unit = finalUnit; }
          if (item.qualitative) r.qualitative = item.qualitative;
          if (item.status) r.status = item.status;
          const idx = newExams.findIndex(e => e.date === item.date);
          if (idx >= 0) {
            newExams[idx].results.push(r);
          } else {
            newExams.push({ _id: newExams.length, _skip: false, date: item.date, results: [r] });
          }
        }
        onUpdate({ ...extracted, lab_review_items: newReview, lab_exams: newExams });
      };
      const handleRevIgnore = (item) => {
        onUpdate({ ...extracted, lab_review_items: (extracted.lab_review_items || []).filter(r => !(r.key === item.key && r.date === item.date)) });
      };
      return (
        <LabValueReviewPanel
          items={extracted.lab_review_items || []}
          trustedUnits={LAB_REVIEW_TRUSTED_UNITS}
          onConfirm={handleRevConfirm}
          onConfirmMany={handleRevConfirmMany}
          onIgnore={handleRevIgnore}
        />
      );
    }
    case "instrumental_findings":
      return (
        <DeletableList
          items={extracted.instrumental_findings || []}
          getLabel={f => `${f.examLabel || f.examType || "Esame"}${f.date ? ` — ${fmtIso(f.date)}` : ""}${f.summary ? `: ${f.summary.slice(0, 60)}` : ""}`}
          onChange={items => onUpdate({ ...extracted, instrumental_findings: items })}
        />
      );
    case "exam_imaging":
      return (
        <DeletableList
          items={extracted.exam_imaging || []}
          getLabel={f => `${f.examLabel || "Imaging"}${f.territory ? ` (${f.territory})` : ""}${f.date ? ` [${f.date}]` : ""}`}
          onChange={items => onUpdate({ ...extracted, exam_imaging: items })}
        />
      );
    default:
      return <SectionPreview section={section} data={extracted[section]} />;
  }
}

// ── MultiVisitInput ──────────────────────────────────────────────────────────

function MultiVisitInput({ blocks, onChange }) {
  const addBlock = () => {
    const newId = Date.now();
    onChange([...blocks, { id: newId, date: "", text: "", visitType: "follow_up" }]);
  };

  const removeBlock = (id) => {
    onChange(blocks.filter(b => b.id !== id));
  };

  const updateBlock = (id, field, value) => {
    onChange(blocks.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const VISIT_TYPE_OPTIONS = [
    { value: "follow_up",    label: "Follow-up" },
    { value: "workup",       label: "Workup / valutazione" },
    { value: "prima_visita", label: "Prima visita" },
    { value: "teleconsulto", label: "Teleconsulto" },
  ];

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-600">
        Aggiungi una voce per ogni lettera o referto. Ogni blocco viene analizzato
        separatamente e salvato come visita storica distinta nella timeline del paziente.
        Il sistema riconosce automaticamente duplicati, continuità terapeutiche e conflitti.
      </div>
      <div className="flex items-start gap-1.5 text-[10px] text-teal-700 bg-teal-50 border border-teal-200 rounded-md px-2.5 py-1.5">
        <ScanSearch className="w-3 h-3 flex-shrink-0 mt-0.5" />
        <span>
          Elaborazione <strong>100% locale</strong> — nessun dato inviato a servizi esterni.
          La riconciliazione con lo storico del paziente avviene in automatico.
        </span>
      </div>

      <div className="space-y-3 max-h-[52vh] overflow-y-auto pr-1">
        {blocks.map((block, idx) => (
          <div
            key={block.id}
            className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2"
          >
            {/* Block header */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#0A2540] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                Visita {idx + 1}
                {block.source_filename && (
                  <span
                    className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-violet-50 border border-violet-200 text-violet-700 max-w-[180px] truncate"
                    title={block.source_filename}
                  >
                    {block.source_filename}
                  </span>
                )}
              </span>
              {blocks.length >= 2 && (
                <button
                  type="button"
                  onClick={() => removeBlock(block.id)}
                  className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-500 transition-colors px-1.5 py-0.5 rounded hover:bg-red-50"
                  title="Rimuovi questa visita"
                >
                  <X className="w-3 h-3" /> Rimuovi visita
                </button>
              )}
            </div>

            {/* Date + visit type row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 w-20 flex-shrink-0">
                  Data *
                </label>
                <input
                  type="date"
                  required
                  value={block.date}
                  onChange={e => updateBlock(block.id, "date", e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400"
                />
                {!block.date && (
                  <span className="text-[10px] text-red-400">Obbligatorio</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex-shrink-0">
                  Tipo
                </label>
                <select
                  value={block.visitType || "follow_up"}
                  onChange={e => updateBlock(block.id, "visitType", e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400 cursor-pointer"
                >
                  {VISIT_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Letter text */}
            <div className="space-y-0.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Testo lettera / referto *
              </label>
              <Textarea
                value={block.text}
                onChange={e => updateBlock(block.id, "text", e.target.value)}
                placeholder="Incolla qui il testo della lettera di visita o del referto…"
                className="min-h-[110px] font-mono text-xs resize-y"
              />
              <div className="flex justify-end">
                <span className={`text-[10px] ${block.text.trim().length < 30 && block.text.length > 0 ? "text-red-400" : "text-gray-400"}`}>
                  {block.text.length} car.{block.text.trim().length < 30 && block.text.length > 0 ? " (min 30)" : ""}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addBlock}
        className="flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-900 border border-dashed border-teal-300 hover:border-teal-500 rounded-md px-3 py-2 w-full justify-center hover:bg-teal-50 transition-all"
      >
        <Plus className="w-3.5 h-3.5" /> Aggiungi un'altra visita
      </button>
    </div>
  );
}

// ── ItemStatusBadge ───────────────────────────────────────────────────────────

function ItemStatusBadge({ status, reason }) {
  if (!status) return null;
  const meta = STATUS_META[status];
  if (!meta) return null;

  const colorMap = {
    teal:   "bg-teal-50   text-teal-700   border-teal-200",
    gray:   "bg-gray-100  text-gray-500   border-gray-200",
    blue:   "bg-blue-50   text-blue-700   border-blue-200",
    red:    "bg-red-50    text-red-700    border-red-200",
    amber:  "bg-amber-50  text-amber-700  border-amber-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
  };

  const cls = colorMap[meta.color] || "bg-gray-100 text-gray-500 border-gray-200";

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded border ${cls} whitespace-nowrap`}
      title={reason || meta.desc}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: meta.dot, display: "inline-block", flexShrink: 0 }} />
      {meta.label}
    </span>
  );
}

// ── ReconciliationSummary — global status legend for the review ───────────────

function ReconciliationSummary({ visitResults }) {
  const counts = { new: 0, continuity: 0, duplicate: 0, conflict: 0, update: 0, uncertain: 0 };
  for (const v of visitResults) {
    const d = v.draft;
    for (const item of [...(d.therapies || []), ...(d.assessments || []), ...(d.lab_exams || [])]) {
      if (item._status) counts[item._status] = (counts[item._status] || 0) + 1;
    }
  }
  const active = Object.entries(counts).filter(([, n]) => n > 0);
  if (active.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50">
      {active.map(([status, n]) => (
        <span key={status} className="flex items-center gap-1">
          <ItemStatusBadge status={status} />
          <span className="text-[10px] text-gray-500">×{n}</span>
        </span>
      ))}
    </div>
  );
}

// ── ReconciliationItemList — shows therapies/assessments/labs with status ─────

function ReconciliationItemList({ items, type, onToggleSkip }) {
  if (!items || items.length === 0) return null;

  const LABELS = { therapies: "Terapie", assessments: "Score / clinimetrie", lab_exams: "Lab" };
  const label = LABELS[type] || type;

  return (
    <div className="space-y-1">
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</div>
      <div className="space-y-0.5">
        {items.map((item, i) => {
          const name = item.drug_name || item.index_type || item.panel || item.category || `#${i + 1}`;
          const value = item.score != null ? ` — ${item.score}` : item.dose ? ` ${item.dose}` : "";
          const isSkipped = !!item._skip;
          return (
            <div
              key={i}
              className={`flex items-center gap-2 text-xs rounded px-1.5 py-0.5 ${isSkipped ? "opacity-50" : ""}`}
            >
              <input
                type="checkbox"
                checked={!isSkipped}
                onChange={() => onToggleSkip && onToggleSkip(i, !isSkipped)}
                className="w-3 h-3 accent-teal-600 flex-shrink-0"
                title={isSkipped ? "Clicca per includere" : "Clicca per escludere"}
              />
              <span className={`flex-1 truncate ${isSkipped ? "line-through text-gray-400" : "text-gray-700"}`}>
                {name}{value}
              </span>
              {item._status && (
                <ItemStatusBadge status={item._status} reason={item._statusReason} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── VISIT_TYPE_LABELS (shared) ───────────────────────────────────────────────

const VISIT_TYPE_LABELS = {
  follow_up:    "Follow-up",
  workup:       "Workup",
  prima_visita: "Prima visita",
  teleconsulto: "Teleconsulto",
};

// ── MultiVisitWizard — orchestrates per-visit step-by-step review ─────────────

function MultiVisitWizard({ visitResults, onUpdate, onApply, applying, applyProgress }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [phase, setPhase]           = useState("wizard"); // "wizard" | "summary"

  const handleNext = () => {
    if (currentIdx < visitResults.length - 1) setCurrentIdx(currentIdx + 1);
    else setPhase("summary");
  };

  const handlePrev = () => {
    if (phase === "summary") { setPhase("wizard"); setCurrentIdx(visitResults.length - 1); }
    else if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
  };

  const updateCurrentDraft = (draft) => {
    const updated = [...visitResults];
    updated[currentIdx] = { ...updated[currentIdx], draft };
    onUpdate(updated);
  };

  const updateCurrentVisitType = (vType) => {
    const updated = [...visitResults];
    const prev = updated[currentIdx];
    updated[currentIdx] = { ...prev, visitType: vType, draft: { ...prev.draft, visit_type: vType } };
    onUpdate(updated);
  };

  const toggleItemSkip = (section, itemIdx) => {
    const updated = [...visitResults];
    const draft   = { ...updated[currentIdx].draft };
    draft[section] = (draft[section] || []).map((item, i) =>
      i === itemIdx ? { ...item, _skip: !item._skip } : item
    );
    updated[currentIdx] = { ...updated[currentIdx], draft };
    onUpdate(updated);
  };

  const toggleIncluded = (checked) => {
    const updated = [...visitResults];
    updated[currentIdx] = { ...updated[currentIdx], included: checked };
    onUpdate(updated);
  };

  if (phase === "summary") {
    return (
      <WizardFinalSummary
        visitResults={visitResults}
        onApply={onApply}
        applying={applying}
        applyProgress={applyProgress}
        onBack={handlePrev}
      />
    );
  }

  const visit  = visitResults[currentIdx];
  const isFirst = currentIdx === 0;
  const isLast  = currentIdx === visitResults.length - 1;

  return (
    <WizardVisitStep
      visit={visit}
      visitIdx={currentIdx}
      total={visitResults.length}
      isFirst={isFirst}
      isLast={isLast}
      onUpdateDraft={updateCurrentDraft}
      onUpdateVisitType={updateCurrentVisitType}
      onToggleItemSkip={toggleItemSkip}
      onToggleIncluded={toggleIncluded}
      onNext={handleNext}
      onPrev={handlePrev}
    />
  );
}

// ── WizardSection — collapsible labeled section ───────────────────────────────

function WizardSection({ label, subtitle, color, count, open, onToggle, empty, children, badge, badgeColor }) {
  const C = {
    blue:    { bg: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-700",    dot: "bg-blue-500" },
    gray:    { bg: "bg-gray-50",    border: "border-gray-200",    text: "text-gray-600",    dot: "bg-gray-400" },
    purple:  { bg: "bg-purple-50",  border: "border-purple-200",  text: "text-purple-700",  dot: "bg-purple-500" },
    violet:  { bg: "bg-violet-50",  border: "border-violet-200",  text: "text-violet-700",  dot: "bg-violet-500" },
    emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" },
    amber:   { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700",   dot: "bg-amber-500" },
    teal:    { bg: "bg-teal-50",    border: "border-teal-200",    text: "text-teal-700",    dot: "bg-teal-500" },
  };
  const c  = C[color]     || C.gray;
  const bc = C[badgeColor] || C.amber;
  return (
    <div className={`rounded-lg border ${c.border} overflow-hidden`}>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-3 py-2 ${c.bg} text-left hover:brightness-95 transition-all`}
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
        <span className={`font-semibold text-xs ${c.text}`}>{label}</span>
        {count > 0 && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ml-0.5 ${c.bg} ${c.text} border ${c.border}`}>
            {count}
          </span>
        )}
        {badge && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded border ml-0.5 ${bc.bg} ${bc.text} ${bc.border}`}>
            {badge}
          </span>
        )}
        <span className="ml-auto text-gray-400">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>
      </button>
      {open && (
        <div className="px-3 py-2.5 bg-white space-y-2">
          {subtitle && <p className="text-[10px] text-gray-400">{subtitle}</p>}
          {count === 0 && !children
            ? <p className="text-xs text-gray-400 italic">{empty}</p>
            : children}
        </div>
      )}
    </div>
  );
}

// ── DAS28 joint groups (module-level) ────────────────────────────────────────
const DAS28_GROUPS = [
  { key: "shoulders", label: "Spalle",            max: 2  },
  { key: "elbows",    label: "Gomiti",            max: 2  },
  { key: "wrists",    label: "Polsi",             max: 2  },
  { key: "mcp",       label: "MCP (metacarpofalangee)", max: 10 },
  { key: "pip",       label: "PIP (interfalangee prossimali)", max: 10 },
  { key: "knees",     label: "Ginocchia",         max: 2  },
];

// ── HomuculusSVG — simplified anatomical front-view with joint markers ────────
function HomuculusSVG({ joints }) {
  const jc = k => joints?.[k] || { dolenti: 0, tumefatte: 0 };
  const mix = (k, _max) => {
    const d = jc(k).dolenti  || 0;
    const t = jc(k).tumefatte || 0;
    if (d === 0 && t === 0) return "#e5e7eb";
    if (d > 0 && t > 0)    return "#c084fc"; // purple — both
    if (d > 0)              return "#f87171"; // red
    return "#60a5fa";                         // blue
  };
  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0">
      <svg viewBox="0 0 80 200" className="w-14 h-auto" aria-label="Homunculus articolare">
        {/* Body silhouette */}
        <ellipse cx="40" cy="12" rx="11" ry="11" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1" />
        <rect x="35" y="22" width="10" height="8" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="0.8" rx="1" />
        <rect x="24" y="30" width="32" height="44" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1" rx="3" />
        <rect x="9"  y="30" width="13" height="28" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="0.8" rx="3" />
        <rect x="58" y="30" width="13" height="28" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="0.8" rx="3" />
        <rect x="8"  y="60" width="12" height="25" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="0.8" rx="3" />
        <rect x="60" y="60" width="12" height="25" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="0.8" rx="3" />
        <rect x="7"  y="87" width="14" height="20" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="0.8" rx="2" />
        <rect x="59" y="87" width="14" height="20" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="0.8" rx="2" />
        <rect x="26" y="75" width="13" height="40" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="0.8" rx="3" />
        <rect x="41" y="75" width="13" height="40" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="0.8" rx="3" />
        <rect x="26" y="118" width="13" height="36" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="0.8" rx="3" />
        <rect x="41" y="118" width="13" height="36" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="0.8" rx="3" />
        {/* Joint markers */}
        <circle cx="20" cy="31" r="5"   fill={mix("shoulders", 2)}  stroke="#9ca3af" strokeWidth="0.8" />
        <circle cx="60" cy="31" r="5"   fill={mix("shoulders", 2)}  stroke="#9ca3af" strokeWidth="0.8" />
        <circle cx="13" cy="60" r="4.5" fill={mix("elbows", 2)}     stroke="#9ca3af" strokeWidth="0.8" />
        <circle cx="67" cy="60" r="4.5" fill={mix("elbows", 2)}     stroke="#9ca3af" strokeWidth="0.8" />
        <rect x="8"  y="83" width="12" height="5" fill={mix("wrists", 2)}  stroke="#9ca3af" strokeWidth="0.8" rx="1" />
        <rect x="60" y="83" width="12" height="5" fill={mix("wrists", 2)}  stroke="#9ca3af" strokeWidth="0.8" rx="1" />
        <rect x="8"  y="91" width="14" height="6" fill={mix("mcp", 10)}    stroke="#9ca3af" strokeWidth="0.8" rx="1" />
        <rect x="58" y="91" width="14" height="6" fill={mix("mcp", 10)}    stroke="#9ca3af" strokeWidth="0.8" rx="1" />
        <rect x="8"  y="100" width="14" height="5" fill={mix("pip", 10)}   stroke="#9ca3af" strokeWidth="0.8" rx="1" />
        <rect x="58" y="100" width="14" height="5" fill={mix("pip", 10)}   stroke="#9ca3af" strokeWidth="0.8" rx="1" />
        <circle cx="32" cy="117" r="5.5" fill={mix("knees", 2)} stroke="#9ca3af" strokeWidth="0.8" />
        <circle cx="48" cy="117" r="5.5" fill={mix("knees", 2)} stroke="#9ca3af" strokeWidth="0.8" />
      </svg>
      <div className="flex flex-col gap-0.5 text-[7.5px] text-gray-400">
        <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block flex-shrink-0" /> dolente</span>
        <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block flex-shrink-0" /> tumefatta</span>
        <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block flex-shrink-0" /> entrambe</span>
      </div>
    </div>
  );
}

// ── ComponentField — small labeled number input ───────────────────────────────
function ComponentField({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] text-gray-500 font-medium w-8">{label}</span>
      <input
        type="number" min="0" max="28"
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        placeholder="—"
        className="w-10 text-center text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-teal-400 bg-white"
      />
    </div>
  );
}

// ── ExamObjSection — section B: joint exam with homunculus ────────────────────
function ExamObjSection({ draft, onUpdateDraft, confirmed, onSetConfirmed }) {
  const refA = (draft.assessments || []).find(
    a => a.tender_count != null || a.swollen_count != null
  );
  const [tjc, setTjc] = useState(refA?.tender_count ?? "");
  const [sjc, setSjc] = useState(refA?.swollen_count ?? "");
  const [joints, setJoints] = useState(() => {
    if (draft._joint_data) return draft._joint_data;
    const j = {};
    DAS28_GROUPS.forEach(g => { j[g.key] = { dolenti: 0, tumefatte: 0 }; });
    return j;
  });
  const [showGrid, setShowGrid] = useState(false);

  const originalText = draft.visit_sections?.esame_obj || "";
  const lowConf = refA?.notes?.includes("ambiguo");

  const gridTJC = DAS28_GROUPS.reduce((s, g) => s + (parseInt(joints[g.key]?.dolenti)  || 0), 0);
  const gridSJC = DAS28_GROUPS.reduce((s, g) => s + (parseInt(joints[g.key]?.tumefatte) || 0), 0);
  const gridUsed = gridTJC > 0 || gridSJC > 0;

  const commitToGlobal = (newTjc, newSjc, newJoints) => {
    const tjcVal = newTjc !== "" ? parseInt(newTjc) : null;
    const sjcVal = newSjc !== "" ? parseInt(newSjc) : null;
    const updatedAssessments = (draft.assessments || []).map(a => ({
      ...a,
      tender_count:  tjcVal,
      swollen_count: sjcVal,
    }));
    onUpdateDraft({ ...draft, assessments: updatedAssessments, _joint_data: newJoints });
  };

  const handleTjc = val => {
    setTjc(val); if (confirmed) onSetConfirmed(false);
    commitToGlobal(val, sjc, joints);
  };
  const handleSjc = val => {
    setSjc(val); if (confirmed) onSetConfirmed(false);
    commitToGlobal(tjc, val, joints);
  };
  const handleJoint = (key, type, val) => {
    const g = DAS28_GROUPS.find(x => x.key === key);
    const clamped = Math.min(Math.max(parseInt(val) || 0, 0), g?.max || 10);
    const next = { ...joints, [key]: { ...joints[key], [type]: clamped } };
    setJoints(next);
    if (confirmed) onSetConfirmed(false);
    const nTjc = DAS28_GROUPS.reduce((s, g) => s + (parseInt(next[g.key]?.dolenti)  || 0), 0);
    const nSjc = DAS28_GROUPS.reduce((s, g) => s + (parseInt(next[g.key]?.tumefatte) || 0), 0);
    setTjc(nTjc); setSjc(nSjc);
    commitToGlobal(nTjc, nSjc, next);
  };

  return (
    <div className="space-y-3">
      {/* TJC / SJC + homunculus */}
      <div className="flex items-stretch gap-3">
        {/* TJC card */}
        <div className="flex-1 rounded-lg border border-red-200 bg-red-50 p-2.5 text-center">
          <div className="text-[9px] font-bold uppercase tracking-wider text-red-400 mb-0.5">TJC · dolenti</div>
          <input
            type="number" min="0" max="28"
            value={tjc}
            onChange={e => handleTjc(e.target.value)}
            className="w-full text-3xl font-bold text-red-700 border-0 focus:outline-none text-center bg-transparent"
            placeholder="—"
          />
          <div className="text-[9px] text-red-300">/ 28</div>
        </div>
        {/* Homunculus */}
        <HomuculusSVG joints={joints} />
        {/* SJC card */}
        <div className="flex-1 rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-center">
          <div className="text-[9px] font-bold uppercase tracking-wider text-blue-400 mb-0.5">SJC · tumefatte</div>
          <input
            type="number" min="0" max="28"
            value={sjc}
            onChange={e => handleSjc(e.target.value)}
            className="w-full text-3xl font-bold text-blue-700 border-0 focus:outline-none text-center bg-transparent"
            placeholder="—"
          />
          <div className="text-[9px] text-blue-300">/ 28</div>
        </div>
      </div>

      {lowConf && (
        <div className="text-[10px] px-2.5 py-1.5 rounded border border-amber-200 bg-amber-50 text-amber-700 flex items-center gap-1.5">
          <span>⚠</span>
          <span>Valori riconosciuti con <strong>bassa confidenza</strong> — verificare sul testo originale.</span>
        </div>
      )}

      {/* DAS28 joint grid */}
      <div>
        <button
          type="button"
          onClick={() => setShowGrid(v => !v)}
          className="flex items-center gap-1.5 text-[11px] text-teal-700 hover:text-teal-900 font-medium"
        >
          {showGrid
            ? <><ChevronDown className="w-3 h-3" /> Nascondi griglia articolare DAS28</>
            : <><ChevronRight className="w-3 h-3" /> Apri griglia articolare DAS28 (distribuzione per distretto)</>}
          {gridUsed && <span className="ml-2 text-[9px] text-teal-600 border border-teal-300 rounded px-1 py-0.5">griglia attiva</span>}
        </button>
        {showGrid && (
          <div className="mt-2 rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px]">
                  <th className="text-left px-2.5 py-1.5 text-gray-500 font-medium">Distretto</th>
                  <th className="text-center px-2 py-1.5 text-red-500 font-medium">Dolenti</th>
                  <th className="text-center px-2 py-1.5 text-blue-500 font-medium">Tumefatte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {DAS28_GROUPS.map(g => (
                  <tr key={g.key} className="hover:bg-gray-50">
                    <td className="px-2.5 py-1 text-gray-700">{g.label} <span className="text-gray-400">/{g.max}</span></td>
                    <td className="px-2 py-0.5 text-center">
                      <input
                        type="number" min="0" max={g.max}
                        value={joints[g.key]?.dolenti || 0}
                        onChange={e => handleJoint(g.key, "dolenti", e.target.value)}
                        className={`w-12 text-center border rounded px-1 py-0.5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-teal-400 ${
                          (joints[g.key]?.dolenti || 0) > 0
                            ? "border-red-300 bg-red-50 text-red-700"
                            : "border-gray-200 bg-white text-gray-400"
                        }`}
                      />
                    </td>
                    <td className="px-2 py-0.5 text-center">
                      <input
                        type="number" min="0" max={g.max}
                        value={joints[g.key]?.tumefatte || 0}
                        onChange={e => handleJoint(g.key, "tumefatte", e.target.value)}
                        className={`w-12 text-center border rounded px-1 py-0.5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-teal-400 ${
                          (joints[g.key]?.tumefatte || 0) > 0
                            ? "border-blue-300 bg-blue-50 text-blue-700"
                            : "border-gray-200 bg-white text-gray-400"
                        }`}
                      />
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-bold border-t-2 border-gray-300 text-xs">
                  <td className="px-2.5 py-1.5 text-gray-700">Totale DAS28</td>
                  <td className="px-2 py-1.5 text-center text-red-700">{gridTJC}</td>
                  <td className="px-2 py-1.5 text-center text-blue-700">{gridSJC}</td>
                </tr>
              </tbody>
            </table>
            {gridUsed && (
              <div className="text-[9px] text-teal-600 px-2.5 py-1 border-t border-teal-100 bg-teal-50">
                I totali sopra (TJC/SJC) si aggiornano automaticamente dalla griglia.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Original text */}
      {originalText ? (
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            Testo originale estratto (Esame Obiettivo)
          </div>
          <p className="text-xs text-gray-600 font-mono whitespace-pre-wrap leading-relaxed">{originalText}</p>
        </div>
      ) : (
        <p className="text-[10px] text-gray-400 italic">Nessun testo di esame obiettivo estratto dalla lettera.</p>
      )}

      {/* Mandatory confirmation */}
      <div className={`rounded-lg border px-3 py-2.5 ${confirmed ? "border-teal-200 bg-teal-50" : "border-amber-200 bg-amber-50"}`}>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => onSetConfirmed(e.target.checked)}
            className="w-4 h-4 accent-teal-600 flex-shrink-0 mt-0.5"
          />
          <div>
            <div className={`text-xs font-semibold ${confirmed ? "text-teal-800" : "text-amber-800"}`}>
              {confirmed ? "✓ Esame obiettivo articolare confermato" : "Conferma richiesta — obbligatoria prima di avanzare"}
            </div>
            <div className={`text-[10px] mt-0.5 ${confirmed ? "text-teal-600" : "text-amber-600"}`}>
              Ho verificato TJC, SJC e il testo estratto. I valori sono corretti.
            </div>
          </div>
        </label>
      </div>
    </div>
  );
}

// ── ClinimetrieSection — section C: scores with source labels + editable fields
function ClinimetrieSection({ draft, onUpdateDraft, confirmed, onSetConfirmed }) {
  const assessments = draft.assessments || [];
  const originalText = draft.visit_sections?.esame_obj || "";

  const [editedScores, setEditedScores] = useState(() => {
    const m = {};
    assessments.forEach((a, i) => { m[i] = a.score ?? ""; });
    return m;
  });

  const getSource = (a) => {
    if (a.notes?.includes("ambiguo"))
      return { label: "incerto",    bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200", icon: "?" };
    if (a.score == null)
      return { label: "incompleto", bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200",  icon: "~" };
    if (a.tender_count != null || a.swollen_count != null)
      return { label: "calcolato",  bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200",  icon: "≈" };
    return   { label: "dal testo",  bg: "bg-teal-50",   text: "text-teal-700",   border: "border-teal-200",   icon: "T" };
  };

  const updateAssessments = (updater) => {
    onUpdateDraft({ ...draft, assessments: assessments.map(updater) });
  };

  const handleScore = (i, val) => {
    const next = { ...editedScores, [i]: val };
    setEditedScores(next);
    if (confirmed) onSetConfirmed(false);
    updateAssessments((a, idx) =>
      idx === i ? { ...a, score: val === "" ? null : parseFloat(val) } : a
    );
  };

  const handleComponent = (i, field, val) => {
    if (confirmed) onSetConfirmed(false);
    updateAssessments((a, idx) =>
      idx === i ? { ...a, [field]: val === "" ? null : parseFloat(val) } : a
    );
  };

  const handleToggleSkip = (i) => {
    updateAssessments((a, idx) =>
      idx === i ? { ...a, _skip: !a._skip } : a
    );
  };

  const hasData = assessments.length > 0;
  const isDAS28Like = (a) =>
    ["das28", "cdai", "sdai"].some(k => (a.index_type || "").toLowerCase().includes(k));

  return (
    <div className="space-y-3">
      {assessments.length === 0 && (
        <p className="text-xs text-gray-400 italic">Nessuna clinimetria rilevata.</p>
      )}

      <div className="space-y-2">
        {assessments.map((a, i) => {
          const src = getSource(a);
          return (
            <div
              key={i}
              className={`rounded-lg border p-2.5 space-y-2 transition-opacity ${
                a._skip ? "opacity-50 border-gray-200 bg-gray-50" : "border-gray-200 bg-white"
              }`}
            >
              {/* Header row */}
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="checkbox"
                  checked={!a._skip}
                  onChange={() => handleToggleSkip(i)}
                  className="w-3.5 h-3.5 accent-purple-600 flex-shrink-0"
                />
                <span className={`font-bold text-sm ${a._skip ? "line-through text-gray-400" : "text-[#0A2540]"}`}>
                  {a.index_type}
                </span>
                {a.date && <span className="text-[10px] text-gray-400">{a.date}</span>}
                <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${src.bg} ${src.text} ${src.border}`}>
                  {src.icon} {src.label}
                </span>
                {a.interpretation && (
                  <span className="text-[10px] text-gray-400 ml-auto">{a.interpretation}</span>
                )}
                <ItemStatusBadge status={a._status} reason={a._statusReason} />
              </div>

              {/* Editable fields */}
              {!a._skip && (
                <div className="flex items-center gap-3 flex-wrap pl-6">
                  {/* Score */}
                  <div>
                    <div className="text-[9px] text-gray-400 mb-0.5">Score</div>
                    <input
                      type="number" step="0.01"
                      value={editedScores[i] ?? ""}
                      onChange={e => handleScore(i, e.target.value)}
                      placeholder="—"
                      className={`w-20 text-center text-sm font-bold border rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-teal-400 ${
                        src.label === "incerto"    ? "border-violet-300 bg-violet-50 text-violet-700" :
                        src.label === "incompleto" ? "border-amber-300  bg-amber-50  text-amber-700"  :
                        src.label === "calcolato"  ? "border-amber-200  bg-amber-50  text-amber-700"  :
                                                     "border-teal-300   bg-teal-50   text-teal-700"
                      }`}
                    />
                  </div>

                  {/* Component counts (TJC/SJC) for DAS28-like indices */}
                  {(isDAS28Like(a) || a.tender_count != null || a.swollen_count != null) && (
                    <div className="flex items-center gap-2">
                      <ComponentField
                        label="TJC"
                        value={a.tender_count}
                        onChange={v => handleComponent(i, "tender_count", v)}
                      />
                      <ComponentField
                        label="SJC"
                        value={a.swollen_count}
                        onChange={v => handleComponent(i, "swollen_count", v)}
                      />
                    </div>
                  )}

                  {/* Ambiguity warning */}
                  {a.notes && (
                    <div className="text-[10px] text-amber-700 flex items-center gap-1">
                      <span>⚠</span><span>{a.notes}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Original text */}
      {originalText && (
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            Testo originale (Esame Obiettivo / Clinimetrie)
          </div>
          <p className="text-xs text-gray-600 font-mono whitespace-pre-wrap leading-relaxed">{originalText}</p>
        </div>
      )}

      {/* Mandatory confirmation */}
      {hasData && (
        <div className={`rounded-lg border px-3 py-2.5 ${confirmed ? "border-teal-200 bg-teal-50" : "border-amber-200 bg-amber-50"}`}>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => onSetConfirmed(e.target.checked)}
              className="w-4 h-4 accent-teal-600 flex-shrink-0 mt-0.5"
            />
            <div>
              <div className={`text-xs font-semibold ${confirmed ? "text-teal-800" : "text-amber-800"}`}>
                {confirmed ? "✓ Clinimetrie confermate" : "Conferma richiesta — obbligatoria prima di avanzare"}
              </div>
              <div className={`text-[10px] mt-0.5 ${confirmed ? "text-teal-600" : "text-amber-600"}`}>
                Ho verificato tutti i valori. Gli score sono corretti e pronti per il salvataggio.
              </div>
            </div>
          </label>
        </div>
      )}
    </div>
  );
}

// ── WizardVisitStep — single visit, 5 sections ────────────────────────────────

function WizardVisitStep({
  visit, visitIdx, total, isFirst, isLast,
  onUpdateDraft, onUpdateVisitType, onToggleItemSkip, onToggleIncluded,
  onNext, onPrev,
}) {
  const [examObjConfirmed, setExamObjConfirmed] = useState(false);
  const [clinConfirmed,    setClinConfirmed]    = useState(false);
  const [sections, setSections] = useState({ A: true, B: true, C: true, D: true, E: true });

  const d          = visit.draft;
  const isIncluded = visit.included !== false;
  const hasConflicts = [...(d.therapies || []), ...(d.assessments || [])].some(x => x._status === ITEM_STATUS.CONFLICT);

  // ── Lab review handlers ───────────────────────────────────────────────────
  const reviewItems = d.lab_review_items || [];

  function handleLabReviewConfirm(item, { value, unit } = {}) {
    const newReviewItems = reviewItems.filter(r => !(r.key === item.key && r.date === item.date));
    let newLabExams = [...(d.lab_exams || [])];
    const finalValue = value != null ? value : item.proposed_value;
    const finalUnit  = unit  != null ? unit  : (item.proposed_unit || "");
    if (finalValue != null || item.qualitative) {
      const examIdx = newLabExams.findIndex(e => e.panel === item.panel && e.date === item.date);
      const r = { name: item.label, param_key: item.key };
      if (finalValue != null) { r.value = String(finalValue); r.unit = finalUnit; }
      if (item.qualitative) r.qualitative = item.qualitative;
      if (item.status) r.status = item.status;
      if (examIdx >= 0) {
        newLabExams[examIdx] = { ...newLabExams[examIdx], results: [...(newLabExams[examIdx].results || []), r] };
      } else {
        newLabExams.push({ _id: newLabExams.length, _skip: false, panel: item.panel, category: item.panel, date: item.date, results: [r] });
      }
    }
    onUpdateDraft({ ...d, lab_review_items: newReviewItems, lab_exams: newLabExams });
  }

  function handleLabReviewConfirmMany(itemsToConfirm) {
    if (!itemsToConfirm || itemsToConfirm.length === 0) return;
    const keyDate        = new Set(itemsToConfirm.map(it => `${it.key}|${it.date}`));
    const newReviewItems = reviewItems.filter(r => !keyDate.has(`${r.key}|${r.date}`));
    const newLabExams    = (d.lab_exams || []).map(e => ({ ...e, results: [...(e.results || [])] }));
    for (const item of itemsToConfirm) {
      const finalValue = item.proposed_value;
      const finalUnit  = item.proposed_unit || LAB_REVIEW_TRUSTED_UNITS[item.key] || "";
      if (finalValue == null && !item.qualitative) continue;
      const r = { name: item.label, param_key: item.key };
      if (finalValue != null) { r.value = String(finalValue); r.unit = finalUnit; }
      if (item.qualitative) r.qualitative = item.qualitative;
      if (item.status) r.status = item.status;
      const examIdx = newLabExams.findIndex(e => e.panel === item.panel && e.date === item.date);
      if (examIdx >= 0) {
        newLabExams[examIdx].results.push(r);
      } else {
        newLabExams.push({ _id: newLabExams.length, _skip: false, panel: item.panel, category: item.panel, date: item.date, results: [r] });
      }
    }
    onUpdateDraft({ ...d, lab_review_items: newReviewItems, lab_exams: newLabExams });
  }

  function handleLabReviewIgnore(item) {
    onUpdateDraft({ ...d, lab_review_items: reviewItems.filter(r => !(r.key === item.key && r.date === item.date)) });
  }

  // Section data
  const therapiesIn  = (d.therapies || []).filter(t => t._status === ITEM_STATUS.CONTINUITY);
  const therapiesOut = (d.therapies || []).filter(t => t._status !== ITEM_STATUS.CONTINUITY);
  const assessments  = d.assessments || [];
  const labs         = d.lab_exams   || [];
  const imaging      = d.instrumental_findings || [];

  // Blocking conditions for navigation
  const hasExamData = !!(d.visit_sections?.esame_obj?.trim()) ||
    assessments.some(a => a.tender_count != null || a.swollen_count != null);
  const hasCliData  = assessments.filter(a => !a._skip).length > 0;
  const examBlocked = hasExamData && !examObjConfirmed;
  const clinBlocked = hasCliData  && !clinConfirmed;
  const canProceed  = !examBlocked && !clinBlocked;

  const toggle = (k) => setSections(prev => ({ ...prev, [k]: !prev[k] }));

  const handleNext = () => {
    if (!canProceed) {
      toast.error(
        examBlocked && clinBlocked
          ? "Conferma obbligatoria: verifica e conferma Esame obiettivo e Clinimetrie prima di procedere."
          : examBlocked
          ? "Conferma obbligatoria: verifica e conferma l'Esame obiettivo prima di procedere."
          : "Conferma obbligatoria: verifica e conferma le Clinimetrie prima di procedere."
      );
      return;
    }
    onNext();
  };

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="font-semibold text-[#0A2540]">Passo {visitIdx + 1} di {total}</span>
          <span className="text-gray-400">{Math.round((visitIdx / total) * 100)}% completato</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div
            className="bg-teal-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${(visitIdx / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Visit header */}
      <div className={`rounded-lg border px-3 py-2.5 flex items-center gap-2 flex-wrap ${hasConflicts ? "border-red-200 bg-red-50" : "border-teal-200 bg-teal-50"}`}>
        <Calendar className={`w-4 h-4 flex-shrink-0 ${hasConflicts ? "text-red-500" : "text-teal-600"}`} />
        <span className={`font-semibold text-sm ${hasConflicts ? "text-red-800" : "text-[#0A2540]"}`}>{visit.label}</span>
        {hasConflicts && (
          <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded font-semibold">⚠ conflitti da risolvere</span>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[10px] text-gray-500">Tipo:</span>
          <select
            value={d.visit_type || visit.visitType || "follow_up"}
            onChange={e => onUpdateVisitType(e.target.value)}
            className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"
          >
            {Object.entries(VISIT_TYPE_LABELS).map(([val, lbl]) => (
              <option key={val} value={val}>{lbl}</option>
            ))}
          </select>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={isIncluded}
              onChange={e => onToggleIncluded(e.target.checked)}
              className="w-3.5 h-3.5 accent-teal-600"
            />
            <span className="text-[10px] text-gray-600">Includi</span>
          </label>
        </div>
      </div>

      {/* 5 sections */}
      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">

        {/* A — Terapia in ingresso */}
        <WizardSection
          label="A. Terapia in ingresso"
          subtitle="Farmaci già in corso al momento di questa visita"
          color="blue" count={therapiesIn.length} open={sections.A} onToggle={() => toggle("A")}
          empty="Nessuna terapia in continuità rilevata"
        >
          <div className="space-y-0.5">
            {therapiesIn.map((t, i) => {
              const globalIdx = (d.therapies || []).indexOf(t);
              return (
                <div key={i} className={`flex items-center gap-2 text-xs py-0.5 ${t._skip ? "opacity-50" : ""}`}>
                  <input type="checkbox" checked={!t._skip}
                    onChange={() => onToggleItemSkip("therapies", globalIdx)}
                    className="w-3 h-3 accent-blue-600 flex-shrink-0" />
                  <span className={`flex-1 ${t._skip ? "line-through text-gray-400" : "text-gray-700"}`}>
                    <strong>{t.drug_name}</strong>
                    {t.dose && ` · ${t.dose}`}{t.frequency && ` · ${t.frequency}`}
                  </span>
                  <ItemStatusBadge status={t._status} reason={t._statusReason} />
                </div>
              );
            })}
          </div>
        </WizardSection>

        {/* B — Esame obiettivo articolare */}
        <WizardSection
          label="B. Esame obiettivo articolare"
          subtitle="Homunculus DAS28 · TJC/SJC · testo originale — conferma obbligatoria"
          color="gray"
          count={hasExamData ? 1 : 0}
          open={sections.B} onToggle={() => toggle("B")}
          empty="Nessun dato di esame obiettivo rilevato"
          badge={examObjConfirmed ? "✓ Confermato" : (hasExamData ? "⚠ Da confermare" : null)}
          badgeColor={examObjConfirmed ? "teal" : "amber"}
        >
          <ExamObjSection
            draft={d}
            onUpdateDraft={onUpdateDraft}
            confirmed={examObjConfirmed}
            onSetConfirmed={setExamObjConfirmed}
          />
        </WizardSection>

        {/* C — Clinimetrie */}
        <WizardSection
          label="C. Clinimetrie"
          subtitle="Score editabili · sorgente (testo/calcolato/incompleto/incerto) · conferma obbligatoria"
          color="purple"
          count={assessments.filter(a => !a._skip).length}
          open={sections.C} onToggle={() => toggle("C")}
          empty="Nessuna clinimetria rilevata"
          badge={assessments.length > 0 ? (clinConfirmed ? "✓ Confermato" : "⚠ Da confermare") : null}
          badgeColor={clinConfirmed ? "teal" : "amber"}
        >
          <ClinimetrieSection
            draft={d}
            onUpdateDraft={onUpdateDraft}
            confirmed={clinConfirmed}
            onSetConfirmed={setClinConfirmed}
          />
        </WizardSection>

        {/* D — Esami */}
        <WizardSection
          label="D. Esami"
          subtitle="Laboratorio, imaging e visite specialistiche"
          color="violet"
          count={labs.filter(l => !l._skip).length + imaging.filter(f => !f._skip).length}
          open={sections.D} onToggle={() => toggle("D")}
          empty={labs.length === 0 && imaging.length === 0 && reviewItems.length === 0 ? "Nessun esame rilevato" : null}
        >
          <div className="space-y-3">
            {labs.length > 0 && (
              <div className="space-y-0.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Laboratorio</div>
                {labs.map((l, i) => (
                  <div key={i} className={`flex items-center gap-2 text-xs ${l._skip ? "opacity-50" : ""}`}>
                    <input type="checkbox" checked={!l._skip}
                      onChange={() => onToggleItemSkip("lab_exams", i)}
                      className="w-3 h-3 accent-violet-600 flex-shrink-0" />
                    <span className={`flex-1 truncate ${l._skip ? "line-through text-gray-400" : "text-gray-700"}`}>
                      <strong>{l.panel || l.category || "Esame"}</strong>
                      {l.date && <span className="text-gray-400 text-[10px]"> · {l.date}</span>}
                      {l.results && l.results.length > 0 && <span className="text-gray-400 text-[10px]"> · {l.results.length} valori</span>}
                    </span>
                    <ItemStatusBadge status={l._status} reason={l._statusReason} />
                  </div>
                ))}
              </div>
            )}
            {/* Lab valori da revisionare (low-confidence: unità non specificata per parametri critici) */}
            {reviewItems.length > 0 && (
              <LabValueReviewPanel
                items={reviewItems}
                trustedUnits={LAB_REVIEW_TRUSTED_UNITS}
                onConfirm={handleLabReviewConfirm}
                onConfirmMany={handleLabReviewConfirmMany}
                onIgnore={handleLabReviewIgnore}
              />
            )}
            {imaging.length > 0 && (
              <div className="space-y-0.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Imaging / strumentale</div>
                {imaging.map((f, i) => (
                  <div key={i} className={`flex items-center gap-2 text-xs ${f._skip ? "opacity-50" : ""}`}>
                    <input type="checkbox" checked={!f._skip}
                      onChange={() => onToggleItemSkip("instrumental_findings", i)}
                      className="w-3 h-3 accent-violet-600 flex-shrink-0" />
                    <span className={`flex-1 truncate ${f._skip ? "line-through text-gray-400" : "text-gray-700"}`}>
                      <strong>{f.examLabel || f.examType || "Esame"}</strong>
                      {f.territory && ` · ${f.territory}`}
                      {f.date && <span className="text-gray-400 text-[10px]"> · {f.date}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </WizardSection>

        {/* E — Terapia in uscita */}
        <WizardSection
          label="E. Terapia in uscita"
          subtitle="Piano terapeutico in uscita; evidenziate le decisioni di questa visita"
          color="emerald"
          count={therapiesOut.filter(t => !t._skip).length}
          open={sections.E} onToggle={() => toggle("E")}
          empty="Nessuna modifica terapeutica rilevata"
        >
          {(() => {
            const started   = therapiesOut.filter(t => t._visit_event === "start");
            const stopped   = therapiesOut.filter(t => t._visit_event === "stop");
            const changed   = therapiesOut.filter(t => t._visit_event === "change");
            const decided   = new Set([...started, ...stopped, ...changed]);
            const conflicts = therapiesOut.filter(t => !decided.has(t) && t._status === ITEM_STATUS.CONFLICT);
            const uncertain = therapiesOut.filter(t => !decided.has(t) && t._status === ITEM_STATUS.UNCERTAIN);
            const flagged   = new Set([...conflicts, ...uncertain]);
            const ongoing   = therapiesOut.filter(t => !decided.has(t) && !flagged.has(t) && t.status !== "discontinued");
            const past      = therapiesOut.filter(t => !decided.has(t) && !flagged.has(t) && t.status === "discontinued");

            const Group = ({ title, items, dotColor }) => {
              if (!items.length) return null;
              return (
                <div className="space-y-0.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: dotColor }}>{title}</div>
                  {items.map((t, i) => {
                    const globalIdx = (d.therapies || []).indexOf(t);
                    return (
                      <div key={i} className={`flex items-center gap-2 text-xs py-0.5 ${t._skip ? "opacity-50" : ""}`}>
                        <input type="checkbox" checked={!t._skip}
                          onChange={() => onToggleItemSkip("therapies", globalIdx)}
                          className="w-3 h-3 flex-shrink-0" />
                        <span className={`flex-1 ${t._skip ? "line-through text-gray-400" : "text-gray-700"}`}>
                          <strong>{t.drug_name}</strong>
                          {t.dose && ` · ${t.dose}`}{t.frequency && ` · ${t.frequency}`}
                        </span>
                        <ItemStatusBadge status={t._status} reason={t._statusReason} />
                      </div>
                    );
                  })}
                </div>
              );
            };

            return (
              <div className="space-y-3">
                <Group title="▶ Avviati"            items={started}   dotColor="#10b981" />
                <Group title="✕ Sospesi"            items={stopped}   dotColor="#ef4444" />
                <Group title="↑ Modificati"         items={changed}   dotColor="#f59e0b" />
                <Group title="⚠ Conflitti"          items={conflicts} dotColor="#ef4444" />
                <Group title="? Da verificare"      items={uncertain} dotColor="#8b5cf6" />
                <Group title="• In corso (invariata)" items={ongoing} dotColor="#6b7280" />
                <Group title="• Pregresse"          items={past}      dotColor="#9ca3af" />
              </div>
            );
          })()}
        </WizardSection>
      </div>

      {/* Blocking banner */}
      {!canProceed && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
          <div>
            <strong>Conferma obbligatoria prima di procedere:</strong>{" "}
            {examBlocked && clinBlocked
              ? "Sezioni B (Esame obiettivo) e C (Clinimetrie) richiedono verifica e conferma."
              : examBlocked
              ? "Sezione B (Esame obiettivo articolare) richiede verifica e conferma."
              : "Sezione C (Clinimetrie) richiede verifica e conferma."}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <Button variant="outline" onClick={onPrev} disabled={isFirst} className="text-sm">
          ← Torna alla visita precedente
        </Button>
        <Button
          onClick={handleNext}
          disabled={!canProceed}
          className={`text-sm transition-colors ${
            canProceed
              ? "bg-[#0A2540] hover:bg-[#051626] text-white"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          {isLast ? "Procedi al riepilogo →" : "Conferma e passa alla visita successiva →"}
        </Button>
      </div>
    </div>
  );
}

// ── WizardFinalSummary — shown after all visits reviewed ─────────────────────

const IMPORT_SECTION_LABELS = {
  patient: "Dati paziente",
  visit_sections: "Visita odierna / EO",
  exam_imaging: "Esami in visione",
  assessments: "Clinimetrie",
  therapies: "Terapie",
  lab_exams: "Esami di laboratorio",
  instrumental_findings: "Esami strumentali",
  sclero_profile: "Profilo SSc",
  ra_profile: "Profilo AR",
  spa_profile: "Profilo SpA",
  sle_profile: "Profilo LES",
  profilo_generale: "Profilo generale",
  comorbidita: "Comorbidità",
  intolleranze: "Intolleranze / Allergie",
  raccordo_events: "Cronologia clinica",
};

function draftSectionHasData(draft, key) {
  const v = draft?.[key];
  if (Array.isArray(v)) return v.some(x => !x?._skip);
  if (v && typeof v === "object") return Object.values(v).some(Boolean);
  return !!v;
}

function WizardFinalSummary({ visitResults, onApply, applying, applyProgress, onBack }) {
  const included = visitResults.filter(v => v.included !== false);
  const excluded = visitResults.filter(v => v.included === false);

  let totalNew = 0, totalDup = 0, totalCont = 0, totalConflict = 0, totalUpdate = 0;
  const changes = { started: [], stopped: [], changed: [] };

  for (const v of included) {
    const d = v.draft;
    const all = [...(d.therapies || []), ...(d.assessments || [])];
    for (const item of all) {
      if (item._status === ITEM_STATUS.NEW)        totalNew++;
      else if (item._status === ITEM_STATUS.DUPLICATE)  totalDup++;
      else if (item._status === ITEM_STATUS.CONTINUITY) totalCont++;
      else if (item._status === ITEM_STATUS.CONFLICT)   totalConflict++;
      else if (item._status === ITEM_STATUS.UPDATE)     totalUpdate++;
    }
    for (const ex of (d.lab_exams || [])) {
      for (const r of (ex.results || [])) {
        if (r._status === ITEM_STATUS.NEW)        totalNew++;
        else if (r._status === ITEM_STATUS.DUPLICATE)  totalDup++;
        else if (r._status === ITEM_STATUS.CONFLICT)   totalConflict++;
      }
    }
    for (const s of [d._ra_profile_status, d._spa_profile_status, d._sle_profile_status, d._sclero_profile_status]) {
      if (s === ITEM_STATUS.CONFLICT) totalConflict++;
    }
    for (const t of (d.therapies || [])) {
      if (t._skip) continue;
      if (t._visit_event === "start")  changes.started.push({ drug: t.drug_name, date: v.date });
      if (t._visit_event === "stop")   changes.stopped.push({ drug: t.drug_name, date: v.date });
      if (t._visit_event === "change") changes.changed.push({ drug: t.drug_name, date: v.date });
    }
  }

  const hasChanges = changes.started.length + changes.stopped.length + changes.changed.length > 0;

  const notImported = [];
  const seenNotImported = new Set();
  for (const v of included) {
    const sel = v.selected || {};
    for (const key of Object.keys(IMPORT_SECTION_LABELS)) {
      if (sel[key] === false && draftSectionHasData(v.draft, key) && !seenNotImported.has(key)) {
        seenNotImported.add(key);
        notImported.push(IMPORT_SECTION_LABELS[key]);
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-lg border border-[#0A2540] bg-[#0A2540]/5 px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <Layers className="w-4 h-4 text-[#0A2540]" />
          <span className="font-bold text-sm text-[#0A2540]">Riepilogo importazione</span>
        </div>
        <p className="text-sm text-[#0A2540]">
          <strong>{included.length} visite</strong> verranno create nella timeline del paziente
          {excluded.length > 0 && <span className="text-gray-400"> ({excluded.length} escluse)</span>}.
        </p>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-2">
        {totalNew > 0 && (
          <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-teal-200 bg-teal-50 text-teal-700">
            <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />
            <strong>{totalNew}</strong> nuovi dati
          </div>
        )}
        {totalCont > 0 && (
          <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700">
            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
            <strong>{totalCont}</strong> continuità
          </div>
        )}
        {totalDup > 0 && (
          <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-500">
            <span className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0" />
            <strong>{totalDup}</strong> già presenti (saltati)
          </div>
        )}
        {totalUpdate > 0 && (
          <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700">
            <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
            <strong>{totalUpdate}</strong> aggiornamenti
          </div>
        )}
        {totalConflict > 0 && (
          <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 font-semibold">
            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
            <strong>{totalConflict}</strong> conflitti aperti
          </div>
        )}
      </div>

      {/* Conflict warning */}
      {totalConflict > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
          <div>
            <strong>{totalConflict} conflitti non risolti.</strong>{" "}
            I dati in conflitto non verranno sovrascritti.
            Puoi importare comunque o tornare alle visite per risolverli.
          </div>
        </div>
      )}

      {/* Sezioni non importate */}
      {notImported.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Sezioni non importate</div>
          <div className="flex flex-wrap gap-1.5">
            {notImported.map((label) => (
              <span key={label} className="text-[11px] px-2 py-0.5 rounded-md border border-gray-200 bg-white text-gray-500">
                {label}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-gray-400">Dati presenti nelle lettere ma esclusi dall'importazione.</p>
        </div>
      )}

      {/* Therapy changes */}
      {hasChanges && (
        <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Modifiche terapeutiche rilevate</div>
          {changes.started.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-emerald-600 uppercase mb-0.5">▶ Avviati</div>
              {changes.started.map((t, i) => (
                <div key={i} className="text-xs text-gray-700"><strong>{t.drug}</strong><span className="text-gray-400 ml-1">· {t.date}</span></div>
              ))}
            </div>
          )}
          {changes.stopped.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-red-600 uppercase mb-0.5">✕ Sospesi</div>
              {changes.stopped.map((t, i) => (
                <div key={i} className="text-xs text-gray-700"><strong>{t.drug}</strong><span className="text-gray-400 ml-1">· {t.date}</span></div>
              ))}
            </div>
          )}
          {changes.changed.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-amber-600 uppercase mb-0.5">↑ Ripresi / Modificati</div>
              {changes.changed.map((t, i) => (
                <div key={i} className="text-xs text-gray-700"><strong>{t.drug}</strong><span className="text-gray-400 ml-1">· {t.date}</span></div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Visit list */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-3 pt-2.5 pb-1.5 border-b border-gray-100">
          Visite che verranno create ({included.length})
        </div>
        <div className="divide-y divide-gray-100">
          {included.map((v, i) => {
            const stats = draftSummaryStats(v.draft);
            const hasC  = [...(v.draft.therapies || []), ...(v.draft.assessments || [])].some(x => x._status === ITEM_STATUS.CONFLICT);
            return (
              <div key={v.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                <span className="text-gray-400 font-mono w-4">{i + 1}.</span>
                <Calendar className="w-3 h-3 text-teal-500 flex-shrink-0" />
                <span className="font-medium text-[#0A2540]">{v.label}</span>
                <span className="text-[9px] text-gray-400">{VISIT_TYPE_LABELS[v.draft.visit_type || v.visitType] || "Follow-up"}</span>
                <div className="ml-auto flex items-center gap-1">
                  {hasC && <span className="text-[9px] text-red-500 font-bold">⚠</span>}
                  <span className="text-gray-400">{stats.toSave} da salvare</span>
                  {stats.skipped > 0 && <span className="text-gray-300 ml-1">· {stats.skipped} skip</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save progress */}
      {applyProgress && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-teal-200 bg-teal-50 text-teal-800 text-sm">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          <span>Salvataggio {applyProgress.label} ({applyProgress.current}/{applyProgress.total})…</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <Button variant="outline" onClick={onBack} disabled={applying} className="text-sm">
          ← Torna alla revisione
        </Button>
        <Button
          onClick={onApply}
          disabled={applying || included.length === 0}
          className="bg-[#0A2540] hover:bg-[#051626] text-white text-sm"
          data-testid="visit-apply-multi-btn"
        >
          {applying
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{applyProgress ? `Visita ${applyProgress.current}/${applyProgress.total}…` : "Salvataggio…"}</>
            : <><Check className="w-4 h-4 mr-2" />Importa tutte le visite ({included.length})</>}
        </Button>
      </div>
    </div>
  );
}

// ── (OLD MultiVisitReview removed — replaced by MultiVisitWizard above) ───────

function _UNUSED_MultiVisitReview({ visitResults, onUpdate, applyProgress }) {
  const [expanded, setExpanded]         = useState({});
  const [detailExpanded, setDetailExpanded] = useState({});

  const toggleExpanded = (id) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const toggleDetail = (id) =>
    setDetailExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const toggleIncluded = (idx, value) => {
    const updated = [...visitResults];
    updated[idx] = { ...updated[idx], included: value };
    onUpdate(updated);
  };

  const updateDraft = (idx, draft) => {
    const updated = [...visitResults];
    updated[idx] = { ...updated[idx], draft };
    onUpdate(updated);
  };

  const updateSelected = (idx, sel) => {
    const updated = [...visitResults];
    updated[idx] = { ...updated[idx], selected: sel };
    onUpdate(updated);
  };

  const updateVisitType = (idx, vType) => {
    const updated = [...visitResults];
    const prevDraft = updated[idx].draft;
    updated[idx] = { ...updated[idx], visitType: vType, draft: { ...prevDraft, visit_type: vType } };
    onUpdate(updated);
  };

  const toggleItemSkip = (vIdx, section, itemIdx, currentlySkipped) => {
    const updated = [...visitResults];
    const draft = { ...updated[vIdx].draft };
    draft[section] = (draft[section] || []).map((item, i) =>
      i === itemIdx ? { ...item, _skip: !currentlySkipped } : item
    );
    updated[vIdx] = { ...updated[vIdx], draft };
    onUpdate(updated);
  };

  const includedCount  = visitResults.filter(v => v.included !== false).length;
  const totalConflicts = visitResults.reduce((s, v) => {
    return s + [...(v.draft.therapies || []), ...(v.draft.assessments || [])].filter(x => x._status === ITEM_STATUS.CONFLICT).length;
  }, 0);

  return (
    <div className="space-y-3">
      {/* Header banner */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-900 text-sm">
        <Layers className="w-4 h-4 flex-shrink-0 text-blue-500" />
        <span>
          <strong>{visitResults.length} visite analizzate</strong> —{" "}
          {includedCount} selezionate per l'importazione.
          {totalConflicts > 0 && (
            <span className="ml-1 font-semibold text-red-700">
              ⚠ {totalConflicts} conflitti da verificare.
            </span>
          )}
        </span>
      </div>

      {/* Global reconciliation legend */}
      <ReconciliationSummary visitResults={visitResults} />

      {/* Progress indicator during save */}
      {applyProgress && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-teal-200 bg-teal-50 text-teal-800 text-sm">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          <span>Salvataggio {applyProgress.label} ({applyProgress.current}/{applyProgress.total})…</span>
        </div>
      )}

      {/* Visit accordion list */}
      <div className="space-y-2 max-h-[58vh] overflow-y-auto pr-1">
        {visitResults.map((v, idx) => {
          const d = v.draft;

          // Items to save (not skipped)
          const liveTherapies   = (d.therapies    || []).filter(x => !x._skip);
          const liveAssessments = (d.assessments  || []).filter(x => !x._skip);
          const liveLabs        = (d.lab_exams    || []).filter(x => !x._skip);
          const liveImaging     = (d.instrumental_findings || []).filter(x => !x._skip);

          // Items that will be skipped due to deduplication
          const skippedTherapies   = (d.therapies   || []).filter(x => x._skip && x._status);
          const skippedAssessments = (d.assessments || []).filter(x => x._skip && x._status);
          const skippedLabs        = (d.lab_exams   || []).filter(x => x._skip && x._status);

          const hasConflicts = [...(d.therapies || []), ...(d.assessments || [])].some(x => x._status === ITEM_STATUS.CONFLICT);
          const isExpanded   = !!expanded[v.id];
          const showDetail   = !!detailExpanded[v.id];
          const isIncluded   = v.included !== false;

          return (
            <Card
              key={v.id}
              className={`border transition-colors ${
                isIncluded
                  ? hasConflicts
                    ? isExpanded ? "border-red-400 bg-white" : "border-red-200 bg-white"
                    : isExpanded ? "border-teal-400 bg-white" : "border-teal-200 bg-white"
                  : "border-gray-200 bg-gray-50 opacity-60"
              }`}
            >
              {/* Card header */}
              <div className="flex items-center gap-2.5 p-3">
                <input
                  type="checkbox"
                  checked={isIncluded}
                  onChange={e => toggleIncluded(idx, e.target.checked)}
                  className="w-4 h-4 accent-teal-600 flex-shrink-0"
                  title={isIncluded ? "Escludi questa visita" : "Includi questa visita"}
                />
                <button
                  type="button"
                  className="flex-1 flex items-center gap-2 text-left min-w-0"
                  onClick={() => toggleExpanded(v.id)}
                >
                  <Calendar className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
                  <span className="font-semibold text-sm text-[#0A2540] truncate">{v.label}</span>
                  <div className="flex items-center gap-1 ml-1 flex-shrink-0 flex-wrap">
                    {hasConflicts && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-semibold">⚠ conflitto</span>
                    )}
                    {liveTherapies.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {liveTherapies.length} farmaci
                      </span>
                    )}
                    {liveAssessments.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {liveAssessments.length} score
                      </span>
                    )}
                    {liveLabs.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">
                        {liveLabs.length} lab
                      </span>
                    )}
                    {liveImaging.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        {liveImaging.length} esami
                      </span>
                    )}
                    {(skippedTherapies.length + skippedAssessments.length + skippedLabs.length) > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">
                        {skippedTherapies.length + skippedAssessments.length + skippedLabs.length} deduplicati
                      </span>
                    )}
                    {liveTherapies.length + liveAssessments.length + liveLabs.length + liveImaging.length === 0 && skippedTherapies.length + skippedAssessments.length === 0 && (
                      <span className="text-[9px] text-gray-400 italic">nessun dato estratto</span>
                    )}
                  </div>
                  <span className="ml-auto flex-shrink-0">
                    {isExpanded
                      ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                      : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                  </span>
                </button>
              </div>

              {/* Expanded: reconciliation summary + detail editor */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-3 pb-3 space-y-3">

                  {/* Visit type selector (editable in review) */}
                  <div className="flex items-center gap-2 pt-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Tipo visita</span>
                    <select
                      value={v.draft.visit_type || v.visitType || "follow_up"}
                      onChange={e => updateVisitType(idx, e.target.value)}
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400"
                    >
                      {Object.entries(VISIT_TYPE_LABELS).map(([val, lbl]) => (
                        <option key={val} value={val}>{lbl}</option>
                      ))}
                    </select>
                  </div>

                  {/* Reconciliation item lists (therapies, assessments, labs) with status badges and skip toggles */}
                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 space-y-3">
                    <ReconciliationItemList
                      items={d.therapies}
                      type="therapies"
                      onToggleSkip={(i, cur) => toggleItemSkip(idx, "therapies", i, cur)}
                    />
                    <ReconciliationItemList
                      items={d.assessments}
                      type="assessments"
                      onToggleSkip={(i, cur) => toggleItemSkip(idx, "assessments", i, cur)}
                    />
                    <ReconciliationItemList
                      items={d.lab_exams}
                      type="lab_exams"
                      onToggleSkip={(i, cur) => toggleItemSkip(idx, "lab_exams", i, cur)}
                    />
                    {d.therapies?.length === 0 && d.assessments?.length === 0 && d.lab_exams?.length === 0 && (
                      <p className="text-xs text-gray-400 italic">Nessun dato strutturato estratto da questa lettera.</p>
                    )}
                  </div>

                  {/* Link to full editable review */}
                  <div>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-[11px] text-teal-700 hover:text-teal-900 font-medium"
                      onClick={() => toggleDetail(v.id)}
                    >
                      {showDetail
                        ? <><ChevronDown className="w-3 h-3" /> Nascondi editor dettagliato</>
                        : <><ChevronRight className="w-3 h-3" /> Apri editor dettagliato (modifica tutti i campi)</>}
                    </button>
                    {showDetail && (
                      <div className="mt-2 border-t border-gray-100 pt-2">
                        <ExtractedReview
                          extracted={v.draft}
                          onUpdate={draft => updateDraft(idx, draft)}
                          selected={v.selected || DEFAULT_SELECTED}
                          setSelected={sel => updateSelected(idx, sel)}
                          originalText={null}
                          patient={null}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function SectionPreview({ section, data }) {
  if (section === "patient" && data) {
    return (
      <ul className="space-y-0.5">
        {Object.entries(data).filter(([, v]) => v).map(([k, v]) => (
          <li key={k}><span className="font-mono text-gray-400">{k}:</span> {String(v)}</li>
        ))}
      </ul>
    );
  }
  if (section === "assessments" && Array.isArray(data)) {
    return (
      <ul className="space-y-1">
        {data.map((a, i) => (
          <li key={`${a.index_type || "?"}-${a.date || i}`}>
            <span className="font-bold">{a.index_type}</span> · score {a.score ?? "—"} · {a.interpretation || "—"}
            {a.tender_count != null && ` · TJC ${a.tender_count}`}
            {a.swollen_count != null && ` · SJC ${a.swollen_count}`}
            {a.notes && <span className="text-amber-600"> ⚠ {a.notes}</span>}
          </li>
        ))}
      </ul>
    );
  }
  if (section === "therapies" && Array.isArray(data)) {
    return (
      <ul className="space-y-1">
        {data.map((t, i) => (
          <li key={`${t.drug_name || "?"}-${i}`}>
            <span className="font-bold">{t.drug_name}</span>
            {t.dose && ` ${t.dose}`}
            {t.frequency && ` ${t.frequency}`}
            {t.route && ` (${t.route})`}
            {" "}
            <span className="text-gray-400 text-[10px]">[{t.category}]</span>
          </li>
        ))}
      </ul>
    );
  }
  if (section === "lab_exams" && Array.isArray(data)) {
    return (
      <ul className="space-y-1">
        {data.map((e, i) => (
          <li key={`${e.category || "?"}-${i}`}>
            <span className="font-bold">{e.category}</span>:{" "}
            {(e.results || []).map((r) =>
              `${r.name}${r.value ? " " + r.value : ""}${r.unit ? " " + r.unit : ""}${r.qualitative ? " (" + r.qualitative + ")" : ""}${r.status && r.status !== "normal" ? " [" + r.status + "]" : ""}`
            ).join(", ")}
          </li>
        ))}
      </ul>
    );
  }
  if (section === "ra_profile" && data) {
    const STATUS = { positive: "Positivo", negative: "Negativo", unknown: "N/D" };
    return (
      <ul className="space-y-0.5">
        {data.rf_status && data.rf_status !== "unknown" && (
          <li>RF: <span className={data.rf_status === "positive" ? "text-red-600 font-medium" : "text-green-700 font-medium"}>{STATUS[data.rf_status]}</span>{data.rf_titer ? ` — ${data.rf_titer} UI/mL` : ""}</li>
        )}
        {data.acpa_status && data.acpa_status !== "unknown" && (
          <li>Anti-CCP: <span className={data.acpa_status === "positive" ? "text-red-600 font-medium" : "text-green-700 font-medium"}>{STATUS[data.acpa_status]}</span>{data.acpa_titer ? ` — ${data.acpa_titer} UI/mL` : ""}</li>
        )}
        {data.disease_type && <li>Forma: {data.disease_type === "erosive" ? "Erosiva" : "Non erosiva"}</li>}
        {data.ild && <li>ILD polmonare: <span className="text-red-600 font-medium">presente</span></li>}
      </ul>
    );
  }
  if (section === "spa_profile" && data) {
    const FLAGS = [
      ["axial_involvement", "Coinvolgimento assiale"],
      ["peripheral_involvement", "Coinvolgimento periferico"],
      ["psoriasis", "Psoriasi"],
      ["uveitis", "Uveite"],
      ["ibd", "IBD/MICI"],
      ["dactylitis", "Dattilite"],
      ["enthesitis", "Entesite"],
    ];
    const active = FLAGS.filter(([k]) => data[k]);
    return <p className="text-sm">{active.map(([, l]) => l).join(" · ") || "—"}</p>;
  }
  if (section === "sle_profile" && data) {
    return (
      <ul className="space-y-0.5">
        {data.antibodies && Object.entries(data.antibodies).map(([k, v]) => (
          <li key={k}>
            <span className="font-medium uppercase text-[11px]">{k.replace(/_/g, "/")}</span>:{" "}
            <span className={v.status === "positive" ? "text-red-600 font-medium" : "text-green-700 font-medium"}>
              {v.status === "positive" ? "positivo" : "negativo"}
            </span>
            {v.titer ? ` (${v.titer})` : ""}
            {v.value ? ` — ${v.value}` : ""}
          </li>
        ))}
        {data.c3 && <li>C3: {data.c3} mg/dL</li>}
        {data.c4 && <li>C4: {data.c4} mg/dL</li>}
        {data.renal_involvement && <li>Nefrite lupica: <span className="text-red-600 font-medium">sì</span></li>}
        {data.proteinuria_24h && <li>Proteinuria 24h: {data.proteinuria_24h} g/24h</li>}
      </ul>
    );
  }
  if (section === "sclero_profile" && data) {
    return (
      <ul className="space-y-0.5">
        {Object.entries(data)
          .filter(([, v]) => v !== null && v !== undefined && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length > 0)
          .map(([k, v]) => (
            <li key={k}>
              <span className="font-bold uppercase text-[10px]">{k}:</span>{" "}
              {Object.entries(v)
                .filter(([, vv]) => vv !== null && vv !== undefined && vv !== "")
                .map(([kk, vv]) => `${kk}=${vv}`)
                .join(", ")}
            </li>
          ))}
        {typeof data.subtype === "string" && (
          <li><span className="font-bold uppercase text-[10px]">sottotipo:</span> {data.subtype}</li>
        )}
      </ul>
    );
  }
  if (section === "comorbidita" && Array.isArray(data)) {
    return (
      <ul className="space-y-0.5 list-disc list-inside">
        {data.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    );
  }
  if (section === "intolleranze" && Array.isArray(data)) {
    return (
      <ul className="space-y-0.5">
        {data.map((item, i) => (
          <li key={i}>
            <span className="font-bold">{item.drug}</span>
            {item.reason && <span className="text-gray-500"> — {item.reason}</span>}
          </li>
        ))}
      </ul>
    );
  }
  if (section === "visit_sections" && data && typeof data === "object") {
    const LABELS = {
      raccordo:    "Raccordo anamnestico",
      anamnesi:    "Anamnesi intervallare",
      esame_obj:   "Esame obiettivo",
      conclusioni: "Conclusioni",
      indicazioni: "Indicazioni",
      labs_text:   "Esami / Imaging (testo)",
    };
    return (
      <ul className="space-y-2">
        {Object.entries(data).map(([k, v]) => (
          <li key={k}>
            <div className="font-bold text-[11px] uppercase tracking-wide text-[#0A2540] mb-0.5">{LABELS[k] || k}</div>
            <div className="text-gray-600 leading-snug whitespace-pre-wrap">{v.length > 300 ? v.slice(0, 297) + "…" : v}</div>
          </li>
        ))}
      </ul>
    );
  }
  if ((section === "instrumental_findings" || section === "exam_imaging") && Array.isArray(data)) {
    return (
      <ul className="space-y-1.5">
        {data.map((f, i) => (
          <li key={`${f.examType}-${f.date || i}`} className="flex flex-col gap-0.5">
            <div>
              <span className="font-bold text-teal-700">{f.examLabel}</span>
              {f.territory && <span className="text-gray-500"> · {f.territory}</span>}
              {f.date && <span className="text-gray-400"> · {f.date}</span>}
            </div>
            {f.reportText && (
              <div className="text-gray-500 italic leading-snug">
                {f.reportText.length > 120 ? f.reportText.slice(0, 117) + "…" : f.reportText}
              </div>
            )}
          </li>
        ))}
      </ul>
    );
  }
  if (section === "requested_tests" && Array.isArray(data)) {
    return (
      <ul className="space-y-0.5 list-disc list-inside">
        {data.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    );
  }
  if (section === "profilo_generale" && data && typeof data === "object") {
    const LABELS = {
      anamnesi_fisiologica: "Anamnesi fisiologica",
      anamnesi_familiare:   "Anamnesi familiare",
      comorbidita_apr:      "Comorbidità / APR",
      terapia_domiciliare:  "Terapia domiciliare",
      allergie:             "Allergie",
    };
    return (
      <ul className="space-y-2">
        {Object.entries(LABELS)
          .filter(([k]) => data[k])
          .map(([k, label]) => (
            <li key={k}>
              <div className="font-bold text-[11px] uppercase tracking-wide text-[#0A2540] mb-0.5">{label}</div>
              <div className="text-gray-600 leading-snug whitespace-pre-wrap text-xs">
                {data[k].length > 200 ? data[k].slice(0, 197) + "…" : data[k]}
              </div>
            </li>
          ))}
      </ul>
    );
  }
  return null;
}
