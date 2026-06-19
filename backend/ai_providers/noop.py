from __future__ import annotations

from .base import LLMProvider


class NoopProvider(LLMProvider):
    """
    Provider nullo: implementa tutta l'interfaccia LLMProvider senza effetti
    collaterali e senza chiamate esterne. Usato come default sicuro quando
    nessun provider AI è configurato.

    Tutti i metodi asincroni ritornano strutture vuote coerenti con il contratto
    dell'interfaccia. Nessun metodo solleva eccezioni sugli input.
    """

    async def extract_text_from_image(self, image_bytes: bytes, mime: str) -> str:
        return ""

    async def extract_text_from_pdf_page(self, page_image_bytes: bytes) -> str:
        return ""

    async def extract_structured_from_text(
        self, text: str, task_type: str, schema: dict
    ) -> dict:
        return {}

    async def parse_raccordo_text(self, text: str) -> dict:
        return {"events": [], "_provider": "noop"}

    async def parse_therapy_text(self, text: str) -> dict:
        return {"therapies": [], "_provider": "noop"}

    async def parse_visit_text(self, text: str) -> dict:
        return {"visit_sections": {}, "_provider": "noop"}

    def supports_vision(self) -> bool:
        return False

    def supports_text_understanding(self) -> bool:
        return False

    def provider_name(self) -> str:
        return "noop"
