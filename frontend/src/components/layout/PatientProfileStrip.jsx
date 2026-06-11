import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Leaf, Users, Heart, Pill, AlertTriangle,
  ChevronDown, ChevronUp, X, Plus, Search, Trash2, ChevronDown as DropArrow,
} from "lucide-react";
import { diseaseProfileApi, patientsApi, therapiesApi } from "../../lib/api";
import { parseTherapyText } from "../../lib/therapyTextParser";
import { COMORBIDITY_CATEGORIES, FREQUENT_CONDITIONS } from "../../lib/conditions";
import { Button } from "../ui/button";
import { toast } from "sonner";

// Phase 2C: narrative fields are SSOT in patients, not prima_visita
const PATIENT_NARRATIVE_MAP = {
  physiologic_history:    "anamnesi_fisiologica",
  family_history:         "anamnesi_familiare",
  comorbidity_free_notes: "comorbidita_apr",
  current_therapies_text: "terapia_domiciliare",
  drug_allergies:         "allergie_testo",
};
const NARRATIVE_KEYS = new Set(Object.keys(PATIENT_NARRATIVE_MAP));

// ── Category → badge colour (strip chips) ───────────────────────────────────
const CAT_COLOR = {
  cardiovascular:   "bg-rose-50   text-rose-700   border-rose-200",
  metabolic:        "bg-orange-50 text-orange-700 border-orange-200",
  respiratory:      "bg-sky-50    text-sky-700    border-sky-200",
  renal:            "bg-purple-50 text-purple-700 border-purple-200",
  infectious:       "bg-emerald-50 text-emerald-700 border-emerald-200",
  oncologic:        "bg-gray-100  text-gray-600   border-gray-200",
  gastrointestinal: "bg-amber-50  text-amber-700  border-amber-200",
  psychiatric:      "bg-violet-50 text-violet-700 border-violet-200",
  osteo_rheum:      "bg-indigo-50 text-indigo-700 border-indigo-200",
  endocrine:        "bg-teal-50   text-teal-700   border-teal-200",
  neurologic:       "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  allergologic:     "bg-red-50    text-red-700    border-red-200",
  altro:            "bg-gray-50   text-gray-600   border-gray-200",
};
const DEFAULT_COLOR = "bg-rose-50 text-rose-700 border-rose-200";

// ── Category → dot colour (modal list) ──────────────────────────────────────
const CAT_DOT = {
  cardiovascular:   "bg-rose-500",
  metabolic:        "bg-orange-500",
  respiratory:      "bg-sky-500",
  renal:            "bg-purple-500",
  infectious:       "bg-emerald-500",
  oncologic:        "bg-gray-400",
  gastrointestinal: "bg-amber-500",
  psychiatric:      "bg-violet-500",
  osteo_rheum:      "bg-indigo-500",
  endocrine:        "bg-teal-500",
  neurologic:       "bg-fuchsia-500",
  allergologic:     "bg-red-500",
  altro:            "bg-gray-400",
};

// ── Detail key ───────────────────────────────────────────────────────────────
const dk = (catKey, item) => `${catKey}__${item}`;

// ── Build enriched text fields ───────────────────────────────────────────────
function buildEnrichedFields(fvData) {
  const details = fvData.comorbidity_details || {};
  const allComorbidities = Object.entries(fvData.comorbidities || {})
    .filter(([k]) => k !== "allergologic")
    .flatMap(([catKey, items]) =>
      (items || []).filter(Boolean).map(item => {
        const desc = details[dk(catKey, item)]?.description?.trim();
        return desc ? `${item} (${desc})` : item;
      })
    );
  const allergicItems = fvData.comorbidities?.allergologic || [];
  const comorbText = [
    ...allComorbidities,
    fvData.comorbidity_free_notes?.trim() || "",
  ].filter(Boolean).join("; ");
  const therapyText = (fvData.current_therapies_text || "")
    .split("\n").filter(l => l.trim()).join("\n");
  const allergiesText = [
    ...allergicItems,
    fvData.drug_allergies?.trim() || "",
  ].filter(Boolean).join(", ");
  return { comorbidities_text: comorbText, therapy_dom_text: therapyText, allergies_text: allergiesText, other_text: "" };
}

// ── Auto-resize textarea hook ────────────────────────────────────────────────
function useAutoResize(value) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [value]);
  return ref;
}

// ── Auto-resize textarea component (for use inside loops) ────────────────────
function AutoResizeTextarea({ value, onChange, placeholder, className }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={1}
      className={`${className} resize-none overflow-hidden leading-snug`}
    />
  );
}

// ── Simple text modal ────────────────────────────────────────────────────────
function TextEditorModal({ title, value, placeholder, onSave, onClose, saving }) {
  const [draft, setDraft] = useState(value || "");
  const taRef = useAutoResize(draft);
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
    >
      <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="font-heading font-bold text-sm text-gray-800 mb-3">{title}</div>
        <textarea ref={taRef} value={draft} onChange={e => setDraft(e.target.value)}
          placeholder={placeholder} rows={4} autoFocus
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 leading-relaxed"
        />
        <div className="flex gap-2 mt-4">
          <Button size="sm" onClick={() => onSave(draft)} disabled={saving}
            className="bg-[#0A2540] hover:bg-[#051626] text-white text-xs">
            {saving ? "Salvataggio…" : "Salva"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} disabled={saving} className="text-gray-500 text-xs">
            Annulla
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Comorbidity editor modal — chip + search + detail rows ───────────────────
function ComorbidityEditorModal({ comorbidities, comorbDetails, freeNotes, onSave, onClose, saving }) {
  // draft chip lists per category
  const [chips, setChips] = useState(() =>
    Object.fromEntries(Object.entries(comorbidities).map(([k, v]) => [k, [...(v || [])]])));
  // draft description per chip key
  const [descs, setDescs] = useState(() => {
    const init = {};
    Object.entries(comorbDetails || {}).forEach(([key, val]) => {
      init[key] = val?.description || "";
    });
    return init;
  });
  const [notes,      setNotes]      = useState(freeNotes || "");
  const [search,     setSearch]     = useState("");
  const [showDrop,   setShowDrop]   = useState(false);
  const searchRef = useRef(null);
  const dropRef   = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setShowDrop(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  // All selected (excluding allergologic, which is handled separately)
  const allSelected = Object.entries(chips)
    .filter(([k]) => k !== "allergologic")
    .flatMap(([catKey, items]) => (items || []).filter(Boolean).map(item => ({ catKey, item })));

  const hasChip = (catKey, item) => (chips[catKey] || []).includes(item);

  const addChip = (catKey, item) => {
    if (hasChip(catKey, item)) return;
    setChips(prev => ({ ...prev, [catKey]: [...(prev[catKey] || []), item] }));
  };

  const removeChip = (catKey, item) => {
    setChips(prev => ({ ...prev, [catKey]: (prev[catKey] || []).filter(i => i !== item) }));
  };

  const addCustom = () => {
    const term = search.trim();
    if (!term) return;
    addChip("altro", term);
    setSearch("");
    setShowDrop(false);
  };

  // Autocomplete results
  const q = search.toLowerCase().trim();
  const dropResults = q.length >= 1
    ? COMORBIDITY_CATEGORIES.flatMap(cat =>
        cat.items
          .filter(item => item.toLowerCase().includes(q) && !hasChip(cat.key, item))
          .map(item => ({ catKey: cat.key, item }))
      ).slice(0, 10)
    : FREQUENT_CONDITIONS
        .filter(({ catKey, label }) => !hasChip(catKey, label))
        .map(({ catKey, label }) => ({ catKey, item: label }))
        .slice(0, 10);

  const exactMatch = q && COMORBIDITY_CATEGORIES.some(cat =>
    cat.items.some(item => item.toLowerCase() === q)
  );

  const handleSave = () => {
    // Build updated comorbidity_details
    const newDetails = { ...(comorbDetails || {}) };
    allSelected.forEach(({ catKey, item }) => {
      const key  = dk(catKey, item);
      const desc = (descs[key] || "").trim();
      newDetails[key] = { description: desc };
    });
    onSave(chips, notes, newDetails);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <span className="font-heading font-bold text-base text-gray-900">Comorbidità e APR</span>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* ── 1. Chips selezionate ── */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
              Comorbidità selezionate
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[32px]">
              {allSelected.length === 0 && (
                <span className="text-xs text-gray-400 italic">Nessuna selezionata</span>
              )}
              {allSelected.map(({ catKey, item }) => (
                <span key={`${catKey}__${item}`}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${CAT_COLOR[catKey] || DEFAULT_COLOR}`}
                >
                  {item}
                  <button type="button" onClick={() => removeChip(catKey, item)}
                    className="hover:opacity-60 transition-opacity flex-shrink-0">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* ── 2. Cerca / aggiungi ── */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
              Aggiungi comorbidità
            </div>
            <div className="relative" ref={dropRef}>
              <div className="flex items-center border border-gray-200 rounded-xl px-3 py-2 gap-2 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-200 bg-white">
                <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => { setSearch(e.target.value); setShowDrop(true); }}
                  onFocus={() => setShowDrop(true)}
                  onKeyDown={e => {
                    if (e.key === "Enter") { addCustom(); }
                    if (e.key === "Escape") { setShowDrop(false); }
                  }}
                  placeholder="Cerca o aggiungi comorbidità..."
                  className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
                />
                <DropArrow className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </div>

              {showDrop && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                  {dropResults.length > 0 && (
                    <div className="max-h-48 overflow-y-auto py-1">
                      {dropResults.map(({ catKey, item }) => (
                        <button key={`${catKey}__${item}`} type="button"
                          onClick={() => { addChip(catKey, item); setSearch(""); setShowDrop(false); }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 transition-colors flex items-center gap-2"
                        >
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${CAT_DOT[catKey] || "bg-gray-400"}`} />
                          {item}
                        </button>
                      ))}
                    </div>
                  )}
                  {q && !exactMatch && (
                    <button type="button"
                      onClick={addCustom}
                      className="w-full text-left px-4 py-2 text-sm text-indigo-600 font-medium hover:bg-indigo-50 transition-colors flex items-center gap-2 border-t border-gray-100"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Aggiungi "{search.trim()}"
                    </button>
                  )}
                  {dropResults.length === 0 && !q && (
                    <div className="px-4 py-3 text-xs text-gray-400">Digita per cercare…</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── 3. Dettagli per ciascuna chip ── */}
          {allSelected.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                Dettagli delle comorbidità selezionate
              </div>
              <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100">
                {allSelected.map(({ catKey, item }) => {
                  const key = dk(catKey, item);
                  return (
                    <div key={key} className="flex items-center gap-3 px-4 py-3">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${CAT_DOT[catKey] || "bg-gray-400"}`} />
                      <span className="font-semibold text-sm text-gray-800 w-44 flex-shrink-0 leading-tight">
                        {item}
                      </span>
                      <AutoResizeTextarea
                        value={descs[key] || ""}
                        onChange={e => setDescs(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder="Specifiche / dettagli…"
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                      />
                      <button type="button" onClick={() => removeChip(catKey, item)}
                        className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Note libere generali */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              Note generali (opzionali)
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Osservazioni aggiuntive sull'anamnesi patologica remota…"
              rows={2}
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 leading-relaxed"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
          <Button size="sm" onClick={handleSave} disabled={saving}
            className="bg-[#0A2540] hover:bg-[#051626] text-white text-sm px-5">
            {saving ? "Salvataggio…" : "Salva"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} disabled={saving}
            className="text-gray-500 text-sm">
            Annulla
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Allergies editor modal ────────────────────────────────────────────────────
function AllergiesEditorModal({ drugAllergies, allergologicItems, onSave, onClose, saving }) {
  const [drugDraft,    setDrugDraft]    = useState(drugAllergies || "");
  const [allergoItems, setAllergoItems] = useState([...(allergologicItems || [])]);
  const taRef = useAutoResize(drugDraft);
  const ALLERGO_CAT = COMORBIDITY_CATEGORIES.find(c => c.key === "allergologic");

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const toggleAllergo = (item) =>
    setAllergoItems(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
    >
      <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="font-heading font-bold text-sm text-gray-800 mb-3">Allergie / Intolleranze</div>
        <div className="space-y-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Condizioni allergologiche / atopiche</div>
            <div className="flex flex-wrap gap-1.5">
              {ALLERGO_CAT?.items.map(item => {
                const sel = allergoItems.includes(item);
                return (
                  <button key={item} type="button" onClick={() => toggleAllergo(item)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all ${
                      sel ? "bg-red-50 text-red-700 border-red-200" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {sel && <span className="mr-1">✓</span>}{item}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              Allergie a farmaci (specificare farmaco e reazione)
            </div>
            <textarea ref={taRef} value={drugDraft} onChange={e => setDrugDraft(e.target.value)}
              placeholder="Es: Penicillina (anafilassi), FANS (orticaria)…" rows={3} autoFocus
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 leading-relaxed"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button size="sm" onClick={() => onSave(drugDraft, allergoItems)} disabled={saving}
            className="bg-[#0A2540] hover:bg-[#051626] text-white text-xs">
            {saving ? "Salvataggio…" : "Salva"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} disabled={saving} className="text-gray-500 text-xs">
            Annulla
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Column wrapper ────────────────────────────────────────────────────────────
function Col({ icon: Icon, iconColor, label, reportKey, reportSections, toggleReportSection, onClick, children }) {
  const checked = reportSections?.has(reportKey);
  return (
    <div onClick={onClick}
      className="px-3 py-3 flex flex-col gap-1.5 min-w-0 cursor-pointer group hover:bg-indigo-50/40 transition-colors">
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] group-hover:underline decoration-dotted underline-offset-2 ${iconColor}`}>
          <Icon className="w-3 h-3 flex-shrink-0" />
          {label}
        </div>
        {toggleReportSection && (
          <label title="Includi nel referto" className="flex items-center cursor-pointer flex-shrink-0"
            onClick={e => e.stopPropagation()}>
            <input type="checkbox" checked={!!checked} onChange={() => toggleReportSection(reportKey)}
              style={{ width: 12, height: 12, accentColor: "#0A2540", cursor: "pointer" }} />
          </label>
        )}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PatientProfileStrip({
  patientId,
  patient,
  firstVisit,
  onCockpitData,
  onFirstVisitChange,
  reportSections,
  toggleReportSection,
}) {
  const [expanded,   setExpanded]   = useState(false);
  const [cockpit,    setCockpit]    = useState(null);
  const [openEditor, setOpenEditor] = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [localFv,    setLocalFv]    = useState(null);

  // prima_visita.data holds structural fields (comorbidities, comorbidity_details, etc.)
  const fvBase = firstVisit?.data || firstVisit || {};

  // Patient document is the SSOT for narrative fields (Phase 2C).
  // prima_visita.data.physiologic_history / family_history etc. are legacy fallbacks
  // for patients created before Phase 2C — read-only, never written from here.
  const patientNarrative = {
    physiologic_history:    patient?.anamnesi_fisiologica    || fvBase.physiologic_history    || null,
    family_history:         patient?.anamnesi_familiare      || fvBase.family_history         || null,
    comorbidity_free_notes: patient?.comorbidita_apr         || fvBase.comorbidity_free_notes || null,
    current_therapies_text: patient?.terapia_domiciliare     || fvBase.current_therapies_text || null,
    drug_allergies:         patient?.allergie_testo          || fvBase.drug_allergies         || null,
  };

  // Merge: structural fields from prima_visita, narrative fields from patient doc
  const fvMerged = { ...fvBase, ...Object.fromEntries(Object.entries(patientNarrative).filter(([, v]) => v != null)) };
  const fvData = localFv !== null ? localFv : fvMerged;

  // Load clinical_cockpit
  const load = useCallback(async () => {
    try {
      const doc = await diseaseProfileApi.get(patientId, "clinical_cockpit");
      const base = doc?.data || null;
      if (base) {
        const enriched = { ...base, ...buildEnrichedFields(fvData) };
        setCockpit(enriched);
        onCockpitData?.(enriched);
      } else {
        const initial = {
          physiologic_history: fvData.physiologic_history?.trim() || "",
          family_history:      fvData.family_history?.trim() || "",
          referral_reason_text: "", extra_rheumatologic_history: "",
          last_therapy_modification: "", diagnostic_status: "", pending_items: "",
          ...buildEnrichedFields(fvData),
        };
        setCockpit(initial);
        diseaseProfileApi.upsert(patientId, "clinical_cockpit", initial).catch(() => {});
        onCockpitData?.(initial);
      }
    } catch {
      const fallback = buildEnrichedFields(fvData);
      setCockpit(fallback);
      onCockpitData?.(fallback);
    }
  }, [patientId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Re-sync profile fields to parent when firstVisit or patient data arrives/changes.
  // patient drives narrative fields (SSOT); firstVisit drives structural fields.
  useEffect(() => {
    const enriched = buildEnrichedFields(fvData);
    const physiologic = fvData.physiologic_history?.trim() || "";
    const family      = fvData.family_history?.trim()      || "";
    const hasData = enriched.comorbidities_text || enriched.therapy_dom_text ||
                    enriched.allergies_text || physiologic || family;
    if (!hasData) return;
    const update = { ...enriched, physiologic_history: physiologic, family_history: family };
    setCockpit(prev => prev ? { ...prev, ...update } : prev);
    onCockpitData?.(update);
  }, [firstVisit, patient]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sincronizza i farmaci riconosciuti nel testo terapia → db.therapies.
  // Splitta per riga/virgola/punto-e-virgola, parsa ogni segmento con parseTherapyText,
  // e fa upsert solo per i farmaci riconosciuti (parsed=true) non già attivi.
  const syncTherapiesFromText = useCallback(async (therapyText) => {
    if (!therapyText?.trim() || !patientId) return 0;
    const segments = therapyText
      .split(/[\n;]/)
      .flatMap(line => line.split(","))
      .map(s => s.trim())
      .filter(Boolean);
    const existing = await therapiesApi.listByPatient(patientId).catch(() => []);
    const activeNames = new Set(
      existing.filter(t => t.status === "active").map(t => (t.drug_name || "").toLowerCase())
    );
    let created = 0;
    for (const segment of segments) {
      const p = parseTherapyText(segment);
      if (!p.parsed) continue;
      if (activeNames.has(p.drug_name.toLowerCase())) continue;
      try {
        await therapiesApi.upsert({
          patient_id: patientId,
          drug_name:  p.drug_name,
          category:   p.category || "other",
          dose:       p.dose     || null,
          frequency:  p.frequency || null,
          route:      p.route    || null,
          status:     "active",
          start_date: null,
        });
        activeNames.add(p.drug_name.toLowerCase());
        created++;
      } catch (_) {}
    }
    return created;
  }, [patientId]);

  // Generic save — Phase 2C: narrative fields → patients (PATCH), structural → prima_visita
  //
  // NON-DESTRUCTIVE CONTRACT:
  //   • prima_visita: backend uses dot-notation $set so pre-Phase-2C legacy fields
  //     not present in the current payload are never deleted.
  //   • patient doc: uses PATCH endpoint — only the narrative fields explicitly in
  //     this patch are touched. Other sections of the patient doc are not sent and
  //     therefore cannot be overwritten.
  const saveFields = useCallback(async (patch) => {
    const newFv = { ...fvData, ...patch };
    setLocalFv(newFv);
    setSaving(true);
    try {
      // Build a MINIMAL patient patch — only the narrative keys that are in the
      // current edit.  Empty string → null so the backend $unsets the field.
      // Fields NOT in the patch are completely omitted (other sections untouched).
      const patientPatch = {};
      Object.entries(patch).forEach(([k, v]) => {
        if (!NARRATIVE_KEYS.has(k)) return;
        const dbKey = PATIENT_NARRATIVE_MAP[k];
        patientPatch[dbKey] = (typeof v === "string" && !v.trim()) ? null : (v ?? null);
      });

      // Strip narrative fields — they are managed via patientsApi.patch above,
      // not stored in prima_visita (Phase 2C architecture).
      const {
        physiologic_history, family_history, comorbidity_free_notes,
        current_therapies_text, drug_allergies,
        ...fvOnly
      } = newFv;

      if (process.env.NODE_ENV !== "production") {
        console.log("[ProfileStrip] prima_visita payload →", fvOnly);
        console.log("[ProfileStrip] patient PATCH →", patientPatch);
        const nulled = Object.entries(patientPatch).filter(([, v]) => v === null).map(([k]) => k);
        if (nulled.length) console.warn("[ProfileStrip] Fields that will be CLEARED on patient:", nulled);
      }

      // 1. Structural comorbidity / prima_visita data (non-destructive dot-set on backend)
      await diseaseProfileApi.upsert(patientId, "prima_visita", fvOnly);

      // 2. Narrative fields in patient doc — only what changed in this edit
      if (Object.keys(patientPatch).length > 0) {
        await patientsApi.patch(patientId, patientPatch);
      }

      toast.success("Aggiornato");
      setOpenEditor(null);
      onFirstVisitChange?.();
      const enriched = { ...(cockpit || {}), ...buildEnrichedFields(newFv) };
      setCockpit(enriched);
      onCockpitData?.(enriched);

      // 3. Se si è modificato il testo terapia, sincronizza i farmaci riconosciuti
      //    nel registro strutturato (db.therapies) — solo nuovi, non già attivi.
      if ("current_therapies_text" in patch) {
        const n = await syncTherapiesFromText(patch.current_therapies_text).catch(() => 0);
        if (n > 0) {
          toast.success(
            `${n} ${n === 1 ? "farmaco aggiunto" : "farmaci aggiunti"} al registro terapie`
          );
          onFirstVisitChange?.();
        }
      }
    } catch {
      toast.error("Errore nel salvataggio");
      setLocalFv(null);
    } finally {
      setSaving(false);
    }
  }, [fvData, cockpit, patientId, onFirstVisitChange, onCockpitData, syncTherapiesFromText]);

  // Derived
  const allComorbidities = Object.entries(fvData.comorbidities || {})
    .filter(([k]) => k !== "allergologic")
    .flatMap(([catKey, items]) => (items || []).filter(Boolean).map(item => ({ item, catKey })));

  const allergicItems    = fvData.comorbidities?.allergologic || [];
  const allergiesDisplay = [...allergicItems, fvData.drug_allergies?.trim() || ""].filter(Boolean);

  const therapyLines = (fvData.current_therapies_text || "").split("\n").filter(l => l.trim());
  const MAX_THERAPY  = 4;
  const shownLines   = expanded ? therapyLines : therapyLines.slice(0, MAX_THERAPY);
  const extraCount   = therapyLines.length - MAX_THERAPY;

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50/80 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="font-heading font-bold text-[11px] text-gray-600 uppercase tracking-[0.16em]">
              Profilo generale del paziente
            </span>
            <button type="button" onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700 transition-colors">
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? "Comprimi" : "Mostra dettagli"}
            </button>
          </div>
          <span className="text-[10px] text-gray-400 italic">Clicca una sezione per modificarla</span>
        </div>

        {/* 5 columns */}
        <div className="grid grid-cols-5 divide-x divide-gray-100">

          {/* Fisiologica */}
          <Col icon={Leaf} iconColor="text-emerald-600" label="Fisiologica"
            reportKey="cockpit_physiologic" reportSections={reportSections} toggleReportSection={toggleReportSection}
            onClick={() => setOpenEditor("physiologic")}>
            {fvData.physiologic_history
              ? <p className={`text-xs text-gray-700 leading-snug whitespace-pre-wrap ${!expanded ? "line-clamp-3" : ""}`}>{fvData.physiologic_history}</p>
              : <span className="text-[11px] text-gray-300 italic">Clicca per compilare</span>}
          </Col>

          {/* Familiarità */}
          <Col icon={Users} iconColor="text-blue-500" label="Familiarità"
            reportKey="cockpit_family" reportSections={reportSections} toggleReportSection={toggleReportSection}
            onClick={() => setOpenEditor("family")}>
            {fvData.family_history
              ? <p className={`text-xs text-gray-700 leading-snug whitespace-pre-wrap ${!expanded ? "line-clamp-3" : ""}`}>{fvData.family_history}</p>
              : <span className="text-[11px] text-gray-300 italic">Clicca per compilare</span>}
          </Col>

          {/* Comorbidità */}
          <Col icon={Heart} iconColor="text-rose-500" label="Comorbidità"
            reportKey="profile_comorbidities" reportSections={reportSections} toggleReportSection={toggleReportSection}
            onClick={() => setOpenEditor("comorbidities")}>
            {allComorbidities.length === 0
              ? <span className="text-[11px] text-gray-300 italic">Clicca per compilare</span>
              : <div className="flex flex-wrap gap-1">
                  {allComorbidities.map((c, i) => (
                    <span key={i}
                      className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${CAT_COLOR[c.catKey] || DEFAULT_COLOR}`}>
                      {c.item}
                    </span>
                  ))}
                  {fvData.comorbidity_free_notes?.trim() && (
                    <span className="text-[10px] text-gray-500 italic self-center">
                      {fvData.comorbidity_free_notes.trim()}
                    </span>
                  )}
                </div>
            }
          </Col>

          {/* Terapia domiciliare */}
          <Col icon={Pill} iconColor="text-amber-500" label="Terapia domiciliare"
            reportKey="profile_therapy" reportSections={reportSections} toggleReportSection={toggleReportSection}
            onClick={() => setOpenEditor("therapy")}>
            {therapyLines.length === 0
              ? <span className="text-[11px] text-gray-300 italic">Clicca per compilare</span>
              : <div className="space-y-0.5">
                  {shownLines.map((line, i) => <div key={i} className="text-xs text-gray-700 leading-snug">{line}</div>)}
                  {!expanded && extraCount > 0 && (
                    <button type="button" onClick={e => { e.stopPropagation(); setExpanded(true); }}
                      className="text-[10px] text-indigo-500 hover:underline font-medium">
                      + altre {extraCount} {extraCount === 1 ? "terapia" : "terapie"}
                    </button>
                  )}
                </div>
            }
          </Col>

          {/* Allergie */}
          <Col icon={AlertTriangle} iconColor="text-orange-500" label="Allergie / Intolleranze"
            reportKey="profile_allergies" reportSections={reportSections} toggleReportSection={toggleReportSection}
            onClick={() => setOpenEditor("allergies")}>
            {allergiesDisplay.length === 0
              ? <span className="text-[11px] text-gray-300 italic">Clicca per compilare</span>
              : <div className="space-y-0.5">
                  {allergiesDisplay.map((a, i) => <div key={i} className="text-xs text-orange-700 leading-snug font-medium">{a}</div>)}
                </div>
            }
          </Col>

        </div>
      </div>

      {/* Modals */}
      {openEditor === "physiologic" && (
        <TextEditorModal title="Anamnesi fisiologica"
          value={fvData.physiologic_history || ""}
          placeholder="Abitudini di vita, fumo, alcol, attività fisica, storia riproduttiva, familiari a carico…"
          onSave={v => saveFields({ physiologic_history: v })}
          onClose={() => setOpenEditor(null)} saving={saving} />
      )}
      {openEditor === "family" && (
        <TextEditorModal title="Anamnesi familiare"
          value={fvData.family_history || ""}
          placeholder="Familiarità per patologie reumatologiche, autoimmuni o correlate (specificare il grado di parentela)…"
          onSave={v => saveFields({ family_history: v })}
          onClose={() => setOpenEditor(null)} saving={saving} />
      )}
      {openEditor === "therapy" && (
        <TextEditorModal title="Terapia domiciliare (non reumatologica)"
          value={fvData.current_therapies_text || ""}
          placeholder={"Una terapia per riga:\nRamipril 5 mg 1 cp/die\nAtorvastatin 20 mg 1 cp/die\n…"}
          onSave={v => saveFields({ current_therapies_text: v })}
          onClose={() => setOpenEditor(null)} saving={saving} />
      )}
      {openEditor === "comorbidities" && (
        <ComorbidityEditorModal
          comorbidities={fvData.comorbidities || {}}
          comorbDetails={fvData.comorbidity_details || {}}
          freeNotes={fvData.comorbidity_free_notes || ""}
          onSave={(comorbidities, comorbidity_free_notes, comorbidity_details) =>
            saveFields({ comorbidities, comorbidity_free_notes, comorbidity_details })}
          onClose={() => setOpenEditor(null)}
          saving={saving}
        />
      )}
      {openEditor === "allergies" && (
        <AllergiesEditorModal
          drugAllergies={fvData.drug_allergies || ""}
          allergologicItems={fvData.comorbidities?.allergologic || []}
          onSave={(drug_allergies, allergologicItems) =>
            saveFields({ drug_allergies, comorbidities: { ...(fvData.comorbidities || {}), allergologic: allergologicItems } })}
          onClose={() => setOpenEditor(null)} saving={saving} />
      )}
    </>
  );
}
