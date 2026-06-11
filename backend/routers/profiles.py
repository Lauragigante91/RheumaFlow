"""
Stats, scleroderma profile, generic disease profiles, and PDF visit parser.
"""
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Depends, File, UploadFile
from pydantic import BaseModel, ConfigDict, Field

from database import db
from auth_utils import get_current_user
from models import ScleroProfile, ScleroProfileBase
from helpers import verify_patient_in_org

router = APIRouter()


# ── Disease profile models (authoritative — inline data dict) ─────────────────

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


ALLOWED_DISEASE_TYPES = {
    "ra", "spa", "sle", "aav", "igav", "cryo_vas", "urticarial_vas",
    "behcet", "pan", "csvv",
    "sjogren", "myositis", "pmr_lvv",
    "comorbidities", "prima_visita", "clinical_cockpit",
}


def _check_disease_type(t: str) -> None:
    if t not in ALLOWED_DISEASE_TYPES:
        raise HTTPException(status_code=400, detail=f"Disease type '{t}' non supportato")


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def stats(user: dict = Depends(get_current_user)):
    org_id = user["organization_id"]
    patients_count = await db.patients.count_documents({"organization_id": org_id})
    assessments_count = await db.assessments.count_documents({"organization_id": org_id})
    recent = await db.assessments.find(
        {"organization_id": org_id}, {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    return {"patients": patients_count, "assessments": assessments_count, "recent_assessments": recent}


# ── Scleroderma profile ───────────────────────────────────────────────────────

@router.get("/patients/{patient_id}/sclero-profile")
async def get_sclero_profile(patient_id: str, user: dict = Depends(get_current_user)):
    await verify_patient_in_org(patient_id, user["organization_id"])
    return await db.sclero_profiles.find_one(
        {"patient_id": patient_id, "organization_id": user["organization_id"]}, {"_id": 0}
    )


@router.put("/patients/{patient_id}/sclero-profile", response_model=ScleroProfile)
async def upsert_sclero_profile(
    patient_id: str,
    payload: ScleroProfileBase,
    user: dict = Depends(get_current_user),
):
    await verify_patient_in_org(patient_id, user["organization_id"])
    if payload.patient_id != patient_id:
        raise HTTPException(status_code=400, detail="patient_id mismatch")

    existing = await db.sclero_profiles.find_one(
        {"patient_id": patient_id, "organization_id": user["organization_id"]}, {"_id": 0}
    )
    now = datetime.now(timezone.utc).isoformat()
    if existing:
        update_data = payload.model_dump(exclude={"patient_id"})
        update_data["updated_at"] = now
        update_data["updated_by_name"] = user.get("name")
        await db.sclero_profiles.update_one({"id": existing["id"]}, {"$set": update_data})
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


# ── Generic disease profiles ──────────────────────────────────────────────────

@router.get("/patients/{patient_id}/disease-profile/{disease_type}")
async def get_disease_profile(
    patient_id: str,
    disease_type: str,
    user: dict = Depends(get_current_user),
):
    _check_disease_type(disease_type)
    await verify_patient_in_org(patient_id, user["organization_id"])
    return await db.disease_profiles.find_one(
        {
            "patient_id": patient_id,
            "organization_id": user["organization_id"],
            "disease_type": disease_type,
        },
        {"_id": 0},
    )


@router.delete("/patients/{patient_id}/disease-profile/{disease_type}", status_code=204)
async def delete_disease_profile(
    patient_id: str,
    disease_type: str,
    user: dict = Depends(get_current_user),
):
    _check_disease_type(disease_type)
    await verify_patient_in_org(patient_id, user["organization_id"])
    await db.disease_profiles.delete_one({
        "patient_id": patient_id,
        "organization_id": user["organization_id"],
        "disease_type": disease_type,
    })
    return None


@router.put("/patients/{patient_id}/disease-profile/{disease_type}", response_model=DiseaseProfile)
async def upsert_disease_profile(
    patient_id: str,
    disease_type: str,
    payload: DiseaseProfileBase,
    user: dict = Depends(get_current_user),
):
    _check_disease_type(disease_type)
    await verify_patient_in_org(patient_id, user["organization_id"])
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
        # Non-destructive merge: update individual data.* keys rather than replacing
        # the entire data object. This preserves legacy fields (e.g. physiologic_history
        # written to prima_visita before Phase 2C) that are absent from the current payload.
        set_ops = {f"data.{k}": v for k, v in payload.data.items()}
        set_ops["updated_at"] = now
        set_ops["updated_by_name"] = user.get("name")
        await db.disease_profiles.update_one(
            {"id": existing["id"]},
            {"$set": set_ops},
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


# ── PDF Visit Parser ──────────────────────────────────────────────────────────

VISIT_SECTION_PATTERNS = [
    ("anamnesi_fisiologica", r"ANAMNESI\s+FISIOLOGICA\s*:"),
    ("apr",                  r"(?:A\.?P\.?R\.?|ANAMNESI\s+PATOLOGICA\s+REMOTA)\s*:"),
    ("terapia_domiciliare",  r"TERAPIA\s+DOMICILIARE\s*:"),
    ("raccordo",             r"RACCORDO\s+ANAMNESTICO\s*:"),
    ("esame_obiettivo",      r"ESAME\s+OBIETTIVO\s*:"),
    ("esami",                r"ESAMI\s+(?:PREGRESSI|DEL\s+RICOVERO|EMATOCHIMICI|DI\s+LABORATORIO)"),
    ("conclusioni",          r"CONCLUSIONI(?:/DIAGNOSI)?\s*:?(?=\s)"),
    ("piano",                r"PIANO\s*(?:TERAPEUTICO\s*)?:"),
]

_PDF_SECTION_KWS = [
    "ANAMNESI", "TERAPIA DOMICILIARE", "RACCORDO", "ESAMI",
    "CONCLUSIONI", "ESAME OBIETTIVO", "PIANO TERAPEUTICO",
]


def _extract_visit_pdf_text(pdf_bytes: bytes) -> str:
    """
    Extract text from PDF using bounding-box analysis to exclude
    the lateral sidebar (demographics, hospital logo, etc.).
    """
    try:
        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        parts = []
        for page in doc:
            pw = page.rect.width
            raw_blocks = page.get_text("blocks")
            text_blocks = [
                (b[0], b[1], b[2], b[3], b[4])
                for b in raw_blocks
                if b[6] == 0 and b[4].strip()
            ]
            if not text_blocks:
                continue
            section_x0s = [
                x0 for x0, y0, x1, y1, txt in text_blocks
                if any(kw in txt.upper() for kw in _PDF_SECTION_KWS)
            ]
            if section_x0s:
                threshold = min(section_x0s) - 5
                kept = [b for b in text_blocks if b[0] >= threshold]
            else:
                threshold = pw * 0.30
                kept = [b for b in text_blocks if b[0] >= threshold]
                if not kept:
                    kept = text_blocks
            kept.sort(key=lambda b: (b[1], b[0]))
            parts.append("\n".join(b[4].strip() for b in kept))
        doc.close()
        return "\n".join(parts)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Impossibile estrarre testo dal PDF: {exc}")


def _split_visit_sections(text: str) -> dict:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    positions = []
    for key, pattern in VISIT_SECTION_PATTERNS:
        for m in re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE):
            positions.append((m.start(), key, m.end()))
    if not positions:
        return {}
    positions.sort(key=lambda x: x[0])
    sections: dict = {}
    for i, (start, key, end) in enumerate(positions):
        next_start = positions[i + 1][0] if i + 1 < len(positions) else len(text)
        content = text[end:next_start].strip()
        content = re.sub(r"[ \t]+", " ", content)
        content = re.sub(r"\n{3,}", "\n\n", content)
        if content:
            sections[key] = sections.get(key, "") + ("\n\n" + content if key in sections else content)
    return sections


def _detect_visit_date(text: str) -> Optional[str]:
    """Detect the visit date from extracted text. Returns ISO "YYYY-MM-DD" or None."""
    contextual = re.search(
        r'(?:visita|in\s+data|del|data\s*(?:di\s+)?visita|effettuata?)\s*:?\s*'
        r'(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})',
        text, re.IGNORECASE,
    )
    if contextual:
        d, mo, y = contextual.group(1), contextual.group(2), contextual.group(3)
        if 1990 <= int(y) <= 2100:
            return f"{y}-{mo.zfill(2)}-{d.zfill(2)}"
    m = re.search(r'(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})', text[:600])
    if m:
        d, mo, y = m.group(1), m.group(2), m.group(3)
        if 1990 <= int(y) <= 2100:
            return f"{y}-{mo.zfill(2)}-{d.zfill(2)}"
    return None


@router.post("/parse-pdf-visit")
async def parse_pdf_visit(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """
    Zero-AI PDF follow-up visit parser.
    Extracts text with PyMuPDF and splits into clinical sections.
    No demographic data is returned.
    """
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File vuoto")
    raw_text = _extract_visit_pdf_text(content)
    sections = _split_visit_sections(raw_text)
    detected_date = _detect_visit_date(raw_text)
    return {"raw_text": raw_text, "sections": sections, "detected_date": detected_date}
