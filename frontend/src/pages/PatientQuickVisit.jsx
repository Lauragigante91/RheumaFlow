import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { patientsApi, therapiesApi, assessmentsApi, remindersApi, diseaseProfileApi } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { ArrowLeft, Stethoscope, Pill, Bell, Sparkles, ChevronRight, FileText } from "lucide-react";
import VisitImportButton from "../components/visits/VisitImportButton";
import { toast } from "sonner";
import CompositeAssessmentDialog from "../components/clinical/CompositeAssessmentDialog";

import { isRaDiagnosis, isSpaDiagnosis } from "../lib/diseaseDetection";

import FirstVisitSummaryPanel from "../components/profiles/FirstVisitSummaryPanel";

/**
 * Modalità "Visita rapida": single-page ottimizzata per uso in ambulatorio.
 * Tutto il flusso essenziale di una visita scrolla in una sola pagina:
 *   1. Header: chi è il paziente + ultima visita
 *   2. Quick Actions: nuova clinimetria composita, import AI da nota, import lab da PDF
 *   3. Terapia attiva al volo
 *   4. Reminder rapido (urgente o follow-up)
 *
 * L'idea è chiudere una visita di controllo in <1 minuto di click.
 */
export default function PatientQuickVisit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [therapies, setTherapies] = useState([]);
  const [lastAssessments, setLastAssessments] = useState([]);
  const [firstVisit, setFirstVisit] = useState(null);
  const [compositeOpen, setCompositeOpen] = useState(false);
  const [compositeProtocolId, setCompositeProtocolId] = useState(null);
  const load = async () => {
    try {
      const [p, t, all, fv] = await Promise.all([
        patientsApi.get(id),
        therapiesApi.listByPatient(id).catch(() => []),
        assessmentsApi.listByPatient(id).catch(() => []),
        diseaseProfileApi.get(id, "prima_visita").catch(() => null),
      ]);
      setPatient(p);
      setTherapies(t);
      setFirstVisit(fv);
      // Get latest per index_type
      const byIdx = {};
      for (const a of all) {
        if (!byIdx[a.index_type] || (a.date || "") > (byIdx[a.index_type].date || "")) {
          byIdx[a.index_type] = a;
        }
      }
      setLastAssessments(Object.values(byIdx).sort((a, b) => (b.date || "").localeCompare(a.date || "")));
    } catch (e) {
      toast.error("Paziente non trovato");
      navigate("/pazienti");
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!patient) return null;

  const active = therapies.filter((t) => t.status === "active");
  // Build available composite protocols based on diagnosis
  const protocols = [];
  if (isRaDiagnosis(patient.diagnosi)) {
    protocols.push({ id: "ra", label: "AR — DAS28-VES + DAS28-PCR + CDAI + SDAI" });
  }
  if (isSpaDiagnosis(patient.diagnosi)) {
    protocols.push({ id: "spa", label: "SpA — BASDAI + ASDAS-CRP + ASDAS-VES + BASFI" });
    protocols.push({ id: "psa", label: "Artrite psoriasica — DAPSA + Domini PsA" });
  }

  const startComposite = (proto) => {
    setCompositeProtocolId(proto.id);
    setCompositeOpen(true);
  };

  const quickReminder = async (preset) => {
    const today = new Date();
    const due = new Date(today);
    if (preset === "next_visit") due.setDate(due.getDate() + 90);
    if (preset === "6mo") due.setDate(due.getDate() + 180);
    if (preset === "asap") due.setDate(due.getDate() + 7);
    const isAsap = preset === "asap";
    try {
      await remindersApi.create({
        patient_id: id,
        title: isAsap ? "Da rivalutare presto" : preset === "6mo" ? "Controllo a 6 mesi" : "Prossima visita",
        type: "follow_up",
        due_date: due.toISOString().slice(0, 10),
        priority: isAsap ? "asap" : "routine",
        visibility: "shared",
      });
      toast.success(isAsap ? "Richiesta urgente creata" : "Reminder creato");
    } catch (e) {
      toast.error("Errore");
    }
  };

  return (
    <div className="bg-[#F9FAFB] min-h-screen pb-24">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <Link to={`/pazienti/${id}`} className="text-xs text-gray-500 flex items-center gap-1 hover:text-[#0A2540]">
            <ArrowLeft className="w-3.5 h-3.5" /> Vista completa
          </Link>
          <div className="text-center">
            <div className="font-heading font-black text-base tracking-tight">
              {patient.codice_paziente || `${patient.cognome || ""} ${patient.nome || ""}`}
            </div>
            <div className="text-[11px] text-gray-500">
              {patient.diagnosi} · {patient.anno_nascita || "?"} · {patient.sesso || "?"}
            </div>
          </div>
          <Badge className="bg-violet-100 text-violet-800 hover:bg-violet-100" data-testid="quick-mode-badge">
            <Stethoscope className="w-3 h-3 mr-1" /> Visita rapida
          </Badge>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {/* Longitudinal patient profile from First Visit */}
        <FirstVisitSummaryPanel fv={firstVisit} patientId={id} />

        {/* Last visit summary */}
        <Card className="border-gray-200 p-4">
          <div className="text-[11px] uppercase tracking-[0.15em] text-gray-500 mb-2">Ultima clinimetria</div>
          {lastAssessments.length === 0 ? (
            <div className="text-sm text-gray-400 italic">Nessuna valutazione registrata</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {lastAssessments.slice(0, 6).map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-xs">
                  <span className="font-heading font-bold text-[10px] uppercase tracking-[0.05em] text-[#0A2540]">{a.index_type.replace(/_/g, " ")}</span>
                  <span className="font-mono font-bold">{a.score ?? "-"}</span>
                  {a.interpretation && <span className="text-[10px] text-gray-600">({a.interpretation})</span>}
                  <span className="text-[10px] text-gray-500">{new Date(a.date).toLocaleDateString("it-IT")}</span>
                </span>
              ))}
            </div>
          )}
        </Card>

        {/* Quick assess actions */}
        <Card className="border-gray-200 p-4 space-y-2">
          <div className="text-[11px] uppercase tracking-[0.15em] text-gray-500 mb-2">Nuova valutazione</div>
          {protocols && protocols.length > 0 ? (
            protocols.map((proto) => (
              <Button
                key={proto.id}
                onClick={() => startComposite(proto)}
                className="w-full justify-between bg-[#0A2540] text-white hover:bg-[#051626]"
                data-testid={`quick-composite-${proto.id}`}
              >
                <span className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4" /> {proto.label}
                </span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            ))
          ) : (
            <Button
              onClick={() => navigate(`/pazienti/${id}`)}
              className="w-full justify-between bg-[#0A2540] text-white hover:bg-[#051626]"
              variant="outline"
              data-testid="quick-go-full"
            >
              <span>Apri form valutazione completo</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
          <div className="border-t border-gray-100 pt-2 mt-2">
            <VisitImportButton patient={patient} onImported={() => load()} />
          </div>
        </Card>

        {/* Active therapy at a glance */}
        <Card className="border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] uppercase tracking-[0.15em] text-gray-500">Terapia in corso</div>
            <Link
              to={`/pazienti/${id}`}
              className="text-[11px] text-[#0A2540] hover:underline flex items-center gap-1"
              data-testid="quick-go-therapies"
            >
              <Pill className="w-3 h-3" /> Modifica
            </Link>
          </div>
          {active.length === 0 ? (
            <div className="text-sm text-gray-400 italic">Nessuna terapia attiva</div>
          ) : (
            <div className="space-y-1.5">
              {active.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm border border-gray-100 rounded px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <Pill className="w-3.5 h-3.5 text-[#0A2540]" />
                    <span className="font-medium">{t.drug_name}</span>
                    {t.dose && <span className="text-gray-500 text-xs">{t.dose}</span>}
                    {t.frequency && <span className="text-gray-400 text-xs">{t.frequency}</span>}
                  </div>
                  <Badge variant="outline" className="text-[10px]">{t.category}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Quick reminders */}
        <Card className="border-gray-200 p-4">
          <div className="text-[11px] uppercase tracking-[0.15em] text-gray-500 mb-2">Programma il prossimo controllo</div>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" size="sm" onClick={() => quickReminder("next_visit")} data-testid="quick-rem-3mo">
              Prossima visita (~3 mesi)
            </Button>
            <Button variant="outline" size="sm" onClick={() => quickReminder("6mo")} data-testid="quick-rem-6mo">
              +6 mesi
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => quickReminder("asap")}
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
              data-testid="quick-rem-asap"
            >
              <Bell className="w-3 h-3 mr-1" /> Urgente (+7gg)
            </Button>
          </div>
        </Card>

        <div className="text-center pt-2">
          <Link
            to={`/pazienti/${id}`}
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-[#0A2540]"
            data-testid="quick-back-full"
          >
            <FileText className="w-4 h-4" /> Apri vista completa del paziente
          </Link>
        </div>
      </div>

      {compositeOpen && compositeProtocolId && (
        <CompositeAssessmentDialog
          open={compositeOpen}
          onClose={() => setCompositeOpen(false)}
          mode={compositeProtocolId}
          patient={patient}
          onSaved={() => {
            setCompositeOpen(false);
            load();
          }}
        />
      )}

    </div>
  );
}
