import uuid


def _new_chat_id() -> str:
    return str(uuid.uuid4())


def test_fts_search_finds_message(test_env):
    chat_id = _new_chat_id()
    test_env.post("/api/chats", json={"id": chat_id})
    test_env.post(f"/api/chats/{chat_id}/messages", json={
        "messages": [
            {"role": "user", "content": "How does photosynthesis work?"},
            {"role": "assistant", "content": "Photosynthesis converts sunlight into energy."},
        ]
    })

    resp = test_env.get("/api/search", params={"q": "photosynthesis"})
    assert resp.status_code == 200
    results = resp.json()
    assert len(results) >= 1
    # Should have highlight marks in snippet
    assert "<mark>" in results[0]["snippet"]
    assert results[0]["chat_id"] == chat_id


def test_search_does_not_return_other_user_messages(test_env, other_user_client):
    chat_id = _new_chat_id()
    test_env.post("/api/chats", json={"id": chat_id})
    test_env.post(f"/api/chats/{chat_id}/messages", json={
        "messages": [
            {"role": "user", "content": "Secret quantum entanglement notes"},
        ]
    })

    # Search as otheruser
    resp = other_user_client.get("/api/search", params={"q": "quantum"})
    assert resp.status_code == 200
    assert resp.json() == []
