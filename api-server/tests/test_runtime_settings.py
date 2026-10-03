"""動作設定の現在値APIと、値の読み方のテスト"""
import runtime_settings


def test_returns_defaults_when_unset(client, monkeypatch):
    for name in runtime_settings.DEFAULTS:
        monkeypatch.delenv(name, raising=False)

    res = client.get("/api/runtime-settings")

    assert res.status_code == 200
    assert res.json() == {"values": runtime_settings.DEFAULTS}


def test_returns_env_value(client, monkeypatch):
    monkeypatch.setenv("COACHING_NOTE_MAX_OUTPUT_TOKENS", "6000")

    res = client.get("/api/runtime-settings")

    assert res.json()["values"]["COACHING_NOTE_MAX_OUTPUT_TOKENS"] == 6000


def test_invalid_value_falls_back_to_default(monkeypatch):
    monkeypatch.setenv("AI_CHAT_MAX_OUTPUT_TOKENS", "abc")

    assert runtime_settings.get_int("AI_CHAT_MAX_OUTPUT_TOKENS") == 1024
