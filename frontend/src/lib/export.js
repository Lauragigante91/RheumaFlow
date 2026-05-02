import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { INDEX_LABELS } from "./clinimetrics";

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("it-IT");
}

export function exportPatientCSV(patient, assessments) {
  const headers = [
    "Data", "Indice", "Punteggio", "Interpretazione",
    "TJC", "SJC", "Note", "Creato il"
  ];
  const rows = assessments.map((a) => {
    const inp = a.inputs || {};
    return [
      formatDate(a.date),
      INDEX_LABELS[a.index_type] || a.index_type,
      a.score ?? "-",
      a.interpretation || "-",
      (a.tender_joints || []).length,
      (a.swollen_joints || []).length,
      (a.notes || "").replace(/\n/g, " "),
      formatDate(a.created_at),
    ];
  });
  const csv = [
    `Paziente:,"${patient.cognome} ${patient.nome}"`,
    "",
    headers.join(","),
    ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `report_${patient.cognome}_${patient.nome}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportPatientPDF(patient, assessments) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Report Clinimetrico", 14, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Data emissione: ${new Date().toLocaleDateString("it-IT")}`, pageW - 14, 18, { align: "right" });

  doc.setDrawColor(10, 37, 64);
  doc.setLineWidth(0.5);
  doc.line(14, 22, pageW - 14, 22);

  // Patient info
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Anagrafica Paziente", 14, 32);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const lines = [
    `Nome: ${patient.nome || "-"}`,
    `Cognome: ${patient.cognome || "-"}`,
    `Data di nascita: ${formatDate(patient.data_nascita)}`,
    `Sesso: ${patient.sesso || "-"}`,
    `Codice Fiscale: ${patient.codice_fiscale || "-"}`,
    `Diagnosi: ${patient.diagnosi || "-"}`,
  ];
  lines.forEach((l, i) => doc.text(l, 14, 40 + i * 6));

  if (patient.note) {
    doc.text(`Note: ${patient.note}`, 14, 40 + lines.length * 6);
  }

  // Assessment table
  const startY = 40 + lines.length * 6 + (patient.note ? 10 : 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Storico Valutazioni", 14, startY);

  const tableData = assessments.map((a) => [
    formatDate(a.date),
    INDEX_LABELS[a.index_type] || a.index_type,
    a.score != null ? String(a.score) : "-",
    a.interpretation || "-",
    `T:${(a.tender_joints || []).length} / S:${(a.swollen_joints || []).length}`,
  ]);

  autoTable(doc, {
    startY: startY + 4,
    head: [["Data", "Indice", "Punteggio", "Interpretazione", "Articolazioni"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [10, 37, 64], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 3 },
  });

  // Details per assessment
  assessments.forEach((a) => {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`${INDEX_LABELS[a.index_type] || a.index_type} - ${formatDate(a.date)}`, 14, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Punteggio: ${a.score ?? "-"}`, 14, 30);
    doc.text(`Interpretazione: ${a.interpretation || "-"}`, 14, 36);

    const inputsRows = Object.entries(a.inputs || {}).map(([k, v]) => [
      String(k),
      typeof v === "object" ? JSON.stringify(v) : String(v),
    ]);

    if (inputsRows.length > 0) {
      autoTable(doc, {
        startY: 42,
        head: [["Parametro", "Valore"]],
        body: inputsRows,
        theme: "grid",
        headStyles: { fillColor: [10, 37, 64], textColor: 255 },
        styles: { fontSize: 9 },
      });
    }

    const yAfter = doc.lastAutoTable ? doc.lastAutoTable.finalY + 8 : 50;

    if ((a.tender_joints || []).length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text(`Articolazioni dolenti (${a.tender_joints.length}):`, 14, yAfter);
      doc.setFont("helvetica", "normal");
      doc.text(a.tender_joints.join(", "), 14, yAfter + 6, { maxWidth: pageW - 28 });
    }
    const ySw = yAfter + (a.tender_joints?.length ? 20 : 0);
    if ((a.swollen_joints || []).length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text(`Articolazioni tumefatte (${a.swollen_joints.length}):`, 14, ySw);
      doc.setFont("helvetica", "normal");
      doc.text(a.swollen_joints.join(", "), 14, ySw + 6, { maxWidth: pageW - 28 });
    }

    if (a.notes) {
      const yNotes = ySw + 20;
      doc.setFont("helvetica", "bold");
      doc.text("Note:", 14, yNotes);
      doc.setFont("helvetica", "normal");
      doc.text(a.notes, 14, yNotes + 6, { maxWidth: pageW - 28 });
    }
  });

  doc.save(`report_${patient.cognome}_${patient.nome}.pdf`);
}
