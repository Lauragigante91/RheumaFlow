"""
Conditions router — longitudinal patient conditions / comorbidities.

Every condition belongs to the patient, not to a single visit.
Visits observe, confirm, or update conditions.

Upsert semantics:
  single_instance  → key (patient_id, canonical_name)            — no duplicates
  multi_instance + onset_date → key (patient_id, canonical, date) — distinct events
  multi_instance, no onset_date → always insert                   — can't dedup without anchor

Custom conditions (canonical_name starts with "custom_"):
  Accepted as-is; no flag enrichment from registry; no alert generation.
"""
import re
import uuid
import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, HTTPException, Depends

from database import db
from auth_utils import get_current_user
from models import Condition, ConditionBase, ConditionUpdate, ConditionUpsert
from helpers import verify_patient_in_org

logger = logging.getLogger(__name__)
router = APIRouter()


# ── V1 Canonical registry ─────────────────────────────────────────────────────
# Keys are canonical_name strings.
# label       : default Italian display string
# category    : one of the 12 standard categories + "other"
# status      : status_default
# relevance   : high | medium | low
# flags       : list of machine-readable alert/safety flags
# multi       : True = multi_instance (multiple coexisting episodes allowed)

CANONICAL_REGISTRY = {
    # ── Cardiovascolare ──────────────────────────────────────────────────────
    "hypertension":             {"label": "Ipertensione arteriosa",        "category": "cardiovascular",  "status": "active",    "relevance": "medium", "flags": [],                                                          "multi": False},
    "atrial_fibrillation":      {"label": "Fibrillazione atriale",         "category": "cardiovascular",  "status": "active",    "relevance": "high",   "flags": ["anticoagulation_check", "cardiovascular_risk"],            "multi": False},
    "ischemic_heart_disease":   {"label": "Cardiopatia ischemica",         "category": "cardiovascular",  "status": "active",    "relevance": "high",   "flags": ["cardiovascular_risk"],                                     "multi": False},
    "heart_failure":            {"label": "Scompenso cardiaco",            "category": "cardiovascular",  "status": "active",    "relevance": "high",   "flags": ["cardiovascular_risk", "anti_tnf_caution"],                 "multi": False},
    "valvulopathy":             {"label": "Valvulopatia",                  "category": "cardiovascular",  "status": "active",    "relevance": "medium", "flags": [],                                                          "multi": False},
    "peripheral_artery_disease":{"label": "Arteriopatia periferica",       "category": "cardiovascular",  "status": "active",    "relevance": "medium", "flags": ["cardiovascular_risk"],                                     "multi": False},
    "stroke_tia":               {"label": "Pregresso ictus/TIA",           "category": "cardiovascular",  "status": "historical","relevance": "high",   "flags": ["anticoagulation_check", "cardiovascular_risk"],            "multi": True},
    "vte":                      {"label": "TVP/TEP",                       "category": "cardiovascular",  "status": "historical","relevance": "high",   "flags": ["anticoagulation_check"],                                   "multi": True},

    # ── Metabolico ───────────────────────────────────────────────────────────
    "dm2":                      {"label": "Diabete tipo 2",                "category": "metabolic",       "status": "active",    "relevance": "medium", "flags": ["cardiovascular_risk"],                                     "multi": False},
    "dm1":                      {"label": "Diabete tipo 1",                "category": "metabolic",       "status": "active",    "relevance": "medium", "flags": [],                                                          "multi": False},
    "dyslipidemia":             {"label": "Dislipidemia",                  "category": "metabolic",       "status": "active",    "relevance": "low",    "flags": ["cardiovascular_risk"],                                     "multi": False},
    "obesity":                  {"label": "Obesità",                       "category": "metabolic",       "status": "active",    "relevance": "low",    "flags": ["cardiovascular_risk"],                                     "multi": False},
    "metabolic_syndrome":       {"label": "Sindrome metabolica",           "category": "metabolic",       "status": "active",    "relevance": "low",    "flags": ["cardiovascular_risk"],                                     "multi": False},
    "hyperuricemia_gout":       {"label": "Iperuricemia / Gotta",          "category": "metabolic",       "status": "active",    "relevance": "medium", "flags": [],                                                          "multi": False},
    "nafld":                    {"label": "Steatosi epatica",              "category": "metabolic",       "status": "active",    "relevance": "low",    "flags": ["hepatotoxic_drugs_caution"],                               "multi": False},

    # ── Respiratorio ─────────────────────────────────────────────────────────
    "copd":                     {"label": "BPCO",                          "category": "respiratory",     "status": "active",    "relevance": "medium", "flags": [],                                                          "multi": False},
    "asthma":                   {"label": "Asma bronchiale",               "category": "respiratory",     "status": "active",    "relevance": "low",    "flags": [],                                                          "multi": False},
    "ild":                      {"label": "ILD / Fibrosi polmonare",       "category": "respiratory",     "status": "active",    "relevance": "high",   "flags": ["ild_monitoring"],                                          "multi": False},
    "osas":                     {"label": "Apnea ostruttiva del sonno",    "category": "respiratory",     "status": "active",    "relevance": "low",    "flags": [],                                                          "multi": False},
    "pulmonary_hypertension":   {"label": "Ipertensione polmonare",        "category": "respiratory",     "status": "active",    "relevance": "high",   "flags": [],                                                          "multi": False},

    # ── Infettivologico ──────────────────────────────────────────────────────
    "hbv_hbsag_positive":       {"label": "Epatite B (HBsAg+)",           "category": "infectious",      "status": "active",    "relevance": "high",   "flags": ["requires_pre_biologic_screening"],                         "multi": False},
    "hbv_hbcab_positive":       {"label": "Epatite B (HBcAb+)",           "category": "infectious",      "status": "latent",    "relevance": "high",   "flags": ["requires_pre_biologic_screening"],                         "multi": False},
    "hcv":                      {"label": "Epatite C",                     "category": "infectious",      "status": "active",    "relevance": "high",   "flags": ["requires_pre_biologic_screening"],                         "multi": False},
    "hiv":                      {"label": "HIV",                           "category": "infectious",      "status": "active",    "relevance": "high",   "flags": ["requires_pre_biologic_screening"],                         "multi": False},
    "tbc_latent":               {"label": "TBC latente",                   "category": "infectious",      "status": "latent",    "relevance": "high",   "flags": ["requires_pre_biologic_screening"],                         "multi": False},
    "recurrent_infections":     {"label": "Infezioni ricorrenti",          "category": "infectious",      "status": "active",    "relevance": "medium", "flags": [],                                                          "multi": False},
    "bronchiectasis":           {"label": "Bronchiectasie",                "category": "infectious",      "status": "active",    "relevance": "medium", "flags": [],                                                          "multi": False},

    # ── Oncologico ───────────────────────────────────────────────────────────
    "solid_tumor_prior":        {"label": "Neoplasia solida pregressa",    "category": "oncologic",       "status": "historical","relevance": "high",   "flags": ["contraindication_some_biologics"],                         "multi": True},
    "solid_tumor_active":       {"label": "Neoplasia solida attiva",       "category": "oncologic",       "status": "active",    "relevance": "high",   "flags": ["contraindication_most_biologics"],                         "multi": True},
    "hematologic_tumor_prior":  {"label": "Neoplasia ematologica pregressa","category": "oncologic",      "status": "historical","relevance": "high",   "flags": ["contraindication_some_biologics"],                         "multi": True},
    "hematologic_tumor_active": {"label": "Neoplasia ematologica attiva",  "category": "oncologic",       "status": "active",    "relevance": "high",   "flags": ["contraindication_most_biologics"],                         "multi": True},
    "melanoma_prior":           {"label": "Melanoma pregresso",            "category": "oncologic",       "status": "historical","relevance": "high",   "flags": ["contraindication_anti_tnf"],                               "multi": True},

    # ── Gastroenterico ───────────────────────────────────────────────────────
    "peptic_ulcer":             {"label": "Ulcera peptica",                "category": "gastrointestinal","status": "active",    "relevance": "medium", "flags": ["nsaid_caution", "gastroprotection_needed"],                "multi": False},
    "gerd":                     {"label": "MRGE",                          "category": "gastrointestinal","status": "active",    "relevance": "low",    "flags": [],                                                          "multi": False},
    "diverticular_disease":     {"label": "Diverticolite / Diverticolosi", "category": "gastrointestinal","status": "active",    "relevance": "low",    "flags": [],                                                          "multi": False},
    "ibd":                      {"label": "IBD (Crohn / RCU)",             "category": "gastrointestinal","status": "active",    "relevance": "high",   "flags": [],                                                          "multi": False},
    "chronic_liver_disease":    {"label": "Epatopatia cronica",            "category": "gastrointestinal","status": "active",    "relevance": "high",   "flags": ["hepatotoxic_drugs_caution"],                               "multi": False},
    "cirrhosis":                {"label": "Cirrosi epatica",               "category": "gastrointestinal","status": "active",    "relevance": "high",   "flags": ["hepatotoxic_drugs_caution", "many_drug_contraindications"], "multi": False},

    # ── Renale ───────────────────────────────────────────────────────────────
    "ckd_mild":                 {"label": "IRC lieve (GFR 60–89)",         "category": "renal",           "status": "active",    "relevance": "low",    "flags": [],                                                          "multi": False},
    "ckd_moderate":             {"label": "IRC moderata (GFR 30–59)",      "category": "renal",           "status": "active",    "relevance": "high",   "flags": ["dose_adjustment_needed", "nsaid_caution"],                 "multi": False},
    "ckd_severe":               {"label": "IRC grave (GFR <30)",           "category": "renal",           "status": "active",    "relevance": "high",   "flags": ["dose_adjustment_needed", "nsaid_contraindicated"],         "multi": False},
    "dialysis":                 {"label": "Dialisi",                       "category": "renal",           "status": "active",    "relevance": "high",   "flags": ["dose_adjustment_needed"],                                  "multi": False},
    "renal_transplant":         {"label": "Trapianto renale",              "category": "renal",           "status": "active",    "relevance": "high",   "flags": ["immunosuppression_context"],                               "multi": False},
    "significant_proteinuria":  {"label": "Proteinuria significativa",     "category": "renal",           "status": "active",    "relevance": "medium", "flags": ["nsaid_caution"],                                           "multi": False},

    # ── Neurologico ──────────────────────────────────────────────────────────
    "peripheral_neuropathy":    {"label": "Neuropatia periferica",         "category": "neurologic",      "status": "active",    "relevance": "medium", "flags": [],                                                          "multi": False},
    "epilepsy":                 {"label": "Epilessia",                     "category": "neurologic",      "status": "active",    "relevance": "low",    "flags": [],                                                          "multi": False},
    "parkinson":                {"label": "Parkinson",                     "category": "neurologic",      "status": "active",    "relevance": "low",    "flags": [],                                                          "multi": False},
    "multiple_sclerosis":       {"label": "Sclerosi multipla",             "category": "neurologic",      "status": "active",    "relevance": "high",   "flags": ["contraindication_anti_tnf"],                               "multi": False},
    "dementia":                 {"label": "Demenza / decadimento cognitivo","category": "neurologic",      "status": "active",    "relevance": "low",    "flags": [],                                                          "multi": False},
    "myopathy":                 {"label": "Miopatia",                      "category": "neurologic",      "status": "active",    "relevance": "medium", "flags": [],                                                          "multi": False},

    # ── Psichiatrico ─────────────────────────────────────────────────────────
    "depression":               {"label": "Depressione",                   "category": "psychiatric",     "status": "active",    "relevance": "low",    "flags": [],                                                          "multi": False},
    "anxiety_disorder":         {"label": "Disturbo ansioso",              "category": "psychiatric",     "status": "active",    "relevance": "low",    "flags": [],                                                          "multi": False},
    "bipolar_disorder":         {"label": "Disturbo bipolare",             "category": "psychiatric",     "status": "active",    "relevance": "low",    "flags": [],                                                          "multi": False},
    "psychosis":                {"label": "Schizofrenia / Psicosi",        "category": "psychiatric",     "status": "active",    "relevance": "low",    "flags": [],                                                          "multi": False},
    "sleep_disorder":           {"label": "Disturbo del sonno",            "category": "psychiatric",     "status": "active",    "relevance": "low",    "flags": [],                                                          "multi": False},

    # ── Osteo-metabolico ─────────────────────────────────────────────────────
    "osteoporosis":             {"label": "Osteoporosi",                   "category": "osteo_rheum",     "status": "active",    "relevance": "medium", "flags": ["bone_protection_needed"],                                  "multi": False},
    "osteopenia":               {"label": "Osteopenia",                    "category": "osteo_rheum",     "status": "active",    "relevance": "low",    "flags": [],                                                          "multi": False},
    "vitamin_d_deficiency":     {"label": "Ipovitaminosi D cronica",       "category": "osteo_rheum",     "status": "active",    "relevance": "low",    "flags": [],                                                          "multi": False},
    "fragility_fracture":       {"label": "Frattura da fragilità",         "category": "osteo_rheum",     "status": "historical","relevance": "medium", "flags": ["bone_protection_needed"],                                  "multi": True},

    # ── Endocrino ────────────────────────────────────────────────────────────
    "hypothyroidism":           {"label": "Ipotiroidismo",                 "category": "endocrine",       "status": "active",    "relevance": "low",    "flags": [],                                                          "multi": False},
    "hyperthyroidism":          {"label": "Ipertiroidismo",                "category": "endocrine",       "status": "active",    "relevance": "low",    "flags": [],                                                          "multi": False},
    "autoimmune_thyroiditis":   {"label": "Tiroidite autoimmune",          "category": "endocrine",       "status": "active",    "relevance": "low",    "flags": [],                                                          "multi": False},
    "adrenal_insufficiency":    {"label": "Insufficienza surrenalica",     "category": "endocrine",       "status": "active",    "relevance": "high",   "flags": ["steroid_interaction"],                                     "multi": False},
    "hypogonadism":             {"label": "Ipogonadismo",                  "category": "endocrine",       "status": "active",    "relevance": "low",    "flags": [],                                                          "multi": False},
}

# Reverse lookup: lower-cased label → canonical_name (for frontend-side resolution)
LABEL_TO_CANONICAL: dict[str, str] = {
    v["label"].lower(): k for k, v in CANONICAL_REGISTRY.items()
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _slugify(text: str) -> str:
    """Convert free text to a safe slug for custom canonical names."""
    slug = text.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "_", slug)
    slug = slug.strip("_")[:60]
    return slug or "condition"


def _enrich(payload: ConditionUpsert) -> dict:
    """
    Merge registry defaults with caller-supplied values.
    Registry values are applied ONLY when the caller did not provide them explicitly
    (i.e., when they match the model defaults).
    Custom canonicals are never enriched.
    """
    reg = CANONICAL_REGISTRY.get(payload.canonical_name)
    now = datetime.now(timezone.utc).isoformat()

    data = payload.model_dump()
    if reg:
        # Apply registry defaults only when the payload carries model defaults
        if data.get("relevance_to_rheumatology") == "low" and reg["relevance"] != "low":
            data["relevance_to_rheumatology"] = reg["relevance"]
        if not data.get("flags"):
            data["flags"] = list(reg["flags"])
        if data.get("status") == "active" and reg["status"] != "active":
            data["status"] = reg["status"]
        # Always sync multi_instance from registry for known canonicals
        data["multi_instance"] = reg["multi"]

    data["updated_at"] = now
    return data


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/conditions", response_model=Condition, status_code=201)
async def create_condition(payload: ConditionBase, user: dict = Depends(get_current_user)):
    """Create a new condition document unconditionally (no upsert logic)."""
    await verify_patient_in_org(payload.patient_id, user)
    now = datetime.now(timezone.utc).isoformat()
    doc = Condition(
        **payload.model_dump(),
        organization_id=user["organization_id"],
        created_by=user["id"],
        created_by_name=user.get("name"),
        created_at=now,
        updated_at=now,
    )
    await db.conditions.insert_one(doc.model_dump())
    return doc


@router.post("/conditions/upsert", response_model=Condition)
async def upsert_condition(payload: ConditionUpsert, user: dict = Depends(get_current_user)):
    """
    Episode-aware upsert.

    Determines the upsert key based on multi_instance flag (enriched from registry):
      - single_instance  : (patient_id, canonical_name)
      - multi + onset    : (patient_id, canonical_name, onset_date)
      - multi, no onset  : always insert (cannot deduplicate without a date anchor)
    """
    await verify_patient_in_org(payload.patient_id, user)

    enriched = _enrich(payload)
    is_multi = enriched.get("multi_instance", False)
    now = enriched["updated_at"]

    if is_multi and not payload.onset_date:
        # Cannot deduplicate — always create a fresh document
        doc_id = str(uuid.uuid4())
        doc = {
            **enriched,
            "id": doc_id,
            "organization_id": user["organization_id"],
            "created_by": user["id"],
            "created_by_name": user.get("name"),
            "created_at": now,
        }
        await db.conditions.insert_one(doc)
        result = await db.conditions.find_one({"id": doc_id}, {"_id": 0})
        return result

    # Build the upsert key
    if is_multi and payload.onset_date:
        key = {
            "patient_id": payload.patient_id,
            "canonical_name": payload.canonical_name,
            "onset_date": payload.onset_date,
        }
    else:
        # single_instance
        key = {
            "patient_id": payload.patient_id,
            "canonical_name": payload.canonical_name,
        }

    # Fields to set on update; fields to set on insert
    set_on_update = {
        k: v for k, v in enriched.items()
        if k not in ("patient_id", "canonical_name", "onset_date", "multi_instance")
    }
    set_on_update["updated_at"] = now

    set_on_insert = {
        "id": str(uuid.uuid4()),
        "organization_id": user["organization_id"],
        "created_by": user["id"],
        "created_by_name": user.get("name"),
        "created_at": now,
        **{k: enriched[k] for k in ("patient_id", "canonical_name", "onset_date",
                                     "multi_instance", "category")
           if k in enriched},
    }

    await db.conditions.update_one(
        {**key, "organization_id": user["organization_id"]},
        {"$set": set_on_update, "$setOnInsert": set_on_insert},
        upsert=True,
    )

    existing = await db.conditions.find_one(
        {**key, "organization_id": user["organization_id"]},
        {"_id": 0},
    )
    return existing


@router.get("/patients/{patient_id}/conditions", response_model=List[Condition])
async def list_conditions(patient_id: str, user: dict = Depends(get_current_user)):
    """Return all conditions for a patient, sorted by category then label."""
    await verify_patient_in_org(patient_id, user)
    docs = await db.conditions.find(
        {"patient_id": patient_id, "organization_id": user["organization_id"]},
        {"_id": 0},
    ).sort([("category", 1), ("label", 1)]).to_list(500)
    return docs


@router.put("/conditions/{condition_id}", response_model=Condition)
async def update_condition(
    condition_id: str,
    payload: ConditionUpdate,
    user: dict = Depends(get_current_user),
):
    existing = await db.conditions.find_one(
        {"id": condition_id, "organization_id": user["organization_id"]},
        {"_id": 0},
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Condition not found")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        return existing

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.conditions.update_one({"id": condition_id}, {"$set": updates})
    return await db.conditions.find_one({"id": condition_id}, {"_id": 0})


@router.delete("/conditions/{condition_id}", status_code=204)
async def delete_condition(condition_id: str, user: dict = Depends(get_current_user)):
    result = await db.conditions.delete_one(
        {"id": condition_id, "organization_id": user["organization_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Condition not found")


@router.get("/conditions/registry")
async def get_registry(_: dict = Depends(get_current_user)):
    """Expose the canonical registry to frontend for reference."""
    return CANONICAL_REGISTRY


@router.get("/conditions/label-map")
async def get_label_map(_: dict = Depends(get_current_user)):
    """Expose the label → canonical_name reverse map to frontend."""
    return LABEL_TO_CANONICAL
