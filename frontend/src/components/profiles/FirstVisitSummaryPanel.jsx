import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, ClipboardList, ExternalLink } from "lucide-react";
import { COMORBIDITY_CATEGORIES } from "../../lib/conditions";

// ─── Label lookups ────────────────────────────────────────────────────────────

const REFERRAL_LABELS = {
  artralgie:     "Artralgie / sospetta artrite infiammatoria",
  fibromialgia:  "Dolore diffuso / sospetta fibromialgia",
  osteoporosi:   "Osteoporosi / frattura da fragilità / MOC",
  autoanticorpi: "Autoanticorpi positivi isolati",
  connettivite:  "Sospetta connettivite / malattia sistemica",
  pmr_lvv:       "Sospetta PMR / GCA / LVV",
  spa:           "Lombalgia infiammatoria / sospetta SpA",
  altro:         "Altro / motivo non specificato",
};

const CERTAINTY_LABELS = {
  definita:   "Definita",
  probabile:  "Probabile",
  sospetta:   "Sospetta",
  incerta:    "Incerta",
};

// ─── Small helpers ────────────────────────────────────────────────────────────

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[140px_1fr] gap-x-2 text-xs py-0.5">
      <span className="text-gray-500 font-medium shrink-0">{label}</span>
      <span className="text-gray-800 whitespace-pre-wrap break-words">{value}</span>
    </div>
  );
}

function SectionHead({ title }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-[#0A2540] mt-3 mb-1.5 border-b border-gray-100 pb-0.5">
      {title}
    </div>
  );
}

function CollapsibleText({ text, maxLines = 6, label = "testo" }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const lines = text.split("\n");
  const needsCollapse = lines.length > maxLines;
  const displayed = (!needsCollapse || expanded) ? text : lines.slice(0, maxLines).join("\n") + "…";
  return (
    <div>
      <pre className="text-xs text-gray-800 whitespace-pre-wrap break-words font-sans leading-relaxed">
        {displayed}
      </pre>
      {needsCollapse && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800"
        >
          {expanded
            ? <><ChevronDown className="w-3 h-3" /> Comprimi</>
            : <><ChevronRight className="w-3 h-3" /> Mostra tutto ({lines.length} righe)</>}
        </button>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function FirstVisitSummaryPanel({ fv, patientId }) {
  const [open, setOpen] = useState(true);

  if (!fv) return null;

  // Build flat comorbidity list with optional notes
  const comorbItems = [];
  if (fv.comorbidities) {
    for (const cat of COMORBIDITY_CATEGORIES) {
      const selected = fv.comorbidities[cat.key] || [];
      for (const item of selected) {
        const note = fv.comorbidity_item_notes?.[item];
        comorbItems.push({ item, note });
      }
    }
  }

  // Frailty flags
  const frailty = fv.frailty || [];

  // Referral label
  const referralLabel = fv.referral_reason
    ? (REFERRAL_LABELS[fv.referral_reason] || fv.referral_reason)
    : null;

  // Diagnostic conclusion display
  const conclusion = fv.diagnostic_conclusion || fv.suggested_diagnosis;
  const certainty = fv.diagnostic_certainty ? CERTAINTY_LABELS[fv.diagnostic_certainty] || fv.diagnostic_certainty : null;

  const hasAnything =
    referralLabel ||
    fv.referral_notes ||
    fv.referral_source ||
    fv.physiological_history ||
    fv.family_history ||
    fv.allergies ||
    comorbItems.length > 0 ||
    fv.current_therapies_text ||
    fv.previous_therapies_text ||
    fv.rheumatologic_history ||
    fv.bone_history ||
    fv.physical_exam ||
    conclusion;

  if (!hasAnything) return null;

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-indigo-50/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-[0.1em] text-indigo-800">
            Profilo longitudinale — dati Prima Visita
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/pazienti/${patientId}/prima-visita`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700"
          >
            <ExternalLink className="w-3 h-3" /> Apri
          </Link>
          {open
            ? <ChevronDown className="w-4 h-4 text-indigo-400" />
            : <ChevronRight className="w-4 h-4 text-indigo-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4">

          {/* ── 1. Referral reason ── */}
          {(referralLabel || fv.referral_notes || fv.referral_source) && (
            <>
              <SectionHead title="Motivo di invio" />
              <Row label="Categoria" value={referralLabel} />
              <Row label="Quesito clinico" value={fv.referral_notes} />
              <Row label="Inviante / fonte" value={fv.referral_source} />
            </>
          )}

          {/* ── 2. Extra-rheumatologic history ── */}
          {(fv.physiological_history || fv.family_history || fv.allergies ||
            comorbItems.length > 0 || frailty.length > 0 ||
            fv.current_therapies_text || fv.previous_therapies_text) && (
            <>
              <SectionHead title="Anamnesi extra-reumatologica" />
              <Row label="Storia fisiologica" value={fv.physiological_history} />
              <Row label="Anamnesi familiare" value={fv.family_history} />
              <Row label="Allergie / intolleranze" value={fv.allergies} />

              {comorbItems.length > 0 && (
                <div className="grid grid-cols-[140px_1fr] gap-x-2 text-xs py-0.5">
                  <span className="text-gray-500 font-medium shrink-0 pt-0.5">Comorbilità</span>
                  <div className="flex flex-wrap gap-1">
                    {comorbItems.map(({ item, note }) => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded px-1.5 py-0.5 text-[11px] text-gray-700"
                        title={note || undefined}
                      >
                        {item}
                        {note && <span className="text-gray-400 italic text-[10px]">· {note}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {frailty.length > 0 && (
                <div className="grid grid-cols-[140px_1fr] gap-x-2 text-xs py-0.5">
                  <span className="text-gray-500 font-medium shrink-0 pt-0.5">Fragilità</span>
                  <div className="flex flex-wrap gap-1">
                    {frailty.map((f) => (
                      <span key={f} className="inline-flex items-center bg-amber-50 border border-amber-200 text-amber-800 rounded px-1.5 py-0.5 text-[11px]">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <Row label="Terapie non-reuma" value={fv.current_therapies_text} />
              <Row label="Terapie pregresse" value={fv.previous_therapies_text} />
            </>
          )}

          {/* ── 3. Rheumatologic history ── */}
          {fv.rheumatologic_history && (
            <>
              <SectionHead title="Anamnesi reumatologica" />
              <CollapsibleText text={fv.rheumatologic_history} maxLines={6} />
            </>
          )}

          {/* ── 4. Bone history (only if present) ── */}
          {fv.bone_history && (
            <>
              <SectionHead title="Anamnesi osseo-metabolica" />
              <CollapsibleText text={fv.bone_history} maxLines={5} />
            </>
          )}

          {/* ── 5. Physical examination ── */}
          {fv.physical_exam && (
            <>
              <SectionHead title="Esame obiettivo (Prima Visita)" />
              <CollapsibleText text={fv.physical_exam} maxLines={6} />
            </>
          )}

          {/* ── 6. Diagnostic conclusion ── */}
          {conclusion && (
            <>
              <SectionHead title="Conclusione diagnostica" />
              <div className="flex flex-wrap items-baseline gap-2 text-xs">
                <span className="font-semibold text-gray-800">{conclusion}</span>
                {certainty && (
                  <span className="text-[11px] text-indigo-600 font-medium">({certainty})</span>
                )}
                {fv.referral_date && (
                  <span className="text-[11px] text-gray-400">
                    · Prima visita: {new Date(fv.referral_date).toLocaleDateString("it-IT")}
                  </span>
                )}
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
}
