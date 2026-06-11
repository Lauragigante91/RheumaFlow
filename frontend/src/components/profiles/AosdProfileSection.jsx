import React, { useEffect, useState, useMemo } from "react";
import { diseaseProfileApi } from "../../lib/api";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Save, Beaker, AlertTriangle, HeartPulse, FileText, Thermometer } from "lucide-react";
import { toast } from "sonner";

const YAMAGUCHI_MAJOR = [
  { key: "fever",       label: "Febbre ≥39°C, quotidiana, ≥1 settimana",    points: 1 },
  { key: "arthritis",   label: "Artralgia/artrite ≥2 settimane",             points: 1 },
  { key: "rash",        label: "Rash tipico (color salmone, transitorio)",   points: 1 },
  { key: "leukocytosis",label: "Leucocitosi ≥10.000 con ≥80% neutrofili",   points: 1 },
];

const YAMAGUCHI_MINOR = [
  { key: "sore_throat",    label: "Faringodinia" },
  { key: "lymphadenopathy", label: "Linfadenopatia" },
  { key: "organomegaly",   label: "Epato/splenomegalia" },
  { key: "liver_enzymes",  label: "Transaminasi elevate" },
  { key: "neg_rf_ana",     label: "FR negativo e ANA negativo" },
];

const ORGANS = [
  { key: "joint",     label: "Articolare",   hint: "Artrite poliartricolare" },
  { key: "skin",      label: "Cute",         hint: "Rash salmone (tipico), macule, eritema" },
  { key: "liver",     label: "Fegato",       hint: "Epatomegalia, ipertransaminasemia" },
  { key: "spleen",    label: "Milza",        hint: "Splenomegalia" },
  { key: "lymph",     label: "Linfonodi",    hint: "Linfadenopatia (collo/ascelle)" },
  { key: "serositis", label: "Sierose",      hint: "Pericardite, pleurite" },
  { key: "lung",      label: "Polmonare",    hint: "ILD, versamento pleurico" },
  { key: "neuro",     label: "Neurologico",  hint: "Raro: meningite, encefalopatia" },
];

const DIAG_BASIS = [
  { key: "yamaguchi_met",    label: "Criteri Yamaguchi soddisfatti (≥5, ≥2 maggiori)" },
  { key: "fautrel_met",      label: "Criteri Fautrel soddisfatti (alt.)" },
  { key: "exclusions_done",  label: "Escluse infezioni, neoplasie, altre connettiviti" },
  { key: "ferritin_elevated", label: "Ferritina molto elevata (>2000–5× ULN)" },
  { key: "ferritin_glyc",    label: "Frazione glicosilata ferritina <20%" },
  { key: "il18_elevated",    label: "IL-18 elevata (se dosata)" },
];

const DEFAULT = {
  form_type: "",
  yamaguchi_major: {},
  yamaguchi_minor: {},
  ferritin_peak: "",
  ferritin_current: "",
  ferritin_glycosylated_pct: "",
  il18: "",
  mas_episode: false,
  mas_episodes_count: "",
  hscore: "",
  organs: {},
  affected_joints: "",
  diagnostic_basis: {},
  course: "",
  altro: "",
};

export default function AosdProfileSection({ patient, onUpdated }) {
  const [data, setData] = useState(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!patient?.id) return;
    diseaseProfileApi.get(patient.id, "aosd")
      .then(doc => { if (doc?.data) setData(p => ({ ...DEFAULT, ...p, ...doc.data })); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [patient?.id]);

  const set = (k, v) => setData(p => ({ ...p, [k]: v }));
  const setNested = (obj, k, v) => setData(p => ({ ...p, [obj]: { ...p[obj], [k]: v } }));

  const majorCount = useMemo(() => YAMAGUCHI_MAJOR.filter(i => data.yamaguchi_major?.[i.key]).length, [data.yamaguchi_major]);
  const minorCount = useMemo(() => YAMAGUCHI_MINOR.filter(i => data.yamaguchi_minor?.[i.key]).length, [data.yamaguchi_minor]);
  const totalScore = majorCount + minorCount;
  const yamaguchiFulfilled = totalScore >= 5 && majorCount >= 2;

  const save = async () => {
    setSaving(true);
    try {
      await diseaseProfileApi.upsert(patient.id, "aosd", data);
      toast.success("Profilo Still salvato");
      if (onUpdated) onUpdated(data);
    } catch (e) { toast.error(e.response?.data?.detail || "Errore salvataggio"); }
    finally { setSaving(false); }
  };

  if (!loaded) return <Card className="p-6 text-sm text-gray-500">Caricamento profilo Still…</Card>;

  return (
    <Card className="border-gray-200 shadow-sm p-6" data-testid="aosd-profile-section">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-1">Profilo clinico</div>
          <h2 className="font-heading font-black text-2xl tracking-tight text-[#0A2540]">Malattia di Still dell'adulto (AOSD)</h2>
        </div>
        <Button onClick={save} disabled={saving} className="bg-[#0A2540] text-white hover:bg-[#051626]">
          <Save className="w-4 h-4 mr-2" />{saving ? "Salvataggio..." : "Salva profilo"}
        </Button>
      </div>

      {/* FORMA CLINICA */}
      <div className="mb-5">
        <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700 block mb-2">Forma clinica</Label>
        <div className="flex flex-wrap gap-1">
          {[
            {v:"systemic",l:"Sistemica (febbre/rash dominante)"},
            {v:"chronic_articular",l:"Cronica articolare"},
            {v:"intermittent",l:"Intermittente"},
          ].map(o => (
            <button key={o.v} type="button" onClick={() => set("form_type", data.form_type === o.v ? "" : o.v)}
              className={`px-2.5 py-1 text-xs rounded-md border transition ${data.form_type === o.v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
            >{o.l}</button>
          ))}
        </div>
      </div>

      {/* CRITERI YAMAGUCHI */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-[#0A2540]" />
            <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Criteri Yamaguchi 1992</h3>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold border ${yamaguchiFulfilled ? "bg-green-50 border-green-300 text-green-700" : "bg-gray-100 border-gray-300 text-gray-600"}`}>
            <span>Score: {totalScore} ({majorCount} maggiori + {minorCount} minori)</span>
            {yamaguchiFulfilled && <span className="text-xs font-normal">✓ Soddisfatti</span>}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Criteri maggiori</div>
            <div className="space-y-1.5">
              {YAMAGUCHI_MAJOR.map(item => {
                const checked = !!data.yamaguchi_major?.[item.key];
                return (
                  <label key={item.key} className={`flex items-center gap-2.5 border rounded-md p-2.5 cursor-pointer transition text-sm ${checked ? "border-[#0A2540] bg-[#F0F4F8]" : "border-gray-200 hover:bg-gray-50"}`}>
                    <Checkbox checked={checked} onCheckedChange={v => setNested("yamaguchi_major", item.key, !!v)} />
                    {item.label}
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Criteri minori</div>
            <div className="space-y-1.5">
              {YAMAGUCHI_MINOR.map(item => {
                const checked = !!data.yamaguchi_minor?.[item.key];
                return (
                  <label key={item.key} className={`flex items-center gap-2.5 border rounded-md p-2.5 cursor-pointer transition text-sm ${checked ? "border-[#0A2540] bg-[#F0F4F8]" : "border-gray-200 hover:bg-gray-50"}`}>
                    <Checkbox checked={checked} onCheckedChange={v => setNested("yamaguchi_minor", item.key, !!v)} />
                    {item.label}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* BIOMARKER */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Beaker className="w-4 h-4 text-[#0A2540]" />
          <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Biomarker</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs text-gray-600">Ferritina picco (µg/L)</Label>
            <Input value={data.ferritin_peak || ""} onChange={e => set("ferritin_peak", e.target.value)} placeholder="es. 48.000" className="text-xs mt-1" />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Ferritina attuale (µg/L)</Label>
            <Input value={data.ferritin_current || ""} onChange={e => set("ferritin_current", e.target.value)} placeholder="es. 2.400" className="text-xs mt-1" />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Frazione glicosilata (%)</Label>
            <Input value={data.ferritin_glycosylated_pct || ""} onChange={e => set("ferritin_glycosylated_pct", e.target.value)} placeholder="&lt;20% = alta spec." className="text-xs mt-1" />
            {data.ferritin_glycosylated_pct && parseFloat(data.ferritin_glycosylated_pct) < 20 && (
              <p className="text-[10px] text-green-700 mt-0.5">✓ &lt;20%: alta specificità per AOSD</p>
            )}
          </div>
          <div>
            <Label className="text-xs text-gray-600">IL-18 (pg/mL)</Label>
            <Input value={data.il18 || ""} onChange={e => set("il18", e.target.value)} placeholder="es. 48.000" className="text-xs mt-1" />
          </div>
        </div>
      </div>

      {/* MAS */}
      <div className="mb-6 border border-red-200 rounded-lg p-4 bg-red-50/20">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={!!data.mas_episode} onCheckedChange={v => set("mas_episode", !!v)} />
            <span className="text-sm font-semibold text-red-700">Episodio di MAS (Macrophage Activation Syndrome)</span>
          </label>
        </div>
        {data.mas_episode && (
          <div className="grid grid-cols-2 gap-3 ml-6">
            <div>
              <Label className="text-xs text-gray-600">N° episodi</Label>
              <Input value={data.mas_episodes_count || ""} onChange={e => set("mas_episodes_count", e.target.value)} placeholder="1" className="text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-600">HScore (se calcolato)</Label>
              <Input value={data.hscore || ""} onChange={e => set("hscore", e.target.value)} placeholder="es. 180 (≥169 = 93% MAS)" className="text-xs mt-1" />
            </div>
          </div>
        )}
      </div>

      {/* ORGANI + BASE DIAG + DECORSO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <HeartPulse className="w-4 h-4 text-[#0A2540]" />
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Organi coinvolti</Label>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {ORGANS.map(o => {
              const checked = !!data.organs?.[o.key];
              return (
                <label key={o.key} className={`flex items-start gap-2 border rounded-md p-2 cursor-pointer transition ${checked ? "border-red-300 bg-red-50/60" : "border-gray-200 hover:bg-gray-50"}`}>
                  <Checkbox checked={checked} onCheckedChange={v => setNested("organs", o.key, !!v)} />
                  <div>
                    <div className="text-xs font-medium">{o.label}</div>
                    <div className="text-[9px] text-gray-500">{o.hint}</div>
                  </div>
                </label>
              );
            })}
          </div>
          {data.organs?.joint && (
            <Input className="mt-2 text-xs" value={data.affected_joints || ""} onChange={e => set("affected_joints", e.target.value)} placeholder="Articolazioni: es. carpo bilaterale, MTF, caviglie" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-[#0A2540]" />
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Base diagnostica</Label>
          </div>
          <div className="space-y-1.5 mb-3">
            {DIAG_BASIS.map(b => {
              const checked = !!data.diagnostic_basis?.[b.key];
              return (
                <label key={b.key} className={`flex items-center gap-2 border rounded-md p-2 text-xs cursor-pointer transition ${checked ? "border-[#0A2540] bg-[#F9FAFB]" : "border-gray-200 hover:bg-gray-50"}`}>
                  <Checkbox checked={checked} onCheckedChange={v => setNested("diagnostic_basis", b.key, !!v)} />
                  {b.label}
                </label>
              );
            })}
          </div>
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700 block mb-1">Decorso</Label>
          <div className="flex gap-1 mb-3">
            {[{v:"monocyclic",l:"Monoperiodico"},{v:"polycyclic",l:"Policiclico"},{v:"chronic_articular",l:"Cronico articolare"}].map(o => (
              <button key={o.v} type="button" onClick={() => set("course", data.course === o.v ? "" : o.v)}
                className={`px-2 py-1 text-xs rounded-md border transition ${data.course === o.v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >{o.l}</button>
            ))}
          </div>
          <Textarea rows={3} value={data.altro || ""} onChange={e => set("altro", e.target.value)} placeholder="Risposta ad anakinra, canakinumab, tocilizumab, MTX…" data-testid="aosd-altro" />
        </div>
      </div>
    </Card>
  );
}
