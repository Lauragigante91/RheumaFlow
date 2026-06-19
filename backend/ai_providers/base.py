from __future__ import annotations

from abc import ABC, abstractmethod


class LLMProvider(ABC):

    @abstractmethod
    async def extract_text_from_image(self, image_bytes: bytes, mime: str) -> str:
        """Estrae testo leggibile da un'immagine (JPEG/PNG/WebP)."""

    @abstractmethod
    async def extract_text_from_pdf_page(self, page_image_bytes: bytes) -> str:
        """Estrae testo da una singola pagina PDF renderizzata come immagine."""

    @abstractmethod
    async def extract_structured_from_text(
        self, text: str, task_type: str, schema: dict
    ) -> dict:
        """
        Estrae struttura da testo libero già disponibile.

        task_type: una delle costanti TASK_* definite in ai_providers/__init__.py
        schema:    dict che descrive i campi attesi nell'output (usato dai provider reali
                   per costruire il prompt; ignorato da NoopProvider)

        Ritorna dict con i campi estratti, oppure {} se il provider non supporta il task.
        Non scrive mai nel DB. Non accetta patient_id.
        """

    @abstractmethod
    async def parse_raccordo_text(self, text: str) -> dict:
        """
        Estrae eventi clinici dal testo del raccordo anamnestico.
        Ritorna {"events": [...], "_provider": str}.
        """

    @abstractmethod
    async def parse_therapy_text(self, text: str) -> dict:
        """
        Estrae terapie strutturate dal testo.
        Ritorna {"therapies": [...], "_provider": str}.
        """

    @abstractmethod
    async def parse_visit_text(self, text: str) -> dict:
        """
        Estrae sezioni strutturate dal testo di una visita.
        Ritorna {"visit_sections": {...}, "_provider": str}.
        """

    def supports_vision(self) -> bool:
        return False

    def supports_text_understanding(self) -> bool:
        return False

    def provider_name(self) -> str:
        return "unknown"
