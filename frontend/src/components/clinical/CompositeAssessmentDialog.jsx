import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import { Textarea } from "../ui/textarea";
import { Card } from "../ui/card";
import ItalianDatePicker from "../shared/ItalianDatePicker";
import Homunculus, { countTenderIn, countSwollenIn, countTender, countSwollen } from "../imaging/Homunculus";
import {
  calcDAS28_ESR, calcDAS28_CRP, calcCDAI, calcSDAI, calcBASDAI, calcASDAS_CRP, calcBASFI,
  calcDAPSA, calcLEI, calcPASI,
  interpretDAS28, interpretCDAI, interpretSDAI, interpretBASDAI, interpretASDAS, interpretBASFI,
  interpretDAPSA, interpretLEI, interpretPASI,
  validateRAScores, validateSpAScores, validatePsAScores,
  JOINTS_DAS28, BASFI_QUESTIONS, LEI_SITES, PASI_REGIONS,
} from "../../lib/clinimetrics";
import { assessmentsApi, labExamsApi } from "../../lib/api";
import { toast } from "sonner";
import { Save, Zap, Copy } from "lucide-react";
import { Checkbox } from "../ui/checkbox";
import EnthesisBodyChart from "../imaging/EnthesisBodyChart";
import { VasSlider, ResultTile, QrScanButton } from "./CompositeFormParts";
import { applyPrevToRa, applyPrevToSpa, applyPrevToPsa } from "../../lib/compositeReusePrev";

/**
 * Form compositi che condividono input tra indici della stessa malattia.
 *   mode="ra"  → DAS28-ESR + DAS28-CRP + CDAI + SDAI  (stesso TJC/SJC/PGA/EGA)
 *   mode="spa" → BASDAI + ASDAS-CRP + BASFI          (voci VAS in comune)
 */

const VAS_DEFAULT = 0;

export default function CompositeAssessmentDialog({ open, onClose, mode, patient, onSaved, initialJoints, initialLeiSites, onJointsSaved, visitId, visitType, visitDate }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(visitDate || today);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [prevVisit, setPrevVisit] = useState(null); // {date, payload}
  const [copied, setCopied] = useState(false);
  const [fromExamObj, setFromExamObj] = useState(false);

  // RA shared state
  const [joints, setJoints] = useState({});
  const [esr, setEsr] = useState("");
  const [crp, setCrp] = useState("");
  const [pga, setPga] = useState(null);
  const [ega, setEga] = useState(null);

  // SpA shared state (BASDAI q1-q6, ASDAS extra pga, BASFI q1-q10)
  const [bas, setBas] = useState({}); // q1..q6 BASDAI
  const [asdasPga, setAsdasPga] = useState(0);
  const [basfiVals, setBasfiVals] = useState({}); // q1..q10

  // PsA shared state (DAPSA = joints 66/68 + PGA + patientPain + CRP; LEI = sites; PASI = regions)
  const [patientPain, setPatientPain] = useState(0); // VAS dolore paziente DAPSA
  const [leiSites, setLeiSites] = useState({});
  const [pasiData, setPasiData] = useState({ head: {}, upper: {}, trunk: {}, lower: {} });

  const reset = () => {
    setDate(visitDate || new Date().toISOString().slice(0, 10));
    setNotes("");
    setJoints({}); setEsr(""); setCrp(""); setPga(null); setEga(null);
    setBas({}); setAsdasPga(0); setBasfiVals({});
    setPatientPain(0); setLeiSites({}); setPasiData({ head: {}, upper: {}, trunk: {}, lower: {} });
    setCopied(false); setFromExamObj(false);
  };

  // ===== Reset + pre-popola da Esame obiettivo ogni volta che il dialog si apre =====
  useEffect(() => {
    if (!open) return;
    reset();
    if ((mode === "psa" || mode === "ra") && initialJoints && Object.keys(initialJoints).length > 0) {
      setJoints(initialJoints);
      setFromExamObj(true);
    }
    if (mode === "psa" && initialLeiSites && Object.keys(initialLeiSites).length > 0) {
      setLeiSites(initialLeiSites);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== Auto-importa VES/PCR dagli esami strutturati della stessa visita =====
  const loadLabsFromDB = useCallback(async () => {
    if (!patient?.id) return;
    try {
      const all = await labExamsApi.listByPatient(patient.id);
      if (!Array.isArray(all) || all.length === 0) return;
      const sorted = [...all].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      const withPcr = sorted.find((e) => e.values?.crp?.value != null);
      const withVes = sorted.find((e) => e.values?.ves?.value != null);
      if (withPcr) setCrp(String(withPcr.values.crp.value));
      if (withVes) setEsr(String(withVes.values.ves.value));
    } catch {
      // silenzioso — i campi rimangono vuoti
    }
  }, [patient?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !patient?.id) return;
    if (mode !== "ra" && mode !== "psa" && mode !== "spa") return;
    loadLabsFromDB();
  }, [open, patient?.id, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== Carica ultima visita composita (quando il dialog si apre) =====
  useEffect(() => {
    if (!open || !patient?.id) return;
    const loadPrev = async () => {
      try {
        const all = await assessmentsApi.listByPatient(patient.id);
        if (!Array.isArray(all) || all.length === 0) { setPrevVisit(null); return; }
        // Pivot per ogni modalità — include joint_exam come fallback per RA e PsA
        // (joint_exam viene creato dall'import da testo quando non c'è un punteggio composito)
        const PIVOT_TYPES = {
          ra:  ["das28_esr", "das28_crp", "cdai", "sdai", "joint_exam"],
          spa: ["basdai", "asdas_crp"],
          psa: ["dapsa", "joint_exam"],
        };
        const pivotTypes = PIVOT_TYPES[mode] || [];
        const sortedByDate = [...all].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        const pivot = sortedByDate.find((a) => pivotTypes.includes(a.index_type));
        if (!pivot) { setPrevVisit(null); return; }
        const visitDate = pivot.date;
        const visitItems = all.filter((a) => a.date === visitDate);
        setPrevVisit({ date: visitDate, items: visitItems });
      } catch {
        setPrevVisit(null);
      }
    };
    loadPrev();
  }, [open, patient?.id, mode]);

  // ===== Applica precompilazione dal prevVisit =====
  const applyCopyFromPrev = () => {
    if (!prevVisit?.items) return;
    const setters = {
      setJoints, setEsr, setCrp, setPga, setEga,
      setBas, setAsdasPga, setBasfiVals,
      setPatientPain, setLeiSites, setPasiData,
    };
    if (mode === "ra") applyPrevToRa(prevVisit, setters);
    else if (mode === "spa") applyPrevToSpa(prevVisit, setters);
    else if (mode === "psa") applyPrevToPsa(prevVisit, setters);
    setCopied(true); setFromExamObj(false);
    toast.success(`Valori precompilati dalla visita del ${new Date(prevVisit.date).toLocaleDateString("it-IT")}`);
  };

  // ===== RA computations =====
  const jointsTouched = Object.keys(joints).length > 0;
  const tjc28 = jointsTouched ? countTenderIn(joints, JOINTS_DAS28) : null;
  const sjc28 = jointsTouched ? countSwollenIn(joints, JOINTS_DAS28) : null;
  const tjcAll = countTender(joints);
  const sjcAll = countSwollen(joints);

  const raResults = useMemo(() => {
    if (mode !== "ra") return null;
    const validation = validateRAScores({ esr, crp, pga, ega, tjc28, sjc28 });
    const gh = pga !== null ? (Number(pga) || 0) * 10 : 0;
    return {
      das28_esr: { score: calcDAS28_ESR({ tjc: tjc28 ?? 0, sjc: sjc28 ?? 0, esr, gh }), interp: interpretDAS28, missing: validation.das28_esr.missing },
      das28_crp: { score: calcDAS28_CRP({ tjc: tjc28 ?? 0, sjc: sjc28 ?? 0, crp, gh }), interp: interpretDAS28, missing: validation.das28_crp.missing },
      cdai:      { score: calcCDAI({ tjc28: tjc28 ?? 0, sjc28: sjc28 ?? 0, pga: pga ?? 0, ega: ega ?? 0 }), interp: interpretCDAI, missing: validation.cdai.missing },
      sdai:      { score: calcSDAI({ tjc28: tjc28 ?? 0, sjc28: sjc28 ?? 0, pga: pga ?? 0, ega: ega ?? 0, crp }), interp: interpretSDAI, missing: validation.sdai.missing },
    };
  }, [mode, tjc28, sjc28, esr, crp, pga, ega]);

  // ===== SpA computations =====
  const spaResults = useMemo(() => {
    if (mode !== "spa") return null;
    const validation = validateSpAScores({ crp });
    return {
      basdai: {
        score: calcBASDAI({ q1: bas.q1, q2: bas.q2, q3: bas.q3, q4: bas.q4, q5: bas.q5, q6: bas.q6 }),
        interp: interpretBASDAI,
        missing: validation.basdai.missing,
      },
      asdas_crp: {
        score: calcASDAS_CRP({ backPain: bas.q2, morningStiffness: bas.q6, pga: asdasPga, peripheralPain: bas.q3, crp }),
        interp: interpretASDAS,
        missing: validation.asdas_crp.missing,
      },
      basfi: {
        score: calcBASFI(basfiVals),
        interp: interpretBASFI,
        missing: validation.basfi.missing,
      },
    };
  }, [mode, bas, asdasPga, crp, basfiVals]);

  // ===== PsA computations =====
  const psaResults = useMemo(() => {
    if (mode !== "psa") return null;
    const validation = validatePsAScores({ crp, pga, ega, tjc28, sjc28 });
    return {
      dapsa: { score: calcDAPSA({ tjc68: tjcAll, sjc66: sjcAll, pga, patientPain, crp }), interp: interpretDAPSA, missing: validation.dapsa.missing },
      cdai:  { score: calcCDAI({ tjc28: tjc28 ?? 0, sjc28: sjc28 ?? 0, pga: pga ?? 0, ega: ega ?? 0 }), interp: interpretCDAI, missing: validation.cdai.missing },
      sdai:  { score: calcSDAI({ tjc28: tjc28 ?? 0, sjc28: sjc28 ?? 0, pga: pga ?? 0, ega: ega ?? 0, crp }), interp: interpretSDAI, missing: validation.sdai.missing },
      lei:   { score: calcLEI(leiSites),  interp: interpretLEI,  missing: validation.lei.missing },
      pasi:  { score: calcPASI(pasiData), interp: interpretPASI, missing: validation.pasi.missing },
    };
  }, [mode, tjcAll, sjcAll, tjc28, sjc28, pga, ega, patientPain, crp, leiSites, pasiData]);

  // ===== Save =====
  const handleSave = async () => {
    if (!patient?.id) return;
    setSaving(true);
    try {
      // Extra fields to attach when assessment is linked to a specific visit
      const visitLink = visitId ? { visit_id: visitId, visit_type: visitType || "workup" } : {};

      let savedIndexTypes = [];
      if (mode === "ra") {
        const allItems = Object.entries(raResults).map(([index_type, r]) => ({
          patient_id: patient.id,
          index_type,
          date,
          score: r.score,
          interpretation: r.interp(r.score),
          tender_joints: Object.entries(joints).filter(([_, v]) => v === "tender" || v === "both").map(([k]) => k),
          swollen_joints: Object.entries(joints).filter(([_, v]) => v === "swollen" || v === "both").map(([k]) => k),
          inputs: { esr, crp, pga, ega, tjc28, sjc28, tjc_all: tjcAll, sjc_all: sjcAll },
          notes,
          ...visitLink,
          _missing: r.missing,
        }));
        const items = allItems.filter(i => !i._missing?.length).map(({ _missing, ...i }) => i);
        const skipped = allItems.filter(i => i._missing?.length).map(i => i.index_type.toUpperCase());
        if (!items.length) { toast.error("Nessuno score completato: inserisci VES e/o PCR per salvare."); setSaving(false); return; }
        await Promise.all(items.map((p) => assessmentsApi.create(p)));
        savedIndexTypes = items.map(i => i.index_type);
        const savedNames = items.map(i => i.index_type.replace("_", "-").toUpperCase()).join(", ");
        const msg = skipped.length ? `Salvate: ${savedNames}. Saltate (dati mancanti): ${skipped.join(", ")}` : `${items.length} valutazioni AR salvate`;
        toast.success(msg);
      } else if (mode === "spa") {
        const allSpa = [
          {
            index_type: "basdai", score: spaResults.basdai.score,
            interpretation: spaResults.basdai.interp(spaResults.basdai.score),
            inputs: { ...bas },
            _missing: spaResults.basdai.missing,
          },
          {
            index_type: "asdas_crp", score: spaResults.asdas_crp.score,
            interpretation: spaResults.asdas_crp.interp(spaResults.asdas_crp.score),
            inputs: { backPain: bas.q2, morningStiffness: bas.q6, pga: asdasPga, peripheralPain: bas.q3, crp },
            _missing: spaResults.asdas_crp.missing,
          },
          {
            index_type: "basfi", score: spaResults.basfi.score,
            interpretation: spaResults.basfi.interp(spaResults.basfi.score),
            inputs: { ...basfiVals },
            _missing: spaResults.basfi.missing,
          },
        ];
        const items = allSpa.filter(i => !i._missing?.length).map(({ _missing, ...i }) => ({ ...i, patient_id: patient.id, date, notes, ...visitLink }));
        const skipped = allSpa.filter(i => i._missing?.length).map(i => i.index_type.toUpperCase());
        if (!items.length) { toast.error("Nessuno score completato: inserisci PCR per ASDAS."); setSaving(false); return; }
        await Promise.all(items.map((p) => assessmentsApi.create(p)));
        savedIndexTypes = items.map(i => i.index_type);
        const savedNames = items.map(i => i.index_type.replace("_", "-").toUpperCase()).join(", ");
        const msg = skipped.length ? `Salvate: ${savedNames}. Saltate: ${skipped.join(", ")}` : "3 valutazioni SpA salvate (BASDAI, ASDAS-PCR, BASFI)";
        toast.success(msg);
      } else if (mode === "psa") {
        const tenderKeys = Object.entries(joints).filter(([_, v]) => v === "tender" || v === "both").map(([k]) => k);
        const swollenKeys = Object.entries(joints).filter(([_, v]) => v === "swollen" || v === "both").map(([k]) => k);
        const allPsa = [
          {
            index_type: "dapsa", score: psaResults.dapsa.score,
            interpretation: psaResults.dapsa.interp(psaResults.dapsa.score),
            tender_joints: tenderKeys,
            swollen_joints: swollenKeys,
            inputs: { tjc68: tjcAll, sjc66: sjcAll, pga, patientPain, crp },
            _missing: psaResults.dapsa.missing,
          },
          {
            index_type: "cdai", score: psaResults.cdai.score,
            interpretation: psaResults.cdai.interp(psaResults.cdai.score),
            tender_joints: tenderKeys,
            swollen_joints: swollenKeys,
            inputs: { tjc28, sjc28, pga, ega, crp },
            _missing: psaResults.cdai.missing,
          },
          {
            index_type: "sdai", score: psaResults.sdai.score,
            interpretation: psaResults.sdai.interp(psaResults.sdai.score),
            tender_joints: tenderKeys,
            swollen_joints: swollenKeys,
            inputs: { tjc28, sjc28, pga, ega, crp },
            _missing: psaResults.sdai.missing,
          },
          {
            index_type: "lei", score: psaResults.lei.score,
            interpretation: psaResults.lei.interp(psaResults.lei.score),
            inputs: { sites: leiSites },
            _missing: psaResults.lei.missing,
          },
          {
            index_type: "pasi", score: psaResults.pasi.score,
            interpretation: psaResults.pasi.interp(psaResults.pasi.score),
            inputs: { ...pasiData },
            _missing: psaResults.pasi.missing,
          },
        ];
        const items = allPsa.filter(i => !i._missing?.length).map(({ _missing, ...i }) => ({ ...i, patient_id: patient.id, date, notes, ...visitLink }));
        const skipped = allPsa.filter(i => i._missing?.length).map(i => i.index_type.toUpperCase());
        if (!items.length) { toast.error("Nessuno score completato: inserisci PCR per DAPSA."); setSaving(false); return; }
        await Promise.all(items.map((p) => assessmentsApi.create(p)));
        savedIndexTypes = items.map(i => i.index_type);
        const savedNames = items.map(i => i.index_type.toUpperCase()).join(", ");
        const msg = skipped.length ? `Salvate: ${savedNames}. Saltate (dati mancanti): ${skipped.join(", ")}` : `${items.length} valutazioni PsA salvate`;
        toast.success(msg);
        onJointsSaved?.(joints, leiSites);
      }
      reset();
      onSaved && onSaved(savedIndexTypes);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const title = mode === "ra"
    ? "AR — Form unificato: DAS28-VES, DAS28-PCR, CDAI, SDAI"
    : mode === "spa"
    ? "SpA — Form unificato: BASDAI, ASDAS-PCR, BASFI"
    : "AP — Form unificato: DAPSA, CDAI, SDAI, LEI, PASI";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto" data-testid={`composite-${mode}-dialog`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600" />
            {title}
          </DialogTitle>
          <p className="text-xs text-gray-500 mt-1">
            Compila una sola volta i dati condivisi: {mode === "ra"
              ? "i punteggi DAS28-VES, DAS28-PCR, CDAI e SDAI verranno calcolati e salvati insieme."
              : mode === "spa"
              ? "i punteggi BASDAI, ASDAS-PCR e BASFI condividono le voci VAS e verranno salvati insieme."
              : "DAPSA (66/68), CDAI/SDAI (TJC28/SJC28 + PGA + PhGA ± PCR), LEI (entesiti) e PASI verranno salvati insieme."}
          </p>
        </DialogHeader>

        <div className="space-y-5">
          {/* Banner "Copia dalla visita precedente" */}
          {prevVisit && (
            <div
              className={`flex items-center justify-between gap-3 rounded-md border p-3 ${
                copied ? "bg-green-50 border-green-200" : "bg-blue-50/60 border-blue-200"
              }`}
              data-testid="copy-prev-banner"
            >
              <div className="flex items-start gap-2.5">
                <Copy className={`w-4 h-4 mt-0.5 flex-shrink-0 ${copied ? "text-green-700" : "text-blue-700"}`} />
                <div className="text-xs">
                  <div className="font-semibold text-gray-900">
                    {copied
                      ? `✓ Pre-compilato dalla visita del ${new Date(prevVisit.date).toLocaleDateString("it-IT")}`
                      : `Ultima visita ${mode === "ra" ? "AR" : mode === "spa" ? "SpA" : "AP"} disponibile: ${new Date(prevVisit.date).toLocaleDateString("it-IT")}`}
                  </div>
                  <div className="text-gray-600 mt-0.5">
                    {copied
                      ? "Modifica solo i campi cambiati e salva."
                      : "Pre-compila tutti i campi dall'ultima valutazione e aggiorna solo quanto è cambiato."}
                  </div>
                </div>
              </div>
              {!copied && (
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white hover:bg-blue-50 border-blue-300 text-blue-800 flex-shrink-0"
                  onClick={applyCopyFromPrev}
                  data-testid="copy-prev-btn"
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" /> Copia valori
                </Button>
              )}
            </div>
          )}

          {/* Date + Notes */}
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-3 items-end">
            <div>
              <Label className="text-xs uppercase tracking-[0.1em] text-gray-500">
                Data clinica
                {visitDate && (
                  <span className="ml-2 text-[10px] font-normal normal-case tracking-normal text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">
                    ereditata dalla visita
                  </span>
                )}
              </Label>
              <ItalianDatePicker value={date} onChange={visitDate ? undefined : setDate} disabled={!!visitDate} />
            </div>
          </div>

          {mode === "ra" ? (
            <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
              <div>
                {fromExamObj && (
                  <div className="inline-flex items-center gap-1.5 mb-2 px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-[10px] font-semibold text-teal-700">
                    <span>↩</span> Sincronizzato dall'Esame obiettivo
                  </div>
                )}
                <Homunculus mode="66_68" joints={joints} onChange={setJoints} title="Conta articolare 66/68 · TJC28 e SJC28 calcolati automaticamente" />
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="border rounded-md p-2"><div className="text-gray-500 text-[10px]">TJC28</div><div className="font-mono font-bold text-[#0A2540]" data-testid="ra-tjc28">{tjc28 ?? "—"}</div></div>
                  <div className="border rounded-md p-2"><div className="text-gray-500 text-[10px]">SJC28</div><div className="font-mono font-bold text-[#FF3333]" data-testid="ra-sjc28">{sjc28 ?? "—"}</div></div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-600">VES (mm/h)</Label>
                    <Input type="number" value={esr} onChange={(e) => setEsr(e.target.value)} placeholder="es. 28" data-testid="ra-esr" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">PCR (mg/dL)</Label>
                    <Input type="number" step="0.1" value={crp} onChange={(e) => setCrp(e.target.value)} placeholder="es. 1.2" data-testid="ra-crp" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm"
                    className="text-[10px] h-6 px-2 border-gray-300 text-gray-500 hover:bg-gray-50"
                    onClick={loadLabsFromDB}
                  >
                    Ricarica dai lab
                  </Button>
                </div>
                <div className="space-y-1" data-testid="ra-pga">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-medium leading-snug flex-1">PtGA — Patient Global Assessment (0-10)</Label>
                    <div className="flex items-center gap-1.5">
                      <QrScanButton onValue={(v) => setPga(v > 10 ? Math.min(10, v / 10) : v)} fieldLabel="PtGA" />
                      <Input type="number" min={0} max={10} step="0.1" className="w-20 text-sm h-8" value={pga ?? ""} onChange={(e) => setPga(e.target.value)} />
                    </div>
                  </div>
                  <Slider min={0} max={10} step={0.1} value={[Number(pga) || 0]} onValueChange={([val]) => setPga(val)} />
                  <p className="text-[10px] text-gray-500 leading-tight">Attività di malattia percepita dal paziente · 0 = nessuna · 10 = massima · Scansiona QR per precompilare (scala 0–100 mm VAS o 0–10)</p>
                </div>
                <VasSlider label="PhGA — Physician Global Assessment (0-10)" value={ega} onChange={setEga} hint="Attività di malattia valutata dal medico · 0 = nessuna · 10 = massima" testid="ra-ega" />

                <Card className="p-3 bg-gray-50/60">
                  <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold mb-2">Risultati in tempo reale</div>
                  <div className="grid grid-cols-2 gap-2">
                    <ResultTile hideIfIncomplete title="DAS28-VES" score={raResults.das28_esr.score} interp={raResults.das28_esr.interp(raResults.das28_esr.score)} missingFields={raResults.das28_esr.missing} testid="ra-result-das28-esr" />
                    <ResultTile hideIfIncomplete title="DAS28-PCR" score={raResults.das28_crp.score} interp={raResults.das28_crp.interp(raResults.das28_crp.score)} missingFields={raResults.das28_crp.missing} testid="ra-result-das28-crp" />
                    <ResultTile hideIfIncomplete title="CDAI" score={raResults.cdai.score} interp={raResults.cdai.interp(raResults.cdai.score)} missingFields={raResults.cdai.missing} testid="ra-result-cdai" />
                    <ResultTile hideIfIncomplete title="SDAI" score={raResults.sdai.score} interp={raResults.sdai.interp(raResults.sdai.score)} missingFields={raResults.sdai.missing} testid="ra-result-sdai" />
                  </div>
                </Card>
              </div>
            </div>
          ) : mode === "spa" ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* BASDAI + ASDAS shared */}
              <div className="space-y-3">
                <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Domande VAS condivise (BASDAI + ASDAS)</h3>
                <VasSlider label="1. Affaticamento/fatica complessiva nell'ultima settimana" value={bas.q1} onChange={(v) => setBas((p) => ({ ...p, q1: v }))} testid="spa-q1" />
                <VasSlider label="2. Dolore spinale (collo, schiena, anche)" value={bas.q2} onChange={(v) => setBas((p) => ({ ...p, q2: v }))} hint="Usato anche per ASDAS (back pain)" testid="spa-q2" />
                <VasSlider label="3. Dolore/gonfiore articolare periferico" value={bas.q3} onChange={(v) => setBas((p) => ({ ...p, q3: v }))} hint="Usato anche per ASDAS (peripheral pain)" testid="spa-q3" />
                <VasSlider label="4. Dolore alla palpazione / entesite" value={bas.q4} onChange={(v) => setBas((p) => ({ ...p, q4: v }))} testid="spa-q4" />
                <VasSlider label="5. Severità della rigidità mattutina" value={bas.q5} onChange={(v) => setBas((p) => ({ ...p, q5: v }))} testid="spa-q5" />
                <VasSlider label="6. Durata della rigidità mattutina" value={bas.q6} onChange={(v) => setBas((p) => ({ ...p, q6: v }))} hint="0 = nessuna · 10 = ≥2 ore · Usato anche per ASDAS" testid="spa-q6" />

                <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700 pt-2">Specifici ASDAS</h3>
                <VasSlider label="PGA — Valutazione globale del paziente (0-10)" value={asdasPga} onChange={setAsdasPga} testid="spa-pga" />
                <div>
                  <Label className="text-xs text-gray-600">PCR (mg/L)</Label>
                  <Input type="number" step="0.1" value={crp} onChange={(e) => setCrp(e.target.value)} placeholder="es. 8.0" data-testid="spa-crp" />
                </div>
              </div>

              {/* BASFI questions */}
              <div className="space-y-3">
                <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">BASFI — 10 domande funzionali (VAS 0-10)</h3>
                {BASFI_QUESTIONS.map((q, i) => {
                  const key = `q${i + 1}`;
                  return (
                    <VasSlider
                      key={key}
                      label={`${i + 1}. ${q}`}
                      value={basfiVals[key]}
                      onChange={(v) => setBasfiVals((p) => ({ ...p, [key]: v }))}
                      testid={`basfi-${key}`}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            /* PSA mode */
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">DAPSA — Articolazioni 66/68</h3>
                    {fromExamObj && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-[10px] font-semibold text-teal-700">
                        ↩ Da Esame obiettivo
                      </span>
                    )}
                  </div>
                  <Homunculus mode="66_68" joints={joints} onChange={setJoints} title={null} />
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="border rounded-md p-2 text-center">
                      <div className="text-gray-500 text-[10px]">TJ68</div>
                      <div className="font-mono font-bold text-[#0055FF]" data-testid="psa-tjc68">{tjcAll}</div>
                    </div>
                    <div className="border rounded-md p-2 text-center">
                      <div className="text-gray-500 text-[10px]">SJ66</div>
                      <div className="font-mono font-bold text-[#FF3333]" data-testid="psa-sjc66">{sjcAll}</div>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div className="border rounded-md p-2 text-center bg-gray-50">
                      <div className="text-gray-500 text-[10px]">TJC28</div>
                      <div className="font-mono font-bold text-[#0055FF]" data-testid="psa-tjc28">{tjc28 ?? "—"}</div>
                    </div>
                    <div className="border rounded-md p-2 text-center bg-gray-50">
                      <div className="text-gray-500 text-[10px]">SJC28</div>
                      <div className="font-mono font-bold text-[#FF3333]" data-testid="psa-sjc28">{sjc28 ?? "—"}</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-gray-600">PCR (mg/dL)</Label>
                    <Input type="number" step="0.1" value={crp} onChange={(e) => setCrp(e.target.value)} placeholder="es. 1.2" data-testid="psa-crp" />
                  </div>
                  <VasSlider label="PGA — Valutazione globale paziente (0-10)" value={pga} onChange={setPga} testid="psa-pga" />
                  <VasSlider label="Dolore paziente (0-10)" value={patientPain} onChange={setPatientPain} hint="Dolore articolare percepito su scala VAS" testid="psa-pain" />
                  <VasSlider label="PhGA — Physician Global Assessment (0-10)" value={ega} onChange={setEga} hint="Attività di malattia valutata dal medico · 0 = nessuna · 10 = massima · Usato per CDAI e SDAI" testid="psa-ega" />

                  {/* LEI body chart */}
                  <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">LEI — Entesiti</h3>
                      {fromExamObj && initialLeiSites && Object.keys(initialLeiSites).length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-[10px] font-semibold text-teal-700">
                          ↩ Da Esame obiettivo
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4 items-start">
                      <EnthesisBodyChart
                        sites={leiSites}
                        onChange={setLeiSites}
                        labels={Object.fromEntries(LEI_SITES.map((s) => [s.key, s.label]))}
                        title={null}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 self-start">
                        {LEI_SITES.map((s) => {
                          const checked = !!leiSites[s.key];
                          return (
                            <button
                              key={s.key}
                              type="button"
                              onClick={() => setLeiSites((p) => ({ ...p, [s.key]: !checked }))}
                              className={`text-left flex items-center gap-2 border rounded-md p-1.5 transition ${
                                checked ? "border-red-300 bg-red-50/60" : "border-gray-200 hover:bg-gray-50"
                              }`}
                              data-testid={`psa-lei-${s.key}`}
                            >
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${checked ? "bg-red-600" : "bg-gray-300"}`} />
                              <span className="text-[11px] flex-1 leading-tight">{s.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* PASI regions */}
              <div>
                <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700 mb-3">PASI — 4 regioni cutanee</h3>
                <p className="text-[11px] text-gray-500 mb-2">
                  E = Eritema, I = Infiltrazione, D = Desquamazione (0-4 ciascuno) · A = Area % coinvolta (0-6)
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {PASI_REGIONS.map((reg) => (
                    <Card key={reg.key} className="p-2.5">
                      <div className="text-sm font-bold text-[#0A2540] mb-1.5">{reg.label}</div>
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { k: "E", max: 4, label: "E" },
                          { k: "I", max: 4, label: "I" },
                          { k: "D", max: 4, label: "D" },
                          { k: "A", max: 6, label: "A" },
                        ].map((f) => (
                          <div key={f.k}>
                            <Label className="text-[9px] uppercase tracking-wider text-gray-500 block">{f.label}</Label>
                            <Input
                              type="number" min={0} max={f.max} step="1"
                              className="text-sm h-8 px-1.5 text-center"
                              value={pasiData[reg.key]?.[f.k] ?? ""}
                              onChange={(e) =>
                                setPasiData((p) => ({
                                  ...p,
                                  [reg.key]: { ...p[reg.key], [f.k]: e.target.value },
                                }))
                              }
                              data-testid={`psa-pasi-${reg.key}-${f.k}`}
                            />
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}

          {mode === "spa" && (
            <Card className="p-3 bg-gray-50/60">
              <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold mb-2">Risultati in tempo reale</div>
              <div className="grid grid-cols-3 gap-2">
                <ResultTile title="BASDAI" score={spaResults.basdai.score} interp={spaResults.basdai.interp(spaResults.basdai.score)} missingFields={spaResults.basdai.missing} testid="spa-result-basdai" />
                <ResultTile title="ASDAS-PCR" score={spaResults.asdas_crp.score} interp={spaResults.asdas_crp.interp(spaResults.asdas_crp.score)} missingFields={spaResults.asdas_crp.missing} testid="spa-result-asdas" />
                <ResultTile title="BASFI" score={spaResults.basfi.score} interp={spaResults.basfi.interp(spaResults.basfi.score)} missingFields={spaResults.basfi.missing} testid="spa-result-basfi" />
              </div>
            </Card>
          )}

          {mode === "psa" && (
            <Card className="p-3 bg-gray-50/60">
              <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold mb-2">Risultati in tempo reale</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                <ResultTile title="DAPSA" score={psaResults.dapsa.score} interp={psaResults.dapsa.interp(psaResults.dapsa.score)} missingFields={psaResults.dapsa.missing} testid="psa-result-dapsa" />
                <ResultTile hideIfIncomplete title="CDAI" score={psaResults.cdai.score} interp={psaResults.cdai.interp(psaResults.cdai.score)} missingFields={psaResults.cdai.missing} testid="psa-result-cdai" />
                <ResultTile hideIfIncomplete title="SDAI" score={psaResults.sdai.score} interp={psaResults.sdai.interp(psaResults.sdai.score)} missingFields={psaResults.sdai.missing} testid="psa-result-sdai" />
                <ResultTile title="LEI" score={psaResults.lei.score} interp={psaResults.lei.interp(psaResults.lei.score)} subtitle="/ 6" missingFields={psaResults.lei.missing} testid="psa-result-lei" />
                <ResultTile title="PASI" score={psaResults.pasi.score} interp={psaResults.pasi.interp(psaResults.pasi.score)} missingFields={psaResults.pasi.missing} testid="psa-result-pasi" />
              </div>
            </Card>
          )}

          {/* Notes */}
          <div>
            <Label className="text-xs uppercase tracking-[0.1em] text-gray-500">Note cliniche (condivise)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="composite-notes" />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="ghost" onClick={onClose} data-testid="composite-cancel">Annulla</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#0A2540] text-white hover:bg-[#051626]" data-testid="composite-save">
              <Save className="w-4 h-4 mr-2" /> {saving ? "Salvataggio..." : mode === "ra" ? "Salva 4 valutazioni" : mode === "psa" ? "Salva valutazioni" : "Salva 3 valutazioni"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
