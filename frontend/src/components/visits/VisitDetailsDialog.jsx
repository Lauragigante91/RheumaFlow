import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Edit, Trash2, FlaskConical, Pill, Stethoscope, FileText, Printer, Copy, ExternalLink } from "lucide-react";
import { INDEX_LABELS } from "../../lib/clinimetrics";
import { categoryColor } from "../../lib/drugs";
import { toast } from "sonner";

function patientLabel(p) {
  if (!p) return "Paziente";
  return [p.cognome, p.nome].filter(Boolean).join(" ") || p.codice_paziente || "Paziente";
}

function fmtDateShort(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Parse structured notes text (sections delimited by [Label]\n) into an array of {label, text}
function parseVisitNotes(raw) {
  if (!raw?.trim()) return [];
  const sections = [];
  // Split on section headers like [Label]\n
  const parts = raw.split(/(?=\[[^\]]+\]\n)/);
  for (const part of parts) {
    const match = part.match(/^\[([^\]]+)\]\n([\s\S]*)/);
    if (match) {
      const text = match[2].trim();
      if (text) sections.push({ label: match[1], text });
    } else {
      // Free text not in a section (symptoms, free notes, score info)
      const text = part.trim();
      if (text) sections.push({ label: null, text });
    }
  }
  return sections;
}

// Extract the unique visit narrative from a group of assessments (same date).
// Multiple indices on the same day share the same text prefix — deduplicate it.
function extractVisitNotes(assessments) {
  const seen = new Set();
  const blocks = [];
  for (const a of assessments) {
    if (!a.notes?.trim()) continue;
    // The notes = textPrefix + symptomStr + free note. Strip out score/numeric lines
    // and keep only the narrative text (everything before a line starting with a digit).
    const full = a.notes.trim();
    if (!seen.has(full)) {
      seen.add(full);
      blocks.push(full);
    }
  }
  return blocks;
}

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

export default function VisitDetailsDialog({ open, group, patient, onClose, onEdit, onRemove, onOpenExams, onOpenTherapies, onPromoteToWorkup }) {
  if (!group) return null;

  const dateLabel = new Date(group.date).toLocaleDateString("it-IT", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
  const dateShort = fmtDateShort(group.date);
  const pLabel = patientLabel(patient);

  function buildReportSections() {
    const sections = [];

    // Narrative from assessments (structured fields — imported visits)
    const raccordo = group.assessments.reduce((acc, a) => acc || a.rheumatologic_history_summary?.trim(), "");
    const intervalHistory = group.assessments.reduce((acc, a) => acc || a.interval_history?.trim(), "");
    const labsImaging = group.assessments.reduce((acc, a) => acc || a.labs_imaging?.trim(), "");
    const conclusions = group.assessments.reduce((acc, a) => acc || a.conclusions?.trim(), "");

    if (raccordo)       sections.push({ label: "RACCORDO ANAMNESTICO REUMATOLOGICO", text: raccordo });
    if (intervalHistory) sections.push({ label: "ANAMNESI INTERVALLARE", text: intervalHistory });
    if (labsImaging)    sections.push({ label: "ESAMI / IMAGING", text: labsImaging });

    // Clinimetria
    const clinLines = group.assessments
      .filter(a => a.score != null)
      .map(a => {
        const label = INDEX_LABELS[a.index_type] || a.index_type;
        return `${label}: ${a.score}${a.interpretation ? `  →  ${a.interpretation}` : ""}`;
      });
    if (clinLines.length) sections.push({ label: "CLINIMETRIA", text: clinLines.join("\n") });

    if (conclusions) sections.push({ label: "CONCLUSIONI", text: conclusions });

    // Therapies
    if (group.therapies.length) {
      const therapyText = group.therapies
        .map(t => [t.drug_name, t.dose, t.frequency, t.route].filter(Boolean).join(" · "))
        .join("\n");
      sections.push({ label: "TERAPIE ATTIVE", text: therapyText });
    }

    // Lab exams
    if (group.exams?.length) {
      const examLines = group.exams.flatMap(e =>
        Object.entries(e.values || {}).map(([k, v]) =>
          `${k}: ${v?.value ?? v?.qualitative ?? "-"}${v?.unit ? " " + v.unit : ""}`
        )
      );
      if (examLines.length) sections.push({ label: "ESAMI DI LABORATORIO", text: examLines.join("\n") });
    }

    return sections;
  }

  const handleCopy = () => {
    const sections = buildReportSections();
    const txt = [
      `${pLabel} — Visita del ${dateShort}${patient?.diagnosi ? " · " + patient.diagnosi : ""}`,
      "",
      ...sections.map(s => `${s.label}\n${s.text}`),
    ].join("\n\n");
    navigator.clipboard.writeText(txt)
      .then(() => toast.success("Testo copiato negli appunti"))
      .catch(() => toast.error("Copia non riuscita"));
  };

  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w) { toast.error("Popup bloccato — abilita i popup per stampare"); return; }
    const esc = (s = "") => s
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
    const sections = buildReportSections();
    const diagLabel = patient?.diagnosi ? ` · ${patient.diagnosi}` : "";
    w.document.write(`<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8">
<title>Referto – ${pLabel} – ${dateShort}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; max-width: 720px; margin: 40px auto; padding: 0 24px; color: #111; line-height: 1.7; font-size: 13px; }
  .header { border-bottom: 2px solid #0A2540; padding-bottom: 14px; margin-bottom: 24px; }
  .header h1 { font-size: 20px; font-weight: 700; color: #0A2540; }
  .header .sub { font-size: 12px; color: #555; margin-top: 3px; }
  .section { margin-bottom: 22px; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: #b45309; margin-bottom: 6px; }
  .section-body { white-space: pre-wrap; color: #222; }
  .footer-note { margin-top: 36px; border-top: 1px solid #e5e7eb; padding-top: 10px; font-size: 10px; color: #9ca3af; }
  @media print { button { display: none !important; } }
</style>
</head><body>
<div class="header">
  <h1>${esc(pLabel)}</h1>
  <div class="sub">Visita del ${dateShort}${esc(diagLabel)}</div>
</div>
${sections.map(s => `<div class="section">
  <div class="section-title">${esc(s.label)}</div>
  <div class="section-body">${esc(s.text)}</div>
</div>`).join("")}
<div class="footer-note">Documento generato da RheumaFlow — ${new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}</div>
</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

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
          {/* Visit narrative notes */}
          {(() => {
            const noteBlocks = extractVisitNotes(group.assessments);
            if (noteBlocks.length === 0) return null;
            // Use first unique block (others are usually score-only duplicates)
            const sections = parseVisitNotes(noteBlocks[0]);
            if (sections.length === 0) return null;
            return (
              <section>
                <h3 className="font-heading font-bold text-sm uppercase tracking-[0.15em] text-[#0A2540] mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Referto visita
                </h3>
                <div className="rounded-lg border border-gray-200 bg-gray-50 divide-y divide-gray-100">
                  {sections.map((sec, i) => (
                    <div key={i} className="px-4 py-3">
                      {sec.label && (
                        <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-gray-400 mb-1">
                          {sec.label}
                        </div>
                      )}
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {sec.text}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            );
          })()}

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
              {onOpenTherapies && (
                <button
                  type="button"
                  onClick={onOpenTherapies}
                  className="ml-auto text-[11px] font-normal normal-case tracking-normal text-teal-600 hover:text-teal-800 hover:underline flex items-center gap-0.5"
                >
                  Gestisci <ExternalLink className="w-3 h-3" />
                </button>
              )}
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
                {onOpenExams && (
                  <button
                    type="button"
                    onClick={onOpenExams}
                    className="ml-auto text-[11px] font-normal normal-case tracking-normal text-teal-600 hover:text-teal-800 hover:underline flex items-center gap-0.5"
                  >
                    Modifica <ExternalLink className="w-3 h-3" />
                  </button>
                )}
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

        <DialogFooter className="flex-row items-center gap-2 sm:justify-between">
          <div className="flex items-center gap-2">
            <Button onClick={handlePrint} className="bg-[#0A2540] hover:bg-[#051626] text-white gap-1.5">
              <Printer className="w-4 h-4" /> Stampa referto
            </Button>
            <Button variant="outline" onClick={handleCopy} className="gap-1.5">
              <Copy className="w-4 h-4" /> Copia testo
            </Button>
            {onPromoteToWorkup && (
              <Button
                variant="outline"
                onClick={() => { onClose(); onPromoteToWorkup(group.date); }}
                className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
              >
                <ExternalLink className="w-4 h-4" /> Modifica visita completa
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={onClose} data-testid="visit-details-close">Chiudi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
