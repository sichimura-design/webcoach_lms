"""
Dify連携ツールへの添付画像の転送 (agents/tools_langchain.py)

- 画像アップロードが有効なアプリには /files/upload でアップロードし、chat-messages に files を付ける
- 同じ会話の以降のターン（画像なし）でも、アップロード済みの画像を送り続ける
- 画像アップロードが無効なアプリ・アップロード失敗時は、画像なしで従来どおり送る
"""
import base64
from unittest.mock import MagicMock, patch

import pytest
import requests

import agents.tools_langchain as tools_langchain
from agents.tools_langchain import _call_dify_chat

IMAGE = {"media_type": "image/png", "data": base64.b64encode(b"fake-png").decode()}

PARAMS_IMAGE_ENABLED = {
    "file_upload": {"enabled": True, "allowed_file_types": ["image"]},
    "user_input_form": [],
}
PARAMS_IMAGE_DISABLED = {
    "file_upload": {"enabled": False, "image": {"enabled": False}},
    "user_input_form": [],
}


@pytest.fixture(autouse=True)
def _reset_caches():
    for cache in (
        tools_langchain._dify_conversation_cache,
        tools_langchain._dify_sticky_app_cache,
        tools_langchain._dify_extra_inputs_cache,
        tools_langchain._dify_image_cache,
    ):
        cache.clear()
    yield
    tools_langchain._dify_image_cache.clear()


def _response(payload):
    resp = MagicMock()
    resp.json.return_value = payload
    resp.raise_for_status.return_value = None
    return resp


def _fake_post(upload_id="file-1"):
    """/files/upload と /chat-messages を振り分けるモック"""
    def post(url, **kwargs):
        if url.endswith("/files/upload"):
            return _response({"id": upload_id})
        return _response({"answer": "ok", "conversation_id": "conv-1"})
    return MagicMock(side_effect=post)


def _chat_calls(mock_post):
    return [c for c in mock_post.call_args_list if c.args[0].endswith("/chat-messages")]


def _upload_calls(mock_post):
    return [c for c in mock_post.call_args_list if c.args[0].endswith("/files/upload")]


def test_uploads_image_and_attaches_files_when_app_accepts_images():
    mock_post = _fake_post("file-1")
    with patch.object(tools_langchain, "_get_dify_parameters", return_value=PARAMS_IMAGE_ENABLED), \
         patch.object(tools_langchain.requests, "post", mock_post):
        _call_dify_chat("添削して", 7, "key", 17, session_id="s1", image=IMAGE)

    upload = _upload_calls(mock_post)
    assert len(upload) == 1
    name, content, media_type = upload[0].kwargs["files"]["file"]
    assert (name, content, media_type) == ("upload.png", b"fake-png", "image/png")
    assert upload[0].kwargs["data"] == {"user": "webcoach-user-7"}

    body = _chat_calls(mock_post)[0].kwargs["json"]
    assert body["files"] == [
        {"type": "image", "transfer_method": "local_file", "upload_file_id": "file-1"}
    ]


def test_keeps_sending_uploaded_image_on_later_turns_without_image():
    mock_post = _fake_post("file-1")
    with patch.object(tools_langchain, "_get_dify_parameters", return_value=PARAMS_IMAGE_ENABLED), \
         patch.object(tools_langchain.requests, "post", mock_post):
        _call_dify_chat("添削して", 7, "key", 17, session_id="s1", image=IMAGE)
        _call_dify_chat("バナー広告です", 7, "key", 17, session_id="s1")

    assert len(_upload_calls(mock_post)) == 1
    second = _chat_calls(mock_post)[1].kwargs["json"]
    assert second["files"][0]["upload_file_id"] == "file-1"


def test_image_is_not_shared_across_sessions_and_is_cleared_on_reset():
    mock_post = _fake_post("file-1")
    with patch.object(tools_langchain, "_get_dify_parameters", return_value=PARAMS_IMAGE_ENABLED), \
         patch.object(tools_langchain.requests, "post", mock_post):
        _call_dify_chat("添削して", 7, "key", 17, session_id="s1", image=IMAGE)
        _call_dify_chat("別の相談", 7, "key", 17, session_id="s2")
        _call_dify_chat("新しく見て", 7, "key", 17, session_id="s1", reset=True)

    chats = _chat_calls(mock_post)
    assert "files" not in chats[1].kwargs["json"]
    assert "files" not in chats[2].kwargs["json"]


def test_skips_image_when_app_does_not_accept_images():
    mock_post = _fake_post()
    with patch.object(tools_langchain, "_get_dify_parameters", return_value=PARAMS_IMAGE_DISABLED), \
         patch.object(tools_langchain.requests, "post", mock_post):
        answer = _call_dify_chat("添削して", 7, "key", 17, session_id="s1", image=IMAGE)

    assert answer == "ok"
    assert _upload_calls(mock_post) == []
    assert "files" not in _chat_calls(mock_post)[0].kwargs["json"]


def test_upload_failure_falls_back_to_text_only():
    def post(url, **kwargs):
        if url.endswith("/files/upload"):
            raise requests.exceptions.ConnectionError("boom")
        return _response({"answer": "ok", "conversation_id": "conv-1"})

    mock_post = MagicMock(side_effect=post)
    with patch.object(tools_langchain, "_get_dify_parameters", return_value=PARAMS_IMAGE_ENABLED), \
         patch.object(tools_langchain.requests, "post", mock_post):
        answer = _call_dify_chat("添削して", 7, "key", 17, session_id="s1", image=IMAGE)

    assert answer == "ok"
    assert "files" not in _chat_calls(mock_post)[0].kwargs["json"]
