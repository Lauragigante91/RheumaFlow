import React, { useState, useEffect, useMemo } from "react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Dialog, DialogContent } from "../ui/dialog";
import { Loader2, FileText, ScanSearch, Layers, X, Calendar, Plus } from "lucide-react";
import { toast } from "sonner";
import { assessmentsApi, scleroProfileApi, therapiesApi, labExamsApi, diseaseProfileApi, clinicalEventsApi } from "../../lib/api";
import { parseVisitText } from "../../lib/visitTextParser";
import { applyOneDraft, applyDraftBatch, computeLongitudinalState } from "../../lib/importApply";
import { reconcileDrafts, draftSummaryStats } from "../../lib/visitReconciler";
import { parseJointExam } from "../../lib/jointExamParser";
import ImportReviewScreen from "./ImportReviewScreen";

const SAMPLE = `Visita ambulatoriale del 15/02/2026.
Paziente: Mario Rossi, 58 anni, M.
Diagnosi: Artrite reumatoide sieropositiva.
Esame: 6 articolazioni dolenti (TJC), 4 tumefatte (SJC). DAS28-CRP 4.2 (alta attività). VAS-PtGA 50/100.
Esami: VES 32, PCR 18 mg/L, RF positivo, anti-CCP positivo.
Terapia in corso: Methotrexate 15 mg/sett s.c., Acido folico 5 mg, Prednisone 5 mg/die.`;

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
  const setOpen = controlled ? (v) => onOpenChange?.(v) : setInternalOpen;

  const [text, setText] = useState("");
  const [initialDateHint, setInitialDateHint] = useState("");
  const [step, setStep] = useState("input");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [mode, setMode] = useState("single");
  const [multiBlocks, setMultiBlocks] = useState([
    { id: 1, date: "", text: "", visitType: "follow_up" },
    { id: 2, date: "", text: "", visitType: "follow_up" },
  ]);
  const [multiExtracted, setMultiExtracted] = useState([]);
  const [multiApplyProgress, setMultiApplyProgress] = useState(null);
  const [fieldOverrides, setFieldOverrides] = useState({});

  const batchFieldConflicts = useMemo(() => {
    if (multiExtracted.length <= 1) return [];
    const activeDrafts = multiExtracted
      .filter(v => v.included !== false)
      .map(v => ({ draft: v.draft, selected: v.selected || DEFAULT_SELECTED }));
    const longiState = computeLongitudinalState(activeDrafts);
    return Object.entries(longiState)
      .filter(([, res]) => res.warn)
      .map(([field, res]) => ({ field, selected: res.selected, conflicts: res.conflicts }));
  }, [multiExtracted]);

  useEffect(() => {
    const conflictFields = new Set(batchFieldConflicts.map(c => c.field));
    setFieldOverrides(prev => {
      const stale = Object.keys(prev).filter(k => !conflictFields.has(k));
      if (stale.length === 0) return prev;
      const next = { ...prev };
      stale.forEach(k => delete next[k]);
      return next;
    });
  }, [batchFieldConflicts]);

  useEffect(() => {
    if (open && initialText) {
      setText(initialText);
      setInitialDateHint(initialDate || "");
    }
  }, [open]); // eslint-disable-line

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
    setLoading(false);
    setApplying(false);
    setStep("input");
    setMode("single");
    setMultiBlocks([{ id: 1, date: "", text: "", visitType: "follow_up" }, { id: 2, date: "", text: "", visitType: "follow_up" }]);
    setMultiExtracted([]);
    setMultiApplyProgress(null);
    setFieldOverrides({});
  };

  const close = () => {
    setOpen(false);
    setTimeout(reset, 200);
  };

  function buildEditableDraft(ext) {
    if (!ext) return null;
    const stamp = (arr) => (arr || []).map((item, i) => ({ ...item, _id: i, _skip: false }));
    const jointExam = parseJointExam(ext.visit_sections?.esame_obj || "");
    return {
      ...ext,
      physical_exam_joint_exam: jointExam.found ? jointExam.joints : {},
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
        _id: i, _skip: false,
        text: typeof item === "string" ? item : String(item),
      })),
      intolleranze:          (ext.intolleranze || []).map((item, i) => ({
        _id: i, _skip: false,
        drug:   (item && item.drug)   ? item.drug   : "",
        reason: (item && item.reason) ? item.reason : "",
      })),
    };
  }

  const parse = async () => {
    if (text.trim().length < 30) {
      toast.error("Inserisci almeno 30 caratteri di testo della visita");
      return;
    }
    setLoading(true);
    try {
      const res = parseVisitText(text);
      let draft = buildEditableDraft(res.extracted);
      const todayIso = new Date().toISOString().slice(0, 10);
      const isWeakDate = !draft.visit_date || draft.visit_date === todayIso || res._dateSource === "RE3";
      if (initialDateHint && isWeakDate) {
        if (res._trace) res._trace.push(`[DATE OVERRIDE] source=${res._dateSource} → applico hint PDF`);
        draft.visit_date = initialDateHint;
      }
      if (process.env.NODE_ENV !== "production" && res._trace?.length) {
        fetch("/api/debug/parse-trace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trace: res._trace }),
        }).catch(() => {});
      }

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
            sclero_profile:   scleroRes.status === "fulfilled" ? scleroRes.value : null,
            clinical_events:  ceRes.status    === "fulfilled" ? (ceRes.value    || []) : [],
          };
        } catch (_) {}
      }
      const [reconciledDraft] = reconcileDrafts([draft], existingData);
      draft = reconciledDraft;

      const stats = draftSummaryStats(draft);
      const result = {
        id:         "single",
        date:       draft.visit_date || "",
        visitType:  visitType || "follow_up",
        label:      "Visita",
        draft,
        included:   true,
        selected:   { ...DEFAULT_SELECTED },
        sourceText: text,
        total:      stats.toSave,
        stats,
      };
      setMultiExtracted([result]);
      setStep("review");
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

  const parseMulti = async () => {
    for (let i = 0; i < multiBlocks.length; i++) {
      const b = multiBlocks[i];
      if (!b.date) { toast.error(`Visita ${i + 1}: inserisci la data.`); return; }
      if (b.text.trim().length < 30) { toast.error(`Visita ${i + 1}: inserisci almeno 30 caratteri di testo.`); return; }
    }
    setLoading(true);
    try {
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

      rawResults.sort((a, b) => (a.block.date || "").localeCompare(b.block.date || ""));

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
            therapies:       thRes.status    === "fulfilled" ? (thRes.value    || []) : [],
            assessments:     assRes.status   === "fulfilled" ? (assRes.value   || []) : [],
            lab_exams:       labRes.status   === "fulfilled" ? (labRes.value   || []) : [],
            disease_profiles: {
              ra:  raRes.status  === "fulfilled" ? raRes.value  : null,
              spa: spaRes.status === "fulfilled" ? spaRes.value : null,
              sle: sleRes.status === "fulfilled" ? sleRes.value : null,
            },
            sclero_profile:  scleroRes.status === "fulfilled" ? scleroRes.value : null,
            clinical_events: ceRes.status === "fulfilled" ? (ceRes.value || []) : [],
          };
        } catch (_) {}
      }

      const rawDrafts        = rawResults.map(r => r.draft);
      const reconciledDrafts = reconcileDrafts(rawDrafts, existingData);

      setFieldOverrides({});

      if (process.env.NODE_ENV !== "production") {
        const evNew  = reconciledDrafts.reduce((s, d) => s + (d.raccordo_events || []).filter(e => e.event_type && !e._skip).length, 0);
        const evSkip = reconciledDrafts.reduce((s, d) => s + (d.raccordo_events || []).filter(e => e._skip).length, 0);
        console.log(`[import multi][merge] eventi raccordo dopo deduplica: ${evNew} nuovi, ${evSkip} duplicati ignorati`);
      }

      const results = rawResults.map(({ block }, i) => {
        const draft = reconciledDrafts[i];
        const fmt   = block.date.split("-").reverse().join("/");
        const stats = draftSummaryStats(draft);
        return {
          id:         block.id,
          date:       block.date,
          visitType:  block.visitType || "follow_up",
          label:      `Visita ${i + 1} — ${fmt}`,
          draft,
          included:   true,
          selected:   { ...DEFAULT_SELECTED },
          sourceText: block.text,
          total:      stats.toSave,
          stats,
        };
      });

      setMultiExtracted(results);
      setStep("review");

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

  const applyOne = async (idx) => {
    if (!patient) return;
    const item = multiExtracted[idx];
    if (!item) return;
    const vType = item.draft?.visit_type || item.visitType || visitType || "follow_up";
    const { updates, errors } = await applyOneDraft(
      item.draft, patient, item.selected, vType, item.draft?.source_filename || null
    );
    if (errors.length === 0) {
      setMultiExtracted(prev => prev.map((v, i) => i === idx ? { ...v, _confirmed: true } : v));
      toast.success(`Importazione completata (${updates} sezioni aggiornate)`);
      onImported?.();
    } else if (updates > 0) {
      toast.warning(`${updates} sezioni importate, ${errors.length} errori — vedi console`);
      errors.forEach(msg => toast.error(msg, { duration: 8000 }));
    } else {
      errors.forEach(msg => toast.error(msg, { duration: 8000 }));
      throw new Error("Importazione fallita");
    }
  };

  function hasWarning(item) {
    if ((item.stats?.conflicts || 0) > 0) return true;
    if ((item.draft?.lab_review_items?.length || 0) > 0) return true;
    if ((item.draft?._parse_review?.unresolved?.length || 0) > 0) return true;
    return false;
  }

  const applyMulti = async () => {
    if (!patient) return;
    const candidates = multiExtracted.filter(v => v.included !== false && !v._confirmed);
    const toApply = candidates
      .filter(v => !hasWarning(v))
      .slice()
      .sort((a, b) => {
        const da = a.date || a.draft?.visit_date || "";
        const db = b.date || b.draft?.visit_date || "";
        return da.localeCompare(db);
      });
    const skipped = candidates.length - toApply.length;
    if (toApply.length === 0) {
      toast.warning(
        skipped > 0
          ? `Tutte le visite hanno warning da verificare. Revisionale singolarmente prima di confermare.`
          : "Nessuna visita selezionata per l'importazione."
      );
      return;
    }
    setApplying(true);
    const appliedSet = new Set(toApply);
    const { updates: totalUpdates, errors: allErrors } = await applyDraftBatch(
      toApply,
      patient,
      { defaultVisitType: visitType, onProgress: (p) => setMultiApplyProgress(p), fieldOverrides }
    );
    setApplying(false);
    setMultiApplyProgress(null);
    if (allErrors.length === 0) {
      setMultiExtracted(prev => prev.map(v => appliedSet.has(v) ? { ...v, _confirmed: true } : v));
      if (skipped > 0) {
        toast.success(`${toApply.length} visit${toApply.length > 1 ? "e" : "a"} importat${toApply.length > 1 ? "e" : "a"} (${totalUpdates} sezioni aggiornate) — ${skipped} con warning rimandate`);
      } else {
        toast.success(`${toApply.length} visite importate (${totalUpdates} sezioni aggiornate)`);
        close();
      }
      onImported?.();
    } else if (totalUpdates > 0) {
      toast.warning(`${totalUpdates} sezioni importate, ${allErrors.length} errori — vedi console`);
      allErrors.forEach(msg => toast.error(msg, { duration: 8000 }));
    } else {
      allErrors.forEach(msg => toast.error(msg, { duration: 8000 }));
    }
  };

  const isReview = step === "review";

  return (
    <>
      {!controlled && (
        <Button
          onClick={() => setOpen(true)}
          variant="outline"
          className="border-teal-300 text-teal-700 hover:bg-teal-50"
          data-testid="visit-import-btn"
        >
          <ScanSearch className="w-4 h-4 mr-2" /> Importa da testo visita
        </Button>
      )}

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
        <DialogContent
          className={isReview
            ? "w-screen h-screen max-w-none max-h-screen rounded-none p-0 overflow-hidden flex flex-col"
            : "max-w-4xl max-h-[92vh] overflow-y-auto"}
          data-testid="visit-import-dialog"
        >
          {isReview ? (
            <ImportReviewScreen
              visitResults={multiExtracted}
              onUpdate={setMultiExtracted}
              onConfirmOne={async (idx) => {
                if (multiExtracted.length === 1) {
                  await applyOne(idx);
                  close();
                } else {
                  await applyOne(idx);
                }
              }}
              onConfirmAll={async () => {
                await applyMulti();
              }}
              onCancel={() => { setMultiExtracted([]); setStep("input"); }}
              applying={applying}
              applyProgress={multiApplyProgress}
              batchFieldConflicts={batchFieldConflicts}
              fieldOverrides={fieldOverrides}
              onFieldOverride={(field, value) => setFieldOverrides(prev => ({ ...prev, [field]: value }))}
            />
          ) : (
            <>
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="flex items-center gap-2 text-base font-bold text-[#0A2540]">
                  <ScanSearch className="w-5 h-5 text-teal-600" /> Importa visita da testo
                </h2>
              </div>

              <div className="px-6 py-4 space-y-4">
                <div className="flex gap-1.5 p-1 bg-gray-100 rounded-lg w-fit">
                  <button
                    type="button"
                    onClick={() => setMode("single")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      mode === "single" ? "bg-white text-[#0A2540] shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" /> Visita singola
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("multi")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      mode === "multi" ? "bg-white text-[#0A2540] shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" /> Più visite
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
                      <button onClick={() => setText(SAMPLE)} className="text-xs text-gray-500 hover:text-[#0A2540] underline" type="button">
                        Usa testo esempio
                      </button>
                      <span className="text-xs text-gray-400">{text.length} caratteri</span>
                    </div>
                  </>
                ) : (
                  <MultiVisitInput blocks={multiBlocks} onChange={setMultiBlocks} />
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
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
              </div>
            </>
          )}
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

const VISIT_TYPE_OPTIONS_MULTI = [
  { value: "follow_up",    label: "Follow-up" },
  { value: "workup",       label: "Workup / valutazione" },
  { value: "prima_visita", label: "Prima visita" },
  { value: "teleconsulto", label: "Teleconsulto" },
];

function MultiVisitInput({ blocks, onChange }) {
  const addBlock = () => {
    onChange([...blocks, { id: Date.now(), date: "", text: "", visitType: "follow_up" }]);
  };
  const removeBlock = (id) => onChange(blocks.filter(b => b.id !== id));
  const updateBlock = (id, field, value) => onChange(blocks.map(b => b.id === id ? { ...b, [field]: value } : b));

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-600">
        Aggiungi una voce per ogni lettera o referto. Ogni blocco viene analizzato
        separatamente e salvato come visita storica distinta nella timeline del paziente.
        Il sistema riconosce automaticamente duplicati, continuità terapeutiche e conflitti.
      </div>
      <div className="flex items-start gap-1.5 text-[10px] text-teal-700 bg-teal-50 border border-teal-200 rounded-md px-2.5 py-1.5">
        <ScanSearch className="w-3 h-3 flex-shrink-0 mt-0.5" />
        <span>Elaborazione <strong>100% locale</strong> — nessun dato inviato a servizi esterni.</span>
      </div>
      <div className="space-y-3 max-h-[52vh] overflow-y-auto pr-1">
        {blocks.map((block, idx) => (
          <div key={block.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#0A2540] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                Visita {idx + 1}
                {block.source_filename && (
                  <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-violet-50 border border-violet-200 text-violet-700 max-w-[180px] truncate" title={block.source_filename}>
                    {block.source_filename}
                  </span>
                )}
              </span>
              {blocks.length >= 2 && (
                <button type="button" onClick={() => removeBlock(block.id)}
                  className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-500 transition-colors px-1.5 py-0.5 rounded hover:bg-red-50">
                  <X className="w-3 h-3" /> Rimuovi visita
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 w-20 flex-shrink-0">Data *</label>
                <input type="date" required value={block.date}
                  onChange={e => updateBlock(block.id, "date", e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400" />
                {!block.date && <span className="text-[10px] text-red-400">Obbligatorio</span>}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex-shrink-0">Tipo</label>
                <select value={block.visitType || "follow_up"}
                  onChange={e => updateBlock(block.id, "visitType", e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400 cursor-pointer">
                  {VISIT_TYPE_OPTIONS_MULTI.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-0.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Testo lettera / referto *</label>
              <Textarea value={block.text} onChange={e => updateBlock(block.id, "text", e.target.value)}
                placeholder="Incolla qui il testo della lettera di visita o del referto…"
                className="min-h-[110px] font-mono text-xs resize-y" />
              <div className="flex justify-end">
                <span className={`text-[10px] ${block.text.trim().length < 30 && block.text.length > 0 ? "text-red-400" : "text-gray-400"}`}>
                  {block.text.length} car.{block.text.trim().length < 30 && block.text.length > 0 ? " (min 30)" : ""}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={addBlock}
        className="flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-900 border border-dashed border-teal-300 hover:border-teal-500 rounded-md px-3 py-2 w-full justify-center hover:bg-teal-50 transition-all">
        <Plus className="w-3.5 h-3.5" /> Aggiungi un'altra visita
      </button>
    </div>
  );
}
