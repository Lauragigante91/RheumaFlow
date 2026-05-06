import React, { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { Textarea } from "./ui/textarea";
import { Card } from "./ui/card";
import ItalianDatePicker from "./ItalianDatePicker";
import Homunculus, { countTenderIn, countSwollenIn, countTender, countSwollen } from "./Homunculus";
import {
  calcDAS28_ESR, calcDAS28_CRP, calcCDAI, calcSDAI, calcBASDAI, calcASDAS_CRP, calcBASFI,
  calcDAPSA, calcLEI, calcPASI,
  interpretDAS28, interpretCDAI, interpretSDAI, interpretBASDAI, interpretASDAS, interpretBASFI,
  interpretDAPSA, interpretLEI, interpretPASI,
  JOINTS_DAS28, BASFI_QUESTIONS, LEI_SITES, PASI_REGIONS,
} from "../lib/clinimetrics";
import { assessmentsApi } from "../lib/api";
import { toast } from "sonner";
import { Save, Zap, Copy } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import EnthesisBodyChart from "./EnthesisBodyChart";

/**
 * Form compositi che condividono input tra indici della stessa malattia.
 *   mode="ra"  → DAS28-ESR + DAS28-CRP + CDAI + SDAI  (stesso TJC/SJC/PGA/EGA)
 *   mode="spa" → BASDAI + ASDAS-CRP + BASFI          (voci VAS in comune)
 */

const VAS_DEFAULT = 0;

function VasSlider({ label, value, onChange, hint, testid }) {
  const v = Number(value) || 0;
  return (
    <div className="space-y-1" data-testid={testid}>
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium leading-snug flex-1">{label}</Label>
        <Input
          type="number" min={0} max={10} step="0.1"
          className="w-20 text-sm h-8"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <Slider min={0} max={10} step={0.1} value={[v]} onValueChange={([val]) => onChange(val)} />
      {hint && <p className="text-[10px] text-gray-500 leading-tight">{hint}</p>}
    </div>
  );
}

function ResultTile({ title, score, interp, subtitle, testid }) {
  return (
    <div className="border border-gray-200 rounded-md p-3" data-testid={testid}>
      <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold">{title}</div>
      <div className="flex items-baseline gap-2 mt-0.5">
        <span className="font-mono font-black text-2xl text-[#0A2540]" data-testid={`${testid}-score`}>
          {score === null || isNaN(score) ? "—" : score}
        </span>
        {subtitle && <span className="text-[10px] text-gray-500">{subtitle}</span>}
      </div>
      {interp && <div className="text-xs font-medium mt-0.5 text-gray-700">{interp}</div>}
    </div>
  );
}

export default function CompositeAssessmentDialog({ open, onClose, mode, patient, onSaved }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [prevVisit, setPrevVisit] = useState(null); // {date, payload}
  const [copied, setCopied] = useState(false);

  // RA shared state
  const [joints, setJoints] = useState({});
  const [esr, setEsr] = useState("");
  const [crp, setCrp] = useState("");
  const [pga, setPga] = useState(0);
  const [ega, setEga] = useState(0);

  // SpA shared state (BASDAI q1-q6, ASDAS extra pga, BASFI q1-q10)
  const [bas, setBas] = useState({}); // q1..q6 BASDAI
  const [asdasPga, setAsdasPga] = useState(0);
  const [basfiVals, setBasfiVals] = useState({}); // q1..q10

  // PsA shared state (DAPSA = joints 66/68 + PGA + patientPain + CRP; LEI = sites; PASI = regions)
  const [patientPain, setPatientPain] = useState(0); // VAS dolore paziente DAPSA
  const [leiSites, setLeiSites] = useState({});
  const [pasiData, setPasiData] = useState({ head: {}, upper: {}, trunk: {}, lower: {} });

  const reset = () => {
    setDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setJoints({}); setEsr(""); setCrp(""); setPga(0); setEga(0);
    setBas({}); setAsdasPga(0); setBasfiVals({});
    setPatientPain(0); setLeiSites({}); setPasiData({ head: {}, upper: {}, trunk: {}, lower: {} });
    setCopied(false);
  };

  // ===== Carica ultima visita composita (quando il dialog si apre) =====
  useEffect(() => {
    if (!open || !patient?.id) return;
    // Reset on open
    reset();
    const loadPrev = async () => {
      try {
        const all = await assessmentsApi.listByPatient(patient.id);
        if (!Array.isArray(all) || all.length === 0) { setPrevVisit(null); return; }
        // Pivot per ogni modalità
        const pivotType = mode === "ra" ? "das28_esr" : mode === "spa" ? "basdai" : "dapsa";
        const sortedByDate = [...all].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        const pivot = sortedByDate.find((a) => a.index_type === pivotType);
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
    const byType = Object.fromEntries(prevVisit.items.map((a) => [a.index_type, a]));
    if (mode === "ra") {
      // Ricostruisci joints dall'ultimo das28_esr o cdai (hanno tender_joints/swollen_joints)
      const srcJoints = byType.das28_esr || byType.das28_crp || byType.cdai || byType.sdai;
      const newJoints = {};
      (srcJoints?.tender_joints || []).forEach((k) => { newJoints[k] = "tender"; });
      (srcJoints?.swollen_joints || []).forEach((k) => {
        newJoints[k] = newJoints[k] === "tender" ? "both" : "swollen";
      });
      setJoints(newJoints);
      const ins = srcJoints?.inputs || {};
      setEsr(ins.esr ?? "");
      setCrp(ins.crp ?? "");
      setPga(Number(ins.pga) || 0);
      setEga(Number(ins.ega) || 0);
    } else if (mode === "spa") {
      const basdai = byType.basdai?.inputs || {};
      const asdas = byType.asdas_crp?.inputs || {};
      const basfi = byType.basfi?.inputs || {};
      setBas({
        q1: basdai.q1 ?? "", q2: basdai.q2 ?? asdas.backPain ?? "",
        q3: basdai.q3 ?? asdas.peripheralPain ?? "", q4: basdai.q4 ?? "",
        q5: basdai.q5 ?? "", q6: basdai.q6 ?? asdas.morningStiffness ?? "",
      });
      setAsdasPga(Number(asdas.pga) || 0);
      setCrp(asdas.crp ?? "");
      const bf = {};
      for (let i = 1; i <= 10; i++) bf[`q${i}`] = basfi[`q${i}`] ?? "";
      setBasfiVals(bf);
    } else if (mode === "psa") {
      // DAPSA — ricostruisci joints + PGA + dolore paziente + CRP
      const dapsa = byType.dapsa;
      const dapsaIns = dapsa?.inputs || {};
      const newJoints = {};
      (dapsa?.tender_joints || []).forEach((k) => { newJoints[k] = "tender"; });
      (dapsa?.swollen_joints || []).forEach((k) => {
        newJoints[k] = newJoints[k] === "tender" ? "both" : "swollen";
      });
      setJoints(newJoints);
      setPga(Number(dapsaIns.pga) || 0);
      setPatientPain(Number(dapsaIns.patientPain) || 0);
      setCrp(dapsaIns.crp ?? "");
      // LEI
      const lei = byType.lei?.inputs || {};
      setLeiSites(lei.sites || {});
      // PASI
      const pasiIns = byType.pasi?.inputs || {};
      const pd = { head: {}, upper: {}, trunk: {}, lower: {} };
      ["head", "upper", "trunk", "lower"].forEach((reg) => {
        if (pasiIns[reg]) pd[reg] = { ...pasiIns[reg] };
      });
      setPasiData(pd);
    }
    setCopied(true);
    toast.success(`Valori precompilati dalla visita del ${new Date(prevVisit.date).toLocaleDateString("it-IT")}`);
  };

  // ===== RA computations =====
  const tjc28 = countTenderIn(joints, JOINTS_DAS28);
  const sjc28 = countSwollenIn(joints, JOINTS_DAS28);
  const tjcAll = countTender(joints);
  const sjcAll = countSwollen(joints);

  const raResults = useMemo(() => {
    if (mode !== "ra") return null;
    return {
      das28_esr: { score: calcDAS28_ESR({ tjc: tjc28, sjc: sjc28, esr, gh: pga * 10 }), interp: interpretDAS28 },
      das28_crp: { score: calcDAS28_CRP({ tjc: tjc28, sjc: sjc28, crp, gh: pga * 10 }), interp: interpretDAS28 },
      cdai: { score: calcCDAI({ tjc28, sjc28, pga, ega }), interp: interpretCDAI },
      sdai: { score: calcSDAI({ tjc28, sjc28, pga, ega, crp }), interp: interpretSDAI },
    };
  }, [mode, tjc28, sjc28, esr, crp, pga, ega]);

  // ===== SpA computations =====
  const spaResults = useMemo(() => {
    if (mode !== "spa") return null;
    return {
      basdai: {
        score: calcBASDAI({ q1: bas.q1, q2: bas.q2, q3: bas.q3, q4: bas.q4, q5: bas.q5, q6: bas.q6 }),
        interp: interpretBASDAI,
      },
      asdas_crp: {
        score: calcASDAS_CRP({ backPain: bas.q2, morningStiffness: bas.q6, pga: asdasPga, peripheralPain: bas.q3, crp }),
        interp: interpretASDAS,
      },
      basfi: {
        score: calcBASFI(basfiVals),
        interp: interpretBASFI,
      },
    };
  }, [mode, bas, asdasPga, crp, basfiVals]);

  // ===== PsA computations =====
  const psaResults = useMemo(() => {
    if (mode !== "psa") return null;
    return {
      dapsa: { score: calcDAPSA({ tjc68: tjcAll, sjc66: sjcAll, pga, patientPain, crp }), interp: interpretDAPSA },
      lei: { score: calcLEI(leiSites), interp: interpretLEI },
      pasi: { score: calcPASI(pasiData), interp: interpretPASI },
    };
  }, [mode, tjcAll, sjcAll, pga, patientPain, crp, leiSites, pasiData]);

  // ===== Save =====
  const handleSave = async () => {
    if (!patient?.id) return;
    setSaving(true);
    try {
      if (mode === "ra") {
        const items = Object.entries(raResults).map(([index_type, r]) => ({
          patient_id: patient.id,
          index_type,
          date,
          score: r.score,
          interpretation: r.interp(r.score),
          tender_joints: Object.entries(joints).filter(([_, v]) => v === "tender" || v === "both").map(([k]) => k),
          swollen_joints: Object.entries(joints).filter(([_, v]) => v === "swollen" || v === "both").map(([k]) => k),
          inputs: { esr, crp, pga, ega, tjc28, sjc28, tjc_all: tjcAll, sjc_all: sjcAll },
          notes,
        }));
        await Promise.all(items.map((p) => assessmentsApi.create(p)));
        toast.success("4 valutazioni AR salvate (DAS28-VES, DAS28-PCR, CDAI, SDAI)");
      } else if (mode === "spa") {
        const items = [
          {
            index_type: "basdai", score: spaResults.basdai.score,
            interpretation: spaResults.basdai.interp(spaResults.basdai.score),
            inputs: { ...bas },
          },
          {
            index_type: "asdas_crp", score: spaResults.asdas_crp.score,
            interpretation: spaResults.asdas_crp.interp(spaResults.asdas_crp.score),
            inputs: { backPain: bas.q2, morningStiffness: bas.q6, pga: asdasPga, peripheralPain: bas.q3, crp },
          },
          {
            index_type: "basfi", score: spaResults.basfi.score,
            interpretation: spaResults.basfi.interp(spaResults.basfi.score),
            inputs: { ...basfiVals },
          },
        ].map((a) => ({ ...a, patient_id: patient.id, date, notes }));
        await Promise.all(items.map((p) => assessmentsApi.create(p)));
        toast.success("3 valutazioni SpA salvate (BASDAI, ASDAS-PCR, BASFI)");
      } else if (mode === "psa") {
        const tenderKeys = Object.entries(joints).filter(([_, v]) => v === "tender" || v === "both").map(([k]) => k);
        const swollenKeys = Object.entries(joints).filter(([_, v]) => v === "swollen" || v === "both").map(([k]) => k);
        const items = [
          {
            index_type: "dapsa", score: psaResults.dapsa.score,
            interpretation: psaResults.dapsa.interp(psaResults.dapsa.score),
            tender_joints: tenderKeys,
            swollen_joints: swollenKeys,
            inputs: { tjc68: tjcAll, sjc66: sjcAll, pga, patientPain, crp },
          },
          {
            index_type: "lei", score: psaResults.lei.score,
            interpretation: psaResults.lei.interp(psaResults.lei.score),
            inputs: { sites: leiSites },
          },
          {
            index_type: "pasi", score: psaResults.pasi.score,
            interpretation: psaResults.pasi.interp(psaResults.pasi.score),
            inputs: { ...pasiData },
          },
        ].map((a) => ({ ...a, patient_id: patient.id, date, notes }));
        await Promise.all(items.map((p) => assessmentsApi.create(p)));
        toast.success("3 valutazioni PsA salvate (DAPSA, LEI, PASI)");
      }
      reset();
      onSaved && onSaved();
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
    : "AP — Form unificato: DAPSA, LEI, PASI";

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
              : "DAPSA (articolazioni 66/68 + PGA + dolore + PCR), LEI (entesiti) e PASI (psoriasi) verranno salvati insieme."}
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
              <Label className="text-xs uppercase tracking-[0.1em] text-gray-500">Data visita</Label>
              <ItalianDatePicker value={date} onChange={setDate} />
            </div>
          </div>

          {mode === "ra" ? (
            <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
              <div>
                <Homunculus mode="66_68" joints={joints} onChange={setJoints} title="Conta articolare (TJC/SJC)" />
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="border rounded-md p-2"><div className="text-gray-500 text-[10px]">TJC28 (calcolo)</div><div className="font-mono font-bold text-[#0A2540]" data-testid="ra-tjc28">{tjc28}</div></div>
                  <div className="border rounded-md p-2"><div className="text-gray-500 text-[10px]">SJC28 (calcolo)</div><div className="font-mono font-bold text-[#FF3333]" data-testid="ra-sjc28">{sjc28}</div></div>
                  <div className="border rounded-md p-2"><div className="text-gray-500 text-[10px]">TJC totale</div><div className="font-mono font-bold">{tjcAll}</div></div>
                  <div className="border rounded-md p-2"><div className="text-gray-500 text-[10px]">SJC totale</div><div className="font-mono font-bold">{sjcAll}</div></div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-600">VES (mm/h)</Label>
                    <Input type="number" value={esr} onChange={(e) => setEsr(e.target.value)} placeholder="es. 28" data-testid="ra-esr" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">PCR (mg/L)</Label>
                    <Input type="number" step="0.1" value={crp} onChange={(e) => setCrp(e.target.value)} placeholder="es. 12.5" data-testid="ra-crp" />
                  </div>
                </div>
                <VasSlider label="PGA — Valutazione globale del paziente (0-10)" value={pga} onChange={setPga} hint="0 = nessuna attività · 10 = massima attività" testid="ra-pga" />
                <VasSlider label="EGA — Valutazione globale del medico (0-10)" value={ega} onChange={setEga} hint="0 = nessuna attività · 10 = massima attività" testid="ra-ega" />

                <Card className="p-3 bg-gray-50/60">
                  <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold mb-2">Risultati in tempo reale</div>
                  <div className="grid grid-cols-2 gap-2">
                    <ResultTile title="DAS28-VES" score={raResults.das28_esr.score} interp={raResults.das28_esr.interp(raResults.das28_esr.score)} testid="ra-result-das28-esr" />
                    <ResultTile title="DAS28-PCR" score={raResults.das28_crp.score} interp={raResults.das28_crp.interp(raResults.das28_crp.score)} testid="ra-result-das28-crp" />
                    <ResultTile title="CDAI" score={raResults.cdai.score} interp={raResults.cdai.interp(raResults.cdai.score)} testid="ra-result-cdai" />
                    <ResultTile title="SDAI" score={raResults.sdai.score} interp={raResults.sdai.interp(raResults.sdai.score)} testid="ra-result-sdai" />
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
                  <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700 mb-2">DAPSA — Articolazioni 66/68</h3>
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
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-gray-600">PCR (mg/dL)</Label>
                    <Input type="number" step="0.1" value={crp} onChange={(e) => setCrp(e.target.value)} placeholder="es. 1.2" data-testid="psa-crp" />
                  </div>
                  <VasSlider label="PGA — Valutazione globale paziente (0-10)" value={pga} onChange={setPga} testid="psa-pga" />
                  <VasSlider label="Dolore paziente (0-10)" value={patientPain} onChange={setPatientPain} hint="Dolore articolare percepito su scala VAS" testid="psa-pain" />

                  {/* LEI body chart */}
                  <div>
                    <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700 mb-2">LEI — Entesiti</h3>
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
                <ResultTile title="BASDAI" score={spaResults.basdai.score} interp={spaResults.basdai.interp(spaResults.basdai.score)} testid="spa-result-basdai" />
                <ResultTile title="ASDAS-PCR" score={spaResults.asdas_crp.score} interp={spaResults.asdas_crp.interp(spaResults.asdas_crp.score)} testid="spa-result-asdas" />
                <ResultTile title="BASFI" score={spaResults.basfi.score} interp={spaResults.basfi.interp(spaResults.basfi.score)} testid="spa-result-basfi" />
              </div>
            </Card>
          )}

          {mode === "psa" && (
            <Card className="p-3 bg-gray-50/60">
              <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold mb-2">Risultati in tempo reale</div>
              <div className="grid grid-cols-3 gap-2">
                <ResultTile title="DAPSA" score={psaResults.dapsa.score} interp={psaResults.dapsa.interp(psaResults.dapsa.score)} testid="psa-result-dapsa" />
                <ResultTile title="LEI" score={psaResults.lei.score} interp={psaResults.lei.interp(psaResults.lei.score)} subtitle="/ 6" testid="psa-result-lei" />
                <ResultTile title="PASI" score={psaResults.pasi.score} interp={psaResults.pasi.interp(psaResults.pasi.score)} testid="psa-result-pasi" />
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
              <Save className="w-4 h-4 mr-2" /> {saving ? "Salvataggio..." : `Salva ${mode === "ra" ? "4" : "3"} valutazioni`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
