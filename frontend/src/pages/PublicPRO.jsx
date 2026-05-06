import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { proTokensApi } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Activity, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { PRO_INSTRUMENTS } from "../lib/proInstruments";

/**
 * Public PRO form: opened by the patient via QR/link, NO login required.
 * Renders the questionnaires the doctor selected, validates inputs and
 * submits the responses. Calculates scores client-side for quick feedback.
 */
export default function PublicPRO() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState(null); // { status, instruments, patient_first_name, ... }
  const [responses, setResponses] = useState({}); // { [instrument_id]: { [item_key]: value } }
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    proTokensApi
      .publicGet(token)
      .then((data) => setInfo(data))
      .catch((e) => setError(e.response?.data?.detail || "Link non valido"))
      .finally(() => setLoading(false));
  }, [token]);

  const setItemValue = (instrId, key, val) => {
    setResponses((p) => ({ ...p, [instrId]: { ...(p[instrId] || {}), [key]: val } }));
  };

  const submit = async () => {
    if (!info) return;
    // Validate every instrument has every item answered
    for (const instrId of info.instruments) {
      const def = PRO_INSTRUMENTS[instrId];
      if (!def) continue;
      const r = responses[instrId] || {};
      for (const it of def.items) {
        if (r[it.key] === undefined || r[it.key] === null || r[it.key] === "") {
          alert(`Manca una risposta a "${it.question}" del questionario ${def.label}`);
          return;
        }
      }
    }
    setSubmitting(true);
    try {
      // Compute scores client-side (also re-evaluated by doctor on convert)
      const computed = {};
      for (const instrId of info.instruments) {
        const def = PRO_INSTRUMENTS[instrId];
        if (!def) continue;
        const r = responses[instrId] || {};
        const result = def.score(r);
        computed[instrId] = result;
      }
      await proTokensApi.publicSubmit(token, { instruments: computed });
      setSubmitted(true);
    } catch (e) {
      alert(e.response?.data?.detail || "Errore durante l'invio");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4">
        <Card className="p-6 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h2 className="font-heading text-xl font-bold mt-3">Link non valido</h2>
          <p className="text-sm text-gray-600 mt-2">{error}</p>
        </Card>
      </div>
    );
  }

  if (info?.status === "expired") {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4">
        <Card className="p-6 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <h2 className="font-heading text-xl font-bold mt-3">Link scaduto</h2>
          <p className="text-sm text-gray-600 mt-2">
            Questo link è scaduto il {new Date(info.expired_at).toLocaleString("it-IT")}.
            Contatta il tuo medico per richiederne uno nuovo.
          </p>
        </Card>
      </div>
    );
  }

  if (info?.status === "already_submitted" || submitted) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4">
        <Card className="p-6 max-w-md text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h2 className="font-heading text-xl font-bold mt-3">Grazie!</h2>
          <p className="text-sm text-gray-600 mt-2">
            Le tue risposte sono state inviate al tuo medico. Puoi chiudere questa pagina.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-24">
      {/* Header */}
      <div className="bg-[#0A2540] text-white px-4 py-5">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="font-heading font-black text-lg tracking-tight">
              Questionario per {info.patient_first_name || "il paziente"}
            </div>
            <div className="text-[11px] text-white/70">
              {info.organization_name} {info.diagnosis ? `· ${info.diagnosis}` : ""}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {info.note && (
          <Card className="p-3 bg-blue-50/40 border-blue-200 text-sm text-blue-900">
            <strong>Messaggio dal medico:</strong> {info.note}
          </Card>
        )}

        <Card className="p-3 bg-emerald-50/40 border-emerald-200 text-xs text-emerald-900">
          Compila ogni domanda pensando alla tua condizione nell'<strong>ultima settimana</strong>.
          Le risposte sono inviate solo al medico che ti ha generato questo link.
        </Card>

        {info.instruments.map((instrId) => {
          const def = PRO_INSTRUMENTS[instrId];
          if (!def) return null;
          return (
            <Card key={instrId} className="p-4 border-gray-200 space-y-4" data-testid={`instr-${instrId}`}>
              <div>
                <h2 className="font-heading font-black text-lg tracking-tight text-[#0A2540]">{def.label}</h2>
                <div className="text-xs text-gray-700 mt-0.5">{def.title}</div>
                <div className="text-xs text-gray-600 mt-2">{def.intro}</div>
              </div>

              {def.items.map((it) => (
                <ItemControl
                  key={it.key}
                  instrId={instrId}
                  item={it}
                  options={def.options}
                  value={responses[instrId]?.[it.key]}
                  onChange={(v) => setItemValue(instrId, it.key, v)}
                />
              ))}
            </Card>
          );
        })}

        <Button
          onClick={submit}
          disabled={submitting}
          className="w-full bg-[#0A2540] text-white hover:bg-[#051626] py-6 text-base"
          data-testid="submit-pro-btn"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Invio in corso...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5 mr-2" /> Invia al mio medico
            </>
          )}
        </Button>

        <p className="text-[10px] text-center text-gray-500">
          Le tue risposte sono criptate e visibili solo al tuo medico curante.
        </p>
      </div>
    </div>
  );
}

function ItemControl({ instrId, item, options, value, onChange }) {
  if (item.type === "ord4") {
    return (
      <div className="space-y-2">
        {item.category && (
          <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500">{item.category}</div>
        )}
        <div className="text-sm">È in grado di: <strong>{item.question}</strong></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`text-left text-xs px-3 py-2 rounded-md border transition ${
                value === opt.value
                  ? "border-[#0A2540] bg-blue-50 ring-1 ring-[#0A2540]"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
              data-testid={`${instrId}-${item.key}-${opt.value}`}
            >
              <span className="font-mono font-bold text-[#0A2540] mr-2">{opt.value}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (item.type === "nrs") {
    const v = value ?? "";
    return (
      <div className="space-y-2">
        <div className="text-sm leading-snug">{item.question}</div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-8 text-right">0</span>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={Number.isFinite(v) ? v : 5}
            onChange={(e) => onChange(Number(e.target.value))}
            className="flex-1 accent-[#0A2540]"
            data-testid={`${instrId}-${item.key}-slider`}
          />
          <span className="text-[10px] text-gray-500 w-8">10</span>
          <span
            className={`font-mono font-bold w-10 text-center text-base ${
              value !== undefined && value !== null && value !== "" ? "text-[#0A2540]" : "text-gray-300"
            }`}
            data-testid={`${instrId}-${item.key}-value`}
          >
            {value ?? "-"}
          </span>
        </div>
        <div className="grid grid-cols-11 gap-0.5">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`text-xs h-7 rounded ${
                value === n ? "bg-[#0A2540] text-white font-bold" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              data-testid={`${instrId}-${item.key}-${n}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (item.type === "vas100") {
    const v = value ?? "";
    return (
      <div className="space-y-2">
        <div className="text-sm leading-snug">{item.question}</div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-8 text-right">0</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Number.isFinite(v) ? v : 50}
            onChange={(e) => onChange(Number(e.target.value))}
            className="flex-1 accent-[#0A2540]"
            data-testid={`${instrId}-${item.key}-vas`}
          />
          <span className="text-[10px] text-gray-500 w-8">100</span>
          <span className={`font-mono font-bold w-12 text-center text-base ${value != null && value !== "" ? "text-[#0A2540]" : "text-gray-300"}`}>
            {value ?? "-"}
          </span>
        </div>
      </div>
    );
  }
  return null;
}
