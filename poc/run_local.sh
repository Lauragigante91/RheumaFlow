#!/usr/bin/env bash
# run_local.sh — POC raccordo LLM su PC locale con Ollama
#
# Uso:
#   bash poc/run_local.sh                          # confronto 3B vs 7B su tutti i TC
#   bash poc/run_local.sh qwen2.5:3b               # solo 3B
#   bash poc/run_local.sh qwen2.5:3b qwen2.5:7b    # 3B vs 7B esplicito
#   bash poc/run_local.sh qwen2.5:3b --tc TC01,TC06 --verbose
#   bash poc/run_local.sh --no-llm                 # solo baseline parser regex
#
# Prerequisiti: Ollama in esecuzione, Node.js, Python 3.8+
# Vedere: poc/LOCAL_SETUP.md

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${BOLD}[run_local]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[ERRORE]${NC} $*"; exit 1; }

MODEL1="qwen2.5:3b"
MODEL2="qwen2.5:7b"
EXTRA_ARGS=()
NO_LLM=0

# Parsing argomenti semplificato
for arg in "$@"; do
    case "$arg" in
        --no-llm)          NO_LLM=1 ;;
        --*)               EXTRA_ARGS+=("$arg") ;;
        qwen2.5:*|llama*|mistral*|phi*)
            if [ -z "$_M1_SET" ]; then MODEL1="$arg"; _M1_SET=1
            else MODEL2="$arg"; fi ;;
        *)                 EXTRA_ARGS+=("$arg") ;;
    esac
done

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║  RheumaFlow — POC raccordo LLM  (esecuzione locale)         ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Controlla Node.js ──────────────────────────────────────────────────────
log "Verifica Node.js…"
node --version > /dev/null 2>&1 || fail "Node.js non trovato. Installa da https://nodejs.org/"
ok "Node.js $(node --version)"

# ── 2. Controlla Python 3 ────────────────────────────────────────────────────
log "Verifica Python 3…"
PYTHON=$(command -v python3 || command -v python || "")
[ -z "$PYTHON" ] && fail "Python 3 non trovato."
$PYTHON --version > /dev/null 2>&1 || fail "Python 3 non funzionante."
ok "Python $($PYTHON --version)"

# ── 3. Controlla Ollama ──────────────────────────────────────────────────────
if [ "$NO_LLM" = "0" ]; then
    log "Verifica Ollama…"
    ollama --version > /dev/null 2>&1 || fail "Ollama non trovato. Installa da https://ollama.com/download\nPoi esegui: ollama serve"
    curl -sf http://localhost:11434/api/tags > /dev/null 2>&1 || {
        warn "Ollama non in ascolto su :11434. Avvia con: ollama serve"
        fail "Ollama non raggiungibile."
    }
    ok "Ollama attivo"

    # ── 4. Pull modelli se necessari ──────────────────────────────────────────
    MODELS_JSON=$(curl -sf http://localhost:11434/api/tags)
    AVAILABLE=$(echo "$MODELS_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(' '.join(m['name'] for m in d.get('models',[])))" 2>/dev/null || echo "")

    pull_if_missing() {
        local model="$1"
        if echo "$AVAILABLE" | grep -q "$model"; then
            ok "Modello $model già presente"
        else
            log "Pull $model (potrebbe richiedere qualche minuto)…"
            ollama pull "$model" || fail "Pull $model fallito"
            ok "Pull $model completato"
        fi
    }

    if [ "$NO_LLM" = "0" ]; then
        pull_if_missing "$MODEL1"
        [ "$MODEL1" != "$MODEL2" ] && pull_if_missing "$MODEL2"
    fi
fi

# ── 5. Genera bundle raccordoParser + drug data ───────────────────────────────
log "Generazione bundle raccordoParser…"
bash poc/build.sh 2>&1 | grep -v "^$" | sed 's/^/    /'
ok "Bundle generato"

# ── 6. Crea output directory ─────────────────────────────────────────────────
OUT_DIR="poc/results/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$OUT_DIR"
log "Output → $OUT_DIR"

# ── 7. Esegui POC ─────────────────────────────────────────────────────────────
echo ""
if [ "$NO_LLM" = "1" ]; then
    log "Esecuzione solo parser regex (--no-llm)…"
    CMD="$PYTHON poc/raccordo_llm_poc.py --no-llm ${EXTRA_ARGS[*]}"
else
    if [ "$MODEL1" = "$MODEL2" ]; then
        log "Esecuzione con modello: $MODEL1"
        CMD="$PYTHON poc/raccordo_llm_poc.py --model $MODEL1 ${EXTRA_ARGS[*]}"
    else
        log "Esecuzione confronto: $MODEL1 vs $MODEL2"
        CMD="$PYTHON poc/raccordo_llm_poc.py --compare $MODEL1 $MODEL2 ${EXTRA_ARGS[*]}"
    fi
fi

echo -e "${CYAN}  $ $CMD${NC}"
echo ""

# Esegui e salva output
$CMD 2>&1 | tee "$OUT_DIR/output.txt"
EXIT_CODE=${PIPESTATUS[0]}

# ── 8. Salva anche JSON risultati (re-run con redirect) ───────────────────────
echo ""
if [ "$EXIT_CODE" = "0" ]; then
    ok "POC completato. Output: $OUT_DIR/output.txt"
    echo ""
    echo -e "${BOLD}Risultati salvati:${NC}"
    echo -e "  ${CYAN}$OUT_DIR/output.txt${NC}   output completo (testo)"
    echo ""
    echo -e "Confronto baseline parser (pre-calcolato da Replit):"
    echo -e "  ${CYAN}poc/export/parser_baseline.csv${NC}"
    echo ""
else
    fail "POC terminato con errore (exit $EXIT_CODE). Controlla $OUT_DIR/output.txt"
fi
