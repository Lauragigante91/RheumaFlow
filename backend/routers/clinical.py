"""
Clinical data routes: assessments, criteria evaluations, therapies,
lab exams, specialist visits.
"""
import re
import uuid
import logging
import unicodedata
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends

logger = logging.getLogger(__name__)

from database import db
from auth_utils import get_current_user
from models import (
    Assessment, AssessmentBase,
    CriteriaEvaluation, CriteriaEvaluationBase,
    Therapy, TherapyBase, TherapyUpdate, TherapyUpsert,
    TherapyEvent, TherapyEventAdd,
    LabExam, LabExamBase,
    SpecialistVisit, SpecialistVisitBase,
    InstrumentalExam, InstrumentalExamBase, InstrumentalExamUpdate,
)
from helpers import verify_patient_in_org, _episode_state_at, _therapy_state_at, compute_exit_therapies_text

router = APIRouter()

# ── Therapies: exclusivity rule ───────────────────────────────────────────────
EXCLUSIVE_CATEGORIES = {"bDMARD", "tsDMARD"}

# ── Therapy episode helpers ────────────────────────────────────────────────────

# Maps category → therapy_type classification
_CATEGORY_TO_THERAPY_TYPE = {
    "csDMARD":       "rheum_dmard",
    "bDMARD":        "rheum_dmard",
    "tsDMARD":       "rheum_dmard",
    "glucocorticoid":"glucocorticoid",
    "NSAID":         "nsaid",
}

# Maps category → rheumatological relevance
_CATEGORY_TO_RELEVANCE = {
    "csDMARD":       "high",
    "bDMARD":        "high",
    "tsDMARD":       "high",
    "glucocorticoid":"high",
    "NSAID":         "medium",
}


def _norm_drug_canonical(name: str) -> str:
    """Normalise a drug name to a stable canonical key (lowercase, collapsed spaces)."""
    return " ".join(name.lower().strip().split())


def _derive_therapy_type(category: str) -> str:
    return _CATEGORY_TO_THERAPY_TYPE.get(category, "other")


def _derive_relevance(category: str) -> str:
    return _CATEGORY_TO_RELEVANCE.get(category, "low")


def _extract_dose_mg(dose_str: Optional[str]) -> Optional[float]:
    """Extract the numeric mg value from a free-text dose string, or None."""
    if not dose_str:
        return None
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*mg", dose_str, re.IGNORECASE)
    return float(m.group(1).replace(",", ".")) if m else None


def _therapy_event_projection(event: dict) -> dict:
    """Project the current episode fields implied by a non-voided therapy event."""
    if event.get("voided"):
        return {}

    event_type = event.get("type")
    set_fields: dict = {}
    if event_type == "discontinued":
        set_fields["status"] = "discontinued"
        set_fields["end_date"] = event.get("date")
        if event.get("reason"):
            set_fields["discontinuation_reason"] = event.get("reason")
    elif event_type in ("dose_increased", "dose_reduced"):
        if event.get("dose_after"):
            set_fields["dose"] = event.get("dose_after")
        if event.get("frequency_after"):
            set_fields["frequency"] = event.get("frequency_after")
        if event.get("route_after"):
            set_fields["route"] = event.get("route_after")
    elif event_type == "regimen_changed":
        if event.get("dose_after"):
            set_fields["dose"] = event.get("dose_after")
        if event.get("frequency_after"):
            set_fields["frequency"] = event.get("frequency_after")
        if event.get("route_after"):
            set_fields["route"] = event.get("route_after")
    elif event_type == "resumed_within":
        set_fields["status"] = "active"
        set_fields["end_date"] = None
        if event.get("dose"):
            set_fields["dose"] = event.get("dose")
    elif event_type == "paused":
        set_fields["status"] = "paused"

    return set_fields


async def _append_therapy_event_and_project(
    therapy_filter: dict,
    event: dict,
    extra_set: Optional[dict] = None,
):
    """
    Append a therapy event and project event-derived current fields atomically.
    All writes to therapy longitudinal fields must go through this helper.
    """
    set_fields = dict(extra_set or {})
    set_fields.update(_therapy_event_projection(event))

    update_op: dict = {"$push": {"events": event}}
    if set_fields:
        update_op["$set"] = set_fields

    return await db.therapies.update_one(therapy_filter, update_op)


async def _find_active_episode(patient_id: str, org_id: str, canonical: str) -> Optional[dict]:
    """Return the active episode document for this drug, or None."""
    doc = await db.therapies.find_one({
        "patient_id": patient_id,
        "organization_id": org_id,
        "drug_canonical": canonical,
        "status": "active",
    }, {"_id": 0})
    if doc:
        return doc
    # Fallback: legacy documents that pre-date the drug_canonical field
    return await db.therapies.find_one({
        "patient_id": patient_id,
        "organization_id": org_id,
        "drug_name": re.compile(f"^{re.escape(canonical)}$", re.IGNORECASE),
        "drug_canonical": {"$exists": False},
        "status": "active",
    }, {"_id": 0})


def _norm_reason_sig(s: Optional[str]) -> str:
    if not s:
        return ""
    norm = unicodedata.normalize("NFD", str(s).lower())
    norm = "".join(c for c in norm if unicodedata.category(c) != "Mn")
    norm = re.sub(r"[^a-z0-9]+", " ", norm).strip()
    if not norm:
        return ""
    return " ".join(sorted(set(norm.split(" "))))


def _year_of(d: Optional[str]) -> str:
    if not d:
        return ""
    s = str(d)
    return s[:4] if len(s) >= 4 else ""


async def _find_duplicate_discontinued(
    patient_id: str,
    org_id: str,
    canonical: str,
    date_hint: Optional[str],
    reason: Optional[str],
) -> Optional[dict]:
    candidates = await db.therapies.find({
        "patient_id": patient_id,
        "organization_id": org_id,
        "drug_canonical": canonical,
        "status": "discontinued",
        "deleted_at": None,
    }, {"_id": 0}).to_list(length=None)
    year = _year_of(date_hint)
    reason_sig = _norm_reason_sig(reason)
    for c in candidates:
        c_year = _year_of(c.get("end_date") or c.get("start_date"))
        c_reason = _norm_reason_sig(c.get("discontinuation_reason"))
        year_match = bool(year) and bool(c_year) and year == c_year
        year_conflict = bool(year) and bool(c_year) and year != c_year
        reason_match = bool(reason_sig) and bool(c_reason) and reason_sig == c_reason
        reason_conflict = bool(reason_sig) and bool(c_reason) and reason_sig != c_reason
        if year_conflict or reason_conflict:
            continue
        if year_match or reason_match:
            return c
    return None


async def _auto_discontinue_competing(
    patient_id: str,
    organization_id: str,
    new_category: str,
    new_start_date: Optional[str],
    exclude_id: Optional[str] = None,
) -> int:
    """Auto-discontinue competing active biologics/tsDMARDs when a new one is started."""
    if new_category not in EXCLUSIVE_CATEGORIES:
        return 0
    end_date = new_start_date or datetime.now(timezone.utc).date().isoformat()
    query = {
        "patient_id": patient_id,
        "organization_id": organization_id,
        "category": {"$in": list(EXCLUSIVE_CATEGORIES)},
        "status": "active",
    }
    if exclude_id:
        query["id"] = {"$ne": exclude_id}
    modified = 0
    async for episode in db.therapies.find(query, {"_id": 0, "id": 1}):
        event = {
            "type": "discontinued",
            "date": end_date,
            "reason": "auto_discontinued_competing_therapy",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        result = await _append_therapy_event_and_project(
            {"id": episode["id"], "organization_id": organization_id},
            event,
            {"auto_discontinued": True},
        )
        modified += result.modified_count
    return modified


# ── Assessments ───────────────────────────────────────────────────────────────

@router.post("/assessments", response_model=Assessment)
async def create_assessment(payload: AssessmentBase, user: dict = Depends(get_current_user)):
    await verify_patient_in_org(payload.patient_id, user["organization_id"])
    a = Assessment(
        **payload.model_dump(),
        organization_id=user["organization_id"],
        created_by=user["id"],
        created_by_name=user.get("name"),
    )
    await db.assessments.insert_one(a.model_dump())
    return a


@router.put("/assessments/{assessment_id}", response_model=Assessment)
async def update_assessment(assessment_id: str, payload: AssessmentBase, user: dict = Depends(get_current_user)):
    result = await db.assessments.update_one(
        {"id": assessment_id, "organization_id": user["organization_id"]},
        {"$set": payload.model_dump()},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Valutazione non trovata")
    return await db.assessments.find_one({"id": assessment_id, "organization_id": user["organization_id"]}, {"_id": 0})


@router.get("/patients/{patient_id}/assessments", response_model=List[Assessment])
async def list_patient_assessments(patient_id: str, user: dict = Depends(get_current_user)):
    await verify_patient_in_org(patient_id, user["organization_id"])
    docs = await db.assessments.find({"patient_id": patient_id}, {"_id": 0}).sort("date", -1).to_list(2000)

    # In-flight migration: if assessment has visit_id, resolve clinical date from the visit
    visit_ids = list({d["visit_id"] for d in docs if d.get("visit_id")})
    if visit_ids:
        visit_date_map: dict = {}
        async for wv in db.workup_visits.find({"id": {"$in": visit_ids}}, {"_id": 0, "id": 1, "visit_date": 1}):
            if wv.get("visit_date"):
                visit_date_map[wv["id"]] = wv["visit_date"]
        try:
            async for fu in db.follow_up_visits.find({"id": {"$in": visit_ids}}, {"_id": 0, "id": 1, "visit_date": 1}):
                if fu.get("visit_date"):
                    visit_date_map[fu["id"]] = fu["visit_date"]
        except Exception as exc:
            # follow_up_visits collection may not exist in all deployments;
            # assessment dates are still resolved from workup_visits above.
            logger.warning(
                "Could not query follow_up_visits for date resolution (patient=%s): %s — %s",
                patient_id, type(exc).__name__, exc,
            )
        for d in docs:
            vid = d.get("visit_id")
            if vid and vid in visit_date_map:
                d["date"] = visit_date_map[vid]
        docs.sort(key=lambda d: (d.get("date") or ""), reverse=True)

    return docs


@router.get("/assessments/{assessment_id}", response_model=Assessment)
async def get_assessment(assessment_id: str, user: dict = Depends(get_current_user)):
    doc = await db.assessments.find_one(
        {"id": assessment_id, "organization_id": user["organization_id"]}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Valutazione non trovata")
    return doc


@router.delete("/assessments/{assessment_id}")
async def delete_assessment(assessment_id: str, user: dict = Depends(get_current_user)):
    result = await db.assessments.delete_one(
        {"id": assessment_id, "organization_id": user["organization_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Valutazione non trovata")
    return {"success": True}


@router.post("/assessments/upsert", response_model=Assessment)
async def upsert_assessment(payload: AssessmentBase, user: dict = Depends(get_current_user)):
    """Upsert idempotente: dedup su patient_id + index_type + date (ISO slice 10).
    Se esiste già un record con stessa chiave aggiorna i campi; altrimenti crea."""
    await verify_patient_in_org(payload.patient_id, user["organization_id"])
    date_key = (payload.date or "")[:10]
    filter_: dict = {
        "patient_id": payload.patient_id,
        "organization_id": user["organization_id"],
        "index_type": payload.index_type,
    }
    if date_key:
        filter_["date"] = {"$regex": f"^{re.escape(date_key)}"}
    existing = await db.assessments.find_one(filter_, {"_id": 0})
    if existing:
        await db.assessments.update_one(
            {"id": existing["id"]},
            {"$set": payload.model_dump(exclude_none=True)},
        )
        return await db.assessments.find_one({"id": existing["id"]}, {"_id": 0})
    a = Assessment(
        **payload.model_dump(),
        organization_id=user["organization_id"],
        created_by=user["id"],
        created_by_name=user.get("name"),
    )
    await db.assessments.insert_one(a.model_dump())
    return a


# ── Instrumental Exams ────────────────────────────────────────────────────────

@router.post("/instrumental-exams", response_model=InstrumentalExam)
async def create_instrumental_exam(payload: InstrumentalExamBase, user: dict = Depends(get_current_user)):
    await verify_patient_in_org(payload.patient_id, user["organization_id"])
    exam = InstrumentalExam(
        **payload.model_dump(),
        organization_id=user["organization_id"],
        created_by=user["id"],
        created_by_name=user.get("name"),
    )
    await db.instrumental_exams.insert_one(exam.model_dump())
    return exam


@router.get("/patients/{patient_id}/instrumental-exams", response_model=List[InstrumentalExam])
async def list_patient_instrumental_exams(patient_id: str, user: dict = Depends(get_current_user)):
    await verify_patient_in_org(patient_id, user["organization_id"])
    docs = await db.instrumental_exams.find(
        {"patient_id": patient_id, "organization_id": user["organization_id"]}, {"_id": 0}
    ).sort("exam_date", -1).to_list(2000)
    return docs


@router.get("/instrumental-exams/{exam_id}", response_model=InstrumentalExam)
async def get_instrumental_exam(exam_id: str, user: dict = Depends(get_current_user)):
    doc = await db.instrumental_exams.find_one(
        {"id": exam_id, "organization_id": user["organization_id"]}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Esame strumentale non trovato")
    return doc


@router.put("/instrumental-exams/{exam_id}", response_model=InstrumentalExam)
async def update_instrumental_exam(exam_id: str, payload: InstrumentalExamUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    result = await db.instrumental_exams.update_one(
        {"id": exam_id, "organization_id": user["organization_id"]},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Esame strumentale non trovato")
    return await db.instrumental_exams.find_one({"id": exam_id, "organization_id": user["organization_id"]}, {"_id": 0})


@router.delete("/instrumental-exams/{exam_id}")
async def delete_instrumental_exam(exam_id: str, user: dict = Depends(get_current_user)):
    result = await db.instrumental_exams.delete_one(
        {"id": exam_id, "organization_id": user["organization_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Esame strumentale non trovato")
    return {"success": True}


@router.post("/instrumental-exams/upsert", response_model=InstrumentalExam)
async def upsert_instrumental_exam(payload: InstrumentalExamBase, user: dict = Depends(get_current_user)):
    """Upsert idempotente: dedup su patient_id + exam_type + date (ISO slice 10) + territory.
    Se esiste già un record con stessa chiave lo restituisce invariato; altrimenti crea."""
    await verify_patient_in_org(payload.patient_id, user["organization_id"])
    date_key = (payload.exam_date or "")[:10]
    filter_: dict = {
        "patient_id": payload.patient_id,
        "organization_id": user["organization_id"],
        "exam_type": payload.exam_type,
    }
    if date_key:
        filter_["exam_date"] = {"$regex": f"^{re.escape(date_key)}"}
    if payload.territory:
        filter_["territory"] = payload.territory
    existing = await db.instrumental_exams.find_one(filter_, {"_id": 0})
    if existing:
        return existing
    exam = InstrumentalExam(
        **payload.model_dump(),
        organization_id=user["organization_id"],
        created_by=user["id"],
        created_by_name=user.get("name"),
    )
    await db.instrumental_exams.insert_one(exam.model_dump())
    return exam


# ── Criteria Evaluations ──────────────────────────────────────────────────────

@router.post("/criteria-evaluations", response_model=CriteriaEvaluation)
async def create_criteria_evaluation(payload: CriteriaEvaluationBase, user: dict = Depends(get_current_user)):
    await verify_patient_in_org(payload.patient_id, user["organization_id"])
    ev = CriteriaEvaluation(
        **payload.model_dump(),
        organization_id=user["organization_id"],
        created_by=user["id"],
        created_by_name=user.get("name"),
    )
    await db.criteria_evaluations.insert_one(ev.model_dump())
    return ev


@router.get("/patients/{patient_id}/criteria-evaluations", response_model=List[CriteriaEvaluation])
async def list_patient_criteria(patient_id: str, user: dict = Depends(get_current_user)):
    await verify_patient_in_org(patient_id, user["organization_id"])
    return await db.criteria_evaluations.find({"patient_id": patient_id}, {"_id": 0}).sort("date", -1).to_list(2000)


@router.delete("/criteria-evaluations/{evaluation_id}")
async def delete_criteria_evaluation(evaluation_id: str, user: dict = Depends(get_current_user)):
    result = await db.criteria_evaluations.delete_one(
        {"id": evaluation_id, "organization_id": user["organization_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Valutazione non trovata")
    return {"success": True}


# ── Therapies ─────────────────────────────────────────────────────────────────

@router.post("/therapies", response_model=Therapy)
async def create_therapy(payload: TherapyBase, user: dict = Depends(get_current_user)):
    """
    Legacy create endpoint — inserts a new episode unconditionally.
    Backfills drug_canonical / therapy_type / relevance if not provided.
    """
    await verify_patient_in_org(payload.patient_id, user["organization_id"])
    if (payload.status or "active") == "active":
        await _auto_discontinue_competing(
            payload.patient_id, user["organization_id"], payload.category, payload.start_date
        )
    data = payload.model_dump()
    if not data.get("drug_canonical"):
        data["drug_canonical"] = _norm_drug_canonical(payload.drug_name)
    if not data.get("therapy_type"):
        data["therapy_type"] = _derive_therapy_type(payload.category)
    if not data.get("relevance"):
        data["relevance"] = _derive_relevance(payload.category)
    t = Therapy(
        **data,
        organization_id=user["organization_id"],
        created_by=user["id"],
        created_by_name=user.get("name"),
    )
    await db.therapies.insert_one(t.model_dump())
    return t


async def _refresh_exit_snapshot_for_visit(
    visit_id: Optional[str], patient_id: str, organization_id: str
) -> None:
    if not visit_id:
        return
    visit = await db.workup_visits.find_one(
        {"id": visit_id, "organization_id": organization_id},
        {"_id": 0, "visit_date": 1},
    )
    if not visit:
        return
    visit_date = visit.get("visit_date") or ""
    if not visit_date:
        return
    episodes = await db.therapies.find(
        {"patient_id": patient_id, "organization_id": organization_id},
        {"_id": 0},
    ).to_list(2000)
    await db.workup_visits.update_one(
        {"id": visit_id, "organization_id": organization_id},
        {"$set": {"exit_therapies_text": compute_exit_therapies_text(episodes, visit_date)}},
    )


@router.post("/therapies/upsert", response_model=Therapy)
async def upsert_therapy(payload: TherapyUpsert, user: dict = Depends(get_current_user)):
    result = await _upsert_therapy_impl(payload, user)
    await _refresh_exit_snapshot_for_visit(
        payload.visit_id, payload.patient_id, user["organization_id"]
    )
    return result


async def _upsert_therapy_impl(payload: TherapyUpsert, user: dict):
    """
    Episode-aware upsert.

    Standard rules (no event_type_override):
    - Active episode + incoming active + same dose   → event: continued
    - Active episode + incoming active + dose change → event: dose_increased / dose_reduced
    - Active episode + incoming discontinued         → event: discontinued, close episode
    - No active episode + incoming active            → new episode, event: started
    - No active episode + incoming discontinued      → new episode (historical), event: discontinued

    noted (event_type_override="noted"):
    - Active episode found + same dose               → skip, no duplicate
    - Active episode found + dose changed            → event: dose_increased / dose_reduced
    - No active episode                              → new active episode, event: noted
      (start_date may be null — therapy already ongoing at first contact)

    historical_exposure (event_type_override="historical_exposure"):
    - NEVER modifies active episodes
    - Looks for duplicate discontinued episodes of same canonical in overlapping year range
    - Duplicate found                                → returns existing without changes
    - No duplicate                                   → new discontinued episode,
      events: [historical_exposure, discontinued (with reason if provided)]
    """
    await verify_patient_in_org(payload.patient_id, user["organization_id"])

    today = datetime.now(timezone.utc).date().isoformat()
    canonical = payload.drug_canonical or _norm_drug_canonical(payload.drug_name)
    therapy_type = payload.therapy_type or _derive_therapy_type(payload.category)
    relevance = payload.relevance or _derive_relevance(payload.category)
    first_seen = payload.first_seen_date or today
    override = payload.event_type_override

    base_event = {
        "visit_id": payload.visit_id,
        "created_by": user["id"],
        "created_by_name": user.get("name"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    # ══════════════════════════════════════════════════════════════════════════
    # PATHWAY: historical_exposure
    # Anamnestic past therapy — never touch active episodes.
    # ══════════════════════════════════════════════════════════════════════════
    if override == "historical_exposure":
        existing_hist = await _find_duplicate_discontinued(
            payload.patient_id,
            user["organization_id"],
            canonical,
            payload.end_date or payload.start_date,
            payload.discontinuation_reason,
        )
        if existing_hist:
            existing_hist["_duplicate"] = True
            return existing_hist

        # Build two events: historical_exposure (start) + discontinued (end/reason)
        hist_event = {
            **base_event,
            "type": "historical_exposure",
            "date": payload.start_date or first_seen,
            "date_approximate": payload.date_approximate,
            "dose": payload.dose,
            "notes": payload.notes,
        }
        events = [TherapyEvent(**hist_event)]
        if payload.discontinuation_reason or payload.end_date:
            disc_event = {
                **base_event,
                "type": "discontinued",
                "date": payload.end_date or first_seen,
                "date_approximate": payload.date_approximate,
                "dose": payload.dose,
                "reason": payload.discontinuation_reason,
            }
            events.append(TherapyEvent(**disc_event))

        t = Therapy(
            patient_id=payload.patient_id,
            drug_name=payload.drug_name,
            drug_canonical=canonical,
            category=payload.category,
            therapy_type=therapy_type,
            relevance=relevance,
            indication=payload.indication,
            dose=payload.dose,
            route=payload.route,
            start_date=payload.start_date,
            end_date=payload.end_date,
            first_seen_date=first_seen,
            date_approximate=payload.date_approximate,
            source=payload.source or "anamnesi_prima_visita",
            status="discontinued",
            discontinuation_reason=payload.discontinuation_reason,
            notes=payload.notes,
            visit_id=payload.visit_id,
            events=events,
            organization_id=user["organization_id"],
            created_by=user["id"],
            created_by_name=user.get("name"),
        )
        await db.therapies.insert_one(t.model_dump())
        return t

    # ══════════════════════════════════════════════════════════════════════════
    # PATHWAY: noted  +  standard
    # Both look for an active episode first.
    # ══════════════════════════════════════════════════════════════════════════
    event_date = payload.start_date or today
    existing = await _find_active_episode(payload.patient_id, user["organization_id"], canonical)

    print(f"[upsert_therapy] drug={payload.drug_name!r} canonical={canonical!r} source={payload.source!r} override={override!r}")
    print(f"[upsert_therapy] _find_active_episode → {'trovato id=' + existing.get('id','?') if existing else 'NESSUN episodio attivo'}")
    if existing:
        print(f"[upsert_therapy] existing.dose={existing.get('dose')!r} existing.drug_canonical={existing.get('drug_canonical')!r}")

    if existing:
        episode_id = existing["id"]

        # noted + active episode → skip silently unless dose or regimen changed
        if override == "noted":
            existing_mg = _extract_dose_mg(existing.get("dose"))
            new_mg = _extract_dose_mg(payload.dose)
            dose_changed  = (existing_mg is not None and new_mg is not None and existing_mg != new_mg)
            freq_changed  = bool(payload.frequency and payload.frequency != existing.get("frequency"))
            route_changed = bool(payload.route and payload.route != existing.get("route"))
            if dose_changed:
                evt_type = "dose_increased" if new_mg > existing_mg else "dose_reduced"
                event: dict = {
                    **base_event, "type": evt_type,
                    "date": first_seen,
                    "dose_before": existing.get("dose"),
                    "dose_after": payload.dose,
                    "dose": payload.dose,
                    "reason": payload.notes,
                }
                if freq_changed:
                    event["frequency_before"] = existing.get("frequency")
                    event["frequency_after"]  = payload.frequency
                if route_changed:
                    event["route_before"] = existing.get("route")
                    event["route_after"]  = payload.route
                await _append_therapy_event_and_project(
                    {"id": episode_id},
                    event,
                    {"drug_canonical": canonical, "therapy_type": therapy_type,
                     "relevance": relevance},
                )
            elif freq_changed or route_changed:
                event = {**base_event, "type": "regimen_changed", "date": first_seen,
                         "dose": existing.get("dose"), "reason": payload.notes}
                if freq_changed:
                    event["frequency_before"] = existing.get("frequency")
                    event["frequency_after"]  = payload.frequency
                if route_changed:
                    event["route_before"] = existing.get("route")
                    event["route_after"]  = payload.route
                await _append_therapy_event_and_project(
                    {"id": episode_id},
                    event,
                    {"drug_canonical": canonical, "therapy_type": therapy_type,
                     "relevance": relevance},
                )
            else:
                # Identical active episode — just backfill metadata
                await db.therapies.update_one(
                    {"id": episode_id},
                    {"$set": {"drug_canonical": canonical, "therapy_type": therapy_type,
                              "relevance": relevance}},
                )
            return await db.therapies.find_one({"id": episode_id}, {"_id": 0})

        # Standard pathway — active episode found
        if payload.status == "discontinued":
            reason = payload.discontinuation_reason or payload.notes
            event = {**base_event, "type": "discontinued", "date": event_date,
                     "dose": existing.get("dose"), "reason": reason}
            await _append_therapy_event_and_project(
                {"id": episode_id},
                event,
                {"drug_canonical": canonical, "therapy_type": therapy_type,
                 "relevance": relevance},
            )
        else:
            existing_mg = _extract_dose_mg(existing.get("dose"))
            new_mg = _extract_dose_mg(payload.dose)
            dose_changed  = (existing_mg is not None and new_mg is not None and existing_mg != new_mg)
            freq_changed  = bool(payload.frequency and payload.frequency != existing.get("frequency"))
            route_changed = bool(payload.route and payload.route != existing.get("route"))
            print(f"[upsert_therapy] existing_mg={existing_mg} new_mg={new_mg} dose_changed={dose_changed} freq_changed={freq_changed}")
            if dose_changed:
                evt_type = "dose_increased" if new_mg > existing_mg else "dose_reduced"
                ev: dict = {**base_event, "type": evt_type, "date": event_date,
                            "dose_before": existing.get("dose"), "dose_after": payload.dose,
                            "dose": payload.dose, "reason": payload.notes}
                if freq_changed:
                    ev["frequency_before"] = existing.get("frequency")
                    ev["frequency_after"]  = payload.frequency
                if route_changed:
                    ev["route_before"] = existing.get("route")
                    ev["route_after"]  = payload.route
                await _append_therapy_event_and_project(
                    {"id": episode_id},
                    ev,
                    {"drug_canonical": canonical, "therapy_type": therapy_type,
                     "relevance": relevance},
                )
            elif freq_changed or route_changed:
                # Regimen change only (dose unchanged): spacing, route switch, etc.
                ev = {**base_event, "type": "regimen_changed", "date": event_date,
                      "dose": existing.get("dose"), "reason": payload.notes}
                if freq_changed:
                    ev["frequency_before"] = existing.get("frequency")
                    ev["frequency_after"]  = payload.frequency
                if route_changed:
                    ev["route_before"] = existing.get("route")
                    ev["route_after"]  = payload.route
                await _append_therapy_event_and_project(
                    {"id": episode_id},
                    ev,
                    {"drug_canonical": canonical, "therapy_type": therapy_type,
                     "relevance": relevance},
                )
            else:
                eff_relevance = existing.get("relevance") or relevance
                backfill = {"drug_canonical": canonical, "therapy_type": therapy_type,
                            "relevance": relevance}
                if eff_relevance == "high":
                    ev = {**base_event, "type": "continued", "date": event_date,
                          "dose": existing.get("dose")}
                    await _append_therapy_event_and_project(
                        {"id": episode_id},
                        ev,
                        backfill,
                    )
                else:
                    await db.therapies.update_one({"id": episode_id}, {"$set": backfill})

        return await db.therapies.find_one({"id": episode_id}, {"_id": 0})

    else:
        # ── No active episode — open a new one ────────────────────────────────
        incoming_status = payload.status or "active"

        if override == "noted":
            # Therapy already ongoing at first contact — capture initial regimen
            event = {**base_event, "type": "noted", "date": first_seen,
                     "dose": payload.dose, "notes": payload.notes,
                     "frequency_after": payload.frequency or None,
                     "route_after": payload.route or None}
            t = Therapy(
                patient_id=payload.patient_id,
                drug_name=payload.drug_name,
                drug_canonical=canonical,
                category=payload.category,
                therapy_type=therapy_type,
                relevance=relevance,
                indication=payload.indication,
                dose=payload.dose,
                frequency=payload.frequency,
                route=payload.route,
                start_date=payload.start_date,       # may be null — real start unknown
                first_seen_date=first_seen,
                date_approximate=payload.date_approximate,
                source=payload.source or "anamnesi_prima_visita",
                status="active",
                notes=payload.notes,
                visit_id=payload.visit_id,
                events=[TherapyEvent(**event)],
                organization_id=user["organization_id"],
                created_by=user["id"],
                created_by_name=user.get("name"),
            )
            await db.therapies.insert_one(t.model_dump())
            return t

        if incoming_status == "discontinued":
            dup = await _find_duplicate_discontinued(
                payload.patient_id,
                user["organization_id"],
                canonical,
                payload.end_date or payload.start_date,
                payload.discontinuation_reason,
            )
            if dup:
                dup["_duplicate"] = True
                return dup

        # Standard: new episode
        if incoming_status == "active":
            await _auto_discontinue_competing(
                payload.patient_id, user["organization_id"], payload.category, payload.start_date
            )
        evt_type = "started" if incoming_status == "active" else "discontinued"
        event = {
            **base_event,
            "type": evt_type,
            "date": event_date,
            "dose": payload.dose,
            "reason": payload.discontinuation_reason or payload.notes if evt_type == "discontinued" else None,
            # Capture initial regimen on "started" so therapy_state_at() can bootstrap correctly
            **({"frequency_after": payload.frequency or None,
                "route_after":     payload.route     or None} if evt_type == "started" else {}),
        }
        t = Therapy(
            patient_id=payload.patient_id,
            drug_name=payload.drug_name,
            drug_canonical=canonical,
            category=payload.category,
            therapy_type=therapy_type,
            relevance=relevance,
            indication=payload.indication,
            dose=payload.dose,
            frequency=payload.frequency,
            route=payload.route,
            start_date=payload.start_date,
            end_date=event_date if incoming_status == "discontinued" else None,
            first_seen_date=first_seen,
            source=payload.source,
            status=incoming_status,
            discontinuation_reason=payload.discontinuation_reason,
            notes=payload.notes,
            visit_id=payload.visit_id,
            events=[TherapyEvent(**event)],
            organization_id=user["organization_id"],
            created_by=user["id"],
            created_by_name=user.get("name"),
        )
        await db.therapies.insert_one(t.model_dump())
        return t


@router.post("/therapies/{therapy_id}/events", response_model=Therapy)
async def add_therapy_event(
    therapy_id: str,
    payload: TherapyEventAdd,
    user: dict = Depends(get_current_user),
):
    """
    Manually append a clinical event to an existing therapy episode.
    Side-effects on the episode document:
      discontinued  → status=discontinued, end_date=payload.date
      dose_increased / dose_reduced → dose=dose_after
      resumed_within → status=active, end_date=None
      paused → status=paused
    """
    existing = await db.therapies.find_one(
        {"id": therapy_id, "organization_id": user["organization_id"]}, {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Episodio terapeutico non trovato")

    event = TherapyEvent(
        **payload.model_dump(),
        created_by=user["id"],
        created_by_name=user.get("name"),
    )

    await _append_therapy_event_and_project(
        {"id": therapy_id, "organization_id": user["organization_id"]},
        event.model_dump(),
    )
    return await db.therapies.find_one({"id": therapy_id, "organization_id": user["organization_id"]}, {"_id": 0})


@router.get("/patients/{patient_id}/therapies", response_model=List[Therapy])
async def list_patient_therapies(patient_id: str, user: dict = Depends(get_current_user)):
    await verify_patient_in_org(patient_id, user["organization_id"])
    return await db.therapies.find({"patient_id": patient_id}, {"_id": 0}).sort("start_date", -1).to_list(2000)


# ── Point-in-time therapy reconstruction ─────────────────────────────────────
# _episode_state_at and _therapy_state_at are canonical helpers defined once in
# helpers.py and imported at the top of this module.


@router.get("/patients/{patient_id}/therapies/state")
async def get_therapy_state_at(
    patient_id: str,
    date: str,
    user: dict = Depends(get_current_user),
):
    """
    Point-in-time therapy reconstruction.

    Returns the list of therapies that were active for `patient_id` on `date`
    (ISO-8601, YYYY-MM-DD), with historically-accurate dose, frequency, and
    route reconstructed by walking the events[] log of each episode.

    This is the canonical replacement for the legacy _therapies_active_on()
    pattern which returned current (not historical) dose/frequency values.
    """
    await verify_patient_in_org(patient_id, user["organization_id"])
    episodes = await db.therapies.find(
        {"patient_id": patient_id, "organization_id": user["organization_id"]},
        {"_id": 0},
    ).to_list(2000)
    return _therapy_state_at(episodes, date)


@router.put("/therapies/{therapy_id}", response_model=Therapy)
async def update_therapy(therapy_id: str, payload: TherapyUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
    current = await db.therapies.find_one(
        {"id": therapy_id, "organization_id": user["organization_id"]}, {"_id": 0}
    )
    if not current:
        raise HTTPException(status_code=404, detail="Terapia non trovata")

    longitudinal_fields = {
        "status",
        "dose",
        "frequency",
        "route",
        "end_date",
        "discontinuation_reason",
    }
    def _norm(v):
        return None if v in (None, "") else v

    direct_update = {k: v for k, v in update_data.items() if k not in longitudinal_fields}
    longitudinal_update = {
        k: v
        for k, v in update_data.items()
        if k in longitudinal_fields and _norm(v) != _norm(current.get(k))
    }

    new_status = update_data.get("status", current.get("status"))
    new_category = update_data.get("category", current.get("category"))
    new_start = update_data.get("start_date", current.get("start_date"))
    if new_status == "active":
        await _auto_discontinue_competing(
            current["patient_id"], user["organization_id"], new_category, new_start, exclude_id=therapy_id
        )

    if longitudinal_update:
        today = datetime.now(timezone.utc).date().isoformat()
        event_date = longitudinal_update.get("end_date") or today
        reason = longitudinal_update.get("discontinuation_reason") or update_data.get("notes")
        event_type = payload.therapy_event

        if longitudinal_update.get("status") == "discontinued" or "end_date" in longitudinal_update:
            event_type = "discontinued"
        elif longitudinal_update.get("status") == "paused":
            event_type = "paused"
        elif longitudinal_update.get("status") == "active" and current.get("status") != "active":
            event_type = "resumed_within"
        elif "dose" in longitudinal_update:
            current_mg = _extract_dose_mg(current.get("dose"))
            new_mg = _extract_dose_mg(longitudinal_update.get("dose"))
            if current_mg is not None and new_mg is not None and new_mg != current_mg:
                event_type = "dose_increased" if new_mg > current_mg else "dose_reduced"
            else:
                event_type = event_type or "regimen_changed"
        elif "frequency" in longitudinal_update or "route" in longitudinal_update:
            event_type = "regimen_changed"
        elif "discontinuation_reason" in longitudinal_update:
            event_type = "discontinued"

        event = {
            "type": event_type or "noted",
            "date": event_date,
            "dose": longitudinal_update.get("dose", current.get("dose")),
            "dose_before": current.get("dose") if "dose" in longitudinal_update else None,
            "dose_after": longitudinal_update.get("dose") if "dose" in longitudinal_update else None,
            "frequency_before": current.get("frequency") if "frequency" in longitudinal_update else None,
            "frequency_after": longitudinal_update.get("frequency") if "frequency" in longitudinal_update else None,
            "route_before": current.get("route") if "route" in longitudinal_update else None,
            "route_after": longitudinal_update.get("route") if "route" in longitudinal_update else None,
            "reason": reason,
            "created_by": user["id"],
            "created_by_name": user.get("name"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "notes": update_data.get("notes"),
        }
        event = TherapyEvent(**event).model_dump()
        result = await _append_therapy_event_and_project(
            {"id": therapy_id, "organization_id": user["organization_id"]},
            event,
            direct_update,
        )
    elif direct_update:
        result = await db.therapies.update_one(
            {"id": therapy_id, "organization_id": user["organization_id"]},
            {"$set": direct_update},
        )
    else:
        result = None

    if result and result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Terapia non trovata")
    return await db.therapies.find_one({"id": therapy_id, "organization_id": user["organization_id"]}, {"_id": 0})


@router.delete("/therapies/{therapy_id}")
async def delete_therapy(therapy_id: str, user: dict = Depends(get_current_user)):
    result = await db.therapies.delete_one(
        {"id": therapy_id, "organization_id": user["organization_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Terapia non trovata")
    return {"success": True}


# ── Lab Exams ─────────────────────────────────────────────────────────────────

@router.post("/lab-exams/upsert", response_model=LabExam)
async def upsert_lab_exam(payload: LabExamBase, user: dict = Depends(get_current_user)):
    """One record per patient+date. If a record already exists for this date, merges values (new wins on conflict).
    Gli esami senza data (date=None) vengono sempre inseriti come nuovo record: non si fondono mai tra loro."""
    await verify_patient_in_org(payload.patient_id, user["organization_id"])
    existing = await db.lab_exams.find_one(
        {"patient_id": payload.patient_id, "date": payload.date, "organization_id": user["organization_id"]},
        {"_id": 0},
    ) if payload.date else None
    if existing:
        merged = {**existing.get("values", {}), **payload.values}
        await db.lab_exams.update_one(
            {"id": existing["id"]},
            {"$set": {"values": merged, "panel": None}},
        )
        return await db.lab_exams.find_one({"id": existing["id"]}, {"_id": 0})
    e = LabExam(
        **payload.model_dump(),
        organization_id=user["organization_id"],
        created_by=user["id"],
        created_by_name=user.get("name"),
    )
    await db.lab_exams.insert_one(e.model_dump())
    return e


@router.post("/lab-exams", response_model=LabExam)
async def create_lab_exam(payload: LabExamBase, user: dict = Depends(get_current_user)):
    await verify_patient_in_org(payload.patient_id, user["organization_id"])
    e = LabExam(
        **payload.model_dump(),
        organization_id=user["organization_id"],
        created_by=user["id"],
        created_by_name=user.get("name"),
    )
    await db.lab_exams.insert_one(e.model_dump())
    return e


@router.get("/patients/{patient_id}/lab-exams", response_model=List[LabExam])
async def list_patient_lab_exams(patient_id: str, user: dict = Depends(get_current_user)):
    await verify_patient_in_org(patient_id, user["organization_id"])
    return await db.lab_exams.find({"patient_id": patient_id}, {"_id": 0}).sort("date", -1).to_list(2000)


@router.put("/lab-exams/{exam_id}", response_model=LabExam)
async def update_lab_exam(exam_id: str, payload: LabExamBase, user: dict = Depends(get_current_user)):
    result = await db.lab_exams.update_one(
        {"id": exam_id, "organization_id": user["organization_id"]},
        {"$set": payload.model_dump()},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Esame non trovato")
    return await db.lab_exams.find_one({"id": exam_id, "organization_id": user["organization_id"]}, {"_id": 0})


@router.delete("/lab-exams/{exam_id}")
async def delete_lab_exam(exam_id: str, user: dict = Depends(get_current_user)):
    result = await db.lab_exams.delete_one(
        {"id": exam_id, "organization_id": user["organization_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Esame non trovato")
    return {"success": True}


# ── Specialist Visits ─────────────────────────────────────────────────────────

@router.post("/specialist-visits", response_model=SpecialistVisit)
async def create_specialist_visit(payload: SpecialistVisitBase, user: dict = Depends(get_current_user)):
    await verify_patient_in_org(payload.patient_id, user["organization_id"])
    sv = SpecialistVisit(
        **payload.model_dump(),
        organization_id=user["organization_id"],
        created_by=user["id"],
        created_by_name=user.get("name") or user.get("email"),
    )
    await db.specialist_visits.insert_one(sv.model_dump())
    return sv


@router.get("/patients/{patient_id}/specialist-visits", response_model=List[SpecialistVisit])
async def list_specialist_visits(patient_id: str, user: dict = Depends(get_current_user)):
    await verify_patient_in_org(patient_id, user["organization_id"])
    return await db.specialist_visits.find(
        {"patient_id": patient_id, "organization_id": user["organization_id"]}, {"_id": 0}
    ).sort("visit_date", -1).to_list(500)


@router.put("/specialist-visits/{visit_id}", response_model=SpecialistVisit)
async def update_specialist_visit(visit_id: str, payload: SpecialistVisitBase, user: dict = Depends(get_current_user)):
    result = await db.specialist_visits.update_one(
        {"id": visit_id, "organization_id": user["organization_id"]},
        {"$set": payload.model_dump()},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Visita non trovata")
    return await db.specialist_visits.find_one({"id": visit_id, "organization_id": user["organization_id"]}, {"_id": 0})


@router.delete("/specialist-visits/{visit_id}")
async def delete_specialist_visit(visit_id: str, user: dict = Depends(get_current_user)):
    result = await db.specialist_visits.delete_one(
        {"id": visit_id, "organization_id": user["organization_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Visita non trovata")
    return {"success": True}
