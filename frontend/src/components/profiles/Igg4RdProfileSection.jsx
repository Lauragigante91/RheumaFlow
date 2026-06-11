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

const ORGANS = [
  { key: "pancreas",       label: "Pancreas",                  hint: "AIP tipo 1: «sausage pancreas», ittero ostruttivo" },
  { key: "bile_ducts",     label: "Vie biliari",               hint: "Colangite sclerosante IgG4 — simula PSC/CCA" },
  { key: "orbits",         label: "Orbite",                    hint: "Pseudotumor orbitale, esoftalmo" },
  { key: "salivary",       label: "Ghiandole salivari",        hint: "Scialoadenite (Sjögren-like): parotidi/sottomandibolare" },
  { key: "lacrimal",       label: "Ghiandole lacrimali",       hint: "Dacrioadenite (Mikulicz)" },
  { key: "retroperitoneum", label: "Retroperitoneo",           hint: "Fibrosi retroperitoneale — compressione uretere" },
  { key: "kidney",         label: "Rene",                      hint: "Nefrite tubulointerstiziale, masse renali" },
  { key: "lung",           label: "Polmone",                   hint: "Noduli, ILD, ispessimento pleurico" },
  { key: "aorta",          label: "Aorta / grandi vasi",       hint: "Aortite/periaortite, aneurisma infiammatorio" },
  { key: "thyroid",        label: "Tiroide",                   hint: "Tiroidite di Riedel" },
  { key: "pituitary",      label: "Ipofisi",                   hint: "Ipofisite — diabete insipido, ipopituitarismo" },
  { key: "lymph",          label: "Linfonodi",                 hint: "Linfadenopatia sistemica" },
  { key: "meninges",       label: "Meningi / pachimeningite",  hint: "Pachimeningite ipertrofica" },
];

const DIAG_BASIS = [
  { key: "igg4_elevated",    label: "IgG4 sierico elevato (>135 mg/dL)" },
  { key: "igg4_very_high",   label: "IgG4 sierico molto elevato (>270 mg/dL, 2× ULN)" },
  { key: "biopsy_storiform",  label: "Istologia: fibrosi storiforme" },
  { key: "biopsy_phlebitis",  label: "Istologia: flebite obliterante" },
  { key: "biopsy_igg4_ratio", label: "IgG4/IgG ratio >40% (IHC)" },
  { key: "biopsy_hpf",        label: ">10 cellule IgG4+/HPF" },
  { key: "acr_eular_2019",    label: "Criteri ACR/EULAR 2019 soddisfatti" },
  { key: "steroid_response",  label: "Risposta drammatica a steroidi" },
  { key: "imaging_typical",   label: "Imaging tipico (TC/RMN multi-organo)" },
];

const DEFAULT = {
  igg4_serum: "",
  igg4_elevated: null,
  organs: {},
  organ_detail: {},
  biopsy: false,
  biopsy_site: "",
  biopsy_igg4_per_hpf: "",
  biopsy_igg4_igg_ratio: "",
  diagnostic_basis: {},
  disease_activity: "",
  course: "",
  steroid_response_detail: "",
  altro: "",
};

export default function Igg4RdProfileSection({ patient, onUpdated }) {
  const [data, setData] = useState(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!patient?.id) return;
    diseaseProfileApi.get(patient.id, "igg4rd")
      .then(doc => { if (doc?.data) setData(p => ({ ...DEFAULT, ...p, ...doc.data })); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [patient?.id]);

  const set = (k, v) => setData(p => ({ ...p, [k]: v }));
  const setNested = (obj, k, v) => setData(p => ({ ...p, [obj]: { ...p[obj], [k]: v } }));

  const affectedCount = Object.values(data.organs || {}).filter(Boolean).length;

  const save = async () => {
    setSaving(true);
    try {
      await diseaseProfileApi.upsert(patient.id, "igg4rd", data);
      toast.success("Profilo IgG4-RD salvato");
      if (onUpdated) onUpdated(data);
    } catch (e) { toast.error(e.response?.data?.detail || "Errore salvataggio"); }
    finally { setSaving(false); }
  };

  const igg4Val = parseFloat(data.igg4_serum);

  if (!loaded) return <Card className="p-6 text-sm text-gray-500">Caricamento profilo IgG4-RD…</Card>;

  return (
    <Card className="border-gray-200 shadow-sm p-6" data-testid="igg4rd-profile-section">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-1">Profilo clinico</div>
          <h2 className="font-heading font-black text-2xl tracking-tight text-[#0A2540]">Malattia Correlata a IgG4 (IgG4-RD)</h2>
          {affectedCount > 0 && <p className="text-xs text-gray-500 mt-0.5">{affectedCount} {affectedCount === 1 ? "organo coinvolto" : "organi coinvolti"}</p>}
        </div>
        <Button onClick={save} disabled={saving} className="bg-[#0A2540] text-white hover:bg-[#051626]">
          <Save className="w-4 h-4 mr-2" />{saving ? "Salvataggio..." : "Salva profilo"}
        </Button>
      </div>

      {/* IgG4 SIERICO */}
      <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50/30">
        <div className="flex items-center gap-2 mb-2">
          <Beaker className="w-4 h-4 text-[#0A2540]" />
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">IgG4 sierico</Label>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <Label className="text-xs text-gray-600">Valore (mg/dL)</Label>
            <Input value={data.igg4_serum || ""} onChange={e => set("igg4_serum", e.target.value)} placeholder="es. 480" className="text-xs mt-1 w-32" />
          </div>
          {!isNaN(igg4Val) && igg4Val > 0 && (
            <div className={`px-3 py-1.5 rounded-md text-xs font-medium border mt-5 ${igg4Val > 270 ? "bg-red-50 border-red-300 text-red-700" : igg4Val > 135 ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-gray-100 border-gray-300 text-gray-600"}`}>
              {igg4Val > 270 ? "⚠ Molto elevato (>2× ULN) — alta specificità" : igg4Val > 135 ? "↑ Elevato (>135 mg/dL)" : "→ Nella norma (non esclude IgG4-RD)"}
            </div>
          )}
          <p className="text-[10px] text-gray-500 mt-5 ml-1">Normale: &lt;135 mg/dL. Attenzione: 30–40% dei pazienti con IgG4-RD istologicamente confermata ha IgG4 normale.</p>
        </div>
      </div>

      {/* ORGANI */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <HeartPulse className="w-4 h-4 text-[#0A2540]" />
          <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Organi coinvolti</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
          {ORGANS.map(o => {
            const checked = !!data.organs?.[o.key];
            return (
              <label key={o.key} className={`flex items-start gap-2 border rounded-md p-2.5 cursor-pointer transition ${checked ? "border-[#0A2540] bg-[#F0F4F8]" : "border-gray-200 hover:bg-gray-50"}`} data-testid={`igg4-organ-${o.key}`}>
                <Checkbox checked={checked} onCheckedChange={v => setNested("organs", o.key, !!v)} />
                <div>
                  <div className="text-xs font-medium leading-tight">{o.label}</div>
                  <div className="text-[9px] text-gray-500 mt-0.5 leading-tight">{o.hint}</div>
                </div>
              </label>
            );
          })}
        </div>
        {Object.entries(data.organs || {}).filter(([,v]) => v).length > 0 && (
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/30">
            <div className="text-xs font-semibold text-gray-600 mb-2">Dettagli per organo</div>
            <div className="space-y-1.5">
              {ORGANS.filter(o => data.organs?.[o.key]).map(o => (
                <div key={o.key} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-36 shrink-0">{o.label}:</span>
                  <Input value={data.organ_detail?.[o.key] || ""} onChange={e => setNested("organ_detail", o.key, e.target.value)} placeholder="Referto/imaging/biopsia…" className="text-xs flex-1" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* BIOPSIA */}
      <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50/30">
        <label className="flex items-center gap-2 cursor-pointer mb-2">
          <Checkbox checked={!!data.biopsy} onCheckedChange={v => set("biopsy", !!v)} />
          <span className="text-sm font-medium">Biopsia eseguita</span>
        </label>
        {data.biopsy && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 ml-6">
            <div>
              <Label className="text-xs text-gray-600">Organo biopsiato</Label>
              <Input value={data.biopsy_site || ""} onChange={e => set("biopsy_site", e.target.value)} placeholder="es. pancreas, ghiandola sottomandibolare" className="text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Cellule IgG4+/HPF</Label>
              <Input value={data.biopsy_igg4_per_hpf || ""} onChange={e => set("biopsy_igg4_per_hpf", e.target.value)} placeholder="es. 42 (>10 = positivo)" className="text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-600">IgG4:IgG ratio (%)</Label>
              <Input value={data.biopsy_igg4_igg_ratio || ""} onChange={e => set("biopsy_igg4_igg_ratio", e.target.value)} placeholder="es. 55% (>40% = positivo)" className="text-xs mt-1" />
              {data.biopsy_igg4_igg_ratio && parseFloat(data.biopsy_igg4_igg_ratio) > 40 && (
                <p className="text-[10px] text-green-700 mt-0.5">✓ &gt;40%: positivo per IgG4-RD</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* BASE DIAGNOSTICA + ATTIVITÀ + DECORSO + NOTE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-[#0A2540]" />
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Base diagnostica</Label>
          </div>
          <div className="space-y-1.5">
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
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700 block mb-2">Attività di malattia</Label>
          <div className="flex gap-1 mb-3 flex-wrap">
            {[{v:"active",l:"Attiva"},{v:"partial",l:"Risposta parziale"},{v:"remission",l:"Remissione"}].map(o => (
              <button key={o.v} type="button" onClick={() => set("disease_activity", data.disease_activity === o.v ? "" : o.v)}
                className={`px-2.5 py-1 text-xs rounded-md border transition ${data.disease_activity === o.v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >{o.l}</button>
            ))}
          </div>
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700 block mb-2">Decorso</Label>
          <div className="flex gap-1 mb-3 flex-wrap">
            {[{v:"active",l:"Monoperiodico"},{v:"relapsing",l:"Recidivante"},{v:"smoldering",l:"Smoldering"}].map(o => (
              <button key={o.v} type="button" onClick={() => set("course", data.course === o.v ? "" : o.v)}
                className={`px-2.5 py-1 text-xs rounded-md border transition ${data.course === o.v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >{o.l}</button>
            ))}
          </div>
          <Textarea rows={4} value={data.altro || ""} onChange={e => set("altro", e.target.value)} placeholder="Risposta a steroidi (tipicamente drammatica), rituximab per ricadute, fibrosi residua, monitoraggio IgG4…" data-testid="igg4rd-altro" />
        </div>
      </div>
    </Card>
  );
}
