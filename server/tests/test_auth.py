import base64

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from askclaw.auth import get_current_user


@pytest.fixture()
def auth_app():
    """Minimal app that exposes get_current_user for direct testing."""
    _app = FastAPI()

    @_app.get("/me")
    def me(username: str = pytest.importorskip("fastapi").Depends(get_current_user)):
        return {"user": username}

    return TestClient(_app, raise_server_exceptions=False)


def test_x_forwarded_user(auth_app):
    resp = auth_app.get("/me", headers={"X-Forwarded-User": "alice"})
    assert resp.status_code == 200
    assert resp.json()["user"] == "alice"


def test_basic_auth(auth_app):
    creds = base64.b64encode(b"bob:secret").decode()
    resp = auth_app.get("/me", headers={"Authorization": f"Basic {creds}"})
    assert resp.status_code == 200
    assert resp.json()["user"] == "bob"


def test_missing_auth_returns_401(auth_app):
    resp = auth_app.get("/me")
    assert resp.status_code == 401
