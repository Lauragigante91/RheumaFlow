import React, { useState } from "react";
import { therapiesApi } from "../../lib/api";
import { toast } from "sonner";
import { X, Check, ChevronDown, ChevronUp, AlertTriangle, HelpCircle, Clock, History } from "lucide-react";

const CATEGORY_LABELS = {
  antiplatelet: "Antiaggregante",
  ace_inhibitor: "ACE inibitore",
  arb: "Sartano",
  ca_channel_blocker: "Calcio-antagonista",
  beta_blocker: "Beta-bloccante",
  biguanide: "Biguanide",
  sulfonylurea: "Sulfonilurea",
  dpp4_inhibitor: "DPP-4 inibitore",
  sglt2_inhibitor: "SGLT-2 inibitore",
  glp1_agonist: "GLP-1 agonista",
  insulin: "Insulina",
  statin: "Statina",
  other_lipid: "Ipolipemizzante",
  urate_lowering: "Uricostatico",
  anticoagulant: "Anticoagulante",
  antiarrhythmic: "Antiaritmico",
  diuretic: "Diuretico",
  ppi: "Gastroprotettore",
  thyroid: "Tiroide",
  bisphosphonate: "Bifosfonato",
  denosumab: "Anti-osteoporotico",
  antiviral_hbv: "Antivirale HBV",
  antiviral_hcv: "Antivirale HCV",
  analgesic: "Analgesico",
  csDMARD: "csDMARD",
  bDMARD: "bDMARD",
  tsDMARD: "tsDMARD",
  glucocorticoid: "Glucocorticoide",
  NSAID: "FANS",
  supportive: "Supportivo",
  other: "Altro",
};

function CategoryBadge({ category }) {
  const label = CATEGORY_LABELS[category] || category;
  return (
    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">
      {label}
    </span>
  );
}

function ConcomitantChip({ item, onChange }) {
  const [open, setOpen] = useState(false);
  const isUnrecognized = !item._recognized;
  const isDuplicate = item._duplicate;

  return (
    <div className={`rounded-lg border text-sm transition-colors ${
      item._skip ? "opacity-40 bg-gray-50 border-gray-200" :
      isDuplicate ? "bg-blue-50 border-blue-200" :
      isUnrecognized ? "bg-amber-50 border-amber-200" :
      "bg-white border-gray-200"
    }`}>
      <div className="flex items-center gap-2 px-3 py-2">
        {isUnrecognized ? (
          <HelpCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        ) : isDuplicate ? (
          <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
        ) : (
          <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
        )}

        <span className={`font-semibold flex-1 ${item._skip ? "line-through text-gray-400" : "text-gray-800"}`}>
          {item.canonical || item.drug_name}
        </span>

        {item.dose && (
          <span className="text-xs text-gray-500">{item.dose}</span>
        )}

        <CategoryBadge category={item.category} />

        {isDuplicate && (
          <span className="text-[10px] text-blue-600 font-medium">già attiva</span>
        )}
        {isUnrecognized && (
          <span className="text-[10px] text-amber-600 font-medium">non riconosciuto</span>
        )}

        {!isDuplicate && (
          <>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="text-gray-400 hover:text-gray-600 ml-1"
              title="Modifica"
            >
              {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...item, _skip: !item._skip })}
              className={`ml-0.5 rounded p-0.5 transition-colors ${
                item._skip ? "text-gray-400 hover:text-green-600" : "text-gray-400 hover:text-red-500"
              }`}
              title={item._skip ? "Includi" : "Escludi"}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {open && !isDuplicate && (
        <div className="px-3 pb-3 pt-0 border-t border-gray-100 space-y-2">
          <div className="flex items-center gap-2 mt-2">
            <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <label className="text-xs text-gray-500 w-36 flex-shrink-0">
              Data inizio reale (opz.)
            </label>
            <input
              type="text"
              placeholder="es. 2019 o 2019-03"
              value={item._custom_start_date || ""}
              onChange={(e) => onChange({ ...item, _custom_start_date: e.target.value })}
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-300"
            />
          </div>
          {isUnrecognized && (
            <div className="flex items-center gap-2">
              <HelpCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="text-xs text-amber-700">
                Farmaco non riconosciuto — verrà salvato come testo libero nella categoria "Altro".
                Puoi includerlo comunque o escluderlo.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HistoricalChip({ item, onChange }) {
  const [open, setOpen] = useState(false);
  const isDuplicate = item._duplicate;
  const isAmbiguous = item._ambiguous;

  return (
    <div className={`rounded-lg border text-sm transition-colors ${
      item._skip ? "opacity-40 bg-gray-50 border-gray-200" :
      isDuplicate ? "bg-blue-50 border-blue-200" :
      isAmbiguous ? "bg-amber-50 border-amber-300" :
      "bg-purple-50 border-purple-200"
    }`}>
      <div className="flex items-center gap-2 px-3 py-2">
        {isAmbiguous ? (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        ) : (
          <History className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
        )}
        <span className={`font-semibold flex-1 ${item._skip ? "line-through text-gray-400" : "text-gray-800"}`}>
          {item.canonical || item.drug_name}
        </span>

        {item.start_date && (
          <span className="text-xs text-gray-500">
            {item.date_approximate ? "~" : ""}{item.start_date}
            {item.end_date ? `–${item.end_date}` : ""}
          </span>
        )}

        <CategoryBadge category={item.category} />

        {item.discontinuation_reason && (
          <span className={`text-[10px] italic ${isAmbiguous ? "text-amber-700" : "text-purple-600"}`}>
            {item.discontinuation_reason}
          </span>
        )}

        {isDuplicate && (
          <span className="text-[10px] text-blue-600 font-medium">già registrata</span>
        )}
        {isAmbiguous && !item._skip && (
          <span className="text-[10px] text-amber-700 font-semibold">da confermare</span>
        )}

        {!isDuplicate && (
          <>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="text-gray-400 hover:text-gray-600 ml-1"
            >
              {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...item, _skip: !item._skip })}
              className={`ml-0.5 rounded p-0.5 transition-colors ${
                item._skip ? "text-gray-400 hover:text-green-600" : "text-gray-400 hover:text-red-500"
              }`}
              title={item._skip ? "Includi" : "Escludi"}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {open && !isDuplicate && (
        <div className={`px-3 pb-3 pt-0 border-t ${isAmbiguous ? "border-amber-200" : "border-purple-100"} space-y-2 mt-1`}>
          {isAmbiguous && (
            <p className="text-xs text-amber-800 bg-amber-100 rounded px-2 py-1.5 mt-2 leading-relaxed">
              Il farmaco è stato trovato nel mezzo di una frase descrittiva — potrebbe riferirsi alla terapia attuale già presente.
              Verifica se si tratta di un episodio storico separato e compila le date, oppure escludi questa voce.
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <label className="text-xs text-gray-500 w-20 flex-shrink-0">Inizio</label>
            <input
              type="text"
              placeholder="es. 2015"
              value={item._edit_start || ""}
              onChange={(e) => onChange({ ...item, _edit_start: e.target.value, start_date: e.target.value })}
              className="w-24 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-purple-300"
            />
            <label className="text-xs text-gray-500 w-10 flex-shrink-0">Fine</label>
            <input
              type="text"
              placeholder="es. 2016"
              value={item._edit_end || ""}
              onChange={(e) => onChange({ ...item, _edit_end: e.target.value, end_date: e.target.value })}
              className="w-24 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-purple-300"
            />
            <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={!!item._edit_approx}
                onChange={(e) => onChange({ ...item, _edit_approx: e.target.checked, date_approximate: e.target.checked })}
                className="w-3 h-3"
              />
              Approssimative
            </label>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-20 flex-shrink-0">Motivo sospensione</label>
            <input
              type="text"
              placeholder="es. intolleranza, inefficacia…"
              value={item._edit_reason || ""}
              onChange={(e) => onChange({ ...item, _edit_reason: e.target.value, discontinuation_reason: e.target.value })}
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-purple-300"
            />
          </div>
          {item.indication && (
            <p className="text-xs text-gray-400">Indicazione rilevata: <span className="font-medium text-gray-600">{item.indication}</span></p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * ConcomitantTherapyReview
 *
 * Props:
 *   mode:        "noted" | "historical"
 *   items:       array from parseConcomitantDrugs() or parseHistoricalTherapies()
 *   patientId:   string
 *   onConfirmed: () => void — called after successful save
 *   onCancel:    () => void — called when user closes without saving
 */
export default function ConcomitantTherapyReview({ mode, items: initialItems, patientId, onConfirmed, onCancel }) {
  const [items, setItems] = useState(initialItems);
  const [saving, setSaving] = useState(false);

  const updateItem = (idx, updated) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? updated : it)));
  };

  const toSave = items.filter((it) => !it._skip && !it._duplicate);
  const skipped = items.filter((it) => it._skip).length;
  const duplicates = items.filter((it) => it._duplicate).length;

  const handleConfirm = async () => {
    if (toSave.length === 0) { onConfirmed?.(); return; }
    setSaving(true);
    let ok = 0;
    let fail = 0;
    for (const item of toSave) {
      try {
        const payload = {
          patient_id: patientId,
          drug_name: item.drug_name || item.canonical,
          drug_canonical: item.drug_canonical || null,
          category: item.category || "other",
          therapy_type: item.therapy_type || null,
          relevance: item.relevance || "low",
          dose: item.dose || null,
          route: item.route || null,
          indication: item.indication || null,
          status: item.status || (mode === "historical" ? "discontinued" : "active"),
          event_type_override: item.event_type_override,
          start_date: (mode === "noted" ? item._custom_start_date || null : item.start_date) || null,
          end_date: item.end_date || null,
          first_seen_date: item.first_seen_date,
          date_approximate: item.date_approximate || item._edit_approx || false,
          discontinuation_reason: item.discontinuation_reason || item._edit_reason || null,
          source: item.source || "anamnesi_prima_visita",
        };
        await therapiesApi.upsert(payload);
        ok++;
      } catch {
        fail++;
      }
    }
    setSaving(false);
    if (fail === 0) {
      toast.success(`${ok} ${mode === "historical" ? "terapie pregresse" : "terapie"} registrate`);
    } else {
      toast.warning(`${ok} salvate, ${fail} errori`);
    }
    onConfirmed?.();
  };

  const isHistorical = mode === "historical";
  const headerColor = isHistorical ? "text-purple-700" : "text-slate-700";
  const btnColor = isHistorical
    ? "bg-purple-600 hover:bg-purple-700 text-white"
    : "bg-blue-600 hover:bg-blue-700 text-white";

  return (
    <div className={`mt-2 rounded-xl border p-3 space-y-2 ${
      isHistorical ? "border-purple-200 bg-purple-50/40" : "border-blue-200 bg-blue-50/30"
    }`}>
      <div className="flex items-center justify-between">
        <p className={`text-xs font-semibold ${headerColor}`}>
          {isHistorical ? "Terapie pregresse rilevate" : "Farmaci riconosciuti"}{" "}
          <span className="font-normal text-gray-400">
            ({toSave.length} da registrare
            {skipped > 0 ? `, ${skipped} esclusi` : ""}
            {duplicates > 0 ? `, ${duplicates} già presenti` : ""})
          </span>
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {items.length === 0 && (
        <p className="text-xs text-gray-400 italic py-1">
          Nessun farmaco riconosciuto. Controlla il testo o aggiungi manualmente.
        </p>
      )}

      <div className="space-y-1.5">
        {items.map((item, idx) =>
          isHistorical ? (
            <HistoricalChip key={idx} item={item} onChange={(updated) => updateItem(idx, updated)} />
          ) : (
            <ConcomitantChip key={idx} item={item} onChange={(updated) => updateItem(idx, updated)} />
          )
        )}
      </div>

      {toSave.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${btnColor} disabled:opacity-60`}
          >
            {saving ? "Salvataggio…" : `Conferma ${toSave.length} ${isHistorical ? (toSave.length === 1 ? "pregressa" : "pregresse") : (toSave.length === 1 ? "farmaco" : "farmaci")}`}
          </button>
          <button
            type="button"
            onClick={() => setItems((prev) => prev.map((it) => ({ ...it, _skip: true })))}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Escludi tutti
          </button>
        </div>
      )}
    </div>
  );
}
