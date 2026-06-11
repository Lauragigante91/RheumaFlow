import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { X, Save, Trash2 } from "lucide-react";
import { instrumentalExamsApi } from "../../lib/api";
import ItalianDatePicker from "../shared/ItalianDatePicker";

// ─── Districts ────────────────────────────────────────────────────────────────
const ECHO_DISTRICTS = [
  { key: "temporal_dx",   label: "Temporale dx",   temporal: true,  group: "Temporali" },
  { key: "temporal_sx",   label: "Temporale sx",   temporal: true,  group: "Temporali" },
  { key: "carotid_dx",    label: "Carotide dx",    temporal: false, group: "Carotidi" },
  { key: "carotid_sx",    label: "Carotide sx",    temporal: false, group: "Carotidi" },
  { key: "subclavian_dx", label: "Succlavia dx",   temporal: false, group: "Succlavia / Ascellare" },
  { key: "subclavian_sx", label: "Succlavia sx",   temporal: false, group: "Succlavia / Ascellare" },
  { key: "axillary_dx",   label: "Ascellare dx",   temporal: false, group: "Succlavia / Ascellare" },
  { key: "axillary_sx",   label: "Ascellare sx",   temporal: false, group: "Succlavia / Ascellare" },
  { key: "vertebral_dx",  label: "Vertebrale dx",  temporal: false, group: "Vertebrali / Femorali" },
  { key: "vertebral_sx",  label: "Vertebrale sx",  temporal: false, group: "Vertebrali / Femorali" },
  { key: "femoral_dx",    label: "Femorale dx",    temporal: false, group: "Vertebrali / Femorali" },
  { key: "femoral_sx",    label: "Femorale sx",    temporal: false, group: "Vertebrali / Femorali" },
];

const GROUPS = [...new Set(ECHO_DISTRICTS.map(d => d.group))];

function initFindings() {
  return Object.fromEntries(ECHO_DISTRICTS.map(d => [d.key, {
    halo: false, stenosis: "none", occlusion: false,
    wall_thickening: "none", compressibility: "normal", notes: "",
  }]));
}

function hasFinding(f) {
  return f?.halo || f?.occlusion ||
    (f?.stenosis && f.stenosis !== "none") ||
    (f?.wall_thickening && f.wall_thickening !== "none") ||
    (f?.compressibility && f.compressibility !== "normal") ||
    !!f?.notes?.trim();
}

function generateSummary(findings) {
  const parts = [];
  for (const d of ECHO_DISTRICTS) {
    const f = findings[d.key];
    if (!f || !hasFinding(f)) continue;
    const items = [];
    if (f.halo)                              items.push("segno del halo");
    if (f.occlusion)                         items.push("occlusione");
    if (f.stenosis !== "none")               items.push(`stenosi ${f.stenosis}`);
    if (f.wall_thickening !== "none")        items.push(`ispessimento parietale ${f.wall_thickening}`);
    if (d.temporal && f.compressibility !== "normal") items.push(`compressibilità ${f.compressibility}`);
    if (f.notes?.trim())                     items.push(f.notes.trim());
    parts.push(`${d.label}: ${items.join(", ")}`);
  }
  if (!parts.length) return "Ecodoppler vascolare: nessun reperto patologico rilevante.";
  return "Ecodoppler vascolare. " + parts.join("; ") + ".";
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function EcodopplerDialog({ open, onClose, patient, prefillAssessment, onSaved, visitDate }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate]       = useState(visitDate || today);
  const [findings, setFindings] = useState(initFindings);
  const [notes, setNotes]     = useState("");
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (!open) return;
    if (prefillAssessment?.structured_values?.districts) {
      setDate(prefillAssessment.exam_date?.slice(0, 10) || today);
      setFindings({ ...initFindings(), ...prefillAssessment.structured_values.districts });
      setNotes(prefillAssessment.source_text || "");
    } else {
      setDate(visitDate || today);
      setFindings(initFindings());
      setNotes("");
    }
  }, [open, prefillAssessment]); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = (key, field, value) =>
    setFindings(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const summary = useMemo(() => generateSummary(findings), [findings]);
  const activeDistricts = ECHO_DISTRICTS.filter(d => hasFinding(findings[d.key]));

  const handleDelete = async () => {
    if (!prefillAssessment?.id) return;
    if (!window.confirm("Eliminare questo ecodoppler? L'azione non può essere annullata.")) return;
    try {
      await instrumentalExamsApi.remove(prefillAssessment.id);
      toast.success("Ecodoppler eliminato.");
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
        exam_type: "ecodoppler",
        result: activeDistricts.length > 0 ? "positive" : "negative",
        summary,
        source_text: notes.trim() || null,
        structured_values: {
          districts: findings,
          active_districts: activeDistricts.map(d => d.key),
        },
      };
      if (prefillAssessment?.id) {
        await instrumentalExamsApi.update(prefillAssessment.id, payload);
        toast.success("Ecodoppler aggiornato.");
      } else {
        await instrumentalExamsApi.create(payload);
        toast.success(
          activeDistricts.length
            ? `Ecodoppler registrato — ${activeDistricts.length} distretto/i con reperto.`
            : "Ecodoppler registrato — nessun reperto patologico."
        );
      }
      onSaved?.();
      onClose();
    } catch {
      toast.error("Errore nel salvataggio dell'ecodoppler.");
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
            Ecodoppler vascolare
            {patient && <span className="font-normal text-gray-500 ml-2 text-base">— {patient.cognome} {patient.nome}</span>}
          </DialogTitle>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
        </DialogHeader>

        {/* Sub-header: date + count */}
        <div className="flex items-center gap-6 px-5 py-2.5 bg-gray-50 border-b border-gray-100 flex-shrink-0">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Data esame</div>
            <ItalianDatePicker value={date} onChange={setDate} />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              activeDistricts.length > 0
                ? "bg-orange-50 border-orange-200 text-orange-700"
                : "bg-gray-100 border-gray-200 text-gray-500"
            }`}>
              {activeDistricts.length > 0 ? `${activeDistricts.length} distretti positivi` : "Nessun reperto"}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-5 py-1.5 bg-blue-50/40 border-b border-blue-100 text-[9px] text-gray-500 flex-shrink-0">
          <span><span className="text-rose-600 font-bold">Halo</span>: segno del halo (infiammazione parietale)</span>
          <span><span className="font-bold text-gray-700">Comp.</span>: compressibilità (solo temporali)</span>
        </div>

        {/* Districts table */}
        <div className="flex-1 overflow-y-auto">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-[#F9FAFB] border-b-2 border-gray-200 z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-[9px] uppercase tracking-widest font-bold text-gray-500 w-[140px] border-r border-gray-200">Distretto</th>
                  <th className="px-2 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-rose-600 w-[52px] border-r border-gray-100">Halo</th>
                  <th className="px-2 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-gray-600 w-[90px] border-r border-gray-100">Stenosi</th>
                  <th className="px-2 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-amber-700 w-[90px] border-r border-gray-100">Ispessimento</th>
                  <th className="px-2 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-indigo-600 w-[90px] border-r border-gray-100">Comp.</th>
                  <th className="px-2 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-red-600 w-[60px] border-r border-gray-100">Occlusione</th>
                  <th className="px-3 py-2 text-left text-[9px] uppercase tracking-widest font-bold text-gray-400">Note libere</th>
                </tr>
              </thead>
              <tbody>
                {GROUPS.map(group => {
                  const groupDists = ECHO_DISTRICTS.filter(d => d.group === group);
                  return (
                    <React.Fragment key={group}>
                      <tr className="bg-[#0A2540]/5 border-t border-[#0A2540]/10">
                        <td colSpan={7} className="px-3 py-1 text-[9px] uppercase tracking-widest font-bold text-[#0A2540]">
                          {group}
                        </td>
                      </tr>
                      {groupDists.map(d => {
                        const f = findings[d.key];
                        const active = hasFinding(f);
                        return (
                          <tr key={d.key}
                            className={`border-t border-gray-100 ${active ? "bg-orange-50/30" : "bg-white hover:bg-gray-50/50"}`}>
                            <td className="px-3 py-1.5 font-semibold text-[11px] text-[#0A2540] border-r border-gray-100">
                              {d.label}
                            </td>
                            {/* Halo */}
                            <td className="px-2 py-1.5 text-center border-r border-gray-100">
                              <input type="checkbox" checked={f.halo}
                                onChange={e => setField(d.key, "halo", e.target.checked)}
                                className="w-4 h-4 accent-rose-500 cursor-pointer" />
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
                            {/* Wall thickening */}
                            <td className="px-2 py-1.5 border-r border-gray-100">
                              <select value={f.wall_thickening}
                                onChange={e => setField(d.key, "wall_thickening", e.target.value)}
                                className={`text-[10px] border rounded px-1 py-0.5 w-full cursor-pointer ${
                                  f.wall_thickening !== "none"
                                    ? "border-amber-300 bg-amber-50 font-semibold text-amber-800"
                                    : "border-gray-200 bg-white text-gray-400"
                                }`}>
                                <option value="none">—</option>
                                <option value="mild">Lieve</option>
                                <option value="moderate">Moderato</option>
                              </select>
                            </td>
                            {/* Compressibility (temporal only) */}
                            <td className="px-2 py-1.5 border-r border-gray-100">
                              {d.temporal ? (
                                <select value={f.compressibility}
                                  onChange={e => setField(d.key, "compressibility", e.target.value)}
                                  className={`text-[10px] border rounded px-1 py-0.5 w-full cursor-pointer ${
                                    f.compressibility !== "normal"
                                      ? "border-indigo-300 bg-indigo-50 font-semibold text-indigo-800"
                                      : "border-gray-200 bg-white text-gray-400"
                                  }`}>
                                  <option value="normal">Normale</option>
                                  <option value="reduced">Ridotta</option>
                                  <option value="absent">Assente</option>
                                </select>
                              ) : (
                                <span className="text-gray-300 text-center block">—</span>
                              )}
                            </td>
                            {/* Occlusion */}
                            <td className="px-2 py-1.5 text-center border-r border-gray-100">
                              <input type="checkbox" checked={f.occlusion}
                                onChange={e => setField(d.key, "occlusion", e.target.checked)}
                                className="w-4 h-4 accent-red-600 cursor-pointer" />
                            </td>
                            {/* Notes */}
                            <td className="px-3 py-1.5">
                              <input value={f.notes}
                                onChange={e => setField(d.key, "notes", e.target.value)}
                                placeholder="Note libere…"
                                className="w-full text-[10px] border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:border-blue-300 bg-white" />
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

          {/* Auto-summary */}
          <div className="px-5 py-3 border-t border-gray-100 bg-blue-50/30">
            <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Referto automatico</div>
            <p className="text-[11px] text-gray-700 leading-relaxed italic">{summary}</p>
          </div>

          {/* Free notes */}
          <div className="px-5 py-3 border-t border-gray-100">
            <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Note / Conclusioni aggiuntive</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Conclusioni, raccomandazioni, confronto con esame precedente…"
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-300" />
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
                : "Nessun reperto patologico registrato"}
            </span>
          </div>
          <Button onClick={save} disabled={saving}
            className="bg-[#0A2540] text-white hover:bg-[#0A2540]/90 text-xs h-8">
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saving ? "Salvataggio…" : prefillAssessment?.id ? "Aggiorna ecodoppler" : "Salva ecodoppler"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
