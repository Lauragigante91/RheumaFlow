/**
 * EchoMskDialog — PMR musculoskeletal / articular ultrasound.
 *
 * Structured form for PMR-specific findings:
 *   Shoulder (dx/sx): subacromial-subdeltoid bursitis, biceps tenosynovitis,
 *                     glenohumeral synovitis, acromioclavicular synovitis
 *   Hip (dx/sx):      hip joint synovitis, trochanteric bursitis, iliopsoas bursitis
 *
 * Saves as index_type = "echo_msk".
 */
import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { X, Save, Trash2 } from "lucide-react";
import { instrumentalExamsApi } from "../../lib/api";
import ItalianDatePicker from "../shared/ItalianDatePicker";

// ─── Site definitions ──────────────────────────────────────────────────────────
const SHOULDER_SITES = [
  { key: "shoulder_dx", label: "Spalla dx", side: "dx" },
  { key: "shoulder_sx", label: "Spalla sx", side: "sx" },
];
const HIP_SITES = [
  { key: "hip_dx", label: "Anca dx", side: "dx" },
  { key: "hip_sx", label: "Anca sx", side: "sx" },
];

function initFindings() {
  const out = {};
  for (const s of [...SHOULDER_SITES, ...HIP_SITES]) {
    if (s.key.startsWith("shoulder")) {
      out[s.key] = {
        sas_bursitis: false,          // subacromial-subdeltoid bursitis
        sas_grade: "none",            // none | mild | moderate | severe
        biceps_tenosynovitis: false,
        glenohumeral_synovitis: false,
        acromioclavicular_synovitis: false,
        notes: "",
      };
    } else {
      out[s.key] = {
        synovitis: false,
        trochanteric_bursitis: false,
        iliopsoas_bursitis: false,
        notes: "",
      };
    }
  }
  return out;
}

function hasFindingShoulder(f) {
  return f?.sas_bursitis || f?.biceps_tenosynovitis ||
    f?.glenohumeral_synovitis || f?.acromioclavicular_synovitis || !!f?.notes?.trim();
}
function hasFindingHip(f) {
  return f?.synovitis || f?.trochanteric_bursitis || f?.iliopsoas_bursitis || !!f?.notes?.trim();
}
function hasFinding(key, f) {
  return key.startsWith("shoulder") ? hasFindingShoulder(f) : hasFindingHip(f);
}

function generateSummary(findings) {
  const parts = [];

  for (const s of SHOULDER_SITES) {
    const f = findings[s.key];
    if (!f || !hasFindingShoulder(f)) continue;
    const items = [];
    if (f.sas_bursitis) {
      items.push(`borsite SAd${f.sas_grade !== "none" ? ` (${f.sas_grade})` : ""}`);
    }
    if (f.biceps_tenosynovitis) items.push("tenosinovite capo lungo del bicipite");
    if (f.glenohumeral_synovitis) items.push("sinovite glenomerale");
    if (f.acromioclavicular_synovitis) items.push("sinovite ACJ");
    if (f.notes?.trim()) items.push(f.notes.trim());
    parts.push(`${s.label}: ${items.join(", ")}`);
  }

  for (const h of HIP_SITES) {
    const f = findings[h.key];
    if (!f || !hasFindingHip(f)) continue;
    const items = [];
    if (f.synovitis) items.push("sinovite coxofemorale");
    if (f.trochanteric_bursitis) items.push("borsite trocanterica");
    if (f.iliopsoas_bursitis) items.push("borsite dell'ileo-psoas");
    if (f.notes?.trim()) items.push(f.notes.trim());
    parts.push(`${h.label}: ${items.join(", ")}`);
  }

  if (!parts.length) return "Ecografia MSK (PMR): nessun reperto patologico.";
  return "Ecografia MSK (PMR). " + parts.join("; ") + ".";
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function EchoMskDialog({ open, onClose, patient, prefillAssessment, onSaved, visitDate }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate]       = useState(visitDate || today);
  const [findings, setFindings] = useState(initFindings);
  const [notes, setNotes]     = useState("");
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (!open) return;
    if (prefillAssessment?.structured_values?.sites) {
      setDate(prefillAssessment.exam_date?.slice(0, 10) || today);
      setFindings({ ...initFindings(), ...prefillAssessment.structured_values.sites });
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
  const activeSites = [...SHOULDER_SITES, ...HIP_SITES].filter(s => hasFinding(s.key, findings[s.key]));

  const handleDelete = async () => {
    if (!prefillAssessment?.id) return;
    if (!window.confirm("Eliminare questa ecografia MSK? L'azione non può essere annullata.")) return;
    try {
      await instrumentalExamsApi.remove(prefillAssessment.id);
      toast.success("Eco MSK eliminata.");
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
        exam_type: "echo_msk",
        result: activeSites.length > 0 ? "positive" : "negative",
        summary,
        source_text: notes.trim() || null,
        structured_values: {
          sites: findings,
          active_sites: activeSites.map(s => s.key),
        },
      };
      if (prefillAssessment?.id) {
        await instrumentalExamsApi.update(prefillAssessment.id, payload);
        toast.success("Eco MSK aggiornata.");
      } else {
        await instrumentalExamsApi.create(payload);
        toast.success(activeSites.length
          ? `Eco MSK registrata — ${activeSites.length} sede/i con reperto.`
          : "Eco MSK registrata — nessun reperto patologico.");
      }
      onSaved?.();
      onClose();
    } catch {
      toast.error("Errore nel salvataggio dell'ecografia MSK.");
    } finally {
      setSaving(false);
    }
  };

  const CheckCell = ({ siteKey, field, label, color = "teal" }) => {
    const checked = findings[siteKey]?.[field] ?? false;
    const accentMap = { teal: "accent-teal-600", rose: "accent-rose-500", amber: "accent-amber-500" };
    return (
      <td className="px-3 py-2 text-center border-r border-gray-100">
        <label className="flex flex-col items-center gap-0.5 cursor-pointer">
          <input type="checkbox" checked={checked}
            onChange={e => setField(siteKey, field, e.target.checked)}
            className={`w-4 h-4 ${accentMap[color] || "accent-teal-600"} cursor-pointer`} />
          {checked && <span className={`text-[8px] font-bold ${
            color === "rose" ? "text-rose-600" : color === "amber" ? "text-amber-600" : "text-teal-700"
          }`}>✓</span>}
        </label>
      </td>
    );
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between px-5 pt-4 pb-3 border-b border-gray-200 flex-shrink-0">
          <DialogTitle className="font-heading text-lg font-bold text-[#0A2540]">
            Ecografia MSK — PMR
            {patient && <span className="font-normal text-gray-500 ml-2 text-base">— {patient.cognome} {patient.nome}</span>}
          </DialogTitle>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
        </DialogHeader>

        {/* Sub-header */}
        <div className="flex items-center gap-6 px-5 py-2.5 bg-teal-50/60 border-b border-teal-100 flex-shrink-0">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Data esame</div>
            <ItalianDatePicker value={date} onChange={setDate} />
          </div>
          <div className="ml-auto">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              activeSites.length > 0
                ? "bg-teal-50 border-teal-300 text-teal-800"
                : "bg-gray-100 border-gray-200 text-gray-500"
            }`}>
              {activeSites.length > 0 ? `${activeSites.length} sede/i con reperto` : "Nessun reperto"}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-5 py-1.5 bg-teal-50/30 border-b border-teal-100 text-[9px] text-gray-500 flex-shrink-0">
          <span><span className="font-bold text-teal-700">SAd</span> = Borsite sottoacromiodeltoidea (subacromial-subdeltoid)</span>
          <span><span className="font-bold text-gray-700">ACJ</span> = Articolazione acromioclavicolare</span>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── Shoulders ── */}
          <div className="px-5 pt-4 pb-2">
            <div className="text-[9px] uppercase tracking-widest font-bold text-[#0A2540] mb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#0A2540]/10 flex items-center justify-center text-[10px]">🦾</span>
              Spalle
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse rounded-xl overflow-hidden border border-gray-200">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="px-3 py-2 text-left text-[9px] uppercase tracking-widest font-bold text-gray-500 w-[110px] border-r border-gray-200">Sede</th>
                    <th className="px-3 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-teal-700 w-[110px] border-r border-gray-100">
                      Borsite SAd
                    </th>
                    <th className="px-3 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-teal-600 w-[80px] border-r border-gray-100">
                      Grado SAd
                    </th>
                    <th className="px-3 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-indigo-700 w-[130px] border-r border-gray-100">
                      Ten. bicipite
                    </th>
                    <th className="px-3 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-amber-700 w-[130px] border-r border-gray-100">
                      Sin. glenomer.
                    </th>
                    <th className="px-3 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-orange-700 w-[130px] border-r border-gray-100">
                      Sin. ACJ
                    </th>
                    <th className="px-3 py-2 text-left text-[9px] uppercase tracking-widest font-bold text-gray-400">
                      Note
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SHOULDER_SITES.map(s => {
                    const f = findings[s.key] || {};
                    const active = hasFindingShoulder(f);
                    return (
                      <tr key={s.key}
                        className={`border-t border-gray-100 ${active ? "bg-teal-50/30" : "bg-white hover:bg-gray-50/40"}`}>
                        <td className="px-3 py-2 font-semibold text-[11px] text-[#0A2540] border-r border-gray-100">{s.label}</td>
                        {/* SAd bursitis */}
                        <CheckCell siteKey={s.key} field="sas_bursitis" color="teal" />
                        {/* SAd grade */}
                        <td className="px-2 py-2 border-r border-gray-100">
                          <select value={f.sas_grade || "none"}
                            onChange={e => setField(s.key, "sas_grade", e.target.value)}
                            className={`text-[10px] border rounded px-1 py-0.5 w-full cursor-pointer ${
                              f.sas_grade && f.sas_grade !== "none"
                                ? "border-teal-300 bg-teal-50 font-semibold text-teal-800"
                                : "border-gray-200 bg-white text-gray-400"
                            }`}>
                            <option value="none">—</option>
                            <option value="mild">Lieve</option>
                            <option value="moderate">Moderata</option>
                            <option value="severe">Severa</option>
                          </select>
                        </td>
                        {/* Biceps tenosynovitis */}
                        <CheckCell siteKey={s.key} field="biceps_tenosynovitis" color="teal" />
                        {/* Glenohumeral synovitis */}
                        <CheckCell siteKey={s.key} field="glenohumeral_synovitis" color="amber" />
                        {/* ACJ synovitis */}
                        <CheckCell siteKey={s.key} field="acromioclavicular_synovitis" color="amber" />
                        {/* Notes */}
                        <td className="px-3 py-2">
                          <input value={f.notes || ""}
                            onChange={e => setField(s.key, "notes", e.target.value)}
                            placeholder="Note…"
                            className="w-full text-[10px] border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:border-teal-300 bg-white" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Hips ── */}
          <div className="px-5 pt-3 pb-2">
            <div className="text-[9px] uppercase tracking-widest font-bold text-[#0A2540] mb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#0A2540]/10 flex items-center justify-center text-[10px]">🦵</span>
              Anche
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse rounded-xl overflow-hidden border border-gray-200">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="px-3 py-2 text-left text-[9px] uppercase tracking-widest font-bold text-gray-500 w-[110px] border-r border-gray-200">Sede</th>
                    <th className="px-3 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-teal-700 w-[150px] border-r border-gray-100">
                      Sinovite coxofemorale
                    </th>
                    <th className="px-3 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-amber-700 w-[150px] border-r border-gray-100">
                      Borsite trocanterica
                    </th>
                    <th className="px-3 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-orange-700 w-[150px] border-r border-gray-100">
                      Borsite ileo-psoas
                    </th>
                    <th className="px-3 py-2 text-left text-[9px] uppercase tracking-widest font-bold text-gray-400">
                      Note
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {HIP_SITES.map(h => {
                    const f = findings[h.key] || {};
                    const active = hasFindingHip(f);
                    return (
                      <tr key={h.key}
                        className={`border-t border-gray-100 ${active ? "bg-teal-50/30" : "bg-white hover:bg-gray-50/40"}`}>
                        <td className="px-3 py-2 font-semibold text-[11px] text-[#0A2540] border-r border-gray-100">{h.label}</td>
                        <CheckCell siteKey={h.key} field="synovitis" color="teal" />
                        <CheckCell siteKey={h.key} field="trochanteric_bursitis" color="amber" />
                        <CheckCell siteKey={h.key} field="iliopsoas_bursitis" color="amber" />
                        <td className="px-3 py-2">
                          <input value={f.notes || ""}
                            onChange={e => setField(h.key, "notes", e.target.value)}
                            placeholder="Note…"
                            className="w-full text-[10px] border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:border-teal-300 bg-white" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Auto-summary */}
          <div className="mx-5 mb-3 rounded-lg border border-teal-100 bg-teal-50/30 px-4 py-3">
            <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Referto automatico</div>
            <p className="text-[11px] text-gray-700 leading-relaxed italic">{summary}</p>
          </div>

          {/* Free notes */}
          <div className="px-5 pb-4 border-t border-gray-100 pt-3">
            <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Note / Conclusioni aggiuntive</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Confronto con esame precedente, conclusioni cliniche, raccomandazioni…"
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-teal-300" />
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
              {activeSites.length > 0
                ? `Reperti: ${activeSites.map(s => s.label).join(", ")}`
                : "Nessun reperto patologico"}
            </span>
          </div>
          <Button onClick={save} disabled={saving}
            className="bg-teal-700 text-white hover:bg-teal-800 text-xs h-8">
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saving ? "Salvataggio…" : prefillAssessment?.id ? "Aggiorna eco MSK" : "Salva eco MSK"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
