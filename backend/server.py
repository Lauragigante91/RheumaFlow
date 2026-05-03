from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

import bcrypt
import jwt
import json
import csv
import io
import zipfile
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import StreamingResponse, JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, EmailStr

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


# ==================== AUTH HELPERS ====================
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str, organization_id: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "org": organization_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=8),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Non autenticato")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Tipo di token non valido")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Utente non trovato")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token scaduto")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token non valido")


def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    # Cancella eventuali cookie obsoleti (es. con SameSite/Secure differenti) prima di settare i nuovi
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=28800, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")


# ==================== MODELS ====================
class Organization(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    invite_code: str = Field(default_factory=lambda: secrets.token_urlsafe(8))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    pseudonymized_mode: bool = False  # se True l'UI nasconde nome/cognome/CF/data_nascita


class OrganizationSettings(BaseModel):
    pseudonymized_mode: Optional[bool] = None


class UserPublic(BaseModel):
    id: str
    email: str
    name: str
    role: str
    organization_id: str
    organization_name: Optional[str] = None


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    organization_name: Optional[str] = None  # se nuovo
    invite_code: Optional[str] = None  # se join


class LoginRequest(BaseModel):
    email: str
    password: str


class PatientBase(BaseModel):
    # Pseudonimizzazione: il codice_paziente è sempre preferito.
    # Se modalità pseudonimizzata attiva nell'org, i campi nominativi NON devono essere inviati dall'UI.
    codice_paziente: Optional[str] = None  # identificatore scelto dall'utente (es. RX-2026-001)
    nome: Optional[str] = None
    cognome: Optional[str] = None
    anno_nascita: Optional[int] = None  # alternativa meno identificante a data_nascita
    data_nascita: Optional[str] = None
    sesso: Optional[str] = None
    codice_fiscale: Optional[str] = None
    diagnosi: Optional[str] = None
    note: Optional[str] = None


class Patient(PatientBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    created_by: str
    created_by_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PatientUpdate(BaseModel):
    codice_paziente: Optional[str] = None
    nome: Optional[str] = None
    cognome: Optional[str] = None
    anno_nascita: Optional[int] = None
    data_nascita: Optional[str] = None
    sesso: Optional[str] = None
    codice_fiscale: Optional[str] = None
    diagnosi: Optional[str] = None
    note: Optional[str] = None


class AssessmentBase(BaseModel):
    patient_id: str
    index_type: str
    date: str
    inputs: Dict[str, Any] = {}
    score: Optional[float] = None
    interpretation: Optional[str] = None
    tender_joints: List[str] = []
    swollen_joints: List[str] = []
    notes: Optional[str] = None


class Assessment(AssessmentBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    created_by: str
    created_by_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CriteriaEvaluationBase(BaseModel):
    patient_id: str
    criteria_id: str
    criteria_name: str
    source: str
    date: str
    score: float
    threshold: float
    meets: bool
    selections: Dict[str, Any] = {}
    notes: Optional[str] = None


class CriteriaEvaluation(CriteriaEvaluationBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    created_by: str
    created_by_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TherapyBase(BaseModel):
    patient_id: str
    drug_name: str
    category: str  # csDMARD, bDMARD, tsDMARD, glucocorticoid, NSAID, analgesic, supportive, other
    dose: Optional[str] = None
    frequency: Optional[str] = None
    route: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: str = "active"  # active, discontinued, completed
    discontinuation_reason: Optional[str] = None
    notes: Optional[str] = None


class Therapy(TherapyBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    created_by: str
    created_by_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TherapyUpdate(BaseModel):
    drug_name: Optional[str] = None
    category: Optional[str] = None
    dose: Optional[str] = None
    frequency: Optional[str] = None
    route: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None
    discontinuation_reason: Optional[str] = None
    notes: Optional[str] = None


class LabExamBase(BaseModel):
    patient_id: str
    date: str
    panel: str  # autoanticorpi, complemento, fase_acuta, emocromo, funzione, urine, custom
    values: Dict[str, Any] = {}  # { test_key: { value, unit, status (positive/negative/normal/high/low), notes? } }
    notes: Optional[str] = None


class LabExam(LabExamBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    created_by: str
    created_by_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ReminderBase(BaseModel):
    patient_id: str
    due_date: str
    title: str
    type: Optional[str] = None  # follow_up, lab, imaging, therapy, other
    notes: Optional[str] = None
    completed: bool = False


class Reminder(ReminderBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    created_by: str
    created_by_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ReminderUpdate(BaseModel):
    due_date: Optional[str] = None
    title: Optional[str] = None
    type: Optional[str] = None
    notes: Optional[str] = None
    completed: Optional[bool] = None


# ==================== SCLERODERMA PROFILE ====================
class ScleroProfileBase(BaseModel):
    patient_id: str
    cutaneous: Optional[Dict[str, Any]] = None       # subset, mrss, notes
    antibody: Optional[Dict[str, Any]] = None        # ana, aca, scl70, rnap3, ...
    vascular: Optional[Dict[str, Any]] = None        # raynaud, ulcers, capillaroscopy ...
    ild: Optional[Dict[str, Any]] = None             # presence, hrct, fvc, dlco
    pah: Optional[Dict[str, Any]] = None             # screen, echo, rhc
    gi: Optional[Dict[str, Any]] = None              # ger, sibo, dysmotility, ...
    msk: Optional[Dict[str, Any]] = None             # arthralgia, arthritis, contractures
    notes: Optional[str] = None


class ScleroProfile(ScleroProfileBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    created_by: str
    created_by_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_by_name: Optional[str] = None


# ==================== APP ====================
app = FastAPI(title="Clinimetria Reumatologica API")
api_router = APIRouter(prefix="/api")


# ==================== AUTH ENDPOINTS ====================
@api_router.post("/auth/register")
async def register(payload: RegisterRequest, response: Response):
    email = payload.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email già registrata")

    # Determine organization
    org_id = None
    org_name = None
    role = "member"
    if payload.invite_code:
        org = await db.organizations.find_one({"invite_code": payload.invite_code.strip()}, {"_id": 0})
        if not org:
            raise HTTPException(status_code=400, detail="Codice invito non valido")
        org_id = org["id"]
        org_name = org["name"]
        role = "member"
    elif payload.organization_name:
        new_org = Organization(name=payload.organization_name.strip())
        await db.organizations.insert_one(new_org.model_dump())
        org_id = new_org.id
        org_name = new_org.name
        role = "admin"
    else:
        raise HTTPException(status_code=400, detail="Specificare nome dell'UO o codice invito")

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
    }


@api_router.post("/auth/login")
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
    }


@api_router.post("/auth/logout")
async def logout(response: Response, _: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"success": True}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    org = await db.organizations.find_one({"id": user["organization_id"]}, {"_id": 0})
    return {
        "id": user["id"], "email": user["email"], "name": user["name"], "role": user.get("role", "member"),
        "organization_id": user["organization_id"], "organization_name": org["name"] if org else None,
        "invite_code": org["invite_code"] if org else None,
        "pseudonymized_mode": bool(org.get("pseudonymized_mode", False)) if org else False,
    }


@api_router.put("/organization/settings")
async def update_org_settings(payload: OrganizationSettings, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo gli amministratori possono modificare le impostazioni")
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nessuna modifica")
    await db.organizations.update_one({"id": user["organization_id"]}, {"$set": update})
    return {"success": True, **update}


@api_router.post("/auth/refresh")
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
        response.set_cookie(key="access_token", value=access, httponly=True, secure=True, samesite="none", max_age=28800, path="/")
        return {"success": True}
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token non valido")


# ==================== PATIENTS (auth + org-scoped) ====================
@api_router.get("/")
async def root():
    return {"message": "Clinimetria Reumatologica API"}


@api_router.post("/patients", response_model=Patient)
async def create_patient(payload: PatientBase, user: dict = Depends(get_current_user)):
    # Require at least codice_paziente OR (nome + cognome) to identify the patient
    has_code = bool((payload.codice_paziente or "").strip())
    has_name = bool((payload.nome or "").strip() and (payload.cognome or "").strip())
    if not has_code and not has_name:
        raise HTTPException(
            status_code=400,
            detail="Fornire almeno il codice paziente o nome+cognome",
        )
    # Enforce uniqueness of codice_paziente within the org
    if has_code:
        existing = await db.patients.find_one({
            "organization_id": user["organization_id"],
            "codice_paziente": payload.codice_paziente.strip(),
        })
        if existing:
            raise HTTPException(status_code=400, detail="Codice paziente già esistente nell'UO")
    p = Patient(**payload.model_dump(), organization_id=user["organization_id"], created_by=user["id"], created_by_name=user.get("name"))
    await db.patients.insert_one(p.model_dump())
    return p


@api_router.post("/patients/{patient_id}/anonymize", response_model=Patient)
async def anonymize_patient(patient_id: str, user: dict = Depends(get_current_user)):
    """Rimuove i dati identificativi (nome, cognome, CF, data_nascita) lasciando solo
    codice paziente + anno di nascita + sesso + diagnosi."""
    await _verify_patient_in_org(patient_id, user["organization_id"])
    patient = await db.patients.find_one(
        {"id": patient_id, "organization_id": user["organization_id"]}, {"_id": 0}
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Paziente non trovato")

    # Compute anno_nascita from data_nascita if present and not already set
    update = {"nome": None, "cognome": None, "codice_fiscale": None, "data_nascita": None}
    if patient.get("data_nascita") and not patient.get("anno_nascita"):
        try:
            update["anno_nascita"] = int(patient["data_nascita"][:4])
        except (ValueError, TypeError):
            pass
    # Ensure codice_paziente exists; if not, generate one
    if not patient.get("codice_paziente"):
        update["codice_paziente"] = f"PZ-{patient_id[:8].upper()}"
    await db.patients.update_one({"id": patient_id}, {"$set": update})
    return await db.patients.find_one({"id": patient_id}, {"_id": 0})


@api_router.get("/patients", response_model=List[Patient])
async def list_patients(user: dict = Depends(get_current_user)):
    docs = await db.patients.find({"organization_id": user["organization_id"]}, {"_id": 0}).to_list(2000)
    # Sort in Python to tolerate missing cognome (pseudonymized patients)
    docs.sort(key=lambda p: (p.get("cognome") or p.get("codice_paziente") or "").lower())
    return docs


@api_router.get("/patients/{patient_id}", response_model=Patient)
async def get_patient(patient_id: str, user: dict = Depends(get_current_user)):
    doc = await db.patients.find_one({"id": patient_id, "organization_id": user["organization_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Paziente non trovato")
    return doc


@api_router.put("/patients/{patient_id}", response_model=Patient)
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


@api_router.delete("/patients/{patient_id}")
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
    return {"success": True}


# ==================== ASSESSMENTS ====================
async def _verify_patient_in_org(patient_id: str, organization_id: str):
    p = await db.patients.find_one({"id": patient_id, "organization_id": organization_id}, {"_id": 0, "id": 1})
    if not p:
        raise HTTPException(status_code=404, detail="Paziente non trovato")


@api_router.post("/assessments", response_model=Assessment)
async def create_assessment(payload: AssessmentBase, user: dict = Depends(get_current_user)):
    await _verify_patient_in_org(payload.patient_id, user["organization_id"])
    a = Assessment(**payload.model_dump(), organization_id=user["organization_id"], created_by=user["id"], created_by_name=user.get("name"))
    await db.assessments.insert_one(a.model_dump())
    return a


@api_router.put("/assessments/{assessment_id}", response_model=Assessment)
async def update_assessment(assessment_id: str, payload: AssessmentBase, user: dict = Depends(get_current_user)):
    update_data = payload.model_dump()
    result = await db.assessments.update_one(
        {"id": assessment_id, "organization_id": user["organization_id"]},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Valutazione non trovata")
    return await db.assessments.find_one({"id": assessment_id}, {"_id": 0})


@api_router.get("/patients/{patient_id}/assessments", response_model=List[Assessment])
async def list_patient_assessments(patient_id: str, user: dict = Depends(get_current_user)):
    await _verify_patient_in_org(patient_id, user["organization_id"])
    docs = await db.assessments.find({"patient_id": patient_id}, {"_id": 0}).sort("date", -1).to_list(2000)
    return docs


@api_router.get("/assessments/{assessment_id}", response_model=Assessment)
async def get_assessment(assessment_id: str, user: dict = Depends(get_current_user)):
    doc = await db.assessments.find_one({"id": assessment_id, "organization_id": user["organization_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Valutazione non trovata")
    return doc


@api_router.delete("/assessments/{assessment_id}")
async def delete_assessment(assessment_id: str, user: dict = Depends(get_current_user)):
    result = await db.assessments.delete_one({"id": assessment_id, "organization_id": user["organization_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Valutazione non trovata")
    return {"success": True}


# ==================== CRITERIA EVALUATIONS ====================
@api_router.post("/criteria-evaluations", response_model=CriteriaEvaluation)
async def create_criteria_evaluation(payload: CriteriaEvaluationBase, user: dict = Depends(get_current_user)):
    await _verify_patient_in_org(payload.patient_id, user["organization_id"])
    ev = CriteriaEvaluation(**payload.model_dump(), organization_id=user["organization_id"], created_by=user["id"], created_by_name=user.get("name"))
    await db.criteria_evaluations.insert_one(ev.model_dump())
    return ev


@api_router.get("/patients/{patient_id}/criteria-evaluations", response_model=List[CriteriaEvaluation])
async def list_patient_criteria(patient_id: str, user: dict = Depends(get_current_user)):
    await _verify_patient_in_org(patient_id, user["organization_id"])
    docs = await db.criteria_evaluations.find({"patient_id": patient_id}, {"_id": 0}).sort("date", -1).to_list(2000)
    return docs


@api_router.delete("/criteria-evaluations/{evaluation_id}")
async def delete_criteria_evaluation(evaluation_id: str, user: dict = Depends(get_current_user)):
    result = await db.criteria_evaluations.delete_one({"id": evaluation_id, "organization_id": user["organization_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Valutazione non trovata")
    return {"success": True}


# ==================== THERAPIES ====================
@api_router.post("/therapies", response_model=Therapy)
async def create_therapy(payload: TherapyBase, user: dict = Depends(get_current_user)):
    await _verify_patient_in_org(payload.patient_id, user["organization_id"])
    t = Therapy(**payload.model_dump(), organization_id=user["organization_id"], created_by=user["id"], created_by_name=user.get("name"))
    await db.therapies.insert_one(t.model_dump())
    return t


@api_router.get("/patients/{patient_id}/therapies", response_model=List[Therapy])
async def list_patient_therapies(patient_id: str, user: dict = Depends(get_current_user)):
    await _verify_patient_in_org(patient_id, user["organization_id"])
    docs = await db.therapies.find({"patient_id": patient_id}, {"_id": 0}).sort("start_date", -1).to_list(2000)
    return docs


@api_router.put("/therapies/{therapy_id}", response_model=Therapy)
async def update_therapy(therapy_id: str, payload: TherapyUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
    result = await db.therapies.update_one(
        {"id": therapy_id, "organization_id": user["organization_id"]},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Terapia non trovata")
    return await db.therapies.find_one({"id": therapy_id}, {"_id": 0})


@api_router.delete("/therapies/{therapy_id}")
async def delete_therapy(therapy_id: str, user: dict = Depends(get_current_user)):
    result = await db.therapies.delete_one({"id": therapy_id, "organization_id": user["organization_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Terapia non trovata")
    return {"success": True}


# ==================== LAB EXAMS ====================
@api_router.post("/lab-exams", response_model=LabExam)
async def create_lab_exam(payload: LabExamBase, user: dict = Depends(get_current_user)):
    await _verify_patient_in_org(payload.patient_id, user["organization_id"])
    e = LabExam(**payload.model_dump(), organization_id=user["organization_id"], created_by=user["id"], created_by_name=user.get("name"))
    await db.lab_exams.insert_one(e.model_dump())
    return e


@api_router.get("/patients/{patient_id}/lab-exams", response_model=List[LabExam])
async def list_patient_lab_exams(patient_id: str, user: dict = Depends(get_current_user)):
    await _verify_patient_in_org(patient_id, user["organization_id"])
    docs = await db.lab_exams.find({"patient_id": patient_id}, {"_id": 0}).sort("date", -1).to_list(2000)
    return docs


@api_router.put("/lab-exams/{exam_id}", response_model=LabExam)
async def update_lab_exam(exam_id: str, payload: LabExamBase, user: dict = Depends(get_current_user)):
    update_data = payload.model_dump()
    result = await db.lab_exams.update_one(
        {"id": exam_id, "organization_id": user["organization_id"]},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Esame non trovato")
    return await db.lab_exams.find_one({"id": exam_id}, {"_id": 0})


@api_router.delete("/lab-exams/{exam_id}")
async def delete_lab_exam(exam_id: str, user: dict = Depends(get_current_user)):
    result = await db.lab_exams.delete_one({"id": exam_id, "organization_id": user["organization_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Esame non trovato")
    return {"success": True}


# ==================== REMINDERS ====================
@api_router.post("/reminders", response_model=Reminder)
async def create_reminder(payload: ReminderBase, user: dict = Depends(get_current_user)):
    await _verify_patient_in_org(payload.patient_id, user["organization_id"])
    r = Reminder(**payload.model_dump(), organization_id=user["organization_id"], created_by=user["id"], created_by_name=user.get("name"))
    await db.reminders.insert_one(r.model_dump())
    return r


@api_router.get("/patients/{patient_id}/reminders", response_model=List[Reminder])
async def list_patient_reminders(patient_id: str, user: dict = Depends(get_current_user)):
    await _verify_patient_in_org(patient_id, user["organization_id"])
    docs = await db.reminders.find({"patient_id": patient_id}, {"_id": 0}).sort("due_date", 1).to_list(2000)
    return docs


@api_router.get("/reminders/upcoming", response_model=List[Reminder])
async def upcoming_reminders(user: dict = Depends(get_current_user)):
    docs = await db.reminders.find(
        {"organization_id": user["organization_id"], "completed": False},
        {"_id": 0},
    ).sort("due_date", 1).limit(20).to_list(20)
    return docs


@api_router.put("/reminders/{reminder_id}", response_model=Reminder)
async def update_reminder(reminder_id: str, payload: ReminderUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
    result = await db.reminders.update_one(
        {"id": reminder_id, "organization_id": user["organization_id"]},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reminder non trovato")
    return await db.reminders.find_one({"id": reminder_id}, {"_id": 0})


@api_router.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str, user: dict = Depends(get_current_user)):
    result = await db.reminders.delete_one({"id": reminder_id, "organization_id": user["organization_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reminder non trovato")
    return {"success": True}


# ==================== EXPORT DATABASE ====================
COLLECTIONS_TO_EXPORT = [
    "patients", "assessments", "criteria_evaluations",
    "therapies", "lab_exams", "reminders", "sclero_profiles",
    "disease_profiles",
]


async def _collect_org_data(organization_id: str) -> dict:
    data = {}
    for col in COLLECTIONS_TO_EXPORT:
        docs = await db[col].find({"organization_id": organization_id}, {"_id": 0}).to_list(100000)
        data[col] = docs
    return data


@api_router.get("/export/json")
async def export_json(user: dict = Depends(get_current_user)):
    """Export all org data as a single JSON file."""
    data = await _collect_org_data(user["organization_id"])
    payload = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "exported_by": user.get("name"),
        "organization_id": user["organization_id"],
        "version": 1,
        **data,
    }
    body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    fname = f"clinimetria_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
    return Response(
        content=body,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


def _flatten_for_csv(value):
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return value if value is not None else ""


@api_router.get("/export/csv-zip")
async def export_csv_zip(user: dict = Depends(get_current_user)):
    """Export all org data as a ZIP of CSV files (one per collection)."""
    data = await _collect_org_data(user["organization_id"])
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for col, rows in data.items():
            csv_buf = io.StringIO()
            if rows:
                # Union of all keys across rows for stable schema
                keys = []
                seen = set()
                for r in rows:
                    for k in r.keys():
                        if k not in seen:
                            seen.add(k)
                            keys.append(k)
                writer = csv.DictWriter(csv_buf, fieldnames=keys, extrasaction="ignore")
                writer.writeheader()
                for r in rows:
                    writer.writerow({k: _flatten_for_csv(r.get(k)) for k in keys})
            else:
                csv_buf.write("(no records)\n")
            zf.writestr(f"{col}.csv", csv_buf.getvalue())
        # Manifest
        manifest = {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "exported_by": user.get("name"),
            "organization_id": user["organization_id"],
            "counts": {col: len(rows) for col, rows in data.items()},
        }
        zf.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))

    buf.seek(0)
    fname = f"clinimetria_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.zip"
    return Response(
        content=buf.read(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# ==================== AI VISIT PARSING ====================
class ParseVisitRequest(BaseModel):
    text: str
    patient_id: Optional[str] = None  # if provided, scope to existing patient


PARSING_SCHEMA_PROMPT = """Sei un assistente clinico esperto in REUMATOLOGIA. Estrai dati strutturati dal testo della visita medica in italiano.
Restituisci ESCLUSIVAMENTE un oggetto JSON valido (no markdown, no commenti, no testo prima/dopo) con questa struttura:

{
  "patient": {
    "nome": "string|null",
    "cognome": "string|null",
    "data_nascita": "YYYY-MM-DD|null",
    "sesso": "M|F|null",
    "codice_fiscale": "string|null",
    "diagnosi": "string|null"
  },
  "assessments": [
    {
      "index_type": "das28_esr|das28_crp|cdai|sdai|basdai|asdas_crp|dapsa|sledai|haq|pasi|basfi|basmi|essdai|esspri|bvas|mmt8|fiqr|mrss|capillaroscopy|schober",
      "date": "YYYY-MM-DD|null",
      "score": "number|null",
      "interpretation": "string|null",
      "tender_count": "number|null",
      "swollen_count": "number|null",
      "inputs": {"any clinically relevant input fields key-value"}
    }
  ],
  "lab_exams": [
    {
      "category": "autoanticorpi|complemento|fase_acuta|emocromo|funzione_organi|urine|altro",
      "date": "YYYY-MM-DD|null",
      "results": [
        {"name": "string", "value": "string", "unit": "string|null", "qualitative": "positivo|negativo|borderline|null", "title": "string|null"}
      ]
    }
  ],
  "therapies": [
    {
      "drug_name": "string",
      "category": "csDMARD|bDMARD|tsDMARD|glucocorticoid|NSAID|analgesic|supportive|other",
      "dose": "string|null",
      "frequency": "string|null",
      "route": "string|null",
      "start_date": "YYYY-MM-DD|null",
      "status": "active|discontinued|completed",
      "notes": "string|null"
    }
  ],
  "sclero_profile": {
    "cutaneous": {"subset": "sine_scleroderma|limited|diffuse|null", "mrss_score": "number|null", "sclerodactyly": "bool|null", "puffy_fingers": "bool|null", "telangiectasias": "bool|null", "calcinosis": "bool|null", "face_involvement": "bool|null"},
    "antibody": {"ana": "string|null", "aca": "neg|pos|borderline|null", "scl70": "neg|pos|borderline|null", "rnap3": "neg|pos|borderline|null", "u3rnp_fibrillarin": "neg|pos|borderline|null", "th_to": "neg|pos|borderline|null", "pm_scl": "neg|pos|borderline|null", "ku": "neg|pos|borderline|null", "u1rnp": "neg|pos|borderline|null"},
    "vascular": {"raynaud": "absent|primary|secondary|null", "raynaud_onset_year": "number|null", "digital_ulcers": "none|past|active_one|active_multiple|null", "capillaroscopy_pattern": "normal|non_specific|early|active|late|null", "pitting_scars": "bool|null", "gangrene": "bool|null", "renal_crisis": "bool|null", "therapy": "string|null"},
    "ild": {"present": "no|yes_stable|yes_progressive|not_assessed|null", "hrct_pattern": "none|nsip|uip|op|mixed|null", "extent": "limited|extensive|null", "fvc_percent": "number|null", "dlco_percent": "number|null", "six_mwt": "number|null", "therapy": "string|null"},
    "pah": {"status": "not_screened|negative|suspected|confirmed|null", "echo_psap": "number|null", "nt_probnp": "number|null", "rhc_done": "yes|no|null", "rhc_mpap": "number|null", "rhc_pcwp": "number|null", "rhc_pvr": "number|null", "who_class": "I|II|III|IV|null", "therapy": "string|null"},
    "gi": {"gerd": "bool|null", "esophageal_dysmotility": "bool|null", "dysphagia": "bool|null", "gavedeformation": "bool|null", "sibo": "bool|null", "intestinal_pseudo_obstruction": "bool|null", "fecal_incontinence": "bool|null", "weight_loss": "bool|null", "therapy": "string|null"},
    "msk": {"arthralgia": "bool|null", "synovitis": "bool|null", "tendon_friction_rubs": "bool|null", "contractures": "bool|null", "myalgia": "bool|null", "myositis": "bool|null", "weakness": "bool|null", "ck_value": "number|null", "therapy": "string|null"}
  },
  "summary": "breve riepilogo italiano della visita (max 3 righe)"
}

REGOLE:
- Lascia i campi a null se non esplicitamente menzionati nel testo. NON inventare.
- Date in formato ISO YYYY-MM-DD. Se solo l'anno è presente, ometti il campo.
- Per "swollen_count" / "tender_count" estrai numeri di articolazioni se menzionati.
- Per anticorpi: "pos" se positivo, "neg" se negativo, "borderline" se debole/dubbio.
- Per "sclero_profile" compila SOLO se la diagnosi è sclerosi sistemica/sclerodermia/SSc/VEDOSS.
- Output: solo JSON puro. Inizia con { e finisci con }. NIENTE altro."""


async def _call_claude_extract(text: str) -> dict:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY non configurato")

    chat = LlmChat(
        api_key=api_key,
        session_id=f"parse-{uuid.uuid4()}",
        system_message=PARSING_SCHEMA_PROMPT,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    user_message = UserMessage(text=f"Testo della visita:\n\n{text}\n\nRestituisci JSON.")
    response = await chat.send_message(user_message)
    raw = (response or "").strip()
    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.strip("`")
        # remove leading "json\n" if present
        if raw.lower().startswith("json"):
            raw = raw[4:].lstrip()
    # Find first { and last }
    if "{" in raw and "}" in raw:
        raw = raw[raw.index("{"): raw.rindex("}") + 1]
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"Risposta AI non valida: {e}")


@api_router.post("/ai/parse-visit")
async def parse_visit_text(payload: ParseVisitRequest, user: dict = Depends(get_current_user)):
    text = (payload.text or "").strip()
    if len(text) < 30:
        raise HTTPException(status_code=400, detail="Testo troppo breve")
    if len(text) > 25000:
        raise HTTPException(status_code=400, detail="Testo troppo lungo (max 25000 caratteri)")

    data = None
    try:
        data = await _call_claude_extract(text)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("AI parse error")
        raise HTTPException(status_code=502, detail=f"Errore AI: {e}")

    return {"extracted": data}


# ==================== STATS ====================
@api_router.get("/stats")
async def stats(user: dict = Depends(get_current_user)):
    org_id = user["organization_id"]
    patients_count = await db.patients.count_documents({"organization_id": org_id})
    assessments_count = await db.assessments.count_documents({"organization_id": org_id})
    recent = await db.assessments.find({"organization_id": org_id}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    return {"patients": patients_count, "assessments": assessments_count, "recent_assessments": recent}


# ==================== SCLERODERMA PROFILE ENDPOINTS ====================
@api_router.get("/patients/{patient_id}/sclero-profile")
async def get_sclero_profile(patient_id: str, user: dict = Depends(get_current_user)):
    await _verify_patient_in_org(patient_id, user["organization_id"])
    doc = await db.sclero_profiles.find_one(
        {"patient_id": patient_id, "organization_id": user["organization_id"]},
        {"_id": 0},
    )
    return doc  # null if not exists


@api_router.put("/patients/{patient_id}/sclero-profile", response_model=ScleroProfile)
async def upsert_sclero_profile(
    patient_id: str,
    payload: ScleroProfileBase,
    user: dict = Depends(get_current_user),
):
    await _verify_patient_in_org(patient_id, user["organization_id"])
    if payload.patient_id != patient_id:
        raise HTTPException(status_code=400, detail="patient_id mismatch")

    existing = await db.sclero_profiles.find_one(
        {"patient_id": patient_id, "organization_id": user["organization_id"]},
        {"_id": 0},
    )
    now = datetime.now(timezone.utc).isoformat()
    if existing:
        update_data = payload.model_dump(exclude={"patient_id"})
        update_data["updated_at"] = now
        update_data["updated_by_name"] = user.get("name")
        await db.sclero_profiles.update_one(
            {"id": existing["id"]},
            {"$set": update_data},
        )
        return await db.sclero_profiles.find_one({"id": existing["id"]}, {"_id": 0})

    profile = ScleroProfile(
        **payload.model_dump(),
        organization_id=user["organization_id"],
        created_by=user["id"],
        created_by_name=user.get("name"),
        updated_by_name=user.get("name"),
    )
    await db.sclero_profiles.insert_one(profile.model_dump())
    return profile


# ==================== GENERIC DISEASE PROFILE (RA / SpA / ...) ====================
ALLOWED_DISEASE_TYPES = {"ra", "spa"}


class DiseaseProfileBase(BaseModel):
    patient_id: str
    data: Dict[str, Any] = Field(default_factory=dict)


class DiseaseProfile(DiseaseProfileBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    disease_type: str
    created_by: str
    created_by_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_by_name: Optional[str] = None


def _check_disease_type(t: str):
    if t not in ALLOWED_DISEASE_TYPES:
        raise HTTPException(status_code=400, detail=f"Disease type '{t}' non supportato")


@api_router.get("/patients/{patient_id}/disease-profile/{disease_type}")
async def get_disease_profile(
    patient_id: str, disease_type: str, user: dict = Depends(get_current_user)
):
    _check_disease_type(disease_type)
    await _verify_patient_in_org(patient_id, user["organization_id"])
    doc = await db.disease_profiles.find_one(
        {
            "patient_id": patient_id,
            "organization_id": user["organization_id"],
            "disease_type": disease_type,
        },
        {"_id": 0},
    )
    return doc  # null if not exists


@api_router.put("/patients/{patient_id}/disease-profile/{disease_type}", response_model=DiseaseProfile)
async def upsert_disease_profile(
    patient_id: str,
    disease_type: str,
    payload: DiseaseProfileBase,
    user: dict = Depends(get_current_user),
):
    _check_disease_type(disease_type)
    await _verify_patient_in_org(patient_id, user["organization_id"])
    if payload.patient_id != patient_id:
        raise HTTPException(status_code=400, detail="patient_id mismatch")

    existing = await db.disease_profiles.find_one(
        {
            "patient_id": patient_id,
            "organization_id": user["organization_id"],
            "disease_type": disease_type,
        },
        {"_id": 0},
    )
    now = datetime.now(timezone.utc).isoformat()
    if existing:
        await db.disease_profiles.update_one(
            {"id": existing["id"]},
            {
                "$set": {
                    "data": payload.data,
                    "updated_at": now,
                    "updated_by_name": user.get("name"),
                }
            },
        )
        return await db.disease_profiles.find_one({"id": existing["id"]}, {"_id": 0})

    profile = DiseaseProfile(
        **payload.model_dump(),
        disease_type=disease_type,
        organization_id=user["organization_id"],
        created_by=user["id"],
        created_by_name=user.get("name"),
        updated_by_name=user.get("name"),
    )
    await db.disease_profiles.insert_one(profile.model_dump())
    return profile


app.include_router(api_router)


# ==================== STARTUP ====================
@app.on_event("startup")
async def startup_event():
    # Indexes
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("id", unique=True)
        await db.organizations.create_index("invite_code", unique=True)
        await db.organizations.create_index("id", unique=True)
        await db.patients.create_index("organization_id")
        await db.assessments.create_index([("patient_id", 1), ("date", -1)])
        await db.criteria_evaluations.create_index([("patient_id", 1), ("date", -1)])
        await db.therapies.create_index([("patient_id", 1)])
        await db.sclero_profiles.create_index([("patient_id", 1)], unique=True)
        await db.disease_profiles.create_index(
            [("patient_id", 1), ("disease_type", 1)], unique=True
        )
    except Exception as e:
        logger.warning(f"Index creation: {e}")

    # Default organization
    default_org_name = os.environ.get("DEFAULT_ORG_NAME", "UO Reumatologia")
    default_org = await db.organizations.find_one({"name": default_org_name}, {"_id": 0})
    if not default_org:
        new_org = Organization(name=default_org_name)
        await db.organizations.insert_one(new_org.model_dump())
        default_org = new_org.model_dump()
    default_org_id = default_org["id"]

    # Migrate existing patients/assessments without organization_id
    await db.patients.update_many({"organization_id": {"$exists": False}}, {"$set": {"organization_id": default_org_id, "created_by": "system"}})
    await db.assessments.update_many({"organization_id": {"$exists": False}}, {"$set": {"organization_id": default_org_id, "created_by": "system"}})
    await db.criteria_evaluations.update_many({"organization_id": {"$exists": False}}, {"$set": {"organization_id": default_org_id, "created_by": "system"}})
    await db.therapies.update_many({"organization_id": {"$exists": False}}, {"$set": {"organization_id": default_org_id, "created_by": "system"}})

    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@clinimetria.it")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing_admin = await db.users.find_one({"email": admin_email})
    if not existing_admin:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "name": "Admin",
            "password_hash": hash_password(admin_password),
            "role": "admin",
            "organization_id": default_org_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(admin_password, existing_admin["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )

    # Write test credentials
    try:
        memory_dir = Path("/app/memory")
        memory_dir.mkdir(parents=True, exist_ok=True)
        org = await db.organizations.find_one({"id": default_org_id}, {"_id": 0})
        creds_path = memory_dir / "test_credentials.md"
        creds_path.write_text(
            f"# Test Credentials\n\n"
            f"## Admin (Default UO)\n"
            f"- Email: `{admin_email}`\n"
            f"- Password: `{admin_password}`\n"
            f"- Role: admin\n"
            f"- Organization: `{org['name']}`\n"
            f"- Invite code: `{org['invite_code']}`\n\n"
            f"## Auth endpoints\n"
            f"- POST /api/auth/register\n"
            f"- POST /api/auth/login\n"
            f"- POST /api/auth/logout\n"
            f"- GET /api/auth/me\n"
            f"- POST /api/auth/refresh\n"
        )
    except Exception as e:
        logger.warning(f"Failed to write test_credentials.md: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# ==================== CORS ====================
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
