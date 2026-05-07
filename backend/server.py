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
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File
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
    diagnosi_secondarie: List[str] = Field(default_factory=list)  # overlap diagnoses (es. fibromialgia, osteoporosi)
    note: Optional[str] = None


class Patient(PatientBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    created_by: str
    created_by_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    # Recall flag for "Pazienti da ricontrollare" widget. Stored as nested dict
    # {flag, note, set_at, set_by, set_by_name} where flag ∈ {'private', 'shared'}.
    recall: Optional[Dict[str, Any]] = None


class PatientUpdate(BaseModel):
    codice_paziente: Optional[str] = None
    nome: Optional[str] = None
    cognome: Optional[str] = None
    anno_nascita: Optional[int] = None
    data_nascita: Optional[str] = None
    sesso: Optional[str] = None
    codice_fiscale: Optional[str] = None
    diagnosi: Optional[str] = None
    diagnosi_secondarie: Optional[List[str]] = None
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
    auto_discontinued: Optional[bool] = None
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
    # Priority: "routine" = visible only inside patient page;
    #           "asap" = visible in dashboard "richieste urgenti" widget.
    priority: str = "routine"
    # Visibility: "shared" (default) = whole organization can see/edit;
    #             "private"           = only creator + shared_with_user_ids see it.
    visibility: str = "shared"
    shared_with_user_ids: List[str] = Field(default_factory=list)


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
    priority: Optional[str] = None
    visibility: Optional[str] = None
    shared_with_user_ids: Optional[List[str]] = None


# ==================== PRO TOKEN (Patient-Reported Outcomes) ====================
# A PRO token is a short-lived signed link the doctor sends/prints/shows to a
# patient. The patient opens it on their phone and fills validated
# questionnaires (HAQ, BASDAI, BASFI, RAID, VAS pain/PGA, FIQR, PSAID, ESSPRI...).
# When submitted, results are stored on the token and the doctor reviews +
# approves them, optionally turning them into formal assessments.
PRO_INSTRUMENTS_ALLOWED = {
    "haq", "basdai", "basfi", "raid", "psaid", "fiqr", "esspri",
    "vas_pain", "vas_pga", "vas_fatigue",
}


class PROTokenCreate(BaseModel):
    patient_id: str
    instruments: List[str] = Field(default_factory=list)
    expires_in_hours: int = 168  # default 7 days
    note: Optional[str] = None  # optional note shown to the patient


class PROToken(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    token: str = Field(default_factory=lambda: secrets.token_urlsafe(24))
    patient_id: str
    organization_id: str
    instruments: List[str] = Field(default_factory=list)
    note: Optional[str] = None
    expires_at: str
    created_by: str
    created_by_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None
    submitted_responses: Optional[Dict[str, Any]] = None
    # Indicates whether the responses were already converted to assessments.
    converted: bool = False


class PROSubmit(BaseModel):
    responses: Dict[str, Any]


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
    """Inserts one demo patient with its assessments and therapies."""
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


@api_router.post("/auth/demo")
async def login_demo(response: Response):
    """
    One-click demo: creates a fresh isolated organization with 3 pre-populated
    patients (RA, SpA, SLE) with assessments and therapies, and signs the user
    in immediately. Each call creates a NEW demo org (so multiple users can
    explore in parallel).
    """
    import secrets
    suffix = secrets.token_hex(4)  # 8 lowercase hex chars; cryptographically strong
    org = Organization(name=f"Demo UO {suffix}")
    await db.organizations.insert_one(org.model_dump())

    user_id = str(uuid.uuid4())
    email = f"demo-{suffix}@clinimetria.demo"
    await db.users.insert_one({
        "id": user_id, "email": email, "name": "Utente Demo",
        "password_hash": hash_password(f"demo-{suffix}"),
        "role": "admin", "organization_id": org.id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_demo": True,
    })

    today = datetime.now(timezone.utc).date()
    def days_ago(n: int) -> str:
        return (today - timedelta(days=n)).isoformat()

    for p_seed in _build_demo_seed_patients(days_ago):
        await _insert_demo_patient(p_seed, org.id, user_id)

    access = create_access_token(user_id, email, org.id)
    refresh = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh)
    return {
        "id": user_id, "email": email, "name": "Utente Demo", "role": "admin",
        "organization_id": org.id, "organization_name": org.name,
        "is_demo": True,
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
        "is_demo": bool(user.get("is_demo", False)),
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


# ==================== RECALL FLAGS (pazienti da ricontrollare) ====================
# Each patient can have at most one recall flag, with three states:
#   - flag = "private"  → visibile solo all'autore (es. "stellina blu")
#   - flag = "shared"   → visibile a tutti i membri dell'organizzazione (es. "stellina rossa")
#   - flag = None       → nessun ricontrollo
# Stored as `patients.recall = {flag, note, set_at, set_by, set_by_name}`.

class RecallFlagPayload(BaseModel):
    flag: Optional[str] = None  # "private" | "shared" | None
    note: Optional[str] = None


@api_router.put("/patients/{patient_id}/recall")
async def set_patient_recall(
    patient_id: str,
    payload: RecallFlagPayload,
    user: dict = Depends(get_current_user),
):
    if payload.flag not in (None, "", "private", "shared"):
        raise HTTPException(status_code=400, detail="flag deve essere 'private', 'shared' o nullo")
    p = await db.patients.find_one({"id": patient_id, "organization_id": user["organization_id"]}, {"_id": 0, "id": 1})
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
    await db.patients.update_one({"id": patient_id}, {"$set": {"recall": recall}})
    return {"success": True, "recall": recall}


@api_router.get("/patients-recall")
async def list_patients_to_recall(user: dict = Depends(get_current_user)):
    """Pazienti con recall flag visibili a questo utente:
    - tutti i 'shared' dell'org
    - solo i 'private' che ho creato io
    """
    org_id = user["organization_id"]
    cursor = db.patients.find(
        {
            "organization_id": org_id,
            "$or": [
                {"recall.flag": "shared"},
                {"recall.flag": "private", "recall.set_by": user["id"]},
            ],
        },
        {"_id": 0},
    )
    out = []
    async for p in cursor:
        out.append(p)
    out.sort(key=lambda p: (p.get("recall", {}).get("set_at") or ""), reverse=True)
    return out


@api_router.get("/patients-recent-mine")
async def list_recent_patients_mine(days: int = 7, user: dict = Depends(get_current_user)):
    """Pazienti su cui IO ho lavorato (creato/aggiornato un assessment) negli ultimi `days` giorni."""
    org_id = user["organization_id"]
    if days < 1:
        days = 7
    if days > 365:
        days = 365
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
        for p in await db.patients.find({"id": {"$in": pids}, "organization_id": org_id}, {"_id": 0}).to_list(1000)
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
# Categorie che richiedono esclusione (un solo farmaco di queste categorie attivo per volta)
EXCLUSIVE_CATEGORIES = {"bDMARD", "tsDMARD"}


async def _auto_discontinue_competing(patient_id: str, organization_id: str, new_category: str, new_start_date: Optional[str], exclude_id: Optional[str] = None) -> int:
    """If new therapy is in EXCLUSIVE_CATEGORIES (biologic/tsDMARD), discontinue any
    other active therapy of those categories for the same patient. Sets end_date to
    the new therapy's start_date (or today) and status='discontinued'.
    Returns the number of therapies auto-discontinued."""
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
    result = await db.therapies.update_many(
        query,
        {"$set": {"status": "discontinued", "end_date": end_date, "auto_discontinued": True}},
    )
    return result.modified_count


@api_router.post("/therapies", response_model=Therapy)
async def create_therapy(payload: TherapyBase, user: dict = Depends(get_current_user)):
    await _verify_patient_in_org(payload.patient_id, user["organization_id"])
    # Apply exclusivity rule for biologics/tsDMARDs BEFORE inserting the new one
    if (payload.status or "active") == "active":
        await _auto_discontinue_competing(
            payload.patient_id, user["organization_id"], payload.category, payload.start_date
        )
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
    # Fetch current therapy to know patient/category
    current = await db.therapies.find_one({"id": therapy_id, "organization_id": user["organization_id"]}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Terapia non trovata")
    # Apply exclusivity if the (resulting) therapy is an active biologic/tsDMARD
    new_status = update_data.get("status", current.get("status"))
    new_category = update_data.get("category", current.get("category"))
    new_start = update_data.get("start_date", current.get("start_date"))
    if new_status == "active":
        await _auto_discontinue_competing(
            current["patient_id"], user["organization_id"], new_category, new_start, exclude_id=therapy_id
        )
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
def _reminder_visibility_query(user: dict) -> dict:
    """Filter clause: show shared org reminders OR private ones owned/shared with current user."""
    return {
        "$or": [
            {"visibility": {"$ne": "private"}},
            {"created_by": user["id"]},
            {"shared_with_user_ids": user["id"]},
        ]
    }


@api_router.post("/reminders", response_model=Reminder)
async def create_reminder(payload: ReminderBase, user: dict = Depends(get_current_user)):
    await _verify_patient_in_org(payload.patient_id, user["organization_id"])
    r = Reminder(**payload.model_dump(), organization_id=user["organization_id"], created_by=user["id"], created_by_name=user.get("name"))
    await db.reminders.insert_one(r.model_dump())
    return r


@api_router.get("/patients/{patient_id}/reminders", response_model=List[Reminder])
async def list_patient_reminders(patient_id: str, user: dict = Depends(get_current_user)):
    await _verify_patient_in_org(patient_id, user["organization_id"])
    q = {
        "patient_id": patient_id,
        "organization_id": user["organization_id"],
        **_reminder_visibility_query(user),
    }
    docs = await db.reminders.find(q, {"_id": 0}).sort("due_date", 1).to_list(2000)
    return docs


@api_router.get("/reminders/upcoming", response_model=List[Reminder])
async def upcoming_reminders(user: dict = Depends(get_current_user)):
    """Dashboard widget: only PRIORITY=asap items, respecting visibility."""
    q = {
        "organization_id": user["organization_id"],
        "completed": False,
        "priority": "asap",
        **_reminder_visibility_query(user),
    }
    docs = await db.reminders.find(q, {"_id": 0}).sort("due_date", 1).limit(50).to_list(50)
    return docs


@api_router.put("/reminders/{reminder_id}", response_model=Reminder)
async def update_reminder(reminder_id: str, payload: ReminderUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
    # Visibility check: ensure user can update this reminder
    existing = await db.reminders.find_one(
        {"id": reminder_id, "organization_id": user["organization_id"]},
        {"_id": 0},
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Reminder non trovato")
    if existing.get("visibility") == "private" and existing.get("created_by") != user["id"] and user["id"] not in (existing.get("shared_with_user_ids") or []):
        raise HTTPException(status_code=403, detail="Non hai accesso a questa richiesta privata")
    await db.reminders.update_one(
        {"id": reminder_id, "organization_id": user["organization_id"]},
        {"$set": update_data},
    )
    return await db.reminders.find_one({"id": reminder_id}, {"_id": 0})


@api_router.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str, user: dict = Depends(get_current_user)):
    existing = await db.reminders.find_one(
        {"id": reminder_id, "organization_id": user["organization_id"]},
        {"_id": 0},
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Reminder non trovato")
    if existing.get("visibility") == "private" and existing.get("created_by") != user["id"]:
        raise HTTPException(status_code=403, detail="Solo il creatore può eliminare una richiesta privata")
    await db.reminders.delete_one({"id": reminder_id, "organization_id": user["organization_id"]})
    return {"success": True}


@api_router.get("/organization/members")
async def list_org_members(user: dict = Depends(get_current_user)):
    """Return basic info on members of the same organization (for sharing UI)."""
    docs = await db.users.find(
        {"organization_id": user["organization_id"]},
        {"_id": 0, "password_hash": 0},
    ).to_list(500)
    return [
        {"id": d.get("id"), "name": d.get("name"), "email": d.get("email"), "role": d.get("role")}
        for d in docs
    ]


# ==================== PRO TOKENS ====================
@api_router.post("/pro-tokens", response_model=PROToken)
async def create_pro_token(payload: PROTokenCreate, user: dict = Depends(get_current_user)):
    """Doctor creates a short-lived PRO link/QR for a specific patient."""
    await _verify_patient_in_org(payload.patient_id, user["organization_id"])
    invalid = [i for i in payload.instruments if i not in PRO_INSTRUMENTS_ALLOWED]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Strumenti non validi: {invalid}")
    if not payload.instruments:
        raise HTTPException(status_code=400, detail="Devi selezionare almeno uno strumento")
    hours = max(1, min(24 * 60, int(payload.expires_in_hours or 168)))  # max 60 days
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


@api_router.get("/patients/{patient_id}/pro-tokens", response_model=List[PROToken])
async def list_pro_tokens(patient_id: str, user: dict = Depends(get_current_user)):
    """List all PRO tokens (active+expired+completed) for a patient."""
    await _verify_patient_in_org(patient_id, user["organization_id"])
    docs = await db.pro_tokens.find(
        {"patient_id": patient_id, "organization_id": user["organization_id"]},
        {"_id": 0},
    ).sort("created_at", -1).to_list(500)
    return docs


@api_router.delete("/pro-tokens/{token_id}")
async def delete_pro_token(token_id: str, user: dict = Depends(get_current_user)):
    """Doctor revokes a PRO token (deletes it; pending submissions are lost)."""
    res = await db.pro_tokens.delete_one(
        {"id": token_id, "organization_id": user["organization_id"]}
    )
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Token non trovato")
    return {"success": True}


@api_router.post("/pro-tokens/{token_id}/convert")
async def convert_pro_token(token_id: str, user: dict = Depends(get_current_user)):
    """
    Convert a submitted PRO token into formal assessment(s). Each instrument
    that has a numeric score becomes a single assessment row with index_type
    matching the instrument key.
    """
    pt = await db.pro_tokens.find_one(
        {"id": token_id, "organization_id": user["organization_id"]},
        {"_id": 0},
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
        {"id": token_id}, {"$set": {"converted": True, "converted_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True, "created": created}


# ===== PUBLIC PRO endpoints (NO AUTH — token-protected) =====
@api_router.get("/public/pro/{token}")
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

    # Fetch minimal patient context (only first name to confirm to the patient)
    p = await db.patients.find_one({"id": pt["patient_id"]}, {"_id": 0})
    org = await db.organizations.find_one({"id": pt["organization_id"]}, {"_id": 0})
    return {
        "status": "active",
        "patient_first_name": (p or {}).get("nome") or "",
        "patient_code": (p or {}).get("codice_paziente") or "",
        "diagnosis": (p or {}).get("diagnosi") or "",
        "organization_name": (org or {}).get("name") or "",
        "instruments": pt.get("instruments", []),
        "note": pt.get("note"),
        "expires_at": pt["expires_at"],
    }


@api_router.post("/public/pro/{token}/submit")
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
        {
            "$set": {
                "submitted_responses": payload.responses,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
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


# ==================== COHORT EXPORT (XLSX) ====================
def _therapies_active_on(therapies: List[dict], date_str: str) -> List[dict]:
    """Return list of therapies active on a given ISO date (YYYY-MM-DD)."""
    out = []
    for t in therapies:
        start = (t.get("start_date") or "")[:10]
        end = (t.get("end_date") or "")[:10] or None
        if start and start > date_str:
            continue
        if end and end < date_str:
            continue
        # If no start date, skip (can't reason about time)
        if not start:
            continue
        out.append(t)
    return out


def _format_therapy(t: dict) -> str:
    parts = [t.get("drug_name") or "?"]
    if t.get("dose"):
        parts.append(t["dose"])
    if t.get("frequency"):
        parts.append(t["frequency"])
    if t.get("route"):
        parts.append(t["route"])
    return " ".join(parts)


def _days_delta(anchor_iso: Optional[str], visit_iso: Optional[str]):
    """Return integer days delta visit-anchor (negative if before anchor)."""
    if not anchor_iso or not visit_iso:
        return ""
    try:
        a = datetime.fromisoformat(anchor_iso[:10]).date()
        v = datetime.fromisoformat(visit_iso[:10]).date()
        return (v - a).days
    except Exception:
        return ""


async def _load_cohort_data(
    org_id: str, diagnosis: Optional[str]
) -> tuple:
    """
    Load patients (filtered by diagnosis) + their assessments + therapies +
    disease profiles + scleroderma profiles from MongoDB.

    Returns: (patients, assess_by_pid, therap_by_pid, prof_by_pid, sclero_by_pid)
    """
    patient_query: dict = {"organization_id": org_id}
    if diagnosis and diagnosis.strip():
        safe = diagnosis.strip().replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        patient_query["diagnosi"] = {"$regex": safe, "$options": "i"}
    patients = await db.patients.find(patient_query, {"_id": 0}).to_list(100000)
    patient_ids = [p["id"] for p in patients]

    assess_by_pid: Dict[str, List[dict]] = {}
    therap_by_pid: Dict[str, List[dict]] = {}
    prof_by_pid: Dict[str, Dict[str, dict]] = {}
    sclero_by_pid: Dict[str, dict] = {}

    if patient_ids:
        flt = {"organization_id": org_id, "patient_id": {"$in": patient_ids}}
        for a in await db.assessments.find(flt, {"_id": 0}).to_list(1000000):
            assess_by_pid.setdefault(a["patient_id"], []).append(a)
        for t in await db.therapies.find(flt, {"_id": 0}).to_list(1000000):
            therap_by_pid.setdefault(t["patient_id"], []).append(t)
        for d in await db.disease_profiles.find(flt, {"_id": 0}).to_list(1000000):
            prof_by_pid.setdefault(d["patient_id"], {})[d.get("disease_type", "unknown")] = d
        for s in await db.sclero_profiles.find(flt, {"_id": 0}).to_list(1000000):
            sclero_by_pid[s["patient_id"]] = s

    return patients, assess_by_pid, therap_by_pid, prof_by_pid, sclero_by_pid


def _build_visits_pivot(assess_by_pid: Dict[str, List[dict]]) -> tuple:
    """Group assessments per (patient, date). Returns (visits_by_pid, max_visits, all_indices)."""
    visits_by_pid: Dict[str, List[dict]] = {}
    max_visits = 0
    for pid, alist in assess_by_pid.items():
        by_date: Dict[str, List[dict]] = {}
        for a in alist:
            d = (a.get("date") or a.get("created_at") or "")[:10]
            if d:
                by_date.setdefault(d, []).append(a)
        visits = sorted(({"date": d, "assessments": ass} for d, ass in by_date.items()), key=lambda v: v["date"])
        visits_by_pid[pid] = visits
        if len(visits) > max_visits:
            max_visits = len(visits)

    seen_idx: set = set()
    all_indices: List[str] = []
    for alist in assess_by_pid.values():
        for a in alist:
            it = a.get("index_type")
            if it and it not in seen_idx:
                seen_idx.add(it)
                all_indices.append(it)
    all_indices.sort()
    return visits_by_pid, max_visits, all_indices


def _compute_anchor_dates(
    therap_by_pid: Dict[str, List[dict]], anchor_drug: str
) -> Dict[str, str]:
    """For each patient, return earliest start_date of a therapy whose drug_name contains the anchor (case-insensitive)."""
    anchor_norm = (anchor_drug or "").strip().lower()
    out: Dict[str, str] = {}
    if not anchor_norm:
        return out
    for pid, ther_list in therap_by_pid.items():
        matches = [
            t for t in ther_list
            if t.get("start_date") and anchor_norm in (t.get("drug_name") or "").lower()
        ]
        if matches:
            out[pid] = min(t["start_date"] for t in matches)
    return out


def _collect_profile_columns(
    prof_by_pid: Dict[str, Dict[str, dict]],
    sclero_by_pid: Dict[str, dict],
) -> tuple:
    """Return (profile_cols, sclero_cols): lists of (disease_type|section, key) tuples."""
    profile_cols: List[tuple] = []
    profile_keys_seen: set = set()
    for prof_map in prof_by_pid.values():
        for dtype, doc in prof_map.items():
            for k in (doc.get("data") or {}).keys():
                tag = (dtype, k)
                if tag not in profile_keys_seen:
                    profile_keys_seen.add(tag)
                    profile_cols.append(tag)

    sclero_cols: List[tuple] = []
    sclero_keys_seen: set = set()
    for sdoc in sclero_by_pid.values():
        for sec in ("cutaneous", "antibody", "vascular", "ild", "pah", "gi", "msk"):
            section_data = sdoc.get(sec) or {}
            if not isinstance(section_data, dict):
                continue
            for k in section_data.keys():
                tag = (sec, k)
                if tag not in sclero_keys_seen:
                    sclero_keys_seen.add(tag)
                    sclero_cols.append(tag)
    return profile_cols, sclero_cols


def _build_cohort_columns(
    pseudo: bool,
    profile_cols: List[tuple],
    sclero_cols: List[tuple],
    anchor_norm: bool,
    max_visits: int,
    all_indices: List[str],
) -> List[str]:
    """Build the ordered list of column names for the main 'Coorte' sheet."""
    cols: List[str] = ["codice_paziente"]
    if not pseudo:
        cols.extend(["cognome", "nome", "codice_fiscale", "data_nascita"])
    cols.extend(["anno_nascita", "sesso", "diagnosi", "note", "n_visite"])
    for dtype, k in profile_cols:
        cols.append(f"profilo_{dtype}__{k}")
    for sec, k in sclero_cols:
        cols.append(f"ssc_{sec}__{k}")
    if anchor_norm:
        cols.extend(["anchor_drug", "anchor_t0"])
    for i in range(1, max_visits + 1):
        cols.append(f"t{i}_data")
        if anchor_norm:
            cols.append(f"t{i}_giorni_da_anchor")
        for idx in all_indices:
            cols.append(f"t{i}_{idx}_score")
        cols.append(f"t{i}_terapie_attive")
    return cols


def _build_patient_row(
    p: dict,
    *,
    pseudo: bool,
    visits: List[dict],
    all_ther: List[dict],
    profile_cols: List[tuple],
    sclero_cols: List[tuple],
    prof_map: Dict[str, dict],
    sdoc: Optional[dict],
    all_indices: List[str],
    max_visits: int,
    anchor_drug: Optional[str],
    anchor_t0: Optional[str],
) -> List[Any]:
    """Build the ordered row of cell values for one patient on the 'Coorte' sheet."""
    row: List[Any] = [p.get("codice_paziente") or ""]
    if not pseudo:
        row.extend([
            p.get("cognome") or "",
            p.get("nome") or "",
            p.get("codice_fiscale") or "",
            p.get("data_nascita") or "",
        ])
    row.extend([
        p.get("anno_nascita") or "",
        p.get("sesso") or "",
        p.get("diagnosi") or "",
        (p.get("note") or "").replace("\n", " "),
        len(visits),
    ])
    for dtype, k in profile_cols:
        doc = prof_map.get(dtype)
        val = (doc or {}).get("data", {}).get(k) if doc else None
        row.append(_cell(val))
    for sec, k in sclero_cols:
        val = None
        if sdoc:
            section_data = sdoc.get(sec) or {}
            if isinstance(section_data, dict):
                val = section_data.get(k)
        row.append(_cell(val))
    if anchor_drug:
        row.append(anchor_drug)
        row.append(anchor_t0 or "")
    for i in range(max_visits):
        if i < len(visits):
            v = visits[i]
            row.append(v["date"])
            if anchor_drug:
                row.append(_days_delta(anchor_t0, v["date"]))
            score_map: Dict[str, Any] = {}
            for a in v["assessments"]:
                it = a.get("index_type")
                s = a.get("score")
                if it and s is not None and it not in score_map:
                    score_map[it] = s
            for idx in all_indices:
                row.append(score_map.get(idx, ""))
            active = _therapies_active_on(all_ther, v["date"])
            row.append("; ".join(_format_therapy(t) for t in active) if active else "")
        else:
            row.append("")
            if anchor_drug:
                row.append("")
            for _ in all_indices:
                row.append("")
            row.append("")
    return row


def _style_header_row(ws, ncols: int, row: int = 1) -> None:
    hfont = Font(bold=True, color="FFFFFF", size=10)
    hfill = PatternFill("solid", fgColor="0A2540")
    halign = Alignment(horizontal="left", vertical="center", wrap_text=True)
    for col_idx in range(1, ncols + 1):
        c = ws.cell(row=row, column=col_idx)
        c.font = hfont
        c.fill = hfill
        c.alignment = halign
    ws.row_dimensions[row].height = 30
    ws.freeze_panes = "A2"


def _autosize_columns(ws, cols: List[str]) -> None:
    for col_idx, name in enumerate(cols, start=1):
        max_len = len(name)
        letter = ws.cell(row=1, column=col_idx).column_letter
        for r in range(2, ws.max_row + 1):
            val = ws.cell(row=r, column=col_idx).value
            if val is not None:
                L = len(str(val))
                if L > max_len:
                    max_len = L
        ws.column_dimensions[letter].width = min(max(max_len + 2, 12), 60)


def _write_long_sheet(
    wb,
    *,
    title: str,
    columns: List[str],
    pseudo: bool,
    patients: List[dict],
    items_for_patient,
    sort_key=None,
) -> None:
    """Write a long-format companion sheet (Terapie / Valutazioni)."""
    cols = [c for c in columns if not (pseudo and c in ("cognome", "nome"))]
    ws = wb.create_sheet(title)
    ws.append(cols)
    _style_header_row(ws, len(cols))
    ws.row_dimensions[1].height = 25
    for p in patients:
        items = items_for_patient(p)
        if sort_key:
            items = sorted(items, key=sort_key)
        for it in items:
            row = []
            for k in cols:
                if k == "codice_paziente":
                    row.append(p.get("codice_paziente") or "")
                elif k in ("cognome", "nome", "diagnosi"):
                    row.append(p.get(k) or "")
                else:
                    row.append(_cell(it.get(k)))
            ws.append(row)


@api_router.get("/export/cohort-xlsx")
async def export_cohort_xlsx(
    diagnosis: Optional[str] = None,
    anchor_drug: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """
    Export an Excel workbook where each row = 1 patient of the cohort
    (optionally filtered by diagnosis, case-insensitive contains), with
    demographics + disease profile + pivoted visits (t1, t2, ...) each
    showing score per index + active therapies at that date.

    If `anchor_drug` is provided (case-insensitive contains match on drug_name),
    each patient's t0 is anchored to the earliest start_date of that drug; an
    extra column `tN_giorni_da_anchor` reports the day delta of each visit
    relative to that anchor (negative = before, positive = after).
    """
    org_id = user["organization_id"]

    patients, assess_by_pid, therap_by_pid, prof_by_pid, sclero_by_pid = await _load_cohort_data(
        org_id, diagnosis
    )
    visits_by_pid, max_visits, all_indices = _build_visits_pivot(assess_by_pid)
    anchor_by_pid = _compute_anchor_dates(therap_by_pid, anchor_drug or "")
    profile_cols, sclero_cols = _collect_profile_columns(prof_by_pid, sclero_by_pid)

    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    pseudo = bool((org or {}).get("pseudonymized_mode"))
    anchor_active = bool((anchor_drug or "").strip())

    # Workbook + main sheet
    wb = Workbook()
    ws = wb.active
    ws.title = "Coorte"

    cols = _build_cohort_columns(pseudo, profile_cols, sclero_cols, anchor_active, max_visits, all_indices)
    ws.append(cols)
    _style_header_row(ws, len(cols))

    for p in patients:
        ws.append(_build_patient_row(
            p,
            pseudo=pseudo,
            visits=visits_by_pid.get(p["id"], []),
            all_ther=therap_by_pid.get(p["id"], []),
            profile_cols=profile_cols,
            sclero_cols=sclero_cols,
            prof_map=prof_by_pid.get(p["id"], {}),
            sdoc=sclero_by_pid.get(p["id"]),
            all_indices=all_indices,
            max_visits=max_visits,
            anchor_drug=(anchor_drug if anchor_active else None),
            anchor_t0=anchor_by_pid.get(p["id"]),
        ))
    _autosize_columns(ws, cols)

    # Long-format sheets
    _write_long_sheet(
        wb,
        title="Terapie",
        columns=[
            "codice_paziente", "cognome", "nome", "diagnosi", "drug_name", "category",
            "indication", "dose", "frequency", "route", "start_date", "end_date",
            "status", "discontinuation_reason", "auto_discontinued", "notes", "created_by_name",
        ],
        pseudo=pseudo,
        patients=patients,
        items_for_patient=lambda p: therap_by_pid.get(p["id"], []),
    )
    _write_long_sheet(
        wb,
        title="Valutazioni",
        columns=[
            "codice_paziente", "cognome", "nome", "diagnosi", "date",
            "index_type", "score", "interpretation",
            "tender_count", "swollen_count", "created_by_name", "notes",
        ],
        pseudo=pseudo,
        patients=patients,
        items_for_patient=lambda p: assess_by_pid.get(p["id"], []),
        sort_key=lambda x: (x.get("date") or ""),
    )

    # Serialize
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    diag_tag = (diagnosis or "all").strip().replace(" ", "_").replace("/", "_")[:30] or "all"
    fname = f"coorte_{diag_tag}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.xlsx"
    return Response(
        content=buf.read(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


def _cell(val):
    """Serialize a cell value safely for openpyxl."""
    if val is None:
        return ""
    if isinstance(val, bool):
        return "sì" if val else "no"
    if isinstance(val, (dict, list)):
        return json.dumps(val, ensure_ascii=False)
    return val


@api_router.get("/export/diagnoses")
async def export_diagnoses(user: dict = Depends(get_current_user)):
    """Return the distinct list of diagnoses present for the organization, to populate the cohort filter."""
    org_id = user["organization_id"]
    vals = await db.patients.distinct("diagnosi", {"organization_id": org_id})
    clean = sorted({(v or "").strip() for v in vals if (v or "").strip()})
    return {"diagnoses": clean}


@api_router.get("/export/drugs")
async def export_drugs(user: dict = Depends(get_current_user)):
    """Return the distinct list of drug names used in therapies, for cohort anchor selection."""
    org_id = user["organization_id"]
    vals = await db.therapies.distinct("drug_name", {"organization_id": org_id})
    clean = sorted({(v or "").strip() for v in vals if (v or "").strip()}, key=lambda s: s.lower())
    return {"drugs": clean}


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
      "index_type": "das28_esr|das28_crp|cdai|sdai|basdai|asdas_crp|dapsa|sledai|haq|pasi|basfi|basmi|essdai|esspri|bvas|mmt8|fiqr|mrss|capillaroscopy|schober|lei",
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
  "criteria_flags": {
    "haemochromatosis": {
      "iron_fist": "bool|null",
      "joint_onset_before_50": "bool|null",
      "absence_dip_swelling_deformity": "bool|null",
      "mcp_2_5_tenderness": "bool|null",
      "hip_ankle_surgery": "none|hip_only|ankle_only|ankle_and_hip|null",
      "hfe_c282y_homozygous": "bool|null",
      "iron_overload": "bool|null"
    }
  },
  "summary": "breve riepilogo italiano della visita (max 3 righe)"
}

REGOLE:
- Lascia i campi a null se non esplicitamente menzionati nel testo. NON inventare.
- Date in formato ISO YYYY-MM-DD. Se solo l'anno è presente, ometti il campo.
- Per "swollen_count" / "tender_count" estrai numeri di articolazioni se menzionati.
- Per "lei" (Leeds Enthesitis Index): se il testo menziona dolorabilità in entesite/inserzioni
  (es. "Achille destro dolente", "epicondilo laterale sinistro", "condilo femorale mediale dx"),
  popola "inputs.sites" con le chiavi tra: lat_epicondyle_l, lat_epicondyle_r,
  med_femoral_l, med_femoral_r, achilles_l, achilles_r — valore booleano (true se doloroso/positivo).
  Calcola lo score come somma dei siti positivi (range 0–6). Esempio: "Achille bilaterale doloroso,
  epicondilo dx" → sites: {achilles_l: true, achilles_r: true, lat_epicondyle_r: true} score=3.
- Per anticorpi: "pos" se positivo, "neg" se negativo, "borderline" se debole/dubbio.
- Per "sclero_profile" compila SOLO se la diagnosi è sclerosi sistemica/sclerodermia/SSc/VEDOSS.
- Per "criteria_flags.haemochromatosis" compila SOLO se la nota menziona emocromatosi/HFE/sovraccarico di ferro/artropatia da ferro:
  * "iron_fist": true se il paziente NON riesce a chiudere completamente il pugno per limitazione MCP 2-5 (es. "non riesce a chiudere il pugno", "iron fist positivo", "limitazione flessione MCP", "pugno serrato impossibile"). False se la chiusura del pugno è documentata come normale.
  * "joint_onset_before_50": true se l'esordio dei sintomi articolari è prima dei 50 anni.
  * "absence_dip_swelling_deformity": true se le DIP sono descritte SENZA tumefazione e SENZA deformità (cioè non OA-like). False se sono presenti noduli di Heberden/tumefazione DIP.
  * "mcp_2_5_tenderness": true se MCP 2°/3°/4°/5° dolorabili all'esame.
  * "hip_ankle_surgery": "ankle_only" / "hip_only" / "ankle_and_hip" / "none" in base alla storia chirurgica documentata.
  * "hfe_c282y_homozygous": true se la genetica conferma omozigosi C282Y. false se eterozigosi/altro.
  * "iron_overload": true se ferritina elevata, saturazione transferrina elevata, o evidenza biopsia/RMN.
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


# ==================== AI - LAB EXAMS PARSING (PDF/IMAGE) ====================
# Lab schema definition mirrors /app/frontend/src/lib/labPanels.js so that the
# AI returns keys aligned with the existing UI panels and existing data model.
LAB_SCHEMA_KEYS_BY_PANEL = {
    "autoanticorpi": [
        "ana_titolo", "ana_pattern", "anti_dsdna", "anti_sm", "anti_rnp", "anti_ssa_ro", "anti_ssb_la",
        "anti_scl70", "anti_centromero", "anti_rnap3", "anti_pmscl", "anti_ku", "anti_jo1", "anti_mi2",
        "anti_mda5", "anti_tif1g", "anti_nxp2", "anti_srp", "anti_hmgcr",
        "anca_pr3", "anca_mpo", "fr", "acpa_anti_ccp", "anti_mcv",
        "lac", "acl_igg", "acl_igm", "b2gp1_igg", "b2gp1_igm",
    ],
    "complemento": ["c3", "c4", "ch50"],
    "fase_acuta": ["ves", "pcr", "fibrinogeno", "ferritina", "saa"],
    "emocromo": ["wbc", "neutrophils", "lymphocytes", "eosinophils", "monocytes", "hb", "plt"],
    "funzione": ["creatinina", "egfr", "ast", "alt", "ggt", "ldh", "ck", "aldolasi", "urato", "vit_d"],
    "urine": ["proteinuria_24h", "albuminuria", "uacr", "urinary_casts", "hematuria", "sedimento_note"],
}

LAB_PARSING_PROMPT = """Sei un assistente medico esperto in REUMATOLOGIA e LABORATORIO clinico italiano.
RICEVI: il contenuto di un referto di laboratorio (PDF o foto/scansione del referto).
COMPITO: estrarre TUTTI i valori dei test che corrispondono allo schema sottostante e restituire UN SOLO JSON in italiano.

Schema atteso (chiavi standardizzate con cui devi mappare i nomi italiani/inglesi che trovi sul referto):
{
  "date": "YYYY-MM-DD" (se rilevabile la data del prelievo o della firma del referto, altrimenti null),
  "values": {
    "<panel>__<test_key>": {
      "value": numero (oppure null se solo qualitativo),
      "qualitative": "pos|neg|positivo|negativo|debolmente_positivo|null" (solo per test qualitativi tipo Lupus Anticoagulant, ANA pattern, ecc),
      "unit": "stringa, es. mg/L, U/mL, x10^9/L"
    }
  },
  "raw_notes": "note testuali rilevanti dal referto (max 500 caratteri)"
}

Pannelli e chiavi consentite:
- autoanticorpi: ana_titolo, ana_pattern, anti_dsdna, anti_sm, anti_rnp, anti_ssa_ro, anti_ssb_la, anti_scl70, anti_centromero, anti_rnap3, anti_pmscl, anti_ku, anti_jo1, anti_mi2, anti_mda5, anti_tif1g, anti_nxp2, anti_srp, anti_hmgcr, anca_pr3, anca_mpo, fr, acpa_anti_ccp, anti_mcv, lac, acl_igg, acl_igm, b2gp1_igg, b2gp1_igm
- complemento: c3, c4, ch50
- fase_acuta: ves, pcr, fibrinogeno, ferritina, saa
- emocromo: wbc, neutrophils, lymphocytes, eosinophils, monocytes, hb, plt
- funzione: creatinina, egfr, ast, alt, ggt, ldh, ck, aldolasi, urato, vit_d
- urine: proteinuria_24h, albuminuria, uacr, urinary_casts, hematuria, sedimento_note

Regole di mapping italiano/inglese (importanti):
- "VES" / "ESR" → fase_acuta__ves
- "PCR" / "Proteina C reattiva" / "CRP" → fase_acuta__pcr
- "Hb" / "Emoglobina" / "Hemoglobin" → emocromo__hb
- "Globuli bianchi" / "WBC" / "Leucociti" → emocromo__wbc
- "Globuli rossi" / "RBC" → ignorare (non in schema)
- "PLT" / "Piastrine" → emocromo__plt
- "Creatinina" / "Creatinine" → funzione__creatinina
- "GOT" / "AST" → funzione__ast
- "GPT" / "ALT" → funzione__alt
- "γGT" / "GGT" → funzione__ggt
- "CK" / "CPK" / "Creatinchinasi" → funzione__ck
- "C3" / "Complemento C3" → complemento__c3
- "Anti-CCP" / "ACPA" → autoanticorpi__acpa_anti_ccp
- "Fattore Reumatoide" / "FR" / "RF" → autoanticorpi__fr
- "ANA" titolo es 1:160, 1:320 → autoanticorpi__ana_titolo (value=null, "qualitative" può essere il titolo come stringa)
- "Anti-dsDNA" / "Anti-DNA nativo" → autoanticorpi__anti_dsdna
- "Vitamina D" / "25(OH)D" → funzione__vit_d
- "Acido urico" / "Uricemia" → funzione__urato
- "Ferritina" → fase_acuta__ferritina
- "eGFR" / "Velocità filtrazione glomerulare" / "GFR" → funzione__egfr
- "Proteinuria 24h" / "Proteinuria delle 24 ore" → urine__proteinuria_24h

Linee guida operative:
- INSERISCI nel JSON SOLO i test effettivamente presenti nel referto. Tutti gli altri li ometti (NON null fittizi).
- Per test qualitativi (Lupus Anticoagulant, ANA pattern, anti-Sm, ecc), valorizza "qualitative" e lascia "value" a null.
- Conserva l'unità di misura come scritta sul referto.
- Se il valore è "<5" o ">300" tieni il numero principale e mettilo in "value", aggiungi un commento in raw_notes.
- Se il referto contiene SOLO immagini (foto del referto) leggi via OCR e applica le stesse regole.
- NON inventare valori non presenti nel referto.
- Output: SOLO JSON puro. Inizia con { e finisci con }. Niente altro."""


def _resolve_lab_file_mime(content_type: str, fname: str) -> tuple:
    """Return (mime, ext) tuple for supported lab file types, or raise 400."""
    ct = (content_type or "").lower()
    fn = fname.lower()
    if ct == "application/pdf" or fn.endswith(".pdf"):
        return "application/pdf", ".pdf"
    if ct in ("image/jpeg", "image/jpg") or fn.endswith((".jpg", ".jpeg")):
        return "image/jpeg", ".jpg"
    if ct == "image/png" or fn.endswith(".png"):
        return "image/png", ".png"
    if ct == "image/webp" or fn.endswith(".webp"):
        return "image/webp", ".webp"
    raise HTTPException(
        status_code=400,
        detail="Formato non supportato. Carica PDF, JPEG, PNG o WEBP.",
    )


async def _gemini_extract_lab(tmp_path: str, mime: str) -> dict:
    """Send the lab file to Gemini 2.5 Pro and return the parsed JSON dict."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY non configurato")

    chat = LlmChat(
        api_key=api_key,
        session_id=f"lab-{uuid.uuid4()}",
        system_message=LAB_PARSING_PROMPT,
    ).with_model("gemini", "gemini-2.5-pro")

    attachment = FileContentWithMimeType(file_path=tmp_path, mime_type=mime)
    user_message = UserMessage(
        text=(
            "Estrai i valori di laboratorio da questo referto secondo lo schema "
            "indicato nel system prompt. Restituisci SOLO JSON valido."
        ),
        file_contents=[attachment],
    )

    try:
        response = await chat.send_message(user_message)
    except Exception as e:
        logger.exception("Lab AI parse error")
        raise HTTPException(status_code=502, detail=f"Errore AI: {e}")

    raw = (response or "").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].lstrip()
    if "{" in raw and "}" in raw:
        raw = raw[raw.index("{") : raw.rindex("}") + 1]
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"Risposta AI non valida: {e}")


def _reorganize_lab_values(values: dict) -> tuple:
    """Reorganize "panel__test" flat keys into nested {panel: {test_key: val}}.

    Returns (reorganized_dict, unmatched_keys_list).
    """
    reorganized: Dict[str, Dict[str, Any]] = {}
    unmatched: List[str] = []
    for key, val in (values or {}).items():
        if "__" not in key:
            unmatched.append(key)
            continue
        panel, test_key = key.split("__", 1)
        if panel not in LAB_SCHEMA_KEYS_BY_PANEL:
            unmatched.append(key)
            continue
        if test_key not in LAB_SCHEMA_KEYS_BY_PANEL[panel]:
            unmatched.append(key)
            continue
        reorganized.setdefault(panel, {})[test_key] = val
    return reorganized, unmatched


@api_router.post("/ai/parse-lab")
async def parse_lab_file(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """
    Accept a PDF or image (jpeg/png/webp) of a laboratory report and use Gemini
    2.5 Pro (multimodal) to extract structured lab values mapped to the
    application's lab panels schema.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="File non valido")

    mime, ext = _resolve_lab_file_mime(file.content_type or "", file.filename)

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="File vuoto")
    if len(contents) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File troppo grande (max 15 MB)")

    # Persist to a temp file (emergentintegrations expects a file path)
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        data = await _gemini_extract_lab(tmp_path, mime)
        reorganized, unmatched = _reorganize_lab_values(data.get("values") or {})
        return {
            "date": data.get("date"),
            "panels": reorganized,
            "raw_notes": data.get("raw_notes"),
            "unmatched_keys": unmatched,
            "filename": file.filename,
        }
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


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
ALLOWED_DISEASE_TYPES = {"ra", "spa", "sle", "aav", "sjogren", "myositis"}


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
