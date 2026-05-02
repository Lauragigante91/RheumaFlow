import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { patientsApi, assessmentsApi } from "../lib/api";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
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
import { ArrowLeft, Plus, Download, FileText, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import AssessmentForm from "../components/AssessmentForm";
import { INDEX_LABELS, INDEX_DISEASES } from "../lib/clinimetrics";
import { exportPatientCSV, exportPatientPDF } from "../lib/export";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [newOpen, setNewOpen] = useState(false);
  const [newType, setNewType] = useState("das28_esr");
  const [selectedIndex, setSelectedIndex] = useState("all");

  const load = async () => {
    const p = await patientsApi.get(id);
    setPatient(p);
    const a = await assessmentsApi.listByPatient(id);
    setAssessments(a);
  };
  useEffect(() => { load(); }, [id]);

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
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Artrite Reumatoide</DropdownMenuLabel>
              {["das28_esr", "das28_crp", "cdai", "sdai"].map((k) => (
                <DropdownMenuItem key={k} onClick={() => startNew(k)} data-testid={`new-${k}`}>
                  {INDEX_LABELS[k]}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Spondiloartrite</DropdownMenuLabel>
              {["basdai", "asdas_crp", "basfi", "basmi"].map((k) => (
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
