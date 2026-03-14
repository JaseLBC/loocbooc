"""
Authentication middleware.
Supports:
1. API Key — for brand integrations: X-API-Key: lb_live_xxxxx
2. JWT Bearer token — for web/mobile consumers

Sets request.state.auth with the authenticated context.
"""
import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, HTTPException, Request, Security, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.brand import APIKey, Brand

logger = logging.getLogger(__name__)

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class AuthContext:
    """Auth context set on request.state.auth after successful authentication."""
    auth_type: str  # "api_key" or "jwt"
    brand_id: str | None = None
    brand: "Brand | None" = None
    user_id: str | None = None
    scopes: list[str] = None

    def __post_init__(self):
        if self.scopes is None:
            self.scopes = []

    @property
    def is_brand(self) -> bool:
        return self.brand_id is not None

    @property
    def is_user(self) -> bool:
        return self.user_id is not None


def hash_api_key(raw_key: str) -> str:
    """Hash an API key for storage/comparison. Uses SHA-256."""
    return hashlib.sha256(raw_key.encode()).hexdigest()


async def verify_api_key(
    api_key: str | None,
    db: AsyncSession,
) -> AuthContext | None:
    """Verify an API key and return auth context, or None if invalid."""
    if not api_key:
        return None

    if not api_key.startswith(settings.API_KEY_PREFIX):
        return None

    key_hash = hash_api_key(api_key)

    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(APIKey)
        .options(selectinload(APIKey.brand))
        .where(APIKey.key_hash == key_hash, APIKey.is_active == True)  # noqa: E712
    )
    api_key_obj = result.scalar_one_or_none()

    if api_key_obj is None:
        return None

    # Check expiry
    if api_key_obj.expires_at and api_key_obj.expires_at < datetime.now(timezone.utc):
        return None

    # Check brand is active
    if not api_key_obj.brand.is_active:
        return None

    # Update last used
    api_key_obj.last_used_at = datetime.now(timezone.utc)
    await db.flush()

    return AuthContext(
        auth_type="api_key",
        brand_id=api_key_obj.brand_id,
        brand=api_key_obj.brand,
        scopes=["garments:write", "garments:read", "files:write"],
    )


def verify_jwt_token(token: str) -> dict[str, Any] | None:
    """Verify a JWT token and return the payload, or None if invalid."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError as e:
        logger.debug(f"JWT verification failed: {e}")
        return None


def create_access_token(data: dict, expires_delta: int | None = None) -> str:
    """Create a JWT access token."""
    from datetime import timedelta
    import copy

    to_encode = copy.deepcopy(data)
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_delta or settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


async def get_auth_context(
    request: Request,
    api_key: str | None = Security(api_key_header),
    bearer: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> AuthContext | None:
    """
    FastAPI dependency: tries API key first, then JWT.
    Returns None if no valid auth provided (allows public access).
    """
    # Try API key first
    if api_key:
        ctx = await verify_api_key(api_key, db)
        if ctx:
            request.state.auth = ctx
            return ctx

    # Try JWT
    if bearer:
        payload = verify_jwt_token(bearer.credentials)
        if payload:
            ctx = AuthContext(
                auth_type="jwt",
                user_id=payload.get("sub"),
                scopes=payload.get("scopes", []),
            )
            request.state.auth = ctx
            return ctx

    request.state.auth = None
    return None


async def require_auth(
    auth: AuthContext | None = Depends(get_auth_context),
) -> AuthContext:
    """FastAPI dependency: requires authentication. Raises 401 if not authenticated."""
    if auth is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer, ApiKey"},
        )
    return auth


async def require_api_key(
    auth: AuthContext | None = Depends(get_auth_context),
) -> AuthContext:
    """FastAPI dependency: requires API key authentication specifically."""
    if auth is None or auth.auth_type != "api_key":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key authentication required",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    return auth
