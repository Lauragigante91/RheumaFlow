"""Iteration 5 backend acceptance tests for the 6 new features:

1. PRO_INSTRUMENTS_ALLOWED accepts 'esspri' (renamed from ess_pri) and 'fiqr'.
2. POST /api/pro-tokens with esspri+fiqr+vas_pain returns 200.
3. GET /api/public/pro/{token} returns 200 with status=active.
4. POST /api/public/pro/{token}/submit accepts ESSPRI + FIQR + VAS pain payload.
5. POST /api/patients with diagnosi_secondarie persists list; GET returns it.
6. PUT /api/patients/{id} can replace diagnosi_secondarie list (e.g. shrink to 1).
"""

import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@clinimetria.it"
ADMIN_PASSWORD = "admin123"


# ---------- shared fixtures ----------

@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    yield s


@pytest.fixture(scope="module")
def created_patient_ids():
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_session, created_patient_ids):
    yield
    # teardown: delete any patient created by this module
    for pid in created_patient_ids:
        try:
            admin_session.delete(f"{API}/patients/{pid}")
        except Exception:
            pass


# ---------- Feature 5: diagnosi_secondarie ----------

class TestDiagnosiSecondarie:
    def test_create_patient_with_diagnosi_secondarie(self, admin_session, created_patient_ids):
        payload = {
            "codice_paziente": f"TEST_DS_{uuid.uuid4().hex[:6]}",
            "diagnosi": "AR",
            "diagnosi_secondarie": ["Fibromialgia", "Osteoporosi"],
        }
        r = admin_session.post(f"{API}/patients", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["diagnosi"] == "AR"
        assert data["diagnosi_secondarie"] == ["Fibromialgia", "Osteoporosi"]
        assert "id" in data and "_id" not in data
        created_patient_ids.append(data["id"])

        # GET-back validation: persistence
        g = admin_session.get(f"{API}/patients/{data['id']}")
        assert g.status_code == 200, g.text
        gp = g.json()
        assert gp["diagnosi_secondarie"] == ["Fibromialgia", "Osteoporosi"]

    def test_update_patient_diagnosi_secondarie_to_single(self, admin_session, created_patient_ids):
        # reuse the patient from the previous test
        assert created_patient_ids, "create test must run first"
        pid = created_patient_ids[0]
        r = admin_session.put(
            f"{API}/patients/{pid}",
            json={"diagnosi_secondarie": ["Fibromialgia"]},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["diagnosi_secondarie"] == ["Fibromialgia"]

        # GET-back
        g = admin_session.get(f"{API}/patients/{pid}")
        assert g.status_code == 200
        assert g.json()["diagnosi_secondarie"] == ["Fibromialgia"]

    def test_create_patient_with_no_diagnosi_secondarie_defaults_empty(
        self, admin_session, created_patient_ids
    ):
        payload = {
            "codice_paziente": f"TEST_DS_EMPTY_{uuid.uuid4().hex[:6]}",
            "diagnosi": "AR",
        }
        r = admin_session.post(f"{API}/patients", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("diagnosi_secondarie", []) == []
        created_patient_ids.append(data["id"])


# ---------- Feature 1+2: ESSPRI/FIQR PRO token flow ----------

class TestEsspriFiqrPRO:
    @pytest.fixture(scope="class")
    def patient_for_pro(self, admin_session, created_patient_ids):
        payload = {
            "codice_paziente": f"TEST_PRO_{uuid.uuid4().hex[:6]}",
            "diagnosi": "Sjögren primaria + Fibromialgia",
            "diagnosi_secondarie": ["Fibromialgia"],
        }
        r = admin_session.post(f"{API}/patients", json=payload)
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        created_patient_ids.append(pid)
        return pid

    def test_esspri_not_rejected_anymore(self, admin_session, patient_for_pro):
        """Critical regression: ess_pri was renamed to esspri."""
        r = admin_session.post(
            f"{API}/pro-tokens",
            json={
                "patient_id": patient_for_pro,
                "instruments": ["ess_pri"],  # old name -> should now FAIL
                "expires_in_hours": 24,
            },
        )
        assert r.status_code == 400, f"old key 'ess_pri' should be rejected, got {r.status_code}"
        assert "ess_pri" in r.text or "non validi" in r.text.lower()

    def test_create_pro_token_with_esspri_fiqr_vaspain(self, admin_session, patient_for_pro):
        r = admin_session.post(
            f"{API}/pro-tokens",
            json={
                "patient_id": patient_for_pro,
                "instruments": ["esspri", "fiqr", "vas_pain"],
                "expires_in_hours": 24,
            },
        )
        assert r.status_code == 200, f"expected 200 with new keys, got {r.status_code}: {r.text}"
        token_doc = r.json()
        assert token_doc["instruments"] == ["esspri", "fiqr", "vas_pain"]
        assert "token" in token_doc and len(token_doc["token"]) > 10
        assert "_id" not in token_doc
        # stash for next tests
        type(self).TOKEN = token_doc["token"]

    def test_public_get_token_no_auth(self, patient_for_pro):
        token = getattr(self, "TOKEN", None)
        assert token, "previous test must run first"
        # explicitly NOT authenticated
        r = requests.get(f"{API}/public/pro/{token}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "active"
        assert set(data["instruments"]) == {"esspri", "fiqr", "vas_pain"}

    def test_public_submit_esspri_fiqr_vaspain(self):
        token = getattr(self, "TOKEN", None)
        assert token, "previous test must run first"

        # ESSPRI score = (7+6+5)/3 = 6.0 — computed client-side in proInstruments.js,
        # but the backend just stores the responses payload.
        responses = {
            "instruments": {
                "esspri": {
                    "score": 6.0,
                    "interpretation": "Sintomi moderati",
                    "inputs": {"dryness": 7, "fatigue": 6, "pain": 5},
                },
                "fiqr": {
                    "score": 50.0,  # all items = 5 -> linear positive
                    "interpretation": "Impatto moderato",
                    "inputs": {f: 5 for f in (
                        "f_q1 f_q2 f_q3 f_q4 f_q5 f_q6 f_q7 f_q8 f_q9 "
                        "o_balance o_environmental "
                        "s_pain s_energy s_stiffness s_sleep s_depression s_memory "
                        "s_anxiety s_tenderness s_balance_sym s_environmental_sym"
                    ).split()},
                },
                "vas_pain": {
                    "score": 80,
                    "interpretation": "Dolore severo",
                    "inputs": {"vas": 80},
                },
            }
        }
        r = requests.post(
            f"{API}/public/pro/{token}/submit",
            json={"responses": responses},
        )
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

    def test_public_get_after_submit_marks_completed(self):
        token = getattr(self, "TOKEN", None)
        assert token, "previous tests must run first"
        r = requests.get(f"{API}/public/pro/{token}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "already_submitted", data

    def test_double_submit_returns_409(self):
        token = getattr(self, "TOKEN", None)
        r = requests.post(
            f"{API}/public/pro/{token}/submit",
            json={"responses": {"instruments": {}}},
        )
        assert r.status_code == 409, r.text
