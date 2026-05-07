import React, { useEffect, useState } from "react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { AlertTriangle, ShieldPlus, Bone, BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { isRaDiagnosis } from "../lib/diseaseDetection";
import { labExamsApi, diseaseProfileApi } from "../lib/api";

/**
 * Suggerimenti gestionali (clinical alerts) basati su:
 *  - diagnosi paziente
 *  - profilo di malattia salvato (es. RA con FR/ACPA, presenza ILD)
 *  - terapie attive (steroidi prolungati → osteoporosi; alta immunosoppressione → PJP)
 *  - dati anagrafici (età, sesso, fumo)
 *
 * NON è un alert clinico vincolante: ogni suggerimento è informativo, basato
 * su evidenze pubblicate (EULAR/ACR), e linka alle Linee Guida quando disponibili.
 */
export default function ClinicalAlerts({ patient, therapies = [] }) {
  const [raProfile, setRaProfile] = useState(null);
  const [labs, setLabs] = useState([]);
  const [collapsed, setCollapsed] = useState({});

  useEffect(() => {
    if (!patient?.id) return;
    if (isRaDiagnosis(patient)) {
      diseaseProfileApi.get(patient.id, "ra").then((d) => setRaProfile(d?.data || null)).catch(() => {});
    }
    labExamsApi.listByPatient(patient.id).then(setLabs).catch(() => {});
  }, [patient]);

  const alerts = computeAlerts({ patient, therapies, raProfile, labs });
  if (alerts.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/40 shadow-sm p-5" data-testid="clinical-alerts">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-amber-700" />
        <h2 className="font-heading font-bold text-base tracking-tight text-amber-900">
          Suggerimenti gestionali
        </h2>
        <Badge className="ml-auto bg-amber-200 text-amber-900 hover:bg-amber-200">{alerts.length}</Badge>
      </div>
      <div className="space-y-2">
        {alerts.map((a) => {
          const isOpen = !collapsed[a.id];
          return (
            <div
              key={a.id}
              className="bg-white border border-amber-200 rounded-md overflow-hidden"
              data-testid={`alert-${a.id}`}
            >
              <button
                type="button"
                className="w-full text-left flex items-start gap-2 p-3 hover:bg-amber-50 transition"
                onClick={() => setCollapsed((p) => ({ ...p, [a.id]: !p[a.id] }))}
              >
                <a.Icon className={`w-4 h-4 mt-0.5 ${a.color || "text-amber-700"}`} />
                <div className="flex-1">
                  <div className="font-semibold text-sm text-[#0A2540]">{a.title}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{a.summary}</div>
                </div>
                {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
              </button>
              {isOpen && (
                <div className="px-3 pb-3 pt-1 text-xs text-gray-700 border-t border-amber-100 bg-amber-50/60 space-y-2">
                  {a.factors && a.factors.length > 0 && (
                    <div>
                      <div className="font-semibold text-[11px] uppercase tracking-[0.1em] text-amber-800 mb-1">
                        Fattori rilevati nel paziente
                      </div>
                      <ul className="list-disc pl-5 space-y-0.5">
                        {a.factors.map((f) => <li key={f}>{f}</li>)}
                      </ul>
                    </div>
                  )}
                  {a.action && (
                    <div>
                      <div className="font-semibold text-[11px] uppercase tracking-[0.1em] text-amber-800 mb-1">
                        Azione suggerita
                      </div>
                      <div>{a.action}</div>
                    </div>
                  )}
                  {a.guidelineLink && (
                    <Link
                      to={a.guidelineLink}
                      className="inline-flex items-center gap-1.5 text-[11px] text-blue-700 hover:underline"
                    >
                      <BookOpen className="w-3 h-3" /> {a.guidelineLabel || "Linea guida"}
                    </Link>
                  )}
                  <div className="text-[10px] text-gray-500 italic">{a.evidence}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// Helpers ----------------------------------------------------------------

function ageOf(p) {
  if (!p) return null;
  if (p.data_nascita) {
    const d = new Date(p.data_nascita);
    if (!isNaN(d.getTime())) {
      const ageMs = Date.now() - d.getTime();
      return Math.floor(ageMs / (365.25 * 24 * 3600 * 1000));
    }
  }
  if (p.anno_nascita) return new Date().getFullYear() - Number(p.anno_nascita);
  return null;
}

function isHighRiskImmunosuppression(therapies) {
  // Drugs known to require PJP prophylaxis (ACR/EULAR consensus):
  // - High-dose corticosteroids (≥20 mg prednisone equiv. for ≥4 weeks)
  // - Cyclophosphamide
  // - High-dose MTX in ILD context (less consensus)
  // - Rituximab / B-cell depletion in vasculitis/SLE/myositis
  // - Combined CYC + GC induction (vasculitis)
  const active = therapies.filter((t) => t.status === "active");
  const out = [];
  // High-dose steroid: dose contains "≥20" or extracted numeric ≥20mg/day
  const steroid = active.find((t) => /predniso|metilpredniso|deltacortene|medrol/i.test(t.drug_name || ""));
  if (steroid) {
    const doseStr = (steroid.dose || "").toLowerCase();
    const m = doseStr.match(/(\d+(?:[.,]\d+)?)\s*mg/);
    const dose = m ? parseFloat(m[1].replace(",", ".")) : null;
    if (dose != null && dose >= 20) out.push(`${steroid.drug_name} ${steroid.dose}/die (≥20 mg)`);
  }
  if (active.find((t) => /ciclofosfamide|cyclophospham/i.test(t.drug_name || ""))) {
    out.push("Ciclofosfamide attiva");
  }
  if (active.find((t) => /rituximab/i.test(t.drug_name || ""))) {
    out.push("Rituximab (deplezione B-cellulare)");
  }
  return out;
}

function activeSteroidMonths(therapies) {
  // Returns max months of continuous steroid (any dose ≥5 mg prednisone equiv)
  const today = new Date();
  let maxMonths = 0;
  for (const t of therapies) {
    if (!/predniso|metilpredniso|deltacortene|medrol/i.test(t.drug_name || "")) continue;
    const start = t.start_date ? new Date(t.start_date) : null;
    if (!start) continue;
    const end = t.end_date ? new Date(t.end_date) : today;
    const months = Math.round((end - start) / (30.4 * 24 * 3600 * 1000));
    if (t.status === "active" || (t.end_date && (today - end) / (30 * 24 * 3600 * 1000) < 1)) {
      if (months > maxMonths) maxMonths = months;
    }
  }
  return maxMonths;
}

function getLabValue(labs, panelKey, testKey) {
  for (const e of labs) {
    if (e.panel !== panelKey) continue;
    const v = (e.values || {})[testKey];
    if (v == null) continue;
    return v;
  }
  return null;
}

function computeAlerts({ patient, therapies, raProfile, labs }) {
  const out = [];

  // ---- 1) RA + ILD risk factors → screening ILD ----
  if (isRaDiagnosis(patient)) {
    const factors = [];
    const age = ageOf(patient);
    if (age != null && age >= 60) factors.push(`Età ${age} anni (≥60)`);
    if (patient.sesso === "M") factors.push("Sesso maschile");
    // RA profile
    if (raProfile?.rf_status === "positive") {
      factors.push("FR positivo" + (raProfile.rf_titer ? ` (titolo ${raProfile.rf_titer})` : ""));
    }
    if (raProfile?.acpa_status === "positive") {
      factors.push("Anti-CCP/ACPA positivo" + (raProfile.acpa_titer ? ` (titolo ${raProfile.acpa_titer})` : ""));
    }
    // Smoking from notes
    const noteText = (patient.note || "").toLowerCase();
    if (/fumat|fumo attivo|smoking|smoker/.test(noteText)) {
      factors.push("Anamnesi positiva per fumo");
    }
    // Inflammatory markers from labs
    const crp = getLabValue(labs, "fase_acuta", "pcr") || getLabValue(labs, "fase_acuta", "crp");
    if (crp && Number(crp.value) > 1.0) factors.push(`PCR elevata (${crp.value} ${crp.unit || "mg/dL"})`);
    const esr = getLabValue(labs, "fase_acuta", "ves") || getLabValue(labs, "fase_acuta", "esr");
    if (esr && Number(esr.value) > 30) factors.push(`VES elevata (${esr.value} ${esr.unit || "mm/h"})`);
    // High disease activity = recent DAS28 ≥ 5.1 etc — would need assessments. Skipping for now.
    if (raProfile?.ild) {
      factors.push("ILD già nota (monitoraggio attivo)");
    }

    if (factors.length >= 2 && !raProfile?.ild) {
      out.push({
        id: "ra-ild-screening",
        Icon: ShieldPlus,
        color: "text-blue-700",
        title: "Screening ILD raccomandato",
        summary: "Paziente con AR e ≥2 fattori di rischio per malattia interstiziale polmonare.",
        factors,
        action:
          "Considera HRCT torace ad alta risoluzione + spirometria con DLCO. " +
          "In presenza di pattern UIP/NSIP avvia counselling per terapia (es. nintedanib se PPF) " +
          "e modifica del piano terapeutico (preferire abatacept/rituximab; cautela MTX in ILD avanzata).",
        guidelineLink: "/linee-guida?q=CTD-ILD",
        guidelineLabel: "ERS/EULAR/ACR 2025 — CTD-ILD",
        evidence:
          "Fattori di rischio noti per AR-ILD: età avanzata, sesso maschile, fumo, FR/ACPA positivi, " +
          "elevati indici flogistici, alta attività di malattia (Kronzer V, Doyle T 2021; ERS/EULAR 2025).",
      });
    }
  }

  // ---- 2) Steroidi prolungati → osteoporosi ----
  const monthsOnSteroid = activeSteroidMonths(therapies);
  if (monthsOnSteroid >= 3) {
    const factors = [`Steroide attivo da ~${monthsOnSteroid} mesi (≥3)`];
    const age = ageOf(patient);
    if (age != null && age >= 65) factors.push(`Età ${age} anni (≥65)`);
    if (patient.sesso === "F" && age != null && age >= 50) factors.push("Donna in (probabile) post-menopausa");
    out.push({
      id: "gc-osteoporosis",
      Icon: Bone,
      color: "text-orange-700",
      title: "Profilassi osteoporosi corticosteroidi (GIOP)",
      summary: `Steroide assunto da ≥3 mesi: avviare valutazione e profilassi osteoporosi.`,
      factors,
      action:
        "Avvia: (1) DEXA femore + colonna; (2) calcio + vitamina D (≥800 UI/die); " +
        "(3) considera bisfosfonati orali o ac. zoledronico EV se rischio frattura ≥10%/10y o T-score ≤-1.5; " +
        "(4) denosumab in alternativa; (5) FRAX adattato GIOP. Valutare livelli 25-OH-vitD e funzione renale.",
      guidelineLink: "/linee-guida?q=osteoporosi+corticosteroidi",
      guidelineLabel: "ACR 2017 GIOP",
      evidence:
        "L'uso di prednisone ≥2.5 mg/die per ≥3 mesi aumenta il rischio fratturativo. " +
        "ACR 2017 raccomanda profilassi anti-osteoporotica in tutti i pazienti adulti su GC ≥3 mesi.",
    });
  }

  // ---- 3) PJP prophylaxis ----
  const pjpFactors = isHighRiskImmunosuppression(therapies);
  if (pjpFactors.length > 0) {
    out.push({
      id: "pjp-prophylaxis",
      Icon: ShieldPlus,
      color: "text-red-700",
      title: "Profilassi Pneumocystis jirovecii (PJP)",
      summary: "Regime immunosoppressivo ad alto rischio: considerare profilassi anti-PJP.",
      factors: pjpFactors,
      action:
        "Profilassi standard: cotrimoxazolo (Bactrim) 80/400 mg 1 cpr/die o 3 volte/sett. " +
        "Alternative se allergia: dapsone 100 mg/die (escludere G6PD), atovaquone 1500 mg/die, " +
        "pentamidina aerosol 300 mg/mese. Considera profilassi soprattutto se linfopenia CD4<200, " +
        "GC ≥20 mg/die per ≥4 settimane, ciclofosfamide o rituximab in induzione vasculitica.",
      guidelineLink: "/linee-guida?q=vasculite+ANCA",
      guidelineLabel: "ACR/VF 2021 AAV / EULAR 2024 ANCA",
      evidence:
        "Le linee guida ACR/VF 2021 e EULAR 2024 raccomandano profilassi PJP in pazienti con vasculiti " +
        "ANCA in induzione con ciclofosfamide o rituximab, e in tutti i regimi con GC ≥20 mg/die ≥4 settimane.",
    });
  }

  return out;
}
