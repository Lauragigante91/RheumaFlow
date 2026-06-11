import React, { useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Edit, Trash2, FlaskConical, ChevronDown, ChevronRight, Plus, TrendingUp, ArrowDownToLine, X,
} from "lucide-react";
import { INDEX_LABELS } from "../../lib/clinimetrics";
import { categoryColor } from "../../lib/drugs";

const JOINT_INDICES = ["das28_esr", "das28_crp", "cdai", "sdai", "dapsa"];

const SOURCE_TYPE_LABELS = {
  previous_report:      "Referto precedente",
  raccordo_anamnestico: "Raccordo anamnestico",
  external_report:      "Referto esterno",
  discharge_letter:     "Lettera di dimissione",
  selected_text:        "Testo selezionato",
};

/**
 * Wraps an assessment badge. When the assessment is imported, clicking the
 * ArrowDownToLine icon shows a small popover with the source text.
 */
function ImportedBadgeWrapper({ isImported, sourceText, sourceType, children }) {
  const [open, setOpen] = useState(false);
  if (!isImported) return children;
  return (
    <div className="relative inline-flex">
      {children}
      {/* Source text popover trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-gray-400 flex items-center justify-center text-white hover:bg-gray-500 transition z-10"
        title="Valore importato — clicca per vedere il testo originale"
      >
        <ArrowDownToLine className="w-2 h-2" />
      </button>
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-20"
            onClick={() => setOpen(false)}
          />
          {/* Popover */}
          <div className="absolute bottom-full left-0 mb-2 z-30 w-72 rounded-lg border border-gray-200 bg-white shadow-lg p-3 text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-gray-600 flex items-center gap-1">
                <ArrowDownToLine className="w-3 h-3" /> Importato
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {sourceType && (
              <div className="text-[10px] text-gray-400 mb-1">
                {SOURCE_TYPE_LABELS[sourceType] || sourceType}
              </div>
            )}
            {sourceText ? (
              <p className="text-gray-700 italic leading-snug border-l-2 border-cyan-200 pl-2">
                «{sourceText.length > 200 ? sourceText.slice(0, 197) + "…" : sourceText}»
              </p>
            ) : (
              <p className="text-gray-400 italic">Testo originale non disponibile</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Maps an interpretation string to a colored badge class.
export function interpClass(s) {
  const lc = (s || "").toLowerCase();
  if (lc.includes("remissione") || lc.includes("nessuna") || lc.includes("normale")) return "bg-green-100 text-green-800";
  if (lc.includes("bassa") || lc.includes("lieve") || lc.includes("mild") || lc.includes("lda")) return "bg-emerald-100 text-emerald-800";
  if (lc.includes("moderata") || lc.includes("mda")) return "bg-amber-100 text-amber-800";
  if (lc.includes("alta") || lc.includes("severa") || lc.includes("hda") || lc.includes("grave") || lc.includes("very high")) return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-700";
}

export function shortInterp(s) {
  const lc = (s || "").toLowerCase();
  if (lc.includes("remissione")) return "Rem";
  if (lc.includes("bassa attività") || lc.includes("low disease")) return "LDA";
  if (lc.includes("moderata attività") || lc.includes("moderate")) return "MDA";
  if (lc.includes("alta attività") || lc.includes("high")) return "HDA";
  return s.length > 18 ? s.slice(0, 16) + "…" : s;
}

/**
 * One row of the assessment history grouped per visit date.
 * Renders all index badges + active therapies + lab exam icon (expandable).
 */
export default function VisitGroupRow({
  group,
  isOpen,
  toggleOpen,
  responseByAssessmentId,
  responseColor,
  startEdit,
  removeAssessment,
  onAddExam,
}) {
  const { date, assessments, therapies, exams } = group;
  return (
    <div className="bg-white" data-testid={`visit-group-${date}`}>
      {/* Header row */}
      <div className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/60">
        {/* Date */}
        <div className="w-[110px] flex-shrink-0">
          <div className="font-heading font-medium text-sm text-gray-600">
            {new Date(date).toLocaleDateString("it-IT")}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            {new Date(date).toLocaleDateString("it-IT", { weekday: "long" })}
          </div>
        </div>

        {/* Indices block */}
        <div className="flex-1 min-w-0 flex flex-wrap gap-1.5">
          {assessments.map((a) => {
            const resp = responseByAssessmentId[a.id];
            const isJoint = JOINT_INDICES.includes(a.index_type);
            const isImported = a.inputs?.imported === true;
            return (
              <ImportedBadgeWrapper key={a.id} isImported={isImported} sourceText={a.inputs?.source_text} sourceType={a.inputs?.source_type}>
                <div
                  className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs group ${
                    isImported
                      ? "bg-gray-50 border border-dashed border-gray-300"
                      : "bg-gray-50 border border-gray-200"
                  }`}
                  data-testid={`visit-idx-${a.id}`}
                >
                  {isImported && (
                    <ArrowDownToLine
                      className="w-2.5 h-2.5 text-gray-400 flex-shrink-0"
                      title="Valore importato da referto esterno"
                    />
                  )}
                  <span className="font-heading font-bold text-[11px] uppercase tracking-[0.05em] text-[#0A2540]">
                    {INDEX_LABELS[a.index_type] || a.index_type}
                  </span>
                  <span className="font-mono font-bold">{a.score ?? "-"}</span>
                  {a.interpretation && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${interpClass(a.interpretation)}`}>
                      {shortInterp(a.interpretation)}
                    </span>
                  )}
                  {isJoint && (a.tender_joints?.length || a.swollen_joints?.length) ? (
                    <span className="text-[10px] text-gray-500 font-mono">
                      TJ{a.tender_joints?.length ?? 0}·SJ{a.swollen_joints?.length ?? 0}
                    </span>
                  ) : null}
                  {resp && (
                    <Badge className={`${responseColor(resp.level)} text-[9px] px-1.5 py-0`} data-testid={`eular-${a.id}`}>
                      <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> {resp.label}
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => startEdit(a)}
                    className="ml-1 p-0.5 rounded hover:bg-white opacity-0 group-hover:opacity-100 transition"
                    data-testid={`edit-assessment-${a.id}`}
                    title="Modifica"
                  >
                    <Edit className="w-3 h-3 text-gray-600" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAssessment(a.id)}
                    className="p-0.5 rounded hover:bg-white opacity-0 group-hover:opacity-100 transition"
                    data-testid={`delete-assessment-${a.id}`}
                    title="Elimina"
                  >
                    <Trash2 className="w-3 h-3 text-red-600" />
                  </button>
                </div>
              </ImportedBadgeWrapper>
            );
          })}
        </div>

        {/* Therapy in corso */}
        <div className="w-[200px] flex-shrink-0">
          <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 mb-1">In terapia</div>
          {therapies.length === 0 ? (
            <span className="text-xs text-gray-400 italic">Nessuna</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {therapies.slice(0, 3).map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-gray-50 border border-gray-100 text-gray-400"
                  title={`${t.drug_name}${t.dose ? ` · ${t.dose}` : ""}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full opacity-50" style={{ background: categoryColor(t.category) }} />
                  <span>{t.drug_name}</span>
                  {t.dose && <span className="text-gray-300">{t.dose}</span>}
                </span>
              ))}
              {therapies.length > 3 && (
                <span className="text-[10px] text-gray-500 self-center">+{therapies.length - 3}</span>
              )}
            </div>
          )}
        </div>

        {/* Exams icon */}
        <button
          type="button"
          onClick={toggleOpen}
          className={`w-[80px] flex-shrink-0 flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-md border transition ${
            exams.length > 0
              ? "border-blue-300 bg-blue-50/50 hover:bg-blue-100"
              : "border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100"
          }`}
          data-testid={`toggle-exams-${date}`}
          title={exams.length > 0 ? "Apri esami di laboratorio di questa data" : "Nessun esame in questa data"}
        >
          <FlaskConical className="w-4 h-4" />
          <span className="text-[10px] font-mono font-bold">
            {exams.length > 0 ? `${exams.length} esami` : "—"}
          </span>
          {exams.length > 0 && (isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)}
        </button>
      </div>

      {/* Expanded exams panel */}
      {isOpen && (
        <div className="bg-blue-50/30 border-t border-blue-200 px-4 py-3" data-testid={`exams-expand-${date}`}>
          {exams.length === 0 ? (
            <div className="text-xs text-gray-500 italic">Nessun esame registrato per questa data.</div>
          ) : (
            <div className="space-y-2">
              {exams.map((e) => (
                <div key={e.id} className="bg-white border border-gray-200 rounded-md p-2 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <FlaskConical className="w-3.5 h-3.5 text-[#0A2540]" />
                    <span className="font-heading font-bold text-[11px] uppercase tracking-[0.1em] text-[#0A2540]">
                      {e.panel || "esami"}
                    </span>
                    {e.created_by_name && <span className="text-[10px] text-gray-500">· {e.created_by_name}</span>}
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
            <Button variant="outline" size="sm" onClick={onAddExam} className="text-xs h-7" data-testid={`add-exam-${date}`}>
              <Plus className="w-3 h-3 mr-1" /> Aggiungi/modifica esami
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
