"use strict";
const { parseRaccordoTimeline } = require('/tmp/raccordo_bundle.cjs');
const tests = require('./poc/test_texts.json');

const STOP_RE = /\b(sospeso|sospesa|sospesi|sospese|sospension[ei]|interrott[oa]|discontinuat[oa]|cessato|cessata|smesso|smessa|fermato|fermata)\b/i;
const DRUG_ALIASES = [
  'Methotrexate','MTX','metotressato','Adalimumab','Leflunomide','LEF','Idrossiclorochina','HCQ','hcq',
  'Micofenolato','MMF','Etanercept','Rituximab','RTX','Infliximab','IFX','Tofacitinib','Baricitinib',
  'Secukinumab','Certolizumab','Golimumab','Ixekizumab','Upadacitinib','Abatacept','Prednisone',
  'Azatioprina','Belimumab','Ciclofosfamide','Sulfasalazina','Nifedipina','Sildenafil','Bosentan','Nintedanib',
];

function hasDrugInRange(s, from, to) {
  const sub = s.slice(from, to).toLowerCase();
  return DRUG_ALIASES.some(d => sub.includes(d.toLowerCase()));
}

const stats = { verbFirst:0, anaphora:0, dalBefore:0, startVerb:0, switchVerb:0, dateRange:0 };
const ex    = { verbFirst:[], anaphora:[], dalBefore:[], startVerb:[], switchVerb:[], dateRange:[] };

for (const tc of tests) {
  const sentences = tc.raccordo
    .split(/(?<=[.;!\n])\s+|\n{2,}/)
    .map(s => s.trim())
    .filter(s => s.length > 8);

  for (const s of sentences) {
    // ── Verb-first stop / implicit anaphora ──────────────────────────────────
    if (STOP_RE.test(s)) {
      const mStop = STOP_RE.exec(s);
      const stopPos = mStop.index;
      const drugBefore = hasDrugInRange(s, 0, stopPos);
      const drugAfter  = hasDrugInRange(s, stopPos, s.length);
      const pronoun = /\b(?:del|della)\s+(?:farmaco|terapia|biologico|biosimilare|trattamento|molecola)\b/i.test(s);
      if (!drugBefore && drugAfter)           { stats.verbFirst++; if (ex.verbFirst.length < 3) ex.verbFirst.push({tc: tc.id, s: s.slice(0,110)}); }
      if (!drugBefore && !drugAfter && !pronoun) { stats.anaphora++; if (ex.anaphora.length < 3) ex.anaphora.push({tc: tc.id, s: s.slice(0,110)}); }
    }

    // ── Drug before "dal YEAR" or "dal MM/YYYY" ───────────────────────────────
    const dalRe = /\bdal?\s+(?:(?:0?\d|1[012])\/)?((19|20)\d{2})\b/gi;
    let dm;
    while ((dm = dalRe.exec(s)) !== null) {
      const drugBefore = hasDrugInRange(s, 0, dm.index);
      const drugAfter  = hasDrugInRange(s, dm.index + dm[0].length, s.length);
      if (drugBefore && !drugAfter) { stats.dalBefore++; if (ex.dalBefore.length < 3) ex.dalBefore.push({tc: tc.id, match: dm[0], s: s.slice(0,110)}); }
    }

    // ── Start verbs (avviato/aggiunto/iniziato/introdotto/intrapreso/ripreso) ─
    if (/\b(avviat[oa]|aggiunt[oa]|iniziat[oa]|introdott[oa]|intrapres[oa]|ripres[oa]|riavviat[oa]|reintrodott[oa])\b/i.test(s)) {
      const hasDrug = DRUG_ALIASES.some(d => s.toLowerCase().includes(d.toLowerCase()));
      if (hasDrug) { stats.startVerb++; if (ex.startVerb.length < 3) ex.startVerb.push({tc: tc.id, s: s.slice(0,110)}); }
    }

    // ── Switch verbs ──────────────────────────────────────────────────────────
    if (/\b(passato\s+a|sostituito\s+con|switch\s+a|cambiato\s+(?:a|con)|convertito\s+a)\b/i.test(s)) {
      const hasDrug = DRUG_ALIASES.some(d => s.toLowerCase().includes(d.toLowerCase()));
      if (hasDrug) { stats.switchVerb++; if (ex.switchVerb.length < 3) ex.switchVerb.push({tc: tc.id, s: s.slice(0,110)}); }
    }

    // ── Date-range format "YEAR-YEAR: DRUG" or "YEAR: drug" ──────────────────
    if (/^[-*\s]*\d{4}[-–](?:\d{4}|oggi|ad\s+oggi)\s*:/i.test(s) || /^[-*\s]*\d{4}\s*:/i.test(s)) {
      const hasDrug = DRUG_ALIASES.some(d => s.toLowerCase().includes(d.toLowerCase()));
      if (hasDrug) { stats.dateRange++; if (ex.dateRange.length < 2) ex.dateRange.push({tc: tc.id, s: s.slice(0,110)}); }
    }
  }
}

console.log(JSON.stringify({ stats, ex }, null, 2));
