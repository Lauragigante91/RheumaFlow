import React, { useEffect, useState } from "react";
import { diseaseProfileApi } from "../../lib/api";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Save, Beaker, Stethoscope, FileText, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const CAUSES = [
  { value: "drug",          label: "Farmaco" },
  { value: "infection",     label: "Infezione" },
  { value: "paraneoplastic", label: "Paraneoplastica" },
  { value: "ctd_lupus",     label: "CTD — LES" },
  { value: "ctd_sjogren",   label: "CTD — Sjögren" },
  { value: "ctd_ra",        label: "CTD — AR" },
  { value: "cryo",          label: "Crioglobulinemia" },
  { value: "idiopathic",    label: "Idiopatica" },
  { value: "other",         label: "Altra" },
];

const MORPHOLOGY = [
  { key: "palpable_purpura",  label: "Porpora palpabile",        hint: "Lesione classica — dipendente dalla gravità" },
  { key: "petechiae",         label: "Petecchie",                hint: "" },
  { key: "urticaria_vasc",    label: "Orticaria vasculitica",     hint: "Lesioni persistenti >24h" },
  { key: "ulcers",            label: "Ulcere cutanee",           hint: "Forma grave" },
  { key: "vesicles_bullae",   label: "Vescicole / bolle emorragiche", hint: "" },
  { key: "papules",           label: "Papule eritematose",       hint: "" },
  { key: "livedo",            label: "Livedo reticularis",       hint: "" },
  { key: "nodules",           label: "Noduli sottocutanei",      hint: "Raro in CSVV isolata" },
];

const SYSTEMIC_STATUS = [
  { value: "normal",   label: "Normale" },
  { value: "abnormal", label: "Alterato" },
  { value: "unknown",  label: "N.D." },
];

const TERNARY = [
  { value: "positive", label: "Positivo" },
  { value: "negative", label: "Negativo" },
  { value: "unknown",  label: "N.D." },
];

const DIAG_BASIS = [
  { key: "biopsy_lc",        label: "Biopsia: leucocitoclasia (neutrofili degenerati, karyorrhexis)" },
  { key: "biopsy_neutrophil", label: "Biopsia: infiltrato neutrofilico perivasale" },
  { key: "biopsy_fibrin",    label: "Biopsia: necrosi fibrinoide della parete vasale" },
  { key: "biopsy_if",        label: "Biopsia: IF (depositi Ig/complemento)" },
  { key: "clinical_only",    label: "Diagnosi clinica (lesioni tipiche, causa identificata)" },
  { key: "systemic_excluded", label: "Coinvolgimento sistemico escluso (workup negativo)" },
];

const DEFAULT = {
  assessment: "",
  suspected_cause: "",
  cause_detail: "",
  drug_name: "",
  infection_agent: "",
  tumor_detail: "",
  morphology: {},
  distribution: "",
  biopsy: false,
  biopsy_if_result: "",
  biopsy_detail: "",
  systemic_renal: "unknown",
  systemic_pulmonary: "unknown",
  systemic_gi: "unknown",
  serology_anca: "unknown",
  serology_ana: "unknown",
  serology_cryo: "unknown",
  serology_complement: "unknown",
  serology_hbv: "unknown",
  serology_hcv: "unknown",
  diagnostic_basis: {},
  course: "",
  altro: "",
};

export default function CsvvProfileSection({ patient, onUpdated }) {
  const [data, setData] = useState(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!patient?.id) return;
    diseaseProfileApi.get(patient.id, "csvv")
      .then(doc => { if (doc?.data) setData(p => ({ ...DEFAULT, ...p, ...doc.data })); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [patient?.id]);

  const set = (key, val) => setData(p => ({ ...p, [key]: val }));
  const setNested = (obj, key, val) => setData(p => ({ ...p, [obj]: { ...p[obj], [key]: val } }));

  const save = async () => {
    setSaving(true);
    try {
      await diseaseProfileApi.upsert(patient.id, "csvv", data);
      toast.success("Profilo vasculite cutanea salvato");
      if (onUpdated) onUpdated(data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const SysRow = ({ field, label }) => (
    <div>
      <Label className="text-xs text-gray-600">{label}</Label>
      <div className="flex gap-1 mt-1">
        {SYSTEMIC_STATUS.map(o => (
          <button key={o.value} type="button" onClick={() => set(field, o.value)}
            className={`px-2 py-0.5 text-xs rounded-md border transition ${data[field] === o.value
              ? o.value === "normal" ? "bg-green-600 text-white border-green-600"
                : o.value === "abnormal" ? "bg-red-500 text-white border-red-500"
                : "bg-gray-400 text-white border-gray-400"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
          >{o.label}</button>
        ))}
      </div>
    </div>
  );

  const TernaryRow = ({ field, label }) => (
    <div>
      <Label className="text-xs text-gray-600">{label}</Label>
      <div className="flex gap-1 mt-1">
        {TERNARY.map(o => (
          <button key={o.value} type="button" onClick={() => set(field, o.value)}
            className={`px-2 py-0.5 text-xs rounded-md border transition ${data[field] === o.value ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
          >{o.label}</button>
        ))}
      </div>
    </div>
  );

  if (!loaded) return <Card className="p-6 text-sm text-gray-500">Caricamento profilo vasculite cutanea…</Card>;

  const isSystemicSuspected = data.assessment === "systemic_workup" ||
    data.systemic_renal === "abnormal" || data.systemic_pulmonary === "abnormal" || data.systemic_gi === "abnormal";

  return (
    <Card className="border-gray-200 shadow-sm p-6" data-testid="csvv-profile-section">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-1">Profilo clinico</div>
          <h2 className="font-heading font-black text-2xl tracking-tight text-[#0A2540]">Vasculite Cutanea dei Piccoli Vasi (CSVV)</h2>
          <p className="text-xs text-gray-500 mt-0.5">Vasculite leucocitoclastica <strong>isolata alla cute</strong> — assenza di coinvolgimento sistemico</p>
        </div>
        <Button onClick={save} disabled={saving} className="bg-[#0A2540] text-white hover:bg-[#051626]" data-testid="csvv-save-btn">
          <Save className="w-4 h-4 mr-2" /> {saving ? "Salvataggio..." : "Salva profilo"}
        </Button>
      </div>

      {/* VALUTAZIONE CLINICA + CAUSA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Stethoscope className="w-4 h-4 text-[#0A2540]" />
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Valutazione clinica</Label>
          </div>
          <div className="space-y-1.5">
            {[
              { v: "isolated_cutaneous", l: "Vasculite cutanea isolata", h: "Nessun coinvolgimento sistemico identificato" },
              { v: "systemic_workup",    l: "Workup sistemico in corso / sospetto CTD", h: "Escludere IgAV, crioglobulinemia, vasculite da CTD" },
            ].map(t => (
              <label key={t.v} className={`flex items-start gap-2.5 border rounded-md p-2.5 cursor-pointer transition ${data.assessment === t.v ? "border-[#0A2540] bg-[#F9FAFB]" : "border-gray-200 hover:bg-gray-50"}`}>
                <input type="radio" checked={data.assessment === t.v} onChange={() => set("assessment", t.v)} className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">{t.l}</div>
                  <div className="text-[10px] text-gray-500">{t.h}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-[#0A2540]" />
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Causa sospetta</Label>
          </div>
          <div className="flex flex-wrap gap-1 mb-2">
            {CAUSES.map(c => (
              <button key={c.value} type="button"
                onClick={() => set("suspected_cause", data.suspected_cause === c.value ? "" : c.value)}
                className={`px-2.5 py-1 text-xs rounded-md border transition ${data.suspected_cause === c.value ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >{c.label}</button>
            ))}
          </div>
          {data.suspected_cause === "drug" && (
            <Input className="text-xs mt-1" value={data.drug_name || ""} onChange={e => set("drug_name", e.target.value)} placeholder="Farmaco sospetto (es. amoxicillina, FANS, allopurinolo)" />
          )}
          {data.suspected_cause === "infection" && (
            <Input className="text-xs mt-1" value={data.infection_agent || ""} onChange={e => set("infection_agent", e.target.value)} placeholder="Agente (es. SBEA, HBV, parvovirus B19, SARS-CoV-2)" />
          )}
          {data.suspected_cause === "paraneoplastic" && (
            <Input className="text-xs mt-1" value={data.tumor_detail || ""} onChange={e => set("tumor_detail", e.target.value)} placeholder="Tumore noto o sospetto" />
          )}
          {data.suspected_cause === "other" && (
            <Input className="text-xs mt-1" value={data.cause_detail || ""} onChange={e => set("cause_detail", e.target.value)} placeholder="Specificare…" />
          )}
        </div>
      </div>

      {/* MORFOLOGIA CUTANEA */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Morfologia cutanea</Label>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          {MORPHOLOGY.map(o => {
            const checked = !!data.morphology?.[o.key];
            return (
              <label key={o.key} className={`flex items-start gap-2 border rounded-md p-2.5 cursor-pointer transition ${checked ? "border-purple-300 bg-purple-50/60" : "border-gray-200 hover:bg-gray-50"}`} data-testid={`csvv-morph-${o.key}`}>
                <Checkbox checked={checked} onCheckedChange={v => setNested("morphology", o.key, !!v)} />
                <div>
                  <div className="text-xs font-medium leading-tight">{o.label}</div>
                  {o.hint && <div className="text-[9px] text-gray-500 mt-0.5">{o.hint}</div>}
                </div>
              </label>
            );
          })}
        </div>
        <div>
          <Label className="text-xs text-gray-600">Distribuzione</Label>
          <div className="flex flex-wrap gap-1 mt-1">
            {["Arti inferiori (tipica)", "Glutei", "Tronco", "Generalizzata"].map(v => (
              <button key={v} type="button" onClick={() => set("distribution", data.distribution === v ? "" : v)}
                className={`px-2.5 py-1 text-xs rounded-md border transition ${data.distribution === v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >{v}</button>
            ))}
          </div>
        </div>
      </div>

      {/* BIOPSIA */}
      <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50/30">
        <label className="flex items-center gap-2 cursor-pointer mb-2">
          <Checkbox checked={!!data.biopsy} onCheckedChange={v => set("biopsy", !!v)} />
          <span className="text-sm font-medium">Biopsia cutanea eseguita</span>
        </label>
        {data.biopsy && (
          <div className="space-y-2 ml-6">
            <div>
              <Label className="text-xs text-gray-600">IF diretta</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {["IgA+ (→ escludere IgAV)", "IgM+", "IgG+", "C3+", "Negativa", "Non eseguita"].map(v => (
                  <button key={v} type="button" onClick={() => set("biopsy_if_result", data.biopsy_if_result === v ? "" : v)}
                    className={`px-2 py-0.5 text-xs rounded border transition ${data.biopsy_if_result === v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                  >{v}</button>
                ))}
              </div>
            </div>
            <Input value={data.biopsy_detail || ""} onChange={e => set("biopsy_detail", e.target.value)} placeholder="Dettaglio istologico (infiltrato neutrofilico, leucocitoclasia, necrosi fibrinoide, eritrodiapedesi)" className="text-xs" />
          </div>
        )}
      </div>

      {/* WORKUP SISTEMICO */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Beaker className="w-4 h-4 text-[#0A2540]" />
          <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Workup sistemico</h3>
        </div>
        {isSystemicSuspected && (
          <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-700">
            <strong>⚠ Attenzione:</strong> Coinvolgimento sistemico sospetto — considerare IgAV, crioglobulinemia, vasculite da CTD come diagnosi alternativa.
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <SysRow field="systemic_renal"     label="Renale (PA, creatinina, urine)" />
          <SysRow field="systemic_pulmonary" label="Polmonare (Rx/TC torace)" />
          <SysRow field="systemic_gi"        label="GI (dolore addominale, sangue)" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <TernaryRow field="serology_anca"       label="ANCA" />
          <TernaryRow field="serology_ana"        label="ANA" />
          <TernaryRow field="serology_cryo"       label="Crioglobuline" />
          <TernaryRow field="serology_complement" label="Complemento (C3/C4)" />
          <TernaryRow field="serology_hbv"        label="HBV" />
          <TernaryRow field="serology_hcv"        label="HCV" />
        </div>
      </div>

      {/* BASE DIAGNOSTICA + DECORSO + NOTE */}
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
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700 block mb-2">Decorso</Label>
          <div className="flex gap-1 mb-3 flex-wrap">
            {[{v:"acute_mono",l:"Acuto monoperiodico"},{v:"recurrent",l:"Recidivante"},{v:"chronic",l:"Cronico"}].map(o => (
              <button key={o.v} type="button" onClick={() => set("course", data.course === o.v ? "" : o.v)}
                className={`px-2.5 py-1 text-xs rounded-md border transition ${data.course === o.v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >{o.l}</button>
            ))}
          </div>
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700 block mb-2">Note cliniche</Label>
          <Textarea rows={4} value={data.altro || ""} onChange={e => set("altro", e.target.value)} placeholder="Farmaco sospeso, risoluzione dopo sospensione, trattamento (dapsone, steroidi), recidive…" data-testid="csvv-altro" />
        </div>
      </div>
    </Card>
  );
}
