import pytest
from fastapi import Header
from fastapi.testclient import TestClient

from askclaw.auth import get_current_user
from askclaw.config import settings
from askclaw.db import init_db
from askclaw.main import app


def _configurable_user(x_test_user: str = Header("testuser")):
    """Test auth override that reads user from X-Test-User header."""
    return x_test_user


@pytest.fixture()
def test_env(tmp_path):
    """Set up an isolated test database and upload dir, yield a TestClient."""
    settings.db_path = str(tmp_path / "test.db")
    settings.upload_dir = str(tmp_path / "uploads")
    init_db()

    app.dependency_overrides[get_current_user] = _configurable_user
    yield TestClient(app, raise_server_exceptions=False)
    app.dependency_overrides.clear()


@pytest.fixture()
def other_user_client(test_env):
    """Return a TestClient-like wrapper that sends requests as 'otheruser'."""

    class _OtherUserClient:
        def _headers(self, extra=None):
            h = {"X-Test-User": "otheruser"}
            if extra:
                h.update(extra)
            return h

        def get(self, url, **kwargs):
            kwargs.setdefault("headers", {}).update(self._headers())
            return test_env.get(url, **kwargs)

        def post(self, url, **kwargs):
            kwargs.setdefault("headers", {}).update(self._headers())
            return test_env.post(url, **kwargs)

        def delete(self, url, **kwargs):
            kwargs.setdefault("headers", {}).update(self._headers())
            return test_env.delete(url, **kwargs)

    return _OtherUserClient()
