/**
 * SelectionActionMenu
 *
 * A compact floating vertical menu that appears when the physician selects text.
 * Shared between SelectableTextArea (editable) and SelectableText (read-only).
 *
 * Renders via a React portal directly on document.body using position:fixed so
 * it is never clipped by ancestor overflow:hidden containers.
 *
 * Actions are split into two groups separated by a divider:
 *   group: "save"   → "Salva selezione come…"
 *   group: "insert" → "Inserisci in…"
 *
 * Special action type "section_picker":
 *   Instead of a single row, renders an inline chip grid of destination sections.
 *   The action must have:
 *     { key, type: "section_picker", label, sections: [{key, label, color}], handler(sectionKey) }
 *
 * Props:
 *   actions  [{ key, label, icon, color, bg, group, type?, sections?, handler, enabled? }]
 *   onClose  () => void
 *   style    object  — position overrides using fixed coords: { top, left } or { top, right }
 */

import React from "react";
import ReactDOM from "react-dom";

export default function SelectionActionMenu({ actions = [], onClose, style }) {
  const visible       = actions.filter(a => a.enabled !== false);
  const saveGroup     = visible.filter(a => a.group === "save");
  const insertGroup   = visible.filter(a => a.group === "insert");
  const archiveGroup  = visible.filter(a => a.group === "archive");
  const otherGroup    = visible.filter(a => !["save","insert","archive"].includes(a.group));

  if (!visible.length) return null;

  const allSave = [...saveGroup, ...otherGroup];

  const menu = (
    <div
      className="sam-portal"
      style={{
        position: "fixed",
        zIndex: 99999,
        background: "#fff",
        border: "1.5px solid #e5e7eb",
        borderRadius: "10px",
        boxShadow: "0 8px 28px rgba(0,0,0,0.15)",
        overflow: "hidden",
        minWidth: "270px",
        maxWidth: "340px",
        animation: "sam-fadein 0.12s ease",
        ...style,
      }}
      onMouseDown={e => e.preventDefault()}
    >
      {/* ── Save group ─────────────────────────────────────────────────── */}
      {allSave.length > 0 && (
        <>
          <GroupHeader>Salva selezione come…</GroupHeader>
          {allSave.map((action, i) => (
            <ActionRow key={action.key} action={action} onClose={onClose} sep={i > 0} />
          ))}
        </>
      )}

      {/* ── Divider ─────────────────────────────────────────────────────── */}
      {allSave.length > 0 && insertGroup.length > 0 && (
        <div style={{ height: "1px", background: "#f3f4f6", margin: "2px 0" }} />
      )}

      {/* ── Insert group ────────────────────────────────────────────────── */}
      {insertGroup.length > 0 && (
        <>
          <GroupHeader>Inserisci in…</GroupHeader>
          {insertGroup.map((action) =>
            action.type === "section_picker"
              ? <SectionPickerRow key={action.key} action={action} onClose={onClose} />
              : <ActionRow key={action.key} action={action} onClose={onClose} sep={false} />
          )}
        </>
      )}

      {/* ── Divider ─────────────────────────────────────────────────────── */}
      {(allSave.length > 0 || insertGroup.length > 0) && archiveGroup.length > 0 && (
        <div style={{ height: "1px", background: "#f3f4f6", margin: "2px 0" }} />
      )}

      {/* ── Archive group ────────────────────────────────────────────────── */}
      {archiveGroup.length > 0 && (
        <>
          <GroupHeader>Archivia in…</GroupHeader>
          {archiveGroup.map((action, i) => (
            <ActionRow key={action.key} action={action} onClose={onClose} sep={i > 0} />
          ))}
        </>
      )}

      <style>{`
        @keyframes sam-fadein {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </div>
  );

  return ReactDOM.createPortal(menu, document.body);
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function GroupHeader({ children }) {
  return (
    <div style={{
      padding: "5px 10px 3px",
      fontSize: "9px", fontWeight: 700, color: "#9ca3af",
      textTransform: "uppercase", letterSpacing: "0.1em",
      userSelect: "none",
    }}>
      {children}
    </div>
  );
}

function ActionRow({ action, onClose, sep }) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      onClick={() => { action.handler(); onClose?.(); }}
      style={{
        display: "flex", alignItems: "center", gap: "8px",
        width: "100%", padding: "7px 10px",
        background: "#fff", border: "none",
        borderTop: sep ? "1px solid #f9fafb" : "none",
        cursor: "pointer", textAlign: "left",
        transition: "background 0.08s",
        color: "#374151", fontSize: "12px",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = action.bg || "#f9fafb";
        e.currentTarget.style.color = action.color || "#374151";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "#fff";
        e.currentTarget.style.color = "#374151";
      }}
    >
      <div style={{
        width: "22px", height: "22px",
        borderRadius: "5px",
        background: action.bg || "#f9fafb",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {Icon && <Icon size={11} color={action.color || "#6b7280"} />}
      </div>
      <span style={{ flex: 1, lineHeight: 1.3 }}>{action.label}</span>
    </button>
  );
}

/**
 * SectionPickerRow
 *
 * Renders an inline chip grid of destination sections.
 * Used when action.type === "section_picker".
 * Clicking a chip calls action.handler(sectionKey) and closes the menu.
 */
function SectionPickerRow({ action, onClose }) {
  return (
    <div style={{ padding: "5px 10px 10px" }}>
      <div style={{
        fontSize: "10px", color: "#6b7280", marginBottom: "6px", lineHeight: 1.3,
      }}>
        {action.label}:
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
        {(action.sections || []).map(sec => (
          <button
            key={sec.key}
            type="button"
            onClick={() => {
              action.handler(sec.key);
              onClose?.();
            }}
            style={{
              padding: "3px 9px",
              borderRadius: "999px",
              border: `1.5px solid ${sec.color || "#d1d5db"}`,
              background: "#fff",
              color: sec.color || "#374151",
              fontSize: "10px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.1s",
              lineHeight: 1.4,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = sec.color || "#374151";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "#fff";
              e.currentTarget.style.color = sec.color || "#374151";
            }}
          >
            {sec.label}
          </button>
        ))}
      </div>
    </div>
  );
}
