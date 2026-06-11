import React, { useEffect, useState, useCallback } from "react";
import { diseaseProfileApi } from "../../lib/api";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Save, ChevronDown, ChevronUp, Check } from "lucide-react";
import { toast } from "sonner";

// ─── Data definitions ──────────────────────────────────────────────────────────

const COMORBIDITY_CATEGORIES = [
  {
    key: "cardiovascular", label: "Cardiovascolare",
    items: ["Ipertensione arteriosa", "Fibrillazione atriale", "Cardiopatia ischemica", "Scompenso cardiaco", "Valvulopatia", "Pregresso ictus/TIA", "TVP/TEP", "Arteriopatia periferica"],
  },
  {
    key: "metabolic", label: "Metabolico",
    items: ["Diabete tipo 2", "Diabete tipo 1", "Dislipidemia", "Obesità", "Sindrome metabolica", "Iperuricemia / Gotta", "Steatosi epatica"],
  },
  {
    key: "respiratory", label: "Respiratorio",
    items: ["BPCO", "Asma bronchiale", "ILD / Fibrosi polmonare", "Apnea ostruttiva del sonno", "Ipertensione polmonare"],
  },
  {
    key: "infectious", label: "Infettivologico",
    items: ["Epatite B (HBsAg+)", "Epatite B (HBcAb+)", "Epatite C", "HIV", "TBC latente", "Infezioni ricorrenti", "Bronchiectasie"],
  },
  {
    key: "oncologic", label: "Oncologico",
    items: ["Neoplasia solida pregressa", "Neoplasia solida attiva", "Neoplasia ematologica pregressa", "Neoplasia ematologica attiva", "Melanoma pregresso"],
  },
  {
    key: "gastrointestinal", label: "Gastroenterico",
    items: ["Ulcera peptica", "MRGE", "Diverticolite / Diverticolosi", "IBD (Crohn / RCU)", "Epatopatia cronica", "Cirrosi epatica"],
  },
  {
    key: "renal", label: "Renale",
    items: ["IRC lieve (GFR 60–89)", "IRC moderata (GFR 30–59)", "IRC grave (GFR <30)", "Dialisi", "Trapianto renale", "Proteinuria significativa"],
  },
  {
    key: "neurologic", label: "Neurologico",
    items: ["Neuropatia periferica", "Epilessia", "Parkinson", "Sclerosi multipla", "Demenza / decadimento cognitivo", "Miopatia"],
  },
  {
    key: "psychiatric", label: "Psichiatrico",
    items: ["Depressione", "Disturbo ansioso", "Disturbo bipolare", "Schizofrenia / Psicosi", "Disturbo del sonno"],
  },
  {
    key: "osteo_rheum", label: "Osteo-metabolico / Reumatologico",
    items: ["Osteoporosi", "Osteopenia", "Pregresse fratture da fragilità", "Ipovitaminosi D cronica", "Overlap sindrome reumatologica"],
  },
  {
    key: "endocrine", label: "Endocrino",
    items: ["Ipotiroidismo", "Ipertiroidismo", "Tiroidite autoimmune", "Insufficienza surrenalica", "Ipogonadismo"],
  },
  {
    key: "allergologic", label: "Allergologico",
    items: ["Allergia a farmaci (specificare in note)", "Allergia alimentare", "Asma allergica", "Dermatite atopica"],
  },
];

const FRAILTY_ITEMS = [
  "Cadute ricorrenti", "Ridotta mobilità / allettamento", "Deterioramento cognitivo",
  "Polifarmacia (≥5 farmaci)", "Scarsa aderenza terapeutica", "Assenza caregiver",
  "Difficoltà sociali / lavorative", "Vaccinazioni incomplete", "Malnutrizione / cachessia",
  "Isolamento sociale",
];

const CONCOMITANT_THERAPY_CATEGORIES = [
  { key: "cardiovascular_drugs", label: "Farmaci cardiovascolari" },
  { key: "anticoagulants", label: "Anticoagulanti / Antiaggreganti" },
  { key: "diabetes_metabolic", label: "Farmaci per diabete / metabolismo" },
  { key: "gastroprotective", label: "Gastroprotettori" },
  { key: "psychiatric_drugs", label: "Farmaci psichiatrici" },
  { key: "respiratory_drugs", label: "Farmaci respiratori" },
  { key: "neurologic_drugs", label: "Farmaci neurologici" },
  { key: "oncologic_therapies", label: "Terapie oncologiche" },
  { key: "hormonal", label: "Terapie ormonali" },
  { key: "supplements", label: "Integratori / Altro" },
];

// ─── Tag button ────────────────────────────────────────────────────────────────
function TagButton({ label, selected, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
        selected
          ? "bg-[#0A2540] border-[#0A2540] text-white"
          : "bg-white border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-800"
      }`}
    >
      {selected && <Check className="w-3 h-3 flex-shrink-0" />}
      {label}
    </button>
  );
}

// ─── Category group ────────────────────────────────────────────────────────────
function CategoryGroup({ label, items, selected, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  const hasSelections = items.some((it) => selected.includes(it));
  const visible = expanded ? items : items.slice(0, 5);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 mb-1.5 group"
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">
          {label}
        </span>
        {hasSelections && (
          <span className="text-[9px] bg-[#0A2540] text-white rounded-full px-1.5 py-0.5">
            {items.filter((it) => selected.includes(it)).length}
          </span>
        )}
        {items.length > 5 && (
          <span className="text-[9px] text-gray-400 group-hover:text-gray-500">
            {expanded ? "▲" : `+${items.length - 5}`}
          </span>
        )}
      </button>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((item) => (
          <TagButton
            key={item}
            label={item}
            selected={selected.includes(item)}
            onToggle={() => onToggle(item)}
          />
        ))}
        {!expanded && items.slice(5).some((it) => selected.includes(it)) &&
          items.slice(5).filter((it) => selected.includes(it)).map((item) => (
            <TagButton
              key={item}
              label={item}
              selected
              onToggle={() => onToggle(item)}
            />
          ))
        }
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
const EMPTY = {
  comorbidities: {},
  comorbidity_notes: "",
  frailty: [],
  therapies: {},
  therapy_notes: "",
  previous_therapy_notes: "",
};

export default function ComorbiditiesSection({ patient }) {
  const [data, setData] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!patient?.id) return;
    const doc = await diseaseProfileApi.get(patient.id, "comorbidities").catch(() => null);
    if (doc?.data) {
      const d = doc.data;
      setData({
        ...EMPTY,
        ...d,
        comorbidities: (d.comorbidities && typeof d.comorbidities === "object" && !Array.isArray(d.comorbidities)) ? d.comorbidities : {},
        frailty: Array.isArray(d.frailty) ? d.frailty : [],
        therapies: (d.therapies && typeof d.therapies === "object" && !Array.isArray(d.therapies)) ? d.therapies : {},
      });
    }
  }, [patient?.id]);

  useEffect(() => { load(); }, [load]);

  const patch = (updater) => {
    setData((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setDirty(true);
      return next;
    });
  };

  const toggleComorbidity = (catKey, item) => {
    patch((prev) => {
      const current = prev.comorbidities[catKey] || [];
      const updated = current.includes(item)
        ? current.filter((x) => x !== item)
        : [...current, item];
      return { ...prev, comorbidities: { ...prev.comorbidities, [catKey]: updated } };
    });
  };

  const toggleFrailty = (item) => {
    patch((prev) => {
      const updated = prev.frailty.includes(item)
        ? prev.frailty.filter((x) => x !== item)
        : [...prev.frailty, item];
      return { ...prev, frailty: updated };
    });
  };

  const toggleTherapy = (catKey) => {
    patch((prev) => {
      const current = prev.therapies[catKey];
      const updated = { ...prev.therapies };
      if (current !== undefined) {
        delete updated[catKey];
      } else {
        updated[catKey] = "";
      }
      return { ...prev, therapies: updated };
    });
  };

  const setTherapyNote = (catKey, value) => {
    patch((prev) => ({
      ...prev,
      therapies: { ...prev.therapies, [catKey]: value },
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await diseaseProfileApi.upsert(patient.id, "comorbidities", data);
      toast.success("Comorbidità e terapie aggiornate.");
      setDirty(false);
    } catch {
      toast.error("Errore nel salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  // ── Summary counts ────────────────────────────────────────────────────────
  const totalComorbidities = Object.values(data.comorbidities || {}).flat().length;
  const totalFrailty = (data.frailty || []).length;
  const totalTherapies = Object.keys(data.therapies || {}).length;
  const totalItems = totalComorbidities + totalFrailty + totalTherapies;

  const summaryParts = [];
  if (totalComorbidities) summaryParts.push(`${totalComorbidities} comorbidità`);
  if (totalTherapies) summaryParts.push(`${totalTherapies} terapie`);
  if (totalFrailty) summaryParts.push(`${totalFrailty} fattori fragilità`);

  return (
    <Card className="border-gray-200 shadow-sm overflow-hidden">
      {/* ── Header / toggle ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-heading font-semibold text-xs text-gray-400 uppercase tracking-[0.15em]">
            Comorbidità &amp; Terapie Concomitanti
          </span>
          {summaryParts.length > 0 ? (
            <span className="text-[11px] text-gray-500 font-normal normal-case">
              {summaryParts.join(" · ")}
            </span>
          ) : (
            <span className="text-[11px] text-gray-400 font-normal normal-case italic">Nessuna registrata</span>
          )}
          {dirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" title="Modifiche non salvate" />}
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-400" />
          : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="p-5 space-y-7">

          {/* ── Section 1: Comorbidities ──────────────────────────────── */}
          <div>
            <h3 className="font-heading font-bold text-sm text-[#0A2540] mb-3">1. Comorbidità</h3>
            <div className="space-y-4">
              {COMORBIDITY_CATEGORIES.map((cat) => (
                <CategoryGroup
                  key={cat.key}
                  label={cat.label}
                  items={cat.items}
                  selected={(data.comorbidities || {})[cat.key] || []}
                  onToggle={(item) => toggleComorbidity(cat.key, item)}
                />
              ))}
            </div>
            <div className="mt-3">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 block mb-1">
                Altre comorbidità / note cliniche
              </label>
              <textarea
                value={data.comorbidity_notes}
                onChange={(e) => patch((p) => ({ ...p, comorbidity_notes: e.target.value }))}
                rows={2}
                placeholder="Es. anemia cronica, pregresso intervento cardiochirurgico…"
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-300"
              />
            </div>
          </div>

          {/* ── Section 2: Frailty factors ────────────────────────────── */}
          <div>
            <h3 className="font-heading font-bold text-sm text-[#0A2540] mb-3">2. Fattori di fragilità / gestione</h3>
            <div className="flex flex-wrap gap-1.5">
              {FRAILTY_ITEMS.map((item) => (
                <TagButton
                  key={item}
                  label={item}
                  selected={(data.frailty || []).includes(item)}
                  onToggle={() => toggleFrailty(item)}
                />
              ))}
            </div>
          </div>

          {/* ── Section 3: Concomitant non-rheumatologic therapies ────── */}
          <div>
            <h3 className="font-heading font-bold text-sm text-[#0A2540] mb-3">3. Terapie concomitanti non reumatologiche</h3>
            <div className="space-y-2">
              {CONCOMITANT_THERAPY_CATEGORIES.map((cat) => {
                const active = cat.key in (data.therapies || {});
                return (
                  <div key={cat.key} className={`rounded-lg border transition-colors ${active ? "border-[#0A2540]/20 bg-[#0A2540]/[0.02]" : "border-gray-100"}`}>
                    <div className="flex items-center gap-2 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleTherapy(cat.key)}
                        className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                          active ? "bg-[#0A2540] border-[#0A2540]" : "border-gray-300 bg-white hover:border-gray-500"
                        }`}
                      >
                        {active && <Check className="w-2.5 h-2.5 text-white" />}
                      </button>
                      <span className={`text-xs font-medium ${active ? "text-[#0A2540]" : "text-gray-600"}`}>{cat.label}</span>
                    </div>
                    {active && (
                      <div className="px-3 pb-2">
                        <input
                          type="text"
                          value={(data.therapies || {})[cat.key] || ""}
                          onChange={(e) => setTherapyNote(cat.key, e.target.value)}
                          placeholder="Farmaco, dose, schema (es. Atorvastatina 20 mg/die)"
                          className="w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-blue-300"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 space-y-2">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 block mb-1">
                  Note sulle terapie concomitanti
                </label>
                <textarea
                  value={data.therapy_notes}
                  onChange={(e) => patch((p) => ({ ...p, therapy_notes: e.target.value }))}
                  rows={2}
                  placeholder="Interazioni rilevanti, note sul regime terapeutico complessivo…"
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-300"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 block mb-1">
                  Terapie non reumatologiche pregresse rilevanti
                </label>
                <textarea
                  value={data.previous_therapy_notes}
                  onChange={(e) => patch((p) => ({ ...p, previous_therapy_notes: e.target.value }))}
                  rows={2}
                  placeholder="Es. chemioterapia pregressa, terapia anticoagulante sospesa…"
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-300"
                />
              </div>
            </div>
          </div>

          {/* ── Save footer ────────────────────────────────────────────── */}
          <div className="flex justify-end pt-2 border-t border-gray-100">
            <Button
              onClick={save}
              disabled={saving || !dirty}
              className="bg-[#0A2540] text-white hover:bg-[#051626] text-xs h-8"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {saving ? "Salvataggio…" : "Salva comorbidità e terapie"}
            </Button>
          </div>

        </div>
      )}
    </Card>
  );
}
