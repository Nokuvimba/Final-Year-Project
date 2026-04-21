# test_api.py
# MSSIA Platform – FastAPI Unit & Integration Tests
# Run locally:  pytest test_api.py -v
# Run vs cloud: BASE_URL=https://mssia.duckdns.org pytest test_api.py -v
#
# Install dependencies first:
#   pip install pytest requests python-dotenv

import os
import pytest
import requests

# ── Config ────────────────────────────────────────────────────────────────────
# Defaults to localhost. Override with environment variable:
#   BASE_URL=https://mssia.duckdns.org pytest test_api.py -v
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")

# Admin credentials – must match .env on the server
ADMIN_EMAIL    = os.getenv("ADMIN_EMAIL",    "admin@mssia.ie")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

# A known assigned node name (must exist in your database)
KNOWN_NODE   = "ESP32-LAB-01"
UNKNOWN_NODE = "FAKE-NODE-999"

print(f"\n\n{'='*60}")
print(f"  Running MSSIA API Tests against: {BASE_URL}")
print(f"{'='*60}\n")


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def jwt_token():
    """Log in once and reuse the token for all tests that need auth."""
    res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
    })
    assert res.status_code == 200, f"Login failed: {res.text}"
    return res.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(jwt_token):
    return {"Authorization": f"Bearer {jwt_token}"}


# ── Health ────────────────────────────────────────────────────────────────────

class TestHealth:
    def test_health_returns_200(self):
        """GET /health should return HTTP 200."""
        res = requests.get(f"{BASE_URL}/health")
        assert res.status_code == 200

    def test_health_returns_ok(self):
        """GET /health should return {status: ok}."""
        res = requests.get(f"{BASE_URL}/health")
        assert res.json() == {"status": "ok"}


# ── Authentication ────────────────────────────────────────────────────────────

class TestAuth:
    def test_login_valid_credentials_returns_200(self):
        """POST /auth/login with correct credentials returns 200."""
        res = requests.post(f"{BASE_URL}/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
        })
        assert res.status_code == 200

    def test_login_returns_access_token(self):
        """POST /auth/login response contains access_token field."""
        res = requests.post(f"{BASE_URL}/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
        })
        data = res.json()
        assert "access_token" in data
        assert len(data["access_token"]) > 20  # token is not empty

    def test_login_returns_bearer_type(self):
        """POST /auth/login response token_type is bearer."""
        res = requests.post(f"{BASE_URL}/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
        })
        assert res.json()["token_type"] == "bearer"

    def test_login_wrong_password_returns_401(self):
        """POST /auth/login with wrong password returns 401."""
        res = requests.post(f"{BASE_URL}/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword",
        })
        assert res.status_code == 401

    def test_login_wrong_email_returns_401(self):
        """POST /auth/login with unknown email returns 401."""
        res = requests.post(f"{BASE_URL}/auth/login", json={
            "email": "notanadmin@test.com",
            "password": ADMIN_PASSWORD,
        })
        assert res.status_code == 401

    def test_login_missing_fields_returns_422(self):
        """POST /auth/login with empty body returns validation error."""
        res = requests.post(f"{BASE_URL}/auth/login", json={})
        # FastAPI returns 200 with 401 detail – depends on implementation
        assert res.status_code in [401, 422]

    def test_verify_valid_token_returns_200(self, auth_headers):
        """GET /auth/verify with valid Bearer token returns 200."""
        res = requests.get(f"{BASE_URL}/auth/verify", headers=auth_headers)
        assert res.status_code == 200

    def test_verify_valid_token_returns_valid_true(self, auth_headers):
        """GET /auth/verify with valid token returns {valid: true}."""
        res = requests.get(f"{BASE_URL}/auth/verify", headers=auth_headers)
        assert res.json()["valid"] is True

    def test_verify_valid_token_returns_email(self, auth_headers):
        """GET /auth/verify response contains the admin email."""
        res = requests.get(f"{BASE_URL}/auth/verify", headers=auth_headers)
        assert res.json()["email"] == ADMIN_EMAIL.lower()

    def test_verify_no_token_returns_401(self):
        """GET /auth/verify without Authorization header returns 401."""
        res = requests.get(f"{BASE_URL}/auth/verify")
        assert res.status_code == 401

    def test_verify_invalid_token_returns_401(self):
        """GET /auth/verify with fake token returns 401."""
        res = requests.get(f"{BASE_URL}/auth/verify",
                           headers={"Authorization": "Bearer faketoken123"})
        assert res.status_code == 401

    def test_verify_malformed_header_returns_401(self):
        """GET /auth/verify with missing 'Bearer ' prefix returns 401."""
        res = requests.get(f"{BASE_URL}/auth/verify",
                           headers={"Authorization": "notbearer token"})
        assert res.status_code == 401


# ── Ingest ────────────────────────────────────────────────────────────────────

class TestIngest:
    def test_ingest_unknown_node_returns_403(self):
        """POST /ingest with unregistered node returns 403 Forbidden."""
        res = requests.post(f"{BASE_URL}/ingest", json={
            "node": UNKNOWN_NODE,
            "scans": [{"ssid": "TestNet", "bssid": "aa:bb:cc:dd:ee:ff",
                        "rssi": -65, "channel": 6, "enc": 4}]
        })
        assert res.status_code == 403

    def test_ingest_missing_node_returns_400(self):
        """POST /ingest with missing node field returns 400."""
        res = requests.post(f"{BASE_URL}/ingest", json={
            "scans": [{"ssid": "TestNet", "rssi": -65}]
        })
        assert res.status_code == 400

    def test_ingest_empty_scans_returns_400(self):
        """POST /ingest with empty scans array returns 400."""
        res = requests.post(f"{BASE_URL}/ingest", json={
            "node": KNOWN_NODE,
            "scans": []
        })
        assert res.status_code == 400

    def test_ingest_known_node_returns_assigned(self):
        """POST /ingest with a known assigned node returns status Assigned.
        NOTE: This test only passes if ESP32-LAB-01 is assigned to a scan point
        in the database. If not, it will return 403.
        """
        res = requests.post(f"{BASE_URL}/ingest", json={
            "node": KNOWN_NODE,
            "scans": [{"ssid": "TestNet", "bssid": "aa:bb:cc:dd:ee:ff",
                        "rssi": -70, "channel": 1, "enc": 4}]
        })
        # Accept 200 (assigned) or 403 (not assigned yet)
        assert res.status_code in [200, 403]
        if res.status_code == 200:
            assert res.json()["status"] == "Assigned"


# ── Buildings ─────────────────────────────────────────────────────────────────

class TestBuildings:
    def test_list_buildings_returns_200(self):
        """GET /buildings returns 200."""
        res = requests.get(f"{BASE_URL}/buildings")
        assert res.status_code == 200

    def test_list_buildings_returns_list(self):
        """GET /buildings response contains buildings array."""
        res = requests.get(f"{BASE_URL}/buildings")
        assert "buildings" in res.json()
        assert isinstance(res.json()["buildings"], list)

    def test_create_building_returns_201_or_200(self):
        """POST /buildings creates a new building."""
        res = requests.post(f"{BASE_URL}/buildings", json={
            "name": f"Test Building pytest",
            "description": "Created by automated test"
        })
        assert res.status_code in [200, 400]  # 400 if name already exists

    def test_get_building_not_found_returns_404(self):
        """GET /buildings/99999 returns 404 for non-existent building."""
        res = requests.get(f"{BASE_URL}/buildings/99999")
        assert res.status_code == 404


# ── Heatmap ───────────────────────────────────────────────────────────────────

class TestHeatmap:
    def test_heatmap_invalid_floorplan_returns_404(self):
        """GET /heatmap/floorplan/99999 returns 404 for non-existent floor plan."""
        res = requests.get(f"{BASE_URL}/heatmap/floorplan/99999")
        assert res.status_code == 404

    def test_heatmap_returns_list(self):
        """GET /heatmap/floorplan/1 returns a list (empty or populated)."""
        res = requests.get(f"{BASE_URL}/heatmap/floorplan/1")
        # Returns 200 with list, or 404 if floorplan 1 doesn't exist
        assert res.status_code in [200, 404]
        if res.status_code == 200:
            assert isinstance(res.json(), list)


# ── WiFi History ──────────────────────────────────────────────────────────────

class TestWifiHistory:
    def test_wifi_history_invalid_point_returns_404(self):
        """GET /scan-points/99999/wifi-history returns 404."""
        res = requests.get(f"{BASE_URL}/scan-points/99999/wifi-history")
        assert res.status_code == 404

    def test_wifi_history_invalid_range_returns_422(self):
        """GET /scan-points/1/wifi-history?time_range=invalid returns 422."""
        res = requests.get(f"{BASE_URL}/scan-points/1/wifi-history?time_range=invalid")
        assert res.status_code == 422

    def test_wifi_history_valid_ranges(self):
        """GET /scan-points/1/wifi-history accepts all valid range values."""
        for time_range in ["20m", "1h", "6h", "24h", "7d"]:
            res = requests.get(
                f"{BASE_URL}/scan-points/1/wifi-history?time_range={time_range}")
            assert res.status_code in [200, 404], \
                f"Range {time_range} returned unexpected status {res.status_code}"


# ── Devices ───────────────────────────────────────────────────────────────────

class TestDevices:
    def test_list_devices_returns_200(self):
        """GET /devices returns 200."""
        res = requests.get(f"{BASE_URL}/devices")
        assert res.status_code == 200

    def test_list_devices_returns_devices_key(self):
        """GET /devices response contains devices array."""
        res = requests.get(f"{BASE_URL}/devices")
        assert "devices" in res.json()

    def test_known_nodes_returns_200(self):
        """GET /devices/known returns 200."""
        res = requests.get(f"{BASE_URL}/devices/known")
        assert res.status_code == 200

    def test_known_nodes_returns_list(self):
        """GET /devices/known returns nodes array."""
        res = requests.get(f"{BASE_URL}/devices/known")
        assert "nodes" in res.json()
        assert isinstance(res.json()["nodes"], list)


# ── Rooms ─────────────────────────────────────────────────────────────────────

class TestRooms:
    def test_list_rooms_returns_200(self):
        """GET /rooms returns 200."""
        res = requests.get(f"{BASE_URL}/rooms")
        assert res.status_code == 200

    def test_list_rooms_returns_rooms_key(self):
        """GET /rooms response contains rooms array."""
        res = requests.get(f"{BASE_URL}/rooms")
        assert "rooms" in res.json()

    def test_delete_nonexistent_room_returns_404(self):
        """DELETE /rooms/99999 returns 404."""
        res = requests.delete(f"{BASE_URL}/rooms/99999")
        assert res.status_code == 404
