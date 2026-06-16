import os
import sys

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "test_exit_therapies")
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from helpers import compute_exit_therapies_text
from routers.visits import WorkupVisitBase


def ep(drug, start=None, end=None, dose=None, frequency=None, route=None,
       relevance="medium", events=None, canonical=None, status=None):
    return {
        "drug_name": drug,
        "drug_canonical": canonical or drug.lower(),
        "start_date": start,
        "end_date": end,
        "dose": dose,
        "frequency": frequency,
        "route": route,
        "relevance": relevance,
        "status": status,
        "events": events or [],
    }


def test_no_episodes_returns_empty():
    assert compute_exit_therapies_text([], "2024-06-16") == ""


def test_no_visit_date_returns_empty():
    assert compute_exit_therapies_text([ep("Metotrexato", start="2023-01-01", dose="10 mg")], "") == ""


def test_unchanged_regimen_marked_invariata_sorted_by_relevance():
    episodes = [
        ep("Metotrexato", start="2023-01-01", dose="10 mg", relevance="medium"),
        ep("Secukinumab", start="2024-01-01", dose="300 mg", relevance="high"),
    ]
    out = compute_exit_therapies_text(episodes, "2024-06-16")
    assert out == "Secukinumab 300 mg (invariata)\nMetotrexato 10 mg (invariata)"


def test_stop_at_visit_is_sospeso():
    episodes = [
        ep("Secukinumab", start="2024-01-01", dose="300 mg", relevance="high"),
        ep("Metotrexato", start="2023-01-01", end="2024-06-16", dose="10 mg", relevance="medium"),
    ]
    out = compute_exit_therapies_text(episodes, "2024-06-16")
    assert out == "Secukinumab 300 mg (invariata)\nMetotrexato sospeso"


def test_start_at_visit_is_nuovo():
    episodes = [
        ep("Secukinumab", start="2024-01-01", dose="300 mg", relevance="medium"),
        ep("Adalimumab", start="2024-06-16", dose="40 mg", relevance="high"),
    ]
    out = compute_exit_therapies_text(episodes, "2024-06-16")
    assert out == "Adalimumab 40 mg (nuovo)\nSecukinumab 300 mg (invariata)"


def test_dose_change_at_visit_is_modificata_with_new_posology():
    episodes = [
        ep(
            "Metotrexato",
            start="2023-01-01",
            dose="15 mg",
            relevance="medium",
            events=[
                {"type": "started", "date": "2023-01-01", "dose": "10 mg"},
                {"type": "dose_increased", "date": "2024-06-16", "dose_after": "15 mg"},
            ],
        ),
    ]
    out = compute_exit_therapies_text(episodes, "2024-06-16")
    assert out == "Metotrexato 15 mg (modificata)"


def test_past_therapy_ended_before_visit_is_excluded():
    episodes = [
        ep("Secukinumab", start="2024-01-01", dose="300 mg", relevance="high"),
        ep("Etanercept", start="2020-01-01", end="2022-01-01", dose="50 mg", relevance="medium"),
    ]
    out = compute_exit_therapies_text(episodes, "2024-06-16")
    assert out == "Secukinumab 300 mg (invariata)"


def test_noted_drug_without_start_is_invariata():
    episodes = [ep("Idrossiclorochina", start=None, dose="200 mg", relevance="low")]
    out = compute_exit_therapies_text(episodes, "2024-06-16")
    assert out == "Idrossiclorochina 200 mg (invariata)"


def test_same_drug_stop_and_restart_at_visit_is_deterministic_nuovo():
    episodes = [
        ep("Metotrexato", start="2024-06-16", dose="15 mg", relevance="medium",
           canonical="metotrexato", events=[{"type": "started", "date": "2024-06-16", "dose": "15 mg"}]),
        ep("Metotrexato", start="2022-01-01", end="2024-03-01", dose="10 mg", relevance="medium",
           canonical="metotrexato"),
    ]
    out_a = compute_exit_therapies_text(episodes, "2024-06-16")
    out_b = compute_exit_therapies_text(list(reversed(episodes)), "2024-06-16")
    assert out_a == out_b == "Metotrexato 15 mg (nuovo)"


def test_unbounded_historical_exposure_is_hidden():
    # Pregressa da anamnesi senza data di stop: founding event historical_exposure,
    # nessun end_date -> non deve comparire come "(invariata)" nella terapia in uscita.
    episodes = [
        ep("Secukinumab", start="2024-01-01", dose="300 mg", relevance="high"),
        ep("Golimumab", start=None, end=None, dose="50 mg", relevance="high",
           status="discontinued",
           events=[{"type": "historical_exposure", "date": "2018-01-01", "dose": "50 mg"}]),
    ]
    out = compute_exit_therapies_text(episodes, "2024-06-16")
    assert out == "Secukinumab 300 mg (invariata)"


def test_unbounded_discontinued_status_is_hidden():
    # Episodio flaggato discontinued ma senza closure date e senza evento di chiusura:
    # non asseribile come attivo -> escluso dalla terapia in uscita.
    episodes = [
        ep("Secukinumab", start="2024-01-01", dose="300 mg", relevance="high"),
        ep("Leflunomide", start="2019-01-01", end=None, dose="20 mg", relevance="high",
           status="discontinued"),
    ]
    out = compute_exit_therapies_text(episodes, "2024-06-16")
    assert out == "Secukinumab 300 mg (invariata)"


def test_discontinued_via_event_before_visit_is_gone():
    # end_date assente, ma un evento 'discontinued' anni prima della visita chiude
    # l'episodio: non deve comparire né come attivo né come "sospeso" a questa visita.
    episodes = [
        ep("Secukinumab", start="2024-01-01", dose="300 mg", relevance="high"),
        ep("Adalimumab", start="2020-01-01", end=None, dose="40 mg", relevance="high",
           status="discontinued",
           events=[
               {"type": "started", "date": "2020-01-01", "dose": "40 mg"},
               {"type": "discontinued", "date": "2022-03-01"},
           ]),
    ]
    out = compute_exit_therapies_text(episodes, "2024-06-16")
    assert out == "Secukinumab 300 mg (invariata)"


def test_discontinued_via_event_at_visit_is_sospeso():
    # end_date assente ma evento 'discontinued' alla data della visita: il farmaco era
    # attivo entrando (entry) e viene chiuso -> "sospeso".
    episodes = [
        ep("Secukinumab", start="2024-01-01", dose="300 mg", relevance="high"),
        ep("Metotrexato", start="2023-01-01", end=None, dose="10 mg", relevance="medium",
           status="discontinued",
           events=[
               {"type": "started", "date": "2023-01-01", "dose": "10 mg"},
               {"type": "discontinued", "date": "2024-06-16"},
           ]),
    ]
    out = compute_exit_therapies_text(episodes, "2024-06-16")
    assert out == "Secukinumab 300 mg (invariata)\nMetotrexato sospeso"


def test_resumed_after_discontinued_stays_active():
    # Episodio chiuso e poi riaperto (resumed_within) prima della visita: l'effective
    # end torna aperto -> resta attivo -> "(invariata)".
    episodes = [
        ep("Adalimumab", start="2020-01-01", end=None, dose="40 mg", relevance="high",
           status="active",
           events=[
               {"type": "started", "date": "2020-01-01", "dose": "40 mg"},
               {"type": "discontinued", "date": "2023-01-01"},
               {"type": "resumed_within", "date": "2023-06-01"},
           ]),
    ]
    out = compute_exit_therapies_text(episodes, "2024-06-16")
    assert out == "Adalimumab 40 mg (invariata)"


def test_discontinued_at_visit_with_later_resume_is_sospeso():
    # Sospeso ALLA data della visita con un resumed_within SUCCESSIVO: il resume
    # futuro non deve riaprire retroattivamente l'episodio alla data della visita;
    # entrando era attivo, alla visita viene chiuso -> "sospeso".
    episodes = [
        ep("Secukinumab", start="2024-01-01", dose="300 mg", relevance="high"),
        ep("Metotrexato", start="2024-01-01", end=None, dose="10 mg", relevance="medium",
           status="active",
           events=[
               {"type": "started", "date": "2024-01-01", "dose": "10 mg"},
               {"type": "discontinued", "date": "2024-06-16"},
               {"type": "resumed_within", "date": "2024-07-01"},
           ]),
    ]
    out = compute_exit_therapies_text(episodes, "2024-06-16")
    assert out == "Secukinumab 300 mg (invariata)\nMetotrexato sospeso"


def test_future_resume_does_not_reopen_earlier_dates():
    # Lo stesso episodio sospeso 16/6 e ripreso 1/7: a una visita nel mezzo (20/6)
    # il farmaco resta inattivo (il resume futuro non lo riapre); dopo il resume
    # (1/8) torna attivo come "(invariata)".
    episode = ep("Metotrexato", start="2024-01-01", end=None, dose="10 mg",
                 relevance="high", status="active",
                 events=[
                     {"type": "started", "date": "2024-01-01", "dose": "10 mg"},
                     {"type": "discontinued", "date": "2024-06-16"},
                     {"type": "resumed_within", "date": "2024-07-01"},
                 ])
    assert compute_exit_therapies_text([episode], "2024-06-20") == ""
    assert compute_exit_therapies_text([episode], "2024-08-01") == "Metotrexato 10 mg (invariata)"


def test_secukinumab_dose_increase_150_to_300_is_modificata():
    # Aumento di dose alla visita: la terapia in uscita riporta 300 mg "(modificata)".
    episodes = [
        ep("Secukinumab", start="2023-01-01", dose="300 mg", relevance="high",
           events=[
               {"type": "noted", "date": "2023-01-01", "dose": "150 mg"},
               {"type": "dose_increased", "date": "2024-06-16",
                "dose_before": "150 mg", "dose_after": "300 mg"},
           ]),
    ]
    out = compute_exit_therapies_text(episodes, "2024-06-16")
    assert out == "Secukinumab 300 mg (modificata)"


def test_pregresse_plus_dose_increase_real_world_combo():
    # Caso clinico reale: pregresse (Golimumab, Leflunomide) già sospese prima della
    # visita + Secukinumab aumentato 150->300. La terapia in uscita deve mostrare solo
    # il farmaco attivo aggiornato, senza le pregresse.
    episodes = [
        ep("Golimumab", start=None, end=None, dose="50 mg", relevance="high",
           status="discontinued",
           events=[{"type": "historical_exposure", "date": "2017-01-01", "dose": "50 mg"}]),
        ep("Leflunomide", start=None, end=None, dose="20 mg", relevance="high",
           status="discontinued",
           events=[{"type": "historical_exposure", "date": "2019-01-01", "dose": "20 mg"}]),
        ep("Secukinumab", start="2023-01-01", dose="300 mg", relevance="high",
           events=[
               {"type": "noted", "date": "2023-01-01", "dose": "150 mg"},
               {"type": "dose_increased", "date": "2024-06-16",
                "dose_before": "150 mg", "dose_after": "300 mg"},
           ]),
    ]
    out = compute_exit_therapies_text(episodes, "2024-06-16")
    assert out == "Secukinumab 300 mg (modificata)"


def test_workup_visit_base_persists_exit_therapy_text_round_trip():
    text = (
        "Prednisone 25 mg/die con scalaggio di 2,5 mg ogni 7 giorni fino a 5 mg.\n"
        "Controllo emocromo e PCR a 4 settimane. Rivalutazione clinica a 3 mesi."
    )
    m = WorkupVisitBase(patient_id="p1", visit_date="2024-06-16", exit_therapy_text=text)
    dumped = m.model_dump()
    assert "exit_therapy_text" in dumped
    assert dumped["exit_therapy_text"] == text


def test_workup_visit_base_exit_therapy_text_defaults_none():
    m = WorkupVisitBase(patient_id="p1", visit_date="2024-06-16")
    assert m.model_dump()["exit_therapy_text"] is None
