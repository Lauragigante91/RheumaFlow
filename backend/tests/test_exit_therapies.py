import os
import sys

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "test_exit_therapies")
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from helpers import compute_exit_therapies_text


def ep(drug, start=None, end=None, dose=None, frequency=None, route=None,
       relevance="medium", events=None, canonical=None):
    return {
        "drug_name": drug,
        "drug_canonical": canonical or drug.lower(),
        "start_date": start,
        "end_date": end,
        "dose": dose,
        "frequency": frequency,
        "route": route,
        "relevance": relevance,
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
