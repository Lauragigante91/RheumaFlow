#!/usr/bin/env bash
# build.sh — ricrea il bundle CJS dal raccordoParser ES module
# Eseguire dalla root del workspace: bash poc/build.sh

set -e

cd "$(dirname "$0")/.."

echo "Bundling raccordoParser + drugs → /tmp/raccordo_bundle.cjs …"
npx esbuild frontend/src/lib/raccordoParser.js \
  --bundle \
  --platform=node \
  --format=cjs \
  --outfile=/tmp/raccordo_bundle.cjs \
  --log-level=warning

node -e "
const { parseRaccordoTimeline } = require('/tmp/raccordo_bundle.cjs');
const r = parseRaccordoTimeline('Dal 2011 Methotrexate. Sospeso nel 2022 per intolleranza.');
console.assert(r.length >= 1, 'bundle smoke test failed');
console.log('Bundle OK — smoke test OK (' + r.length + ' eventi)');
"

echo "Aggiornamento drug_canonicals.json e drug_alias_index.json …"
node -e "
const fs = require('fs');
let src = fs.readFileSync('frontend/src/lib/drugs.js', 'utf8').replace(/^export\s+/gm, '');
const tmp = '/tmp/drugs_cjs.js';
fs.writeFileSync(tmp, src + '\nmodule.exports = { DRUG_ALIAS_MAP };');
const { DRUG_ALIAS_MAP } = require(tmp);
const canonicals = [...new Set(Object.values(DRUG_ALIAS_MAP).map(v => v.canonical))].sort();
fs.writeFileSync('/tmp/drug_canonicals.json', JSON.stringify(canonicals));
console.log('drug_canonicals.json aggiornato:', canonicals.length, 'farmaci canonici');

// Alias index: canonical → array di alias lowercase
const index = {};
canonicals.forEach(c => { index[c] = []; });
for (const [alias, meta] of Object.entries(DRUG_ALIAS_MAP)) {
  const can = meta.canonical;
  if (can && index[can] !== undefined) {
    index[can].push(alias.toLowerCase());
  }
}
fs.writeFileSync('/tmp/drug_alias_index.json', JSON.stringify(index));
console.log('drug_alias_index.json aggiornato:', Object.keys(index).length, 'canonicals');
"

echo ""
echo "Build completata. Puoi ora eseguire:"
echo "  python3 poc/raccordo_llm_poc.py --no-llm               # solo parser regex"
echo "  python3 poc/raccordo_llm_poc.py --export               # genera pacchetto offline"
echo "  python3 poc/raccordo_llm_poc.py --model qwen2.5:3b     # LLM + parser"
echo "  python3 poc/raccordo_llm_poc.py --model qwen2.5:3b --tc TC01,TC02"
