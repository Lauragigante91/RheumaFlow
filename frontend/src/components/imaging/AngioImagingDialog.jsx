import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { X, Save, Trash2 } from "lucide-react";
import { instrumentalExamsApi } from "../../lib/api";
import ItalianDatePicker from "../shared/ItalianDatePicker";

// ─── Districts ────────────────────────────────────────────────────────────────
const ANGIO_DISTRICTS = [
  { key: "ascending_aorta",             label: "Aorta ascendente",            group: "Aorta" },
  { key: "aortic_arch",                 label: "Arco aortico",                group: "Aorta" },
  { key: "descending_thoracic_aorta",   label: "Aorta toracica discendente",  group: "Aorta" },
  { key: "abdominal_aorta",             label: "Aorta addominale",            group: "Aorta" },
  { key: "carotid_dx",                  label: "Carotide dx",                 group: "Sovra-aortici" },
  { key: "carotid_sx",                  label: "Carotide sx",                 group: "Sovra-aortici" },
  { key: "subclavian_dx",               label: "Succlavia dx",                group: "Sovra-aortici" },
  { key: "subclavian_sx",               label: "Succlavia sx",                group: "Sovra-aortici" },
  { key: "axillary_dx",                 label: "Ascellare dx",                group: "Sovra-aortici" },
  { key: "axillary_sx",                 label: "Ascellare sx",                group: "Sovra-aortici" },
  { key: "iliac_dx",                    label: "Iliaca dx",                   group: "Sotto-diaframmatico" },
  { key: "iliac_sx",                    label: "Iliaca sx",                   group: "Sotto-diaframmatico" },
  { key: "renal_dx",                    label: "Renale dx",                   group: "Sotto-diaframmatico" },
  { key: "renal_sx",                    label: "Renale sx",                   group: "Sotto-diaframmatico" },
  { key: "mesenteric",                  label: "Mesenterica",                 group: "Sotto-diaframmatico" },
];

const GROUPS = [...new Set(ANGIO_DISTRICTS.map(d => d.group))];

const CHANGE_LABELS = {
  stable:   "Stabile",
  improved: "Miglioramento",
  worse:    "Peggioramento",
  new:      "Nuova lesione",
};

function initFindings() {
  return Object.fromEntries(ANGIO_DISTRICTS.map(d => [d.key, {
    stenosis: "none", aneurysm: false, wall_thickening: false,
    wall_enhancement: false, change: "stable",
  }]));
}

function hasFinding(f) {
  return f?.aneurysm || f?.wall_thickening || f?.wall_enhancement ||
    (f?.stenosis && f.stenosis !== "none") ||
    (f?.change && f.change !== "stable");
}

function generateSummary(findings, modality) {
  const type = modality === "angio_mri" ? "AngioMRI" : "AngioCT";
  const parts = [];
  for (const d of ANGIO_DISTRICTS) {
    const f = findings[d.key];
    if (!f || !hasFinding(f)) continue;
    const items = [];
    if (f.stenosis !== "none")  items.push(`stenosi ${f.stenosis}`);
    if (f.aneurysm)             items.push("aneurisma");
    if (f.wall_thickening)      items.push("ispessimento parietale");
    if (f.wall_enhancement)     items.push("enhancement parietale");
    if (f.change && f.change !== "stable") items.push(CHANGE_LABELS[f.change]);
    parts.push(`${d.label}: ${items.join(", ")}`);
  }
  if (!parts.length) return `${type}: nessun reperto strutturale patologico significativo.`;
  return `${type}. ${parts.join("; ")}.`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AngioImagingDialog({
  open, onClose, patient, prefillAssessment, initialModality, onSaved, visitDate,
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate]         = useState(visitDate || today);
  const [modality, setModality] = useState(initialModality || "angio_ct");
  const [findings, setFindings] = useState(initFindings);
  const [indication, setIndication] = useState("");
  const [notes, setNotes]       = useState("");
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialModality) setModality(initialModality);
    if (prefillAssessment) {
      setDate(prefillAssessment.exam_date?.slice(0, 10) || visitDate || today);
      if (prefillAssessment.exam_type) setModality(prefillAssessment.exam_type);
      setFindings({ ...initFindings(), ...prefillAssessment.structured_values?.districts });
      setIndication(prefillAssessment.structured_values?.indication || "");
      setNotes(prefillAssessment.source_text || "");
    } else {
      setDate(today);
      setFindings(initFindings());
      setIndication("");
      setNotes("");
    }
  }, [open, prefillAssessment, initialModality]); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = (key, field, value) =>
    setFindings(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const summary = useMemo(() => generateSummary(findings, modality), [findings, modality]);
  const activeDistricts = ANGIO_DISTRICTS.filter(d => hasFinding(findings[d.key]));

  const modalityLabel = modality === "angio_mri" ? "AngioMRI" : "AngioCT";

  const handleDelete = async () => {
    if (!prefillAssessment?.id) return;
    if (!window.confirm(`Eliminare questo esame (${modalityLabel})? L'azione non può essere annullata.`)) return;
    try {
      await instrumentalExamsApi.remove(prefillAssessment.id);
      toast.success(`${modalityLabel} eliminato.`);
      onSaved?.();
      onClose();
    } catch {
      toast.error("Errore durante l'eliminazione.");
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        patient_id: patient.id,
        exam_date: date,
        exam_type: modality,
        result: activeDistricts.length > 0 ? "positive" : "negative",
        summary,
        source_text: [indication, notes].filter(Boolean).join("\n") || null,
        structured_values: {
          districts: findings,
          indication: indication.trim() || null,
          active_districts: activeDistricts.map(d => d.key),
        },
      };
      if (prefillAssessment?.id) {
        await instrumentalExamsApi.update(prefillAssessment.id, payload);
        toast.success(`${modalityLabel} aggiornata.`);
      } else {
        await instrumentalExamsApi.create(payload);
        toast.success(
          activeDistricts.length
            ? `${modalityLabel} registrata — ${activeDistricts.length} distretto/i con reperto.`
            : `${modalityLabel} registrata — nessun reperto significativo.`
        );
      }
      onSaved?.();
      onClose();
    } catch {
      toast.error("Errore nel salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between px-5 pt-4 pb-3 border-b border-gray-200 flex-shrink-0">
          <DialogTitle className="font-heading text-lg font-bold text-[#0A2540]">
            {modalityLabel}
            {patient && <span className="font-normal text-gray-500 ml-2 text-base">— {patient.cognome} {patient.nome}</span>}
          </DialogTitle>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
        </DialogHeader>

        {/* Sub-header: modality picker + date */}
        <div className="flex items-center gap-6 px-5 py-2.5 bg-gray-50 border-b border-gray-100 flex-shrink-0 flex-wrap">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Modalità</div>
            <div className="flex gap-2">
              {[["angio_ct", "AngioCT"], ["angio_mri", "AngioMRI"]].map(([v, lbl]) => (
                <button key={v} type="button" onClick={() => setModality(v)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all ${
                    modality === v
                      ? "bg-[#0A2540] text-white border-[#0A2540]"
                      : "bg-white text-gray-500 border-gray-300 hover:border-gray-500"
                  }`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Data esame</div>
            <ItalianDatePicker value={date} onChange={setDate} />
          </div>
          <div className="ml-auto">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              activeDistricts.length > 0
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "bg-gray-100 border-gray-200 text-gray-500"
            }`}>
              {activeDistricts.length > 0 ? `${activeDistricts.length} distretti con reperto` : "Nessun reperto"}
            </span>
          </div>
        </div>

        {/* Districts table */}
        <div className="flex-1 overflow-y-auto">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-[#F9FAFB] border-b-2 border-gray-200 z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-[9px] uppercase tracking-widest font-bold text-gray-500 w-[180px] border-r border-gray-200">Distretto</th>
                  <th className="px-2 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-gray-600 w-[100px] border-r border-gray-100">Stenosi</th>
                  <th className="px-2 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-orange-600 w-[72px] border-r border-gray-100">Aneurisma</th>
                  <th className="px-2 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-amber-700 w-[90px] border-r border-gray-100">Isp. parietale</th>
                  <th className="px-2 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-yellow-700 w-[90px] border-r border-gray-100">Enhancement</th>
                  <th className="px-2 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-blue-600 w-[120px]">vs. precedente</th>
                </tr>
              </thead>
              <tbody>
                {GROUPS.map(group => {
                  const groupDists = ANGIO_DISTRICTS.filter(d => d.group === group);
                  return (
                    <React.Fragment key={group}>
                      <tr className="bg-[#0A2540]/5 border-t border-[#0A2540]/10">
                        <td colSpan={6} className="px-3 py-1 text-[9px] uppercase tracking-widest font-bold text-[#0A2540]">
                          {group}
                        </td>
                      </tr>
                      {groupDists.map(d => {
                        const f = findings[d.key];
                        const active = hasFinding(f);
                        return (
                          <tr key={d.key}
                            className={`border-t border-gray-100 ${active ? "bg-amber-50/30" : "bg-white hover:bg-gray-50/50"}`}>
                            <td className="px-3 py-1.5 font-semibold text-[11px] text-[#0A2540] border-r border-gray-100">
                              {d.label}
                            </td>
                            {/* Stenosis */}
                            <td className="px-2 py-1.5 border-r border-gray-100">
                              <select value={f.stenosis}
                                onChange={e => setField(d.key, "stenosis", e.target.value)}
                                className={`text-[10px] border rounded px-1 py-0.5 w-full cursor-pointer ${
                                  f.stenosis !== "none"
                                    ? "border-orange-300 bg-orange-50 font-semibold text-orange-800"
                                    : "border-gray-200 bg-white text-gray-400"
                                }`}>
                                <option value="none">—</option>
                                <option value="mild">Lieve</option>
                                <option value="moderate">Moderata</option>
                                <option value="severe">Severa</option>
                              </select>
                            </td>
                            {/* Aneurysm */}
                            <td className="px-2 py-1.5 text-center border-r border-gray-100">
                              <input type="checkbox" checked={f.aneurysm}
                                onChange={e => setField(d.key, "aneurysm", e.target.checked)}
                                className="w-4 h-4 accent-orange-500 cursor-pointer" />
                            </td>
                            {/* Wall thickening */}
                            <td className="px-2 py-1.5 text-center border-r border-gray-100">
                              <input type="checkbox" checked={f.wall_thickening}
                                onChange={e => setField(d.key, "wall_thickening", e.target.checked)}
                                className="w-4 h-4 accent-amber-500 cursor-pointer" />
                            </td>
                            {/* Wall enhancement */}
                            <td className="px-2 py-1.5 text-center border-r border-gray-100">
                              <input type="checkbox" checked={f.wall_enhancement}
                                onChange={e => setField(d.key, "wall_enhancement", e.target.checked)}
                                className="w-4 h-4 accent-yellow-500 cursor-pointer" />
                            </td>
                            {/* Change vs previous */}
                            <td className="px-2 py-1.5">
                              <select value={f.change}
                                onChange={e => setField(d.key, "change", e.target.value)}
                                className={`text-[10px] border rounded px-1 py-0.5 w-full cursor-pointer ${
                                  f.change === "worse" || f.change === "new"
                                    ? "border-red-300 bg-red-50 font-semibold text-red-700"
                                    : f.change === "improved"
                                      ? "border-green-300 bg-green-50 font-semibold text-green-700"
                                      : "border-gray-200 bg-white text-gray-400"
                                }`}>
                                <option value="stable">Stabile</option>
                                <option value="improved">Miglioramento</option>
                                <option value="worse">Peggioramento</option>
                                <option value="new">Nuova lesione</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Indication + Auto-summary + Notes */}
          <div className="px-5 py-3 border-t border-gray-100 space-y-3">
            <div>
              <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Indicazione clinica</div>
              <input value={indication} onChange={e => setIndication(e.target.value)}
                placeholder="es. Valutazione attività vasculitica, follow-up post-angioplastica…"
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-300" />
            </div>
            <div className="bg-blue-50/40 rounded-lg border border-blue-100 px-3 py-2">
              <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Referto automatico</div>
              <p className="text-[11px] text-gray-700 leading-relaxed italic">{summary}</p>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Note / Conclusioni aggiuntive</div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                rows={2} placeholder="Conclusioni, raccomandazioni, confronto con esame precedente…"
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-300" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            {prefillAssessment?.id && (
              <Button variant="outline" size="sm" onClick={handleDelete} disabled={saving}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 text-xs h-8">
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Elimina
              </Button>
            )}
            <span className="text-[10px] text-gray-500 truncate max-w-[240px]">
              {activeDistricts.length > 0
                ? `Reperti: ${activeDistricts.map(d => d.label).join(", ")}`
                : "Nessun reperto strutturale significativo"}
            </span>
          </div>
          <Button onClick={save} disabled={saving}
            className="bg-[#0A2540] text-white hover:bg-[#0A2540]/90 text-xs h-8">
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saving ? "Salvataggio…" : prefillAssessment?.id ? `Aggiorna ${modalityLabel}` : `Salva ${modalityLabel}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
