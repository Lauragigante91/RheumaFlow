import React, { useEffect, useState } from "react";
import { diseaseProfileApi } from "../../lib/api";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Save, Beaker, HeartPulse, Stethoscope, FileText, Eye } from "lucide-react";
import { toast } from "sonner";

const UV_TYPES = [
  { value: "nuv", label: "NUV — Normocomplementemica", hint: "Complemento normale; decorso più benigno" },
  { value: "huv", label: "HUV — Ipocomplementemica (McDuffie)", hint: "Complemento ridotto, anti-C1q, associata a LES/CTD" },
];

const ORGANS = [
  { key: "skin",      label: "Cute",             hint: "Orticaria vasculitica ± angioedema" },
  { key: "ocular",    label: "Oculare",           hint: "Episclerite, uveite, congiuntivite" },
  { key: "pulmonary", label: "Polmonare",         hint: "BPCO-like (HUV), dispnea, ostruzione" },
  { key: "renal",     label: "Renale",            hint: "Glomerulonefrite (rara)" },
  { key: "gi",        label: "GI",                hint: "Dolore addominale, nausea, diarrea" },
  { key: "joint",     label: "Articolare",        hint: "Artralgie / artrite non erosiva" },
];

const ASSOC_CONDITIONS = [
  { value: "lupus",     label: "LES" },
  { value: "sjogren",   label: "Sjögren" },
  { value: "hepatitis", label: "Epatite virale (HBV/HCV)" },
  { value: "drug",      label: "Farmaco" },
  { value: "infection", label: "Infezione acuta" },
  { value: "idiopathic", label: "Idiopatica" },
  { value: "other",     label: "Altra CTD" },
];

const COMPL_STATUS = [
  { value: "low",     label: "Ridotto" },
  { value: "normal",  label: "Normale" },
  { value: "unknown", label: "N.D." },
];

const TERNARY = [
  { value: "positive", label: "Positivo" },
  { value: "negative", label: "Negativo" },
  { value: "unknown",  label: "N.D." },
];

const DIAG_BASIS = [
  { key: "biopsy_skin",      label: "Biopsia cute (vasculite leucocitoclastica)" },
  { key: "biopsy_dif",       label: "Biopsia cute — IF (depositi Ig/C3)" },
  { key: "low_complement",   label: "Complemento ridotto (C3/C4/CH50)" },
  { key: "anti_c1q_pos",     label: "Anti-C1q positivi (HUV)" },
  { key: "clinical_criteria", label: "Criteri clinici (lesioni >24h, residuo ecchimotico)" },
  { key: "dermoscopy",       label: "Dermoscopia (pattern vascolare)" },
];

const DEFAULT = {
  uv_type: "",
  associated_condition: "",
  associated_detail: "",
  complement_c3: "unknown",
  complement_c4: "unknown",
  complement_c1q: "unknown",
  ch50: "unknown",
  anti_c1q: "unknown",
  ana_status: "unknown",
  anti_dsdna: "unknown",
  anca_status: "unknown",
  organs: {},
  urticaria_duration_h: "",
  burning: false,
  pruritus: false,
  residual_bruising: false,
  angioedema: false,
  skin_biopsy: false,
  skin_biopsy_finding: "",
  diagnostic_basis: {},
  course: "",
  altro: "",
};

export default function UrticarialVasProfileSection({ patient, onUpdated }) {
  const [data, setData] = useState(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!patient?.id) return;
    diseaseProfileApi.get(patient.id, "urticarial_vas")
      .then(doc => { if (doc?.data) setData(p => ({ ...DEFAULT, ...p, ...doc.data })); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [patient?.id]);

  const set = (key, val) => setData(p => ({ ...p, [key]: val }));
  const setNested = (obj, key, val) => setData(p => ({ ...p, [obj]: { ...p[obj], [key]: val } }));

  const save = async () => {
    setSaving(true);
    try {
      await diseaseProfileApi.upsert(patient.id, "urticarial_vas", data);
      toast.success("Profilo vasculite orticarioide salvato");
      if (onUpdated) onUpdated(data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const TernaryRow = ({ field, label }) => (
    <div>
      <Label className="text-xs text-gray-600">{label}</Label>
      <div className="flex flex-wrap gap-1 mt-1">
        {TERNARY.map(o => (
          <button key={o.value} type="button" onClick={() => set(field, o.value)}
            className={`px-2 py-1 text-xs rounded-md border transition ${data[field] === o.value ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
          >{o.label}</button>
        ))}
      </div>
    </div>
  );

  if (!loaded) return <Card className="p-6 text-sm text-gray-500">Caricamento profilo vasculite orticarioide…</Card>;

  return (
    <Card className="border-gray-200 shadow-sm p-6" data-testid="urticarial-profile-section">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-1">Profilo clinico</div>
          <h2 className="font-heading font-black text-2xl tracking-tight text-[#0A2540]">Vasculite Orticarioide (UV)</h2>
        </div>
        <Button onClick={save} disabled={saving} className="bg-[#0A2540] text-white hover:bg-[#051626]" data-testid="urticarial-save-btn">
          <Save className="w-4 h-4 mr-2" /> {saving ? "Salvataggio..." : "Salva profilo"}
        </Button>
      </div>

      {/* TIPO + CONDIZIONE ASSOCIATA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-[#0A2540]" />
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Tipo</Label>
          </div>
          <div className="space-y-1.5">
            {UV_TYPES.map(t => (
              <label key={t.value} className={`flex items-start gap-2.5 border rounded-md p-2.5 cursor-pointer transition ${data.uv_type === t.value ? "border-[#0A2540] bg-[#F9FAFB]" : "border-gray-200 hover:bg-gray-50"}`}>
                <input type="radio" checked={data.uv_type === t.value} onChange={() => set("uv_type", t.value)} className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">{t.label}</div>
                  <div className="text-[10px] text-gray-500">{t.hint}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Stethoscope className="w-4 h-4 text-[#0A2540]" />
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Condizione associata</Label>
          </div>
          <div className="flex flex-wrap gap-1">
            {ASSOC_CONDITIONS.map(c => (
              <button key={c.value} type="button"
                onClick={() => set("associated_condition", data.associated_condition === c.value ? "" : c.value)}
                className={`px-2.5 py-1 text-xs rounded-md border transition ${data.associated_condition === c.value ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >{c.label}</button>
            ))}
          </div>
          {data.associated_condition && !["idiopathic"].includes(data.associated_condition) && (
            <Input className="mt-2 text-xs" value={data.associated_detail || ""} onChange={e => set("associated_detail", e.target.value)} placeholder="Dettaglio (es. farmaco specifico, agente virale…)" />
          )}
        </div>
      </div>

      {/* CARATTERISTICHE CUTANEE */}
      <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50/30">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-3">Caratteristiche dell'orticaria</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-gray-600">Durata singola lesione</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input value={data.urticaria_duration_h || ""} onChange={e => set("urticaria_duration_h", e.target.value)} placeholder="es. 36" className="text-xs w-24" />
              <span className="text-xs text-gray-500">ore</span>
              <span className="text-xs text-gray-400 ml-2">(tipica UV: &gt;24h)</span>
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-600 block mb-1">Caratteri clinici</Label>
            <div className="flex flex-wrap gap-2">
              {[
                {k:"burning",l:"Bruciore (non prurito)"},
                {k:"pruritus",l:"Prurito"},
                {k:"residual_bruising",l:"Residuo ecchimotico"},
                {k:"angioedema",l:"Angioedema"},
              ].map(f => (
                <label key={f.k} className={`flex items-center gap-1.5 border rounded-md px-2.5 py-1.5 cursor-pointer text-xs transition ${data[f.k] ? "border-amber-300 bg-amber-50 text-amber-800" : "border-gray-200 hover:bg-gray-50 text-gray-700"}`}>
                  <Checkbox checked={!!data[f.k]} onCheckedChange={v => set(f.k, !!v)} />
                  {f.l}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SIEROLOGICO */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Beaker className="w-4 h-4 text-[#0A2540]" />
          <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Sierologico</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            {key:"complement_c3",label:"C3"},
            {key:"complement_c4",label:"C4"},
            {key:"complement_c1q",label:"C1q"},
            {key:"ch50",label:"CH50"},
          ].map(f => (
            <div key={f.key}>
              <Label className="text-xs text-gray-600">{f.label}</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {COMPL_STATUS.map(o => (
                  <button key={o.value} type="button" onClick={() => set(f.key, o.value)}
                    className={`px-2 py-0.5 text-xs rounded-md border transition ${data[f.key] === o.value ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                  >{o.label}</button>
                ))}
              </div>
            </div>
          ))}
          <TernaryRow field="anti_c1q" label="Anti-C1q" />
          <TernaryRow field="ana_status" label="ANA" />
          <TernaryRow field="anti_dsdna" label="Anti-dsDNA" />
          <TernaryRow field="anca_status" label="ANCA" />
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
              <label key={o.key} className={`flex items-start gap-2 border rounded-md p-2.5 cursor-pointer transition ${checked ? "border-red-300 bg-red-50/60" : "border-gray-200 hover:bg-gray-50"}`} data-testid={`urticarial-organ-${o.key}`}>
                <Checkbox checked={checked} onCheckedChange={v => setNested("organs", o.key, !!v)} />
                <div>
                  <div className="text-xs font-medium leading-tight">{o.label}</div>
                  <div className="text-[9px] text-gray-500 mt-0.5 leading-tight">{o.hint}</div>
                </div>
              </label>
            );
          })}
        </div>
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/40">
          <label className="flex items-center gap-2 text-xs cursor-pointer mb-2">
            <Checkbox checked={!!data.skin_biopsy} onCheckedChange={v => set("skin_biopsy", !!v)} />
            <span className="font-medium">Biopsia cutanea eseguita</span>
          </label>
          {data.skin_biopsy && (
            <Input value={data.skin_biopsy_finding || ""} onChange={e => set("skin_biopsy_finding", e.target.value)} placeholder="es. infiltrato neutrofilico perivasale, leucocitoclasia, depositi IgM e C3" className="text-xs" />
          )}
        </div>
      </div>

      {/* BASE DIAGNOSTICA + DECORSO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-[#0A2540]" />
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Base diagnostica</Label>
          </div>
          <div className="space-y-1.5">
            {DIAG_BASIS.map(b => {
              const checked = !!data.diagnostic_basis?.[b.key];
              return (
                <label key={b.key} className={`flex items-center gap-2 border rounded-md p-2 cursor-pointer transition text-xs ${checked ? "border-[#0A2540] bg-[#F9FAFB]" : "border-gray-200 hover:bg-gray-50"}`}>
                  <Checkbox checked={checked} onCheckedChange={v => setNested("diagnostic_basis", b.key, !!v)} />
                  {b.label}
                </label>
              );
            })}
          </div>
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700 block mb-2">Decorso</Label>
          <div className="flex gap-1 mb-3">
            {[{v:"monophasic",l:"Monoperiodico"},{v:"recurrent",l:"Recidivante"},{v:"chronic",l:"Cronico"}].map(o => (
              <button key={o.v} type="button" onClick={() => set("course", data.course === o.v ? "" : o.v)}
                className={`px-2.5 py-1 text-xs rounded-md border transition ${data.course === o.v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >{o.l}</button>
            ))}
          </div>
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700 block mb-2">Note cliniche</Label>
          <Textarea rows={3} value={data.altro || ""} onChange={e => set("altro", e.target.value)} placeholder="Risposta a dapsone, colchicina, idrossiclorochina, immunosoppressori…" data-testid="urticarial-altro" />
        </div>
      </div>
    </Card>
  );
}
