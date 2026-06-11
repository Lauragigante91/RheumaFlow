import React, { useEffect, useState, useMemo } from "react";
import { diseaseProfileApi } from "../../lib/api";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Save, Beaker, Target, FileText, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const JOINTS = [
  { key: "mtp1",     label: "1° MTP (podagra)" },
  { key: "ankle",    label: "Caviglia" },
  { key: "knee",     label: "Ginocchio" },
  { key: "wrist",    label: "Polso" },
  { key: "elbow",    label: "Gomito (borsa olecranica)" },
  { key: "finger",   label: "Dita mani" },
  { key: "midfoot",  label: "Mesopiede" },
  { key: "hip",      label: "Anca (raro)" },
];

const TOPHI_SITES = [
  { key: "ear",        label: "Orecchio (elice)" },
  { key: "olecranon",  label: "Borsa olecranica" },
  { key: "mtp1",       label: "Alluce / 1° MTP" },
  { key: "fingers",    label: "Dita mani" },
  { key: "achilles",   label: "Tendine Achilleo" },
  { key: "intradermal", label: "Sottocutanei / intradermici" },
];

const IMAGING = [
  { key: "us_double_contour", label: "Ecografia: segno del doppio contorno" },
  { key: "us_tophus",         label: "Ecografia: tofi intrasinoviali/tendinei" },
  { key: "xray_erosions",     label: "Rx: erosioni a strapiombo (punch-out)" },
  { key: "dect_urate",        label: "DECT: depositi urato" },
  { key: "crystal_confirmed", label: "Artrocentesi: cristalli MSU (gold standard)" },
];

const COMORBIDITIES = [
  { key: "ckd",         label: "IRC / CKD" },
  { key: "hypertension", label: "Ipertensione" },
  { key: "metabolic",   label: "Sindrome metabolica / diabete" },
  { key: "diuretics",   label: "Diuretici tiazidici/ansa" },
  { key: "cyclosporine", label: "Ciclosporina" },
  { key: "chemo",       label: "Chemioterapia / lisi tumorale" },
];

const DIAG_BASIS = [
  { key: "crystal_pos",    label: "Cristalli MSU all'artrocentesi" },
  { key: "acr_eular_2015", label: "Criteri ACR/EULAR 2015 (score ≥8)" },
  { key: "clinical_classic", label: "Presentazione clinica classica (podagra + iperuricemia)" },
  { key: "imaging_positive", label: "Imaging: doppio contorno o DECT positivo" },
];

const DEFAULT = {
  course: "",
  urate_baseline: "",
  urate_current: "",
  urate_target: "6",
  flare_frequency: "",
  last_flare_date: "",
  flare_duration_days: "",
  affected_joints: {},
  tophaceous: false,
  tophi_sites: {},
  tophi_detail: "",
  imaging: {},
  ult_drug: "",
  ult_dose: "",
  ult_max_dose: "",
  prophylaxis: "",
  comorbidities: {},
  ckd_stage: "",
  diagnostic_basis: {},
  altro: "",
};

export default function GoutProfileSection({ patient, onUpdated }) {
  const [data, setData] = useState(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!patient?.id) return;
    diseaseProfileApi.get(patient.id, "gout")
      .then(doc => { if (doc?.data) setData(p => ({ ...DEFAULT, ...p, ...doc.data })); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [patient?.id]);

  const set = (k, v) => setData(p => ({ ...p, [k]: v }));
  const setNested = (obj, k, v) => setData(p => ({ ...p, [obj]: { ...p[obj], [k]: v } }));

  const urateCurrent = parseFloat(data.urate_current);
  const urateTarget  = parseFloat(data.urate_target) || 6;
  const urateAtTarget = !isNaN(urateCurrent) && urateCurrent <= urateTarget;
  const urateHighAlert = !isNaN(urateCurrent) && urateCurrent > 9;

  const save = async () => {
    setSaving(true);
    try {
      await diseaseProfileApi.upsert(patient.id, "gout", data);
      toast.success("Profilo gotta salvato");
      if (onUpdated) onUpdated(data);
    } catch (e) { toast.error(e.response?.data?.detail || "Errore salvataggio"); }
    finally { setSaving(false); }
  };

  if (!loaded) return <Card className="p-6 text-sm text-gray-500">Caricamento profilo gotta…</Card>;

  return (
    <Card className="border-gray-200 shadow-sm p-6" data-testid="gout-profile-section">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-1">Profilo clinico</div>
          <h2 className="font-heading font-black text-2xl tracking-tight text-[#0A2540]">Gotta (Artrite Uratica)</h2>
        </div>
        <Button onClick={save} disabled={saving} className="bg-[#0A2540] text-white hover:bg-[#051626]">
          <Save className="w-4 h-4 mr-2" />{saving ? "Salvataggio..." : "Salva profilo"}
        </Button>
      </div>

      {/* URICEMIA + TARGET */}
      <div className="mb-6 border rounded-lg p-4 bg-gray-50/30">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-[#0A2540]" />
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Uricemia e target</Label>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
          <div>
            <Label className="text-xs text-gray-600">Uricemia basale (mg/dL)</Label>
            <Input value={data.urate_baseline || ""} onChange={e => set("urate_baseline", e.target.value)} placeholder="es. 9.8" className="text-xs mt-1" />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Uricemia attuale (mg/dL)</Label>
            <Input value={data.urate_current || ""} onChange={e => set("urate_current", e.target.value)} placeholder="es. 5.4" className="text-xs mt-1" />
            {!isNaN(urateCurrent) && (
              <p className={`text-[10px] mt-0.5 font-medium ${urateAtTarget ? "text-green-700" : urateHighAlert ? "text-red-600" : "text-amber-600"}`}>
                {urateAtTarget ? `✓ Sotto target (≤${urateTarget} mg/dL)` : urateHighAlert ? "⚠ Alto rischio flare / progressione" : `→ Sopra target (>${urateTarget} mg/dL)`}
              </p>
            )}
          </div>
          <div>
            <Label className="text-xs text-gray-600">Target uricemia</Label>
            <div className="flex gap-1 mt-1">
              {[{v:"6",l:"<6 mg/dL (standard)"},{v:"5",l:"<5 mg/dL (tofi)"}].map(o => (
                <button key={o.v} type="button" onClick={() => set("urate_target", o.v)}
                  className={`px-2 py-0.5 text-xs rounded border transition ${data.urate_target === o.v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                >{o.l}</button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Stadio IRC (se presente)</Label>
            <Input value={data.ckd_stage || ""} onChange={e => set("ckd_stage", e.target.value)} placeholder="es. G3b (eGFR 30–44)" className="text-xs mt-1" />
          </div>
        </div>
      </div>

      {/* DECORSO + FLARE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700 block mb-2">Decorso</Label>
          <div className="flex flex-wrap gap-1 mb-3">
            {[{v:"acute_intermittent",l:"Acuta intermittente"},{v:"intercritical",l:"Intercritica"},{v:"chronic_tophaceous",l:"Cronica tofacea"}].map(o => (
              <button key={o.v} type="button" onClick={() => set("course", data.course === o.v ? "" : o.v)}
                className={`px-2.5 py-1 text-xs rounded-md border transition ${data.course === o.v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >{o.l}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs text-gray-600">Flare/anno</Label>
              <Input value={data.flare_frequency || ""} onChange={e => set("flare_frequency", e.target.value)} placeholder="es. 4" className="text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Ultimo flare</Label>
              <Input type="date" value={data.last_flare_date || ""} onChange={e => set("last_flare_date", e.target.value)} className="text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Durata (gg)</Label>
              <Input value={data.flare_duration_days || ""} onChange={e => set("flare_duration_days", e.target.value)} placeholder="es. 7" className="text-xs mt-1" />
            </div>
          </div>
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700 block mb-2">Articolazioni coinvolte</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {JOINTS.map(j => (
              <label key={j.key} className={`flex items-center gap-1.5 border rounded-md px-2 py-1.5 text-xs cursor-pointer transition ${data.affected_joints?.[j.key] ? "border-[#0A2540] bg-[#F0F4F8]" : "border-gray-200 hover:bg-gray-50"}`}>
                <Checkbox checked={!!data.affected_joints?.[j.key]} onCheckedChange={v => setNested("affected_joints", j.key, !!v)} />
                {j.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* TOFI */}
      <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50/30">
        <label className="flex items-center gap-2 cursor-pointer mb-2">
          <Checkbox checked={!!data.tophaceous} onCheckedChange={v => set("tophaceous", !!v)} />
          <span className="text-sm font-medium">Malattia tofacea (tofi presenti)</span>
          {data.tophaceous && <span className="text-xs text-amber-600 ml-2">→ Target uricemia &lt;5 mg/dL</span>}
        </label>
        {data.tophaceous && (
          <div className="ml-6 space-y-2">
            <div className="flex flex-wrap gap-2">
              {TOPHI_SITES.map(s => (
                <label key={s.key} className={`flex items-center gap-1.5 border rounded-md px-2.5 py-1.5 text-xs cursor-pointer transition ${data.tophi_sites?.[s.key] ? "border-amber-400 bg-amber-50 text-amber-900" : "border-gray-200 hover:bg-gray-50"}`}>
                  <Checkbox checked={!!data.tophi_sites?.[s.key]} onCheckedChange={v => setNested("tophi_sites", s.key, !!v)} />
                  {s.label}
                </label>
              ))}
            </div>
            <Input value={data.tophi_detail || ""} onChange={e => set("tophi_detail", e.target.value)} placeholder="Dettaglio: dimensioni, numero, ulcerazione" className="text-xs" />
          </div>
        )}
      </div>

      {/* IMAGING */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-[#0A2540]" />
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Imaging / conferma diagnostica</Label>
        </div>
        <div className="flex flex-wrap gap-2">
          {IMAGING.map(img => (
            <label key={img.key} className={`flex items-center gap-1.5 border rounded-md px-3 py-1.5 text-xs cursor-pointer transition ${data.imaging?.[img.key] ? "border-[#0A2540] bg-[#F9FAFB]" : "border-gray-200 hover:bg-gray-50"}`}>
              <Checkbox checked={!!data.imaging?.[img.key]} onCheckedChange={v => setNested("imaging", img.key, !!v)} />
              {img.label}
            </label>
          ))}
        </div>
      </div>

      {/* TERAPIA + COMORBIDITÀ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Beaker className="w-4 h-4 text-[#0A2540]" />
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Terapia ipouricemizzante (ULT)</Label>
          </div>
          <div className="flex flex-wrap gap-1 mb-2">
            {["Allopurinolo","Febuxostat","Benzbromarone","Probenecid","Pegloticase","Nessuna"].map(v => (
              <button key={v} type="button" onClick={() => set("ult_drug", data.ult_drug === v ? "" : v)}
                className={`px-2 py-0.5 text-xs rounded border transition ${data.ult_drug === v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >{v}</button>
            ))}
          </div>
          {data.ult_drug && data.ult_drug !== "Nessuna" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-gray-600">Dose attuale</Label>
                <Input value={data.ult_dose || ""} onChange={e => set("ult_dose", e.target.value)} placeholder="es. 300 mg/die" className="text-xs mt-0.5" />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Dose massima raggiunta</Label>
                <Input value={data.ult_max_dose || ""} onChange={e => set("ult_max_dose", e.target.value)} placeholder="es. 600 mg/die" className="text-xs mt-0.5" />
              </div>
            </div>
          )}
          <div className="mt-2">
            <Label className="text-xs text-gray-600">Profilassi flare</Label>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {["Colchicina 0.5 mg/die","Colchicina 1 mg/die","FANS a bassa dose","Nessuna"].map(v => (
                <button key={v} type="button" onClick={() => set("prophylaxis", data.prophylaxis === v ? "" : v)}
                  className={`px-2 py-0.5 text-xs rounded border transition ${data.prophylaxis === v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                >{v}</button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Comorbidità rilevanti</Label>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {COMORBIDITIES.map(c => (
              <label key={c.key} className={`flex items-center gap-1.5 border rounded-md px-2 py-1.5 text-xs cursor-pointer transition ${data.comorbidities?.[c.key] ? "border-amber-300 bg-amber-50/60" : "border-gray-200 hover:bg-gray-50"}`}>
                <Checkbox checked={!!data.comorbidities?.[c.key]} onCheckedChange={v => setNested("comorbidities", c.key, !!v)} />
                {c.label}
              </label>
            ))}
          </div>
          <div className="mt-4">
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700 block mb-2">Base diagnostica</Label>
            <div className="space-y-1">
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
      </div>

      <Textarea rows={2} value={data.altro || ""} onChange={e => set("altro", e.target.value)} placeholder="Note: allopurinolo ipersensibilità (HLA-B*5801), febuxostat e rischio CV, risposta a pegloticase…" data-testid="gout-altro" />
    </Card>
  );
}
