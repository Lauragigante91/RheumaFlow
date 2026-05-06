import React, { useState } from "react";
import Homunculus, { countTender, countSwollen, countTenderIn, countSwollenIn, getTenderKeys, getSwollenKeys, JOINT_LABELS_IT } from "./Homunculus";
import MRSSHomunculus from "./MRSSHomunculus";
import EnthesisBodyChart from "./EnthesisBodyChart";
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
  calcMRSS, calcSchober, calcCapillaroscopy, calcLEI,
  haqCategoryScore,
  interpretDAS28, interpretCDAI, interpretSDAI, interpretBASDAI, interpretASDAS, interpretDAPSA,
  interpretSLEDAI, interpretHAQ, interpretPASI, interpretBASFI, interpretBASMI, interpretESSDAI,
  interpretESSPRI, interpretBVAS, interpretMMT8, interpretFIQR, interpretMRSS, interpretSchober, interpretCapillaroscopy,
  interpretLEI,
  SLEDAI_ITEMS, HAQ_CATEGORIES, PASI_REGIONS, BASFI_QUESTIONS, BASMI_MEASURES, ESSDAI_DOMAINS,
  BVAS_SYSTEMS, MMT8_GROUPS, FIQR_FUNCTION, FIQR_OVERALL, FIQR_SYMPTOMS,
  MRSS_AREAS, CAPILLAROSCOPY_PATTERNS, CAPILLAROSCOPY_FEATURES, LEI_SITES,
  JOINTS_DAS28,
  INDEX_LABELS,
} from "../lib/clinimetrics";

/**
 * props: indexType, onSubmit({ inputs, score, interpretation, tender_joints, swollen_joints }), previousAssessments, initial (per modifica)
 */
export default function AssessmentForm({ indexType, onSubmit, onCancel, previousAssessments = [], initial = null }) {
  const [inputs, setInputs] = useState(() => {
    if (!initial) return {};
    // Estrae i campi semplici dagli inputs salvati (esclude joints_state e altre sub-mappe)
    const i = { ...(initial.inputs || {}) };
    delete i.joints_state;
    delete i.regions;
    delete i.items;
    delete i.categories;
    delete i.domains;
    delete i.systems;
    delete i.groups;
    delete i.areas;
    delete i.function;
    delete i.overall;
    delete i.symptoms;
    delete i.features;
    return i;
  });
  const [joints, setJoints] = useState(() => initial?.inputs?.joints_state || {});
  const [pasiData, setPasiData] = useState(() => initial?.inputs?.regions || {});
  const [sledaiData, setSledaiData] = useState(() => initial?.inputs?.items || {});
  const [haqData, setHaqData] = useState(() => initial?.inputs?.categories || {});
  const [essdaiData, setEssdaiData] = useState(() => initial?.inputs?.domains || {});
  const [bvasData, setBvasData] = useState(() => initial?.inputs?.systems || {});
  const [mmtData, setMmtData] = useState(() => initial?.inputs?.groups || {});
  const [fiqrData, setFiqrData] = useState(() => initial?.inputs?.function ? { function: initial.inputs.function, overall: initial.inputs.overall || {}, symptoms: initial.inputs.symptoms || {} } : { function: {}, overall: {}, symptoms: {} });
  const [mrssData, setMrssData] = useState(() => initial?.inputs?.areas || {});
  const [capData, setCapData] = useState(() => initial?.inputs?.pattern ? { pattern: initial.inputs.pattern, features: initial.inputs.features || {} } : { pattern: "", features: {} });
  const [leiSites, setLeiSites] = useState(() => initial?.inputs?.sites || {});
  const [notes, setNotes] = useState(() => initial?.notes || "");
  const [date, setDate] = useState(() => initial?.date || new Date().toISOString().slice(0, 10));

  const set = (k, v) => setInputs((p) => ({ ...p, [k]: v }));

  const computeScore = () => {
    // Ora il homunculus è sempre 66/68: per DAS28/CDAI/SDAI estraiamo il subset 28
    const tjc28 = countTenderIn(joints, JOINTS_DAS28);
    const sjc28 = countSwollenIn(joints, JOINTS_DAS28);
    const tjcAll = countTender(joints);
    const sjcAll = countSwollen(joints);
    switch (indexType) {
      case "das28_esr":
        return { score: calcDAS28_ESR({ tjc: tjc28, sjc: sjc28, esr: inputs.esr, gh: inputs.gh }), interp: interpretDAS28, ins: { ...inputs, tjc: tjc28, sjc: sjc28, tjc_all: tjcAll, sjc_all: sjcAll } };
      case "das28_crp":
        return { score: calcDAS28_CRP({ tjc: tjc28, sjc: sjc28, crp: inputs.crp, gh: inputs.gh }), interp: interpretDAS28, ins: { ...inputs, tjc: tjc28, sjc: sjc28, tjc_all: tjcAll, sjc_all: sjcAll } };
      case "cdai": {
        const s = calcCDAI({ tjc28, sjc28, pga: inputs.pga, ega: inputs.ega });
        return { score: s, interp: interpretCDAI, ins: { ...inputs, tjc28, sjc28, tjc_all: tjcAll, sjc_all: sjcAll } };
      }
      case "sdai": {
        const s = calcSDAI({ tjc28, sjc28, pga: inputs.pga, ega: inputs.ega, crp: inputs.crp });
        return { score: s, interp: interpretSDAI, ins: { ...inputs, tjc28, sjc28, tjc_all: tjcAll, sjc_all: sjcAll } };
      }
      case "basdai":
        return { score: calcBASDAI(inputs), interp: interpretBASDAI, ins: { ...inputs } };
      case "asdas_crp":
        return { score: calcASDAS_CRP(inputs), interp: interpretASDAS, ins: { ...inputs } };
      case "dapsa":
        return { score: calcDAPSA({ tjc68: tjcAll, sjc66: sjcAll, pga: inputs.pga, patientPain: inputs.patientPain, crp: inputs.crp }), interp: interpretDAPSA, ins: { ...inputs, tjc68: tjcAll, sjc66: sjcAll } };
      case "lei":
        return { score: calcLEI(leiSites), interp: interpretLEI, ins: { sites: leiSites } };
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

  // Conta articolare unificata: sempre 66/68 quando un indice articolare è in uso.
  // Per DAS28/CDAI/SDAI estraiamo automaticamente il subset 28.
  const jointMode = ["das28_esr", "das28_crp", "cdai", "sdai", "dapsa"].includes(indexType) ? "66_68" : null;
  const showDas28Subset = ["das28_esr", "das28_crp", "cdai", "sdai"].includes(indexType);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-1">{initial ? "Modifica" : "Calcolo"}</div>
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
            <Homunculus mode={jointMode} joints={joints} onChange={setJoints} title="Visita corrente" />
            {showDas28Subset && (
              <div className="mt-3 text-[11px] text-gray-600 bg-blue-50/60 border border-blue-100 rounded-md p-2 leading-relaxed">
                <strong>Conta unificata 66/68:</strong> il punteggio DAS28/CDAI/SDAI usa
                automaticamente il subset 28 articolazioni (spalle, gomiti, polsi, MCP, PIP,
                ginocchia). Le altre articolazioni vengono salvate ma non entrano nel calcolo.
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              {showDas28Subset ? (
                <>
                  <StatBox label="TJC28 (calcolo)" value={countTenderIn(joints, JOINTS_DAS28)} color="#0055FF" testid="tjc28-count" />
                  <StatBox label="SJC28 (calcolo)" value={countSwollenIn(joints, JOINTS_DAS28)} color="#FF3333" testid="sjc28-count" />
                  <StatBox label="TJC totale" value={countTender(joints)} color="#0055FF" testid="tjc-total-count" />
                  <StatBox label="SJC totale" value={countSwollen(joints)} color="#FF3333" testid="sjc-total-count" />
                </>
              ) : (
                <>
                  <StatBox label="Dolenti (TJC)" value={countTender(joints)} color="#0055FF" testid="tjc-count" />
                  <StatBox label="Tumefatte (SJC)" value={countSwollen(joints)} color="#FF3333" testid="sjc-count" />
                </>
              )}
            </div>

            {lastWithJoints && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="text-xs text-gray-500 mb-2">
                  Confronto con visita del {new Date(lastWithJoints.date).toLocaleDateString("it-IT")}
                </div>
                <Homunculus
                  mode={jointMode}
                  joints={lastWithJoints.inputs?.joints_state || {}}
                  readOnly
                  title="Visita precedente"
                />
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <StatBox label="TJC prec." value={countTender(lastWithJoints.inputs?.joints_state || {})} color="#0055FF" testid="prev-tjc-count" />
                  <StatBox label="SJC prec." value={countSwollen(lastWithJoints.inputs?.joints_state || {})} color="#FF3333" testid="prev-sjc-count" />
                </div>
              </div>
            )}
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
            leiSites={leiSites}
            setLeiSites={setLeiSites}
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
              {initial ? "Aggiorna valutazione" : "Salva valutazione"}
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

function IndexForm({ indexType, inputs, set, sledaiData, setSledaiData, haqData, setHaqData, pasiData, setPasiData, essdaiData, setEssdaiData, bvasData, setBvasData, mmtData, setMmtData, fiqrData, setFiqrData, mrssData, setMrssData, capData, setCapData, leiSites, setLeiSites }) {
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
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            <strong>SLEDAI-2K</strong> — flagga ogni manifestazione presente negli ultimi 30 giorni.
            Le definizioni cliniche seguono Bombardier 1992 / Gladman 2002.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {SLEDAI_ITEMS.map((item) => (
              <label key={item.key} className="flex items-start gap-3 p-2.5 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                <Checkbox
                  className="mt-0.5"
                  checked={!!sledaiData[item.key]}
                  onCheckedChange={(v) => setSledaiData((p) => ({ ...p, [item.key]: !!v }))}
                  data-testid={`sledai-${item.key}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{item.label}</div>
                  {item.description && (
                    <div className="text-[11px] text-gray-600 leading-snug mt-0.5">{item.description}</div>
                  )}
                </div>
                <span className="text-xs font-mono font-bold text-gray-500 flex-shrink-0">+{item.weight}</span>
              </label>
            ))}
          </div>
        </div>
      );
    case "haq":
      return (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-900 leading-relaxed">
            <strong>Health Assessment Questionnaire (HAQ)</strong> — Per ogni domanda, indica la risposta che meglio descrive la reale condizione <strong>riferita all'ultima settimana</strong>.
            <br />
            <span className="font-mono">0</span> = senza difficoltà · <span className="font-mono">1</span> = con qualche difficoltà · <span className="font-mono">2</span> = con molta difficoltà · <span className="font-mono">3</span> = no (impossibile).
            <br />
            Il punteggio di ogni categoria è il <strong>massimo</strong> degli item; il totale è la media delle 8 categorie.
          </div>
          {HAQ_CATEGORIES.map((cat) => {
            const catScore = haqCategoryScore(cat, haqData);
            return (
              <div key={cat.key} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between gap-3 bg-gray-50 px-3 py-2">
                  <div className="text-xs font-heading font-bold uppercase tracking-[0.12em] text-gray-700">
                    {cat.label}
                  </div>
                  <div className="text-xs font-mono">
                    Tot: <span className="font-bold text-[#0A2540]">{catScore}</span>
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {cat.items.map((it) => (
                    <div key={it.key} className="flex items-start justify-between gap-3 px-3 py-2.5">
                      <div className="flex-1 text-sm text-gray-800">È in grado di: <span className="text-gray-900">{it.label}</span></div>
                      <div className="flex gap-1 flex-shrink-0">
                        {[0, 1, 2, 3].map((v) => (
                          <Button
                            key={v}
                            variant={haqData[it.key] === v ? "default" : "outline"}
                            size="sm"
                            className={`w-10 ${haqData[it.key] === v ? "bg-[#0A2540] text-white hover:bg-[#051626]" : ""}`}
                            onClick={() => setHaqData((p) => ({ ...p, [it.key]: v }))}
                            data-testid={`haq-${it.key}-${v}`}
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
          })}
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
        <div className="space-y-3" data-testid="essdai-form">
          <p className="text-sm text-gray-600">
            Per ogni dominio seleziona il livello di attività attuale. Le definizioni cliniche
            sono quelle del paper EULAR di Seror et al. 2010 (Ann Rheum Dis).
          </p>
          {ESSDAI_DOMAINS.map((d) => {
            const selected = essdaiData[d.key] ?? null;
            return (
              <div key={d.key} className="border border-gray-200 rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <Label className="text-sm font-semibold">{d.label}</Label>
                    {d.note && <p className="text-[10px] text-gray-500 italic mt-0.5">{d.note}</p>}
                  </div>
                  <span className="text-[10px] font-mono text-gray-500 whitespace-nowrap">peso ×{d.weight}</span>
                </div>
                <div className="space-y-1.5">
                  {d.levels.map((lv) => {
                    const isSelected = selected === lv.value;
                    return (
                      <button
                        key={lv.value}
                        type="button"
                        onClick={() => setEssdaiData((p) => ({ ...p, [d.key]: lv.value }))}
                        className={`w-full text-left flex gap-3 border rounded-md p-2.5 transition ${
                          isSelected
                            ? "border-[#0A2540] bg-[#F9FAFB] ring-1 ring-[#0A2540]"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                        data-testid={`essdai-${d.key}-${lv.value}`}
                      >
                        <span
                          className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                            isSelected ? "bg-[#0A2540] text-white" : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {lv.value}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-semibold ${isSelected ? "text-[#0A2540]" : "text-gray-800"}`}>
                            {lv.label}
                          </div>
                          <div className="text-[11px] text-gray-600 leading-snug mt-0.5">
                            {lv.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
          <p className="text-sm text-gray-600">
            Per ogni sistema, indica se l&apos;attività è di nuova insorgenza/peggiorata
            (peso maggiore) o persistente (peso minore) e specifica i punti.
            BVAS v3 (Mukhtyar et al. 2009).
          </p>
          {BVAS_SYSTEMS.map((s) => (
            <div key={s.key} className="border border-gray-200 rounded-md p-3">
              <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                <Label className="text-sm font-semibold">{s.label}</Label>
                <span className="text-[10px] font-mono text-gray-500">max nuovo: {s.newMax} · max persistente: {s.persistentMax}</span>
              </div>
              {s.examples && (
                <p className="text-[11px] text-gray-600 italic mb-2 leading-snug">
                  Voci tipiche: {s.examples}
                </p>
              )}
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
            Clicca su ogni regione corporea per ciclare lo spessore cutaneo: 0 (normale) → 1 (lieve) → 2 (moderato) → 3 (severo). Massimo 51.
          </p>
          <MRSSHomunculus values={mrssData} onChange={setMrssData} />
        </div>
      );
    case "lei":
      return (
        <div className="space-y-4" data-testid="lei-form">
          <p className="text-sm text-gray-600">
            <strong>LEI (Leeds Enthesitis Index)</strong> — clicca i siti dolorosi sulla
            sagoma. 6 siti bilaterali: epicondilo laterale, condilo femorale mediale,
            inserzione del tendine d&apos;Achille. Range 0–6.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-start">
            <EnthesisBodyChart
              sites={leiSites}
              onChange={setLeiSites}
              labels={Object.fromEntries(LEI_SITES.map((s) => [s.key, s.label]))}
              title="Sagoma LEI"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 self-start">
              {LEI_SITES.map((s) => {
                const checked = !!leiSites[s.key];
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setLeiSites((p) => ({ ...p, [s.key]: !checked }))}
                    className={`text-left flex items-center gap-2 border rounded-md p-2 transition ${
                      checked ? "border-red-300 bg-red-50/60" : "border-gray-200 hover:bg-gray-50"
                    }`}
                    data-testid={`lei-${s.key}`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${checked ? "bg-red-600" : "bg-gray-300"}`} />
                    <span className="text-xs font-medium flex-1">{s.label}</span>
                    {checked && (
                      <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-red-700 text-white font-bold">
                        Doloroso
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
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
