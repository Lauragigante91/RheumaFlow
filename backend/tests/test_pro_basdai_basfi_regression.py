"""
Regression test for BASDAI/BASFI PRO QR flow.
Verifies that when the frontend submits BASDAI (q1..q6) and BASFI (q1..q10)
keys — matching calcBASDAI/calcBASFI signatures — the computed scores are
correctly persisted in the backend (not 0).
"""
import os
import math
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


# ---------------- Ported JS score formulas (mirror of frontend/src/lib/clinimetrics.js) ----------------
def round2(n):
    return round(n * 100) / 100


def calc_basdai(q1, q2, q3, q4, q5, q6):
    # ((q1+q2+q3+q4 + (q5+q6)/2) / 5)
    return round2(((q1 + q2 + q3 + q4 + (q5 + q6) / 2) / 5))


def calc_basfi(values):
    vals = [values.get(f"q{i+1}", 0) for i in range(10)]
    return round2(sum(vals) / 10)


# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def auth_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    # Cookie set; verify /auth/me
    me = s.get(f"{API}/auth/me", timeout=10)
    assert me.status_code == 200, f"/auth/me failed: {me.status_code} {me.text}"
    return s


@pytest.fixture(scope="module")
def test_patient(auth_session):
    suffix = uuid.uuid4().hex[:6]
    payload = {
        "nome": f"TEST_BAS_{suffix}",
        "cognome": "Regression",
        "sesso": "M",
        "data_nascita": "1970-01-01",
        "diagnosi": "Spondiloartrite",
    }
    r = auth_session.post(f"{API}/patients", json=payload, timeout=15)
    assert r.status_code in (200, 201), f"Create patient failed: {r.status_code} {r.text}"
    pid = r.json()["id"]
    yield pid
    # Cleanup
    try:
        auth_session.delete(f"{API}/patients/{pid}", timeout=10)
    except Exception:
        pass


# ---------------- Tests ----------------
class TestPROBasdaiBasfiRegression:

    def test_score_formulas_sanity(self):
        """Sanity: BASDAI with all q*=5 == 5.0; BASFI with all q*=5 == 5.0"""
        assert calc_basdai(5, 5, 5, 5, 5, 5) == 5.0
        assert calc_basfi({f"q{i+1}": 5 for i in range(10)}) == 5.0

    def test_full_flow_scores_persist_correctly(self, auth_session, test_patient):
        # 1. Create PRO token
        r = auth_session.post(
            f"{API}/pro-tokens",
            json={
                "patient_id": test_patient,
                "instruments": ["basdai", "basfi", "haq"],
                "note": "regression test",
                "expires_in_hours": 24,
            },
            timeout=15,
        )
        assert r.status_code == 200, f"Create token failed: {r.status_code} {r.text}"
        tdata = r.json()
        token = tdata["token"]
        token_id = tdata["id"]
        assert isinstance(token, str) and len(token) > 0

        # 2. Fetch public endpoint (no auth!)
        anon = requests.Session()
        pub = anon.get(f"{API}/public/pro/{token}", timeout=10)
        assert pub.status_code == 200, f"Public GET failed: {pub.status_code} {pub.text}"
        pub_data = pub.json()
        assert pub_data.get("status") == "active"
        assert set(pub_data.get("instruments", [])) == {"basdai", "basfi", "haq"}

        # 3. Build submission exactly like the frontend does:
        # responses[instrId][item.key] = value, then def.score(responses[instrId])
        # BASDAI: q1..q6 all = 5  → expected 5.0
        basdai_inputs = {f"q{i+1}": 5 for i in range(6)}
        basdai_score = calc_basdai(**basdai_inputs)
        assert basdai_score == 5.0

        # BASFI: q1..q10 all = 5 → expected 5.0
        basfi_inputs = {f"q{i+1}": 5 for i in range(10)}
        basfi_score = calc_basfi(basfi_inputs)
        assert basfi_score == 5.0

        # HAQ: all categorical items = 0 → expected 0.0 (unaffected by BASDAI/BASFI key change)
        haq_inputs = {}  # empty → treated as 0 by calcHAQ
        haq_score = 0.0

        submission = {
            "responses": {
                "instruments": {
                    "basdai": {
                        "score": basdai_score,
                        "interpretation": "Malattia attiva",
                        "inputs": basdai_inputs,
                    },
                    "basfi": {
                        "score": basfi_score,
                        "interpretation": "Limitazione moderata",
                        "inputs": basfi_inputs,
                    },
                    "haq": {
                        "score": haq_score,
                        "interpretation": "Disabilità minima",
                        "inputs": haq_inputs,
                    },
                }
            }
        }
        sub = anon.post(f"{API}/public/pro/{token}/submit", json=submission, timeout=15)
        assert sub.status_code == 200, f"Submit failed: {sub.status_code} {sub.text}"
        assert sub.json().get("success") is True

        # 4. Verify scores persisted via doctor list endpoint
        r2 = auth_session.get(f"{API}/patients/{test_patient}/pro-tokens", timeout=15)
        assert r2.status_code == 200
        tokens = r2.json()
        mine = next((t for t in tokens if t["id"] == token_id), None)
        assert mine is not None, "Submitted token not found in list"
        assert mine.get("completed_at"), "completed_at not set after submit"

        stored = mine.get("submitted_responses", {}) or {}
        instruments_stored = stored.get("instruments", {})
        assert "basdai" in instruments_stored
        assert "basfi" in instruments_stored
        assert "haq" in instruments_stored

        # CRITICAL assertions — the bug would manifest as score == 0
        assert instruments_stored["basdai"]["score"] == 5.0, \
            f"BASDAI score expected 5.0, got {instruments_stored['basdai']['score']}"
        assert instruments_stored["basfi"]["score"] == 5.0, \
            f"BASFI score expected 5.0, got {instruments_stored['basfi']['score']}"
        assert instruments_stored["haq"]["score"] == 0.0, \
            f"HAQ score expected 0.0, got {instruments_stored['haq']['score']}"

        # Inputs preserved with correct keys
        assert instruments_stored["basdai"]["inputs"].get("q1") == 5
        assert instruments_stored["basdai"]["inputs"].get("q6") == 5
        assert instruments_stored["basfi"]["inputs"].get("q10") == 5

        # 5. Public endpoint should now say already_submitted
        pub2 = anon.get(f"{API}/public/pro/{token}", timeout=10)
        assert pub2.status_code == 200
        assert pub2.json().get("status") == "already_submitted"

        # 6. Resubmit should be rejected (409)
        sub2 = anon.post(f"{API}/public/pro/{token}/submit", json=submission, timeout=10)
        assert sub2.status_code == 409

    def test_convert_creates_assessments_with_correct_scores(self, auth_session, test_patient):
        """Convert endpoint should transform submitted_responses into assessments preserving the non-zero scores."""
        # New token + submit
        r = auth_session.post(
            f"{API}/pro-tokens",
            json={"patient_id": test_patient, "instruments": ["basdai", "basfi"], "expires_in_hours": 24},
            timeout=15,
        )
        assert r.status_code == 200
        tdata = r.json()
        token = tdata["token"]
        token_id = tdata["id"]

        anon = requests.Session()
        submission = {
            "responses": {
                "instruments": {
                    "basdai": {"score": 5.0, "interpretation": "Malattia attiva",
                               "inputs": {f"q{i+1}": 5 for i in range(6)}},
                    "basfi": {"score": 5.0, "interpretation": "Limitazione moderata",
                              "inputs": {f"q{i+1}": 5 for i in range(10)}},
                }
            }
        }
        assert anon.post(f"{API}/public/pro/{token}/submit", json=submission, timeout=15).status_code == 200

        conv = auth_session.post(f"{API}/pro-tokens/{token_id}/convert", timeout=15)
        assert conv.status_code == 200, f"Convert failed: {conv.status_code} {conv.text}"
        cd = conv.json()
        assert cd.get("success") is True
        assert set(cd.get("created", [])) == {"basdai", "basfi"}

        # Fetch assessments and verify scores
        ra = auth_session.get(f"{API}/patients/{test_patient}/assessments", timeout=15)
        assert ra.status_code == 200
        alist = ra.json()
        bas_scores = {a["index_type"]: a["score"] for a in alist if a["index_type"] in ("basdai", "basfi")}
        assert bas_scores.get("basdai") == 5.0, f"Converted BASDAI score={bas_scores.get('basdai')}"
        assert bas_scores.get("basfi") == 5.0, f"Converted BASFI score={bas_scores.get('basfi')}"
