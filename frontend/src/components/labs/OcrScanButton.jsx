/**
 * OcrScanButton
 *
 * Compact reusable component: a small button that opens a mini OCR dialog.
 * Accepts an image (upload / drag-drop / Ctrl+V / clipboard API),
 * runs Tesseract.js OCR locally (no server, no AI), then calls onText(text).
 *
 * Props:
 *   onText      (text: string) => void   — called with the recognised text
 *   label?      string                   — button label (default "Da immagine")
 *   disabled?   boolean
 *   style?      object                   — extra styles for the trigger button
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Camera, X, Loader2, ClipboardPaste, RotateCcw, Check } from "lucide-react";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/bmp,image/tiff";

export default function OcrScanButton({ onText, label = "Da immagine", disabled = false, style }) {
  const [open,      setOpen]      = useState(false);
  const [imgSrc,    setImgSrc]    = useState(null);   // data-URL preview
  const [ocrState,  setOcrState]  = useState("idle"); // idle | running | done | error
  const [progress,  setProgress]  = useState(0);
  const [resultText,setResultText]= useState("");
  const [dragging,  setDragging]  = useState(false);
  const fileRef = useRef(null);
  const dropRef = useRef(null);

  // ── Reset when dialog opens ──────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setImgSrc(null);
      setOcrState("idle");
      setProgress(0);
      setResultText("");
    }
  }, [open]);

  // ── Paste listener (Ctrl+V) ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handlePaste = (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imgItem = items.find(it => it.type.startsWith("image/"));
      if (imgItem) {
        const file = imgItem.getAsFile();
        if (file) loadFile(file);
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load file → data URL ─────────────────────────────────────────────────────
  const loadFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setImgSrc(e.target.result);
      setOcrState("idle");
      setResultText("");
    };
    reader.readAsDataURL(file);
  }, []);

  // ── Paste from clipboard API ─────────────────────────────────────────────────
  const pasteFromClipboard = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imgType = item.types.find(t => t.startsWith("image/"));
        if (imgType) {
          const blob = await item.getType(imgType);
          loadFile(new File([blob], "clipboard.png", { type: imgType }));
          return;
        }
      }
    } catch {
      // fallback — user will use Ctrl+V or file picker
    }
  };

  // ── Drag & drop ──────────────────────────────────────────────────────────────
  const onDragOver  = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = ()  => setDragging(false);
  const onDrop      = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  // ── Run OCR ──────────────────────────────────────────────────────────────────
  const runOcr = async () => {
    if (!imgSrc) return;
    setOcrState("running");
    setProgress(0);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("ita+eng", 1, {
        workerPath: `${window.location.origin}/tesseract/worker.min.js`,
        workerBlobURL: false,
        logger: (m) => {
          if (m.status === "recognizing text") {
            setProgress(Math.round((m.progress || 0) * 100));
          }
        },
      });
      const { data } = await worker.recognize(imgSrc);
      await worker.terminate();
      setResultText(data.text || "");
      setOcrState("done");
    } catch (err) {
      console.error("OCR error:", err);
      setOcrState("error");
    }
  };

  // ── Confirm: send text upstream ──────────────────────────────────────────────
  const confirm = () => {
    onText(resultText);
    setOpen(false);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: "5px",
          padding: "4px 10px", borderRadius: 7,
          border: "1.5px solid #6ee7b7",
          background: "#ecfdf5", color: "#065f46",
          fontSize: 12, fontWeight: 600, cursor: "pointer",
          lineHeight: 1.4,
          opacity: disabled ? 0.5 : 1,
          ...style,
        }}
      >
        <Camera size={13} />
        {label}
      </button>

      {/* Dialog overlay */}
      {open && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "16px",
          }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div style={{
            background: "#fff", borderRadius: 14, width: "100%", maxWidth: 520,
            boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
            overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px 12px",
              borderBottom: "1px solid #f3f4f6",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: "#ecfdf5", border: "1px solid #a7f3d0",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Camera size={16} color="#065f46" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0A2540" }}>Importa da immagine (OCR)</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>Elaborazione locale — nessun dato inviato a server esterni</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 4, lineHeight: 1 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Drop zone / preview */}
              {!imgSrc ? (
                <div
                  ref={dropRef}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragging ? "#34d399" : "#d1d5db"}`,
                    borderRadius: 10,
                    padding: "32px 24px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: dragging ? "#f0fdf4" : "#fafafa",
                    transition: "all 0.15s",
                  }}
                >
                  <Camera size={28} color={dragging ? "#059669" : "#d1d5db"} style={{ margin: "0 auto 10px" }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                    Clicca per scegliere un'immagine
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>
                    oppure trascina qui · Ctrl+V per incollare uno screenshot
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept={ACCEPT}
                    style={{ display: "none" }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }}
                  />
                </div>
              ) : (
                <div style={{ position: "relative" }}>
                  <img
                    src={imgSrc}
                    alt="Anteprima"
                    style={{ width: "100%", maxHeight: 200, objectFit: "contain", borderRadius: 8, border: "1px solid #e5e7eb" }}
                  />
                  <button
                    type="button"
                    onClick={() => { setImgSrc(null); setOcrState("idle"); setResultText(""); }}
                    style={{
                      position: "absolute", top: 6, right: 6,
                      background: "rgba(0,0,0,0.55)", border: "none",
                      borderRadius: "50%", width: 24, height: 24,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <X size={13} color="#fff" />
                  </button>
                </div>
              )}

              {/* Clipboard paste button (shown only before image is loaded) */}
              {!imgSrc && (
                <button
                  type="button"
                  onClick={pasteFromClipboard}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "9px 14px", borderRadius: 8,
                    border: "1.5px solid #e5e7eb", background: "#fff",
                    fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer",
                  }}
                >
                  <ClipboardPaste size={15} />
                  Incolla dagli appunti
                </button>
              )}

              {/* OCR progress bar */}
              {ocrState === "running" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Loader2 size={14} className="animate-spin" color="#059669" />
                    <span style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>
                      Riconoscimento testo… {progress}%
                    </span>
                  </div>
                  <div style={{ background: "#e5e7eb", borderRadius: 4, height: 6, overflow: "hidden" }}>
                    <div style={{
                      width: `${progress}%`, height: "100%",
                      background: "linear-gradient(90deg,#34d399,#059669)",
                      transition: "width 0.2s",
                    }} />
                  </div>
                </div>
              )}

              {/* OCR error */}
              {ocrState === "error" && (
                <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, color: "#dc2626" }}>
                  Errore nel riconoscimento. Verifica che l'immagine sia leggibile e riprova.
                </div>
              )}

              {/* Result text area */}
              {ocrState === "done" && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>
                    Testo riconosciuto — modifica se necessario
                  </div>
                  <textarea
                    value={resultText}
                    onChange={e => setResultText(e.target.value)}
                    rows={7}
                    style={{
                      width: "100%", border: "1.5px solid #a7f3d0", borderRadius: 8,
                      padding: "10px 12px", fontSize: 12, outline: "none",
                      resize: "vertical", fontFamily: "inherit", lineHeight: 1.6,
                      color: "#374151", boxSizing: "border-box",
                      background: "#f0fdf4",
                    }}
                  />
                </div>
              )}

              {/* Action row */}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#fff", fontSize: 13, fontWeight: 600, color: "#6b7280", cursor: "pointer" }}
                >
                  Annulla
                </button>

                {ocrState === "done" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => { setOcrState("idle"); setResultText(""); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "8px 14px", borderRadius: 8,
                        border: "1.5px solid #e5e7eb", background: "#fff",
                        fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer",
                      }}
                    >
                      <RotateCcw size={13} /> Riprova
                    </button>
                    <button
                      type="button"
                      onClick={confirm}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "8px 18px", borderRadius: 8,
                        border: "none", background: "#059669",
                        fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer",
                      }}
                    >
                      <Check size={14} /> Usa questo testo
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={runOcr}
                    disabled={!imgSrc || ocrState === "running"}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "8px 18px", borderRadius: 8,
                      border: "none",
                      background: (!imgSrc || ocrState === "running") ? "#d1d5db" : "#059669",
                      fontSize: 13, fontWeight: 700, color: "#fff",
                      cursor: (!imgSrc || ocrState === "running") ? "not-allowed" : "pointer",
                    }}
                  >
                    {ocrState === "running"
                      ? <><Loader2 size={13} className="animate-spin" /> Analisi…</>
                      : <><Camera size={13} /> Avvia OCR</>
                    }
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
