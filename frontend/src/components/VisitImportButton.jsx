import React, { useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Sparkles, Loader2, FileText, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { aiApi, patientsApi, assessmentsApi, scleroProfileApi, therapiesApi, labExamsApi } from "../lib/api";

const SAMPLE = `Visita ambulatoriale del 15/02/2026.
Paziente: Mario Rossi, 58 anni, M.
Diagnosi: Artrite reumatoide sieropositiva.
Esame: 6 articolazioni dolenti (TJC), 4 tumefatte (SJC). DAS28-CRP 4.2 (alta attività). VAS-PtGA 50/100.
Esami: VES 32, PCR 18 mg/L, RF positivo, anti-CCP positivo.
Terapia in corso: Methotrexate 15 mg/sett s.c., Acido folico 5 mg, Prednisone 5 mg/die.`;

export default function VisitImportButton({ patient, onImported }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [applying, setApplying] = useState(false);
  const [selected, setSelected] = useState({
    patient: true,
    assessments: true,
    therapies: true,
    lab_exams: true,
    sclero_profile: true,
  });

  const reset = () => {
    setText("");
    setExtracted(null);
    setLoading(false);
    setApplying(false);
  };

  const close = () => {
    setOpen(false);
    setTimeout(reset, 200);
  };

  const parse = async () => {
    if (text.trim().length < 30) {
      toast.error("Inserisci almeno 30 caratteri di testo della visita");
      return;
    }
    setLoading(true);
    try {
      const res = await aiApi.parseVisit(text, patient?.id);
      setExtracted(res.extracted);
      toast.success("Estrazione AI completata. Verifica i dati e applica.");
    } catch (e) {
      const msg = e.response?.data?.detail || "Errore AI";
      if (msg.toLowerCase().includes("budget")) {
        toast.error("Credito chiave LLM Emergent esaurito. Vai su Profilo → Universal Key → Add Balance.", { duration: 8000 });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!extracted || !patient) return;
    setApplying(true);
    try {
      let updates = 0;

      // Patient anagraphics + diagnosi
      if (selected.patient && extracted.patient) {
        const patch = {};
        const pp = extracted.patient;
        ["nome", "cognome", "data_nascita", "sesso", "codice_fiscale", "diagnosi"].forEach((k) => {
          if (pp[k] && pp[k] !== patient[k]) patch[k] = pp[k];
        });
        if (Object.keys(patch).length > 0) {
          await patientsApi.update(patient.id, patch);
          updates += 1;
        }
      }

      // Assessments
      if (selected.assessments && Array.isArray(extracted.assessments)) {
        for (const a of extracted.assessments) {
          if (!a.index_type) continue;
          const today = new Date().toISOString().slice(0, 10);
          await assessmentsApi.create({
            patient_id: patient.id,
            index_type: a.index_type,
            date: a.date || today,
            score: a.score ?? null,
            interpretation: a.interpretation || null,
            inputs: a.inputs || {},
            tender_joints: Array.isArray(a.tender_joints) ? a.tender_joints : [],
            swollen_joints: Array.isArray(a.swollen_joints) ? a.swollen_joints : [],
            notes: a.notes || null,
          });
          updates += 1;
        }
      }

      // Therapies
      if (selected.therapies && Array.isArray(extracted.therapies)) {
        for (const t of extracted.therapies) {
          if (!t.drug_name) continue;
          await therapiesApi.create({
            patient_id: patient.id,
            drug_name: t.drug_name,
            category: t.category || "other",
            dose: t.dose || null,
            frequency: t.frequency || null,
            route: t.route || null,
            start_date: t.start_date || new Date().toISOString().slice(0, 10),
            end_date: null,
            status: t.status || "active",
            notes: t.notes || null,
          });
          updates += 1;
        }
      }

      // Lab exams
      if (selected.lab_exams && Array.isArray(extracted.lab_exams)) {
        for (const ex of extracted.lab_exams) {
          if (!ex.results || ex.results.length === 0) continue;
          await labExamsApi.create({
            patient_id: patient.id,
            category: ex.category || "altro",
            date: ex.date || new Date().toISOString().slice(0, 10),
            results: ex.results,
            notes: null,
          });
          updates += 1;
        }
      }

      // Sclero profile
      if (selected.sclero_profile && extracted.sclero_profile) {
        const sp = extracted.sclero_profile;
        const hasContent = Object.values(sp).some((v) => v && Object.keys(v || {}).length > 0);
        if (hasContent) {
          // Merge with existing profile if any
          let existing = await scleroProfileApi.get(patient.id).catch(() => null);
          existing = existing || {};
          const merged = {};
          ["cutaneous", "antibody", "vascular", "ild", "pah", "gi", "msk"].forEach((sec) => {
            const aiSec = sp[sec] || {};
            const exSec = existing[sec] || {};
            const out = { ...exSec };
            Object.entries(aiSec).forEach(([k, v]) => {
              if (v !== null && v !== undefined && v !== "") out[k] = v;
            });
            if (Object.keys(out).length > 0) merged[sec] = out;
          });
          await scleroProfileApi.upsert(patient.id, merged);
          updates += 1;
        }
      }

      toast.success(`Importazione completata (${updates} sezioni aggiornate)`);
      close();
      onImported?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore durante l'applicazione");
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white shadow-md"
        data-testid="ai-import-btn"
      >
        <Sparkles className="w-4 h-4 mr-2" /> Importa da testo visita (AI)
      </Button>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto" data-testid="ai-import-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-600" /> Importa visita con AI
            </DialogTitle>
          </DialogHeader>

          {!extracted ? (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                Incolla il testo della visita. L'AI (<span className="font-mono">Claude Sonnet 4.5</span>) estrarrà
                anagrafica, diagnosi, indici clinimetrici, esami di laboratorio, terapie e — se SSc — il profilo organo-specifico.
                Potrai rivedere e selezionare cosa applicare.
              </div>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={SAMPLE}
                className="min-h-[280px] font-mono text-xs"
                data-testid="ai-import-textarea"
              />
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setText(SAMPLE)}
                  className="text-xs text-gray-500 hover:text-[#0A2540] underline"
                  type="button"
                >
                  Usa testo esempio
                </button>
                <span className="text-xs text-gray-400">{text.length} caratteri</span>
              </div>
            </div>
          ) : (
            <ExtractedReview
              extracted={extracted}
              selected={selected}
              setSelected={setSelected}
            />
          )}

          <DialogFooter className="gap-2">
            {!extracted ? (
              <>
                <Button variant="outline" onClick={close}>Annulla</Button>
                <Button
                  onClick={parse}
                  disabled={loading || text.trim().length < 30}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                  data-testid="ai-parse-btn"
                >
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Estrazione...</> : <><Sparkles className="w-4 h-4 mr-2" /> Estrai dati</>}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setExtracted(null)}>Modifica testo</Button>
                <Button
                  onClick={apply}
                  disabled={applying}
                  className="bg-[#0A2540] hover:bg-[#051626] text-white"
                  data-testid="ai-apply-btn"
                >
                  {applying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Applicazione...</> : <><Check className="w-4 h-4 mr-2" /> Applica al paziente</>}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ExtractedReview({ extracted, selected, setSelected }) {
  const sections = [
    { key: "patient", label: "Anagrafica + Diagnosi", count: extracted.patient ? Object.values(extracted.patient).filter(Boolean).length : 0 },
    { key: "assessments", label: "Indici clinimetrici", count: (extracted.assessments || []).length },
    { key: "therapies", label: "Terapie", count: (extracted.therapies || []).length },
    { key: "lab_exams", label: "Esami di laboratorio", count: (extracted.lab_exams || []).length },
    { key: "sclero_profile", label: "Profilo Sclerodermia", count: extracted.sclero_profile ? Object.values(extracted.sclero_profile).filter((v) => v && Object.keys(v || {}).length > 0).length : 0 },
  ];

  return (
    <div className="space-y-4" data-testid="ai-review">
      {extracted.summary && (
        <div className="p-3 bg-violet-50 border border-violet-200 rounded-md text-sm text-violet-900">
          <div className="font-semibold text-xs uppercase tracking-[0.15em] mb-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Riepilogo AI
          </div>
          {extracted.summary}
        </div>
      )}

      <CriteriaFlagsHint flags={extracted.criteria_flags} />

      <div className="space-y-2">
        {sections.map((s) => (
          <Card key={s.key} className={`border p-4 ${selected[s.key] ? "border-[#0A2540] bg-white" : "border-gray-200 bg-gray-50"}`}>
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected[s.key]}
                  onChange={(e) => setSelected({ ...selected, [s.key]: e.target.checked })}
                  className="w-4 h-4 accent-[#0A2540]"
                  data-testid={`ai-section-${s.key}`}
                />
                <div>
                  <div className="font-heading font-bold text-sm tracking-tight text-[#0A2540]">{s.label}</div>
                  <div className="text-xs text-gray-500">
                    {s.count > 0 ? `${s.count} elementi estratti` : "Nessun dato estratto"}
                  </div>
                </div>
              </div>
              {s.count === 0 && (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <AlertCircle className="w-3 h-3" /> vuoto
                </Badge>
              )}
            </label>
            {selected[s.key] && s.count > 0 && (
              <div className="mt-3 pl-7 text-xs text-gray-600">
                <SectionPreview section={s.key} data={extracted[s.key]} />
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="text-xs text-gray-500 italic flex items-start gap-1.5">
        <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
        L'AI può sbagliare. Rivedi sempre i valori prima di applicarli. I dati estratti aggiungono nuove valutazioni e terapie; il profilo SSc viene unito a quello esistente (campi non null sovrascrivono).
      </div>
    </div>
  );
}

function SectionPreview({ section, data }) {
  if (section === "patient" && data) {
    return (
      <ul className="space-y-0.5">
        {Object.entries(data).filter(([, v]) => v).map(([k, v]) => (
          <li key={k}><span className="font-mono text-gray-400">{k}:</span> {String(v)}</li>
        ))}
      </ul>
    );
  }
  if (section === "assessments" && Array.isArray(data)) {
    return (
      <ul className="space-y-1">
        {data.map((a, i) => (
          <li key={`${a.index_type || "?"}-${a.date || i}`}>
            <span className="font-bold">{a.index_type}</span> · score {a.score ?? "—"} · {a.interpretation || "no interp."}
            {a.tender_count != null && ` · TJC ${a.tender_count}`}
            {a.swollen_count != null && ` · SJC ${a.swollen_count}`}
          </li>
        ))}
      </ul>
    );
  }
  if (section === "therapies" && Array.isArray(data)) {
    return (
      <ul className="space-y-1">
        {data.map((t, i) => (
          <li key={`${t.drug_name || "?"}-${t.start_date || i}`}>
            <span className="font-bold">{t.drug_name}</span> {t.dose || ""} {t.frequency || ""} ({t.category}, {t.status})
          </li>
        ))}
      </ul>
    );
  }
  if (section === "lab_exams" && Array.isArray(data)) {
    return (
      <ul className="space-y-1">
        {data.map((e, i) => (
          <li key={`${e.category || "?"}-${i}`}>
            <span className="font-bold">{e.category}</span>: {(e.results || []).map((r) => `${r.name} ${r.value}${r.unit ? " " + r.unit : ""}${r.qualitative ? " (" + r.qualitative + ")" : ""}`).join(", ")}
          </li>
        ))}
      </ul>
    );
  }
  if (section === "sclero_profile" && data) {
    return (
      <ul className="space-y-0.5">
        {Object.entries(data).filter(([, v]) => v && Object.keys(v || {}).length > 0).map(([k, v]) => (
          <li key={k}>
            <span className="font-bold uppercase text-[10px]">{k}:</span>{" "}
            {Object.entries(v).filter(([, vv]) => vv !== null && vv !== undefined && vv !== "").map(([kk, vv]) => `${kk}=${vv}`).join(", ")}
          </li>
        ))}
      </ul>
    );
  }
  return null;
}

const HC_LABELS = {
  iron_fist: "Iron fist (impossibilità chiusura pugno)",
  joint_onset_before_50: "Esordio sintomi articolari < 50 anni",
  absence_dip_swelling_deformity: "DIP senza tumefazione/deformità",
  mcp_2_5_tenderness: "Dolorabilità MCP 2-5",
  hip_ankle_surgery: "Storia di chirurgia anca/caviglia",
  hfe_c282y_homozygous: "Omozigosi HFE C282Y",
  iron_overload: "Sovraccarico di ferro",
};

function CriteriaFlagsHint({ flags }) {
  if (!flags || !flags.haemochromatosis) return null;
  const hc = flags.haemochromatosis;
  const detected = Object.entries(hc).filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== false);
  if (detected.length === 0) return null;
  return (
    <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-900" data-testid="ai-criteria-hint-haemochromatosis">
      <div className="font-semibold text-xs uppercase tracking-[0.15em] mb-1.5 flex items-center gap-1">
        <Sparkles className="w-3 h-3" /> Criteri EULAR 2025 Emocromatosi — Voci rilevate dall'AI
      </div>
      <ul className="space-y-0.5 text-xs">
        {detected.map(([k, v]) => (
          <li key={k}>
            <span className="font-mono text-amber-700">·</span>{" "}
            <span className="font-medium">{HC_LABELS[k] || k}:</span>{" "}
            <span className="font-bold">{typeof v === "boolean" ? (v ? "sì" : "no") : String(v)}</span>
          </li>
        ))}
      </ul>
      <div className="text-[10px] italic mt-2 text-amber-700">
        Nota: queste voci NON vengono applicate automaticamente. Apri "Criteri" → "Artropatia da emocromatosi (EULAR 2025)" per inserirle manualmente con conferma clinica.
      </div>
    </div>
  );
}
