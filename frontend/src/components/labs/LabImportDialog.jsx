import React, { useRef, useState, useEffect } from "react";
import { labExamsApi } from "../../lib/api";
import { extractLabValuesByDate } from "../../lib/labValueExtractor";
import { extractTextFromPdf } from "../../lib/pdfLabExtractor";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import {
  Upload, FlaskConical, Loader2, X, CheckCircle2,
  ShieldCheck, AlertTriangle, Cpu, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { LAB_PANELS } from "../../lib/labPanels";
import ItalianDatePicker from "../shared/ItalianDatePicker";

/**
 * Dialog: upload PDF/image of a lab report → local OCR/rules extract values
 * → optional AI fallback → user reviews/edits/confirms → saves to chart.
 *
 * Props:
 *   open, onOpenChange — controlled dialog state
 *   patient — patient object (used for patient_id)
 *   onImported — optional callback after successful save
 */

const CONFIDENCE_STYLES = {
  high:   { badge: "bg-emerald-100 text-emerald-800 border-emerald-300", label: "Alta" },
  medium: { badge: "bg-amber-100  text-amber-800  border-amber-300",  label: "Media" },
  low:    { badge: "bg-red-100    text-red-800    border-red-300",    label: "Bassa" },
};

function ConfidenceBadge({ level }) {
  const s = CONFIDENCE_STYLES[level] || CONFIDENCE_STYLES.medium;
  return (
    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${s.badge}`}>
      {s.label}
    </span>
  );
}

function ExtractionMethodBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
      <Cpu className="w-3 h-3" /> Locale
    </span>
  );
}

function parseLocalLabText(text) {
  const groups = extractLabValuesByDate(text);
  const keyToPanel = {};
  Object.entries(LAB_PANELS).forEach(([pk, panel]) => {
    (panel.tests || []).forEach(t => { keyToPanel[t.key] = pk; });
  });
  const panels = {};
  const confidenceMap = {};
  let date = null;
  groups.forEach(g => {
    if (!date && g.date) date = g.date;
    (g.items || []).forEach(item => {
      const key = item.param_key || item.name;
      if (!key) return;
      const panelKey = keyToPanel[key];
      if (!panelKey) return;
      if (!panels[panelKey]) panels[panelKey] = {};
      panels[panelKey][key] = {
        value: item.value != null ? String(item.value) : "",
        unit: item.unit || "",
        qualitative: item.qualitative || null,
      };
      confidenceMap[`${panelKey}__${key}`] = item.confidence || "medium";
    });
  });
  return { panels, confidenceMap, date, extraction_method: "local" };
}

/**
 * Validation summary: shows conversions + uncertain units + low-confidence per panel.
 */
function ValidationSummary({ editedPanels, confidenceMap }) {
  const items = [];

  for (const [panelKey, vals] of Object.entries(editedPanels)) {
    const panelDef = LAB_PANELS[panelKey];
    const panelLabel = panelDef?.label || panelKey;

    for (const [testKey, cur] of Object.entries(vals || {})) {
      if (!cur) continue;
      const testDef = (panelDef?.tests || []).find(t => t.key === testKey);
      const testLabel = testDef?.label || testKey;
      const confKey = `${panelKey}__${testKey}`;
      const conf = confidenceMap[confKey];

      const hasConversion =
        cur.original_value != null &&
        cur.original_unit != null &&
        cur.original_unit !== cur.unit;

      const hasPct = cur.pct != null && cur.unit && cur.unit.includes("10");

      if (hasConversion) {
        items.push({
          type: "conversion",
          label: `${panelLabel} — ${testLabel}`,
          detail: `${cur.original_value} ${cur.original_unit} → ${cur.value} ${cur.unit}`,
        });
      } else if (hasPct) {
        items.push({
          type: "ok",
          label: `${panelLabel} — ${testLabel}`,
          detail: `${cur.value} ${cur.unit} (${cur.pct}%)`,
        });
      } else if (cur.unit_uncertain) {
        items.push({
          type: "warn",
          label: `${panelLabel} — ${testLabel}`,
          detail: `Unità non riconosciuta — verifica il valore (${cur.value} ${cur.unit || "?"})`,
        });
      } else if (conf === "low") {
        items.push({
          type: "warn",
          label: `${panelLabel} — ${testLabel}`,
          detail: `Confidenza bassa — verifica che ${cur.value} ${cur.unit} corrisponda al referto`,
        });
      }
    }
  }

  if (items.length === 0) return null;

  const conversions = items.filter(i => i.type === "conversion" || i.type === "ok");
  const warnings = items.filter(i => i.type === "warn");

  return (
    <div className="space-y-2">
      {conversions.length > 0 && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md space-y-1.5">
          <div className="text-[11px] uppercase tracking-[0.12em] font-bold text-emerald-800 mb-1">
            ✔ Conversioni e rilevamenti automatici
          </div>
          {conversions.map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] text-emerald-900">
              <ArrowRight className="w-3 h-3 flex-shrink-0 mt-0.5 text-emerald-600" />
              <span>
                <span className="font-semibold">{item.label}:</span>{" "}
                <span className="font-mono">{item.detail}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      {warnings.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md space-y-1.5">
          <div className="text-[11px] uppercase tracking-[0.12em] font-bold text-amber-800 mb-1">
            ⚠ Valori da verificare
          </div>
          {warnings.map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] text-amber-900">
              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5 text-amber-600" />
              <span>
                <span className="font-semibold">{item.label}:</span>{" "}
                {item.detail}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LabImportDialog({ open, onOpenChange, patient, onImported, initialText = null }) {
  const inputRef = useRef(null);
  const [file, setFile]         = useState(null);
  const [parsing, setParsing]   = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [editedDate, setEditedDate] = useState("");
  const [saving, setSaving]     = useState(false);
  const [editedPanels, setEditedPanels] = useState({});
  const [parseFailed, setParseFailed] = useState(false);
  const [forceUpload, setForceUpload] = useState(false);

  const reset = () => {
    setFile(null);
    setExtracted(null);
    setEditedDate("");
    setEditedPanels({});
    setParseFailed(false);
    setForceUpload(false);
  };

  const handleClose = (v) => {
    if (!v) reset();
    onOpenChange(v);
  };

  useEffect(() => {
    if (open && initialText && !extracted && !parsing) {
      setParseFailed(false);
      setParsing(true);
      try {
        const data = parseLocalLabText(initialText);
        setExtracted(data);
        setEditedDate(data.date || new Date().toISOString().slice(0, 10));
        setEditedPanels(data.panels || {});
        const total = Object.values(data.panels || {}).reduce(
          (acc, p) => acc + Object.keys(p || {}).length, 0
        );
        if (total === 0) {
          toast.warning("Nessun valore di laboratorio riconosciuto nel testo selezionato. Il testo potrebbe non contenere referti di laboratorio.", { duration: 8000 });
        } else {
          toast.success(`Estratti ${total} valori dal testo selezionato`);
        }
      } catch {
        setParseFailed(true);
        toast.error("Errore durante l'estrazione dei valori dal testo selezionato.");
      } finally {
        setParsing(false);
      }
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFilePick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setExtracted(null);
  };

  const runParse = async () => {
    if (!file) { toast.error("Seleziona un file"); return; }
    if (!/\.pdf$/i.test(file.name)) {
      toast.error("Solo file PDF sono supportati per l'estrazione locale. Converti l'immagine in PDF prima di caricarla.", { duration: 8000 });
      return;
    }
    setParsing(true);
    try {
      const text = await extractTextFromPdf(file);
      if (!text?.trim()) {
        toast.warning("Impossibile estrarre testo dal PDF. Il file potrebbe essere un'immagine scansionata non riconoscibile.", { duration: 8000 });
        setParseFailed(true);
        return;
      }
      const data = parseLocalLabText(text);
      setExtracted(data);
      setEditedDate(data.date || new Date().toISOString().slice(0, 10));
      setEditedPanels(data.panels || {});
      const totalTests = Object.values(data.panels || {}).reduce(
        (acc, p) => acc + Object.keys(p || {}).length, 0
      );
      if (totalTests === 0) {
        toast.warning(
          "Nessun valore riconosciuto automaticamente. Verifica il referto e inserisci i valori manualmente.",
          { duration: 8000 }
        );
      } else {
        const lowCount = Object.values(data.confidenceMap || {}).filter(c => c === "low").length;
        const msg = `Estratti ${totalTests} valori in locale`;
        if (lowCount > 0) {
          toast.success(`${msg} — ${lowCount} valore/i a bassa confidenza: verifica prima di salvare.`, { duration: 6000 });
        } else {
          toast.success(msg);
        }
      }
    } catch {
      toast.error("Errore durante l'estrazione. Riprovare.");
    } finally {
      setParsing(false);
    }
  };

  const togglePanelTest = (panelKey, testKey) => {
    setEditedPanels((prev) => {
      const panel = { ...(prev[panelKey] || {}) };
      if (panel[testKey]) {
        delete panel[testKey];
      } else {
        const def = (LAB_PANELS[panelKey]?.tests || []).find((t) => t.key === testKey);
        panel[testKey] = { value: "", qualitative: null, unit: def?.unit || "" };
      }
      return { ...prev, [panelKey]: panel };
    });
  };

  const updateTestValue = (panelKey, testKey, field, val) => {
    setEditedPanels((prev) => ({
      ...prev,
      [panelKey]: {
        ...(prev[panelKey] || {}),
        [testKey]: { ...(prev[panelKey]?.[testKey] || {}), [field]: val },
      },
    }));
  };

  const totalKept = Object.values(editedPanels).reduce(
    (acc, p) => acc + Object.keys(p || {}).length, 0
  );

  const save = async () => {
    if (!editedDate) { toast.error("Inserisci la data del prelievo"); return; }
    if (totalKept === 0) { toast.error("Nessun valore da salvare"); return; }
    setSaving(true);
    try {
      const allValues = {};
      for (const [, vals] of Object.entries(editedPanels)) {
        const cleaned = Object.fromEntries(
          Object.entries(vals || {}).filter(
            ([, v]) => (v?.value !== "" && v?.value != null) || (v?.qualitative != null && v?.qualitative !== "")
          )
        );
        Object.assign(allValues, cleaned);
      }
      if (Object.keys(allValues).length === 0) { toast.error("Nessun valore da salvare"); return; }
      await labExamsApi.upsert({
        patient_id: patient.id,
        date: editedDate,
        values: allValues,
        notes: extracted?.raw_notes || "",
      });
      toast.success(`Importati ${totalKept} valori dal referto`);
      reset();
      onOpenChange(false);
      if (onImported) onImported();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore durante il salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const confidenceMap = extracted?.confidence_map || {};

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto" data-testid="lab-import-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading font-black tracking-tight flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-[#0A2540]" />
            Importa referto di laboratorio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* ── Loading state (text-from-selection mode) ── */}
          {!extracted && parsing && initialText && (
            <Card className="p-10 flex flex-col items-center gap-3 border-dashed border-2 border-blue-200 bg-blue-50/30">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-sm text-blue-800 font-medium">Analisi del testo in corso…</p>
              <p className="text-xs text-blue-600">Estrazione automatica dei valori di laboratorio</p>
            </Card>
          )}

          {/* ── Parse failure state (text-from-selection mode) ── */}
          {!extracted && !parsing && initialText && parseFailed && !forceUpload && (
            <Card className="p-8 flex flex-col items-center gap-3 border-dashed border-2 border-red-200 bg-red-50/30">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <p className="text-sm text-red-800 font-medium text-center">Impossibile estrarre valori dal testo selezionato.</p>
              <p className="text-xs text-red-600 text-center">Prova a selezionare un referto di laboratorio, oppure carica un file PDF direttamente.</p>
              <Button variant="outline" size="sm" onClick={() => { setParseFailed(false); setForceUpload(true); }}>
                Carica file PDF
              </Button>
            </Card>
          )}

          {/* ── Upload step ── */}
          {!extracted && !parsing && (!initialText || forceUpload) && (
            <Card className="p-6 border-dashed border-2 border-gray-300 bg-gray-50/50">
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={onFilePick}
                data-testid="lab-import-file"
              />
              <div className="text-center space-y-3">
                <Upload className="w-10 h-10 text-gray-400 mx-auto" />
                <div>
                  <h3 className="font-heading font-bold text-base">Carica un referto di laboratorio</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    Solo file PDF. I valori vengono estratti localmente con regole specifiche
                    per referti reumatologici italiani — nessun dato inviato a servizi esterni.
                  </p>
                </div>

                {/* GDPR notice */}
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5 max-w-sm mx-auto">
                  <ShieldCheck className="w-3 h-3 flex-shrink-0" />
                  <span>
                    Elaborazione locale: il testo viene estratto sul server e il documento originale
                    viene eliminato immediatamente. Solo i valori confermati vengono salvati.
                  </span>
                </div>

                <div className="flex items-start gap-1.5 text-[10px] text-blue-800 bg-blue-50 border border-blue-200 rounded-md px-2.5 py-1.5 max-w-sm mx-auto text-left">
                  <Cpu className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Estrazione locale:</strong> regole specifiche per referti reumatologici italiani
                    (emocromo, VES/PCR, funzionalità epatica e renale, autoanticorpi, urine…).
                    Tutto avviene nel browser, zero dati trasmessi a servizi terzi.
                  </span>
                </div>

                {file ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <FlaskConical className="w-4 h-4 text-[#0A2540]" />
                    <span className="font-medium">{file.name}</span>
                    <button onClick={() => setFile(null)} className="text-red-600 hover:text-red-800" data-testid="lab-clear-file">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : null}

                <div className="flex justify-center gap-2">
                  <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={parsing}>
                    <Upload className="w-4 h-4 mr-2" /> Scegli file
                  </Button>
                  {file && (
                    <Button
                      onClick={runParse}
                      disabled={parsing}
                      className="bg-[#0A2540] text-white hover:bg-[#051626]"
                      data-testid="lab-parse-btn"
                    >
                      {parsing ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Estrazione in corso…</>
                      ) : (
                        <><Cpu className="w-4 h-4 mr-2" /> Estrai valori</>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* ── Review step ── */}
          {extracted && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className={`flex items-center justify-between p-3 rounded-md flex-wrap gap-2 ${
                totalKept > 0
                  ? "bg-emerald-50 border border-emerald-200"
                  : "bg-amber-50 border border-amber-200"
              }`}>
                <div className={`flex items-center gap-2 text-sm ${totalKept > 0 ? "text-emerald-900" : "text-amber-900"}`}>
                  {totalKept > 0
                    ? <CheckCircle2 className="w-4 h-4" />
                    : <AlertTriangle className="w-4 h-4" />}
                  <span>
                    {totalKept > 0
                      ? <><strong>{totalKept}</strong> valori da{" "}<strong>{Object.keys(editedPanels).length}</strong> pannelli pronti per l'importazione.</>
                      : "Nessun valore di laboratorio trovato nel testo. Il testo selezionato potrebbe non contenere referti di laboratorio."
                    }
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ExtractionMethodBadge />
                  <Button variant="outline" size="sm" onClick={reset} data-testid="lab-restart">
                    <X className="w-3.5 h-3.5 mr-1" /> Riparti
                  </Button>
                </div>
              </div>

              {/* ── Validation summary ── */}
              <ValidationSummary editedPanels={editedPanels} confidenceMap={confidenceMap} />

              {/* Low-confidence global warning */}
              {Object.values(confidenceMap).some(c => c === "low") && (
                <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-300 rounded-md text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Alcuni valori hanno confidenza <strong>bassa</strong> (etichetta rossa) — verifica
                    che corrispondano al referto prima di salvare. Puoi modificarli o deselezionarli.
                  </span>
                </div>
              )}

              {/* Date picker */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                <div>
                  <label className="text-xs uppercase tracking-[0.15em] text-gray-600 block mb-1">
                    Data prelievo *
                  </label>
                  <ItalianDatePicker value={editedDate} onChange={setEditedDate} testid="lab-import-date" />
                </div>
                <div className="text-[11px] text-gray-500 italic">
                  La data è stata letta dal referto. Modificala se necessario.
                  {extracted.raw_notes && (
                    <div className="text-[10px] text-gray-600 mt-1 bg-yellow-50 border border-yellow-200 rounded p-1.5">
                      <strong>Note dal referto:</strong> {extracted.raw_notes}
                    </div>
                  )}
                </div>
              </div>

              {/* Per-panel review */}
              <div className="space-y-3">
                {Object.entries(editedPanels).map(([panelKey, vals]) => {
                  const panelDef = LAB_PANELS[panelKey];
                  if (!panelDef) return null;
                  const panelTests = panelDef.tests || [];

                  return (
                    <Card key={panelKey} className="p-3 border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-heading font-bold text-sm uppercase tracking-[0.1em] text-[#0A2540]">
                          {panelDef.label}
                        </h4>
                        <Badge variant="outline" className="text-[10px]">
                          {Object.keys(vals || {}).length} valori
                        </Badge>
                      </div>

                      <div className="space-y-1.5">
                        {panelTests.map((t) => {
                          const cur = vals?.[t.key];
                          const present = !!cur;
                          const confKey = `${panelKey}__${t.key}`;
                          const conf = confidenceMap[confKey];
                          const isLow = conf === "low";

                          return (
                            <div
                              key={t.key}
                              className={`flex items-center gap-2 p-2 rounded border ${
                                present
                                  ? isLow
                                    ? "bg-red-50/40 border-red-200"
                                    : "bg-blue-50/40 border-blue-200"
                                  : "bg-gray-50 border-gray-200 opacity-40"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={present}
                                onChange={() => togglePanelTest(panelKey, t.key)}
                                className="w-4 h-4 flex-shrink-0"
                                data-testid={`lab-toggle-${panelKey}-${t.key}`}
                              />
                              <div className="flex-1 text-xs leading-tight">{t.label}</div>

                              {/* Unit-uncertain indicator */}
                              {present && cur.unit_uncertain && (
                                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-300 rounded px-1">
                                  unità?
                                </span>
                              )}

                              {/* Pct indicator */}
                              {present && cur.pct != null && (
                                <span className="text-[9px] text-gray-500 font-mono">
                                  {cur.pct}%
                                </span>
                              )}

                              {present && conf && (
                                <ConfidenceBadge level={conf} />
                              )}

                              {present && (
                                <>
                                  {t.type === "qual" ? (
                                    <select
                                      value={cur.qualitative || ""}
                                      onChange={(e) => updateTestValue(panelKey, t.key, "qualitative", e.target.value)}
                                      className="text-xs h-7 px-1 border border-gray-200 rounded"
                                      data-testid={`lab-qual-${panelKey}-${t.key}`}
                                    >
                                      <option value="">—</option>
                                      <option value="negative">Negativo</option>
                                      <option value="positive_low">Positivo (basso)</option>
                                      <option value="positive">Positivo</option>
                                      <option value="borderline">Borderline</option>
                                    </select>
                                  ) : (
                                    <input
                                      type={t.type === "number" ? "number" : "text"}
                                      step="any"
                                      value={cur.value ?? ""}
                                      onChange={(e) => updateTestValue(panelKey, t.key, "value", e.target.value)}
                                      className={`w-24 text-xs h-7 px-2 border rounded font-mono ${
                                        isLow ? "border-red-300 bg-red-50" : "border-gray-200"
                                      }`}
                                      placeholder="—"
                                      data-testid={`lab-val-${panelKey}-${t.key}`}
                                    />
                                  )}
                                  <span className="text-[10px] text-gray-500 w-16 truncate">
                                    {cur.unit || t.unit}
                                  </span>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Empty state */}
              {Object.keys(editedPanels).length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  <FlaskConical className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>Nessun valore riconosciuto automaticamente.</p>
                  <p className="text-xs mt-1">
                    Verifica che il PDF contenga testo selezionabile oppure prova con un file di qualità migliore.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>
            {extracted ? "Annulla" : "Chiudi"}
          </Button>
          {extracted && totalKept > 0 && (
            <Button
              onClick={save}
              disabled={saving}
              className="bg-[#0A2540] text-white hover:bg-[#051626]"
              data-testid="lab-import-save-btn"
            >
              {saving
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Salva {totalKept} valori
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
