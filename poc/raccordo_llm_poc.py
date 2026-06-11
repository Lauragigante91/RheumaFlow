#!/usr/bin/env python3
"""
raccordo_llm_poc.py  v2

POC: LLM locale (Ollama) vs parser regex — estrazione eventi terapeutici
da RACCORDO ANAMNESTICO.

Uso:
    python3 poc/raccordo_llm_poc.py [--model qwen2.5:7b] [--tc TC01] [--verbose]
    python3 poc/raccordo_llm_poc.py --compare 3b 7b         # confronto side-by-side
    python3 poc/raccordo_llm_poc.py --no-llm                # solo parser regex baseline

Non modifica il database. Non tocca il flusso clinico principale.
"""

import argparse, csv, json, os, re, subprocess, sys, time
import urllib.request, urllib.error
from collections import defaultdict
from datetime import datetime

OLLAMA_HOST            = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
DRUG_CANONICALS_PATH   = "/tmp/drug_canonicals.json"
DRUG_ALIAS_INDEX_PATH  = "/tmp/drug_alias_index.json"
RACCORDO_BUNDLE_PATH   = "/tmp/raccordo_bundle.cjs"
TEST_TEXTS_PATH        = os.path.join(os.path.dirname(__file__), "test_texts.json")

ALLOWED_EVENT_TYPES = {
    "therapy_start", "therapy_stop", "dose_change",
    "therapy_switch", "dose_spacing", "unknown",
}

# Normalizzazione confidence stringa (dal parser regex) → float
_CONF_STR_MAP = {"high": 0.9, "medium": 0.7, "low": 0.5}

CONFIDENCE_REVIEW_THRESHOLD = 0.7
EST_CORRECTION_SECS_PER_EVENT = 45

GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
BLUE   = "\033[94m"
BOLD   = "\033[1m"
RESET  = "\033[0m"
CYAN   = "\033[96m"
DIM    = "\033[2m"


# ── Drug data ─────────────────────────────────────────────────────────────────

def load_drug_canonicals() -> set:
    with open(DRUG_CANONICALS_PATH) as f:
        return set(json.load(f))

def load_drug_alias_index() -> dict:
    with open(DRUG_ALIAS_INDEX_PATH) as f:
        return json.load(f)

def drug_present_in_fragment(canonical: str, fragment: str, alias_index: dict) -> bool:
    """
    Verifica che almeno un alias del farmaco canonico sia presente
    nel source_fragment come token di parola (\\b).
    Restituisce True se il farmaco è verificabile nel testo sorgente.
    """
    aliases = alias_index.get(canonical, [])
    if not aliases:
        return False
    frag_lower = fragment.lower()
    for alias in aliases:
        if len(alias) < 3:
            continue
        escaped = re.escape(alias.lower())
        if re.search(r'\b' + escaped, frag_lower):
            return True
    return False


# ── raccordoParser (Node.js) runner ──────────────────────────────────────────

def run_regex_parser(text: str) -> list:
    runner = os.path.join(os.path.dirname(__file__), "raccordo_parser_runner.js")
    try:
        r = subprocess.run(["node", runner], input=text,
                           capture_output=True, text=True, timeout=10)
        if r.returncode != 0:
            print(f"[PARSER ERROR] {r.stderr.strip()}", file=sys.stderr)
            return []
        return json.loads(r.stdout)
    except (subprocess.TimeoutExpired, json.JSONDecodeError) as e:
        print(f"[PARSER ERROR] {e}", file=sys.stderr)
        return []


# ── Ollama API ────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """Sei un estrattore di dati clinici specializzato in reumatologia italiana.
Il tuo compito è analizzare un raccordo anamnestico e restituire SOLO gli eventi terapeutici in formato JSON.

Regole obbligatorie:
1. Restituisci SOLO un array JSON valido. Nessun testo aggiuntivo.
2. Ogni elemento deve avere esattamente questi campi:
   - drug_canonical: nome ESATTO dalla lista farmaci fornita (stringa, o null se non applicabile)
   - event_type: uno tra "therapy_start" | "therapy_stop" | "dose_change" | "therapy_switch" | "dose_spacing" | "unknown"
   - date_text: testo della data come appare nel testo (stringa, o null)
   - date_year: anno numerico intero (o null)
   - reason: motivo dell'evento in italiano (stringa breve max 60 char, o null)
   - source_fragment: frase sorgente da cui hai estratto l'evento (obbligatorio, max 200 char)
   - confidence: numero 0.0-1.0 (usa valori graduati: 0.9=sicuro, 0.7=probabile, 0.5=dubbio)
3. Includi SOLO farmaci della lista fornita, con il nome ESATTO della lista.
4. Per "mai sospeso" / "non sospeso" NON generare therapy_stop.
5. Se la data è assente o ambigua, abbassa confidence a 0.6 o meno.
6. Non duplicare eventi: una singola frase genera al massimo un evento per farmaco."""

USER_TEMPLATE = """Analizza questo raccordo anamnestico ed estrai gli eventi terapeutici:

---
{text}
---

Lista farmaci canonici (usa ESATTAMENTE questi nomi, nessun altro):
{drug_list}

Rispondi con SOLO l'array JSON degli eventi."""


def call_ollama(text: str, model: str, drug_canonicals: set) -> tuple:
    user_msg = USER_TEMPLATE.format(
        text=text.strip(),
        drug_list=", ".join(sorted(drug_canonicals))
    )
    payload = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_msg},
        ],
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.0, "num_predict": 2048},
    }).encode()

    req = urllib.request.Request(
        f"{OLLAMA_HOST}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            raw = resp.read().decode()
    except urllib.error.URLError as e:
        return [], 0.0, f"OLLAMA_ERROR: {e}"

    elapsed = time.time() - t0
    body = json.loads(raw)
    content = body.get("message", {}).get("content", "")

    try:
        parsed = json.loads(content)
        if isinstance(parsed, dict):
            parsed = next(iter(parsed.values()), []) if parsed else []
        if not isinstance(parsed, list):
            return [], elapsed, f"LLM_FORMAT_ERROR: not a list"
        return parsed, elapsed, ""
    except json.JSONDecodeError as e:
        return [], elapsed, f"LLM_JSON_ERROR: {e} — {content[:200]}"


# ── Validatore deterministico v2 ─────────────────────────────────────────────

def validate_event(ev: dict, drug_canonicals: set, alias_index: dict) -> dict:
    errors   = []
    warnings = []

    # 1. source_fragment obbligatorio
    frag = ev.get("source_fragment", "")
    if not isinstance(frag, str) or not frag.strip():
        errors.append("source_fragment_mancante")

    # 2. event_type ammesso
    et = ev.get("event_type")
    if et not in ALLOWED_EVENT_TYPES:
        errors.append(f"event_type_non_ammesso:{et}")

    # 3. drug_canonical — normalizzazione case-insensitive
    dc = ev.get("drug_canonical")
    if dc is not None:
        if not isinstance(dc, str):
            errors.append("drug_canonical_tipo_errato")
        else:
            dc_lower = dc.lower()
            matched = next((c for c in drug_canonicals if c.lower() == dc_lower), None)
            if matched:
                ev["drug_canonical"] = matched
                dc = matched
            else:
                errors.append(f"drug_non_in_mappa:{dc}")

    # 4. drug presente nel source_fragment
    if dc and isinstance(dc, str) and dc in drug_canonicals and frag:
        if not drug_present_in_fragment(dc, frag, alias_index):
            warnings.append(f"drug_non_in_fragment:{dc}")

    # 5. confidence range e threshold (normalizza stringa → float se necessario)
    conf = ev.get("confidence")
    if isinstance(conf, str):
        conf = _CONF_STR_MAP.get(conf.lower())
        if conf is not None:
            ev["confidence"] = conf
    if not isinstance(conf, (int, float)) or not (0.0 <= conf <= 1.0):
        errors.append("confidence_fuori_range")
    elif conf < CONFIDENCE_REVIEW_THRESHOLD:
        warnings.append(f"confidence_bassa:{conf:.2f}")

    # 6. date_year plausibilità
    dy = ev.get("date_year")
    if dy is not None:
        if not isinstance(dy, int) or not (1950 <= dy <= 2030):
            errors.append(f"date_year_non_plausibile:{dy}")

    review_only = (len(errors) == 0) and (
        conf < CONFIDENCE_REVIEW_THRESHOLD if isinstance(conf, float) else False
    )

    return {
        "valid":       len(errors) == 0,
        "errors":      errors,
        "warnings":    warnings,
        "review_only": review_only,
    }


def validate_all(events: list, drug_canonicals: set, alias_index: dict) -> list:
    return [{**ev, "_validation": validate_event(ev, drug_canonicals, alias_index)}
            for ev in events]


# ── Deduplicazione ───────────────────────────────────────────────────────────

def _dedup_key(ev: dict) -> tuple:
    dc  = (ev.get("drug_canonical") or "").lower()
    et  = ev.get("event_type") or ""
    yr  = ev.get("date_year") or 0
    frag_head = (ev.get("source_fragment") or "")[:60].lower()
    return (dc, et, yr, frag_head)

def deduplicate_events(events: list) -> tuple:
    """
    Rimuove duplicati: stesso drug + event_type + (anno o frase sorgente simile).
    Mantiene l'evento con confidence più alta.
    Restituisce (events_deduplicati, n_removed).
    """
    seen: dict[tuple, dict] = {}
    for ev in events:
        key = _dedup_key(ev)
        existing = seen.get(key)
        conf_new = ev.get("confidence", 0) if isinstance(ev.get("confidence"), (int, float)) else 0
        conf_old = existing.get("confidence", 0) if existing and isinstance(existing.get("confidence"), (int, float)) else 0
        if existing is None or conf_new > conf_old:
            seen[key] = ev
    deduped = list(seen.values())
    return deduped, len(events) - len(deduped)


# ── Metriche ─────────────────────────────────────────────────────────────────

def _ev_key(e: dict) -> tuple:
    return (
        (e.get("drug_canonical") or "").lower(),
        e.get("event_type") or "",
    )

def compute_metrics(predicted: list, ground_truth: list,
                    alias_index: dict, drug_canonicals: set) -> dict:
    pred_keys = [_ev_key(e) for e in predicted]
    gt_keys   = [_ev_key(e) for e in ground_truth]

    tp = sum(1 for k in pred_keys if k in gt_keys)
    fp = sum(1 for k in pred_keys if k not in gt_keys)
    fn = sum(1 for k in gt_keys   if k not in pred_keys)

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall    = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1        = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

    # Falsi farmaci: drug_canonical non in fragment
    false_drug = sum(
        1 for e in predicted
        if e.get("drug_canonical") and e.get("source_fragment")
        and not drug_present_in_fragment(e["drug_canonical"], e.get("source_fragment",""), alias_index)
        and e["drug_canonical"] in drug_canonicals
    )

    # Reason recall: GT events con reason che sono stati trovati (con qualsiasi reason)
    gt_with_reason = [e for e in ground_truth if e.get("reason")]
    reason_tp = sum(1 for e in gt_with_reason if _ev_key(e) in pred_keys)
    reason_recall = reason_tp / len(gt_with_reason) if gt_with_reason else 1.0

    # Tempo di correzione stimato: FP richiede rimozione, FN richiede aggiunta
    est_correction_s = (fp + fn) * EST_CORRECTION_SECS_PER_EVENT

    return {
        "tp": tp, "fp": fp, "fn": fn,
        "precision": precision, "recall": recall, "f1": f1,
        "false_drug_count": false_drug,
        "reason_recall": reason_recall,
        "est_correction_s": est_correction_s,
    }

def compute_confidence_calibration(predicted: list, ground_truth: list) -> dict:
    """
    Calibrazione: per ogni evento predetto, misura se confidence è coerente
    con l'essere un vero positivo o un falso positivo.
    """
    gt_keys = {_ev_key(e) for e in ground_truth}
    buckets = defaultdict(lambda: {"correct": 0, "total": 0})
    for ev in predicted:
        conf = ev.get("confidence")
        if not isinstance(conf, (int, float)):
            continue
        bucket = f"{int(conf * 10) / 10:.1f}"
        buckets[bucket]["total"] += 1
        if _ev_key(ev) in gt_keys:
            buckets[bucket]["correct"] += 1

    all_confs = [ev.get("confidence") for ev in predicted
                 if isinstance(ev.get("confidence"), (int, float))]
    spread = max(all_confs) - min(all_confs) if len(all_confs) >= 2 else 0.0
    unique = len(set(round(c, 1) for c in all_confs))

    return {
        "buckets":      dict(buckets),
        "conf_spread":  spread,
        "unique_values": unique,
        "overconfident": spread < 0.2 and len(predicted) >= 3,
    }


# ── Display ───────────────────────────────────────────────────────────────────

def fmt_conf(conf) -> str:
    if not isinstance(conf, (int, float)):
        return f"{RED}N/A{RESET}"
    if conf >= 0.8:  return f"{GREEN}{conf:.2f}{RESET}"
    if conf >= 0.7:  return f"{YELLOW}{conf:.2f}{RESET}"
    return f"{RED}{conf:.2f}{RESET}"

def fmt_metric(val: float, ref: float = None) -> str:
    s = f"{val:.2f}"
    if ref is None:
        return s
    if val > ref:  return f"{GREEN}{s}{RESET}"
    if val < ref:  return f"{RED}{s}{RESET}"
    return f"{YELLOW}{s}{RESET}"

def print_events_table(events: list, label: str, show_validation: bool = False,
                       alias_index: dict = None, drug_canonicals: set = None):
    print(f"\n{BOLD}{CYAN}{'─' * 90}{RESET}")
    print(f"{BOLD}{label}{RESET}")
    print("─" * 90)
    if not events:
        print(f"  {YELLOW}(nessun evento){RESET}")
        return
    print(f"  {'DRUG':<28} {'TYPE':<18} {'YEAR':<6} {'CONF':<7} {'REASON':<30} {'NOTE'}")
    print(f"  {'─'*28} {'─'*18} {'─'*6} {'─'*7} {'─'*30} {'─'*12}")
    for ev in events:
        drug   = str(ev.get("drug_canonical") or "—")[:27]
        etype  = str(ev.get("event_type") or "?")[:17]
        year   = str(ev.get("date_year") or "—")[:5]
        conf   = ev.get("confidence")
        reason = str(ev.get("reason") or "—")[:29]

        note_parts = []
        if show_validation and isinstance(ev.get("_validation"), dict):
            vr = ev["_validation"]
            if vr["errors"]:
                note_parts.append(f"{RED}ERR:{','.join(vr['errors'])[:30]}{RESET}")
            elif vr["review_only"]:
                note_parts.append(f"{YELLOW}review{RESET}")
            else:
                # check drug in fragment warning
                drug_warn = [w for w in vr.get("warnings",[]) if w.startswith("drug_non_in_fragment")]
                if drug_warn:
                    note_parts.append(f"{YELLOW}!fragment{RESET}")
                else:
                    note_parts.append(f"{GREEN}OK{RESET}")

        note = " ".join(note_parts) if note_parts else ""
        print(f"  {drug:<28} {etype:<18} {year:<6} {fmt_conf(conf):<7} {reason:<30} {note}")


def print_metrics_row(label: str, m: dict, ref: dict = None, elapsed: float = 0.0,
                      dup_removed: int = 0):
    f1  = m["f1"]
    pre = m["precision"]
    rec = m["recall"]
    fd  = m["false_drug_count"]
    rr  = m["reason_recall"]
    ec  = m["est_correction_s"]
    tp  = m["tp"]; fp = m["fp"]; fn = m["fn"]

    f1_s  = fmt_metric(f1,  ref["f1"]  if ref else None)
    pre_s = fmt_metric(pre, ref["precision"] if ref else None)
    rec_s = fmt_metric(rec, ref["recall"] if ref else None)
    rr_s  = fmt_metric(rr,  ref["reason_recall"] if ref else None)

    fd_s  = f"{RED}{fd}{RESET}" if fd > 0 else f"{GREEN}{fd}{RESET}"
    dup_s = f"{YELLOW}{dup_removed}{RESET}" if dup_removed > 0 else f"{GREEN}{dup_removed}{RESET}"
    ec_s  = f"{ec//60:.0f}m{ec%60:.0f}s"
    t_s   = f"{elapsed:.0f}s" if elapsed > 0 else "—"

    print(f"  {label:<20} F1={f1_s}  Pre={pre_s}  Rec={rec_s}  "
          f"TP/FP/FN={tp}/{fp}/{fn}  "
          f"FalseFarm={fd_s}  Dup={dup_s}  RR={rr_s}  "
          f"EstCorr={ec_s}  t={t_s}")


def print_diff(llm_events: list, regex_events: list, ground_truth: list):
    llm_keys   = {_ev_key(e) for e in llm_events}
    regex_keys = {_ev_key(e) for e in regex_events}
    gt_keys    = {_ev_key(e) for e in ground_truth}

    only_llm   = llm_keys - regex_keys
    only_regex = regex_keys - llm_keys

    if not only_llm and not only_regex:
        print(f"\n  {GREEN}Nessuna differenza tra LLM e parser.{RESET}")
        return

    if only_llm:
        print(f"\n  {GREEN}Solo in LLM (non trovati dal parser):{RESET}")
        for k in sorted(only_llm):
            mark = f"{GREEN}[GT]{RESET}" if k in gt_keys else f"{YELLOW}[FP]{RESET}"
            print(f"    {k[0]:<28} {k[1]:<22} {mark}")
    if only_regex:
        print(f"\n  {YELLOW}Solo nel parser (non trovati da LLM):{RESET}")
        for k in sorted(only_regex):
            mark = f"{GREEN}[GT]{RESET}" if k in gt_keys else f"{YELLOW}[FP]{RESET}"
            print(f"    {k[0]:<28} {k[1]:<22} {mark}")


# ── Sessione singola per un modello ──────────────────────────────────────────

def run_model_on_tc(tc: dict, model: str, drug_canonicals: set,
                    alias_index: dict, verbose: bool) -> dict:
    text = tc["raccordo"]
    gt   = tc["ground_truth"]
    result = {"model": model, "llm_ok": False, "elapsed": 0.0,
              "metrics": None, "events": [], "dup_removed": 0,
              "calibration": None}

    print(f"\n  {BOLD}Invio a {model}…{RESET}", end=" ", flush=True)
    llm_raw, elapsed, err = call_ollama(text, model, drug_canonicals)
    result["elapsed"] = elapsed

    if err:
        print(f"{RED}ERRORE{RESET}\n  {err}")
        return result

    print(f"{GREEN}OK{RESET} ({elapsed:.0f}s, {len(llm_raw)} eventi grezzi)")

    validated = validate_all(llm_raw, drug_canonicals, alias_index)
    valid_events = [v for v in validated if v["_validation"]["valid"]]
    deduped, dup_removed = deduplicate_events(valid_events)
    result["dup_removed"] = dup_removed

    print_events_table(deduped, f"Output {model} (post-validazione + dedup)",
                       show_validation=True, alias_index=alias_index,
                       drug_canonicals=drug_canonicals)

    if verbose:
        err_events = [v for v in validated if not v["_validation"]["valid"]]
        if err_events:
            print(f"\n  {RED}Scartati dalla validazione ({len(err_events)}):{RESET}")
            for ev in err_events:
                errs = ev["_validation"]["errors"]
                dc   = ev.get("drug_canonical","?")
                et   = ev.get("event_type","?")
                print(f"    {dc:<28} {et:<20} ERR: {'; '.join(errs)}")

        print(f"\n  {BOLD}Source fragments:{RESET}")
        for i, ev in enumerate(deduped):
            frag = (ev.get("source_fragment") or "—")[:120]
            dc   = ev.get("drug_canonical","—")
            in_frag = (drug_present_in_fragment(dc, frag, alias_index)
                       if dc and dc in drug_canonicals else None)
            flag = f"{GREEN}✓{RESET}" if in_frag else (f"{YELLOW}?fragment{RESET}" if in_frag is False else "")
            print(f"    [{i+1}] {frag}  {flag}")

    m = compute_metrics(deduped, gt, alias_index, drug_canonicals)
    cal = compute_confidence_calibration(deduped, gt)
    result["llm_ok"]     = True
    result["metrics"]    = m
    result["events"]     = deduped
    result["calibration"] = cal

    return result


# ── Check Ollama ──────────────────────────────────────────────────────────────

def check_ollama(model: str) -> bool:
    try:
        with urllib.request.urlopen(f"{OLLAMA_HOST}/api/tags", timeout=5) as r:
            d     = json.loads(r.read())
            names = [m["name"] for m in d.get("models", [])]
            if not any(model in n for n in names):
                print(f"{RED}Modello '{model}' non trovato. Disponibili: {names or '(nessuno)'}{RESET}")
                print(f"Esegui: OLLAMA_MODELS=/tmp/ollama_models /tmp/ollama_bin/bin/ollama pull {model}")
                return False
            return True
    except Exception as e:
        print(f"{RED}Ollama non raggiungibile: {e}{RESET}")
        return False


# ── Session summary ───────────────────────────────────────────────────────────

def print_session_summary(all_tc_results: list, models_tested: list,
                          drug_canonicals: set, alias_index: dict):
    print(f"\n{'═' * 90}")
    print(f"{BOLD}  RIEPILOGO SESSIONE{RESET}")
    print(f"{'═' * 90}")

    for model_label in models_tested:
        res_for_model = [r[model_label] for r in all_tc_results if r.get(model_label)]
        ok  = [r for r in res_for_model if r.get("llm_ok")]
        if not ok:
            print(f"\n  {model_label}: nessun risultato")
            continue

        avg = lambda key: sum(r["metrics"][key] for r in ok) / len(ok)
        print(f"\n  {BOLD}{model_label}{RESET}")
        print(f"  F1={avg('f1'):.3f}  Pre={avg('precision'):.3f}  Rec={avg('recall'):.3f}  "
              f"FalseFarm={sum(r['metrics']['false_drug_count'] for r in ok)}  "
              f"Dup={sum(r['dup_removed'] for r in ok)}  "
              f"t_medio={sum(r['elapsed'] for r in ok)/len(ok):.0f}s  "
              f"EstCorr_tot={sum(r['metrics']['est_correction_s'] for r in ok)//60:.0f}min")

        overconf = sum(1 for r in ok if r.get("calibration",{}).get("overconfident"))
        if overconf:
            print(f"  {YELLOW}Calibrazione confidence: {overconf}/{len(ok)} TC con spread < 0.2 (overconfident){RESET}")

    print(f"\n  {'TC':<8}", end="")
    for label in models_tested:
        print(f"  {label[:12]:<12}", end="")
    print(f"  {'Parser':>8}  {'GT evt':>8}")

    regex_key = "regex"
    for r in all_tc_results:
        tc_id = r["tc_id"]
        print(f"  {tc_id:<8}", end="")
        for label in models_tested:
            entry = r.get(label)
            if entry and entry.get("llm_ok"):
                f1s = f"{entry['metrics']['f1']:.2f}"
                fd  = entry['metrics']['false_drug_count']
                fd_s = f"({RED}{fd}fd{RESET})" if fd > 0 else ""
                print(f"  {f1s:<6}{fd_s:<6}", end="")
            else:
                print(f"  {'FAIL':<12}", end="")
        rx = r.get(regex_key)
        if rx:
            print(f"  {rx['metrics']['f1']:>8.2f}  {len(r['ground_truth']):>8}", end="")
        print()

    print(f"\n{'═' * 90}\n")


# ── Export pacchetto offline ──────────────────────────────────────────────────

def export_offline_package(test_texts: list, drug_canonicals: set,
                           alias_index: dict, out_dir: str):
    """
    Genera il pacchetto di test per esecuzione su PC locale con Ollama.

    Struttura output:
      <out_dir>/tc_data/TCxx.json          raccordo + ground truth
      <out_dir>/parser_baseline/TCxx.json  output parser regex + metriche
      <out_dir>/parser_baseline.csv        tabella riepilogo
      <out_dir>/all_tc_data.json           tutti i TC in un file
      <out_dir>/EXPORT_INFO.txt            metadati
    """
    tc_dir     = os.path.join(out_dir, "tc_data")
    parser_dir = os.path.join(out_dir, "parser_baseline")
    os.makedirs(tc_dir,     exist_ok=True)
    os.makedirs(parser_dir, exist_ok=True)

    print(f"\n{BOLD}Generazione pacchetto offline → {out_dir}/{RESET}")

    summary_rows = []
    all_tc_data  = []

    for tc in test_texts:
        tc_id = tc["id"]
        print(f"  {tc_id}  {tc.get('description','')[:55]:<55}", end=" ", flush=True)

        # Salva dati TC
        tc_data = {
            "id":          tc["id"],
            "description": tc.get("description", ""),
            "raccordo":    tc["raccordo"],
            "ground_truth": tc["ground_truth"],
        }
        with open(os.path.join(tc_dir, f"{tc_id}.json"), "w", encoding="utf-8") as fh:
            json.dump(tc_data, fh, ensure_ascii=False, indent=2)

        # Esegui parser regex e calcola metriche
        regex_raw    = run_regex_parser(tc["raccordo"])
        regex_valid  = validate_all(regex_raw, drug_canonicals, alias_index)
        regex_valid  = [v for v in regex_valid if v["_validation"]["valid"]]
        regex_deduped, dup_removed = deduplicate_events(regex_valid)
        m = compute_metrics(regex_deduped, tc["ground_truth"], alias_index, drug_canonicals)

        # Salva baseline parser (rimuove chiave interna _validation)
        clean_events = [{k: v for k, v in e.items() if k != "_validation"}
                        for e in regex_deduped]
        parser_out = {
            "tc_id":       tc_id,
            "events":      clean_events,
            "metrics":     m,
            "dup_removed": dup_removed,
        }
        with open(os.path.join(parser_dir, f"{tc_id}.json"), "w", encoding="utf-8") as fh:
            json.dump(parser_out, fh, ensure_ascii=False, indent=2)

        # Riga CSV
        summary_rows.append({
            "tc_id":            tc_id,
            "description":      tc.get("description", ""),
            "gt_events":        len(tc["ground_truth"]),
            "parser_events":    len(regex_deduped),
            "tp":               m["tp"],
            "fp":               m["fp"],
            "fn":               m["fn"],
            "precision":        round(m["precision"],   3),
            "recall":           round(m["recall"],      3),
            "f1":               round(m["f1"],          3),
            "false_drug":       m["false_drug_count"],
            "reason_recall":    round(m["reason_recall"], 3),
            "est_correction_s": m["est_correction_s"],
        })
        all_tc_data.append({**tc_data, "parser_baseline": parser_out})

        f1c = GREEN if m["f1"] >= 0.7 else (YELLOW if m["f1"] >= 0.4 else RED)
        print(f"F1={f1c}{m['f1']:.2f}{RESET}  TP/FP/FN={m['tp']}/{m['fp']}/{m['fn']}"
              f"  dup={dup_removed}")

    # CSV riepilogo
    csv_path  = os.path.join(out_dir, "parser_baseline.csv")
    fieldnames = [
        "tc_id", "description", "gt_events", "parser_events",
        "tp", "fp", "fn", "precision", "recall", "f1",
        "false_drug", "reason_recall", "est_correction_s",
    ]
    with open(csv_path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(summary_rows)

    # File combinato (convenienza per analisi)
    all_path = os.path.join(out_dir, "all_tc_data.json")
    with open(all_path, "w", encoding="utf-8") as fh:
        json.dump(all_tc_data, fh, ensure_ascii=False, indent=2)

    # EXPORT_INFO.txt
    avg_f1  = sum(r["f1"]       for r in summary_rows) / len(summary_rows)
    avg_pre = sum(r["precision"] for r in summary_rows) / len(summary_rows)
    avg_rec = sum(r["recall"]    for r in summary_rows) / len(summary_rows)
    tot_fd  = sum(r["false_drug"] for r in summary_rows)
    tot_ec  = sum(r["est_correction_s"] for r in summary_rows)

    info_path = os.path.join(out_dir, "EXPORT_INFO.txt")
    with open(info_path, "w", encoding="utf-8") as fh:
        fh.write("RheumaFlow — POC raccordo LLM — Pacchetto offline\n")
        fh.write(f"Generato:             {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
        fh.write(f"Test case:            {len(test_texts)} (TC01-TC15)\n")
        fh.write(f"Farmaci canonici:     {len(drug_canonicals)}\n")
        fh.write(f"Parser baseline F1:   {avg_f1:.3f} (Pre={avg_pre:.3f} Rec={avg_rec:.3f})\n")
        fh.write(f"Falsi farmaci parser: {tot_fd}\n")
        fh.write(f"Corr. stim. parser:   {tot_ec // 60:.0f}min\n\n")
        fh.write("Struttura directory:\n")
        fh.write("  tc_data/TCxx.json          raccordo + ground truth (input per LLM)\n")
        fh.write("  parser_baseline/TCxx.json  output parser regex + metriche\n")
        fh.write("  parser_baseline.csv        tabella riepilogo (confronto con LLM)\n")
        fh.write("  all_tc_data.json           tutti i dati in un file\n\n")
        fh.write("Per eseguire su PC locale:\n")
        fh.write("  bash poc/run_local.sh                          # 3B vs 7B\n")
        fh.write("  bash poc/run_local.sh qwen2.5:3b               # solo 3B\n")
        fh.write("  bash poc/run_local.sh qwen2.5:3b --tc TC01,TC06 --verbose\n")

    print(f"\n{BOLD}  Parser baseline — media su {len(test_texts)} TC:{RESET}")
    print(f"  F1={avg_f1:.3f}  Pre={avg_pre:.3f}  Rec={avg_rec:.3f}  "
          f"FalseFarm={tot_fd}  EstCorr={tot_ec // 60:.0f}min")
    print(f"\n{GREEN}  Pacchetto salvato in: {os.path.abspath(out_dir)}/{RESET}")
    print(f"  {DIM}tc_data/        {len(test_texts)} file JSON (raccordi + expected){RESET}")
    print(f"  {DIM}parser_baseline/{len(test_texts)} file JSON + {os.path.basename(csv_path)}{RESET}")
    print(f"  {DIM}all_tc_data.json, EXPORT_INFO.txt{RESET}")
    print(f"\n  {CYAN}bash poc/run_local.sh{RESET}  — lancia il confronto su PC locale con Ollama")


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="POC raccordo LLM v2")
    ap.add_argument("--model",   default="qwen2.5:3b")
    ap.add_argument("--compare", nargs="+", metavar="MODEL",
                    help="Confronta più modelli (es. --compare qwen2.5:3b qwen2.5:7b)")
    ap.add_argument("--tc",      default="", help="TC01,TC02 oppure 'real' per TC06-TC15")
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--no-llm",  action="store_true")
    ap.add_argument("--export",  nargs="?", const="poc/export", metavar="DIR",
                    help="Genera pacchetto offline (default: poc/export). Non richiede Ollama.")
    args = ap.parse_args()

    drug_canonicals = load_drug_canonicals()
    alias_index     = load_drug_alias_index()

    with open(TEST_TEXTS_PATH) as f:
        all_texts = json.load(f)

    # Modalità export — non richiede Ollama
    if args.export:
        export_offline_package(all_texts, drug_canonicals, alias_index, args.export)
        sys.exit(0)

    # Selezione TC
    if args.tc.lower() == "real":
        selected_ids = [f"TC{i:02d}" for i in range(6, 16)]
    elif args.tc.lower() == "synthetic":
        selected_ids = [f"TC{i:02d}" for i in range(1, 6)]
    elif args.tc:
        selected_ids = [t.strip().upper() for t in args.tc.split(",") if t.strip()]
    else:
        selected_ids = []

    test_texts = [t for t in all_texts if not selected_ids or t["id"] in selected_ids]
    if not test_texts:
        print(f"{RED}Nessun test case trovato.{RESET}"); sys.exit(1)

    # Modelli da testare
    if args.compare:
        models_to_run = args.compare
    elif args.no_llm:
        models_to_run = []
    else:
        models_to_run = [args.model]

    for m in models_to_run:
        if not check_ollama(m):
            sys.exit(1)

    print(f"\n{BOLD}{'═' * 90}{RESET}")
    print(f"{BOLD}  POC raccordo LLM v2 — {', '.join(models_to_run) or 'solo parser regex'}{RESET}")
    print(f"  TC: {', '.join(t['id'] for t in test_texts)}  |  farmaci: {len(drug_canonicals)}")
    print(f"{'═' * 90}")

    all_tc_results = []

    for tc in test_texts:
        tc_id = tc["id"]
        text  = tc["raccordo"]
        gt    = tc["ground_truth"]
        desc  = tc.get("description", "")

        print(f"\n\n{BOLD}{BLUE}{'▌' * 45}{RESET}")
        print(f"{BOLD}{BLUE}  [{tc_id}] {desc}{RESET}")
        print(f"{BOLD}{BLUE}{'▌' * 45}{RESET}")
        print(f"\n  Testo ({len(text)} char): {text[:250]}{'…' if len(text)>250 else ''}")

        row = {"tc_id": tc_id, "ground_truth": gt}

        # Parser regex
        print(f"\n  {BOLD}Parser regex…{RESET}", end=" ", flush=True)
        regex_raw    = run_regex_parser(text)
        regex_valid  = validate_all(regex_raw, drug_canonicals, alias_index)
        regex_valid  = [v for v in regex_valid if v["_validation"]["valid"]]
        regex_deduped, _ = deduplicate_events(regex_valid)
        print(f"{GREEN}OK{RESET} ({len(regex_deduped)} eventi)")
        print_events_table(regex_deduped, "Parser regex")
        regex_m = compute_metrics(regex_deduped, gt, alias_index, drug_canonicals)
        row["regex"] = {"metrics": regex_m, "events": regex_deduped}
        print(f"\n  {DIM}Regex:{RESET} ", end=""); print_metrics_row("Parser regex", regex_m)

        # LLM(s)
        for model in models_to_run:
            model_result = run_model_on_tc(tc, model, drug_canonicals, alias_index, args.verbose)
            row[model] = model_result
            if model_result["llm_ok"]:
                print(f"\n  {DIM}{model}:{RESET} ", end="")
                print_metrics_row(model, model_result["metrics"],
                                  ref=regex_m,
                                  elapsed=model_result["elapsed"],
                                  dup_removed=model_result["dup_removed"])
                if models_to_run:
                    print_diff(model_result["events"], regex_deduped, gt)

        # Ground truth
        print_events_table(gt, f"Ground truth ({len(gt)} eventi annotati)")
        all_tc_results.append(row)

    print_session_summary(all_tc_results, models_to_run, drug_canonicals, alias_index)


if __name__ == "__main__":
    main()
