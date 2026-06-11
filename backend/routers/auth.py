"""
Authentication & organisation management routes.
"""
import os
import uuid
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import jwt
from fastapi import APIRouter, HTTPException, Depends, Request, Response

from database import db
from auth_utils import (
    JWT_ALGORITHM, get_jwt_secret,
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    get_current_user, set_auth_cookies,
)
from models import Organization, RegisterRequest, LoginRequest, OrganizationSettings

router = APIRouter()


# ── Demo seed helpers ─────────────────────────────────────────────────────────

def _build_demo_seed_patients(days_ago) -> list:
    """Returns the 3 demo patients (RA, SpA, SLE) with realistic longitudinal data."""
    return [
        {
            "codice_paziente": "DEMO-AR-01",
            "cognome": "Bianchi", "nome": "Maria",
            "anno_nascita": 1968, "sesso": "F",
            "diagnosi": "Artrite reumatoide",
            "note": "RA sieropositiva erosiva, esordio 2019.",
            "assessments": [
                {"index_type": "das28_crp", "date": days_ago(540), "score": 5.6, "interpretation": "Alta attività", "tender": 8, "swollen": 6},
                {"index_type": "das28_crp", "date": days_ago(360), "score": 4.1, "interpretation": "Moderata attività", "tender": 5, "swollen": 3},
                {"index_type": "das28_crp", "date": days_ago(180), "score": 3.0, "interpretation": "Bassa attività", "tender": 2, "swollen": 1},
                {"index_type": "das28_crp", "date": days_ago(60), "score": 2.4, "interpretation": "Remissione", "tender": 1, "swollen": 0},
                {"index_type": "cdai", "date": days_ago(60), "score": 4, "interpretation": "Bassa attività"},
                {"index_type": "haq", "date": days_ago(60), "score": 0.5, "interpretation": "Disabilità lieve"},
            ],
            "therapies": [
                {"drug_name": "Methotrexate", "category": "csDMARD", "dose": "15 mg/sett", "frequency": "Settimanale", "route": "s.c.", "start_date": days_ago(540), "status": "active"},
                {"drug_name": "Prednisone", "category": "Glucocorticoidi", "dose": "5 mg", "frequency": "Giornaliera", "route": "oral", "start_date": days_ago(540), "end_date": days_ago(120), "status": "discontinued"},
                {"drug_name": "Adalimumab", "category": "bDMARD", "dose": "40 mg", "frequency": "Bisettimanale", "route": "s.c.", "start_date": days_ago(300), "status": "active"},
            ],
        },
        {
            "codice_paziente": "DEMO-SPA-02",
            "cognome": "Rossi", "nome": "Marco",
            "anno_nascita": 1985, "sesso": "M",
            "diagnosi": "Spondilite anchilosante",
            "note": "axSpA HLA-B27+, sacroileite RM positiva.",
            "assessments": [
                {"index_type": "basdai", "date": days_ago(365), "score": 6.8, "interpretation": "Alta attività"},
                {"index_type": "asdas_crp", "date": days_ago(365), "score": 3.4, "interpretation": "Alta attività"},
                {"index_type": "basdai", "date": days_ago(120), "score": 3.2, "interpretation": "Moderata"},
                {"index_type": "asdas_crp", "date": days_ago(120), "score": 1.9, "interpretation": "Bassa attività"},
                {"index_type": "basfi", "date": days_ago(120), "score": 2.5, "interpretation": "Funzione preservata"},
            ],
            "therapies": [
                {"drug_name": "Ibuprofene", "category": "FANS", "dose": "600 mg", "frequency": "TID al bisogno", "route": "oral", "start_date": days_ago(365), "status": "active"},
                {"drug_name": "Secukinumab", "category": "bDMARD", "dose": "150 mg", "frequency": "Mensile", "route": "s.c.", "start_date": days_ago(280), "status": "active"},
            ],
        },
        {
            "codice_paziente": "DEMO-SLE-03",
            "cognome": "Verdi", "nome": "Lucia",
            "anno_nascita": 1992, "sesso": "F",
            "diagnosi": "Lupus eritematoso sistemico (LES)",
            "note": "LES con coinvolgimento cutaneo, articolare, ANA+ a titolo elevato.",
            "assessments": [
                {"index_type": "sledai", "date": days_ago(420), "score": 12, "interpretation": "Alta attività"},
                {"index_type": "sledai", "date": days_ago(180), "score": 6, "interpretation": "Moderata"},
                {"index_type": "sledai", "date": days_ago(60), "score": 2, "interpretation": "Bassa attività"},
            ],
            "therapies": [
                {"drug_name": "Idrossiclorochina", "category": "csDMARD", "dose": "200 mg", "frequency": "BID", "route": "oral", "start_date": days_ago(420), "status": "active"},
                {"drug_name": "Prednisone", "category": "Glucocorticoidi", "dose": "10 mg", "frequency": "Giornaliera", "route": "oral", "start_date": days_ago(420), "end_date": days_ago(150), "status": "discontinued"},
                {"drug_name": "Belimumab", "category": "bDMARD", "dose": "200 mg", "frequency": "Settimanale", "route": "s.c.", "start_date": days_ago(180), "status": "active"},
            ],
        },
    ]


async def _insert_demo_patient(p_seed: dict, org_id: str, user_id: str) -> None:
    p_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    audit = {"created_at": now_iso, "created_by": user_id, "created_by_name": "Utente Demo"}

    await db.patients.insert_one({
        "id": p_id, "organization_id": org_id,
        "codice_paziente": p_seed["codice_paziente"],
        "cognome": p_seed["cognome"], "nome": p_seed["nome"],
        "anno_nascita": p_seed["anno_nascita"], "sesso": p_seed["sesso"],
        "diagnosi": p_seed["diagnosi"], "note": p_seed["note"],
        **audit,
    })
    for a in p_seed["assessments"]:
        await db.assessments.insert_one({
            "id": str(uuid.uuid4()), "patient_id": p_id, "organization_id": org_id,
            "index_type": a["index_type"], "date": a["date"], "score": a["score"],
            "interpretation": a.get("interpretation"),
            "tender_joints": [f"j{i}" for i in range(a.get("tender", 0))],
            "swollen_joints": [f"j{i}" for i in range(a.get("swollen", 0))],
            "inputs": {}, **audit,
        })
    for t in p_seed["therapies"]:
        await db.therapies.insert_one({
            "id": str(uuid.uuid4()), "patient_id": p_id, "organization_id": org_id,
            "drug_name": t["drug_name"], "category": t["category"],
            "dose": t.get("dose"), "frequency": t.get("frequency"), "route": t.get("route"),
            "start_date": t["start_date"], "end_date": t.get("end_date"),
            "status": t["status"], "indication": p_seed["diagnosi"],
            **audit,
        })


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/")
async def root():
    return {"message": "Clinimetria Reumatologica API"}


@router.post("/auth/register")
async def register(payload: RegisterRequest, response: Response):
    email = payload.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email già registrata")

    invite_code_out = None

    if payload.invite_code:
        # Join existing org as member
        org = await db.organizations.find_one({"invite_code": payload.invite_code.strip()}, {"_id": 0})
        if not org:
            raise HTTPException(status_code=400, detail="Codice invito non valido")
        org_id = org["id"]
        org_name = org["name"]
        invite_code_out = org["invite_code"]
        role = "member"
    elif payload.organization_name and payload.organization_name.strip():
        # Check platform access code
        platform_code = os.environ.get("PLATFORM_ACCESS_CODE", "")
        if platform_code and payload.platform_code != platform_code:
            raise HTTPException(status_code=400, detail="Codice di accesso piattaforma non valido")
        # Create new org, user becomes admin
        new_org = Organization(name=payload.organization_name.strip())
        await db.organizations.insert_one(new_org.model_dump())
        org_id = new_org.id
        org_name = new_org.name
        invite_code_out = new_org.invite_code
        role = "admin"
    else:
        raise HTTPException(status_code=400, detail="Inserisci un codice invito oppure il nome della tua UO")

    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email,
        "name": payload.name.strip(),
        "password_hash": hash_password(payload.password),
        "role": role,
        "organization_id": org_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)

    access = create_access_token(user_id, email, org_id)
    refresh = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh)

    return {
        "id": user_id, "email": email, "name": payload.name, "role": role,
        "organization_id": org_id, "organization_name": org_name,
        "invite_code": invite_code_out,
    }


@router.post("/auth/demo")
async def login_demo():
    raise HTTPException(status_code=404, detail="Non disponibile")


@router.post("/auth/login")
async def login(payload: LoginRequest, response: Response):
    email = payload.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenziali non valide")

    org = await db.organizations.find_one({"id": user["organization_id"]}, {"_id": 0})
    org_name = org["name"] if org else None

    access = create_access_token(user["id"], user["email"], user["organization_id"])
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)

    return {
        "id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"],
        "organization_id": user["organization_id"], "organization_name": org_name,
        "invite_code": org["invite_code"] if org else None,
    }


@router.post("/auth/logout")
async def logout(response: Response, _: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"success": True}


@router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    org = await db.organizations.find_one({"id": user["organization_id"]}, {"_id": 0})
    return {
        "id": user["id"], "email": user["email"], "name": user["name"],
        "role": user.get("role", "member"),
        "organization_id": user["organization_id"],
        "organization_name": org["name"] if org else None,
        "invite_code": org["invite_code"] if org else None,
        "pseudonymized_mode": bool(org.get("pseudonymized_mode", False)) if org else False,
        "is_demo": bool(user.get("is_demo", False)),
    }


@router.post("/auth/change-password")
async def change_password(payload: dict, user: dict = Depends(get_current_user)):
    current_pw = payload.get("current_password", "")
    new_pw = payload.get("new_password", "")
    if not current_pw or not new_pw:
        raise HTTPException(status_code=400, detail="Compila tutti i campi")
    if len(new_pw) < 6:
        raise HTTPException(status_code=400, detail="La nuova password deve essere lunga almeno 6 caratteri")
    db_user = await db.users.find_one({"id": user["id"]})
    if not db_user or not verify_password(current_pw, db_user["password_hash"]):
        raise HTTPException(status_code=400, detail="La password attuale non è corretta")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(new_pw)}})
    return {"success": True}


@router.put("/organization/settings")
async def update_org_settings(payload: OrganizationSettings, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo gli amministratori possono modificare le impostazioni")
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nessuna modifica")
    await db.organizations.update_one({"id": user["organization_id"]}, {"$set": update})
    return {"success": True, **update}


@router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Token di refresh assente")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Tipo di token non valido")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="Utente non trovato")
        access = create_access_token(user["id"], user["email"], user["organization_id"])
        from auth_utils import _IS_PRODUCTION
        response.set_cookie(
            key="access_token", value=access,
            httponly=True,
            secure=_IS_PRODUCTION,
            samesite="none" if _IS_PRODUCTION else "lax",
            max_age=28800, path="/",
        )
        return {"success": True}
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token non valido")
