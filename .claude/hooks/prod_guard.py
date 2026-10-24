#!/usr/bin/env python3
"""Claude Code PreToolUse(Bash) hook: 本番AWSを変える操作を実行前に止める。

1. cdk-prod の cdk deploy / destroy を直接打つのは拒否(deny)。scripts/deploy-prod.sh を使わせる。
2. scripts/deploy-prod.sh deploy(本番への反映)は確認を求める(ask)。diff はそのまま通す。
3. 本番アカウント(840513866884)に対する aws コマンドのうち、読み取り以外は確認を求める(ask)。
"""
import json
import os
import re
import shlex
import sys

PROD_ACCOUNT = "840513866884"
# aws <service> <operation> の operation がこれで始まれば読み取りとみなす
READ_PREFIXES = ("describe", "get", "list", "lookup", "filter", "head", "search", "query",
                 "tail", "start-query", "stop-query", "wait", "help", "ls", "presign")
READ_SERVICES = ("sts", "sso", "configure")


def decide(decision, reason):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": decision,
            "permissionDecisionReason": reason,
        }
    }, ensure_ascii=False))
    sys.exit(0)


def split_commands(command):
    parts = re.split(r"&&|\|\||;|\||\n", command)
    return [p.strip() for p in parts if p.strip()]


def strip_prefix(tokens):
    """先頭の環境変数代入(VAR=...)・env・timeout・sudo を読み飛ばす"""
    while tokens and (re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", tokens[0]) or tokens[0] in ("timeout", "env", "sudo")):
        tokens = tokens[1:]
        if tokens and re.match(r"^\d+[smh]?$", tokens[0]):
            tokens = tokens[1:]
    return tokens


def aws_operation(tokens):
    """aws [--opt val ...] <service> <operation> から (service, operation) を返す"""
    args = [t for t in tokens[1:]]
    words = []
    skip = False
    for a in args:
        if skip:
            skip = False
            continue
        if a.startswith("--"):
            # --profile x / --region x のように値を取るもの。--no-xxx 等の値なしは次を飛ばさない
            skip = "=" not in a and not a.startswith("--no-") and a not in ("--debug", "--dry-run")
            continue
        words.append(a)
        if len(words) == 2:
            break
    service = words[0] if words else ""
    op = words[1] if len(words) > 1 else ""
    return service, op


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return
    command = (data.get("tool_input") or {}).get("command") or ""
    cwd = data.get("cwd") or os.getcwd()
    whole_is_prod = PROD_ACCOUNT in command or os.environ.get("AWS_PROFILE", "").endswith(PROD_ACCOUNT)

    for part in split_commands(command):
        try:
            tokens = shlex.split(part)
        except ValueError:
            tokens = part.split()
        tokens = strip_prefix(tokens)
        if not tokens:
            continue
        if tokens[0] == "cd" and len(tokens) > 1:
            cwd = os.path.join(cwd, os.path.expanduser(tokens[1]))
            continue

        prog = os.path.basename(tokens[0])

        if prog == "deploy-prod.sh" or (prog in ("bash", "sh") and len(tokens) > 1
                                        and os.path.basename(tokens[1]) == "deploy-prod.sh"):
            rest = tokens[1:] if prog == "deploy-prod.sh" else tokens[2:]
            if rest and rest[0] == "deploy":
                decide("ask", "本番への反映(" + " ".join(rest[1:2]) + ")です。差分を確認したうえで進めますか?")
            continue

        if prog == "npm" and "cdk-prod" in cwd and len(tokens) >= 3 and tokens[1] == "run" and tokens[2] == "deploy":
            decide("ask", "本番への反映(npm run deploy)です。差分を確認したうえで進めますか?")

        in_prod_cdk = "cdk-prod" in cwd or "cdk-prod" in part or whole_is_prod
        if (prog == "cdk" or (prog == "npx" and len(tokens) > 1 and tokens[1] == "cdk")) and in_prod_cdk:
            if any(t in ("deploy", "destroy", "import") for t in tokens[1:]):
                decide("deny", "本番の cdk deploy/destroy は直接実行できません。"
                       "cdk-prod/scripts/deploy-prod.sh diff|deploy <スタック名> を使ってください。")

        if prog == "aws" and (whole_is_prod or PROD_ACCOUNT in part):
            service, op = aws_operation(tokens)
            if service in READ_SERVICES:
                continue
            if service == "s3" and op in ("ls", "presign"):
                continue
            if op.startswith(READ_PREFIXES):
                continue
            decide("ask", f"本番AWSを変更する操作です(aws {service} {op})。本当に実行しますか?")


if __name__ == "__main__":
    main()
