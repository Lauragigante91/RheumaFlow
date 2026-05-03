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
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
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
    nome: str
    cognome: str
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
    nome: Optional[str] = None
    cognome: Optional[str] = None
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
    }


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
    p = Patient(**payload.model_dump(), organization_id=user["organization_id"], created_by=user["id"], created_by_name=user.get("name"))
    await db.patients.insert_one(p.model_dump())
    return p


@api_router.get("/patients", response_model=List[Patient])
async def list_patients(user: dict = Depends(get_current_user)):
    docs = await db.patients.find({"organization_id": user["organization_id"]}, {"_id": 0}).sort("cognome", 1).to_list(2000)
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


# ==================== STATS ====================
@api_router.get("/stats")
async def stats(user: dict = Depends(get_current_user)):
    org_id = user["organization_id"]
    patients_count = await db.patients.count_documents({"organization_id": org_id})
    assessments_count = await db.assessments.count_documents({"organization_id": org_id})
    recent = await db.assessments.find({"organization_id": org_id}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    return {"patients": patients_count, "assessments": assessments_count, "recent_assessments": recent}


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
