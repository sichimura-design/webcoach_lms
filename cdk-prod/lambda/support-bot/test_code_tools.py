"""code_tools.py の単体テスト(一時フォルダに作ったソースで確かめる)

実行: cd cdk-prod/lambda/support-bot && python3 -m pytest test_code_tools.py
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(__file__))

import code_tools  # noqa: E402


@pytest.fixture(autouse=True)
def code(tmp_path, monkeypatch):
    (tmp_path / "bff-server" / "routes").mkdir(parents=True)
    (tmp_path / "bff-server" / "routes" / "auth.js").write_text(
        "const a = 1;\nsetError('仮パスワードの有効期限が切れています');\n// end\n", encoding="utf-8")
    (tmp_path / "api-server").mkdir()
    (tmp_path / "api-server" / "crud.py").write_text("def get_pending_coaching_reminders():\n    pass\n", encoding="utf-8")
    (tmp_path / "VERSION").write_text("origin/master abc1234\n", encoding="utf-8")
    (tmp_path.parent / "secret.txt").write_text("外のファイル", encoding="utf-8")
    monkeypatch.setenv("CODE_DIR", str(tmp_path))
    return tmp_path


def test_検索は大文字小文字を区別せず_パスと行番号を返す():
    assert code_tools.search_code_impl("仮パスワード") == "bff-server/routes/auth.js:2: setError('仮パスワードの有効期限が切れています');"
    assert code_tools.search_code_impl("GET_PENDING", "api-server/").startswith("api-server/crud.py:1:")
    assert code_tools.search_code_impl("仮パスワード", "api-server/") == "見つかりませんでした。"


def test_検索の正規表現が壊れていたら理由を返す():
    assert "正規表現が正しくありません" in code_tools.search_code_impl("(")


def test_ファイルを行番号つきで読む_範囲指定もできる():
    assert code_tools.read_file_impl("bff-server/routes/auth.js").startswith("1\tconst a = 1;\n2\t")
    assert code_tools.read_file_impl("bff-server/routes/auth.js", 2, 2) == (
        "2\tsetError('仮パスワードの有効期限が切れています');\n\n(全3行のうち2〜2行目)")
    assert "ファイルがありません" in code_tools.read_file_impl("nothing.js")


def test_一覧はVERSIONを含めない():
    assert code_tools.list_files_impl() == "api-server/crud.py\nbff-server/routes/auth.js"
    assert code_tools.code_version() == "origin/master abc1234"


def test_ソースの外は読めない():
    for fn, args in [(code_tools.read_file_impl, ("../secret.txt",)), (code_tools.list_files_impl, ("../",)),
                     (code_tools.search_code_impl, ("外", "../"))]:
        with pytest.raises(ValueError):
            fn(*args)
    # 道具として呼ばれたときは例外にせず、理由を文字列で返す
    assert "対象外のパス" in code_tools._safe(code_tools.read_file_impl, "/../secret.txt")


def test_道具の定義が作られている():
    names = [t.name for t in code_tools.TOOLS]
    assert names == ["search_code", "read_file", "list_files"]
    schema = code_tools.TOOLS[0].to_dict()["input_schema"]
    assert schema["required"] == ["pattern"]
