import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from routers.clinical_events import _clinical_event_sig


class TestClinicalEventSigFix1:
    def test_diagnosis_ocr_variante_2_stessa_sig(self):
        e1 = {
            "event_type": "diagnosis",
            "date_value": "2000-01-01",
            "date_precision": "year",
            "detail": "artrite sieronegativa2 posta nel 2000",
        }
        e2 = {
            "event_type": "diagnosis",
            "date_value": "2000-01-01",
            "date_precision": "year",
            "detail": "artrite sieronegativa\u00bf posta nel 2000",
        }
        assert _clinical_event_sig(e1) == _clinical_event_sig(e2)

    def test_disease_status_ocr_variante_stessa_sig(self):
        e1 = {
            "event_type": "disease_status",
            "date_value": "2022-06-15",
            "detail": "buon controllo\u00bf di malattia",
        }
        e2 = {
            "event_type": "disease_status",
            "date_value": "2022-06-15",
            "detail": "buon controllo2 di malattia",
        }
        assert _clinical_event_sig(e1) == _clinical_event_sig(e2)

    def test_diagnosis_anni_diversi_sig_diverse(self):
        e1 = {
            "event_type": "diagnosis",
            "date_value": "2000",
            "date_precision": "year",
            "detail": "artrite reumatoide",
        }
        e2 = {
            "event_type": "diagnosis",
            "date_value": "2005",
            "date_precision": "year",
            "detail": "artrite reumatoide",
        }
        assert _clinical_event_sig(e1) != _clinical_event_sig(e2)

    def test_therapy_start_usa_ancora_il_testo(self):
        e1 = {
            "event_type": "therapy_start",
            "date_value": "2022-01-01",
            "drug_canonical": "adalimumab",
            "detail": "40 mg sc ogni due settimane",
        }
        e2 = {
            "event_type": "therapy_start",
            "date_value": "2022-01-01",
            "drug_canonical": "adalimumab",
            "detail": "testo completamente diverso",
        }
        assert _clinical_event_sig(e1) != _clinical_event_sig(e2)

    def test_disease_onset_usa_ancora_il_testo(self):
        e1 = {
            "event_type": "disease_onset",
            "date_value": "2020-01-01",
            "detail": "artrite alle mani",
        }
        e2 = {
            "event_type": "disease_onset",
            "date_value": "2020-01-01",
            "detail": "artrite ai piedi",
        }
        assert _clinical_event_sig(e1) != _clinical_event_sig(e2)

    def test_diagnosis_senza_data_stessa_sig(self):
        e1 = {"event_type": "diagnosis", "date_value": None, "detail": "artrite A"}
        e2 = {"event_type": "diagnosis", "date_value": None, "detail": "artrite B"}
        assert _clinical_event_sig(e1) == _clinical_event_sig(e2)

    def test_disease_status_diverso_anno_sig_diverse(self):
        e1 = {
            "event_type": "disease_status",
            "date_value": "2021-01-01",
            "detail": "remissione",
        }
        e2 = {
            "event_type": "disease_status",
            "date_value": "2023-01-01",
            "detail": "remissione",
        }
        assert _clinical_event_sig(e1) != _clinical_event_sig(e2)
