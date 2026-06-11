from fastapi import APIRouter, Depends, HTTPException, Body
from datetime import datetime, timezone
from typing import List, Optional

from database import db
from models import ClinicalEvent, ClinicalEventCreate, ClinicalEventBatch
from routers.auth import get_current_user
from helpers import verify_patient_in_org

router = APIRouter()


@router.get("/patients/{patient_id}/clinical-events")
async def list_clinical_events(
    patient_id: str,
    event_type: Optional[str] = None,
    confirmed: Optional[bool] = None,
    user: dict = Depends(get_current_user),
):
    await verify_patient_in_org(patient_id, user["organization_id"])
    query: dict = {
        "patient_id": patient_id,
        "organization_id": user["organization_id"],
        "deleted_at": None,
    }
    if event_type:
        query["event_type"] = event_type
    if confirmed is not None:
        query["confirmed_by_user"] = confirmed
    events = (
        await db.clinical_events
        .find(query, {"_id": 0})
        .sort("date_value", 1)
        .to_list(1000)
    )
    return events


@router.post("/patients/{patient_id}/clinical-events", response_model=ClinicalEvent)
async def create_clinical_event(
    patient_id: str,
    payload: ClinicalEventCreate,
    user: dict = Depends(get_current_user),
):
    await verify_patient_in_org(patient_id, user["organization_id"])
    ev = ClinicalEvent(
        **payload.model_dump(),
        patient_id=patient_id,
        organization_id=user["organization_id"],
        created_by=user["id"],
        created_by_name=user.get("name"),
    )
    await db.clinical_events.insert_one(ev.model_dump())
    return ev


@router.post("/patients/{patient_id}/clinical-events/batch")
async def batch_create_clinical_events(
    patient_id: str,
    payload: ClinicalEventBatch,
    user: dict = Depends(get_current_user),
):
    """
    Batch-create clinical events from a raccordo import review.
    All events in this call have been reviewed and confirmed by the clinician.
    No side-effects on db.therapies in V1 — events are stored independently.
    """
    await verify_patient_in_org(patient_id, user["organization_id"])
    docs = []
    for ev_data in payload.events:
        # Exclude fields set explicitly below (visit_id, confirmed_by_user) to avoid duplicate kwarg error
        base = ev_data.model_dump(exclude={"visit_id", "confirmed_by_user"})
        ev = ClinicalEvent(
            **base,
            patient_id=patient_id,
            organization_id=user["organization_id"],
            created_by=user["id"],
            created_by_name=user.get("name"),
            visit_id=ev_data.visit_id or payload.visit_id,
            confirmed_by_user=True,
            confirmed_at=datetime.now(timezone.utc).isoformat(),
            confirmed_by=user["id"],
        )
        docs.append(ev.model_dump())
    if docs:
        await db.clinical_events.insert_many(docs)
    return {"created": len(docs)}


@router.patch("/patients/{patient_id}/clinical-events/{event_id}")
async def update_clinical_event(
    patient_id: str,
    event_id: str,
    update_data: dict = Body(...),
    user: dict = Depends(get_current_user),
):
    await verify_patient_in_org(patient_id, user["organization_id"])
    # Strip immutable fields
    for k in ("id", "patient_id", "organization_id", "created_by", "created_at"):
        update_data.pop(k, None)
    # Stamp update metadata
    now = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = user["id"]
    update_data["updated_at"] = now
    result = await db.clinical_events.update_one(
        {
            "id": event_id,
            "patient_id": patient_id,
            "organization_id": user["organization_id"],
        },
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Evento clinico non trovato")
    return {"updated": True}


@router.patch("/patients/{patient_id}/clinical-events/{event_id}/confirm")
async def confirm_clinical_event(
    patient_id: str,
    event_id: str,
    user: dict = Depends(get_current_user),
):
    await verify_patient_in_org(patient_id, user["organization_id"])
    now = datetime.now(timezone.utc).isoformat()
    result = await db.clinical_events.update_one(
        {
            "id": event_id,
            "patient_id": patient_id,
            "organization_id": user["organization_id"],
        },
        {"$set": {
            "confirmed_by_user": True,
            "confirmed_at": now,
            "confirmed_by": user["id"],
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Evento clinico non trovato")
    return {"confirmed": True}


@router.delete("/patients/{patient_id}/clinical-events/{event_id}")
async def delete_clinical_event(
    patient_id: str,
    event_id: str,
    user: dict = Depends(get_current_user),
):
    await verify_patient_in_org(patient_id, user["organization_id"])
    now = datetime.now(timezone.utc).isoformat()
    result = await db.clinical_events.update_one(
        {
            "id": event_id,
            "patient_id": patient_id,
            "organization_id": user["organization_id"],
        },
        {"$set": {"deleted_at": now}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Evento clinico non trovato")
    return {"deleted": True}
