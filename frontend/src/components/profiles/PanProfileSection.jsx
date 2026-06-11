import React, { useEffect, useState } from "react";
import { diseaseProfileApi } from "../../lib/api";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Save, Beaker, HeartPulse, Stethoscope, AlertTriangle, FileText, ScanLine } from "lucide-react";
import { toast } from "sonner";

const CAUSES = [
  { value: "hbv",          label: "HBV (epatite B)" },
  { value: "hcv",          label: "HCV (epatite C)" },
  { value: "hiv",          label: "HIV" },
  { value: "paraneoplastic", label: "Paraneoplastica" },
  { value: "idiopathic",   label: "Idiopatica" },
  { value: "other",        label: "Altra" },
];

const TERRITORIES = [
  { key: "peripheral_neuro", label: "Neuro periferico",    hint: "Mononeurite multipla (caratteristica)", warn: true },
  { key: "renal",            label: "Renale",              hint: "Stenosi/aneurismi art. renali — NO glomerulonefrite" },
  { key: "mesenteric",       label: "Mesenterico",         hint: "Angina mesenterica, infarto intestinale" },
  { key: "skin",             label: "Cutaneo",             hint: "Livedo reticularis, ulcere, noduli" },
  { key: "testicular",       label: "Testicolare",         hint: "Orchite/epididimite (caratteristica di PAN)" },
  { key: "cardiac",          label: "Coronarico",          hint: "Raro: IMA, disfunzione ventricolare" },
  { key: "hepatic",          label: "Epatico/biliare",     hint: "Infarto epatico, colangiopatia ischemica" },
  { key: "muscle",           label: "Muscolo",             hint: "Mialgie, claudicatio" },
];

const SKIN_FEATURES = [
  { key: "livedo",     label: "Livedo reticularis" },
  { key: "ulcers",     label: "Ulcere cutanee" },
  { key: "nodules",    label: "Noduli sottocutanei" },
  { key: "purpura",    label: "Porpora palpabile" },
  { key: "necrosis",   label: "Necrosi cutanea" },
];

const IMAGING = [
  { key: "angio_ct",       label: "Angio-TC (aneurismi/stenosi)" },
  { key: "angio_mri",      label: "Angio-RMN" },
  { key: "arteriography",  label: "Arteriografia convenzionale (gold standard)" },
  { key: "eco_doppler",    label: "Eco-Doppler renale/addominale" },
];

const DIAG_BASIS = [
  { key: "acr_criteria_1990", label: "Criteri ACR 1990 (≥3/10)" },
  { key: "angiography_aneurysms", label: "Angiografia: aneurismi arterie medie" },
  { key: "biopsy_positive",  label: "Biopsia: vasculite necrotizzante" },
  { key: "anca_negative",    label: "ANCA negativo (esclude MPA)" },
  { key: "no_gn",            label: "Assenza glomerulonefrite (esclude MPA)" },
  { key: "hbv_associated",   label: "Associazione HBV confermata" },
];

const TERNARY = [
  { value: "positive", label: "Positivo" },
  { value: "negative", label: "Negativo" },
  { value: "unknown",  label: "N.D." },
];

const DEFAULT = {
  form_type: "",
  associated_cause: "",
  cause_detail: "",
  hbv_status: "unknown",
  hbv_dna: "unknown",
  hcv_status: "unknown",
  anca_status: "unknown",
  territories: {},
  skin_features: {},
  neuro_detail: "",
  renal_aneurysm: false,
  renal_stenosis: false,
  imaging: {},
  imaging_findings: "",
  biopsy: false,
  biopsy_site: "",
  biopsy_finding: "",
  diagnostic_basis: {},
  course: "",
  altro: "",
};

export default function PanProfileSection({ patient, onUpdated }) {
  const [data, setData] = useState(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!patient?.id) return;
    diseaseProfileApi.get(patient.id, "pan")
      .then(doc => { if (doc?.data) setData(p => ({ ...DEFAULT, ...p, ...doc.data })); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [patient?.id]);

  const set = (key, val) => setData(p => ({ ...p, [key]: val }));
  const setNested = (obj, key, val) => setData(p => ({ ...p, [obj]: { ...p[obj], [key]: val } }));

  const save = async () => {
    setSaving(true);
    try {
      await diseaseProfileApi.upsert(patient.id, "pan", data);
      toast.success("Profilo PAN salvato");
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

  if (!loaded) return <Card className="p-6 text-sm text-gray-500">Caricamento profilo PAN…</Card>;

  return (
    <Card className="border-gray-200 shadow-sm p-6" data-testid="pan-profile-section">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-1">Profilo clinico</div>
          <h2 className="font-heading font-black text-2xl tracking-tight text-[#0A2540]">Poliarterite Nodosa (PAN)</h2>
          <p className="text-xs text-gray-500 mt-0.5">Vasculite necrotizzante dei vasi medi — ANCA-negativa</p>
        </div>
        <Button onClick={save} disabled={saving} className="bg-[#0A2540] text-white hover:bg-[#051626]" data-testid="pan-save-btn">
          <Save className="w-4 h-4 mr-2" /> {saving ? "Salvataggio..." : "Salva profilo"}
        </Button>
      </div>

      {/* FORMA CLINICA + CAUSA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Stethoscope className="w-4 h-4 text-[#0A2540]" />
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Forma clinica</Label>
          </div>
          <div className="space-y-1.5">
            {[
              { v: "systemic",  l: "PAN sistemica",  h: "Coinvolgimento multiviscerale — prognosi peggiore" },
              { v: "cutaneous", l: "PAN cutanea",     h: "Isolata alla cute e ai nervi periferici — prognosi favorevole" },
            ].map(t => (
              <label key={t.v} className={`flex items-start gap-2.5 border rounded-md p-2.5 cursor-pointer transition ${data.form_type === t.v ? "border-[#0A2540] bg-[#F9FAFB]" : "border-gray-200 hover:bg-gray-50"}`}>
                <input type="radio" checked={data.form_type === t.v} onChange={() => set("form_type", t.v)} className="mt-0.5" />
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
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Causa associata</Label>
          </div>
          <div className="flex flex-wrap gap-1 mb-2">
            {CAUSES.map(c => (
              <button key={c.value} type="button"
                onClick={() => set("associated_cause", data.associated_cause === c.value ? "" : c.value)}
                className={`px-2.5 py-1 text-xs rounded-md border transition ${data.associated_cause === c.value ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >{c.label}</button>
            ))}
          </div>
          {data.associated_cause && !["idiopathic"].includes(data.associated_cause) && (
            <Input className="text-xs" value={data.cause_detail || ""} onChange={e => set("cause_detail", e.target.value)} placeholder="Dettaglio (es. AgHBs+, HBV-DNA carica virale, tumore primitivo…)" />
          )}
        </div>
      </div>

      {/* SIEROLOGICO */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Beaker className="w-4 h-4 text-[#0A2540]" />
          <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Sierologico</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs text-gray-600">HBV (AgHBs)</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {TERNARY.map(o => (
                <button key={o.value} type="button" onClick={() => set("hbv_status", o.value)}
                  className={`px-2 py-1 text-xs rounded-md border transition ${data.hbv_status === o.value ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                >{o.label}</button>
              ))}
            </div>
            {data.hbv_status === "positive" && (
              <div className="mt-1.5">
                <Label className="text-xs text-gray-500">HBV-DNA</Label>
                <div className="flex gap-1 mt-0.5 flex-wrap">
                  {[{v:"detectable",l:"Rilevabile"},{v:"undetectable",l:"Irrilevabile"}].map(o => (
                    <button key={o.v} type="button" onClick={() => set("hbv_dna", o.v)}
                      className={`px-2 py-0.5 text-xs rounded-md border transition ${data.hbv_dna === o.v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                    >{o.l}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <TernaryRow field="hcv_status" label="HCV" />
          <div>
            <Label className="text-xs text-gray-600">ANCA</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {TERNARY.map(o => (
                <button key={o.value} type="button" onClick={() => set("anca_status", o.value)}
                  className={`px-2 py-1 text-xs rounded-md border transition ${data.anca_status === o.value
                    ? data.anca_status === "negative" ? "bg-green-600 text-white border-green-600"
                      : data.anca_status === "positive" ? "bg-red-600 text-white border-red-600"
                      : "bg-[#0A2540] text-white border-[#0A2540]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                >{o.label}</button>
              ))}
            </div>
            {data.anca_status === "negative" && (
              <p className="text-[10px] text-green-700 mt-1">✓ Coerente con PAN (esclude MPA)</p>
            )}
            {data.anca_status === "positive" && (
              <p className="text-[10px] text-amber-600 mt-1">⚠ Riconsiderare diagnosi (MPA?)</p>
            )}
          </div>
        </div>
      </div>

      {/* TERRITORI COLPITI */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <HeartPulse className="w-4 h-4 text-[#0A2540]" />
          <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Territori vascolari coinvolti</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          {TERRITORIES.map(o => {
            const checked = !!data.territories?.[o.key];
            return (
              <label key={o.key} className={`flex items-start gap-2 border rounded-md p-2.5 cursor-pointer transition ${checked ? o.warn ? "border-orange-400 bg-orange-50/60" : "border-red-300 bg-red-50/60" : "border-gray-200 hover:bg-gray-50"}`} data-testid={`pan-territory-${o.key}`}>
                <Checkbox checked={checked} onCheckedChange={v => setNested("territories", o.key, !!v)} />
                <div>
                  <div className="text-xs font-medium leading-tight">{o.label}</div>
                  <div className="text-[9px] text-gray-500 mt-0.5 leading-tight">{o.hint}</div>
                </div>
              </label>
            );
          })}
        </div>

        {data.territories?.peripheral_neuro && (
          <div className="border border-orange-200 rounded-lg p-3 bg-orange-50/30 mb-2">
            <div className="text-xs font-semibold text-orange-700 mb-1">Neuropatia periferica — Dettaglio</div>
            <Input value={data.neuro_detail || ""} onChange={e => set("neuro_detail", e.target.value)} placeholder="es. mononeurite multipla: sciatico-popliteo est. dx, cubitale sin.; EMG: pattern assonale" className="text-xs" />
          </div>
        )}

        {data.territories?.renal && (
          <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/30 mb-2">
            <div className="text-xs font-semibold text-blue-700 mb-2">Renale — Dettaglio (NO glomerulonefrite in PAN)</div>
            <div className="flex gap-3">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox checked={!!data.renal_aneurysm} onCheckedChange={v => set("renal_aneurysm", !!v)} />
                Aneurismi arterie renali
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox checked={!!data.renal_stenosis} onCheckedChange={v => set("renal_stenosis", !!v)} />
                Stenosi arterie renali
              </label>
            </div>
          </div>
        )}

        {data.territories?.skin && (
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/40 mb-2">
            <div className="text-xs font-semibold text-gray-600 mb-2">Cute — Manifestazioni</div>
            <div className="flex flex-wrap gap-2">
              {SKIN_FEATURES.map(f => (
                <label key={f.key} className={`flex items-center gap-1.5 border rounded-md px-2.5 py-1.5 text-xs cursor-pointer transition ${data.skin_features?.[f.key] ? "border-purple-300 bg-purple-50 text-purple-800" : "border-gray-200 hover:bg-gray-50 text-gray-700"}`}>
                  <Checkbox checked={!!data.skin_features?.[f.key]} onCheckedChange={v => setNested("skin_features", f.key, !!v)} />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* IMAGING */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <ScanLine className="w-4 h-4 text-[#0A2540]" />
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Imaging vascolare</Label>
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          {IMAGING.map(img => (
            <label key={img.key} className={`flex items-center gap-1.5 border rounded-md px-3 py-1.5 text-xs cursor-pointer transition ${data.imaging?.[img.key] ? "border-[#0A2540] bg-[#F9FAFB]" : "border-gray-200 hover:bg-gray-50"}`}>
              <Checkbox checked={!!data.imaging?.[img.key]} onCheckedChange={v => setNested("imaging", img.key, !!v)} />
              {img.label}
            </label>
          ))}
        </div>
        {Object.values(data.imaging || {}).some(Boolean) && (
          <Input value={data.imaging_findings || ""} onChange={e => set("imaging_findings", e.target.value)} placeholder="Reperti: es. aneurismi a rosario arterie renali (3-5mm), stenosi arteria mesenterica superiore" className="text-xs" />
        )}
      </div>

      {/* BIOPSIA */}
      <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50/30">
        <label className="flex items-center gap-2 cursor-pointer mb-2">
          <Checkbox checked={!!data.biopsy} onCheckedChange={v => set("biopsy", !!v)} />
          <span className="text-sm font-medium">Biopsia eseguita</span>
        </label>
        {data.biopsy && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-6">
            <div>
              <Label className="text-xs text-gray-600">Sede</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {["Muscolo (gastrocnemio)", "Nervo surale", "Cute", "Testicolo", "Rene (raro)"].map(s => (
                  <button key={s} type="button" onClick={() => set("biopsy_site", data.biopsy_site === s ? "" : s)}
                    className={`px-2 py-0.5 text-xs rounded border transition ${data.biopsy_site === s ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                  >{s}</button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600">Referto</Label>
              <Input value={data.biopsy_finding || ""} onChange={e => set("biopsy_finding", e.target.value)} placeholder="es. vasculite necrotizzante dei vasi medi, infiltrato neutrofilico e mononucleare, necrosi fibrinoide" className="text-xs mt-1" />
            </div>
          </div>
        )}
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
          <div className="flex gap-1 mb-3">
            {[{v:"acute",l:"Acuto"},{v:"relapsing",l:"Recidivante"},{v:"chronic",l:"Cronico"}].map(o => (
              <button key={o.v} type="button" onClick={() => set("course", data.course === o.v ? "" : o.v)}
                className={`px-2.5 py-1 text-xs rounded-md border transition ${data.course === o.v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >{o.l}</button>
            ))}
          </div>
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700 block mb-2">Note cliniche</Label>
          <Textarea rows={4} value={data.altro || ""} onChange={e => set("altro", e.target.value)} placeholder="Trattamento antivirale (HBV), risposta a steroidi/ciclofosfamide, evoluzione renale, complicanze ischemiche…" data-testid="pan-altro" />
        </div>
      </div>
    </Card>
  );
}
