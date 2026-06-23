import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { examUploadApi } from "../../lib/api";

const EXAM_TYPE_LABELS = {
  lab: "Laboratorio",
  rx: "Radiografia",
  ct: "TAC",
  us: "Ecografia",
  specialist_visit: "Visita specialistica",
  other: "Altro",
};

const STATUS_LABELS = {
  pending_review: { label: "In attesa", className: "bg-amber-100 text-amber-700" },
  accepted: { label: "Accettato", className: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Scartato", className: "bg-gray-100 text-gray-500" },
};

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("it-IT", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const IMAGE_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/jpg"]);

export default function PatientExamUploadQueue({ visitId, onPendingChange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});
  const [revoking, setRevoking] = useState(false);
  const [editedTexts, setEditedTexts] = useState({});

  const load = useCallback(async () => {
    try {
      const result = await examUploadApi.listUploads(visitId);
      setData(result);
      const pending = (result.uploads || []).filter(u => u.status === "pending_review").length;
      onPendingChange?.(pending);
    } catch {
      setData({ uploads: [], active_session: null });
    } finally {
      setLoading(false);
    }
  }, [visitId, onPendingChange]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const handleStatus = async (uploadId, status, originalExtractedText) => {
    setProcessing(p => ({ ...p, [uploadId]: true }));
    try {
      const payload = { status };
      if (status === "rejected") {
        payload.extracted_text = "";
      } else {
        const edited = editedTexts[uploadId];
        if (edited !== undefined && edited !== (originalExtractedText || "")) {
          payload.extracted_text = edited;
        }
      }
      await examUploadApi.updateUpload(uploadId, payload);
      setEditedTexts(t => { const n = { ...t }; delete n[uploadId]; return n; });
      await load();
      toast.success(status === "accepted" ? "Esame accettato" : "Esame scartato");
    } catch {
      toast.error("Errore nell'aggiornamento");
    } finally {
      setProcessing(p => ({ ...p, [uploadId]: false }));
    }
  };

  const handleRevoke = async () => {
    if (!data?.active_session) return;
    if (!window.confirm("Disattivare il QR? Il paziente non potrà più caricare file con questo link.")) return;
    setRevoking(true);
    try {
      await examUploadApi.revokeSession(data.active_session.id);
      await load();
      toast.success("QR disattivato");
    } catch {
      toast.error("Errore nella disattivazione");
    } finally {
      setRevoking(false);
    }
  };

  if (loading) return null;

  const uploads = data?.uploads || [];
  const pending = uploads.filter(u => u.status === "pending_review");
  const others = uploads.filter(u => u.status !== "pending_review");
  const activeSession = data?.active_session;

  if (!uploads.length && !activeSession) return null;

  return (
    <div className="border border-amber-200 rounded-xl bg-amber-50/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-200">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span className="text-sm font-semibold text-amber-800">Esami caricati dal paziente</span>
          {pending.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 font-medium">
              {pending.length} in attesa
            </span>
          )}
        </div>
        {activeSession && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-emerald-700 bg-emerald-100 border border-emerald-200 rounded px-1.5 py-0.5">
              QR attivo
            </span>
            <button
              onClick={handleRevoke}
              disabled={revoking}
              className="text-[11px] text-red-600 hover:underline disabled:opacity-50"
            >
              Disattiva
            </button>
          </div>
        )}
      </div>

      {pending.length > 0 && (
        <div className="p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-2">
            Da revisionare — obbligatorio prima di completare la visita
          </p>
          {pending.map(upload => (
            <UploadRow
              key={upload.id}
              upload={upload}
              onAccept={() => handleStatus(upload.id, "accepted", upload.extracted_text)}
              onReject={() => handleStatus(upload.id, "rejected", upload.extracted_text)}
              processing={!!processing[upload.id]}
              editedText={editedTexts[upload.id]}
              onEditText={(t) => setEditedTexts(prev => ({ ...prev, [upload.id]: t }))}
            />
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div className="px-3 pb-3 space-y-1">
          {pending.length > 0 && (
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-2 mb-1.5">
              Revisionati
            </p>
          )}
          {others.map(upload => (
            <UploadRow
              key={upload.id}
              upload={upload}
              processing={!!processing[upload.id]}
            />
          ))}
        </div>
      )}

      {uploads.length === 0 && activeSession && (
        <div className="px-4 py-4 text-center">
          <p className="text-xs text-gray-500">Nessun file caricato ancora. QR attivo in attesa del paziente.</p>
        </div>
      )}
    </div>
  );
}

function UploadRow({ upload, onAccept, onReject, processing, editedText, onEditText }) {
  const status = STATUS_LABELS[upload.status] || STATUS_LABELS.pending_review;
  const isPending = upload.status === "pending_review";
  const fileUrl = examUploadApi.fileUrl(upload.id);
  const isImage = IMAGE_CONTENT_TYPES.has(upload.content_type);
  const displayText = editedText !== undefined ? editedText : (upload.extracted_text || "");

  return (
    <div className={`bg-white border rounded-lg overflow-hidden ${isPending ? "border-amber-200" : "border-gray-100"}`}>
      <div className="flex items-start justify-between gap-2 px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold text-gray-700">
              {EXAM_TYPE_LABELS[upload.exam_type] || upload.exam_type}
            </span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${status.className}`}>
              {status.label}
            </span>
            {isImage && !upload.extracted_text && isPending && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                OCR in corso
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {upload.original_filename}
            {upload.file_size ? ` — ${formatSize(upload.file_size)}` : ""}
          </p>
          {upload.notes && (
            <p className="text-[10px] text-gray-500 italic mt-0.5">"{upload.notes}"</p>
          )}
          <p className="text-[10px] text-gray-400 mt-0.5">
            Caricato: {formatDate(upload.uploaded_at)}
            {upload.uploaded_by_ip ? ` — IP: ${upload.uploaded_by_ip}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[#0A2540] border border-[#0A2540]/30 rounded px-1.5 py-1 hover:bg-[#0A2540]/5"
          >
            Visualizza
          </a>
          {isPending && (
            <>
              <button
                onClick={onAccept}
                disabled={processing}
                className="text-[11px] text-emerald-700 border border-emerald-300 rounded px-1.5 py-1 hover:bg-emerald-50 disabled:opacity-50"
              >
                Accetta
              </button>
              <button
                onClick={onReject}
                disabled={processing}
                className="text-[11px] text-red-600 border border-red-200 rounded px-1.5 py-1 hover:bg-red-50 disabled:opacity-50"
              >
                Scarta
              </button>
            </>
          )}
        </div>
      </div>

      {isImage && (
        <div className="border-t border-gray-100 px-3 pb-3 pt-2 flex gap-3">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
          >
            <img
              src={fileUrl}
              alt={upload.original_filename}
              className="w-20 h-20 object-cover rounded border border-gray-200 hover:opacity-90 transition-opacity"
            />
          </a>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Testo estratto (OCR)
              {isPending && <span className="ml-1 font-normal normal-case text-gray-400">— modificabile</span>}
            </p>
            <textarea
              value={displayText}
              onChange={isPending ? (e) => onEditText(e.target.value) : undefined}
              readOnly={!isPending}
              rows={4}
              className={`w-full text-[11px] font-mono border rounded px-2 py-1.5 resize-y leading-relaxed ${
                isPending
                  ? "border-gray-200 focus:border-[#0A2540] focus:outline-none bg-white"
                  : "border-gray-100 bg-gray-50 text-gray-600"
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
