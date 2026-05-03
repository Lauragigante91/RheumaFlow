import React, { useEffect, useState } from "react";
import { scleroProfileApi } from "../lib/api";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import {
  Save, Hand, Activity, Wind, Heart, Stethoscope, Bone, Beaker, ChevronDown, ChevronRight, User,
} from "lucide-react";
import { toast } from "sonner";

// Detect scleroderma diagnosis to enable this section
export function isScleroDiagnosis(diagnosi) {
  if (!diagnosi) return false;
  const d = String(diagnosi).toLowerCase();
  return (
    d.includes("sclerosi sistem") ||
    d.includes("sclerodermia") ||
    d.includes("scleroderma") ||
    d.includes("ssc") ||
    d.includes("vedoss") ||
    d.includes("crest")
  );
}

const CUTANEOUS_SUBSETS = [
  { value: "sine_scleroderma", label: "Sine scleroderma (no skin)" },
  { value: "limited", label: "Limitata (lcSSc)" },
  { value: "diffuse", label: "Diffusa (dcSSc)" },
];

const ANTIBODIES = [
  { key: "ana", label: "ANA (titolo + pattern)", type: "text", placeholder: "es. 1:640 nucleolare" },
  { key: "aca", label: "Anti-centromero (ACA)", type: "tristate" },
  { key: "scl70", label: "Anti-topoisomerasi I (Scl-70)", type: "tristate" },
  { key: "rnap3", label: "Anti-RNA polimerasi III", type: "tristate" },
  { key: "u3rnp_fibrillarin", label: "Anti-U3-RNP / fibrillarina", type: "tristate" },
  { key: "th_to", label: "Anti-Th/To", type: "tristate" },
  { key: "pm_scl", label: "Anti-PM/Scl", type: "tristate" },
  { key: "ku", label: "Anti-Ku", type: "tristate" },
  { key: "u1rnp", label: "Anti-U1-RNP (overlap MCTD)", type: "tristate" },
  { key: "ena_other", label: "Altri ENA / note autoanticorpi", type: "text" },
];

const CAPILLAROSCOPY_PATTERNS = [
  { value: "normal", label: "Normale" },
  { value: "non_specific", label: "Aspecifico" },
  { value: "early", label: "Early SSc" },
  { value: "active", label: "Active SSc" },
  { value: "late", label: "Late SSc" },
];

const HRCT_PATTERNS = [
  { value: "none", label: "Assente" },
  { value: "nsip", label: "NSIP (non-specific interstitial pneumonia)" },
  { value: "uip", label: "UIP" },
  { value: "op", label: "OP (organizing pneumonia)" },
  { value: "mixed", label: "Misto / indeterminato" },
];

const PAH_STATUS = [
  { value: "not_screened", label: "Non screenato" },
  { value: "negative", label: "Screening negativo" },
  { value: "suspected", label: "Sospetto (PSAP elevato)" },
  { value: "confirmed", label: "Confermata (RHC+)" },
];

export default function ScleroProfileSection({ patient }) {
  const [profile, setProfile] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openSection, setOpenSection] = useState("cutaneous");

  useEffect(() => {
    if (!patient?.id) return;
    setLoading(true);
    scleroProfileApi.get(patient.id)
      .then((data) => setProfile(data || {}))
      .catch(() => setProfile({}))
      .finally(() => setLoading(false));
  }, [patient?.id]);

  const updateField = (section, key, value) => {
    setProfile((p) => ({
      ...p,
      [section]: { ...(p[section] || {}), [key]: value },
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const data = await scleroProfileApi.upsert(patient.id, {
        cutaneous: profile.cutaneous || null,
        antibody: profile.antibody || null,
        vascular: profile.vascular || null,
        ild: profile.ild || null,
        pah: profile.pah || null,
        gi: profile.gi || null,
        msk: profile.msk || null,
        notes: profile.notes || null,
      });
      setProfile(data);
      toast.success("Profilo Sclerodermia salvato");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const sections = [
    { id: "cutaneous", title: "Impegno cutaneo", icon: Hand, render: renderCutaneous },
    { id: "antibody", title: "Profilo anticorpale", icon: Beaker, render: renderAntibody },
    { id: "vascular", title: "Impegno vascolare", icon: Activity, render: renderVascular },
    { id: "ild", title: "Impegno polmonare interstiziale (ILD)", icon: Wind, render: renderILD },
    { id: "pah", title: "Ipertensione polmonare (PAH)", icon: Heart, render: renderPAH },
    { id: "gi", title: "Impegno gastrointestinale", icon: Stethoscope, render: renderGI },
    { id: "msk", title: "Impegno muscoloscheletrico", icon: Bone, render: renderMSK },
  ];

  return (
    <Card className="border-gray-200 shadow-sm" data-testid="sclero-profile-section">
      <div className="p-6 border-b border-gray-200 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-heading text-xl font-bold tracking-tight text-[#0A2540]">
            Profilo Sclerodermia
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Inquadramento d'organo per sclerosi sistemica. Salvataggio cumulativo (un profilo per paziente, aggiornabile).
          </p>
          {profile.updated_at && (
            <div className="mt-1 text-[11px] text-gray-500 flex items-center gap-1">
              <User className="w-3 h-3" /> Ultima modifica: {profile.updated_by_name || profile.created_by_name || "—"} · {new Date(profile.updated_at).toLocaleString("it-IT")}
            </div>
          )}
        </div>
        <Button
          onClick={save}
          disabled={saving || loading}
          className="bg-[#0A2540] text-white hover:bg-[#051626]"
          data-testid="sclero-save-btn"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Salvataggio..." : "Salva profilo"}
        </Button>
      </div>

      <div className="divide-y divide-gray-200">
        {sections.map((s) => {
          const Icon = s.icon;
          const isOpen = openSection === s.id;
          return (
            <div key={s.id}>
              <button
                onClick={() => setOpenSection(isOpen ? null : s.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
                data-testid={`sclero-section-toggle-${s.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-sm bg-[#0A2540]/5 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-[#0A2540]" />
                  </div>
                  <span className="font-heading font-bold text-sm uppercase tracking-[0.1em] text-[#0A2540]">
                    {s.title}
                  </span>
                  {profile[s.id] && Object.values(profile[s.id]).filter(Boolean).length > 0 && (
                    <Badge variant="outline" className="text-[10px]">compilato</Badge>
                  )}
                </div>
                {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
              </button>
              {isOpen && (
                <div className="px-4 pb-6 pt-2" data-testid={`sclero-section-${s.id}`}>
                  {s.render({ value: profile[s.id] || {}, set: (k, v) => updateField(s.id, k, v) })}
                </div>
              )}
            </div>
          );
        })}

        {/* Notes */}
        <div className="p-4">
          <Label className="text-xs uppercase tracking-[0.1em] text-gray-600">Note generali</Label>
          <Textarea
            value={profile.notes || ""}
            onChange={(e) => setProfile((p) => ({ ...p, notes: e.target.value }))}
            placeholder="Annotazioni libere sull'inquadramento globale..."
            className="mt-2 min-h-[80px]"
            data-testid="sclero-notes"
          />
        </div>
      </div>
    </Card>
  );
}

// ===== Section renderers =====

function TriState({ value, onChange, testid }) {
  const opts = [
    { v: "neg", label: "Neg" },
    { v: "borderline", label: "Borderline" },
    { v: "pos", label: "Pos" },
  ];
  return (
    <div className="inline-flex border border-gray-200 rounded-md overflow-hidden">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(value === o.v ? null : o.v)}
          className={`text-xs px-3 py-1.5 transition-colors ${
            value === o.v
              ? o.v === "pos"
                ? "bg-red-600 text-white"
                : o.v === "borderline"
                ? "bg-amber-500 text-white"
                : "bg-gray-700 text-white"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
          data-testid={`${testid}-${o.v}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-[0.1em] text-gray-600">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function CheckRow({ checked, onChange, label, testid }) {
  return (
    <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer">
      <Checkbox checked={!!checked} onCheckedChange={onChange} data-testid={testid} />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function renderCutaneous({ value, set }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Subset clinico">
        <Select value={value.subset || ""} onValueChange={(v) => set("subset", v)}>
          <SelectTrigger data-testid="sclero-cut-subset"><SelectValue placeholder="Seleziona subset..." /></SelectTrigger>
          <SelectContent>
            {CUTANEOUS_SUBSETS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Anno di esordio cutaneo">
        <Input
          type="number"
          value={value.onset_year || ""}
          onChange={(e) => set("onset_year", e.target.value)}
          placeholder="es. 2020"
          data-testid="sclero-cut-onset"
        />
      </Field>
      <Field label="mRSS più recente (0-51)">
        <Input
          type="number"
          min="0" max="51"
          value={value.mrss_score ?? ""}
          onChange={(e) => set("mrss_score", e.target.value === "" ? null : Number(e.target.value))}
          placeholder="es. 14"
          data-testid="sclero-cut-mrss"
        />
      </Field>
      <Field label="Data mRSS">
        <Input
          type="date"
          value={value.mrss_date || ""}
          onChange={(e) => set("mrss_date", e.target.value)}
          data-testid="sclero-cut-mrss-date"
        />
      </Field>
      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-1">
        <CheckRow checked={value.puffy_fingers} onChange={(v) => set("puffy_fingers", v)} label="Puffy fingers (dita gonfie)" testid="sclero-cut-puffy" />
        <CheckRow checked={value.sclerodactyly} onChange={(v) => set("sclerodactyly", v)} label="Sclerodattilia" testid="sclero-cut-sclerodactyly" />
        <CheckRow checked={value.face_involvement} onChange={(v) => set("face_involvement", v)} label="Coinvolgimento del volto / microstomia" testid="sclero-cut-face" />
        <CheckRow checked={value.calcinosis} onChange={(v) => set("calcinosis", v)} label="Calcinosi cutanea" testid="sclero-cut-calcinosis" />
        <CheckRow checked={value.telangiectasias} onChange={(v) => set("telangiectasias", v)} label="Teleangectasie" testid="sclero-cut-telangiectasias" />
        <CheckRow checked={value.skin_pruritus} onChange={(v) => set("skin_pruritus", v)} label="Prurito cutaneo" testid="sclero-cut-pruritus" />
      </div>
      <div className="md:col-span-2">
        <Field label="Note cutanee">
          <Textarea value={value.notes || ""} onChange={(e) => set("notes", e.target.value)} placeholder="Distribuzione, evoluzione..." data-testid="sclero-cut-notes" />
        </Field>
      </div>
    </div>
  );
}

function renderAntibody({ value, set }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {ANTIBODIES.map((ab) => (
        <Field key={ab.key} label={ab.label}>
          {ab.type === "text" ? (
            <Input
              value={value[ab.key] || ""}
              onChange={(e) => set(ab.key, e.target.value)}
              placeholder={ab.placeholder || ""}
              data-testid={`sclero-ab-${ab.key}`}
            />
          ) : (
            <TriState value={value[ab.key]} onChange={(v) => set(ab.key, v)} testid={`sclero-ab-${ab.key}`} />
          )}
        </Field>
      ))}
    </div>
  );
}

function renderVascular({ value, set }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Fenomeno di Raynaud">
        <Select value={value.raynaud || ""} onValueChange={(v) => set("raynaud", v)}>
          <SelectTrigger data-testid="sclero-vasc-raynaud"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="absent">Assente</SelectItem>
            <SelectItem value="primary">Primario (sospetto)</SelectItem>
            <SelectItem value="secondary">Secondario (SSc-correlato)</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Anno di esordio Raynaud">
        <Input type="number" value={value.raynaud_onset_year || ""} onChange={(e) => set("raynaud_onset_year", e.target.value)} placeholder="es. 2018" data-testid="sclero-vasc-raynaud-year" />
      </Field>
      <Field label="Ulcere digitali">
        <Select value={value.digital_ulcers || ""} onValueChange={(v) => set("digital_ulcers", v)}>
          <SelectTrigger data-testid="sclero-vasc-ulcers"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Mai</SelectItem>
            <SelectItem value="past">Pregresse / cicatrizzate</SelectItem>
            <SelectItem value="active_one">Attive (1)</SelectItem>
            <SelectItem value="active_multiple">Attive multiple</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Pattern capillaroscopia (Cutolo)">
        <Select value={value.capillaroscopy_pattern || ""} onValueChange={(v) => set("capillaroscopy_pattern", v)}>
          <SelectTrigger data-testid="sclero-vasc-capillaroscopy"><SelectValue placeholder="Pattern..." /></SelectTrigger>
          <SelectContent>
            {CAPILLAROSCOPY_PATTERNS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Data ultima capillaroscopia">
        <Input type="date" value={value.capillaroscopy_date || ""} onChange={(e) => set("capillaroscopy_date", e.target.value)} data-testid="sclero-vasc-cap-date" />
      </Field>
      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-1">
        <CheckRow checked={value.pitting_scars} onChange={(v) => set("pitting_scars", v)} label="Pitting scars (cicatrici depresse polpastrello)" testid="sclero-vasc-pitting" />
        <CheckRow checked={value.gangrene} onChange={(v) => set("gangrene", v)} label="Gangrena / amputazione digitale" testid="sclero-vasc-gangrene" />
        <CheckRow checked={value.macrovascular} onChange={(v) => set("macrovascular", v)} label="Coinvolgimento macrovascolare (ictus, IMA, claudicatio)" testid="sclero-vasc-macro" />
        <CheckRow checked={value.renal_crisis} onChange={(v) => set("renal_crisis", v)} label="Crisi renale sclerodermica (anamnesi)" testid="sclero-vasc-renal" />
      </div>
      <div className="md:col-span-2">
        <Field label="Terapia vascolare in corso">
          <Input value={value.therapy || ""} onChange={(e) => set("therapy", e.target.value)} placeholder="es. Nifedipina 30 mg, Sildenafil 20 mg x 3, Iloprost cicli e.v." data-testid="sclero-vasc-therapy" />
        </Field>
      </div>
    </div>
  );
}

function renderILD({ value, set }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="ILD presente">
        <Select value={value.present || ""} onValueChange={(v) => set("present", v)}>
          <SelectTrigger data-testid="sclero-ild-present"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="no">No (HRCT negativa)</SelectItem>
            <SelectItem value="yes_stable">Sì - stabile</SelectItem>
            <SelectItem value="yes_progressive">Sì - progressiva</SelectItem>
            <SelectItem value="not_assessed">Non valutata</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Pattern HRCT">
        <Select value={value.hrct_pattern || ""} onValueChange={(v) => set("hrct_pattern", v)}>
          <SelectTrigger data-testid="sclero-ild-pattern"><SelectValue placeholder="Pattern..." /></SelectTrigger>
          <SelectContent>
            {HRCT_PATTERNS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Estensione HRCT">
        <Select value={value.extent || ""} onValueChange={(v) => set("extent", v)}>
          <SelectTrigger data-testid="sclero-ild-extent"><SelectValue placeholder="Estensione..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="limited">Limitata (&lt;20%)</SelectItem>
            <SelectItem value="extensive">Estesa (≥20% Goh-Wells)</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Data HRCT">
        <Input type="date" value={value.hrct_date || ""} onChange={(e) => set("hrct_date", e.target.value)} data-testid="sclero-ild-hrct-date" />
      </Field>
      <Field label="FVC % predetto">
        <Input type="number" value={value.fvc_percent ?? ""} onChange={(e) => set("fvc_percent", e.target.value === "" ? null : Number(e.target.value))} placeholder="es. 78" data-testid="sclero-ild-fvc" />
      </Field>
      <Field label="DLCO % predetto">
        <Input type="number" value={value.dlco_percent ?? ""} onChange={(e) => set("dlco_percent", e.target.value === "" ? null : Number(e.target.value))} placeholder="es. 62" data-testid="sclero-ild-dlco" />
      </Field>
      <Field label="Data PFR">
        <Input type="date" value={value.pft_date || ""} onChange={(e) => set("pft_date", e.target.value)} data-testid="sclero-ild-pft-date" />
      </Field>
      <Field label="6MWT (metri)">
        <Input type="number" value={value.six_mwt ?? ""} onChange={(e) => set("six_mwt", e.target.value === "" ? null : Number(e.target.value))} placeholder="es. 420" data-testid="sclero-ild-6mwt" />
      </Field>
      <div className="md:col-span-2">
        <Field label="Terapia ILD in corso">
          <Input value={value.therapy || ""} onChange={(e) => set("therapy", e.target.value)} placeholder="es. MMF 2g/die, Nintedanib 150 mg x 2, Tocilizumab 162 mg/sett" data-testid="sclero-ild-therapy" />
        </Field>
      </div>
    </div>
  );
}

function renderPAH({ value, set }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Stato PAH">
        <Select value={value.status || ""} onValueChange={(v) => set("status", v)}>
          <SelectTrigger data-testid="sclero-pah-status"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
          <SelectContent>
            {PAH_STATUS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Data screening">
        <Input type="date" value={value.screening_date || ""} onChange={(e) => set("screening_date", e.target.value)} data-testid="sclero-pah-screen-date" />
      </Field>
      <Field label="PSAP eco (mmHg)">
        <Input type="number" value={value.echo_psap ?? ""} onChange={(e) => set("echo_psap", e.target.value === "" ? null : Number(e.target.value))} placeholder="es. 38" data-testid="sclero-pah-psap" />
      </Field>
      <Field label="NT-proBNP (pg/mL)">
        <Input type="number" value={value.nt_probnp ?? ""} onChange={(e) => set("nt_probnp", e.target.value === "" ? null : Number(e.target.value))} placeholder="es. 250" data-testid="sclero-pah-bnp" />
      </Field>
      <Field label="RHC eseguito">
        <Select value={value.rhc_done || ""} onValueChange={(v) => set("rhc_done", v)}>
          <SelectTrigger data-testid="sclero-pah-rhc"><SelectValue placeholder="..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="no">No</SelectItem>
            <SelectItem value="yes">Sì</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="mPAP cateterismo (mmHg)">
        <Input type="number" value={value.rhc_mpap ?? ""} onChange={(e) => set("rhc_mpap", e.target.value === "" ? null : Number(e.target.value))} placeholder="es. 28" data-testid="sclero-pah-mpap" />
      </Field>
      <Field label="PCWP (mmHg)">
        <Input type="number" value={value.rhc_pcwp ?? ""} onChange={(e) => set("rhc_pcwp", e.target.value === "" ? null : Number(e.target.value))} placeholder="es. 10" data-testid="sclero-pah-pcwp" />
      </Field>
      <Field label="PVR (Wood Units)">
        <Input type="number" step="0.1" value={value.rhc_pvr ?? ""} onChange={(e) => set("rhc_pvr", e.target.value === "" ? null : Number(e.target.value))} placeholder="es. 3.5" data-testid="sclero-pah-pvr" />
      </Field>
      <Field label="Classe funzionale OMS">
        <Select value={value.who_class || ""} onValueChange={(v) => set("who_class", v)}>
          <SelectTrigger data-testid="sclero-pah-who"><SelectValue placeholder="Classe..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="I">I</SelectItem>
            <SelectItem value="II">II</SelectItem>
            <SelectItem value="III">III</SelectItem>
            <SelectItem value="IV">IV</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="md:col-span-2">
        <Field label="Terapia PAH-specifica">
          <Input value={value.therapy || ""} onChange={(e) => set("therapy", e.target.value)} placeholder="es. Sildenafil 20 mg x 3 + Macitentan 10 mg" data-testid="sclero-pah-therapy" />
        </Field>
      </div>
    </div>
  );
}

function renderGI({ value, set }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-1">
        <CheckRow checked={value.gerd} onChange={(v) => set("gerd", v)} label="Reflusso gastroesofageo (GERD)" testid="sclero-gi-gerd" />
        <CheckRow checked={value.esophageal_dysmotility} onChange={(v) => set("esophageal_dysmotility", v)} label="Dismotilità esofagea (manometria/RX)" testid="sclero-gi-esoph" />
        <CheckRow checked={value.dysphagia} onChange={(v) => set("dysphagia", v)} label="Disfagia" testid="sclero-gi-dysphagia" />
        <CheckRow checked={value.gavedeformation} onChange={(v) => set("gavedeformation", v)} label="GAVE (gastric antral vascular ectasia)" testid="sclero-gi-gave" />
        <CheckRow checked={value.sibo} onChange={(v) => set("sibo", v)} label="SIBO (overgrowth batterico tenue)" testid="sclero-gi-sibo" />
        <CheckRow checked={value.intestinal_pseudo_obstruction} onChange={(v) => set("intestinal_pseudo_obstruction", v)} label="Pseudo-ostruzione intestinale" testid="sclero-gi-pseudo" />
        <CheckRow checked={value.fecal_incontinence} onChange={(v) => set("fecal_incontinence", v)} label="Incontinenza fecale" testid="sclero-gi-fec" />
        <CheckRow checked={value.malabsorption} onChange={(v) => set("malabsorption", v)} label="Malassorbimento / steatorrea" testid="sclero-gi-malabs" />
        <CheckRow checked={value.weight_loss} onChange={(v) => set("weight_loss", v)} label="Calo ponderale significativo (&gt;5%)" testid="sclero-gi-weight" />
      </div>
      <div className="md:col-span-2">
        <Field label="Terapia GI in corso">
          <Input value={value.therapy || ""} onChange={(e) => set("therapy", e.target.value)} placeholder="es. PPI alte dosi, Procinetici, Rifaximina cicli, octreotide" data-testid="sclero-gi-therapy" />
        </Field>
      </div>
      <div className="md:col-span-2">
        <Field label="Note GI">
          <Textarea value={value.notes || ""} onChange={(e) => set("notes", e.target.value)} placeholder="Endoscopie, manometrie, esami..." data-testid="sclero-gi-notes" />
        </Field>
      </div>
    </div>
  );
}

function renderMSK({ value, set }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-1">
        <CheckRow checked={value.arthralgia} onChange={(v) => set("arthralgia", v)} label="Artralgie infiammatorie" testid="sclero-msk-arthralgia" />
        <CheckRow checked={value.synovitis} onChange={(v) => set("synovitis", v)} label="Sinovite clinicamente attiva" testid="sclero-msk-synovitis" />
        <CheckRow checked={value.tendon_friction_rubs} onChange={(v) => set("tendon_friction_rubs", v)} label="Tendon friction rubs" testid="sclero-msk-tfr" />
        <CheckRow checked={value.contractures} onChange={(v) => set("contractures", v)} label="Contratture articolari (mani/gomiti)" testid="sclero-msk-contractures" />
        <CheckRow checked={value.acroosteolysis} onChange={(v) => set("acroosteolysis", v)} label="Acroosteolisi (RX mani)" testid="sclero-msk-acroosteo" />
        <CheckRow checked={value.myalgia} onChange={(v) => set("myalgia", v)} label="Mialgie" testid="sclero-msk-myalgia" />
        <CheckRow checked={value.myositis} onChange={(v) => set("myositis", v)} label="Miosite (CK elevati / EMG / biopsia)" testid="sclero-msk-myositis" />
        <CheckRow checked={value.weakness} onChange={(v) => set("weakness", v)} label="Debolezza muscolare prossimale" testid="sclero-msk-weakness" />
      </div>
      <Field label="CK più recente (U/L)">
        <Input type="number" value={value.ck_value ?? ""} onChange={(e) => set("ck_value", e.target.value === "" ? null : Number(e.target.value))} placeholder="es. 180" data-testid="sclero-msk-ck" />
      </Field>
      <Field label="Data CK">
        <Input type="date" value={value.ck_date || ""} onChange={(e) => set("ck_date", e.target.value)} data-testid="sclero-msk-ck-date" />
      </Field>
      <div className="md:col-span-2">
        <Field label="Terapia MSK in corso">
          <Input value={value.therapy || ""} onChange={(e) => set("therapy", e.target.value)} placeholder="es. MTX 15 mg/sett, FANS al bisogno, Fisioterapia" data-testid="sclero-msk-therapy" />
        </Field>
      </div>
    </div>
  );
}
