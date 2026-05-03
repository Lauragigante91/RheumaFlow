import React, { useEffect, useState } from "react";
import { diseaseProfileApi } from "../lib/api";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { Save, Beaker, HeartPulse, Stethoscope, FileText } from "lucide-react";
import { toast } from "sonner";

// Organi coinvolti (piccoli e medi vasi)
export const AAV_ORGANS = [
  { key: "kidney", label: "Rene", hint: "Glomerulonefrite / insuff. renale" },
  { key: "lung", label: "Polmone", hint: "Noduli, emorragia alveolare, cavità" },
  { key: "ent", label: "ORL", hint: "Naso, seni paranasali, orecchio medio, tracheo-bronchiale" },
  { key: "skin", label: "Cute", hint: "Porpora palpabile, ulcere, noduli" },
  { key: "nervous", label: "Neuro periferico", hint: "Mononeurite multipla, polineuropatia" },
  { key: "cns", label: "SNC", hint: "Pachimeningite, stroke" },
  { key: "eye", label: "Occhio", hint: "Sclerite, uveite, pseudotumor orbitario" },
  { key: "gi", label: "GI", hint: "Ischemia mesenterica, sanguinamento" },
  { key: "cardiac", label: "Cardiaco", hint: "Pericardite, miocardite, valvulopatia" },
  { key: "muscular", label: "Muscolo-scheletrico", hint: "Artralgie, artrite, mialgia" },
];

// Base diagnostica
export const AAV_DIAG_BASIS = [
  { key: "biopsy_kidney", label: "Biopsia renale" },
  { key: "biopsy_skin", label: "Biopsia cute" },
  { key: "biopsy_lung", label: "Biopsia polmone" },
  { key: "biopsy_ent", label: "Biopsia ORL" },
  { key: "biopsy_nerve", label: "Biopsia nervo/muscolo" },
  { key: "imaging_ct", label: "TC (torace/seni/addome)" },
  { key: "imaging_mri", label: "RMN" },
  { key: "angio", label: "Angiografia / PET" },
  { key: "clinical_anca", label: "Clinica + ANCA" },
  { key: "eosinophilia", label: "Eosinofilia + asma (EGPA)" },
];

const ANCA_PATTERNS = [
  { value: "cANCA", label: "cANCA" },
  { value: "pANCA", label: "pANCA" },
  { value: "atypical", label: "Atipico / xANCA" },
  { value: "negative", label: "Negativo" },
  { value: "unknown", label: "Non testato" },
];

const ANCA_SPECIFICITY = [
  { value: "PR3", label: "Anti-PR3" },
  { value: "MPO", label: "Anti-MPO" },
  { value: "both", label: "PR3 + MPO" },
  { value: "negative", label: "Negativa" },
  { value: "unknown", label: "Non testata" },
];

export function summarizeAav(profileData) {
  if (!profileData) return { organs: [], basis: [], anca: null };
  const organs = AAV_ORGANS.filter((o) => profileData.organs?.[o.key]).map((o) => o.label);
  const basis = AAV_DIAG_BASIS.filter((b) => profileData.diagnostic_basis?.[b.key]).map((b) => b.label);
  const ancaPattern = profileData.anca_pattern && profileData.anca_pattern !== "unknown" ? profileData.anca_pattern : null;
  const ancaSpec = profileData.anca_specificity && !["unknown", "negative"].includes(profileData.anca_specificity) ? profileData.anca_specificity : null;
  return {
    organs,
    basis,
    anca: ancaPattern || ancaSpec ? { pattern: ancaPattern, specificity: ancaSpec } : null,
  };
}

export default function AavProfileSection({ patient, onUpdated }) {
  const [data, setData] = useState({
    anca_pattern: "unknown",
    anca_specificity: "unknown",
    anca_titer: "",
    organs: {},
    diagnostic_basis: {},
    altro: "",
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!patient?.id) return;
    diseaseProfileApi.get(patient.id, "aav")
      .then((doc) => { if (doc?.data) setData((p) => ({ ...p, ...doc.data })); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [patient?.id]);

  const save = async () => {
    setSaving(true);
    try {
      await diseaseProfileApi.upsert(patient.id, "aav", data);
      toast.success("Profilo vasculite salvato");
      if (onUpdated) onUpdated(data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return <Card className="p-6 text-sm text-gray-500" data-testid="aav-profile-loading">Caricamento profilo vasculite…</Card>;
  }

  return (
    <Card className="border-gray-200 shadow-sm p-6" data-testid="aav-profile-section">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-1">Profilo clinico</div>
          <h2 className="font-heading font-black text-2xl tracking-tight text-[#0A2540]">Vasculite (piccoli/medi vasi)</h2>
        </div>
        <Button onClick={save} disabled={saving} className="bg-[#0A2540] text-white hover:bg-[#051626]" data-testid="aav-profile-save-btn">
          <Save className="w-4 h-4 mr-2" /> {saving ? "Salvataggio..." : "Salva profilo"}
        </Button>
      </div>

      {/* ANCA */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Beaker className="w-4 h-4 text-[#0A2540]" />
          <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">ANCA</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-gray-600">Pattern IFI</Label>
            <div className="flex flex-wrap gap-1 mt-1" data-testid="aav-pattern">
              {ANCA_PATTERNS.map((o) => (
                <button key={o.value} type="button"
                  onClick={() => setData((p) => ({ ...p, anca_pattern: o.value }))}
                  className={`px-2.5 py-1 text-xs rounded-md border ${data.anca_pattern === o.value ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                  data-testid={`aav-pattern-${o.value}`}
                >{o.label}</button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Specificità antigenica</Label>
            <div className="flex flex-wrap gap-1 mt-1" data-testid="aav-specificity">
              {ANCA_SPECIFICITY.map((o) => (
                <button key={o.value} type="button"
                  onClick={() => setData((p) => ({ ...p, anca_specificity: o.value }))}
                  className={`px-2.5 py-1 text-xs rounded-md border ${data.anca_specificity === o.value ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                  data-testid={`aav-spec-${o.value}`}
                >{o.label}</button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Titolo</Label>
            <Input value={data.anca_titer || ""} onChange={(e) => setData((p) => ({ ...p, anca_titer: e.target.value }))} placeholder="es. 1:320 / 120 UI" data-testid="aav-titer" />
          </div>
        </div>
      </div>

      {/* Organi coinvolti */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <HeartPulse className="w-4 h-4 text-[#0A2540]" />
          <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Organi coinvolti</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {AAV_ORGANS.map((o) => {
            const checked = !!data.organs?.[o.key];
            return (
              <label key={o.key} className={`flex items-start gap-2.5 border rounded-md p-2.5 cursor-pointer transition ${checked ? "border-red-300 bg-red-50/60" : "border-gray-200 hover:bg-gray-50"}`} data-testid={`aav-organ-${o.key}`}>
                <Checkbox checked={checked} onCheckedChange={(v) => setData((p) => ({ ...p, organs: { ...p.organs, [o.key]: !!v } }))} />
                <div>
                  <div className="text-sm font-medium leading-tight">{o.label}</div>
                  <div className="text-[10px] text-gray-500 leading-tight mt-0.5">{o.hint}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Base diagnostica */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Stethoscope className="w-4 h-4 text-[#0A2540]" />
          <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Base diagnostica</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {AAV_DIAG_BASIS.map((b) => {
            const checked = !!data.diagnostic_basis?.[b.key];
            return (
              <label key={b.key} className={`flex items-center gap-2.5 border rounded-md p-2.5 cursor-pointer transition ${checked ? "border-[#0A2540] bg-[#F9FAFB]" : "border-gray-200 hover:bg-gray-50"}`} data-testid={`aav-basis-${b.key}`}>
                <Checkbox checked={checked} onCheckedChange={(v) => setData((p) => ({ ...p, diagnostic_basis: { ...p.diagnostic_basis, [b.key]: !!v } }))} />
                <span className="text-sm">{b.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Altro */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-[#0A2540]" />
          <Label className="text-sm font-bold uppercase tracking-[0.12em] text-gray-700">Altro</Label>
        </div>
        <Textarea rows={3} value={data.altro || ""} onChange={(e) => setData((p) => ({ ...p, altro: e.target.value }))} placeholder="Dettagli istologici (necrosi fibrinoide, granulomi, semilune), sede biopsia, note cliniche..." data-testid="aav-altro" />
      </div>
    </Card>
  );
}
