import React, { useRef, useState } from "react";
import { aiApi, labExamsApi } from "../lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Sparkles, Upload, FlaskConical, Loader2, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { LAB_PANELS } from "../lib/labPanels";
import ItalianDatePicker from "./ItalianDatePicker";

/**
 * Dialog: upload PDF/image of a lab report, AI extracts structured values
 * via Gemini 2.5 Pro, user reviews + edits + confirms → batch creates one
 * lab exam per panel populated.
 *
 * Props:
 *   open, onOpenChange — controlled dialog state
 *   patient — patient object (used for patient_id)
 *   onImported — optional callback (after successful save)
 */
export default function LabImportDialog({ open, onOpenChange, patient, onImported }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [extracted, setExtracted] = useState(null); // { date, panels: {panelKey: {testKey: {value, qualitative, unit}}}, raw_notes, unmatched_keys, filename }
  const [editedDate, setEditedDate] = useState("");
  const [saving, setSaving] = useState(false);
  // Map panelKey → { testKey: { value, qualitative, unit } } (allows user edits)
  const [editedPanels, setEditedPanels] = useState({});

  const reset = () => {
    setFile(null);
    setExtracted(null);
    setEditedDate("");
    setEditedPanels({});
  };

  const handleClose = (v) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const onFilePick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setExtracted(null);
  };

  const runParse = async () => {
    if (!file) {
      toast.error("Seleziona un file");
      return;
    }
    setParsing(true);
    try {
      const data = await aiApi.parseLab(file);
      setExtracted(data);
      setEditedDate(data.date || new Date().toISOString().slice(0, 10));
      setEditedPanels(data.panels || {});
      const totalTests = Object.values(data.panels || {}).reduce(
        (acc, panel) => acc + Object.keys(panel || {}).length,
        0
      );
      if (totalTests === 0) {
        toast.warning("L'AI non ha estratto nessun valore. Riprova con un'altra scansione.");
      } else {
        toast.success(`AI: ${totalTests} valori estratti su ${Object.keys(data.panels || {}).length} pannelli`);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore durante l'estrazione");
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
        [testKey]: {
          ...(prev[panelKey]?.[testKey] || {}),
          [field]: val,
        },
      },
    }));
  };

  const totalKept = Object.values(editedPanels).reduce(
    (acc, p) => acc + Object.keys(p || {}).length,
    0
  );

  const save = async () => {
    if (!editedDate) {
      toast.error("Inserisci la data del prelievo");
      return;
    }
    if (totalKept === 0) {
      toast.error("Nessun valore da salvare");
      return;
    }
    setSaving(true);
    try {
      // Create one exam per panel that has at least 1 value
      let created = 0;
      for (const [panelKey, vals] of Object.entries(editedPanels)) {
        const cleaned = Object.fromEntries(
          Object.entries(vals || {}).filter(
            ([, v]) => (v?.value !== "" && v?.value != null) || (v?.qualitative != null && v?.qualitative !== "")
          )
        );
        if (Object.keys(cleaned).length === 0) continue;
        await labExamsApi.create({
          patient_id: patient.id,
          date: editedDate,
          panel: panelKey,
          values: cleaned,
          notes: extracted?.raw_notes || "",
        });
        created++;
      }
      toast.success(`Importati ${created} pannelli (${totalKept} valori) dal referto AI`);
      reset();
      onOpenChange(false);
      if (onImported) onImported();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore durante il salvataggio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto" data-testid="lab-import-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading font-black tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-600" />
            Importa esami di laboratorio (AI)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload step */}
          {!extracted && (
            <Card className="p-6 border-dashed border-2 border-gray-300 bg-gray-50/50">
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={onFilePick}
                data-testid="lab-import-file"
              />
              <div className="text-center space-y-3">
                <Upload className="w-10 h-10 text-gray-400 mx-auto" />
                <div>
                  <h3 className="font-heading font-bold text-base">Carica un referto di laboratorio</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    PDF o foto (JPEG/PNG/WEBP, max 15 MB). L'AI estrarrà automaticamente i valori dei test riconosciuti.
                  </p>
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
                      className="bg-violet-600 text-white hover:bg-violet-700"
                      data-testid="lab-parse-btn"
                    >
                      {parsing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analisi in corso (10-30 sec)…
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" /> Estrai con AI
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Review step */}
          {extracted && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-md">
                <div className="flex items-center gap-2 text-sm text-emerald-900">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    <strong>{totalKept}</strong> valori da <strong>{Object.keys(editedPanels).length}</strong> pannelli pronti per l'importazione.
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={reset} data-testid="lab-restart">
                  <X className="w-3.5 h-3.5 mr-1" /> Riparti
                </Button>
              </div>

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
                      <div className="space-y-2">
                        {(panelDef.tests || []).map((t) => {
                          const cur = vals?.[t.key];
                          const present = !!cur;
                          return (
                            <div
                              key={t.key}
                              className={`flex items-center gap-2 p-2 rounded border ${
                                present ? "bg-blue-50/40 border-blue-200" : "bg-gray-50 border-gray-200 opacity-50"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={present}
                                onChange={() => togglePanelTest(panelKey, t.key)}
                                className="w-4 h-4"
                                data-testid={`lab-toggle-${panelKey}-${t.key}`}
                              />
                              <div className="flex-1 text-xs">{t.label}</div>
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
                                      className="w-24 text-xs h-7 px-2 border border-gray-200 rounded font-mono"
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
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>
            {extracted ? "Annulla" : "Chiudi"}
          </Button>
          {extracted && (
            <Button
              onClick={save}
              disabled={saving || totalKept === 0}
              className="bg-[#0A2540] text-white hover:bg-[#051626]"
              data-testid="lab-import-save-btn"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Salva {totalKept} valori
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
