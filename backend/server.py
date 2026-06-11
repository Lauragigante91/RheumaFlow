from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env', override=False)

import os
import uuid
import logging
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI, APIRouter, Request, Response, Depends
from fastapi.responses import FileResponse
from starlette.middleware.cors import CORSMiddleware

# ── Shared modules ────────────────────────────────────────────────────────────
from database import db, _client as client
from auth_utils import hash_password, verify_password, get_current_user
from models import Organization

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="Clinimetria Reumatologica API")

# ── Domain routers ────────────────────────────────────────────────────────────
from routers.auth import router as _auth_router
from routers.patients import router as _patients_router
from routers.clinical import router as _clinical_router
from routers.reminders import router as _reminders_router
from routers.visits import router as _visits_router
from routers.tokens import router as _tokens_router
from routers.profiles import router as _profiles_router
from routers.export import router as _export_router
from routers.conditions import router as _conditions_router
from routers.clinical_events import router as _clinical_events_router

for _r in (
    _auth_router, _patients_router, _clinical_router,
    _reminders_router, _visits_router, _tokens_router,
    _profiles_router, _export_router,
    _conditions_router, _clinical_events_router,
):
    app.include_router(_r, prefix="/api")


# ── Parser diagnostic endpoint (dev only) ─────────────────────────────────────
from fastapi import Body as _Body
@app.post("/api/debug/parse-trace")
async def debug_parse_trace(payload: dict = _Body(...), _: dict = Depends(get_current_user)):
    if (ROOT_DIR.parent / "frontend" / "build" / "index.html").exists():
        return {"logged": 0, "disabled": True}
    lines = payload.get("trace", [])
    logger.info("=== PARSER TRACE BEGIN ===")
    for line in lines:
        logger.info(line)
    logger.info("=== PARSER TRACE END ===")
    return {"logged": len(lines)}


# ==================== STARTUP ====================
@app.on_event("startup")
async def startup_event():
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
        await db.workup_visits.create_index([("patient_id", 1), ("visit_date", -1)])
        await db.conditions.create_index([("patient_id", 1), ("canonical_name", 1)])
        await db.conditions.create_index([("patient_id", 1), ("category", 1)])
        await db.clinical_events.create_index([("patient_id", 1), ("organization_id", 1), ("date_value", 1)])
        await db.clinical_events.create_index([("patient_id", 1), ("event_type", 1)])
        await db.clinical_events.create_index([("patient_id", 1), ("drug_canonical", 1)])
        await db.clinical_events.create_index([("patient_id", 1), ("deleted_at", 1)])
        await db.lab_exams.create_index([("patient_id", 1), ("date", -1)])
        await db.instrumental_exams.create_index([("patient_id", 1), ("date", -1)])
        await db.specialist_visits.create_index([("patient_id", 1), ("visit_date", -1)])
        await db.pro_tokens.create_index("token", unique=True)
        await db.consult_tokens.create_index("token", unique=True)
        await db.conditions.create_index(
            [("patient_id", 1), ("canonical_name", 1), ("organization_id", 1)],
            unique=True, name="conditions_upsert_key",
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

    # Migrate existing records without organization_id
    await db.patients.update_many(
        {"organization_id": {"$exists": False}},
        {"$set": {"organization_id": default_org_id, "created_by": "system"}},
    )
    await db.assessments.update_many(
        {"organization_id": {"$exists": False}},
        {"$set": {"organization_id": default_org_id, "created_by": "system"}},
    )
    await db.criteria_evaluations.update_many(
        {"organization_id": {"$exists": False}},
        {"$set": {"organization_id": default_org_id, "created_by": "system"}},
    )
    await db.therapies.update_many(
        {"organization_id": {"$exists": False}},
        {"$set": {"organization_id": default_org_id, "created_by": "system"}},
    )

    # Seed admin user
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



@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# ==================== SPA FALLBACK ====================
_FRONTEND_BUILD = ROOT_DIR.parent / "frontend" / "build"
_SPA_DEV_SERVER = "http://localhost:5000"
_HOP_BY_HOP = {
    "connection", "transfer-encoding", "te", "upgrade",
    "proxy-authorization", "proxy-authenticate", "trailers",
}


@app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
async def spa_fallback(path: str, request: Request):
    # PRODUCTION: serve compiled static files
    if (_FRONTEND_BUILD / "index.html").exists():
        if path:
            candidate = (_FRONTEND_BUILD / path).resolve()
            build_root = _FRONTEND_BUILD.resolve()
            try:
                candidate.relative_to(build_root)
                if candidate.is_file():
                    return FileResponse(str(candidate))
            except ValueError:
                # Path is outside the build root (traversal attempt); fall through
                # to serve index.html. This ValueError from .relative_to() is intentional.
                pass
        return FileResponse(
            str(_FRONTEND_BUILD / "index.html"),
            headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache"},
        )

    # DEVELOPMENT: proxy to React dev server
    target = f"{_SPA_DEV_SERVER}/{path}"
    if request.url.query:
        target += f"?{request.url.query}"
    _strip_req = _HOP_BY_HOP | {"host", "accept-encoding"}
    forward_headers = {
        k: v for k, v in request.headers.items() if k.lower() not in _strip_req
    }
    forward_headers["accept-encoding"] = "identity"
    try:
        async with httpx.AsyncClient(timeout=30.0) as hc:
            resp = await hc.request(
                request.method, target, headers=forward_headers, follow_redirects=True,
            )
        _strip_resp = _HOP_BY_HOP | {"content-encoding", "content-length"}
        resp_headers = {k: v for k, v in resp.headers.items() if k.lower() not in _strip_resp}
        return Response(
            content=resp.content,
            status_code=resp.status_code,
            headers=resp_headers,
            media_type=resp.headers.get("content-type"),
        )
    except Exception as exc:
        logger.error("[spa_fallback] %s → %s: %s", request.url.path, target, exc)
        return Response(
            content=(
                "<html><body><b>Dev server unavailable.</b><br>"
                "Make sure the React dev server is running on port 5000.<br>"
                f"<code>{exc}</code></body></html>"
            ),
            status_code=502,
            media_type="text/html",
        )


# ==================== CORS ====================
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', 'http://localhost:3000,http://localhost:5000').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
