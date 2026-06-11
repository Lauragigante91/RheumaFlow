"""
raccordo_llm_standalone.py — POC raccordo LLM, versione standalone Python puro

Differenze rispetto a raccordo_llm_poc.py:
  - Nessun Node.js / esbuild richiesto
  - Drug canonicals estratti da drugs.js via regex Python
  - Parser baseline caricato da poc/export/parser_baseline/ (pre-calcolato)
  - Ollama API tramite urllib.request (zero dipendenze esterne)

Uso:
  python poc/raccordo_llm_standalone.py --no-llm
  python poc/raccordo_llm_standalone.py --model qwen2.5:3b
  python poc/raccordo_llm_standalone.py --compare qwen2.5:3b qwen2.5:7b
  python poc/raccordo_llm_standalone.py --model qwen2.5:3b --tc real
  python poc/raccordo_llm_standalone.py --model qwen2.5:3b --tc TC01,TC06 --verbose
"""

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime

# ── Costanti ──────────────────────────────────────────────────────────────────

SCRIPT_DIR        = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR          = os.path.dirname(SCRIPT_DIR)
DRUGS_JS          = os.path.join(ROOT_DIR, "frontend", "src", "lib", "drugs.js")
EXPORT_DIR        = os.path.join(SCRIPT_DIR, "export")
DRUG_ALIAS_INDEX  = os.path.join(EXPORT_DIR, "drug_alias_index.json")
TC_DATA_DIR  = os.path.join(EXPORT_DIR, "tc_data")
BASELINE_DIR = os.path.join(EXPORT_DIR, "parser_baseline")
TEST_TEXTS   = os.path.join(SCRIPT_DIR, "test_texts.json")

ALLOWED_EVENT_TYPES = {
    "therapy_start", "therapy_stop", "dose_change",
    "therapy_switch", "dose_spacing", "unknown",
}
CONFIDENCE_THRESHOLD  = 0.7
EST_CORRECTION_SECS   = 45
_CONF_STR_MAP         = {"high": 0.9, "medium": 0.7, "low": 0.5}

BOLD   = "\033[1m"
DIM    = "\033[2m"
CYAN   = "\033[0;36m"
GREEN  = "\033[0;32m"
YELLOW = "\033[1;33m"
RED    = "\033[0;31m"
RESET  = "\033[0m"

# Disabilita ANSI su Windows senza terminale compatibile
if sys.platform == "win32" and not os.environ.get("TERM"):
    BOLD = DIM = CYAN = GREEN = YELLOW = RED = RESET = ""

# ── Estrazione drug data da drugs.js (Python puro) ────────────────────────────

def load_drug_data() -> tuple[set, dict]:
    """
    Carica drug canonicals e alias da:
      1. export/drug_alias_index.json  (distribuito con il POC)
      2. frontend/src/lib/drugs.js     (ambiente di sviluppo)
      3. fallback silenzioso           (validazione farmaci disabilitata)

    Restituisce:
        canonicals  — set di nomi canonici (es. {"Methotrexate", ...})
        alias_map   — dict canonical → list[alias_lowercase]
    """
    if os.path.isfile(DRUG_ALIAS_INDEX):
        try:
            data = json.load(open(DRUG_ALIAS_INDEX, encoding="utf-8"))
            alias_map = data.get("alias_map", {})
            canonicals = set(data.get("canonicals", alias_map.keys()))
            return canonicals, alias_map
        except Exception:
            pass

    if os.path.isfile(DRUGS_JS):
        try:
            src = open(DRUGS_JS, encoding="utf-8").read()
            entries = re.findall(
                r'"([^"]+)"\s*:\s*\{[^}]*canonical\s*:\s*"([^"]+)"', src
            )
            alias_map: dict = {}
            for alias, canonical in entries:
                alias_map.setdefault(canonical, []).append(alias.lower())
            return set(alias_map.keys()), alias_map
        except Exception:
            pass

    return set(), {}


def drug_in_text(canonical: str, text: str, alias_map: dict) -> bool:
    """Verifica che il farmaco (o un suo alias) compaia nel testo sorgente."""
    if not text or not canonical:
        return True
    text_lower = text.lower()
    aliases = alias_map.get(canonical, [canonical.lower()])
    for alias in aliases:
        if re.search(r"\b" + re.escape(alias) + r"\b", text_lower):
            return True
    return False


# ── Caricamento test case ─────────────────────────────────────────────────────

def load_test_cases(selected_ids: list[str] | None = None) -> list[dict]:
    """
    Carica i test case da poc/export/tc_data/ (preferito) o poc/test_texts.json.
    """
    cases = []

    if os.path.isdir(TC_DATA_DIR):
        for fn in sorted(os.listdir(TC_DATA_DIR)):
            if fn.endswith(".json"):
                tc = json.load(open(os.path.join(TC_DATA_DIR, fn), encoding="utf-8"))
                cases.append(tc)
    elif os.path.isfile(TEST_TEXTS):
        cases = json.load(open(TEST_TEXTS, encoding="utf-8"))
    else:
        print(f"{RED}[ERRORE] Nessuna sorgente test case trovata.{RESET}")
        print(f"  Atteso: {TC_DATA_DIR}/  oppure  {TEST_TEXTS}")
        sys.exit(1)

    if selected_ids:
        cases = [c for c in cases if c["id"] in selected_ids]

    if not cases:
        print(f"{RED}[ERRORE] Nessun test case trovato per gli ID selezionati.{RESET}")
        sys.exit(1)

    return cases


# ── Caricamento parser baseline ───────────────────────────────────────────────

def load_parser_baseline(tc_id: str) -> dict | None:
    """
    Carica il baseline parser pre-calcolato da poc/export/parser_baseline/TCxx.json.
    Restituisce None se non disponibile.
    """
    path = os.path.join(BASELINE_DIR, f"{tc_id}.json")
    if os.path.isfile(path):
        return json.load(open(path, encoding="utf-8"))
    return None


# ── Ollama API (urllib puro) ──────────────────────────────────────────────────

def ollama_available(host: str = "http://localhost:11434") -> bool:
    try:
        req = urllib.request.urlopen(f"{host}/api/tags", timeout=3)
        return req.status == 200
    except Exception:
        return False


def ollama_model_available(model: str, host: str = "http://localhost:11434") -> bool:
    try:
        data  = json.load(urllib.request.urlopen(f"{host}/api/tags", timeout=5))
        names = [m["name"] for m in data.get("models", [])]
        return model in names or any(m.startswith(model.split(":")[0]) for m in names)
    except Exception:
        return False


def call_ollama(model: str, prompt: str, system: str,
                host: str = "http://localhost:11434",
                timeout: int = 120) -> tuple[str, float]:
    """
    Chiama Ollama via REST API con urllib.request (stdlib).
    Restituisce (risposta_testo, latenza_secondi).
    """
    payload = json.dumps({
        "model":  model,
        "prompt": prompt,
        "system": system,
        "stream": False,
        "options": {
            "temperature":   0.1,
            "top_p":         0.9,
            "repeat_penalty": 1.1,
        },
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{host}/api/generate",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body     = json.loads(resp.read().decode("utf-8"))
            elapsed  = time.time() - t0
            return body.get("response", ""), elapsed
    except urllib.error.URLError as e:
        raise RuntimeError(f"Ollama non raggiungibile su {host}: {e.reason}") from e
    except Exception as e:
        raise RuntimeError(f"Errore chiamata Ollama: {e}") from e


# ── Prompt ────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
Sei un assistente medico specializzato in reumatologia.
Il tuo compito e' analizzare un raccordo anamnestico e restituire SOLO gli eventi
terapeutici in formato JSON.

TIPI DI EVENTO AMMESSI:
- therapy_start    : inizio o ripresa di un farmaco
- therapy_stop     : sospensione o interruzione
- dose_change      : variazione di dose
- therapy_switch   : switch a farmaco diverso
- dose_spacing     : allungamento o riduzione dell'intervallo tra dosi
- unknown          : evento terapeutico non classificabile

FORMATO RISPOSTA (solo JSON, nessun testo aggiuntivo):
[
  {
    "drug_canonical": "NomeFarmacoCanonicoItaliano",
    "event_type": "therapy_start",
    "date_year": 2019,
    "reason": "motivo se presente, altrimenti null",
    "confidence": 0.9,
    "source_fragment": "frase originale da cui hai estratto l'evento"
  }
]

REGOLE IMPORTANTI:
1. Estrai SOLO farmaci esplicitamente citati nel testo
2. drug_canonical deve essere il nome commerciale o INN esatto del farmaco
3. Non inventare farmaci o eventi non presenti nel testo
4. confidence: 0.9=certezza, 0.7=probabile, 0.5=incerto
5. date_year: solo l'anno come intero, null se non presente
6. Se non trovi eventi terapeutici, restituisci []
"""


def build_prompt(raccordo: str) -> str:
    return f"Analizza il seguente raccordo anamnestico:\n\n{raccordo}\n\nRispondi solo con il JSON degli eventi terapeutici:"


# ── Parsing risposta LLM ──────────────────────────────────────────────────────

_JSON_RE = re.compile(r"\[.*?\]", re.DOTALL)


def parse_llm_response(text: str) -> tuple[list[dict], str | None]:
    """
    Estrae il primo array JSON dalla risposta LLM.
    Restituisce (eventi, errore_se_fallisce).
    """
    text = text.strip()
    if not text:
        return [], "risposta_vuota"

    m = _JSON_RE.search(text)
    if not m:
        return [], "json_non_trovato"

    try:
        data = json.loads(m.group())
        if not isinstance(data, list):
            return [], "json_non_lista"
        return data, None
    except json.JSONDecodeError as e:
        return [], f"json_decode_error:{e}"


# ── Validazione eventi ────────────────────────────────────────────────────────

def validate_event(ev: dict, canonicals: set, alias_map: dict) -> dict:
    errors   = []
    warnings = []

    if not isinstance(ev, dict):
        return {"valid": False, "errors": ["tipo_non_dict"], "warnings": []}

    et = ev.get("event_type")
    if et not in ALLOWED_EVENT_TYPES:
        errors.append(f"event_type_non_ammesso:{et}")

    dc = ev.get("drug_canonical")
    if dc is not None:
        if not isinstance(dc, str):
            errors.append("drug_canonical_tipo_errato")
        elif canonicals:
            matched = next(
                (c for c in canonicals if c.lower() == dc.lower()), None
            )
            if matched:
                ev["drug_canonical"] = matched
                dc = matched
            else:
                errors.append(f"drug_non_in_mappa:{dc}")

    frag = ev.get("source_fragment") or ""
    if dc and isinstance(dc, str) and dc in canonicals and frag:
        if not drug_in_text(dc, frag, alias_map):
            warnings.append(f"drug_non_in_fragment:{dc}")

    conf = ev.get("confidence")
    if isinstance(conf, str):
        conf = _CONF_STR_MAP.get(conf.lower())
        if conf is not None:
            ev["confidence"] = conf
    if not isinstance(conf, (int, float)) or not (0.0 <= conf <= 1.0):
        errors.append("confidence_fuori_range")
    elif conf < CONFIDENCE_THRESHOLD:
        warnings.append(f"confidence_bassa:{conf:.2f}")

    dy = ev.get("date_year")
    if dy is not None:
        if not isinstance(dy, int) or not (1950 <= dy <= 2030):
            errors.append(f"date_year_non_plausibile:{dy}")

    return {
        "valid":    len(errors) == 0,
        "errors":   errors,
        "warnings": warnings,
    }


def validate_all(events: list[dict], canonicals: set,
                 alias_map: dict) -> list[dict]:
    for ev in events:
        ev["_validation"] = validate_event(ev, canonicals, alias_map)
    return events


# ── Metriche ──────────────────────────────────────────────────────────────────

def _ev_key(e: dict) -> tuple:
    return (
        (e.get("drug_canonical") or "").lower(),
        e.get("event_type") or "",
    )


def _reason_present(r: str | None) -> bool:
    return bool(r and str(r).strip() not in ("null", "None", ""))


def deduplicate(events: list[dict]) -> tuple[list[dict], int]:
    seen  = {}
    dupes = 0
    for ev in events:
        k  = _ev_key(ev)
        dy = ev.get("date_year")
        full_key = (k, dy)
        if full_key in seen:
            conf_new = ev.get("confidence", 0) if isinstance(ev.get("confidence"), (int, float)) else 0
            conf_old = seen[full_key].get("confidence", 0) if isinstance(seen[full_key].get("confidence"), (int, float)) else 0
            if conf_new > conf_old:
                seen[full_key] = ev
            dupes += 1
        else:
            seen[full_key] = ev
    return list(seen.values()), dupes


def compute_metrics(predicted: list[dict], ground_truth: list[dict],
                    alias_map: dict, canonicals: set) -> dict:
    gt_keys  = [_ev_key(e) for e in ground_truth]
    pred_keys = [_ev_key(e) for e in predicted]

    matched_gt   = set()
    matched_pred = set()
    for i, pk in enumerate(pred_keys):
        for j, gk in enumerate(gt_keys):
            if j not in matched_gt and pk == gk:
                matched_gt.add(j)
                matched_pred.add(i)
                break

    tp = len(matched_gt)
    fp = len(predicted) - tp
    fn = len(ground_truth) - tp

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall    = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1        = (2 * precision * recall / (precision + recall)
                 if (precision + recall) > 0 else 0.0)

    false_drugs = sum(
        1 for ev in predicted
        if ev.get("drug_canonical") and canonicals
        and ev["drug_canonical"] not in canonicals
    )

    gt_reasons  = sum(1 for e in ground_truth if _reason_present(e.get("reason")))
    pred_reasons = sum(
        1 for i, e in enumerate(predicted)
        if i in matched_pred and _reason_present(e.get("reason"))
    )
    reason_recall = pred_reasons / gt_reasons if gt_reasons > 0 else 1.0

    confs   = [e["confidence"] for e in predicted
               if isinstance(e.get("confidence"), (int, float))]
    conf_min = min(confs) if confs else 0.0
    conf_max = max(confs) if confs else 0.0

    return {
        "tp": tp, "fp": fp, "fn": fn,
        "precision": precision, "recall": recall, "f1": f1,
        "false_drug_count": false_drugs,
        "reason_recall": reason_recall,
        "conf_spread": round(conf_max - conf_min, 2),
        "est_correction_s": (fp + fn) * EST_CORRECTION_SECS,
    }


# ── Esecuzione su un test case ────────────────────────────────────────────────

def run_one_tc(tc: dict, model: str, canonicals: set, alias_map: dict,
               ollama_host: str, timeout: int,
               verbose: bool) -> dict:
    """
    Esegue LLM su un TC e restituisce result dict con metriche.
    """
    raccordo = tc["raccordo"]
    gt       = tc["ground_truth"]

    prompt = build_prompt(raccordo)

    try:
        raw_text, latency = call_ollama(
            model, prompt, SYSTEM_PROMPT, ollama_host, timeout
        )
    except RuntimeError as e:
        return {
            "tc_id":    tc["id"],
            "model":    model,
            "error":    str(e),
            "events":   [],
            "metrics":  {"tp": 0, "fp": 0, "fn": len(gt), "precision": 0,
                         "recall": 0, "f1": 0, "false_drug_count": 0,
                         "reason_recall": 0, "conf_spread": 0,
                         "est_correction_s": len(gt) * EST_CORRECTION_SECS},
            "latency_s": 0,
        }

    events, parse_error = parse_llm_response(raw_text)
    if parse_error and verbose:
        print(f"    {YELLOW}[PARSE] {parse_error}{RESET}")

    validated = validate_all(events, canonicals, alias_map)
    valid_evs = [e for e in validated if e["_validation"]["valid"]]
    deduped, dup_removed = deduplicate(valid_evs)

    m = compute_metrics(deduped, gt, alias_map, canonicals)

    if verbose:
        print(f"\n    {DIM}Risposta grezza:{RESET}")
        for line in raw_text.strip().splitlines()[:20]:
            print(f"      {line}")
        print(f"\n    {DIM}Validi: {len(deduped)}  Scartati: {len(events)-len(valid_evs)}"
              f"  Dup: {dup_removed}{RESET}")

    return {
        "tc_id":      tc["id"],
        "model":      model,
        "events":     deduped,
        "raw":        raw_text,
        "parse_error": parse_error,
        "dup_removed": dup_removed,
        "metrics":    m,
        "latency_s":  round(latency, 1),
    }


# ── Tabella riepilogo ─────────────────────────────────────────────────────────

_HDR = (
    f"{'TC':<5}  {'GT':>3}  "
    f"{'TP':>3}{'FP':>3}{'FN':>3}  "
    f"{'Pre':>5}{'Rec':>5}{'F1':>5}  "
    f"{'FD':>3}  {'RR':>5}  {'Lat':>5}  "
    f"{'EstCorr':>8}"
)
_SEP = "─" * len(_HDR)


def _f1_color(f1: float) -> str:
    if f1 >= 0.7: return GREEN
    if f1 >= 0.4: return YELLOW
    return RED


def print_row(tc_id: str, gt: list, result: dict):
    m  = result["metrics"]
    lat = result.get("latency_s", 0)
    ec  = m["est_correction_s"]
    f1c = _f1_color(m["f1"])
    print(
        f"{tc_id:<5}  {len(gt):>3}  "
        f"{m['tp']:>3}{m['fp']:>3}{m['fn']:>3}  "
        f"{m['precision']:>5.2f}{m['recall']:>5.2f}"
        f"{f1c}{m['f1']:>5.2f}{RESET}  "
        f"{m['false_drug_count']:>3}  "
        f"{m['reason_recall']:>5.2f}  "
        f"{lat:>5.1f}s  "
        f"{ec // 60:>5.0f}min"
    )


def print_summary(label: str, results: list[dict], test_cases: list[dict]):
    avg = lambda key: sum(r["metrics"][key] for r in results) / len(results)
    tot_ec  = sum(r["metrics"]["est_correction_s"] for r in results)
    tot_fd  = sum(r["metrics"]["false_drug_count"] for r in results)
    avg_lat = sum(r.get("latency_s", 0) for r in results) / len(results)
    f1c = _f1_color(avg("f1"))
    print(f"\n  {BOLD}{label} — media su {len(results)} TC:{RESET}")
    print(f"  F1={f1c}{avg('f1'):.3f}{RESET}  Pre={avg('precision'):.3f}"
          f"  Rec={avg('recall'):.3f}  FalseFarm={tot_fd}"
          f"  EstCorr={tot_ec // 60:.0f}min  Latenza_media={avg_lat:.1f}s")


# ── Delta LLM vs parser baseline ─────────────────────────────────────────────

def print_delta_table(model_results: list[dict], test_cases: list[dict]):
    tc_map = {tc["id"]: tc for tc in test_cases}
    print(f"\n{BOLD}{'═' * 72}{RESET}")
    print(f"{BOLD}  Delta LLM vs Parser baseline{RESET}")
    print(f"{'═' * 72}")
    print(f"{'TC':<5}  {'Parser F1':>9}  {'LLM F1':>7}  {'Delta':>6}  {'Verdetto'}")
    print(f"{'─' * 72}")

    for r in model_results:
        tc_id   = r["tc_id"]
        llm_f1  = r["metrics"]["f1"]
        baseline = load_parser_baseline(tc_id)
        if baseline:
            p_f1  = baseline["metrics"]["f1"]
            delta = llm_f1 - p_f1
            if delta >= 0.1:
                verdict = f"{GREEN}LLM migliore{RESET}"
            elif delta <= -0.1:
                verdict = f"{RED}Parser migliore{RESET}"
            else:
                verdict = f"{YELLOW}Pari{RESET}"
            print(f"{tc_id:<5}  {p_f1:>9.3f}  {llm_f1:>7.3f}  "
                  f"{delta:>+6.3f}  {verdict}")
        else:
            print(f"{tc_id:<5}  {'n/a':>9}  {llm_f1:>7.3f}  {'n/a':>6}  "
                  f"{DIM}baseline non disponibile{RESET}")
    print(f"{'─' * 72}")


def save_results_csv(results_by_model: dict[str, list[dict]],
                     test_cases: list[dict], out_path: str):
    rows   = []
    tc_map = {tc["id"]: tc for tc in test_cases}
    for model, results in results_by_model.items():
        for r in results:
            baseline = load_parser_baseline(r["tc_id"])
            p_f1  = baseline["metrics"]["f1"] if baseline else None
            m     = r["metrics"]
            rows.append({
                "tc_id":           r["tc_id"],
                "model":           model,
                "gt_events":       len(tc_map.get(r["tc_id"], {}).get("ground_truth", [])),
                "tp":              m["tp"], "fp": m["fp"], "fn": m["fn"],
                "precision":       round(m["precision"], 3),
                "recall":          round(m["recall"], 3),
                "f1":              round(m["f1"], 3),
                "parser_f1":       round(p_f1, 3) if p_f1 is not None else "",
                "delta_f1":        round(m["f1"] - p_f1, 3) if p_f1 is not None else "",
                "false_drug":      m["false_drug_count"],
                "reason_recall":   round(m["reason_recall"], 3),
                "latency_s":       r.get("latency_s", 0),
                "est_correction_s": m["est_correction_s"],
            })

    fieldnames = [
        "tc_id", "model", "gt_events", "tp", "fp", "fn",
        "precision", "recall", "f1", "parser_f1", "delta_f1",
        "false_drug", "reason_recall", "latency_s", "est_correction_s",
    ]
    with open(out_path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)
    print(f"\n  {CYAN}Risultati CSV: {out_path}{RESET}")


# ── Modalità audit (singolo referto reale) ────────────────────────────────────

_ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")


class _Tee:
    """Scrive su stdout e cattura in un buffer, per salvare l'output su file."""
    def __init__(self):
        self._buf: list[str] = []

    def write(self, s: str):
        sys.stdout.write(s)
        self._buf.append(s)

    def flush(self):
        sys.stdout.flush()

    def text(self) -> str:
        raw = "".join(self._buf)
        return _ANSI_RE.sub("", raw)


def _scan_drugs_in_text(text: str, alias_map: dict, canonicals: set) -> list[str]:
    """Restituisce i canonici trovati nel testo, ordinati per occorrenza."""
    text_lower = text.lower()
    found = []
    for canonical in sorted(canonicals):
        aliases = alias_map.get(canonical, [canonical.lower()])
        for alias in aliases:
            if re.search(r"\b" + re.escape(alias) + r"\b", text_lower):
                found.append(canonical)
                break
    return found


def run_audit(text: str, filename: str, args, canonicals: set, alias_map: dict,
              out_dir: str = ""):
    """
    Analisi di un singolo referto reale.
    Mostra farmaci rilevati, eventi estratti, motivazioni, segnalazioni e JSON finale.
    Nessun confronto con ground truth. Salva sempre results/audit_<nome>_<ts>.{txt,json}.
    """
    tee = _Tee()
    _orig_stdout = sys.stdout
    sys.stdout = tee  # type: ignore[assignment]

    lines = text.splitlines()
    W = 68

    print(f"\n{BOLD}{'═' * W}{RESET}")
    print(f"{BOLD}  AUDIT: {filename}  ({len(text)} car, {len(lines)} righe){RESET}")
    print(f"{BOLD}{'═' * W}{RESET}")

    # ── 1. Scansione farmaci nel testo ───────────────────────────────────────
    drugs_in_text = _scan_drugs_in_text(text, alias_map, canonicals) if canonicals else []

    print(f"\n{CYAN}─── FARMACI RILEVATI NEL TESTO {'─' * (W - 31)}{RESET}")
    if drugs_in_text:
        per_row = 4
        for i in range(0, len(drugs_in_text), per_row):
            row = drugs_in_text[i:i + per_row]
            print("  " + "   ".join(f"{d:<22}" for d in row))
        print(f"  {DIM}Totale: {len(drugs_in_text)}{RESET}")
    elif not canonicals:
        print(f"  {DIM}Drug data non disponibile.{RESET}")
    else:
        print(f"  {DIM}Nessun farmaco riconosciuto nel testo.{RESET}")

    events: list[dict] = []
    latency = 0.0

    # ── 2. Estrazione eventi ─────────────────────────────────────────────────
    if args.no_llm:
        print(f"\n{CYAN}─── EVENTI ESTRATTI {'─' * (W - 20)}{RESET}")
        print(f"  {DIM}Modalità --no-llm: estrazione LLM disabilitata.{RESET}")
        print(f"  {DIM}Lancia senza --no-llm per estrarre eventi con il modello LLM.{RESET}")
    else:
        model = args.model
        print(f"\n{CYAN}─── EVENTI ESTRATTI  (LLM: {model}) {'─' * max(1, W - 35 - len(model))}{RESET}")
        print(f"  Chiamata in corso... ", end="", flush=True)
        raw_text = ""
        try:
            raw_text, latency = call_ollama(
                model, build_prompt(text), SYSTEM_PROMPT,
                args.host, args.timeout,
            )
            print(f"{GREEN}OK{RESET}  ({latency:.1f}s)")
        except RuntimeError as e:
            print(f"{RED}ERRORE{RESET}: {e}")

        if raw_text:
            evs, parse_err = parse_llm_response(raw_text)
            if parse_err:
                print(f"  {YELLOW}[WARN] parse LLM: {parse_err}{RESET}")
            evs = validate_all(evs, canonicals, alias_map)
            valid_evs = [e for e in evs if e.get("_validation", {}).get("valid", True)]
            events, _ = deduplicate(valid_evs)

        if events:
            col = max((len(e.get("drug_canonical") or "") for e in events), default=8)
            col = max(col, 10)
            hdr = f"  {'#':>3}  {'FARMACO':<{col}}  {'TIPO':<16}  {'ANNO':>4}  {'CONF':>4}  MOTIVAZIONE"
            print(hdr)
            print("  " + "─" * (len(hdr) - 2))
            for i, ev in enumerate(events, 1):
                drug  = (ev.get("drug_canonical") or "—")
                tipo  = (ev.get("event_type") or "—")[:16]
                anno  = str(ev.get("date_year") or "—")
                conf  = ev.get("confidence")
                conf_s = f"{conf:.2f}" if isinstance(conf, (int, float)) else "—"
                motiv  = ((ev.get("reason") or "")[:55] + "…"
                          if len(ev.get("reason") or "") > 55
                          else (ev.get("reason") or ""))
                val    = ev.get("_validation", {})
                flags  = ""
                if val.get("warnings"):
                    flags += f" {YELLOW}[W]{RESET}"
                if val.get("errors"):
                    flags += f" {RED}[ERR]{RESET}"
                print(f"  {i:>3}  {drug:<{col}}  {tipo:<16}  "
                      f"{anno:>4}  {conf_s:>4}  {motiv}{flags}")
        else:
            if raw_text:
                print(f"  {DIM}Nessun evento valido estratto.{RESET}")

    # ── 3. Motivazioni / diagnosi citate ─────────────────────────────────────
    reasons = [
        (e.get("drug_canonical") or "?", e.get("reason") or "")
        for e in events if _reason_present(e.get("reason"))
    ]
    if reasons:
        print(f"\n{CYAN}─── MOTIVAZIONI / DIAGNOSI CITATE {'─' * (W - 35)}{RESET}")
        for drug, reason in reasons:
            print(f"  [{drug}]  {reason}")

    # ── 4. Segnalazioni ──────────────────────────────────────────────────────
    extracted_drugs = {(e.get("drug_canonical") or "").lower() for e in events}
    not_extracted   = [d for d in drugs_in_text if d.lower() not in extracted_drugs]
    unknown_drugs   = [
        e.get("drug_canonical") for e in events
        if e.get("drug_canonical") and canonicals
        and e["drug_canonical"] not in canonicals
    ]
    low_conf = [
        e.get("drug_canonical", "?") for e in events
        if isinstance(e.get("confidence"), (int, float))
        and e["confidence"] < CONFIDENCE_THRESHOLD
    ]

    print(f"\n{CYAN}─── SEGNALAZIONI {'─' * (W - 18)}{RESET}")
    any_flag = False
    if not_extracted and events:
        print(f"  {YELLOW}Farmaci nel testo non estratti come eventi:{RESET} "
              + ", ".join(not_extracted))
        any_flag = True
    if unknown_drugs:
        print(f"  {RED}Farmaci estratti non in mappa canonical:{RESET} "
              + ", ".join(str(d) for d in unknown_drugs))
        any_flag = True
    if low_conf:
        print(f"  {YELLOW}Confidenza bassa (<{CONFIDENCE_THRESHOLD}):{RESET} "
              + ", ".join(low_conf))
        any_flag = True
    if not any_flag:
        print(f"  {GREEN}Nessuna segnalazione.{RESET}")

    # ── 5. JSON finale ───────────────────────────────────────────────────────
    clean = [{k: v for k, v in e.items() if k != "_validation"} for e in events]
    print(f"\n{CYAN}─── JSON FINALE {'─' * (W - 16)}{RESET}")
    print(json.dumps(clean, ensure_ascii=False, indent=2))

    print(f"\n{BOLD}{'═' * W}{RESET}")
    if latency > 0:
        print(f"  Tempo LLM: {latency:.1f}s")
    print()

    sys.stdout = _orig_stdout

    # ── Salvataggio output ───────────────────────────────────────────────────
    ts       = datetime.now().strftime("%Y%m%d_%H%M%S")
    stem     = re.sub(r"[^\w\-]", "_", os.path.splitext(filename)[0])[:40]
    base     = f"audit_{stem}_{ts}"
    save_dir = out_dir or os.path.join(SCRIPT_DIR, "results")
    os.makedirs(save_dir, exist_ok=True)

    txt_path  = os.path.join(save_dir, f"{base}.txt")
    json_path = os.path.join(save_dir, f"{base}.json")

    with open(txt_path, "w", encoding="utf-8") as fh:
        fh.write(tee.text())

    with open(json_path, "w", encoding="utf-8") as fh:
        json.dump(
            {
                "filename":  filename,
                "timestamp": ts,
                "model":     args.model if not args.no_llm else None,
                "drugs_in_text": drugs_in_text,
                "events":    clean,
            },
            fh, ensure_ascii=False, indent=2,
        )

    print(f"{GREEN}[SALVATO]{RESET}  {txt_path}")
    print(f"{GREEN}[SALVATO]{RESET}  {json_path}")
    print()


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(
        description="POC raccordo LLM — versione standalone Python puro (no Node.js)"
    )
    ap.add_argument("--model",   default="qwen2.5:3b",
                    help="Modello Ollama da usare (default: qwen2.5:3b)")
    ap.add_argument("--compare", nargs="+", metavar="MODEL",
                    help="Confronta più modelli (es. --compare qwen2.5:3b qwen2.5:7b)")
    ap.add_argument("--tc",      default="",
                    help="TC01,TC02 oppure 'real' (TC06-15) oppure 'synthetic' (TC01-05)")
    ap.add_argument("--no-llm",  action="store_true",
                    help="Mostra solo il baseline parser, senza LLM")
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--host",    default="http://localhost:11434",
                    help="Host Ollama (default: http://localhost:11434)")
    ap.add_argument("--timeout", type=int, default=120,
                    help="Timeout chiamata Ollama in secondi (default: 120)")
    ap.add_argument("--out",     default="",
                    help="Directory output (default: poc/results/TIMESTAMP)")
    ap.add_argument("--audit",   default="", metavar="FILE",
                    help="Analisi singolo referto reale: mostra entità estratte senza benchmark")
    args = ap.parse_args()

    print(f"\n{BOLD}╔══════════════════════════════════════════════════════════════╗{RESET}")
    print(f"{BOLD}║  RheumaFlow — POC raccordo LLM  (standalone Python puro)    ║{RESET}")
    print(f"{BOLD}╚══════════════════════════════════════════════════════════════╝{RESET}")

    # Drugs
    print(f"\n  Caricamento drug data... ", end="", flush=True)
    canonicals, alias_map = load_drug_data()
    if canonicals:
        print(f"{GREEN}{len(canonicals)} farmaci canonici{RESET}")
    else:
        print(f"{YELLOW}non disponibile — validazione farmaci disabilitata{RESET}")

    # ── Modalità audit: early return ─────────────────────────────────────────
    if args.audit:
        audit_path = args.audit
        if not os.path.isfile(audit_path):
            print(f"\n{RED}[ERRORE] File non trovato: {audit_path}{RESET}")
            sys.exit(1)
        try:
            text = open(audit_path, encoding="utf-8").read()
        except UnicodeDecodeError:
            text = open(audit_path, encoding="cp1252", errors="replace").read()

        if not args.no_llm:
            print(f"\n  Verifica Ollama su {args.host}... ", end="", flush=True)
            if not ollama_available(args.host):
                print(f"{RED}non raggiungibile{RESET}")
                print(f"  Usa --no-llm per la sola scansione farmaci.")
                sys.exit(1)
            print(f"{GREEN}OK{RESET}")
            print(f"  Verifica modello {args.model}... ", end="", flush=True)
            if ollama_model_available(args.model, args.host):
                print(f"{GREEN}OK{RESET}")
            else:
                print(f"{YELLOW}non trovato — esegui: ollama pull {args.model}{RESET}")

        out_dir = args.out or os.path.join(SCRIPT_DIR, "results")
        run_audit(text, os.path.basename(audit_path), args, canonicals, alias_map,
                  out_dir=out_dir)
        sys.exit(0)

    # Test cases
    if args.tc.lower() == "real":
        selected_ids = [f"TC{i:02d}" for i in range(6, 16)]
    elif args.tc.lower() == "synthetic":
        selected_ids = [f"TC{i:02d}" for i in range(1, 6)]
    elif args.tc:
        selected_ids = [t.strip().upper() for t in args.tc.split(",")]
    else:
        selected_ids = None

    test_cases = load_test_cases(selected_ids)
    print(f"  Test case caricati: {len(test_cases)}")

    # Baseline disponibile?
    n_baseline = sum(1 for tc in test_cases
                     if load_parser_baseline(tc["id"]) is not None)
    print(f"  Parser baseline disponibile: {n_baseline}/{len(test_cases)} TC")

    # Modelli da confrontare
    if args.no_llm:
        models = []
    elif args.compare:
        models = args.compare
    else:
        models = [args.model]

    # Verifica Ollama se LLM richiesto
    if models:
        print(f"\n  Verifica Ollama su {args.host}... ", end="", flush=True)
        if not ollama_available(args.host):
            print(f"{RED}non raggiungibile{RESET}")
            print(f"\n  Avvia Ollama con:  ollama serve")
            print(f"  Poi riesegui questo script.")
            sys.exit(1)
        print(f"{GREEN}OK{RESET}")

        for model in models:
            print(f"  Verifica modello {model}... ", end="", flush=True)
            if not ollama_model_available(model, args.host):
                print(f"{YELLOW}non trovato — esegui: ollama pull {model}{RESET}")
            else:
                print(f"{GREEN}OK{RESET}")

    # Output dir
    out_dir = args.out or os.path.join(
        SCRIPT_DIR, "results", datetime.now().strftime("%Y%m%d_%H%M%S") + "_standalone"
    )
    os.makedirs(out_dir, exist_ok=True)

    # ── Modalità --no-llm: mostra solo baseline ──────────────────────────────
    if not models:
        print(f"\n{BOLD}{'═' * 72}{RESET}")
        print(f"{BOLD}  Parser baseline (pre-calcolato){RESET}")
        print(f"{'═' * 72}")
        print(_HDR.replace("Lat", " - ").replace("EstCorr", "EstCorr"))
        print(_SEP)
        for tc in test_cases:
            baseline = load_parser_baseline(tc["id"])
            if baseline:
                fake_result = {
                    "tc_id":     tc["id"],
                    "model":     "parser",
                    "metrics":   baseline["metrics"],
                    "latency_s": 0,
                }
                print_row(tc["id"], tc["ground_truth"], fake_result)
            else:
                print(f"{tc['id']:<5}  {DIM}baseline non disponibile{RESET}")
        print(_SEP)
        print(f"\n  Baseline: {BASELINE_DIR}")
        return

    # ── Esecuzione LLM ────────────────────────────────────────────────────────
    results_by_model: dict[str, list[dict]] = {}

    for model in models:
        print(f"\n{BOLD}{'═' * 72}{RESET}")
        print(f"{BOLD}  Modello: {model}{RESET}")
        print(f"{'═' * 72}")
        print(_HDR)
        print(_SEP)

        model_results = []
        for tc in test_cases:
            print(f"{tc['id']:<5}  {DIM}{tc.get('description','')[:40]:<40}{RESET}  ",
                  end="", flush=True)

            result = run_one_tc(
                tc, model, canonicals, alias_map,
                args.host, args.timeout, args.verbose
            )
            model_results.append(result)
            print_row(tc["id"], tc["ground_truth"], result)

            if args.verbose and result.get("events"):
                for ev in result["events"]:
                    print(f"      {DIM}{ev.get('drug_canonical')} "
                          f"| {ev.get('event_type')} "
                          f"| {ev.get('date_year')} "
                          f"| conf={ev.get('confidence')}{RESET}")

        print(_SEP)
        print_summary(model, model_results, test_cases)
        results_by_model[model] = model_results

    # ── Delta table ───────────────────────────────────────────────────────────
    if n_baseline > 0:
        for model, results in results_by_model.items():
            print_delta_table(results, test_cases)

    # ── Confronto tra modelli ─────────────────────────────────────────────────
    if len(models) > 1:
        print(f"\n{BOLD}{'═' * 72}{RESET}")
        print(f"{BOLD}  Confronto modelli{RESET}")
        print(f"{'═' * 72}")
        print(f"{'Modello':<25}  {'F1':>5}  {'Pre':>5}  {'Rec':>5}  "
              f"{'FD':>3}  {'Lat':>6}  EstCorr")
        print(f"{'─' * 72}")
        for model, results in results_by_model.items():
            avg = lambda k: sum(r["metrics"][k] for r in results) / len(results)
            tot_ec  = sum(r["metrics"]["est_correction_s"] for r in results)
            avg_lat = sum(r.get("latency_s", 0) for r in results) / len(results)
            f1c = _f1_color(avg("f1"))
            print(f"{model:<25}  "
                  f"{f1c}{avg('f1'):>5.3f}{RESET}  "
                  f"{avg('precision'):>5.3f}  {avg('recall'):>5.3f}  "
                  f"{sum(r['metrics']['false_drug_count'] for r in results):>3}  "
                  f"{avg_lat:>5.1f}s  {tot_ec // 60:.0f}min")
        print(f"{'─' * 72}")

    # ── Salva CSV ─────────────────────────────────────────────────────────────
    csv_path = os.path.join(out_dir, "results.csv")
    save_results_csv(results_by_model, test_cases, csv_path)
    print(f"  Output: {out_dir}")


if __name__ == "__main__":
    main()
