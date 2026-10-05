"""
Claudeのチャットモデル(ChatAnthropic)の作り方と、応答本文の取り出し方を1か所にまとめる。

Claude Sonnet 5.5 で変わった点:
- temperature/top_p/top_k に既定以外の値を渡すと400になる → 渡さない
- thinking: {"type": "disabled"} は400。思考なしにするには {"type": "between_tools"}
  (Sonnet 5.5専用で、他のモデルに送ると400。effortは"high"以下のみ)
- 応答の先頭に thinking ブロックが付くことがある → 本文は message_text() で text ブロックだけ取る。
  ツール呼び出しの往復では thinking ブロックを変えずに送り返す必要があり、
  langchain-anthropic(0.3.22以降)がそのまま送り返す
- tool_choice で特定のツールを強制({"type": "tool"} / {"type": "any"})すると400
"""
import logging
import os

from langchain_anthropic import ChatAnthropic

import runtime_settings

logger = logging.getLogger(__name__)


def _model_options(model_name: str, effort: str) -> dict:
    """モデルごとに付ける設定。ここに無いモデル(Haiku 4.5等)は何も付けない"""
    if model_name.startswith("claude-sonnet-5-5"):
        # 以前のHaiku 4.5と同じく考えずにすぐ答えさせる(応答の速さと、max_tokensを
        # 思考に食われないため)。effortはチャット・要約向けの推奨に合わせて"low"から
        return {
            "thinking": {"type": "between_tools"},
            "model_kwargs": {"output_config": {"effort": effort}},
        }
    return {}


def create_chat_model(max_tokens: int, effort: str = "low") -> ChatAnthropic:
    """ANTHROPIC_MODELのモデルでChatAnthropicを作る。APIキーが無ければValueError"""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not set")
    model_name = runtime_settings.get_str("ANTHROPIC_MODEL")
    llm = ChatAnthropic(
        model=model_name,
        anthropic_api_key=api_key,
        max_tokens=max_tokens,
        **_model_options(model_name, effort),
    )
    logger.info(f"Claude LLM initialized with model: {model_name}")
    return llm


def message_text(content) -> str:
    """メッセージのcontentからtextブロックだけをつなげて返す。
    contentは文字列のほか、thinkingやtool_use、画像を含むブロックのlistのことがある"""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
            elif isinstance(block, str):
                parts.append(block)
        return "".join(parts)
    return ""


def log_if_refused(response, where: str) -> None:
    """安全上の理由で断られた応答(stop_reason=refusal、本文は空)をログに残す"""
    metadata = getattr(response, "response_metadata", None) or {}
    if metadata.get("stop_reason") == "refusal":
        logger.warning(f"[{where}] Claude declined the request (stop_reason=refusal): {metadata.get('stop_details')}")
