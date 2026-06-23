import React, { useState } from "react";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { examUploadApi } from "../../lib/api";

const PURPOSE_OPTIONS = [
  { value: "same_day", label: "4 ore — paziente presente oggi", description: "Il link scade in 4 ore" },
  { value: "pre_visit", label: "7 giorni — pre-visita successiva", description: "Il link scade tra 7 giorni" },
];

export default function ExamUploadQRModal({ visitId, onClose }) {
  const [purpose, setPurpose] = useState("same_day");
  const [generating, setGenerating] = useState(false);
  const [session, setSession] = useState(null);
  const [revoking, setRevoking] = useState(false);

  const uploadUrl = session
    ? `${window.location.origin}/exam-upload/${session.token}`
    : "";

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await examUploadApi.generateQR(visitId, purpose);
      setSession(result);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Errore nella generazione del QR");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async () => {
    if (!window.confirm("Disattivare il QR? Il paziente non potrà più caricare file con questo link.")) return;
    setRevoking(true);
    try {
      await examUploadApi.revokeSession(session.session_id);
      toast.success("QR disattivato");
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Errore nella disattivazione");
    } finally {
      setRevoking(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(uploadUrl).then(() => toast.success("Link copiato"));
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">QR upload esami paziente</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {!session ? (
            <>
              <div>
                <p className="text-xs text-gray-500 mb-3">
                  Genera un link temporaneo che consente al paziente di caricare esami senza login.
                </p>
                <div className="space-y-2">
                  {PURPOSE_OPTIONS.map(opt => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 border rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                        purpose === opt.value
                          ? "border-[#0A2540] bg-[#0A2540]/5"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="purpose"
                        value={opt.value}
                        checked={purpose === opt.value}
                        onChange={() => setPurpose(opt.value)}
                        className="mt-0.5 accent-[#0A2540]"
                      />
                      <div>
                        <p className="text-xs font-medium text-gray-800">{opt.label}</p>
                        <p className="text-[11px] text-gray-400">{opt.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full bg-[#0A2540] hover:bg-[#051626] disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2 transition-colors"
              >
                {generating ? "Generazione..." : "Genera QR"}
              </button>
            </>
          ) : (
            <>
              <div className="flex justify-center p-4 bg-white border border-gray-100 rounded-lg">
                <QRCode value={uploadUrl} size={160} />
              </div>

              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-gray-400 mb-1">Link copiabile</p>
                <div className="flex items-center gap-2">
                  <p className="text-[11px] text-gray-700 break-all flex-1 font-mono">{uploadUrl}</p>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 text-[11px] text-[#0A2540] border border-[#0A2540]/30 rounded px-2 py-1 hover:bg-[#0A2540]/5"
                  >
                    Copia
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-gray-500 space-y-0.5">
                <p>
                  <span className="font-medium">Durata:</span>{" "}
                  {session.purpose === "same_day" ? "4 ore" : "7 giorni"}
                </p>
                <p>
                  <span className="font-medium">Max file:</span> 5 per sessione (PDF, JPG, PNG, max 20 MB)
                </p>
                <p className="text-amber-600">Il QR si disattiva automaticamente al completamento della visita.</p>
              </div>

              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="w-full border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 text-sm rounded-lg py-2 transition-colors"
              >
                {revoking ? "Disattivazione..." : "Disattiva QR"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
