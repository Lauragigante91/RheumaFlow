import React, { useState } from "react";
import { Check, Loader2, X, AlertTriangle, Calendar, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import { Button } from "../ui/button";
import VisitFacsimile from "./VisitFacsimile";
import { STATUS_META, LONGIT_STATUS, LONGIT_STATUS_META } from "../../lib/visitReconciler";

function fmtIso(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function VisitSidebarItem({ item, active, confirmed, onClick }) {
  const conflicts = item.stats?.conflicts || 0;
  const date = item.date || item.draft?.visit_date;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all flex flex-col gap-0.5 ${
        active
          ? "border-[#0A2540] bg-[#0A2540] text-white"
          : confirmed
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold">
        {confirmed && <Check className="w-3 h-3 text-emerald-600 flex-shrink-0" />}
        <Calendar className={`w-3 h-3 flex-shrink-0 ${active ? "text-teal-300" : confirmed ? "text-emerald-500" : "text-gray-400"}`} />
        {date ? fmtIso(date) : <span className="italic">data assente</span>}
      </span>
      <span className={`text-[10px] ${active ? "text-gray-300" : "text-gray-400"}`}>
        {item.visitType === "prima_visita" ? "Prima visita" : item.visitType === "workup" ? "Workup" : item.visitType === "teleconsulto" ? "Teleconsulto" : "Follow-up"}
        {item.stats?.toSave != null && <span> · {item.stats.toSave} elem.</span>}
      </span>
      {conflicts > 0 && (
        <span className="flex items-center gap-1 text-[9px] font-medium text-amber-700 bg-amber-100 border border-amber-200 rounded px-1 py-0.5 w-fit">
          <AlertTriangle className="w-2.5 h-2.5" /> {conflicts} conflitto{conflicts > 1 ? "i" : ""}
        </span>
      )}
      {confirmed && (
        <span className="text-[9px] font-medium text-emerald-700">Importata</span>
      )}
    </button>
  );
}

function ItemStatusLegend({ visitResults }) {
  const counts = {};
  for (const v of visitResults) {
    const d = v.draft;
    for (const item of [...(d.therapies || []), ...(d.assessments || []), ...(d.lab_exams || [])]) {
      if (item._status) counts[item._status] = (counts[item._status] || 0) + 1;
    }
  }
  const active = Object.entries(counts).filter(([, n]) => n > 0);
  if (active.length === 0) return null;
  const colorMap = {
    teal:   "bg-teal-50 text-teal-700 border-teal-200",
    gray:   "bg-gray-100 text-gray-500 border-gray-200",
    blue:   "bg-blue-50 text-blue-700 border-blue-200",
    red:    "bg-red-50 text-red-700 border-red-200",
    amber:  "bg-amber-50 text-amber-700 border-amber-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
  };
  return (
    <div className="flex flex-wrap gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50">
      {active.map(([status, n]) => {
        const meta = STATUS_META[status];
        if (!meta) return null;
        const cls = colorMap[meta.color] || "bg-gray-100 text-gray-500 border-gray-200";
        return (
          <span key={status} className="flex items-center gap-1">
            <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded border ${cls}`}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: meta.dot, display: "inline-block", flexShrink: 0 }} />
              {meta.label}
            </span>
            <span className="text-[10px] text-gray-500">×{n}</span>
          </span>
        );
      })}
    </div>
  );
}

function hasWarning(item) {
  if ((item.stats?.conflicts || 0) > 0) return true;
  if ((item.draft?.lab_review_items?.length || 0) > 0) return true;
  if ((item.draft?._parse_review?.unresolved?.length || 0) > 0) return true;
  return false;
}

const FIELD_LABEL_IT = {
  diagnosi:            "Diagnosi",
  anamnesi_fisiologica:"Anamnesi fisiologica",
  anamnesi_familiare:  "Anamnesi familiare",
  comorbidita_apr:     "Comorbidità",
  allergie_testo:      "Allergie / Intolleranze",
  terapia_domiciliare: "Terapia domiciliare",
};

const LONGIT_COLOR = {
  gray:  { bg: "bg-gray-50",   border: "border-gray-200",  text: "text-gray-600",  badge: "bg-gray-100 text-gray-500 border-gray-200"  },
  teal:  { bg: "bg-teal-50",   border: "border-teal-200",  text: "text-teal-700",  badge: "bg-teal-50 text-teal-700 border-teal-200"   },
  red:   { bg: "bg-red-50",    border: "border-red-200",   text: "text-red-700",   badge: "bg-red-50 text-red-700 border-red-200"       },
  amber: { bg: "bg-amber-50",  border: "border-amber-200", text: "text-amber-700", badge: "bg-amber-50 text-amber-700 border-amber-200" },
};

function LongitudinalFieldsPanel({ longitudinal, onToggle }) {
  const [open, setOpen] = useState(true);
  if (!Array.isArray(longitudinal) || longitudinal.length === 0) return null;
  const nonInvariato = longitudinal.filter(f => f.status !== LONGIT_STATUS.INVARIATO);
  if (nonInvariato.length === 0) return null;

  return (
    <div className="border-b border-gray-200 bg-white flex-shrink-0">
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <ArrowRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <span className="text-xs font-semibold text-gray-700">
          Confronto longitudinale — {nonInvariato.length} campo{nonInvariato.length !== 1 ? "i" : ""} da verificare
        </span>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 ml-auto" />
          : <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-auto" />}
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-2">
          {nonInvariato.map(f => {
            const meta  = LONGIT_STATUS_META[f.status] || {};
            const clr   = LONGIT_COLOR[meta.color] || LONGIT_COLOR.gray;
            const skipped = f._skip;
            return (
              <div key={f.key} className={`rounded-lg border ${clr.border} ${skipped ? "opacity-50" : ""}`}>
                <div className={`px-3 py-2 rounded-t-lg flex items-center gap-2 ${clr.bg}`}>
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${clr.text}`}>{f.label}</span>
                  <span className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded border ml-1 ${clr.badge}`}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: meta.dot, display: "inline-block", flexShrink: 0 }} />
                    {meta.label}
                  </span>
                  <div className="ml-auto flex gap-1">
                    {f.status !== LONGIT_STATUS.INVARIATO && (
                      <>
                        <button
                          type="button"
                          onClick={() => onToggle(f.key, true)}
                          className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${skipped ? "border-gray-300 bg-gray-100 text-gray-700 font-semibold" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"}`}
                        >
                          Ignora
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggle(f.key, false)}
                          className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${!skipped ? "border-teal-400 bg-teal-50 text-teal-700 font-semibold" : "border-gray-200 bg-white text-gray-500 hover:border-teal-200"}`}
                        >
                          {f.status === LONGIT_STATUS.NUOVO_DATO ? "Aggiungi" : "Conferma"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-0 divide-x divide-gray-200">
                  <div className="px-3 py-2">
                    <div className="text-[9px] text-gray-400 mb-1 font-semibold uppercase tracking-wider">Precedente</div>
                    <pre className="text-[11px] text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">
                      {f.previous || <span className="italic text-gray-300">nessun dato</span>}
                    </pre>
                  </div>
                  <div className="px-3 py-2">
                    <div className="text-[9px] text-gray-400 mb-1 font-semibold uppercase tracking-wider">Estratto</div>
                    <pre className="text-[11px] text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">{f.current}</pre>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BatchFieldConflictsPanel({ conflicts, overrides, onFieldOverride }) {
  const [open, setOpen] = useState(true);
  if (!conflicts || conflicts.length === 0) return null;
  return (
    <div className="px-4 py-2 border-b border-amber-200 bg-amber-50 flex-shrink-0">
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left"
        onClick={() => setOpen(v => !v)}
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
        <span className="text-xs font-semibold text-amber-800">
          {conflicts.length} campo{conflicts.length !== 1 ? " in conflitto" : " in conflitto"} tra le visite — scegli quale valore salvare
        </span>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-amber-500 ml-auto" />
          : <ChevronDown className="w-3.5 h-3.5 text-amber-500 ml-auto" />}
      </button>
      {open && (
        <div className="mt-2 space-y-3">
          {conflicts.map((c) => {
            const activeVal = overrides?.[c.field] !== undefined ? overrides[c.field] : c.selected.value;
            const allOptions = [c.selected, ...c.conflicts];
            return (
              <div key={c.field} className="rounded-lg border border-amber-200 bg-white p-2.5 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                  {FIELD_LABEL_IT[c.field] || c.field}
                </span>
                <div className={`grid gap-2 ${allOptions.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {allOptions.map((opt, oi) => {
                    const isActive = activeVal === opt.value;
                    return (
                      <div
                        key={oi}
                        role="button"
                        tabIndex={0}
                        onClick={() => onFieldOverride(c.field, opt.value)}
                        onKeyDown={(e) => e.key === "Enter" && onFieldOverride(c.field, opt.value)}
                        className={`rounded p-2 text-xs cursor-pointer border transition-all ${
                          isActive
                            ? "border-teal-400 bg-teal-50 ring-1 ring-teal-400"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <div className="text-[9px] font-semibold text-gray-400 mb-1 flex items-center gap-1">
                          {oi === 0 ? "Proposta dal sistema" : "Alternativa"}
                          {opt.source_visit_date && <span className="text-gray-300">· {opt.source_visit_date}</span>}
                          {isActive && <span className="text-teal-600 ml-1">selezionata</span>}
                        </div>
                        <pre className="whitespace-pre-wrap font-sans text-gray-700 text-[11px] leading-relaxed">{opt.value}</pre>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ImportReviewScreen({
  visitResults,
  onUpdate,
  onConfirmOne,
  onConfirmAll,
  onCancel,
  applying,
  applyProgress,
  batchFieldConflicts,
  fieldOverrides,
  onFieldOverride,
  onLongitudinalToggle,
}) {
  const isMulti = visitResults.length > 1;
  const [currentIdx, setCurrentIdx] = useState(0);
  const [confirmingIdx, setConfirmingIdx] = useState(null);

  const sortedOrder = [...visitResults]
    .map((v, i) => ({ v, i }))
    .sort((a, b) => {
      const da = a.v.date || a.v.draft?.visit_date || "";
      const db = b.v.date || b.v.draft?.visit_date || "";
      return da.localeCompare(db);
    })
    .map(({ i }) => i);

  const current = visitResults[currentIdx];
  if (!current) return null;

  const allConfirmed = visitResults.every(v => !!v._confirmed);
  const confirmedCount = visitResults.filter(v => !!v._confirmed).length;
  const pendingCount   = visitResults.length - confirmedCount;
  const warnFreeCount  = visitResults.filter(v => !v._confirmed && !hasWarning(v)).length;

  const handleConfirmOne = async (idx) => {
    setConfirmingIdx(idx);
    try {
      await onConfirmOne(idx);
      const nextPending = visitResults.findIndex((v, i) => i !== idx && !v._confirmed && i > idx);
      if (nextPending !== -1) setCurrentIdx(nextPending);
      else {
        const anyPending = visitResults.findIndex((v, i) => !v._confirmed && i !== idx);
        if (anyPending !== -1) setCurrentIdx(anyPending);
      }
    } finally {
      setConfirmingIdx(null);
    }
  };

  const handleConfirmAll = async () => {
    try {
      await onConfirmAll();
    } catch (_) {}
  };

  const updateCurrentDraft = (draft) => {
    const updated = [...visitResults];
    updated[currentIdx] = { ...updated[currentIdx], draft };
    onUpdate(updated);
  };

  const isConfirmingCurrent = confirmingIdx === currentIdx;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onCancel}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors px-2 py-1 rounded hover:bg-gray-100">
            <X className="w-3.5 h-3.5" /> Annulla
          </button>
          <div className="h-4 w-px bg-gray-200" />
          <h2 className="text-sm font-bold text-[#0A2540]">
            {isMulti
              ? `Revisione import — ${visitResults.length} visite`
              : "Revisione import"}
          </h2>
          {isMulti && (
            <span className="text-xs text-gray-400">
              {confirmedCount > 0 && `${confirmedCount} importate · `}{pendingCount} da confermare
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isMulti ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleConfirmOne(currentIdx)}
                disabled={applying || isConfirmingCurrent || !!current._confirmed}
                className="text-xs"
              >
                {isConfirmingCurrent
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Importazione...</>
                  : current._confirmed
                  ? <><Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Importata</>
                  : <><Check className="w-3.5 h-3.5 mr-1.5" /> Conferma visita</>}
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmAll}
                disabled={applying || allConfirmed || warnFreeCount === 0}
                className="bg-[#0A2540] hover:bg-[#051626] text-white text-xs"
              >
                {applying
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    {applyProgress ? `${applyProgress.current}/${applyProgress.total}` : "Importazione..."}
                    </>
                  : <><Check className="w-3.5 h-3.5 mr-1.5" /> Conferma tutte senza warning ({warnFreeCount})</>}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => handleConfirmOne(0)}
              disabled={applying || isConfirmingCurrent || !!visitResults[0]?._confirmed}
              className="bg-[#0A2540] hover:bg-[#051626] text-white text-xs"
            >
              {isConfirmingCurrent
                ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Salvataggio...</>
                : visitResults[0]?._confirmed
                ? <><Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> Importata</>
                : <><Check className="w-3.5 h-3.5 mr-1.5" /> Conferma importazione</>}
            </Button>
          )}
        </div>
      </div>

      {isMulti && visitResults.length > 1 && (
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          <ItemStatusLegend visitResults={visitResults} />
        </div>
      )}

      {isMulti && (
        <BatchFieldConflictsPanel
          conflicts={batchFieldConflicts}
          overrides={fieldOverrides}
          onFieldOverride={onFieldOverride}
        />
      )}

      <div className="flex flex-1 min-h-0">
        {isMulti && (
          <div className="w-52 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col">
            <div className="px-3 py-2 border-b border-gray-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Visite</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {[...visitResults]
                .map((v, i) => ({ v, i }))
                .sort((a, b) => {
                  const da = a.v.date || a.v.draft?.visit_date || "";
                  const db = b.v.date || b.v.draft?.visit_date || "";
                  return da.localeCompare(db);
                })
                .map(({ v, i }) => (
                  <VisitSidebarItem
                    key={v.id ?? i}
                    item={v}
                    active={i === currentIdx}
                    confirmed={!!v._confirmed}
                    onClick={() => setCurrentIdx(i)}
                  />
                ))}
            </div>
            <div className="px-2 py-2 border-t border-gray-200 flex gap-1">
              <button type="button"
                onClick={() => {
                  const pos = sortedOrder.indexOf(currentIdx);
                  if (pos > 0) setCurrentIdx(sortedOrder[pos - 1]);
                }}
                disabled={sortedOrder.indexOf(currentIdx) === 0}
                className="flex-1 flex items-center justify-center py-1 rounded border border-gray-200 bg-white text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button type="button"
                onClick={() => {
                  const pos = sortedOrder.indexOf(currentIdx);
                  if (pos < sortedOrder.length - 1) setCurrentIdx(sortedOrder[pos + 1]);
                }}
                disabled={sortedOrder.indexOf(currentIdx) === sortedOrder.length - 1}
                className="flex-1 flex items-center justify-center py-1 rounded border border-gray-200 bg-white text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-1 min-h-0 min-w-0">
          <div className="flex-1 min-w-0 overflow-y-auto border-r border-gray-200 bg-gray-50">
            <div className="px-3 py-2 border-b border-gray-200 bg-white flex-shrink-0 sticky top-0 z-10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Testo originale</span>
            </div>
            <div className="px-4 py-4">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-mono break-words">
                {current.sourceText || "(testo non disponibile)"}
              </pre>
            </div>
          </div>

          <div className="flex-1 min-w-0 overflow-y-auto bg-white flex flex-col">
            <div className="px-3 py-2 border-b border-gray-200 bg-white flex-shrink-0 sticky top-0 z-10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Dati strutturati</span>
            </div>
            <LongitudinalFieldsPanel
              longitudinal={current.draft?._longitudinal}
              onToggle={(fieldKey, skip) => onLongitudinalToggle?.(currentIdx, fieldKey, skip)}
            />
            <div className="px-4 py-4">
              <VisitFacsimile
                draft={current.draft}
                onUpdate={updateCurrentDraft}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
