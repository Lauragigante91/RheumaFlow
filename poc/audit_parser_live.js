#!/usr/bin/env node
/**
 * audit_parser_live.js
 *
 * Esegue il parser raccordoParser sul corrente codebase su tutti i TC di
 * poc/test_texts.json, confronta con ground_truth e produce:
 *   - poc/results/TIMESTAMP_audit/audit_results.json
 *   - poc/results/TIMESTAMP_audit/audit_results.csv
 *   - poc/results/TIMESTAMP_audit/audit_report.md
 *
 * Uso: node poc/audit_parser_live.js
 * Pre-requisito: bash poc/build.sh (bundle /tmp/raccordo_bundle.cjs)
 */

"use strict";

const fs   = require("fs");
const path = require("path");

// ── Bundle ────────────────────────────────────────────────────────────────────
const BUNDLE = "/tmp/raccordo_bundle.cjs";
if (!fs.existsSync(BUNDLE)) {
  console.error("Bundle non trovato. Esegui prima: bash poc/build.sh");
  process.exit(1);
}
const { parseRaccordoTimeline } = require(BUNDLE);

// ── Paths ─────────────────────────────────────────────────────────────────────
const SCRIPT_DIR   = path.dirname(path.resolve(__filename));
const TEST_TEXTS   = path.join(SCRIPT_DIR, "test_texts.json");
const RESULTS_ROOT = path.join(SCRIPT_DIR, "results");

const ts        = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15) + "_audit";
const OUT_DIR   = path.join(RESULTS_ROOT, ts);
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Config ────────────────────────────────────────────────────────────────────
const THERAPY_TYPES = new Set([
  "therapy_start", "therapy_stop", "dose_change",
  "therapy_switch", "dose_spacing", "unknown",
]);

// Error categories assigned to each FP / FN
const ERROR_CATEGORY = {
  fn_therapy_stop:   "MISSING_STOP",
  fn_therapy_start:  "MISSING_START",
  fn_dose_spacing:   "MISSING_SPACING",
  fn_dose_change:    "MISSING_DOSE_CHANGE",
  fn_therapy_switch: "MISSING_SWITCH",
  fn_unknown:        "MISSING_UNKNOWN",
  fp_any:            "EXTRA_EVENT",
  date_mismatch:     "DATE_MISMATCH",
  reason_missing:    "REASON_MISSING",
  reason_partial:    "REASON_PARTIAL",
};

// ── Normalisation helpers ─────────────────────────────────────────────────────
function normConf(c) {
  if (typeof c === "number") return c;
  return { high: 0.9, medium: 0.7, low: 0.5 }[String(c).toLowerCase()] ?? 0.7;
}

function normEvents(raw) {
  return raw
    .filter(ev => THERAPY_TYPES.has(ev.event_type))
    .map(ev => {
      const dv = ev.date_value || null;
      return {
        drug_canonical:  ev.drug_canonical  || null,
        event_type:      ev.event_type,
        date_value:      dv,
        date_year:       dv ? parseInt(dv.slice(0, 4), 10) : null,
        date_text:       ev.date_text       || null,
        date_precision:  ev.date_precision  || null,
        reason:          ev.reason          || null,
        confidence:      normConf(ev.confidence),
        source_fragment: ev.source_text || ev.source_fragment || null,
      };
    });
}

// ── Matching ──────────────────────────────────────────────────────────────────
// Match key: drug_canonical (case-insensitive) + event_type
// Date: if GT has date_year and parser has date_year, they must agree ±0
// Reason: soft match (GT reason is a substring of parser reason, case-insensitive)

function sameKey(a, b) {
  return (
    String(a.drug_canonical  || "").toLowerCase() ===
    String(b.drug_canonical  || "").toLowerCase() &&
    a.event_type === b.event_type
  );
}

function reasonMatch(gtReason, parserReason) {
  if (!gtReason)       return "ok_no_gt";
  if (!parserReason)   return "missing";
  const gt  = gtReason.toLowerCase();
  const par = parserReason.toLowerCase();
  // Partial word overlap: at least one significant word (≥4 chars) in common
  const gtWords  = gt.split(/\W+/).filter(w => w.length >= 4);
  const parWords = new Set(par.split(/\W+/));
  const overlap  = gtWords.filter(w => parWords.has(w)).length;
  if (par.includes(gt) || gt.includes(par))    return "full";
  if (overlap >= 1)                            return "partial";
  return "none";
}

function matchEvents(gtList, parserList) {
  const used = new Set();
  const tp   = [];
  const fn   = [];

  for (const gt of gtList) {
    let best = null;
    for (let i = 0; i < parserList.length; i++) {
      if (used.has(i)) continue;
      const pEv = parserList[i];
      if (!sameKey(gt, pEv)) continue;
      // Prefer exact-year match; accept year-null on either side
      const dateOk =
        !gt.date_year || !pEv.date_year ||
        gt.date_year === pEv.date_year;
      if (dateOk) { best = i; break; }
      if (best === null) best = i; // year mismatch but same drug+type — keep as fallback
    }

    if (best !== null) {
      used.add(best);
      const pEv = parserList[best];
      const dateMismatch =
        gt.date_year && pEv.date_year && gt.date_year !== pEv.date_year;
      const rMatch = reasonMatch(gt.reason, pEv.reason);
      tp.push({
        gt:            gt,
        parser:        pEv,
        date_mismatch: dateMismatch || false,
        reason_match:  rMatch,
      });
    } else {
      fn.push(gt);
    }
  }

  const fp = parserList.filter((_, i) => !used.has(i));
  return { tp, fp, fn };
}

// ── Error classification ──────────────────────────────────────────────────────
function classifyMismatch(match) {
  const errors = [];
  if (match.date_mismatch) errors.push(ERROR_CATEGORY.date_mismatch);
  if (match.reason_match === "missing") errors.push(ERROR_CATEGORY.reason_missing);
  else if (match.reason_match === "none") errors.push(ERROR_CATEGORY.reason_partial);
  return errors;
}

function classifyFN(ev) {
  const key = `fn_${ev.event_type}`;
  return ERROR_CATEGORY[key] || "MISSING_OTHER";
}

// ── Per-TC audit ──────────────────────────────────────────────────────────────
function auditTC(tc) {
  const events = normEvents(parseRaccordoTimeline(tc.raccordo));
  const gt     = tc.ground_truth.map(g => ({
    drug_canonical: g.drug_canonical,
    event_type:     g.event_type,
    date_year:      g.date_year ?? null,
    reason:         g.reason     ?? null,
  }));

  const { tp, fp, fn } = matchEvents(gt, events);

  const gtCount     = gt.length;
  const parserCount = events.length;
  const tpCount     = tp.length;
  const fpCount     = fp.length;
  const fnCount     = fn.length;

  const precision   = parserCount > 0 ? tpCount / parserCount : 0;
  const recall      = gtCount     > 0 ? tpCount / gtCount     : 0;
  const f1          = precision + recall > 0
    ? 2 * precision * recall / (precision + recall) : 0;

  // Reason recall: among TP where GT has a reason, how many did parser get (full or partial)?
  const gtWithReason = tp.filter(m => m.gt.reason);
  const reasonFound  = gtWithReason.filter(m =>
    m.reason_match === "full" || m.reason_match === "partial"
  ).length;
  const reasonRecall = gtWithReason.length > 0
    ? reasonFound / gtWithReason.length : null;

  // Mismatch rows
  const mismatches = [];

  for (const m of tp) {
    const errs = classifyMismatch(m);
    if (errs.length) {
      mismatches.push({
        tc_id:          tc.id,
        drug_canonical: m.gt.drug_canonical,
        event_type:     m.gt.event_type,
        match_status:   "TP_WITH_ERROR",
        error_category: errs.join("|"),
        gt_date_year:   m.gt.date_year,
        parser_date_year: m.parser.date_year,
        gt_reason:      m.gt.reason,
        parser_reason:  m.parser.reason,
        source_fragment: m.parser.source_fragment,
      });
    }
  }

  for (const ev of fn) {
    mismatches.push({
      tc_id:            tc.id,
      drug_canonical:   ev.drug_canonical,
      event_type:       ev.event_type,
      match_status:     "FN",
      error_category:   classifyFN(ev),
      gt_date_year:     ev.date_year,
      parser_date_year: null,
      gt_reason:        ev.reason,
      parser_reason:    null,
      source_fragment:  null,
    });
  }

  for (const ev of fp) {
    mismatches.push({
      tc_id:            tc.id,
      drug_canonical:   ev.drug_canonical,
      event_type:       ev.event_type,
      match_status:     "FP",
      error_category:   ERROR_CATEGORY.fp_any,
      gt_date_year:     null,
      parser_date_year: ev.date_year,
      gt_reason:        null,
      parser_reason:    ev.reason,
      source_fragment:  ev.source_fragment,
    });
  }

  return {
    tc_id:          tc.id,
    description:    tc.description,
    raccordo:       tc.raccordo,
    gt_events:      gt,
    parser_events:  events,
    metrics: {
      gt_count:       gtCount,
      parser_count:   parserCount,
      tp:             tpCount,
      fp:             fpCount,
      fn:             fnCount,
      precision:      +precision.toFixed(3),
      recall:         +recall.toFixed(3),
      f1:             +f1.toFixed(3),
      reason_recall:  reasonRecall !== null ? +reasonRecall.toFixed(3) : null,
    },
    tp_detail:      tp,
    mismatches:     mismatches,
  };
}

// ── Load test cases ───────────────────────────────────────────────────────────
const testCases = JSON.parse(fs.readFileSync(TEST_TEXTS, "utf8"));
console.log(`Audit parser live — ${testCases.length} test case\n`);

const results = testCases.map(tc => {
  const r = auditTC(tc);
  const m = r.metrics;
  const flag = m.f1 < 0.5 ? "!!!" : m.f1 < 0.75 ? " ! " : "   ";
  console.log(
    `[${flag}] ${r.tc_id.padEnd(4)} F1=${String(m.f1.toFixed(2)).padEnd(4)}  ` +
    `Pre=${String(m.precision.toFixed(2)).padEnd(4)}  ` +
    `Rec=${String(m.recall.toFixed(2)).padEnd(4)}  ` +
    `TP=${m.tp} FP=${m.fp} FN=${m.fn}  ` +
    `RR=${m.reason_recall !== null ? m.reason_recall.toFixed(2) : "n/a"}  ` +
    `| ${r.description}`
  );
  return r;
});

// ── Aggregate stats ───────────────────────────────────────────────────────────
const agg = results.reduce((acc, r) => {
  const m = r.metrics;
  acc.tp   += m.tp;   acc.fp += m.fp;   acc.fn += m.fn;
  acc.gt   += m.gt_count;
  acc.par  += m.parser_count;
  acc.rrSum += m.reason_recall ?? 0;
  acc.rrN   += m.reason_recall !== null ? 1 : 0;
  return acc;
}, { tp: 0, fp: 0, fn: 0, gt: 0, par: 0, rrSum: 0, rrN: 0 });

const macroF1 = results.reduce((s, r) => s + r.metrics.f1, 0) / results.length;
const microPre = agg.par > 0 ? agg.tp / agg.par : 0;
const microRec = agg.gt  > 0 ? agg.tp / agg.gt  : 0;
const microF1  = microPre + microRec > 0
  ? 2 * microPre * microRec / (microPre + microRec) : 0;
const avgRR = agg.rrN > 0 ? agg.rrSum / agg.rrN : null;

// Error frequency
const allMismatches = results.flatMap(r => r.mismatches);
const catFreq = {};
for (const m of allMismatches) {
  for (const cat of m.error_category.split("|")) {
    catFreq[cat] = (catFreq[cat] || 0) + 1;
  }
}
const catSorted = Object.entries(catFreq).sort((a, b) => b[1] - a[1]);

console.log("\n─────────────────────────────────────────────────────────");
console.log(`Macro-F1:  ${macroF1.toFixed(3)}`);
console.log(`Micro-Pre: ${microPre.toFixed(3)}  Micro-Rec: ${microRec.toFixed(3)}  Micro-F1: ${microF1.toFixed(3)}`);
console.log(`Avg Reason Recall: ${avgRR !== null ? avgRR.toFixed(3) : "n/a"}`);
console.log(`Totale: TP=${agg.tp} FP=${agg.fp} FN=${agg.fn}  (eventi GT=${agg.gt}, parser=${agg.par})`);
console.log("\nFrequenza errori:");
for (const [cat, n] of catSorted) {
  console.log(`  ${String(n).padStart(3)}  ${cat}`);
}

// ── Save JSON ─────────────────────────────────────────────────────────────────
const jsonOut = {
  generated_at: new Date().toISOString(),
  parser_version: "raccordoParser.js (live bundle)",
  tc_count: results.length,
  aggregate: {
    macro_f1:      +macroF1.toFixed(3),
    micro_precision: +microPre.toFixed(3),
    micro_recall:    +microRec.toFixed(3),
    micro_f1:        +microF1.toFixed(3),
    avg_reason_recall: avgRR !== null ? +avgRR.toFixed(3) : null,
    total_tp: agg.tp, total_fp: agg.fp, total_fn: agg.fn,
    total_gt_events: agg.gt, total_parser_events: agg.par,
  },
  error_frequency: Object.fromEntries(catSorted),
  test_cases: results,
};
fs.writeFileSync(path.join(OUT_DIR, "audit_results.json"),
  JSON.stringify(jsonOut, null, 2), "utf8");

// ── Save CSV (per mismatch) ───────────────────────────────────────────────────
const csvHeader = [
  "tc_id","description","match_status","error_category",
  "drug_canonical","event_type",
  "gt_date_year","parser_date_year",
  "gt_reason","parser_reason",
  "source_fragment",
].join(",");

function csvQ(v) {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/"/g, '""');
  return /[,"\n\r]/.test(s) ? `"${s}"` : s;
}

const csvRows = [];
for (const r of results) {
  if (r.mismatches.length === 0) {
    csvRows.push([
      r.tc_id, csvQ(r.description), "ALL_OK", "",
      "", "", "", "", "", "", "",
    ].join(","));
  } else {
    for (const m of r.mismatches) {
      csvRows.push([
        m.tc_id, csvQ(r.description), m.match_status, m.error_category,
        csvQ(m.drug_canonical), m.event_type,
        m.gt_date_year ?? "", m.parser_date_year ?? "",
        csvQ(m.gt_reason), csvQ(m.parser_reason),
        csvQ(m.source_fragment),
      ].join(","));
    }
  }
}
fs.writeFileSync(path.join(OUT_DIR, "audit_results.csv"),
  [csvHeader, ...csvRows].join("\n"), "utf8");

// ── Save Markdown report ──────────────────────────────────────────────────────
function pct(n) { return (n * 100).toFixed(1) + "%"; }
function bar(f, w = 20) {
  const filled = Math.round(f * w);
  return "[" + "#".repeat(filled) + "-".repeat(w - filled) + "]";
}

const worstTCs = [...results].sort((a, b) => a.metrics.f1 - b.metrics.f1).slice(0, 5);

let md = `# Audit parser raccordoParser — Risultati live\n\n`;
md += `**Generato:** ${new Date().toLocaleString("it-IT")}\n`;
md += `**Parser:** raccordoParser.js (bundle live)\n`;
md += `**Test case:** ${results.length} (TC01–TC${results.length.toString().padStart(2, "0")})\n\n`;

md += `---\n\n## Metriche aggregate\n\n`;
md += `| Metrica | Valore |\n|---|---|\n`;
md += `| Macro-F1 | **${macroF1.toFixed(3)}** ${bar(macroF1)} |\n`;
md += `| Micro-F1 | **${microF1.toFixed(3)}** ${bar(microF1)} |\n`;
md += `| Micro-Precisione | ${pct(microPre)} |\n`;
md += `| Micro-Recall | ${pct(microRec)} |\n`;
md += `| Avg Reason Recall | ${avgRR !== null ? pct(avgRR) : "n/a"} |\n`;
md += `| Totale TP | ${agg.tp} |\n`;
md += `| Totale FP | ${agg.fp} |\n`;
md += `| Totale FN | ${agg.fn} |\n`;
md += `| Eventi GT totali | ${agg.gt} |\n`;
md += `| Eventi parser totali | ${agg.par} |\n\n`;

md += `---\n\n## Risultati per test case\n\n`;
md += `| ID | F1 | Pre | Rec | TP | FP | FN | RR | Descrizione |\n`;
md += `|---|---|---|---|---|---|---|---|---|\n`;
for (const r of results) {
  const m = r.metrics;
  const flag = m.f1 < 0.5 ? "🔴" : m.f1 < 0.75 ? "🟡" : "🟢";
  md += `| ${r.tc_id} | ${flag} ${m.f1.toFixed(2)} | ${m.precision.toFixed(2)} | ${m.recall.toFixed(2)} | ${m.tp} | ${m.fp} | ${m.fn} | ${m.reason_recall !== null ? m.reason_recall.toFixed(2) : "–"} | ${r.description} |\n`;
}

md += `\n---\n\n## Frequenza errori\n\n`;
md += `| Categoria errore | Occorrenze |\n|---|---|\n`;
for (const [cat, n] of catSorted) {
  md += `| \`${cat}\` | ${n} |\n`;
}

md += `\n---\n\n## Peggiori 5 test case (per F1)\n\n`;
for (const r of worstTCs) {
  const m = r.metrics;
  md += `### ${r.tc_id} — F1 ${m.f1.toFixed(2)} — ${r.description}\n\n`;
  md += `**Input raccordo:**\n\`\`\`\n${r.raccordo}\n\`\`\`\n\n`;
  md += `**Ground truth (${m.gt_count} eventi):**\n\n`;
  md += `| Drug | Tipo | Anno | Motivo |\n|---|---|---|---|\n`;
  for (const g of r.gt_events) {
    md += `| ${g.drug_canonical} | ${g.event_type} | ${g.date_year ?? "–"} | ${g.reason ?? "–"} |\n`;
  }
  md += `\n**Parser output (${m.parser_count} eventi):**\n\n`;
  if (r.parser_events.length === 0) {
    md += `_Nessun evento estratto._\n\n`;
  } else {
    md += `| Drug | Tipo | Anno | Motivo | Confidence | Frammento |\n|---|---|---|---|---|---|\n`;
    for (const ev of r.parser_events) {
      const frag = ev.source_fragment
        ? ev.source_fragment.slice(0, 80) + (ev.source_fragment.length > 80 ? "…" : "")
        : "–";
      md += `| ${ev.drug_canonical} | ${ev.event_type} | ${ev.date_year ?? "–"} | ${ev.reason ?? "–"} | ${ev.confidence.toFixed(2)} | ${frag} |\n`;
    }
  }
  md += `\n**Mismatch:**\n\n`;
  if (r.mismatches.length === 0) {
    md += `_Nessun mismatch._\n\n`;
  } else {
    md += `| Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |\n`;
    md += `|---|---|---|---|---|---|---|---|\n`;
    for (const mm of r.mismatches) {
      md += `| ${mm.match_status} | \`${mm.error_category}\` | ${mm.drug_canonical} | ${mm.event_type} | ${mm.gt_date_year ?? "–"} | ${mm.parser_date_year ?? "–"} | ${mm.gt_reason ?? "–"} | ${mm.parser_reason ?? "–"} |\n`;
    }
    md += "\n";
  }
}

md += `---\n\n## Dettaglio completo mismatch\n\n`;
md += `| TC | Status | Categoria | Drug | Tipo | Anno GT | Anno Parser | Motivo GT | Motivo Parser |\n`;
md += `|---|---|---|---|---|---|---|---|---|\n`;
for (const mm of allMismatches) {
  md += `| ${mm.tc_id} | ${mm.match_status} | \`${mm.error_category}\` | ${mm.drug_canonical} | ${mm.event_type} | ${mm.gt_date_year ?? "–"} | ${mm.parser_date_year ?? "–"} | ${mm.gt_reason ?? "–"} | ${mm.parser_reason ?? "–"} |\n`;
}

fs.writeFileSync(path.join(OUT_DIR, "audit_report.md"), md, "utf8");

console.log(`\nOutput salvato in: poc/results/${ts}/`);
console.log(`  audit_results.json`);
console.log(`  audit_results.csv`);
console.log(`  audit_report.md`);
