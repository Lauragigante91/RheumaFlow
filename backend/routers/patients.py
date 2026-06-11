"""
Patient CRUD, anonymization, recall flags, and dashboard queries.
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any, Dict

from fastapi import APIRouter, HTTPException, Depends, Body
from pydantic import BaseModel, Field

from database import db
from auth_utils import get_current_user
from models import Patient, PatientBase, PatientUpdate
from helpers import verify_patient_in_org

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Recall flag payload (extended vs models.py — includes shared_with) ────────
class RecallFlagPayload(BaseModel):
    flag: Optional[str] = None       # "private" | "selected" | "shared" | None
    note: Optional[str] = None
    shared_with: Optional[List[str]] = None  # user IDs; only for flag == "selected"


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/patients", response_model=Patient)
async def create_patient(payload: PatientBase, user: dict = Depends(get_current_user)):
    has_code = bool((payload.codice_paziente or "").strip())
    has_name = bool((payload.nome or "").strip() and (payload.cognome or "").strip())
    if not has_code and not has_name:
        raise HTTPException(
            status_code=400,
            detail="Fornire almeno il codice paziente o nome+cognome",
        )
    if has_code:
        existing = await db.patients.find_one({
            "organization_id": user["organization_id"],
            "codice_paziente": payload.codice_paziente.strip(),
        })
        if existing:
            raise HTTPException(status_code=400, detail="Codice paziente già esistente nell'UO")
    p = Patient(
        **payload.model_dump(),
        organization_id=user["organization_id"],
        created_by=user["id"],
        created_by_name=user.get("name"),
    )
    await db.patients.insert_one(p.model_dump())
    return p


@router.post("/patients/{patient_id}/anonymize", response_model=Patient)
async def anonymize_patient(patient_id: str, user: dict = Depends(get_current_user)):
    """Remove identifying fields (nome, cognome, CF, data_nascita), keep codice/anno/sesso/diagnosi."""
    await verify_patient_in_org(patient_id, user["organization_id"])
    patient = await db.patients.find_one(
        {"id": patient_id, "organization_id": user["organization_id"]}, {"_id": 0}
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Paziente non trovato")

    update = {"nome": None, "cognome": None, "codice_fiscale": None, "data_nascita": None}
    if patient.get("data_nascita") and not patient.get("anno_nascita"):
        try:
            update["anno_nascita"] = int(patient["data_nascita"][:4])
        except (ValueError, TypeError) as exc:
            # data_nascita is malformed; anno_nascita stays unset — not a blocking error.
            logger.debug(
                "Could not parse birth year from data_nascita=%r for patient %s: %s",
                patient.get("data_nascita"), patient_id, exc,
            )
    if not patient.get("codice_paziente"):
        update["codice_paziente"] = f"PZ-{patient_id[:8].upper()}"
    await db.patients.update_one({"id": patient_id}, {"$set": update})
    return await db.patients.find_one({"id": patient_id}, {"_id": 0})


@router.get("/patients", response_model=List[Patient])
async def list_patients(user: dict = Depends(get_current_user)):
    docs = await db.patients.find({"organization_id": user["organization_id"]}, {"_id": 0}).to_list(2000)
    docs.sort(key=lambda p: (p.get("cognome") or p.get("codice_paziente") or "").lower())
    return docs


@router.get("/patients/{patient_id}", response_model=Patient)
async def get_patient(patient_id: str, user: dict = Depends(get_current_user)):
    doc = await db.patients.find_one(
        {"id": patient_id, "organization_id": user["organization_id"]}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Paziente non trovato")
    return doc


@router.put("/patients/{patient_id}", response_model=Patient)
async def update_patient(patient_id: str, payload: PatientUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
    result = await db.patients.update_one(
        {"id": patient_id, "organization_id": user["organization_id"]},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Paziente non trovato")
    return await db.patients.find_one({"id": patient_id}, {"_id": 0})


@router.patch("/patients/{patient_id}", response_model=Patient)
async def patch_patient(
    patient_id: str,
    payload: Dict[str, Any] = Body(...),
    user: dict = Depends(get_current_user),
):
    """Non-destructive partial update of a patient document.

    - Non-null field values  → ``$set``   (create or overwrite the field).
    - Explicit ``null`` values → ``$unset`` (remove the field from the document).
    - Fields absent from the payload are never touched.

    Returns the full updated patient document.
    """
    _IMMUTABLE = frozenset({
        "id", "patient_id", "organization_id",
        "created_by", "created_at", "created_by_name",
    })
    await verify_patient_in_org(patient_id, user["organization_id"])
    if not payload:
        doc = await db.patients.find_one({"id": patient_id}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="Paziente non trovato")
        return doc

    safe      = {k: v for k, v in payload.items() if k not in _IMMUTABLE}
    set_ops   = {k: v for k, v in safe.items() if v is not None}
    unset_ops = {k: "" for k, v in safe.items() if v is None}

    mongo_ops: Dict[str, Any] = {}
    if set_ops:   mongo_ops["$set"]   = set_ops
    if unset_ops: mongo_ops["$unset"] = unset_ops

    if mongo_ops:
        result = await db.patients.update_one(
            {"id": patient_id, "organization_id": user["organization_id"]},
            mongo_ops,
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Paziente non trovato")

    return await db.patients.find_one({"id": patient_id}, {"_id": 0})


@router.delete("/patients/{patient_id}")
async def delete_patient(patient_id: str, user: dict = Depends(get_current_user)):
    result = await db.patients.delete_one({"id": patient_id, "organization_id": user["organization_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Paziente non trovato")
    await db.assessments.delete_many({"patient_id": patient_id})
    await db.criteria_evaluations.delete_many({"patient_id": patient_id})
    await db.therapies.delete_many({"patient_id": patient_id})
    await db.lab_exams.delete_many({"patient_id": patient_id})
    await db.reminders.delete_many({"patient_id": patient_id})
    await db.sclero_profiles.delete_many({"patient_id": patient_id})
    await db.disease_profiles.delete_many({"patient_id": patient_id})
    await db.workup_visits.delete_many({"patient_id": patient_id})
    await db.clinical_events.delete_many({"patient_id": patient_id})
    await db.conditions.delete_many({"patient_id": patient_id})
    await db.pro_tokens.delete_many({"patient_id": patient_id})
    await db.consult_tokens.delete_many({"patient_id": patient_id})
    await db.specialist_visits.delete_many({"patient_id": patient_id})
    return {"success": True}


# ── Recall flags ──────────────────────────────────────────────────────────────

@router.put("/patients/{patient_id}/recall")
async def set_patient_recall(
    patient_id: str,
    payload: RecallFlagPayload,
    user: dict = Depends(get_current_user),
):
    if payload.flag not in (None, "", "private", "selected", "shared"):
        raise HTTPException(status_code=400, detail="flag deve essere 'private', 'selected', 'shared' o nullo")
    p = await db.patients.find_one(
        {"id": patient_id, "organization_id": user["organization_id"]},
        {"_id": 0, "id": 1},
    )
    if not p:
        raise HTTPException(status_code=404, detail="Paziente non trovato")

    if not payload.flag:
        await db.patients.update_one({"id": patient_id}, {"$unset": {"recall": ""}})
        return {"success": True, "recall": None}

    recall = {
        "flag": payload.flag,
        "note": (payload.note or "").strip(),
        "set_at": datetime.now(timezone.utc).isoformat(),
        "set_by": user["id"],
        "set_by_name": user.get("name") or user.get("email"),
    }
    if payload.flag == "selected":
        recall["shared_with"] = [uid for uid in (payload.shared_with or []) if uid != user["id"]]
    else:
        recall["shared_with"] = []

    await db.patients.update_one({"id": patient_id}, {"$set": {"recall": recall}})
    return {"success": True, "recall": recall}


@router.get("/patients-recall")
async def list_patients_to_recall(user: dict = Depends(get_current_user)):
    """Pazienti con recall flag visibili a questo utente."""
    org_id = user["organization_id"]
    uid = user["id"]
    cursor = db.patients.find(
        {
            "organization_id": org_id,
            "$or": [
                {"recall.flag": "shared"},
                {"recall.flag": "private", "recall.set_by": uid},
                {"recall.flag": "selected", "recall.set_by": uid},
                {"recall.flag": "selected", "recall.shared_with": uid},
            ],
        },
        {"_id": 0},
    )
    out = []
    async for p in cursor:
        out.append(p)
    out.sort(key=lambda p: (p.get("recall", {}).get("set_at") or ""), reverse=True)
    return out


@router.get("/patients-recent-mine")
async def list_recent_patients_mine(days: int = 7, user: dict = Depends(get_current_user)):
    """Pazienti su cui l'utente ha lavorato negli ultimi `days` giorni."""
    org_id = user["organization_id"]
    days = max(1, min(365, days))
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    pipeline = [
        {"$match": {
            "organization_id": org_id,
            "created_by": user["id"],
            "created_at": {"$gte": cutoff},
        }},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$patient_id",
            "last_assessment_at": {"$first": "$created_at"},
            "last_index_type": {"$first": "$index_type"},
            "last_score": {"$first": "$score"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"last_assessment_at": -1}},
        {"$limit": 20},
    ]
    items = []
    async for doc in db.assessments.aggregate(pipeline):
        items.append(doc)
    if not items:
        return []
    pids = [i["_id"] for i in items]
    patients = {
        p["id"]: p
        for p in await db.patients.find(
            {"id": {"$in": pids}, "organization_id": org_id}, {"_id": 0}
        ).to_list(1000)
    }
    out = []
    for it in items:
        p = patients.get(it["_id"])
        if not p:
            continue
        out.append({
            **p,
            "last_assessment_at": it["last_assessment_at"],
            "last_index_type": it["last_index_type"],
            "last_score": it["last_score"],
            "assessments_in_window": it["count"],
        })
    return out
