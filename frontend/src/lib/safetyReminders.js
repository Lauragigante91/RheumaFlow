/**
 * safetyReminders.js
 * Comprehensive per-drug safety checklist for RheumaFlow.
 *
 * Each reminder:
 *   id        — unique string key (stable across sessions for localStorage dismiss)
 *   priority  — "high" | "routine"
 *   category  — drug class/section header shown in SafetyPanel
 *   label     — short checklist label (shown collapsed)
 *   detail    — full clinical guidance (shown expanded)
 *   trigger   — short note for what activated this reminder
 *
 * API:
 *   detectSafetyReminders(activeTherapies, patient) → Reminder[]
 *   detectDrugsInText(text)                         → {drug_name, status}[]
 *   REMINDER_STYLE_INTERACTION_IDS                  → Set<string>
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchesDrug(name, list) {
  const n = (name || "").toLowerCase();
  return list.some(d => n.includes(d.toLowerCase()));
}

// ── Drug lists ────────────────────────────────────────────────────────────────

const MTX         = ["Methotrexate"];
const LEF         = ["Leflunomide"];
const SSZ         = ["Sulfasalazina"];
const HCQ         = ["Idrossiclorochina"];
const AZA         = ["Azatioprina"];
const MMF         = ["Micofenolato Mofetil", "Micofenolato"];
const CYC         = ["Ciclofosfamide"];
const CNI         = ["Ciclosporina", "Tacrolimus"];
const STEROIDS    = ["Prednisone", "Metilprednisolone", "Deltacortene", "Medrol", "Deflazacort", "Betametasone", "Desametasone"];
const TNF_I       = ["Adalimumab", "Etanercept", "Infliximab", "Certolizumab pegol", "Golimumab"];
const RTX         = ["Rituximab"];
const ABA         = ["Abatacept"];
const IL6_I       = ["Tocilizumab", "Sarilumab"];
const IL17_I      = ["Secukinumab", "Ixekizumab", "Bimekizumab"];
const IL1223_I    = ["Ustekinumab", "Guselkumab", "Risankizumab"];
const BELI        = ["Belimumab"];
const ANIFROLU    = ["Anifrolumab"];
const JAKI        = ["Tofacitinib", "Baricitinib", "Upadacitinib", "Filgotinib"];
const APR         = ["Apremilast"];
const COL         = ["Colchicina"];
const ANA         = ["Anakinra"];
const CANA        = ["Canakinumab"];
// Aggiunte per safetyReminders ULT/APS/IVIg — le costanti qui sotto servono
// solo per leggibilità; le stringhe sono inserite direttamente nei blocchi.

const ALL_BIOLOGICS = [...TNF_I, ...RTX, ...ABA, ...IL6_I, ...IL17_I, ...IL1223_I,
  ...BELI, ...ANIFROLU, ...ANA, ...CANA];
const HEPATOTOXIC   = [...MTX, ...LEF, ...AZA, ...CYC, ...MMF];
const TERATOGENS    = [...MTX, ...LEF, ...MMF, ...CYC, "Talidomide"];
const IMMUNOSUPP_SIG = [...ALL_BIOLOGICS, ...JAKI, ...MTX, ...LEF, ...AZA, ...MMF, ...CYC, ...CNI];

// ── Per-drug reminder registry ────────────────────────────────────────────────
// Each entry: { drugs: string[], reminders: Reminder[] }

const REGISTRY = [

  // ── Methotrexate ───────────────────────────────────────────────────────────
  {
    drugs: MTX,
    reminders: [
      // A) Controindicato in gravidanza — sempre visibile, con testo da inserire
      {
        id: "mtx_pregnancy",
        priority: "high",
        category: "Methotrexate",
        label: "CONTROINDICATO IN GRAVIDANZA — Teratogeno",
        detail:
          "MTX è un teratogeno accertato (classe X). Controindicato in gravidanza e allattamento.\n" +
          "Escludere gravidanza in donne fertili prima di prescrivere.\n" +
          "Pianificazione gravidanza: sospendere MTX ≥3 mesi prima (uomini inclusi).",
        insertionText:
          "Farmaco controindicato in gravidanza in quanto teratogeno accertato; si raccomanda adeguata contraccezione durante il trattamento.",
        trigger: "MTX — teratogenicità",
      },
      // B) Evitare cotrimoxazolo — warning pratico, sempre visibile
      {
        id: "mtx_cotrim",
        priority: "high",
        category: "Methotrexate",
        label: "Evitare associazione con cotrimoxazolo / trimetoprim",
        detail:
          "Rischio di tossicità ematologica grave (pancitopenia).\n" +
          "Cotrimoxazolo e trimetoprim inibiscono la diidrofolato-reduttasi e competono con l'escrezione tubulare di MTX.\n" +
          "Se profilassi PJP necessaria: preferire dapsone, atovaquone o pentamidina inalatoria.",
        trigger: "MTX — interazione grave",
      },
      // C) Monitoraggio esami — con testo da inserire
      {
        id: "mtx_cbc_lft",
        priority: "routine",
        category: "Methotrexate",
        label: "Monitoraggio esami",
        detail:
          "Emocromo + AST/ALT + creatinina/eGFR.\n" +
          "Cadenza: mensile per i primi 3 mesi, poi ogni 3-4 mesi.\n" +
          "Se AST/ALT >2-3× ULN: ridurre dose o sospendere temporaneamente.",
        insertionText:
          "Si raccomanda monitoraggio mensile per 3 mesi, quindi ogni 3-4 mesi, di emocromo, funzionalità epatica e funzionalità renale.",
        trigger: "MTX",
      },
      // D) Cautela ILD — alert minore, graficamente meno evidente
      {
        id: "mtx_ild",
        priority: "low",
        category: "Methotrexate",
        label: "Cautela in ILD o sintomi respiratori nuovi",
        detail:
          "Valutare alternative terapeutiche in pazienti con ILD preesistente o sintomi respiratori nuovi (tosse, dispnea).",
        trigger: "MTX — ILD",
      },
    ],
  },

  // ── Leflunomide ────────────────────────────────────────────────────────────
  {
    drugs: LEF,
    reminders: [
      {
        id: "lef_cbc_lft_bp",
        priority: "routine",
        category: "Leflunomide",
        label: "Emocromo + AST/ALT + pressione arteriosa",
        detail:
          "Baseline: emocromo, ALT, creatinina, PA.\n" +
          "Follow-up LFT: mensile per i primi 6 mesi, poi ogni 6-8 settimane.\n" +
          "Emocromo: ogni 4-8 settimane (primissimi mesi), poi ogni 3 mesi.\n" +
          "Ipertensione si osserva nel 10% dei pazienti — monitorare PA periodicamente.",
        trigger: "Leflunomide",
      },
      {
        id: "lef_terato",
        priority: "high",
        category: "Leflunomide",
        label: "⚠ Teratogenicità — washout obbligatorio con colestiramina",
        detail:
          "Leflunomide e il suo metabolita attivo (teriflunomide) sono teratogeni.\n" +
          "Washout OBBLIGATORIO prima della gravidanza (o in caso di tossicità grave):\n" +
          "  → Colestiramina 8 g ×3/die per 11 giorni\n" +
          "  → Poi 2 dosaggi plasmatici a distanza di ≥14 giorni < 0.02 mg/L\n" +
          "Senza washout, il metabolita persiste per 1-2 anni.\n" +
          "Contraccezione efficace obbligatoria durante il trattamento.",
        trigger: "Leflunomide — teratogenicità",
      },
      {
        id: "lef_neuropathy",
        priority: "routine",
        category: "Leflunomide",
        label: "Neuropatia periferica / ipertensione / epatotossicità",
        detail:
          "Neuropatia periferica: relativamente rara ma documentata — segnalare intorpidimento o parestesie.\n" +
          "Epatotossicità: può essere grave; se ALT >3× ULN sospendere e valutare washout.\n" +
          "Ipertensione: più comune nelle prime settimane — controllare PA e adeguare eventuale terapia antiipertensiva.\n" +
          "Diarrea e calo ponderale: frequenti (20-30%); modulare con dose riduzione se necessario.",
        trigger: "Leflunomide",
      },
    ],
  },

  // ── Sulfasalazina ──────────────────────────────────────────────────────────
  {
    drugs: SSZ,
    reminders: [
      {
        id: "ssz_cbc_lft",
        priority: "routine",
        category: "Sulfasalazina",
        label: "Emocromo + AST/ALT — monitoraggio",
        detail:
          "Baseline: emocromo, AST/ALT.\n" +
          "Follow-up: emocromo + LFT mensile nei primi 3 mesi, poi ogni 3-6 mesi.\n" +
          "Attenzione a leucopenia, trombocitopenia, anemia emolitica.",
        trigger: "Sulfasalazina",
      },
      {
        id: "ssz_dress",
        priority: "high",
        category: "Sulfasalazina",
        label: "⚠ Rash / febbre / mucosite — possibile DRESS",
        detail:
          "La reazione da ipersensibilità (DRESS: Drug Reaction with Eosinophilia and Systemic Symptoms) è rara ma grave.\n" +
          "Sintomi: febbre, rash (spesso morbilliforme), linfoadenopatia, epatite, eosinofilia.\n" +
          "Insorgenza: tipicamente entro 2-8 settimane dall'inizio.\n" +
          "In caso di comparsa: sospendere SSZ immediatamente e inviare a urgenza.\n" +
          "Non ricominciare sulfasalazina dopo DRESS confermato.",
        trigger: "Sulfasalazina — DRESS",
      },
      {
        id: "ssz_allergy",
        priority: "high",
        category: "Sulfasalazina",
        label: "⚠ Allergia a sulfonamidi o salicilati — controindicazione",
        detail:
          "Sulfasalazina è metabolizzata in sulfapiridina (sulfonamide) e mesalazina (salicilato).\n" +
          "Controindicata in caso di allergia documentata a sulfonamidi o salicilati.\n" +
          "Verificare anamnesi farmacologica prima della prescrizione.",
        trigger: "Sulfasalazina — controindicazione",
      },
      {
        id: "ssz_g6pd",
        priority: "routine",
        category: "Sulfasalazina",
        label: "Deficit G6PD — rischio emolisi",
        detail:
          "Il deficit di G6PD predispone a emolisi in corso di sulfasalazina.\n" +
          "Considerare screening G6PD in popolazioni a rischio (Africa sub-sahariana, Mediterraneo, Medio Oriente, Asia).\n" +
          "In caso di G6PD noto: evitare SSZ o usare con monitoraggio emocromo ravvicinato.",
        trigger: "Sulfasalazina",
      },
      {
        id: "ssz_oligospermia",
        priority: "routine",
        category: "Sulfasalazina",
        label: "Oligospermia reversibile (uomini)",
        detail:
          "Sulfasalazina causa oligospermia e alterazioni della motilità spermatica nel 60-70% degli uomini trattati.\n" +
          "L'effetto è reversibile entro 3 mesi dalla sospensione.\n" +
          "In caso di pianificazione familiare maschile: valutare switch a idrossiclorochina o altro csDMARD.",
        trigger: "Sulfasalazina — fertilità maschile",
      },
    ],
  },

  // ── Idrossiclorochina ──────────────────────────────────────────────────────
  {
    drugs: HCQ,
    reminders: [
      {
        id: "hcq_dose_kgbw",
        priority: "high",
        category: "Idrossiclorochina",
        label: "⚠ Dose massima ≤5 mg/kg/die (peso corporeo reale)",
        detail:
          "Il rischio di retinopatia da idrossiclorochina è dose-dipendente e correlato al peso corporeo.\n" +
          "Dose massima raccomandata: 5 mg/kg/die (ACR/AAO guidelines 2016).\n" +
          "Evitare il calcolo sul peso ideale — usare il peso corporeo reale.\n" +
          "Dose abituale: 200-400 mg/die. Verificare che la dose prescritta non superi 5 mg/kg/die.",
        trigger: "HCQ — dosaggio",
      },
      {
        id: "hcq_eye",
        priority: "routine",
        category: "Idrossiclorochina",
        label: "Screening oculistico — baseline e follow-up annuale",
        detail:
          "Baseline: visita oculistica entro 1 anno dall'inizio (esame del campo visivo 10-2, SD-OCT maculare).\n" +
          "Follow-up: annuale dopo 5 anni di terapia (o prima se fattori di rischio).\n" +
          "Fattori di rischio per retinopatia precoce: dose >5 mg/kg/die, IRC, tamoxifene, maculopatia preesistente.\n" +
          "La retinopatia da HCQ è irreversibile ma la diagnosi precoce permette la sospensione prima del danno grave.",
        trigger: "HCQ — retinopatia",
      },
      {
        id: "hcq_qt",
        priority: "routine",
        category: "Idrossiclorochina",
        label: "QT lungo / interazioni — ECG se indicato",
        detail:
          "HCQ può prolungare il QT, specialmente in associazione con:\n" +
          "  • Antimalarici (combinazione con clorochina)\n" +
          "  • Antiaritmici (amiodarone, sotalolo)\n" +
          "  • Macrolidi, fluorochinoloni\n" +
          "  • Antipsicotici\n" +
          "ECG baseline raccomandato se fattori di rischio cardiovascolari o terapia concomitante pro-aritmia.",
        trigger: "HCQ",
      },
      {
        id: "hcq_miopathy",
        priority: "routine",
        category: "Idrossiclorochina",
        label: "Miopatia / cardiomiopatia (tossicità rara)",
        detail:
          "Miopatia vacuolare e cardiomiopatia da HCQ sono complicanze rare ma gravi, tipicamente dopo anni di terapia.\n" +
          "Segnali: debolezza muscolare prossimale, CK elevato, aritmie, blocco di conduzione.\n" +
          "In caso di sospetto: sospendere HCQ e inviare a cardiologo/neurologo per valutazione.",
        trigger: "HCQ",
      },
    ],
  },

  // ── Azatioprina ────────────────────────────────────────────────────────────
  {
    drugs: AZA,
    reminders: [
      {
        id: "aza_cbc_lft",
        priority: "routine",
        category: "Azatioprina",
        label: "Emocromo + AST/ALT — monitoraggio ravvicinato",
        detail:
          "Baseline: emocromo + LFT.\n" +
          "Follow-up: emocromo ogni 2-4 settimane per i primi 3 mesi, poi ogni 3 mesi.\n" +
          "LFT: ogni 4-8 settimane (primi 6 mesi), poi ogni 3 mesi.\n" +
          "Leucopenia e trombocitopenia possono essere gravi — sospendere se conta <3.000 WBC o <100.000 PLT.",
        trigger: "Azatioprina",
      },
      {
        id: "aza_tpmt",
        priority: "routine",
        category: "Azatioprina",
        label: "TPMT / NUDT15 — considerare genotipizzazione",
        detail:
          "La tiopurina metiltransferasi (TPMT) e NUDT15 metabolizzano la azatioprina.\n" +
          "Deficit omozigote TPMT (<0.3% popolazione): controindicazione assoluta (rischio pancitopenia grave).\n" +
          "Deficit eterozigote: ridurre la dose del 50%.\n" +
          "Se genotipizzazione non disponibile: iniziare a dose bassa con monitoraggio emocromo ravvicinato.",
        trigger: "Azatioprina",
      },
      {
        id: "aza_allopurinol",
        priority: "high",
        category: "Azatioprina",
        label: "⚠ Interazione GRAVE con allopurinolo / febuxostat",
        detail:
          "Allopurinolo e febuxostat inibiscono la xantina ossidasi, aumentando drasticamente i livelli di 6-tioguanina (metabolita tossico di AZA).\n" +
          "Rischio: pancitopenia grave, potenzialmente fatale.\n" +
          "Se la co-somministrazione è necessaria: ridurre AZA al 25% della dose standard e monitorare emocromo settimanalmente.\n" +
          "In alternativa: sostituire AZA con MMF o altro immunosoppressore.",
        trigger: "AZA — interazione grave allopurinolo",
      },
      {
        id: "aza_pancreatitis",
        priority: "routine",
        category: "Azatioprina",
        label: "Pancreatite — alert dolore addominale acuto",
        detail:
          "La pancreatite acuta è una complicanza rara ma nota di AZA (idiosincrasica, dose-indipendente).\n" +
          "Insorge tipicamente nelle prime settimane di trattamento.\n" +
          "In caso di dolore epigastrico/periombelicale acuto: sospendere AZA, dosare lipasi/amilasi.\n" +
          "Non ricominciare AZA dopo pancreatite confermata.",
        trigger: "Azatioprina",
      },
    ],
  },

  // ── Micofenolato ───────────────────────────────────────────────────────────
  {
    drugs: MMF,
    reminders: [
      {
        id: "mmf_cbc_lft_renal",
        priority: "routine",
        category: "Micofenolato",
        label: "Emocromo + AST/ALT + creatinina/eGFR",
        detail:
          "Baseline: emocromo, LFT, creatinina.\n" +
          "Follow-up: emocromo ogni 4-8 settimane (primi 3 mesi), poi ogni 3 mesi.\n" +
          "LFT: ogni 3 mesi.\n" +
          "Leucopenia grave (WBC <3.000): ridurre dose o sospendere.",
        trigger: "MMF",
      },
      {
        id: "mmf_git",
        priority: "routine",
        category: "Micofenolato",
        label: "Tossicità gastrointestinale — diarrea, nausea, crampi",
        detail:
          "La tossicità GI è dose-correlata e frequente (20-40%).\n" +
          "Strategie: assumere con cibo, frazionare la dose, ridurre temporaneamente.\n" +
          "Il micofenolato sodico (MPS, formulazione EC) può essere tollerato meglio rispetto all'MMF in caso di intolleranza GI.\n" +
          "In caso di diarrea grave: escludere CMV (soprattutto in trapiantati o forte immunosoppressione).",
        trigger: "MMF",
      },
      {
        id: "mmf_terato",
        priority: "high",
        category: "Micofenolato",
        label: "⚠ Teratogenicità — contraccezione doppia obbligatoria",
        detail:
          "MMF e MPS sono TERATOGENI (categoria FDA D/X): difetti cardiaci, labiopalatoschisi, arti, orecchie, microftalmia.\n" +
          "Due metodi contraccettivi efficaci obbligatori durante il trattamento e per 6 settimane dopo la sospensione.\n" +
          "Pianificazione gravidanza: sospendere MMF e passare ad azatioprina (compatibile con gravidanza) ≥3 mesi prima.\n" +
          "Consulenza reumatologica preconcezione obbligatoria.",
        trigger: "MMF — teratogenicità",
      },
    ],
  },

  // ── Ciclofosfamide ─────────────────────────────────────────────────────────
  {
    drugs: CYC,
    reminders: [
      {
        id: "cyc_cbc_urgent",
        priority: "high",
        category: "Ciclofosfamide",
        label: "⚠ Emocromo ravvicinato — nadir a 10-14 giorni",
        detail:
          "Il nadir leucocitario si verifica 10-14 giorni dopo la somministrazione.\n" +
          "Schema EV: emocromo al nadir (giorno 10-14) e prima di ogni ciclo.\n" +
          "Schema orale: emocromo + esame urine ogni 2-4 settimane.\n" +
          "Target: leucociti >3.000-3.500/mm³, neutrofili >1.500/mm³ prima del ciclo successivo.",
        trigger: "CYC",
      },
      {
        id: "cyc_bladder",
        priority: "high",
        category: "Ciclofosfamide",
        label: "⚠ Cistite emorragica — idratazione / MESNA",
        detail:
          "L'acroleina (metabolita di CYC) causa cistite emorragica e aumenta il rischio di neoplasie uroteliali.\n" +
          "CYC EV: mesna (dose: 60-100% della dose di CYC in tre somministrazioni) + abbondante idratazione.\n" +
          "CYC orale: abbondante apporto idrico (≥2L/die), assunzione mattutina.\n" +
          "Esame urine periodico: ematuria richiede valutazione urologica.\n" +
          "Ecografia vescicale ogni 2-3 anni in pazienti con esposizione cumulativa significativa.",
        trigger: "CYC — tossicità urologica",
      },
      {
        id: "cyc_infertility",
        priority: "high",
        category: "Ciclofosfamide",
        label: "Infertilità — counselling e criopreservazione",
        detail:
          "CYC può causare infertilità permanente, dosi-correlata.\n" +
          "Donne: amenorrea e insufficienza ovarica prematura (POI). Considerare GnRH analoghi per protezione ovarica durante CYC EV.\n" +
          "Uomini: oligospermia/azoospermia — crioconservazione sperma prima del trattamento.\n" +
          "Counselling obbligatorio sulla fertilità prima di iniziare CYC.",
        trigger: "CYC — infertilità",
      },
      {
        id: "cyc_pjp",
        priority: "routine",
        category: "Ciclofosfamide",
        label: "Profilassi PJP se associata a steroidi ad alte dosi",
        detail:
          "In pazienti che ricevono CYC + cortisonico equivalente >20 mg/die per >4 settimane:\n" +
          "Valutare profilassi anti-Pneumocystis jirovecii (PJP):\n" +
          "  → Prima scelta: TMP-SMX 480-960 mg ×3/settimana (ATTENZIONE: controindicato con MTX)\n" +
          "  → Alternativa: dapsone 100 mg/die, atovaquone 1500 mg/die o pentamidina inalatoria.\n" +
          "Particolarmente indicata in pazienti con linfociti <500/mm³.",
        trigger: "CYC + steroidi",
      },
      {
        id: "cyc_oncology",
        priority: "routine",
        category: "Ciclofosfamide",
        label: "Rischio neoplastico — sorveglianza a lungo termine",
        detail:
          "CYC aumenta il rischio di neoplasie uroteliali (dose-cumulativa) e neoplasie ematologiche.\n" +
          "Sorveglianza: esame urine annuale; se ematuria persistente: cistoscopia.\n" +
          "Evitare CYC a lungo termine: preferire regimi brevi (<6 cicli EV) e passaggio a farmaco meno citotossico.",
        trigger: "CYC — oncologia",
      },
    ],
  },

  // ── Inibitori della calcineurina (Ciclosporina / Tacrolimus) ───────────────
  {
    drugs: CNI,
    reminders: [
      {
        id: "cni_bp_renal",
        priority: "high",
        category: "Ciclosporina / Tacrolimus",
        label: "⚠ Pressione arteriosa + creatinina/eGFR — monitoraggio stretto",
        detail:
          "Nefrotossicità è dose-correlata e può essere cronica e irreversibile.\n" +
          "Monitorare: PA + creatinina ogni 2 settimane (primo mese), poi mensile.\n" +
          "Se creatinina aumenta >25% dal baseline: ridurre dose o sospendere.\n" +
          "Target PA: <130/80 mmHg. Preferire calcioantagonisti (amlodipina, nifedipina) come antiipertensivo.",
        trigger: "Ciclosporina/Tacrolimus",
      },
      {
        id: "cni_electrolytes",
        priority: "routine",
        category: "Ciclosporina / Tacrolimus",
        label: "Potassio / Magnesio / Livelli plasmatici",
        detail:
          "Iperkaliemia: riduzione escrezione renale di K+ — monitorare potassiemia.\n" +
          "Ipomagnesemia: frequente con tacrolimus — supplementare se <0.7 mmol/L.\n" +
          "Livelli plasmatici: trough (C0) per ciclosporina e tacrolimus — necessari per il range terapeutico.\n" +
          "Interazioni CYP3A4: numerose (azoli, macrolidi, diltiazem, verapamil, rifampicina, carbamazepina, erba di S. Giovanni).",
        trigger: "CNI",
      },
      {
        id: "cni_tremor_neuro",
        priority: "routine",
        category: "Ciclosporina / Tacrolimus",
        label: "Tremore / neurotossicità — più frequente con tacrolimus",
        detail:
          "Tremore fine, parestesie, cefalea, insonnia, raramente leucoencefalopatia posteriore reversibile (PRES).\n" +
          "Sintomi neurologici gravi con tacrolimus: considerare riduzione dose o switch a ciclosporina.\n" +
          "PRES: convulsioni, disturbi visivi, alterazione coscienza — emergenza neurologica.",
        trigger: "Tacrolimus/Ciclosporina — neurotossicità",
      },
    ],
  },

  // ── Glucocorticoidi ────────────────────────────────────────────────────────
  {
    drugs: STEROIDS,
    reminders: [
      {
        id: "gc_osteoporosis",
        priority: "high",
        category: "Glucocorticoidi",
        label: "⚠ Osteoporosi da steroidi — calcio, Vit.D, bisfosfonato",
        detail:
          "Se prednisone-equivalente >5 mg/die per >3 mesi: rischio osteoporosi significativo.\n" +
          "Raccomandazioni EULAR/ACR:\n" +
          "  • Calcio 1000-1200 mg/die + Vitamina D 800-1000 UI/die\n" +
          "  • Bisfosfonato orale (alendronato 70 mg/settimana) se rischio fratture elevato (FRAX >10% a 10 anni)\n" +
          "  • MOC/DXA baseline e ogni 1-2 anni durante terapia\n" +
          "In donne post-menopausali o uomini >50 anni con GC cronici: terapia anti-riassorbimento raccomandata.",
        trigger: "GC cronici",
      },
      {
        id: "gc_metabolic",
        priority: "routine",
        category: "Glucocorticoidi",
        label: "Glicemia / PA / peso — monitoraggio metabolico",
        detail:
          "Monitorare glicemia (a digiuno e 2h post-prandiale se diabete noto o dose ≥20 mg/die).\n" +
          "Iperglicemia steroidea: può richiedere adeguamento terapia antidiabetica o insulina.\n" +
          "Ipertensione: comune — monitorare PA e adeguare terapia antiipertensiva.\n" +
          "Peso: incremento ponderale, redistribuzione del grasso — counselling dieta e attività fisica.",
        trigger: "GC",
      },
      {
        id: "gc_eye",
        priority: "routine",
        category: "Glucocorticoidi",
        label: "Cataratta / glaucoma — visita oculistica se terapia prolungata",
        detail:
          "Terapia prolungata (>1 anno) con dosi >5 mg/die: aumentato rischio cataratta sottocapsulare posteriore e glaucoma.\n" +
          "Visita oculistica annuale raccomandata se terapia cronica.\n" +
          "Pazienti con familiarità per glaucoma: misurazione della pressione oculare periodica.",
        trigger: "GC cronici",
      },
      {
        id: "gc_taper",
        priority: "routine",
        category: "Glucocorticoidi",
        label: "Piano di tapering — no sospensione brusca",
        detail:
          "La sospensione brusca dopo terapia prolungata può causare insufficienza surrenalica.\n" +
          "Tapering graduale: riduzione del 10-20% della dose ogni 1-4 settimane (più lento a dosi basse <10 mg).\n" +
          "Se dose <5 mg/die per mesi/anni: test di stimolo con ACTH se si sospetta soppressione surrenalica.\n" +
          "Documentare il piano di tapering in cartella.",
        trigger: "GC",
      },
    ],
  },

  // ── Anti-TNF ───────────────────────────────────────────────────────────────
  {
    drugs: TNF_I,
    reminders: [
      {
        id: "tnf_tb",
        priority: "high",
        category: "Anti-TNF",
        label: "⚠ Screening TBC obbligatorio (Quantiferon/IGRA + RX torace)",
        detail:
          "Prima dell'inizio di qualsiasi anti-TNF: screening TBC latente obbligatorio.\n" +
          "  → Quantiferon-TB Gold o T-SPOT.TB (preferred su TST)\n" +
          "  → RX torace\n" +
          "Se IGRA positivo o RX suggestivo: profilassi con isoniazide 300 mg/die + piridossina per ≥1 mese PRIMA dell'anti-TNF, totale 6-9 mesi.\n" +
          "Gli anti-TNF aumentano il rischio di riattivazione TBC di 4-25×.",
        trigger: "Anti-TNF",
      },
      {
        id: "tnf_hbv",
        priority: "high",
        category: "Anti-TNF",
        label: "⚠ Screening HBV (HBsAg, anti-HBc, anti-HBs)",
        detail:
          "Rischio di riattivazione HBV con anti-TNF, particolarmente se HBsAg+ o anti-HBc+ (isolato).\n" +
          "Se HBsAg+: profilassi antivirale obbligatoria (tenofovir o entecavir) PRIMA dell'anti-TNF. Consulenza epatologica.\n" +
          "Se anti-HBc+ isolato: valutare profilassi antivirale o monitoraggio HBV-DNA trimestrale.\n" +
          "Se anti-HBs+ (vaccinato): monitoraggio HBV-DNA semestrale.",
        trigger: "Anti-TNF — HBV",
      },
      {
        id: "tnf_hf",
        priority: "high",
        category: "Anti-TNF",
        label: "⚠ Cautela in scompenso cardiaco (NYHA III-IV)",
        detail:
          "Anti-TNF controindicati in scompenso cardiaco NYHA classe III-IV.\n" +
          "In NYHA I-II: usare con cautela; evitare se FE <35%.\n" +
          "Infliximab ad alte dosi ha mostrato peggioramento dello scompenso in trial clinici.\n" +
          "Valutare abatacept o IL-6i come alternativa in pazienti con scompenso cardiaco.",
        trigger: "Anti-TNF — cardiopatia",
      },
      {
        id: "tnf_demyel",
        priority: "high",
        category: "Anti-TNF",
        label: "⚠ Controindicazione in demielinizzazione (SM, neurite ottica)",
        detail:
          "Gli anti-TNF possono indurre o esacerbare malattie demielinizzanti (sclerosi multipla, neurite ottica).\n" +
          "Controindicati in pazienti con SM o demielinizzazione documentata.\n" +
          "In caso di sintomi neurologici nuovi (disturbi visivi, parestesie, debolezza): sospendere e inviare a neurologo.",
        trigger: "Anti-TNF — neurotossicità",
      },
      {
        id: "tnf_lupus_psoriasis",
        priority: "routine",
        category: "Anti-TNF",
        label: "Lupus-like / psoriasi paradossa",
        detail:
          "Lupus indotto da anti-TNF: artralgie, rash, ANA+ (spesso anti-dsDNA–). Generalmente reversibile alla sospensione.\n" +
          "Psoriasi paradossa: insorge o si aggrava durante anti-TNF (specialmente ETN). Se lesioni gravi: valutare switch a IL-17i o IL-23i.",
        trigger: "Anti-TNF",
      },
    ],
  },

  // ── Rituximab ──────────────────────────────────────────────────────────────
  {
    drugs: RTX,
    reminders: [
      {
        id: "rtx_hbv_mandatory",
        priority: "high",
        category: "Rituximab",
        label: "⚠ Screening HBV COMPLETO obbligatorio — rischio riattivazione elevato",
        detail:
          "Il rischio di riattivazione HBV con rituximab è il più elevato tra i biologici (fino al 25% in anti-HBc+).\n" +
          "Screening obbligatorio: HBsAg, anti-HBc, anti-HBs, HBV-DNA.\n" +
          "Se HBsAg+ o anti-HBc+: profilassi antivirale OBBLIGATORIA con tenofovir o entecavir PRIMA della prima infusione.\n" +
          "Continuar profilassi per ≥12 mesi dopo l'ultimo ciclo di RTX. Consulenza epatologica.",
        trigger: "Rituximab — HBV (urgente)",
      },
      {
        id: "rtx_igg",
        priority: "routine",
        category: "Rituximab",
        label: "IgG baseline e monitoraggio (ipogammaglobulinemia)",
        detail:
          "RTX causa deplezione B-cellulare che può portare a ipogammaglobulinemia, specialmente dopo cicli multipli.\n" +
          "Dosare IgG baseline prima del primo ciclo e ogni 6 mesi (o prima di ogni ciclo).\n" +
          "Se IgG <3-4 g/L con infezioni ricorrenti: valutare IVIG sostitutiva. Consulenza immunologica.\n" +
          "IgM e IgA si riducono meno e si ripristinano prima.",
        trigger: "Rituximab",
      },
      {
        id: "rtx_vaccines",
        priority: "high",
        category: "Rituximab",
        label: "⚠ Vaccini PRIMA del trattamento — risposta annullata dopo RTX",
        detail:
          "La risposta vaccinale è nulla o quasi per ≥6-12 mesi dopo RTX (deplezione B-cellulare).\n" +
          "Tutti i vaccini indicati (influenza, pneumococco, COVID, herpes zoster) devono essere somministrati ≥4-6 settimane PRIMA del primo ciclo.\n" +
          "Vaccini vivi controindicati dopo RTX.\n" +
          "Influenza: somministrare durante finestra di ripopolazione B-cellulare (>6 mesi dopo RTX).",
        trigger: "Rituximab — vaccinazioni",
      },
      {
        id: "rtx_pml",
        priority: "routine",
        category: "Rituximab",
        label: "PML (leucoencefalopatia multifocale progressiva) — rare",
        detail:
          "PML da JC virus è una complicanza rara ma grave del RTX (segnalata soprattutto in LLC e AR con grave immunodepressione).\n" +
          "Sintomi: deterioramento cognitivo, disturbi del linguaggio, emiparesi, disturbi visivi.\n" +
          "In caso di sintomi neurologici nuovi: sospendere RTX e inviare a neurologo urgente per RMN + PCR JC virus su liquor.",
        trigger: "Rituximab — PML",
      },
    ],
  },

  // ── Abatacept ──────────────────────────────────────────────────────────────
  {
    drugs: ABA,
    reminders: [
      {
        id: "aba_infections",
        priority: "routine",
        category: "Abatacept",
        label: "Screening infezioni attive + cautela in COPD/bronchiectasie",
        detail:
          "Controindicato in infezione attiva grave — trattare e guarire prima dell'inizio.\n" +
          "COPD grave: aumentato rischio di infezioni respiratorie e riacutizzazioni — usare con cautela e monitorare.\n" +
          "Rispetto ad altri biologici: rischio infettivo relativamente basso.",
        trigger: "Abatacept",
      },
      {
        id: "aba_live_vaccines",
        priority: "high",
        category: "Abatacept",
        label: "⚠ Vaccini vivi controindicati",
        detail:
          "I vaccini vivi attenuati (varicella, MMR, febbre gialla, tifo orale, rotavirus) sono controindicati durante il trattamento con abatacept.\n" +
          "Completare lo schema vaccinale (incluso herpes zoster Shingrix) prima dell'inizio quando possibile.\n" +
          "Influenza (inattivato), pneumococco, COVID-19: indicati e raccomandati.",
        trigger: "Abatacept",
      },
    ],
  },

  // ── Anti-IL-6 (Tocilizumab / Sarilumab) ───────────────────────────────────
  {
    drugs: IL6_I,
    reminders: [
      {
        id: "il6_cbc_lft_lipids",
        priority: "routine",
        category: "Anti-IL-6",
        label: "Emocromo + piastrine + AST/ALT + lipidi — monitoraggio",
        detail:
          "Neutropenia: frequente (specie con TCZ). Se neutrofili <1.000/mm³: ridurre dose o sospendere.\n" +
          "Piastrine: trombocitopenia possibile.\n" +
          "LFT: monitorare mensilmente (prime 6 settimane), poi ogni 3 mesi. Se AST/ALT >3× ULN: sospendere.\n" +
          "Lipidi: IL-6i aumentano LDL e HDL — dosare baseline e a 4-8 settimane, poi ogni 6 mesi. Considerare statina se indicato.",
        trigger: "Anti-IL-6",
      },
      {
        id: "il6_diverticulitis",
        priority: "high",
        category: "Anti-IL-6",
        label: "⚠ Diverticolite / perforazione intestinale",
        detail:
          "Perforazione intestinale (spesso associata a diverticolite) è una complicanza rara ma grave di TCZ/SAR.\n" +
          "Rischio maggiore in pazienti con diverticolosi nota, terapia concomitante con FANS o cortisonici.\n" +
          "Dolore addominale acuto in corso di anti-IL-6: sospendere immediatamente e valutare urgente.\n" +
          "Informare il paziente di riferire qualsiasi dolore addominale intenso.",
        trigger: "Anti-IL-6 — GI",
      },
      {
        id: "il6_crp_fever",
        priority: "routine",
        category: "Anti-IL-6",
        label: "CRP e febbre attenuate — infezioni mascherate",
        detail:
          "Gli anti-IL-6 sopprimono la CRP e possono attenuare la risposta febbrile.\n" +
          "Questo può mascherare infezioni batteriche gravi o sepsi.\n" +
          "In pazienti con peggioramento clinico inspiegabile, anche in assenza di febbre o CRP elevata:\n" +
          "  → Colture, procalcitonina, valutazione infettivologica.\n" +
          "Informare il paziente: non aspettarsi necessariamente febbre in caso di infezione.",
        trigger: "Anti-IL-6",
      },
    ],
  },

  // ── Anti-IL-17 (Secukinumab, Ixekizumab, Bimekizumab) ────────────────────
  {
    drugs: IL17_I,
    reminders: [
      {
        id: "il17_ibd",
        priority: "high",
        category: "Anti-IL-17",
        label: "⚠ IBD nota o sospetta — CONTROINDICAZIONE RELATIVA",
        detail:
          "Gli anti-IL-17 possono indurre o peggiorare la malattia infiammatoria intestinale (Crohn, CU).\n" +
          "Controindicati in IBD attiva.\n" +
          "In caso di diarrea persistente, dolore addominale, rettorragia: sospendere e inviare a gastroenterologo.\n" +
          "In pazienti con anamnesi di IBD: preferire anti-IL-12/23 o anti-IL-23.",
        trigger: "Anti-IL-17 — IBD",
      },
      {
        id: "il17_candida",
        priority: "routine",
        category: "Anti-IL-17",
        label: "Candidosi mucocutanea — frequente con bimekizumab",
        detail:
          "IL-17 è fondamentale per la difesa contro Candida epiteliale.\n" +
          "Candidosi orale, vaginale o cutanea sono eventi avversi frequenti (specie con bimekizumab).\n" +
          "In caso di candidosi: trattamento locale/sistemico standard; generalmente non richiede sospensione del biologico.",
        trigger: "Anti-IL-17",
      },
      {
        id: "il17_live_vaccines",
        priority: "high",
        category: "Anti-IL-17",
        label: "⚠ Vaccini vivi controindicati",
        detail:
          "Vaccini vivi attenuati controindicati durante trattamento con anti-IL-17.\n" +
          "Completare vaccinazioni (inclusa Shingrix per HZ) prima dell'inizio quando possibile.",
        trigger: "Anti-IL-17",
      },
    ],
  },

  // ── Anti-IL-12/23 e anti-IL-23 ────────────────────────────────────────────
  {
    drugs: IL1223_I,
    reminders: [
      {
        id: "il1223_infections",
        priority: "routine",
        category: "Anti-IL-12/23 e Anti-IL-23",
        label: "Screening infezioni / TBC secondo pratica locale",
        detail:
          "Il rischio infettivo è generalmente basso rispetto ad altri biologici.\n" +
          "Screening pre-trattamento: TBC (IGRA/Quantiferon + RX torace), HBV secondo pratica istituzionale.\n" +
          "Stato vaccinale: aggiornare prima dell'inizio.\n" +
          "Vaccini vivi controindicati durante il trattamento.",
        trigger: "Anti-IL-12/23 / Anti-IL-23",
      },
    ],
  },

  // ── Belimumab ──────────────────────────────────────────────────────────────
  {
    drugs: BELI,
    reminders: [
      {
        id: "beli_depression",
        priority: "high",
        category: "Belimumab",
        label: "⚠ Depressione / ideazione suicidaria — monitoraggio psichiatrico",
        detail:
          "I trial clinici e la post-marketing hanno identificato un aumentato rischio di depressione e ideazione suicidaria con belimumab.\n" +
          "Valutare anamnesi psichiatrica prima della prescrizione.\n" +
          "Monitorare attivamente umore e stato psichico ad ogni visita.\n" +
          "Istruire il paziente (e familiari) a riferire immediatamente pensieri di autolesionismo o ideazione suicidaria.",
        trigger: "Belimumab — psichiatrico",
      },
      {
        id: "beli_infusion",
        priority: "routine",
        category: "Belimumab",
        label: "Reazioni infusionali / ipersensibilità",
        detail:
          "Premedicazione raccomandata prima dell'infusione EV (antistaminico ± paracetamolo ± cortisonico).\n" +
          "Monitorare il paziente durante e per 1 ora dopo l'infusione.\n" +
          "Reazioni acute: rallentare o interrompere l'infusione; disponibilità di adrenalina e attrezzatura rianimazione.",
        trigger: "Belimumab",
      },
    ],
  },

  // ── Anifrolumab ────────────────────────────────────────────────────────────
  {
    drugs: ANIFROLU,
    reminders: [
      {
        id: "anifrolu_vzv",
        priority: "high",
        category: "Anifrolumab",
        label: "⚠ Herpes Zoster — Shingrix pre-trattamento",
        detail:
          "Anifrolumab blocca il recettore dell'interferone di tipo I, aumentando significativamente il rischio di Herpes Zoster.\n" +
          "Vaccinazione con Shingrix (inattivato, 2 dosi) PRIMA dell'inizio del trattamento fortemente raccomandata.\n" +
          "Monitorare comparsa di rash doloroso (zoster) durante il trattamento.",
        trigger: "Anifrolumab — VZV",
      },
      {
        id: "anifrolu_resp",
        priority: "routine",
        category: "Anifrolumab",
        label: "Infezioni respiratorie — monitoraggio",
        detail:
          "Aumentata incidenza di infezioni respiratorie superiori e inferiori nei trial clinici.\n" +
          "Vaccino antiinfluenzale annuale e antipneumococcico raccomandati.\n" +
          "In caso di infezione respiratoria moderata-grave: considerare pausa terapeutica.",
        trigger: "Anifrolumab",
      },
    ],
  },

  // ── JAK-inibitori ──────────────────────────────────────────────────────────
  {
    drugs: JAKI,
    reminders: [
      {
        id: "jaki_tb_screening",
        priority: "high",
        category: "JAK-inibitori",
        label: "⚠ Screening TBC (IGRA + RX torace) obbligatorio",
        detail:
          "Il rischio di TBC con JAKi è intermedio tra csDMARD e biologici anti-TNF.\n" +
          "Quantiferon-TB Gold o T-SPOT prima dell'inizio.\n" +
          "Se IGRA positivo: profilassi isoniazide come per i biologici.",
        trigger: "JAKi",
      },
      {
        id: "jaki_hbv_hcv",
        priority: "high",
        category: "JAK-inibitori",
        label: "⚠ Screening HBV/HCV — rischio riattivazione",
        detail:
          "Rischio di riattivazione HBV con JAKi: simile agli anti-TNF.\n" +
          "Screening: HBsAg, anti-HBc, anti-HBs, HBV-DNA (+ anti-HCV).\n" +
          "Se HBsAg+ o anti-HBc+: profilassi antivirale prima dell'inizio.",
        trigger: "JAKi",
      },
      {
        id: "jaki_cbc_lft_lipids",
        priority: "routine",
        category: "JAK-inibitori",
        label: "Emocromo + AST/ALT + lipidi — monitoraggio",
        detail:
          "Emocromo: ogni 4-8 settimane (prime 12 settimane), poi ogni 3 mesi.\n" +
          "Se neutrofili <1.000/mm³, Hb <8 g/dL o PLT <50.000/mm³: sospendere.\n" +
          "LFT: ogni 3 mesi.\n" +
          "Lipidi: dosare baseline e a 8-12 settimane (JAKi aumentano LDL e HDL); considerare statina se target non raggiunti.",
        trigger: "JAKi",
      },
      {
        id: "jaki_vzv",
        priority: "high",
        category: "JAK-inibitori",
        label: "⚠ Herpes Zoster — Shingrix raccomandata",
        detail:
          "I JAKi aumentano il rischio di Herpes Zoster di 2-3× (soprattutto tofacitinib, upadacitinib).\n" +
          "Shingrix (vaccino inattivato, 2 dosi a distanza 2-6 mesi) raccomandata:\n" +
          "  → Prima dell'inizio del JAKi se possibile\n" +
          "  → Anche durante la terapia (vaccino inattivato: sicuro)\n" +
          "Non somministrare vaccino zoster vivo (Zostavax) durante JAKi.",
        trigger: "JAKi — VZV",
      },
      {
        id: "jaki_cv_risk",
        priority: "high",
        category: "JAK-inibitori",
        label: "⚠ Rischio CV / trombotico / neoplastico (ORAL Surveillance)",
        detail:
          "Dati ORAL Surveillance (tofacitinib vs TNFi in AR ad alto rischio CV):\n" +
          "Aumentato rischio di MACE (infarto, ictus), TEV (TVP, EP) e neoplasie in pazienti:\n" +
          "  → Età ≥65 anni\n" +
          "  → Fumatori attuali o ex-fumatori\n" +
          "  → Pregresso evento cardiovascolare o fattori di rischio CV multipli\n" +
          "  → Pregressa TVP/EP o neoplasia\n" +
          "EMA/FDA: avvertenza per l'intera classe JAKi. Valutare il profilo di rischio individuale prima della prescrizione.\n" +
          "In pazienti ad alto rischio: preferire biologico (TNFi, IL-6i, anti-IL-17) se possibile.",
        trigger: "JAKi — rischio CV/neoplastico",
      },
    ],
  },

  // ── Apremilast ─────────────────────────────────────────────────────────────
  {
    drugs: APR,
    reminders: [
      {
        id: "apr_git",
        priority: "routine",
        category: "Apremilast",
        label: "Diarrea / nausea / calo ponderale — dose titolazione",
        detail:
          "Gli effetti GI sono frequenti (30-40%) nelle prime settimane — spesso migliorano con il tempo.\n" +
          "Schema di titolazione: iniziare a 10 mg/die con incrementi graduali per 5 giorni fino a 30 mg ×2/die.\n" +
          "Monitorare peso: perdita ponderale >5% può richiedere adeguamento terapia.\n" +
          "In IRC severa (eGFR <30): dimezzare la dose (30 mg/die invece di 30 mg ×2/die).",
        trigger: "Apremilast",
      },
      {
        id: "apr_depression",
        priority: "high",
        category: "Apremilast",
        label: "⚠ Depressione / ideazione suicidaria",
        detail:
          "Casi di depressione, umore depresso e ideazione suicidaria riportati con apremilast (SmPC).\n" +
          "Valutare anamnesi psichiatrica prima della prescrizione.\n" +
          "Evitare o usare con estrema cautela in pazienti con storia di depressione/ideazione suicidaria.\n" +
          "Istruire il paziente e familiari a segnalare umore depresso, pensieri di autolesionismo.",
        trigger: "Apremilast — psichiatrico",
      },
    ],
  },

  // ── Colchicina ─────────────────────────────────────────────────────────────
  {
    drugs: COL,
    reminders: [
      {
        id: "col_renal",
        priority: "high",
        category: "Colchicina",
        label: "⚠ Ridurre dose in insufficienza renale / epatica",
        detail:
          "In IRC grave (eGFR <30 ml/min): dose max 0.5 mg/die (riduzione obbligatoria).\n" +
          "In dialisi: controindicazione relativa — evitare se possibile.\n" +
          "In insufficienza epatica moderata-grave: ridurre dose.\n" +
          "ATTENZIONE: la tossicità da colchicina può essere grave o letale in IRC.",
        trigger: "Colchicina — IRC",
      },
      {
        id: "col_interactions",
        priority: "high",
        category: "Colchicina",
        label: "⚠ Interazioni gravi: macrolidi / azoli / ciclosporina / verapamil / statine",
        detail:
          "Colchicina è substrato di CYP3A4 e P-gp. Le seguenti associazioni aumentano marcatamente i livelli plasmatici:\n" +
          "  • Macrolidi (claritromicina, azitromicina): GRAVE — ridurre dose o evitare\n" +
          "  • Azoli antifungini (itraconazolo, ketoconazolo): ridurre dose\n" +
          "  • Ciclosporina: aumenta esposizione ×2-3 — ridurre colchicina al 50%\n" +
          "  • Verapamil, diltiazem: aumentano i livelli — cautela\n" +
          "  • Statine (simvastatina, atorvastatina): rischio miopatia/rabdomiolisi aumentato\n" +
          "In caso di combinazione necessaria: dose ridotta + monitoraggio CK se mialgie.",
        trigger: "Colchicina — interazioni CYP3A4/P-gp",
      },
      {
        id: "col_cbc_renal_cbc",
        priority: "routine",
        category: "Colchicina",
        label: "Emocromo + funzione renale/epatica + CK se mialgie",
        detail:
          "Monitorare emocromo (citopenie in IRC o sovradosaggio), creatinina/eGFR, LFT periodicamente.\n" +
          "CK: dosare in caso di mialgie, debolezza muscolare o crampi (miopatia da colchicina).\n" +
          "Tossicità neuromuscolare: debolezza prossimale, CK elevato — sospendere colchicina.",
        trigger: "Colchicina",
      },
    ],
  },

  // ── Anakinra / Canakinumab / Rilonacept ────────────────────────────────────
  {
    drugs: [...ANA, ...CANA, "Rilonacept"],
    reminders: [
      {
        id: "il1i_infections",
        priority: "routine",
        category: "Anti-IL-1",
        label: "Infezioni attive — screening e monitoraggio",
        detail:
          "Anti-IL-1 controindicati in infezione attiva grave.\n" +
          "Anakinra: rischio di infezioni serie (comprese polmoniti) — monitorare emocromo e clinica.\n" +
          "Canakinumab: clearance delle infezioni prima del trattamento; aggiornare vaccinazioni.\n" +
          "Vaccini vivi controindicati.",
        trigger: "Anti-IL-1",
      },
    ],
  },

  // ── Allopurinolo ────────────────────────────────────────────────────────────
  {
    drugs: ["Allopurinolo"],
    reminders: [
      {
        id: "allopurinol_hla",
        priority: "high",
        category: "Allopurinolo",
        label: "⚠ Screening HLA-B*5801 prima di avviare (pazienti asiatici e specifiche popolazioni)",
        detail:
          "HLA-B*5801 predispone a sindrome di Stevens-Johnson / DRESS grave da allopurinolo.\n" +
          "Screening obbligatorio prima dell'avvio in:\n" +
          "  • Pazienti di origine Han-cinese, tailandese, coreana, vietnamita\n" +
          "  • Pazienti con IRC (clearance renale ridotta → accumulo oxypurinol)\n" +
          "Se HLA-B*5801 positivo: controindicato — usare febuxostat.\n" +
          "Iniziare sempre a dose bassa (100 mg/die, 50 mg/die in IRC) e titolare lentamente.",
        trigger: "Allopurinolo — HLA-B*5801",
      },
      {
        id: "allopurinol_monitoring",
        priority: "routine",
        category: "Allopurinolo",
        label: "Monitoraggio: uricemia + creatinina + LFT",
        detail:
          "Uricemia ogni 4-6 settimane durante la titolazione, poi ogni 6 mesi a regime.\n" +
          "Target: <6 mg/dL (standard) o <5 mg/dL (in presenza di tofi).\n" +
          "Creatinina/eGFR: dose allopurinolo correlata alla funzione renale.\n" +
          "  eGFR 30-59: massimo 200 mg/die; eGFR 15-29: massimo 100 mg/die.\n" +
          "Transaminasi basali e a 3 mesi.",
        trigger: "Allopurinolo",
      },
    ],
  },

  // ── Febuxostat ─────────────────────────────────────────────────────────────
  {
    drugs: ["Febuxostat"],
    reminders: [
      {
        id: "febuxostat_cv_warning",
        priority: "high",
        category: "Febuxostat",
        label: "⚠ Warning FDA/EMA: aumentato rischio cardiovascolare in pazienti con CVD",
        detail:
          "Studio CARES (2018): febuxostat associato ad aumento della mortalità cardiovascolare\n" +
          "rispetto ad allopurinolo in pazienti con storia di malattia cardiovascolare.\n" +
          "EMA (2019): febuxostat controindicato in pazienti con cardiopatia ischemica o\n" +
          "scompenso cardiaco congestizia. Preferire allopurinolo in questi pazienti.\n" +
          "Se febuxostat è necessario in paziente CV: informare il paziente e monitorare.",
        trigger: "Febuxostat — warning CV",
      },
      {
        id: "febuxostat_flare_prophylaxis",
        priority: "routine",
        category: "Febuxostat",
        label: "Profilassi flare all'avvio della terapia ipouricemizzante",
        detail:
          "Mobilizzazione dei cristalli MSU → rischio di flare acuti nelle prime settimane-mesi.\n" +
          "Profilassi raccomandata per 3-6 mesi: colchicina 0.5 mg x 1-2/die (prima scelta).\n" +
          "Alternativa: FANS a bassa dose o GC orali (se colchicina controindicata).\n" +
          "Non sospendere febuxostat durante il flare acuto: mantenere la terapia.",
        trigger: "Febuxostat — profilassi flare",
      },
    ],
  },

  // ── Pegloticase ─────────────────────────────────────────────────────────────
  {
    drugs: ["Pegloticase"],
    reminders: [
      {
        id: "pegloticase_g6pd",
        priority: "high",
        category: "Pegloticase",
        label: "⚠ Controindicazione assoluta: deficit di G6PD",
        detail:
          "Pegloticase converte urato in allantoina tramite H2O2 come intermedio.\n" +
          "In deficit di G6PD → accumulo H2O2 → emolisi grave e metaemoglobinemia.\n" +
          "Screening G6PD obbligatorio PRIMA dell'avvio. Se deficit: controindicato.",
        trigger: "Pegloticase — G6PD",
      },
      {
        id: "pegloticase_infusion_reaction",
        priority: "high",
        category: "Pegloticase",
        label: "⚠ Rischio reazione da infusione (anafilassi) — premedica e monitorizza",
        detail:
          "Incidenza reazioni infusionali ~26%. Rischio anafilassi: ~6%.\n" +
          "Premedica obbligatorio (30-60 min prima):\n" +
          "  • Antistaminico (difenidramina 50 mg IV)\n" +
          "  • Paracetamolo 1g\n" +
          "  • GC (idrocortisone 200 mg IV o equivalente)\n" +
          "Infusione in ambiente ospedaliero con accesso a rianimazione. Non somministrare a domicilio.\n" +
          "Monitorare uricemia prima di ogni infusione: se uricemia >6 mg/dL → stop (anticorpi anti-PEG).",
        trigger: "Pegloticase — infusion reaction",
      },
    ],
  },

  // ── Warfarin / Acenocumarolo (VKA) ────────────────────────────────────────
  {
    drugs: ["Warfarin", "Acenocumarolo"],
    reminders: [
      {
        id: "vka_inr_monitoring",
        priority: "routine",
        category: "Anticoagulante VKA",
        label: "Monitoraggio INR e interazioni farmacologiche",
        detail:
          "INR target standard APS: 2.0–3.0 (trombosi venosa); 2.5–3.5 (arteriosa o recidiva).\n" +
          "INR da misurare: ogni settimana nelle prime 4 settimane, poi ogni 4-6 settimane a regime.\n" +
          "Interazioni farmacologiche RILEVANTI con i farmaci reumatologici:\n" +
          "  • Allopurinolo → possibile aumento INR (CYP2C9)\n" +
          "  • Glucocorticoidi → effetto variabile sull'INR, generalmente aumenta\n" +
          "  • Idrossiclorochina → lieve effetto anticoagulante additivo\n" +
          "  • Cotrimoxazolo (profilassi PJP) → aumento NETTO INR — ridurre VKA ~25-50%\n" +
          "  • Fluconazolo → forte inibizione CYP2C9 → aumento INR\n" +
          "  • MTX → modesta inibizione; monitorare INR all'inizio\n" +
          "Acenocumarolo: emivita più corta di warfarin (8h vs 36h) → INR più labile; monitorare più frequentemente.",
        trigger: "VKA — monitoring",
      },
      {
        id: "vka_doac_aps",
        priority: "high",
        category: "Anticoagulante VKA",
        label: "⚠ DOAC non raccomandati in APS con LAC positivo o tripla positività",
        detail:
          "Studio TRAPS (2019): rivaroxaban inferiore a warfarin in APS ad alto rischio.\n" +
          "Linee guida EULAR 2019: i VKA (warfarin/acenocumarolo) rimangono il gold standard\n" +
          "per trombosi arteriosa e per pazienti con LAC positivo o profilo ad alto rischio.\n" +
          "DOAC (apixaban, rivaroxaban) possono essere considerati solo in:\n" +
          "  • APS a basso rischio (singolo anticorpo positivo, trombosi venosa isolata)\n" +
          "  • Pazienti con difficoltà a mantenere INR in range con VKA\n" +
          "MAI usare DOAC in tripla positività anticorpale.",
        trigger: "VKA — DOAC in APS",
      },
    ],
  },

  // ── IVIg (Immunoglobuline endovena) ────────────────────────────────────────
  {
    drugs: ["IVIg"],
    reminders: [
      {
        id: "ivig_thrombosis",
        priority: "high",
        category: "IVIg",
        label: "⚠ Rischio tromboembolico — stratificare prima dell'infusione",
        detail:
          "IVIg può aumentare la viscosità ematica e il rischio di TEV (TVP, EP, stroke).\n" +
          "Fattori di rischio: età >65 anni, storia di TEV, obesità, immobilità, ipercoagulabilità.\n" +
          "In pazienti APS o ad alto rischio trombotico:\n" +
          "  • Velocità di infusione lenta (non superare 0.08 mL/kg/min)\n" +
          "  • Considerare idratazione pre-infusione\n" +
          "  • Evitare se possibile nei 3 mesi post-TEV acuto.",
        trigger: "IVIg — TEV",
      },
      {
        id: "ivig_renal",
        priority: "routine",
        category: "IVIg",
        label: "Monitoraggio renale — prodotti sucrosio-free in IRC",
        detail:
          "Insufficienza renale acuta possibile, soprattutto con prodotti contenenti sucrosio.\n" +
          "Preferire formulazioni sucrosio-free (sorbitolo o glicina) in pazienti con IRC.\n" +
          "Misurare creatinina prima e 48h dopo la prima infusione.\n" +
          "Emolisi: monitorare emocromo 48-72h dopo l'infusione (specie in pazienti gruppo non-O).",
        trigger: "IVIg — renal",
      },
    ],
  },
];

// ── MTX renal impairment check ────────────────────────────────────────────────

function hasRenalImpairment(patient) {
  const comorbList = [
    ...(Array.isArray(patient?.comorbidita) ? patient.comorbidita : []),
    ...(Array.isArray(patient?.comorbidities) ? patient.comorbidities : []),
  ];
  const IRC_KW = ["irc", "ckd", "insufficienza renale", "nefropatia", "dialisi", "emodialisi"];
  return comorbList.some(c => {
    const label = (typeof c === "string" ? c : c.item || c.label || c.nome || "").toLowerCase();
    return IRC_KW.some(kw => label.includes(kw));
  });
}

// ── Common immunosuppression reminders (class-level) ─────────────────────────

function commonImmunosuppression(drugNames, patient) {
  const out = [];

  const isBioOrJaki = drugNames.some(n =>
    matchesDrug(n, ALL_BIOLOGICS) || matchesDrug(n, JAKI)
  );
  const isSignificantIS = drugNames.some(n => matchesDrug(n, IMMUNOSUPP_SIG));

  if (isBioOrJaki) {
    out.push({
      id: "common_hcv_hiv_screen",
      priority: "routine",
      category: "Screening pre-immunosoppressione",
      label: "Screening HCV (anti-HCV ± HCV-RNA) e HIV (Ag/Ab HIV 1-2)",
      detail:
        "HCV: in caso di RNA+, valutare eradicazione con DAA prima dell'immunosoppressione.\n" +
        "HIV: raccomandato prima di qualsiasi biologico. Se HIV+: coordinare con infettivologo per HAART ottimale.\n" +
        "Biologici e JAKi possono aumentare la replicazione virale.",
      trigger: "Biologico/JAKi",
    });

    out.push({
      id: "common_vaccination_review",
      priority: "routine",
      category: "Screening pre-immunosoppressione",
      label: "Revisione stato vaccinale completo prima dell'inizio",
      detail:
        "Aggiornare le vaccinazioni PRIMA dell'inizio del biologico/JAKi (idealmente ≥4 settimane prima):\n" +
        "  • Influenza: annuale (inattivato)\n" +
        "  • Pneumococco: PCV20 o PCV13 + PPV23\n" +
        "  • COVID-19: schema completo + booster\n" +
        "  • Herpes Zoster: Shingrix ×2 dosi (raccomandata con JAKi e anti-IL-17; preferibile prima di RTX)\n" +
        "  • Hepatite B: se anti-HBs negativo\n" +
        "Vaccini vivi controindicati durante biologici e JAKi.",
      trigger: "Biologico/JAKi — vaccini",
    });
  }

  if (isSignificantIS) {
    const age = patient?.anno_nascita
      ? new Date().getFullYear() - parseInt(patient.anno_nascita)
      : null;
    const isFertileF = patient?.sesso === "F" && (age === null || age < 52);
    const teratogenDrugs = drugNames.filter(n => matchesDrug(n, TERATOGENS));

    if (isFertileF && teratogenDrugs.length > 0) {
      out.push({
        id: "common_contraception",
        priority: "high",
        category: "Sicurezza riproduttiva",
        label: "⚠ Contraccezione efficace — farmaco teratogeno attivo",
        detail:
          `Farmaci teratogeni in terapia: ${teratogenDrugs.join(", ")}.\n` +
          "Documentare counselling sulla contraccezione e pianificazione familiare.\n" +
          "Due metodi contraccettivi efficaci raccomandati (MMF, CYC, talidomide).\n" +
          "Per washout e pianificazione gravidanza: consultare schede specifiche dei singoli farmaci.",
        trigger: "Donna fertile + teratogeno",
      });
    }
  }

  return out;
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Detect safety reminders for a given set of active therapies.
 * @param {Array<{drug_name: string, status?: string}>} activeTherapies
 * @param {Object} patient — { sesso, anno_nascita, ... }
 * @returns {Reminder[]}
 */
export function detectSafetyReminders(activeTherapies, patient) {
  const out = [];
  const seen = new Set();
  const drugNames = activeTherapies.map(t => t.drug_name || "");

  // Per-drug registry
  for (const entry of REGISTRY) {
    const triggered = entry.drugs.some(d => drugNames.some(n => matchesDrug(n, [d])));
    if (!triggered) continue;
    for (const r of entry.reminders) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        out.push(r);
      }
    }
  }

  // Common class-level reminders
  for (const r of commonImmunosuppression(drugNames, patient || {})) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      out.push(r);
    }
  }

  // Conditional MTX renal reminder — only if patient has IRC in comorbidities
  if (drugNames.some(n => matchesDrug(n, MTX)) && hasRenalImpairment(patient || {})) {
    const r = {
      id: "mtx_renal",
      priority: "high",
      category: "Methotrexate",
      label: "Attenzione — Insufficienza renale",
      detail:
        "Valutare dose o evitare MTX in base alla funzione renale e al rischio di tossicità.\n" +
        "In IRC moderata-grave (eGFR <30 ml/min): evitare o usare con estrema cautela.",
      trigger: "MTX + IRC",
    };
    if (!seen.has(r.id)) { seen.add(r.id); out.push(r); }
  }

  // Sort: high → routine → low
  const PRIO_ORDER = { high: 0, routine: 1, low: 2 };
  return out.sort((a, b) => {
    const pa = PRIO_ORDER[a.priority] ?? 1;
    const pb = PRIO_ORDER[b.priority] ?? 1;
    return pa - pb;
  });
}

// ── IDs of reminder-style entries in drugInteractions.js ─────────────────────
// These overlap with SafetyPanel and should NOT be shown in the interactions list.
export const REMINDER_STYLE_INTERACTION_IDS = new Set([
  "jaki_live_vaccines",
  "biologic_live_vaccine",
  "biologic_tb_screening",
  "gc_live_vaccines",
  "rituximab_live",
  "anifrolumab_live",
]);

// ── Text-based drug detection ─────────────────────────────────────────────────

const ALL_MONITORED_DRUGS = [
  ...MTX, ...LEF, ...SSZ, ...HCQ, ...AZA, ...MMF, ...CYC, ...CNI,
  ...STEROIDS, ...ALL_BIOLOGICS, ...JAKI, ...APR, ...COL,
  "Anakinra", "Canakinumab",
];

/**
 * Parse free text and return a simulated therapy list for detectSafetyReminders().
 * @param {string} text
 * @returns {Array<{drug_name: string, status: string}>}
 */
export function detectDrugsInText(text) {
  if (!text?.trim()) return [];
  const lower = text.toLowerCase();
  const seen  = new Set();
  const out   = [];
  for (const drug of ALL_MONITORED_DRUGS) {
    if (!seen.has(drug) && lower.includes(drug.toLowerCase())) {
      seen.add(drug);
      out.push({ drug_name: drug, status: "active" });
    }
  }
  return out;
}
