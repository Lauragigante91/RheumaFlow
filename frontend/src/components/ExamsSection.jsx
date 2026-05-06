import React, { useEffect, useState, useMemo } from "react";
import { labExamsApi } from "../lib/api";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Plus, FlaskConical, Trash2, Edit, ChevronDown, ChevronRight, User, Sparkles } from "lucide-react";
import { toast } from "sonner";
import ItalianDatePicker from "./ItalianDatePicker";
import { LAB_PANELS, LAB_PANEL_KEYS } from "../lib/labPanels";
import LabImportDialog from "./LabImportDialog";

const QUAL_OPTIONS = [
  { value: "negative", label: "Negativo", color: "bg-gray-100 text-gray-700" },
  { value: "positive_low", label: "Positivo (basso titolo)", color: "bg-amber-100 text-amber-800" },
  { value: "positive", label: "Positivo", color: "bg-red-100 text-red-800" },
  { value: "borderline", label: "Borderline", color: "bg-yellow-100 text-yellow-800" },
];

function isOutOfRange(test, value) {
  if (value == null || value === "" || isNaN(Number(value))) return false;
  const v = Number(value);
  if (test.refMax != null && v > test.refMax) return "high";
  if (test.refMin != null && v < test.refMin) return "low";
  return false;
}

export default function ExamsSection({ patient }) {
  const [exams, setExams] = useState([]);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [activePanel, setActivePanel] = useState(LAB_PANEL_KEYS[0]);
  const [values, setValues] = useState({});
  const [notes, setNotes] = useState("");
  const [expanded, setExpanded] = useState({});

  const load = async () => {
    if (!patient?.id) return;
    const data = await labExamsApi.listByPatient(patient.id);
    setExams(data);
  };
  useEffect(() => { load(); }, [patient?.id]);

  const openNew = () => {
    setEditing(null);
    setDate(new Date().toISOString().slice(0, 10));
    setValues({});
    setNotes("");
    setActivePanel(LAB_PANEL_KEYS[0]);
    setOpen(true);
  };

  const openEdit = (e) => {
    setEditing(e);
    setDate(e.date);
    setValues(e.values || {});
    setNotes(e.notes || "");
    setActivePanel(e.panel || LAB_PANEL_KEYS[0]);
    setOpen(true);
  };

  const save = async () => {
    // Filter out empty values
    const cleanedValues = Object.fromEntries(
      Object.entries(values).filter(([_, v]) => v?.value !== "" && v?.value != null)
    );
    if (Object.keys(cleanedValues).length === 0) {
      toast.error("Compila almeno un valore");
      return;
    }
    try {
      const payload = {
        patient_id: patient.id,
        date,
        panel: activePanel,
        values: cleanedValues,
        notes,
      };
      if (editing) {
        await labExamsApi.update(editing.id, payload);
        toast.success("Esame aggiornato");
      } else {
        await labExamsApi.create(payload);
        toast.success("Esame salvato");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore");
    }
  };

  const remove = async (e) => {
    if (!window.confirm("Eliminare questo esame?")) return;
    await labExamsApi.remove(e.id);
    toast.success("Eliminato");
    load();
  };

  const updateValue = (key, field, value) => {
    setValues((p) => ({ ...p, [key]: { ...(p[key] || {}), [field]: value } }));
  };

  const examsByPanel = useMemo(() => {
    const m = {};
    LAB_PANEL_KEYS.forEach((k) => { m[k] = []; });
    exams.forEach((e) => { (m[e.panel] || (m[e.panel] = [])).push(e); });
    return m;
  }, [exams]);

  return (
    <div className="space-y-4" data-testid="exams-section">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-xl tracking-tight">Esami di laboratorio</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="border-violet-300 text-violet-700 hover:bg-violet-50"
            data-testid="import-lab-btn"
          >
            <Sparkles className="w-4 h-4 mr-2" /> Importa da PDF/foto (AI)
          </Button>
          <Button onClick={openNew} className="bg-[#0A2540] text-white hover:bg-[#051626]" data-testid="add-exam-btn">
            <Plus className="w-4 h-4 mr-2" /> Aggiungi esame
          </Button>
        </div>
      </div>

      <LabImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        patient={patient}
        onImported={load}
      />

      {exams.length === 0 ? (
        <Card className="border-gray-200 shadow-sm p-10 text-center text-gray-500 text-sm">
          Nessun esame registrato. Clicca "Aggiungi esame".
        </Card>
      ) : (
        <div className="space-y-3">
          {LAB_PANEL_KEYS.map((panelKey) => {
            const panelExams = examsByPanel[panelKey];
            if (!panelExams || panelExams.length === 0) return null;
            const isExpanded = expanded[panelKey] !== false;
            return (
              <Card key={panelKey} className="border-gray-200 shadow-sm overflow-hidden">
                <button
                  className="w-full text-left p-4 flex items-center justify-between hover:bg-gray-50"
                  onClick={() => setExpanded((p) => ({ ...p, [panelKey]: !isExpanded }))}
                  data-testid={`toggle-panel-${panelKey}`}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    <FlaskConical className="w-4 h-4 text-[#0A2540]" />
                    <span className="font-heading font-bold tracking-tight">{LAB_PANELS[panelKey].label}</span>
                    <Badge variant="outline" className="text-xs">{panelExams.length}</Badge>
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-gray-200">
                    {panelExams.map((e) => (
                      <ExamRow key={e.id} exam={e} panelKey={panelKey} onEdit={openEdit} onRemove={remove} />
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading font-black tracking-tight">
              {editing ? "Modifica esame" : "Nuovo esame"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Data</Label>
              <ItalianDatePicker value={date} onChange={setDate} testid="exam-date" />
            </div>
          </div>

          <Tabs value={activePanel} onValueChange={setActivePanel}>
            <TabsList className="grid grid-cols-3 md:grid-cols-6 mb-3">
              {LAB_PANEL_KEYS.map((k) => (
                <TabsTrigger key={k} value={k} data-testid={`panel-tab-${k}`} className="text-xs">
                  {LAB_PANELS[k].label}
                </TabsTrigger>
              ))}
            </TabsList>
            {LAB_PANEL_KEYS.map((k) => (
              <TabsContent key={k} value={k} className="space-y-2">
                {LAB_PANELS[k].tests.map((t) => (
                  <TestRow key={t.key} test={t} value={values[t.key]} onChange={(field, v) => updateValue(t.key, field, v)} />
                ))}
              </TabsContent>
            ))}
          </Tabs>

          <div className="mt-4">
            <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Note</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="exam-notes" />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button className="bg-[#0A2540] text-white hover:bg-[#051626]" onClick={save} data-testid="save-exam-btn">
              {editing ? "Aggiorna" : "Salva esame"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TestRow({ test, value, onChange }) {
  const v = value?.value ?? "";
  const outOfRange = test.type === "number" ? isOutOfRange(test, v) : false;
  const refLine = test.refMin != null && test.refMax != null
    ? `${test.refMin}-${test.refMax}`
    : test.refMax != null ? `< ${test.refMax}` : test.refMin != null ? `> ${test.refMin}` : null;

  return (
    <div className="grid grid-cols-12 gap-2 items-center border border-gray-200 rounded-md p-2.5">
      <div className="col-span-12 md:col-span-5">
        <div className="text-sm font-medium">{test.label}</div>
        {refLine && <div className="text-[10px] text-gray-500">vn: {refLine} {test.unit}</div>}
      </div>
      <div className="col-span-7 md:col-span-4">
        {test.type === "qual" ? (
          <select
            className="w-full h-9 border border-gray-200 rounded-md px-2 text-sm"
            value={v || ""}
            onChange={(e) => onChange("value", e.target.value)}
            data-testid={`exam-${test.key}-qual`}
          >
            <option value="">--</option>
            {QUAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <Input
            type={test.type === "number" ? "number" : "text"}
            step="any"
            value={v}
            onChange={(e) => onChange("value", e.target.value)}
            placeholder={test.placeholder}
            className={outOfRange ? "border-red-400 text-red-700" : ""}
            data-testid={`exam-${test.key}-val`}
          />
        )}
      </div>
      <div className="col-span-3 md:col-span-2 text-xs text-gray-500">{test.unit}</div>
      <div className="col-span-2 md:col-span-1 flex justify-end">
        {outOfRange === "high" && <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-xs">↑</Badge>}
        {outOfRange === "low" && <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs">↓</Badge>}
      </div>
    </div>
  );
}

function ExamRow({ exam, panelKey, onEdit, onRemove }) {
  const tests = LAB_PANELS[panelKey]?.tests || [];
  return (
    <div className="p-4 border-b border-gray-100 last:border-0" data-testid={`exam-row-${exam.id}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-medium text-[#0A2540]">{new Date(exam.date).toLocaleDateString("it-IT")}</div>
          {exam.created_by_name && (
            <div className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
              <User className="w-2.5 h-2.5" /> {exam.created_by_name}
            </div>
          )}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => onEdit(exam)} data-testid={`edit-exam-${exam.id}`}>
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onRemove(exam)} data-testid={`delete-exam-${exam.id}`}>
            <Trash2 className="w-4 h-4 text-red-600" />
          </Button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 text-xs">
        {Object.entries(exam.values || {}).map(([k, v]) => {
          const t = tests.find((x) => x.key === k);
          const lbl = t?.label || k;
          let displayVal = v.value;
          if (t?.type === "qual") {
            displayVal = QUAL_OPTIONS.find((o) => o.value === v.value)?.label || v.value;
          }
          const outOfRange = t?.type === "number" ? isOutOfRange(t, v.value) : false;
          return (
            <div key={k} className="flex items-center gap-2 py-0.5">
              <span className="text-gray-600">{lbl}:</span>
              <span className={`font-mono font-semibold ${outOfRange ? "text-red-700" : ""}`}>
                {displayVal} {t?.unit || ""}
              </span>
            </div>
          );
        })}
      </div>
      {exam.notes && <div className="text-xs text-gray-500 mt-2 italic">{exam.notes}</div>}
    </div>
  );
}
