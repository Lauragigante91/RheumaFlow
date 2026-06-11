import React, { useState } from "react";
import { AlertCircle, AlertTriangle, Check, ChevronDown, ChevronRight } from "lucide-react";

// ── Section target definitions ────────────────────────────────────────────────
// Keys must match visit_sections fields (or "td" for terapia_domiciliare).
const SECTION_TARGETS = [
  { key: "raccordo",    label: "Raccordo",              bg: "bg-indigo-50",  text: "text-indigo-700",  border: "border-indigo-200"  },
  { key: "anamnesi",    label: "Anamnesi intervallare",  bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200"    },
  { key: "esame_obj",   label: "Esame obiettivo",        bg: "bg-teal-50",    text: "text-teal-700",    border: "border-teal-200"    },
  { key: "labs_text",   label: "Esami / Imaging",        bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200"   },
  { key: "conclusioni", label: "Conclusioni",            bg: "bg-slate-50",   text: "text-slate-700",   border: "border-slate-200"   },
  { key: "indicazioni", label: "Indicazioni",            bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200"  },
  { key: "td",          label: "Terapia domiciliare",    bg: "bg-green-50",   text: "text-green-700",   border: "border-green-200"   },
];

// ── Chip row ──────────────────────────────────────────────────────────────────
function SectionChips({ onAssign, excludeKey }) {
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <span className="text-[10px] text-gray-400 flex-shrink-0">Assegna a:</span>
      {SECTION_TARGETS.filter((s) => s.key !== excludeKey).map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => onAssign(s.key)}
          className={`text-[10px] px-2 py-0.5 rounded border ${s.bg} ${s.text} ${s.border} hover:opacity-75 transition-opacity font-medium`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ── Group A — Unresolved block ────────────────────────────────────────────────
function UnresolvedBlock({ block, isOpen, isAssigned, onToggle, onAssign, onDismiss }) {
  const suggested = SECTION_TARGETS.find((s) => s.key === block.suggested_section);

  return (
    <div className={`rounded-lg border transition-colors ${isAssigned ? "border-green-200 bg-green-50/40" : "border-amber-200 bg-white"}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start gap-2 px-3 py-2.5 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isAssigned
              ? <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
              : <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-0.5" />
            }
            <span className="text-xs font-semibold text-gray-700">{block.source}</span>
            {isAssigned && <span className="text-[10px] text-green-600 font-medium">Assegnato ✓</span>}
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5 ml-3.5 leading-snug">{block.reason}</p>
        </div>
        {isOpen
          ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
          : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
        }
      </button>

      {isOpen && (
        <div className="px-3 pb-3 border-t border-amber-100 space-y-2">
          <pre className="text-[11px] text-gray-700 whitespace-pre-wrap leading-relaxed font-sans mt-2 max-h-44 overflow-y-auto bg-gray-50 rounded p-2.5 border border-gray-100">
            {block.text}
          </pre>

          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 space-y-1.5">
              {suggested && !isAssigned && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400">Suggerito:</span>
                  <button
                    type="button"
                    onClick={() => onAssign(suggested.key)}
                    className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${suggested.bg} ${suggested.text} ${suggested.border} hover:opacity-75`}
                  >
                    → {suggested.label}
                  </button>
                </div>
              )}
              <SectionChips onAssign={onAssign} excludeKey={block.suggested_section} />
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="text-[10px] text-gray-400 hover:text-gray-600 flex-shrink-0 whitespace-nowrap pt-0.5"
            >
              Ignora
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Group B — Low-confidence block ───────────────────────────────────────────
function LowConfidenceBlock({ block, isOpen, isAssigned, onToggle, onAssign, onDismiss }) {
  const suggested = SECTION_TARGETS.find((s) => s.key === block.suggested_section);

  return (
    <div className={`rounded-lg border transition-colors ${isAssigned ? "border-green-200 bg-green-50/40" : "border-amber-200 bg-white"}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start gap-2 px-3 py-2.5 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isAssigned
              ? <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
              : <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            }
            <span className="text-xs font-semibold text-gray-700">
              Assegnato a:{" "}
              <span className={isAssigned ? "text-green-700" : "text-amber-700"}>
                {block.current_label}
              </span>
            </span>
            {isAssigned && <span className="text-[10px] text-green-600 font-medium">Riassegnato ✓</span>}
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5 ml-5 leading-snug line-clamp-2">{block.hint}</p>
        </div>
        {isOpen
          ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
          : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
        }
      </button>

      {isOpen && (
        <div className="px-3 pb-3 border-t border-amber-100 space-y-2">
          <div className="mt-2">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Testo sospetto
            </div>
            <pre className="text-[11px] text-amber-900 whitespace-pre-wrap leading-relaxed font-sans max-h-36 overflow-y-auto bg-amber-50 rounded p-2.5 border border-amber-200">
              {block.suspect_text}
            </pre>
          </div>

          <div className="flex items-start gap-2 flex-wrap">
            <button
              type="button"
              onClick={onDismiss}
              className="text-[11px] px-2.5 py-1 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 flex-shrink-0"
            >
              ✓ Va bene così
            </button>
            {suggested && (
              <button
                type="button"
                onClick={() => onAssign(suggested.key, block.suspect_text)}
                className={`text-[11px] px-2.5 py-1 rounded border font-medium flex-shrink-0 ${suggested.bg} ${suggested.text} ${suggested.border} hover:opacity-75`}
              >
                → Sposta in {suggested.label}
              </button>
            )}
          </div>
          <SectionChips
            onAssign={(key) => onAssign(key, block.suspect_text)}
            excludeKey={block.suggested_section}
          />
        </div>
      )}
    </div>
  );
}

// ── Group C — Therapy conflict block ─────────────────────────────────────────
function TherapyConflictBlock({ conflict, isOpen, isResolved, onToggle, onResolve }) {
  const { drug_name, source_dom, source_ind } = conflict;

  function fmtSource(s) {
    if (!s) return "—";
    return [s.dose, s.route, s.frequency].filter(Boolean).join("  ·  ") || "?";
  }

  return (
    <div className={`rounded-lg border transition-colors ${isResolved ? "border-green-200 bg-green-50/40" : "border-red-200 bg-white"}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start gap-2 px-3 py-2.5 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isResolved
              ? <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
              : <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
            }
            <span className="text-xs font-semibold text-gray-800">
              ⚠ Conflitto terapia: <span className="text-red-700">{drug_name}</span>
            </span>
            {isResolved && <span className="text-[10px] text-green-600 font-medium">Risolto ✓</span>}
          </div>
          {!isResolved && (
            <p className="text-[11px] text-gray-500 mt-0.5 ml-5 leading-snug">
              TERAPIE IN ATTO → <strong>{fmtSource(source_dom)}</strong>
              {"  vs  "}
              INDICAZIONI → <strong>{fmtSource(source_ind)}</strong>
            </p>
          )}
        </div>
        {isOpen
          ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
          : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
        }
      </button>

      {isOpen && (
        <div className="px-3 pb-3 border-t border-red-100 space-y-3">
          <div className="mt-2 grid grid-cols-2 gap-2">
            {/* Source A — DOM */}
            <div className="rounded border border-amber-200 bg-amber-50 p-2.5 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                TERAPIE IN ATTO
              </div>
              <div className="text-[11px] text-gray-700 space-y-0.5">
                {source_dom?.dose      && <div><span className="text-gray-400">Dose:</span> {source_dom.dose}</div>}
                {source_dom?.frequency && <div><span className="text-gray-400">Freq:</span> {source_dom.frequency}</div>}
                {source_dom?.route     && <div><span className="text-gray-400">Via:</span> {source_dom.route}</div>}
              </div>
              {source_dom?.source_fragment && (
                <p className="text-[10px] text-amber-800 italic leading-snug mt-1 line-clamp-2">
                  «{source_dom.source_fragment}»
                </p>
              )}
            </div>
            {/* Source B — IND */}
            <div className="rounded border border-blue-200 bg-blue-50 p-2.5 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                INDICAZIONI FINALI <span className="font-normal text-blue-500">(default)</span>
              </div>
              <div className="text-[11px] text-gray-700 space-y-0.5">
                {source_ind?.dose      && <div><span className="text-gray-400">Dose:</span> {source_ind.dose}</div>}
                {source_ind?.frequency && <div><span className="text-gray-400">Freq:</span> {source_ind.frequency}</div>}
                {source_ind?.route     && <div><span className="text-gray-400">Via:</span> {source_ind.route}</div>}
              </div>
              {source_ind?.source_fragment && (
                <p className="text-[10px] text-blue-800 italic leading-snug mt-1 line-clamp-2">
                  «{source_ind.source_fragment}»
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-gray-400 flex-shrink-0">Salva come:</span>
            <button
              type="button"
              onClick={() => onResolve("ind")}
              className="text-[11px] px-2.5 py-1 rounded border border-blue-300 bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100 flex-shrink-0"
            >
              ✓ Usa INDICAZIONI FINALI (ogni {source_ind?.frequency || "?"})
            </button>
            <button
              type="button"
              onClick={() => onResolve("dom")}
              className="text-[11px] px-2.5 py-1 rounded border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 flex-shrink-0"
            >
              Usa TERAPIE IN ATTO (ogni {source_dom?.frequency || "?"})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
/**
 * SectionReviewPanel
 *
 * Human-in-the-loop review step that appears between text parsing and the
 * full ExtractedReview when the parser detected clinically significant
 * ambiguities (_parse_review is non-null).
 *
 * Props:
 *   parseReview  { unresolved: [...], low_confidence: [...], therapy_conflicts: [...] }
 *   extracted    current extracted draft (read + write via onUpdate)
 *   onUpdate(newExtracted)  callback to update the extracted draft in parent
 */
export default function SectionReviewPanel({ parseReview, extracted, onUpdate }) {
  const allIds = [
    ...(parseReview.unresolved       || []).map((b) => b.id),
    ...(parseReview.low_confidence   || []).map((b) => b.id),
    ...(parseReview.therapy_conflicts || []).map((b) => b.id),
  ];

  const [dismissed, setDismissed] = useState(new Set());
  const [assigned,  setAssigned]  = useState(new Set());
  const [openIds,   setOpenIds]   = useState(new Set(allIds));

  function toggleOpen(id) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleAssign(blockId, sectionKey, text) {
    setAssigned((prev) => new Set([...prev, blockId]));
    if (sectionKey === "td") {
      onUpdate({
        ...extracted,
        profilo_generale: {
          ...(extracted.profilo_generale || {}),
          terapia_domiciliare: [
            extracted.profilo_generale?.terapia_domiciliare,
            text,
          ].filter(Boolean).join("\n\n"),
        },
      });
    } else {
      onUpdate({
        ...extracted,
        visit_sections: {
          ...(extracted.visit_sections || {}),
          [sectionKey]: [
            extracted.visit_sections?.[sectionKey],
            text,
          ].filter(Boolean).join("\n\n"),
        },
      });
    }
  }

  function handleDismiss(blockId) {
    setDismissed((prev) => new Set([...prev, blockId]));
  }

  function handleTherapyConflictResolve(conflict, choice) {
    setAssigned((prev) => new Set([...prev, conflict.id]));
    const source = choice === "dom" ? conflict.source_dom : conflict.source_ind;
    const updatedTherapies = (extracted.therapies || []).map((t) => {
      if ((t.drug_name || "").toLowerCase() !== conflict.drug_name.toLowerCase()) return t;
      return {
        ...t,
        dose:            source.dose            ?? t.dose,
        frequency:       source.frequency       ?? t.frequency,
        route:           source.route           ?? t.route,
        source_fragment: source.source_fragment ?? t.source_fragment,
      };
    });
    onUpdate({ ...extracted, therapies: updatedTherapies });
  }

  const visibleUnresolved      = (parseReview.unresolved       || []).filter((b) => !dismissed.has(b.id));
  const visibleLowConfidence   = (parseReview.low_confidence   || []).filter((b) => !dismissed.has(b.id));
  const visibleConflicts       = (parseReview.therapy_conflicts || []).filter((b) => !dismissed.has(b.id));
  const totalAll               = allIds.length;
  const totalProcessed         = assigned.size + dismissed.size;

  return (
    <div className="space-y-4">
      {/* Header banner */}
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-amber-200 bg-amber-50">
        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900 leading-snug">
          <strong>
            {totalAll} {totalAll === 1 ? "elemento" : "elementi"} da verificare
          </strong>
          {" — "}Il parser ha rilevato situazioni ambigue. Correggi dove necessario o salta tutto.
          {totalProcessed > 0 && (
            <span className="ml-2 text-[12px] text-amber-700">
              ({totalProcessed}/{totalAll} gestiti)
            </span>
          )}
        </div>
      </div>

      {/* Group C — Therapy conflicts (mostrato PRIMA di A/B — clinicamente critico) */}
      {visibleConflicts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-red-500 flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded-full bg-red-100 border border-red-300 text-red-700 text-[9px] flex items-center justify-center font-bold">C</span>
            Conflitti terapia ({visibleConflicts.length}) — richiesta scelta manuale
          </h4>
          {visibleConflicts.map((conflict) => (
            <TherapyConflictBlock
              key={conflict.id}
              conflict={conflict}
              isOpen={openIds.has(conflict.id)}
              isResolved={assigned.has(conflict.id)}
              onToggle={() => toggleOpen(conflict.id)}
              onResolve={(choice) => handleTherapyConflictResolve(conflict, choice)}
            />
          ))}
        </div>
      )}

      {/* Group A — Unresolved */}
      {visibleUnresolved.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded-full bg-amber-100 border border-amber-300 text-amber-700 text-[9px] flex items-center justify-center font-bold">A</span>
            Testo non assegnato ({visibleUnresolved.length})
          </h4>
          {visibleUnresolved.map((block) => (
            <UnresolvedBlock
              key={block.id}
              block={block}
              isOpen={openIds.has(block.id)}
              isAssigned={assigned.has(block.id)}
              onToggle={() => toggleOpen(block.id)}
              onAssign={(key) => handleAssign(block.id, key, block.text)}
              onDismiss={() => handleDismiss(block.id)}
            />
          ))}
        </div>
      )}

      {/* Group B — Low confidence */}
      {visibleLowConfidence.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded-full bg-amber-100 border border-amber-300 text-amber-700 text-[9px] flex items-center justify-center font-bold">B</span>
            Assegnazioni da verificare ({visibleLowConfidence.length})
          </h4>
          {visibleLowConfidence.map((block) => (
            <LowConfidenceBlock
              key={block.id}
              block={block}
              isOpen={openIds.has(block.id)}
              isAssigned={assigned.has(block.id)}
              onToggle={() => toggleOpen(block.id)}
              onAssign={(key, text) => handleAssign(block.id, key, text)}
              onDismiss={() => handleDismiss(block.id)}
            />
          ))}
        </div>
      )}

      {/* All handled */}
      {visibleConflicts.length === 0 && visibleUnresolved.length === 0 && visibleLowConfidence.length === 0 && totalProcessed > 0 && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-green-200 bg-green-50 text-sm text-green-800">
          <Check className="w-4 h-4 text-green-600" />
          Tutti gli elementi verificati. Premi <strong className="mx-1">Avanti</strong> per continuare.
        </div>
      )}
    </div>
  );
}
