import io
import os
import uuid
import hashlib
import secrets
import logging
from datetime import datetime, timezone, timedelta

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorGridFSBucket

from database import db
from auth_utils import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 20 * 1024 * 1024
MAX_FILES_PER_SESSION = 5
ALLOWED_MIMETYPES = {"application/pdf", "image/jpeg", "image/png"}
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
TTL_MAP = {
    "same_day": timedelta(hours=4),
    "pre_visit": timedelta(days=7),
}
EXAM_TYPES = ["lab", "rx", "ct", "us", "specialist_visit", "other"]


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _fs():
    return AsyncIOMotorGridFSBucket(db, bucket_name="exam_uploads_fs")


async def _resolve_session(token: str):
    token_hash = _hash_token(token)
    session = await db.exam_upload_sessions.find_one(
        {"token_hash": token_hash, "revoked_at": None},
        {"_id": 0},
    )
    if not session:
        return None
    if session["expires_at"] <= datetime.now(timezone.utc).isoformat():
        return None
    return session


async def _upload_count(session_id: str) -> int:
    return await db.exam_uploads.count_documents(
        {"session_id": session_id, "status": {"$ne": "rejected"}}
    )


@router.post("/visits/{visit_id}/generate-exam-upload-qr")
async def generate_exam_upload_qr(
    visit_id: str,
    payload: dict,
    user: dict = Depends(get_current_user),
):
    purpose = payload.get("purpose", "same_day")
    if purpose not in TTL_MAP:
        raise HTTPException(status_code=400, detail="purpose deve essere 'same_day' o 'pre_visit'")

    visit = await db.workup_visits.find_one(
        {"id": visit_id, "organization_id": user["organization_id"]},
        {"_id": 0, "patient_id": 1},
    )
    if not visit:
        raise HTTPException(status_code=404, detail="Visita non trovata")

    token = secrets.token_urlsafe(96)
    expires_at = (datetime.now(timezone.utc) + TTL_MAP[purpose]).isoformat()

    session = {
        "id": str(uuid.uuid4()),
        "visit_id": visit_id,
        "patient_id": visit["patient_id"],
        "organization_id": user["organization_id"],
        "token_hash": _hash_token(token),
        "expires_at": expires_at,
        "revoked_at": None,
        "purpose": purpose,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"],
    }
    await db.exam_upload_sessions.insert_one(session)

    return {
        "token": token,
        "session_id": session["id"],
        "expires_at": expires_at,
        "purpose": purpose,
    }


@router.get("/exam-upload/{token}/status")
async def exam_upload_status(token: str):
    session = await _resolve_session(token)
    if not session:
        return {"valid": False}
    count = await _upload_count(session["id"])
    return {
        "valid": True,
        "purpose": session["purpose"],
        "expires_at": session["expires_at"],
        "remaining_uploads": max(0, MAX_FILES_PER_SESSION - count),
    }


@router.post("/exam-upload/{token}/upload")
async def exam_upload_file(
    token: str,
    request: Request,
    exam_type: str = Form(...),
    notes: str = Form(""),
    file: UploadFile = File(...),
):
    session = await _resolve_session(token)
    if not session:
        raise HTTPException(status_code=403, detail="Link scaduto o non valido")

    if exam_type not in EXAM_TYPES:
        raise HTTPException(status_code=400, detail="Tipo esame non valido")

    count = await _upload_count(session["id"])
    if count >= MAX_FILES_PER_SESSION:
        raise HTTPException(status_code=429, detail="Limite di 5 file raggiunto per questa sessione")

    content_type = file.content_type or ""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if content_type not in ALLOWED_MIMETYPES and ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Tipo file non supportato. Caricare PDF, JPG o PNG.")

    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File troppo grande (max 20 MB)")

    fs = _fs()
    file_id = await fs.upload_from_stream(
        file.filename or "upload",
        io.BytesIO(data),
        metadata={
            "session_id": session["id"],
            "visit_id": session["visit_id"],
            "content_type": content_type,
        },
    )

    upload_doc = {
        "id": str(uuid.uuid4()),
        "session_id": session["id"],
        "visit_id": session["visit_id"],
        "patient_id": session["patient_id"],
        "organization_id": session["organization_id"],
        "gridfs_file_id": str(file_id),
        "original_filename": file.filename or "upload",
        "content_type": content_type,
        "file_size": len(data),
        "exam_type": exam_type,
        "notes": (notes or "")[:255],
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by_ip": request.client.host if request.client else None,
        "status": "pending_review",
    }
    await db.exam_uploads.insert_one(upload_doc)

    return {
        "success": True,
        "upload_id": upload_doc["id"],
        "remaining_uploads": max(0, MAX_FILES_PER_SESSION - (count + 1)),
    }


@router.post("/exam-upload-sessions/{session_id}/revoke")
async def revoke_exam_upload_session(
    session_id: str,
    user: dict = Depends(get_current_user),
):
    result = await db.exam_upload_sessions.update_one(
        {
            "id": session_id,
            "organization_id": user["organization_id"],
            "revoked_at": None,
        },
        {"$set": {"revoked_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Sessione non trovata o già revocata")
    return {"success": True}


@router.get("/visits/{visit_id}/exam-uploads")
async def list_exam_uploads(visit_id: str, user: dict = Depends(get_current_user)):
    uploads = await db.exam_uploads.find(
        {"visit_id": visit_id, "organization_id": user["organization_id"]},
        {"_id": 0, "gridfs_file_id": 0},
    ).sort("uploaded_at", 1).to_list(200)

    session = await db.exam_upload_sessions.find_one(
        {
            "visit_id": visit_id,
            "organization_id": user["organization_id"],
            "revoked_at": None,
        },
        {"_id": 0, "id": 1, "expires_at": 1, "purpose": 1},
        sort=[("created_at", -1)],
    )

    return {
        "uploads": uploads,
        "active_session": {
            "id": session["id"],
            "expires_at": session["expires_at"],
            "purpose": session["purpose"],
        } if session else None,
    }


@router.patch("/exam-uploads/{upload_id}")
async def update_exam_upload(
    upload_id: str,
    payload: dict,
    user: dict = Depends(get_current_user),
):
    set_fields = {}

    new_status = payload.get("status")
    if new_status is not None:
        if new_status not in {"accepted", "rejected"}:
            raise HTTPException(status_code=400, detail="Status deve essere 'accepted' o 'rejected'")
        set_fields["status"] = new_status
        set_fields["reviewed_at"] = datetime.now(timezone.utc).isoformat()

    if "extracted_text" in payload:
        set_fields["extracted_text"] = payload["extracted_text"] or ""

    if not set_fields:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")

    result = await db.exam_uploads.update_one(
        {"id": upload_id, "organization_id": user["organization_id"]},
        {"$set": set_fields},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Upload non trovato")
    return {"success": True}


@router.patch("/exam-upload/{token}/uploads/{upload_id}/text")
async def public_patch_extracted_text(token: str, upload_id: str, payload: dict):
    session = await _resolve_session(token)
    if not session:
        raise HTTPException(status_code=403, detail="Link scaduto o non valido")

    extracted_text = (payload.get("extracted_text") or "")[:50000]

    result = await db.exam_uploads.update_one(
        {"id": upload_id, "session_id": session["id"]},
        {"$set": {"extracted_text": extracted_text}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Upload non trovato")
    return {"success": True}


@router.get("/exam-uploads/{upload_id}/file")
async def serve_exam_upload_file(upload_id: str, user: dict = Depends(get_current_user)):
    doc = await db.exam_uploads.find_one(
        {"id": upload_id, "organization_id": user["organization_id"]},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="File non trovato")

    fs = _fs()
    try:
        grid_out = await fs.open_download_stream(ObjectId(doc["gridfs_file_id"]))
    except Exception:
        raise HTTPException(status_code=404, detail="File non trovato nello storage")

    content_type = doc.get("content_type") or "application/octet-stream"
    filename = doc.get("original_filename", "esame")

    async def stream():
        while True:
            chunk = await grid_out.read(65536)
            if not chunk:
                break
            yield chunk

    return StreamingResponse(
        stream(),
        media_type=content_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
