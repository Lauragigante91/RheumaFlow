import React, { useRef, useState } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import { Button } from "../ui/button";

export function VasSlider({ label, value, onChange, hint, testid }) {
  const v = Number(value) || 0;
  return (
    <div className="space-y-1" data-testid={testid}>
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium leading-snug flex-1">{label}</Label>
        <Input
          type="number"
          min={0}
          max={10}
          step="0.1"
          className="w-20 text-sm h-8"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <Slider min={0} max={10} step={0.1} value={[v]} onValueChange={([val]) => onChange(val)} />
      {hint && <p className="text-[10px] text-gray-500 leading-tight">{hint}</p>}
    </div>
  );
}

/**
 * Read-only tile showing a computed clinimetric score + its interpretation.
 * Se `missingFields` è un array non vuoto, la tile non viene mostrata (hideIfIncomplete=true)
 * oppure mostra uno stato grigio "Dati incompleti" (default).
 */
export function ResultTile({ title, score, interp, subtitle, testid, missingFields, hideIfIncomplete }) {
  const incomplete = Array.isArray(missingFields) && missingFields.length > 0;

  if (incomplete && hideIfIncomplete) return null;

  if (incomplete) {
    return (
      <div
        className="border border-gray-200 rounded-md p-3 bg-gray-50"
        data-testid={testid}
      >
        <div className="text-[10px] uppercase tracking-[0.15em] text-gray-400 font-semibold">
          {title}
        </div>
        <div className="mt-1 text-xs font-semibold text-gray-400" data-testid={`${testid}-score`}>
          Dati incompleti
        </div>
        <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">
          Mancano: {missingFields.join(", ")}
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-md p-3" data-testid={testid}>
      <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold">{title}</div>
      <div className="flex items-baseline gap-2 mt-0.5">
        <span className="font-mono font-black text-2xl text-[#0A2540]" data-testid={`${testid}-score`}>
          {score === null || isNaN(score) ? "—" : score}
        </span>
        {subtitle && <span className="text-[10px] text-gray-500">{subtitle}</span>}
      </div>
      {interp && <div className="text-xs font-medium mt-0.5 text-gray-700">{interp}</div>}
    </div>
  );
}

/**
 * Pulsante per leggere un QR code con la fotocamera del dispositivo.
 * Usa BarcodeDetector API (Chromium) con fallback a input manuale.
 * Formato QR supportato: numero puro (es. "45") oppure JSON {"pga":45} o {"vas":45} o {"value":45}.
 * Chiama onValue(number) con il valore letto (0–100).
 */
export function QrScanButton({ onValue, fieldLabel }) {
  const fileRef = useRef(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualVal, setManualVal] = useState("");
  const [error, setError] = useState("");

  const parseQrRaw = (raw) => {
    const trimmed = raw.trim();
    try {
      const obj = JSON.parse(trimmed);
      const candidate = obj.pga ?? obj.vas ?? obj.vasP ?? obj.value ?? null;
      if (candidate !== null) return Number(candidate);
    } catch {
      const n = parseFloat(trimmed);
      if (!isNaN(n)) return n;
    }
    return null;
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    if (typeof BarcodeDetector === "undefined") {
      setManualOpen(true);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    try {
      const bd = new BarcodeDetector({ formats: ["qr_code"] });
      const bitmap = await createImageBitmap(file);
      const results = await bd.detect(bitmap);
      if (results.length === 0) {
        setError("Nessun QR rilevato. Riprova o inserisci manualmente.");
        setManualOpen(true);
      } else {
        const val = parseQrRaw(results[0].rawValue);
        if (val === null) {
          setError("Formato QR non riconosciuto.");
          setManualOpen(true);
        } else {
          onValue(Math.min(100, Math.max(0, val)));
        }
      }
    } catch {
      setError("Lettura QR non riuscita.");
      setManualOpen(true);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const confirmManual = () => {
    const n = parseFloat(manualVal);
    if (isNaN(n)) return;
    onValue(Math.min(100, Math.max(0, n)));
    setManualOpen(false);
    setManualVal("");
    setError("");
  };

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2 text-[10px] border-gray-300 text-gray-600 hover:bg-gray-50 flex-shrink-0"
        onClick={() => { setError(""); fileRef.current?.click(); }}
        title={`Precompila ${fieldLabel || "valore"} da QR code`}
      >
        QR
      </Button>
      {manualOpen && (
        <div className="flex items-center gap-1.5 mt-1">
          {error && <span className="text-[10px] text-red-500">{error}</span>}
          <Input
            type="number"
            min={0}
            max={100}
            step="1"
            className="w-20 h-7 text-xs"
            placeholder="0–100"
            value={manualVal}
            onChange={(e) => setManualVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") confirmManual(); if (e.key === "Escape") { setManualOpen(false); setError(""); } }}
            autoFocus
          />
          <Button type="button" size="sm" className="h-7 px-2 text-xs" onClick={confirmManual}>OK</Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-1 text-xs" onClick={() => { setManualOpen(false); setError(""); }}>✕</Button>
        </div>
      )}
    </div>
  );
}
