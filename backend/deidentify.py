"""
GDPR De-Identification Engine
Pre-compiled PII patterns for Italian clinical documents.
Applied to visit/lab text before sending to any AI model.
The original text is NEVER stored; only the structured extracted output is persisted.
"""
import re
from typing import Optional

_RE_CF = re.compile(r'\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b', re.IGNORECASE)
_RE_EMAIL = re.compile(r'\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b')
_RE_PHONE = re.compile(
    r'(?<!\d)(\+39\s?|0039\s?)?\(?\d{2,4}\)?\s*[\-\.]?\s*\d{3,4}\s*[\-\.]?\s*\d{3,5}(?!\d)',
    re.IGNORECASE,
)
_RE_BORN = re.compile(
    r'\b(nato|nata|n\.|data\s+di\s+nascita|d\.?o\.?b\.?|nascita)'
    r'[\s/:]+(?:il\s+)?\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b',
    re.IGNORECASE,
)
_RE_HOSP_HEADER = re.compile(
    r'^(Azienda|A\.?O\.?|Ospedale|IRCCS|ASL|AOU|Policlinico|Università|Universita|Clinica|Istituto|Fondazione|Presidio).+$',
    re.MULTILINE | re.IGNORECASE,
)
_RE_PHYSICIAN_SIG = re.compile(
    r'\b(Dott\.?|Dott\.?ssa|Dr\.?|Prof\.?|Prof\.?ssa)\s+[A-ZÀÈÉÌÒÙ][a-zàèéìòù]+(?:\s+[A-ZÀÈÉÌÒÙ][a-zàèéìòù]+){0,2}\b',
)
_RE_PATIENT_CONTEXT = re.compile(
    r'\b(Paziente|Pz\.?|Sig\.?|Sig\.?ra|Signore?|Signora)[:\s]+[A-ZÀÈÉÌÒÙ][a-zàèéìòù]+(?:\s+[A-ZÀÈÉÌÒÙ][a-zàèéìòù]+){0,2}\b',
)
_RE_ADDRESS = re.compile(
    r'\b(Via|Viale|V\.?le|Corso|C\.?so|Piazza|P\.?za|Vicolo|Contrada|Strada|Str\.)\s+\S+(?:\s+\S+){0,3}[,\s]+\d{5}\b',
    re.IGNORECASE,
)
_RE_HOSP_ID = re.compile(
    r'\b(N\.?\s*ric\.?|N\.?\s*prot\.?|nosologico|NRO|N[°.]\s*paz\.?|ID\s*paz\.?)[:\s]*\d{4,12}\b',
    re.IGNORECASE,
)


def deidentify_text(
    text: str,
    patient_name: Optional[str] = None,
    patient_surname: Optional[str] = None,
) -> tuple:
    """
    Remove common Italian PII patterns from clinical text before AI processing.
    Returns (cleaned_text, list_of_masked_categories).
    Operates on a copy; the caller's original string is unchanged.
    """
    masked: list = []

    for val, label in [(patient_surname, "cognome"), (patient_name, "nome")]:
        if val and len(val) > 2:
            cleaned = re.sub(re.escape(val), "[PAZIENTE]", text, flags=re.IGNORECASE)
            if cleaned != text:
                text = cleaned
                masked.append(label)

    t = _RE_CF.sub("[CF]", text)
    if t != text:
        masked.append("codice_fiscale")
    text = t

    t = _RE_EMAIL.sub("[EMAIL]", text)
    if t != text:
        masked.append("email")
    text = t

    t = _RE_BORN.sub("[DATA_NASCITA]", text)
    if t != text:
        masked.append("data_nascita")
    text = t

    t = _RE_HOSP_HEADER.sub("[INTESTAZIONE]", text)
    if t != text:
        masked.append("intestazione_ospedaliera")
    text = t

    t = _RE_PHYSICIAN_SIG.sub("[FIRMA_MEDICO]", text)
    if t != text:
        masked.append("firma_medico")
    text = t

    t = _RE_PATIENT_CONTEXT.sub("[NOME_PAZIENTE]", text)
    if t != text:
        masked.append("nome_contestuale")
    text = t

    t = _RE_ADDRESS.sub("[INDIRIZZO]", text)
    if t != text:
        masked.append("indirizzo")
    text = t

    t = _RE_HOSP_ID.sub("[ID_OSPEDALIERO]", text)
    if t != text:
        masked.append("id_ospedaliero")
    text = t

    return text, masked
