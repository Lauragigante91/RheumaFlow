"""
Visit templates, workup visits, and organisation members.
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from database import db
from auth_utils import get_current_user
from helpers import verify_patient_in_org, generate_home_therapies_text, compute_exit_therapies_text

router = APIRouter()


# ── Models (authoritative definitions — differ from generic models.py) ─────────

class VisitTemplateBase(BaseModel):
    category: str   # "rheumatic_history" | "physical_exam"
    name: str
    content: str


class VisitTemplate(VisitTemplateBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    organization_id: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class VisitTemplateUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None


VISIT_TYPES = {"first_visit", "workup", "follow_up"}


class WorkupVisitBase(BaseModel):
    patient_id: str
    visit_date: str                                       # ISO "YYYY-MM-DD"
    visit_type: Optional[str] = "workup"                 # "first_visit" | "workup" | "follow_up"
    rheumatologic_history_summary: Optional[str] = None  # 0 · Raccordo anamnestico reumatologico
    interval_history: Optional[str] = None               # 1 · Anamnesi intervallare
    physical_exam: Optional[str] = None                  # 2 · Esame obiettivo (free text)
    physical_exam_joint_exam: Optional[dict] = None      # 2 · Esame articolare (homunculus map)
    physical_exam_systems: Optional[dict] = None         # 2 · Apparati per sistema (organ fields)
    physical_exam_mrss: Optional[dict] = None            # 2 · MRSS (sclerosi sistemica)
    physical_exam_pasi: Optional[dict] = None            # 2 · PASI (psoriasi)
    physical_exam_lei: Optional[dict] = None             # 2 · LEI (entesiti)
    physical_exam_sacroiliac: Optional[dict] = None      # 2 · Manovre sacroiliache (si_l/si_r: positive|negative)
    labs_imaging: Optional[str] = None                   # 3 · Esami / imaging in visione
    clinimetria_notes: Optional[str] = None              # 4 · Clinimetria (opzionale)
    diagnostic_hypotheses: Optional[str] = None          # 5 · Assessment: ipotesi diagnostiche
    conclusions: Optional[str] = None                    # 5 · Assessment: conclusioni
    clinical_decision: str = "open"                      # "open" | "converting"
    confirmed_diagnosis: Optional[str] = None            # 5 · Diagnosi confermata (when converting)
    requested_tests: Optional[List[str]] = None          # 6 · Piano: esami richiesti
    requested_tests_notes: Optional[str] = None          # 6 · Piano: note esami richiesti
    followup_date: Optional[str] = None                  # 6 · Piano: data prossima rivalutazione
    therapy_modification: Optional[str] = None           # 6 · Piano: modifica terapeutica
    referred_to_gp: Optional[bool] = None                # 7 · Referral: restituzione al MMG
    referral_note: Optional[str] = None                  # 7 · Referral: note / lettera al MMG
    exit_therapy_text: Optional[str] = None              # Terapia in uscita: testo originale del referto
    comorbidities_text: Optional[str] = None              # Snapshot comorbidità testo (report)
    home_therapies_text: Optional[str] = None            # Snapshot terapia domiciliare (report)
    notes: Optional[str] = None                          # Note aggiuntive libere
    status: str = "draft"                                # "draft" | "completed"
    report_generated: bool = False                       # True dopo generazione referto


class WorkupVisit(WorkupVisitBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    created_by: str
    created_by_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: Optional[str] = None
    exit_therapies_text: Optional[str] = None   # Terapia in uscita: snapshot persistito post-upsert; fallback calcolato a lettura


# ── Visit Templates ───────────────────────────────────────────────────────────

@router.get("/visit-templates", response_model=List[VisitTemplate])
async def list_visit_templates(category: Optional[str] = None, user: dict = Depends(get_current_user)):
    query: Dict[str, Any] = {"user_id": user["id"]}
    if category:
        query["category"] = category
    return await db.visit_templates.find(query, {"_id": 0}).sort("name", 1).to_list(500)


@router.post("/visit-templates", response_model=VisitTemplate)
async def create_visit_template(payload: VisitTemplateBase, user: dict = Depends(get_current_user)):
    tpl = VisitTemplate(**payload.model_dump(), user_id=user["id"], organization_id=user["organization_id"])
    await db.visit_templates.insert_one(tpl.model_dump())
    return tpl


@router.put("/visit-templates/{tpl_id}", response_model=VisitTemplate)
async def update_visit_template(tpl_id: str, payload: VisitTemplateUpdate, user: dict = Depends(get_current_user)):
    existing = await db.visit_templates.find_one({"id": tpl_id, "user_id": user["id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Template non trovato")
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.visit_templates.update_one({"id": tpl_id}, {"$set": update_data})
    return {**existing, **update_data}


@router.delete("/visit-templates/{tpl_id}")
async def delete_visit_template(tpl_id: str, user: dict = Depends(get_current_user)):
    existing = await db.visit_templates.find_one({"id": tpl_id, "user_id": user["id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Template non trovato")
    await db.visit_templates.delete_one({"id": tpl_id})
    return {"success": True}


# ── Workup Visits ─────────────────────────────────────────────────────────────

@router.post("/patients/{patient_id}/workup-visits", response_model=WorkupVisit)
async def create_workup_visit(patient_id: str, payload: WorkupVisitBase, user: dict = Depends(get_current_user)):
    await verify_patient_in_org(patient_id, user["organization_id"])
    data = payload.model_dump()
    # Validate and normalise visit_type; unknown values fall back to "workup"
    if data.get("visit_type") not in VISIT_TYPES:
        data["visit_type"] = "workup"

    # Auto-generate home_therapies_text from therapy_state_at(visit_date).
    # The payload value (imported/manual text) is used only as fallback when
    # therapy_state_at returns no active therapies.
    visit_date: str = data.get("visit_date") or ""
    if visit_date:
        data["home_therapies_text"] = await generate_home_therapies_text(
            patient_id=patient_id,
            organization_id=user["organization_id"],
            visit_date=visit_date,
            fallback_text=data.get("home_therapies_text"),
        )

    v = WorkupVisit(
        **{**data, "patient_id": patient_id},
        organization_id=user["organization_id"],
        created_by=user["id"],
        created_by_name=user.get("name"),
    )
    await db.workup_visits.insert_one(v.model_dump())
    return v


@router.get("/patients/{patient_id}/workup-visits", response_model=List[WorkupVisit])
async def list_workup_visits(
    patient_id: str,
    visit_type: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    await verify_patient_in_org(patient_id, user["organization_id"])
    query: Dict[str, Any] = {
        "patient_id": patient_id,
        "organization_id": user["organization_id"],
    }
    if visit_type and visit_type in VISIT_TYPES:
        query["visit_type"] = visit_type
    visits = await db.workup_visits.find(query, {"_id": 0}).sort("visit_date", -1).to_list(500)
    episodes = await db.therapies.find(
        {"patient_id": patient_id, "organization_id": user["organization_id"]},
        {"_id": 0},
    ).to_list(2000)
    for v in visits:
        if not (v.get("exit_therapies_text") or "").strip():
            v["exit_therapies_text"] = compute_exit_therapies_text(episodes, v.get("visit_date") or "")
    return visits


@router.put("/workup-visits/{visit_id}", response_model=WorkupVisit)
async def update_workup_visit(visit_id: str, payload: WorkupVisitBase, user: dict = Depends(get_current_user)):
    # Immutability rule: home_therapies_text is a historical snapshot set once
    # at creation. On subsequent saves:
    #   - If existing visit already has a non-empty value → preserve it.
    #   - If existing value is null/empty AND payload provides one → use payload.
    #   - If existing value is null/empty AND payload is also empty → try to
    #     auto-generate now (late generation for visits created before Passo 2).
    existing = await db.workup_visits.find_one(
        {"id": visit_id, "organization_id": user["organization_id"]},
        {"_id": 0, "home_therapies_text": 1, "patient_id": 1, "visit_date": 1},
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Visita workup non trovata")

    update_data = {**payload.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}

    existing_snapshot = (existing.get("home_therapies_text") or "").strip()
    if existing_snapshot:
        # Already set — preserve the historical snapshot regardless of payload
        update_data["home_therapies_text"] = existing_snapshot
    else:
        # Not yet set — generate now (or accept the payload value as fallback)
        visit_date: str = existing.get("visit_date") or payload.visit_date or ""
        patient_id: str = existing.get("patient_id") or payload.patient_id
        if visit_date and patient_id:
            update_data["home_therapies_text"] = await generate_home_therapies_text(
                patient_id=patient_id,
                organization_id=user["organization_id"],
                visit_date=visit_date,
                fallback_text=update_data.get("home_therapies_text"),
            )

    result = await db.workup_visits.update_one(
        {"id": visit_id, "organization_id": user["organization_id"]},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Visita workup non trovata")
    return await db.workup_visits.find_one({"id": visit_id}, {"_id": 0})


@router.patch("/workup-visits/{visit_id}")
async def patch_workup_visit(visit_id: str, payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    """Partial update: only the provided fields are overwritten (no full-replace)."""
    PROTECTED = {"id", "patient_id", "organization_id", "created_by", "created_by_name", "created_at"}
    update_data = {k: v for k, v in payload.items() if k not in PROTECTED}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nessun campo aggiornabile nella richiesta")
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.workup_visits.update_one(
        {"id": visit_id, "organization_id": user["organization_id"]},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Visita workup non trovata")
    return await db.workup_visits.find_one({"id": visit_id}, {"_id": 0})


@router.patch("/workup-visits/{visit_id}/complete")
async def complete_workup_visit(visit_id: str, user: dict = Depends(get_current_user)):
    """Mark a workup visit as completed (report generated / visit confirmed)."""
    result = await db.workup_visits.update_one(
        {"id": visit_id, "organization_id": user["organization_id"]},
        {"$set": {
            "status": "completed",
            "report_generated": True,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Visita workup non trovata")
    await db.exam_upload_sessions.update_many(
        {"visit_id": visit_id, "organization_id": user["organization_id"], "revoked_at": None},
        {"$set": {"revoked_at": datetime.now(timezone.utc).isoformat()}},
    )
    return await db.workup_visits.find_one({"id": visit_id}, {"_id": 0})


@router.delete("/workup-visits/{visit_id}")
async def delete_workup_visit(visit_id: str, user: dict = Depends(get_current_user)):
    result = await db.workup_visits.delete_one(
        {"id": visit_id, "organization_id": user["organization_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Visita workup non trovata")
    return {"success": True}


# ── Organisation members ──────────────────────────────────────────────────────

@router.get("/organization/members")
async def list_org_members(user: dict = Depends(get_current_user)):
    """Return basic info on members of the same organisation (for sharing UI)."""
    docs = await db.users.find(
        {"organization_id": user["organization_id"]},
        {"_id": 0, "password_hash": 0},
    ).to_list(500)
    return [
        {"id": d.get("id"), "name": d.get("name"), "email": d.get("email"), "role": d.get("role")}
        for d in docs
    ]
