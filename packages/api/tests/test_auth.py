"""
Tests for authentication middleware.
Covers API key auth, JWT auth, and the dual-path get_auth_context dependency.
"""
import hashlib
import time
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.middleware.auth import (
    AuthContext,
    create_access_token,
    hash_api_key,
    verify_jwt_token,
)


class TestHashApiKey:
    def test_hash_is_sha256(self):
        raw = "lb_live_test_key_123"
        result = hash_api_key(raw)
        expected = hashlib.sha256(raw.encode()).hexdigest()
        assert result == expected

    def test_same_input_same_hash(self):
        raw = "lb_live_abc"
        assert hash_api_key(raw) == hash_api_key(raw)

    def test_different_inputs_different_hashes(self):
        assert hash_api_key("key1") != hash_api_key("key2")

    def test_hash_is_hex_string(self):
        result = hash_api_key("test")
        assert all(c in "0123456789abcdef" for c in result)
        assert len(result) == 64  # SHA-256 = 32 bytes = 64 hex chars


class TestJWT:
    def test_create_and_verify_token(self):
        data = {"sub": "user-123", "scopes": ["garments:read"]}
        token = create_access_token(data, expires_delta=60)
        payload = verify_jwt_token(token)
        assert payload is not None
        assert payload["sub"] == "user-123"
        assert "garments:read" in payload["scopes"]

    def test_expired_token_returns_none(self):
        # Use negative expiry to force immediate expiration
        data = {"sub": "user-456"}
        token = create_access_token(data, expires_delta=-1)
        payload = verify_jwt_token(token)
        assert payload is None

    def test_tampered_token_returns_none(self):
        data = {"sub": "user-789"}
        token = create_access_token(data, expires_delta=60)
        # Tamper with the signature
        parts = token.split(".")
        parts[2] = parts[2][::-1]  # Reverse the signature
        tampered = ".".join(parts)
        assert verify_jwt_token(tampered) is None

    def test_invalid_token_returns_none(self):
        assert verify_jwt_token("not.a.token") is None
        assert verify_jwt_token("") is None

    def test_token_with_brand_id(self):
        data = {"sub": "user-100", "brand_id": "brand-abc", "scopes": ["garments:write"]}
        token = create_access_token(data, expires_delta=60)
        payload = verify_jwt_token(token)
        assert payload is not None
        assert payload["brand_id"] == "brand-abc"


class TestAuthContext:
    def test_is_brand_true_when_brand_id_set(self):
        ctx = AuthContext(auth_type="api_key", brand_id="brand-1")
        assert ctx.is_brand is True
        assert ctx.is_user is False

    def test_is_user_true_when_user_id_set(self):
        ctx = AuthContext(auth_type="jwt", user_id="user-1")
        assert ctx.is_user is True
        assert ctx.is_brand is False

    def test_scopes_defaults_to_empty_list(self):
        ctx = AuthContext(auth_type="jwt")
        assert ctx.scopes == []

    def test_scopes_provided(self):
        ctx = AuthContext(auth_type="api_key", scopes=["garments:read", "garments:write"])
        assert len(ctx.scopes) == 2


class TestAPIKeyHeaderAuth:
    """
    Integration-style tests for API key authentication.
    These test the actual endpoint behaviour.
    """

    async def test_no_auth_returns_401_on_protected_endpoint(self, client):
        """Protected endpoint with no credentials returns 401."""
        response = await client.post(
            "/api/v1/garments",
            json={"name": "Test", "category": "tops"},
        )
        assert response.status_code == 401

    async def test_wrong_api_key_prefix_returns_401(self, client):
        """API key without the lb_live_ prefix should be rejected."""
        response = await client.post(
            "/api/v1/garments",
            json={"name": "Test", "category": "tops"},
            headers={"X-API-Key": "wrong_prefix_key_123456"},
        )
        assert response.status_code == 401

    async def test_valid_api_key_authenticates(self, client, test_brand):
        """Valid API key in X-API-Key header authenticates successfully."""
        response = await client.post(
            "/api/v1/garments",
            json={"name": "Auth Test", "category": "tops"},
            headers={"X-API-Key": test_brand["api_key"]},
        )
        assert response.status_code == 201

    async def test_jwt_bearer_denied_on_api_key_only_endpoint(self, client):
        """Endpoints requiring api_key auth reject JWT tokens."""
        token = create_access_token({"sub": "user-123"}, expires_delta=60)
        response = await client.post(
            "/api/v1/garments",
            json={"name": "JWT Test", "category": "tops"},
            headers={"Authorization": f"Bearer {token}"},
        )
        # POST /garments requires api_key specifically
        assert response.status_code == 401

    async def test_bearer_auth_wrong_header(self, client, test_brand):
        """Passing API key as Bearer token (old bug) should fail auth."""
        response = await client.post(
            "/api/v1/garments",
            json={"name": "Wrong Header Test", "category": "tops"},
            headers={"Authorization": f"Bearer {test_brand['api_key']}"},
        )
        # The API key sent as Bearer will fail JWT verification AND API key check
        assert response.status_code == 401
