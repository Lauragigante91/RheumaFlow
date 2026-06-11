import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { INDEX_LABELS } from "./clinimetrics";
import { buildInstrumentalText, EXAM_TYPE_LABELS, formatPetExam, formatGenericExam, allByType } from "./instrumentalFormatters";

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("it-IT");
}

// ── Full patient history export ──────────────────────────────────────────────

function buildHistoryText(patient, { firstVisit, workupVisits, assessments, instrumentalExams }) {
  const SEP70 = "═".repeat(70);
  const SEP40 = "─".repeat(40);
  const lines = [];

  lines.push("STORICO CLINICO COMPLETO — RheumaFlow");
  lines.push(SEP70);
  lines.push(`Paziente   : ${patient.cognome || ""} ${patient.nome || ""}`);
  lines.push(`Nascita    : ${formatDate(patient.data_nascita)}`);
  lines.push(`Sesso      : ${patient.sesso || "-"}`);
  lines.push(`Cod. Fisc. : ${patient.codice_fiscale || "-"}`);
  lines.push(`Diagnosi   : ${patient.diagnosi || "-"}`);
  lines.push(`Emesso il  : ${new Date().toLocaleDateString("it-IT")}`);
  lines.push("");

  // Prima visita
  if (firstVisit) {
    lines.push(SEP70);
    lines.push(`PRIMA VISITA — ${formatDate(firstVisit.referral_date)}`);
    lines.push(SEP40);
    const anam = [firstVisit.rheumatologic_history, firstVisit.diagnostic_conclusion]
      .filter(Boolean).join("\n\n");
    if (anam) { lines.push("Anamnesi reumatologica / Conclusioni:"); lines.push(anam); lines.push(""); }
    if (firstVisit.physical_exam) {
      lines.push("Esame obiettivo:"); lines.push(firstVisit.physical_exam); lines.push("");
    }
    const tests = Array.isArray(firstVisit.requested_tests) && firstVisit.requested_tests.length
      ? firstVisit.requested_tests.join(" · ")
      : typeof firstVisit.requested_tests === "string" ? firstVisit.requested_tests : "";
    const testsBlock = [tests, firstVisit.requested_tests_notes].filter(Boolean).join("\n");
    if (testsBlock) { lines.push("Esami richiesti:"); lines.push(testsBlock); lines.push(""); }
  }

  // Workup visits sorted by date ascending
  const sortedWorkup = [...(workupVisits || [])].sort((a, b) =>
    (a.visit_date || "").localeCompare(b.visit_date || "")
  );
  let wkpCounter = 0;
  sortedWorkup.forEach((v) => {
    lines.push(SEP70);
    const isFollowUpVisit = v.visit_type === "follow_up";
    lines.push(isFollowUpVisit
      ? `FOLLOW-UP — ${formatDate(v.visit_date)}`
      : `WORKUP DIAGNOSTICO #${++wkpCounter} — ${formatDate(v.visit_date)}`
    );
    lines.push(SEP40);
    const fields = [
      ["Raccordo anamnestico reumatologico", v.rheumatologic_history_summary],
      ["Anamnesi intervallare",              v.interval_history],
      ["Esame obiettivo",                    v.physical_exam],
      ["Esami / Imaging",                    v.labs_imaging],
      ["Conclusioni",                        v.conclusions],
      ["Terapia / Modifiche",                v.therapy_modification],
      ["Indicazioni / Note MMG",             v.referral_note],
    ];
    fields.forEach(([label, value]) => {
      if (value?.trim()) {
        lines.push(`${label}:`);
        lines.push(value.trim());
        lines.push("");
      }
    });
    const reqTests = Array.isArray(v.requested_tests) && v.requested_tests.length
      ? v.requested_tests.join(" · ") : "";
    if (reqTests) { lines.push("Esami richiesti:"); lines.push(reqTests); lines.push(""); }
    if (v.notes?.trim()) { lines.push("Note aggiuntive:"); lines.push(v.notes.trim()); lines.push(""); }
  });

  // Esami strumentali — archivio completo
  const instrText = buildInstrumentalText(instrumentalExams || [], null);
  if (instrText) {
    lines.push(SEP70);
    lines.push("ESAMI STRUMENTALI — ARCHIVIO COMPLETO");
    lines.push(SEP40);
    lines.push(instrText);
    lines.push("");
  }

  // Follow-up assessments grouped by date (legacy: only those without a visit_id link)
  const sortedAss = [...(assessments || [])].filter(a => !a.visit_id).sort((a, b) =>
    (a.date || "").localeCompare(b.date || "")
  );
  const grouped = {};
  sortedAss.forEach((a) => {
    const key = a.date || "sconosciuta";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(a);
  });

  Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([date, group]) => {
      lines.push(SEP70);
      lines.push(`FOLLOW-UP — ${formatDate(date)}`);
      lines.push(SEP40);
      // Notes may differ per assessment; take unique non-empty notes
      const seenNotes = new Set();
      group.forEach((a) => {
        if (a.notes?.trim() && !seenNotes.has(a.notes.trim())) {
          seenNotes.add(a.notes.trim());
          lines.push(a.notes.trim());
          lines.push("");
        }
      });
      // Scores
      const scores = group
        .filter((a) => a.score != null)
        .map((a) => `${INDEX_LABELS[a.index_type] || a.index_type}: ${a.score}${a.interpretation ? ` (${a.interpretation})` : ""}`);
      if (scores.length) {
        lines.push("Indici clinimetrici:");
        scores.forEach((s) => lines.push(`  • ${s}`));
        lines.push("");
      }
    });

  lines.push(SEP70);
  lines.push("Fine documento — RheumaFlow");
  return lines.join("\n");
}

export function exportFullHistoryTXTDownload(patient, data) {
  const text = buildHistoryText(patient, data);
  const blob = new Blob(["\uFEFF" + text], { type: "text/plain;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `storico_${patient.cognome}_${patient.nome}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function copyFullHistoryToClipboard(patient, data) {
  const text = buildHistoryText(patient, data);
  await navigator.clipboard.writeText(text);
}

// Add a text section to the PDF, handling page breaks. Returns new y.
function pdfSection(doc, label, content, y, pageW, pageH) {
  if (!content?.trim()) return y;
  const maxW = pageW - 28;
  const lh   = 4.5;

  if (y > pageH - 30) { doc.addPage(); y = 20; }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  doc.text(label.toUpperCase(), 14, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(25, 25, 25);
  const lines = doc.splitTextToSize(content.trim(), maxW);
  for (const line of lines) {
    if (y > pageH - 15) { doc.addPage(); y = 20; }
    doc.text(line, 14, y);
    y += lh;
  }
  return y + 4;
}

function pdfVisitHeader(doc, title, dateStr, y, pageW, pageH) {
  if (y > pageH - 40) { doc.addPage(); y = 20; }
  doc.setFillColor(10, 37, 64);
  doc.rect(14, y - 4, pageW - 28, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(`${title}`, 17, y + 0.5);
  if (dateStr) doc.text(dateStr, pageW - 14, y + 0.5, { align: "right" });
  doc.setTextColor(0, 0, 0);
  return y + 12;
}

export function exportFullHistoryPDF(patient, { firstVisit, workupVisits, assessments, instrumentalExams }) {
  const doc   = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y       = 14;

  // ── Cover header ────────────────────────────────────────────────────────
  doc.setFillColor(10, 37, 64);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("Storico Clinico Completo", 14, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("RheumaFlow", 14, 20);
  doc.text(`Emesso il ${new Date().toLocaleDateString("it-IT")}`, pageW - 14, 20, { align: "right" });

  y = 36;

  // ── Patient info ─────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(10, 37, 64);
  doc.text(`${patient.cognome || ""} ${patient.nome || ""}`, 14, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(60, 60, 60);
  const infoLines = [
    `Nato/a il: ${formatDate(patient.data_nascita)}${patient.sesso ? `  |  Sesso: ${patient.sesso}` : ""}`,
    patient.codice_fiscale ? `C.F.: ${patient.codice_fiscale}` : null,
    `Diagnosi: ${patient.diagnosi || "-"}`,
  ].filter(Boolean);
  infoLines.forEach((l) => { doc.text(l, 14, y); y += 5; });

  doc.setDrawColor(10, 37, 64);
  doc.setLineWidth(0.3);
  doc.line(14, y + 2, pageW - 14, y + 2);
  y += 10;

  // ── Prima visita ─────────────────────────────────────────────────────────
  if (firstVisit) {
    y = pdfVisitHeader(doc, "Prima visita", formatDate(firstVisit.referral_date), y, pageW, pageH);
    const anam = [firstVisit.rheumatologic_history, firstVisit.diagnostic_conclusion]
      .filter(Boolean).join("\n\n");
    y = pdfSection(doc, "Anamnesi reumatologica / Conclusioni", anam, y, pageW, pageH);
    y = pdfSection(doc, "Esame obiettivo", firstVisit.physical_exam, y, pageW, pageH);
    const tests = Array.isArray(firstVisit.requested_tests) && firstVisit.requested_tests.length
      ? firstVisit.requested_tests.join(" · ")
      : typeof firstVisit.requested_tests === "string" ? firstVisit.requested_tests : "";
    const testsBlock = [tests, firstVisit.requested_tests_notes].filter(Boolean).join(" — ");
    y = pdfSection(doc, "Esami richiesti", testsBlock, y, pageW, pageH);
    y += 4;
  }

  // ── Workup visits ─────────────────────────────────────────────────────────
  const sortedWorkup = [...(workupVisits || [])].sort((a, b) =>
    (a.visit_date || "").localeCompare(b.visit_date || "")
  );
  sortedWorkup.forEach((v, i) => {
    y = pdfVisitHeader(doc, `Workup diagnostico #${i + 1}`, formatDate(v.visit_date), y, pageW, pageH);
    y = pdfSection(doc, "Raccordo anamnestico reumatologico", v.rheumatologic_history_summary, y, pageW, pageH);
    y = pdfSection(doc, "Anamnesi intervallare",              v.interval_history,              y, pageW, pageH);
    y = pdfSection(doc, "Esame obiettivo",                    v.physical_exam,                 y, pageW, pageH);
    y = pdfSection(doc, "Esami / Imaging",                    v.labs_imaging,                  y, pageW, pageH);
    y = pdfSection(doc, "Conclusioni",                        v.conclusions,                   y, pageW, pageH);
    y = pdfSection(doc, "Terapia / Modifiche",                v.therapy_modification,          y, pageW, pageH);
    y = pdfSection(doc, "Indicazioni / Note MMG",             v.referral_note,                 y, pageW, pageH);
    const reqTests = Array.isArray(v.requested_tests) && v.requested_tests.length
      ? v.requested_tests.join(" · ") : "";
    y = pdfSection(doc, "Esami richiesti",  reqTests,  y, pageW, pageH);
    y = pdfSection(doc, "Note aggiuntive",  v.notes,   y, pageW, pageH);
    y += 4;
  });

  // ── Esami strumentali — archivio completo ────────────────────────────────
  if ((instrumentalExams || []).length > 0) {
    y = pdfVisitHeader(doc, "Esami strumentali — Archivio completo", null, y, pageW, pageH);

    // Group by exam_type, PET gets full narrative treatment
    const byType = {};
    for (const e of (instrumentalExams || [])) {
      const t = e.exam_type || "other";
      if (!byType[t]) byType[t] = [];
      byType[t].push(e);
    }
    const typeOrder = ["petvas","hrct","pft","echo_cardiac","capillaroscopy",
                       "ecodoppler","angio_ct","angio_mri","echo_msk",
                       "xray","mri","ct","imaging_report","other"];
    const sortedTypes = Object.keys(byType).sort((a, b) => {
      const ia = typeOrder.indexOf(a); const ib = typeOrder.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    for (const type of sortedTypes) {
      const label = EXAM_TYPE_LABELS[type] || type;
      const group = byType[type];

      if (type === "petvas") {
        const sorted = [...group].sort((a, b) => {
          const da = a.exam_date || a.date || ""; const db = b.exam_date || b.date || "";
          return db > da ? 1 : db < da ? -1 : 0;
        });
        for (let i = 0; i < sorted.length; i++) {
          const e = sorted[i];
          const prev = sorted[i + 1] || null;
          const petText = formatPetExam(e, prev);
          if (petText) y = pdfSection(doc, label, petText, y, pageW, pageH);
        }
      } else {
        const sorted = [...group].sort((a, b) => {
          const da = a.exam_date || a.date || ""; const db = b.exam_date || b.date || "";
          return da > db ? 1 : da < db ? -1 : 0;
        });
        const rows = sorted.map(e => {
          const text = formatGenericExam(e);
          return [text];
        });
        autoTable(doc, {
          startY: y,
          head: [[label]],
          body: rows,
          theme: "striped",
          headStyles: { fillColor: [40, 90, 130], textColor: 255, fontSize: 8.5 },
          styles: { fontSize: 8.5, cellPadding: 2 },
          margin: { left: 14, right: 14 },
        });
        y = (doc.lastAutoTable?.finalY || y) + 6;
      }
    }
    y += 4;
  }

  // ── Follow-up assessments ─────────────────────────────────────────────────
  const sortedAss = [...(assessments || [])].sort((a, b) =>
    (a.date || "").localeCompare(b.date || "")
  );
  const grouped = {};
  sortedAss.forEach((a) => {
    const key = a.date || "";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(a);
  });

  Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([date, group]) => {
      y = pdfVisitHeader(doc, "Follow-up", formatDate(date), y, pageW, pageH);
      const seenNotes = new Set();
      group.forEach((a) => {
        if (a.notes?.trim() && !seenNotes.has(a.notes.trim())) {
          seenNotes.add(a.notes.trim());
          y = pdfSection(doc, "Note visita", a.notes, y, pageW, pageH);
        }
      });
      const scores = group
        .filter((a) => a.score != null)
        .map((a) => `${INDEX_LABELS[a.index_type] || a.index_type}: ${a.score}${a.interpretation ? ` (${a.interpretation})` : ""}`);
      if (scores.length) {
        y = pdfSection(doc, "Indici clinimetrici", scores.join("\n"), y, pageW, pageH);
      }
      y += 4;
    });

  // ── Footer on each page ───────────────────────────────────────────────────
  const totalPages = doc.internal.pages.length - 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `${patient.cognome} ${patient.nome} — ${patient.diagnosi || ""}`,
      14, pageH - 6
    );
    doc.text(`Pag. ${p} / ${totalPages}`, pageW - 14, pageH - 6, { align: "right" });
  }

  doc.save(`storico_${patient.cognome}_${patient.nome}.pdf`);
}

// ── Single follow-up visit PDF (opens in new tab) ────────────────────────────

// Parse structured notes text ([Label]\n...) into sections array
function parseSections(raw) {
  if (!raw?.trim()) return [];
  const sections = [];
  const parts = raw.split(/(?=\[[^\]]+\]\n)/);
  for (const part of parts) {
    const m = part.match(/^\[([^\]]+)\]\n([\s\S]*)/);
    if (m) {
      const text = m[2].trim();
      if (text) sections.push({ label: m[1], text });
    } else {
      const text = part.trim();
      if (text) sections.push({ label: null, text });
    }
  }
  return sections;
}

export function openSingleVisitPDF(patient, group) {
  const doc   = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const fmtDateLong = (iso) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleDateString("it-IT", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
    });
  };

  // ── Header strip ────────────────────────────────────────────────────────────
  doc.setFillColor(10, 37, 64);
  doc.rect(0, 0, pageW, 24, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("Referto Visita di Follow-Up", 14, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Emesso il ${new Date().toLocaleDateString("it-IT")}`, pageW - 14, 11, { align: "right" });
  doc.text(`${patient.cognome || ""} ${patient.nome || ""}  ·  ${patient.diagnosi || ""}`, 14, 19);

  let y = 32;

  // ── Visit date ───────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(10, 37, 64);
  doc.text(fmtDateLong(group.date), 14, y);
  y += 3;
  doc.setDrawColor(10, 37, 64);
  doc.setLineWidth(0.3);
  doc.line(14, y, pageW - 14, y);
  y += 8;

  // ── Notes (narrative text) ──────────────────────────────────────────────────
  const seen = new Set();
  const noteBlocks = (group.assessments || [])
    .filter((a) => a.notes?.trim())
    .reduce((acc, a) => {
      if (!seen.has(a.notes.trim())) { seen.add(a.notes.trim()); acc.push(a.notes.trim()); }
      return acc;
    }, []);

  if (noteBlocks.length > 0) {
    const sections = parseSections(noteBlocks[0]);
    if (sections.length > 0) {
      y = pdfVisitHeader(doc, "Referto clinico", null, y, pageW, pageH);
      for (const sec of sections) {
        y = pdfSection(doc, sec.label || "Note", sec.text, y, pageW, pageH);
      }
      y += 4;
    } else if (noteBlocks[0].trim()) {
      y = pdfVisitHeader(doc, "Referto clinico", null, y, pageW, pageH);
      y = pdfSection(doc, "Note visita", noteBlocks[0], y, pageW, pageH);
      y += 4;
    }
  } else {
    // No narrative saved — show a notice
    if (y > pageH - 20) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text("Nessun testo narrativo registrato per questa visita.", 14, y);
    doc.setTextColor(0, 0, 0);
    y += 10;
  }

  // ── Clinimetria ──────────────────────────────────────────────────────────────
  const scoredAss = (group.assessments || []).filter((a) => a.score != null);
  if (scoredAss.length > 0) {
    y = pdfVisitHeader(doc, "Indici clinimetrici", null, y, pageW, pageH);
    const rows = scoredAss.map((a) => [
      INDEX_LABELS[a.index_type] || a.index_type,
      String(a.score),
      a.interpretation || "-",
    ]);
    autoTable(doc, {
      startY: y,
      head: [["Indice", "Punteggio", "Interpretazione"]],
      body: rows,
      theme: "striped",
      headStyles: { fillColor: [10, 37, 64], textColor: 255, fontStyle: "bold", fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 2.5 },
      margin: { left: 14, right: 14 },
    });
    y = (doc.lastAutoTable?.finalY || y) + 8;
  }

  // ── Terapie attive ───────────────────────────────────────────────────────────
  if ((group.therapies || []).length > 0) {
    if (y > pageH - 40) { doc.addPage(); y = 20; }
    y = pdfVisitHeader(doc, "Terapie attive a questa data", null, y, pageW, pageH);
    const tRows = group.therapies.map((t) => [
      t.drug_name || "-",
      t.dose || "-",
      t.frequency || "-",
      t.route || "-",
    ]);
    autoTable(doc, {
      startY: y,
      head: [["Farmaco", "Dose", "Frequenza", "Via"]],
      body: tRows,
      theme: "grid",
      headStyles: { fillColor: [60, 80, 110], textColor: 255, fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 2.5 },
      margin: { left: 14, right: 14 },
    });
    y = (doc.lastAutoTable?.finalY || y) + 8;
  }

  // ── Esami di lab ─────────────────────────────────────────────────────────────
  if ((group.exams || []).length > 0) {
    if (y > pageH - 40) { doc.addPage(); y = 20; }
    y = pdfVisitHeader(doc, "Esami di laboratorio", null, y, pageW, pageH);
    const eRows = [];
    for (const e of group.exams) {
      for (const [k, v] of Object.entries(e.values || {})) {
        eRows.push([
          e.panel || "-",
          k,
          v?.value ?? v?.qualitative ?? "-",
          v?.unit || "-",
        ]);
      }
    }
    if (eRows.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Pannello", "Parametro", "Valore", "Unità"]],
        body: eRows,
        theme: "striped",
        headStyles: { fillColor: [60, 80, 110], textColor: 255, fontSize: 9 },
        styles: { fontSize: 9, cellPadding: 2.5 },
        margin: { left: 14, right: 14 },
      });
      y = (doc.lastAutoTable?.finalY || y) + 8;
    }
  }

  // ── Esami strumentali ────────────────────────────────────────────────────────
  if ((group.instrumentalExams || []).length > 0) {
    if (y > pageH - 40) { doc.addPage(); y = 20; }
    y = pdfVisitHeader(doc, "Esami strumentali", null, y, pageW, pageH);
    const instrRows = (group.instrumentalExams || []).map(e => {
      const label = EXAM_TYPE_LABELS[e.exam_type] || e.exam_type || "-";
      const d     = formatDate(e.exam_date || e.date);
      const text  = e.summary || e.result || "-";
      return [label, d, text];
    });
    autoTable(doc, {
      startY: y,
      head: [["Tipo esame", "Data", "Risultato / Descrizione"]],
      body: instrRows,
      theme: "striped",
      headStyles: { fillColor: [40, 90, 130], textColor: 255, fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: { 2: { cellWidth: "auto" } },
      margin: { left: 14, right: 14 },
    });
    y = (doc.lastAutoTable?.finalY || y) + 8;
  }

  // ── Footer ───────────────────────────────────────────────────────────────────
  const totalPages = doc.internal.pages.length - 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `${patient.cognome} ${patient.nome} — ${patient.diagnosi || ""}`,
      14, pageH - 6
    );
    doc.text(`Pag. ${p} / ${totalPages}`, pageW - 14, pageH - 6, { align: "right" });
  }

  return doc.output("bloburl");
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
  function fmtOnset(p) {
    if (!p?.onset_year) return null;
    const base = p.onset_month
      ? `${String(p.onset_month).padStart(2, "0")}/${p.onset_year}`
      : String(p.onset_year);
    const now = new Date();
    const onset = new Date(p.onset_year, (p.onset_month || 6) - 1, 1);
    const diffMs = now - onset;
    if (diffMs <= 0) return base;
    const years = diffMs / (1000 * 60 * 60 * 24 * 365.25);
    let dur;
    if (years < 1) {
      const months = Math.round(years * 12);
      dur = months <= 1 ? "< 1 mese" : `${months} mesi`;
    } else {
      const rounded = Math.floor(years);
      dur = rounded === 1 ? "1 anno" : `${rounded} anni`;
    }
    return `${base} (durata: ${dur})`;
  }
  const lines = [
    `Nome: ${patient.nome || "-"}`,
    `Cognome: ${patient.cognome || "-"}`,
    `Data di nascita: ${formatDate(patient.data_nascita)}`,
    `Sesso: ${patient.sesso || "-"}`,
    `Codice Fiscale: ${patient.codice_fiscale || "-"}`,
    `Diagnosi: ${patient.diagnosi || "-"}`,
    ...(fmtOnset(patient) ? [`Esordio malattia: ${fmtOnset(patient)}`] : []),
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

export function exportCriteriaPDF(patient, criteriaEvals) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Report Criteri Classificativi", 14, 18);

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

  const startY = 40 + lines.length * 6 + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Storico criteri applicati", 14, startY);

  const tableData = criteriaEvals.map((ce) => [
    formatDate(ce.date),
    ce.criteria_name,
    ce.source,
    `${ce.score} / ≥${ce.threshold}`,
    ce.meets ? "Soddisfatti" : "Non raggiunti",
  ]);

  autoTable(doc, {
    startY: startY + 4,
    head: [["Data", "Criteri", "Sorgente", "Score / Soglia", "Esito"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [10, 37, 64], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 3 },
  });

  // Detail per evaluation
  criteriaEvals.forEach((ce) => {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`${ce.criteria_name}`, 14, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Sorgente: ${ce.source}`, 14, 28);
    doc.text(`Data: ${formatDate(ce.date)}`, 14, 34);
    doc.text(`Score: ${ce.score} (soglia ≥ ${ce.threshold})`, 14, 40);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(ce.meets ? 21 : 100, ce.meets ? 128 : 100, ce.meets ? 61 : 100);
    doc.text(`Esito: ${ce.meets ? "CRITERI SODDISFATTI" : "Criteri non raggiunti"}`, 14, 48);
    doc.setTextColor(0, 0, 0);

    const selRows = Object.entries(ce.selections || {}).map(([k, v]) => [
      String(k),
      typeof v === "boolean" ? (v ? "Sì" : "No") : String(v),
    ]);
    if (selRows.length) {
      autoTable(doc, {
        startY: 56,
        head: [["Voce", "Selezione"]],
        body: selRows,
        theme: "grid",
        headStyles: { fillColor: [10, 37, 64], textColor: 255 },
        styles: { fontSize: 9 },
      });
    }
  });

  doc.save(`criteri_${patient.cognome}_${patient.nome}.pdf`);
}
