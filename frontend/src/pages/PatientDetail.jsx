import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { patientsApi, assessmentsApi, criteriaApi } from "../lib/api";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { ArrowLeft, Plus, Download, FileText, Trash2, ChevronDown, Sparkles, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import AssessmentForm from "../components/AssessmentForm";
import { INDEX_LABELS, INDEX_DISEASES } from "../lib/clinimetrics";
import { exportPatientCSV, exportPatientPDF } from "../lib/export";
import { suggestForDiagnosis } from "../lib/diagnosisSuggestions";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [criteriaEvals, setCriteriaEvals] = useState([]);
  const [newOpen, setNewOpen] = useState(false);
  const [newType, setNewType] = useState("das28_esr");
  const [selectedIndex, setSelectedIndex] = useState("all");

  const load = async () => {
    const p = await patientsApi.get(id);
    setPatient(p);
    const a = await assessmentsApi.listByPatient(id);
    setAssessments(a);
    const ce = await criteriaApi.listByPatient(id).catch(() => []);
    setCriteriaEvals(ce);
  };
  useEffect(() => { load(); }, [id]);

  const suggestions = useMemo(() => suggestForDiagnosis(patient?.diagnosi), [patient?.diagnosi]);

  const removeCriteriaEval = async (cid) => {
    if (!window.confirm("Eliminare questa valutazione di criteri?")) return;
    await criteriaApi.remove(cid);
    toast.success("Eliminata");
    load();
  };

  const startNew = (type) => {
    setNewType(type);
    setNewOpen(true);
  };

  const saveAssessment = async (payload) => {
    try {
      await assessmentsApi.create({ ...payload, patient_id: id });
      toast.success("Valutazione salvata");
      setNewOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore nel salvataggio");
    }
  };

  const removeAssessment = async (aid) => {
    if (!window.confirm("Eliminare questa valutazione?")) return;
    await assessmentsApi.remove(aid);
    toast.success("Eliminata");
    load();
  };

  const chartData = useMemo(() => {
    const filtered = selectedIndex === "all"
      ? assessments
      : assessments.filter((a) => a.index_type === selectedIndex);
    return [...filtered]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((a) => ({
        date: new Date(a.date).toLocaleDateString("it-IT"),
        score: a.score,
        type: INDEX_LABELS[a.index_type] || a.index_type,
      }));
  }, [assessments, selectedIndex]);

  if (!patient) {
    return <div className="p-10 text-gray-500">Caricamento...</div>;
  }

  return (
    <div className="space-y-6 fade-in" data-testid="patient-detail-page">
      <Link to="/pazienti" className="inline-flex items-center text-sm text-gray-600 hover:text-[#0A2540]">
        <ArrowLeft className="w-4 h-4 mr-1" /> Torna ai pazienti
      </Link>

      {/* Patient header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-1">Paziente</div>
          <h1 className="font-heading text-4xl md:text-5xl font-black tracking-tighter text-[#0A2540]">
            {patient.cognome} {patient.nome}
          </h1>
          <div className="mt-3 flex flex-wrap gap-6 text-sm text-gray-700">
            {patient.data_nascita && <Info label="Nato il" value={new Date(patient.data_nascita).toLocaleDateString("it-IT")} />}
            {patient.sesso && <Info label="Sesso" value={patient.sesso} />}
            {patient.codice_fiscale && <Info label="CF" value={patient.codice_fiscale} />}
            {patient.diagnosi && <Info label="Diagnosi" value={patient.diagnosi} />}
          </div>
          {patient.note && (
            <div className="mt-3 text-sm text-gray-600 max-w-3xl">
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">Note: </span>
              {patient.note}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-[#0A2540] text-white hover:bg-[#051626]" data-testid="new-assessment-btn">
                <Plus className="w-4 h-4 mr-2" /> Nuova valutazione <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 max-h-[80vh] overflow-y-auto">
              {suggestions.indices.length > 0 && (
                <>
                  <DropdownMenuLabel className="flex items-center gap-1.5 text-[#0A2540]">
                    <Sparkles className="w-3.5 h-3.5" />
                    Consigliati per diagnosi
                  </DropdownMenuLabel>
                  {suggestions.indices.map((k) => (
                    <DropdownMenuItem key={`sug-${k}`} onClick={() => startNew(k)} data-testid={`new-suggested-${k}`} className="bg-blue-50/50">
                      <span className="font-medium">{INDEX_LABELS[k]}</span>
                      <span className="ml-auto text-xs text-gray-500">{INDEX_DISEASES[k]}</span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuLabel>Artrite Reumatoide</DropdownMenuLabel>
              {["das28_esr", "das28_crp", "cdai", "sdai"].map((k) => (
                <DropdownMenuItem key={k} onClick={() => startNew(k)} data-testid={`new-${k}`}>
                  {INDEX_LABELS[k]}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Spondiloartrite</DropdownMenuLabel>
              {["basdai", "asdas_crp", "basfi", "basmi", "schober"].map((k) => (
                <DropdownMenuItem key={k} onClick={() => startNew(k)} data-testid={`new-${k}`}>
                  {INDEX_LABELS[k]}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Sclerosi Sistemica</DropdownMenuLabel>
              {["mrss", "capillaroscopy"].map((k) => (
                <DropdownMenuItem key={k} onClick={() => startNew(k)} data-testid={`new-${k}`}>
                  {INDEX_LABELS[k]}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Altri</DropdownMenuLabel>
              {["dapsa", "sledai", "essdai", "esspri", "bvas", "mmt8", "fiqr", "haq", "pasi"].map((k) => (
                <DropdownMenuItem key={k} onClick={() => startNew(k)} data-testid={`new-${k}`}>
                  {INDEX_LABELS[k]} <span className="ml-auto text-xs text-gray-500">{INDEX_DISEASES[k]}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="export-btn">
                <Download className="w-4 h-4 mr-2" /> Esporta <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportPatientPDF(patient, assessments)} data-testid="export-pdf">
                <FileText className="w-4 h-4 mr-2" /> PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportPatientCSV(patient, assessments)} data-testid="export-csv">
                <FileText className="w-4 h-4 mr-2" /> CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Suggested indices/criteria */}
      {(suggestions.indices.length > 0 || suggestions.criteria.length > 0) && (
        <Card className="border-blue-200 bg-blue-50/30 p-5" data-testid="suggestions-card">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-[#0A2540] mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-heading font-bold text-base tracking-tight mb-1">
                Consigliati per <span className="text-[#0A2540]">{patient.diagnosi}</span>
              </h3>
              {suggestions.indices.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs uppercase tracking-[0.15em] text-gray-500 mb-1">Indici clinimetrici</div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.indices.map((k) => (
                      <Button
                        key={k}
                        variant="outline"
                        size="sm"
                        className="bg-white border-gray-300"
                        onClick={() => startNew(k)}
                        data-testid={`suggested-${k}`}
                      >
                        {INDEX_LABELS[k]}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {suggestions.criteria.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs uppercase tracking-[0.15em] text-gray-500 mb-1">Criteri classificativi</div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.criteria.map((cid) => (
                      <Link key={cid} to={`/criteri?paziente=${id}&open=${cid}`}>
                        <Button variant="outline" size="sm" className="bg-white border-gray-300" data-testid={`suggested-crit-${cid}`}>
                          <FileCheck2 className="w-3.5 h-3.5 mr-1.5" /> {cid.split("_").slice(0, -1).join(" ").toUpperCase()}
                        </Button>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Trend chart */}
      <Card className="border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-heading font-bold text-xl tracking-tight">Andamento nel tempo</h2>
          <Select value={selectedIndex} onValueChange={setSelectedIndex}>
            <SelectTrigger className="w-56" data-testid="trend-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli indici</SelectItem>
              {Object.entries(INDEX_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-500 border border-dashed border-gray-200 rounded-md">
            Nessun dato per questo indice
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" fontSize={11} stroke="#6B7280" />
              <YAxis fontSize={11} stroke="#6B7280" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
              <Legend />
              <Line type="monotone" dataKey="score" stroke="#0A2540" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Punteggio" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* History table */}
      <Card className="border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="font-heading font-bold text-xl tracking-tight">Storico valutazioni</h2>
        </div>
        {assessments.length === 0 ? (
          <div className="p-10 text-center text-gray-500" data-testid="empty-assessments">
            Nessuna valutazione. Clicca "Nuova valutazione" per iniziare.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F9FAFB] border-b border-gray-200">
                <tr className="text-left">
                  <Th>Data</Th>
                  <Th>Indice</Th>
                  <Th>Punteggio</Th>
                  <Th>Interpretazione</Th>
                  <Th>TJC / SJC</Th>
                  <Th className="text-right">Azioni</Th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((a) => (
                  <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50" data-testid={`assessment-row-${a.id}`}>
                    <td className="px-4 py-3 font-medium">{new Date(a.date).toLocaleDateString("it-IT")}</td>
                    <td className="px-4 py-3">{INDEX_LABELS[a.index_type] || a.index_type}</td>
                    <td className="px-4 py-3 font-mono font-bold text-[#0A2540]">{a.score ?? "-"}</td>
                    <td className="px-4 py-3">{a.interpretation || "-"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {(a.tender_joints?.length ?? 0)} / {(a.swollen_joints?.length ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => removeAssessment(a.id)} data-testid={`delete-assessment-${a.id}`}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Criteria evaluations history */}
      <Card className="border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-heading font-bold text-xl tracking-tight">Storico criteri classificativi</h2>
          <Link to={`/criteri?paziente=${id}`}>
            <Button variant="outline" size="sm" data-testid="goto-criteria-btn">
              <FileCheck2 className="w-4 h-4 mr-2" /> Applica criteri
            </Button>
          </Link>
        </div>
        {criteriaEvals.length === 0 ? (
          <div className="p-10 text-center text-gray-500" data-testid="empty-criteria">
            Nessun criterio applicato. Vai a "Criteri" per valutare il paziente.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F9FAFB] border-b border-gray-200">
                <tr className="text-left">
                  <Th>Data</Th>
                  <Th>Criteri</Th>
                  <Th>Sorgente</Th>
                  <Th>Score</Th>
                  <Th>Esito</Th>
                  <Th className="text-right">Azioni</Th>
                </tr>
              </thead>
              <tbody>
                {criteriaEvals.map((ce) => (
                  <tr key={ce.id} className="border-b border-gray-100 hover:bg-gray-50" data-testid={`criteria-row-${ce.id}`}>
                    <td className="px-4 py-3 font-medium">{new Date(ce.date).toLocaleDateString("it-IT")}</td>
                    <td className="px-4 py-3">{ce.criteria_name}</td>
                    <td className="px-4 py-3 text-gray-600">{ce.source}</td>
                    <td className="px-4 py-3 font-mono font-bold text-[#0A2540]">{ce.score} / ≥{ce.threshold}</td>
                    <td className="px-4 py-3">
                      <Badge variant={ce.meets ? "default" : "outline"} className={ce.meets ? "bg-green-700 hover:bg-green-700 text-white" : ""}>
                        {ce.meets ? "Soddisfatti" : "Non raggiunti"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => removeCriteriaEval(ce.id)} data-testid={`delete-criteria-${ce.id}`}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* New assessment dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">Nuova valutazione</DialogTitle>
          </DialogHeader>
          <AssessmentForm
            indexType={newType}
            onSubmit={saveAssessment}
            onCancel={() => setNewOpen(false)}
            previousAssessments={assessments.filter((a) => a.index_type === newType)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Th = ({ children, className = "" }) => (
  <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-gray-500 ${className}`}>{children}</th>
);

const Info = ({ label, value }) => (
  <div>
    <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500">{label}</div>
    <div className="font-medium">{value}</div>
  </div>
);
