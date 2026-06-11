/**
 * raccordo_parser_runner.js
 *
 * Node.js runner per raccordoParser.js — usato dalla POC per confrontare
 * l'output del parser regex con quello dell'LLM locale.
 *
 * Uso: node raccordo_parser_runner.js <testo_raccordo>
 *   oppure: echo "<testo>" | node raccordo_parser_runner.js
 *
 * Output: JSON array di RaccordoEvent su stdout.
 */

// Importato da poc/ — il bundle viene generato da build.sh
const { parseRaccordoTimeline } = require("/tmp/raccordo_bundle.cjs");

const text = process.argv[2] || require("fs").readFileSync("/dev/stdin", "utf8");
const events = parseRaccordoTimeline(text.trim());

// Solo eventi terapeutici (scope della POC)
const THERAPY_TYPES = new Set([
  "therapy_start", "therapy_stop", "dose_change",
  "therapy_switch", "dose_spacing", "unknown",
]);

// Normalizzazione confidence stringa → float
const CONF_MAP = { high: 0.9, medium: 0.7, low: 0.5 };

const normalized = events
  .filter(ev => THERAPY_TYPES.has(ev.event_type))
  .map(ev => {
    const dv = ev.date_value || null;
    const dateYear = dv ? (parseInt(dv.substring(0, 4), 10) || null) : null;
    const confRaw  = ev.confidence;
    const conf     = typeof confRaw === "number"
      ? confRaw
      : (CONF_MAP[String(confRaw).toLowerCase()] ?? 0.7);
    return {
      drug_canonical:  ev.drug_canonical  || null,
      event_type:      ev.event_type,
      date_text:       ev.date_text       || null,
      date_value:      dv,
      date_year:       dateYear,
      date_precision:  ev.date_precision  || null,
      reason:          ev.reason          || null,
      confidence:      conf,
      source_fragment: ev.source_text     || null,
    };
  });

process.stdout.write(JSON.stringify(normalized, null, 2));
