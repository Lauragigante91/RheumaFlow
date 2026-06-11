import React, { useEffect, useState } from "react";
import { diseaseProfileApi } from "../../lib/api";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Save, Beaker, HeartPulse, FileText } from "lucide-react";
import { toast } from "sonner";

const SLE_FEATURES = [
  { key: "photosensitivity",  label: "Fotosensibilità / rash malare" },
  { key: "serositis",         label: "Sierositi (pleurite/pericardite)" },
  { key: "nephritis",         label: "Nefrite lupica" },
  { key: "cytopenia",         label: "Citopenie (anemia emolitica, leuopenia, trombocitopenia)" },
  { key: "cns",               label: "CNS (psicosi, convulsioni)" },
  { key: "antidsdna",         label: "Anti-dsDNA / anti-Sm positivi" },
];

const SSC_FEATURES = [
  { key: "puffy_hands",       label: "Mani edematose (\"puffy hands\")" },
  { key: "sclerodactyly",     label: "Sclerodattilia" },
  { key: "esophageal",        label: "Dismotilità esofagea" },
  { key: "ild",               label: "ILD (interstiziopatia polmonare)" },
  { key: "pah",               label: "PAH (ipertensione polmonare arteriosa)" },
  { key: "capillaroscopy",    label: "Capillaroscopia patologica (pattern SSc)" },
];

const MIOSITIS_FEATURES = [
  { key: "proximal_weakness", label: "Debolezza prossimale" },
  { key: "elevated_ck",       label: "CK elevata" },
  { key: "ild_myositis",      label: "ILD (anti-sintetasi overlap)" },
  { key: "mechanic_hands",    label: "\"Mechanic's hands\"" },
];

const RA_FEATURES = [
  { key: "symmetric_arthritis", label: "Artrite simmetrica" },
  { key: "erosions",            label: "Erosioni radiologiche" },
  { key: "rf_positive",         label: "FR positivo (basso titolo)" },
];

const DIAG_CRITERIA = [
  { key: "alarcon_segovia",  label: "Criteri Alarcón-Ségovia (classici)" },
  { key: "kasukawa",         label: "Criteri Kasukawa" },
  { key: "sharp",            label: "Criteri Sharp (originali)" },
  { key: "u1rnp_high_titer", label: "Anti-U1-RNP ad alto titolo (>1:1600)" },
];

const DEFAULT = {
  u1rnp_positive: null,
  u1rnp_titer: "",
  raynaud: false,
  raynaud_severity: "",
  sle_features: {},
  ssc_features: {},
  myositis_features: {},
  ra_features: {},
  dominant_overlap: "",
  ild: false,
  fvc_pct: "",
  dlco_pct: "",
  pah: false,
  pah_pasp: "",
  diagnostic_criteria: {},
  course: "",
  altro: "",
};

export default function MctdProfileSection({ patient, onUpdated }) {
  const [data, setData] = useState(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!patient?.id) return;
    diseaseProfileApi.get(patient.id, "mctd")
      .then(doc => { if (doc?.data) setData(p => ({ ...DEFAULT, ...p, ...doc.data })); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [patient?.id]);

  const set = (k, v) => setData(p => ({ ...p, [k]: v }));
  const setNested = (obj, k, v) => setData(p => ({ ...p, [obj]: { ...p[obj], [k]: v } }));

  const save = async () => {
    setSaving(true);
    try {
      await diseaseProfileApi.upsert(patient.id, "mctd", data);
      toast.success("Profilo MCTD salvato");
      if (onUpdated) onUpdated(data);
    } catch (e) { toast.error(e.response?.data?.detail || "Errore salvataggio"); }
    finally { setSaving(false); }
  };

  const OverlapBlock = ({ title, items, obj, color }) => (
    <div className={`border rounded-lg p-3 ${color}`}>
      <div className="text-xs font-semibold uppercase tracking-wide mb-2 text-gray-700">{title}</div>
      <div className="space-y-1">
        {items.map(item => {
          const checked = !!data[obj]?.[item.key];
          return (
            <label key={item.key} className={`flex items-center gap-2 border rounded px-2 py-1.5 text-xs cursor-pointer transition ${checked ? "border-[#0A2540] bg-white/80" : "border-transparent hover:bg-white/50"}`}>
              <Checkbox checked={checked} onCheckedChange={v => setNested(obj, item.key, !!v)} />
              {item.label}
            </label>
          );
        })}
      </div>
    </div>
  );

  if (!loaded) return <Card className="p-6 text-sm text-gray-500">Caricamento profilo MCTD…</Card>;

  return (
    <Card className="border-gray-200 shadow-sm p-6" data-testid="mctd-profile-section">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-1">Profilo clinico</div>
          <h2 className="font-heading font-black text-2xl tracking-tight text-[#0A2540]">MCTD — Connettivite Mista (Sharp)</h2>
        </div>
        <Button onClick={save} disabled={saving} className="bg-[#0A2540] text-white hover:bg-[#051626]">
          <Save className="w-4 h-4 mr-2" />{saving ? "Salvataggio..." : "Salva profilo"}
        </Button>
      </div>

      {/* ANTI-U1-RNP + RAYNAUD */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Beaker className="w-4 h-4 text-[#0A2540]" />
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Anti-U1-RNP (marker centrale)</Label>
          </div>
          <div className="flex gap-1 mb-2">
            {[{v:true,l:"Positivo"},{v:false,l:"Negativo"},{v:null,l:"N.D."}].map(o => (
              <button key={String(o.v)} type="button" onClick={() => set("u1rnp_positive", o.v)}
                className={`px-2.5 py-1 text-xs rounded-md border transition ${data.u1rnp_positive === o.v
                  ? o.v === true ? "bg-green-600 text-white border-green-600" : "bg-[#0A2540] text-white border-[#0A2540]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >{o.l}</button>
            ))}
          </div>
          {data.u1rnp_positive && (
            <Input value={data.u1rnp_titer || ""} onChange={e => set("u1rnp_titer", e.target.value)} placeholder="Titolo (es. >1:1600, 240 AU/mL)" className="text-xs" />
          )}
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700 block mb-2">Fenomeno di Raynaud</Label>
          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <Checkbox checked={!!data.raynaud} onCheckedChange={v => set("raynaud", !!v)} />
            <span className="text-sm">Presente (quasi universale in MCTD)</span>
          </label>
          {data.raynaud && (
            <div className="flex gap-1">
              {["Lieve","Moderato","Grave (ulcere digitali)"].map(v => (
                <button key={v} type="button" onClick={() => set("raynaud_severity", data.raynaud_severity === v ? "" : v)}
                  className={`px-2 py-0.5 text-xs rounded border transition ${data.raynaud_severity === v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                >{v}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FEATURES OVERLAP */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <HeartPulse className="w-4 h-4 text-[#0A2540]" />
          <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Features di overlap</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <OverlapBlock title="Features LES" items={SLE_FEATURES} obj="sle_features" color="border-purple-200 bg-purple-50/30" />
          <OverlapBlock title="Features SSc / Sclerodermia" items={SSC_FEATURES} obj="ssc_features" color="border-blue-200 bg-blue-50/30" />
          <OverlapBlock title="Features Miosite" items={MIOSITIS_FEATURES} obj="myositis_features" color="border-orange-200 bg-orange-50/30" />
          <OverlapBlock title="Features AR" items={RA_FEATURES} obj="ra_features" color="border-green-200 bg-green-50/30" />
        </div>
      </div>

      {/* PAH / ILD */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="border border-amber-200 rounded-lg p-3 bg-amber-50/20">
          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <Checkbox checked={!!data.ild} onCheckedChange={v => set("ild", !!v)} />
            <span className="text-sm font-semibold">ILD (Interstiziopatia polmonare)</span>
          </label>
          {data.ild && (
            <div className="grid grid-cols-2 gap-2 ml-6">
              <div><Label className="text-xs text-gray-600">FVC%</Label><Input value={data.fvc_pct || ""} onChange={e => set("fvc_pct", e.target.value)} placeholder="es. 72" className="text-xs mt-1" /></div>
              <div><Label className="text-xs text-gray-600">DLCO%</Label><Input value={data.dlco_pct || ""} onChange={e => set("dlco_pct", e.target.value)} placeholder="es. 58" className="text-xs mt-1" /></div>
            </div>
          )}
        </div>
        <div className="border border-red-200 rounded-lg p-3 bg-red-50/20">
          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <Checkbox checked={!!data.pah} onCheckedChange={v => set("pah", !!v)} />
            <span className="text-sm font-semibold text-red-700">PAH (Ipertensione polmonare arteriosa)</span>
          </label>
          {data.pah && (
            <div className="ml-6">
              <Label className="text-xs text-gray-600">PAPs all'ecocardiogramma (mmHg)</Label>
              <Input value={data.pah_pasp || ""} onChange={e => set("pah_pasp", e.target.value)} placeholder="es. 42 mmHg" className="text-xs mt-1" />
            </div>
          )}
        </div>
      </div>

      {/* OVERLAP DOMINANTE + CRITERI + DECORSO + NOTE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700 block mb-2">Feature dominante nel tempo</Label>
          <div className="flex flex-wrap gap-1 mb-4">
            {["LES","SSc","Miosite","AR","Mista equilibrata"].map(v => (
              <button key={v} type="button" onClick={() => set("dominant_overlap", data.dominant_overlap === v ? "" : v)}
                className={`px-2.5 py-1 text-xs rounded-md border transition ${data.dominant_overlap === v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >{v}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-[#0A2540]" />
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Criteri diagnostici</Label>
          </div>
          <div className="space-y-1.5">
            {DIAG_CRITERIA.map(b => {
              const checked = !!data.diagnostic_criteria?.[b.key];
              return (
                <label key={b.key} className={`flex items-center gap-2 border rounded-md p-2 text-xs cursor-pointer transition ${checked ? "border-[#0A2540] bg-[#F9FAFB]" : "border-gray-200 hover:bg-gray-50"}`}>
                  <Checkbox checked={checked} onCheckedChange={v => setNested("diagnostic_criteria", b.key, !!v)} />
                  {b.label}
                </label>
              );
            })}
          </div>
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700 block mb-2">Evoluzione nel tempo</Label>
          <div className="flex flex-col gap-1 mb-4">
            {[{v:"stable",l:"Stabile MCTD"},{v:"evolving_sle",l:"Evoluzione → LES"},{v:"evolving_ssc",l:"Evoluzione → SSc"},{v:"evolving_myositis",l:"Evoluzione → Miosite"}].map(o => (
              <button key={o.v} type="button" onClick={() => set("course", data.course === o.v ? "" : o.v)}
                className={`px-2.5 py-1.5 text-xs rounded-md border text-left transition ${data.course === o.v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >{o.l}</button>
            ))}
          </div>
          <Textarea rows={4} value={data.altro || ""} onChange={e => set("altro", e.target.value)} placeholder="Trattamento, risposta a idrossiclorochina, steroidi, MMF, screening PAH annuale…" data-testid="mctd-altro" />
        </div>
      </div>
    </Card>
  );
}
