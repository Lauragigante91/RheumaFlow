from __future__ import annotations

import os

from .base import LLMProvider
from .noop import NoopProvider

TASK_RACCORDO   = "raccordo"
TASK_THERAPY    = "therapy"
TASK_VISIT      = "visit"
TASK_LAB        = "lab"
TASK_EXAM_OBJ   = "esame_obiettivo"
TASK_CLINIMETRY = "clinimetria"

__all__ = [
    "LLMProvider",
    "NoopProvider",
    "get_provider",
    "TASK_RACCORDO",
    "TASK_THERAPY",
    "TASK_VISIT",
    "TASK_LAB",
    "TASK_EXAM_OBJ",
    "TASK_CLINIMETRY",
]


def get_provider(settings: dict | None = None) -> LLMProvider:
    """
    Costruisce e ritorna il provider AI appropriato.

    Priorità di configurazione (dalla più alta alla più bassa):
      1. settings["ai_provider"]  — configurazione per-organizzazione
      2. variabile ambiente AI_PROVIDER
      3. "noop"                   — default sicuro

    Provider supportati nella Fase A:
      "noop" (o stringa vuota / None) → NoopProvider

    Le fasi successive aggiungeranno "ollama" e "openrouter".
    Un nome non riconosciuto solleva ValueError in modo esplicito
    (fail-fast: meglio un avvio bloccato che un import silenzioso su provider sbagliato).
    """
    name = (
        (settings or {}).get("ai_provider")
        or os.getenv("AI_PROVIDER", "noop")
        or "noop"
    )
    name = name.strip().lower()

    if name in ("noop", ""):
        return NoopProvider()

    raise ValueError(
        f"Provider AI non riconosciuto: {name!r}. "
        "Provider disponibili: 'noop'. "
        "Le fasi successive aggiungeranno 'ollama' e 'openrouter'."
    )
