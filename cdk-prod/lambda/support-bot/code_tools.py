"""ボットがソースを調べるための道具(検索・読み取り・一覧)

ソースはデプロイ時に本番のブランチ(既定 origin/master)から取り出して code/ に同梱している。
読むだけで、code/ の外は見られない。
"""
import os
import re

from anthropic import beta_tool

MAX_SEARCH_RESULTS = 60
MAX_READ_LINES = 200
MAX_LIST_FILES = 300
MAX_LINE_CHARS = 300


def code_dir():
    return os.environ.get("CODE_DIR") or os.path.join(os.path.dirname(__file__), "code")


def code_version():
    try:
        with open(os.path.join(code_dir(), "VERSION"), encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return "不明"


def _resolve(path):
    """code/ の中のパスだけを通す(../ などで外へ出させない)"""
    root = os.path.realpath(code_dir())
    full = os.path.realpath(os.path.join(root, (path or "").lstrip("/")))
    if full != root and not full.startswith(root + os.sep):
        raise ValueError(f"対象外のパスです: {path}")
    return root, full


def _walk(prefix):
    root, base = _resolve(prefix)
    if os.path.isfile(base):
        yield os.path.relpath(base, root)
        return
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames.sort()
        for name in sorted(filenames):
            rel = os.path.relpath(os.path.join(dirpath, name), root)
            if rel != "VERSION":
                yield rel


def search_code_impl(pattern, path_prefix=""):
    try:
        regex = re.compile(pattern, re.IGNORECASE)
    except re.error as err:
        return f"正規表現が正しくありません: {err}"
    root = os.path.realpath(code_dir())
    hits = []
    for rel in _walk(path_prefix):
        try:
            with open(os.path.join(root, rel), encoding="utf-8") as f:
                for no, line in enumerate(f, 1):
                    if regex.search(line):
                        hits.append(f"{rel}:{no}: {line.rstrip()[:MAX_LINE_CHARS]}")
                        if len(hits) >= MAX_SEARCH_RESULTS:
                            return "\n".join(hits) + f"\n(上限{MAX_SEARCH_RESULTS}件で打ち切り。path_prefix や語を絞ってください)"
        except (UnicodeDecodeError, OSError):
            continue
    return "\n".join(hits) if hits else "見つかりませんでした。"


def read_file_impl(path, start_line=1, end_line=0):
    root, full = _resolve(path)
    if not os.path.isfile(full):
        return f"ファイルがありません: {path}"
    with open(full, encoding="utf-8", errors="replace") as f:
        lines = f.readlines()
    start = max(1, start_line)
    end = len(lines) if end_line <= 0 else min(end_line, len(lines))
    end = min(end, start + MAX_READ_LINES - 1)
    body = "".join(f"{no}\t{lines[no - 1]}" for no in range(start, end + 1))
    rest = f"\n(全{len(lines)}行のうち{start}〜{end}行目)" if end < len(lines) or start > 1 else ""
    return (body or "(空のファイル)") + rest


def list_files_impl(path_prefix=""):
    files = []
    for rel in _walk(path_prefix):
        files.append(rel)
        if len(files) >= MAX_LIST_FILES:
            return "\n".join(files) + f"\n(上限{MAX_LIST_FILES}件で打ち切り。path_prefix を絞ってください)"
    return "\n".join(files) if files else "ファイルがありません。"


def _safe(fn, *args):
    try:
        return fn(*args)
    except ValueError as err:
        return str(err)


@beta_tool
def search_code(pattern: str, path_prefix: str = "") -> str:
    """WEBCOACHのソースを正規表現で検索し、一致した行を「パス:行番号: 内容」で返す(大文字小文字は区別しない)。
    画面に出る文言・APIのパス・関数名・設定値などから、動きを決めている箇所を探すときに使う。

    Args:
        pattern: 検索する正規表現。例: "仮パスワード", "reminder_sent_at", "/api/admin/"
        path_prefix: 探す範囲のディレクトリまたはファイル。例: "bff-server/", "frontend/src/components/". 空なら全体
    """
    return _safe(search_code_impl, pattern, path_prefix)


@beta_tool
def read_file(path: str, start_line: int = 1, end_line: int = 0) -> str:
    """WEBCOACHのソースファイルを行番号つきで読む。一度に最大200行。必要な範囲だけを読む。

    Args:
        path: ファイルのパス。例: "bff-server/services/ReminderService.js"
        start_line: 読み始める行(1から)
        end_line: 読み終える行。0ならファイルの最後まで(最大200行)
    """
    return _safe(read_file_impl, path, start_line, end_line)


@beta_tool
def list_files(path_prefix: str = "") -> str:
    """WEBCOACHのソースのファイル一覧を返す。どこに何があるか分からないときに使う。

    Args:
        path_prefix: 一覧を出すディレクトリ。例: "api-server/routers/". 空なら全体
    """
    return _safe(list_files_impl, path_prefix)


TOOLS = [search_code, read_file, list_files]
