import React, { useState } from "react";
import Homunculus, { countTender, countSwollen, getTenderKeys, getSwollenKeys, JOINT_LABELS_IT } from "./Homunculus";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Slider } from "./ui/slider";
import { Checkbox } from "./ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import ItalianDatePicker from "./ItalianDatePicker";
import {
  calcDAS28_ESR, calcDAS28_CRP, calcCDAI, calcSDAI, calcBASDAI, calcASDAS_CRP, calcDAPSA,
  calcSLEDAI, calcHAQ, calcPASI, calcBASFI, calcBASMI, calcESSDAI, calcESSPRI, calcBVAS, calcMMT8, calcFIQR,
  calcMRSS, calcSchober, calcCapillaroscopy,
  interpretDAS28, interpretCDAI, interpretSDAI, interpretBASDAI, interpretASDAS, interpretDAPSA,
  interpretSLEDAI, interpretHAQ, interpretPASI, interpretBASFI, interpretBASMI, interpretESSDAI,
  interpretESSPRI, interpretBVAS, interpretMMT8, interpretFIQR, interpretMRSS, interpretSchober, interpretCapillaroscopy,
  SLEDAI_ITEMS, HAQ_CATEGORIES, PASI_REGIONS, BASFI_QUESTIONS, BASMI_MEASURES, ESSDAI_DOMAINS,
  BVAS_SYSTEMS, MMT8_GROUPS, FIQR_FUNCTION, FIQR_OVERALL, FIQR_SYMPTOMS,
  MRSS_AREAS, CAPILLAROSCOPY_PATTERNS, CAPILLAROSCOPY_FEATURES,
  INDEX_LABELS,
} from "../lib/clinimetrics";

/**
 * props: indexType, onSubmit({ inputs, score, interpretation, tender_joints, swollen_joints }), previousAssessments
 */
export default function AssessmentForm({ indexType, onSubmit, onCancel, previousAssessments = [] }) {
  const [inputs, setInputs] = useState({});
  const [joints, setJoints] = useState({});
  const [pasiData, setPasiData] = useState({});
  const [sledaiData, setSledaiData] = useState({});
  const [haqData, setHaqData] = useState({});
  const [essdaiData, setEssdaiData] = useState({});
  const [bvasData, setBvasData] = useState({});
  const [mmtData, setMmtData] = useState({});
  const [fiqrData, setFiqrData] = useState({ function: {}, overall: {}, symptoms: {} });
  const [mrssData, setMrssData] = useState({});
  const [capData, setCapData] = useState({ pattern: "", features: {} });
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const set = (k, v) => setInputs((p) => ({ ...p, [k]: v }));

  const computeScore = () => {
    const tjc = countTender(joints);
    const sjc = countSwollen(joints);
    switch (indexType) {
      case "das28_esr":
        return { score: calcDAS28_ESR({ tjc, sjc, esr: inputs.esr, gh: inputs.gh }), interp: interpretDAS28, ins: { ...inputs, tjc, sjc } };
      case "das28_crp":
        return { score: calcDAS28_CRP({ tjc, sjc, crp: inputs.crp, gh: inputs.gh }), interp: interpretDAS28, ins: { ...inputs, tjc, sjc } };
      case "cdai": {
        const s = calcCDAI({ tjc28: tjc, sjc28: sjc, pga: inputs.pga, ega: inputs.ega });
        return { score: s, interp: interpretCDAI, ins: { ...inputs, tjc28: tjc, sjc28: sjc } };
      }
      case "sdai": {
        const s = calcSDAI({ tjc28: tjc, sjc28: sjc, pga: inputs.pga, ega: inputs.ega, crp: inputs.crp });
        return { score: s, interp: interpretSDAI, ins: { ...inputs, tjc28: tjc, sjc28: sjc } };
      }
      case "basdai":
        return { score: calcBASDAI(inputs), interp: interpretBASDAI, ins: { ...inputs } };
      case "asdas_crp":
        return { score: calcASDAS_CRP(inputs), interp: interpretASDAS, ins: { ...inputs } };
      case "dapsa":
        return { score: calcDAPSA({ tjc68: tjc, sjc66: sjc, pga: inputs.pga, patientPain: inputs.patientPain, crp: inputs.crp }), interp: interpretDAPSA, ins: { ...inputs, tjc68: tjc, sjc66: sjc } };
      case "sledai":
        return { score: calcSLEDAI(sledaiData), interp: interpretSLEDAI, ins: { items: sledaiData } };
      case "haq":
        return { score: calcHAQ(haqData), interp: interpretHAQ, ins: { categories: haqData } };
      case "pasi":
        return { score: calcPASI(pasiData), interp: interpretPASI, ins: { regions: pasiData } };
      case "basfi":
        return { score: calcBASFI(inputs), interp: interpretBASFI, ins: { ...inputs } };
      case "basmi":
        return { score: calcBASMI(inputs), interp: interpretBASMI, ins: { ...inputs } };
      case "essdai":
        return { score: calcESSDAI(essdaiData), interp: interpretESSDAI, ins: { domains: essdaiData } };
      case "esspri":
        return { score: calcESSPRI(inputs), interp: interpretESSPRI, ins: { ...inputs } };
      case "bvas":
        return { score: calcBVAS(bvasData), interp: interpretBVAS, ins: { systems: bvasData } };
      case "mmt8":
        return { score: calcMMT8(mmtData), interp: interpretMMT8, ins: { groups: mmtData } };
      case "fiqr":
        return { score: calcFIQR(fiqrData), interp: interpretFIQR, ins: fiqrData };
      case "mrss":
        return { score: calcMRSS(mrssData), interp: interpretMRSS, ins: { areas: mrssData } };
      case "schober":
        return { score: calcSchober(inputs), interp: interpretSchober, ins: { ...inputs } };
      case "capillaroscopy": {
        const sc = calcCapillaroscopy(capData);
        return { score: sc, interp: () => interpretCapillaroscopy(capData), ins: { ...capData } };
      }
      default:
        return { score: null, interp: () => "-", ins: {} };
    }
  };

  const { score, interp, ins } = computeScore();
  const interpretation = interp ? interp(score) : "-";

  const handleSubmit = () => {
    const payload = {
      index_type: indexType,
      date,
      inputs: { ...ins, joints_state: joints },
      score,
      interpretation,
      tender_joints: getTenderKeys(joints).map((k) => JOINT_LABELS_IT[k] || k),
      swollen_joints: getSwollenKeys(joints).map((k) => JOINT_LABELS_IT[k] || k),
      notes,
    };
    onSubmit(payload);
  };

  // Importa la conta articolare dall'ultima valutazione disponibile
  const lastWithJoints = (previousAssessments || []).find((a) => a.inputs?.joints_state && Object.keys(a.inputs.joints_state).length > 0);
  const importPrevious = () => {
    if (!lastWithJoints) return;
    setJoints({ ...(lastWithJoints.inputs.joints_state || {}) });
  };

  const jointMode = ["das28_esr", "das28_crp", "cdai", "sdai"].includes(indexType) ? "28"
    : indexType === "dapsa" ? "66_68" : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-1">Calcolo</div>
          <h2 className="font-heading text-3xl font-black tracking-tighter text-[#0A2540]">
            {INDEX_LABELS[indexType]}
          </h2>
        </div>
        <div className="flex gap-2 items-center">
          <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Data:</Label>
          <div className="w-44">
            <ItalianDatePicker value={date} onChange={setDate} testid="assessment-date" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Joint counter or body map */}
        {jointMode && (
          <Card className="border-gray-200 shadow-sm p-6 lg:col-span-1">
            <div className="flex items-start justify-between mb-1 gap-2">
              <h3 className="font-heading font-bold text-lg tracking-tight">Conta articolare</h3>
              {lastWithJoints && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={importPrevious}
                  data-testid="import-previous-joints-btn"
                  title={`Importa dalla valutazione del ${new Date(lastWithJoints.date).toLocaleDateString("it-IT")}`}
                  className="text-xs"
                >
                  Importa precedente
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Clicca sull'articolazione per ciclare: nessuno → dolente → tumefatta → entrambe.
            </p>
            <Homunculus mode={jointMode} joints={joints} onChange={setJoints} />
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <StatBox label="Dolenti (TJC)" value={countTender(joints)} color="#0055FF" testid="tjc-count" />
              <StatBox label="Tumefatte (SJC)" value={countSwollen(joints)} color="#FF3333" testid="sjc-count" />
            </div>
          </Card>
        )}

        {/* Right: Form */}
        <Card className={`border-gray-200 shadow-sm p-6 ${jointMode ? "lg:col-span-2" : "lg:col-span-3"}`}>
          <IndexForm
            indexType={indexType}
            inputs={inputs}
            set={set}
            sledaiData={sledaiData}
            setSledaiData={setSledaiData}
            haqData={haqData}
            setHaqData={setHaqData}
            pasiData={pasiData}
            setPasiData={setPasiData}
            essdaiData={essdaiData}
            setEssdaiData={setEssdaiData}
            bvasData={bvasData}
            setBvasData={setBvasData}
            mmtData={mmtData}
            setMmtData={setMmtData}
            fiqrData={fiqrData}
            setFiqrData={setFiqrData}
            mrssData={mrssData}
            setMrssData={setMrssData}
            capData={capData}
            setCapData={setCapData}
          />

          {/* Score summary */}
          <div className="mt-6 p-4 bg-[#F9FAFB] border border-gray-200 rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Punteggio</div>
                <div className="font-mono font-black text-4xl text-[#0A2540] mt-1" data-testid="score-value">
                  {score ?? "-"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Interpretazione</div>
                <div className="font-heading font-bold text-xl mt-1" data-testid="score-interpretation">{interpretation}</div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Note cliniche</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="assessment-notes" />
          </div>

          <div className="mt-6 flex gap-3 justify-end">
            <Button variant="outline" onClick={onCancel} data-testid="cancel-assessment-btn">Annulla</Button>
            <Button className="bg-[#0A2540] text-white hover:bg-[#051626]" onClick={handleSubmit} data-testid="save-assessment-btn">
              Salva valutazione
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatBox({ label, value, color, testid }) {
  return (
    <div className="border border-gray-200 rounded-md p-3" data-testid={testid}>
      <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500">{label}</div>
      <div className="flex items-center gap-2 mt-1">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-mono font-bold text-2xl">{value}</span>
      </div>
    </div>
  );
}

function NumInput({ label, value, onChange, min, max, step = "any", unit, testid }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">{label}{unit ? ` (${unit})` : ""}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        data-testid={testid}
      />
    </div>
  );
}

function VASSlider({ label, value, onChange, testid }) {
  return (
    <div>
      <div className="flex justify-between">
        <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">{label}</Label>
        <span className="text-sm font-mono font-bold" data-testid={`${testid}-val`}>{value ?? 0}</span>
      </div>
      <Slider
        value={[Number(value) || 0]}
        min={0}
        max={10}
        step={0.1}
        onValueChange={(v) => onChange(v[0])}
        className="mt-2"
        data-testid={testid}
      />
    </div>
  );
}

function IndexForm({ indexType, inputs, set, sledaiData, setSledaiData, haqData, setHaqData, pasiData, setPasiData, essdaiData, setEssdaiData, bvasData, setBvasData, mmtData, setMmtData, fiqrData, setFiqrData, mrssData, setMrssData, capData, setCapData }) {
  switch (indexType) {
    case "das28_esr":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NumInput label="VES" value={inputs.esr} onChange={(v) => set("esr", v)} min={0} unit="mm/h" testid="esr-input" />
          <VASSlider label="Global Health (PGA)" value={inputs.gh || 0} onChange={(v) => set("gh", v)} testid="gh-input" />
        </div>
      );
    case "das28_crp":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NumInput label="PCR" value={inputs.crp} onChange={(v) => set("crp", v)} min={0} unit="mg/L" testid="crp-input" />
          <VASSlider label="Global Health (PGA)" value={inputs.gh || 0} onChange={(v) => set("gh", v)} testid="gh-input" />
        </div>
      );
    case "cdai":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <VASSlider label="PGA (Valutazione Paziente)" value={inputs.pga || 0} onChange={(v) => set("pga", v)} testid="pga-input" />
          <VASSlider label="EGA (Valutazione Clinico)" value={inputs.ega || 0} onChange={(v) => set("ega", v)} testid="ega-input" />
        </div>
      );
    case "sdai":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <VASSlider label="PGA (Paziente)" value={inputs.pga || 0} onChange={(v) => set("pga", v)} testid="pga-input" />
          <VASSlider label="EGA (Clinico)" value={inputs.ega || 0} onChange={(v) => set("ega", v)} testid="ega-input" />
          <NumInput label="PCR" value={inputs.crp} onChange={(v) => set("crp", v)} min={0} unit="mg/dL" testid="crp-input" />
        </div>
      );
    case "basdai":
      return (
        <div className="space-y-5">
          <VASSlider label="1. Stanchezza/fatica" value={inputs.q1 || 0} onChange={(v) => set("q1", v)} testid="q1-input" />
          <VASSlider label="2. Dolore al collo, schiena o anche" value={inputs.q2 || 0} onChange={(v) => set("q2", v)} testid="q2-input" />
          <VASSlider label="3. Dolore/gonfiore articolazioni (eccetto collo, schiena, anche)" value={inputs.q3 || 0} onChange={(v) => set("q3", v)} testid="q3-input" />
          <VASSlider label="4. Disturbo per aree sensibili alla pressione" value={inputs.q4 || 0} onChange={(v) => set("q4", v)} testid="q4-input" />
          <VASSlider label="5. Intensità rigidità mattutina" value={inputs.q5 || 0} onChange={(v) => set("q5", v)} testid="q5-input" />
          <VASSlider label="6. Durata rigidità mattutina (0-2+h)" value={inputs.q6 || 0} onChange={(v) => set("q6", v)} testid="q6-input" />
        </div>
      );
    case "asdas_crp":
      return (
        <div className="space-y-5">
          <VASSlider label="Dolore lombare" value={inputs.backPain || 0} onChange={(v) => set("backPain", v)} testid="backpain-input" />
          <VASSlider label="Durata rigidità mattutina" value={inputs.morningStiffness || 0} onChange={(v) => set("morningStiffness", v)} testid="stiffness-input" />
          <VASSlider label="PGA (Paziente)" value={inputs.pga || 0} onChange={(v) => set("pga", v)} testid="pga-input" />
          <VASSlider label="Dolore/gonfiore periferico" value={inputs.peripheralPain || 0} onChange={(v) => set("peripheralPain", v)} testid="peripheral-input" />
          <NumInput label="PCR" value={inputs.crp} onChange={(v) => set("crp", v)} min={0} unit="mg/L" testid="crp-input" />
        </div>
      );
    case "dapsa":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <VASSlider label="PGA (Paziente)" value={inputs.pga || 0} onChange={(v) => set("pga", v)} testid="pga-input" />
          <VASSlider label="Dolore paziente (VAS)" value={inputs.patientPain || 0} onChange={(v) => set("patientPain", v)} testid="pain-input" />
          <NumInput label="PCR" value={inputs.crp} onChange={(v) => set("crp", v)} min={0} unit="mg/dL" testid="crp-input" />
        </div>
      );
    case "sledai":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {SLEDAI_ITEMS.map((item) => (
            <label key={item.key} className="flex items-center gap-3 p-2.5 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
              <Checkbox
                checked={!!sledaiData[item.key]}
                onCheckedChange={(v) => setSledaiData((p) => ({ ...p, [item.key]: !!v }))}
                data-testid={`sledai-${item.key}`}
              />
              <div className="flex-1">
                <div className="text-sm">{item.label}</div>
              </div>
              <span className="text-xs font-mono font-bold text-gray-500">+{item.weight}</span>
            </label>
          ))}
        </div>
      );
    case "haq":
      return (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Per ogni categoria, indica la massima difficoltà: 0 = nessuna, 1 = con qualche difficoltà, 2 = con molta difficoltà, 3 = impossibile.
          </p>
          {HAQ_CATEGORIES.map((cat) => (
            <div key={cat.key} className="flex items-center justify-between gap-4 border-b border-gray-100 pb-3">
              <div className="flex-1 text-sm">{cat.label}</div>
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((v) => (
                  <Button
                    key={v}
                    variant={haqData[cat.key] === v ? "default" : "outline"}
                    size="sm"
                    className={`w-10 ${haqData[cat.key] === v ? "bg-[#0A2540] text-white" : ""}`}
                    onClick={() => setHaqData((p) => ({ ...p, [cat.key]: v }))}
                    data-testid={`haq-${cat.key}-${v}`}
                  >
                    {v}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    case "pasi":
      return <PASIForm pasiData={pasiData} setPasiData={setPasiData} />;
    case "basfi":
      return (
        <div className="space-y-5">
          <p className="text-sm text-gray-600">Per ogni attività indica la difficoltà negli ultimi giorni (0 = facile, 10 = impossibile).</p>
          {BASFI_QUESTIONS.map((q, i) => (
            <VASSlider key={i} label={`${i + 1}. ${q}`} value={inputs[`q${i + 1}`] || 0} onChange={(v) => set(`q${i + 1}`, v)} testid={`basfi-q${i + 1}`} />
          ))}
        </div>
      );
    case "basmi":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <p className="md:col-span-2 text-sm text-gray-600">Inserisci le misurazioni fisiche (BASMI lineare, range 0-10 per ogni misura).</p>
          {BASMI_MEASURES.map((m) => (
            <NumInput key={m.key} label={m.label} value={inputs[m.key]} onChange={(v) => set(m.key, v)} min={0} step="0.1" testid={`basmi-${m.key}`} />
          ))}
        </div>
      );
    case "essdai":
      return (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Per ogni dominio, indica il livello di attività attuale.</p>
          {ESSDAI_DOMAINS.map((d) => (
            <div key={d.key} className="border border-gray-200 rounded-md p-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">{d.label}</Label>
                <span className="text-xs font-mono text-gray-500">peso ×{d.weight}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {d.levels.map((lv, idx) => (
                  <Button
                    key={idx}
                    variant={essdaiData[d.key] === idx ? "default" : "outline"}
                    size="sm"
                    className={essdaiData[d.key] === idx ? "bg-[#0A2540] text-white" : ""}
                    onClick={() => setEssdaiData((p) => ({ ...p, [d.key]: idx }))}
                    data-testid={`essdai-${d.key}-${idx}`}
                  >
                    {lv}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    case "esspri":
      return (
        <div className="space-y-5">
          <p className="text-sm text-gray-600">Per ogni dominio indica l'intensità negli ultimi 14 giorni (VAS 0-10).</p>
          <VASSlider label="Secchezza" value={inputs.dryness || 0} onChange={(v) => set("dryness", v)} testid="esspri-dryness" />
          <VASSlider label="Affaticamento" value={inputs.fatigue || 0} onChange={(v) => set("fatigue", v)} testid="esspri-fatigue" />
          <VASSlider label="Dolore (articolare/muscolare)" value={inputs.pain || 0} onChange={(v) => set("pain", v)} testid="esspri-pain" />
        </div>
      );
    case "bvas":
      return (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Per ogni sistema, indica se l'attività è di nuova insorgenza (peso maggiore) o persistente (peso minore) e specifica i punti.</p>
          {BVAS_SYSTEMS.map((s) => (
            <div key={s.key} className="border border-gray-200 rounded-md p-3">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <Label className="text-sm font-semibold">{s.label}</Label>
                <span className="text-xs text-gray-500">max nuovo: {s.newMax} · max persistente: {s.persistentMax}</span>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <Button
                  variant={bvasData[s.key]?.type === "new" ? "default" : "outline"}
                  size="sm"
                  className={bvasData[s.key]?.type === "new" ? "bg-[#0A2540] text-white" : ""}
                  onClick={() => setBvasData((p) => ({ ...p, [s.key]: { ...(p[s.key] || {}), type: "new" } }))}
                  data-testid={`bvas-${s.key}-new`}
                >Nuovo / peggiorato</Button>
                <Button
                  variant={bvasData[s.key]?.type === "persistent" ? "default" : "outline"}
                  size="sm"
                  className={bvasData[s.key]?.type === "persistent" ? "bg-[#0A2540] text-white" : ""}
                  onClick={() => setBvasData((p) => ({ ...p, [s.key]: { ...(p[s.key] || {}), type: "persistent" } }))}
                  data-testid={`bvas-${s.key}-persistent`}
                >Persistente</Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBvasData((p) => ({ ...p, [s.key]: { type: null, score: 0 } }))}
                  data-testid={`bvas-${s.key}-clear`}
                >Pulisci</Button>
                <Input
                  type="number"
                  className="w-24"
                  min={0}
                  max={bvasData[s.key]?.type === "new" ? s.newMax : s.persistentMax}
                  value={bvasData[s.key]?.score ?? ""}
                  onChange={(e) => setBvasData((p) => ({ ...p, [s.key]: { ...(p[s.key] || {}), score: Number(e.target.value) || 0 } }))}
                  placeholder="Punti"
                  data-testid={`bvas-${s.key}-score`}
                  disabled={!bvasData[s.key]?.type}
                />
              </div>
            </div>
          ))}
        </div>
      );
    case "mmt8":
      return (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Forza muscolare scala Kendall 0-10 per ogni gruppo. I gruppi bilaterali si valutano separatamente dx/sx (max totale 150).</p>
          {MMT8_GROUPS.map((g) => (
            <div key={g.key} className="border border-gray-200 rounded-md p-3">
              <Label className="text-sm font-semibold">{g.label}</Label>
              {g.bilateral ? (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <NumInput label="Sinistra" value={mmtData[g.key]?.l} onChange={(v) => setMmtData((p) => ({ ...p, [g.key]: { ...(p[g.key] || {}), l: v } }))} min={0} max={10} step="0.5" testid={`mmt-${g.key}-l`} />
                  <NumInput label="Destra" value={mmtData[g.key]?.r} onChange={(v) => setMmtData((p) => ({ ...p, [g.key]: { ...(p[g.key] || {}), r: v } }))} min={0} max={10} step="0.5" testid={`mmt-${g.key}-r`} />
                </div>
              ) : (
                <div className="mt-2 max-w-xs">
                  <NumInput label="Punteggio" value={mmtData[g.key]?.s} onChange={(v) => setMmtData((p) => ({ ...p, [g.key]: { s: v } }))} min={0} max={10} step="0.5" testid={`mmt-${g.key}-s`} />
                </div>
              )}
            </div>
          ))}
        </div>
      );
    case "fiqr":
      return (
        <Tabs defaultValue="function" className="w-full">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="function" data-testid="fiqr-tab-function">Funzione</TabsTrigger>
            <TabsTrigger value="overall" data-testid="fiqr-tab-overall">Impatto globale</TabsTrigger>
            <TabsTrigger value="symptoms" data-testid="fiqr-tab-symptoms">Sintomi</TabsTrigger>
          </TabsList>
          <TabsContent value="function" className="space-y-4">
            <p className="text-sm text-gray-600">Difficoltà nelle attività (0 = facile, 10 = impossibile).</p>
            {FIQR_FUNCTION.map((q, i) => (
              <VASSlider key={i} label={`${i + 1}. ${q}`} value={fiqrData.function?.[`q${i + 1}`] || 0} onChange={(v) => setFiqrData((p) => ({ ...p, function: { ...p.function, [`q${i + 1}`]: v } }))} testid={`fiqr-fn-${i + 1}`} />
            ))}
          </TabsContent>
          <TabsContent value="overall" className="space-y-4">
            {FIQR_OVERALL.map((d) => (
              <VASSlider key={d.key} label={d.label} value={fiqrData.overall?.[d.key] || 0} onChange={(v) => setFiqrData((p) => ({ ...p, overall: { ...p.overall, [d.key]: v } }))} testid={`fiqr-ov-${d.key}`} />
            ))}
          </TabsContent>
          <TabsContent value="symptoms" className="space-y-4">
            {FIQR_SYMPTOMS.map((d) => (
              <VASSlider key={d.key} label={d.label} value={fiqrData.symptoms?.[d.key] || 0} onChange={(v) => setFiqrData((p) => ({ ...p, symptoms: { ...p.symptoms, [d.key]: v } }))} testid={`fiqr-sy-${d.key}`} />
            ))}
          </TabsContent>
        </Tabs>
      );
    case "mrss":
      return (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Per ogni area corporea valuta lo spessore cutaneo: 0 = normale, 1 = lieve ispessimento, 2 = moderato, 3 = severo. Massimo 51.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {MRSS_AREAS.map((a) => (
              <div key={a.key} className="flex items-center justify-between gap-2 border border-gray-200 rounded-md p-2.5">
                <div className="text-sm font-medium">{a.label}</div>
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((v) => (
                    <Button
                      key={v}
                      variant={mrssData[a.key] === v ? "default" : "outline"}
                      size="sm"
                      className={`w-9 h-8 ${mrssData[a.key] === v ? "bg-[#0A2540] text-white" : ""}`}
                      onClick={() => setMrssData((p) => ({ ...p, [a.key]: v }))}
                      data-testid={`mrss-${a.key}-${v}`}
                    >
                      {v}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    case "schober":
      return (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Test di Schöber modificato (10+5 cm). Marca un punto a livello della linea bisiliaca (S1, dimples of Venus), uno 10 cm sopra e uno 5 cm sotto. Misura la distanza tra i due marcatori esterni in posizione eretta e in flessione massima.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NumInput label="Distanza in posizione eretta" value={inputs.standing} onChange={(v) => set("standing", v)} min={0} step="0.1" unit="cm" testid="schober-standing" />
            <NumInput label="Distanza in flessione massima" value={inputs.flexed} onChange={(v) => set("flexed", v)} min={0} step="0.1" unit="cm" testid="schober-flexed" />
          </div>
          <div className="text-xs text-gray-500 bg-[#F9FAFB] border border-gray-200 rounded-md p-3">
            Valore atteso normale: incremento ≥ 5 cm. Riduzione = limitazione mobilità lombare.
          </div>
        </div>
      );
    case "capillaroscopy":
      return (
        <div className="space-y-5">
          <p className="text-sm text-gray-600">Pattern qualitativo (Cutolo) e caratteristiche capillaroscopiche.</p>
          <div>
            <Label className="text-xs uppercase tracking-[0.15em] text-gray-600 mb-2 block">Pattern</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {CAPILLAROSCOPY_PATTERNS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setCapData((s) => ({ ...s, pattern: p.value }))}
                  className={`text-left border rounded-md p-3 transition-colors ${capData.pattern === p.value ? "border-[#0A2540] bg-[#F9FAFB] ring-1 ring-[#0A2540]" : "border-gray-200 hover:bg-gray-50"}`}
                  data-testid={`cap-pattern-${p.value}`}
                  type="button"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{p.label}</span>
                    {p.points > 0 && <span className="text-xs font-mono text-gray-500">+{p.points}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-[0.15em] text-gray-600 mb-2 block">Caratteristiche aggiuntive</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {CAPILLAROSCOPY_FEATURES.map((f) => (
                <label key={f.key} className="flex items-center gap-3 p-2.5 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                  <Checkbox
                    checked={!!capData.features?.[f.key]}
                    onCheckedChange={(v) => setCapData((s) => ({ ...s, features: { ...s.features, [f.key]: !!v } }))}
                    data-testid={`cap-feat-${f.key}`}
                  />
                  <span className="text-sm flex-1">{f.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
}

function PASIForm({ pasiData, setPasiData }) {
  const update = (region, field, value) => {
    setPasiData((p) => ({
      ...p,
      [region]: { ...(p[region] || {}), [field]: value },
    }));
  };

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        Per ogni regione del corpo valuta: eritema (E), infiltrazione (I), desquamazione (D) su scala 0-4, e l'area coinvolta (A) su scala 0-6.
      </p>
      <Tabs defaultValue={PASI_REGIONS[0].key}>
        <TabsList className="grid grid-cols-4 mb-4">
          {PASI_REGIONS.map((r) => (
            <TabsTrigger key={r.key} value={r.key} data-testid={`pasi-tab-${r.key}`}>{r.label}</TabsTrigger>
          ))}
        </TabsList>
        {PASI_REGIONS.map((r) => (
          <TabsContent key={r.key} value={r.key}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <PASISelector label="Eritema (E)" max={4} value={pasiData?.[r.key]?.E || 0} onChange={(v) => update(r.key, "E", v)} testid={`pasi-${r.key}-E`} />
              <PASISelector label="Infiltrazione (I)" max={4} value={pasiData?.[r.key]?.I || 0} onChange={(v) => update(r.key, "I", v)} testid={`pasi-${r.key}-I`} />
              <PASISelector label="Desquamazione (D)" max={4} value={pasiData?.[r.key]?.D || 0} onChange={(v) => update(r.key, "D", v)} testid={`pasi-${r.key}-D`} />
              <PASISelector label="Area (A)" max={6} value={pasiData?.[r.key]?.A || 0} onChange={(v) => update(r.key, "A", v)} testid={`pasi-${r.key}-A`} />
            </div>
            <div className="mt-4 text-xs text-gray-500">
              Peso regione: {r.weight}. Area: 0 = 0%, 1 = &lt;10%, 2 = 10-29%, 3 = 30-49%, 4 = 50-69%, 5 = 70-89%, 6 = 90-100%
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function PASISelector({ label, max, value, onChange, testid }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">{label}</Label>
      <div className="flex flex-wrap gap-1 mt-2">
        {Array.from({ length: max + 1 }).map((_, i) => (
          <Button
            key={i}
            variant={value === i ? "default" : "outline"}
            size="sm"
            className={`w-9 ${value === i ? "bg-[#0A2540] text-white" : ""}`}
            onClick={() => onChange(i)}
            data-testid={`${testid}-${i}`}
          >
            {i}
          </Button>
        ))}
      </div>
    </div>
  );
}
