"""
動作設定の現在値(BFFの管理画面向け)
"""
from fastapi import APIRouter

import runtime_settings

router = APIRouter(prefix="/api", tags=["Runtime Settings"])


@router.get("/runtime-settings", summary="このプロセスで使っている設定値")
def get_runtime_settings():
    return {"values": runtime_settings.current_values()}
