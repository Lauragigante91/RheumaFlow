import os
import pytest

from ai_providers import (
    LLMProvider,
    NoopProvider,
    get_provider,
    TASK_RACCORDO,
    TASK_THERAPY,
    TASK_VISIT,
    TASK_LAB,
    TASK_EXAM_OBJ,
    TASK_CLINIMETRY,
)


# =============================================================================
# Factory — risoluzione provider
# =============================================================================

class TestGetProvider:
    def test_default_senza_env_e_senza_settings(self, monkeypatch):
        monkeypatch.delenv("AI_PROVIDER", raising=False)
        provider = get_provider()
        assert isinstance(provider, NoopProvider)

    def test_env_noop_esplicito(self, monkeypatch):
        monkeypatch.setenv("AI_PROVIDER", "noop")
        provider = get_provider()
        assert isinstance(provider, NoopProvider)

    def test_env_stringa_vuota_ritorna_noop(self, monkeypatch):
        monkeypatch.setenv("AI_PROVIDER", "")
        provider = get_provider()
        assert isinstance(provider, NoopProvider)

    def test_provider_sconosciuto_solleva_value_error(self, monkeypatch):
        monkeypatch.setenv("AI_PROVIDER", "chatgpt")
        with pytest.raises(ValueError, match="non riconosciuto"):
            get_provider()

    def test_settings_org_ha_priorita_su_env(self, monkeypatch):
        monkeypatch.setenv("AI_PROVIDER", "invalido_che_farebbe_raise")
        provider = get_provider(settings={"ai_provider": "noop"})
        assert isinstance(provider, NoopProvider)

    def test_settings_org_none_ricade_su_env_noop(self, monkeypatch):
        monkeypatch.setenv("AI_PROVIDER", "noop")
        provider = get_provider(settings={"ai_provider": None})
        assert isinstance(provider, NoopProvider)

    def test_settings_org_stringa_vuota_ricade_su_env(self, monkeypatch):
        monkeypatch.setenv("AI_PROVIDER", "noop")
        provider = get_provider(settings={"ai_provider": ""})
        assert isinstance(provider, NoopProvider)

    def test_settings_org_assenti_ricade_su_env(self, monkeypatch):
        monkeypatch.setenv("AI_PROVIDER", "noop")
        provider = get_provider(settings={})
        assert isinstance(provider, NoopProvider)

    def test_get_provider_senza_argomenti_non_solleva(self, monkeypatch):
        monkeypatch.delenv("AI_PROVIDER", raising=False)
        provider = get_provider()
        assert provider is not None

    def test_ogni_chiamata_ritorna_nuova_istanza(self, monkeypatch):
        monkeypatch.delenv("AI_PROVIDER", raising=False)
        p1 = get_provider()
        p2 = get_provider()
        assert p1 is not p2


# =============================================================================
# Contratto interfaccia — NoopProvider implementa LLMProvider completamente
# =============================================================================

class TestInterfaceContract:
    def test_noop_e_istanza_di_llmprovider(self):
        assert isinstance(NoopProvider(), LLMProvider)

    def test_noop_non_ha_metodi_astratti_residui(self):
        abstract = getattr(NoopProvider, "__abstractmethods__", frozenset())
        assert len(abstract) == 0, f"Metodi astratti non implementati: {abstract}"

    def test_noop_istanziabile_senza_argomenti(self):
        provider = NoopProvider()
        assert provider is not None

    def test_llmprovider_non_e_istanziabile_direttamente(self):
        with pytest.raises(TypeError):
            LLMProvider()


# =============================================================================
# NoopProvider — extract_text_from_image
# =============================================================================

class TestNoopExtractTextFromImage:
    @pytest.mark.asyncio
    async def test_ritorna_stringa_vuota(self):
        p = NoopProvider()
        result = await p.extract_text_from_image(b"fakebytes", "image/jpeg")
        assert result == ""

    @pytest.mark.asyncio
    async def test_bytes_vuoti_non_sollevano_eccezioni(self):
        p = NoopProvider()
        result = await p.extract_text_from_image(b"", "image/png")
        assert result == ""

    @pytest.mark.asyncio
    async def test_mime_sconosciuto_non_solleva(self):
        p = NoopProvider()
        result = await p.extract_text_from_image(b"\xff\xd8\xff", "image/tiff")
        assert isinstance(result, str)

    @pytest.mark.asyncio
    async def test_ritorna_stringa_non_none(self):
        p = NoopProvider()
        result = await p.extract_text_from_image(b"x", "image/webp")
        assert result is not None


# =============================================================================
# NoopProvider — extract_text_from_pdf_page
# =============================================================================

class TestNoopExtractTextFromPdfPage:
    @pytest.mark.asyncio
    async def test_ritorna_stringa_vuota(self):
        p = NoopProvider()
        result = await p.extract_text_from_pdf_page(b"fakepdfpage")
        assert result == ""

    @pytest.mark.asyncio
    async def test_bytes_vuoti_non_sollevano(self):
        p = NoopProvider()
        result = await p.extract_text_from_pdf_page(b"")
        assert result == ""

    @pytest.mark.asyncio
    async def test_ritorna_stringa_non_none(self):
        p = NoopProvider()
        result = await p.extract_text_from_pdf_page(b"\x00\x01\x02")
        assert result is not None


# =============================================================================
# NoopProvider — extract_structured_from_text
# =============================================================================

class TestNoopExtractStructuredFromText:
    @pytest.mark.asyncio
    async def test_ritorna_dict_vuoto(self):
        p = NoopProvider()
        result = await p.extract_structured_from_text("testo clinico", TASK_RACCORDO, {})
        assert result == {}

    @pytest.mark.asyncio
    async def test_tutti_i_task_type_ritornano_dict_vuoto(self):
        p = NoopProvider()
        for task in [TASK_RACCORDO, TASK_THERAPY, TASK_VISIT, TASK_LAB, TASK_EXAM_OBJ, TASK_CLINIMETRY]:
            result = await p.extract_structured_from_text("testo", task, {})
            assert result == {}, f"task_type={task!r} non ha ritornato dict vuoto"

    @pytest.mark.asyncio
    async def test_schema_complesso_non_solleva(self):
        p = NoopProvider()
        schema = {"events": [{"type": "str", "date": "str", "drug": "str"}]}
        result = await p.extract_structured_from_text("...", TASK_RACCORDO, schema)
        assert isinstance(result, dict)

    @pytest.mark.asyncio
    async def test_testo_vuoto_non_solleva(self):
        p = NoopProvider()
        result = await p.extract_structured_from_text("", TASK_LAB, {})
        assert result == {}

    @pytest.mark.asyncio
    async def test_task_sconosciuto_non_solleva(self):
        p = NoopProvider()
        result = await p.extract_structured_from_text("testo", "task_futuro_ignoto", {})
        assert isinstance(result, dict)


# =============================================================================
# NoopProvider — parse_raccordo_text
# =============================================================================

class TestNoopParseRaccordoText:
    @pytest.mark.asyncio
    async def test_ritorna_events_lista_vuota(self):
        p = NoopProvider()
        result = await p.parse_raccordo_text("In terapia con MTX dal 2020, sospeso 2022.")
        assert "events" in result
        assert result["events"] == []

    @pytest.mark.asyncio
    async def test_provider_tag_e_noop(self):
        p = NoopProvider()
        result = await p.parse_raccordo_text("qualsiasi testo")
        assert result["_provider"] == "noop"

    @pytest.mark.asyncio
    async def test_testo_vuoto_non_solleva(self):
        p = NoopProvider()
        result = await p.parse_raccordo_text("")
        assert result["events"] == []

    @pytest.mark.asyncio
    async def test_testo_lungo_non_solleva(self):
        p = NoopProvider()
        result = await p.parse_raccordo_text("testo " * 5000)
        assert isinstance(result, dict)

    @pytest.mark.asyncio
    async def test_struttura_output_completa(self):
        p = NoopProvider()
        result = await p.parse_raccordo_text("testo")
        assert set(result.keys()) >= {"events", "_provider"}


# =============================================================================
# NoopProvider — parse_therapy_text
# =============================================================================

class TestNoopParseTherapyText:
    @pytest.mark.asyncio
    async def test_ritorna_therapies_lista_vuota(self):
        p = NoopProvider()
        result = await p.parse_therapy_text("Adalimumab 40 mg sc ogni 2 settimane")
        assert "therapies" in result
        assert result["therapies"] == []

    @pytest.mark.asyncio
    async def test_provider_tag_e_noop(self):
        p = NoopProvider()
        result = await p.parse_therapy_text("MTX 15 mg/settimana")
        assert result["_provider"] == "noop"

    @pytest.mark.asyncio
    async def test_testo_vuoto_non_solleva(self):
        p = NoopProvider()
        result = await p.parse_therapy_text("")
        assert result["therapies"] == []

    @pytest.mark.asyncio
    async def test_struttura_output_completa(self):
        p = NoopProvider()
        result = await p.parse_therapy_text("testo")
        assert set(result.keys()) >= {"therapies", "_provider"}


# =============================================================================
# NoopProvider — parse_visit_text
# =============================================================================

class TestNoopParseVisitText:
    @pytest.mark.asyncio
    async def test_ritorna_visit_sections_dict_vuoto(self):
        p = NoopProvider()
        result = await p.parse_visit_text("ANAMNESI: stabile. EO: ndr.")
        assert "visit_sections" in result
        assert result["visit_sections"] == {}

    @pytest.mark.asyncio
    async def test_provider_tag_e_noop(self):
        p = NoopProvider()
        result = await p.parse_visit_text("testo visita")
        assert result["_provider"] == "noop"

    @pytest.mark.asyncio
    async def test_testo_vuoto_non_solleva(self):
        p = NoopProvider()
        result = await p.parse_visit_text("")
        assert result["visit_sections"] == {}

    @pytest.mark.asyncio
    async def test_struttura_output_completa(self):
        p = NoopProvider()
        result = await p.parse_visit_text("testo")
        assert set(result.keys()) >= {"visit_sections", "_provider"}


# =============================================================================
# Capability reporting
# =============================================================================

class TestNoopCapabilities:
    def test_supports_vision_false(self):
        assert NoopProvider().supports_vision() is False

    def test_supports_text_understanding_false(self):
        assert NoopProvider().supports_text_understanding() is False

    def test_provider_name_noop(self):
        assert NoopProvider().provider_name() == "noop"

    def test_provider_name_da_factory_e_noop(self, monkeypatch):
        monkeypatch.delenv("AI_PROVIDER", raising=False)
        p = get_provider()
        assert p.provider_name() == "noop"


# =============================================================================
# Garanzie di non-scrittura nel DB (contratto strutturale)
# =============================================================================

class TestNoWriteDbContract:
    def test_nessun_metodo_accetta_patient_id(self):
        import inspect
        p = NoopProvider()
        for name in ["parse_raccordo_text", "parse_therapy_text", "parse_visit_text",
                     "extract_text_from_image", "extract_text_from_pdf_page",
                     "extract_structured_from_text"]:
            sig = inspect.signature(getattr(p, name))
            param_names = list(sig.parameters.keys())
            assert "patient_id" not in param_names, (
                f"{name} non deve accettare patient_id (scriverebbe nel DB)"
            )
            assert "db" not in param_names, (
                f"{name} non deve accettare db"
            )

    @pytest.mark.asyncio
    async def test_tutti_i_ritorni_sono_serializzabili(self):
        import json
        p = NoopProvider()
        results = [
            await p.extract_text_from_image(b"x", "image/jpeg"),
            await p.extract_text_from_pdf_page(b"x"),
            await p.extract_structured_from_text("t", TASK_RACCORDO, {}),
            await p.parse_raccordo_text("t"),
            await p.parse_therapy_text("t"),
            await p.parse_visit_text("t"),
        ]
        for r in results:
            json.dumps(r)


# =============================================================================
# Costanti TASK_*
# =============================================================================

class TestTaskConstants:
    def test_tutte_le_costanti_sono_stringhe_non_vuote(self):
        from ai_providers import (
            TASK_RACCORDO, TASK_THERAPY, TASK_VISIT,
            TASK_LAB, TASK_EXAM_OBJ, TASK_CLINIMETRY,
        )
        for val in [TASK_RACCORDO, TASK_THERAPY, TASK_VISIT,
                    TASK_LAB, TASK_EXAM_OBJ, TASK_CLINIMETRY]:
            assert isinstance(val, str) and val

    def test_costanti_distinte(self):
        from ai_providers import (
            TASK_RACCORDO, TASK_THERAPY, TASK_VISIT,
            TASK_LAB, TASK_EXAM_OBJ, TASK_CLINIMETRY,
        )
        vals = [TASK_RACCORDO, TASK_THERAPY, TASK_VISIT,
                TASK_LAB, TASK_EXAM_OBJ, TASK_CLINIMETRY]
        assert len(vals) == len(set(vals)), "Costanti TASK_* duplicate"
