"""FastAPI application entry point for CrosSwords."""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime
from contextlib import contextmanager
from typing import Any, Dict, List

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import or_, update
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.gzip import GZipMiddleware
from starlette.responses import Response

from .auth import router as auth_router
from .db.session import get_session, init_db
from .models.models import Game
from .routers.games import router as games_router
from .routers.friends import router as friends_router
from .routers.admin_ui import router as admin_router
from .routers.matchmaking import router as matchmaking_router

APP_NAME = os.getenv("APP_NAME", "CrosSwords Server")
APP_VERSION = os.getenv("APP_VERSION", "0.4.0")
ALLOW_ORIGINS_RAW = os.getenv("ALLOW_ORIGINS", "*")
ALLOW_HEADERS_RAW = os.getenv("ALLOW_HEADERS", "*")
ALLOW_METHODS_RAW = os.getenv("ALLOW_METHODS", "*")
GZIP_MIN_SIZE = int(os.getenv("GZIP_MIN_SIZE", "500"))

logger = logging.getLogger("croswords.main")
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

# Build stamp printed on startup and echoed in response headers (TEMP DEBUG for guess-length issues).
SERVER_BUILD_STAMP = f"guess-debug-{datetime.utcnow().strftime('%Y%m%d-%H%M')}"


def _parse_csv(raw: str) -> List[str]:
    return [item.strip() for item in raw.split(",") if item.strip()]


def _resolve_cors_settings() -> Dict[str, object]:
    origins = ["*"] if ALLOW_ORIGINS_RAW.strip() == "*" else _parse_csv(ALLOW_ORIGINS_RAW)
    methods = ["*"] if ALLOW_METHODS_RAW.strip() == "*" else _parse_csv(ALLOW_METHODS_RAW)
    headers = ["*"] if ALLOW_HEADERS_RAW.strip() == "*" else _parse_csv(ALLOW_HEADERS_RAW)
    allow_credentials = origins != ["*"]
    return {
        "allow_origins": origins,
        "allow_methods": methods,
        "allow_headers": headers,
        "allow_credentials": allow_credentials,
    }


@contextmanager
def _session_scope():
    generator = get_session()
    session = next(generator)
    try:
        yield session
    finally:
        try:
            next(generator)
        except StopIteration:
            pass


app = FastAPI(title=APP_NAME, version=APP_VERSION)

cors_settings = _resolve_cors_settings()
app.add_middleware(CORSMiddleware, **cors_settings)
app.add_middleware(GZipMiddleware, minimum_size=max(0, GZIP_MIN_SIZE))


@app.middleware("http")
async def add_request_id_and_headers(request: Request, call_next):
    """
    Inject a request_id and build stamp on every response so we can trace which server handled a request.
    """
    request_id = uuid.uuid4().hex[:12]
    request.state.request_id = request_id

    # Pre-log only for guess submissions (path endswith /guess under /games/).
    path = request.url.path or ""
    is_guess_post = request.method.upper() == "POST" and path.startswith("/games/") and path.endswith("/guess")
    if is_guess_post:
        # Read and preserve body for downstream handlers (TEMP DEBUG).
        body = await request.body()
        body_preview = body[:200].decode(errors="replace") if body else ""
        async def receive():
            return {"type": "http.request", "body": body, "more_body": False}
        request._receive = receive  # type: ignore[attr-defined]
        print(
            "DEBUG_GUESS_MW_IN",
            {
                "request_id": request_id,
                "build": SERVER_BUILD_STAMP,
                "method": request.method,
                "path": path,
                "client": getattr(request.client, 'host', None),
                "content_type": request.headers.get("content-type"),
                "content_length": request.headers.get("content-length"),
            },
            flush=True,
        )
        print(
            "DEBUG_GUESS_MW_BODY",
            {
                "request_id": request_id,
                "build": SERVER_BUILD_STAMP,
                "body_preview": body_preview,
                "body_len": len(body or b""),
            },
            flush=True,
        )

    response: Response = await call_next(request)
    response.headers["X-Request-Id"] = request_id
    response.headers["X-Server-Build"] = SERVER_BUILD_STAMP
    return response


@app.on_event("startup")
def on_startup() -> None:
    logger.info("SERVER_BUILD_STAMP %s", SERVER_BUILD_STAMP)
    logger.info("Starting up: initializing database...")
    init_db()
    logger.info("DB init complete.")

    logger.info("Normalizing legacy Game.status values...")
    with _session_scope() as session:
        result = session.exec(
            update(Game)
            .where(or_(Game.status.is_(None), Game.status == ""))
            .values(status="waiting")
        )
        patched = result.rowcount or 0
        if patched:
            session.commit()
    logger.info("Normalization complete; %d rows patched.", patched)


if auth_router is not None:
    app.include_router(auth_router)
    logger.info("Mounted auth routes at /auth/*")
else:
    logger.warning("Auth router not found - /auth/* endpoints will be missing.")

if games_router is not None:
    app.include_router(games_router)
    logger.info("Mounted game routes at /games/*")
else:
    logger.warning("Games router not found - /games/* endpoints will be missing.")

if friends_router is not None:
    app.include_router(friends_router)
    logger.info("Mounted friends routes at /friends/*")
else:
    logger.warning("Friends router not found - /friends/* endpoints will be missing.")

if admin_router is not None:
    app.include_router(admin_router)
    logger.info("Mounted admin routes at /admin/*")
else:
    logger.warning("Admin router not found - /admin/* endpoints will be missing.")

if matchmaking_router is not None:
    app.include_router(matchmaking_router)
    logger.info("Mounted matchmaking routes at /matchmaking/*")
else:
    logger.warning("Matchmaking router not found - /matchmaking/* endpoints will be missing.")


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "path": request.url.path},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    body = await request.body()
    body_preview = body[:200].decode(errors="replace") if body else ""
    print(
        "DEBUG_REQUEST_VALIDATION_ERROR",
        {
            "request_id": getattr(request.state, "request_id", None),
            "build": SERVER_BUILD_STAMP,
            "path": request.url.path,
            "errors": exc.errors(),
            "body_preview": body_preview,
        },
        flush=True,
    )
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "path": request.url.path},
        headers={
            "X-Request-Id": getattr(request.state, "request_id", ""),
            "X-Server-Build": SERVER_BUILD_STAMP,
        },
    )


@app.get("/")
def root() -> Dict[str, Any]:
    return {"ok": True, "service": APP_NAME, "version": APP_VERSION}


@app.get("/healthz")
def healthz() -> Dict[str, bool]:
    """Minimal health check for load balancers / readiness probes."""
    return {"ok": True}


@app.get("/__debug/routes")
def list_routes() -> List[Dict[str, Any]]:
    routes: List[Dict[str, Any]] = []
    for route in app.router.routes:
        path = getattr(route, "path", None)
        methods = list(getattr(route, "methods", []) or [])
        if path:
            routes.append({"path": path, "methods": methods})
    routes.sort(key=lambda item: item["path"])
    return routes
