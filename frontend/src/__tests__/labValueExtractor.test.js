/**
 * Test suite — labValueExtractor.js
 *
 * Copre:
 *   - Marcatori di flogosi (CRP/PCR, VES/ESR, ferritina, LDH, aldolasi)
 *   - Emocromo (Hb, WBC/GB, neutrofili, linfociti, PLT)
 *   - Complemento (C3, C4)
 *   - Funzione epatica (ALT/GPT, AST/GOT, GGT, ALP, bilirubina, CPK, albumina)
 *   - Funzione renale (creatinina, eGFR, proteinuria, UPCR)
 *   - Metabolismo (vitamina D, calcemia, fosforemia, PTH, TSH, uricemia)
 *   - Pattern slash-group (GOT/GPT/GGT 21/25/21)
 *   - Risultati qualitativi (nn, nella norma, neg)
 *   - Normalizzazione unità (mg/dL → mg/L per CRP)
 *   - Inference status (high / low / normal)
 *   - Intervallo di riferimento inline (v.n. X-Y)
 */

import { extractLabValues, extractLabValuesByDate, detectReportDate } from "../lib/labValueExtractor";

// helper
function findLab(results, key) {
  return results.find((r) => r.key === key) || null;
}

// ─── Flogosi ──────────────────────────────────────────────────────────────────
describe("Marcatori di flogosi", () => {
  test("PCR in mg/L", () => {
    const r = findLab(extractLabValues("PCR 18 mg/L"), "crp");
    expect(r?.value).toBe(18);
    expect(r?.status).toBe("high");
  });

  test("CRP in mg/dL normalizzato a mg/L", () => {
    const r = findLab(extractLabValues("CRP 1.8 mg/dL"), "crp");
    expect(r?.normalizedValue).toBe(18);
    expect(r?.normalizedUnit).toBe("mg/L");
    expect(r?.status).toBe("high");
  });

  test("VES 32 mm/h — alta", () => {
    const r = findLab(extractLabValues("VES 32 mm/h"), "ves");
    expect(r?.value).toBe(32);
    expect(r?.status).toBe("high");
  });

  test("ESR 12 mm/h — normale", () => {
    const r = findLab(extractLabValues("ESR 12 mm/h"), "ves");
    expect(r?.status).toBe("normal");
  });

  test("Ferritina", () => {
    const r = findLab(extractLabValues("Ferritina 250 ng/mL"), "ferritin");
    expect(r?.value).toBe(250);
  });

  test("LDH elevato", () => {
    const r = findLab(extractLabValues("LDH 320 U/L"), "ldh");
    expect(r?.status).toBe("high");
  });

  test("Aldolasi", () => {
    const r = findLab(extractLabValues("Aldolasi 5.2 U/L"), "aldolase");
    expect(r?.value).toBe(5.2);
    expect(r?.status).toBe("normal");
  });
});

// ─── Emocromo ─────────────────────────────────────────────────────────────────
describe("Emocromo", () => {
  test("Hb normale", () => {
    const r = findLab(extractLabValues("Hb 13.5 g/dL"), "hb");
    expect(r?.value).toBe(13.5);
    expect(r?.status).toBe("normal");
  });

  test("Hb bassa", () => {
    const r = findLab(extractLabValues("Emoglobina 10.2 g/dL"), "hb");
    expect(r?.status).toBe("low");
  });

  test("GB / WBC", () => {
    const r = findLab(extractLabValues("GB 5.8 K/μL"), "wbc");
    expect(r?.value).toBe(5.8);
  });

  test("Leucociti alta denominazione", () => {
    const r = findLab(extractLabValues("Leucociti 12.4 K/μL"), "wbc");
    expect(r?.status).toBe("high");
  });

  test("Neutrofili", () => {
    const r = findLab(extractLabValues("Neutrofili 2.4 K/μL"), "neutrophils");
    expect(r?.value).toBe(2.4);
  });

  test("PLT normale", () => {
    const r = findLab(extractLabValues("PLT 210 K/μL"), "plt");
    expect(r?.status).toBe("normal");
  });

  test("Piastrine basse", () => {
    const r = findLab(extractLabValues("Piastrine 98 K/μL"), "plt");
    expect(r?.status).toBe("low");
  });
});

// ─── Complemento ─────────────────────────────────────────────────────────────
describe("Complemento", () => {
  test("Complemento C3", () => {
    const r = findLab(extractLabValues("Complemento C3 85 mg/dL"), "c3");
    expect(r?.value).toBe(85);
    expect(r?.status).toBe("low");
  });

  test("C4 normale", () => {
    const r = findLab(extractLabValues("C4 complemento 22 mg/dL"), "c4");
    expect(r?.status).toBe("normal");
  });
});

// ─── Funzione epatica ─────────────────────────────────────────────────────────
describe("Funzione epatica", () => {
  test("ALT/GPT alta", () => {
    const r = findLab(extractLabValues("ALT 68 U/L"), "alt");
    expect(r?.status).toBe("high");
  });

  test("AST alias GOT", () => {
    const r = findLab(extractLabValues("GOT 35 U/L"), "ast");
    expect(r?.value).toBe(35);
  });

  test("GGT", () => {
    const r = findLab(extractLabValues("GGT 45 U/L"), "ggt");
    expect(r?.status).toBe("normal");
  });

  test("ALP", () => {
    const r = findLab(extractLabValues("ALP 95 U/L"), "alp");
    expect(r?.status).toBe("normal");
  });

  test("Fosfatasi alcalina alta", () => {
    const r = findLab(extractLabValues("Fosfatasi alcalina 150 U/L"), "alp");
    expect(r?.status).toBe("high");
  });

  test("CPK alias CK", () => {
    const r = findLab(extractLabValues("CK 380 U/L"), "cpk");
    expect(r?.status).toBe("high");
  });

  test("Albumina", () => {
    const r = findLab(extractLabValues("Albumina 4.0 g/dL"), "albumin");
    expect(r?.status).toBe("normal");
  });
});

// ─── Funzione renale ─────────────────────────────────────────────────────────
describe("Funzione renale", () => {
  test("Creatinina normale", () => {
    const r = findLab(extractLabValues("Creatinina 0.9 mg/dL"), "creatinine");
    expect(r?.status).toBe("normal");
  });

  test("Creatinina alta", () => {
    const r = findLab(extractLabValues("Creat 1.5 mg/dL"), "creatinine");
    expect(r?.status).toBe("high");
  });

  test("eGFR basso", () => {
    const r = findLab(extractLabValues("eGFR 45 mL/min"), "egfr");
    expect(r?.status).toBe("low");
  });

  test("Proteinuria", () => {
    const r = findLab(extractLabValues("Proteinuria 0.8 g/24h"), "proteinuria");
    expect(r?.value).toBe(0.8);
  });

  test("Proteinuria mg/24h normalizzata a g/24h", () => {
    const r = findLab(extractLabValues("Proteinuria 800 mg/24h"), "proteinuria");
    expect(r?.normalizedValue).toBeCloseTo(0.8, 2);
    expect(r?.normalizedUnit).toBe("g/24h");
  });

  test("Esame urine completo standard: stick e sedimento non diventano proteinuria 24h", () => {
    const items = extractLabValues(`
Esame completo urine
pH 6.5 range 5.0-7.0
Densità Relativa 1.004 range 1.010-1.030
Proteine Assenti mg/dL range <15
Glucosio Assente mg/dL
Corpi Chetonici Assenti mg/dL
Emoglobina Assente mg/dL
Nitriti Assenti
Esterasi leucocitaria Assente
Emazie 6 num/microL range 0-15
Leucociti 1 num/microL range 0-20
    `);

    expect(findLab(items, "proteinuria")).toBeNull();
    expect(findLab(items, "proteinuria_stick")?.qualitative).toBe("assenti");
    expect(findLab(items, "nitriti")?.qualitative).toBe("assenti");
    expect(findLab(items, "esterasi_leucocitaria")?.qualitative).toBe("assente");
    expect(findLab(items, "hemoglobinuria")?.qualitative).toBe("assente");
    expect(findLab(items, "urine_rbc")?.value).toBe(6);
    expect(findLab(items, "urine_rbc")?.unit).toBe("num/microL");
    expect(findLab(items, "urine_wbc")?.value).toBe(1);
    expect(findLab(items, "urine_wbc")?.unit).toBe("num/microL");
  });

  test("Proteinuria quantitativa 24h resta distinta dallo stick urine", () => {
    const mg = findLab(extractLabValues("Proteinuria 350 mg/24h"), "proteinuria");
    expect(mg?.normalizedValue).toBeCloseTo(0.35, 2);
    expect(mg?.normalizedUnit).toBe("g/24h");

    const g = findLab(extractLabValues("Proteinuria 0,35 g/24h"), "proteinuria");
    expect(g?.value).toBe(0.35);
    expect(g?.unit).toBe("g/24h");

    const stick = extractLabValues("Proteine Assenti mg/dL");
    expect(findLab(stick, "proteinuria")).toBeNull();
    expect(findLab(stick, "proteinuria_stick")?.qualitative).toBe("assenti");
  });
});

// ─── Metabolismo / altro ─────────────────────────────────────────────────────
describe("Metabolismo e altri parametri", () => {
  test("Vitamina D insufficiente", () => {
    const r = findLab(extractLabValues("Vitamina D 18 ng/mL"), "vitd");
    expect(r?.status).toBe("low");
  });

  test("25-OH-D3 nmol/L → ng/mL", () => {
    const r = findLab(extractLabValues("25-OH-D3 50 nmol/L"), "vitd");
    expect(r?.normalizedValue).toBeCloseTo(50 / 2.496, 0);
  });

  test("TSH normale", () => {
    const r = findLab(extractLabValues("TSH 2.1 mIU/L"), "tsh");
    expect(r?.status).toBe("normal");
  });

  test("Uricemia alta", () => {
    const r = findLab(extractLabValues("Acido urico 8.2 mg/dL"), "uric_acid");
    expect(r?.status).toBe("high");
  });

  test("Calcemia normale", () => {
    const r = findLab(extractLabValues("Calcemia 9.2 mg/dL"), "calcium");
    expect(r?.status).toBe("normal");
  });

  test("PTH", () => {
    const r = findLab(extractLabValues("PTH 45 pg/mL"), "pth");
    expect(r?.status).toBe("normal");
  });
});

// ─── Slash-group ─────────────────────────────────────────────────────────────
describe("Pattern slash-group (GOT/GPT/GGT = 21/25/45)", () => {
  test("GOT/GPT/GGT tre valori", () => {
    const results = extractLabValues("GOT/GPT/GGT 21/25/45");
    const ast = findLab(results, "ast");
    const alt = findLab(results, "alt");
    const ggt = findLab(results, "ggt");
    expect(ast?.value).toBe(21);
    expect(alt?.value).toBe(25);
    expect(ggt?.value).toBe(45);
  });

  test("AST/ALT due valori con uguale", () => {
    const results = extractLabValues("AST/ALT = 32/28");
    expect(findLab(results, "ast")?.value).toBe(32);
    expect(findLab(results, "alt")?.value).toBe(28);
  });

  test("VES/PCR slash-group", () => {
    const results = extractLabValues("VES/PCR 28/12");
    expect(findLab(results, "ves")?.value).toBe(28);
    expect(findLab(results, "crp")?.value).toBe(12);
  });
});

// ─── Qualitative (nn / nella norma / neg) ────────────────────────────────────
describe("Risultati qualitativi", () => {
  test("PCR nn", () => {
    const results = extractLabValues("PCR nn");
    const r = findLab(results, "crp");
    expect(r?.qualitative).toBe("nella norma");
    expect(r?.status).toBe("normal");
    expect(r?.value).toBeNull();
  });

  test("VES nella norma", () => {
    const r = findLab(extractLabValues("VES nella norma"), "ves");
    expect(r?.qualitative).toBe("nella norma");
  });

  test("ALT negativo", () => {
    const r = findLab(extractLabValues("ALT neg"), "alt");
    expect(r?.qualitative).toBe("nella norma");
  });
});

// ─── Intervallo di riferimento inline ────────────────────────────────────────
describe("Intervallo di riferimento inline", () => {
  test("CRP 3 (v.n. 0-5) — normale con range personalizzato", () => {
    const r = findLab(extractLabValues("CRP 3 (v.n. 0-5)"), "crp");
    expect(r?.detectedRange).toEqual({ low: 0, high: 5 });
    expect(r?.status).toBe("normal");
  });

  test("CRP 8 (rif. < 5) — alta con soglia esplicita", () => {
    const r = findLab(extractLabValues("CRP 8 (rif. < 5)"), "crp");
    expect(r?.status).toBe("high");
  });

  test("PCR 0.4 mg/dL (v.n. 0-0.5) — NORMALE: range in mg/dL normalizzato assieme al valore", () => {
    const r = findLab(extractLabValues("PCR 0.4 mg/dL (v.n. 0-0.5)"), "crp");
    expect(r?.normalizedValue).toBe(4);
    expect(r?.detectedRange?.high).toBeCloseTo(5);
    expect(r?.status).toBe("normal");
  });

  test("PCR 0.6 mg/dL (v.n. 0-0.5) — ALTA: valore e range entrambi convertiti mg/dL→mg/L", () => {
    const r = findLab(extractLabValues("PCR 0.6 mg/dL (v.n. 0-0.5)"), "crp");
    expect(r?.normalizedValue).toBe(6);
    expect(r?.detectedRange?.high).toBeCloseTo(5);
    expect(r?.status).toBe("high");
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────
describe("Edge cases", () => {
  test("Testo vuoto → array vuoto", () => {
    expect(extractLabValues("")).toHaveLength(0);
  });

  test("Più parametri nello stesso testo", () => {
    const text = "VES 32 mm/h, PCR 18 mg/L, Hb 11.5 g/dL, PLT 220 K/μL.";
    const results = extractLabValues(text);
    expect(findLab(results, "ves")?.value).toBe(32);
    expect(findLab(results, "crp")?.value).toBe(18);
    expect(findLab(results, "hb")?.value).toBe(11.5);
    expect(findLab(results, "plt")?.value).toBe(220);
  });

  test("Numero generico non interpretato come parametro", () => {
    const results = extractLabValues("Il paziente pesa 72 kg e ha 58 anni.");
    expect(results).toHaveLength(0);
  });
});

// ─── Autoanticorpi ────────────────────────────────────────────────────────────
describe("Autoanticorpi", () => {
  const FULL_TEXT =
    "FR +, ACPA neg, ANA 1:160 nucleolare, dsDNA +, SSA +, SSB-, Sm+, RNP-, " +
    "crioglobuline +, LAC +, anticardiolipina IgG 150*, IgM neg, restanti APL negativi.";

  test("FR + → positivo", () => {
    const r = findLab(extractLabValues("FR +"), "fr");
    expect(r?.status).toBe("positive");
    expect(r?.qualitative).toBe("positivo");
    expect(r?.panel).toBe("autoanticorpi");
  });

  test("ACPA neg → negativo", () => {
    const r = findLab(extractLabValues("ACPA neg"), "acpa_anti_ccp");
    expect(r?.status).toBe("negative");
    expect(r?.qualitative).toBe("negativo");
  });

  test("ANA 1:160 → titolo positivo", () => {
    const r = findLab(extractLabValues("ANA 1:160 nucleolare"), "ana_titolo");
    expect(r?.qualitative).toBe("1:160");
    expect(r?.status).toBe("positive");
  });

  test("ANA 1:160 nucleolare → pattern estratto", () => {
    const r = findLab(extractLabValues("ANA 1:160 nucleolare"), "ana_pattern");
    expect(r?.qualitative).toBe("nucleolare");
  });

  test("dsDNA + → positivo", () => {
    const r = findLab(extractLabValues("dsDNA +"), "anti_dsdna");
    expect(r?.status).toBe("positive");
  });

  test("SSA + → positivo", () => {
    const r = findLab(extractLabValues("SSA +"), "anti_ssa_ro");
    expect(r?.status).toBe("positive");
  });

  test("SSB- (no spazio) → negativo", () => {
    const r = findLab(extractLabValues("SSB-"), "anti_ssb_la");
    expect(r?.status).toBe("negative");
  });

  test("Sm+ (no spazio) → positivo", () => {
    const r = findLab(extractLabValues("Sm+"), "anti_sm");
    expect(r?.status).toBe("positive");
  });

  test("RNP- (no spazio) → negativo", () => {
    const r = findLab(extractLabValues("RNP-"), "anti_rnp");
    expect(r?.status).toBe("negative");
  });

  test("crioglobuline + → positivo", () => {
    const r = findLab(extractLabValues("crioglobuline +"), "crioglobuline");
    expect(r?.status).toBe("positive");
  });

  test("LAC + → positivo", () => {
    const r = findLab(extractLabValues("LAC +"), "lac");
    expect(r?.status).toBe("positive");
  });

  test("anticardiolipina IgG 150* → positivo con valore numerico", () => {
    const r = findLab(extractLabValues("anticardiolipina IgG 150*"), "acl_igg");
    expect(r?.value).toBe(150);
    expect(r?.status).toBe("positive");
  });

  test("anticardiolipina IgM neg → negativo", () => {
    const r = findLab(extractLabValues("anticardiolipina IgG 150*, IgM neg"), "acl_igm");
    expect(r?.status).toBe("negative");
    expect(r?.qualitative).toBe("negativo");
  });

  test("restanti APL negativi → b2gp1_igg negativo", () => {
    const r = findLab(extractLabValues("anticardiolipina IgG 150*, IgM neg, restanti APL negativi."), "b2gp1_igg");
    expect(r?.status).toBe("negative");
  });

  test("restanti APL negativi → b2gp1_igm negativo", () => {
    const r = findLab(extractLabValues("anticardiolipina IgG 150*, IgM neg, restanti APL negativi."), "b2gp1_igm");
    expect(r?.status).toBe("negative");
  });

  test("restanti APL negativi non sovrascrive acl_igg già trovato", () => {
    const results = extractLabValues("anticardiolipina IgG 150*, IgM neg, restanti APL negativi.");
    const igg = findLab(results, "acl_igg");
    expect(igg?.status).toBe("positive");
    expect(igg?.value).toBe(150);
  });

  test("testo completo — tutti e 13 gli autoanticorpi riconosciuti", () => {
    const results = extractLabValues(FULL_TEXT);
    const keys = [
      "fr", "acpa_anti_ccp", "ana_titolo", "ana_pattern",
      "anti_dsdna", "anti_ssa_ro", "anti_ssb_la", "anti_sm", "anti_rnp",
      "crioglobuline", "lac", "acl_igg", "acl_igm",
    ];
    for (const k of keys) {
      expect(findLab(results, k)).not.toBeNull();
    }
  });

  test("testo completo — b2gp1 negativi da APL bulk", () => {
    const results = extractLabValues(FULL_TEXT);
    expect(findLab(results, "b2gp1_igg")?.status).toBe("negative");
    expect(findLab(results, "b2gp1_igm")?.status).toBe("negative");
  });

  test("panel = autoanticorpi per tutti i risultati Ab", () => {
    const results = extractLabValues(FULL_TEXT).filter((r) => r.panel === "autoanticorpi");
    expect(results.length).toBeGreaterThanOrEqual(13);
  });
});

// ─── Fix parser LIS: formula leucocitaria, eosinofili, PLT conteggio, parentetiche ───
describe("Fix parser LIS — emocromo formula + parentetiche", () => {

  // Formula leucocitaria: preferisce valore assoluto (10^9/L) rispetto a %
  test("Neutrofili — scarta il valore in % e prende il 10^9/L", () => {
    const text = "Neutrofili  45.2  %  20.00 - 44.00\nNeutrofili  2.23  10^9/L  1.80 - 7.50";
    const r = findLab(extractLabValues(text), "neutrophils");
    expect(r?.value).toBe(2.23);
    expect(r?.unit).toBe("10^9/L");
  });

  test("Neutrofili con flag > — scarta il valore in % anche con flag", () => {
    const text = "Neutrofili  44.9  >  %\nNeutrofili  2.22  10^9/L";
    const r = findLab(extractLabValues(text), "neutrophils");
    expect(r?.value).toBe(2.22);
  });

  test("Linfociti — scarta il valore in % e prende il 10^9/L", () => {
    const text = "Linfociti  38.5  %\nLinfociti  1.90  10^9/L";
    const r = findLab(extractLabValues(text), "lymphocytes");
    expect(r?.value).toBe(1.90);
  });

  // Eosinofili
  test("Eosinofili — valore assoluto 10^9/L estratto correttamente", () => {
    const text = "Eosinofili  4.0  %\nEosinofili  0.20  10^9/L  0.02 - 0.50";
    const r = findLab(extractLabValues(text), "eosinophils");
    expect(r?.value).toBe(0.20);
    expect(r?.status).toBe("normal");
  });

  test("Eosinofili alta (solo riga assoluta)", () => {
    const text = "Eosinofili 0.65 10^9/L";
    const r = findLab(extractLabValues(text), "eosinophils");
    expect(r?.value).toBe(0.65);
    expect(r?.status).toBe("high");
  });

  // Piastrine dal "Conteggio" LIS
  test("PLT estratto da 'Conteggio VALUE 10^9/L'", () => {
    const text = "[3] Piastrine\n  Conteggio  228  10^9/L  160 - 370";
    const r = findLab(extractLabValues(text), "plt");
    expect(r?.value).toBe(228);
    expect(r?.status).toBe("normal");
  });

  test("PLT estratto da 'Conteggio piastrine VALUE 10^9/L'", () => {
    const r = findLab(extractLabValues("Conteggio piastrine 98 10^9/L"), "plt");
    expect(r?.value).toBe(98);
    expect(r?.status).toBe("low");
  });

  // AST (GOT) / ALT (GPT) con parentetiche
  test("AST (GOT) con parentetica", () => {
    const r = findLab(extractLabValues("AST (GOT)  35  U/L"), "ast");
    expect(r?.value).toBe(35);
    expect(r?.status).toBe("normal");
  });

  test("ALT (GPT) con parentetica", () => {
    const r = findLab(extractLabValues("ALT (GPT)  68  U/L"), "alt");
    expect(r?.value).toBe(68);
    expect(r?.status).toBe("high");
  });

  test("GammaGT (GGT) con parentetica", () => {
    const r = findLab(extractLabValues("GammaGT (GGT)  45  U/L"), "ggt");
    expect(r?.value).toBe(45);
    expect(r?.status).toBe("normal");
  });

  // Creatinchinasi (alias CPK)
  test("Creatinchinasi riconosciuta come CPK", () => {
    const r = findLab(extractLabValues("Creatinchinasi  120  U/L"), "cpk");
    expect(r?.value).toBe(120);
    expect(r?.status).toBe("normal");
  });

  test("Creatinchinasi (CPK) con parentetica alta", () => {
    const r = findLab(extractLabValues("Creatinchinasi (CPK)  380  U/L"), "cpk");
    expect(r?.value).toBe(380);
    expect(r?.status).toBe("high");
  });

  // Albumina: % dall'elettroforesi NON deve essere estratta
  test("Albumina in % (elettroforesi) — NON estratta", () => {
    const r = findLab(extractLabValues("Albumina  58.3  %  55.0 - 68.0"), "albumin");
    expect(r).toBeNull();
  });

  test("Albumina in g/dL (biochimica) — estratta correttamente", () => {
    const r = findLab(extractLabValues("Albumina  4.2  g/dL"), "albumin");
    expect(r?.value).toBe(4.2);
    expect(r?.status).toBe("normal");
  });
});

// ─── Alias brevi: N (neutrofili) e Ly (linfociti) ────────────────────────────
describe("Alias brevi emocromo — N e Ly", () => {
  test("N 4 riconosciuto come neutrofili (alias breve)", () => {
    const r = findLab(extractLabValues("N 4 K/μL"), "neutrophils");
    expect(r?.value).toBe(4);
  });

  test("Ly 2 riconosciuto come linfociti (alias breve)", () => {
    const r = findLab(extractLabValues("Ly 2 K/μL"), "lymphocytes");
    expect(r?.value).toBe(2);
  });

  test("N e Ly nel formato utente reale: bullet EE data: Hb WBC N Ly Plt VES PCR CPK", () => {
    const text = "- EE 11/11/2025: Hb 15, WBC 5, N 4, Ly 2, Plt 350, VES 15, PCR 0.5 mg/dL, CPK 150";
    const results = extractLabValues(text);
    expect(findLab(results, "neutrophils")?.value).toBe(4);
    expect(findLab(results, "lymphocytes")?.value).toBe(2);
  });

  test("N non cattura 'Na' (sodio) — word boundary", () => {
    const r = findLab(extractLabValues("Na 140 mEq/L"), "neutrophils");
    expect(r).toBeNull();
  });

  test("Ly non cattura parole più lunghe — word boundary", () => {
    const r = findLab(extractLabValues("Lymphocytes 1.9 K/μL"), "lymphocytes");
    expect(r?.value).toBe(1.9);
  });
});

// ─── extractLabValuesByDate — raggruppamento multi-data ───────────────────────
describe("extractLabValuesByDate — raggruppamento multi-data", () => {
  test("testo senza date → singolo gruppo con date=null", () => {
    const groups = extractLabValuesByDate("VES 45, PCR 2.1");
    expect(groups).toHaveLength(1);
    expect(groups[0].date).toBeNull();
    expect(findLab(groups[0].items, "ves")?.value).toBe(45);
  });

  test("testo vuoto → array vuoto", () => {
    expect(extractLabValuesByDate("")).toHaveLength(0);
    expect(extractLabValuesByDate("   ")).toHaveLength(0);
  });

  test("formato reale utente: due blocchi EE con bullet", () => {
    const text =
      "- EE 11/11/2025: Hb 15, WBC 5, N 4, Ly 2, Plt 350, VES 15, PCR 0.5 mg/dL, CPK 150\n" +
      "- EE 01/08/2025: Hb 13, WBC 6, Plt 280, VES 30, PCR 1.2 mg/dL";
    const groups = extractLabValuesByDate(text);
    expect(groups).toHaveLength(2);
    expect(groups[0].date).toBe("2025-11-11");
    expect(groups[1].date).toBe("2025-08-01");
    expect(findLab(groups[0].items, "hb")?.value).toBe(15);
    expect(findLab(groups[1].items, "hb")?.value).toBe(13);
  });

  test("tutti e 8 i parametri del formato reale estratti nel primo gruppo", () => {
    const text = "- EE 11/11/2025: Hb 15, WBC 5, N 4, Ly 2, Plt 350, VES 15, PCR 0.5 mg/dL, CPK 150";
    const groups = extractLabValuesByDate(text);
    const items = groups[0]?.items ?? [];
    expect(findLab(items, "hb")?.value).toBe(15);
    expect(findLab(items, "wbc")?.value).toBe(5);
    expect(findLab(items, "neutrophils")?.value).toBe(4);
    expect(findLab(items, "lymphocytes")?.value).toBe(2);
    expect(findLab(items, "plt")?.value).toBe(350);
    expect(findLab(items, "ves")?.value).toBe(15);
    expect(findLab(items, "crp")).not.toBeNull();
    expect(findLab(items, "cpk")?.value).toBe(150);
  });

  test("frase clinica mid-sentence NON crea gruppo extra", () => {
    const text =
      "Visita del paziente risalente al 15/03/2024 per AR in buon controllo.\n" +
      "- EE 10/01/2024: VES 38, PCR 0.8 mg/dL";
    const groups = extractLabValuesByDate(text);
    // solo il blocco EE deve diventare un gruppo con data
    expect(groups.filter((g) => g.date !== null)).toHaveLength(1);
    expect(groups.find((g) => g.date !== null)?.date).toBe("2024-01-10");
  });

  test("date in ordine qualsiasi — ogni gruppo ha la data corretta", () => {
    const text =
      "15/03/2024: VES 45, PCR 2.1\n" +
      "10/01/2024: VES 38, PCR 0.8";
    const groups = extractLabValuesByDate(text);
    expect(groups).toHaveLength(2);
    const g1 = groups.find((g) => g.date === "2024-03-15");
    const g2 = groups.find((g) => g.date === "2024-01-10");
    expect(findLab(g1.items, "ves")?.value).toBe(45);
    expect(findLab(g2.items, "ves")?.value).toBe(38);
  });

  test("testo senza lab validi → array vuoto", () => {
    const groups = extractLabValuesByDate("Paziente in buon controllo generale.");
    expect(groups).toHaveLength(0);
  });
});

// ─── detectReportDate — data referto esplicita o null ─────────────────────────
describe("detectReportDate — data referto", () => {
  test("data prelievo prevale su data stampa", () => {
    const det = detectReportDate("Data prelievo 05/06/2025  -  Data di stampa 07/06/2025");
    expect(det?.date).toBe("2025-06-05");
    expect(det?.source).toBe("prelievo");
  });

  test("multi-data accettazione/prelievo/stampa → vince prelievo", () => {
    const text =
      "Data accettazione: 10/03/2024\n" +
      "Data prelievo: 09/03/2024\n" +
      "Data di stampa: 12/03/2024";
    const det = detectReportDate(text);
    expect(det?.date).toBe("2024-03-09");
    expect(det?.source).toBe("prelievo");
  });

  test("stampa usata solo se non c'è prelievo/accettazione", () => {
    const det = detectReportDate("Referto stampato il 12/03/2024");
    expect(det?.date).toBe("2024-03-12");
  });

  test("null quando nessun pattern esplicito", () => {
    const det = detectReportDate("Emocromo: Hb 13.5 g/dL, WBC 6.2, PLT 250.");
    expect(det).toBeNull();
  });
});

// ─── Sedimento urinario — niente falsi positivi da RBC/WBC ematici ────────────
describe("Urine — emazie/leucociti solo con unità per-campo o contesto", () => {
  test("'Globuli rossi 4.52 10^6/uL' (emocromo) → nessun urine_rbc", () => {
    const r = findLab(extractLabValues("Emocromo: Globuli rossi 4.52 10^6/uL, Hb 13.5"), "urine_rbc");
    expect(r).toBeNull();
  });

  test("'globuli rossi 10.5' senza unità → nessun urine_rbc", () => {
    const r = findLab(extractLabValues("Sedimento urinario: globuli rossi 10.5"), "urine_rbc");
    expect(r).toBeNull();
  });

  test("'Leucociti 12.4 K/μL' (emocromo) → nessun urine_wbc", () => {
    const r = findLab(extractLabValues("Emocromo: Leucociti 12.4 K/μL, Hb 14"), "urine_wbc");
    expect(r).toBeNull();
  });

  test("'17 emazie/campo' → urine_rbc=17", () => {
    const r = findLab(extractLabValues("EU 04/04/26: 17 emazie/campo"), "urine_rbc");
    expect(r?.value).toBe(17);
  });

  test("'EU: emazie 22*' in contesto urine → urine_rbc=22", () => {
    const r = findLab(extractLabValues("EU: emazie 22*, leucociti 8/campo"), "urine_rbc");
    expect(r?.value).toBe(22);
  });
});
