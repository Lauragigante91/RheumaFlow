from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, date

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Clinimetria Reumatologica API")
api_router = APIRouter(prefix="/api")


# ==================== MODELS ====================
class PatientBase(BaseModel):
    nome: str
    cognome: str
    data_nascita: Optional[str] = None  # ISO date string
    sesso: Optional[str] = None  # M / F / Altro
    codice_fiscale: Optional[str] = None
    diagnosi: Optional[str] = None
    note: Optional[str] = None


class Patient(PatientBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
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
    index_type: str  # das28_esr, das28_crp, cdai, sdai, basdai, asdas_crp, dapsa, sledai, haq, pasi
    date: str  # ISO date
    inputs: Dict[str, Any] = {}
    score: Optional[float] = None
    interpretation: Optional[str] = None
    tender_joints: List[str] = []
    swollen_joints: List[str] = []
    notes: Optional[str] = None


class Assessment(AssessmentBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CriteriaEvaluationBase(BaseModel):
    patient_id: str
    criteria_id: str  # e.g. "acr_eular_2010_ra"
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
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ==================== PATIENTS ====================
@api_router.get("/")
async def root():
    return {"message": "Clinimetria Reumatologica API"}


@api_router.post("/patients", response_model=Patient)
async def create_patient(payload: PatientBase):
    patient = Patient(**payload.model_dump())
    await db.patients.insert_one(patient.model_dump())
    return patient


@api_router.get("/patients", response_model=List[Patient])
async def list_patients():
    docs = await db.patients.find({}, {"_id": 0}).sort("cognome", 1).to_list(2000)
    return docs


@api_router.get("/patients/{patient_id}", response_model=Patient)
async def get_patient(patient_id: str):
    doc = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Paziente non trovato")
    return doc


@api_router.put("/patients/{patient_id}", response_model=Patient)
async def update_patient(patient_id: str, payload: PatientUpdate):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
    result = await db.patients.update_one({"id": patient_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Paziente non trovato")
    doc = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    return doc


@api_router.delete("/patients/{patient_id}")
async def delete_patient(patient_id: str):
    result = await db.patients.delete_one({"id": patient_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Paziente non trovato")
    await db.assessments.delete_many({"patient_id": patient_id})
    await db.criteria_evaluations.delete_many({"patient_id": patient_id})
    return {"success": True}


# ==================== ASSESSMENTS ====================
@api_router.post("/assessments", response_model=Assessment)
async def create_assessment(payload: AssessmentBase):
    # verify patient exists
    exists = await db.patients.find_one({"id": payload.patient_id}, {"_id": 0, "id": 1})
    if not exists:
        raise HTTPException(status_code=404, detail="Paziente non trovato")
    assessment = Assessment(**payload.model_dump())
    await db.assessments.insert_one(assessment.model_dump())
    return assessment


@api_router.get("/patients/{patient_id}/assessments", response_model=List[Assessment])
async def list_patient_assessments(patient_id: str):
    docs = await db.assessments.find({"patient_id": patient_id}, {"_id": 0}).sort("date", -1).to_list(2000)
    return docs


@api_router.get("/assessments/{assessment_id}", response_model=Assessment)
async def get_assessment(assessment_id: str):
    doc = await db.assessments.find_one({"id": assessment_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Valutazione non trovata")
    return doc


@api_router.delete("/assessments/{assessment_id}")
async def delete_assessment(assessment_id: str):
    result = await db.assessments.delete_one({"id": assessment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Valutazione non trovata")
    return {"success": True}


@api_router.put("/assessments/{assessment_id}", response_model=Assessment)
async def update_assessment(assessment_id: str, payload: AssessmentBase):
    update_data = payload.model_dump()
    result = await db.assessments.update_one({"id": assessment_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Valutazione non trovata")
    doc = await db.assessments.find_one({"id": assessment_id}, {"_id": 0})
    return doc


# ==================== CRITERIA EVALUATIONS ====================
@api_router.post("/criteria-evaluations", response_model=CriteriaEvaluation)
async def create_criteria_evaluation(payload: CriteriaEvaluationBase):
    exists = await db.patients.find_one({"id": payload.patient_id}, {"_id": 0, "id": 1})
    if not exists:
        raise HTTPException(status_code=404, detail="Paziente non trovato")
    evaluation = CriteriaEvaluation(**payload.model_dump())
    await db.criteria_evaluations.insert_one(evaluation.model_dump())
    return evaluation


@api_router.get("/patients/{patient_id}/criteria-evaluations", response_model=List[CriteriaEvaluation])
async def list_patient_criteria(patient_id: str):
    docs = await db.criteria_evaluations.find({"patient_id": patient_id}, {"_id": 0}).sort("date", -1).to_list(2000)
    return docs


@api_router.delete("/criteria-evaluations/{evaluation_id}")
async def delete_criteria_evaluation(evaluation_id: str):
    result = await db.criteria_evaluations.delete_one({"id": evaluation_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Valutazione non trovata")
    return {"success": True}


# ==================== STATS ====================
@api_router.get("/stats")
async def stats():
    patients_count = await db.patients.count_documents({})
    assessments_count = await db.assessments.count_documents({})
    # Recent assessments
    recent = await db.assessments.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    return {
        "patients": patients_count,
        "assessments": assessments_count,
        "recent_assessments": recent,
    }


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
