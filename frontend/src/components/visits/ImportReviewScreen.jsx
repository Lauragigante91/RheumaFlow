import React, { useState } from "react";
import { Check, Loader2, X, AlertTriangle, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import VisitFacsimile from "./VisitFacsimile";
import { STATUS_META } from "../../lib/visitReconciler";

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

export default function ImportReviewScreen({
  visitResults,
  onUpdate,
  onConfirmOne,
  onConfirmAll,
  onCancel,
  applying,
  applyProgress,
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

          <div className="flex-1 min-w-0 overflow-y-auto bg-white">
            <div className="px-3 py-2 border-b border-gray-200 bg-white flex-shrink-0 sticky top-0 z-10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Dati strutturati</span>
            </div>
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
