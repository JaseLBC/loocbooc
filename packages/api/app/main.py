"""
Loocbooc API — FastAPI application entry point.
"""
import logging
import time
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import engine
from app.redis import close_redis, get_redis
from app.routers import avatars, brands, garments, health, scan, try_on

# --- Structured Logging Setup ---
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer()
        if settings.ENVIRONMENT == "production"
        else structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logging.basicConfig(level=logging.DEBUG if settings.DEBUG else logging.INFO)
logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — startup and shutdown hooks."""
    logger.info(
        "Starting Loocbooc API",
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
    )

    # Warm up Redis connection
    try:
        redis = await get_redis()
        await redis.ping()
        logger.info("Redis connected")
    except Exception as e:
        logger.error("Redis connection failed on startup", error=str(e))

    yield

    # Shutdown
    logger.info("Shutting down Loocbooc API")
    await close_redis()
    await engine.dispose()


# --- App ---
app = FastAPI(
    title="Loocbooc API",
    description="""
## Loocbooc Platform API

The universal cloud infrastructure for the global fashion industry.

### Authentication
- **API Key**: Pass `X-API-Key: lb_live_xxxxx` header for brand integrations
- **JWT Bearer**: Pass `Authorization: Bearer <token>` for consumer apps

### Universal Garment Identifier (UGI)
Every garment receives a UGI on creation: `LB-{BRAND}-{CAT}-{TS36}-{CHK}`

Example: `LB-CHAR-TO-K9F3M2A1-X7Q`
    """,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.DEBUG else ["https://loocbooc.com", "https://app.loocbooc.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Rate Limiting Middleware ---
from app.middleware.rate_limit import rate_limit_middleware
app.middleware("http")(rate_limit_middleware)


# --- Request Logging Middleware ---
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000

    logger.info(
        "http_request",
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        duration_ms=round(duration_ms, 2),
        ip=request.client.host if request.client else None,
    )
    response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"
    return response


# --- Global Exception Handler ---
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        "unhandled_exception",
        path=request.url.path,
        error=str(exc),
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred"},
    )


# --- Routers ---
# Health check at root level
app.include_router(health.router)

# API v1 routes
API_PREFIX = settings.API_PREFIX

app.include_router(brands.router, prefix=API_PREFIX)
app.include_router(garments.router, prefix=API_PREFIX)
app.include_router(avatars.router, prefix=API_PREFIX)
app.include_router(scan.router, prefix=API_PREFIX)
app.include_router(try_on.router, prefix=API_PREFIX)


@app.get("/", tags=["root"])
async def root():
    """API root — confirms service is running."""
    return {
        "service": "Loocbooc API",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health",
    }
