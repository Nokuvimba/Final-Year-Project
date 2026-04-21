import os
import pytest
import requests

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "requires_server: skip if the API server is not reachable"
    )


def _server_is_up() -> bool:
    try:
        requests.get(f"{BASE_URL}/health", timeout=3)
        return True
    except requests.exceptions.ConnectionError:
        return False


def pytest_collection_modifyitems(config, items):
    if _server_is_up():
        return
    skip = pytest.mark.skip(
        reason=f"API server not reachable at {BASE_URL}. "
               "Start the server with `uvicorn main:app --reload` or set "
               "BASE_URL=https://mssia.duckdns.org to run against the cloud."
    )
    for item in items:
        item.add_marker(skip)
