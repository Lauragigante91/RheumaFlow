import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { examUploadApi } from "../lib/api";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/jpg"]);

async function preprocessImage(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    const contrastFactor = (259 * (77 + 255)) / (255 * (259 - 77));
    for (let i = 0; i < d.length; i += 4) {
      let v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      v = Math.min(255, v + 25);
      v = Math.min(255, Math.max(0, contrastFactor * (v - 128) + 128));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(imgData, 0, 0);
    return await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.9));
  } catch {
    return file;
  }
}

const CLINICAL_RE = /(\d+[.,]\d+|\b(?:mg|g|U|mL|mmol|µmol|nmol|pg|ng|IU|iU|dl|dL|mEq|mmHg|UI)\b|[<>]\s*\d|\d\s*-\s*\d|\d{2}\/\d{2}\/\d{4}|1:\d+)/;

const REPORT_START_RE = [
  /Reparto richiedente/i,
  /Richiesta:\s*\d/i,
  /Prelievo:\s*\d/i,
  /Doc\.\s*n\.\s*\d/i,
  /Esame\s+Esito/i,
  /FSE\s*[-–]\s*Fascicolo/i,
  /Accettazione:\s*\d/i,
  /Laboratorio\s+(Analisi|Referto)/i,
  /Reparto\s+Richiedente/i,
  /REFERTO\s+DI\s+LABORATORIO/i,
];

function cleanOCRText(raw) {
  const lines = raw.split("\n");

  // Trova il primo segnale affidabile di inizio referto e taglia prima
  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (REPORT_START_RE.some(re => re.test(lines[i]))) {
      startIdx = i;
      break;
    }
  }
  const content = lines.slice(startIdx);

  return content
    .filter(line => {
      const t = line.trim();
      if (!t) return false;

      const alnums = (t.match(/[a-zA-Z0-9àèéìòùÀÈÉÌÒÙ]/g) || []).length;
      if (alnums < 3) return false;

      // Linee separatore ripetitive (es. "zzzz..." o "====")
      if (/^(.)\1{4,}$/.test(t.replace(/\s/g, ""))) return false;
      if (/^[=\-_*#~]{3,}$/.test(t)) return false;

      // Linee con segnali clinici: sempre mantenute
      if (CLINICAL_RE.test(t)) return true;

      const ratio = alnums / t.length;
      if (ratio < 0.5 && t.length > 5) return false;

      const nonSpace = t.replace(/\s/g, "");
      const special = (nonSpace.match(/[^a-zA-Z0-9àèéìòùÀÈÉÌÒÙ]/g) || []).length;
      if (nonSpace.length > 5 && special / nonSpace.length > 0.28) return false;

      const words = t.toLowerCase().split(/\s+/);
      const meaningful = words.filter(w => /[a-zA-Zàèéìòù]{4,}/.test(w));
      if (meaningful.length === 0) return false;

      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function runOCR(file, token, uploadId) {
  try {
    const processed = await preprocessImage(file);
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("ita", 1, { logger: () => {} });
    const { data: { text } } = await worker.recognize(processed);
    await worker.terminate();
    const cleaned = cleanOCRText(text || "");
    if (cleaned.length > 0) {
      await examUploadApi.publicPatchExtractedText(token, uploadId, cleaned);
    }
    return "done";
  } catch {
    return "failed";
  }
}

const EXAM_TYPE_LABELS = {
  lab: "Referti laboratorio",
  rx: "Radiografia",
  ct: "TAC",
  us: "Ecografia",
  specialist_visit: "Visita specialistica",
  other: "Altro",
};

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export default function ExamUploadPage() {
  const { token } = useParams();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [examType, setExamType] = useState("lab");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [remaining, setRemaining] = useState(5);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [ocrStatus, setOcrStatus] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    examUploadApi.publicStatus(token)
      .then(data => {
        setStatus(data);
        if (data.valid) setRemaining(data.remaining_uploads);
      })
      .catch(() => setStatus({ valid: false }))
      .finally(() => setLoading(false));
  }, [token]);

  const handleFile = (f) => {
    setError("");
    if (!f) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    const ext = f.name.split(".").pop().toLowerCase();
    if (!allowed.includes(f.type) && !["pdf", "jpg", "jpeg", "png"].includes(ext)) {
      setError("Tipo file non supportato. Caricare PDF, JPG o PNG.");
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError("File troppo grande (max 20 MB).");
      return;
    }
    setFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { setError("Selezionare un file da caricare."); return; }
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("exam_type", examType);
      fd.append("notes", notes);
      fd.append("file", file);
      const uploadedFile = file;
      const result = await examUploadApi.publicUpload(token, fd);
      setRemaining(result.remaining_uploads);
      setUploadedCount(c => c + 1);
      setFile(null);
      setNotes("");
      if (fileRef.current) fileRef.current.value = "";
      setSuccessMessage("Esame caricato correttamente. Il medico lo revisionerà prima della visita.");

      if (IMAGE_TYPES.has(uploadedFile.type) && result.upload_id) {
        setOcrStatus("processing");
        runOCR(uploadedFile, token, result.upload_id).then(s => setOcrStatus(s));
      }
    } catch (err) {
      const msg = err.response?.data?.detail || "Errore durante il caricamento. Riprovare.";
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-sm">Verifica link in corso...</p>
      </div>
    );
  }

  if (!status?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.072 16.5C2.302 18.333 3.262 20 4.804 20z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-800 mb-2">Link scaduto o non valido</h1>
          <p className="text-sm text-gray-500">Questo link non è più attivo. Contattare l'ambulatorio per riceverne uno nuovo.</p>
        </div>
      </div>
    );
  }

  if (remaining === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-800 mb-2">Limite raggiunto</h1>
          <p className="text-sm text-gray-500">Hai caricato il numero massimo di file (5) per questa sessione.</p>
          {uploadedCount > 0 && (
            <p className="text-sm text-emerald-600 mt-2">Caricati {uploadedCount} file con successo.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center py-10 px-4">
      <div className="max-w-md w-full">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-[#0A2540] flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-700">RheumaFlow — Upload esami</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Carica i tuoi esami</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {remaining} upload rimanenti su 5. Il medico revisionerà i file prima di includerli nel referto.
          </p>
        </div>

        {successMessage && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-start gap-2">
            <svg className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-emerald-700">{successMessage}</p>
          </div>
        )}

        {ocrStatus === "processing" && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <p className="text-sm text-blue-700">Estraendo testo dalla foto...</p>
          </div>
        )}
        {ocrStatus === "done" && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <p className="text-sm text-blue-700">Testo estratto e inviato al medico.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tipo esame</label>
            <select
              value={examType}
              onChange={e => setExamType(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#0A2540]"
            >
              {Object.entries(EXAM_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">File (PDF, JPG, PNG — max 20 MB)</label>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-lg px-4 py-6 text-center cursor-pointer transition-colors ${
                dragOver ? "border-[#0A2540] bg-blue-50" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {file ? (
                <div>
                  <p className="text-sm font-medium text-gray-800">{file.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                    className="text-xs text-red-500 mt-1 hover:underline"
                  >
                    Rimuovi
                  </button>
                </div>
              ) : (
                <div>
                  <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-gray-500">Trascina qui il file oppure <span className="text-[#0A2540] font-medium">sfoglia</span></p>
                  <p className="text-xs text-gray-400 mt-0.5">PDF, JPG, PNG — max 20 MB</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={e => handleFile(e.target.files[0])}
            />
            {file && IMAGE_TYPES.has(file.type) && (
              <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-snug">
                Suggerimento: per un testo estratto migliore, usa Adobe Scan o Google Drive (icona fotocamera) per scansionare il referto — creano PDF leggibili automaticamente.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Note (opzionale)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value.slice(0, 255))}
              rows={2}
              placeholder="es. Esame del 10/06/2026, accettazione 12345"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#0A2540]"
            />
            <p className="text-right text-[10px] text-gray-400">{notes.length}/255</p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={uploading || !file}
            className="w-full bg-[#0A2540] hover:bg-[#051626] disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2.5 transition-colors"
          >
            {uploading ? "Caricamento in corso..." : "Carica esame"}
          </button>
        </form>

        <p className="text-center text-[10px] text-gray-400 mt-4">
          Questo link è temporaneo e verrà disattivato al termine della visita.
        </p>
      </div>
    </div>
  );
}
