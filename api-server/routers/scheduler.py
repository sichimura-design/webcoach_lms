"""
定期処理の担当確認(BFFが定期処理の前に呼ぶ)
"""
from fastapi import APIRouter

import scheduler_lock

router = APIRouter(prefix="/api", tags=["Scheduler"])


@router.post("/scheduler/leader", summary="このタスクが定期処理の担当か(担当でなければ担当になろうとする)")
def claim_scheduler_leader():
    return {"leader": scheduler_lock.is_leader()}
