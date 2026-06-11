"""
PRO token routes (doctor-side + public patient-facing) and consult token routes.
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import List

from fastapi import APIRouter, HTTPException, Depends

from database import db
from auth_utils import get_current_user
from models import (
    PROToken, PROTokenCreate, PROSubmit, PRO_INSTRUMENTS_ALLOWED,
    ConsultToken, ConsultTokenCreate,
)
from helpers import verify_patient_in_org

router = APIRouter()


# ── PRO Tokens (doctor-side) ──────────────────────────────────────────────────

@router.post("/pro-tokens", response_model=PROToken)
async def create_pro_token(payload: PROTokenCreate, user: dict = Depends(get_current_user)):
    """Doctor creates a short-lived PRO link/QR for a specific patient."""
    await verify_patient_in_org(payload.patient_id, user["organization_id"])
    invalid = [i for i in payload.instruments if i not in PRO_INSTRUMENTS_ALLOWED]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Strumenti non validi: {invalid}")
    if not payload.instruments:
        raise HTTPException(status_code=400, detail="Devi selezionare almeno uno strumento")
    hours = max(1, min(24 * 60, int(payload.expires_in_hours or 168)))
    expires = (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()
    pt = PROToken(
        patient_id=payload.patient_id,
        organization_id=user["organization_id"],
        instruments=payload.instruments,
        note=payload.note,
        expires_at=expires,
        created_by=user["id"],
        created_by_name=user.get("name"),
    )
    await db.pro_tokens.insert_one(pt.model_dump())
    return pt


@router.get("/patients/{patient_id}/pro-tokens", response_model=List[PROToken])
async def list_pro_tokens(patient_id: str, user: dict = Depends(get_current_user)):
    """List all PRO tokens (active + expired + completed) for a patient."""
    await verify_patient_in_org(patient_id, user["organization_id"])
    return await db.pro_tokens.find(
        {"patient_id": patient_id, "organization_id": user["organization_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)


@router.delete("/pro-tokens/{token_id}")
async def delete_pro_token(token_id: str, user: dict = Depends(get_current_user)):
    """Doctor revokes a PRO token."""
    res = await db.pro_tokens.delete_one(
        {"id": token_id, "organization_id": user["organization_id"]}
    )
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Token non trovato")
    return {"success": True}


@router.post("/pro-tokens/{token_id}/convert")
async def convert_pro_token(token_id: str, user: dict = Depends(get_current_user)):
    """Convert a submitted PRO token into formal assessment(s)."""
    pt = await db.pro_tokens.find_one(
        {"id": token_id, "organization_id": user["organization_id"]}, {"_id": 0}
    )
    if not pt:
        raise HTTPException(status_code=404, detail="Token non trovato")
    if not pt.get("submitted_responses"):
        raise HTTPException(status_code=400, detail="Il paziente non ha ancora compilato il questionario")

    responses = pt["submitted_responses"]
    submission_date = (pt.get("completed_at") or datetime.now(timezone.utc).isoformat())[:10]
    created = []
    for instr, payload in (responses.get("instruments") or {}).items():
        if not isinstance(payload, dict):
            continue
        score = payload.get("score")
        if score is None:
            continue
        doc = {
            "id": str(uuid.uuid4()),
            "patient_id": pt["patient_id"],
            "organization_id": pt["organization_id"],
            "index_type": instr,
            "date": submission_date,
            "score": score,
            "interpretation": payload.get("interpretation"),
            "tender_joints": [],
            "swollen_joints": [],
            "inputs": payload.get("inputs") or {},
            "notes": "Compilato dal paziente via PRO link",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": user["id"],
            "created_by_name": user.get("name"),
            "source": "patient_reported",
        }
        await db.assessments.insert_one(doc)
        created.append(instr)

    await db.pro_tokens.update_one(
        {"id": token_id},
        {"$set": {"converted": True, "converted_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"success": True, "created": created}


# ── PRO Tokens (public — no auth, token-protected) ────────────────────────────

@router.get("/public/pro/{token}")
async def public_get_pro(token: str):
    """Patient opens the PRO link → fetch instruments + minimal patient info."""
    pt = await db.pro_tokens.find_one({"token": token}, {"_id": 0})
    if not pt:
        raise HTTPException(status_code=404, detail="Link non valido")
    if pt.get("completed_at"):
        return {
            "status": "already_submitted",
            "completed_at": pt["completed_at"],
            "instruments": pt.get("instruments", []),
        }
    if pt["expires_at"] < datetime.now(timezone.utc).isoformat():
        return {"status": "expired", "expired_at": pt["expires_at"]}

    p = await db.patients.find_one({"id": pt["patient_id"]}, {"_id": 0})
    org = await db.organizations.find_one({"id": pt["organization_id"]}, {"_id": 0})
    return {
        "status": "active",
        "patient_code": (p or {}).get("codice_paziente") or "",
        "diagnosis": (p or {}).get("diagnosi") or "",
        "organization_name": (org or {}).get("name") or "",
        "instruments": pt.get("instruments", []),
        "note": pt.get("note"),
        "expires_at": pt["expires_at"],
    }


@router.post("/public/pro/{token}/submit")
async def public_submit_pro(token: str, payload: PROSubmit):
    """Patient submits the responses. Idempotent on first submission."""
    pt = await db.pro_tokens.find_one({"token": token}, {"_id": 0})
    if not pt:
        raise HTTPException(status_code=404, detail="Link non valido")
    if pt.get("completed_at"):
        raise HTTPException(status_code=409, detail="Questionario già compilato")
    if pt["expires_at"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(status_code=410, detail="Link scaduto")
    await db.pro_tokens.update_one(
        {"token": token},
        {"$set": {
            "submitted_responses": payload.responses,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"success": True}


# ── Consult Tokens ────────────────────────────────────────────────────────────

@router.post("/patients/{patient_id}/consult-token", response_model=ConsultToken)
async def create_consult_token(patient_id: str, payload: ConsultTokenCreate, user: dict = Depends(get_current_user)):
    """Doctor creates a read-only consult link for an external colleague."""
    await verify_patient_in_org(patient_id, user["organization_id"])
    hours = max(1, min(24 * 365, int(payload.expires_in_hours or 168)))
    expires = (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()
    ct = ConsultToken(
        patient_id=patient_id,
        organization_id=user["organization_id"],
        created_by=user["id"],
        created_by_name=user.get("name") or user.get("email"),
        expires_at=expires,
    )
    await db.consult_tokens.insert_one(ct.model_dump())
    return ct


@router.get("/patients/{patient_id}/consult-tokens")
async def list_consult_tokens(patient_id: str, user: dict = Depends(get_current_user)):
    await verify_patient_in_org(patient_id, user["organization_id"])
    return await db.consult_tokens.find(
        {"patient_id": patient_id, "organization_id": user["organization_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)


@router.delete("/consult-tokens/{token_id}")
async def delete_consult_token(token_id: str, user: dict = Depends(get_current_user)):
    res = await db.consult_tokens.delete_one(
        {"id": token_id, "organization_id": user["organization_id"]}
    )
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Token non trovato")
    return {"success": True}


@router.get("/public/consult/{token}")
async def public_get_consult(token: str):
    """External colleague opens the consult link — returns full read-only patient bundle."""
    ct = await db.consult_tokens.find_one({"token": token}, {"_id": 0})
    if not ct:
        raise HTTPException(status_code=404, detail="Link non valido o scaduto")
    if ct["expires_at"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(status_code=410, detail="Link scaduto")

    patient_id = ct["patient_id"]
    org_id = ct["organization_id"]

    await db.consult_tokens.update_one({"token": token}, {"$inc": {"views": 1}})

    p = await db.patients.find_one({"id": patient_id}, {"_id": 0}) or {}
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0}) or {}

    patient_safe = {
        "id": p.get("id"),
        "codice_paziente": p.get("codice_paziente"),
        "anno_nascita": p.get("anno_nascita"),
        "sesso": p.get("sesso"),
        "diagnosi": p.get("diagnosi"),
        "diagnosi_secondarie": p.get("diagnosi_secondarie", []),
        "onset_year": p.get("onset_year"),
        "onset_month": p.get("onset_month"),
        "patient_state": p.get("patient_state"),
        "note": p.get("note"),
    }

    assessments = await db.assessments.find({"patient_id": patient_id}, {"_id": 0}).sort("date", -1).to_list(500)
    lab_exams = await db.lab_exams.find({"patient_id": patient_id}, {"_id": 0}).sort("date", -1).to_list(500)
    therapies = await db.therapies.find({"patient_id": patient_id}, {"_id": 0}).sort("start_date", -1).to_list(200)
    criteria_evals = await db.criteria_evaluations.find({"patient_id": patient_id}, {"_id": 0}).sort("date", -1).to_list(100)
    disease_profiles = await db.disease_profiles.find({"patient_id": patient_id}, {"_id": 0}).to_list(20)
    sclero_profiles = await db.sclero_profiles.find({"patient_id": patient_id}, {"_id": 0}).to_list(5)
    workup_visits = await db.workup_visits.find({"patient_id": patient_id}, {"_id": 0}).sort("visit_date", 1).to_list(50)

    return {
        "patient": patient_safe,
        "assessments": assessments,
        "lab_exams": lab_exams,
        "therapies": therapies,
        "criteria_evaluations": criteria_evals,
        "disease_profiles": disease_profiles,
        "sclero_profiles": sclero_profiles,
        "workup_visits": workup_visits,
        "organization_name": org.get("name") or "",
        "expires_at": ct["expires_at"],
        "created_at": ct["created_at"],
    }
