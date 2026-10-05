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


def test_model_and_docs_use_their_types(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_MODEL", raising=False)
    monkeypatch.setenv("ENABLE_DOCS", "False")
    monkeypatch.setenv("DB_POOL_SIZE", "15")

    values = runtime_settings.current_values()

    assert values["ANTHROPIC_MODEL"] == "claude-haiku-4-5-20251001"
    assert values["ENABLE_DOCS"] is False
    assert values["DB_POOL_SIZE"] == 15


def test_blank_bool_and_str_fall_back_to_default(monkeypatch):
    monkeypatch.setenv("ENABLE_DOCS", " ")
    monkeypatch.setenv("ANTHROPIC_MODEL", "")

    assert runtime_settings.get_bool("ENABLE_DOCS") is True
    assert runtime_settings.get_str("ANTHROPIC_MODEL") == "claude-haiku-4-5-20251001"


def test_anthropic_models_are_listed_and_cached(client, monkeypatch):
    from types import SimpleNamespace
    from routers import runtime_settings as router_module

    calls = []

    class FakeClient:
        def __init__(self):
            self.models = SimpleNamespace(list=self._list)

        def _list(self, limit):
            calls.append(limit)
            return [SimpleNamespace(id="claude-opus-5-5", display_name="Claude Opus 5.5")]

    monkeypatch.setattr(router_module.anthropic, "Anthropic", FakeClient)
    monkeypatch.setitem(router_module._models_cache, "models", None)

    first = client.get("/api/runtime-settings/anthropic-models")
    second = client.get("/api/runtime-settings/anthropic-models")

    assert first.json() == {"models": [{"id": "claude-opus-5-5", "display_name": "Claude Opus 5.5"}]}
    assert second.json() == first.json()
    assert len(calls) == 1
