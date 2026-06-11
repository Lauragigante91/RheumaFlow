/**
 * TextToDataModal
 *
 * Confirmation modal for the "text → structured data" extraction flow.
 *
 * Props:
 *   open          boolean
 *   onClose       () => void
 *   matches       array of match objects from extractLabValues()
 *   sscMatches    array of { profileKey, label, result, sourceText, id } from extractSscAntibodies()
 *   patientId     string
 *   patient       object  — full patient (needed for SSc profile save)
 *   visitDate     string  ISO date (default today)
 *   onSaved       (savedCount: number) => void  — called after successful save
 */

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { FlaskConical, Trash2, CheckCircle2, ArrowRight, Loader2, Dna, PlusCircle, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { labExamsApi, scleroProfileApi } from "../../lib/api";
import ItalianDatePicker from "./ItalianDatePicker";
import { LAB_PANELS } from "../../lib/labPanels";

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusPill({ status }) {
  if (!status) return null;
  const styles = {
    high:   { bg: "#fef2f2", color: "#dc2626", border: "#fecaca", label: "Alto" },
    low:    { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", label: "Basso" },
    normal: { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0", label: "Normale" },
  };
  const s = styles[status];
  if (!s) return null;
  return (
    <span style={{
      fontSize: "10px", fontWeight: 600, padding: "1px 6px",
      borderRadius: "999px", border: `1px solid ${s.border}`,
      background: s.bg, color: s.color, whiteSpace: "nowrap",
    }}>
      {s.label}
    </span>
  );
}

// ─── Single match row (numeric o qualitativo) ─────────────────────────────────

function MatchRow({ match, onUpdate, onRemove }) {
  const isQualitative = match.value == null && match.qualitative != null;
  return (
    <div style={{
      border: isQualitative ? "1px solid #bbf7d0" : "1px solid #e5e7eb",
      borderRadius: "8px",
      padding: "10px 12px",
      background: isQualitative ? "#f0fdf4" : "#fff",
      display: "flex", flexDirection: "column", gap: "8px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: 0 }}>
          <FlaskConical size={13} color={isQualitative ? "#16a34a" : "#6366f1"} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#374151" }}>{match.label}</span>
          <StatusPill status={match.status} />
        </div>
        <button
          type="button"
          onClick={onRemove}
          title="Scarta questo valore"
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#d1d5db", padding: "2px", flexShrink: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
          onMouseLeave={e => e.currentTarget.style.color = "#d1d5db"}
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div style={{
        fontSize: "10px", color: "#9ca3af", fontStyle: "italic",
        background: "#f9fafb", borderRadius: "4px", padding: "3px 6px",
        fontFamily: "monospace",
      }}>
        "{match.sourceText}"
      </div>

      {isQualitative ? (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "11px", color: "#6b7280" }}>Risultato:</span>
          <Input
            value={match.qualitative}
            onChange={e => onUpdate({ qualitative: e.target.value })}
            style={{ fontSize: "12px", fontWeight: 600, color: "#15803d", maxWidth: "200px" }}
          />
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <div>
              <label style={{ fontSize: "10px", color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Valore
              </label>
              <Input
                type="number"
                step="any"
                value={match.value}
                onChange={e => onUpdate({ value: parseFloat(e.target.value) || 0 })}
                style={{ marginTop: "2px", fontSize: "13px", fontWeight: 700 }}
              />
            </div>
            <div>
              <label style={{ fontSize: "10px", color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Unità
              </label>
              <Input
                value={match.unit}
                onChange={e => onUpdate({ unit: e.target.value })}
                style={{ marginTop: "2px", fontSize: "12px" }}
              />
            </div>
          </div>
          {match.normalizedValue != null && (
            <div style={{
              display: "flex", alignItems: "center", gap: "6px",
              background: "#eff6ff", borderRadius: "6px", padding: "4px 8px",
              fontSize: "11px", color: "#1d4ed8",
            }}>
              <ArrowRight size={11} />
              <span>Valore normalizzato: </span>
              <strong>{match.normalizedValue} {match.normalizedUnit}</strong>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── SSc antibody row ─────────────────────────────────────────────────────────

const RESULT_OPTS = [
  { v: "neg",        label: "Neg",  bg: "#fef2f2", activeBg: "#dc2626",  color: "#dc2626" },
  { v: "borderline", label: "±",    bg: "#fffbeb", activeBg: "#d97706",  color: "#d97706" },
  { v: "pos",        label: "Pos",  bg: "#f0fdf4", activeBg: "#16a34a",  color: "#16a34a" },
];

function SscAbRow({ match, onUpdate, onRemove }) {
  return (
    <div style={{
      border: "1.5px solid #e0f2fe", borderRadius: "8px",
      padding: "10px 12px", background: "#f0f9ff",
      display: "flex", flexDirection: "column", gap: "8px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: 0 }}>
          <Dna size={13} color="#0284c7" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#0c4a6e" }}>{match.label}</span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          title="Scarta"
          style={{ background: "none", border: "none", cursor: "pointer", color: "#bae6fd", padding: "2px", flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
          onMouseLeave={e => e.currentTarget.style.color = "#bae6fd"}
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div style={{
        fontSize: "10px", color: "#0369a1", fontStyle: "italic",
        background: "#e0f2fe", borderRadius: "4px", padding: "3px 6px",
        fontFamily: "monospace",
      }}>
        "{match.sourceText}"
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "11px", color: "#374151", fontWeight: 600, minWidth: "70px" }}>Risultato:</span>
        <div style={{ display: "inline-flex", border: "1.5px solid #bae6fd", borderRadius: "6px", overflow: "hidden" }}>
          {RESULT_OPTS.map((o, i) => {
            const active = match.result === o.v;
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => onUpdate({ result: o.v })}
                style={{
                  padding: "4px 14px",
                  background: active ? o.activeBg : "#fff",
                  border: "none",
                  borderRight: i < RESULT_OPTS.length - 1 ? "1px solid #bae6fd" : "none",
                  cursor: "pointer",
                  color: active ? "#fff" : o.color,
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
      </div>
    </div>
  );
}

// ─── Manual lab picker dialog ─────────────────────────────────────────────────

function ManualLabPicker({ open, onClose, onConfirm, existingKeys = [] }) {
  const [values, setValues]           = useState({});
  const [openSections, setOpenSections] = useState(new Set(["autoanticorpi"]));

  useEffect(() => {
    if (open) setValues({});
  }, [open]);

  const toggleSection = (k) =>
    setOpenSections(prev => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const setVal = (key, field, val) =>
    setValues(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [field]: val } }));

  const isFilled = (key) => {
    const v = values[key];
    return v && v.value !== undefined && v.value !== null && v.value !== "";
  };

  const filledCount = Object.keys(LAB_PANELS)
    .flatMap(pk => LAB_PANELS[pk].tests)
    .filter(t => isFilled(t.key)).length;

  const handleConfirm = () => {
    const newRows = [];
    for (const [panelKey, panel] of Object.entries(LAB_PANELS)) {
      for (const test of panel.tests) {
        if (!isFilled(test.key)) continue;
        const v = values[test.key];
        const isQual = test.type === "qual" || test.type === "text";
        newRows.push({
          id: `manual_${test.key}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          key: test.key,
          label: test.label,
          panel: panelKey,
          sourceText: "Inserito manualmente",
          value:       isQual ? null : (parseFloat(v.value) || 0),
          qualitative: isQual ? String(v.value) : undefined,
          unit:        isQual ? "" : (v.unit ?? test.unit ?? ""),
          status:      "normal",
        });
      }
    }
    onConfirm(newRows);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent
        style={{ maxWidth: "600px", maxHeight: "85vh", overflowY: "auto" }}
        aria-describedby="manual-picker-desc"
      >
        <DialogHeader>
          <DialogTitle style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "15px" }}>
            <PlusCircle size={16} color="#6366f1" />
            Aggiungi esami non riconosciuti
          </DialogTitle>
          <p id="manual-picker-desc" style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
            Compila i valori per gli esami che non sono stati estratti automaticamente. Solo i campi compilati verranno aggiunti.
          </p>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {Object.entries(LAB_PANELS).map(([panelKey, panel]) => {
            const isOpen = openSections.has(panelKey);
            const filledHere = panel.tests.filter(t => isFilled(t.key)).length;
            return (
              <div key={panelKey} style={{ border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => toggleSection(panelKey)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 14px",
                    background: isOpen ? "#f9fafb" : "#fff",
                    border: "none", cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#374151" }}>{panel.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {filledHere > 0 && (
                      <span style={{
                        background: "#6366f1", color: "#fff", borderRadius: "999px",
                        fontSize: "10px", fontWeight: 700, padding: "1px 7px",
                      }}>
                        {filledHere}
                      </span>
                    )}
                    {isOpen
                      ? <ChevronDown size={14} color="#9ca3af" />
                      : <ChevronRight size={14} color="#9ca3af" />
                    }
                  </div>
                </button>

                {isOpen && (
                  <div style={{
                    padding: "10px 14px", borderTop: "1px solid #f3f4f6",
                    display: "flex", flexDirection: "column", gap: "6px",
                  }}>
                    {panel.tests.map(test => {
                      const v = values[test.key] || {};
                      const filled        = isFilled(test.key);
                      const alreadyInRows = existingKeys.includes(test.key);
                      const isQual        = test.type === "qual" || test.type === "text";
                      return (
                        <div key={test.key} style={{
                          padding: "6px 8px", borderRadius: "6px",
                          background: filled ? "#eff6ff" : "transparent",
                          border:     filled ? "1px solid #bfdbfe" : "1px solid transparent",
                          transition: "background 0.1s",
                        }}>
                          <div style={{ fontSize: "11px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                            {test.label}
                            {alreadyInRows && (
                              <span style={{ fontSize: "9px", color: "#16a34a", marginLeft: "6px", fontWeight: 500 }}>
                                ✓ già estratto
                              </span>
                            )}
                          </div>
                          {isQual ? (
                            <Input
                              value={v.value ?? ""}
                              onChange={e => setVal(test.key, "value", e.target.value)}
                              placeholder={test.placeholder || "es. neg / pos / borderline"}
                              style={{ fontSize: "12px", height: "28px" }}
                            />
                          ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "6px" }}>
                              <Input
                                type="number"
                                step="any"
                                value={v.value ?? ""}
                                onChange={e => setVal(test.key, "value", e.target.value)}
                                placeholder="Valore"
                                style={{ fontSize: "12px", height: "28px" }}
                              />
                              <Input
                                value={v.unit ?? test.unit ?? ""}
                                onChange={e => setVal(test.key, "unit", e.target.value)}
                                placeholder={test.unit || "unità"}
                                style={{ fontSize: "12px", height: "28px" }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter style={{ gap: "8px", marginTop: "4px" }}>
          <Button type="button" variant="outline" onClick={onClose}>
            Annulla
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={filledCount === 0}
            style={{ background: "#6366f1", color: "#fff" }}
          >
            <CheckCircle2 size={14} style={{ marginRight: "6px" }} />
            Aggiungi {filledCount > 0 ? `${filledCount} ` : ""}{filledCount === 1 ? "esame" : "esami"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function TextToDataModal({
  open, onClose,
  matches: initialMatches,
  sscMatches: initialSscMatches = [],
  patientId,
  patient,
  visitDate,
  onSaved,
}) {
  const [rows,       setRows]       = useState([]);
  const [sscRows,    setSscRows]    = useState([]);
  const [date,       setDate]       = useState(() => visitDate || new Date().toISOString().slice(0, 10));
  const [saving,     setSaving]     = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (open) {
      setRows(initialMatches    ? [...initialMatches]    : []);
      setSscRows(initialSscMatches ? [...initialSscMatches] : []);
      setDate(visitDate || new Date().toISOString().slice(0, 10));
    }
  }, [open, initialMatches, initialSscMatches, visitDate]);

  function updateRow(id, partial) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...partial } : r));
  }
  function removeRow(id) {
    setRows(prev => prev.filter(r => r.id !== id));
  }
  function updateSscRow(id, partial) {
    setSscRows(prev => prev.map(r => r.id === id ? { ...r, ...partial } : r));
  }
  function removeSscRow(id) {
    setSscRows(prev => prev.filter(r => r.id !== id));
  }

  const totalCount = rows.length + sscRows.length;

  async function handleSave() {
    if (totalCount === 0) { onClose(); return; }
    setSaving(true);
    let saved = 0;
    try {
      // ── Save lab values (numeric o qualitativi) ──────────────────────────────
      for (const row of rows) {
        const isQualitative = row.value == null && row.qualitative != null;
        const valueToStore = isQualitative ? null : (row.normalizedValue != null ? row.normalizedValue : row.value);
        const unitToStore  = isQualitative ? ""   : (row.normalizedValue != null ? row.normalizedUnit  : row.unit);
        await labExamsApi.create({
          patient_id: patientId,
          date,
          panel: row.panel || "custom",
          values: {
            [row.key]: {
              value:      valueToStore,
              qualitative: isQualitative ? row.qualitative : undefined,
              unit:       unitToStore,
              status:     row.status || "normal",
              notes:      `Estratto da testo: "${row.sourceText}"`,
              ...(isQualitative ? {} : { raw_value: row.value, raw_unit: row.unit }),
            },
          },
          notes: `Inserimento rapido — estratto da nota clinica: "${row.sourceText}"`,
        });
        saved++;
      }

      // ── Save SSc antibodies to Profilo Sclerodermia ──────────────────────────
      if (sscRows.length > 0 && (patientId || patient?.id)) {
        const pid = patientId || patient?.id;
        const current = await scleroProfileApi.get(pid).catch(() => ({}));
        const updatedAntibody = { ...(current?.antibody || {}) };
        for (const ab of sscRows) {
          updatedAntibody[ab.profileKey] = ab.result;
        }
        await scleroProfileApi.upsert(pid, {
          ...current,
          antibody: updatedAntibody,
        });
        saved += sscRows.length;
      }

      toast.success(
        saved === 1
          ? "1 dato salvato nella cartella"
          : `${saved} dati salvati nella cartella`,
        sscRows.length > 0
          ? { description: `${sscRows.length} anticorpo/i importato/i nel Profilo Sclerodermia` }
          : undefined
      );
      onSaved?.(saved);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        style={{ maxWidth: "520px", maxHeight: "90vh", overflowY: "auto" }}
        aria-describedby="text-to-data-desc"
      >
        <DialogHeader>
          <DialogTitle style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "15px" }}>
            <FlaskConical size={16} color="#6366f1" />
            Converti in dato strutturato
          </DialogTitle>
          <p id="text-to-data-desc" style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
            Verifica e correggi i valori estratti dal testo selezionato, poi conferma per salvarli in cartella.
          </p>
        </DialogHeader>

        {/* Date row — shown only if there are numeric values */}
        {rows.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0" }}>
            <span style={{ fontSize: "12px", color: "#374151", fontWeight: 600, whiteSpace: "nowrap" }}>
              Data esame:
            </span>
            <ItalianDatePicker value={date} onChange={setDate} />
          </div>
        )}

        {/* ── Numeric lab values ── */}
        {rows.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {rows.map(row => (
              <MatchRow
                key={row.id}
                match={row}
                onUpdate={partial => updateRow(row.id, partial)}
                onRemove={() => removeRow(row.id)}
              />
            ))}
          </div>
        )}

        {/* ── SSc antibody section ── */}
        {sscRows.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "6px 10px",
              background: "#f0f9ff", borderRadius: "8px",
              border: "1.5px solid #bae6fd",
            }}>
              <Dna size={13} color="#0284c7" />
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#0c4a6e" }}>
                Anticorpi SSc riconosciuti — saranno importati nel Profilo Sclerodermia
              </span>
            </div>
            {sscRows.map(row => (
              <SscAbRow
                key={row.id}
                match={row}
                onUpdate={partial => updateSscRow(row.id, partial)}
                onRemove={() => removeSscRow(row.id)}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {rows.length === 0 && sscRows.length === 0 && (
          <div style={{
            textAlign: "center", padding: "24px", color: "#9ca3af",
            fontSize: "13px", borderRadius: "8px", background: "#f9fafb",
            border: "1px dashed #e5e7eb",
          }}>
            Nessun parametro riconosciuto nel testo selezionato.
            <br />
            <span style={{ fontSize: "11px" }}>
              Prova a selezionare un testo come "CRP 2.4 mg/dL", "VES 45 mm/h" o "Scl-70 +++".
            </span>
          </div>
        )}

        <DialogFooter style={{ gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Annulla
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowPicker(true)}
            disabled={saving}
            style={{ color: "#6366f1", borderColor: "#a5b4fc" }}
          >
            <PlusCircle size={14} style={{ marginRight: "6px" }} />
            Aggiungi esami non riconosciuti
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || totalCount === 0}
            style={{ background: "#6366f1", color: "#fff", minWidth: "120px" }}
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin mr-1" /> Salvataggio…</>
            ) : (
              <><CheckCircle2 size={14} style={{ marginRight: "6px" }} />
                Salva {totalCount > 0 ? totalCount : ""} {totalCount === 1 ? "dato" : "dati"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      <ManualLabPicker
        open={showPicker}
        onClose={() => setShowPicker(false)}
        existingKeys={rows.map(r => r.key)}
        onConfirm={(newRows) => setRows(prev => [...prev, ...newRows])}
      />
    </Dialog>
  );
}
