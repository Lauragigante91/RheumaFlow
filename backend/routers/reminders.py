"""
Reminder (task/follow-up) routes.
"""
from fastapi import APIRouter, HTTPException, Depends

from database import db
from auth_utils import get_current_user
from models import Reminder, ReminderBase, ReminderUpdate
from helpers import verify_patient_in_org

router = APIRouter()


def _visibility_query(user: dict) -> dict:
    """Filter: shared org reminders OR private ones owned/shared with current user."""
    return {
        "$or": [
            {"visibility": {"$ne": "private"}},
            {"created_by": user["id"]},
            {"shared_with_user_ids": user["id"]},
        ]
    }


@router.post("/reminders", response_model=Reminder)
async def create_reminder(payload: ReminderBase, user: dict = Depends(get_current_user)):
    if payload.patient_id:
        await verify_patient_in_org(payload.patient_id, user["organization_id"])
    r = Reminder(
        **payload.model_dump(),
        organization_id=user["organization_id"],
        created_by=user["id"],
        created_by_name=user.get("name"),
    )
    await db.reminders.insert_one(r.model_dump())
    return r


@router.get("/patients/{patient_id}/reminders", response_model=list)
async def list_patient_reminders(patient_id: str, user: dict = Depends(get_current_user)):
    await verify_patient_in_org(patient_id, user["organization_id"])
    q = {
        "patient_id": patient_id,
        "organization_id": user["organization_id"],
        **_visibility_query(user),
    }
    return await db.reminders.find(q, {"_id": 0}).sort("due_date", 1).to_list(2000)


@router.get("/reminders/upcoming", response_model=list)
async def upcoming_reminders(user: dict = Depends(get_current_user)):
    """Dashboard: all non-completed tasks visible to user, sorted by due_date."""
    q = {
        "organization_id": user["organization_id"],
        "completed": False,
        **_visibility_query(user),
    }
    return await db.reminders.find(q, {"_id": 0}).sort("due_date", 1).limit(100).to_list(100)


@router.put("/reminders/{reminder_id}", response_model=Reminder)
async def update_reminder(reminder_id: str, payload: ReminderUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
    existing = await db.reminders.find_one(
        {"id": reminder_id, "organization_id": user["organization_id"]}, {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Reminder non trovato")
    if (
        existing.get("visibility") == "private"
        and existing.get("created_by") != user["id"]
        and user["id"] not in (existing.get("shared_with_user_ids") or [])
    ):
        raise HTTPException(status_code=403, detail="Non hai accesso a questa richiesta privata")
    await db.reminders.update_one(
        {"id": reminder_id, "organization_id": user["organization_id"]},
        {"$set": update_data},
    )
    return await db.reminders.find_one({"id": reminder_id}, {"_id": 0})


@router.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str, user: dict = Depends(get_current_user)):
    existing = await db.reminders.find_one(
        {"id": reminder_id, "organization_id": user["organization_id"]}, {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Reminder non trovato")
    if existing.get("visibility") == "private" and existing.get("created_by") != user["id"]:
        raise HTTPException(status_code=403, detail="Solo il creatore può eliminare una richiesta privata")
    await db.reminders.delete_one({"id": reminder_id, "organization_id": user["organization_id"]})
    return {"success": True}
