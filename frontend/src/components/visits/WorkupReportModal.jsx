import React, { useRef } from "react";
import { X, Printer, Copy, FileText } from "lucide-react";
import { toast } from "sonner";
import { serializePhysicalExam } from "../clinical/PhysicalExamSection";

const SECTIONS = [
  { key: "cockpit_physiologic",           label: "Anamnesi fisiologica"                      },
  { key: "cockpit_family",               label: "Anamnesi familiare"                         },
  { key: "profile_comorbidities",         label: "Comorbidità"                               },
  { key: "profile_therapy",              label: "Terapia domiciliare"                        },
  { key: "profile_allergies",            label: "Allergie / Intolleranze"                    },
  { key: "workup_motivo_ipotesi",        label: "Motivo di invio e ipotesi diagnostiche"     },
  { key: "workup_esami_richiesti",       label: "Esami richiesti alla visita precedente"     },
  { key: "rheumatologic_history_summary", label: "Raccordo anamnestico reumatologico"        },
  { key: "interval_history",              label: "Anamnesi intervallare"                     },
  { key: "physical_exam",                 label: "Esame obiettivo"                           },
  { key: "labs_imaging",                  label: "Esami"                                     },
  { key: "clinimetria_notes",             label: "Clinimetria"                               },
  { key: "conclusions",                   label: "Conclusioni"                               },
  { key: "piano",                         label: "Esami richiesti (questa visita)"           },
  { key: "referral_note",                 label: "Indicazioni"                               },
];

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso + "T12:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return iso; }
}

export default function WorkupReportModal({
  open, onClose, form, patient, reportSections, workupTests = [],
  comorbText, cockpitData,
}) {
  const printRef = useRef(null);
  if (!open) return null;

  const getText = (key) => {
    if (key === "comorbidities")         return comorbText || null;
    if (key === "cockpit_physiologic")   return cockpitData?.physiologic_history?.trim() || null;
    if (key === "cockpit_family")        return cockpitData?.family_history?.trim() || null;
    if (key === "profile_comorbidities") return cockpitData?.comorbidities_text?.trim() || null;
    if (key === "profile_therapy")       return cockpitData?.therapy_dom_text?.trim() || null;
    if (key === "profile_allergies")     return cockpitData?.allergies_text?.trim() || null;
    if (key === "workup_motivo_ipotesi") return cockpitData?.workup_motivo_text?.trim() || null;
    if (key === "workup_esami_richiesti")return cockpitData?.workup_esami_text?.trim() || null;
    if (key === "piano") {
      const parts = [];
      if (form.requested_tests?.length > 0) {
        const labels = form.requested_tests.map(k => workupTests.find(t => t.key === k)?.label || k);
        parts.push("Esami richiesti: " + labels.join(", "));
      }
      if (form.requested_tests_notes?.trim()) parts.push(form.requested_tests_notes.trim());
      if (form.followup_date) parts.push("Prossima rivalutazione: " + fmtDate(form.followup_date));
      return parts.join("\n") || null;
    }
    if (key === "conclusions") {
      const parts = [
        form.diagnostic_hypotheses?.trim() ? "Ipotesi diagnostica: " + form.diagnostic_hypotheses.trim() : null,
        form.conclusions?.trim() || null,
      ].filter(Boolean);
      return parts.join("\n") || null;
    }
    if (key === "physical_exam") {
      const hasFreeText  = form.physical_exam?.trim();
      const hasJointExam = Object.keys(form.physical_exam_joint_exam || {}).length > 0;
      const hasSystems   = Object.keys(form.physical_exam_systems    || {}).length > 0;
      if (!hasFreeText && !hasJointExam && !hasSystems) return null;
      const serialized = serializePhysicalExam({
        free_text:  form.physical_exam             || "",
        joint_exam: form.physical_exam_joint_exam  || {},
        systems:    form.physical_exam_systems     || {},
        mrss:       form.physical_exam_mrss        || {},
        pasi:       form.physical_exam_pasi        || {},
        lei:        form.physical_exam_lei         || {},
      });
      return serialized?.trim() || form.physical_exam?.trim() || null;
    }
    if (key === "referral_note")        return form.referral_note?.trim() || null;
    return form[key]?.trim() || null;
  };

  const activeSections = SECTIONS.filter(s => reportSections.has(s.key) && getText(s.key));

  const buildPlainText = () => {
    const patientName = [patient?.cognome, patient?.nome].filter(Boolean).join(" ") || "—";
    const lines = [
      "VISITA DI WORKUP DIAGNOSTICO REUMATOLOGICO",
      "=".repeat(52),
      "Paziente: " + patientName,
      patient?.data_nascita ? "Data di nascita: " + fmtDate(patient.data_nascita) : null,
      "Data visita: " + fmtDate(form.visit_date),
      "=".repeat(52),
      "",
    ].filter(v => v !== null);
    for (const s of activeSections) {
      lines.push(s.label.toUpperCase());
      lines.push("-".repeat(Math.min(s.label.length, 44)));
      lines.push(getText(s.key));
      lines.push("");
    }
    const result = lines.join("\n");
    return result;
  };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const patientName = [patient?.cognome, patient?.nome].filter(Boolean).join(" ") || "—";
    const win = window.open("", "_blank", "width=820,height=950");
    win.document.write(`<!DOCTYPE html><html lang="it"><head><meta charset="utf-8">
<title>Referto workup — ${patientName}</title><style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Times New Roman',Times,serif; font-size:11.5pt; color:#000; padding:2cm 2.5cm; line-height:1.55; }
.rt { font-size:13pt; font-weight:bold; text-transform:uppercase; letter-spacing:.04em; }
.dh { border-top:2px solid #000; margin:8px 0; }
.dl { border-top:1px solid #ccc; margin:12px 0; }
.pi { font-size:11pt; margin-bottom:3px; }
.st { font-size:10.5pt; font-weight:bold; text-transform:uppercase; letter-spacing:.05em; border-bottom:1px solid #bbb; padding-bottom:3px; margin:20px 0 6px; }
.sb { font-size:11pt; white-space:pre-wrap; line-height:1.6; }
.sr { margin-top:56px; display:flex; justify-content:space-between; }
.sl { width:200px; border-top:1px solid #000; padding-top:6px; font-size:10pt; color:#555; text-align:center; }
@media print { body { padding:1.5cm 2cm; } @page { margin:1.5cm; } }
</style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 200);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildPlainText());
      toast.success("Referto copiato negli appunti");
    } catch {
      toast.error("Impossibile copiare");
    }
  };

  const patientName = [patient?.cognome, patient?.nome].filter(Boolean).join(" ") || "—";

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000 }} />
      {/* ── DEBUG BANNER inline ── */}
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 1001, background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        width: "min(760px, 96vw)",
        maxHeight: "90vh",
        overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{
          padding: "13px 18px",
          background: "#0A2540",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FileText size={15} color="#fff" />
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>Anteprima referto</span>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", marginLeft: "2px" }}>
              {activeSections.length} {activeSections.length === 1 ? "sezione" : "sezioni"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button onClick={handleCopy} style={{
              padding: "5px 12px", borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.3)", background: "transparent",
              color: "#fff", fontSize: "11px", fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: "5px",
            }}>
              <Copy size={11} /> Copia testo
            </button>
            <button onClick={handlePrint} style={{
              padding: "5px 14px", borderRadius: "6px",
              border: "none", background: "#fff",
              color: "#0A2540", fontSize: "11px", fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: "5px",
            }}>
              <Printer size={11} /> Stampa / PDF
            </button>
            <button onClick={onClose} style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.6)", padding: "4px",
            }}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px", background: "#f3f4f6" }}>
          {activeSections.length === 0 ? (
            <div style={{ textAlign: "center", padding: "56px 0", color: "#9ca3af" }}>
              <FileText size={32} style={{ margin: "0 auto 10px", opacity: 0.35 }} />
              <div style={{ fontSize: "14px", marginBottom: "4px" }}>Nessuna sezione selezionata o compilata.</div>
              <div style={{ fontSize: "12px" }}>
                Usa le caselle ☐ a sinistra di ogni sezione per includerla nel referto.
              </div>
            </div>
          ) : (
            <div ref={printRef} style={{
              background: "#fff",
              borderRadius: "6px",
              border: "1px solid #e5e7eb",
              padding: "36px 40px",
              maxWidth: "680px",
              margin: "0 auto",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}>
              <div className="rt" style={{ fontSize: "13pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#000" }}>
                Visita di workup diagnostico reumatologico
              </div>
              <div className="dh" style={{ borderTop: "2px solid #000", margin: "8px 0" }} />
              <div className="pi" style={{ fontSize: "11pt", marginBottom: "3px" }}>
                <strong>Paziente:</strong> {patientName}
              </div>
              {patient?.data_nascita && (
                <div className="pi" style={{ fontSize: "11pt", marginBottom: "3px" }}>
                  <strong>Data di nascita:</strong> {fmtDate(patient.data_nascita)}
                  {patient?.sesso && <span>&nbsp;·&nbsp;<strong>Sesso:</strong> {patient.sesso}</span>}
                </div>
              )}
              <div className="pi" style={{ fontSize: "11pt", marginBottom: "3px" }}>
                <strong>Data visita:</strong> {fmtDate(form.visit_date)}
              </div>
              {form.confirmed_diagnosis && (
                <div style={{ fontSize: "11pt", color: "#166534", fontWeight: 600, marginTop: "6px" }}>
                  Diagnosi: {form.confirmed_diagnosis}
                </div>
              )}
              <div className="dl" style={{ borderTop: "1px solid #ccc", margin: "14px 0" }} />

              {activeSections.map(s => (
                <div key={s.key}>
                  <div className="st" style={{
                    fontSize: "10.5pt", fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "0.04em", color: "#000",
                    borderBottom: "1px solid #bbb", paddingBottom: "3px", marginBottom: "6px", marginTop: "20px",
                  }}>
                    {s.num}. {s.label}
                  </div>
                  {s.key === "piano" ? (
                    <div className="sb" style={{ fontSize: "11pt", lineHeight: 1.6 }}>
                      {form.requested_tests?.length > 0 && (
                        <div style={{ marginBottom: "5px" }}>
                          <strong>Esami richiesti:</strong>{" "}
                          {form.requested_tests.map(k => workupTests.find(t => t.key === k)?.label || k).join(", ")}
                        </div>
                      )}
                      {form.followup_date && (
                        <div style={{ marginBottom: "5px" }}>
                          <strong>Prossima rivalutazione:</strong> {fmtDate(form.followup_date)}
                        </div>
                      )}
                      {form.therapy_modification && (
                        <div>
                          <strong>Indicazioni terapeutiche:</strong>
                          <div style={{ whiteSpace: "pre-wrap", marginTop: "2px" }}>{form.therapy_modification}</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="sb" style={{ fontSize: "11pt", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {getText(s.key)}
                    </div>
                  )}
                </div>
              ))}

              <div className="sr" style={{ marginTop: "56px", display: "flex", justifyContent: "space-between" }}>
                <div className="sl" style={{ width: "200px", borderTop: "1px solid #000", paddingTop: "6px", fontSize: "10pt", color: "#555", textAlign: "center" }}>Firma medico</div>
                <div className="sl" style={{ width: "200px", borderTop: "1px solid #000", paddingTop: "6px", fontSize: "10pt", color: "#555", textAlign: "center" }}>Timbro</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
