import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ClipboardList, FlaskConical, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { diseaseProfileApi } from "../../lib/api";
import { toast } from "sonner";

// ── Workup test key → Italian label ─────────────────────────────────────────
const TEST_LABELS = {
  cbc:            "Emocromo (CBC)",
  pcr_ves:        "PCR + VES",
  creatinine:     "Creatinina + eGFR",
  liver:          "AST / ALT / GGT",
  cpk:            "CPK / Aldolasi",
  vitd:           "25-OH Vitamina D",
  rf_anti_ccp:    "FR + Anti-CCP",
  ena:            "ENA panel",
  anca:           "ANCA (P/C)",
  ana:            "ANA / anti-dsDNA",
  urine:          "Urine (proteinuria)",
  quantiferon:    "Quantiferon / IGRA",
  hbv_screen:     "HBV DNA / HBsAg",
  lipids:         "Profilo lipidico",
  glucose:        "Glicemia",
  hrct:           "HRCT torace",
  eco_msk:        "Ecografia MSK",
  eco_vasc:       "Ecografia vascolare",
  rx_mani:        "Rx mani / piedi",
  rx_rachide:     "Rx rachide",
  rmn_rachide:    "RMN rachide",
  capillaroscopia:"Capillaroscopia",
  pet_ct:         "PET/TC vascolare",
  angio_ct:       "AngioCT / AngioMRI",
};

// ── Referral reason labels ───────────────────────────────────────────────────
const REFERRAL_LABELS = {
  artrite_reumatoide:    "Artrite Reumatoide",
  artrite_psoriasica:    "Artrite Psoriasica",
  spondilite:            "Spondilite Anchilosante / SpA",
  lupus:                 "Lupus eritematoso sistemico",
  sjogren:               "Sindrome di Sjögren",
  sclerosi_sistemica:    "Sclerosi Sistemica",
  miopatie_infiammatorie:"Miopatie Infiammatorie",
  vasculiti:             "Vasculiti",
  pmr_lvv:               "PMR / Vasculiti dei grossi vasi",
  artrosi:               "Artrosi",
  osteoporosi:           "Osteoporosi",
  gotta:                 "Gotta / Iperuricemia",
  fibromialgia:          "Fibromialgia",
  altro:                 "Altro",
};

// ── Status style map ─────────────────────────────────────────────────────────
const STATUS_CFG = {
  mancante:   { label: "Mancante",    cls: "bg-red-100   text-red-700   border-red-200"   },
  eseguito:   { label: "Eseguito",    cls: "bg-green-100 text-green-700 border-green-200" },
  programmato:{ label: "Programmato", cls: "bg-amber-100 text-amber-700 border-amber-200" },
};
const STATUS_CYCLE  = ["mancante", "eseguito", "programmato"];
const STATUS_LABELS = { mancante: "Mancante", eseguito: "Eseguito", programmato: "Programmato" };

// ── Date formatter ────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ── Main component ───────────────────────────────────────────────────────────
export default function RheumatologicStatusStrip({
  patientId,
  firstVisit,
  pastVisits,
  reportSections,
  toggleReportSection,
  onWorkupData,
}) {
  const [expanded,     setExpanded]     = useState(false);
  const [examStatuses, setExamStatuses] = useState({});
  const [saving,       setSaving]       = useState(false);

  // ── Stable firstVisit data object ────────────────────────────────────────
  const fvData = useMemo(() =>
    firstVisit?.data || firstVisit || {},
  [firstVisit]);

  // ── Sort workup visits newest-first ─────────────────────────────────────
  const sortedVisits = useMemo(() =>
    [...(pastVisits || [])].sort((a, b) =>
      (b.visit_date || "").localeCompare(a.visit_date || "")
    ), [pastVisits]);

  const lastVisit = sortedVisits[0] || null;
  const hasWorkup = sortedVisits.length > 0;
  const isOpenWkp = lastVisit && lastVisit.clinical_decision !== "converting";

  // ── Hypotheses: merge firstVisit + last workup visit ─────────────────────
  const hypotheses = useMemo(() => {
    const seen = new Set();
    const out  = [];
    const push = (str) => {
      (str || "").split(",").map(h => h.trim()).filter(Boolean).forEach(h => {
        if (!seen.has(h)) { seen.add(h); out.push(h); }
      });
    };
    push(fvData.suggested_diagnosis);
    if (lastVisit) push(lastVisit.diagnostic_hypotheses);
    return out;
  }, [fvData.suggested_diagnosis, lastVisit]);

  // ── Referral text ─────────────────────────────────────────────────────────
  const referralLabel = REFERRAL_LABELS[fvData.referral_reason] || fvData.referral_reason || "";
  const referralText  = useMemo(
    () => [referralLabel, fvData.rheumatologic_history_summary?.trim()].filter(Boolean).join("\n"),
    [referralLabel, fvData.rheumatologic_history_summary]
  );

  // ── Exam items to display ────────────────────────────────────────────────
  const examItems = useMemo(() => {
    const tests   = lastVisit?.requested_tests || fvData.requested_tests || [];
    const reqDate = lastVisit?.visit_date || fvData.referral_date || null;
    const items   = tests.map(key => ({ key, label: TEST_LABELS[key] || key, date: reqDate }));

    if (items.length === 0) {
      const notes = (lastVisit?.requested_tests_notes || fvData.requested_tests_notes || "").trim();
      if (notes) {
        notes.split("\n").filter(Boolean).forEach((line, i) =>
          items.push({ key: `note_${i}`, label: line, date: reqDate })
        );
      }
    }
    return items;
  }, [lastVisit, fvData.requested_tests, fvData.referral_date, fvData.requested_tests_notes]);

  // ── Load exam statuses from clinical_cockpit ─────────────────────────────
  const loadStatuses = useCallback(async () => {
    try {
      const doc = await diseaseProfileApi.get(patientId, "clinical_cockpit");
      if (doc?.data?.exam_statuses) setExamStatuses(doc.data.exam_statuses);
    } catch { /* silent */ }
  }, [patientId]);

  useEffect(() => { loadStatuses(); }, [loadStatuses]);

  // ── Propagate workup text for the report whenever relevant data changes ──
  useEffect(() => {
    if (!onWorkupData) return;
    const workup_motivo_text = [
      referralText && `Motivo di invio: ${referralText}`,
      hypotheses.length && `Ipotesi diagnostiche: ${hypotheses.join(", ")}`,
    ].filter(Boolean).join("\n");

    const examsLines = examItems.map(e => {
      const st = STATUS_LABELS[examStatuses[e.key] || "mancante"];
      const dt = e.date ? fmtDate(e.date) : "—";
      return `- ${e.label}  [${st}]  (richiesto: ${dt})`;
    });
    const workup_esami_text = examsLines.join("\n");

    onWorkupData({ workup_motivo_text, workup_esami_text });
  }, [referralText, hypotheses, examItems, examStatuses]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cycle exam status ─────────────────────────────────────────────────────
  const cycleStatus = useCallback(async (key) => {
    const cur  = examStatuses[key] || "mancante";
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length];
    const updated = { ...examStatuses, [key]: next };
    setExamStatuses(updated);
    setSaving(true);
    try {
      const doc = await diseaseProfileApi.get(patientId, "clinical_cockpit");
      await diseaseProfileApi.upsert(patientId, "clinical_cockpit", {
        ...(doc?.data || {}),
        exam_statuses: updated,
      });
    } catch {
      toast.error("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  }, [examStatuses, patientId]);

  // ── Exam table notes ──────────────────────────────────────────────────────
  const examNotes = (lastVisit?.requested_tests_notes || fvData.requested_tests_notes || "").trim();
  const showNotes = examNotes && examItems.some(e => !e.key.startsWith("note_"));

  // ── Report keys ───────────────────────────────────────────────────────────
  const wkpReportKey   = "workup_motivo_ipotesi";
  const examsReportKey = "workup_esami_richiesti";

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50/80 border-b border-gray-100">
        <span className="font-heading font-bold text-[11px] text-gray-600 uppercase tracking-[0.16em]">
          {hasWorkup && isOpenWkp ? "Workup reumatologico attivo" : "Monitoraggi / Esami attesi"}
        </span>

        {hasWorkup && isOpenWkp && (
          <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
            Workup aperto
          </span>
        )}
        {hasWorkup && !isOpenWkp && (
          <span className="text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
            Iter diagnostico concluso
          </span>
        )}

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Nascondi" : "Mostra dettagli"}
        </button>
      </div>

      {/* ── Body ── */}
      {hasWorkup ? (
        /* Workup mode — 3 columns */
        <div className="grid grid-cols-3 divide-x divide-gray-100">

          {/* Motivo di invio */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-indigo-600">
                <ClipboardList className="w-3 h-3" />
                Motivo di invio
              </div>
              {toggleReportSection && (
                <label title="Includi nel referto" className="flex items-center cursor-pointer" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={!!reportSections?.has(wkpReportKey)}
                    onChange={() => toggleReportSection(wkpReportKey)}
                    style={{ width: 12, height: 12, accentColor: "#0A2540" }}
                  />
                </label>
              )}
            </div>
            {referralText ? (
              <p className={`text-xs text-gray-700 leading-relaxed whitespace-pre-wrap ${!expanded ? "line-clamp-4" : ""}`}>
                {referralText}
              </p>
            ) : (
              <span className="text-[11px] text-gray-300 italic">Non specificato</span>
            )}
          </div>

          {/* Ipotesi diagnostiche */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-amber-600">
                <FlaskConical className="w-3 h-3" />
                Ipotesi diagnostiche
              </div>
              {toggleReportSection && (
                <label title="Includi nel referto" className="flex items-center cursor-pointer" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={!!reportSections?.has(wkpReportKey)}
                    onChange={() => toggleReportSection(wkpReportKey)}
                    style={{ width: 12, height: 12, accentColor: "#0A2540" }}
                  />
                </label>
              )}
            </div>
            {hypotheses.length === 0 ? (
              <span className="text-[11px] text-gray-300 italic">Nessuna ipotesi registrata</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {hypotheses.map((h, i) => (
                  <span key={i} className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                    {h}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Esami richiesti */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-blue-600">
                <FileText className="w-3 h-3" />
                Esami richiesti alla visita precedente
              </div>
              {toggleReportSection && (
                <label title="Includi nel referto" className="flex items-center cursor-pointer" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={!!reportSections?.has(examsReportKey)}
                    onChange={() => toggleReportSection(examsReportKey)}
                    style={{ width: 12, height: 12, accentColor: "#0A2540" }}
                  />
                </label>
              )}
            </div>

            {examItems.length === 0 ? (
              <span className="text-[11px] text-gray-300 italic">Nessun esame richiesto registrato</span>
            ) : (
              <>
                <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                  <span className="flex-1">Esame</span>
                  <span className="w-24 text-right">Data richiesta</span>
                </div>
                <div className="space-y-1">
                  {examItems.map(exam => {
                    const status = examStatuses[exam.key] || "mancante";
                    const scfg   = STATUS_CFG[status] || STATUS_CFG.mancante;
                    return (
                      <div key={exam.key} className="flex items-center gap-2 text-xs">
                        <span className="flex-1 text-gray-700 leading-snug">{exam.label}</span>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => cycleStatus(exam.key)}
                          title="Clicca per cambiare stato"
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 hover:opacity-80 transition-opacity ${scfg.cls}`}
                        >
                          {scfg.label}
                        </button>
                        <span className="text-[10px] text-gray-400 w-20 text-right flex-shrink-0">
                          {fmtDate(exam.date)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {showNotes && (
                  <p className="text-[10px] text-gray-400 italic mt-1.5">Note: {examNotes}</p>
                )}
              </>
            )}
          </div>
        </div>

      ) : (
        /* Follow-up / no workup — esami attesi wide view */
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-blue-600">
              <FileText className="w-3 h-3" />
              Esami attesi / monitoraggi
            </div>
            {toggleReportSection && (
              <label title="Includi nel referto" className="flex items-center cursor-pointer" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={!!reportSections?.has(examsReportKey)}
                  onChange={() => toggleReportSection(examsReportKey)}
                  style={{ width: 12, height: 12, accentColor: "#0A2540" }}
                />
              </label>
            )}
          </div>
          <p className="text-[11px] text-gray-400 italic">
            Nessun workup diagnostico precedente registrato.
          </p>
        </div>
      )}
    </div>
  );
}
