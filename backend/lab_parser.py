"""
lab_parser.py — Improved, clinically-usable lab report extraction for RheumaFlow.

Pipeline
--------
PDF (native text):
    1a. pdfplumber  → table-aware extraction (best for tabular lab reports)
    1b. PyMuPDF     → layout-preserving text extraction
    1c. pdftotext   → CLI fallback (poppler)
    1d. pypdf        → pure-Python last resort
    → if text is too sparse → treat as SCANNED → go to OCR path

PDF (scanned / image-based):
    2a. PyMuPDF renders each page as 300 DPI grayscale bitmap
    2b. PIL preprocessing: contrast enhance → sharpen → Otsu threshold
    2c. pytesseract OCR (ita+eng), if binary available

Image file (JPEG/PNG/WEBP):
    Same PIL preprocessing → pytesseract

Rule-based parsing (applied to all extracted text):
    - 50+ rheumatology-specific rules (unchanged)
    - LINE-AWARE: value extracted from same line as test name
    - REF-RANGE-EXCLUSIVE: ref range detected first so it is NOT confused with patient value
    - PLAUSIBILITY BOUNDS: physiologically impossible values → LOW confidence
    - DECIMAL COMMA/POINT normalisation
    - Abnormal flag extracted from same line only (not cross-line)
    - Duplicate deduplication

GDPR: no PII is ever logged or persisted. Only structural metrics are emitted.
"""

from __future__ import annotations

import io
import logging
import re
import subprocess
import os
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Confidence levels ────────────────────────────────────────────────────────
HIGH   = "high"    # name + numeric value + unit all extracted cleanly and plausible
MEDIUM = "medium"  # name matched + value extracted but unit missing / uncertain
LOW    = "low"     # name matched but value unclear, implausible, or qualitative with ambiguity


# ─── Lab rule definitions ─────────────────────────────────────────────────────
# (panel, test_key, name_regex, value_type)
# value_type: "numeric" | "qualitative" | "titer"

LAB_RULES = [
    # ── Emocromo (CBC) ──────────────────────────────────────────────────────
    ("emocromo", "hb",
     r"(?:emoglobina|hb|haemoglobin\b|hemoglobin\b)(?:\s*\([^)]*\))?",
     "numeric"),
    ("emocromo", "wbc",
     r"(?:globuli\s+bianchi|leucociti|wbc|white\s+blood\s+cell)(?:\s*\([^)]*\))?",
     "numeric"),
    ("emocromo", "plt",
     r"(?:piastrine|plt|platelets|trombociti)(?:\s*\([^)]*\))?",
     "numeric"),
    ("emocromo", "neutrophils",
     r"(?:neutrofili|neutrophils?|granulociti\s+neutrofili)(?:\s*\([^)]*\))?",
     "numeric"),
    ("emocromo", "lymphocytes",
     r"(?:linfociti|lymphocytes?)(?:\s*\([^)]*\))?",
     "numeric"),
    ("emocromo", "eosinophils",
     r"(?:eosinofili|eosinophils?)(?:\s*\([^)]*\))?",
     "numeric"),
    ("emocromo", "monocytes",
     r"(?:monociti|monocytes?)(?:\s*\([^)]*\))?",
     "numeric"),
    ("emocromo", "basophils",
     r"(?:basofili|basophils?)(?:\s*\([^)]*\))?",
     "numeric"),

    # ── Fase acuta (Acute phase) ─────────────────────────────────────────────
    ("fase_acuta", "ves",
     r"(?:ves\b|esr\b|velocit[àa]\s+di\s+eritrosedimentazione|eritrosedimentazione|erythrocyte\s+sed)(?:\s*\([^)]*\))?",
     "numeric"),
    ("fase_acuta", "pcr",
     r"(?:pcr\b|crp\b|c[-\s]?reactive\s+protein|proteina\s+c\s+reattiva)(?!\s*[-\s](?:pr3|mpo))(?:\s*\([^)]*\))?",
     "numeric"),
    ("fase_acuta", "ferritina",
     r"(?:ferritina|ferritin)(?:\s*\([^)]*\))?",
     "numeric"),
    ("fase_acuta", "fibrinogeno",
     r"(?:fibrinogeno|fibrinogen)(?:\s*\([^)]*\))?",
     "numeric"),
    ("fase_acuta", "saa",
     r"(?:saa\b|amiloide\s+a\s+sierica|serum\s+amyloid\s+a)(?:\s*\([^)]*\))?",
     "numeric"),

    # ── Funzione organi ──────────────────────────────────────────────────────
    ("funzione", "creatinina",
     r"(?:creatinina|creatinine)(?!\s*[-/]creatinina)(?:\s*\([^)]*\))?",
     "numeric"),
    ("funzione", "egfr",
     r"(?:egfr\b|gfr\b|filtrato\s+glomerulare|velocit[àa]\s+di\s+filtrazione\s+glomerulare)(?:\s*\([^)]*\))?",
     "numeric"),
    ("funzione", "ast",
     r"(?:ast\b|got\b|aspartato\s+aminotransferasi|aspartate\s+aminotransferase)(?:\s*\([^)]*\))?",
     "numeric"),
    ("funzione", "alt",
     r"(?:alt\b|gpt\b|alanina\s+aminotransferasi|alanine\s+aminotransferase)(?:\s*\([^)]*\))?",
     "numeric"),
    ("funzione", "ggt",
     r"(?:γ[-\s]?gt|ggt\b|gamma[-\s]?gt|gammaglutamiltransferasi|\bγgt)(?:\s*\([^)]*\))?",
     "numeric"),
    ("funzione", "ck",
     r"(?:(?<!\w)ck\b|cpk\b|creatinchinasi|creatine\s+kinase|creatina\s+fosfochinasi)(?:\s*\([^)]*\))?",
     "numeric"),
    ("funzione", "ldh",
     r"(?:ldh\b|lattico\s+deidrogenasi|lattato\s+deidrogenasi|lactate\s+dehydrogenase)(?:\s*\([^)]*\))?",
     "numeric"),
    ("funzione", "urato",
     r"(?:acido\s+urico|uricemia|uratemia|urate\b|uric\s+acid)(?:\s*\([^)]*\))?",
     "numeric"),
    ("funzione", "vit_d",
     r"(?:vitamina\s+d[23]?|25[-\s]?oh[-\s]?d[23]?|colecalciferolo|calcifediolo|25-idrossivitamina)(?:\s*\([^)]*\))?",
     "numeric"),
    ("funzione", "aldolasi",
     r"(?:aldolasi|aldolase)(?:\s*\([^)]*\))?",
     "numeric"),

    # ── Complemento ─────────────────────────────────────────────────────────
    ("complemento", "c3",
     r"(?:complemento\s+)?(?<!\w)c3(?!\w)(?:\s*\([^)]*\))?",
     "numeric"),
    ("complemento", "c4",
     r"(?:complemento\s+)?(?<!\w)c4(?!\w)(?:\s*\([^)]*\))?",
     "numeric"),
    ("complemento", "ch50",
     r"(?:ch50|complemento\s+emolitico|hemolytic\s+complement)(?:\s*\([^)]*\))?",
     "numeric"),

    # ── Autoanticorpi numerici ───────────────────────────────────────────────
    ("autoanticorpi", "anti_dsdna",
     r"anti[-\s]?(?:ds[-\s]?dna|dna\s+nativo|dna\s+ds|dna\s+doppia\s+catena)(?:\s*\([^)]*\))?",
     "numeric"),
    ("autoanticorpi", "fr",
     r"(?:fattore\s+reumatoide|(?<!\w)fr(?!\w)|(?<!\w)rf(?!\w)|rheumatoid\s+factor)(?!\s*[-/]\s*(?:igg|iga|igm))(?:\s*\([^)]*\))?",
     "numeric"),
    ("autoanticorpi", "acpa_anti_ccp",
     r"(?:anti[-\s]?ccp|acpa|anti[-\s]peptidi\s+citrullinati|anti[-\s]cyclic\s+citrullinated)(?:\s*\([^)]*\))?",
     "numeric"),
    ("autoanticorpi", "anca_pr3",
     r"(?:anca[-\s]?pr3|anti[-\s]?pr3\b|anti[-\s]?proteinasi\s*3|c[-\s]?anca)(?:\s*\([^)]*\))?",
     "numeric"),
    ("autoanticorpi", "anca_mpo",
     r"(?:anca[-\s]?mpo|anti[-\s]?mpo\b|anti[-\s]?mieloperossidasi|p[-\s]?anca)(?:\s*\([^)]*\))?",
     "numeric"),
    ("autoanticorpi", "anti_mcv",
     r"(?:anti[-\s]?mcv|anti[-\s]mutated\s+citrullinated\s+vimentin|vimentina\s+citrullinata)(?:\s*\([^)]*\))?",
     "numeric"),
    ("autoanticorpi", "acl_igg",
     r"(?:anticardiolipina\s+igg|anti[-\s]?cardiolipin\s+igg|acl\s+igg|aCL[-\s]IgG)(?:\s*\([^)]*\))?",
     "numeric"),
    ("autoanticorpi", "acl_igm",
     r"(?:anticardiolipina\s+igm|anti[-\s]?cardiolipin\s+igm|acl\s+igm|aCL[-\s]IgM)(?:\s*\([^)]*\))?",
     "numeric"),
    ("autoanticorpi", "b2gp1_igg",
     r"(?:beta\s*2[-\s]glicoproteina\s+(?:i\s+)?igg|b2[-\s]?gp1?[-\s]igg|β2[-\s]?gp\s*1?\s+igg|anti[-\s]?β2gp1?\s+igg)(?:\s*\([^)]*\))?",
     "numeric"),
    ("autoanticorpi", "b2gp1_igm",
     r"(?:beta\s*2[-\s]glicoproteina\s+(?:i\s+)?igm|b2[-\s]?gp1?[-\s]igm|β2[-\s]?gp\s*1?\s+igm|anti[-\s]?β2gp1?\s+igm)(?:\s*\([^)]*\))?",
     "numeric"),

    # ── Autoanticorpi qualitativi / titolo ───────────────────────────────────
    ("autoanticorpi", "ana_titolo",
     r"(?:ana\b|anticorpi\s+antinucleare?|antinuclear\s+antibod)(?!\s*[-:]?\s*(?:pr3|mpo|ena|sm\b|rnp|ssa|ssb|scl|jo|mi|mda|tif|nxp|srp|hmg))(?:\s*\([^)]*\))?",
     "titer"),
    ("autoanticorpi", "ana_pattern",
     r"(?:pattern\s*(?:ana|if)|immunofluorescenza\s+(?:indiretta\s+)?(?:su\s+hep|hep)|pattern\s+fluorescenza)",
     "qualitative"),
    ("autoanticorpi", "anti_sm",
     r"anti[-\s]?sm(?!\s*[-/]?rnp)(?:\s*\([^)]*\))?",
     "qualitative"),
    ("autoanticorpi", "anti_rnp",
     r"anti[-\s]?(?:u1[-\s]?)?rnp\b(?:\s*\([^)]*\))?",
     "qualitative"),
    ("autoanticorpi", "anti_ssa_ro",
     r"anti[-\s]?(?:ssa\b|ro\b)(?:\s*(?:60|52)kd)?(?:\s*\([^)]*\))?",
     "qualitative"),
    ("autoanticorpi", "anti_ssb_la",
     r"anti[-\s]?(?:ssb\b|la\b)(?:\s*\([^)]*\))?",
     "qualitative"),
    ("autoanticorpi", "anti_scl70",
     r"anti[-\s]?(?:scl[-\s]?70|topoisomerasi\s+i)(?:\s*\([^)]*\))?",
     "qualitative"),
    ("autoanticorpi", "anti_centromero",
     r"anti[-\s]?(?:centromero|centromere|cenp[-\s]?b)(?:\s*\([^)]*\))?",
     "qualitative"),
    ("autoanticorpi", "anti_rnap3",
     r"anti[-\s]?(?:rna\s*polimerasi\s*iii|rnap\s*3|rnapiii)(?:\s*\([^)]*\))?",
     "qualitative"),
    ("autoanticorpi", "anti_pmscl",
     r"anti[-\s]?pm[-\s]?scl(?:\s*\([^)]*\))?",
     "qualitative"),
    ("autoanticorpi", "anti_ku",
     r"anti[-\s]?ku(?:\s*\([^)]*\))?",
     "qualitative"),
    ("autoanticorpi", "anti_jo1",
     r"anti[-\s]?jo[-\s]?1(?:\s*\([^)]*\))?",
     "qualitative"),
    ("autoanticorpi", "anti_mi2",
     r"anti[-\s]?mi[-\s]?2(?:\s*\([^)]*\))?",
     "qualitative"),
    ("autoanticorpi", "anti_mda5",
     r"anti[-\s]?mda[-\s]?5(?:\s*\([^)]*\))?",
     "qualitative"),
    ("autoanticorpi", "anti_tif1g",
     r"anti[-\s]?tif1[-\s]?(?:γ|gamma|g)(?:\s*\([^)]*\))?",
     "qualitative"),
    ("autoanticorpi", "anti_nxp2",
     r"anti[-\s]?nxp[-\s]?2(?:\s*\([^)]*\))?",
     "qualitative"),
    ("autoanticorpi", "anti_srp",
     r"anti[-\s]?srp\b(?:\s*\([^)]*\))?",
     "qualitative"),
    ("autoanticorpi", "anti_hmgcr",
     r"anti[-\s]?hmgcr\b(?:\s*\([^)]*\))?",
     "qualitative"),
    ("autoanticorpi", "lac",
     r"(?:(?<!\w)lac\b|lupus\s+anticoagulant|anticoagulante\s+lupico)(?:\s*\([^)]*\))?",
     "qualitative"),

    # ── Urine ────────────────────────────────────────────────────────────────
    ("urine", "proteinuria_24h",
     r"(?:proteinuria\s+(?:delle\s+)?24\s*(?:ore|h)|proteine\s+(?:totali\s+)?urine\s+24)(?:\s*\([^)]*\))?",
     "numeric"),
    ("urine", "albuminuria",
     r"(?:albuminuria|microalbuminuria|albumin(?:a)?\s+(?:urin|nelle\s+urin))(?:\s*\([^)]*\))?",
     "numeric"),
    ("urine", "uacr",
     r"(?:uacr\b|albumin(?:a)?[-/]creatinina\s+urinaria?|rapporto\s+albumin|acr\b)(?:\s*\([^)]*\))?",
     "numeric"),
    ("urine", "leucocituria",
     r"(?:leucocituria|leucociti\s+(?:nelle\s+)?urine?|piuria|wbc\s+urine?|white\s+cell\s+urine)(?:\s*\([^)]*\))?",
     "qualitative"),
    ("urine", "hematuria",
     r"(?:ematuria|eritroc(?:iti)?\s+(?:nelle\s+)?urine?|sangue\s+(?:nelle\s+)?urine?|rbc\s+urine?|red\s+cell\s+urine)(?:\s*\([^)]*\))?",
     "qualitative"),
    ("urine", "urinary_casts",
     r"(?:cilindri\s+(?:urinari)?|cast(?:s)?\s+urin|cilindruria)(?:\s*\([^)]*\))?",
     "qualitative"),

    # ── Metabolismo marziale (ferro) ─────────────────────────────────────────
    ("marziale", "iron",
     r"(?:sideremia|ferro\s+sierico|ferro\s+siero|iron(?:\s+serum)?|(?<!\w)fe(?!\w)(?:\s+sier)?)(?:\s*\([^)]*\))?",
     "numeric"),
    ("marziale", "transferrina",
     r"(?:transferrina|transferrin(?:e)?)(?!\s*sat)(?:\s*\([^)]*\))?",
     "numeric"),
    ("marziale", "saturazione_transferrina",
     r"(?:saturazione\s+(?:della\s+)?transferrina|sat(?:urazione)?\s+(?:della\s+)?transferr?|tsat\b|transferrin\s+sat(?:uration)?)(?:\s*\([^)]*\))?",
     "numeric"),

    # ── Proteine totali ───────────────────────────────────────────────────────
    ("funzione", "proteine_totali",
     r"(?:proteine\s+totali|protidemia|prot(?:eine)?\s+tot(?:ali)?|total\s+protein(?:s)?)(?!\s*urine)(?:\s*\([^)]*\))?",
     "numeric"),

    # ── Immunoglobuline ───────────────────────────────────────────────────────
    ("immunoglobuline", "igg",
     r"(?:(?<!\w)igg\b|immunoglobulin(?:a|e)?\s+g(?!\s*[ma]))(?:\s*\([^)]*\))?",
     "numeric"),
    ("immunoglobuline", "iga",
     r"(?:(?<!\w)iga\b|immunoglobulin(?:a|e)?\s+a(?!\s*[gm]))(?:\s*\([^)]*\))?",
     "numeric"),
    ("immunoglobuline", "igm",
     r"(?:(?<!\w)igm\b|immunoglobulin(?:a|e)?\s+m(?!\s*[ga]))(?:\s*\([^)]*\))?",
     "numeric"),

    # ── Crioglobuline ─────────────────────────────────────────────────────────
    ("autoanticorpi", "crioglobuline",
     r"(?:crioglobuline?|cryoglobulin(?:s|e)?)(?:\s*\([^)]*\))?",
     "qualitative"),

    # ── Metabolismo osseo ─────────────────────────────────────────────────────
    ("metabolismo_osseo", "bap",
     r"(?:fosfatasi\s+alcalina\s+ossea|bap\b|b[-\s]?alp\b|bone[-\s]?(?:specific\s+)?alp(?:haline\s+phosphatase)?|bone\s+alkaline\s+phosphatase)(?:\s*\([^)]*\))?",
     "numeric"),
    ("metabolismo_osseo", "ctx",
     r"(?:crosslaps?|ctx\b|beta[-\s]?ctx\b|telopeptide\s+c[-\s]?terminale|c[-\s]?terminal\s+(?:cross[-\s]?linking\s+)?telopeptide|β[-\s]?ctx\b|s[-\s]?ctx\b)(?:\s*\([^)]*\))?",
     "numeric"),
]


# =============================================================================
# UNIT NORMALISATION
# =============================================================================
#
# For each test_key that may be reported in multiple units, we define:
#   • a canonical (preferred) unit
#   • a list of (compiled regex, canonical_unit, conversion_factor) triples
#
# The first matching pattern wins.  factor=1.0 means unit rename only.
# All patterns are matched against the *extracted* unit string (case-insensitive).
#
# Conversions are rounded to 6 significant figures to avoid float noise.
# ─────────────────────────────────────────────────────────────────────────────
UNIT_NORMALISATIONS: dict[str, list[tuple[re.Pattern, str, float]]] = {
    # CRP / PCR ─────────────────────────────────────────────────────────────
    # canonical: mg/L
    # 1 mg/dL = 10 mg/L
    "pcr": [
        (re.compile(r"mg/dl", re.I), "mg/L", 10.0),
        (re.compile(r"mg/l",  re.I), "mg/L",  1.0),
    ],
    # 25-OH Vitamin D ────────────────────────────────────────────────────────
    # canonical: ng/mL
    # 1 nmol/L = 0.4 ng/mL  (i.e. 1 ng/mL = 2.5 nmol/L)
    "vit_d": [
        (re.compile(r"nmol/l",  re.I), "ng/mL", 0.4),
        (re.compile(r"ng/ml",   re.I), "ng/mL", 1.0),
    ],
    # Creatinine ─────────────────────────────────────────────────────────────
    # canonical: mg/dL
    # 1 µmol/L = 0.011312 mg/dL  (1 mg/dL ≈ 88.4 µmol/L)
    "creatinina": [
        (re.compile(r"[μµu]mol/l", re.I), "mg/dL", 0.011312),
        (re.compile(r"mg/dl",      re.I), "mg/dL", 1.0),
    ],
    # Uric acid ──────────────────────────────────────────────────────────────
    # canonical: mg/dL
    # 1 µmol/L = 0.016807 mg/dL  (1 mg/dL ≈ 59.48 µmol/L)
    # 1 mmol/L = 16.807 mg/dL
    "urato": [
        (re.compile(r"[μµu]mol/l", re.I), "mg/dL", 0.016807),
        (re.compile(r"mmol/l",     re.I), "mg/dL", 16.807),
        (re.compile(r"mg/dl",      re.I), "mg/dL", 1.0),
    ],
    # Complement C3 ──────────────────────────────────────────────────────────
    # canonical: mg/dL
    # 1 g/L = 100 mg/dL
    "c3": [
        (re.compile(r"\bg/l\b",  re.I), "mg/dL", 100.0),
        (re.compile(r"mg/dl",    re.I), "mg/dL",   1.0),
    ],
    # Complement C4 ──────────────────────────────────────────────────────────
    # canonical: mg/dL
    "c4": [
        (re.compile(r"\bg/l\b",  re.I), "mg/dL", 100.0),
        (re.compile(r"mg/dl",    re.I), "mg/dL",   1.0),
    ],
    # Ferritin ───────────────────────────────────────────────────────────────
    # canonical: ng/mL  (numerically identical to µg/L)
    "ferritina": [
        (re.compile(r"[μµu]g/l", re.I), "ng/mL", 1.0),
        (re.compile(r"ng/ml",    re.I), "ng/mL", 1.0),
    ],
    # Haemoglobin ────────────────────────────────────────────────────────────
    # canonical: g/dL
    # 1 mmol/L = 1.6113 g/dL
    "hb": [
        (re.compile(r"mmol/l", re.I), "g/dL", 1.6113),
        (re.compile(r"g/dl",   re.I), "g/dL", 1.0),
    ],
    # Fibrinogen ─────────────────────────────────────────────────────────────
    # canonical: mg/dL
    # 1 g/L = 100 mg/dL
    "fibrinogeno": [
        (re.compile(r"\bg/l\b",  re.I), "mg/dL", 100.0),
        (re.compile(r"mg/dl",    re.I), "mg/dL",   1.0),
    ],
    # Serum iron / Sideremia ─────────────────────────────────────────────────
    # canonical: µg/dL
    # 1 µmol/L = 5.585 µg/dL
    "iron": [
        (re.compile(r"[μµu]mol/l", re.I), "μg/dL", 5.585),
        (re.compile(r"[μµu]g/dl",  re.I), "μg/dL", 1.0),
    ],
    # Transferrin ────────────────────────────────────────────────────────────
    # canonical: mg/dL   (1 g/L = 100 mg/dL)
    "transferrina": [
        (re.compile(r"\bg/l\b",  re.I), "mg/dL", 100.0),
        (re.compile(r"mg/dl",    re.I), "mg/dL",   1.0),
    ],
    # Total protein ──────────────────────────────────────────────────────────
    # canonical: g/dL   (1 g/L = 0.1 g/dL)
    "proteine_totali": [
        (re.compile(r"\bg/l\b",  re.I), "g/dL", 0.1),
        (re.compile(r"g/dl",     re.I), "g/dL", 1.0),
    ],
    # IgG / IgA / IgM ────────────────────────────────────────────────────────
    # canonical: mg/dL   (1 g/L = 100 mg/dL)
    "igg": [
        (re.compile(r"\bg/l\b",  re.I), "mg/dL", 100.0),
        (re.compile(r"mg/dl",    re.I), "mg/dL",   1.0),
    ],
    "iga": [
        (re.compile(r"\bg/l\b",  re.I), "mg/dL", 100.0),
        (re.compile(r"mg/dl",    re.I), "mg/dL",   1.0),
    ],
    "igm": [
        (re.compile(r"\bg/l\b",  re.I), "mg/dL", 100.0),
        (re.compile(r"mg/dl",    re.I), "mg/dL",   1.0),
    ],
}

# Canonical units for PLAUSIBILITY_BOUNDS comment reference.
# After normalisation, all values must satisfy these post-normalisation bounds:
CANONICAL_UNITS: dict[str, str] = {
    "pcr":        "mg/L",
    "vit_d":      "ng/mL",
    "creatinina": "mg/dL",
    "urato":      "mg/dL",
    "c3":         "mg/dL",
    "c4":         "mg/dL",
    "ferritina":  "ng/mL",
    "hb":         "g/dL",
    "fibrinogeno": "mg/dL",
}

# ─── Plausibility bounds ─────────────────────────────────────────────────────
# (min, max) — values outside these are physiologically impossible → LOW confidence.
# Set generously to avoid false LOW ratings; only catch obvious ref-range confusion.
# ⚠ Bounds are checked AFTER unit normalisation — values must be in canonical units.
PLAUSIBILITY_BOUNDS: dict[str, tuple[float, float]] = {
    "hb":            (1.0,    25.0),
    "wbc":           (0.01,   200.0),
    "plt":           (1.0,    3000.0),
    "neutrophils":   (0.0,    150.0),
    "lymphocytes":   (0.0,    150.0),
    "eosinophils":   (0.0,    50.0),
    "monocytes":     (0.0,    50.0),
    "basophils":     (0.0,    5.0),
    "ves":           (1.0,    200.0),
    "pcr":           (0.01,   5000.0),
    "ferritina":     (0.1,    100_000.0),
    "fibrinogeno":   (50.0,   2000.0),
    "saa":           (0.0,    100_000.0),
    "creatinina":    (0.1,    30.0),
    "egfr":          (1.0,    200.0),
    "ast":           (1.0,    100_000.0),
    "alt":           (1.0,    100_000.0),
    "ggt":           (1.0,    100_000.0),
    "ck":            (1.0,    500_000.0),
    "ldh":           (10.0,   100_000.0),
    "urato":         (0.5,    30.0),
    "vit_d":         (0.1,    500.0),
    "aldolasi":      (0.0,    1000.0),
    "c3":            (1.0,    500.0),
    "c4":            (0.1,    100.0),
    "ch50":          (0.0,    300.0),
    "anti_dsdna":    (0.0,    10_000.0),
    "fr":            (0.0,    10_000.0),
    "acpa_anti_ccp": (0.0,    10_000.0),
    "anca_pr3":      (0.0,    10_000.0),
    "anca_mpo":      (0.0,    10_000.0),
    "anti_mcv":      (0.0,    10_000.0),
    "acl_igg":       (0.0,    1000.0),
    "acl_igm":       (0.0,    1000.0),
    "b2gp1_igg":     (0.0,    1000.0),
    "b2gp1_igm":     (0.0,    1000.0),
    "proteinuria_24h": (0.0,  200_000.0),
    "albuminuria":   (0.0,    50_000.0),
    "uacr":          (0.0,    100_000.0),
    # Metabolismo marziale
    "iron":                   (1.0,     1000.0),
    "transferrina":           (50.0,    800.0),
    "saturazione_transferrina": (1.0,   100.0),
    # Funzione (aggiuntivi)
    "proteine_totali":        (3.0,     12.0),
    # Immunoglobuline
    "igg":                    (10.0,    10_000.0),
    "iga":                    (1.0,     5000.0),
    "igm":                    (1.0,     5000.0),
    # Metabolismo osseo
    "bap":                    (0.1,     500.0),
    "ctx":                    (0.001,   20.0),
}


# ─── Unit pattern ────────────────────────────────────────────────────────────
UNIT_PATTERN = re.compile(
    r"(?:"
    r"g/d[Ll]|mg/d[Ll]|μg/d[Ll]|ng/[mμ][Ll]|pg/m[Ll]|"
    r"mg/[Ll]|g/[Ll]|μg/[Ll]|ng/[Ll]|"
    r"U/[mμ][Ll]|UI/[mμ][Ll]|U/[Ll]|UI/[Ll]|"
    r"mUI/[mμ][Ll]|nmol/[Ll]|pmol/[Ll]|μmol/[Ll]|mmol/[Ll]|"
    r"x10\^?[369]/[μμ]?[Ll]|×10\^?[369]/[μμ]?[Ll]|"
    r"10\^?[369]/[μμ]?[Ll]|\*10\^?[369]/[Ll]|"
    r"mm/h|mm/1h|mm/ora|mm\s*/\s*1?h|"
    r"IU/[mμ][Ll]|kU/[Ll]|kIU/[Ll]|"
    r"GPL[-\s]?U|MPL[-\s]?U|SGU|SMU|"
    r"g/24h|mg/24h|mg/g|mg/mmol|"
    r"fl|pg|%|"
    r"m[Ll]/min(?:/1\.73\s*m[²2])?|"
    r"UI/[Ll]|nmol/[Ll]"
    r")",
    re.IGNORECASE,
)

# ─── CBC differential — keys that require absolute count prioritisation ───────
# For these tests the parser applies special logic: absolute count (x10^9/L, /µL,
# K/µL …) is the primary extracted value; percentage is stored as secondary `pct`.
CBC_DIFFERENTIAL_KEYS = frozenset({
    "neutrophils", "lymphocytes", "monocytes", "eosinophils", "basophils",
})

# Regex: numeric value directly followed by an absolute count unit.
# Matches formats like: 3.8 x10^9/L  /  3.8 x10^9/µL  /  3800 /µL  /  3.8 K/µL
# NOTE: the µ/u character before the final L is made optional so that the very
# common Italian lab format "x10^9/L" (no µ prefix) is also matched.
_ABS_COUNT_WITH_UNIT_RE = re.compile(
    r"(?<![/:\w%])"
    r"([<>≤≥]?\s*\d+(?:[.,]\d+)?)"          # e.g. 3.8  or  3,8
    r"\s*"
    r"("
    r"x10\^?[369]/[μµuU]?[Ll]"              # x10^9/L  x10^9/µL  x10³/L
    r"|×10\^?[369]/[μµuU]?[Ll]"
    r"|10\^?[369]/[μµuU]?[Ll]"              # 10^9/L  10^9/µL
    r"|\*10\^?[369]/[μµuU]?[Ll]"            # *10^9/L
    r"|[Kk]/[μµuU]?[Ll]"                    # K/µL  K/L  k/uL
    r"|/[μµuU][Ll]"                         # /µL  /uL  (µ required to avoid /L noise)
    r")",
    re.IGNORECASE,
)

# Regex: percentage value (number + %).
# Used to extract the secondary pct field.
_PERCENTAGE_RE = re.compile(
    r"(?<!\d)"             # not directly preceded by another digit (avoids "10^9")
    r"(\d+(?:[.,]\d+)?)"  # numeric value
    r"\s*%",              # percent sign
)

# ─── Qualitative result keywords ──────────────────────────────────────────────
QUAL_POSITIVE = re.compile(
    r"\b(?:positiv[oa]|present[ei]|rilevat[oa]|detected|pos(?:itiv)?\.?)\b", re.I
)
QUAL_NEGATIVE = re.compile(
    r"\b(?:negativ[oa]|assent[ei]|non\s+rilevat[oa]|not\s+detected|neg(?:ativ)?\.?)\b", re.I
)
QUAL_BORDERLINE = re.compile(
    r"\b(?:dubbi[oa]|borderline|equivoc[oa]|indeterminat[oa])\b", re.I
)

# ─── Abnormal flag (must appear on same line) ─────────────────────────────────
ABNORMAL_HIGH = re.compile(r"(?:\*H\*|\bH\b|ALTO|ALTA|ELEVAT[OA]|HIGH|AUMENTAT[OA]|↑)", re.I)
ABNORMAL_LOW  = re.compile(r"(?:\*L\*|\bL\b|BASSO|BASSA|RIDOTT[OA]|LOW|DIMINUIT[OA]|↓)",  re.I)

# ─── Ref-range start detection ───────────────────────────────────────────────
# These patterns indicate that a reference range is beginning — everything AFTER
# this point in the window must be ignored when searching for the patient value.
_REF_RANGE_START_RE = re.compile(
    r"(?:"
    r"\[\s*<?[\d,.]|"                                     # [4.0-10.0]  [<5.0]
    r"\(\s*(?:v\.?n\.?|v\.?r\.?|rif\.?|ref\.?|range|norm)\b|"  # (vn ...) (rif...)
    r"\bv(?:alori?)?\s*(?:di\s+)?rif[a-z.]*\s*[:=]|"     # v.r.: / valori rif:
    r"\brif(?:erimento)?\s*[:=]\s*<?[\d,.]|"              # rif: 4.0
    r"\brange\s*[:=]?\s*<?[\d,.]|"                        # range: 4.0
    r"v\.n\.\s*<?[\d,.]"                                   # v.n. 5.0
    r")",
    re.IGNORECASE,
)

# ─── Date extraction ──────────────────────────────────────────────────────────
DATE_PATTERN = re.compile(
    r"(?:"
    r"\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b|"
    r"\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b|"
    r"\b(\d{1,2})\s+(?:gen(?:naio)?|feb(?:braio)?|mar(?:zo)?|apr(?:ile)?|mag(?:gio)?|"
    r"giu(?:gno)?|lug(?:lio)?|ago(?:sto)?|set(?:tembre)?|ott(?:obre)?|"
    r"nov(?:embre)?|dic(?:embre)?)\s+(\d{4})\b"
    r")",
    re.IGNORECASE,
)

_MONTH_IT = {
    "gen": 1, "gennaio": 1, "feb": 2, "febbraio": 2, "mar": 3, "marzo": 3,
    "apr": 4, "aprile": 4, "mag": 5, "maggio": 5, "giu": 6, "giugno": 6,
    "lug": 7, "luglio": 7, "ago": 8, "agosto": 8, "set": 9, "settembre": 9,
    "ott": 10, "ottobre": 10, "nov": 11, "novembre": 11, "dic": 12, "dicembre": 12,
}


# =============================================================================
# TEXT EXTRACTION
# =============================================================================

def _is_meaningful_text(text: str) -> bool:
    """
    Heuristic: is the extracted text content-rich enough to be from a native PDF?
    Returns False for empty / near-empty pages (scanned PDFs yield very little text).
    Thresholds are intentionally generous to avoid mis-classifying short lab reports.
    """
    stripped = text.strip()
    if len(stripped) < 50:
        return False
    letters = sum(1 for c in stripped if c.isalpha())
    digits  = sum(1 for c in stripped if c.isdigit())
    return letters > 20 and digits > 5


def _extract_text_pdfplumber(pdf_bytes: bytes) -> tuple[str, str]:
    """
    pdfplumber: best at table-structured lab reports.
    Extracts tables as structured rows and converts to a parseable text format.
    Returns (text, method) or ("", "") on failure.
    """
    try:
        import pdfplumber

        all_lines: list[str] = []
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                # 1. Try tables first (most accurate for column-aligned reports)
                tables = page.extract_tables() or []
                for table in tables:
                    for row in table:
                        if not row:
                            continue
                        # Clean cells: None → ""
                        cells = [str(c).strip() if c else "" for c in row]
                        # Skip header-only rows (all upper-case strings without digits)
                        non_empty = [c for c in cells if c]
                        if not non_empty:
                            continue
                        has_digit = any(any(ch.isdigit() for ch in c) for c in non_empty)
                        # Format as: CELL1   CELL2   CELL3 ... (tab-separated)
                        all_lines.append("\t".join(cells))

                # 2. Also capture any non-table text (headers, section names, dates)
                words_text = page.extract_text() or ""
                if words_text.strip():
                    # Avoid duplicating table content — only add lines that introduce
                    # section headers (no digits) or date labels
                    for line in words_text.split("\n"):
                        line = line.strip()
                        # Only add header/label lines not already covered by tables
                        if line and not any(ch.isdigit() for ch in line):
                            all_lines.append(line)
                        elif re.search(r"data\s+(?:prelievo|referto|esame)", line, re.I):
                            all_lines.append(line)

        text = "\n".join(all_lines).strip()
        if _is_meaningful_text(text):
            logger.info("PDF extraction: pdfplumber OK (%d chars, %d lines)",
                        len(text), len(all_lines))
            return text, "pdfplumber"
    except Exception as exc:
        logger.debug("pdfplumber extraction failed: %s", type(exc).__name__)
    return "", ""


def _extract_text_pymupdf(pdf_bytes: bytes) -> tuple[str, str]:
    """
    PyMuPDF: best layout preservation for complex PDF formatting.
    Uses TEXT_PRESERVE_WHITESPACE to retain column spacing.
    """
    try:
        import fitz  # PyMuPDF

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages_text: list[str] = []
        flags = fitz.TEXT_PRESERVE_WHITESPACE | fitz.TEXT_MEDIABOX_CLIP
        for page in doc:
            t = page.get_text("text", flags=flags)
            if t.strip():
                pages_text.append(t)
        doc.close()

        text = "\n".join(pages_text).strip()
        if _is_meaningful_text(text):
            logger.info("PDF extraction: PyMuPDF OK (%d chars)", len(text))
            return text, "pymupdf"
    except Exception as exc:
        logger.debug("PyMuPDF extraction failed: %s", type(exc).__name__)
    return "", ""


def _extract_text_pdftotext(pdf_bytes: bytes) -> tuple[str, str]:
    """pdftotext CLI (poppler) — preserves layout columns with -layout flag."""
    try:
        result = subprocess.run(
            ["pdftotext", "-layout", "-enc", "UTF-8", "-", "-"],
            input=pdf_bytes,
            capture_output=True,
            timeout=30,
        )
        if result.returncode == 0:
            text = result.stdout.decode("utf-8", errors="replace").strip()
            if _is_meaningful_text(text):
                logger.info("PDF extraction: pdftotext OK (%d chars)", len(text))
                return text, "pdftotext"
    except Exception as exc:
        logger.debug("pdftotext failed: %s", exc)
    return "", ""


def _extract_text_pypdf(pdf_bytes: bytes) -> tuple[str, str]:
    """pypdf pure-Python fallback."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        pages = [page.extract_text() or "" for page in reader.pages]
        text = "\n".join(pages).strip()
        if _is_meaningful_text(text):
            logger.info("PDF extraction: pypdf OK (%d chars)", len(text))
            return text, "pypdf"
    except Exception as exc:
        logger.debug("pypdf failed: %s", exc)
    return "", ""


def _render_pdf_for_ocr(pdf_bytes: bytes) -> list:
    """
    Use PyMuPDF to render each PDF page as a 300 DPI grayscale PIL Image.
    Returns list of PIL Images, empty list on failure.
    """
    images = []
    try:
        import fitz
        from PIL import Image

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        mat = fitz.Matrix(300 / 72, 300 / 72)   # 300 DPI
        for page in doc:
            pix = page.get_pixmap(matrix=mat, colorspace=fitz.csGRAY)
            img = Image.frombytes("L", [pix.width, pix.height], pix.samples)
            images.append(img)
        doc.close()
        logger.info("PDF OCR prep: rendered %d pages at 300 DPI (gray)", len(images))
    except Exception as exc:
        logger.debug("PDF render for OCR failed: %s", type(exc).__name__)
    return images


def _preprocess_for_ocr(img) -> "PIL.Image.Image":
    """
    Image preprocessing pipeline for best OCR quality:
    1. Ensure grayscale
    2. Contrast enhancement (2×)
    3. Sharpening
    4. Otsu-style binary threshold at 128
    """
    from PIL import Image, ImageFilter, ImageEnhance

    if img.mode != "L":
        img = img.convert("L")
    img = ImageEnhance.Contrast(img).enhance(2.0)
    img = img.filter(ImageFilter.SHARPEN)
    # Simple Otsu-like threshold: pixels > 128 → white, else → black
    img = img.point(lambda x: 255 if x > 128 else 0, "L")
    return img


def _ocr_image(img) -> str:
    """Run Tesseract OCR on a PIL Image. Returns empty string if unavailable."""
    try:
        import pytesseract
        # Custom Tesseract config: OEM 3 = best LSTM, PSM 6 = uniform block of text
        custom_cfg = r"--oem 3 --psm 6"
        text = pytesseract.image_to_string(img, lang="ita+eng", config=custom_cfg)
        return text.strip()
    except Exception as exc:
        logger.debug("Tesseract OCR failed: %s", type(exc).__name__)
        return ""


def extract_text_from_pdf(pdf_bytes: bytes) -> tuple[str, str]:
    """
    Full PDF text extraction pipeline.

    Priority:
      1. pdfplumber (best for table-structured lab reports)
      2. PyMuPDF   (best layout preservation)
      3. pdftotext (CLI, layout mode)
      4. pypdf      (pure-Python fallback)
      5. If all yield sparse text → scanned PDF → OCR via PyMuPDF render

    Returns (text, method_used).
    GDPR: pdf_bytes never written to permanent storage.
    """
    # ── Native text extraction chain ─────────────────────────────────────────
    for extractor in [
        _extract_text_pdfplumber,
        _extract_text_pymupdf,
        _extract_text_pdftotext,
        _extract_text_pypdf,
    ]:
        text, method = extractor(pdf_bytes)
        if text:
            return text, method

    # ── Scanned / image-based PDF → OCR ──────────────────────────────────────
    logger.info("PDF: no native text found — attempting OCR (scanned PDF)")
    pages = _render_pdf_for_ocr(pdf_bytes)
    if not pages:
        return "", "none"

    page_texts: list[str] = []
    for img in pages:
        processed = _preprocess_for_ocr(img)
        page_texts.append(_ocr_image(processed))

    ocr_text = "\n".join(t for t in page_texts if t).strip()
    if _is_meaningful_text(ocr_text):
        logger.info("PDF extraction: OCR succeeded (%d chars, %d pages)", len(ocr_text), len(pages))
        return ocr_text, "ocr_pymupdf"

    return "", "none"


def extract_text_from_image(img_bytes: bytes, mime: str) -> tuple[str, str]:
    """
    Extract text from an uploaded image file via OCR with preprocessing.
    Returns (text, method).
    GDPR: image bytes handled only in memory.
    """
    try:
        from PIL import Image

        img = Image.open(io.BytesIO(img_bytes))
        processed = _preprocess_for_ocr(img)
        text = _ocr_image(processed)
        if text:
            logger.info("Image OCR: %d chars extracted", len(text))
            return text, "tesseract_preprocessed"
    except ImportError:
        logger.debug("PIL not available — OCR skipped")
    except Exception as exc:
        logger.debug("Image OCR failed: %s", type(exc).__name__)

    return "", "none"


# =============================================================================
# DATE EXTRACTION
# =============================================================================

def _extract_date(text: str) -> Optional[str]:
    """Return first plausible report date as YYYY-MM-DD, or None."""
    label_re = re.compile(
        r"(?:data\s+(?:prelievo|accettazione|referto|esame|campione)|"
        r"date\s+of\s+(?:collection|report)|data\s*:).{0,60}",
        re.I | re.S,
    )
    search_zones = [m.group(0) for m in label_re.finditer(text)] + [text]

    for zone in search_zones:
        for m in DATE_PATTERN.finditer(zone):
            g = m.groups()
            try:
                if g[0]:      # ISO yyyy-mm-dd
                    y, mo, d = int(g[0]), int(g[1]), int(g[2])
                elif g[3]:    # dd/mm/yyyy
                    d, mo, y = int(g[3]), int(g[4]), int(g[5])
                elif g[6]:    # Italian long: 15 marzo 2024
                    d  = int(g[6])
                    mo = _MONTH_IT.get(g[7].lower()[:3], 0)
                    y  = int(g[8])
                else:
                    continue
                if 2000 <= y <= 2100 and 1 <= mo <= 12 and 1 <= d <= 31:
                    return f"{y:04d}-{mo:02d}-{d:02d}"
            except (ValueError, IndexError):
                continue
    return None


# =============================================================================
# IMPROVED VALUE EXTRACTION
# =============================================================================

def _get_line_window(text: str, match_end: int, extra_lines: int = 1) -> str:
    """
    Return the text from match_end to the end of the current line,
    optionally including `extra_lines` following lines.
    This prevents cross-line contamination (next test's values bleeding in).
    """
    # Find end of current line
    eol = text.find("\n", match_end)
    if eol < 0:
        eol = len(text)

    if extra_lines <= 0:
        return text[match_end:eol]

    # Include one extra line for multi-line report formats
    eol2 = text.find("\n", eol + 1)
    if eol2 < 0:
        eol2 = len(text)
    return text[match_end : eol2]


def _find_ref_range_start(window: str) -> int:
    """
    Detect where a reference range begins in the extraction window.
    Returns the start position, or len(window) if not found
    (so callers can slice window[:pos] safely).
    """
    m = _REF_RANGE_START_RE.search(window[:250])
    return m.start() if m else len(window)


def _normalise_decimal(s: str) -> str:
    """Convert Italian decimal comma to dot: '12,5' → '12.5'."""
    return re.sub(r"(\d),(\d)", r"\1.\2", s)


def _find_percentage(text_norm: str) -> Optional[float]:
    """
    Extract a percentage value from normalised text.
    Returns the float value (e.g. 62.0) or None.
    """
    m = _PERCENTAGE_RE.search(text_norm[:200])
    if m:
        try:
            return float(m.group(1).replace(",", "."))
        except ValueError:
            pass
    return None


def _normalise_lab_unit(
    value: float,
    raw_unit: Optional[str],
    test_key: str,
) -> tuple[float, str, bool]:
    """
    Convert a lab value to its canonical unit using UNIT_NORMALISATIONS.

    Returns: (normalised_value, canonical_unit, unit_uncertain)
      - normalised_value: value in canonical unit
      - canonical_unit:   the standard unit string for this test
      - unit_uncertain:   True when the unit was absent or unrecognised
                          (caller should flag for manual review)

    If test_key has no normalisation rules, the value is returned unchanged.
    If value is None, the tuple (None, raw_unit, False) is returned immediately.
    """
    if value is None:
        return value, raw_unit, False

    rules = UNIT_NORMALISATIONS.get(test_key)
    if not rules:
        return value, raw_unit, False   # test not in normalisation table

    if not raw_unit:
        # Unit completely missing — cannot normalise safely; flag for review
        return value, raw_unit, True

    for pattern, canonical_unit, factor in rules:
        if pattern.search(raw_unit):
            if factor == 1.0:
                norm_value = value                   # unit rename only
            else:
                norm_value = round(value * factor, 6)
            return norm_value, canonical_unit, False

    # Unit extracted but not in any known pattern for this test
    logger.debug(
        "Unit normalisation: unrecognised unit %r for test_key=%r — flagging uncertain",
        raw_unit, test_key,
    )
    return value, raw_unit, True


def _extract_differential_count(
    window: str,
    test_key: str,
) -> tuple[Optional[float], Optional[str], str, Optional[float]]:
    """
    Extract a CBC differential count, strictly prioritising absolute counts
    over percentages.

    Strategy (in order):
      1. Find a number directly followed by an absolute count unit
         (x10^9/L, /µL, K/µL …) — this is the primary clinical value.
      2. If no absolute unit found, find any non-percentage numeric value
         (unit lookup in wider window).
      3. Always scan for a percentage as a secondary annotation.
      4. If only a percentage exists, return (None, None, LOW, pct) so the
         caller can skip saving the item (percentage is never the primary value).

    Returns: (abs_value, unit, confidence, pct_or_None)

    GDPR: no text content logged — only structural counts.
    """
    window = re.sub(r"^[\s:=→\-|]+", "", window)

    # ── Exclude reference range from value search zone ────────────────────────
    ref_start      = _find_ref_range_start(window)
    value_zone     = window[:ref_start]
    value_zone_norm = _normalise_decimal(value_zone)

    # ── Always scan for a percentage in the value zone ────────────────────────
    pct = _find_percentage(value_zone_norm)

    # ── 1. Number + absolute count unit (highest priority) ───────────────────
    abs_match = _ABS_COUNT_WITH_UNIT_RE.search(value_zone_norm[:200])
    if abs_match:
        raw_num  = abs_match.group(1).replace(",", ".").replace(" ", "")
        num_str  = re.sub(r"^[<>≤≥]\s*", "", raw_num)
        try:
            abs_value = float(num_str)
            abs_unit  = abs_match.group(2)
            bounds    = PLAUSIBILITY_BOUNDS.get(test_key)
            if bounds and not (bounds[0] <= abs_value <= bounds[1]):
                return abs_value, abs_unit, LOW, pct
            return abs_value, abs_unit, HIGH, pct
        except ValueError:
            pass

    # ── 2. Non-percentage numeric fallback (no explicit abs unit) ────────────
    # Look for a number that is NOT immediately followed by '%'
    non_pct_re = re.compile(
        r"(?<![/:\w%])"
        r"([<>≤≥]?\s*\d+(?:[.,]\d+)?)"
        r"(?!\s*%)"            # not a percentage
        r"(?!\s*[:/\d])",      # not part of a date or fraction
    )
    m = non_pct_re.search(value_zone_norm[:80])
    if m:
        raw_num = m.group(1).replace(",", ".").replace(" ", "")
        num_str = re.sub(r"^[<>≤≥]\s*", "", raw_num)
        try:
            value      = float(num_str)
            unit_match = UNIT_PATTERN.search(_normalise_decimal(window[:180]))
            unit       = unit_match.group(0) if unit_match else None
            bounds     = PLAUSIBILITY_BOUNDS.get(test_key)
            if bounds and not (bounds[0] <= value <= bounds[1]):
                return value, unit, LOW, pct
            return value, unit, (HIGH if unit else MEDIUM), pct
        except ValueError:
            pass

    # ── 3. Only percentage found — signal caller to skip ────────────────────
    return None, None, LOW, pct


# Numbers that could be patient values: optional comparator + digits
_PATIENT_VALUE_RE = re.compile(
    r"(?<![/:\w])"                   # not preceded by slash / colon / word-char
    r"([<>≤≥]?\s*\d+(?:[.,]\d+)?)"  # optional comparator + number (int or decimal)
    r"(?!\s*[:/\d])"                 # not followed by colon/slash/digit (avoids dates)
)


def _extract_numeric_and_unit(
    window: str,
    test_key: str = "",
) -> tuple[Optional[float], Optional[str], str]:
    """
    Extract patient value and unit from a post-match window.

    Key improvements over the old version:
    - Detects reference range start → truncates window before it
    - Handles decimal comma ('12,5')
    - Validates against physiological plausibility bounds
    - Returns HIGH/MEDIUM/LOW confidence
    """
    # Strip leading separators
    window = re.sub(r"^[\s:=→\-|]+", "", window)

    # ── 1. Find and exclude reference range ──────────────────────────────────
    ref_start = _find_ref_range_start(window)
    value_zone = window[:ref_start]   # only search BEFORE the ref range

    # If value zone is very short and there's clearly nothing useful, use a bit more
    if len(value_zone.strip()) < 2 and ref_start > 0:
        value_zone = window[:min(ref_start + 40, len(window))]

    # ── 2. Normalise decimal comma ────────────────────────────────────────────
    value_zone_norm = _normalise_decimal(value_zone[:80])

    # ── 3. Extract numeric value ─────────────────────────────────────────────
    num_match = _PATIENT_VALUE_RE.search(value_zone_norm)
    if not num_match:
        return None, None, LOW

    raw_num = num_match.group(1).replace(",", ".").replace(" ", "")
    num_str = re.sub(r"^[<>≤≥]\s*", "", raw_num)
    try:
        value = float(num_str)
    except ValueError:
        return None, None, LOW

    # ── 4. Extract unit (slightly wider window including ref range zone) ──────
    unit_window = _normalise_decimal(window[:180])
    unit_match = UNIT_PATTERN.search(unit_window)
    unit = unit_match.group(0) if unit_match else None

    # ── 5. Plausibility check ─────────────────────────────────────────────────
    bounds = PLAUSIBILITY_BOUNDS.get(test_key)
    if bounds:
        lo, hi = bounds
        if not (lo <= value <= hi):
            logger.debug(
                "Plausibility fail: %s = %s (expected %.1f–%.1f) → LOW",
                test_key, value, lo, hi,
            )
            return value, unit, LOW

    confidence = HIGH if unit else MEDIUM
    return value, unit, confidence


def _extract_qualitative(window: str) -> tuple[Optional[str], str]:
    """Extract a qualitative result from the window (same-line preferred)."""
    check = window[:150]
    if QUAL_NEGATIVE.search(check):
        return "negative", HIGH
    if QUAL_BORDERLINE.search(check):
        return "borderline", HIGH
    if QUAL_POSITIVE.search(check):
        return "positive", HIGH
    return None, LOW


def _extract_titer(window: str) -> tuple[Optional[str], Optional[float], str]:
    """Extract ANA titer (e.g. '1:160', '1/320') from window."""
    titer_re = re.compile(r"1\s*[:/ ]\s*(\d+)", re.I)
    m = titer_re.search(window[:150])
    if m:
        denom = int(m.group(1))
        return f"1:{denom}", None, HIGH
    qual, conf = _extract_qualitative(window)
    return qual, None, conf


def _extract_ref_range(window: str) -> Optional[str]:
    """Extract the reference range from the window."""
    patterns = [
        # [4.0-10.0]  [<5.0]
        re.compile(r"\[\s*([^\]]{1,40})\s*\]"),
        # (vn <5.0)  (v.r. 4-10)  (rif. <5)
        re.compile(r"\(\s*(?:vn|v\.n\.|v\.r\.|rif\.?|ref\.?|range)\s*([^)]{1,40})\s*\)", re.I),
        # vn <5.0   vn: 5-10   (without parentheses) — stops after first number or range
        re.compile(r"\bv\.?n\.?\s*:?\s*([<>]?[\d.,]+(?:\s*[-–]\s*[\d.,]+)?)", re.I),
        # v.r.: 4.0-10.0
        re.compile(r"v(?:alori?\s+)?(?:normali?\s+)?(?:di\s+)?rif[a-z.]*[.:]?\s*([^\n,]{1,40})", re.I),
        # rif: 4.0
        re.compile(r"rif(?:erimento)?[.:]?\s*([^\n,]{1,40})", re.I),
        # range: 4.0
        re.compile(r"range\s*[:=]?\s*([^\n,]{1,40})", re.I),
    ]
    for pat in patterns:
        m = pat.search(window[:250])
        if m:
            val = m.group(1).strip()
            # Sanity: must contain a digit or comparator
            if re.search(r"[\d<>]", val):
                return val
    return None


def _extract_abnormal_flag(line: str) -> Optional[str]:
    """
    Extract abnormal flag from the LINE of text containing the test result.
    Restrict to same line to avoid cross-test contamination.
    """
    eol = line.find("\n")
    check = line[:eol] if eol >= 0 else line[:200]
    if ABNORMAL_HIGH.search(check):
        return "H"
    if ABNORMAL_LOW.search(check):
        return "L"
    return None


# =============================================================================
# MAIN PARSER
# =============================================================================

def parse_lab_text(text: str) -> dict:
    """
    Apply all LAB_RULES to the extracted text with improved, line-aware logic.

    Returns:
      {
        "date": "YYYY-MM-DD" | null,
        "items": [
          {
            "panel", "test_key", "value", "qualitative", "unit",
            "ref_range", "abnormal_flag", "source_snippet", "confidence",
          }, ...
        ],
        "raw_notes": str,
      }

    GDPR: no text content is logged; only structural counts.
    """
    date  = _extract_date(text)
    items: list[dict] = []
    seen:  set[str]   = set()   # panel__test_key dedup

    for (panel, test_key, name_pat, val_type) in LAB_RULES:
        key = f"{panel}__{test_key}"
        if key in seen:
            continue

        pattern = re.compile(name_pat, re.IGNORECASE | re.UNICODE)

        for m in pattern.finditer(text):
            span_end = m.end()

            # ── Line-aware windows ────────────────────────────────────────────
            # window_line: current line only — used for ref range, abnormal
            #   flag, and qualitative/titer results (no cross-test bleeding).
            # window_full: current line + next line — used only for numeric
            #   value/unit extraction, handles multi-line lab report formats.
            window_line = _get_line_window(text, span_end, extra_lines=0)
            window_full = _get_line_window(text, span_end, extra_lines=1) if val_type == "numeric" else window_line

            # ── Source snippet for UI display (never logged) ──────────────────
            source_start  = max(0, m.start() - 10)
            source_snippet = text[source_start: span_end + 80].replace("\n", " ")[:120]

            value:          Optional[float] = None
            qualitative:    Optional[str]   = None
            unit:           Optional[str]   = None
            confidence:     str             = LOW
            pct:            Optional[float] = None   # secondary % (differentials only)
            original_value: Optional[float] = None   # pre-normalisation value
            original_unit:  Optional[str]   = None   # pre-normalisation unit
            unit_uncertain: bool            = False   # True → flag for manual review

            if val_type == "numeric":
                if test_key in CBC_DIFFERENTIAL_KEYS:
                    # Differential: prioritise absolute count, capture percentage separately
                    value, unit, confidence, pct = _extract_differential_count(window_full, test_key)
                    if value is None:
                        # Only percentage found (or nothing) — skip: pct cannot replace abs count
                        continue
                else:
                    value, unit, confidence = _extract_numeric_and_unit(window_full, test_key)
                    if value is None:
                        continue   # no numeric value on this line — skip

                # ── Unit normalisation ────────────────────────────────────────
                # Preserve raw extraction as original, then convert to canonical.
                original_value = value
                original_unit  = unit
                value, unit, unit_uncertain = _normalise_lab_unit(value, unit, test_key)

            elif val_type == "qualitative":
                qualitative, confidence = _extract_qualitative(window_line)
                if qualitative is None:
                    continue

            elif val_type == "titer":
                qualitative, value, confidence = _extract_titer(window_line)
                if qualitative is None and value is None:
                    continue

            ref_range     = _extract_ref_range(window_line)
            abnormal_flag = _extract_abnormal_flag(window_line)

            items.append({
                "panel":          panel,
                "test_key":       test_key,
                "value":          value,
                "qualitative":    qualitative,
                "unit":           unit,
                "ref_range":      ref_range,
                "abnormal_flag":  abnormal_flag,
                "source_snippet": source_snippet,
                "confidence":     confidence,
                "pct":            pct,            # secondary % (CBC differentials only)
                "original_value": original_value, # pre-normalisation (None if no conversion needed)
                "original_unit":  original_unit,  # pre-normalisation unit string
                "unit_uncertain": unit_uncertain, # True → unit not recognised, manual review needed
            })
            seen.add(key)
            break   # first match per test_key

    # ── Quality metrics log (no PII) ─────────────────────────────────────────
    n_high = sum(1 for i in items if i["confidence"] == HIGH)
    n_med  = sum(1 for i in items if i["confidence"] == MEDIUM)
    n_low  = sum(1 for i in items if i["confidence"] == LOW)
    logger.info(
        "Lab rule-parse complete: total=%d high=%d medium=%d low=%d",
        len(items), n_high, n_med, n_low,
    )

    # ── Build raw_notes from abnormal values ─────────────────────────────────
    abnormal = [i for i in items if i["abnormal_flag"]]
    raw_notes = ""
    if abnormal:
        parts = []
        for it in abnormal[:8]:
            flag_word = "elevato" if it["abnormal_flag"] == "H" else "ridotto"
            val_str   = str(it["value"]) if it["value"] is not None else (it["qualitative"] or "?")
            parts.append(f"{it['test_key'].upper()} {flag_word} ({val_str} {it['unit'] or ''})")
        raw_notes = "Valori fuori range: " + "; ".join(parts)

    return {"date": date, "items": items, "raw_notes": raw_notes}


# =============================================================================
# PANEL MAPPING
# =============================================================================

def items_to_panels(items: list[dict]) -> tuple[dict, dict, list]:
    """
    Convert flat item list to nested panel structure for the frontend.

    Returns (panels, confidence_map, unmatched)
      panels:         {panel: {test_key: {value, qualitative, unit}}}
      confidence_map: {"panel__test_key": "high"|"medium"|"low"}
    """
    panels:         dict = {}
    confidence_map: dict = {}
    unmatched:      list = []

    for item in items:
        panel    = item["panel"]
        test_key = item["test_key"]
        key      = f"{panel}__{test_key}"

        panels.setdefault(panel, {})[test_key] = {
            "value":          item["value"],
            "qualitative":    item["qualitative"],
            "unit":           item["unit"] or "",
            "pct":            item.get("pct"),            # secondary % (CBC differentials only)
            "original_value": item.get("original_value"), # pre-normalisation value (if converted)
            "original_unit":  item.get("original_unit"),  # pre-normalisation unit
            "unit_uncertain": item.get("unit_uncertain", False),  # flag for manual review
        }
        confidence_map[key] = item["confidence"]

    return panels, confidence_map, unmatched


# =============================================================================
# AI FALLBACK GATE
# =============================================================================

def needs_ai_fallback(local_result: dict, min_items: int = 2) -> bool:
    """
    Return True if the local parse result warrants an AI fallback attempt.

    Triggers when:
      - Fewer than min_items values extracted, OR
      - More than half of extracted values are LOW confidence
    """
    items = local_result.get("items", [])
    if len(items) < min_items:
        return True
    low_count = sum(1 for i in items if i["confidence"] == LOW)
    return low_count > len(items) / 2


# =============================================================================
# CONVENIENCE WRAPPERS (public API)
# =============================================================================

def parse_pdf(pdf_bytes: bytes) -> dict:
    """Full local pipeline for a PDF file."""
    text, method = extract_text_from_pdf(pdf_bytes)
    if not text.strip():
        return {
            "date": None, "panels": {}, "confidence_map": {},
            "raw_notes": "", "unmatched_keys": [],
            "extraction_method": method, "items": [],
        }
    result = parse_lab_text(text)
    panels, confidence_map, unmatched = items_to_panels(result["items"])
    return {
        "date":              result["date"],
        "panels":            panels,
        "confidence_map":    confidence_map,
        "raw_notes":         result["raw_notes"],
        "unmatched_keys":    unmatched,
        "extraction_method": f"local/{method}",
        "items":             result["items"],
    }


def parse_image(img_bytes: bytes, mime: str) -> dict:
    """Full local pipeline for an image file."""
    text, method = extract_text_from_image(img_bytes, mime)
    if not text.strip():
        return {
            "date": None, "panels": {}, "confidence_map": {},
            "raw_notes": "", "unmatched_keys": [],
            "extraction_method": method, "items": [],
        }
    result = parse_lab_text(text)
    panels, confidence_map, unmatched = items_to_panels(result["items"])
    return {
        "date":              result["date"],
        "panels":            panels,
        "confidence_map":    confidence_map,
        "raw_notes":         result["raw_notes"],
        "unmatched_keys":    unmatched,
        "extraction_method": f"local/{method}",
        "items":             result["items"],
    }
