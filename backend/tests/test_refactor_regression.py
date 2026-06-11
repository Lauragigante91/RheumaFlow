"""Regression test after login_demo/parse_lab_file and PatientDetail refactor.

Covers:
- POST /api/auth/demo creates demo org with 3 patients + sets cookies.
- GET /api/patients returns exactly 3 patients with expected IDs in demo org.
- GET /api/patients/{id}/assessments and /therapies return seeded data.
- Admin login + /auth/me still work.
- PRO QR flow: create token, fetch public, submit BASDAI q1..q6=5 -> score 5.0.
- Export smoke: /export/diagnoses (list) and /export/cohort-xlsx (xlsx content-type).
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

EXPECTED_DEMO_IDS = {"DEMO-AR-01", "DEMO-SPA-02", "DEMO-SLE-03"}


# ---------- fixtures ----------

@pytest.fixture(scope="module")
def demo_session():
    """Fresh demo org session with cookies set via /auth/demo."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/demo")
    assert r.status_code == 200, f"demo login failed: {r.status_code} {r.text}"
    data = r.json()
    # Persist the last demo meta for tests
    s.demo_meta = data  # type: ignore[attr-defined]
    s.demo_cookies_raw = r.cookies  # type: ignore[attr-defined]
    yield s


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    yield s


# ---------- demo auth refactor ----------

class TestDemoAuthRefactor:
    def test_demo_returns_200_with_expected_payload(self, demo_session):
        data = demo_session.demo_meta
        assert data.get("is_demo") is True
        assert data.get("email", "").endswith("@clinimetria.demo")
        assert data.get("role") == "admin"
        assert "organization_id" in data

    def test_demo_cookies_are_set(self, demo_session):
        # access_token and refresh_token cookies should both be set
        cookies = {c.name for c in demo_session.demo_cookies_raw}
        assert "access_token" in cookies, f"access_token cookie missing; got {cookies}"
        assert "refresh_token" in cookies, f"refresh_token cookie missing; got {cookies}"

    def test_demo_me_endpoint(self, demo_session):
        r = demo_session.get(f"{API}/auth/me")
        assert r.status_code == 200, r.text
        me = r.json()
        # /auth/me doesn't currently surface is_demo — check via org name prefix "Demo UO"
        assert me["email"] == demo_session.demo_meta["email"]
        assert me.get("organization_name", "").startswith("Demo UO")

    def test_demo_patients_list_has_3(self, demo_session):
        r = demo_session.get(f"{API}/patients")
        assert r.status_code == 200, r.text
        patients = r.json()
        assert isinstance(patients, list)
        assert len(patients) == 3, f"expected 3 demo patients, got {len(patients)}"
        # Patient.id is a UUID; the DEMO-* codes are stored in codice_paziente
        codes = {p.get("codice_paziente") for p in patients}
        assert codes == EXPECTED_DEMO_IDS, f"codice_paziente mismatch: {codes}"
        for p in patients:
            assert "_id" not in p

    def test_demo_patient_has_assessments_and_therapies(self, demo_session):
        # Find DEMO-AR-01 by codice_paziente, then fetch by its UUID id
        r = demo_session.get(f"{API}/patients")
        assert r.status_code == 200, r.text
        ar01 = next((p for p in r.json() if p.get("codice_paziente") == "DEMO-AR-01"), None)
        assert ar01 is not None, "DEMO-AR-01 not found among demo patients"
        pid = ar01["id"]

        ra = demo_session.get(f"{API}/patients/{pid}/assessments")
        assert ra.status_code == 200, ra.text
        assessments = ra.json()
        assert isinstance(assessments, list) and len(assessments) >= 4, \
            f"DEMO-AR-01 should have seeded assessments (>=4), got {len(assessments)}"

        rt = demo_session.get(f"{API}/patients/{pid}/therapies")
        assert rt.status_code == 200, rt.text
        therapies = rt.json()
        assert isinstance(therapies, list) and len(therapies) >= 2, \
            f"DEMO-AR-01 should have seeded therapies (>=2), got {len(therapies)}"


# ---------- admin auth flow ----------

class TestAdminAuth:
    def test_admin_login_ok(self, admin_session):
        # Already logged in via fixture; reuse to verify cookies on next call
        r = admin_session.get(f"{API}/auth/me")
        assert r.status_code == 200, r.text
        me = r.json()
        assert me["email"] == ADMIN_EMAIL
        assert me.get("role") == "admin"


# ---------- PRO QR regression ----------

class TestPROFlow:
    def test_pro_basdai_score_is_5(self, admin_session):
        # Create a test patient first
        patient_payload = {
            "nome": f"TEST_REF_{uuid.uuid4().hex[:6]}",
            "cognome": "ProBasdai",
            "data_nascita": "1980-01-01",
            "sesso": "M",
            "codice_fiscale": f"TST{uuid.uuid4().hex[:13].upper()}",
            "diagnosi": "Spondiloartrite",
        }
        rp = admin_session.post(f"{API}/patients", json=patient_payload)
        assert rp.status_code == 200, rp.text
        patient_id = rp.json()["id"]

        try:
            # Create PRO token for BASDAI (lowercase as required by backend)
            rt = admin_session.post(
                f"{API}/pro-tokens",
                json={"patient_id": patient_id, "instruments": ["basdai"]},
            )
            assert rt.status_code == 200, rt.text
            token = rt.json()["token"]

            # GET public (no auth)
            public = requests.Session()
            rg = public.get(f"{API}/public/pro/{token}")
            assert rg.status_code == 200, rg.text
            body = rg.json()
            assert "basdai" in (body.get("instruments") or [])

            # Submit with q1..q6 = 5 → expected score 5.0
            submit_payload = {
                "responses": {
                    "instruments": {
                        "basdai": {
                            "items": {"q1": 5, "q2": 5, "q3": 5, "q4": 5, "q5": 5, "q6": 5},
                            "score": 5.0,
                        }
                    }
                }
            }
            rs = public.post(f"{API}/public/pro/{token}/submit", json=submit_payload)
            assert rs.status_code == 200, rs.text
            assert rs.json().get("success") is True

            # Verify score persisted via doctor endpoint
            rl = admin_session.get(f"{API}/patients/{patient_id}/pro-tokens")
            assert rl.status_code == 200, rl.text
            tokens = rl.json()
            mine = next((t for t in tokens if t.get("token") == token), None)
            assert mine is not None, "submitted token not found on patient"
            stored = (mine.get("submitted_responses") or {}).get("instruments") or {}
            assert "basdai" in stored, f"BASDAI missing in stored responses: {stored}"
            score = stored["basdai"].get("score")
            assert float(score) == 5.0, f"expected 5.0, got {score}"
        finally:
            admin_session.delete(f"{API}/patients/{patient_id}")


# ---------- Export smoke tests ----------

class TestExports:
    def test_export_diagnoses_returns_list(self, admin_session):
        r = admin_session.get(f"{API}/export/diagnoses")
        assert r.status_code == 200, r.text
        data = r.json()
        # May be list or {diagnoses: [...]} — accept both
        if isinstance(data, dict):
            assert "diagnoses" in data
            assert isinstance(data["diagnoses"], list)
        else:
            assert isinstance(data, list)

    def test_export_cohort_xlsx_smoke(self, admin_session):
        r = admin_session.get(f"{API}/export/cohort-xlsx", params={"diagnosis": "Artrite"})
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        ctype = r.headers.get("content-type", "")
        assert "spreadsheetml" in ctype or "xlsx" in ctype or "octet-stream" in ctype, \
            f"unexpected content-type: {ctype}"
        assert len(r.content) > 0
