/**
 * PatientDataImportPanel
 *
 * Collapsible panel placed above the workup visit form.
 * Loads stable patient data (comorbidities, concomitant therapies, allergies,
 * frailty factors, domiciliary therapies from first visit) and lets the physician
 * click "Inserisci nel referto →" next to any block to choose the destination section.
 *
 * Props:
 *   patient          object  — full patient object (for patient.note)
 *   firstVisit       object  — diseaseProfile document for "prima_visita"
 *   patientId        string
 *   insertSections   [{key, label, color}]  — destination sections to choose from
 *   onImportToSection(text: string, sectionKey: string) => void
 */

import React, { useState, useEffect } from "react";
import { diseaseProfileApi } from "../../lib/api";
import { ArrowDownToLine, ChevronDown, ChevronUp, ArrowRight, X } from "lucide-react";
import { toast } from "sonner";

// ─── Label maps (mirror ComorbiditiesSection) ─────────────────────────────────

const THERAPY_CATEGORY_LABELS = {
  cardiovascular_drugs:  "Farmaci cardiovascolari",
  anticoagulants:        "Anticoagulanti / Antiaggreganti",
  diabetes_metabolic:    "Farmaci per diabete / metabolismo",
  gastroprotective:      "Gastroprotettori",
  psychiatric_drugs:     "Farmaci psichiatrici",
  respiratory_drugs:     "Farmaci respiratori",
  neurologic_drugs:      "Farmaci neurologici",
  oncologic_therapies:   "Terapie oncologiche",
  hormonal:              "Terapie ormonali",
  supplements:           "Integratori / Altro",
};

// ─── Data formatters ──────────────────────────────────────────────────────────

function formatComorbidities(data) {
  const allItems = Object.values(data?.comorbidities || {})
    .flat()
    .filter((item) => {
      // exclude allergies — shown in their own block
      const allergyItems = data?.comorbidities?.allergologic || [];
      return !allergyItems.includes(item);
    });
  const parts = [];
  if (allItems.length) {
    parts.push("Comorbidità: " + allItems.join(", ") + ".");
  }
  if (data?.comorbidity_notes?.trim()) {
    parts.push("Note: " + data.comorbidity_notes.trim());
  }
  return parts.join("\n") || null;
}

function formatTherapies(data) {
  const therapies = data?.therapies || {};
  const entries = Object.entries(therapies);
  if (!entries.length && !data?.therapy_notes?.trim() && !data?.previous_therapy_notes?.trim()) {
    return null;
  }
  const lines = entries.map(([key, val]) => {
    const label = THERAPY_CATEGORY_LABELS[key] || key;
    return "  • " + (val?.trim() ? `${label}: ${val.trim()}` : label);
  });
  const parts = [];
  if (lines.length) parts.push("Terapie concomitanti:\n" + lines.join("\n"));
  if (data?.therapy_notes?.trim()) parts.push("Note terapeutiche: " + data.therapy_notes.trim());
  if (data?.previous_therapy_notes?.trim()) parts.push("Terapie pregresse: " + data.previous_therapy_notes.trim());
  return parts.join("\n") || null;
}

function formatAllergies(data) {
  const items = data?.comorbidities?.allergologic || [];
  if (!items.length) return null;
  return "Allergie note: " + items.join(", ") + ".";
}

function formatFrailty(data) {
  const items = data?.frailty || [];
  if (!items.length) return null;
  return "Fattori di fragilità: " + items.join(", ") + ".";
}

// ─── Section-chip picker ──────────────────────────────────────────────────────

function SectionChipPicker({ sections, onPick, onCancel }) {
  return (
    <div>
      <div style={{
        fontSize: "10px", color: "#9ca3af", marginBottom: "5px", userSelect: "none",
      }}>
        Scegli la sezione di destinazione:
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
        {sections.map(sec => (
          <button
            key={sec.key}
            type="button"
            onClick={() => onPick(sec.key, sec.label)}
            style={{
              padding: "3px 10px",
              borderRadius: "999px",
              border: `1.5px solid ${sec.color}`,
              background: "#fff",
              color: sec.color,
              fontSize: "10px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.1s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = sec.color;
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "#fff";
              e.currentTarget.style.color = sec.color;
            }}
          >
            {sec.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onCancel}
        style={{
          marginTop: "5px", fontSize: "10px", color: "#9ca3af",
          background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: "3px",
        }}
      >
        <X size={10} /> Annulla
      </button>
    </div>
  );
}

// ─── Single data block ────────────────────────────────────────────────────────

function DataBlock({ title, text, sections, onImport }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  if (!text?.trim()) return null;

  const preview = text.length > 220 ? text.slice(0, 220) + "…" : text;

  return (
    <div style={{
      borderRadius: "8px",
      border: "1px solid #e5e7eb",
      padding: "10px 12px",
      background: "#fff",
    }}>
      <div style={{
        fontSize: "9px", fontWeight: 700, color: "#9ca3af",
        textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "5px",
      }}>
        {title}
      </div>
      <div style={{
        fontSize: "12px", color: "#374151", lineHeight: "1.55",
        whiteSpace: "pre-wrap", fontFamily: "inherit",
      }}>
        {preview}
      </div>

      <div style={{ marginTop: "9px" }}>
        {!pickerOpen ? (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              padding: "4px 10px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              background: "#f9fafb",
              color: "#374151",
              fontSize: "11px", fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.1s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "#0284c7";
              e.currentTarget.style.color = "#fff";
              e.currentTarget.style.borderColor = "#0284c7";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "#f9fafb";
              e.currentTarget.style.color = "#374151";
              e.currentTarget.style.borderColor = "#d1d5db";
            }}
          >
            <ArrowDownToLine size={11} />
            Inserisci nel referto
            <ArrowRight size={11} />
          </button>
        ) : (
          <SectionChipPicker
            sections={sections}
            onPick={(key, label) => {
              onImport(text, key);
              toast.success(`Importato in: ${label}`);
              setPickerOpen(false);
            }}
            onCancel={() => setPickerOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PatientDataImportPanel({
  patient,
  firstVisit,
  patientId,
  insertSections,
  onImportToSection,
}) {
  const [open,      setOpen]      = useState(false);
  const [comorbData,setComorbData]= useState(null);
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    if (open && comorbData === null && patientId) {
      setLoading(true);
      diseaseProfileApi.get(patientId, "comorbidities")
        .then(doc => setComorbData(doc?.data || {}))
        .catch(() => setComorbData({}))
        .finally(() => setLoading(false));
    }
  }, [open, comorbData, patientId]);

  const comorbText  = comorbData ? formatComorbidities(comorbData) : null;
  const therapyText = comorbData ? formatTherapies(comorbData)     : null;
  const allergyText = comorbData ? formatAllergies(comorbData)     : null;
  const frailtyText = comorbData ? formatFrailty(comorbData)       : null;
  const domTherapy  = firstVisit?.data?.current_therapies_text     || null;
  const patientNote = patient?.note                                 || null;

  const blockCount = [comorbText, therapyText, allergyText, frailtyText, domTherapy, patientNote]
    .filter(Boolean).length;

  return (
    <div style={{
      borderRadius: "10px",
      border: "1.5px solid #bfdbfe",
      overflow: "hidden",
    }}>
      {/* ── Header / toggle ───────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: "10px",
          padding: "10px 14px",
          background: open ? "#eff6ff" : "#f0f9ff",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          transition: "background 0.1s",
        }}
      >
        <ArrowDownToLine size={14} color="#0284c7" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#0284c7" }}>
            Importa dati stabili del paziente nel referto
          </div>
          <div style={{ fontSize: "10px", color: "#6b7280", marginTop: "1px" }}>
            Comorbidità, terapie concomitanti, allergie, terapie domiciliari — clicca per espandere
          </div>
        </div>
        {blockCount > 0 && !open && (
          <span style={{
            fontSize: "9px", fontWeight: 700, padding: "2px 7px",
            borderRadius: "999px", background: "#dbeafe", color: "#1d4ed8",
            whiteSpace: "nowrap",
          }}>
            {blockCount} {blockCount === 1 ? "blocco" : "blocchi"}
          </span>
        )}
        {open
          ? <ChevronUp  size={14} color="#6b7280" style={{ flexShrink: 0 }} />
          : <ChevronDown size={14} color="#6b7280" style={{ flexShrink: 0 }} />}
      </button>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      {open && (
        <div style={{
          padding: "12px 14px 14px",
          background: "#fff",
          borderTop: "1px solid #bfdbfe",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}>
          {loading && (
            <div style={{ textAlign: "center", color: "#9ca3af", fontSize: "12px", padding: "16px" }}>
              Caricamento dati…
            </div>
          )}

          {!loading && !blockCount && (
            <div style={{
              textAlign: "center", color: "#9ca3af",
              fontSize: "12px", fontStyle: "italic", padding: "14px",
            }}>
              Nessun dato stabile registrato. Completa la sezione Comorbidità &amp; Terapie dal pannello principale del paziente.
            </div>
          )}

          {!loading && patientNote && (
            <DataBlock
              title="Note paziente"
              text={patientNote}
              sections={insertSections}
              onImport={onImportToSection}
            />
          )}

          {!loading && domTherapy && (
            <DataBlock
              title="Terapie domiciliari (dalla prima visita)"
              text={domTherapy}
              sections={insertSections}
              onImport={onImportToSection}
            />
          )}

          {!loading && comorbText && (
            <DataBlock
              title="Comorbidità"
              text={comorbText}
              sections={insertSections}
              onImport={onImportToSection}
            />
          )}

          {!loading && allergyText && (
            <DataBlock
              title="Allergie"
              text={allergyText}
              sections={insertSections}
              onImport={onImportToSection}
            />
          )}

          {!loading && therapyText && (
            <DataBlock
              title="Terapie concomitanti non reumatologiche"
              text={therapyText}
              sections={insertSections}
              onImport={onImportToSection}
            />
          )}

          {!loading && frailtyText && (
            <DataBlock
              title="Fattori di fragilità"
              text={frailtyText}
              sections={insertSections}
              onImport={onImportToSection}
            />
          )}
        </div>
      )}
    </div>
  );
}
