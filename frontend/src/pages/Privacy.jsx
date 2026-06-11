import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { orgApi } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { ShieldCheck, FileDown, Lock, Info, Check } from "lucide-react";
import { toast } from "sonner";
import { generateInformativaPDF, generateRegistroTrattamentiPDF, generateCodiceLabelPDF } from "../lib/privacyTemplates";

export default function Privacy() {
  const { user, refreshMe } = useAuth();
  const [saving, setSaving] = useState(false);
  const [organizationName, setOrganizationName] = useState(user?.organization_name || "UO Reumatologia");
  const [dpoEmail, setDpoEmail] = useState("");

  const pseudo = user?.pseudonymized_mode === true;
  const isAdmin = user?.role === "admin";

  const togglePseudo = async (enabled) => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      await orgApi.updateSettings({ pseudonymized_mode: enabled });
      await refreshMe();
      toast.success(enabled ? "Modalità pseudonimizzata attivata" : "Modalità pseudonimizzata disattivata");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 fade-in max-w-5xl" data-testid="privacy-page">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-2">GDPR · Privacy</div>
        <h1 className="font-heading text-4xl md:text-5xl font-black tracking-tighter text-[#0A2540]">
          Privacy &amp; GDPR
        </h1>
        <p className="mt-2 text-gray-600 max-w-3xl">
          Gestione delle impostazioni di pseudonimizzazione e scarico dei template precompilati per il rispetto del
          Regolamento UE 679/2016 (GDPR) e del Codice Privacy italiano (D.Lgs 196/2003 come modificato dal D.Lgs 101/2018).
        </p>
      </div>

      {/* Pseudonymization toggle */}
      <Card className="border-gray-200 shadow-sm p-6" data-testid="pseudo-card">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 flex-1 min-w-[260px]">
            <div className="w-10 h-10 rounded-sm bg-emerald-600 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-xl tracking-tight flex items-center gap-2">
                Modalità pseudonimizzata
                {pseudo && <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">ATTIVA</Badge>}
              </h2>
              <p className="mt-1 text-sm text-gray-600 max-w-xl">
                Quando attiva, l'app NON memorizza nome/cognome/CF/data di nascita. Per ogni paziente usa solo un codice
                (es. <span className="font-mono">RX-2026-001</span>) + anno di nascita + sesso + diagnosi. La tabella
                di corrispondenza codice↔identità resta fuori dall'app (registro cartaceo/Excel offline).
              </p>
              <p className="mt-2 text-xs text-gray-500 max-w-xl">
                Base giuridica: Art. 9(2)(h) GDPR (finalità di cura) + Art. 2-septies Codice Privacy. Con
                pseudonimizzazione forte non è richiesto il consenso esplicito del paziente, ma va comunque fornita
                l'informativa (scarica sotto).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={pseudo}
              onCheckedChange={togglePseudo}
              disabled={saving || !isAdmin}
              data-testid="pseudo-toggle"
            />
            <span className="text-sm font-medium">{pseudo ? "Attiva" : "Disattiva"}</span>
          </div>
        </div>
        {!isAdmin && (
          <div className="mt-4 text-xs text-amber-700 flex items-center gap-1.5">
            <Lock className="w-3 h-3" /> Solo l'amministratore dell'UO può modificare questa impostazione.
          </div>
        )}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <FeatureRow ok label="Il codice paziente diventa obbligatorio; nome/cognome/CF/data nascita sono nascosti dai form." />
          <FeatureRow ok label="Al posto della data di nascita viene chiesto solo l'anno (meno identificante, permette calcolo età)." />
          <FeatureRow ok label="I pazienti esistenti con dati nominativi vanno anonimizzati dalla scheda paziente." />
          <FeatureRow ok label="Tutti gli export (JSON/CSV) riflettono i dati pseudonimizzati." />
        </div>
      </Card>

      {/* Templates */}
      <Card className="border-gray-200 shadow-sm" data-testid="templates-card">
        <div className="p-6 border-b border-gray-200">
          <h2 className="font-heading font-bold text-xl tracking-tight flex items-center gap-2">
            <FileDown className="w-5 h-5" /> Template PDF
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Documenti precompilati da personalizzare con i tuoi dati. Scarica, modifica i campi segnaposto e conserva firmati/datati.
          </p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-md p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-semibold">Art. 13-14 GDPR</div>
            <h3 className="font-heading font-bold text-lg tracking-tight mt-1">Informativa al paziente</h3>
            <p className="mt-1 text-xs text-gray-600">
              Da consegnare (o mostrare) al paziente alla prima visita. Non richiede firma se usi la modalità pseudonimizzata.
            </p>
            <div className="mt-2 mb-3 space-y-2">
              <div>
                <label className="text-[10px] uppercase tracking-[0.15em] text-gray-500">Nome UO / Studio</label>
                <input
                  type="text"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  className="mt-1 w-full px-2 py-1 text-xs border border-gray-200 rounded-md"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.15em] text-gray-500">Email DPO/Referente (opzionale)</label>
                <input
                  type="text"
                  value={dpoEmail}
                  onChange={(e) => setDpoEmail(e.target.value)}
                  placeholder="privacy@..."
                  className="mt-1 w-full px-2 py-1 text-xs border border-gray-200 rounded-md"
                />
              </div>
            </div>
            <Button
              onClick={() => generateInformativaPDF({ orgName: organizationName, dpoEmail })}
              className="w-full bg-[#0A2540] hover:bg-[#051626] text-white"
              data-testid="download-informativa"
            >
              <FileDown className="w-4 h-4 mr-2" /> Scarica Informativa Privacy
            </Button>
          </div>

          <div className="border border-gray-200 rounded-md p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-semibold">Art. 30 GDPR</div>
            <h3 className="font-heading font-bold text-lg tracking-tight mt-1">Registro dei trattamenti</h3>
            <p className="mt-1 text-xs text-gray-600">
              Obbligatorio per il titolare del trattamento. Documento interno da conservare (non firmato, ma datato).
            </p>
            <div className="mt-2 mb-3">
              <label className="text-[10px] uppercase tracking-[0.15em] text-gray-500">Nome UO / Studio</label>
              <input
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                className="mt-1 w-full px-2 py-1 text-xs border border-gray-200 rounded-md"
              />
            </div>
            <Button
              onClick={() => generateRegistroTrattamentiPDF({ orgName: organizationName, dpoEmail })}
              className="w-full bg-[#0A2540] hover:bg-[#051626] text-white"
              data-testid="download-registro"
            >
              <FileDown className="w-4 h-4 mr-2" /> Scarica Registro Trattamenti
            </Button>
          </div>

          <div className="border border-gray-200 rounded-md p-4 md:col-span-2">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-semibold">Fascicolo cartaceo</div>
            <h3 className="font-heading font-bold text-lg tracking-tight mt-1">Etichetta codice paziente</h3>
            <p className="mt-1 text-xs text-gray-600">
              Etichetta stampabile da attaccare al fascicolo cartaceo con la corrispondenza codice→identità.
              <strong> Da conservare offline, fuori dall'app.</strong>
            </p>
            <Button
              variant="outline"
              onClick={() => generateCodiceLabelPDF()}
              className="mt-3"
              data-testid="download-label"
            >
              <FileDown className="w-4 h-4 mr-2" /> Scarica modello etichette
            </Button>
          </div>
        </div>
      </Card>

      {/* Info box */}
      <Card className="border-blue-200 bg-blue-50 shadow-sm p-5" data-testid="privacy-info-box">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-700 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 space-y-2">
            <p>
              <strong>Consiglio operativo:</strong> per minimizzare gli obblighi GDPR, attiva la modalità pseudonimizzata,
              scarica e conserva i due template sopra, e mantieni la tabella codice→identità in un registro cartaceo
              (o foglio Excel cifrato) nel tuo studio/reparto.
            </p>
            <p className="text-xs">
              Ricorda: l'app non sostituisce il parere di un DPO per strutture complesse. Per UO ospedaliere è
              generalmente già coperta dall'informativa aziendale.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function FeatureRow({ ok, label }) {
  return (
    <div className="flex items-start gap-2">
      {ok ? <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" /> : <span className="w-3.5 h-3.5" />}
      <span className="text-gray-700">{label}</span>
    </div>
  );
}
