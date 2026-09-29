"""
AIチャット1回ぶん（run）の「生成を中止」を管理する。

フロントの「生成を中止」は、送信時に付けた run_id で POST /api/ai/chat/cancel を呼ぶ。
中止されると:
- LangGraph の各ノードの入口で打ち切る（次のLLM呼び出し・ツール呼び出しを始めない）
- LLM(Claude)はストリーミングで受けているので、受信の途中で接続を切って生成を止める
- Dify は task_id を使って停止API（POST /chat-messages/{task_id}/stop）を呼ぶ
途中まで進んだDifyの会話（ユーザーの発言と途中までの回答）はDify側に残る。
次の発言はその続きとして送る（Claude/Geminiで止めたあと、そのまま会話を続けられるのと同じ）。

プロセス内メモリのみ（routers/ai_langgraph._chat_jobs と同じ思想）。
"""
import logging
import threading
import time
import uuid
from typing import Callable, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# 中止の記録（run）をどれだけ保持するか。中止が /chat より先に届いた場合の記録もこの間は残す
RUN_TTL_SECONDS = 600


class ChatCancelled(Exception):
    """ユーザーが「生成を中止」した"""


class ChatRun:
    def __init__(self, run_id: str, user_id: int):
        self.run_id = run_id
        self.user_id = user_id
        self.created_at = time.time()
        self._cancelled = threading.Event()
        self._lock = threading.Lock()
        # 実行中のDify呼び出しを止める関数（task_idが分かった時点で登録される）
        self._stop_dify: Optional[Callable[[], None]] = None

    @property
    def cancelled(self) -> bool:
        return self._cancelled.is_set()

    def raise_if_cancelled(self) -> None:
        if self.cancelled:
            raise ChatCancelled()

    def set_dify_stopper(self, stop: Optional[Callable[[], None]]) -> None:
        """Difyの停止処理を登録する。すでに中止されていれば、その場で止める"""
        with self._lock:
            self._stop_dify = stop
            call_now = stop is not None and self.cancelled
        if call_now:
            _safe_call(stop)

    def cancel(self) -> None:
        with self._lock:
            self._cancelled.set()
            stop = self._stop_dify
        if stop is not None:
            _safe_call(stop)


def _safe_call(fn: Callable[[], None]) -> None:
    try:
        fn()
    except Exception as e:  # 止められなくても、こちらの受信は打ち切るので致命的ではない
        logger.warning(f"Failed to stop running Dify task: {e}")


_runs: Dict[str, ChatRun] = {}
# /chat より先に届いた中止（run_id -> (user_id, 時刻)）
_early_cancels: Dict[str, Tuple[int, float]] = {}
_lock = threading.Lock()


def _cleanup() -> None:
    cutoff = time.time() - RUN_TTL_SECONDS
    for rid in [rid for rid, run in _runs.items() if run.created_at < cutoff]:
        del _runs[rid]
    for rid in [rid for rid, (_, at) in _early_cancels.items() if at < cutoff]:
        del _early_cancels[rid]


def start_run(run_id: Optional[str], user_id: int) -> ChatRun:
    """runを登録する。run_idが無ければ採番する（中止できないだけで、動作は従来どおり）"""
    rid = run_id or f"srv:{uuid.uuid4()}"
    run = ChatRun(rid, user_id)
    with _lock:
        _cleanup()
        early = _early_cancels.pop(rid, None)
        # 同じrun_idが実行中なら上書きしない（別ユーザーによる乗っ取り・二重送信を防ぐ）
        if rid in _runs:
            run = ChatRun(f"srv:{uuid.uuid4()}", user_id)
            early = None
        _runs[run.run_id] = run
    if early and early[0] == user_id:
        run.cancel()
    return run


def get_run(run_id: Optional[str]) -> Optional[ChatRun]:
    if not run_id:
        return None
    with _lock:
        return _runs.get(run_id)


def finish_run(run: ChatRun) -> None:
    with _lock:
        if _runs.get(run.run_id) is run:
            del _runs[run.run_id]


def cancel_run(run_id: str, user_id: int) -> bool:
    """本人のrunを中止する。実行中のrunが無ければ、あとから届く /chat のために記録だけ残す"""
    with _lock:
        _cleanup()
        run = _runs.get(run_id)
        if run is None:
            _early_cancels[run_id] = (user_id, time.time())
            return False
    if run.user_id != user_id:
        return False
    run.cancel()
    logger.info(f"AI chat run {run_id} cancelled by user {user_id}")
    return True


def check_cancelled(run_id: Optional[str]) -> None:
    """LangGraphのノードの入口で呼ぶ。中止済みなら ChatCancelled"""
    run = get_run(run_id)
    if run is not None:
        run.raise_if_cancelled()
