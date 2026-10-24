#!/usr/bin/env bash
# 本番(cdk-prod)のスタックを cdk で反映するときの唯一の入口。
#
#   ./scripts/deploy-prod.sh diff   <スタック名>   差分を見るだけ(本番は変わらない)
#   ./scripts/deploy-prod.sh deploy <スタック名>   差分を見せてから、確認のうえ反映する
#
# 手で cdk deploy を打つと、次のような事故が起きてきた。このスクリプトはそれを機械的に防ぐ。
#   - /usr/bin/cdk(古い)で動かして cdk-prod のライブラリを読めない → 同梱の node_modules/.bin/cdk を使う
#   - 依存スタック(VPC/ALB/Backend 等)まで一緒に更新される → 常に --exclusively で1スタックだけ
#   - prod-EcsStack の desiredCount 付け忘れ → 常に 2 を渡す
#   - prod-EcsStack の imageTag が古いコミットで、本番が昔の版に戻る → origin/master の最新に固定し、
#     そのイメージが ECR にあることを確かめる
#   - prod-SpaStack の contentTokenSecret 渡し忘れで教材の認証が全件失敗 → Secrets Manager から読んで渡す
#   - prod-GithubActionsStack を既定値(REPLACE_ME)で更新して GitHub Actions の権限が壊れる → 受け付けない
#
# アプリの更新(画面・BFF・api-server・Moodleイメージ)はこれを使わない。master へのマージで
# GitHub Actions(deploy-backend.yml / deploy-frontend.yml)が自動で反映する。
# これを使うのは、インフラ(cdk-prod/lib/*.ts)を変えたときだけ。

set -euo pipefail

PROFILE=PowerUserAccess-840513866884
ACCOUNT=840513866884
REGION=ap-northeast-1

usage() {
  cat <<'EOF'
使い方:
  ./scripts/deploy-prod.sh diff   <スタック名>
  ./scripts/deploy-prod.sh deploy <スタック名> [--yes]

  --yes  確認の入力を省く(端末がない環境で、差分を確認済みのときだけ使う)

扱えるスタック:
  prod-EcsStack prod-AlbStack prod-BackendStack prod-SpaStack prod-CognitoStack
  prod-VpcStack prod-EcrStack prod-RdsStack prod-SlackNotifierStack
  prod-SupportBotStack prod-GuardDutyStack
EOF
  exit 1
}

MODE=${1:-}
STACK=${2:-}
YES=${3:-}
[[ "$MODE" == "diff" || "$MODE" == "deploy" ]] || usage
[[ -n "$STACK" ]] || usage
[[ -z "$YES" || "$YES" == "--yes" ]] || usage

cd "$(dirname "$0")/.."

CDK=./node_modules/.bin/cdk
if [[ ! -x "$CDK" ]]; then
  echo "cdk-prod の依存が入っていないので npm ci を実行します"
  npm ci
fi

# ── ログインと接続先アカウントの確認 ─────────────────────────────
if ! CURRENT=$(aws sts get-caller-identity --profile "$PROFILE" --query Account --output text 2>/dev/null); then
  echo "本番AWSにログインしていません。先に次を実行してください:"
  echo "  aws sso login --profile $PROFILE"
  exit 1
fi
if [[ "$CURRENT" != "$ACCOUNT" ]]; then
  echo "接続先が本番アカウント($ACCOUNT)ではありません: $CURRENT"
  exit 1
fi
export AWS_PROFILE=$PROFILE CDK_DEFAULT_ACCOUNT=$ACCOUNT CDK_DEFAULT_REGION=$REGION

# ── スタックごとのエントリと必須の値 ─────────────────────────────
CONTEXT=()
case "$STACK" in
  prod-EcsStack)
    APP=bin/prod-app.ts
    git fetch -q origin master
    TAG=$(git rev-parse origin/master)
    echo "使うイメージ: origin/master = $(git log -1 --format='%h %ci %s' "$TAG")"
    for c in bff api nginx app; do
      if ! aws ecr describe-images --region "$REGION" --repository-name webcoach-lms \
          --image-ids "imageTag=moodle-$c-$TAG" >/dev/null 2>&1; then
        echo "ECR にイメージ moodle-$c-$TAG がありません。"
        echo "master の GitHub Actions(Deploy Backend and Moodle App)が成功しているか確認してください:"
        echo "  gh run list --branch master --workflow deploy-backend.yml --limit 3"
        exit 1
      fi
    done
    CONTEXT+=(-c desiredCount=2 -c "imageTag=$TAG")
    ;;
  prod-SpaStack)
    APP=bin/prod-app.ts
    SECRET=$(aws secretsmanager get-secret-value --region "$REGION" --secret-id prod/lms/app-secrets \
      --query SecretString --output text | python3 -c 'import json,sys;print(json.load(sys.stdin)["contentTokenSecret"])')
    CONTEXT+=(-c "contentTokenSecret=$SECRET")
    ;;
  prod-AlbStack|prod-BackendStack|prod-CognitoStack|prod-VpcStack|prod-EcrStack)
    APP=bin/prod-app.ts
    ;;
  prod-RdsStack)
    APP=bin/rds-app.ts
    ;;
  prod-SlackNotifierStack)
    APP=bin/slack-notifier-app.ts
    ;;
  prod-SupportBotStack)
    APP=bin/support-bot-app.ts
    # ボットは本番のソース(origin/master)を同梱して読むので最新にしておく
    git fetch -q origin master
    ;;
  prod-GuardDutyStack)
    APP=bin/guardduty-app.ts
    ;;
  prod-GithubActionsStack)
    echo "prod-GithubActionsStack は既定値が REPLACE_ME のままで、このまま反映すると GitHub Actions の"
    echo "デプロイ権限が壊れます。必要になったら bin/prod-app.ts の手順を読み、詳しい人と一緒に行ってください。"
    exit 1
    ;;
  *)
    echo "知らないスタック名です: $STACK"
    usage
    ;;
esac

APP_CMD="npx ts-node --prefer-ts-exts $APP"

echo
echo "===== $STACK の差分(本番と、手元の cdk-prod の違い) ====="
"$CDK" diff "$STACK" --exclusively --app "$APP_CMD" "${CONTEXT[@]}" || true

[[ "$MODE" == "diff" ]] && exit 0

echo
echo "上の差分を確認してください。特に次が出ていたら反映せず、詳しい人に相談してください:"
echo "  - [-] で始まる行(リソースの削除)"
echo "  - [-/+] や 'replace' (作り直し。DB・ロードバランサー・ターゲットグループ・EFS は特に危険)"
echo "    ※ AWS::ECS::TaskDefinition の replace だけは「新しい版の登録」なので問題ありません"
if [[ "$YES" != "--yes" ]]; then
  if [[ ! -t 0 ]]; then
    echo "確認の入力ができない環境です。差分を確認したうえで、末尾に --yes を付けて実行し直してください。"
    exit 1
  fi
  read -r -p "本番の $STACK に反映します。よければスタック名をそのまま入力してください: " ANSWER
  if [[ "$ANSWER" != "$STACK" ]]; then
    echo "入力が一致しないので中止しました(本番は変わっていません)"
    exit 1
  fi
fi

"$CDK" deploy "$STACK" --exclusively --app "$APP_CMD" "${CONTEXT[@]}" --require-approval broadening

if [[ "$STACK" == "prod-EcsStack" ]]; then
  echo
  echo "反映後の台数:"
  aws ecs describe-services --region "$REGION" --cluster prod-lms-cluster --services prod-lms-service \
    --query 'services[0].{desired:desiredCount,running:runningCount,taskDef:taskDefinition}' --output table
fi
