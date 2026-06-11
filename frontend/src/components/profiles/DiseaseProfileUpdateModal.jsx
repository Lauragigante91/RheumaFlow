/**
 * DiseaseProfileUpdateModal
 *
 * Quick-update panel for disease characterization, triggered from a clinical
 * text selection (labs, imaging, history). Loads the current profile and lets
 * the physician confirm or update characterizing findings in one step.
 *
 * Supports: SSc (scleroProfileApi) and AR (diseaseProfileApi "ra").
 * If the patient has both (overlap), both sections are shown.
 *
 * Props:
 *   open         boolean
 *   onClose      () => void
 *   sourceText   string   — the selected text (shown as reference)
 *   patient      object   — { id, diagnosi, diagnosi_secondarie }
 */

import React, { useEffect, useState } from "react";
import { scleroProfileApi, diseaseProfileApi } from "../../lib/api";
import { isScleroDiagnosis } from "./ScleroProfileSection";
import { isRaDiagnosis } from "../../lib/diseaseDetection";
import { extractSscAntibodies } from "../../lib/sscAntibodyParser";
import { toast } from "sonner";
import { X, Save, Loader2 } from "lucide-react";

// ── Inline primitive components (inline styles only — no Tailwind) ────────────

function TriToggle({ value, onChange, opts }) {
  return (
    <div style={{ display: "inline-flex", border: "1.5px solid #e5e7eb", borderRadius: "6px", overflow: "hidden" }}>
      {opts.map((o, i) => {
        const active = value === o.v;
        const activeBg = i === 0 ? "#374151" : i === opts.length - 1 ? "#dc2626" : "#f59e0b";
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(value === o.v ? null : o.v)}
            style={{
              padding: "4px 12px",
              background: active ? activeBg : "#fff",
              border: "none",
              borderRight: i < opts.length - 1 ? "1px solid #e5e7eb" : "none",
              cursor: "pointer",
              color: active ? "#fff" : "#374151",
              fontSize: "11px",
              fontWeight: 700,
              transition: "all 0.1s",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function FRow({ label, children }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: "12px", padding: "7px 0", borderBottom: "1px solid #f3f4f6",
    }}>
      <span style={{ fontSize: "12px", color: "#374151", flexShrink: 0, maxWidth: "200px", lineHeight: 1.3 }}>{label}</span>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: "9px", fontWeight: 700, color: "#9ca3af",
      textTransform: "uppercase", letterSpacing: "0.12em",
      padding: "10px 0 3px",
    }}>
      {children}
    </div>
  );
}

function SelectField({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value || ""}
      onChange={e => onChange(e.target.value || null)}
      style={{
        padding: "4px 8px", borderRadius: "6px", border: "1.5px solid #e5e7eb",
        fontSize: "11px", color: "#374151", background: "#fff", cursor: "pointer",
        minWidth: "150px",
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
    </select>
  );
}

function NumberField({ value, onChange, placeholder, unit }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <input
        type="number"
        value={value ?? ""}
        onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))}
        placeholder={placeholder}
        style={{
          width: "72px", padding: "4px 8px", borderRadius: "6px",
          border: "1.5px solid #e5e7eb", fontSize: "11px", color: "#374151", background: "#fff",
        }}
      />
      {unit && <span style={{ fontSize: "11px", color: "#9ca3af" }}>{unit}</span>}
    </div>
  );
}

function TextInputField({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value || ""}
      onChange={e => onChange(e.target.value || null)}
      placeholder={placeholder}
      style={{
        padding: "4px 8px", borderRadius: "6px", border: "1.5px solid #e5e7eb",
        fontSize: "11px", color: "#374151", background: "#fff", width: "180px",
      }}
    />
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SSC_TS = [
  { v: "neg", label: "Neg" },
  { v: "borderline", label: "±" },
  { v: "pos", label: "Pos" },
];
const RA_TS = [
  { v: "negative", label: "Neg" },
  { v: "borderline", label: "±" },
  { v: "positive", label: "Pos" },
];

const CAPILLAROSCOPY_OPTS = [
  { v: "normal", label: "Normale" },
  { v: "non_specific", label: "Aspecifico" },
  { v: "early", label: "Early SSc" },
  { v: "active", label: "Active SSc" },
  { v: "late", label: "Late SSc" },
];

const DIGITAL_ULCERS_OPTS = [
  { v: "none", label: "Mai avute" },
  { v: "past", label: "Pregresse" },
  { v: "active_one", label: "Attiva (1)" },
  { v: "active_multiple", label: "Attive multiple" },
];

const ILD_PRESENT_OPTS = [
  { v: "no", label: "No (HRCT negativa)" },
  { v: "yes_stable", label: "Sì — stabile" },
  { v: "yes_progressive", label: "Sì — progressiva" },
  { v: "not_assessed", label: "Non valutata" },
];

const PAH_STATUS_OPTS = [
  { v: "not_screened", label: "Non screenato" },
  { v: "negative", label: "Screening negativo" },
  { v: "suspected", label: "Sospetto (PSAP elevato)" },
  { v: "confirmed", label: "Confermata (RHC+)" },
];

const SSC_SUBSET_OPTS = [
  { v: "sine_scleroderma", label: "Sine" },
  { v: "limited", label: "Limitata (lc)" },
  { v: "diffuse", label: "Diffusa (dc)" },
];

// ── Disease banner ────────────────────────────────────────────────────────────

function DiseaseBanner({ color, bg, borderColor, children }) {
  return (
    <div style={{
      margin: "12px 0 6px",
      padding: "6px 10px",
      background: bg,
      borderRadius: "6px",
      fontSize: "11px",
      fontWeight: 700,
      color,
      borderLeft: `3px solid ${borderColor}`,
    }}>
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DiseaseProfileUpdateModal({ open, onClose, sourceText, patient }) {
  const isSsc = isScleroDiagnosis(patient);
  const isRa  = isRaDiagnosis(patient);

  const [saving, setSaving]   = useState(false);
  const [fetching, setFetching] = useState(false);
  const [sscData, setSscData]  = useState({});
  const [raData, setRaData]    = useState({});

  // Load current profiles when modal opens; auto-apply any antibodies parsed from sourceText
  useEffect(() => {
    if (!open || !patient?.id) return;
    setFetching(true);
    const tasks = [];
    if (isSsc) {
      tasks.push(
        scleroProfileApi.get(patient.id)
          .then(p => {
            const base = p || {};
            // Overlay antibodies detected in the selected sourceText
            const parsed = sourceText ? extractSscAntibodies(sourceText) : [];
            if (parsed.length > 0) {
              setSscData({
                ...base,
                antibody: {
                  ...(base.antibody || {}),
                  ...Object.fromEntries(parsed.map(ab => [ab.profileKey, ab.result])),
                },
              });
            } else {
              setSscData(base);
            }
          })
          .catch(() => setSscData({}))
      );
    }
    if (isRa) {
      tasks.push(
        diseaseProfileApi.get(patient.id, "ra")
          .then(doc => setRaData(doc?.data || {}))
          .catch(() => setRaData({}))
      );
    }
    Promise.all(tasks).finally(() => setFetching(false));
  }, [open, patient?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  if (!isSsc && !isRa) return null;

  // SSc field updater
  const setSSC = (section, key, value) =>
    setSscData(prev => ({
      ...prev,
      [section]: { ...(prev[section] || {}), [key]: value },
    }));

  // AR field updater
  const setRA = (key, value) => setRaData(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const tasks = [];
      if (isSsc) {
        tasks.push(
          scleroProfileApi.upsert(patient.id, {
            cutaneous: sscData.cutaneous || null,
            antibody:  sscData.antibody  || null,
            vascular:  sscData.vascular  || null,
            ild:       sscData.ild       || null,
            pah:       sscData.pah       || null,
            gi:        sscData.gi        || null,
            msk:       sscData.msk       || null,
            notes:     sscData.notes     || null,
          })
        );
      }
      if (isRa) {
        tasks.push(diseaseProfileApi.upsert(patient.id, "ra", raData));
      }
      await Promise.all(tasks);
      toast.success("Profilo malattia aggiornato");
      onClose();
    } catch {
      toast.error("Errore nel salvataggio del profilo");
    } finally {
      setSaving(false);
    }
  };

  // Shorthand accessors
  const ab   = sscData.antibody  || {};
  const cut  = sscData.cutaneous || {};
  const vasc = sscData.vascular  || {};
  const ild  = sscData.ild       || {};
  const pah  = sscData.pah       || {};

  return (
    <>
      {/* Overlay */}
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.35)",
          zIndex: 1000,
          animation: "dpum-fade 0.12s ease",
        }}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1001,
          background: "#fff",
          borderRadius: "14px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          width: "min(560px, 96vw)",
          maxHeight: "88vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "dpum-slide 0.15s ease",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: "16px 20px 12px",
          borderBottom: "1.5px solid #f3f4f6",
          display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", gap: "12px",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: "9px", fontWeight: 700, color: "#9ca3af",
              textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "2px",
            }}>
              Importa nel profilo malattia
            </div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#0A2540" }}>
              Aggiorna caratterizzazione
            </div>
            {sourceText && (
              <div style={{
                marginTop: "7px", padding: "5px 10px",
                background: "#f9fafb", borderRadius: "6px",
                border: "1px solid #e5e7eb",
                fontSize: "11px", color: "#6b7280", fontStyle: "italic",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                « {sourceText.length > 110 ? sourceText.slice(0, 110) + "…" : sourceText} »
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "4px", borderRadius: "6px", border: "none",
              background: "#f9fafb", cursor: "pointer", color: "#6b7280",
              flexShrink: 0, marginTop: "2px",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "0 20px 16px", overflowY: "auto", flex: 1 }}>
          {fetching ? (
            <div style={{ padding: "36px 0", textAlign: "center", color: "#9ca3af" }}>
              <Loader2 size={22} style={{ animation: "dpum-spin 1s linear infinite", display: "inline-block" }} />
              <div style={{ marginTop: "10px", fontSize: "13px" }}>Caricamento profilo in corso…</div>
            </div>
          ) : (
            <>
              {/* ── SSc section ── */}
              {isSsc && (
                <div>
                  <DiseaseBanner color="#0A2540" bg="#f0f9ff" borderColor="#0A2540">
                    Sclerosi Sistemica
                  </DiseaseBanner>

                  <SectionTitle>Anticorpi</SectionTitle>
                  <FRow label="Anti-topoisomerasi I (Scl-70)">
                    <TriToggle value={ab.scl70} onChange={v => setSSC("antibody", "scl70", v)} opts={SSC_TS} />
                  </FRow>
                  <FRow label="Anti-centromero (ACA)">
                    <TriToggle value={ab.aca} onChange={v => setSSC("antibody", "aca", v)} opts={SSC_TS} />
                  </FRow>
                  <FRow label="Anti-RNA polimerasi III">
                    <TriToggle value={ab.rnap3} onChange={v => setSSC("antibody", "rnap3", v)} opts={SSC_TS} />
                  </FRow>
                  <FRow label="ANA (titolo + pattern)">
                    <TextInputField
                      value={ab.ana}
                      onChange={v => setSSC("antibody", "ana", v)}
                      placeholder="es. 1:640 nucleolare"
                    />
                  </FRow>

                  <SectionTitle>Subset clinico</SectionTitle>
                  <FRow label="Forma cutanea">
                    <div style={{ display: "flex", gap: "4px" }}>
                      {SSC_SUBSET_OPTS.map(o => (
                        <button
                          key={o.v}
                          type="button"
                          onClick={() => setSSC("cutaneous", "subset", cut.subset === o.v ? null : o.v)}
                          style={{
                            padding: "4px 9px", borderRadius: "6px", fontSize: "11px",
                            border: "1.5px solid #e5e7eb",
                            background: cut.subset === o.v ? "#0A2540" : "#fff",
                            color: cut.subset === o.v ? "#fff" : "#374151",
                            cursor: "pointer", fontWeight: 600,
                          }}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </FRow>

                  <SectionTitle>ILD / Polmone interstiziale</SectionTitle>
                  <FRow label="ILD presente">
                    <SelectField
                      value={ild.present}
                      onChange={v => setSSC("ild", "present", v)}
                      options={ILD_PRESENT_OPTS}
                      placeholder="— seleziona —"
                    />
                  </FRow>
                  <FRow label="FVC % predetto">
                    <NumberField
                      value={ild.fvc_percent}
                      onChange={v => setSSC("ild", "fvc_percent", v)}
                      placeholder="es. 78"
                      unit="%"
                    />
                  </FRow>
                  <FRow label="DLCO % predetto">
                    <NumberField
                      value={ild.dlco_percent}
                      onChange={v => setSSC("ild", "dlco_percent", v)}
                      placeholder="es. 62"
                      unit="%"
                    />
                  </FRow>

                  <SectionTitle>Vascolare</SectionTitle>
                  <FRow label="Capillaroscopia (pattern Cutolo)">
                    <SelectField
                      value={vasc.capillaroscopy_pattern}
                      onChange={v => setSSC("vascular", "capillaroscopy_pattern", v)}
                      options={CAPILLAROSCOPY_OPTS}
                      placeholder="— pattern —"
                    />
                  </FRow>
                  <FRow label="Ulcere digitali">
                    <SelectField
                      value={vasc.digital_ulcers}
                      onChange={v => setSSC("vascular", "digital_ulcers", v)}
                      options={DIGITAL_ULCERS_OPTS}
                      placeholder="— seleziona —"
                    />
                  </FRow>

                  <SectionTitle>Ipertensione polmonare (PAH)</SectionTitle>
                  <FRow label="Stato PAH">
                    <SelectField
                      value={pah.status}
                      onChange={v => setSSC("pah", "status", v)}
                      options={PAH_STATUS_OPTS}
                      placeholder="— seleziona —"
                    />
                  </FRow>
                  <FRow label="PSAP eco (mmHg)">
                    <NumberField
                      value={pah.echo_psap}
                      onChange={v => setSSC("pah", "echo_psap", v)}
                      placeholder="es. 38"
                      unit="mmHg"
                    />
                  </FRow>
                </div>
              )}

              {/* ── AR section ── */}
              {isRa && (
                <div>
                  <DiseaseBanner color="#9a3412" bg="#fff7ed" borderColor="#ea580c">
                    Artrite Reumatoide
                  </DiseaseBanner>

                  <SectionTitle>Anticorpi</SectionTitle>
                  <FRow label="Fattore Reumatoide (FR)">
                    <TriToggle
                      value={raData.rf_status}
                      onChange={v => setRA("rf_status", v)}
                      opts={RA_TS}
                    />
                  </FRow>
                  {raData.rf_status === "positive" && (
                    <FRow label="Titolo FR">
                      <TextInputField
                        value={raData.rf_titer}
                        onChange={v => setRA("rf_titer", v)}
                        placeholder="es. 120 UI/mL"
                      />
                    </FRow>
                  )}
                  <FRow label="Anti-CCP / ACPA">
                    <TriToggle
                      value={raData.acpa_status}
                      onChange={v => setRA("acpa_status", v)}
                      opts={RA_TS}
                    />
                  </FRow>
                  {raData.acpa_status === "positive" && (
                    <FRow label="Titolo ACPA">
                      <TextInputField
                        value={raData.acpa_titer}
                        onChange={v => setRA("acpa_titer", v)}
                        placeholder="es. 250 U/mL"
                      />
                    </FRow>
                  )}

                  <SectionTitle>Danno strutturale &amp; organi</SectionTitle>
                  <FRow label="Forma">
                    <div style={{ display: "flex", gap: "6px" }}>
                      {[{ v: "non_erosive", l: "Non erosiva" }, { v: "erosive", l: "Erosiva" }].map(o => (
                        <button
                          key={o.v}
                          type="button"
                          onClick={() => setRA("disease_type", raData.disease_type === o.v ? null : o.v)}
                          style={{
                            padding: "4px 12px", borderRadius: "6px", fontSize: "11px",
                            border: "1.5px solid #e5e7eb",
                            background: raData.disease_type === o.v ? "#0A2540" : "#fff",
                            color: raData.disease_type === o.v ? "#fff" : "#374151",
                            cursor: "pointer", fontWeight: 600,
                          }}
                        >
                          {o.l}
                        </button>
                      ))}
                    </div>
                  </FRow>
                  <FRow label="Interstiziopatia polmonare (RA-ILD)">
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={!!raData.ild}
                        onChange={e => setRA("ild", e.target.checked)}
                        style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#0A2540" }}
                      />
                      <span style={{ fontSize: "12px", color: "#374151" }}>Presente</span>
                    </label>
                  </FRow>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: "12px 20px",
          borderTop: "1.5px solid #f3f4f6",
          display: "flex", justifyContent: "flex-end", gap: "8px",
          background: "#fafafa",
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px", borderRadius: "8px",
              border: "1.5px solid #e5e7eb", background: "#fff",
              fontSize: "12px", color: "#374151", cursor: "pointer", fontWeight: 600,
            }}
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || fetching}
            style={{
              padding: "8px 20px", borderRadius: "8px",
              border: "none", background: "#0A2540",
              fontSize: "12px", color: "#fff", cursor: saving || fetching ? "not-allowed" : "pointer",
              fontWeight: 700,
              display: "flex", alignItems: "center", gap: "6px",
              opacity: saving || fetching ? 0.65 : 1,
              transition: "opacity 0.1s",
            }}
          >
            {saving
              ? <Loader2 size={13} style={{ animation: "dpum-spin 1s linear infinite" }} />
              : <Save size={13} />
            }
            Salva profilo
          </button>
        </div>

        <style>{`
          @keyframes dpum-fade   { from { opacity: 0; } to { opacity: 1; } }
          @keyframes dpum-slide  { from { opacity: 0; transform: translate(-50%, -47%); } to { opacity: 1; transform: translate(-50%, -50%); } }
          @keyframes dpum-spin   { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </>
  );
}
