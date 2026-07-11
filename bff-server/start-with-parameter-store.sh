#!/bin/bash

##############################################################################
# BFF Server 起動スクリプト (Parameter Store対応)
#
# Parameter Storeから設定値を読み取り、環境変数に設定してからBFFサーバーを起動します。
#
# 使い方:
#   USE_PARAMETER_STORE=true ./start-with-parameter-store.sh
#   USE_PARAMETER_STORE=false ./start-with-parameter-store.sh  # .envを使用
##############################################################################

set -e

# Parameter Storeを使用するかどうか
USE_PARAMETER_STORE=${USE_PARAMETER_STORE:-false}
PARAMETER_STORE_PREFIX=${PARAMETER_STORE_PREFIX:-/moodle/prod}
AWS_REGION=${AWS_REGION:-ap-northeast-1}

echo "=========================================="
echo "BFF Server 起動中..."
echo "=========================================="
echo "Parameter Store: $USE_PARAMETER_STORE"
echo "Prefix: $PARAMETER_STORE_PREFIX"
echo "Region: $AWS_REGION"
echo "=========================================="

if [ "$USE_PARAMETER_STORE" = "true" ]; then
    echo "Parameter Storeから設定を読み込み中..."

    # Parameter Storeから全パラメータを一括取得
    params=$(aws ssm get-parameters-by-path \
        --path "$PARAMETER_STORE_PREFIX" \
        --recursive \
        --with-decryption \
        --region "$AWS_REGION" \
        --query 'Parameters[*].[Name,Value]' \
        --output text 2>/dev/null || echo "")

    if [ -z "$params" ]; then
        echo "Warning: Parameter Storeからパラメータを取得できませんでした"
        echo ".envファイルを使用します"
    else
        # パラメータを環境変数に設定
        while IFS=$'\t' read -r name value; do
            # パラメータ名から環境変数名に変換
            # /moodle/prod/secrets/anthropic-api-key → ANTHROPIC_API_KEY
            env_name=$(echo "$name" | sed "s|$PARAMETER_STORE_PREFIX/secrets/||" | sed "s|$PARAMETER_STORE_PREFIX/config/||" | tr '-' '_' | tr '[:lower:]' '[:upper:]')

            # 特定の変換（BFF用）
            case "$env_name" in
                DB_HOST) env_name="MOODLE_DB_HOST" ;;
                DB_PORT) env_name="MOODLE_DB_PORT" ;;
                DB_USER) env_name="MOODLE_DB_USER" ;;
                DB_PASSWORD) env_name="MOODLE_DB_PASSWORD" ;;
                DB_NAME) env_name="MOODLE_DB_NAME" ;;
                ADMIN_USERNAME) env_name="MOODLE_ADMIN_USERNAME" ;;
                ADMIN_PASSWORD) env_name="MOODLE_ADMIN_PASSWORD" ;;
                ADMIN_EMAIL) env_name="MOODLE_ADMIN_EMAIL" ;;
                SITE_NAME) env_name="MOODLE_SITE_NAME" ;;
            esac

            # 環境変数に設定
            export "$env_name=$value"
            echo "✓ $env_name"
        done <<< "$params"

        echo "Parameter Storeからの読み込み完了"
    fi
else
    echo ".envファイルを使用します"
    # 既存の動作（dotenvで.envを読み込み）
    # Node.jsアプリケーション側でdotenvが.envを読み込むので何もしない
fi

echo "=========================================="
echo "BFFサーバーを起動します..."
echo "=========================================="

# Node.jsアプリケーションを起動
exec node index.js
