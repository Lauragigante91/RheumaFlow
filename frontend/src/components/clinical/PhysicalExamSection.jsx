import React, { useState } from "react";
import { Textarea } from "../ui/textarea";
import { ChevronDown, ChevronUp, Crosshair, Layers, Activity } from "lucide-react";
import Homunculus, { countTender, countSwollen } from "../imaging/Homunculus";
import EnthesisBodyChart from "../imaging/EnthesisBodyChart";
import TemplatePickerDialog from "../visits/TemplatePickerDialog";
import SelectableTextArea from "../shared/SelectableTextArea";

// ─── System definitions kept for backward-compat serialization only ───────────
export const PHYSICAL_EXAM_SYSTEMS = [
  { key: "musculoskeletal", label: "Apparato muscoloscheletrico" },
  { key: "skin_mucosae",    label: "Cute / Mucose" },
  { key: "vascular",        label: "Vascolare" },
  { key: "neurological",    label: "Neurologico" },
  { key: "cardiopulmonary", label: "Cardiopolmonare" },
  { key: "abdomen",         label: "Addome" },
  { key: "lymph_nodes",     label: "Linfonodi" },
  { key: "general",         label: "Generale / sistemico" },
  { key: "other",           label: "Altro" },
];

// ─── mRSS — 17 body areas (standard mRSS, no neck/back, mano+dita separated) ─
const MRSS_AREAS = [
  { key: "face",        label: "Viso" },
  { key: "chest_ant",   label: "Torace ant." },
  { key: "abdomen",     label: "Addome" },
  { key: "arm_r",       label: "Braccio dx" },
  { key: "forearm_r",   label: "Avambraccio dx" },
  { key: "hand_r",      label: "Mano dx" },
  { key: "fingers_r",   label: "Dita dx" },
  { key: "arm_l",       label: "Braccio sn" },
  { key: "forearm_l",   label: "Avambraccio sn" },
  { key: "hand_l",      label: "Mano sn" },
  { key: "fingers_l",   label: "Dita sn" },
  { key: "thigh_r",     label: "Coscia dx" },
  { key: "lower_leg_r", label: "Gamba dx" },
  { key: "foot_r",      label: "Piede dx" },
  { key: "thigh_l",     label: "Coscia sn" },
  { key: "lower_leg_l", label: "Gamba sn" },
  { key: "foot_l",      label: "Piede sn" },
];

// ─── PASI — 4 regions ─────────────────────────────────────────────────────────
const PASI_REGIONS = [
  { key: "head",  label: "Testa",  weight: 0.1 },
  { key: "trunk", label: "Tronco", weight: 0.3 },
  { key: "arms",  label: "AASS",   weight: 0.2 },
  { key: "legs",  label: "AAII",   weight: 0.4 },
];

// ─── Calculation helpers ──────────────────────────────────────────────────────
function calcMrssTotal(mrss) {
  return MRSS_AREAS.reduce((s, a) => s + (mrss?.[a.key] || 0), 0);
}

function calcPasi(pasi) {
  return PASI_REGIONS.reduce((s, r) => {
    const reg = pasi?.[r.key] || {};
    return s + ((reg.e || 0) + (reg.i || 0) + (reg.d || 0)) * (reg.a || 0) * r.weight;
  }, 0);
}

function calcLeiScore(lei) {
  return Object.values(lei || {}).filter(Boolean).length;
}

// ─── Serialize utility ────────────────────────────────────────────────────────
export function serializePhysicalExam(value) {
  if (!value) return "";
  const parts = [];

  if (value.free_text?.trim()) parts.push(value.free_text.trim());

  const jointMap = value.joint_exam || {};
  const hasSomeJoints = Object.values(jointMap).some((v) => v && v !== "none");
  if (hasSomeJoints) {
    const tenderKeys  = Object.entries(jointMap).filter(([, v]) => v === "tender" || v === "both").map(([k]) => k.replace(/_/g, " "));
    const swollenKeys = Object.entries(jointMap).filter(([, v]) => v === "swollen" || v === "both").map(([k]) => k.replace(/_/g, " "));
    const lines = [`Esame articolare — TJ: ${countTender(jointMap)}  SJ: ${countSwollen(jointMap)}`];
    if (tenderKeys.length)  lines.push(`  Dolorabilità: ${tenderKeys.join(", ")}`);
    if (swollenKeys.length) lines.push(`  Tumefazione: ${swollenKeys.join(", ")}`);
    parts.push(lines.join("\n"));
  }

  // Legacy systems (backward compat — no longer shown in UI)
  const sysLines = PHYSICAL_EXAM_SYSTEMS
    .filter((s) => value.systems?.[s.key]?.trim())
    .map((s) => `${s.label}:\n${value.systems[s.key].trim()}`);
  if (sysLines.length) parts.push(sysLines.join("\n\n"));

  // LEI
  const leiScore = calcLeiScore(value.lei);
  if (leiScore > 0) {
    const active = Object.entries(value.lei || {}).filter(([, v]) => v)
      .map(([k]) => k.replace("lat_epicondyle", "Epicondilo lat.").replace("med_femoral", "Condilo fem. med.")
        .replace("achilles", "Achille").replace("_r", " dx").replace("_l", " sx"));
    parts.push(`LEI: ${leiScore}/6\n  Siti: ${active.join(", ")}`);
  }

  // mRSS
  const mrssTotal = calcMrssTotal(value.mrss);
  if (mrssTotal > 0) {
    const sev = mrssTotal <= 14 ? "lieve" : mrssTotal <= 25 ? "moderato" : "grave";
    const areaLines = MRSS_AREAS.filter(a => (value.mrss?.[a.key] || 0) > 0)
      .map(a => `  ${a.label}: ${value.mrss[a.key]}`);
    parts.push(`mRSS: ${mrssTotal}/51 (${sev})\n${areaLines.join("\n")}`);
  }

  // PASI
  const pasiTotal = calcPasi(value.pasi);
  if (pasiTotal > 0) {
    const sev = pasiTotal < 10 ? "lieve" : pasiTotal < 20 ? "moderato" : "grave";
    parts.push(`PASI: ${pasiTotal.toFixed(1)} (${sev})`);
  }

  return parts.join("\n\n");
}

// ─── SectionToggle ────────────────────────────────────────────────────────────
function SectionToggle({ open, onToggle, icon, label, badge, hint }) {
  return (
    <button type="button" onClick={onToggle} style={{
      display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between",
      padding: "8px 12px", borderRadius: open ? "8px 8px 0 0" : "8px",
      border: "1.5px solid", borderColor: open ? "#3b82f6" : "#d1d5db",
      background: open ? "#eff6ff" : "#f9fafb", cursor: "pointer",
      textAlign: "left", transition: "border-color 0.15s, background 0.15s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
        <span style={{ color: open ? "#2563eb" : "#6b7280", flexShrink: 0 }}>{icon}</span>
        <span style={{ fontSize: "11px", fontWeight: 700, color: open ? "#1d4ed8" : "#374151", textTransform: "uppercase", letterSpacing: "0.1em", flexShrink: 0 }}>
          {label}
        </span>
        {badge && (
          <span style={{ fontSize: "10px", fontWeight: 600, background: "#dbeafe", color: "#1e40af", border: "1px solid #bfdbfe", borderRadius: "999px", padding: "1px 7px", flexShrink: 0 }}>
            {badge}
          </span>
        )}
        {hint && !badge && <span style={{ fontSize: "10px", color: "#9ca3af", fontStyle: "italic" }}>{hint}</span>}
      </div>
      <span style={{ color: open ? "#2563eb" : "#9ca3af", flexShrink: 0, marginLeft: "8px" }}>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </span>
    </button>
  );
}

// ─── ScoreBtn helpers ─────────────────────────────────────────────────────────
function ScoreBtn({ score, max, current, onClick, color = "blue" }) {
  const active = current === score;
  const colors = {
    blue:  { on: "#1d4ed8", bg: "#eff6ff" },
    green: { on: "#059669", bg: "#f0fdf4" },
  };
  const c = colors[color] || colors.blue;
  return (
    <button type="button" onClick={() => onClick(score)} style={{
      width: max <= 4 ? "26px" : "22px", height: "24px", fontSize: "11px", fontWeight: 700,
      borderRadius: "4px", border: "1.5px solid",
      borderColor: active ? c.on : "#e5e7eb",
      background: active ? c.on : "#f9fafb",
      color: active ? "white" : "#6b7280", cursor: "pointer",
    }}>
      {score}
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
function emptyValue() {
  return { free_text: "", joint_exam: {}, systems: {}, mrss: {}, pasi: {}, lei: {} };
}

const LEI_SITE_LABELS = {
  lat_epicondyle_r: "Epicondilo lat. dx",
  lat_epicondyle_l: "Epicondilo lat. sx",
  med_femoral_r:    "Condilo fem. med. dx",
  med_femoral_l:    "Condilo fem. med. sx",
  achilles_r:       "Achille dx",
  achilles_l:       "Achille sx",
};

export default function PhysicalExamSection({
  value,
  onChange,
  showHomunculus = true,
  homunculusMode = "66_68",
  showLei  = false,
  showMrss = false,
  showPasi = false,
  prevJointsData = null,
  prevLeiData    = null,
  patientId      = null,
  patient        = null,
  visitDate      = null,
  onClinimetrySaved = null,
}) {
  const val = (value && typeof value === "object" && !Array.isArray(value)) ? value : emptyValue();
  const freeText = val.free_text ?? "";
  const jointMap = val.joint_exam ?? {};
  const mrss     = val.mrss      ?? {};
  const pasi     = val.pasi      ?? {};
  const lei      = val.lei       ?? {};

  const [homunculusOpen, setHomunculusOpen] = useState(false);
  const [leiOpen,        setLeiOpen]        = useState(false);
  const [mrssOpen,       setMrssOpen]       = useState(false);
  const [pasiOpen,       setPasiOpen]       = useState(false);

  function patch(partial) { onChange?.({ ...val, ...partial }); }
  function patchMrss(key, score) { patch({ mrss: { ...mrss, [key]: score } }); }
  function patchPasi(region, param, v) { patch({ pasi: { ...pasi, [region]: { ...(pasi[region] || {}), [param]: v } } }); }

  const tjc        = countTender(jointMap);
  const sjc        = countSwollen(jointMap);
  const hasJoints  = tjc > 0 || sjc > 0;
  const mrssTotal  = calcMrssTotal(mrss);
  const pasiTotal  = calcPasi(pasi);
  const leiScore   = calcLeiScore(lei);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

      {/* ── Free-text ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {patientId ? (
          <SelectableTextArea
            value={freeText}
            onChange={(e) => patch({ free_text: e.target.value })}
            placeholder="All'esame obiettivo si rileva… — seleziona un testo per importare clinimetria"
            rows={4}
            patientId={patientId}
            patient={patient}
            visitDate={visitDate}
            onClinimetrySaved={onClinimetrySaved}
          />
        ) : (
          <Textarea
            value={freeText}
            onChange={(e) => patch({ free_text: e.target.value })}
            placeholder="All'esame obiettivo si rileva… (campo libero, compilare solo quanto pertinente)"
            className="text-sm resize-y"
            style={{ minHeight: "80px" }}
          />
        )}
        <TemplatePickerDialog
          category="physical_exam"
          currentText={freeText}
          onSelect={(text) => patch({ free_text: freeText ? freeText + "\n\n" + text : text })}
        />
      </div>

      {/* ── Esame articolare (homunculus) ────────────────────────────────── */}
      {showHomunculus && (
        <div>
          <SectionToggle
            open={homunculusOpen}
            onToggle={() => setHomunculusOpen((v) => !v)}
            icon={<Crosshair size={14} />}
            label="Esame articolare"
            badge={hasJoints && !homunculusOpen ? `TJ ${tjc} · SJ ${sjc}` : null}
            hint={!hasJoints ? "opzionale — clicca per aprire il homunculus" : null}
          />
          {homunculusOpen && (
            <div style={{ border: "1.5px solid #3b82f6", borderTop: "none", borderRadius: "0 0 8px 8px", background: "#fff", padding: "16px" }}>
              <div style={{ display: "flex", flexDirection: "row", gap: "24px", alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flexShrink: 0 }}>
                  <Homunculus mode={homunculusMode} joints={jointMap} onChange={(j) => patch({ joint_exam: j })} title={null} />
                </div>
                <div style={{ flex: 1, minWidth: "160px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div style={{ border: "1px solid #bfdbfe", borderRadius: "6px", padding: "8px", textAlign: "center", background: "#eff6ff" }}>
                      <div style={{ fontSize: "10px", color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Doloranti (TJ)</div>
                      <div style={{ fontFamily: "monospace", fontWeight: 900, fontSize: "22px", color: "#1d4ed8" }}>{tjc}</div>
                    </div>
                    <div style={{ border: "1px solid #fecaca", borderRadius: "6px", padding: "8px", textAlign: "center", background: "#fef2f2" }}>
                      <div style={{ fontSize: "10px", color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Tumefatte (SJ)</div>
                      <div style={{ fontFamily: "monospace", fontWeight: 900, fontSize: "22px", color: "#dc2626" }}>{sjc}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: "10px", color: "#9ca3af", lineHeight: "1.6", display: "flex", flexDirection: "column", gap: "2px" }}>
                    <div>🔵 Clic 1× — dolorante</div>
                    <div>🔴 Clic 2× — tumefatta</div>
                    <div>🟣 Clic 3× — entrambe</div>
                    <div>⚪ Clic 4× — normale</div>
                  </div>
                  {prevJointsData && (
                    <button type="button"
                      onClick={() => { patch({ joint_exam: prevJointsData.joints }); }}
                      style={{ fontSize: "10px", color: "#2563eb", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                      ↩ Importa da visita precedente ({new Date(prevJointsData.date).toLocaleDateString("it-IT")})
                    </button>
                  )}
                  {hasJoints && (
                    <button type="button" onClick={() => patch({ joint_exam: {} })}
                      style={{ fontSize: "10px", color: "#ef4444", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                      Azzera esame articolare
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LEI — Leeds Enthesitis Index (SpA/PsA) ──────────────────────── */}
      {showLei && (
        <div>
          <SectionToggle
            open={leiOpen}
            onToggle={() => setLeiOpen((v) => !v)}
            icon={<Activity size={14} />}
            label="LEI — Leeds Enthesitis Index"
            badge={leiScore > 0 && !leiOpen ? `${leiScore}/6` : null}
            hint={leiScore === 0 ? "opzionale — 6 siti bilaterali (gomito, ginocchio, Achille)" : null}
          />
          {leiOpen && (
            <div style={{ border: "1.5px solid #3b82f6", borderTop: "none", borderRadius: "0 0 8px 8px", background: "#fff", padding: "16px" }}>
              <div style={{ display: "flex", flexDirection: "row", gap: "24px", alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flexShrink: 0, maxWidth: "200px" }}>
                  <EnthesisBodyChart sites={lei} onChange={(newLei) => patch({ lei: newLei })} title={null} />
                </div>
                <div style={{ flex: 1, minWidth: "140px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ border: "1px solid #bfdbfe", borderRadius: "6px", padding: "10px", textAlign: "center", background: "#eff6ff" }}>
                    <div style={{ fontSize: "10px", color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Score LEI</div>
                    <div style={{ fontFamily: "monospace", fontWeight: 900, fontSize: "28px", color: leiScore > 0 ? "#dc2626" : "#1d4ed8" }}>
                      {leiScore}<span style={{ fontSize: "14px", fontWeight: 400, color: "#6b7280" }}>/6</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    {Object.entries(LEI_SITE_LABELS).map(([k, label]) => (
                      <div key={k} style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "11px" }}>
                        <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: lei[k] ? "#dc2626" : "#d1d5db", flexShrink: 0, display: "inline-block" }} />
                        <span style={{ color: lei[k] ? "#b91c1c" : "#6b7280", fontWeight: lei[k] ? 600 : 400 }}>{label}</span>
                      </div>
                    ))}
                  </div>
                  {prevLeiData && (
                    <button type="button"
                      onClick={() => { patch({ lei: prevLeiData.sites }); }}
                      style={{ fontSize: "10px", color: "#2563eb", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                      ↩ Importa LEI da visita precedente ({new Date(prevLeiData.date).toLocaleDateString("it-IT")})
                    </button>
                  )}
                  {leiScore > 0 && (
                    <button type="button" onClick={() => patch({ lei: {} })}
                      style={{ fontSize: "10px", color: "#ef4444", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                      Azzera LEI
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── mRSS — Modified Rodnan Skin Score (SSc) ─────────────────────── */}
      {showMrss && (
        <div>
          <SectionToggle
            open={mrssOpen}
            onToggle={() => setMrssOpen((v) => !v)}
            icon={<Layers size={14} />}
            label="mRSS — Modified Rodnan Skin Score"
            badge={mrssTotal > 0 && !mrssOpen ? `${mrssTotal}/51` : null}
            hint={mrssTotal === 0 ? "opzionale — 17 aree, punteggio 0–3 per cute SSc" : null}
          />
          {mrssOpen && (
            <div style={{ border: "1.5px solid #3b82f6", borderTop: "none", borderRadius: "0 0 8px 8px", background: "#fff", padding: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: "10px", marginBottom: "12px" }}>
                {MRSS_AREAS.map((area) => {
                  const cur = mrss[area.key] ?? 0;
                  return (
                    <div key={area.key}>
                      <div style={{ fontSize: "10px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>{area.label}</div>
                      <div style={{ display: "flex", gap: "3px" }}>
                        {[0, 1, 2, 3].map((score) => {
                          const active = cur === score;
                          const bgActive = score === 0 ? "#e5e7eb" : score === 1 ? "#bfdbfe" : score === 2 ? "#60a5fa" : "#1d4ed8";
                          return (
                            <button key={score} type="button" onClick={() => patchMrss(area.key, score)} style={{
                              width: "30px", height: "26px", fontSize: "12px", fontWeight: 700,
                              borderRadius: "5px", border: "1.5px solid",
                              borderColor: active ? (score === 0 ? "#9ca3af" : "#1d4ed8") : "#e5e7eb",
                              background: active ? bgActive : "#f9fafb",
                              color: active && score >= 2 ? "white" : "#374151",
                              cursor: "pointer",
                            }}>{score}</button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ padding: "8px 14px", background: "#eff6ff", borderRadius: "6px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontWeight: 900, fontSize: "18px", color: "#1e40af" }}>{mrssTotal}</span>
                <span style={{ fontSize: "11px", color: "#6b7280" }}>/ 51</span>
                {mrssTotal > 0 && (
                  <span style={{ fontSize: "11px", color: "#1e40af", fontWeight: 600 }}>
                    — {mrssTotal <= 14 ? "Coinvolgimento lieve" : mrssTotal <= 25 ? "Moderato" : "Grave (dcSSc)"}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PASI — Psoriasis Area and Severity Index (PsA/SpA) ──────────── */}
      {showPasi && (
        <div>
          <SectionToggle
            open={pasiOpen}
            onToggle={() => setPasiOpen((v) => !v)}
            icon={<Activity size={14} />}
            label="PASI — Psoriasis Area and Severity Index"
            badge={pasiTotal > 0 && !pasiOpen ? pasiTotal.toFixed(1) : null}
            hint={pasiTotal === 0 ? "opzionale — psoriasi, 4 regioni (E·I·D × Area)" : null}
          />
          {pasiOpen && (
            <div style={{ border: "1.5px solid #3b82f6", borderTop: "none", borderRadius: "0 0 8px 8px", background: "#fff", padding: "16px" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                  <thead>
                    <tr style={{ background: "#f3f4f6" }}>
                      <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, color: "#374151", whiteSpace: "nowrap" }}>Regione</th>
                      {[["Eritema", "0–4"], ["Indur.", "0–4"], ["Desquam.", "0–4"]].map(([h, sub]) => (
                        <th key={h} style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600, color: "#374151" }}>
                          {h}<div style={{ fontSize: "9px", fontWeight: 400, color: "#9ca3af" }}>{sub}</div>
                        </th>
                      ))}
                      <th style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600, color: "#374151" }}>
                        Area<div style={{ fontSize: "9px", fontWeight: 400, color: "#9ca3af" }}>0–6</div>
                      </th>
                      <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: "#374151" }}>Contrib.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PASI_REGIONS.map((r) => {
                      const reg = pasi[r.key] || {};
                      const contrib = ((reg.e || 0) + (reg.i || 0) + (reg.d || 0)) * (reg.a || 0) * r.weight;
                      return (
                        <tr key={r.key} style={{ borderTop: "1px solid #e5e7eb" }}>
                          <td style={{ padding: "8px", fontWeight: 600, color: "#374151", whiteSpace: "nowrap" }}>
                            {r.label}
                            <div style={{ fontSize: "9px", color: "#9ca3af", fontWeight: 400 }}>×{r.weight}</div>
                          </td>
                          {["e", "i", "d"].map((param) => (
                            <td key={param} style={{ padding: "6px 4px", textAlign: "center" }}>
                              <div style={{ display: "flex", gap: "2px", justifyContent: "center" }}>
                                {[0, 1, 2, 3, 4].map((v) => (
                                  <ScoreBtn key={v} score={v} max={4} current={reg[param] ?? 0} onClick={(s) => patchPasi(r.key, param, s)} color="blue" />
                                ))}
                              </div>
                            </td>
                          ))}
                          <td style={{ padding: "6px 4px", textAlign: "center" }}>
                            <div style={{ display: "flex", gap: "2px", justifyContent: "center", flexWrap: "wrap" }}>
                              {[0, 1, 2, 3, 4, 5, 6].map((v) => (
                                <ScoreBtn key={v} score={v} max={6} current={reg.a ?? 0} onClick={(s) => patchPasi(r.key, "a", s)} color="green" />
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: "8px", textAlign: "right", fontWeight: 600, color: contrib > 0 ? "#1d4ed8" : "#9ca3af", fontFamily: "monospace" }}>
                            {contrib.toFixed(1)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: "12px", padding: "8px 14px", background: "#f0fdf4", borderRadius: "6px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontWeight: 900, fontSize: "18px", color: "#059669" }}>{pasiTotal.toFixed(1)}</span>
                <span style={{ fontSize: "11px", color: "#6b7280" }}>PASI</span>
                {pasiTotal > 0 && (
                  <span style={{ fontSize: "11px", color: "#059669", fontWeight: 600 }}>
                    — {pasiTotal < 10 ? "Lieve" : pasiTotal < 20 ? "Moderato" : "Grave"}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
