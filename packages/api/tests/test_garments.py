"""
Tests for garment endpoints.
Requires the test database fixture from conftest.py.
"""
import pytest
import pytest_asyncio


class TestCreateGarment:
    async def test_create_garment_requires_auth(self, client):
        """POST /garments without auth should return 401."""
        response = await client.post(
            "/api/v1/garments",
            json={"name": "Test Shirt", "category": "tops"},
        )
        assert response.status_code == 401

    async def test_create_garment_success(self, client, test_brand):
        """Create garment with valid API key returns 201 with UGI."""
        response = await client.post(
            "/api/v1/garments",
            json={"name": "Test Shirt", "category": "tops", "description": "A test shirt"},
            headers={"X-API-Key": test_brand["api_key"]},
        )
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["id"].startswith("LB-TEST-TO-")
        assert data["name"] == "Test Shirt"
        assert data["category"] == "tops"
        assert data["status"] == "draft"

    async def test_create_garment_ugi_is_valid(self, client, test_brand):
        """The generated UGI should pass validation."""
        from app.services.uuid_service import validate_ugi

        response = await client.post(
            "/api/v1/garments",
            json={"name": "Dress", "category": "dresses"},
            headers={"X-API-Key": test_brand["api_key"]},
        )
        assert response.status_code == 201
        ugi = response.json()["id"]
        assert validate_ugi(ugi), f"Generated UGI {ugi!r} is not valid"

    async def test_create_garment_with_metadata(self, client, test_brand):
        """Garment can be created with arbitrary metadata."""
        response = await client.post(
            "/api/v1/garments",
            json={
                "name": "Jacket",
                "category": "outerwear",
                "metadata": {"collection": "AW26", "price_aud": 299.00},
                "dpp_data": {"material_origin": "Australia"},
            },
            headers={"X-API-Key": test_brand["api_key"]},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["metadata"]["collection"] == "AW26"
        assert data["dpp_data"]["material_origin"] == "Australia"

    async def test_create_garment_invalid_category(self, client, test_brand):
        """Invalid category should return 422."""
        response = await client.post(
            "/api/v1/garments",
            json={"name": "Thing", "category": "not_a_real_category"},
            headers={"X-API-Key": test_brand["api_key"]},
        )
        assert response.status_code == 422

    async def test_create_garment_missing_name(self, client, test_brand):
        """Missing name should return 422."""
        response = await client.post(
            "/api/v1/garments",
            json={"category": "tops"},
            headers={"X-API-Key": test_brand["api_key"]},
        )
        assert response.status_code == 422


class TestGetGarment:
    async def test_get_nonexistent_garment(self, client):
        """GET on non-existent UGI should return 404."""
        response = await client.get("/api/v1/garments/LB-FAKE-TO-00000000-000")
        assert response.status_code == 404

    async def test_get_draft_garment_public(self, client, test_brand):
        """Public requests cannot see draft garments."""
        # Create a garment (will be draft)
        create_resp = await client.post(
            "/api/v1/garments",
            json={"name": "Secret Dress", "category": "dresses"},
            headers={"X-API-Key": test_brand["api_key"]},
        )
        ugi = create_resp.json()["id"]

        # Public GET should 404
        response = await client.get(f"/api/v1/garments/{ugi}")
        assert response.status_code == 404

    async def test_get_draft_garment_authenticated(self, client, test_brand):
        """Authenticated requests can see draft garments."""
        create_resp = await client.post(
            "/api/v1/garments",
            json={"name": "Draft Top", "category": "tops"},
            headers={"X-API-Key": test_brand["api_key"]},
        )
        ugi = create_resp.json()["id"]

        response = await client.get(
            f"/api/v1/garments/{ugi}",
            headers={"X-API-Key": test_brand["api_key"]},
        )
        assert response.status_code == 200
        assert response.json()["id"] == ugi


class TestUGIValidationEndpoint:
    async def test_validate_valid_ugi(self, client, test_brand):
        """Validate endpoint should confirm valid UGI."""
        create_resp = await client.post(
            "/api/v1/garments",
            json={"name": "Pants", "category": "bottoms"},
            headers={"X-API-Key": test_brand["api_key"]},
        )
        ugi = create_resp.json()["id"]

        response = await client.get(f"/api/v1/garments/validate/{ugi}")
        assert response.status_code == 200
        data = response.json()
        assert data["is_valid"] is True
        assert data["brand_code"] == "TEST"
        assert data["category_code"] == "BT"

    async def test_validate_invalid_ugi(self, client):
        """Validate endpoint should flag invalid UGI."""
        response = await client.get("/api/v1/garments/validate/NOT-A-REAL-UGI")
        assert response.status_code == 200
        assert response.json()["is_valid"] is False


class TestListGarments:
    async def test_list_garments_public(self, client):
        """Public list should only return active garments."""
        response = await client.get("/api/v1/garments")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
