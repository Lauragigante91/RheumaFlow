"""Iteration 7 backend regression tests for the RheumaFlow rebrand + recall flag system.

Endpoints under test:
1. PUT  /api/patients/{id}/recall          (private | shared | None | invalid)
2. GET  /api/patients-recall                (visibility rules across users)
3. GET  /api/patients-recent-mine?days=7    (only my assessments, last 7 days)
4. GET  /api/auth/me                        (regression: still returns is_demo)
"""

import os
import secrets
import time
import pytest
import requests

# --- BASE_URL resolution (parity with other iter test files) ---
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@clinimetria.it"
ADMIN_PASSWORD = "admin123"


# ---------------- fixtures ----------------

@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    yield s


@pytest.fixture(scope="module")
def admin_org_invite(admin_session):
    """Get admin's org invite_code so we can register a second user in the same org."""
    r = admin_session.get(f"{API}/auth/me")
    assert r.status_code == 200
    data = r.json()
    invite = data.get("invite_code")
    assert invite, f"admin /auth/me missing invite_code: {data}"
    return invite


@pytest.fixture(scope="module")
def second_user_session(admin_org_invite):
    """Register a second user joining admin's org via invite_code."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    suffix = secrets.token_hex(4)
    email = f"TEST_iter7_user2_{suffix}@example.com"
    payload = {
        "email": email,
        "password": "Iter7Test!23",
        "name": f"Test Iter7 User {suffix}",
        "invite_code": admin_org_invite,
    }
    r = s.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, f"register second user failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def some_patient_id(admin_session):
    """Pick any existing patient in admin's org."""
    r = admin_session.get(f"{API}/patients")
    assert r.status_code == 200, r.text
    patients = r.json()
    assert len(patients) >= 1, "Need at least one patient in the org seed"
    return patients[0]["id"]


@pytest.fixture(scope="module")
def second_patient_id(admin_session):
    r = admin_session.get(f"{API}/patients")
    assert r.status_code == 200, r.text
    patients = r.json()
    if len(patients) >= 2:
        return patients[1]["id"]
    # else create one
    r = admin_session.post(f"{API}/patients", json={
        "codice_paziente": f"TEST-ITER7-{secrets.token_hex(3)}",
        "anno_nascita": 1970,
        "sesso": "M",
        "diagnosi": "Test diagnosi iter7",
    })
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


# ---------------- TestRecallFlag (PUT) ----------------

class TestRecallFlagPut:
    def test_set_shared_with_note_returns_metadata(self, admin_session, some_patient_id):
        r = admin_session.put(
            f"{API}/patients/{some_patient_id}/recall",
            json={"flag": "shared", "note": "Verificare risposta MTX a 3 mesi"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        recall = body.get("recall")
        assert recall, "recall payload missing"
        assert recall["flag"] == "shared"
        assert recall["note"] == "Verificare risposta MTX a 3 mesi"
        assert recall.get("set_by"), "recall.set_by missing"
        assert recall.get("set_by_name"), "recall.set_by_name missing"
        assert recall.get("set_at"), "recall.set_at missing"

        # Verify persistence via GET /api/patients-recall (the dedicated endpoint
        # does not use response_model=Patient, so recall is preserved)
        gl = admin_session.get(f"{API}/patients-recall")
        assert gl.status_code == 200
        match = next((p for p in gl.json() if p["id"] == some_patient_id), None)
        assert match is not None, "patient not in /patients-recall after setting shared"
        assert match.get("recall", {}).get("flag") == "shared"
        assert match["recall"]["note"] == "Verificare risposta MTX a 3 mesi"

    def test_BUG_get_patient_strips_recall_field(self, admin_session, some_patient_id):
        """REGRESSION BUG: GET /api/patients/{id} uses response_model=Patient with
        extra='ignore', which strips the `recall` field even though it is persisted
        in MongoDB. This breaks PatientHeader.jsx → RecallFlagControl which reads
        patient.recall to display current flag state on page reload.

        Frontend works around this only via /patients-recall list, but the per-patient
        view cannot display recall state. Should be fixed by either:
          (a) adding `recall: Optional[dict] = None` to Patient model, OR
          (b) returning the raw doc (no response_model) from get_patient.
        """
        # set shared
        admin_session.put(
            f"{API}/patients/{some_patient_id}/recall",
            json={"flag": "shared", "note": "bug-repro"},
        )
        g = admin_session.get(f"{API}/patients/{some_patient_id}")
        assert g.status_code == 200
        gp = g.json()
        # This SHOULD pass; if it fails, the bug above is reproduced.
        assert gp.get("recall", {}).get("flag") == "shared", (
            "BUG: GET /patients/{id} does not include the persisted `recall` field. "
            "This breaks RecallFlagControl on page reload."
        )

    def test_set_private_returns_private_flag(self, admin_session, some_patient_id):
        r = admin_session.put(
            f"{API}/patients/{some_patient_id}/recall",
            json={"flag": "private", "note": "solo per me"},
        )
        assert r.status_code == 200, r.text
        recall = r.json()["recall"]
        assert recall["flag"] == "private"
        assert recall["note"] == "solo per me"

    def test_set_null_removes_recall(self, admin_session, some_patient_id):
        r = admin_session.put(
            f"{API}/patients/{some_patient_id}/recall",
            json={"flag": None},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert body.get("recall") is None
        # Verify removal via /patients-recall list (should not include this patient)
        gl = admin_session.get(f"{API}/patients-recall")
        ids = [p["id"] for p in gl.json()]
        assert some_patient_id not in ids, "patient should not appear in recall list after clear"

    def test_invalid_flag_returns_400(self, admin_session, some_patient_id):
        r = admin_session.put(
            f"{API}/patients/{some_patient_id}/recall",
            json={"flag": "invalid"},
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"

    def test_recall_on_unknown_patient_returns_404(self, admin_session):
        r = admin_session.put(
            f"{API}/patients/does-not-exist-xyz/recall",
            json={"flag": "shared", "note": "x"},
        )
        assert r.status_code == 404


# ---------------- TestPatientsRecall (GET list + visibility) ----------------

class TestPatientsRecallVisibility:
    def test_list_recall_returns_shared_and_my_private(
        self, admin_session, some_patient_id, second_patient_id, second_user_session
    ):
        # Admin: flag patient1 = private, patient2 = shared
        r = admin_session.put(
            f"{API}/patients/{some_patient_id}/recall",
            json={"flag": "private", "note": "private nota admin"},
        )
        assert r.status_code == 200
        time.sleep(0.05)
        r = admin_session.put(
            f"{API}/patients/{second_patient_id}/recall",
            json={"flag": "shared", "note": "shared nota admin"},
        )
        assert r.status_code == 200

        # Admin sees both
        r = admin_session.get(f"{API}/patients-recall")
        assert r.status_code == 200, r.text
        items = r.json()
        ids = [p["id"] for p in items]
        assert some_patient_id in ids, "admin should see own private flag"
        assert second_patient_id in ids, "admin should see shared flag"

        # Verify ordering: most recent set_at first
        set_ats = [p.get("recall", {}).get("set_at") for p in items if p.get("recall")]
        assert set_ats == sorted(set_ats, reverse=True), f"recall list not sorted desc: {set_ats}"

        # Second user (same org) should see ONLY the shared one, NOT admin's private
        r2 = second_user_session.get(f"{API}/patients-recall")
        assert r2.status_code == 200, r2.text
        ids2 = [p["id"] for p in r2.json()]
        assert second_patient_id in ids2, "second user should see admin's shared flag"
        assert some_patient_id not in ids2, (
            "second user MUST NOT see admin's private flag — visibility leak!"
        )

    def test_second_user_private_invisible_to_admin(
        self, admin_session, second_user_session, second_patient_id
    ):
        # First clear: admin removes the shared flag on patient2
        r = admin_session.put(f"{API}/patients/{second_patient_id}/recall", json={"flag": None})
        assert r.status_code == 200
        # Second user sets private on patient2
        r = second_user_session.put(
            f"{API}/patients/{second_patient_id}/recall",
            json={"flag": "private", "note": "private da user2"},
        )
        assert r.status_code == 200, r.text

        # Admin should NOT see patient2 in their recall list (it's user2's private)
        r = admin_session.get(f"{API}/patients-recall")
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert second_patient_id not in ids, "admin must not see another user's private flag"

        # Now user2 promotes to shared → admin sees it
        r = second_user_session.put(
            f"{API}/patients/{second_patient_id}/recall",
            json={"flag": "shared", "note": "shared da user2"},
        )
        assert r.status_code == 200
        r = admin_session.get(f"{API}/patients-recall")
        ids = [p["id"] for p in r.json()]
        assert second_patient_id in ids, "admin should see shared flag set by user2"

        # Cleanup: clear flags so other tests start clean
        admin_session.put(f"{API}/patients/{second_patient_id}/recall", json={"flag": None})


# ---------------- TestPatientsRecentMine ----------------

class TestPatientsRecentMine:
    def test_recent_mine_isolates_per_user(
        self, admin_session, second_user_session, some_patient_id
    ):
        # Admin creates an assessment on some_patient
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).date().isoformat()
        a = admin_session.post(f"{API}/assessments", json={
            "patient_id": some_patient_id,
            "index_type": "das28_crp",
            "date": today,
            "inputs": {"tender": 2, "swollen": 1, "crp": 5, "vas": 20},
            "score": 2.5,
            "interpretation": "Bassa attività",
        })
        assert a.status_code in (200, 201), a.text

        # Admin /patients-recent-mine?days=7 should include this patient
        r = admin_session.get(f"{API}/patients-recent-mine?days=7")
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        ids = [p["id"] for p in data]
        assert some_patient_id in ids, f"admin should see own recent patient; got {ids}"

        # Each entry has the expected enrichment fields
        target = next(p for p in data if p["id"] == some_patient_id)
        assert "last_assessment_at" in target
        assert "last_index_type" in target
        assert "last_score" in target
        assert "assessments_in_window" in target
        assert isinstance(target["assessments_in_window"], int)
        assert target["assessments_in_window"] >= 1

        # Limit ≤ 20
        assert len(data) <= 20

        # Second user (same org) should NOT see this patient — they didn't create the assessment
        r2 = second_user_session.get(f"{API}/patients-recent-mine?days=7")
        assert r2.status_code == 200, r2.text
        ids2 = [p["id"] for p in r2.json()]
        # Second user has no assessments → list should be empty (or at least not include some_patient
        # via admin-created assessments)
        if some_patient_id in ids2:
            # If present, it must be because user2 has their own assessment on it — verify
            target2 = next(p for p in r2.json() if p["id"] == some_patient_id)
            # this would only be valid if user2 also assessed; in this test they did not
            pytest.fail(
                f"second user sees recent patient they did NOT assess. "
                f"Cross-user leak in /patients-recent-mine: {target2}"
            )

    def test_recent_mine_days_param_clamped(self, admin_session):
        # Out-of-range days should not crash
        r = admin_session.get(f"{API}/patients-recent-mine?days=0")
        assert r.status_code == 200
        r = admin_session.get(f"{API}/patients-recent-mine?days=10000")
        assert r.status_code == 200


# ---------------- regression: /auth/me still returns is_demo ----------------

class TestAuthMeRegression:
    def test_admin_me_still_returns_is_demo(self, admin_session):
        r = admin_session.get(f"{API}/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert "is_demo" in data, "regression: /auth/me missing is_demo"
        assert data["is_demo"] is False
