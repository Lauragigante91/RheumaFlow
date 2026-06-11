import React, { useState, useRef, useEffect } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Edit, Trash2, FlaskConical, ChevronDown, ChevronRight, Plus, TrendingUp,
} from "lucide-react";
import { INDEX_LABELS } from "../../lib/clinimetrics";
import { categoryColor } from "../../lib/drugs";
import { interpClass, shortInterp } from "./VisitGroupRow";

const JOINT_INDICES = ["das28_esr", "das28_crp", "cdai", "sdai", "dapsa"];

/**
 * Tabular history of clinimetric assessments with one column per index_type.
 *
 * Props:
 *   columns                — array of distinct index_type used in patient
 *   inputCols              — [{key, saveKey, label, indexTypes, extract}]
 *   groupedHistory         — [{date, assessments[], therapies[], exams[]}]
 *   responseByAssessmentId — map id → {label, level}
 *   responseColor(level)   — color helper
 *   startEdit(a) / removeAssessment(id) — actions
 *   onAddExam()            — open ExamsDialog
 *   onDateClick(g)         — open visit detail
 *   onUpdateInputs(assessmentId, saveKey, value) — inline edit callback
 *   onAddTherapy(date)     — open therapy modal for given date
 */
export default function VisitHistoryTable({
  columns,
  inputCols,
  groupedHistory,
  responseByAssessmentId,
  responseColor,
  startEdit,
  removeAssessment,
  onAddExam,
  onDateClick,
  onUpdateInputs,
  onAddTherapy,
}) {
  const hasInputCols = inputCols && inputCols.length > 0;
  const [openExamsDate, setOpenExamsDate] = useState(null);

  // ── Inline edit state for input-column cells ──────────────────────────────
  const [editCell, setEditCell]   = useState(null); // { date, colKey, saveKey, assessmentId }
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving]       = useState(false);
  const editInputRef = useRef(null);

  useEffect(() => {
    if (editCell) {
      setTimeout(() => {
        editInputRef.current?.focus();
        editInputRef.current?.select();
      }, 0);
    }
  }, [editCell]);

  const startCellEdit = (date, colKey, saveKey, assessmentId, currentVal) => {
    if (!onUpdateInputs || !assessmentId) return;
    setEditCell({ date, colKey, saveKey, assessmentId });
    setEditValue(currentVal != null ? String(currentVal) : "");
  };

  const cancelEdit = () => { setEditCell(null); setEditValue(""); };

  const commitEdit = async () => {
    if (!editCell || !onUpdateInputs || saving) return;
    if (editValue.trim() === "") { cancelEdit(); return; }
    setSaving(true);
    try {
      await onUpdateInputs(editCell.assessmentId, editCell.saveKey, editValue);
      setEditCell(null);
      setEditValue("");
    } catch {
      // leave cell open so user can retry
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter")  { e.preventDefault(); commitEdit(); }
    if (e.key === "Escape") { cancelEdit(); }
  };

  if (!columns || columns.length === 0) {
    return (
      <div className="p-10 text-center text-gray-500" data-testid="empty-assessments">
        Nessuna valutazione. Clicca "Nuova valutazione" per iniziare.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto" data-testid="history-table-wrap">
      <table className="w-full text-xs border-collapse" data-testid="history-table">
        <thead className="bg-[#F9FAFB] border-b-2 border-gray-200 sticky top-0">
          <tr>
            <th className="px-3 py-2 text-left font-heading uppercase tracking-[0.1em] text-[10px] text-gray-700 w-[110px] sticky left-0 bg-[#F9FAFB] z-10 border-r border-gray-200">
              Data
            </th>
            {columns.map((idx) => (
              <th
                key={idx}
                className="px-2 py-2 text-center font-heading uppercase tracking-[0.05em] text-[10px] text-[#0A2540] border-r border-gray-100 min-w-[100px]"
                data-testid={`col-${idx}`}
              >
                {INDEX_LABELS[idx] || idx}
              </th>
            ))}
            {hasInputCols && (
              <>
                <th className="px-2 py-2 text-center font-heading uppercase tracking-[0.05em] text-[10px] text-gray-400 border-l-2 border-gray-300 w-[28px]" />
                {inputCols.map((col) => (
                  <th
                    key={col.key}
                    className="px-2 py-2 text-center font-heading uppercase tracking-[0.05em] text-[10px] text-gray-500 border-r border-gray-100 min-w-[64px] bg-gray-50/60"
                    data-testid={`col-input-${col.key}`}
                    title={onUpdateInputs ? `${col.label} — clicca su un valore per modificarlo` : col.label}
                  >
                    {col.label}
                  </th>
                ))}
              </>
            )}
            <th className="px-3 py-2 text-left font-heading uppercase tracking-[0.1em] text-[10px] text-gray-700 border-l border-gray-200 min-w-[200px]">
              Terapia in corso
            </th>
            <th className="px-2 py-2 text-center font-heading uppercase tracking-[0.1em] text-[10px] text-gray-700 w-[70px]">
              Lab
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100">
          {groupedHistory.map((g) => {
            const isOpen = openExamsDate === g.date;
            const byIndex = {};
            for (const a of g.assessments) {
              if (!byIndex[a.index_type]) byIndex[a.index_type] = a;
            }

            return (
              <React.Fragment key={g.date}>
                <tr className="hover:bg-blue-50/30 group" data-testid={`visit-row-${g.date}`}>

                  {/* ── Date ── */}
                  <td className="px-3 py-2 align-top sticky left-0 bg-white group-hover:bg-blue-50/30 z-10 border-r border-gray-200">
                    <button
                      type="button"
                      onClick={() => onDateClick && onDateClick(g)}
                      className="text-left w-full -mx-1 -my-1 px-1 py-1 rounded hover:bg-blue-100/60 transition group/date"
                      data-testid={`open-visit-${g.date}`}
                      title="Apri tutti i dettagli della visita"
                    >
                      <div className="font-heading font-bold text-sm text-[#0A2540] underline decoration-dotted decoration-blue-400 underline-offset-2 group-hover/date:decoration-solid group-hover/date:text-blue-700">
                        {new Date(g.date).toLocaleDateString("it-IT")}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        {new Date(g.date).toLocaleDateString("it-IT", { weekday: "short" })}
                      </div>
                    </button>
                  </td>

                  {/* ── One cell per index column ── */}
                  {columns.map((idx) => {
                    const a = byIndex[idx];
                    if (!a) {
                      return (
                        <td key={idx} className="px-2 py-2 text-center align-top border-r border-gray-100 text-gray-300 text-xs">
                          —
                        </td>
                      );
                    }
                    const resp    = responseByAssessmentId[a.id];
                    const isJoint = JOINT_INDICES.includes(a.index_type);
                    return (
                      <td
                        key={idx}
                        className="px-2 py-2 align-top border-r border-gray-100 relative"
                        data-testid={`cell-${a.index_type}-${g.date}`}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-mono font-bold text-base text-[#0A2540]">
                            {a.score ?? "-"}
                          </span>
                          {a.interpretation && (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${interpClass(a.interpretation)}`}>
                              {shortInterp(a.interpretation)}
                            </span>
                          )}
                          {isJoint && (a.tender_joints?.length || a.swollen_joints?.length) ? (
                            <span className="text-[9px] text-gray-500 font-mono">
                              TJ{a.tender_joints?.length ?? 0}·SJ{a.swollen_joints?.length ?? 0}
                            </span>
                          ) : null}
                          {resp && (
                            <Badge
                              className={`${responseColor(resp.level)} text-[9px] px-1 py-0 mt-0.5`}
                              data-testid={`eular-${a.id}`}
                            >
                              <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> {resp.label}
                            </Badge>
                          )}
                        </div>
                        <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                          <button
                            type="button"
                            onClick={() => startEdit(a)}
                            className="p-0.5 rounded hover:bg-white"
                            data-testid={`edit-assessment-${a.id}`}
                            title="Modifica"
                          >
                            <Edit className="w-3 h-3 text-gray-600" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAssessment(a.id)}
                            className="p-0.5 rounded hover:bg-white"
                            data-testid={`delete-assessment-${a.id}`}
                            title="Elimina"
                          >
                            <Trash2 className="w-3 h-3 text-red-600" />
                          </button>
                        </div>
                      </td>
                    );
                  })}

                  {/* ── Input-derived columns (TJC, SJC, VAS, EGA, PCR, VES) ── */}
                  {hasInputCols && (
                    <>
                      <td className="border-l-2 border-gray-300 bg-gray-50/30" />
                      {inputCols.map((col) => {
                        let val          = null;
                        let assessmentId = null;
                        for (const a of g.assessments) {
                          if (col.indexTypes.includes(a.index_type)) {
                            if (!assessmentId) assessmentId = a.id;
                            if (a.inputs) {
                              const v = col.extract(a.inputs);
                              if (v != null) { val = v; assessmentId = a.id; break; }
                            }
                          }
                        }

                        const isEditing = editCell?.date === g.date && editCell?.colKey === col.key;
                        const canEdit   = !!onUpdateInputs && !!assessmentId;

                        return (
                          <td
                            key={col.key}
                            className="px-1 py-1 text-center align-middle border-r border-gray-100 bg-gray-50/30 text-xs"
                            data-testid={`cell-input-${col.key}-${g.date}`}
                          >
                            {isEditing ? (
                              <input
                                ref={editInputRef}
                                type="number"
                                step="any"
                                min="0"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onBlur={commitEdit}
                                disabled={saving}
                                className="w-12 text-center text-xs font-mono border border-blue-400 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => startCellEdit(g.date, col.key, col.saveKey, assessmentId, val)}
                                disabled={!canEdit}
                                title={canEdit ? "Clicca per modificare" : undefined}
                                className={`w-full min-h-[22px] flex items-center justify-center rounded transition-colors ${
                                  canEdit
                                    ? "hover:bg-blue-50 cursor-text group/icell"
                                    : "cursor-default"
                                }`}
                              >
                                {val != null ? (
                                  <span className="font-mono font-medium text-gray-700 group-hover/icell:text-blue-700">
                                    {val}
                                  </span>
                                ) : (
                                  <span className={canEdit ? "text-gray-300 group-hover/icell:text-blue-400" : "text-gray-300"}>
                                    —
                                  </span>
                                )}
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </>
                  )}

                  {/* ── Terapia in corso ── */}
                  <td className="px-3 py-2 align-top border-l border-gray-200">
                    <div className="flex items-start flex-wrap gap-1">
                      {g.therapies.length === 0 ? (
                        <span className="text-[11px] text-gray-400 italic">Nessuna</span>
                      ) : (
                        <>
                          {g.therapies.slice(0, 5).map((t) => {
                            const visitDay = g.date?.slice(0, 10);
                            const isNew     = t.start_date?.slice(0, 10) === visitDay;
                            const isStopped = t.end_date?.slice(0, 10) === visitDay;
                            const badgeCls = isStopped
                              ? "bg-red-50 border-red-300 text-red-800"
                              : isNew
                              ? "bg-green-50 border-green-300 text-green-800"
                              : "bg-gray-50 border-gray-100 text-gray-400";
                            const dotColor = isStopped ? "#EF4444" : isNew ? "#22C55E" : categoryColor(t.category);
                            return (
                              <span
                                key={t.id}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border font-medium ${badgeCls}`}
                                title={`${t.drug_name}${t.dose ? ` · ${t.dose}` : ""}${t.frequency ? ` · ${t.frequency}` : ""}${isNew ? " — iniziato oggi" : isStopped ? " — sospeso oggi" : ""}`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                                <span className={isStopped ? "line-through opacity-40" : ""}>{t.drug_name}</span>
                                {t.dose && <span className="opacity-50">{t.dose}</span>}
                              </span>
                            );
                          })}
                          {g.therapies.length > 5 && (
                            <span className="text-[10px] text-gray-500 self-center">
                              +{g.therapies.length - 5}
                            </span>
                          )}
                        </>
                      )}
                      {onAddTherapy && (
                        <button
                          type="button"
                          onClick={() => onAddTherapy(g.date)}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] text-blue-500 border border-blue-200 hover:bg-blue-50 hover:text-blue-700 transition-colors ml-auto flex-shrink-0"
                          title="Aggiungi farmaco per questa data"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>Aggiungi</span>
                        </button>
                      )}
                    </div>
                  </td>

                  {/* ── Lab exams toggle ── */}
                  <td className="px-2 py-2 text-center align-top">
                    <button
                      type="button"
                      onClick={() => setOpenExamsDate(isOpen ? null : g.date)}
                      className={`inline-flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-md border transition ${
                        g.exams.length > 0
                          ? "border-blue-300 bg-blue-50/60 hover:bg-blue-100"
                          : "border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100"
                      }`}
                      data-testid={`toggle-exams-${g.date}`}
                      title={g.exams.length > 0 ? "Apri esami" : "Nessun esame"}
                    >
                      <FlaskConical className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-mono font-bold">
                        {g.exams.length > 0 ? g.exams.length : "—"}
                      </span>
                      {g.exams.length > 0 && (isOpen ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />)}
                    </button>
                  </td>
                </tr>

                {/* ── Expanded exams panel ── */}
                {isOpen && (
                  <tr data-testid={`exams-expand-${g.date}`}>
                    <td
                      colSpan={columns.length + 3 + (hasInputCols ? inputCols.length + 1 : 0)}
                      className="bg-blue-50/30 border-t border-blue-200 px-4 py-3"
                    >
                      {g.exams.length === 0 ? (
                        <div className="text-xs text-gray-500 italic">Nessun esame registrato per questa data.</div>
                      ) : (
                        <div className="space-y-2">
                          {g.exams.map((e) => (
                            <div key={e.id} className="bg-white border border-gray-200 rounded-md p-2 text-xs">
                              <div className="flex items-center gap-2 mb-1">
                                <FlaskConical className="w-3.5 h-3.5 text-[#0A2540]" />
                                <span className="font-heading font-bold text-[11px] uppercase tracking-[0.1em] text-[#0A2540]">
                                  {e.panel || "esami"}
                                </span>
                                {e.created_by_name && (
                                  <span className="text-[10px] text-gray-500">· {e.created_by_name}</span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1">
                                {Object.entries(e.values || {}).map(([k, v]) => (
                                  <span key={k} className="font-mono">
                                    <span className="text-gray-500">{k}:</span>{" "}
                                    <span className="font-bold">{v?.value ?? v?.qualitative ?? "-"}</span>
                                    {v?.unit && <span className="text-gray-400"> {v.unit}</span>}
                                  </span>
                                ))}
                              </div>
                              {e.notes && <div className="text-[10px] text-gray-600 italic mt-1">{e.notes}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex justify-end mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onAddExam}
                          className="text-xs h-7"
                          data-testid={`add-exam-${g.date}`}
                        >
                          <Plus className="w-3 h-3 mr-1" /> Aggiungi/modifica esami
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
