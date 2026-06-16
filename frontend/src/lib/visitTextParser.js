/**
 * visitTextParser.js
 *
 * Parser locale (zero costi, zero AI) per note di visita reumatologiche in
 * italiano. Sostituisce completamente la chiamata Claude Haiku /ai/parse-visit.
 *
 * Estrae:
 *   assessments       — score clinimetrici (DAS28, CDAI, SDAI, HAQ, BASDAI, …)
 *   lab_exams         — esami ematochimici raggruppati per pannello
 *   therapies         — farmaci con dose, frequenza, categoria
 *   patient           — anagrafica base + diagnosi
 *   sclero_profile    — profilo SSc organo-specifico
 *   instrumental_findings — già rule-based (instrumentalParser)
 *   summary           — riepilogo testuale auto-generato
 */

import { parseClinimetryFromText } from "./clinimetryTextParser";
import { extractLabValuesByDate, extractLabValues, detectReportDate } from "./labValueExtractor";
import { parseInstrumentalFindings } from "./instrumentalParser";
import { DRUG_ALIAS_MAP } from "./drugs";
import { segmentLetterSections, extractRequestedTests } from "./letterSectionParser";
import { parseRaccordoTimeline } from "./raccordoParser";
import { resolveComorbidita } from "./conditions";

// ── Module-level parse trace buffer ──────────────────────────────────────────
// Cleared at the start of each parseVisitText() call.
// Entries are read by VisitImportButton and POSTed to /api/debug/parse-trace.
let _PARSE_TRACE = [];
// Tracks which RE stage produced the visit date (RE0/RE1/RE2/RE3/null).
// RE3 = "last resort" — can be overridden by initialDateHint in VisitImportButton.
let _lastDateSource = null;
function _trace(msg) {
  console.log(msg);           // still visible in browser console
  _PARSE_TRACE.push(msg);     // also collected for server-side logging
}

// ── 1. Data visita ────────────────────────────────────────────────────────────
function extractVisitDate(text) {
  const _D = (msg) => _trace("[DATE-DIAG] " + msg);
  _D("─────────────────────────────────────────");
  _D("Testo sorgente: " + (text?.length || 0) + " caratteri");
  _D("─────────────────────────────────────────");

  // RE0 — formula di refertazione / firma digitale (massima priorità e specificità)
  const RE0 = /(?:data\s+(?:e\s+ora\s+di\s+)?refertazione|data\s+referto|data\s+(?:di\s+)?(?:emissione|firma)|firmato(?:\s+digitalmente)?(?:\s+in\s+data)?)\s*:?\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/i;
  const m0 = text.match(RE0);
  if (m0) {
    const [, d, mo, y] = m0;
    const year = parseInt(y);
    _D(`RE0 match: anno=${year} pos=${m0.index}`);
    if (year >= 1990 && year <= 2100) {
      const result = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
      _D(`✅ RE0 VINCE (anno=${year})`);
      _lastDateSource = "RE0";
      return result;
    }
    _D(`RE0 scartata: anno ${year} fuori range 1990-2100`);
  } else {
    _D("RE0: nessun match (nessuna formula di refertazione/firma trovata)");
  }

  const thisYear = new Date().getFullYear();
  _D(`thisYear=${thisYear}, soglia RE1: anno >= ${thisYear - 3}, soglia RE2: anno >= ${thisYear - 1}`);

  // RE1 — keyword contestuale specifico
  const RE1 = /(?:visita(?:\s+ambulatoriale)?(?:\s+del)?|in\s+data|effettuata?\s+(?:il|in\s+data)?)\s+(?:del\s+)?(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/i;
  const m1 = text.match(RE1);
  if (m1) {
    const [, d, mo, y] = m1;
    const year = parseInt(y);
    _D(`RE1 match: anno=${year} pos=${m1.index}`);
    if (year >= thisYear - 3 && year <= 2100) {
      const result = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
      _D(`✅ RE1 VINCE (anno=${year})`);
      _lastDateSource = "RE1";
      return result;
    }
    _D(`RE1 scartata: anno ${year} < ${thisYear - 3} (troppo vecchia) o > 2100`);
  } else {
    _D("RE1: nessun match (visita/in data/effettuata non trovato)");
  }

  // RE2 — fallback: prima data con anno >= thisYear-1
  _D("RE2: scansione TUTTE le date nel testo...");
  const RE2 = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/g;
  let m;
  let re2count = 0;
  while ((m = RE2.exec(text)) !== null) {
    const year = parseInt(m[3]);
    re2count++;
    if (year < 1990 || year > 2100) {
      _D(`  RE2[${re2count}] pos=${m.index} anno=${year} → SKIP (range)`);
      continue;
    }
    if (year >= thisYear - 1) {
      const result = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      _D(`  RE2[${re2count}] pos=${m.index} anno=${year} → match`);
      _D(`✅ RE2 VINCE (anno=${year})`);
      _lastDateSource = "RE2";
      return result;
    }
    _D(`  RE2[${re2count}] pos=${m.index} anno=${year} → SKIP (anno < ${thisYear - 1})`);
  }
  _D(`RE2: ${re2count} date totali scansionate, nessuna >= ${thisYear - 1}`);

  // RE3 — ultimo resort (weak: può essere battuto da initialDateHint in VisitImportButton)
  const RE3 = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/;
  const m3 = text.match(RE3);
  if (!m3) { _D("RE3: nessuna data trovata → return null"); _lastDateSource = null; return null; }
  const [, d, mo, y] = m3;
  const year = parseInt(y);
  _D(`RE3 match: anno=${year} pos=${m3.index}`);
  if (year < 1990 || year > 2100) { _D("RE3 scartata: anno fuori range → return null"); _lastDateSource = null; return null; }
  const result = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  _D(`✅ RE3 (ultimo resort, debole — sovrascrivibile da hint PDF) (anno=${year})`);
  _lastDateSource = "RE3";
  return result;
}

// ── 2. Interpretazione score ──────────────────────────────────────────────────
function interpretScore(index_type, score) {
  if (score == null || isNaN(score)) return null;
  const s = score;
  switch (index_type) {
    case "das28_crp":
    case "das28_esr":
      if (s < 2.6) return "Remissione";
      if (s < 3.2) return "Attività bassa";
      if (s < 5.1) return "Attività moderata";
      return "Attività alta";
    case "cdai":
      if (s <= 2.8) return "Remissione";
      if (s <= 10)  return "Attività bassa";
      if (s <= 22)  return "Attività moderata";
      return "Attività alta";
    case "sdai":
      if (s <= 3.3) return "Remissione";
      if (s <= 11)  return "Attività bassa";
      if (s <= 26)  return "Attività moderata";
      return "Attività alta";
    case "haq":
      if (s < 0.5)  return "Nessuna disabilità";
      if (s < 1.0)  return "Disabilità lieve";
      if (s < 1.5)  return "Disabilità moderata";
      return "Disabilità severa";
    case "basdai":
      if (s < 2.0)  return "Malattia inattiva";
      if (s < 4.0)  return "Attività bassa";
      return "Malattia attiva";
    case "asdas_crp":
      if (s < 1.3)  return "Attività molto bassa (remissione)";
      if (s < 2.1)  return "Attività moderata";
      if (s < 3.5)  return "Attività alta";
      return "Attività molto alta";
    case "basfi":
      if (s < 2.0)  return "Funzionalità conservata";
      if (s < 5.0)  return "Compromissione moderata";
      return "Compromissione severa";
    case "basmi":
      return null;
    case "dapsa":
      if (s <= 4)   return "Remissione";
      if (s <= 14)  return "Attività bassa";
      if (s <= 28)  return "Attività moderata";
      return "Attività alta";
    case "sledai":
      if (s < 4)    return "Attività minima";
      if (s < 12)   return "Attività moderata";
      return "Attività alta";
    case "mrss":
      if (s < 15)   return "Cute limitata";
      if (s < 30)   return "Cute diffusa moderata";
      return "Cute diffusa severa";
    case "essdai":
      if (s < 5)    return "Attività bassa";
      if (s < 14)   return "Attività moderata";
      return "Attività alta";
    case "bvas":
      if (s === 0)  return "Remissione";
      if (s < 15)   return "Attività moderata";
      return "Attività alta";
    case "pasi":
      if (s < 3)    return "Psoriasi lieve";
      if (s < 12)   return "Psoriasi moderata";
      return "Psoriasi grave";
    case "mmt8":
      if (s >= 72)  return "Forza normale";
      if (s >= 50)  return "Debolezza lieve";
      return "Debolezza moderata-grave";
    case "fiqr":
      if (s < 25)   return "Impatto basso";
      if (s < 50)   return "Impatto moderato";
      return "Impatto severo";
    default:
      return null;
  }
}

// ── 3. Conteggio articolazioni (TJC / SJC) ───────────────────────────────────
function extractJointCounts(text) {
  // Supporta tutte le forme comuni:
  //   "TJC 6", "TJC=6", "6 articolazioni dolenti", "6 dolenti (TJC)", "6 (TJC)"
  //   "SJC 4", "4 tumefatte (SJC)", "4 articolazioni tumefatte", "4 swollen"
  const tjcRe =
    /(?:TJC\s*(?:28|44)?\s*[=:\s]\s*(\d+)|(\d+)\s+articolazioni\s+dolenti|(\d+)\s+joints?\s+tender|(\d+)\s*(?:dolenti\s*)?\(?\s*TJC\s*\)?)/i;
  const sjcRe =
    /(?:SJC\s*(?:28|44)?\s*[=:\s]\s*(\d+)|(\d+)\s+articolazioni\s+tumefatte|(\d+)\s+joints?\s+swollen|(\d+)\s*(?:tumefatte?\s*)?\(?\s*SJC\s*\)?)/i;

  let tjc = null, sjc = null;
  const tm = text.match(tjcRe);
  if (tm) tjc = parseInt(tm[1] ?? tm[2] ?? tm[3] ?? tm[4]);
  const sm = text.match(sjcRe);
  if (sm) sjc = parseInt(sm[1] ?? sm[2] ?? sm[3] ?? sm[4]);
  return { tjc, sjc };
}

// ── 4. Parser farmaci ─────────────────────────────────────────────────────────
// DRUG_PATTERNS derived from the single-source DRUG_ALIAS_MAP in drugs.js.
// To add a new drug or alias: edit drugs.js DRUG_ALIAS_MAP only.
const DRUG_PATTERNS = (() => {
  const byKey = {};
  for (const [alias, info] of Object.entries(DRUG_ALIAS_MAP)) {
    const { canonical, category } = info;
    const cs = info.caseSensitive === true;
    const key = canonical + (cs ? "\u0000cs" : "");
    if (!byKey[key]) byKey[key] = { canonical, category, caseSensitive: cs, aliases: [] };
    byKey[key].aliases.push(alias);
  }
  return Object.values(byKey).map(({ canonical, category, caseSensitive, aliases }) => [
    new RegExp(
      // \b word boundaries on every alias prevent substring matches:
      // e.g. "aza" must not match inside "stessa", "bassa", "massa" etc.
      aliases.map(a => `\\b${a.replace(/[-[\]{}()*+?.,\\^$|#]/g, "\\$&")}\\b`).join("|"),
      caseSensitive ? "" : "i"
    ),
    canonical,
    category,
    caseSensitive,
  ]);
})();

const DOSE_RE = /(\d+(?:[.,]\d+)?)\s*(?:mg|mcg|µg|μg|g\b|ml\b|mL\b|UI\b|IU\b)\b/i;
const FREQ_PER_WEEK = /(\d+(?:[.,]\d+)?)\s*mg\s*\/\s*(?:sett(?:imana)?|week)/i;
// FREQ_INTERVAL — specific interval patterns extracted from FREQ_GENERAL to give
// them priority over generic abbreviations (die/bid/tid) when both are present.
// Matches: "ogni 4 settimane", "spacing a 4 settimane", "ogni 2 mesi",
//          "40 mg/3 settimane" (slash-interval notation used in Italian referti), etc.
const FREQ_INTERVAL =
  /\bspacing\s+a\s+\d+\s+settiman[ae]\b|\bogni\s+\d+\s+(?:settiman[ae]|giorni?|mes[ei]|weeks?|months?|days?)\b|\/\s*(\d+)\s+settiman[ae]\b/i;
const FREQ_GENERAL =
  /\b(\d+)\s*(?:volta|volte|times?)\s*(?:al\s*(?:giorno|day)|a\s*settimana|weekly)|\b(?:die|bid|tid|qid|once\s+(?:daily|weekly)|biweekly|mensile)\b|\bevery\s+\d+\s+(?:day|week)|\bogni\s+\d+\s+(?:settiman[ae]|giorni?|mes[ei]|weeks?|months?|days?)\b|\bspacing\s+a\s+\d+\s+settiman[ae]\b|\b(?:una|un['’])\s+volta\s+a\s+settimana\b|\bsettimanale\b/i;
const FREQ_PRN_RE = /\b(?:al\s+bisogno|se\s+necessario|secondo\s+necessit[àa]|prn)\b/i;

function prnSentenceScope(s) {
  const m = s.match(/[;\n]|\.\s+(?=[A-ZÀÈÉÌÒÓÙ])/);
  return m ? s.slice(0, m.index) : s;
}
const ROUTE_RE =
  /(?:^|[\s,;(])(?:(?:per\s+)?(?:os|orale(?:\s+per\s+os)?|bocca)|s\.?c\.?|sc|sottocut(?:e|ane[ao])|i\.m\.?|intramuscol[oe]|e\.v\.?|endovenosa?|i\.v\.?|sublinguale?|s\.l\.?|topica?|cutane[ao]|inalatori[ao])(?=[\s,;).\n]|$)/i;
const TAPERING_CONTEXT_RE = /\b(?:riduce|ridurre|scala|scalare|scalaggio|taper(?:ing)?|fino\s+a\s+(?:controllo|sospendere)|prova\s+a\s+sospendere)\b/i;

function parseDoseQuantity(raw) {
  const s = String(raw || "").toLowerCase().replace(",", ".").trim();
  if (!s) return null;
  if (s === "mezza" || s === "mezzo" || s === "½") return 0.5;
  if (s === "¼") return 0.25;
  const frac = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(s);
  if (frac) {
    const n = Number(frac[1]);
    const d = Number(frac[2]);
    return d ? n / d : null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function formatDoseNumber(value) {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function extractDoseAndFrequency(context) {
  const weekly = context.match(FREQ_PER_WEEK);
  if (weekly) return { dose: weekly[0].trim(), frequency: weekly[0].trim() };

  const doseM = context.match(DOSE_RE);
  let dose = null;
  let afterDose = "";
  let dayPartsM = null;

  if (doseM) {
    const unitDose = Number(doseM[1].replace(",", "."));
    const unit = doseM[0].match(/(mg|mcg|µg|μg|g\b|ml\b|mL\b|UI\b|IU\b)/i)?.[1] || "";
    let multiplier = 1;
    afterDose = context.slice(doseM.index + doseM[0].length, doseM.index + doseM[0].length + 80);

    dayPartsM = afterDose.match(/^\s*:?\s*(\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+|mezz[ao]|[¼½])\s*(?:cp|cpr|cps|compress[ae]|compresse|tab(?:\.|lette?)?)\s+(?:la\s+)?mattina\s+e\s+(\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+|mezz[ao]|[¼½])\s*(?:cp|cpr|cps|compress[ae]|compresse|tab(?:\.|lette?)?)?\s+(?:la\s+)?sera\b/i);
    if (dayPartsM) {
      multiplier *= (parseDoseQuantity(dayPartsM[1]) || 0) + (parseDoseQuantity(dayPartsM[2]) || 0);
    } else {
      const tabletM = afterDose.match(/^\s*:?\s*(?:(\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+|mezz[ao]|[¼½])\s*)?(?:cp|cpr|cps|compress[ae]|compresse|tab(?:\.|lette?)?)\b/i);
      if (tabletM) {
        multiplier *= parseDoseQuantity(tabletM[1] || "1") || 1;
        const afterTablet = afterDose.slice(tabletM[0].length);
        const timesM = afterTablet.match(/^\s*(?:x|×)\s*(\d+(?:[.,]\d+)?)(?!\s+(?:mes[ei]|settiman[ae]|giorni|ann[oi]|gg)\b)(?:\s*(?:\/\s*)?(?:die|giorno|dì|di|day)|\s+al\s+(?:giorno|dì|di))?\b/i);
        if (timesM) multiplier *= parseDoseQuantity(timesM[1]) || 1;
      } else {
        const timesM = afterDose.match(/^\s*(?:x|×)\s*(\d+(?:[.,]\d+)?)(?!\s+(?:mes[ei]|settiman[ae]|giorni|ann[oi]|gg)\b)(?:\s*(?:\/\s*)?(?:die|giorno|dì|di|day)|\s+al\s+(?:giorno|dì|di))?\b/i);
        if (timesM) multiplier *= parseDoseQuantity(timesM[1]) || 1;
      }
    }

    const total = multiplier !== 1 ? formatDoseNumber(unitDose * multiplier) : null;
    dose = total ? `${total} ${unit}` : doseM[0].trim();
  }

  const freqPwM = weekly;
  const freqIntM = context.match(FREQ_INTERVAL);
  const freqGenM = context.match(FREQ_GENERAL);
  const dailyM = afterDose.match(/(?:^|[\s/])(?:al\s+(?:di|dì|giorno|day)|die|dì|giorno|day|qd)(?=$|[\s,.;)])/i);
  const twoDaysWeekM = context.match(/\b(?:2|due)\s+giorni\s+(?:a|alla)\s+settimana\b/i);

  const prnScope = prnSentenceScope(context);

  let frequency = null;
  if (twoDaysWeekM) {
    frequency = "2 giorni/settimana";
  } else if (/\b(?:un\s+)?(?:unico\s+)?giorno\s+(?:a|alla)\s+settimana\b/i.test(context)) {
    frequency = "settimanale";
  } else if (dayPartsM) {
    frequency = "die";
  } else if (FREQ_PRN_RE.test(prnScope)) {
    frequency = prnScope.match(FREQ_PRN_RE)[0].trim();
  } else {
    const freqM = [freqPwM, freqIntM, freqGenM]
      .filter(Boolean)
      .sort((a, b) => a.index - b.index)[0] ?? null;
    frequency = freqM ? freqM[0].trim() : (dailyM ? "die" : null);
  }

  if (frequency) {
    const slashIntM = frequency.match(/^\/\s*(\d+)\s+settiman[ae]$/i);
    if (slashIntM) frequency = `ogni ${slashIntM[1]} settimane`;
  }

  return { dose, frequency };
}

function normalizeRoute(raw) {
  if (!raw) return null;
  // Normalizza prima rimuovendo il punto finale se presente
  const r = raw.toLowerCase().replace(/\s+/g, "").replace(/\.$/, "");
  if (/os|orale|bocca/.test(r)) return "os";
  if (/sc|sottocut/.test(r)) return "s.c.";
  if (/im|intramuscol/.test(r)) return "i.m.";
  if (/ev|endoven|iv\b/.test(r)) return "e.v.";
  if (/sl|sublingu/.test(r)) return "s.l.";
  if (/topic|cutane/.test(r)) return "topico";
  if (/inalat/.test(r)) return "inalatorio";
  return raw.trim().toLowerCase();
}

// Sezioni del referto che descrivono terapia CORRENTE
const ACTIVE_SECTION_RE = /TERAPIA\s+IN\s+ATTO|TERAPIA\s+ATTUALE|TERAPIA\s+IN\s+CORSO|IN\s+TERAPIA/i;
// Sezioni che descrivono storia PASSATA (dentro cui trovare farmaci sospesi)
const PAST_SECTION_RE   = /ANAMNESI(?:\s+REUMATOLOGICA)?|STORIA\s+CLINICA|TERAPIA\s+PREGRESSA|PREGRESS/i;
// Marcatori di terapia pregressa/sospesa nel contesto PRIMA del farmaco.
// Coprono sia la storia remota ("in passato", "ha assunto") sia la sospensione
// autonoma da parte del paziente ("ha sospeso", "mantiene sospesa", ecc.).
const PAST_BEFORE_RE = /\bin\s+passato\b|\bpregressa\b|\bha\s+effettuato\b|\bha\s+assunto\b|\beffettuato\s+in\s+passato\b|\bmantiene?\s+sosp(?:eso|esa|esi|ese)\b|\bha\s+(?:sosp(?:eso|esa)|interrott[oa]|smesso|smessa|cessato|cessata|fermato)\b|\bpaziente\s+(?:ha\s+)?(?:sosp(?:eso|esa)|interrott[oa]|smesso|smessa)\b|\b(?:sospende|interrompe|smette)\s+(?:in\s+autonomia|autonomamente)\b|\bsospesa?\s+(?:autonomamente|in\s+autonomia|dalla?\s+paziente|dal\s+paziente)\b|\bnon\s+ha\s+(?:iniziato|assunto|preso)\b/i;

// Marcatori inline nel contesto DOPO il farmaco.
// Estesi per coprire sia la forma parentetica classica sia il testo libero
// ("Colchicina sospesa per intolleranza", "interrotta dopo 2 giorni", ecc.).
// NOTA: il pattern "sosp(eso) + dal" è intenzionalmente mantenuto per casi come
// "(sospeso dal 2020)" ma viene neutralizzato da applyNarrativeDiscontinuations
// quando preceduto da "mai" o "non" (es. "mai sospeso dal 2011").
const PAST_AFTER_RE = /\(\s*(?:inefficace|non\s+tollerat[oa]|sospeso|sospesa|interrotto|interrotta|controindicato|non\s+efficace)[^)]*\)|\b(?:sosp(?:eso|esa|esi|ese)|interrott[oa]|smessa?|cessata?)\s+(?:per|dopo|da[l]?\s|a\s+causa\s+di|dalla?\s+paziente|autonomamente|in\s+autonomia)\b|\bsosp(?:eso|esa)\s+(?:nel|del|dopo)\s+(?:\d+\s+\w+\s+)?per\b|\bsosp(?:eso|esa)\s+a\s+\S+(?:\s+\d{4})?\s+per\b|\bnon\s+tollerat[oa]\b|\bnon\s+iniziat[oa]\b|\bnon\s+ha\s+(?:iniziato|assunto)\b|\bnon\s+(?:assume|prende|usa|assumeva)\s+pi[uù](?!\w)|\bha\s+smesso\b|\bmantenuta?\s+sosp(?:eso|esa)\b/i;

// Pattern stretto per segnale immediato di sospensione (max 80 car. dopo il farmaco).
// Usato per override anche quando il farmaco appare nella sezione terapia attiva.
const SOSP_NARROW_AFTER_RE = /^[\s,;:(]+(?:sosp(?:eso|esa|esi|ese)|interrott[oa]|smessa?|cessata?|non\s+tollerat[oa])\b/i;

const PRN_AFTER_RE = /\bal\s+bisogno\b|\ball['’]?\s*occorrenza\b|\bse\s+(?:dolore|necessario|serve|sintomatic|dolorabilit)|\bin\s+caso\s+di\s+(?:dolore|necessit|riacutizz|attacc)|\bcicl[oi]\s+brev[ei]\b|\bripetibile\b|\bsolo\s+se\s+necessario\b|\bquando\s+necessario\b|\bper\s+\d+(?:\s*-\s*\d+)?\s+(?:giorni|gg)\b[^.;\n]{0,40}\b(?:poi\s+(?:stop|sospen)|sospen|stop)\b|\bmax\b[^.;\n]{0,20}\bvolt[ae]\b/i;
const PRN_LABEL_RE = /(?:\bse\s+dolore|\bse\s+necessario|\bal\s+bisogno|\bin\s+caso\s+di|\ball['’]?\s*occorrenza)\s*:\s*$/i;
const PRN_ABBREV_RE = /\bprn\b|\ba\.\s?b\.|\bal\s+bis\.?(?!\w)/i;
const PRN_AB_BARE_RE = /(?:^|[\s,;(])ab(?![A-Za-z.])(?!\s*anti)/;
const PRN_BEFORE_RE = /\bin\s+caso\s+di\s+[^.;\n]{0,80}\s*:?\s*$/i;
const PRN_NEXT_THERAPY_CUE_RE = /(?:^|[\s.;,\n-])in\s+caso\s+di\s+[^.;\n]{0,80}$/i;

const START_DECISION_RE  = /\b(?:avvia|avviare|avviat[oa]|inizia|iniziare|iniziat[oa]|introduce|introdurre|introdott[oa]|intraprende|intraprendere|intrapres[oa]|imposta|impostare|impostat[oa]|prescrive|prescrivere|prescritt[oa]|riprende|riprendere|ripres[oa]|riavvia|riavviare|reintroduce|reintrodurre)\b/i;
const STOP_DECISION_RE   = /\b(?:sospende|sospendere|sospendono|sospes[oa]|sospesi|interrompe|interrompere|interrompono|interrott[oa]|cessa|cessare|cessat[oa])\b/i;
const CHANGE_DECISION_RE = /\b(?:aumenta|aumentare|aumentat[oa]|incrementa|incrementare|riduce|ridurre|ridott[oa]|riduzione|scala|scalare|scalat[oa]|scalando|scalaggio|tapering|decalage|decrementa|decrementare|modifica|modificare|sostituisce|sostituire|switch)\b/i;
const CHANGE_AFTER_RE    = /\b(?:da\s+\d[\d.,]*\s*\S*\s+a\s+\d|ridott[oa]\s+a|aumentat[oa]\s+a|portat[oa]\s+a)\b/i;
const VISIT_EVENT_HISTORICAL_RE = /\b(?:in\s+passato|pregress|anamnes|storicamente)\b/i;

function _matchNearestVerb(win, re) {
  const g = new RegExp(re.source, "gi");
  let m, last = null;
  while ((m = g.exec(win)) !== null) last = m;
  return last;
}

function inferVisitTherapyEvent(beforeWin, afterWin, drugName) {
  if (VISIT_EVENT_HISTORICAL_RE.test(beforeWin)) return null;
  const noOtherDrug = (winText, fromIdx) => {
    const seg = winText.slice(fromIdx);
    return !DRUG_PATTERNS.some(([p, n, , cs]) =>
      n !== drugName && new RegExp(p.source, cs ? "" : "i").test(seg));
  };
  const notNegated = (winText, idx) =>
    !/\b(?:non|mai|senza)\s*$/i.test(winText.slice(Math.max(0, idx - 7), idx));
  for (const [re, ev] of [[STOP_DECISION_RE, "stop"], [CHANGE_DECISION_RE, "change"], [START_DECISION_RE, "start"]]) {
    const m = _matchNearestVerb(beforeWin, re);
    if (m && notNegated(beforeWin, m.index) && noOtherDrug(beforeWin, m.index + m[0].length)) return ev;
  }
  if (CHANGE_AFTER_RE.test(afterWin)) return "change";
  return null;
}

function getActiveSectionText(text) {
  const m = text.match(
    /(?:TERAPIA\s+IN\s+ATTO|TERAPIA\s+ATTUALE|TERAPIA\s+IN\s+CORSO)\s*([\s\S]*?)(?=\n{2,}|\n[A-ZÀÈÌÒÙ][A-ZÀÈÌÒÙ\s']{3,}[:\n]|$)/i
  );
  return m ? m[1] : "";
}

function extractTherapies(text, today, scopeKind = null) {
  const found = [];
  const seenNames = new Set();

  const activeSectionText = getActiveSectionText(text);

  for (const [pattern, drugName, category, caseSensitive] of DRUG_PATTERNS) {
    const globalRe = new RegExp(pattern.source, caseSensitive ? "g" : "gi");
    let match;
    let first = true;
    while ((match = globalRe.exec(text)) !== null && first) {
      first = false;
      if (seenNames.has(drugName)) break;
      seenNames.add(drugName);

      // Context starts AT the drug match (never before) to avoid leaking dose/freq
      // from adjacent drugs that appear earlier in a comma-separated therapy list.
      // Window extended to 200 chars to capture long-interval patterns like
      // "ogni 4 settimane" / "spacing a 4 settimane" that may follow the dose.
      const ctxStart   = match.index;
      const ctxEnd     = Math.min(text.length, match.index + match[0].length + 200);
      const context    = text.slice(ctxStart, ctxEnd);
      const ctxBefore  = text.slice(Math.max(0, match.index - 250), match.index);
      const ctxAfter   = text.slice(match.index + match[0].length, ctxEnd);

      let doseScope = context;
      {
        const afterDrug = context.slice(match[0].length);
        let nextDrugRel = Infinity;
        for (const [p2, name2, , cs2] of DRUG_PATTERNS) {
          if (name2 === drugName) continue;
          const m2 = new RegExp(p2.source, cs2 ? "" : "i").exec(afterDrug);
          if (m2 && m2.index < nextDrugRel) nextDrugRel = m2.index;
        }
        if (nextDrugRel !== Infinity) {
          const cueM = afterDrug.slice(0, nextDrugRel).match(PRN_NEXT_THERAPY_CUE_RE);
          let limit = nextDrugRel;
          if (cueM) {
            const preCueScope = afterDrug.slice(0, cueM.index);
            const currentHasFreq = FREQ_PER_WEEK.test(preCueScope) ||
              FREQ_INTERVAL.test(preCueScope) || FREQ_GENERAL.test(preCueScope) ||
              /\b(?:mattina|sera|fino\s+al)\b/i.test(preCueScope);
            if (currentHasFreq) limit = cueM.index;
          }
          doseScope = context.slice(0, match[0].length + limit);
        }
      }

      const { dose, frequency: _doseFreq } = extractDoseAndFrequency(doseScope);
      let frequency = _doseFreq;

      // ── THERAPY-DIAG logging ──────────────────────────────────────────────
      {
        const _T = (msg) => _trace("[THERAPY-DIAG] " + msg);
        _T(`─── ${drugName} ─────────────────────────────`);
        _T(`  match pos=${match.index}`);
        _T(`  context (${ctxStart}→${ctxEnd}, ${ctxEnd - ctxStart} car)`);
        _T(`  DOSE_RE: ${DOSE_RE.source}`);
        const doseReTry = context.match(DOSE_RE);
        _T(`  DOSE_RE match: ${doseReTry ? "sì" : "no"}`);
        const freqPwM    = doseScope.match(FREQ_PER_WEEK);
        const freqIntM   = doseScope.match(FREQ_INTERVAL);
        const freqGenM   = doseScope.match(FREQ_GENERAL);
        _T(`  FREQ_PER_WEEK match: ${freqPwM ? "sì" : "no"}`);
        _T(`  FREQ_INTERVAL match: ${freqIntM ? "sì ← PRIORITÀ ALTA" : "no"}`);
        if (freqGenM) {
          _T(`  FREQ_GENERAL match: sì`);
          const alts = [
            { label: "N volta/e al giorno|a settimana", re: /\b(\d+)\s*(?:volta|volte|times?)\s*(?:al\s*(?:giorno|day)|a\s*settimana|weekly)/i },
            { label: "die|bid|tid|qid|once|biweekly|mensile", re: /\b(?:die|bid|tid|qid|once\s+(?:daily|weekly)|biweekly|mensile)\b/i },
            { label: "every N day/week", re: /\bevery\s+\d+\s+(?:day|week)/i },
            { label: "ogni N settimane/giorni/mesi", re: /\bogni\s+\d+\s+(?:settiman[ae]|giorni?|mes[ei]|weeks?|months?|days?)\b/i },
            { label: "spacing a N settimane", re: /\bspacing\s+a\s+\d+\s+settiman[ae]\b/i },
            { label: "una/un' volta a settimana | settimanale", re: /\b(?:una|un['’])\s+volta\s+a\s+settimana\b|\bsettimanale\b/i },
          ];
          const matched = alts.filter(a => a.re.test(context));
          _T(`  FREQ_GENERAL alt(s) che matchano nel context: ${matched.length ? matched.map(a => a.label).join(" | ") : "NESSUNA (?)"}`);
        } else {
          _T(`  FREQ_GENERAL match: no`);
        }
        _T(`  → dose: ${dose ? "estratta" : "assente"} frequency: ${frequency ? "estratta" : "assente"}`);
      }
      // ─────────────────────────────────────────────────────────────────────

      const routeM = doseScope.match(ROUTE_RE);
      const route  = routeM ? normalizeRoute(routeM[0]) : null;

      const _prnScope = prnSentenceScope(doseScope);
      const _prnAbbrevScope = prnSentenceScope(doseScope).slice(match[0].length);
      const _beforeStart = Math.max(0, match.index - 120);
      const _beforeWin = text.slice(_beforeStart, match.index);
      const _beforeM = _beforeWin.match(PRN_BEFORE_RE);
      let _prnBefore = false;
      if (_beforeM) {
        const _cueAbs = _beforeStart + _beforeM.index;
        const _preCue = text.slice(Math.max(0, _cueAbs - 35), _cueAbs);
        const _cueOwnedByPrev = DRUG_PATTERNS.some(([p4, n4, , cs4]) =>
          n4 !== drugName && new RegExp(p4.source, cs4 ? "" : "i").test(_preCue));
        _prnBefore = !_cueOwnedByPrev;
      }
      const isPrn = PRN_AFTER_RE.test(_prnScope) ||
        PRN_LABEL_RE.test(text.slice(Math.max(0, match.index - 80), match.index)) ||
        _prnBefore ||
        PRN_ABBREV_RE.test(_prnAbbrevScope) ||
        PRN_AB_BARE_RE.test(_prnAbbrevScope);
      if (isPrn) frequency = "al bisogno";

      // ── Determina status: "active" vs "discontinued" ────────────────────────
      let status = "active";
      const inActiveSection = activeSectionText &&
        new RegExp(pattern.source, caseSensitive ? "" : "i").test(activeSectionText);

      const hasPastBefore = PAST_BEFORE_RE.test(ctxBefore);
      const hasPastAfter  = PAST_AFTER_RE.test(ctxAfter);
      const hasTaperingContext = TAPERING_CONTEXT_RE.test(context) || /\b(?:riduce|ridurre|scala|scalare|scalaggio)\b/i.test(ctxBefore.slice(-80));

      if (!inActiveSection) {
        if (!hasTaperingContext && (hasPastBefore || hasPastAfter)) status = "discontinued";
      } else {
        // Anche dentro TERAPIA IN ATTO: se il farmaco è immediatamente seguito
        // da un qualificatore di sospensione (es. "Colchicina, sospesa per GI")
        // nel contesto stretto ≤80 caratteri, si sovrascrive ad "discontinued".
        if (!hasTaperingContext && SOSP_NARROW_AFTER_RE.test(ctxAfter.slice(0, 80))) status = "discontinued";
      }

      // ── Estrai motivo sospensione ────────────────────────────────────────────
      let notes = null;
      let discontinuation_reason = null;
      if (status === "discontinued") {
        const reasonM = ctxAfter.match(PAST_AFTER_RE);
        if (reasonM) {
          const extracted = reasonM[0].replace(/[()]/g, "").trim();
          notes = extracted;
          discontinuation_reason = extracted;
        } else {
          // Cerca "per <motivo>" nel contesto dopo il farmaco (testo libero)
          const perAfterM = ctxAfter.match(
            /\bper\s+((?:intolleranza|nausea|diarrea|vomito|gastrite|dispepsia|effett[io]\s+(?:gastrointestinal[ei]|avvers[io]|collateral[ei])|tossicit[àa]|allergi[ae]|inefficacia|inefficace|mancanza\s+di\s+effetto|scarsa\s+tollerabilit[àa]|bruciore)[^.;\n]{0,80})/i
          );
          if (perAfterM) {
            discontinuation_reason = perAfterM[1].trim().replace(/[,.]$/, "");
            notes = `sospeso per ${discontinuation_reason}`;
          } else {
            // Fallback: qualsiasi "per X" entro i primi 120 caratteri dopo il farmaco
            const genericPerM = ctxAfter.match(/\bper\s+([^.;\n]{3,60})/);
            if (genericPerM) {
              discontinuation_reason = genericPerM[1].trim().replace(/[,.]$/, "");
              notes = `sospeso per ${discontinuation_reason}`;
            }
          }
        }
      }

      // Keep a short fragment of the source text for the review UI
      const sourceFragment = text
        .slice(Math.max(0, match.index - 5), Math.min(text.length, match.index + 80))
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 90);
      const _visit_event = scopeKind === "ind"
        ? inferVisitTherapyEvent(ctxBefore.slice(-48), ctxAfter.slice(0, 30), drugName)
        : null;
      found.push({ drug_name: drugName, category, dose, frequency, route, start_date: null, status, notes, discontinuation_reason, source_fragment: sourceFragment, _prn: isPrn, _visit_event });
    }
  }

  return found;
}

// ── 4b. Secondo passaggio: sospensioni riportate nel narrativo ────────────────
// extractTherapies opera su _domScope (TERAPIA DOMICILIARE) e _indScope
// (INDICAZIONI). Se il medico scrive "Ha sospeso la Colchicina" nell'ANAMNESI
// INTERVALLARE, quel contesto non raggiunge mai extractTherapies.
// Questa funzione:
//  A) corregge lo status di farmaci già nella lista ma classificati "active"
//     quando il narrativo indica sospensione recente
//  B) emette nuove voci "discontinued" per farmaci NON presenti nella lista
//     terapie ma menzionati nel narrativo con segnale di sospensione recente
//     (es. omessi dalla TERAPIA DOMICILIARE perché già sospesi al momento
//     della visita)
//
// Per evitare falsi positivi storici ("in passato ha assunto MTX"), il caso B
// usa solo il sottoinsieme "recente" di PAST_BEFORE_RE.
const RECENT_DISC_BEFORE_RE = /\bmantiene?\s+sosp(?:eso|esa|esi|ese)\b|\bha\s+(?:sosp(?:eso|esa)|interrott[oa]|smesso|smessa|cessato|cessata|fermato)\b|\bpaziente\s+(?:ha\s+)?(?:sosp(?:eso|esa)|interrott[oa]|smesso|smessa)\b|\b(?:sospende|interrompe|smette)\s+(?:in\s+autonomia|autonomamente)\b|\bsospesa?\s+(?:autonomamente|in\s+autonomia|dalla?\s+paziente|dal\s+paziente)\b|\bnon\s+ha\s+(?:iniziato|assunto|preso)\b/i;

function _extractDiscReason(ctxAfter) {
  const reasonM = ctxAfter.match(PAST_AFTER_RE);
  if (reasonM) {
    if (/\bper\s*$/i.test(reasonM[0])) {
      const afterPer = ctxAfter.slice(reasonM.index + reasonM[0].length).trim();
      const m = afterPer.match(/^([^.;\n]{3,60})/);
      if (m) {
        const clause = m[1].split(/\s+e\s+(?:successivamente|poi|quindi|dal?\b)/i)[0];
        return clause.trim().replace(/[,.]$/, "");
      }
    }
    return reasonM[0].replace(/[()]/g, "").trim();
  }
  const perKeyM = ctxAfter.match(
    /\bper\s+((?:intolleranza|nausea|diarrea|vomito|dolore(?:\s+\w+)?|gastrite|dispepsia|effett[io]\s+(?:gastrointestinal[ei]|avvers[io]|collateral[ei])|tossicit[àa]|allergi[ae]|inefficacia|inefficace|mancanza\s+di\s+effetto|scarsa\s+tollerabilit[àa]|bruciore)[^.;\n]{0,80})/i
  );
  if (perKeyM) return perKeyM[1].trim().replace(/[,.]$/, "");
  const genericM = ctxAfter.match(/\bper\s+([^.;\n]{3,80})/);
  return genericM ? genericM[1].trim().replace(/[,.]$/, "") : null;
}

function applyNarrativeDiscontinuations(therapies, narrativeText, rheuCategories, allowStatusOverride = true) {
  if (!narrativeText) return therapies;
  const existingNames = new Set(therapies.map((t) => t.drug_name));
  const newEntries = [];

  for (const [pattern, drugName, category, caseSensitive] of DRUG_PATTERNS) {
    const re = new RegExp(pattern.source, caseSensitive ? "g" : "gi");
    let match;
    while ((match = re.exec(narrativeText)) !== null) {
      const ctxBefore  = narrativeText.slice(Math.max(0, match.index - 250), match.index);
      const afterStart = match.index + match[0].length;
      // Finestra estesa a 400 car. per coprire frasi narrative con sospensione distante
      const ctxAfter   = narrativeText.slice(afterStart, Math.min(narrativeText.length, afterStart + 400));

      const hasBefore  = PAST_BEFORE_RE.test(ctxBefore.slice(-80));

      // Per PAST_AFTER_RE verifica che il match non cada in "mai sospeso" / "non sospeso"
      // (es. "Medrol 4 mg mai sospeso dal 2011" → falso positivo via "sospeso dal")
      let hasAfter = false;
      const afterM = PAST_AFTER_RE.exec(ctxAfter);
      if (afterM) {
        const prePad = ctxAfter.slice(Math.max(0, afterM.index - 5), afterM.index);
        if (!/\b(?:mai|non)\s*$/i.test(prePad)) {
          // Segnali deboli (non tollerato, non iniziato) sono validi solo
          // se il farmaco e il segnale di sospensione si trovano nella stessa frase
          // (meno di 2 confini di frase tra loro). Previene casi come "Targin,
          // non tollerato" 200 char dopo Urbason che falsamente sospende Urbason.
          const isWeakSignal = /\bnon\s+tollerat[oa]\b|\bnon\s+iniziat[oa]\b/.test(afterM[0]);
          if (isWeakSignal) {
            const interlude = ctxAfter.slice(0, afterM.index);
            const sentenceBreaks = (interlude.match(/[.!?]\s+[A-Z]|\n/g) || []).length;
            if (sentenceBreaks < 2) hasAfter = true;
          } else {
            hasAfter = true;
          }
        }
      }
      if (!hasAfter) hasAfter = SOSP_NARROW_AFTER_RE.test(ctxAfter.slice(0, 80));

      if (!hasBefore && !hasAfter) continue;

      const discontinuation_reason = _extractDiscReason(ctxAfter);

      if (existingNames.has(drugName)) {
        if (!allowStatusOverride) continue;
        // Caso A: correggi status del farmaco già in lista
        // Continua nel loop per trovare eventuale occorrenza con ragione migliore
        const alreadyDisc = therapies.some((t) => t.drug_name === drugName && t.status === "discontinued");
        therapies = therapies.map((t) => {
          if (t.drug_name !== drugName || t.status !== "active") return t;
          return {
            ...t,
            status: "discontinued",
            discontinuation_reason,
            notes: discontinuation_reason ? `sospeso per ${discontinuation_reason}` : (t.notes || null),
          };
        });
        // Se già in lista come discontinued, aggiorna la ragione solo se quella nuova è più ricca
        if (alreadyDisc && discontinuation_reason) {
          therapies = therapies.map((t) => {
            if (t.drug_name !== drugName || t.status !== "discontinued") return t;
            if (t.discontinuation_reason) return t;
            return { ...t, discontinuation_reason, notes: `sospeso per ${discontinuation_reason}` };
          });
        }
      } else if (rheuCategories && rheuCategories.has(category)) {
        // Caso B: emetti nuova voce discontinued
        const hasRecentBefore = RECENT_DISC_BEFORE_RE.test(ctxBefore);
        if (!hasRecentBefore && !hasAfter) continue;
        const existing = newEntries.find((e) => e.drug_name === drugName);
        if (existing) {
          // Aggiorna la ragione se quella nuova è più ricca (es. "intolleranza GI" > null)
          if (!existing.discontinuation_reason && discontinuation_reason) {
            existing.discontinuation_reason = discontinuation_reason;
            existing.notes = `sospeso per ${discontinuation_reason}`;
          }
          continue;
        }
        const sourceFragment = narrativeText
          .slice(Math.max(0, match.index - 5), Math.min(narrativeText.length, match.index + 80))
          .replace(/\s+/g, " ").trim().slice(0, 90);
        newEntries.push({
          drug_name: drugName,
          category,
          dose: null,
          frequency: null,
          route: null,
          start_date: null,
          status: "discontinued",
          notes: discontinuation_reason ? `sospeso per ${discontinuation_reason}` : null,
          discontinuation_reason,
          source_fragment: sourceFragment,
        });
        existingNames.add(drugName);
      }
      // Nessun break: continua a scansionare le occorrenze successive dello stesso
      // farmaco per trovare segnali di sospensione più specifici (es. ragione "per X")
    }
  }

  return [...therapies, ...newEntries];
}

// ── 5. Info paziente ──────────────────────────────────────────────────────────
function extractPatientInfo(text, diagScope) {
  const info = {};

  // Diagnosi ristretta alle sezioni cliniche (diagScope): evita di catturare
  // testo di esame obiettivo o referti strumentali (es. ecografia "ginocchio dx: ...").
  // Demografica (sesso/eta/peso) usa sempre il testo intero.
  const dScope = diagScope || text;

  // Esplicita "diagnosi:/diag.: X". Rimosso l'alias "Dx" che con flag i collideva
  // con "dx" (destro); "diag." richiede il punto per evitare match spuri.
  const diagExplicit = dScope.match(/\b(?:diagnosi|diag\.)\s*[:\-]\s*([^\n.;]{5,120})/i);
  if (diagExplicit) {
    info.diagnosi = diagExplicit[1].trim().replace(/,\s*$/, "");
  } else {
    // Frase di apertura: "affetto/a da X", "con diagnosi di X", "diagnosi: X"
    // oppure incipit motivo-visita esplicito "visita/(di) controllo ... in paziente
    // con/affetto da X" (il qualificatore di visita evita di scambiare un sintomo
    // generico "paziente con dolore..." per diagnosi).
    const openingScope = dScope.slice(0, 800);
    const openingM = openingScope.match(
      /(?:affett[oa]\s+da|con\s+diagnosi\s+di|diagnosi[:\s]+|(?:di\s+)?(?:visita|controllo|ambulatoriale|rivalutazione|follow[\s-]?up)\b[^.\n]*?\bin\s+paziente\s+(?:con|affett[oa]\s+da)\s+)\s*([^\n.;,]{5,120})/i
    );
    if (openingM) {
      // Tronca dopo "in terapia"/"per cui" per non includere la terapia
      let diag = openingM[1].trim();
      diag = diag.replace(/\s+(?:in\s+terapia|follow.up|per\s+cui|che\s+|dal\s+\d).*/i, "").trim();
      diag = diag.replace(/,\s*$/, "");
      if (diag.length >= 5) info.diagnosi = diag;
    }
  }

  // Sesso
  if (/\b(?:maschio|uomo|signor\b(?!a)|paziente\s+M\.?\b|\baffetto\b|\bfumatore\b|\bpaziente\s+di\s+\d+\s+anni,?\s+M\b)/i.test(text))
    info.sesso = "M";
  else if (/\b(?:femmina|donna|signora|paziente\s+F\.?\b|\baffetta\b|\bfumatrice\b)/i.test(text))
    info.sesso = "F";
  else {
    const sm = text.match(/\bpaziente[^,\n]*,?\s*(\d+)\s*anni[,\s]+([MF])\b/i);
    if (sm) info.sesso = sm[2].toUpperCase();
  }

  // Età — solo età demografica esplicita. Rifiuta range ("20-25 anni"),
  // durata/contesto temporale ("da circa 10 anni", "fino ai N anni") ed esordio
  // narrativo ("benessere fino ai N anni"). Se nessun match valido → eta resta null.
  const etaRe = /\b(\d{1,2})\s+anni\b/gi;
  let em;
  while ((em = etaRe.exec(text)) !== null) {
    const age = parseInt(em[1]);
    if (age < 1 || age > 110) continue;
    const numStart = em.index;
    const pre = text.slice(Math.max(0, numStart - 16), numStart);
    const post = text.slice(numStart + em[1].length, numStart + em[1].length + 3);
    if (/[-–]\s*$/.test(pre)) continue;            // lato destro di un range "20-25"
    if (/^\s*[-–]\s*\d/.test(post)) continue;       // lato sinistro di un range "20-25"
    if (/\b(?:da|fino|ai|dopo|per|ogni|circa|verso|entro|tra|fra)\s*$/i.test(pre)) continue;
    if (/esordi|insorgenz|comparsa|benessere/i.test(pre)) continue;
    info.eta = age;
    break;
  }

  // Peso — "peso[: ] 72 kg", "peso corporeo 80 kg", o "72 kg"; sanity 40-250 kg.
  let pm = text.match(/\bpeso\b[^\d\n]{0,15}(\d{2,3}(?:[.,]\d)?)\s*(?:[Kk]g)?/);
  if (!pm) pm = text.match(/\b(\d{2,3}(?:[.,]\d)?)\s*[Kk]g\b/);
  if (pm) {
    const w = parseFloat(pm[1].replace(",", "."));
    if (w >= 40 && w <= 250) info.peso_kg = w;
  }

  return Object.keys(info).length > 0 ? info : null;
}

// ── 6. Raggruppamento lab per data+pannello → lab_exams ──────────────────────
const PANEL_TO_CATEGORY = {
  fase_acuta:    "ematochimici",
  emocromo:      "emocromo",
  complemento:   "immunologia",
  funzione:      "funzione_organi",
  urine:         "urine",
  elettroforesi: "elettroforesi",
  custom:        "altro",
};

/**
 * Converts output of extractLabValuesByDate() into lab_exams array.
 * One record per date (all panels merged) — one draw = one record.
 * Each result keeps its `panel` field for display grouping.
 * Le date non riconosciute restano null: mai inventate.
 */
function groupLabValuesByDate(dateGroups) {
  const NULL_KEY = "__no_date__";
  const byDate = {};
  for (const { date, items } of dateGroups) {
    if (!items || !items.length) continue;
    const key = date || NULL_KEY;
    if (!byDate[key]) byDate[key] = [];
    for (const lv of items) {
      const result = { name: lv.label, panel: lv.panel || "custom" };
      if (lv.value != null) { result.value = String(lv.value); result.unit = lv.unit || ""; }
      if (lv.qualitative) result.qualitative = lv.qualitative;
      if (lv.status) result.status = lv.status;
      if (lv.inferred_unit)  result.inferred_unit  = true;
      if (lv.confidence)     result.confidence     = lv.confidence;
      if (lv.review_reason)  result.review_reason  = lv.review_reason;
      if (lv.sourceText)     result.source_text    = lv.sourceText;
      if (lv.key)            result.param_key      = lv.key;
      byDate[key].push(result);
    }
  }
  const exams = [];
  for (const [key, results] of Object.entries(byDate)) {
    if (!results.some(r => r.value != null || r.qualitative)) continue;
    exams.push({ date: key === NULL_KEY ? null : key, results });
  }
  return exams;
}

// ── 7. Profilo SSc ───────────────────────────────────────────────────────────
// Helper: verifica se un match è preceduto da negazione nel testo circostante.
// Gestisce propagazione a lista: "Non tosse, dispnea, disfagia" → tutti negati.
// La finestra viene troncata all'ultimo boundary di frase/clausola (., ;, \n)
// per evitare che una negazione di una frase precedente contamini la successiva.
function isNegated(text, matchIndex, windowBefore = 120) {
  const before = text.slice(Math.max(0, matchIndex - windowBefore), matchIndex);
  // Prendi solo il testo dopo l'ultimo boundary di frase/clausola
  const sinceBreak = before.replace(/^[\s\S]*[.;\n]/, "").trimStart();
  return /\b(?:negativa?\s+per|senza\b|assenza\s+di|nega\b|non\b|no\s|esclude?)\b/i.test(sinceBreak);
}

// Parsa una data in formato DD/MM/YYYY o DD/M/YY restituendo YYYY-MM-DD
function parseDateSsc(raw) {
  if (!raw) return null;
  const parts = raw.split(/[\/\-\.]/);
  if (parts.length !== 3) return null;
  const [d, mo, yy] = parts;
  const y = yy.length === 2
    ? (parseInt(yy) < 50 ? `20${yy.padStart(2, "0")}` : `19${yy.padStart(2, "0")}`)
    : yy;
  if (isNaN(parseInt(y)) || isNaN(parseInt(mo)) || isNaN(parseInt(d))) return null;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function extractScleroProfile(text) {
  if (!/scleroderm|sclerosi\s+sistemica|\bSSc\b|\bLSSc\b|\bDSSc\b|CREST/i.test(text)) return null;

  const profile = {};

  // ── Cute ─────────────────────────────────────────────────────────────────
  // Form keys: subset ("limited"/"diffuse"), mrss_score, sclerodactyly, telangiectasias, puffy_fingers
  const cutaneous = {};
  if (
    /\b(?:LSSc|SSc\s+limit|limited\s+(?:cutaneous\s+)?SSc|CREST)\b/i.test(text) ||
    /sclerosi\s+sistemica\s+cutanea\s+limit|sistemica\s+limit|cutanea\s+limit/i.test(text)
  ) {
    cutaneous.subset = "limited";
  } else if (
    /\b(?:DSSc|SSc\s+diff|diffuse\s+(?:cutaneous\s+)?SSc)\b/i.test(text) ||
    /sclerosi\s+sistemica\s+cutanea\s+diff|cutanea\s+diff/i.test(text)
  ) {
    cutaneous.subset = "diffuse";
  }
  const mrssM = text.match(/\bmRSS\s*[=:\s]\s*(\d+)/i);
  if (mrssM) cutaneous.mrss_score = parseInt(mrssM[1]);
  if (/sclerodattili/i.test(text)) cutaneous.sclerodactyly = true;
  if (/telangiectasi/i.test(text)) cutaneous.telangiectasias = true;
  if (/puffy\s+(?:hands|fingers)|dita\s+gonfie/i.test(text)) cutaneous.puffy_fingers = true;
  if (Object.keys(cutaneous).length) profile.cutaneous = cutaneous;

  // ── Anticorpi ─────────────────────────────────────────────────────────────
  // Form uses TriState with values "pos"/"neg"/"borderline"
  const antibody = {};
  if (/anti[-\s]?Scl[-\s]?70|anti[-\s]?topoisomerasi\s+I/i.test(text)) antibody.scl70 = "pos";
  if (/anti[-\s]?centromero|ACA\b/i.test(text)) antibody.aca = "pos";
  if (/anti[-\s]?RNA[-\s]?pol|RNAP\s*III/i.test(text)) antibody.rnap3 = "pos";
  if (/anti[-\s]?PM[-\s]?Scl/i.test(text)) antibody.pm_scl = "pos";
  if (/anti[-\s]?Th[-\s]?To/i.test(text)) antibody.th_to = "pos";
  if (/anti[-\s]?U1[-\s]?RNP|U1RNP/i.test(text)) antibody.u1rnp = "pos";
  if (Object.keys(antibody).length) profile.antibody = antibody;

  // ── Vascolare ─────────────────────────────────────────────────────────────
  // Form keys: raynaud ("absent"/"primary"/"secondary"), raynaud_onset_year,
  //   digital_ulcers ("none"/"past"/"active_one"/"active_multiple"),
  //   capillaroscopy_pattern, capillaroscopy_date, pitting_scars
  const vascular = {};
  const raynaudM = text.match(/fenomeno\s+di\s+Raynaud|\bRaynaud\b/i);
  if (raynaudM && !isNegated(text, raynaudM.index)) {
    vascular.raynaud = "secondary"; // in SSc context almost always secondary
    const raynaudOnsetM = text.match(
      /(?:esordio|comparsa|inizio)\s+(?:del\s+)?(?:fenomeno\s+di\s+)?Raynaud\s+(?:nel\s+)?(\d{4})/i
    );
    if (raynaudOnsetM) {
      vascular.raynaud_onset_year = parseInt(raynaudOnsetM[1]);
    } else {
      const durationM = text.match(
        /Raynaud\s+(?:da\s+circa\s+|da\s+)?(\d+)(?:\s*[-–]\s*(\d+))?\s*anni/i
      );
      if (durationM) {
        const years = parseInt(durationM[2] || durationM[1]);
        vascular.raynaud_onset_year = new Date().getFullYear() - years;
      }
    }
  }
  const udM = text.match(/ulcere?\s+digit(?:ali)?|digital\s+ulcer/i);
  if (udM) {
    const ctxAfterUD  = text.slice(udM.index, udM.index + 80);
    const ctxBeforeUD = text.slice(Math.max(0, udM.index - 60), udM.index);
    const currentlyAbsent = /non\s+ulcere|assent|ora\s+assent|non\s+present|non\s+vi\s+son/i.test(ctxAfterUD);
    const historical      = /in\s+anamnesi|storicamente|anamnest|passato|pregresss/i.test(ctxBeforeUD) || currentlyAbsent;
    vascular.digital_ulcers = (currentlyAbsent || historical) ? "past" : "active_one";
  }
  const capM = text.match(/capillaroscopi/i);
  if (capM && !isNegated(text, capM.index)) {
    if (/pattern\s+(?:early|precoce)/i.test(text))           vascular.capillaroscopy_pattern = "early";
    else if (/pattern\s+(?:attivo|active)/i.test(text))       vascular.capillaroscopy_pattern = "active";
    else if (/pattern\s+(?:tardivo|late)/i.test(text))        vascular.capillaroscopy_pattern = "late";
    // Extract capillaroscopy date
    const capDateM = text.match(
      /capillaroscopi\w+[^.\n]{0,80}?(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i
    );
    if (capDateM) {
      const iso = parseDateSsc(capDateM[1]);
      if (iso) vascular.capillaroscopy_date = iso;
    }
  }
  const pittM = text.match(/pitting\s+scars|cicatrici\s+depresse/i);
  if (pittM && !isNegated(text, pittM.index)) vascular.pitting_scars = true;
  if (Object.keys(vascular).length) profile.vascular = vascular;

  // ── ILD ───────────────────────────────────────────────────────────────────
  // Form key: present ("no"/"yes_stable"/"yes_progressive"/"not_assessed"),
  //   hrct_pattern ("nsip"/"uip"/"op"/"mixed")
  const ild = {};
  const ildRe = /\bILD\b|interstiziopatia|fibrosi\s+polm|\bNSIP\b|\bUIP\b|\bIIP\b/gi;
  let ildMatch;
  while ((ildMatch = ildRe.exec(text)) !== null) {
    if (!isNegated(text, ildMatch.index)) {
      ild.present = "yes_stable";
      if (/NSIP/i.test(ildMatch[0]))      ild.hrct_pattern = "nsip";
      else if (/UIP/i.test(ildMatch[0]))  ild.hrct_pattern = "uip";
      break;
    }
  }
  if (!ild.present && /(?:negativa?\s+per\s+ILD|senza\s+ILD|no\s+ILD|ILD\s+assente)/i.test(text)) {
    ild.present = "no";
  }
  if (Object.keys(ild).length) profile.ild = ild;

  // ── GI ────────────────────────────────────────────────────────────────────
  // Form key: dysphagia (CheckRow → boolean)
  const gi = {};
  if (/disfagia/i.test(text)) {
    const disfM = text.match(/disfagia/i);
    gi.dysphagia = !isNegated(text, disfM.index);
  }
  if (Object.keys(gi).length) profile.gi = gi;

  // ── PAH ───────────────────────────────────────────────────────────────────
  const pah = {};
  const pahRe = /\bPAH\b|ipertensione\s+polm/gi;
  let pahM;
  while ((pahM = pahRe.exec(text)) !== null) {
    if (!isNegated(text, pahM.index)) { pah.present = true; break; }
  }
  if (Object.keys(pah).length) profile.pah = pah;

  return Object.keys(profile).length ? profile : null;
}

// ── 8. Profili malattia specifici ─────────────────────────────────────────────

function extractRaProfile(text) {
  if (!/artrite\s+reumatoide|\bAR\b/i.test(text)) return null;
  const profile = {};

  // RF
  if (/\bRF\b[^.]{0,30}pos|\bfattore\s+reumatoide\b[^.]{0,30}pos|\bRF\s*\+/i.test(text)) {
    profile.rf_status = "positive";
    const t = text.match(/\bRF\s*[=:]\s*(\d+(?:[.,]\d+)?)/i);
    if (t) profile.rf_titer = t[1].replace(",", ".");
  } else if (/\bRF\b[^.]{0,30}neg|\bfattore\s+reumatoide\b[^.]{0,30}neg|\bRF\s*-/i.test(text)) {
    profile.rf_status = "negative";
  }

  // ACPA / Anti-CCP
  if (/anti[\s-]?CCP[^.]{0,30}pos|ACPA[^.]{0,30}pos|anti[\s-]?CCP\s*\+/i.test(text)) {
    profile.acpa_status = "positive";
    const t = text.match(/anti[\s-]?CCP\s*[=:]\s*(\d+(?:[.,]\d+)?)/i);
    if (t) profile.acpa_titer = t[1].replace(",", ".");
  } else if (/anti[\s-]?CCP[^.]{0,30}neg|ACPA[^.]{0,30}neg|anti[\s-]?CCP\s*-/i.test(text)) {
    profile.acpa_status = "negative";
  }

  // ILD
  const ildIdx = text.search(/\bILD\b|interstiziopatia\s+polm/i);
  if (ildIdx !== -1 && !isNegated(text, ildIdx)) profile.ild = true;

  // Erosiva
  if (/malattia\s+erosiva|forma\s+erosiva|erosion[ei]\s+(?:articol|ossee|radiograf)/i.test(text))
    profile.disease_type = "erosive";

  return Object.keys(profile).length ? profile : null;
}

function extractSpaProfile(text) {
  if (!/spondiloartr|spondilite\s+anchilos|\bSpA\b|artrite\s+psoriasica|\bPsA\b|artrite\s+reattiva/i.test(text)) return null;
  const profile = {};

  if (/coinvolgimento\s+assiale|sede\s+assiale|sacroileite|sacroileit|lombalgia\s+infiamm|rachialgia\s+infiamm/i.test(text))
    profile.axial_involvement = true;
  if (/coinvolgimento\s+periferico|sede\s+periferica|artrite\s+periferica|oligoartrite|poliartrite/i.test(text))
    profile.peripheral_involvement = true;
  const mPs = text.match(/\bpsoriasi\b/i);
  if (mPs && !isNegated(text, mPs.index)) profile.psoriasis = true;
  const mUv = text.match(/\buveite\b/i);
  if (mUv && !isNegated(text, mUv.index)) profile.uveitis = true;
  const mIbd = text.match(/\bIBD\b|\bMICI\b|morbo\s+di\s+Crohn|rettocolite\s+ulcerosa/i);
  if (mIbd && !isNegated(text, mIbd.index)) profile.ibd = true;
  const mDat = text.match(/\bdattilite\b/i);
  if (mDat && !isNegated(text, mDat.index)) profile.dactylitis = true;
  const mEnt = text.match(/\bentesite\b/i);
  if (mEnt && !isNegated(text, mEnt.index)) profile.enthesitis = true;

  return Object.keys(profile).length ? profile : null;
}

function extractSleProfile(text) {
  if (!/\bLES\b|\bSLE\b|lupus\s+eritematoso/i.test(text)) return null;
  const profile = {};
  const antibodies = {};

  if (/\bANA\b[^.]{0,30}pos|antinucl[^.]{0,30}pos|\bANA\s*\+/i.test(text)) {
    antibodies.ana = { status: "positive" };
    const t = text.match(/ANA\s+(\d+:\d+)/i);
    if (t) antibodies.ana.titer = t[1];
  }
  if (/anti[\s-]?dsDNA[^.]{0,30}pos|\bdsDNA\s*\+/i.test(text)) {
    antibodies.dsdna = { status: "positive" };
    const v = text.match(/anti[\s-]?dsDNA\s*[=:]\s*(\d+(?:[.,]\d+)?)/i);
    if (v) antibodies.dsdna.value = v[1];
  } else if (/anti[\s-]?dsDNA[^.]{0,30}neg/i.test(text)) {
    antibodies.dsdna = { status: "negative" };
  }
  if (/anti[\s-]?Sm\b[^.]{0,30}pos/i.test(text)) antibodies.sm = { status: "positive" };
  if (/anti[\s-]?Ro\b[^.]{0,30}pos|SSA[^.]{0,20}pos/i.test(text)) antibodies.ro_ssa = { status: "positive" };
  if (/anti[\s-]?La\b[^.]{0,30}pos|SSB[^.]{0,20}pos/i.test(text)) antibodies.la_ssb = { status: "positive" };
  if (/anti[\s-]?RNP\b[^.]{0,30}pos|U1[\s-]?RNP[^.]{0,20}pos/i.test(text)) antibodies.rnp = { status: "positive" };
  if (/anticardiolipina[^.]{0,30}pos|\baCL\b[^.]{0,20}pos/i.test(text)) antibodies.apl_acl = { status: "positive" };
  if (/lupus\s+anticoagulant[^.]{0,30}pos|\bLAC\b[^.]{0,20}pos/i.test(text)) antibodies.apl_lac = { status: "positive" };

  if (Object.keys(antibodies).length) profile.antibodies = antibodies;

  const c3 = text.match(/\bC3\s*[=:]\s*(\d+(?:[.,]\d+)?)\s*(?:mg\/dL|g\/L)?/i);
  if (c3) profile.c3 = c3[1].replace(",", ".");
  const c4 = text.match(/\bC4\s*[=:]\s*(\d+(?:[.,]\d+)?)\s*(?:mg\/dL|g\/L)?/i);
  if (c4) profile.c4 = c4[1].replace(",", ".");

  if (/nefrite\s+lupica|coinvolgimento\s+renale|glomerulonefrite|nefropatia\s+lupica/i.test(text))
    profile.renal_involvement = true;
  const pr = text.match(/proteinuria\s+(?:di\s+)?(\d+(?:[.,]\d+)?)\s*(?:g\/24|mg\/24)/i);
  if (pr) profile.proteinuria_24h = pr[1].replace(",", ".");

  return Object.keys(profile).length ? profile : null;
}

// ── 8a-bis. Inline "Porta/In in visione" extraction ──────────────────────────
// "Porta in visione:" often appears as an inline phrase inside ANAMNESI_INTERVALLARE
// rather than as a standalone section header. Extract the ">" exam lines so they
// land in esami/imaging (instrScope) and NOT in the anamnesi text.
function extractInlineVisioneBlock(text) {
  if (!text) return { cleaned: null, visione: null };
  const visioneLines = [];
  const cleaned =
    text
      .replace(
        /(?:Porta|In)\s+in\s+visione\s*:[ \t]*\n((?:[ \t]*>[ \t]*[^\n]*\n?)+)/gi,
        (_, lines) => { visioneLines.push(lines.trim()); return ""; }
      )
      .trim() || null;
  return { cleaned, visione: visioneLines.length ? visioneLines.join("\n") : null };
}

// ── 8b. Sezioni cliniche libere ───────────────────────────────────────────────
// Estrae Raccordo anamnestico, Anamnesi intervallare, Esame obiettivo,
// Indicazioni e Conclusioni come testo libero mappato ai campi WorkupVisit.
//
// NOTA ARCHITETTURALE: questa funzione opera su vsScope, un testo sintetico
// ricostruito dal parser con header controllati sempre a inizio riga.
// Tutte le regex usano il flag `m` e ancora `^` per matchare SOLO header a inizio
// riga, evitando falsi positivi su frasi cliniche come "ultima visita di controllo"
// o "si consiglia proseguire" che appaiono nel corpo del testo.
function extractVisitSections(text) {
  const HEADERS = [
    // Rheumatologic history — all confirmed variants
    {
      key: "raccordo",
      re: /^(?:RACCORDO(?:\s+(?:REUMATOLOGICO|ANAMNESTIC\w+(?:\s+REUMATOLOGICO)?)?)?|ANAMNESI\s+REUMATOLOGICA(?:\s+REMOTA)?|STORIA\s+(?:CLINICA|REUMATOLOGICA)|DECORSO\s+CLINICO|EVOLUZIONE\s+CLINICA)\b/im,
    },
    // Reason for visit + current visit narrative / follow-up interval anamnesis
    // MOTIVO DELLA VISITA is included so raw-text fallback captures it under interval_history
    {
      key: "anamnesi",
      re: /^(?:MOTIVO\s+DELLA?\s+VISITA|ANAMNESI\s+INTERVALLARE(?:\s+DI\s+MALATTIA)?|VISITA\s+(?:ODIERNA|AMBULATORIALE|DI\s+CONTROLLO)(?:\s+\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})?|VISITA\s+\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|AGGIORNAMENTO\s+CLINICO|RIVALUTAZIONE|CONTROLLO)\b/im,
    },
    // Physical examination — all confirmed variants
    {
      key: "esame_obj",
      re: /^(?:ESAME\s+(?:OBIETTIVO(?:\s+REUMATOLOGICO)?|FISICO|REUMATOLOGICO)|OBIETTIVIT[AÀ]'?|OBB?IETTIVAMENTE|REPERTO\s+OBIETTIVO|EO)\b/im,
    },
    // Exit/discharge therapy — original verbatim text (controlled header from vsScope)
    {
      key: "terapia_uscita",
      re: /^TERAPIA\s+IN\s+USCITA\b/im,
    },
    // Recommendations and follow-up plan
    // NOTE: PROGRAMMA removed — too generic, matches "In programma biopsia..."
    // causing a false-positive that corrupts indicazioni and esame_obj.
    {
      key: "indicazioni",
      re: /^(?:INDICAZIONI|PIANO\s+(?:TERAPEUTICO|DIAGNOSTICO)|SI\s+CONSIGLIA|FOLLOW[\s\-]?UP|RACCOMANDAZIONI)\b/im,
    },
    // Final assessment — only confirmed variants
    {
      key: "conclusioni",
      re: /^(?:CONCLUSIONI|IMPRESSIONE\s+DIAGNOSTICA)\b/im,
    },
  ];

  // Find first match of each header and sort by position in text
  const found = [];
  for (const { key, re } of HEADERS) {
    const m = text.match(re);
    if (m) found.push({ key, start: m.index, end: m.index + m[0].length });
  }
  if (found.length === 0) return null;
  found.sort((a, b) => a.start - b.start);

  // Extract content from header-end to next header-start
  const sections = {};
  for (let i = 0; i < found.length; i++) {
    const contentStart = found[i].end;
    const contentEnd   = i + 1 < found.length ? found[i + 1].start : text.length;
    const content      = text.slice(contentStart, contentEnd)
      .replace(/^[\s:–\-\n]+/, "")
      .trim();
    const minLen = found[i].key === "terapia_uscita" ? 1 : 16;
    if (content.length >= minLen) sections[found[i].key] = content;
  }

  return Object.keys(sections).length ? sections : null;
}

// ── 9. Comorbidità ────────────────────────────────────────────────────────────
function extractComorbidita(text) {
  // Cerca la sezione COMORBIDITA' (testo fino alla riga successiva vuota o al prossimo header)
  const m = text.match(
    /COMORBI(?:DIT[AÀ]|LIT[AÀ])'?\s*([\s\S]*?)(?:\n{2,}|\n[A-ZÀÈÌÒÙ][A-ZÀÈÌÒÙ\s']{3,}(?:\n|:)|$)/i
  );
  if (!m) return null;
  const raw = m[1].trim();
  if (!raw || raw.length < 3) return null;
  // Split su virgole/semicoloni/newline, pulisci
  const items = raw.split(/[,;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2 && !/^(e|ed|o|od|e\/o)$/i.test(s));
  return items.length ? items : null;
}

// ── 9. Intolleranze / allergie ────────────────────────────────────────────────
function extractIntolleranze(text) {
  const results = [];

  // "Intolleranza a/ad X e Y (motivo)"
  const intRe = /intolleranz[ae]\s+(?:a[d]?\s+)?([^.\n]{3,120})/gi;
  let m;
  while ((m = intRe.exec(text)) !== null) {
    const raw = m[1].trim();
    // Separa "adalat e plendil (cefalea)" in items + motivo
    const reasonM = raw.match(/\(([^)]+)\)\s*$/);
    const reason  = reasonM ? reasonM[1].trim() : null;
    const drugsPart = reason ? raw.slice(0, reasonM.index).trim() : raw;
    const drugs = drugsPart.split(/\s+e\s+|\s+ed\s+|,\s*/i)
      .map((s) => s.trim()).filter(Boolean);
    drugs.forEach((d) => results.push({ drug: d, reason }));
  }

  // "allergia a X"
  const allRe = /allergi[ae]\s+a[d]?\s+(?:farmaci\s*[,.;]?\s*)?([^.\n]{3,80})/gi;
  while ((m = allRe.exec(text)) !== null) {
    const raw = m[1].trim();
    if (/^(?:nessun|nega|non\s+not|non\s+rif)/i.test(raw)) continue;
    const drugs = raw.split(/\s+e\s+|\s+ed\s+|,\s*/i).map((s) => s.trim()).filter(Boolean);
    drugs.forEach((d) => {
      if (!results.find((r) => r.drug.toLowerCase() === d.toLowerCase()))
        results.push({ drug: d, reason: "allergia" });
    });
  }

  return results.length ? results : null;
}

// ── 10. Riepilogo testuale ────────────────────────────────────────────────────
function buildSummary({ clinItems, labItems, therapies, comorbidita, intolleranze }) {
  const parts = [];
  if (clinItems.length) {
    const scores = clinItems.map((i) => `${i.label} ${i.score}`).join(", ");
    parts.push(`Score: ${scores}.`);
  }
  if (labItems.length) {
    parts.push(`${labItems.length} parametro/i di laboratorio rilevat${labItems.length === 1 ? "o" : "i"}.`);
  }
  const active = therapies.filter((t) => t.status !== "discontinued");
  const discont = therapies.filter((t) => t.status === "discontinued");
  if (active.length) parts.push(`Terapia attiva: ${active.map((t) => t.drug_name).join(", ")}.`);
  if (discont.length) parts.push(`Pregressa: ${discont.map((t) => t.drug_name).join(", ")}.`);
  if (comorbidita?.length) parts.push(`Comorbidità: ${comorbidita.join(", ")}.`);
  if (intolleranze?.length) parts.push(`Intolleranze: ${intolleranze.map((i) => i.drug).join(", ")}.`);
  if (!parts.length) return null;
  return parts.join(" ") + " — parser locale (zero costi). Verifica sempre i dati prima di applicare.";
}

// ── Parse-review: confidence model ───────────────────────────────────────────
/**
 * raccordoScore(text) → number
 *
 * Scores a text block for likelihood of containing rheumatologic history
 * (raccordo anamnestico). Used to detect misassigned or unassigned raccordo.
 * Threshold ≥ 3 → high confidence it is raccordo.
 */
function raccordoScore(text) {
  if (!text || text.length < 40) return 0;
  let score = 0;
  if (/\b(scleroder|SSc\b|artrite\s+reumatoide|\bAR\b|LES\b|lupus|overlap|connettivite|vasculite|spondilite)/i.test(text)) score += 2;
  if (/\b(diagnosi|esordio|riscontro|classificat|posta\s+diagnosi|stadiazione)\b/i.test(text)) score += 2;
  if (/\b(19|20)\d{2}\b/.test(text)) score += 1;
  if (/\b(valutata?|seguita?|effettuata?|rimasta?|impostata?|intrapresa?|avviata?)\b/i.test(text)) score += 1;
  if (/\b(stabile|invariata|progressione|miglioramento|remissione)\b/i.test(text)) score += 1;
  if (/^Paziente\b/.test(text.trim())) score += 1;
  if (text.length > 100) score += 1;
  // Penalise allergy-typical phrasing
  if (/\b(allergia\s+a|intolleranza\s+a|reazione\s+a|nega\s+allergi)\b/i.test(text)) score -= 2;
  return score;
}

/**
 * cleanPreamble(preamble) → string
 *
 * Strips PDF-form labels ("Conclusioni/Diagnosi") and standard salutation
 * lines ("Gentile collega", "visita ambulatoriale in paziente") from the
 * PREAMBLE block so that raccordoScore() sees only clinical content.
 */
function cleanPreamble(preamble) {
  if (!preamble) return "";
  return preamble
    .split(/\n/)
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      if (/^conclusioni[\s\/]/i.test(t)) return false;
      if (/^gentile\s+(?:collega|dottore|dottoressa)/i.test(t)) return false;
      if (/^(?:visita\s+ambulatoriale|visita\s+di\s+controllo)\s+in\s+paziente/i.test(t)) return false;
      return true;
    })
    .join("\n")
    .trim();
}

/**
 * stripVisitIncipit(s) → string
 *
 * Rimuove l'incipit boilerplate del motivo-visita che ripete la diagnosi
 * ("(visita) di controllo in paziente con <diagnosi>.") dall'inizio di un
 * blocco di anamnesi, preservando l'anamnesi intervallare reale che segue
 * ("Discreto benessere. ..."). Per sicurezza (FP=0) lo strip scatta SOLO se
 * la frase inizia con un qualificatore di visita (visita/controllo/...) seguito
 * da "in paziente con/affetto da": così un'anamnesi reale che inizia con
 * "Paziente con discreto benessere..." non viene mai tagliata. La diagnosi
 * viene estratta a parte da extractPatientInfo, qui va solo tolta dall'interval_history.
 */
function stripVisitIncipit(s) {
  if (!s) return s;
  return s
    .replace(
      /^\s*(?:di\s+)?(?:visita|controllo|ambulatoriale|rivalutazione|follow[\s-]?up)\b[^.\n]*?\bin\s+paziente\s+(?:con|affett[oa]\s+da)\b[^.\n]*[.\n]?\s*/i,
      ""
    )
    .trim();
}

/**
 * computeParseReview(S, raccordoText, visitSections) → object | null
 *
 * Detects clinically significant parser ambiguities and returns a
 * _parse_review object consumed by SectionReviewPanel.  Returns null when
 * no review is needed (most well-structured referti).
 *
 * Only 4 signals are checked — all tied to clinically important sections:
 *   1. raccordo_preamble       — history text in PREAMBLE, no RACCORDO recognised
 *   2. raccordo_in_allergie    — history text absorbed in ALLERGIE body
 *   3. esami_visione_in_preg   — "In visione:" inside ESAMI_PREGRESSI (regex gap)
 *   4. indicazioni_in_concl    — therapy prescriptions embedded in CONCLUSIONI
 */
function computeParseReview(S, raccordoText, visitSections, therapyConflicts) {
  const unresolved       = [];
  const low_confidence   = [];
  const therapy_conflicts = therapyConflicts || [];

  const hasRaccordo = !!(raccordoText || visitSections?.raccordo);

  // ── 1. raccordo_preamble ─────────────────────────────────────────────────
  if (!hasRaccordo) {
    const clean = cleanPreamble(S.PREAMBLE || "");
    if (clean.length > 60 && raccordoScore(clean) >= 3) {
      unresolved.push({
        id: "raccordo_preamble",
        text: clean,
        source: "Testo non assegnato (inizio referto)",
        reason: "Nessun raccordo anamnestico riconosciuto — questo blocco potrebbe contenere la storia clinica del paziente.",
        suggested_section: "raccordo",
      });
    }
  }

  // ── 2. raccordo_in_allergie ──────────────────────────────────────────────
  if (!hasRaccordo && S.ALLERGIE && S.ALLERGIE.length > 150) {
    const lines = S.ALLERGIE.split(/\n/);
    const rest  = lines.slice(1).join("\n").trim();
    if (rest.length > 80 && raccordoScore(rest) >= 2) {
      low_confidence.push({
        id: "raccordo_in_allergie",
        current_label: "Allergie paziente",
        current_text:  S.ALLERGIE,
        suspect_text:  rest,
        hint: "Il campo Allergie contiene testo clinico lungo — probabilmente è il raccordo anamnestico del paziente, non riconosciuto per assenza di header esplicito.",
        suggested_section: "raccordo",
      });
    }
  }

  // ── 3. esami_visione_in_pregressi ────────────────────────────────────────
  // "In visione:" inside ESAMI_PREGRESSI is NOT caught as RECA_IN_VISIONE
  // because the regex requires "Porta in visione" or "RECA IN VISIONE",
  // not bare "In visione:".
  if (S.ESAMI_PREGRESSI) {
    const m = S.ESAMI_PREGRESSI.match(
      /(?:^|\n)(In\s+visione\s*:[\s\S]*?)(?=\n[A-ZÀÈÌÒÙ][A-ZÀÈÌÒÙ\s]{2,}[:\n]|$)/i
    );
    if (m) {
      const suspect = m[1].trim();
      if (suspect.length > 30) {
        low_confidence.push({
          id: "esami_visione_in_pregressi",
          current_label: "Esami pregressi (archivio)",
          current_text:  S.ESAMI_PREGRESSI,
          suspect_text:  suspect,
          hint: "Il blocco \"In visione:\" non è stato riconosciuto come sezione separata — questi esami sono stati archiviati come pregressi invece di essere associati alla visita odierna.",
          suggested_section: "labs_text",
        });
      }
    }
  }

  // ── 4. indicazioni_in_conclusioni ────────────────────────────────────────
  if (!S.INDICAZIONI && S.CONCLUSIONI && S.CONCLUSIONI.length > 250) {
    const actionRe = /\b(inizia|sospende|riduce|aumenta|prosegue\s+con|prescrive|avvia|si\s+consiglia|si\s+propone|si\s+indica|si\s+raccomanda)\b/gi;
    const hits = S.CONCLUSIONI.match(actionRe) || [];
    if (hits.length >= 2) {
      low_confidence.push({
        id: "indicazioni_in_conclusioni",
        current_label: "Conclusioni",
        current_text:  S.CONCLUSIONI,
        suspect_text:  S.CONCLUSIONI,
        hint: "Le Conclusioni contengono indicazioni terapeutiche senza una sezione INDICAZIONI separata — seleziona la parte prescrittiva e assegnala alle Indicazioni.",
        suggested_section: "indicazioni",
      });
    }
  }

  if (unresolved.length === 0 && low_confidence.length === 0 && therapy_conflicts.length === 0) return null;
  return { unresolved, low_confidence, therapy_conflicts };
}

// ── Esportazione principale ───────────────────────────────────────────────────
/**
 * parseVisitText(text)
 *
 * Sostituzione locale e gratuita di /ai/parse-visit.
 * Restituisce lo stesso shape { extracted } che VisitImportButton si aspetta.
 */
// ── Normalizzazione testo importato ──────────────────────────────────────────
// Rimuove spazi multipli e unisce righe spezzate da impaginazione PDF/Word,
// preservando i boundary che il parser usa: header ALL-CAPS, bullet >, -, •,
// righe che iniziano con una data, righe vuote (separatori di paragrafo).
// NON modifica il contenuto clinico.
//
// SECTION_HEADER_NORM_RE — riconosce le righe con header di sezione clinica che hanno
// contenuto inline sullo stesso rigo (es. "ANAMNESI FISIOLOGICA: non fumatrice...").
// Queste righe devono sempre essere block-start anche se NON sono ALL-CAPS.
// Senza questo controllo, normalizeImportedText le unisce alla riga precedente,
// causando il bug "tutti i campi profilo_generale crammed in anamnesi_fisiologica".
const SECTION_HEADER_NORM_RE = /^(?:ANAMNESI\s+(?:FISIOLOGICA|FAMILIARE|INTERVALLARE(?:\s+DI\s+MALATTIA)?|PATOLOGICA(?:\s+REMOTA)?|REUMATOLOGICA(?:\s+REMOTA)?|FARMACOLOGICA)|COMORBI(?:DIT[AÀ]|LIT[AÀ])'?(?:\s*\/\s*APR)?|PATOLOGIE\s+CONCOMITANTI|TERAPI[AE](?:\s+(?:DOMICILIARE|IN\s+ATTO|IN\s+CORSO|ATTUALE|PRATICATA|CORRENTE|ABITUALE))?|FARMACI\s+(?:IN\s+CORSO|ASSUNTI)|ALLERGIE?(?:\s+E\s+INTOLLERANZE)?(?:\s+A\s+FARMACI)?|INTOLLERANZE?(?:\s+E\s+ALLERGIE?)?|RACCORDO(?:\s+\w+)?|MOTIVO\s+DELLA?\s+VISITA|IN\s+DATA\s+ODIERNA|ALLA\s+VISITA\s+ODIERNA|VISITA\s+(?:ODIERNA|AMBULATORIALE|DI\s+CONTROLLO)|ESAME\s+(?:OBIETTIVO|FISICO|REUMATOLOGICO)|OBIETTIVIT[AÀ]'?|OBB?IETTIVAMENTE|REPERTO\s+OBIETTIVO|E\.?O\.?|IN\s+TERAPIA|HO\s+(?:RICHIESTO|PRESCRITTO)|CONCLUSIONI?|INDICAZIONI?|ESAMI\s+(?:PREGRESSI|DI\s+RILIEVO|STRUMENTALI)|IN\s+VISIONE|PORTA\s+IN\s+VISIONE|RECA\s+IN\s+VISIONE|ACCERTAMENTI\s+(?:PRECEDENTI|PREGRESSI|EFFETTUATI|ESEGUITI|ESITATI|REFERTATI|IN\s+VISIONE))\b/i;

function normalizeImportedText(raw) {
  if (!raw?.trim()) return raw;

  const lines = raw.split('\n');
  const out = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Una riga inizia un nuovo blocco (mantieni l'a capo) se:
    //   1. è vuota (separatore di paragrafo)
    //   2. inizia con un bullet/marker esame: >, -, •, *
    //   3. inizia con una data: DD/MM... oppure MM/YYYY
    //   4. è un header ALL-CAPS (nessuna lettera minuscola, ≥2 lettere maiusc.)
    //   5. inizia con un keyword di sezione clinica noto (anche con contenuto inline)
    const isBlockStart =
      trimmed === '' ||
      /^[>\-•*]\s/.test(trimmed) ||
      /^\d{1,2}[\/\-\.]\d{1,2}/.test(trimmed) ||
      (trimmed === trimmed.toUpperCase() && /[A-Z]{2}/.test(trimmed)) ||
      SECTION_HEADER_NORM_RE.test(trimmed);

    if (out.length === 0 || isBlockStart || out[out.length - 1] === '') {
      out.push(trimmed);
    } else {
      const prev = out[out.length - 1];
      // Trattino a fine riga = spezzatura parola → unisci senza spazio
      if (prev.endsWith('-')) {
        out[out.length - 1] = prev.slice(0, -1) + trimmed;
      } else {
        out[out.length - 1] = prev + ' ' + trimmed;
      }
    }
  }

  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')   // max 2 righe vuote consecutive
    .replace(/[ \t]{2,}/g, ' ');  // collassa spazi multipli
}

const _THERAPY_DOSE_RE = /\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|gamma|g|cp|compress\w*|fiala|fiale|fl|ml|gtt|u\.?i\.?|mui|unit\w*)\b(?!\s*\/\s*d?l)/i;
const _THERAPY_VERB_RE = /\b(?:prosegu\w*|continu\w*|sospend\w*|riduc\w*|aument\w*|introdu\w*|aggiung\w*|avvi\w*|scala\w*|switch|associ\w*|mantien\w*|assum\w*|inizi\w*|riprend\w*)/i;

function _textHasKnownDrug(text) {
  if (!text) return false;
  for (const [pattern, , , caseSensitive] of DRUG_PATTERNS) {
    if (new RegExp(pattern.source, caseSensitive ? "" : "i").test(text)) return true;
  }
  return false;
}

const _PHARMA_STOP_RE = /^(?:accertament\w*|esam[ei]\b|esegu[ie]\w*|da\s+esegui\w*|si\s+esegu\w*|si\s+prescriv\w*|prescriv\w*|si\s+richied\w*|richiest[ao]|controll\w*|ricontroll\w*|rivaluta\w*|rivalutazion\w*|prossim[ao]\b|appuntament\w*|visit[ae]\b|prenotat\w*|emocromo|cordiali\s+saluti|distinti\s+saluti|cordialit[àa]|restando\s+a\s+(?:vostra\s+|sua\s+)?disposizion\w*|si\s+resta\s+a\s+disposizion\w*|rimaniamo\s+a\s+disposizion\w*|in\s+attesa\s+di\b|si\s+invia\b|si\s+rinvia\b|si\s+dimette\b)/i;

function _unitIsPharma(unit) {
  return _textHasKnownDrug(unit) || _THERAPY_DOSE_RE.test(unit) || _THERAPY_VERB_RE.test(unit);
}

function pharmaPartOfIndicazioni(text) {
  if (!text || !text.trim()) return null;
  const prot = text.replace(/\b([a-zA-Z])\.([a-zA-Z])\./g, "$1\u0001$2\u0001");
  const boundaryRe = /[.;]\s+(?=[A-Za-zÀ-ÿ])|\n+/g;
  const starts = [0];
  let m;
  while ((m = boundaryRe.exec(prot)) !== null) {
    starts.push(m.index + m[0].length);
  }
  let cut = text.length;
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : text.length;
    const unit = text.slice(s, end);
    const lead = unit.replace(/^[-–—•*>\s]+/, "");
    if (_PHARMA_STOP_RE.test(lead) && !_unitIsPharma(unit)) {
      cut = s;
      break;
    }
  }
  const kept = text.slice(0, cut).trim();
  if (!kept) return null;
  if (!_unitIsPharma(kept)) return null;
  return kept;
}

export function parseVisitText(text) {
  if (!text?.trim()) return { extracted: {}, _trace: [] };

  // Resetta il trace buffer e il date source per questa chiamata
  _PARSE_TRACE = [];
  _lastDateSource = null;

  // Normalizza il testo prima di ogni altra elaborazione
  text = normalizeImportedText(text);

  const today = new Date().toISOString().slice(0, 10);
  const visitDate = extractVisitDate(text) || today;

  // ── Pass 1: segment letter into named sections ───────────────────────────────
  const S = segmentLetterSections(text);
  // Helper: join non-empty section contents with a separator
  const join = (...keys) => keys.map((k) => S[k]).filter(Boolean).join("\n\n");
  // Helper: reconstruct "HEADER\n<content>" for extractors that search for the header
  const withHeader = (header, content) => (content ? `${header}\n${content}` : "");

  // ── Pass 2: extract from section-scoped text ─────────────────────────────────

  // Clinical scores — reason for visit + current visit narrative + EO + conclusions
  const clinScope = join("MOTIVO_VISITA", "ANAMNESI_INTERVALLARE", "VISITA_ODIERNA", "ESAME_OBIETTIVO", "CONCLUSIONI") || text;
  const { items: clinItems } = parseClinimetryFromText(clinScope);
  const { tjc, sjc }        = extractJointCounts(clinScope);

  const assessments = clinItems.map((item) => ({
    index_type:     item.index_type,
    date:           visitDate,
    score:          item.score,
    interpretation: interpretScore(item.index_type, item.score),
    inputs:         {},
    tender_joints:  [],
    swollen_joints: [],
    tender_count:   tjc ?? null,
    swollen_count:  sjc ?? null,
    notes:          item.ambiguous ? `Match ambiguo: «${item.raw_match}»` : null,
    visit_category: "score",
  }));

  // Lab exams — from archive-exam sections only (not HO RICHIESTO, not VISITA ODIERNA)
  const labScope      = join("ESAMI_PREGRESSI", "RECA_IN_VISIONE", "AGGIORNAMENTO") || text;
  const labDateGroups = extractLabValuesByDate(labScope);
  if (labDateGroups.length === 1 && !labDateGroups[0].date) {
    const rd = detectReportDate(labScope);
    if (rd?.date) labDateGroups[0] = { ...labDateGroups[0], date: rd.date };
  }
  const labItems      = labDateGroups.flatMap((g) => g.items || []);

  // ── Confidence split ───────────────────────────────────────────────────────
  // High-confidence items → lab_exams (saved automatically after doctor review).
  // Low-confidence items  → lab_review_items (shown for manual review; NOT saved
  //   until doctor explicitly confirms, modifies, or ignores each one).
  //
  // Low confidence is triggered for HIGH_RISK_KEYS params when the unit is
  // absent from the source text (inferred from param.defaultUnit).
  const cleanGroups = labDateGroups.map(g => ({
    ...g,
    items: (g.items || []).filter(li => li.confidence !== "low"),
  }));
  const lab_exams = groupLabValuesByDate(cleanGroups);

  // Build lab_review_items with full context for the review panel.
  const lab_review_items = [];
  for (const { date: grpDate, items: grpItems } of labDateGroups) {
    for (const li of (grpItems || []).filter(li => li.confidence === "low")) {
      lab_review_items.push({
        key:            li.key,
        label:          li.label,
        panel:          li.panel,
        date:           grpDate || null,
        proposed_value: li.value != null ? li.value : null,
        proposed_unit:  li.unit  || null,
        inferred_unit:  li.inferred_unit || false,
        qualitative:    li.qualitative  || null,
        status:         li.status       || null,
        source_text:    li.sourceText   || null,
        review_reason:  li.review_reason || null,
      });
    }
  }

  // Clinical model: structured therapies = rheumatologic drugs ONLY.
  // Non-rheumatologic drugs (PPIs, vitamins, antihypertensives, supportives) belong
  // only in the free-text patients.terapia_domiciliare field — NOT in the structured
  // therapies table. The doctor always validates before anything is saved.
  // antiinflammatory = Colchicina e farmaci anti-infiammatori non-FANS usati in reumatologia
  // urate_lowering   = allopurinolo, febuxostat, benzbromarone, pegloticase (gotta)
  // anticoagulant    = warfarin, acenocumarolo, DOAC, LMWH (APS/CAPS)
  // immunotherapy    = IVIg (CAPS, miosite, IgG4-RD)
  const RHEUM_CATEGORIES = new Set([
    "csDMARD", "bDMARD", "tsDMARD", "glucocorticoid", "NSAID", "antiinflammatory",
    "urate_lowering", "anticoagulant", "immunotherapy",
  ]);

  // Therapies — conflict-aware extraction:
  //   DOM scope = TERAPIA DOMICILIARE + IN TERAPIA (current baseline)
  //   IND scope = INDICAZIONI (today's prescription / modifications)
  //
  // When the same drug appears in both scopes with different dose or frequency,
  // a therapy_conflict is emitted for human review.
  // Clinical priority: IND wins (final prescription > current list), but the
  // doctor is always shown the discrepancy before importing.
  const _domScope = [
    withHeader("TERAPIA IN ATTO", S.TERAPIA_DOMICILIARE),
    withHeader("TERAPIA IN ATTO", S.IN_TERAPIA),
  ].filter(Boolean).join("\n\n");
  const _indScope = S.INDICAZIONI
    ? withHeader("INDICAZIONI", S.INDICAZIONI)
    : null;

  const _therapyConflicts = [];
  let therapies;

  if (_domScope && _indScope) {
    const fromDom = extractTherapies(_domScope, visitDate, "dom").filter((t) => RHEUM_CATEGORIES.has(t.category));
    const fromInd = extractTherapies(_indScope, visitDate, "ind").filter((t) => RHEUM_CATEGORIES.has(t.category));
    const domByName = new Map(fromDom.map((t) => [t.drug_name, t]));
    const indByName = new Map(fromInd.map((t) => [t.drug_name, t]));

    for (const [name, tInd] of indByName) {
      const tDom = domByName.get(name);
      if (!tDom) continue;
      // Conservative comparison: only flag when BOTH sides have a parsed value
      // AND those values genuinely differ.  If one side is null (parsing gap),
      // IND already wins in the merged list — no false-positive conflict needed.
      const doseDiffers = Boolean(tDom.dose)      && Boolean(tInd.dose)      && tDom.dose      !== tInd.dose;
      const freqDiffers = Boolean(tDom.frequency) && Boolean(tInd.frequency) && tDom.frequency !== tInd.frequency;
      if (doseDiffers || freqDiffers) {
        _therapyConflicts.push({
          id: `therapy_conflict_${name.toLowerCase().replace(/[\s/]+/g, "_")}`,
          drug_name: name,
          source_dom: {
            dose: tDom.dose, frequency: tDom.frequency, route: tDom.route,
            source_fragment: tDom.source_fragment,
          },
          source_ind: {
            dose: tInd.dose, frequency: tInd.frequency, route: tInd.route,
            source_fragment: tInd.source_fragment,
          },
          winner: "ind",
        });
      }
    }

    // Merge: IND list is base (already wins for conflicted drugs).
    // DOM drugs not present in IND are added (continuity).
    const merged = [...fromInd];
    for (const [name, tDom] of domByName) {
      if (!indByName.has(name)) merged.push(tDom);
    }
    therapies = merged;
  } else {
    const therapyScope = [_domScope, _indScope].filter(Boolean).join("\n\n") || text;
    therapies = extractTherapies(therapyScope, visitDate).filter((t) => RHEUM_CATEGORIES.has(t.category));
  }

  // Secondo passaggio: corregge lo status di farmaci classificati come "active"
  // ma menzionati con segnale di sospensione nell'ANAMNESI INTERVALLARE o in
  // altre sezioni narrative (es. "Ha sospeso la Colchicina dopo 2 giorni per...").
  const _narrativeDiscScope = [
    S.ANAMNESI_INTERVALLARE,
    S.MOTIVO_VISITA,
    S.VISITA_ODIERNA,
  ].filter(Boolean).join("\n\n");
  if (_narrativeDiscScope) {
    therapies = applyNarrativeDiscontinuations(therapies, _narrativeDiscScope, RHEUM_CATEGORIES, true);
  }
  if (S.RACCORDO) {
    therapies = applyNarrativeDiscontinuations(therapies, S.RACCORDO, RHEUM_CATEGORIES, false);
  }

  // ── Inline "Porta/In in visione" — strip from narrative sections ─────────
  // When the doctor writes "Porta in visione:\n> ..." inline inside the anamnesi
  // text (rather than as a standalone section header), those ">" exam lines must
  // be removed from the narrative and routed to instrScope as RECA IN VISIONE.
  const _ivAI = extractInlineVisioneBlock(S.ANAMNESI_INTERVALLARE);
  const _ivMV = extractInlineVisioneBlock(S.MOTIVO_VISITA);
  const _ivVO = extractInlineVisioneBlock(S.VISITA_ODIERNA);
  const _inlineVisioneText = [_ivAI.visione, _ivMV.visione, _ivVO.visione]
    .filter(Boolean).join("\n");

  // Instrumental findings — build a correctly-headed text so instrumentalParser's
  // internal section detection still works; HO_RICHIESTO is intentionally excluded
  const instrScope = [
    withHeader("ESAMI PREGRESSI",  S.ESAMI_PREGRESSI),
    withHeader("RECA IN VISIONE",  S.RECA_IN_VISIONE),
    _inlineVisioneText ? withHeader("RECA IN VISIONE", _inlineVisioneText) : null,
    withHeader("ESAMI PREGRESSI",  S.AGGIORNAMENTO),
    // Preamble may contain exam listings (e.g. in letters without a clear section header)
    S.PREAMBLE || null,
  ].filter(Boolean).join("\n\n");
  const _allInstrumental      = parseInstrumentalFindings(instrScope || text);
  const instrumental_findings = _allInstrumental.filter((f) => f.destination !== "visione");
  const exam_imaging          = _allInstrumental.filter((f) => f.destination === "visione");

  // Profiles — raccordo + current visit narrative + EO + conclusions
  const profileScope = join("RACCORDO", "MOTIVO_VISITA", "ANAMNESI_INTERVALLARE", "VISITA_ODIERNA", "ESAME_OBIETTIVO", "CONCLUSIONI") || text;
  const sclero_profile = extractScleroProfile(profileScope);
  const ra_profile     = extractRaProfile(profileScope);
  const spa_profile    = extractSpaProfile(profileScope);
  const sle_profile    = extractSleProfile(profileScope);

  // Comorbidita — from COMORBIDITA section only; re-add header for the regex
  const comorbidita = extractComorbidita(
    S.COMORBIDITA ? `COMORBIDITA' ${S.COMORBIDITA}` : text
  );

  // Phase 4b: resolve raw comorbidity strings to structured condition payloads.
  // patient_id is "" here (no patient context at parse time) — VisitImportButton
  // must inject patient_id before calling conditionsApi.upsert().
  const resolved_conditions = resolveComorbidita(comorbidita || [], "", "import");

  // Intolleranze / allergie — from ALLERGIE + TERAPIA DOMICILIARE (not full text)
  const intoScope   = join("ALLERGIE", "TERAPIA_DOMICILIARE") || text;
  const intolleranze = extractIntolleranze(intoScope);

  // Requested tests — from HO RICHIESTO section → workup visit planned exams
  const requested_tests = extractRequestedTests(S.HO_RICHIESTO);

  // ── Profilo generale paziente ─────────────────────────────────────────────
  // Campi narrativi che vanno nel record paziente (non nella visita).
  // COMORBIDITA + ANAMNESI_PATOLOGICA vengono uniti nel campo comorbidita_apr.
  const _comorbiditaItems = [S.COMORBIDITA, S.ANAMNESI_PATOLOGICA].filter(Boolean);
  // Sanitize allergie: take only the first line/sentence to avoid raccordo contamination
  // (e.g. if "ALLERGIE: nessuna. Raccordo reumatologico: ..." is all on one line)
  // Fallback: se non c'è sezione ALLERGIE esplicita, cerca "nega allergie" / "nessuna allergia"
  // nell'ANAMNESI_PATOLOGICA o TERAPIA_DOMICILIARE (comune nelle lettere AUSL senza header)
  const _allergieRaw = S.ALLERGIE || (() => {
    const fallbackText = [S.ANAMNESI_PATOLOGICA, S.TERAPIA_DOMICILIARE, S.ANAMNESI_FISIOLOGICA].filter(Boolean).join(" ");
    if (!fallbackText) return null;
    const m = fallbackText.match(
      /\b(?:nega|nessuna?|non\s+ri(?:porta|ferisce|sulta))\s+allergi[ae][^.]{0,60}|\bNAF\b|\bnon\s+farmaco[\s-]?allergi[ae]\b|\bnon\s+allergi[ae]\s+farmacologiche?\b|\bnessuna?\s+(?:allergia\s+nota|farmaco[\s-]?allergi[ae])\b/i
    );
    return m ? m[0].trim() : null;
  })();
  const _allergieSanitized = _allergieRaw
    ? (_allergieRaw.split(/\n/)[0] || _allergieRaw)
        .split(/\.(?=\s+[A-Z])/)[0]   // stop at sentence boundary before uppercase word
        .trim()
        .slice(0, 300) || null
    : null;
  const profilo_generale = {
    anamnesi_fisiologica: S.ANAMNESI_FISIOLOGICA || null,
    anamnesi_familiare:   S.ANAMNESI_FAMILIARE   || null,
    comorbidita_apr:      _comorbiditaItems.length ? _comorbiditaItems.join("\n\n") : null,
    terapia_domiciliare:  S.TERAPIA_DOMICILIARE
      ? S.TERAPIA_DOMICILIARE
          .replace(/\s*\b(?:nega|nessuna?|non\s+ri(?:porta|ferisce|sulta))\s+allergi[ae][^.\n]*\.?\s*/gi, " ")
          .replace(/\s*\bNAF\b\.?\s*/g, " ")
          .trim() || null
      : null,
    allergie:             _allergieSanitized,
  };
  const hasProfiloGenerale = Object.values(profilo_generale).some(Boolean);

  // ── Raccordo ─────────────────────────────────────────────────────────────
  // Only use the explicit RACCORDO section — never fall back to the preamble,
  // which typically contains header/date/patient info, not clinical history.
  const raccordoText = S.RACCORDO || null;

  // Visit sections — reconstruct with headers for extractVisitSections.
  // MOTIVO_VISITA + ANAMNESI_INTERVALLARE + VISITA_ODIERNA are merged under a single
  // "ANAMNESI INTERVALLARE" header so extractVisitSections produces one interval_history
  // block (multiple headers with the same key would only capture the first match).
  const _cleanAI = S.ANAMNESI_INTERVALLARE
    ? S.ANAMNESI_INTERVALLARE
        .replace(/^ANAMNESI\s+INTERVALLARE(?:\s+DI\s+MALATTIA)?\b[^\n]*\n?/i, "")
        .trim() || null
    : null;
  const _anamnesisText = [
    stripVisitIncipit(_ivMV.cleaned ?? S.MOTIVO_VISITA),
    _ivAI.cleaned ?? _cleanAI,
    stripVisitIncipit(_ivVO.cleaned ?? S.VISITA_ODIERNA),
  ].filter(Boolean).join("\n\n") || null;
  const terapiaUscitaText =
    S.TERAPIA_USCITA ||
    S.IN_TERAPIA ||
    pharmaPartOfIndicazioni(S.INDICAZIONI) ||
    null;
  const vsScope = [
    raccordoText      ? `RACCORDO ANAMNESTICO\n${raccordoText}`     : null,
    _anamnesisText    ? `ANAMNESI INTERVALLARE\n${_anamnesisText}`  : null,
    S.ESAME_OBIETTIVO ? `ESAME OBIETTIVO\n${S.ESAME_OBIETTIVO}`     : null,
    S.CONCLUSIONI     ? `CONCLUSIONI\n${S.CONCLUSIONI}`             : null,
    terapiaUscitaText ? `TERAPIA IN USCITA\n${terapiaUscitaText}`   : null,
    S.INDICAZIONI     ? `INDICAZIONI\n${S.INDICAZIONI}`             : null,
  ].filter(Boolean).join("\n\n");
  const visit_sections = extractVisitSections(vsScope || text);

  const diagScope = join("MOTIVO_VISITA", "CONCLUSIONI", "RACCORDO", "ANAMNESI_INTERVALLARE", "VISITA_ODIERNA", "PREAMBLE") || text;
  const patient = extractPatientInfo(text, diagScope);
  const summary = buildSummary({ clinItems, labItems, therapies, comorbidita, intolleranze });

  const _parse_review = computeParseReview(S, raccordoText, visit_sections, _therapyConflicts);

  return {
    extracted: {
      visit_date:               visitDate,
      patient,
      assessments,
      therapies,
      lab_exams,
      lab_review_items,
      sclero_profile,
      ra_profile,
      spa_profile,
      sle_profile,
      instrumental_findings,
      exam_imaging,
      comorbidita,
      resolved_conditions,
      intolleranze,
      visit_sections,
      requested_tests,
      profilo_generale:         hasProfiloGenerale ? profilo_generale : null,
      summary,
      criteria_flags:           null,
      _parse_review,
      raccordo_events:          raccordoText ? parseRaccordoTimeline(raccordoText) : [],
    },
    _trace: [..._PARSE_TRACE],
    _dateSource: _lastDateSource,
  };
}

// ─── Regression test: drug extraction safety ─────────────────────────────────
// Call from browser console: import { runDrugParserRegressionTests } from "./visitTextParser";
//                            runDrugParserRegressionTests();
export function runDrugParserRegressionTests() {
  const today = new Date().toISOString().slice(0, 10);

  const cases = [
    // ── FALSE POSITIVE guards (must NOT extract Sulfasalazina) ──────────────
    {
      id: "ssa_antibody",
      text: "Paziente con SpA. Anti-SSA positivo, anti-SSB negativo. Non assume terapia di fondo.",
      expectNot: "Sulfasalazina",
      description: "anti-SSA (autoanticorpo) non deve triggerare Sulfasalazina",
    },
    {
      id: "spa_no_therapy",
      text: "Spondiloartrite assiale in follow-up. BASDAI 2.1. Nessuna terapia modificante la malattia in atto.",
      expectNot: "Sulfasalazina",
      description: "SpA senza terapia → nessuna Sulfasalazina",
    },
    {
      id: "artrite_no_therapy",
      text: "Artrite periferica oligoarticolare. Il paziente non assume farmaci di fondo.",
      expectNot: "Sulfasalazina",
      description: "artrite periferica senza terapia → nessuna Sulfasalazina",
    },
    {
      id: "no_fondo",
      text: "Paziente con diagnosi di AR che al momento non assume terapia di fondo. Si sospende la precedente terapia per intolleranza.",
      expectNot: "Sulfasalazina",
      description: "'non assume terapia di fondo' → nessuna Sulfasalazina",
    },
    {
      id: "ssp_in_text",
      text: "Eseguita spirometria con SSP (supersaturation protocol). Valori nella norma.",
      expectNot: "Sulfasalazina",
      description: "SSP non farmacologico → nessuna Sulfasalazina",
    },
    // ── TRUE POSITIVE guards (MUST extract Sulfasalazina) ───────────────────
    {
      id: "explicit_name",
      text: "TERAPIA IN ATTO: Sulfasalazina 2 g/die per os.",
      expect: "Sulfasalazina",
      description: "nome esplicito 'Sulfasalazina' → deve essere estratta",
    },
    {
      id: "salazopyrin",
      text: "Il paziente assume Salazopyrin 2 compresse al giorno.",
      expect: "Sulfasalazina",
      description: "'Salazopyrin' → deve essere estratta come Sulfasalazina",
    },
    {
      id: "ssz_standalone",
      text: "In terapia con MTX 15 mg/sett e SSZ 2 g/die.",
      expect: "Sulfasalazina",
      description: "'SSZ' standalone → deve essere estratta come Sulfasalazina",
    },
    {
      id: "sasp_alias",
      text: "Terapia modificante: SASP 2 g die, ben tollerata.",
      expect: "Sulfasalazina",
      description: "'SASP' → deve essere estratta come Sulfasalazina",
    },
    {
      id: "salazopirina",
      text: "Assume salazopirina 1 g x 2 al dì da 6 mesi.",
      expect: "Sulfasalazina",
      description: "'salazopirina' → deve essere estratta come Sulfasalazina",
    },
  ];

  let passed = 0;
  let failed = 0;
  const results = [];

  for (const c of cases) {
    const extracted = extractTherapies(c.text, today).map(t => t.drug_name);

    let ok = true;
    let detail = "";
    if (c.expect) {
      ok = extracted.includes(c.expect);
      detail = ok ? `✓ trovata "${c.expect}"` : `✗ MANCANTE "${c.expect}" — estratte: [${extracted.join(", ")}]`;
    } else if (c.expectNot) {
      ok = !extracted.includes(c.expectNot);
      detail = ok ? `✓ "${c.expectNot}" non estratta` : `✗ FALSO POSITIVO "${c.expectNot}" estratta — estratte: [${extracted.join(", ")}]`;
    }

    if (ok) passed++; else failed++;
    results.push({ id: c.id, ok, description: c.description, detail });
    console[ok ? "log" : "error"](`[DrugParser] ${ok ? "PASS" : "FAIL"} ${c.id}: ${c.description}\n       ${detail}`);
  }

  console.log(`\n[DrugParser regression] ${passed}/${passed + failed} test passati${failed > 0 ? ` — ${failed} FALLITI` : " — OK"}`);
  return { passed, failed, results };
}

// ─── Testo de-identificato: lettera AUSL Bologna — Pelliconi 12/09/2025 ──────
// Rappresentativo della lettera originale, usato dai test Pelliconi_*.
// Copre: TERAPIA inline, OBBIETTIVAMENTE doppia B, allergie senza header,
// MTX sospeso a metà 2023 (accento), guard "mai sospeso".
const _PELLICONI_LETTER = `Gent.le collega,
pz. con osteoartrosi e artrite reumatoide.

ANAMNESI FISIOLOGICA: mai fumatrice, mai fratture, menopausa a 50 aa.
ANAMNESI PATOLOGICA REMOTA: quantiferon positivo riscontrato nel 2011, ipertensione arteriosa, discopatie. IC alluce valgo 2020, isterectomia per fibromatosi. Nega allergie.
TERAPIA: atenololo - colecalciferolo 5 gtt al die - vit K2 - urbason 4 mg : 1/2 cp al die
RACCORDO ANAMNESTICO: pz. affetta da artrite reumatoide acpa negativa a scarsa attivita'. In terapia dal 2011 con methotrexate 10 mg / settimana e steroidi a basso dosaggio ( 4 mg al die ). Tentata prima sospensione di MTX a settembre 2022, poi ripreso dopo 3 mesi per ripresa delle artralgie, poi sospeso a metà 2023 per intolleranza GI. A agosto 2024 assumeva solo medrol 16 mg : 1/4 cp al die. Medrol 4 mg mai sospeso dal 2011.
ACCERTAMENTI PRECEDENTI :
- EE 28/12/2024: Hb 13.3 g/dL, VES 18 mm/h, PCR 0.8 mg/dL, FR negativo, ACPA negativi
VISITA ODIERNA: Peggioramento delle artralgie in sede podalica e lombare. Non riesce a sospendere l'Urbason che attualmente assume al dosaggio di 2 mg al die.
IN VISIONE :
- EE agosto 2025 : emocromo nn - ves 22 - creatinina 1,16 - alt 12 - pcr 0,88
OBBIETTIVAMENTE : non segni di artrite periferica. Pes planus. Scrosci alle ginocchia. Non limitazione alle spalle, anche.
CONCLUSIONI: Diagnosi di artrite reumatoide sieronegativa non in fase di attivita' clinica.
INDICAZIONI:
- Urbason 4 mg : 1/2 cp due giorni alla settimana
- Flogorest : 1 cp al die per 10 gg al bisogno
- continua la vitamina D`;

const _MILITELLO_LETTER = `STRUTTURA COMPLESSA DI MEDICINA INTERNA AD INDIRIZZO REUMATOLOGICO
REFERTO
MOTIVO DELLA VISITA: controllo in artrite sieronegativa
ANAMNESI: attualmente lavora in un supermercato, non psoriasi. Nessun dato per connettivite.
COMORBILITA': proctite ulcerosa.
IN TERAPIA: Reumaflex 10 mg/settimana (da gennaio 2026), Folina 5 mg/settimana
ALLERGIE: nessuna
RACCORDO ANAMNESTICO:
Prima visita a maggio 2024. Avviata terapia con MTX da gennaio 2026. Miglioramento clinico al controllo di marzo 2026.
ACCERTAMENTI:
- EE dicembre 2024: emocromo nn - hb 13,2 - plt 336 - pcr 0,05
VISITA ODIERNA:
Torna a controllo a 4 mesi dall'avvio di MTX, che riferisce di tollerare poco. Permane dolore al polso ds.
In visione:
- EE 12/05/2026: Hb 13.3, WBC 7.1, Plt 308, VES 3 mm, PCR 0.06, cr 0,63, GOT/GPT 23/18, TSH 0,57.
EO: dolor e tumor polso ds, non altre articolazioni dolenti o tumefatte. Obiettivita internistica di norma.
GH 9/10, DAS28-PCR 3.1, CDAI/SDAI 15/15.06, DAPSA 16
CONCLUSIONI: Artrite enteropatica simil-reumatoide in MDA, meritevole di upgrade terapeutico ad antiTNF.
IN TERAPIA:
- Continua Reumaflex 10 mg 1 iniezione sottocute una volta a settimana, tutte le settimane, sempre lo stesso giorno (es. lunedi).
- Continua Folina 5 mg: 1 cp a settimana, 24 ore dopo il Reumaflex (es. martedi).`;

// ─── Regression test: robustezza su lettere reali ────────────────────────────
// Copre i 4 bug trovati nel diagnostic trace (lettera AUSL Bologna).
// Aggiungere un caso ogni volta che si corregge un bug su lettera reale.
//
// Call from browser console: import { runRobustnessRegressionTests } from "./visitTextParser";
//                            runRobustnessRegressionTests();
export function runRobustnessRegressionTests() {
  const cases = [

    // ── Allergie senza header esplicito ────────────────────────────────────
    {
      id: "allergie_nega",
      description: "'Nega allergie.' inline in ANAMNESI_PATOLOGICA → profilo_generale.allergie non null",
      run: () => {
        const r = parseVisitText(
          "ANAMNESI PATOLOGICA REMOTA: ipertensione. Nega allergie.\nCONCLUSIONI: remissione.",
        );
        return !!r.extracted.profilo_generale?.allergie;
      },
    },
    {
      id: "allergie_naf",
      description: "'NAF' standalone → profilo_generale.allergie non null",
      run: () => {
        const r = parseVisitText(
          "ANAMNESI PATOLOGICA REMOTA: ipertensione. NAF.\nCONCLUSIONI: remissione.",
        );
        return !!r.extracted.profilo_generale?.allergie;
      },
    },
    {
      id: "allergie_nessuna_nota",
      description: "'nessuna allergia nota' → profilo_generale.allergie non null",
      run: () => {
        const r = parseVisitText(
          "ANAMNESI PATOLOGICA REMOTA: discopatie. Nessuna allergia nota.\nCONCLUSIONI: remissione.",
        );
        return !!r.extracted.profilo_generale?.allergie;
      },
    },
    {
      id: "allergie_non_farmacoallergie",
      description: "'non farmacoallergie' → profilo_generale.allergie non null",
      run: () => {
        const r = parseVisitText(
          "ANAMNESI PATOLOGICA REMOTA: ipertensione. Non farmacoallergie note.\nCONCLUSIONI: remissione.",
        );
        return !!r.extracted.profilo_generale?.allergie;
      },
    },

    // ── Sospensioni terapia — forme verbali estese ─────────────────────────
    // NOTA: ogni testo include "TERAPIA IN ATTO: [altro farmaco]" così il RACCORDO
    // finisce in _narrativeDiscScope (applyNarrativeDiscontinuations) e non nel
    // therapyScope fallback (= testo intero). Senza questa sezione il RACCORDO
    // verrebbe scansionato da extractTherapies con inActiveSection=true e il farmaco
    // verrebbe classificato "active" ignorando hasPastAfter.
    {
      id: "sosp_meta_anno",
      description: "'sospeso a metà 2023 per intolleranza GI' → Methotrexate discontinued",
      run: () => {
        const r = parseVisitText(
          "TERAPIA IN ATTO: idrossiclorochina 200 mg/die\nRACCORDO ANAMNESTICO: in terapia dal 2011 con methotrexate 10 mg/sett, poi sospeso a metà 2023 per intolleranza GI.\nCONCLUSIONI: AR stabile.",
        );
        const t = r.extracted.therapies?.find(
          (x) => x.drug_name === "Methotrexate",
        );
        return t?.status === "discontinued";
      },
    },
    {
      id: "sosp_non_assume_piu",
      description: "'non assume più' → Methotrexate discontinued",
      run: () => {
        const r = parseVisitText(
          "TERAPIA IN ATTO: idrossiclorochina 200 mg/die\nRACCORDO ANAMNESTICO: era in terapia con methotrexate 15 mg/sett, non assume più da gennaio 2024.\nCONCLUSIONI: AR stabile.",
        );
        const t = r.extracted.therapies?.find(
          (x) => x.drug_name === "Methotrexate",
        );
        return t?.status === "discontinued";
      },
    },
    {
      id: "sosp_ha_smesso",
      description: "'ha smesso' → Methotrexate discontinued",
      run: () => {
        const r = parseVisitText(
          "TERAPIA IN ATTO: idrossiclorochina 200 mg/die\nRACCORDO ANAMNESTICO: assumeva methotrexate 10 mg, ha smesso 6 mesi fa per nausea.\nCONCLUSIONI: AR stabile.",
        );
        const t = r.extracted.therapies?.find(
          (x) => x.drug_name === "Methotrexate",
        );
        return t?.status === "discontinued";
      },
    },
    {
      id: "sosp_mantenuta_sospesa",
      description: "'mantenuta sospesa' → Methotrexate discontinued",
      run: () => {
        const r = parseVisitText(
          "TERAPIA IN ATTO: idrossiclorochina 200 mg/die\nRACCORDO ANAMNESTICO: methotrexate 15 mg/sett mantenuta sospesa dal 2023 per epatotossicità.\nCONCLUSIONI: AR stabile.",
        );
        const t = r.extracted.therapies?.find(
          (x) => x.drug_name === "Methotrexate",
        );
        return t?.status === "discontinued";
      },
    },

    // ── Guard: "mai sospeso" NON deve marcare come discontinued ───────────
    // drug_name canonical per Medrol/Urbason = "Metilprednisolone" (alias italiano).
    // Il test verifica che il farmaco SIA trovato in lista E non sia discontinued.
    {
      id: "guard_mai_sospeso",
      description: "'Medrol 4 mg mai sospeso dal 2011' → Metilprednisolone trovato, NON discontinued",
      run: () => {
        const r = parseVisitText(
          "TERAPIA IN ATTO: Medrol 4 mg (mai sospeso dal 2011).\nCONCLUSIONI: AR in remissione.",
        );
        const t = r.extracted.therapies?.find(
          (x) => x.drug_name === "Metilprednisolone",
        );
        if (!t) { console.warn("[guard_mai_sospeso] Metilprednisolone non trovato nelle therapies — drug_name errato?"); return false; }
        return t.status !== "discontinued";
      },
    },
    {
      id: "guard_non_sospeso",
      description: "'idrossiclorochina, non sospeso' → Idrossiclorochina trovata, NON discontinued",
      run: () => {
        const r = parseVisitText(
          "TERAPIA IN ATTO: idrossiclorochina 200 mg/die, non sospeso.\nCONCLUSIONI: LES stabile.",
        );
        const t = r.extracted.therapies?.find(
          (x) => x.drug_name === "Idrossiclorochina",
        );
        if (!t) { console.warn("[guard_non_sospeso] Idrossiclorochina non trovata — drug_name errato?"); return false; }
        return t.status !== "discontinued";
      },
    },

    // ── Lettera reale: AUSL Bologna — Pelliconi 12/09/2025 ─────────────────
    // Testo de-identificato rappresentativo della lettera originale.
    // Ogni sotto-verifica è loggata separatamente per facilitare il debug.
    {
      id: "pelliconi_12092025_terapia_domiciliare",
      description: "Pelliconi: TERAPIA inline → terapia_domiciliare contiene atenololo + colecalciferolo + urbason",
      run: () => {
        const r = parseVisitText(_PELLICONI_LETTER);
        const dom = r.extracted.profilo_generale?.terapia_domiciliare || "";
        const ok1 = /atenololo/i.test(dom);
        const ok2 = /colecalciferolo/i.test(dom);
        const ok3 = /urbason|metilprednisolone|methylprednisolone/i.test(dom);
        if (!ok1) console.warn("[Pelliconi] terapia_domiciliare manca atenololo:", dom);
        if (!ok2) console.warn("[Pelliconi] terapia_domiciliare manca colecalciferolo:", dom);
        if (!ok3) console.warn("[Pelliconi] terapia_domiciliare manca urbason/metilprednisolone:", dom);
        return ok1 && ok2 && ok3;
      },
    },
    {
      id: "pelliconi_12092025_esame_obiettivo",
      description: "Pelliconi: OBBIETTIVAMENTE (doppia B) → visit_sections.esame_obj contiene 3 frasi attese",
      run: () => {
        const r = parseVisitText(_PELLICONI_LETTER);
        const pe = (r.extracted.visit_sections?.esame_obj || "").toLowerCase();
        const ok1 = pe.includes("non segni di artrite");
        const ok2 = pe.includes("pes planus");
        const ok3 = pe.includes("scrosci");
        if (!ok1) console.warn("[Pelliconi] esame_obj manca 'non segni di artrite periferica':", pe.slice(0, 120));
        if (!ok2) console.warn("[Pelliconi] esame_obj manca 'pes planus':", pe.slice(0, 120));
        if (!ok3) console.warn("[Pelliconi] esame_obj manca 'scrosci alle ginocchia':", pe.slice(0, 120));
        return ok1 && ok2 && ok3;
      },
    },
    {
      id: "pelliconi_12092025_allergie",
      description: "Pelliconi: 'Nega allergie.' inline in ANAMNESI_PATOLOGICA → allergie valorizzato, non trasformato in positivo",
      run: () => {
        const r = parseVisitText(_PELLICONI_LETTER);
        const al = r.extracted.profilo_generale?.allergie || "";
        const valorizzato = al.length > 0;
        const nonPositiva  = !/allergi[ae]\s+a\b|allergi[ae]\s+positive/i.test(al);
        if (!valorizzato) console.warn("[Pelliconi] profilo_generale.allergie è vuoto");
        if (!nonPositiva) console.warn("[Pelliconi] allergie sembra positivo:", al);
        return valorizzato && nonPositiva;
      },
    },
    {
      id: "pelliconi_12092025_mtx_discontinued",
      description: "Pelliconi: MTX 'sospeso a metà 2023 per intolleranza GI' → Methotrexate status=discontinued",
      run: () => {
        const r = parseVisitText(_PELLICONI_LETTER);
        const t = r.extracted.therapies?.find((x) => x.drug_name === "Methotrexate");
        const ok = t?.status === "discontinued";
        if (!t) console.warn("[Pelliconi] Methotrexate non trovato nelle therapies");
        else if (!ok) console.warn("[Pelliconi] Methotrexate trovato ma status=", t.status, "atteso discontinued");
        return ok;
      },
    },
    {
      id: "pelliconi_12092025_medrol_mai_sospeso_guard",
      description: "Pelliconi: 'Medrol 4 mg mai sospeso dal 2011' → Metilprednisolone trovato, NON discontinued",
      run: () => {
        const r = parseVisitText(_PELLICONI_LETTER);
        const t = r.extracted.therapies?.find((x) => x.drug_name === "Metilprednisolone");
        if (!t) { console.warn("[Pelliconi] Metilprednisolone non trovato nelle therapies"); return false; }
        if (t.status === "discontinued") {
          console.warn("[Pelliconi] Metilprednisolone erroneamente discontinued — guard 'mai sospeso' fallito");
        }
        return t.status !== "discontinued";
      },
    },

    // ── Referto reale: AUSL Bologna — Militello 09/06/2026 ─────────────────
    // Fix "Easy" dell'audit: scope EO per clinimetria, artefatto "A'" da
    // COMORBILITA', frequenza settimanale, via sottocute, DAS28-PCR non lab,
    // Folina come adiuvante (acido folico, supportive).
    {
      id: "militello_09062026_eo_clinimetry",
      description: "Militello: scope EO → CDAI/SDAI/DAS28-PCR/DAPSA estratti dalle assessments",
      run: () => {
        const r = parseVisitText(_MILITELLO_LETTER);
        const byType = new Map((r.extracted.assessments || []).map((a) => [a.index_type, a.score]));
        const ok =
          byType.get("cdai") === 15 &&
          byType.get("sdai") === 15.06 &&
          byType.get("das28_crp") === 3.1 &&
          byType.get("dapsa") === 16;
        if (!ok) console.warn("[Militello] assessments inattese:", JSON.stringify([...byType]));
        return ok;
      },
    },
    {
      id: "militello_09062026_comorbilita_clean",
      description: "Militello: COMORBILITA' → 'proctite ulcerosa.' senza artefatto \"A'\"",
      run: () => {
        const r = parseVisitText(_MILITELLO_LETTER);
        const com = r.extracted.comorbidita || [];
        const ok = com.some((c) => /proctite ulcerosa/i.test(c)) && !com.some((c) => /^A'/.test(c.trim()));
        if (!ok) console.warn("[Militello] comorbidita inattesa:", JSON.stringify(com));
        return ok;
      },
    },
    {
      id: "militello_09062026_mtx_freq_route",
      description: "Militello: Reumaflex → Methotrexate freq 'una volta a settimana', via 's.c.'",
      run: () => {
        const r = parseVisitText(_MILITELLO_LETTER);
        const t = (r.extracted.therapies || []).find((x) => x.drug_name === "Methotrexate");
        if (!t) { console.warn("[Militello] Methotrexate non trovato nelle therapies"); return false; }
        const ok = t.frequency === "una volta a settimana" && t.route === "s.c.";
        if (!ok) console.warn("[Militello] Methotrexate freq/route inattesi:", t.frequency, t.route);
        return ok;
      },
    },
    {
      id: "militello_09062026_das28pcr_non_lab",
      description: "Militello: 'DAS28-PCR 3.1' NON deve essere estratto come valore di laboratorio crp/pcr",
      run: () => {
        const withGuard = extractLabValues("DAS28-PCR 3.1");
        const mixed = extractLabValues("DAS28-PCR 3.1, PCR 0.8 mg/dL");
        const noLeak = !withGuard.some((v) => v.key === "crp");
        const standaloneOk =
          mixed.some((v) => v.key === "crp" && v.value === 0.8) &&
          !mixed.some((v) => v.key === "crp" && v.value === 3.1);
        if (!noLeak) console.warn("[Militello] 'DAS28-PCR 3.1' erroneamente estratto come crp");
        if (!standaloneOk) console.warn("[Militello] guard DAS28-PCR rompe l'estrazione di PCR standalone");
        return noLeak && standaloneOk;
      },
    },
    {
      id: "militello_09062026_folina_supportive",
      description: "Militello: Folina riconosciuta come Acido folico (supportive), NON nelle therapies strutturate",
      run: () => {
        const today = new Date().toISOString().slice(0, 10);
        const ts = extractTherapies("IN TERAPIA: Folina 5 mg/settimana", today);
        const fol = ts.find((t) => t.drug_name === "Acido folico");
        const recognized = !!fol && fol.category === "supportive";
        const r = parseVisitText(_MILITELLO_LETTER);
        const inStructured = (r.extracted.therapies || []).some((t) => t.drug_name === "Acido folico");
        if (!recognized) console.warn("[Militello] Folina non riconosciuta come Acido folico/supportive");
        if (inStructured) console.warn("[Militello] Acido folico erroneamente presente nelle therapies strutturate");
        return recognized && !inStructured;
      },
    },
  ];

  let passed = 0;
  let failed = 0;
  const results = [];

  for (const c of cases) {
    let ok = false;
    let detail = "";
    try {
      ok = c.run();
      detail = ok ? "✓" : "✗ risultato atteso non ottenuto";
    } catch (e) {
      detail = `✗ ECCEZIONE: ${e.message}`;
    }
    if (ok) passed++; else failed++;
    results.push({ id: c.id, ok, description: c.description, detail });
    console[ok ? "log" : "error"](`[Robustness] ${ok ? "PASS" : "FAIL"} ${c.id}: ${c.description}\n       ${detail}`);
  }

  console.log(`\n[Robustness regression] ${passed}/${passed + failed} test passati${failed > 0 ? ` — ${failed} FALLITI` : " — OK"}`);
  return { passed, failed, results };
}
