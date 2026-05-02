"""Backend API tests for Clinimetria Reumatologica"""
import os
import math
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback read from frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def created_patient(session):
    payload = {
        "nome": "TEST_Mario",
        "cognome": "TEST_Rossi",
        "data_nascita": "1970-01-15",
        "sesso": "M",
        "codice_fiscale": "RSSMRA70A15H501X",
        "diagnosi": "Artrite reumatoide",
        "note": "Test patient",
    }
    r = session.post(f"{API}/patients", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "id" in data and data["nome"] == "TEST_Mario"
    assert "_id" not in data
    yield data
    # Cleanup
    session.delete(f"{API}/patients/{data['id']}")


def test_root(session):
    r = session.get(f"{API}/")
    assert r.status_code == 200
    assert "message" in r.json()


def test_list_patients(session, created_patient):
    r = session.get(f"{API}/patients")
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list)
    assert any(p["id"] == created_patient["id"] for p in arr)
    for p in arr:
        assert "_id" not in p


def test_get_patient(session, created_patient):
    r = session.get(f"{API}/patients/{created_patient['id']}")
    assert r.status_code == 200
    p = r.json()
    assert p["id"] == created_patient["id"]
    assert p["nome"] == "TEST_Mario"
    assert "_id" not in p


def test_get_patient_404(session):
    r = session.get(f"{API}/patients/nonexistent-xyz")
    assert r.status_code == 404


def test_update_patient(session, created_patient):
    r = session.put(f"{API}/patients/{created_patient['id']}", json={"note": "Updated note"})
    assert r.status_code == 200
    assert r.json()["note"] == "Updated note"
    # verify persistence
    g = session.get(f"{API}/patients/{created_patient['id']}")
    assert g.json()["note"] == "Updated note"


def test_update_patient_404(session):
    r = session.put(f"{API}/patients/nonexistent-xyz", json={"note": "x"})
    assert r.status_code == 404


def test_update_patient_empty_payload(session, created_patient):
    r = session.put(f"{API}/patients/{created_patient['id']}", json={})
    assert r.status_code == 400


def test_create_assessment(session, created_patient):
    payload = {
        "patient_id": created_patient["id"],
        "index_type": "das28_esr",
        "date": "2026-01-10",
        "inputs": {"tjc": 5, "sjc": 3, "esr": 25, "gh": 50},
        "score": 4.12,
        "interpretation": "Attività moderata",
        "tender_joints": ["shoulder_l", "elbow_l"],
        "swollen_joints": ["wrist_r"],
    }
    r = session.post(f"{API}/assessments", json=payload)
    assert r.status_code == 200, r.text
    a = r.json()
    assert a["patient_id"] == created_patient["id"]
    assert a["score"] == 4.12
    assert "_id" not in a
    pytest.assessment_id = a["id"]


def test_create_assessment_invalid_patient(session):
    payload = {
        "patient_id": "nonexistent-xyz",
        "index_type": "das28_esr",
        "date": "2026-01-10",
        "inputs": {},
    }
    r = session.post(f"{API}/assessments", json=payload)
    assert r.status_code == 404


def test_list_patient_assessments(session, created_patient):
    r = session.get(f"{API}/patients/{created_patient['id']}/assessments")
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list)
    assert len(arr) >= 1
    for a in arr:
        assert "_id" not in a
        assert a["patient_id"] == created_patient["id"]


def test_get_assessment(session):
    aid = getattr(pytest, "assessment_id", None)
    assert aid
    r = session.get(f"{API}/assessments/{aid}")
    assert r.status_code == 200
    assert r.json()["id"] == aid


def test_get_assessment_404(session):
    r = session.get(f"{API}/assessments/nonexistent-xyz")
    assert r.status_code == 404


def test_stats(session):
    r = session.get(f"{API}/stats")
    assert r.status_code == 200
    d = r.json()
    assert "patients" in d and "assessments" in d and "recent_assessments" in d
    assert isinstance(d["patients"], int)
    for a in d["recent_assessments"]:
        assert "_id" not in a


def test_delete_assessment(session):
    aid = getattr(pytest, "assessment_id", None)
    assert aid
    r = session.delete(f"{API}/assessments/{aid}")
    assert r.status_code == 200
    r2 = session.get(f"{API}/assessments/{aid}")
    assert r2.status_code == 404


def test_delete_assessment_404(session):
    r = session.delete(f"{API}/assessments/nonexistent-xyz")
    assert r.status_code == 404


def test_cascade_delete_patient(session):
    # Create patient + assessment then delete patient and confirm cascade
    pr = session.post(f"{API}/patients", json={"nome": "TEST_Cascade", "cognome": "TEST_Delete"})
    pid = pr.json()["id"]
    ar = session.post(f"{API}/assessments", json={
        "patient_id": pid, "index_type": "haq", "date": "2026-01-10",
        "inputs": {"score": 1.2}, "score": 1.2
    })
    aid = ar.json()["id"]
    dr = session.delete(f"{API}/patients/{pid}")
    assert dr.status_code == 200
    # patient gone
    assert session.get(f"{API}/patients/{pid}").status_code == 404
    # assessment cascade deleted
    assert session.get(f"{API}/assessments/{aid}").status_code == 404


def test_delete_patient_404(session):
    r = session.delete(f"{API}/patients/nonexistent-xyz")
    assert r.status_code == 404
