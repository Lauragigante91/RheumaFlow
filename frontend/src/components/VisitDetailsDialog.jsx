import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Edit, Trash2, FlaskConical, Pill, Stethoscope } from "lucide-react";
import { INDEX_LABELS } from "../lib/clinimetrics";
import { categoryColor } from "../lib/drugs";

// Italian human-readable labels for known assessment input keys.
const INPUT_LABELS = {
  // DAS28 / CDAI / SDAI / DAPSA
  esr: "VES (mm/h)",
  ves: "VES (mm/h)",
  crp: "PCR (mg/dL)",
  pcr: "PCR (mg/dL)",
  pga: "Valutazione globale paziente (PGA, 0-10)",
  ega: "Valutazione globale medico (EGA, 0-10)",
  patient_pain: "Dolore paziente (0-10)",
  // BASDAI / ASDAS
  q1: "Q1",
  q2: "Q2",
  q3: "Q3",
  q4: "Q4",
  q5: "Q5",
  q6: "Q6",
  q7: "Q7",
  q8: "Q8",
  q9: "Q9",
  q10: "Q10",
  backPain: "Dolore al rachide (0-10)",
  back_pain: "Dolore al rachide (0-10)",
  morningStiffness: "Rigidità mattutina (0-10)",
  morning_stiffness: "Rigidità mattutina (0-10)",
  peripheralPain: "Dolore periferico (0-10)",
  peripheral_pain: "Dolore periferico (0-10)",
  // SLEDAI / BVAS / ESSDAI catch-all
  total_score: "Punteggio totale",
};

const JOINT_INDICES = ["das28_esr", "das28_crp", "cdai", "sdai", "dapsa"];

function formatInputValue(v) {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "sì" : "no";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function AssessmentBlock({ a, onEdit, onRemove }) {
  const isJoint = JOINT_INDICES.includes(a.index_type);
  const inputs = a.inputs || {};
  const inputEntries = Object.entries(inputs).filter(
    ([k]) => !["tender_joints", "swollen_joints", "joints"].includes(k)
  );

  return (
    <div
      className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm"
      data-testid={`visit-assess-${a.id}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="font-heading text-lg font-bold text-[#0A2540] tracking-tight">
            {INDEX_LABELS[a.index_type] || a.index_type}
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-mono text-3xl font-black text-[#0A2540]">
              {a.score ?? "—"}
            </span>
            {a.interpretation && (
              <Badge variant="outline" className="text-xs">
                {a.interpretation}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onEdit(a)}
            data-testid={`visit-edit-${a.id}`}
            title="Modifica"
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onRemove(a.id)}
            className="hover:bg-red-50"
            data-testid={`visit-delete-${a.id}`}
            title="Elimina"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </Button>
        </div>
      </div>

      {/* Joint count — visible only for articolari */}
      {isJoint && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-blue-50 border border-blue-100 rounded-md p-2">
            <div className="text-[10px] uppercase tracking-[0.15em] text-blue-700 font-semibold">
              Tender (TJ)
            </div>
            <div className="font-mono text-xl font-bold text-blue-900">
              {a.tender_joints?.length ?? 0}
            </div>
            {a.tender_joints?.length > 0 && (
              <div className="text-[10px] text-blue-700/70 mt-0.5 truncate">
                {a.tender_joints.join(", ")}
              </div>
            )}
          </div>
          <div className="bg-red-50 border border-red-100 rounded-md p-2">
            <div className="text-[10px] uppercase tracking-[0.15em] text-red-700 font-semibold">
              Swollen (SJ)
            </div>
            <div className="font-mono text-xl font-bold text-red-900">
              {a.swollen_joints?.length ?? 0}
            </div>
            {a.swollen_joints?.length > 0 && (
              <div className="text-[10px] text-red-700/70 mt-0.5 truncate">
                {a.swollen_joints.join(", ")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Other inputs */}
      {inputEntries.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          {inputEntries.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between border-b border-gray-100 pb-1">
              <span className="text-gray-600 text-xs">{INPUT_LABELS[k] || k}</span>
              <span className="font-mono font-semibold text-[#0A2540]">{formatInputValue(v)}</span>
            </div>
          ))}
        </div>
      ) : (
        !isJoint && (
          <div className="text-xs text-gray-400 italic">Nessun input dettagliato salvato.</div>
        )
      )}

      {a.created_by_name && (
        <div className="mt-3 pt-2 border-t border-gray-100 text-[11px] text-gray-500">
          Inserito da <span className="font-medium">{a.created_by_name}</span>
        </div>
      )}
    </div>
  );
}

export default function VisitDetailsDialog({ open, group, onClose, onEdit, onRemove }) {
  if (!group) return null;

  const dateLabel = new Date(group.date).toLocaleDateString("it-IT", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-4xl max-h-[92vh] overflow-y-auto"
        data-testid="visit-details-dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-heading font-black tracking-tight text-2xl">
            Visita del {dateLabel}
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Tutte le valutazioni clinimetriche, terapie attive ed esami di laboratorio di questa data.
          </p>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Assessments */}
          <section>
            <h3 className="font-heading font-bold text-sm uppercase tracking-[0.15em] text-[#0A2540] mb-2 flex items-center gap-2">
              <Stethoscope className="w-4 h-4" /> Clinimetria ({group.assessments.length})
            </h3>
            {group.assessments.length === 0 ? (
              <div className="text-sm text-gray-400 italic">Nessuna valutazione registrata.</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {group.assessments.map((a) => (
                  <AssessmentBlock key={a.id} a={a} onEdit={onEdit} onRemove={onRemove} />
                ))}
              </div>
            )}
          </section>

          {/* Therapies active on this date */}
          <section>
            <h3 className="font-heading font-bold text-sm uppercase tracking-[0.15em] text-[#0A2540] mb-2 flex items-center gap-2">
              <Pill className="w-4 h-4" /> Terapie attive a questa data ({group.therapies.length})
            </h3>
            {group.therapies.length === 0 ? (
              <div className="text-sm text-gray-400 italic">Nessuna terapia attiva.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {group.therapies.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-gray-50 border border-gray-200"
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: categoryColor(t.category) }} />
                    <span className="font-semibold">{t.drug_name}</span>
                    {t.dose && <span className="text-gray-600">{t.dose}</span>}
                    {t.frequency && <span className="text-gray-500">· {t.frequency}</span>}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Lab exams */}
          {group.exams && group.exams.length > 0 && (
            <section>
              <h3 className="font-heading font-bold text-sm uppercase tracking-[0.15em] text-[#0A2540] mb-2 flex items-center gap-2">
                <FlaskConical className="w-4 h-4" /> Esami di laboratorio ({group.exams.length})
              </h3>
              <div className="space-y-2">
                {group.exams.map((e) => (
                  <div key={e.id} className="bg-blue-50/40 border border-blue-100 rounded-md p-3 text-xs">
                    <div className="font-heading font-bold text-[11px] uppercase tracking-[0.1em] text-[#0A2540] mb-1.5">
                      {e.panel || "esami"}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {Object.entries(e.values || {}).map(([k, v]) => (
                        <span key={k} className="font-mono">
                          <span className="text-gray-600">{k}:</span>{" "}
                          <span className="font-bold text-[#0A2540]">{v?.value ?? v?.qualitative ?? "-"}</span>
                          {v?.unit && <span className="text-gray-500"> {v.unit}</span>}
                        </span>
                      ))}
                    </div>
                    {e.notes && <div className="mt-1.5 text-[11px] text-gray-600 italic">{e.notes}</div>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="visit-details-close">Chiudi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
