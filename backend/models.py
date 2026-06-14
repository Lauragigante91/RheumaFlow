import os
import uuid
import secrets
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict, EmailStr


class Organization(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    invite_code: str = Field(default_factory=lambda: secrets.token_urlsafe(8))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    pseudonymized_mode: bool = False


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
    organization_name: Optional[str] = None
    invite_code: Optional[str] = None
    platform_code: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class PatientBase(BaseModel):
    codice_paziente: Optional[str] = None
    nome: Optional[str] = None
    cognome: Optional[str] = None
    anno_nascita: Optional[int] = None
    data_nascita: Optional[str] = None
    sesso: Optional[str] = None
    codice_fiscale: Optional[str] = None
    diagnosi: Optional[str] = None
    diagnosi_secondarie: List[str] = Field(default_factory=list)
    note: Optional[str] = None
    onset_year: Optional[int] = None
    onset_month: Optional[int] = None
    patient_state: Optional[str] = None
    # Profilo generale — campi narrativi del paziente
    anamnesi_fisiologica: Optional[str] = None
    anamnesi_familiare: Optional[str] = None
    comorbidita_apr: Optional[str] = None
    terapia_domiciliare: Optional[str] = None
    allergie_testo: Optional[str] = None


class Patient(PatientBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    created_by: str
    created_by_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
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
    onset_year: Optional[int] = None
    onset_month: Optional[int] = None
    patient_state: Optional[str] = None
    anamnesi_fisiologica: Optional[str] = None
    anamnesi_familiare: Optional[str] = None
    comorbidita_apr: Optional[str] = None
    terapia_domiciliare: Optional[str] = None
    allergie_testo: Optional[str] = None


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
    visit_id: Optional[str] = None
    visit_type: Optional[str] = None
    source_filename: Optional[str] = None


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


# ── Therapy Episode Events ────────────────────────────────────────────────────
# Valid event types for a therapy episode
THERAPY_EVENT_TYPES = frozenset({
    "started", "continued",
    "dose_increased", "dose_reduced",
    "regimen_changed",          # frequency / route change without dose change
    "discontinued", "paused",
    "resumed_within", "noted",
    "historical_exposure",
})

# Valid therapy_type values (classification, not storage)
THERAPY_TYPES = frozenset({
    "rheum_dmard", "glucocorticoid", "nsaid",
    "cardiovascular", "metabolic", "antiviral",
    "osteoporosis", "supportive", "other",
})

# Valid relevance values
THERAPY_RELEVANCE = frozenset({"high", "medium", "low"})


class TherapyEvent(BaseModel):
    """A single clinical event inside a therapy episode."""
    type: str
    date: str
    voided: Optional[bool] = None
    # date_approximate: True when only the year is known (e.g. historical events)
    date_approximate: Optional[bool] = None
    # dose: snapshot of the dose at the time of this event
    dose: Optional[str] = None
    dose_before: Optional[str] = None
    dose_after: Optional[str] = None
    # frequency / route history — used by therapy_state_at() for point-in-time reconstruction
    # On "started" / "noted": frequency_after / route_after capture the initial regimen.
    # On "dose_increased" / "dose_reduced": carry frequency/route changes that co-occur.
    # On "regimen_changed": carry frequency/route changes without a dose change.
    frequency_before: Optional[str] = None
    frequency_after:  Optional[str] = None
    route_before:     Optional[str] = None
    route_after:      Optional[str] = None
    reason: Optional[str] = None
    visit_id: Optional[str] = None
    created_by: Optional[str] = None
    created_by_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    notes: Optional[str] = None


class TherapyEventAdd(BaseModel):
    """Payload for manually appending an event to an existing episode."""
    type: str
    date: str
    voided: Optional[bool] = None
    date_approximate: Optional[bool] = None
    dose: Optional[str] = None
    dose_before: Optional[str] = None
    dose_after: Optional[str] = None
    frequency_before: Optional[str] = None
    frequency_after:  Optional[str] = None
    route_before:     Optional[str] = None
    route_after:      Optional[str] = None
    reason: Optional[str] = None
    visit_id: Optional[str] = None
    notes: Optional[str] = None


class TherapyBase(BaseModel):
    patient_id: str
    drug_name: str
    # drug_canonical: normalised lowercase name used to match episodes of the same drug
    drug_canonical: Optional[str] = None
    category: str
    # therapy_type: clinical classification (rheum_dmard, glucocorticoid, cardiovascular, …)
    therapy_type: Optional[str] = None
    # relevance: how relevant this drug is to the rheumatological context
    relevance: Optional[str] = None
    indication: Optional[str] = None
    dose: Optional[str] = None
    frequency: Optional[str] = None
    route: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    # first_seen_date: date RheumaFlow first recorded this therapy (always set)
    first_seen_date: Optional[str] = None
    # date_approximate: True when start/end are year-only or "circa" estimates
    date_approximate: Optional[bool] = None
    # source: origin of the record ("anamnesi_prima_visita", "visita", "importazione")
    source: Optional[str] = None
    status: str = "active"
    discontinuation_reason: Optional[str] = None
    auto_discontinued: Optional[bool] = None
    notes: Optional[str] = None
    therapy_event: Optional[str] = None
    visit_id: Optional[str] = None
    # events: chronological log of clinical changes within this episode
    events: List[TherapyEvent] = Field(default_factory=list)


class Therapy(TherapyBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    created_by: str
    created_by_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TherapyUpdate(BaseModel):
    drug_name: Optional[str] = None
    drug_canonical: Optional[str] = None
    category: Optional[str] = None
    therapy_type: Optional[str] = None
    relevance: Optional[str] = None
    indication: Optional[str] = None
    dose: Optional[str] = None
    frequency: Optional[str] = None
    route: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None
    discontinuation_reason: Optional[str] = None
    notes: Optional[str] = None
    therapy_event: Optional[str] = None


class TherapyUpsert(BaseModel):
    """
    Payload for the smart upsert endpoint.
    The backend looks for an active episode of the same drug;
    if found it records the appropriate event (continued / dose_changed / discontinued);
    if not found it creates a new episode document.

    event_type_override controls the creation semantic:
      "noted"               — therapy already ongoing at first contact (active, start_date may be null)
      "historical_exposure" — past therapy from anamnesis (discontinued, never touches active episodes)
      None                  — default: "started" for active, "discontinued" for inactive
    """
    patient_id: str
    drug_name: str
    drug_canonical: Optional[str] = None
    category: str
    therapy_type: Optional[str] = None
    relevance: Optional[str] = None
    indication: Optional[str] = None
    dose: Optional[str] = None
    frequency: Optional[str] = None
    route: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    first_seen_date: Optional[str] = None
    date_approximate: Optional[bool] = None
    source: Optional[str] = None
    event_type_override: Optional[str] = None
    status: str = "active"
    discontinuation_reason: Optional[str] = None
    notes: Optional[str] = None
    visit_id: Optional[str] = None


class LabExamBase(BaseModel):
    patient_id: str
    date: Optional[str] = None
    panel: Optional[str] = None
    values: Dict[str, Any] = {}
    notes: Optional[str] = None
    visit_id: Optional[str] = None
    source_filename: Optional[str] = None


class LabExam(LabExamBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    created_by: str
    created_by_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SpecialistVisitBase(BaseModel):
    patient_id: str
    visit_date: str
    visit_type: str
    specialty: Optional[str] = None
    source_text: Optional[str] = None
    sintesi: Optional[str] = None


class SpecialistVisit(SpecialistVisitBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    created_by: str
    created_by_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class InstrumentalExamBase(BaseModel):
    patient_id: str
    exam_date: str
    exam_type: str
    territory: Optional[str] = None
    result: Optional[str] = None
    summary: Optional[str] = None
    source_text: Optional[str] = None
    structured_values: Optional[Dict[str, Any]] = None
    destination: Optional[str] = None


class InstrumentalExam(InstrumentalExamBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    created_by: str
    created_by_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class InstrumentalExamUpdate(BaseModel):
    exam_date: Optional[str] = None
    exam_type: Optional[str] = None
    territory: Optional[str] = None
    result: Optional[str] = None
    summary: Optional[str] = None
    source_text: Optional[str] = None
    structured_values: Optional[Dict[str, Any]] = None
    destination: Optional[str] = None


class ReminderBase(BaseModel):
    patient_id: Optional[str] = None
    due_date: str
    title: str
    type: Optional[str] = None
    notes: Optional[str] = None
    completed: bool = False
    priority: str = "routine"
    visibility: str = "shared"
    shared_with_user_ids: List[str] = Field(default_factory=list)
    visit_id: Optional[str] = None


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


# ── PRO Token (Patient-Reported Outcomes) ─────────────────────────────────────
PRO_INSTRUMENTS_ALLOWED = {
    "haq", "basdai", "basfi", "raid", "psaid", "fiqr", "esspri",
    "vas_pain", "vas_pga", "vas_fatigue",
}


class PROTokenCreate(BaseModel):
    patient_id: str
    instruments: List[str] = Field(default_factory=list)
    expires_in_hours: int = 168
    note: Optional[str] = None


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
    converted: bool = False


class PROSubmit(BaseModel):
    responses: Dict[str, Any]


# ── Consult Tokens ────────────────────────────────────────────────────────────
class ConsultTokenCreate(BaseModel):
    expires_in_hours: int = 168


class ConsultToken(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    token: str = Field(default_factory=lambda: secrets.token_urlsafe(16))
    patient_id: str
    organization_id: str
    created_by: str
    created_by_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    expires_at: str
    views: int = 0


# ── Scleroderma Profile ───────────────────────────────────────────────────────
class ScleroProfileBase(BaseModel):
    patient_id: str
    cutaneous: Optional[Dict[str, Any]] = None
    antibody: Optional[Dict[str, Any]] = None
    vascular: Optional[Dict[str, Any]] = None
    ild: Optional[Dict[str, Any]] = None
    pah: Optional[Dict[str, Any]] = None
    gi: Optional[Dict[str, Any]] = None
    msk: Optional[Dict[str, Any]] = None
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


# ── Conditions (longitudinal patient conditions / comorbidities) ───────────────

class ConditionBase(BaseModel):
    patient_id: str
    # label: human-readable display string, always shown in UI
    label: str
    # canonical_name: machine key from CANONICAL_REGISTRY, or "custom_<slug>" for free entries
    canonical_name: str
    # category: cardiovascular | metabolic | respiratory | infectious | oncologic |
    #           gastrointestinal | renal | neurologic | psychiatric | osteo_rheum |
    #           endocrine | allergologic | other
    category: str
    # status: active | resolved | historical | latent
    status: str = "active"
    # onset_date: year ("2018") or ISO date ("2018-03-15"), optional
    onset_date: Optional[str] = None
    # relevance_to_rheumatology: high | medium | low
    relevance_to_rheumatology: str = "low"
    # source: prima_visita | follow_up | manual | migrated
    source: str = "prima_visita"
    note: Optional[str] = None
    # flags: machine-readable alert/safety flags from CANONICAL_REGISTRY
    flags: List[str] = Field(default_factory=list)
    # multi_instance: True for conditions that can have multiple independent episodes
    multi_instance: bool = False


class Condition(ConditionBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    created_by: str
    created_by_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ConditionUpdate(BaseModel):
    """Partial update — all fields optional."""
    label: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    onset_date: Optional[str] = None
    relevance_to_rheumatology: Optional[str] = None
    note: Optional[str] = None
    flags: Optional[List[str]] = None


class ConditionUpsert(BaseModel):
    """
    Smart upsert payload.

    single_instance (multi_instance=False):
      Upsert key = (patient_id, canonical_name).
      Always updates the existing document; never creates a duplicate.

    multi_instance (multi_instance=True) with onset_date:
      Upsert key = (patient_id, canonical_name, onset_date).
      Distinct events on different dates coexist.

    multi_instance without onset_date:
      Always insert — no deduplication possible without a date anchor.

    custom conditions (canonical_name starts with "custom_"):
      Treated as single_instance unless multi_instance=True is passed.
      flags and relevance are not enriched from registry.
    """
    patient_id: str
    label: str
    canonical_name: str
    category: str
    status: str = "active"
    onset_date: Optional[str] = None
    relevance_to_rheumatology: str = "low"
    source: str = "prima_visita"
    note: Optional[str] = None
    flags: List[str] = Field(default_factory=list)
    multi_instance: bool = False


# ── Clinical Events (longitudinal raccordo timeline) ─────────────────────────
class ClinicalEventBase(BaseModel):
    event_type: str                           # disease_onset | therapy_start | dose_spacing | exam | hospitalization | procedure | other | ...
    titolo:           Optional[str] = None    # human-readable title (free text)
    categoria:        Optional[str] = None    # "malattia"|"terapia"|"esame"|"ricovero"|"procedura"|"diagnosi"|"altro"
    date_value:       Optional[str] = None    # ISO-10 approximated ("2009-01-01" if year-only)
    date_estimated:   Optional[str] = None    # anno stimato per back-inference; date_value resta null
    date_text:        Optional[str] = None    # raw text from raccordo ("dal 2009")
    date_precision:   Optional[str] = "year"  # "year" | "month_year" | "exact"
    date_approximate: bool          = False
    # drug fields — only for therapy_* event types
    drug_name:        Optional[str] = None
    drug_canonical:   Optional[str] = None
    drug_category:    Optional[str] = None
    from_drug:        Optional[str] = None    # therapy_switch: drug stopped
    to_drug:          Optional[str] = None    # therapy_switch: drug started
    therapy_id:       Optional[str] = None    # optional FK to db.therapies (not used in V1)
    # clinical fields — for non-drug event types
    manifestation:    Optional[str] = None
    body_system:      Optional[str] = None
    detail:           Optional[str] = None
    reason:           Optional[str] = None
    # provenance & quality
    source_text:      Optional[str] = None
    source_section:   str           = "raccordo"
    source_origin:    Optional[str] = None    # "inserimento_manuale"|"import_testo"|"import_pdf"|"generato_da_parser"|"modifica_manuale"
    confidence:       str           = "medium"  # "high" | "medium" | "low"
    inferred_by:      Optional[str] = None       # "anaphora" when drug inferred by context
    parser_version:   Optional[str] = None
    visit_id:         Optional[str] = None
    source_filename:  Optional[str] = None
    confirmed_by_user: bool         = False


class ClinicalEvent(ClinicalEventBase):
    model_config = ConfigDict(extra="ignore")
    id:               str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id:       str
    organization_id:  str
    created_by:       str
    created_by_name:  Optional[str] = None
    created_at:       str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_by:       Optional[str] = None
    updated_at:       Optional[str] = None
    confirmed_at:     Optional[str] = None
    confirmed_by:     Optional[str] = None
    deleted_at:       Optional[str] = None


class ClinicalEventCreate(ClinicalEventBase):
    patient_id: str


class ClinicalEventBatch(BaseModel):
    patient_id:  str
    events:      List[ClinicalEventBase]
    visit_id:    Optional[str] = None


