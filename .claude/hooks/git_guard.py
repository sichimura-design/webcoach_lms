#!/usr/bin/env python3
"""Claude Code PreToolUse(Bash) hook: 危険な git 操作を実行前に止める。

1. master への push は確認を求める(ask)。force push は拒否(deny)。
2. 秘密鍵・認証情報ファイル(*.pem, *.ppk, *.key, .env 等)のコミットを拒否(deny)。
"""
import fnmatch
import json
import os
import re
import shlex
import subprocess
import sys

SECRET_PATTERNS = ["*.pem", "*.ppk", "*.key", "*.p12", "*.pfx", "id_rsa*", "id_ed25519*", ".env", ".env.*"]
SECRET_ALLOW = [".env.example", ".env.sample", ".env.template"]


def decide(decision, reason):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": decision,
            "permissionDecisionReason": reason,
        }
    }, ensure_ascii=False))
    sys.exit(0)


def is_secret(path):
    name = os.path.basename(path.rstrip("/"))
    if name in SECRET_ALLOW:
        return False
    return any(fnmatch.fnmatch(name, p) for p in SECRET_PATTERNS)


def git(cwd, *args):
    try:
        r = subprocess.run(["git", "-C", cwd, *args], capture_output=True, text=True, timeout=10)
        return r.stdout if r.returncode == 0 else ""
    except Exception:
        return ""


def split_commands(command):
    """&&, ||, ;, | で区切られた各コマンドを (作業ディレクトリ, トークン列) で返す。cd は追跡する。"""
    parts = re.split(r"&&|\|\||;|\||\n", command)
    return [p.strip() for p in parts if p.strip()]


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return
    command = (data.get("tool_input") or {}).get("command") or ""
    if "git" not in command:
        return
    cwd = data.get("cwd") or os.getcwd()

    for part in split_commands(command):
        try:
            tokens = shlex.split(part)
        except ValueError:
            tokens = part.split()
        # 先頭の環境変数代入(VAR=... git push)と timeout を読み飛ばす
        while tokens and (re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", tokens[0]) or tokens[0] in ("timeout", "env")):
            tokens = tokens[1:]
            if tokens and re.match(r"^\d+[smh]?$", tokens[0]):
                tokens = tokens[1:]
        if not tokens:
            continue
        if tokens[0] == "cd" and len(tokens) > 1:
            cwd = os.path.join(cwd, os.path.expanduser(tokens[1]))
            continue
        if tokens[0] != "git":
            continue
        args = tokens[1:]
        git_cwd = cwd
        while len(args) >= 2 and args[0] == "-C":
            git_cwd = os.path.join(git_cwd, args[1])
            args = args[2:]
        if not args:
            continue
        sub, rest = args[0], args[1:]

        if sub == "push":
            if any(a in ("-f", "--force") or a.startswith("--force") for a in rest) or \
                    any(a.startswith("+") for a in rest if not a.startswith("-")):
                decide("deny", "force push はフックで禁止されています。必要ならユーザーが手動で実行してください。")
            refs = [a for a in rest if not a.startswith("-")]
            targets_master = any(re.search(r"(^|:)(refs/heads/)?master$", r) for r in refs[1:])
            if len(refs) <= 1:
                branch = git(git_cwd, "rev-parse", "--abbrev-ref", "HEAD").strip()
                targets_master = branch == "master"
            if targets_master:
                decide("ask", "master ブランチへの push です。開発は dev/kanegae で行うルールです。本当に master へ push しますか?")

        elif sub == "add":
            paths = [a for a in rest if not a.startswith("-")]
            bulk = any(a in ("-A", "--all", "-u", "--update") for a in rest) or any(p in (".", "*", ":/") for p in paths)
            candidates = list(paths)
            if bulk or any(os.path.isdir(os.path.join(git_cwd, p)) for p in paths):
                out = git(git_cwd, "status", "--porcelain", "-uall")
                candidates += [line[3:].strip('"').split(" -> ")[-1] for line in out.splitlines()]
            bad = sorted({c for c in candidates if is_secret(c)})
            if bad:
                decide("deny", "秘密鍵・認証情報ファイルがステージされようとしています: " + ", ".join(bad)
                       + "。対象ファイルを明示して git add するか、.gitignore に追加してください。")

        elif sub == "commit":
            staged = git(git_cwd, "diff", "--cached", "--name-only", "--diff-filter=AM").splitlines()
            if any(a == "--all" or (re.match(r"^-[a-zA-Z]+$", a) and "a" in a) for a in rest):
                staged += git(git_cwd, "diff", "--name-only", "--diff-filter=AM").splitlines()
            bad = sorted({s for s in staged if is_secret(s)})
            if bad:
                decide("deny", "秘密鍵・認証情報ファイルがコミットに含まれています: " + ", ".join(bad)
                       + "。git restore --staged <file> で外してください。")


if __name__ == "__main__":
    main()
