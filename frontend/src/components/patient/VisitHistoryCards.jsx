import React, { useState } from "react";
import { Calendar, Trash2 } from "lucide-react";
import { INDEX_LABELS } from "../../lib/clinimetrics";
import { serializePhysicalExam } from "../clinical/PhysicalExamSection";
import VisitFullRecordModal from "../visits/VisitFullRecordModal";
import { buildTerapiaUscita } from "../../lib/terapiaUscita";

// ── Date helper ───────────────────────────────────────────────────────────────
export function fmtVisitDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ── Tiny label+content block (used in other components that import this file) ─
export function VisitSection({ label, content }) {
  if (!content) return null;
  return (
    <div className="space-y-0.5">
      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-gray-400">{label}</div>
      <p className="text-[11px] text-gray-600 whitespace-pre-wrap leading-relaxed">{content}</p>
    </div>
  );
}

// ── Record builders ───────────────────────────────────────────────────────────

function buildClinietriaText(assessments) {
  const lines = (assessments || [])
    .filter((a) => a.score != null)
    .map((a) => {
      const label = INDEX_LABELS[a.index_type] || a.index_type;
      return `${label}: ${Number(a.score).toFixed(1)}${a.interpretation ? `  →  ${a.interpretation}` : ""}`;
    });
  return lines.length ? lines.join("\n") : null;
}

function buildPrimaVisitaRecord(firstVisit, patient, linkedAssessments) {
  const conclusioniLines = [];
  if (firstVisit.confirmed_diagnosis?.trim())
    conclusioniLines.push(`Diagnosi definitiva: ${firstVisit.confirmed_diagnosis.trim()}`);
  else if (firstVisit.suggested_diagnosis?.trim())
    conclusioniLines.push(`Ipotesi diagnostiche: ${firstVisit.suggested_diagnosis.trim()}`);
  if (firstVisit.diagnostic_conclusion?.trim())
    conclusioniLines.push(firstVisit.diagnostic_conclusion.trim());

  const testsParts = [
    Array.isArray(firstVisit.requested_tests) && firstVisit.requested_tests.length
      ? firstVisit.requested_tests.join(" · ")
      : null,
    firstVisit.requested_tests_notes?.trim() || null,
  ].filter(Boolean);

  const esamiParts = [
    firstVisit.labs_imaging?.trim() || null,
    testsParts.length ? `Esami richiesti:\n${testsParts.join("\n")}` : null,
  ].filter(Boolean);

  return {
    date: firstVisit.referral_date,
    visitTypeLabel: "Prima visita",
    medicoName: firstVisit.created_by_name || null,
    anamnesi_fisiologica:  patient?.anamnesi_fisiologica || null,
    anamnesi_familiare:    patient?.anamnesi_familiare || null,
    comorbidita:           patient?.comorbidita_apr || null,
    allergie:              patient?.allergie_testo || null,
    terapie_in_corso:      patient?.terapia_domiciliare || null,
    terapie_pregresse:     null,
    raccordo:              firstVisit.rheumatologic_history?.trim() || null,
    anamnesi_intervallare: null,
    esame_obiettivo:       firstVisit.physical_exam?.trim() || null,
    clinimetria:           buildClinietriaText(linkedAssessments),
    esami:                 esamiParts.join("\n\n") || null,
    conclusioni:           conclusioniLines.join("\n\n") || null,
    terapia_uscita:        buildTerapiaUscita({ regimen: patient?.terapia_domiciliare }),
    modifiche_terapeutiche: firstVisit?.therapy_modification?.trim() || null,
    indicazioni:           firstVisit.outcome_notes?.trim() || null,
  };
}

function buildWorkupRecord(visit, patient, linkedAssessments) {
  const isFollowUp = visit.visit_type === "follow_up";

  const physEO = (() => {
    const structured = serializePhysicalExam({
      free_text:  visit.physical_exam            || "",
      joint_exam: visit.physical_exam_joint_exam || {},
      systems:    visit.physical_exam_systems    || {},
      mrss:       visit.physical_exam_mrss       || {},
      pasi:       visit.physical_exam_pasi       || {},
      lei:        visit.physical_exam_lei        || {},
    });
    return structured?.trim() || visit.physical_exam?.trim() || null;
  })();

  const conclusioniParts = [
    visit.confirmed_diagnosis ? `Diagnosi: ${visit.confirmed_diagnosis}` : null,
    visit.diagnostic_hypotheses ? `Ipotesi: ${visit.diagnostic_hypotheses}` : null,
    visit.conclusions?.trim() || null,
  ].filter(Boolean);

  return {
    date: visit.visit_date,
    visitTypeLabel: isFollowUp ? "Follow-up" : "Workup",
    medicoName: visit.created_by_name || null,
    anamnesi_fisiologica:  patient?.anamnesi_fisiologica || null,
    anamnesi_familiare:    patient?.anamnesi_familiare || null,
    comorbidita:           visit.comorbidities_text?.trim() || patient?.comorbidita_apr || null,
    allergie:              patient?.allergie_testo || null,
    terapie_in_corso:      visit.home_therapies_text?.trim() || null,
    terapie_pregresse:     null,
    raccordo:              visit.rheumatologic_history_summary?.trim() || null,
    anamnesi_intervallare: visit.interval_history?.trim() || null,
    esame_obiettivo:       physEO,
    clinimetria:           buildClinietriaText(linkedAssessments),
    esami:                 visit.labs_imaging?.trim() || null,
    conclusioni:           conclusioniParts.join("\n\n") || null,
    terapia_uscita:        buildTerapiaUscita({ originalText: visit.exit_therapy_text, exitText: visit.exit_therapies_text }),
    modifiche_terapeutiche: visit?.therapy_modification?.trim() || null,
    indicazioni:           visit.referral_note?.trim() || null,
  };
}

function buildPreviousVisitRecord(group, patient) {
  const { date, assessments = [], therapies = [] } = group;

  const firstField = (field) => {
    for (const a of assessments) {
      const v = a[field];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  };

  const physEO = (() => {
    const a = assessments.find(
      (a) => a.physical_exam?.trim() ||
        Object.keys(a.physical_exam_joint_exam || {}).length ||
        Object.keys(a.physical_exam_systems    || {}).length
    );
    if (!a) return null;
    const serialized = serializePhysicalExam({
      free_text:  a.physical_exam            || "",
      joint_exam: a.physical_exam_joint_exam || {},
      systems:    a.physical_exam_systems    || {},
      mrss:       a.physical_exam_mrss       || {},
      pasi:       a.physical_exam_pasi       || {},
      lei:        a.physical_exam_lei        || {},
    });
    return serialized?.trim() || a.physical_exam?.trim() || null;
  })();

  const terapiaTesto = therapies.length
    ? therapies
        .map((t) => [t.drug_name, t.dose, t.frequency, t.route].filter(Boolean).join(" · "))
        .join("\n")
    : null;

  const medicoName = assessments.find((a) => a.created_by_name)?.created_by_name || null;

  return {
    date,
    visitTypeLabel: "Valutazione clinimetrica",
    medicoName,
    anamnesi_fisiologica:  patient?.anamnesi_fisiologica || null,
    anamnesi_familiare:    patient?.anamnesi_familiare || null,
    comorbidita:           patient?.comorbidita_apr || null,
    allergie:              patient?.allergie_testo || null,
    terapie_in_corso:      terapiaTesto,
    terapie_pregresse:     null,
    raccordo:              firstField("rheumatologic_history_summary"),
    anamnesi_intervallare: firstField("interval_history"),
    esame_obiettivo:       physEO,
    clinimetria:           buildClinietriaText(assessments),
    esami:                 firstField("labs_imaging"),
    conclusioni:           firstField("conclusions"),
    terapia_uscita:        buildTerapiaUscita({ regimen: terapiaTesto }),
    modifiche_terapeutiche: null,
    indicazioni:           null,
  };
}

// ── Prima visita card ─────────────────────────────────────────────────────────
export function PrimaVisitaCard({ firstVisit, patient, patientId, onDelete, onInsertToSection, insertSections, linkedAssessments }) {
  const [modalOpen, setModalOpen] = useState(false);

  const record = buildPrimaVisitaRecord(firstVisit, patient, linkedAssessments);

  const footerActions = (
    <>
      {patientId && (
        <a
          href={`/pazienti/${patientId}/prima-visita`}
          className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline px-3 py-1.5"
        >
          Modifica visita →
        </a>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={() => { setModalOpen(false); onDelete(); }}
          className="text-[11px] text-red-500 hover:text-red-700 hover:underline px-3 py-1.5"
        >
          Elimina visita
        </button>
      )}
    </>
  );

  return (
    <>
      <div className="flex items-center gap-0.5 group/primacard">
        <button
          type="button"
          className="flex-1 flex items-center gap-2 px-3 py-2.5 text-left rounded-lg border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-200 transition-colors"
          onClick={() => setModalOpen(true)}
        >
          <Calendar className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
          <span className="font-medium text-sm text-gray-800">{fmtVisitDate(firstVisit.referral_date)}</span>
          {linkedAssessments?.length > 0 && linkedAssessments.slice(0, 3).map((a) => (
            <span key={a.id || a.index_type} className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
              {INDEX_LABELS?.[a.index_type]?.split(" ")[0] || a.index_type?.toUpperCase()}{a.score != null ? `: ${Number(a.score).toFixed(1)}` : ""}
            </span>
          ))}
          <span className="ml-auto text-[10px] text-blue-600 font-semibold bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded shrink-0">Prima visita</span>
        </button>
        {onDelete && (
          <button
            type="button"
            title="Elimina prima visita"
            onClick={onDelete}
            className="flex-shrink-0 p-1.5 rounded opacity-0 group-hover/primacard:opacity-100 transition-opacity text-gray-300 hover:text-red-500 hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {modalOpen && (
        <VisitFullRecordModal
          onClose={() => setModalOpen(false)}
          record={record}
          patient={patient}
          extraFooterActions={footerActions}
        />
      )}
    </>
  );
}

// ── Workup / follow-up visit card ─────────────────────────────────────────────
export function WorkupVisitCard({ visit, patientId, patient, onDelete, onInsertToSection, insertSections, linkedAssessments }) {
  const [modalOpen, setModalOpen] = useState(false);

  const record = buildWorkupRecord(visit, patient, linkedAssessments);
  const isFollowUp = visit.visit_type === "follow_up";

  const footerActions = (
    <>
      {patientId && visit._id && (
        <a
          href={`/pazienti/${patientId}/visita-workup?editVisit=${visit._id}`}
          className="text-[11px] text-amber-700 hover:text-amber-900 hover:underline px-3 py-1.5"
        >
          Modifica visita →
        </a>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={() => { setModalOpen(false); onDelete(); }}
          className="text-[11px] text-red-500 hover:text-red-700 hover:underline px-3 py-1.5"
        >
          Elimina visita
        </button>
      )}
    </>
  );

  return (
    <>
      <div className="flex items-center gap-0.5 group/workupcard">
        <button
          type="button"
          className="flex-1 flex items-center gap-2 px-3 py-2.5 text-left rounded-lg border border-gray-200 bg-white hover:bg-amber-50 hover:border-amber-200 transition-colors"
          onClick={() => setModalOpen(true)}
        >
          <Calendar className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span className="font-medium text-sm text-gray-800">{fmtVisitDate(visit.visit_date)}</span>
          {linkedAssessments?.length > 0 && linkedAssessments.slice(0, 3).map((a) => (
            <span key={a.id || a.index_type} className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
              {a.index_type === "asdas_crp" ? "ASDAS" : a.index_type.toUpperCase()}{a.score != null ? `: ${Number(a.score).toFixed(1)}` : ""}
            </span>
          ))}
          {visit.status === "draft" && (
            <span className="text-[10px] text-gray-500 font-semibold bg-gray-100 border border-gray-300 px-1.5 py-0.5 rounded shrink-0">Bozza</span>
          )}
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${isFollowUp ? "text-indigo-700 bg-indigo-50 border border-indigo-200" : "text-amber-700 bg-amber-50 border border-amber-200"}`}>
            {isFollowUp ? "Follow-up" : "Workup"}
          </span>
        </button>
        {onDelete && (
          <button
            type="button"
            title="Elimina visita"
            onClick={onDelete}
            className="flex-shrink-0 p-1.5 rounded opacity-0 group-hover/workupcard:opacity-100 transition-opacity text-gray-300 hover:text-red-500 hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {modalOpen && (
        <VisitFullRecordModal
          onClose={() => setModalOpen(false)}
          record={record}
          patient={patient}
          extraFooterActions={footerActions}
        />
      )}
    </>
  );
}

// ── Previous assessment-only visit card ───────────────────────────────────────
export function PreviousVisitCard({ group, patient, onOpenDetail, onDelete, onInsertToSection, insertSections }) {
  const [modalOpen, setModalOpen] = useState(false);
  const { date, assessments } = group;

  const record = buildPreviousVisitRecord(group, patient);

  return (
    <>
      <div className="flex items-center gap-0.5 group/prevcard">
        <button
          type="button"
          className="flex-1 flex items-center gap-2 px-3 py-2.5 text-left rounded-lg border border-gray-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
          onClick={() => setModalOpen(true)}
        >
          <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="font-medium text-sm text-gray-800 flex-1">{fmtVisitDate(date)}</span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {assessments
              .filter((a) => a.score != null)
              .slice(0, 2)
              .map((a) => (
                <span
                  key={a.id}
                  className="text-[10px] font-mono font-bold text-[#0A2540] bg-gray-100 rounded px-1.5 py-0.5"
                >
                  {INDEX_LABELS[a.index_type]?.split(" ")[0] || a.index_type}: {Number(a.score).toFixed(1)}
                </span>
              ))}
            {assessments.filter((a) => a.score != null).length > 2 && (
              <span className="text-[10px] text-gray-400">
                +{assessments.filter((a) => a.score != null).length - 2}
              </span>
            )}
          </div>
        </button>

        {onOpenDetail && (
          <button
            type="button"
            title="Modifica valutazioni"
            onClick={onOpenDetail}
            className="flex-shrink-0 p-1.5 rounded opacity-0 group-hover/prevcard:opacity-100 transition-opacity text-gray-300 hover:text-indigo-500 hover:bg-indigo-50"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            title="Elimina visita"
            onClick={onDelete}
            className="flex-shrink-0 p-1.5 rounded opacity-0 group-hover/prevcard:opacity-100 transition-opacity text-gray-300 hover:text-red-500 hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {modalOpen && patient && (
        <VisitFullRecordModal
          onClose={() => setModalOpen(false)}
          record={record}
          patient={patient}
        />
      )}
    </>
  );
}
