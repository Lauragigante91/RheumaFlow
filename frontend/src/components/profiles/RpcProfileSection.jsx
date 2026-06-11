import React, { useEffect, useState, useMemo } from "react";
import { diseaseProfileApi } from "../../lib/api";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Save, AlertTriangle, HeartPulse, FileText, Ear } from "lucide-react";
import { toast } from "sonner";

// McAdam criteria (1976) — ≥3/6 = diagnosis
const MCADAM = [
  { key: "auricular_bilateral",  label: "Condrite auricolare bilaterale",     hint: "Orecchio rosso, caldo, dolente — risparmia il lobo (cartilagineo)", points: 1 },
  { key: "arthritis",            label: "Artrite infiammatoria sieronegativa", hint: "Poliarticolare, non erosiva, asimmetrica", points: 1 },
  { key: "nasal",                label: "Condrite nasale",                    hint: "Saddle nose (deformità a sella) come esito", points: 1 },
  { key: "ocular",               label: "Infiammazione oculare",              hint: "Episclerite, sclerite, cheratite, uveite, congiuntivite", points: 1 },
  { key: "laryngotracheal",      label: "Condrite laringotracheale",          hint: "⚠ RED FLAG: stenosi sottoglottica, tracheomalacia", points: 1, warn: true },
  { key: "audiovestibular",      label: "Disfunzione cocleo-vestibolare",     hint: "Ipoacusia neurosensoriale, acufeni, vertigini", points: 1 },
];

const RESPIRATORY_DETAIL = [
  { key: "subglottic_stenosis",  label: "Stenosi sottoglottica", warn: true },
  { key: "tracheomalacia",       label: "Tracheomalacia",        warn: true },
  { key: "dynamic_collapse",     label: "Collasso dinamico delle vie aeree", warn: true },
  { key: "airway_stenting",      label: "Stent tracheale/bronchiale eseguito" },
];

const ASSOCIATED = [
  { key: "mds",        label: "SMD (Mielodisplasia)" },
  { key: "aav",        label: "Vasculite ANCA-associata" },
  { key: "ibd",        label: "MICI (Crohn/colite)" },
  { key: "sle",        label: "LES" },
  { key: "ra",         label: "AR" },
  { key: "spondylo",   label: "Spondiloartrite" },
];

const DIAG_BASIS = [
  { key: "clinical_mcadam",  label: "Criteri McAdam (≥3/6) senza biopsia" },
  { key: "biopsy_confirmed", label: "Biopsia cartilagine (confermata istologicamente)" },
  { key: "imaging_airway",   label: "TC torace/collo: ispessimento parete tracheale" },
  { key: "pfts_done",        label: "Spirometria + curva flusso-volume (pattern ostruttivo fisso)" },
  { key: "bronchoscopy",     label: "Broncoscopia (collasso dinamico)" },
];

const DEFAULT = {
  mcadam: {},
  auricular_unilateral: false,
  saddle_nose: false,
  respiratory_detail: {},
  fev1_pct: "",
  spirometry_pattern: "",
  associated: {},
  mds_type: "",
  diagnostic_basis: {},
  disease_activity: "",
  course: "",
  altro: "",
};

export default function RpcProfileSection({ patient, onUpdated }) {
  const [data, setData] = useState(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!patient?.id) return;
    diseaseProfileApi.get(patient.id, "rpc")
      .then(doc => { if (doc?.data) setData(p => ({ ...DEFAULT, ...p, ...doc.data })); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [patient?.id]);

  const set = (k, v) => setData(p => ({ ...p, [k]: v }));
  const setNested = (obj, k, v) => setData(p => ({ ...p, [obj]: { ...p[obj], [k]: v } }));

  const mcadamScore = useMemo(() => MCADAM.filter(i => data.mcadam?.[i.key]).length, [data.mcadam]);
  const mcadamFulfilled = mcadamScore >= 3;
  const airwayRisk = data.mcadam?.laryngotracheal || Object.keys(data.respiratory_detail || {}).some(k => ["subglottic_stenosis","tracheomalacia","dynamic_collapse"].includes(k) && data.respiratory_detail[k]);

  const save = async () => {
    setSaving(true);
    try {
      await diseaseProfileApi.upsert(patient.id, "rpc", data);
      toast.success("Profilo RPC salvato");
      if (onUpdated) onUpdated(data);
    } catch (e) { toast.error(e.response?.data?.detail || "Errore salvataggio"); }
    finally { setSaving(false); }
  };

  if (!loaded) return <Card className="p-6 text-sm text-gray-500">Caricamento profilo RPC…</Card>;

  return (
    <Card className="border-gray-200 shadow-sm p-6" data-testid="rpc-profile-section">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-1">Profilo clinico</div>
          <h2 className="font-heading font-black text-2xl tracking-tight text-[#0A2540]">Policondrite Recidivante (RPC)</h2>
        </div>
        <Button onClick={save} disabled={saving} className="bg-[#0A2540] text-white hover:bg-[#051626]">
          <Save className="w-4 h-4 mr-2" />{saving ? "Salvataggio..." : "Salva profilo"}
        </Button>
      </div>

      {airwayRisk && (
        <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded-lg text-xs text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span><strong>⚠ Rischio vie aeree:</strong> condrite laringotracheale / stenosi sottoglottica / tracheomalacia presente. Valutare urgentemente spirometria + broncoscopia + consulenza ORL/pneumologica.</span>
        </div>
      )}

      {/* CRITERI McADAM */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Ear className="w-4 h-4 text-[#0A2540]" />
            <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Criteri McAdam 1976</h3>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold border ${mcadamFulfilled ? "bg-green-50 border-green-300 text-green-700" : "bg-gray-100 border-gray-300 text-gray-600"}`}>
            <span>{mcadamScore}/6{mcadamFulfilled ? " — Criteri soddisfatti (≥3)" : ""}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {MCADAM.map(item => {
            const checked = !!data.mcadam?.[item.key];
            return (
              <label key={item.key} className={`flex items-start gap-3 border rounded-md p-2.5 cursor-pointer transition ${checked ? item.warn ? "border-red-400 bg-red-50/60" : "border-[#0A2540] bg-[#F0F4F8]" : "border-gray-200 hover:bg-gray-50"}`} data-testid={`rpc-mcadam-${item.key}`}>
                <Checkbox checked={checked} onCheckedChange={v => setNested("mcadam", item.key, !!v)} className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{item.hint}</div>
                </div>
              </label>
            );
          })}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 border rounded-md p-2 text-xs cursor-pointer border-gray-200 hover:bg-gray-50">
            <Checkbox checked={!!data.auricular_unilateral} onCheckedChange={v => set("auricular_unilateral", !!v)} />
            <span>Condrite auricolare <em>monolaterale</em> (non McAdam ma supporta diagnosi)</span>
          </label>
          <label className="flex items-center gap-2 border rounded-md p-2 text-xs cursor-pointer border-gray-200 hover:bg-gray-50">
            <Checkbox checked={!!data.saddle_nose} onCheckedChange={v => set("saddle_nose", !!v)} />
            <span>Deformità naso "a sella" (esito di condrite nasale)</span>
          </label>
        </div>
      </div>

      {/* DETTAGLIO VIE AEREE */}
      {data.mcadam?.laryngotracheal && (
        <div className="mb-6 border border-red-300 rounded-lg p-4 bg-red-50/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <div className="text-xs font-semibold uppercase tracking-wide text-red-700">Vie aeree — Dettaglio</div>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {RESPIRATORY_DETAIL.map(rd => (
              <label key={rd.key} className={`flex items-center gap-1.5 border rounded-md px-2.5 py-1.5 text-xs cursor-pointer transition ${data.respiratory_detail?.[rd.key] ? "border-red-400 bg-red-100 text-red-900" : "border-gray-200 hover:bg-gray-50"}`}>
                <Checkbox checked={!!data.respiratory_detail?.[rd.key]} onCheckedChange={v => setNested("respiratory_detail", rd.key, !!v)} />
                {rd.label}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-600">FEV1 (%)</Label>
              <Input value={data.fev1_pct || ""} onChange={e => set("fev1_pct", e.target.value)} placeholder="es. 52" className="text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Pattern spirometria</Label>
              <Input value={data.spirometry_pattern || ""} onChange={e => set("spirometry_pattern", e.target.value)} placeholder="es. ostruttivo fisso (curva piatta)" className="text-xs mt-1" />
            </div>
          </div>
        </div>
      )}

      {/* CONDIZIONI ASSOCIATE + BASE DIAG + DECORSO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <HeartPulse className="w-4 h-4 text-[#0A2540]" />
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Condizioni associate</Label>
          </div>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {ASSOCIATED.map(a => (
              <label key={a.key} className={`flex items-center gap-1.5 border rounded-md px-2 py-1.5 text-xs cursor-pointer transition ${data.associated?.[a.key] ? "border-[#0A2540] bg-[#F0F4F8]" : "border-gray-200 hover:bg-gray-50"}`}>
                <Checkbox checked={!!data.associated?.[a.key]} onCheckedChange={v => setNested("associated", a.key, !!v)} />
                {a.label}
              </label>
            ))}
          </div>
          {data.associated?.mds && (
            <Input value={data.mds_type || ""} onChange={e => set("mds_type", e.target.value)} placeholder="Tipo SMD (es. RCMD, RAEB-1, RAEB-2)" className="text-xs" />
          )}
          <div className="mt-3">
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
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700 block mb-2">Attività</Label>
          <div className="flex gap-1 mb-3 flex-wrap">
            {[{v:"active",l:"Attiva"},{v:"remission",l:"Remissione"},{v:"damage",l:"Danno residuo"}].map(o => (
              <button key={o.v} type="button" onClick={() => set("disease_activity", data.disease_activity === o.v ? "" : o.v)}
                className={`px-2.5 py-1 text-xs rounded-md border transition ${data.disease_activity === o.v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >{o.l}</button>
            ))}
          </div>
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700 block mb-2">Decorso</Label>
          <div className="flex gap-1 mb-3 flex-wrap">
            {[{v:"relapsing_remitting",l:"Recidivante-remittente"},{v:"chronic_progressive",l:"Cronico progressivo"},{v:"monophasic",l:"Monoperiodico"}].map(o => (
              <button key={o.v} type="button" onClick={() => set("course", data.course === o.v ? "" : o.v)}
                className={`px-2.5 py-1 text-xs rounded-md border transition ${data.course === o.v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >{o.l}</button>
            ))}
          </div>
          <Textarea rows={4} value={data.altro || ""} onChange={e => set("altro", e.target.value)} placeholder="Trattamento: dapsone (mild), steroidi, MTX, azatioprina, ciclosporina, TNFi, rituximab (refrattario)…" data-testid="rpc-altro" />
        </div>
      </div>
    </Card>
  );
}
