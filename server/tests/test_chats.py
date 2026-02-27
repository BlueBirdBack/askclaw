import io
import uuid

import pytest


def _new_chat_id() -> str:
    return str(uuid.uuid4())


def test_create_chat(test_env):
    chat_id = _new_chat_id()
    resp = test_env.post("/api/chats", json={"id": chat_id, "model": "openclaw:main"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["id"] == chat_id
    assert data["model"] == "openclaw:main"


def test_duplicate_chat_returns_409(test_env):
    chat_id = _new_chat_id()
    test_env.post("/api/chats", json={"id": chat_id})
    resp = test_env.post("/api/chats", json={"id": chat_id})
    assert resp.status_code == 409


def test_append_messages(test_env):
    chat_id = _new_chat_id()
    test_env.post("/api/chats", json={"id": chat_id})

    resp = test_env.post(f"/api/chats/{chat_id}/messages", json={
        "messages": [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"},
        ]
    })
    assert resp.status_code == 201
    msgs = resp.json()
    assert len(msgs) == 2
    assert msgs[0]["role"] == "user"
    assert msgs[0]["content"] == "Hello"
    assert msgs[1]["role"] == "assistant"
    assert msgs[1]["content"] == "Hi there!"


def test_auto_title_from_first_user_message(test_env):
    chat_id = _new_chat_id()
    test_env.post("/api/chats", json={"id": chat_id, "title": ""})

    test_env.post(f"/api/chats/{chat_id}/messages", json={
        "messages": [
            {"role": "user", "content": "What is the meaning of life?"},
            {"role": "assistant", "content": "42"},
        ]
    })

    resp = test_env.get(f"/api/chats/{chat_id}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "What is the meaning of life?"


def test_append_message_with_attachments(test_env):
    chat_id = _new_chat_id()
    test_env.post("/api/chats", json={"id": chat_id})

    # Upload a file first
    upload_resp = test_env.post("/api/files", files=[
        ("files", ("test.jpg", io.BytesIO(b"\xff\xd8\xff\xe0" + b"\x00" * 60), "image/jpeg"))
    ])
    att_id = upload_resp.json()[0]["id"]

    # Append message with attachment_ids
    resp = test_env.post(f"/api/chats/{chat_id}/messages", json={
        "messages": [
            {"role": "user", "content": "See this image", "attachment_ids": [att_id]},
        ]
    })
    assert resp.status_code == 201
    msg = resp.json()[0]
    assert len(msg["attachments"]) == 1
    assert msg["attachments"][0]["id"] == att_id
    assert msg["attachments"][0]["filename"] == "test.jpg"


def test_get_chat_includes_attachments(test_env):
    chat_id = _new_chat_id()
    test_env.post("/api/chats", json={"id": chat_id})

    upload_resp = test_env.post("/api/files", files=[
        ("files", ("photo.png", io.BytesIO(b"\x89PNG" + b"\x00" * 60), "image/png"))
    ])
    att_id = upload_resp.json()[0]["id"]

    test_env.post(f"/api/chats/{chat_id}/messages", json={
        "messages": [
            {"role": "user", "content": "Look at this", "attachment_ids": [att_id]},
            {"role": "assistant", "content": "Nice photo!"},
        ]
    })

    resp = test_env.get(f"/api/chats/{chat_id}")
    assert resp.status_code == 200
    detail = resp.json()
    user_msg = detail["messages"][0]
    assert len(user_msg["attachments"]) == 1
    assert user_msg["attachments"][0]["id"] == att_id
    # Assistant message has no attachments
    assert detail["messages"][1]["attachments"] == []


def test_nonexistent_chat_returns_404(test_env):
    resp = test_env.get(f"/api/chats/{_new_chat_id()}")
    assert resp.status_code == 404


def test_delete_chat(test_env):
    chat_id = _new_chat_id()
    test_env.post("/api/chats", json={"id": chat_id})

    resp = test_env.delete(f"/api/chats/{chat_id}")
    assert resp.status_code == 204

    resp = test_env.get(f"/api/chats/{chat_id}")
    assert resp.status_code == 404
