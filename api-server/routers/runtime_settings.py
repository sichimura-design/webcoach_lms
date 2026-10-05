"""
動作設定の現在値(BFFの管理画面向け)
"""
import time

import anthropic
from fastapi import APIRouter, HTTPException

import runtime_settings

router = APIRouter(prefix="/api", tags=["Runtime Settings"])

# 管理画面を開くたびにAnthropicへ問い合わせないよう、モデル一覧はしばらく使い回す
MODELS_CACHE_SECONDS = 3600
_models_cache = {"at": 0.0, "models": None}


@router.get("/runtime-settings", summary="このプロセスで使っている設定値")
def get_runtime_settings():
    return {"values": runtime_settings.current_values()}


@router.get("/runtime-settings/anthropic-models", summary="このAPIキーで使えるClaudeのモデル一覧")
def get_anthropic_models():
    now = time.time()
    if _models_cache["models"] is None or now - _models_cache["at"] > MODELS_CACHE_SECONDS:
        try:
            # 新しいモデルから順に返る。list()は次のページも自動で取りに行く
            models = [
                {"id": m.id, "display_name": m.display_name}
                for m in anthropic.Anthropic().models.list(limit=100)
            ]
        except anthropic.APIError as e:
            raise HTTPException(status_code=502, detail=f"モデル一覧を取得できませんでした: {e}")
        _models_cache.update(at=now, models=models)
    return {"models": _models_cache["models"]}
