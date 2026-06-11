import React, { useEffect, useState, useMemo } from "react";
import { diseaseProfileApi } from "../../lib/api";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Save, Beaker, HeartPulse, AlertTriangle, FileText, Eye, Brain } from "lucide-react";
import { toast } from "sonner";

// ICBD 2014 scoring items
const ICBD_ITEMS = [
  { key: "oral_ulcers",    label: "Ulcere orali ricorrenti",    points: 2, hint: "≥3 episodi/anno" },
  { key: "genital_ulcers", label: "Ulcere genitali",            points: 2, hint: "Scroto/pene o vulva/vagina, cicatrici incluse" },
  { key: "ocular",         label: "Manifestazioni oculari",     points: 2, hint: "Uveite anteriore/posteriore, panuveite, vasculite retinica" },
  { key: "skin_lesions",   label: "Lesioni cutanee",            points: 1, hint: "Pseudofollicolite, eritema nodoso, acneiforme" },
  { key: "neuro",          label: "Manifestazioni neurologiche", points: 1, hint: "Neuro-Behçet: trombosi seno venoso, encefalite, meningite asettica" },
  { key: "vascular",       label: "Manifestazioni vascolari",   points: 1, hint: "TVP, trombosi arteriosa, aneurisma (aortico/polmonare)" },
  { key: "pathergy",       label: "Patergia positiva",          points: 1, hint: "Richiede prick test (non routinario in Europa)" },
];

const OCULAR_TYPES = [
  { key: "ant_uveitis",  label: "Uveite anteriore" },
  { key: "post_uveitis", label: "Uveite posteriore / panuveite" },
  { key: "retinal_vas",  label: "Vasculite retinica" },
  { key: "optic_neuritis", label: "Neurite ottica" },
];

const SKIN_TYPES = [
  { key: "pseudofolliculitis", label: "Pseudofollicolite" },
  { key: "erythema_nodosum",  label: "Eritema nodoso" },
  { key: "acneiform",        label: "Lesioni acneiformi" },
  { key: "ulcers",           label: "Ulcere cutanee" },
];

const NEURO_TYPES = [
  { key: "cvst",            label: "Trombosi seno venoso (CVST)" },
  { key: "encephalitis",    label: "Meningo-encefalite" },
  { key: "brainstem",       label: "Coinvolgimento tronco encefalico" },
  { key: "psychiatric",     label: "Manifestazioni neuropsichiatriche" },
  { key: "spinal",          label: "Mielopatia" },
];

const VASCULAR_TYPES = [
  { key: "dvt",             label: "TVP (arti inferiori/superiori)" },
  { key: "vena_cava",       label: "Trombosi vena cava" },
  { key: "arterial",        label: "Trombosi arteriosa" },
  { key: "aneurysm_aorta",  label: "Aneurisma aortico" },
  { key: "aneurysm_pulm",   label: "Aneurisma polmonare (gravissimo)" },
  { key: "budd_chiari",     label: "Sindrome di Budd-Chiari" },
];

const DIAG_BASIS = [
  { key: "icbd_criteria",   label: "Criteri ICBD 2014 (score ≥4)" },
  { key: "isg_criteria",    label: "Criteri ISG 1990 (storico)" },
  { key: "pathergy_done",   label: "Test patergia eseguito" },
  { key: "hla_b51_tested",  label: "HLA-B51 testato" },
  { key: "neuro_mri",       label: "RMN encefalo (lesioni T2/FLAIR)" },
  { key: "angio_ct",        label: "Angio-TC (aneurismi/trombosi)" },
  { key: "ophthalmology",   label: "Valutazione oculistica con FFA" },
  { key: "ileocolonoscopy",  label: "Ileo-colonscopia (ulcere GI)" },
];

const TERNARY = [
  { value: "positive", label: "Positivo" },
  { value: "negative", label: "Negativo" },
  { value: "unknown",  label: "N.D." },
];

const DEFAULT = {
  icbd: {},
  ocular_types: {},
  ocular_laterality: "",
  visual_acuity_affected: false,
  skin_types: {},
  neuro_types: {},
  vascular_types: {},
  oral_frequency: "",
  oral_size: "",
  gi_involvement: false,
  gi_finding: "",
  joint_involvement: false,
  joint_type: "",
  cardiac: false,
  scrotal_involvement: false,
  hla_b51: "unknown",
  pathergy_test: "unknown",
  disease_activity: "",
  course: "",
  diagnostic_basis: {},
  altro: "",
};

export default function BehcetProfileSection({ patient, onUpdated }) {
  const [data, setData] = useState(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!patient?.id) return;
    diseaseProfileApi.get(patient.id, "behcet")
      .then(doc => { if (doc?.data) setData(p => ({ ...DEFAULT, ...p, ...doc.data })); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [patient?.id]);

  const set = (key, val) => setData(p => ({ ...p, [key]: val }));
  const setNested = (obj, key, val) => setData(p => ({ ...p, [obj]: { ...p[obj], [key]: val } }));

  const icbdScore = useMemo(() => {
    return ICBD_ITEMS.reduce((sum, item) => sum + (data.icbd?.[item.key] ? item.points : 0), 0);
  }, [data.icbd]);

  const icbdSatisfied = icbdScore >= 4;

  const save = async () => {
    setSaving(true);
    try {
      await diseaseProfileApi.upsert(patient.id, "behcet", data);
      toast.success("Profilo Behçet salvato");
      if (onUpdated) onUpdated(data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <Card className="p-6 text-sm text-gray-500">Caricamento profilo Behçet…</Card>;

  return (
    <Card className="border-gray-200 shadow-sm p-6" data-testid="behcet-profile-section">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-1">Profilo clinico</div>
          <h2 className="font-heading font-black text-2xl tracking-tight text-[#0A2540]">Malattia di Behçet</h2>
        </div>
        <Button onClick={save} disabled={saving} className="bg-[#0A2540] text-white hover:bg-[#051626]" data-testid="behcet-save-btn">
          <Save className="w-4 h-4 mr-2" /> {saving ? "Salvataggio..." : "Salva profilo"}
        </Button>
      </div>

      {/* CRITERI ICBD 2014 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#0A2540]" />
            <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Criteri ICBD 2014</h3>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold border ${icbdSatisfied ? "bg-green-50 border-green-300 text-green-700" : "bg-gray-100 border-gray-300 text-gray-600"}`}>
            <span>Score: {icbdScore} / 10</span>
            {icbdSatisfied && <span className="text-xs font-normal">✓ Criteri soddisfatti (≥4)</span>}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {ICBD_ITEMS.map(item => {
            const checked = !!data.icbd?.[item.key];
            return (
              <label key={item.key} className={`flex items-start gap-3 border rounded-md p-3 cursor-pointer transition ${checked ? "border-[#0A2540] bg-[#F0F4F8]" : "border-gray-200 hover:bg-gray-50"}`} data-testid={`behcet-icbd-${item.key}`}>
                <Checkbox checked={checked} onCheckedChange={v => setNested("icbd", item.key, !!v)} className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${checked ? "bg-[#0A2540] text-white" : "bg-gray-200 text-gray-600"}`}>+{item.points}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{item.hint}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* HLA-B51 + PATERGIA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Beaker className="w-4 h-4 text-[#0A2540]" />
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">HLA-B51</Label>
          </div>
          <div className="flex gap-1">
            {TERNARY.map(o => (
              <button key={o.value} type="button" onClick={() => set("hla_b51", o.value)}
                className={`px-2.5 py-1 text-xs rounded-md border transition ${data.hla_b51 === o.value ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >{o.label}</button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700 block mb-2">Test patergia</Label>
          <div className="flex gap-1">
            {[...TERNARY, {value:"not_done", label:"Non eseguito"}].map(o => (
              <button key={o.value} type="button" onClick={() => set("pathergy_test", o.value)}
                className={`px-2.5 py-1 text-xs rounded-md border transition ${data.pathergy_test === o.value ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >{o.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* MANIFESTAZIONI — ULCERE ORALI */}
      {data.icbd?.oral_ulcers && (
        <div className="mb-4 border border-gray-200 rounded-lg p-4 bg-gray-50/40">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">Ulcere orali — Dettaglio</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-600">Frequenza annua</Label>
              <Input value={data.oral_frequency || ""} onChange={e => set("oral_frequency", e.target.value)} placeholder="es. ≥3 episodi/anno" className="text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Dimensioni / sedi</Label>
              <Input value={data.oral_size || ""} onChange={e => set("oral_size", e.target.value)} placeholder="es. minori &lt;1cm, labbra e guance" className="text-xs mt-1" />
            </div>
          </div>
        </div>
      )}

      {/* MANIFESTAZIONI — OCULARI */}
      {data.icbd?.ocular && (
        <div className="mb-4 border border-amber-200 rounded-lg p-4 bg-amber-50/30">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-3.5 h-3.5 text-amber-700" />
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Occhio — Dettaglio</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-600 block mb-1">Tipo</Label>
              <div className="flex flex-wrap gap-1">
                {OCULAR_TYPES.map(t => (
                  <label key={t.key} className={`flex items-center gap-1.5 border rounded-md px-2 py-1 text-xs cursor-pointer transition ${data.ocular_types?.[t.key] ? "border-amber-400 bg-amber-100 text-amber-900" : "border-gray-200 hover:bg-gray-50"}`}>
                    <Checkbox checked={!!data.ocular_types?.[t.key]} onCheckedChange={v => setNested("ocular_types", t.key, !!v)} />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600 block mb-1">Lateralità</Label>
              <div className="flex gap-1">
                {[{v:"mono",l:"Monoculare"},{v:"bilateral",l:"Bilaterale"}].map(o => (
                  <button key={o.v} type="button" onClick={() => set("ocular_laterality", data.ocular_laterality === o.v ? "" : o.v)}
                    className={`px-2.5 py-1 text-xs rounded-md border transition ${data.ocular_laterality === o.v ? "bg-amber-600 text-white border-amber-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                  >{o.l}</button>
                ))}
              </div>
              <label className="flex items-center gap-1.5 mt-2 cursor-pointer">
                <Checkbox checked={!!data.visual_acuity_affected} onCheckedChange={v => set("visual_acuity_affected", !!v)} />
                <span className="text-xs text-red-700 font-medium">Acuità visiva ridotta / danno permanente</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* MANIFESTAZIONI — CUTE */}
      {data.icbd?.skin_lesions && (
        <div className="mb-4 border border-gray-200 rounded-lg p-4 bg-gray-50/40">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">Cute — Tipo lesioni</div>
          <div className="flex flex-wrap gap-2">
            {SKIN_TYPES.map(t => (
              <label key={t.key} className={`flex items-center gap-1.5 border rounded-md px-2.5 py-1.5 text-xs cursor-pointer transition ${data.skin_types?.[t.key] ? "border-pink-300 bg-pink-50 text-pink-900" : "border-gray-200 hover:bg-gray-50"}`}>
                <Checkbox checked={!!data.skin_types?.[t.key]} onCheckedChange={v => setNested("skin_types", t.key, !!v)} />
                {t.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* MANIFESTAZIONI — NEUROLOGICHE */}
      {data.icbd?.neuro && (
        <div className="mb-4 border border-red-200 rounded-lg p-4 bg-red-50/20">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-3.5 h-3.5 text-red-700" />
            <div className="text-xs font-semibold uppercase tracking-wide text-red-700">Neuro-Behçet — Dettaglio</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {NEURO_TYPES.map(t => (
              <label key={t.key} className={`flex items-center gap-1.5 border rounded-md px-2.5 py-1.5 text-xs cursor-pointer transition ${data.neuro_types?.[t.key] ? "border-red-400 bg-red-100 text-red-900" : "border-gray-200 hover:bg-gray-50"}`}>
                <Checkbox checked={!!data.neuro_types?.[t.key]} onCheckedChange={v => setNested("neuro_types", t.key, !!v)} />
                {t.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* MANIFESTAZIONI — VASCOLARI */}
      {data.icbd?.vascular && (
        <div className="mb-4 border border-red-300 rounded-lg p-4 bg-red-50/30">
          <div className="flex items-center gap-2 mb-2">
            <HeartPulse className="w-3.5 h-3.5 text-red-700" />
            <div className="text-xs font-semibold uppercase tracking-wide text-red-700">Vascolare — Dettaglio</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {VASCULAR_TYPES.map(t => (
              <label key={t.key} className={`flex items-center gap-1.5 border rounded-md px-2.5 py-1.5 text-xs cursor-pointer transition ${data.vascular_types?.[t.key] ? "border-red-400 bg-red-100 text-red-900" : "border-gray-200 hover:bg-gray-50"}`}>
                <Checkbox checked={!!data.vascular_types?.[t.key]} onCheckedChange={v => setNested("vascular_types", t.key, !!v)} />
                {t.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ALTRI ORGANI */}
      <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50/30">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-3">Altri organi coinvolti</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-1">
              <Checkbox checked={!!data.gi_involvement} onCheckedChange={v => set("gi_involvement", !!v)} />
              <span className="text-sm font-medium">Coinvolgimento GI</span>
            </label>
            {data.gi_involvement && (
              <Input value={data.gi_finding || ""} onChange={e => set("gi_finding", e.target.value)} placeholder="es. ulcere ileocoliche (ileo terminale, cieco)" className="text-xs ml-6" />
            )}
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-1">
              <Checkbox checked={!!data.joint_involvement} onCheckedChange={v => set("joint_involvement", !!v)} />
              <span className="text-sm font-medium">Coinvolgimento articolare</span>
            </label>
            {data.joint_involvement && (
              <div className="flex gap-1 ml-6 flex-wrap">
                {["Artralgie","Artrite","Artrite erosiva"].map(v => (
                  <button key={v} type="button" onClick={() => set("joint_type", data.joint_type === v ? "" : v)}
                    className={`px-2 py-0.5 text-xs rounded border transition ${data.joint_type === v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                  >{v}</button>
                ))}
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={!!data.scrotal_involvement} onCheckedChange={v => set("scrotal_involvement", !!v)} />
            <span className="text-sm">Coinvolgimento scrotale (epididimite / orchite)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={!!data.cardiac} onCheckedChange={v => set("cardiac", !!v)} />
            <span className="text-sm">Coinvolgimento cardiaco (raro)</span>
          </label>
        </div>
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

      {/* ATTIVITÀ + DECORSO + NOTE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700 block mb-2">Attività di malattia</Label>
          <div className="flex flex-col gap-1">
            {[{v:"active",l:"Malattia attiva"},{v:"partial",l:"Risposta parziale"},{v:"remission",l:"Remissione"}].map(o => (
              <button key={o.v} type="button" onClick={() => set("disease_activity", data.disease_activity === o.v ? "" : o.v)}
                className={`px-2.5 py-1.5 text-xs rounded-md border text-left transition ${data.disease_activity === o.v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >{o.l}</button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700 block mb-2">Decorso</Label>
          <div className="flex flex-col gap-1">
            {[{v:"relapsing",l:"Recidivante-remittente"},{v:"chronic",l:"Cronico progressivo"},{v:"monophasic",l:"Monoperiodico"}].map(o => (
              <button key={o.v} type="button" onClick={() => set("course", data.course === o.v ? "" : o.v)}
                className={`px-2.5 py-1.5 text-xs rounded-md border text-left transition ${data.course === o.v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >{o.l}</button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700 block mb-2">Note cliniche</Label>
          <Textarea rows={4} value={data.altro || ""} onChange={e => set("altro", e.target.value)} placeholder="Risposta a colchicina, azatioprina, ciclosporina, biologici (IFX, secukinumab, apremilast)…" data-testid="behcet-altro" />
        </div>
      </div>
    </Card>
  );
}
