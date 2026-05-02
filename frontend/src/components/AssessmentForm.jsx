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
import {
  calcDAS28_ESR, calcDAS28_CRP, calcCDAI, calcSDAI, calcBASDAI, calcASDAS_CRP, calcDAPSA,
  calcSLEDAI, calcHAQ, calcPASI,
  interpretDAS28, interpretCDAI, interpretSDAI, interpretBASDAI, interpretASDAS, interpretDAPSA,
  interpretSLEDAI, interpretHAQ, interpretPASI,
  SLEDAI_ITEMS, HAQ_CATEGORIES, PASI_REGIONS,
  INDEX_LABELS,
} from "../lib/clinimetrics";

/**
 * props: indexType, onSubmit({ inputs, score, interpretation, tender_joints, swollen_joints })
 */
export default function AssessmentForm({ indexType, onSubmit, onCancel }) {
  const [inputs, setInputs] = useState({});
  const [joints, setJoints] = useState({});
  const [pasiData, setPasiData] = useState({});
  const [sledaiData, setSledaiData] = useState({});
  const [haqData, setHaqData] = useState({});
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
      inputs: ins,
      score,
      interpretation,
      tender_joints: getTenderKeys(joints).map((k) => JOINT_LABELS_IT[k] || k),
      swollen_joints: getSwollenKeys(joints).map((k) => JOINT_LABELS_IT[k] || k),
      notes,
    };
    onSubmit(payload);
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
          <Input type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} data-testid="assessment-date" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Joint counter or body map */}
        {jointMode && (
          <Card className="border-gray-200 shadow-sm p-6 lg:col-span-1">
            <h3 className="font-heading font-bold text-lg tracking-tight mb-1">Conta articolare</h3>
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

function IndexForm({ indexType, inputs, set, sledaiData, setSledaiData, haqData, setHaqData, pasiData, setPasiData }) {
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
