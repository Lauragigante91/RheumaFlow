import React, { useEffect, useState } from "react";
import { diseaseProfileApi } from "../../lib/api";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Save, Beaker, HeartPulse, Stethoscope, FlaskConical, FileText } from "lucide-react";
import { toast } from "sonner";

const CRYO_TYPES = [
  { value: "I",   label: "Tipo I — Monoclonale", hint: "Mieloma, Waldenström, LLC" },
  { value: "II",  label: "Tipo II — Mista (mono+poli)", hint: "Tipica HCV, FR monoclonale" },
  { value: "III", label: "Tipo III — Policlonale", hint: "CTD, infezioni croniche" },
];

const TRIGGERS = [
  { value: "hcv",        label: "HCV" },
  { value: "hbv",        label: "HBV" },
  { value: "hiv",        label: "HIV" },
  { value: "lymphoma",   label: "Linfoma B" },
  { value: "myeloma",    label: "Mieloma / Waldenström" },
  { value: "lupus",      label: "LES" },
  { value: "sjogren",    label: "Sjögren" },
  { value: "ra",         label: "AR" },
  { value: "idiopathic", label: "Essenziale (idiopatica)" },
  { value: "other",      label: "Altro" },
];

const ORGANS = [
  { key: "skin",    label: "Cute",                hint: "Porpora, ulcere, livedo reticularis, necrosi" },
  { key: "renal",   label: "Rene",                hint: "MPGN, proteinuria, ematuria, insufficienza renale" },
  { key: "neuro",   label: "Neuro periferico",    hint: "Mononeurite multipla, polineuropatia assonale" },
  { key: "joint",   label: "Articolare",          hint: "Artralgie / artrite (non erosiva)" },
  { key: "liver",   label: "Fegato",              hint: "Epatopatia cronica (HCV), cirrosi" },
  { key: "raynaud", label: "Fenomeno di Raynaud", hint: "Spesso associato a tipo I" },
  { key: "cardiac", label: "Cardiaco",            hint: "Raro: pericardite, coinvolgimento valvolare" },
  { key: "lung",    label: "Polmonare",           hint: "Raro: emorragia alveolare" },
];

const SKIN_FEATURES = [
  { key: "purpura",  label: "Porpora palpabile" },
  { key: "ulcers",   label: "Ulcere cutanee" },
  { key: "livedo",   label: "Livedo reticularis" },
  { key: "necrosis", label: "Necrosi cutanea" },
];

const VIRAL_STATUS = [
  { value: "positive",  label: "Positivo" },
  { value: "negative",  label: "Negativo" },
  { value: "unknown",   label: "N.D." },
];

const COMPL_STATUS = [
  { value: "low",     label: "Ridotto" },
  { value: "normal",  label: "Normale" },
  { value: "unknown", label: "N.D." },
];

const DIAG_BASIS = [
  { key: "cryo_serum",          label: "Crioglobuline sieriche positive" },
  { key: "immunofixation",      label: "Immunofissazione (componente M)" },
  { key: "biopsy_skin",         label: "Biopsia cute (vasculite leucocitoclastica + depositi Ig)" },
  { key: "biopsy_renal",        label: "Biopsia renale (MPGN / depositi crioglobulinici)" },
  { key: "emg",                 label: "EMG/ENG (neuropatia periferica)" },
  { key: "clinical_lab",        label: "Clinica + complemento basso + RF elevato" },
];

const DEFAULT = {
  cryoglobulin_type: "",
  cryoglobulin_titer: "",
  trigger: "",
  trigger_detail: "",
  hcv_status: "unknown",
  hcv_rna: "unknown",
  hbv_status: "unknown",
  rf_positive: null,
  rf_titer: "",
  monoclonal_component: null,
  mc_isotype: "",
  complement_c3: "unknown",
  complement_c4: "unknown",
  complement_c1q: "unknown",
  ch50: "unknown",
  organs: {},
  skin_features: {},
  renal_biopsy: false,
  renal_biopsy_finding: "",
  diagnostic_basis: {},
  course: "",
  altro: "",
};

export default function CryoVasProfileSection({ patient, onUpdated }) {
  const [data, setData] = useState(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!patient?.id) return;
    diseaseProfileApi.get(patient.id, "cryo_vas")
      .then(doc => { if (doc?.data) setData(p => ({ ...DEFAULT, ...p, ...doc.data })); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [patient?.id]);

  const set = (key, val) => setData(p => ({ ...p, [key]: val }));
  const setNested = (obj, key, val) => setData(p => ({ ...p, [obj]: { ...p[obj], [key]: val } }));

  const save = async () => {
    setSaving(true);
    try {
      await diseaseProfileApi.upsert(patient.id, "cryo_vas", data);
      toast.success("Profilo vasculite crioglobulinemica salvato");
      if (onUpdated) onUpdated(data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const ChipRow = ({ field, options, nested }) => (
    <div className="flex flex-wrap gap-1 mt-1">
      {options.map(o => {
        const active = nested ? data[nested]?.[field] === o.value : data[field] === o.value;
        return (
          <button key={o.value} type="button"
            onClick={() => nested ? setNested(nested, field, o.value) : set(field, data[field] === o.value ? "" : o.value)}
            className={`px-2.5 py-1 text-xs rounded-md border transition ${active ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
          >{o.label}</button>
        );
      })}
    </div>
  );

  if (!loaded) return <Card className="p-6 text-sm text-gray-500">Caricamento profilo vasculite crioglobulinemica…</Card>;

  return (
    <Card className="border-gray-200 shadow-sm p-6" data-testid="cryo-profile-section">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-1">Profilo clinico</div>
          <h2 className="font-heading font-black text-2xl tracking-tight text-[#0A2540]">Vasculite Crioglobulinemica</h2>
        </div>
        <Button onClick={save} disabled={saving} className="bg-[#0A2540] text-white hover:bg-[#051626]" data-testid="cryo-save-btn">
          <Save className="w-4 h-4 mr-2" /> {saving ? "Salvataggio..." : "Salva profilo"}
        </Button>
      </div>

      {/* TIPO + CAUSA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical className="w-4 h-4 text-[#0A2540]" />
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Tipo (Brouet)</Label>
          </div>
          <div className="space-y-1.5">
            {CRYO_TYPES.map(t => (
              <label key={t.value} className={`flex items-start gap-2.5 border rounded-md p-2.5 cursor-pointer transition ${data.cryoglobulin_type === t.value ? "border-[#0A2540] bg-[#F9FAFB]" : "border-gray-200 hover:bg-gray-50"}`}>
                <input type="radio" checked={data.cryoglobulin_type === t.value} onChange={() => set("cryoglobulin_type", t.value)} className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">{t.label}</div>
                  <div className="text-[10px] text-gray-500">{t.hint}</div>
                </div>
              </label>
            ))}
          </div>
          <div className="mt-2">
            <Label className="text-xs text-gray-600">Titolo crioglobuline</Label>
            <Input value={data.cryoglobulin_titer || ""} onChange={e => set("cryoglobulin_titer", e.target.value)} placeholder="es. 0.08 g/dL / 1:64" className="text-xs mt-1" data-testid="cryo-titer" />
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Stethoscope className="w-4 h-4 text-[#0A2540]" />
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Causa / Condizione associata</Label>
          </div>
          <div className="flex flex-wrap gap-1">
            {TRIGGERS.map(t => (
              <button key={t.value} type="button"
                onClick={() => set("trigger", data.trigger === t.value ? "" : t.value)}
                className={`px-2.5 py-1 text-xs rounded-md border transition ${data.trigger === t.value ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >{t.label}</button>
            ))}
          </div>
          {data.trigger === "other" && (
            <Input className="mt-2 text-xs" value={data.trigger_detail || ""} onChange={e => set("trigger_detail", e.target.value)} placeholder="Specificare…" />
          )}
        </div>
      </div>

      {/* SIEROLOGICO */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Beaker className="w-4 h-4 text-[#0A2540]" />
          <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Sierologico</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-gray-600">HCV Ab / RNA</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {VIRAL_STATUS.map(o => (
                <button key={o.value} type="button" onClick={() => set("hcv_status", o.value)}
                  className={`px-2 py-1 text-xs rounded-md border transition ${data.hcv_status === o.value ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                >{o.label}</button>
              ))}
            </div>
            {data.hcv_status === "positive" && (
              <div className="mt-1.5">
                <Label className="text-xs text-gray-500">HCV RNA</Label>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {[{v:"detectable",l:"Rilevabile"},{v:"undetectable",l:"Irrilevabile"}].map(o => (
                    <button key={o.v} type="button" onClick={() => set("hcv_rna", o.v)}
                      className={`px-2 py-0.5 text-xs rounded-md border transition ${data.hcv_rna === o.v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                    >{o.l}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs text-gray-600">HBV</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {VIRAL_STATUS.map(o => (
                <button key={o.value} type="button" onClick={() => set("hbv_status", o.value)}
                  className={`px-2 py-1 text-xs rounded-md border transition ${data.hbv_status === o.value ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                >{o.label}</button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Fattore Reumatoide (FR)</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {[{v:true,l:"Positivo"},{v:false,l:"Negativo"},{v:null,l:"N.D."}].map(o => (
                <button key={String(o.v)} type="button" onClick={() => set("rf_positive", o.v)}
                  className={`px-2 py-1 text-xs rounded-md border transition ${data.rf_positive === o.v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                >{o.l}</button>
              ))}
            </div>
            {data.rf_positive && (
              <Input className="mt-1 text-xs" value={data.rf_titer || ""} onChange={e => set("rf_titer", e.target.value)} placeholder="Titolo FR (UI/mL)" />
            )}
          </div>
          <div>
            <Label className="text-xs text-gray-600">Componente monoclonale</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {[{v:true,l:"Presente"},{v:false,l:"Assente"},{v:null,l:"N.D."}].map(o => (
                <button key={String(o.v)} type="button" onClick={() => set("monoclonal_component", o.v)}
                  className={`px-2 py-1 text-xs rounded-md border transition ${data.monoclonal_component === o.v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                >{o.l}</button>
              ))}
            </div>
            {data.monoclonal_component && (
              <Input className="mt-1 text-xs" value={data.mc_isotype || ""} onChange={e => set("mc_isotype", e.target.value)} placeholder="Isotipo (es. IgMκ, IgGλ)" />
            )}
          </div>
          {["complement_c3","complement_c4","complement_c1q","ch50"].map(key => (
            <div key={key}>
              <Label className="text-xs text-gray-600">{key === "ch50" ? "CH50" : key.replace("complement_","").toUpperCase()}</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {COMPL_STATUS.map(o => (
                  <button key={o.value} type="button" onClick={() => set(key, o.value)}
                    className={`px-2 py-1 text-xs rounded-md border transition ${data[key] === o.value ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                  >{o.label}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ORGANI */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <HeartPulse className="w-4 h-4 text-[#0A2540]" />
          <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Organi coinvolti</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          {ORGANS.map(o => {
            const checked = !!data.organs?.[o.key];
            return (
              <label key={o.key} className={`flex items-start gap-2 border rounded-md p-2.5 cursor-pointer transition ${checked ? "border-red-300 bg-red-50/60" : "border-gray-200 hover:bg-gray-50"}`} data-testid={`cryo-organ-${o.key}`}>
                <Checkbox checked={checked} onCheckedChange={v => setNested("organs", o.key, !!v)} />
                <div>
                  <div className="text-xs font-medium leading-tight">{o.label}</div>
                  <div className="text-[9px] text-gray-500 mt-0.5 leading-tight">{o.hint}</div>
                </div>
              </label>
            );
          })}
        </div>

        {data.organs?.skin && (
          <div className="border border-gray-200 rounded-lg p-3 mb-2 bg-gray-50/40">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">Cute — Manifestazioni</div>
            <div className="flex flex-wrap gap-2">
              {SKIN_FEATURES.map(f => (
                <label key={f.key} className={`flex items-center gap-1.5 border rounded-md px-3 py-1.5 cursor-pointer text-xs transition ${data.skin_features?.[f.key] ? "border-purple-300 bg-purple-50 text-purple-800" : "border-gray-200 hover:bg-gray-50 text-gray-700"}`}>
                  <Checkbox checked={!!data.skin_features?.[f.key]} onCheckedChange={v => setNested("skin_features", f.key, !!v)} />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
        )}

        {data.organs?.renal && (
          <div className="border border-indigo-200 rounded-lg p-3 bg-indigo-50/30">
            <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700 mb-2">Rene — Dettaglio</div>
            <div className="flex flex-wrap gap-2 items-center">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                <Checkbox checked={!!data.renal_biopsy} onCheckedChange={v => set("renal_biopsy", !!v)} />
                <span>Biopsia renale eseguita</span>
              </label>
              {data.renal_biopsy && (
                <Input value={data.renal_biopsy_finding || ""} onChange={e => set("renal_biopsy_finding", e.target.value)} placeholder="es. MPGN tipo I con depositi crioglobulinici" className="text-xs flex-1 min-w-48" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* BASE DIAGNOSTICA */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-[#0A2540]" />
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Base diagnostica</Label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {DIAG_BASIS.map(b => {
            const checked = !!data.diagnostic_basis?.[b.key];
            return (
              <label key={b.key} className={`flex items-center gap-2.5 border rounded-md p-2.5 cursor-pointer transition text-sm ${checked ? "border-[#0A2540] bg-[#F9FAFB]" : "border-gray-200 hover:bg-gray-50"}`}>
                <Checkbox checked={checked} onCheckedChange={v => setNested("diagnostic_basis", b.key, !!v)} />
                {b.label}
              </label>
            );
          })}
        </div>
      </div>

      {/* DECORSO + NOTE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700 block mb-2">Decorso</Label>
          <div className="flex gap-1">
            {[{v:"acute",l:"Acuto"},{v:"relapsing",l:"Recidivante"},{v:"chronic",l:"Cronico"}].map(o => (
              <button key={o.v} type="button" onClick={() => set("course", data.course === o.v ? "" : o.v)}
                className={`px-2.5 py-1 text-xs rounded-md border transition ${data.course === o.v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >{o.l}</button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700 block mb-2">Note cliniche</Label>
          <Textarea rows={2} value={data.altro || ""} onChange={e => set("altro", e.target.value)} placeholder="Trattamento antivirale, risposta terapeutica, complicanze…" data-testid="cryo-altro" />
        </div>
      </div>
    </Card>
  );
}
