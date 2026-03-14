"""
Test fixtures and configuration.
Uses SQLite for tests (fast, no Docker needed for unit tests).
Integration tests use the actual DB.
"""
import asyncio
import uuid
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app

# In-memory SQLite for tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    """Create async test engine with SQLite in-memory."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Provide a test database session."""
    TestSessionLocal = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db_session) -> AsyncGenerator[AsyncClient, None]:
    """AsyncClient with DB dependency overridden."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_brand(db_session) -> dict:
    """Create a test brand and API key."""
    from app.models.brand import APIKey, Brand
    from app.middleware.auth import hash_api_key

    brand = Brand(
        id=str(uuid.uuid4()),
        brand_code="TEST",
        name="Test Brand",
        slug="test-brand",
        is_active=True,
    )
    db_session.add(brand)
    await db_session.flush()

    raw_key = "lb_live_test_key_12345678901234567890123456"
    api_key = APIKey(
        id=str(uuid.uuid4()),
        brand_id=brand.id,
        key_hash=hash_api_key(raw_key),
        key_prefix=raw_key[:16],
        name="Test Key",
    )
    db_session.add(api_key)
    await db_session.flush()
    await db_session.refresh(brand)

    return {"brand": brand, "api_key": raw_key}
