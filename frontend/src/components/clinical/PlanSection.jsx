import React, { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { diseaseProfileApi } from "../../lib/api";
import { toast } from "sonner";
import {
  ClipboardList, Pill, Save, Printer, Copy,
  CheckCircle2, ArrowRight, AlertTriangle, Shuffle, TrendingDown,
  Eye, Scan, HelpCircle, Plus,
} from "lucide-react";
import { isPmrDiagnosis, isLvvDiagnosis } from "../../lib/diseaseDetection";
import TemplatePickerDialog from "../visits/TemplatePickerDialog";
import SelectableTextArea from "../shared/SelectableTextArea";

function InheritedFieldWrapper({ fieldKey, inheritedFields, onMarkReviewed, children }) {
  const isInherited = inheritedFields?.has(fieldKey);
  return (
    <div onFocus={isInherited ? () => onMarkReviewed(fieldKey) : undefined}>
      {isInherited && (
        <div className="flex items-center gap-1.5 text-[10px] text-amber-600 italic mb-1.5 select-none pointer-events-none">
          <span>↩</span> Importato dalla visita precedente — clicca per rivalutare
        </div>
      )}
      <div className={isInherited ? "opacity-55" : ""}>
        {children}
      </div>
    </div>
  );
}


const THERAPY_ACTIONS = [
  {
    key: "continue", label: "Continua", Icon: CheckCircle2,
    style: "text-green-700 border-green-200 bg-green-50/60 hover:bg-green-100",
    activeStyle: "text-green-700 border-green-400 bg-green-100 ring-1 ring-green-400",
    template: "Si conferma la terapia in corso senza modifiche.",
  },
  {
    key: "increase", label: "Aumenta dose", Icon: ArrowRight,
    style: "text-blue-700 border-blue-200 bg-blue-50/60 hover:bg-blue-100",
    activeStyle: "text-blue-700 border-blue-400 bg-blue-100 ring-1 ring-blue-400",
    template: "Si aumenta la dose di ____ da ____ a ____ mg. Prossimo controllo fra ____.",
  },
  {
    key: "stop", label: "Sospendi", Icon: AlertTriangle,
    style: "text-red-700 border-red-200 bg-red-50/60 hover:bg-red-100",
    activeStyle: "text-red-700 border-red-400 bg-red-100 ring-1 ring-red-400",
    template: "Si sospende ____ per: ____. Piano di scalaggio: ____.",
  },
  {
    key: "switch", label: "Switch terapia", Icon: Shuffle,
    style: "text-violet-700 border-violet-200 bg-violet-50/60 hover:bg-violet-100",
    activeStyle: "text-violet-700 border-violet-400 bg-violet-100 ring-1 ring-violet-400",
    template: "Si sospende ____ e si avvia ____ alla dose di ____ mg (____). Motivazione: ____.",
  },
];

const PMR_ACTIONS = [
  {
    key: "taper_steroid", label: "Taper steroide", Icon: TrendingDown,
    style: "text-orange-700 border-orange-200 bg-orange-50/60 hover:bg-orange-100",
    activeStyle: "text-orange-700 border-orange-400 bg-orange-100 ring-1 ring-orange-400",
    template: "Si riduce il prednisone da ____ mg a ____ mg/die. Schema di scalaggio: riduzione di ____ mg ogni ____ settimane. Prossimo controllo fra ____.",
  },
  {
    key: "confirm_remission", label: "Conferma remissione", Icon: CheckCircle2,
    style: "text-green-700 border-green-200 bg-green-50/60 hover:bg-green-100",
    activeStyle: "text-green-700 border-green-400 bg-green-100 ring-1 ring-green-400",
    template: "Si conferma la remissione clinica: VES/PCR nella norma, assenza di sintomi attivi. Terapia confermata senza modifiche. Follow-up programmato.",
  },
  {
    key: "request_imaging", label: "Richiedi imaging vascolare", Icon: Scan,
    style: "text-purple-700 border-purple-200 bg-purple-50/60 hover:bg-purple-100",
    activeStyle: "text-purple-700 border-purple-400 bg-purple-100 ring-1 ring-purple-400",
    template: "Si richiede imaging vascolare: ____. Motivazione: ____. Urgenza: ____.",
  },
  {
    key: "reconsider_dx", label: "Riconsiderazione diagnostica", Icon: HelpCircle,
    style: "text-gray-700 border-gray-200 bg-gray-50/60 hover:bg-gray-100",
    activeStyle: "text-gray-700 border-gray-400 bg-gray-100 ring-1 ring-gray-400",
    template: "Riconsiderazione diagnostica: quadro atipico per ____. Diagnosi alternativa da escludere: ____. Esami aggiuntivi: ____.",
  },
  {
    key: "urgent_referral", label: "Rinvio urgente — sintomi cranici/visivi", Icon: Eye,
    style: "text-red-700 border-red-200 bg-red-50/60 hover:bg-red-100",
    activeStyle: "text-red-700 border-red-400 bg-red-100 ring-1 ring-red-400",
    template: "RINVIO URGENTE: sintomi cranici/visivi compatibili con GCA attiva. Inviato a PS/oculistica per valutazione urgente. Sospeso/aumentato steroide: ____. Motivo: ____.",
  },
];

function SectionReportCheck({ sectionKey, checked, onToggle }) {
  return (
    <label title="Includi nel referto" style={{ paddingTop: "2px", flexShrink: 0, cursor: "pointer" }}>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={() => onToggle?.(sectionKey)}
        style={{ width: "13px", height: "13px", accentColor: "#0A2540", cursor: "pointer" }}
      />
    </label>
  );
}

function formatActiveTherapies(therapies) {
  const active = (therapies || []).filter(t => t.status === "active" && t.drug_name);
  if (!active.length) return "";
  return active.map(t => {
    let line = `- ${t.drug_name}`;
    if (t.dose)      line += ` ${t.dose}`;
    if (t.frequency) line += ` · ${t.frequency}`;
    if (t.route)     line += ` · ${t.route}`;
    return line;
  }).join("\n");
}

export default function PlanSection({ patient, patientId, therapies, onPlanChange, onRegisterHandle, onSaveVisit, onOpenReport, onDuplicatePrevious, onAddTherapy, onTherapySaved, onClinimetrySaved, appendPlanText }) {
  const [therapyAction, setTherapyAction] = useState(null);
  const [therapyNote,   setTherapyNote]   = useState("");
  const [indicazioni,   setIndicazioni]   = useState("");
  const [furtherIndications, setFurtherIndications] = useState("");
  const [planReportSections, setPlanReportSections] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);

  const [inheritedPlanFields, setInheritedPlanFields] = useState(new Set());
  const markPlanReviewed = (key) => setInheritedPlanFields(prev => {
    if (!prev.has(key)) return prev;
    const next = new Set(prev);
    next.delete(key);
    return next;
  });

  // Due ref separati per evitare race condition tra therapies e clinical_cockpit
  const hasInitFromTherapies = useRef(false);
  const hasInitFromCockpit   = useRef(false);

  const isPmrLvv = isPmrDiagnosis(patient) || isLvvDiagnosis(patient);
  const pid = patientId || patient?.id;

  useEffect(() => {
    onRegisterHandle?.({
      appendIndicazioni: (text) => {
        setIndicazioni(prev => prev.trim() ? prev.trim() + "\n" + text : text);
      },
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!appendPlanText?.text) return;
    setIndicazioni(prev => prev.trim() ? prev.trim() + "\n" + appendPlanText.text : appendPlanText.text);
  }, [appendPlanText]);

  // ── §10 Terapia: sorgente primaria = prescrizioni attive (sempre aggiornate) ──
  // Sovrascrive anche il valore già impostato dal clinical_cockpit (che potrebbe
  // essere stale della prima visita), perché le prescrizioni sono la fonte più affidabile.
  useEffect(() => {
    if (hasInitFromTherapies.current) return;
    const formatted = formatActiveTherapies(therapies);
    if (!formatted) return;
    setIndicazioni(formatted);
    setInheritedPlanFields(prev => new Set([...prev, 'indicazioni']));
    hasInitFromTherapies.current = true;
    // Se il cockpit aveva già impostato il campo (stale), il soprascritto lo marca
    // come non-reviewed di nuovo, quindi il badge inherited rimane visibile.
  }, [therapies]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── pending_items da clinical_cockpit (non tocca §10 Terapia) ────────────
  // last_therapy_modification NON viene più usato come sorgente per §10:
  // le prescrizioni attive sono sempre più aggiornate e affidabili.
  useEffect(() => {
    if (loadedRef.current || !pid) return;
    loadedRef.current = true;
    diseaseProfileApi.get(pid, "clinical_cockpit").then(doc => {
      if (!doc?.data) return;
      const d = doc.data;
      if (d.pending_items && !furtherIndications) {
        setFurtherIndications(d.pending_items);
        setInheritedPlanFields(prev => new Set([...prev, 'furtherIndications']));
      }
    }).catch(() => {});
  }, [pid]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlanSection = (key) => {
    const next = new Set(planReportSections);
    if (next.has(key)) next.delete(key); else next.add(key);
    setPlanReportSections(next);
    onPlanChange?.({
      action: therapyAction,
      note: therapyNote,
      indicazioni,
      furtherIndications,
      planReportSections: next,
    });
  };

  const emitChange = (fields) => {
    onPlanChange?.({
      action: therapyAction,
      note: therapyNote,
      indicazioni,
      furtherIndications,
      planReportSections,
      ...fields,
    });
  };

  const selectAction = (action) => {
    const next = therapyAction === action.key ? null : action.key;
    const note = next ? action.template : "";
    setTherapyAction(next);
    setTherapyNote(note);
    emitChange({ action: next, note });
  };

  const handleTherapyNoteChange = (val) => {
    setTherapyNote(val);
    emitChange({ note: val });
  };

  const handleIndicazioniChange = (val) => {
    setIndicazioni(val);
    emitChange({ indicazioni: val });
  };

  const handleFurtherChange = (val) => {
    setFurtherIndications(val);
    emitChange({ furtherIndications: val });
  };

  const savePlan = async (silent = false) => {
    if (!pid) return;
    try {
      const existing = await diseaseProfileApi.get(pid, "clinical_cockpit").catch(() => null);
      const current = existing?.data || {};
      await diseaseProfileApi.upsert(pid, "clinical_cockpit", {
        ...current,
        last_therapy_modification: indicazioni || current.last_therapy_modification || "",
        pending_items: furtherIndications || current.pending_items || "",
      });
      if (!silent) toast.success("Piano salvato nella sintesi clinica");
    } catch (err) {
      if (!silent) toast.error(err?.response?.data?.detail || "Errore nel salvataggio");
    }
  };

  const handleSaveVisit = async () => {
    setSaving(true);
    try {
      await savePlan(true);
      onSaveVisit?.();
    } finally {
      setSaving(false);
    }
  };

  const actionBtnClass = (action) => {
    const isActive = therapyAction === action.key;
    return `flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] font-semibold transition-all ${
      isActive ? action.activeStyle : action.style
    }`;
  };

  return (
    <div className="border-t border-gray-200 overflow-hidden" data-testid="plan-section">
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-[#0A2540]" />
          <h2 className="font-heading font-bold text-base tracking-tight text-[#0A2540]">PIANO</h2>
        </div>
      </div>

      <div className="p-5 space-y-6">

        {/* ── PMR / GCA / LVV specific actions ── */}
        {isPmrLvv && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-gray-400 font-semibold mb-2 flex items-center gap-1.5">
              <Pill className="w-3 h-3 text-orange-400" /> Azioni PMR / GCA / LVV
            </div>
            <div className="grid grid-cols-1 gap-1.5 mb-2">
              {PMR_ACTIONS.map(action => {
                const { Icon } = action;
                return (
                  <button
                    key={action.key}
                    onClick={() => selectAction(action)}
                    className={actionBtnClass(action)}
                    data-testid={`plan-action-${action.key}`}
                  >
                    <Icon className="w-3 h-3 flex-shrink-0" />
                    {action.label}
                  </button>
                );
              })}
            </div>
            {therapyAction && PMR_ACTIONS.some(a => a.key === therapyAction) && (
              <Textarea
                value={therapyNote}
                onChange={e => handleTherapyNoteChange(e.target.value)}
                className="text-xs font-mono min-h-[56px] resize-y mt-1"
                placeholder="Dettagli piano…"
                data-testid="plan-therapy-note"
              />
            )}
            <div className="border-t border-gray-100 my-3" />
          </div>
        )}

        {/* ── §10 · Terapia ── */}
        <div className="space-y-2">
          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
            <SectionReportCheck
              sectionKey="therapy_plan"
              checked={planReportSections.has("therapy_plan")}
              onToggle={togglePlanSection}
            />
            <div style={{ flex: 1 }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0A2540]/8 flex items-center justify-center text-[10px] font-black text-[#0A2540]/60">10</span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-600">Terapia</span>
                </div>
                <div className="flex items-center gap-2">
                  {onAddTherapy && (
                    <button
                      type="button"
                      onClick={onAddTherapy}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#0A2540]/30 bg-[#0A2540]/5 text-[11px] font-semibold text-[#0A2540] hover:bg-[#0A2540] hover:text-white transition-colors"
                    >
                      <Pill className="w-3 h-3" /> Gestione terapia
                    </button>
                  )}
                  <TemplatePickerDialog
                    category="therapy"
                    currentText={indicazioni}
                    onSelect={(text) => handleIndicazioniChange(indicazioni ? indicazioni + "\n\n" + text : text)}
                  />
                </div>
              </div>
              <InheritedFieldWrapper fieldKey="indicazioni" inheritedFields={inheritedPlanFields} onMarkReviewed={markPlanReviewed}>
                <Textarea
                  value={indicazioni}
                  onChange={e => { handleIndicazioniChange(e.target.value); markPlanReviewed('indicazioni'); }}
                  placeholder="Terapia indicata, modifiche, safety check, schema posologico…"
                  className="text-xs min-h-[72px] resize-y"
                  data-testid="plan-indicazioni"
                />
              </InheritedFieldWrapper>
              <p className="text-[10px] text-gray-400 mt-1">
                Confluisce in <span className="font-semibold">Sintesi clinica → Terapia consigliata</span> alla prossima visita.
              </p>
            </div>
          </div>
        </div>

        {/* ── §11 · Indicazioni ulteriori ── */}
        <div className="space-y-2">
          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
            <SectionReportCheck
              sectionKey="further_indications"
              checked={planReportSections.has("further_indications")}
              onToggle={togglePlanSection}
            />
            <div style={{ flex: 1 }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0A2540]/8 flex items-center justify-center text-[10px] font-black text-[#0A2540]/60">11</span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-600">Indicazioni ulteriori</span>
                </div>
                <TemplatePickerDialog
                  category="indications"
                  currentText={furtherIndications}
                  onSelect={(text) => handleFurtherChange(furtherIndications ? furtherIndications + "\n\n" + text : text)}
                />
              </div>
              <InheritedFieldWrapper fieldKey="furtherIndications" inheritedFields={inheritedPlanFields} onMarkReviewed={markPlanReviewed}>
                <SelectableTextArea
                  value={furtherIndications}
                  onChange={e => { handleFurtherChange(e.target.value); markPlanReviewed('furtherIndications'); }}
                  placeholder="Esami prescritti, consulenze richieste, indicazioni al paziente, prossimo follow-up…"
                  className="text-xs min-h-[72px] resize-y"
                  data-testid="plan-further-indications"
                  patientId={patientId || patient?.id}
                  patient={patient}
                  enableLab={false}
                  enableInstrumental={false}
                  onTherapySaved={onTherapySaved}
                  onClinimetrySaved={onClinimetrySaved}
                />
              </InheritedFieldWrapper>
              <p className="text-[10px] text-gray-400 mt-1">
                Confluisce in <span className="font-semibold">Sintesi clinica → Esami pendenti</span> alla prossima visita.
              </p>
            </div>
          </div>
        </div>

        {/* ── Footer fine visita ── */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center flex-wrap gap-3">
            <Button
              onClick={handleSaveVisit}
              disabled={saving}
              className="bg-[#0A2540] hover:bg-[#051626] text-white"
              data-testid="today-visit-save"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Salvataggio…" : "Salva visita"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenReport?.()}
              className="border-[#0A2540]/40 text-[#0A2540] hover:bg-[#0A2540] hover:text-white"
            >
              <Printer className="w-4 h-4 mr-2" />
              Elabora referto
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDuplicatePrevious}
              className="text-xs text-gray-600 ml-auto"
              data-testid="duplicate-visit-btn"
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" /> Duplica precedente
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
