import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { diseaseProfileApi } from "../../lib/api";
import { toast } from "sonner";
import {
  Pencil, Check, X, ClipboardList, Stethoscope,
  Pill, FlaskConical, FileText, ChevronDown, ChevronUp,
} from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";

// ── Referral reason key → display label ───────────────────────────────────────
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

// ── Build full extra-rheumatologic history text from firstVisit fields ──────────
function buildExtraRheumatologicText(fv, patient = null) {
  const itemNotes    = fv.comorbidity_item_notes || {};
  const comorbItems  = Object.values(fv.comorbidities || {}).flat().filter(Boolean);
  const comorbLines  = comorbItems.map((item) => {
    const note = itemNotes[item]?.trim();
    return note ? `- ${item}: ${note}` : `- ${item}`;
  });
  const freeNotes    = fv.comorbidity_free_notes?.trim() || "";
  // Phase 2A: prefer flat patient field; fall back to prima_visita
  const allergies    = patient?.allergie_testo?.trim() || fv.drug_allergies?.trim() || "";
  const surgery      = fv.surgical_history?.trim() || "";
  const therapyText  = fv.current_therapies_text?.trim() || "";
  const frailtyItems = (fv.frailty || []).filter(Boolean);

  const sections = [];
  if (comorbLines.length > 0) {
    const block = comorbLines.join("\n") + (freeNotes ? `\n${freeNotes}` : "");
    sections.push(`Comorbilità:\n${block}`);
  } else if (freeNotes) {
    sections.push(`Comorbilità:\n${freeNotes}`);
  }
  if (allergies)             sections.push(`Allergie a farmaci:\n${allergies}`);
  if (surgery)               sections.push(`Interventi chirurgici:\n${surgery}`);
  if (frailtyItems.length)   sections.push(`Fragilità:\n${frailtyItems.join(", ")}`);
  if (therapyText)           sections.push(`Terapia domiciliare:\n${therapyText}`);
  return sections.join("\n\n");
}

// ── Build initial cockpit data from firstVisit.data ────────────────────────────
function buildInitialCockpit(firstVisitData, lastTherapyMod, patient = null) {
  const fv = firstVisitData || {};

  const physiologicText  = fv.physiologic_history?.trim() || "";
  const familyText       = fv.family_history?.trim() || "";

  // ── Esami pendenti: selected tests list + free notes ──
  const testsList = (fv.requested_tests || []).join(", ");
  const testsNotes = fv.requested_tests_notes || "";
  const pendingParts = [testsList, testsNotes].filter(Boolean);

  const reasonLabel = REFERRAL_LABELS[fv.referral_reason] || fv.referral_reason || "";

  return {
    referral_reason_text:        reasonLabel,
    extra_rheumatologic_history: buildExtraRheumatologicText(fv, patient),
    last_therapy_modification:   lastTherapyMod || fv.therapy_modification || "",
    diagnostic_status:           [fv.suggested_diagnosis, fv.diagnostic_conclusion]
                                   .filter(Boolean).join(" — "),
    pending_items:               pendingParts.join("\n"),
    physiologic_history:         physiologicText,
    family_history:              familyText,
  };
}

// ── Single editable panel ──────────────────────────────────────────────────────
function EditablePanel({ icon: Icon, iconColor, label, value, placeholder, onSave, saving, reportChecked, reportToggle }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value || "");
  const taRef = useRef(null);

  // Keep draft in sync when value changes externally (e.g. auto-update)
  useEffect(() => { if (!editing) setDraft(value || ""); }, [value, editing]);

  const start  = () => { setDraft(value || ""); setEditing(true); };
  const cancel = () => { setDraft(value || ""); setEditing(false); };
  const commit = () => { onSave(draft); setEditing(false); };

  // auto-grow textarea
  useEffect(() => {
    if (editing && taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = taRef.current.scrollHeight + "px";
      taRef.current.focus();
    }
  }, [editing]);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] ${iconColor}`}>
          <Icon className="w-3 h-3 flex-shrink-0" />
          {label}
        </div>
        <div className="flex items-center gap-2">
          {reportToggle && (
            <label title="Includi nel referto" style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={!!reportChecked}
                onChange={reportToggle}
                style={{ width: "13px", height: "13px", accentColor: "#0A2540", cursor: "pointer" }}
              />
            </label>
          )}
          {!editing && (
            <button
              type="button"
              onClick={start}
              className="text-gray-300 hover:text-gray-500 transition-colors p-0.5 rounded"
              title="Modifica"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-1.5">
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            rows={3}
            className="w-full text-xs border border-indigo-200 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 leading-relaxed"
          />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              onClick={commit}
              disabled={saving}
              className="h-6 text-[11px] px-2 bg-[#0A2540] text-white hover:bg-[#051626]"
            >
              <Check className="w-3 h-3 mr-1" /> Salva
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={cancel}
              className="h-6 text-[11px] px-2 text-gray-500 hover:text-gray-800"
            >
              <X className="w-3 h-3 mr-1" /> Annulla
            </Button>
          </div>
        </div>
      ) : (
        <p
          onClick={start}
          className={`text-xs leading-relaxed whitespace-pre-wrap cursor-text rounded px-1 py-0.5 hover:bg-gray-50 transition-colors min-h-[20px] ${
            value ? "text-gray-700" : "text-gray-300 italic"
          }`}
        >
          {value || placeholder}
        </p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ClinicalCockpit({ patientId, patient, firstVisit, pastVisits, refreshKey, reportSections, toggleReportSection, onCockpitData, followupMode }) {
  const [open,    setOpen]    = useState(true);
  const [cockpit, setCockpit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  // Derive last therapy modification from the most recent workup visit that has one
  const lastTherapyMod = (pastVisits || [])
    .filter((v) => v.therapy_modification)
    .sort((a, b) => (b.visit_date || "").localeCompare(a.visit_date || ""))
    [0]?.therapy_modification || null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const doc = await diseaseProfileApi.get(patientId, "clinical_cockpit");
      if (doc?.data) {
        // Stored cockpit exists — use it, but sync any fields that are empty or outdated.
        const fvData = firstVisit?.data || firstVisit || {};

        // Sync last_therapy_modification: workup visit takes priority over firstVisit
        const fvTherapy    = fvData.therapy_modification || null;
        const effectiveTherapy = lastTherapyMod || fvTherapy || null;

        // Sync pending_items: re-build from firstVisit whenever the stored value is empty
        const testsList  = (fvData.requested_tests || []).join(", ");
        const testsNotes = fvData.requested_tests_notes || "";
        const effectivePending = [testsList, testsNotes].filter(Boolean).join("\n") || null;

        const stored = { ...doc.data };
        let changed = false;

        if (effectiveTherapy && stored.last_therapy_modification !== effectiveTherapy) {
          stored.last_therapy_modification = effectiveTherapy;
          changed = true;
        }
        if (effectivePending && !stored.pending_items) {
          stored.pending_items = effectivePending;
          changed = true;
        }

        // Sync physiologic_history and family_history as dedicated cockpit fields
        // Always ensure these fields exist (backwards-compat for pre-existing cockpit docs)
        const physiologicText = fvData.physiologic_history?.trim() || "";
        const familyText      = fvData.family_history?.trim() || "";
        if (!('physiologic_history' in stored)) {
          stored.physiologic_history = physiologicText;
          changed = true;
        } else if (physiologicText && !stored.physiologic_history) {
          stored.physiologic_history = physiologicText;
          changed = true;
        }
        if (!('family_history' in stored)) {
          stored.family_history = familyText;
          changed = true;
        } else if (familyText && !stored.family_history) {
          stored.family_history = familyText;
          changed = true;
        }

        // Sync diagnostic_status: re-build from firstVisit whenever the stored value is empty
        const effectiveDiagnosis = [fvData.suggested_diagnosis, fvData.diagnostic_conclusion]
          .filter(Boolean).join(" — ");
        if (effectiveDiagnosis && !stored.diagnostic_status) {
          stored.diagnostic_status = effectiveDiagnosis;
          changed = true;
        }

        // Sync extra_rheumatologic_history: re-build when firstVisit has sections that are
        // missing from the stored text (e.g. item-level notes, allergie, chirurgia, terapia
        // domiciliare added/filled after the cockpit was first created).
        {
          const effectiveExtra = buildExtraRheumatologicText(fvData, patient);
          const storedExtra    = stored.extra_rheumatologic_history || "";
          const sectionsMissing = effectiveExtra && (
            !storedExtra ||
            effectiveExtra.length > storedExtra.length ||
            (effectiveExtra.includes("Allergie a farmaci:")    && !storedExtra.includes("Allergie a farmaci:"))    ||
            (effectiveExtra.includes("Interventi chirurgici:") && !storedExtra.includes("Interventi chirurgici:")) ||
            (effectiveExtra.includes("Terapia domiciliare:")   && !storedExtra.includes("Terapia domiciliare:"))   ||
            (effectiveExtra.includes("Fragilità:")             && !storedExtra.includes("Fragilità:"))
          );
          if (sectionsMissing) {
            stored.extra_rheumatologic_history = effectiveExtra;
            changed = true;
          }
        }

        if (changed) {
          diseaseProfileApi.upsert(patientId, "clinical_cockpit", stored).catch(() => {});
        }
        setCockpit(stored);
      } else {
        // First time: auto-prefill from firstVisit
        const initial = buildInitialCockpit(firstVisit?.data || firstVisit, lastTherapyMod, patient);
        setCockpit(initial);
        // Persist so future loads don't need to re-prefill
        diseaseProfileApi.upsert(patientId, "clinical_cockpit", initial).catch(() => {});
      }
    } catch {
      setCockpit(buildInitialCockpit(firstVisit?.data || firstVisit, lastTherapyMod, patient));
    } finally {
      setLoading(false);
    }
  }, [patientId, firstVisit, lastTherapyMod, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const handleSave = async (key, value) => {
    const updated = { ...cockpit, [key]: value };
    setCockpit(updated);
    onCockpitData?.(updated);
    setSaving(true);
    try {
      await diseaseProfileApi.upsert(patientId, "clinical_cockpit", updated);
      toast.success("Sintesi aggiornata");
    } catch {
      toast.error("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { if (cockpit) onCockpitData?.(cockpit); }, [cockpit]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return null;
  if (!cockpit) return null;

  return (
    <Card className="border-gray-200 shadow-sm overflow-hidden">
      {/* ── Header ── */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100 hover:bg-gray-100 transition-colors text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="font-heading font-bold text-[11px] text-gray-500 uppercase tracking-[0.16em]">
            Sintesi clinica
          </span>
          <span className="text-[10px] text-gray-400 normal-case font-normal hidden sm:inline">
            — aggiornabile ad ogni visita
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={`/pazienti/${patientId}/prima-visita`}
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] text-indigo-500 hover:text-indigo-700 hover:underline decoration-dotted transition-colors"
          >
            Prima visita →
          </Link>
          {open
            ? <ChevronUp   className="w-3.5 h-3.5 text-gray-400" />
            : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="divide-y divide-gray-100">

          {/* ── Row 1: Last therapy modification (full width, highlighted) ── */}
          <div className="px-4 py-3 bg-emerald-50/60 border-l-2 border-emerald-400">
            <EditablePanel
              icon={Pill}
              iconColor="text-emerald-700"
              label="Terapia consigliata / modificata alla visita precedente"
              value={cockpit.last_therapy_modification}
              placeholder="Nessuna modifica terapeutica registrata alle visite precedenti."
              onSave={(v) => handleSave("last_therapy_modification", v)}
              saving={saving}
              reportChecked={reportSections?.has("cockpit_therapy")}
              reportToggle={toggleReportSection ? () => toggleReportSection("cockpit_therapy") : undefined}
            />
          </div>

          {/* ── Row 2: Motivo invio + Diagnosi ── */}
          {followupMode ? (
            /* Follow-up: solo Diagnosi, larghezza piena */
            <div className="px-4 py-3">
              <EditablePanel
                icon={FlaskConical}
                iconColor="text-amber-600"
                label="Diagnosi"
                value={cockpit.diagnostic_status}
                placeholder="Diagnosi corrente…"
                onSave={(v) => handleSave("diagnostic_status", v)}
                saving={saving}
                reportChecked={reportSections?.has("cockpit_diagnostic")}
                reportToggle={toggleReportSection ? () => toggleReportSection("cockpit_diagnostic") : undefined}
              />
            </div>
          ) : (
            /* Prima visita / Workup: Motivo di invio + Ipotesi diagnostica */
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
              <div className="px-4 py-3">
                <EditablePanel
                  icon={ClipboardList}
                  iconColor="text-indigo-600"
                  label="Motivo di invio"
                  value={cockpit.referral_reason_text}
                  placeholder="Motivo per cui il paziente è stato inviato…"
                  onSave={(v) => handleSave("referral_reason_text", v)}
                  saving={saving}
                  reportChecked={reportSections?.has("cockpit_referral")}
                  reportToggle={toggleReportSection ? () => toggleReportSection("cockpit_referral") : undefined}
                />
              </div>
              <div className="px-4 py-3">
                <EditablePanel
                  icon={FlaskConical}
                  iconColor="text-amber-600"
                  label="Ipotesi diagnostica / stato corrente"
                  value={cockpit.diagnostic_status}
                  placeholder="Ipotesi diagnostica corrente…"
                  onSave={(v) => handleSave("diagnostic_status", v)}
                  saving={saving}
                  reportChecked={reportSections?.has("cockpit_diagnostic")}
                  reportToggle={toggleReportSection ? () => toggleReportSection("cockpit_diagnostic") : undefined}
                />
              </div>
            </div>
          )}

          {/* ── Row 3: Anamnesi extra-reuma + Esami pendenti (two columns) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            <div className="px-4 py-3">
              <EditablePanel
                icon={Stethoscope}
                iconColor="text-gray-500"
                label="Anamnesi extra-reumatologica"
                value={cockpit.extra_rheumatologic_history}
                placeholder="Comorbidità, terapie non reumatologiche, allergie…"
                onSave={(v) => handleSave("extra_rheumatologic_history", v)}
                saving={saving}
                reportChecked={reportSections?.has("cockpit_extra")}
                reportToggle={toggleReportSection ? () => toggleReportSection("cockpit_extra") : undefined}
              />
            </div>
            <div className="px-4 py-3">
              <EditablePanel
                icon={FileText}
                iconColor="text-blue-500"
                label="Esami pendenti / richieste / promemoria"
                value={cockpit.pending_items}
                placeholder="Esami da refertare, richieste in corso, note per la prossima visita…"
                onSave={(v) => handleSave("pending_items", v)}
                saving={saving}
                reportChecked={reportSections?.has("cockpit_pending")}
                reportToggle={toggleReportSection ? () => toggleReportSection("cockpit_pending") : undefined}
              />
            </div>
          </div>

          {/* ── Row 4: Anamnesi fisiologica + Anamnesi familiare ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            <div className="px-4 py-3">
              <EditablePanel
                icon={Stethoscope}
                iconColor="text-violet-500"
                label="Anamnesi fisiologica"
                value={cockpit.physiologic_history}
                placeholder="Abitudini di vita, fattori di rischio, storia riproduttiva…"
                onSave={(v) => handleSave("physiologic_history", v)}
                saving={saving}
                reportChecked={reportSections?.has("cockpit_physiologic")}
                reportToggle={toggleReportSection ? () => toggleReportSection("cockpit_physiologic") : undefined}
              />
            </div>
            <div className="px-4 py-3">
              <EditablePanel
                icon={Stethoscope}
                iconColor="text-rose-500"
                label="Anamnesi familiare"
                value={cockpit.family_history}
                placeholder="Familiarità per patologie reumatologiche o autoimmuni…"
                onSave={(v) => handleSave("family_history", v)}
                saving={saving}
                reportChecked={reportSections?.has("cockpit_family")}
                reportToggle={toggleReportSection ? () => toggleReportSection("cockpit_family") : undefined}
              />
            </div>
          </div>

        </div>
      )}
    </Card>
  );
}
