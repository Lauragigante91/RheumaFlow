import React, { useState, useMemo } from "react";
import { AlertCircle, Check, X, Edit3, ChevronDown, ChevronRight, CheckCheck } from "lucide-react";

/**
 * LabValueReviewPanel
 *
 * Mostra i valori che il parser ha segnalato come low-confidence (unità non
 * specificata per un parametro ad alto rischio). Per ridurre l'alert fatigue i
 * valori sono raggruppati per parametro: invece di una card per ogni valore, un
 * gruppo per tipo (es. "PCR — 15 valori") con accettazione in blocco.
 *
 * Strategia di sicurezza:
 *   - Parametri routinari (in trustedUnits) → unità assunta nota, gruppo
 *     collassato, accettabile in un click.
 *   - Parametri non in whitelist (es. proteinuria) → "verifica attenta",
 *     gruppo espanso, pensato per la revisione manuale dei casi ambigui.
 *
 * Props:
 *   items         Array<lab_review_item>           — da extracted.lab_review_items
 *   trustedUnits  Record<key, unit>                — whitelist unità predefinite
 *   onConfirm     (item, { value?, unit? }) → void — sposta un item in lab_exams
 *   onConfirmMany (items[])                  → void — sposta in blocco in lab_exams
 *   onIgnore      (item)                     → void — scarta un item
 */
export default function LabValueReviewPanel({ items, trustedUnits = {}, onConfirm, onConfirmMany, onIgnore }) {
  const groups = useMemo(() => {
    const m = new Map();
    for (const it of items || []) {
      if (!m.has(it.key)) m.set(it.key, { key: it.key, label: it.label, items: [] });
      m.get(it.key).items.push(it);
    }
    return [...m.values()]
      .map(g => ({
        ...g,
        trustedUnit: trustedUnits[g.key] || null,
        isRoutine:   Object.prototype.hasOwnProperty.call(trustedUnits, g.key),
      }))
      .sort((a, b) => {
        if (a.isRoutine !== b.isRoutine) return a.isRoutine ? 1 : -1;
        return b.items.length - a.items.length;
      });
  }, [items, trustedUnits]);

  if (!items || items.length === 0) return null;

  const total = items.length;

  function acceptAll() {
    if (onConfirmMany) onConfirmMany(items);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-orange-700">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          Da revisionare — {total} {total === 1 ? "valore" : "valori"} in {groups.length} {groups.length === 1 ? "parametro" : "parametri"}
        </div>
        {onConfirmMany && (
          <button
            type="button"
            onClick={acceptAll}
            className="text-[11px] px-2.5 py-1 rounded bg-orange-600 text-white hover:bg-orange-700 font-semibold flex items-center gap-1 flex-shrink-0"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Accetta tutto ({total})
          </button>
        )}
      </div>

      <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-[11px] text-orange-900 leading-snug">
        Valori con <strong>unità di misura non specificata</strong> nel testo. Per i parametri
        routinari l'unità assunta è quella standard di laboratorio: puoi accettarli in blocco.
        Per i parametri <strong>ambigui</strong> (espansi) verifica prima di accettare.
        Regola: meglio nessun dato che un dato clinicamente falso.
      </div>

      {groups.map(g => (
        <LabReviewGroup
          key={g.key}
          group={g}
          onConfirm={onConfirm}
          onConfirmMany={onConfirmMany}
          onIgnore={onIgnore}
        />
      ))}
    </div>
  );
}

// ── Gruppo per parametro ────────────────────────────────────────────────────────
function LabReviewGroup({ group, onConfirm, onConfirmMany, onIgnore }) {
  const { label, items, trustedUnit, isRoutine } = group;
  const [open, setOpen] = useState(!isRoutine);
  const n = items.length;

  function acceptGroup() {
    if (onConfirmMany) onConfirmMany(items);
  }

  return (
    <div className={`rounded-lg border overflow-hidden ${isRoutine ? "border-orange-200 bg-white" : "border-amber-400 bg-amber-50"}`}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          {open
            ? <ChevronDown  className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          }
          <span className="text-xs font-semibold text-gray-800 truncate">{label}</span>
          <span className="text-[11px] text-orange-700 font-medium flex-shrink-0">
            {n} {n === 1 ? "valore" : "valori"} da verificare
          </span>
          {trustedUnit && (
            <span className="px-1.5 py-0 bg-orange-100 text-orange-700 rounded text-[9px] font-semibold flex-shrink-0">
              unità assunta {trustedUnit}
            </span>
          )}
          {!isRoutine && (
            <span className="px-1.5 py-0 bg-amber-200 text-amber-800 rounded text-[9px] font-semibold flex-shrink-0">
              verifica attenta
            </span>
          )}
        </button>
        {onConfirmMany && (
          <button
            type="button"
            onClick={acceptGroup}
            className="text-[11px] px-2.5 py-1 rounded border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 font-medium flex items-center gap-1 flex-shrink-0"
          >
            <Check className="w-3 h-3" />
            Accetta tutti ({n})
          </button>
        )}
      </div>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-orange-100">
          {items.map((item, i) => (
            <LabReviewItem
              key={`${item.key}_${item.date}_${i}`}
              item={item}
              onConfirm={onConfirm}
              onIgnore={onIgnore}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Singolo valore ──────────────────────────────────────────────────────────────
function LabReviewItem({ item, onConfirm, onIgnore }) {
  const [editing,   setEditing]   = useState(false);
  const [editValue, setEditValue] = useState(item.proposed_value != null ? String(item.proposed_value) : "");
  const [editUnit,  setEditUnit]  = useState(item.proposed_unit  || "");
  const [done,      setDone]      = useState(null);

  const hasValue = item.proposed_value != null;
  const hasQual  = !!item.qualitative;

  function handleConfirmAsIs() {
    setDone("confirmed");
    onConfirm(item, {});
  }

  function handleConfirmManual() {
    const v = editValue.trim();
    const u = editUnit.trim();
    if (!v && !hasQual) return;
    setDone("confirmed");
    onConfirm(item, {
      value: v ? parseFloat(v.replace(",", ".")) : undefined,
      unit:  u || undefined,
    });
  }

  function handleIgnore() {
    setDone("ignored");
    onIgnore(item);
  }

  if (done) {
    return (
      <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] ${done === "confirmed" ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-400"}`}>
        {done === "confirmed"
          ? <Check className="w-3.5 h-3.5 flex-shrink-0" />
          : <X    className="w-3.5 h-3.5 flex-shrink-0" />
        }
        <span className="font-medium">{item.label}</span>
        {item.date && <span className="text-[10px]">· {item.date}</span>}
        <span className="text-[10px]">{done === "confirmed" ? "Confermato" : "Ignorato"}</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-orange-200 bg-white px-3 py-2 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        {item.date && (
          <span className="text-[10px] text-gray-400 font-medium">{item.date}</span>
        )}
        {(hasValue || hasQual) && (
          <span className="text-[11px] text-orange-700">
            {hasValue ? `${item.proposed_value} ${item.proposed_unit || ""}` : item.qualitative}
            {item.inferred_unit && (
              <span className="ml-1 px-1 py-0 bg-orange-100 text-orange-600 rounded text-[9px] font-semibold">unità inferita</span>
            )}
          </span>
        )}
      </div>

      {item.source_text && (
        <pre className="text-[11px] text-orange-900 whitespace-pre-wrap leading-relaxed font-sans bg-orange-50 rounded p-2 border border-orange-200">
          {item.source_text}
        </pre>
      )}

      {item.review_reason && (
        <div className="text-[11px] text-orange-700 leading-snug">
          <span className="font-semibold">Motivo: </span>{item.review_reason}
        </div>
      )}

      {editing && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Inserisci il valore corretto
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              placeholder="es. 0.07"
              className="w-24 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-400"
            />
            <input
              type="text"
              value={editUnit}
              onChange={e => setEditUnit(e.target.value)}
              placeholder={item.proposed_unit || "unità"}
              className="w-24 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-400"
            />
            <button
              type="button"
              onClick={handleConfirmManual}
              className="text-[11px] px-2.5 py-1 rounded bg-teal-600 text-white hover:bg-teal-700 font-medium"
            >
              ✓ Salva
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-[11px] px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {!editing && (
        <div className="flex items-center gap-2 flex-wrap pt-0.5">
          {(hasValue || hasQual) && (
            <button
              type="button"
              onClick={handleConfirmAsIs}
              className="text-[11px] px-2.5 py-1 rounded border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 font-medium"
            >
              ✓ Conferma valore proposto
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[11px] px-2.5 py-1 rounded border border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100 flex items-center gap-1"
          >
            <Edit3 className="w-3 h-3" />
            Inserisci manualmente
          </button>
          <button
            type="button"
            onClick={handleIgnore}
            className="text-[11px] px-2.5 py-1 rounded border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
          >
            <X className="w-3 h-3 inline mr-0.5" />
            Ignora
          </button>
        </div>
      )}
    </div>
  );
}
