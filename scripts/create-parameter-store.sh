#!/bin/bash

##############################################################################
# Parameter Store作成スクリプト（CDK不要版）
#
# AWS CLIを使用して直接Parameter Storeにパラメータを作成します。
# CDKが不要なので、シンプルで確実です。
#
# 使い方:
#   1. このスクリプトを実行: ./scripts/create-parameter-store.sh
#   2. 実際の値を投入: ./scripts/populate-parameters-from-env.sh
##############################################################################

set -e

# 色付きログ
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 環境設定
ENVIRONMENT="prod"  # dev, staging, prod など
BASE_PREFIX="/moodle/${ENVIRONMENT}"
AWS_REGION="${AWS_REGION:-ap-northeast-1}"

log_info "=========================================="
log_info "Parameter Store 作成スクリプト"
log_info "=========================================="
log_info "環境: $ENVIRONMENT"
log_info "リージョン: $AWS_REGION"
log_info "プレフィックス: $BASE_PREFIX"
log_info "=========================================="

# Parameter Storeに値を作成する関数
create_parameter() {
    local param_name=$1
    local param_value=$2
    local param_type=$3  # String または SecureString
    local description=$4

    log_info "作成中: $param_name"

    # 既存のパラメータをチェック
    if aws ssm get-parameter \
        --name "$param_name" \
        --region "$AWS_REGION" \
        --no-cli-pager \
        > /dev/null 2>&1; then
        log_warning "スキップ: $param_name (既に存在します)"
        return
    fi

    local result
    result=$(aws ssm put-parameter \
        --name "$param_name" \
        --value "$param_value" \
        --type "$param_type" \
        --description "$description" \
        --region "$AWS_REGION" \
        --no-cli-pager 2>&1)

    if [ $? -eq 0 ]; then
        log_success "✓ $param_name"

        # タグを追加（失敗しても続行）
        aws ssm add-tags-to-resource \
            --resource-type "Parameter" \
            --resource-id "$param_name" \
            --tags "Key=Environment,Value=${ENVIRONMENT}" "Key=ManagedBy,Value=Script" "Key=Project,Value=Moodle" \
            --region "$AWS_REGION" \
            --no-cli-pager > /dev/null 2>&1 || true
    else
        log_error "✗ $param_name の作成に失敗しました: $result"
    fi
}

log_info ""
log_info "=========================================="
log_info "機密情報（SecureString）の作成"
log_info "=========================================="

# 機密情報の作成（プレースホルダー値）
create_parameter \
    "${BASE_PREFIX}/secrets/session-secret" \
    "CHANGE_ME_GENERATE_RANDOM_SECRET" \
    "SecureString" \
    "Session secret for BFF server authentication"

create_parameter \
    "${BASE_PREFIX}/secrets/anthropic-api-key" \
    "sk-ant-api03-XXXXXXXXXXXXXXXX" \
    "SecureString" \
    "Anthropic API key for Claude AI"

create_parameter \
    "${BASE_PREFIX}/secrets/content-token-secret" \
    "CHANGE_ME_GENERATE_RANDOM_SECRET" \
    "SecureString" \
    "Secret for content token generation"

create_parameter \
    "${BASE_PREFIX}/secrets/internal-api-key" \
    "CHANGE_ME_GENERATE_RANDOM_SECRET" \
    "SecureString" \
    "Internal API key for service-to-service authentication"

create_parameter \
    "${BASE_PREFIX}/secrets/moodle-service-password" \
    "CHANGE_ME_STRONG_PASSWORD" \
    "SecureString" \
    "Moodle service account password"

create_parameter \
    "${BASE_PREFIX}/secrets/moodle-admin-password" \
    "CHANGE_ME_STRONG_ADMIN_PASSWORD" \
    "SecureString" \
    "Moodle admin account password"

create_parameter \
    "${BASE_PREFIX}/secrets/db-password" \
    "CHANGE_ME_STRONG_RDS_PASSWORD" \
    "SecureString" \
    "Database password"

log_info ""
log_info "=========================================="
log_info "設定値（String）の作成"
log_info "=========================================="

# 設定値の作成（デフォルト値）
create_parameter \
    "${BASE_PREFIX}/config/public-ip" \
    "localhost" \
    "String" \
    "EC2 Public IP Address or Domain"

create_parameter \
    "${BASE_PREFIX}/config/moodle-url" \
    "http://moodle-app:8080" \
    "String" \
    "Moodle URL (Docker network internal)"

create_parameter \
    "${BASE_PREFIX}/config/api-server-url" \
    "http://api-server:8001" \
    "String" \
    "API Server URL (Docker network internal)"

create_parameter \
    "${BASE_PREFIX}/config/node-env" \
    "production" \
    "String" \
    "Node environment"

create_parameter \
    "${BASE_PREFIX}/config/allowed-origins" \
    "http://localhost:3000,https://your-domain.com" \
    "String" \
    "Allowed CORS Origins (comma-separated)"

create_parameter \
    "${BASE_PREFIX}/config/moodle-lang" \
    "ja" \
    "String" \
    "Moodle Language Configuration"

create_parameter \
    "${BASE_PREFIX}/config/moodle-service-username" \
    "admin" \
    "String" \
    "Moodle Service Account Username"

create_parameter \
    "${BASE_PREFIX}/config/moodle-service-name" \
    "moodle-api-service" \
    "String" \
    "Moodle Service Name"

create_parameter \
    "${BASE_PREFIX}/config/cognito-user-pool-id" \
    "ap-northeast-1_XXXXXXXXX" \
    "String" \
    "Cognito User Pool ID"

create_parameter \
    "${BASE_PREFIX}/config/cognito-client-id" \
    "XXXXXXXXXXXXXXXXXXXXXXXXXX" \
    "String" \
    "Cognito Client ID"

create_parameter \
    "${BASE_PREFIX}/config/cognito-region" \
    "ap-northeast-1" \
    "String" \
    "AWS Cognito Region"

create_parameter \
    "${BASE_PREFIX}/config/s3-bucket-name" \
    "your-bucket-name" \
    "String" \
    "S3 Bucket Name for file uploads"

create_parameter \
    "${BASE_PREFIX}/config/cloudfront-domain" \
    "your-cloudfront-domain.cloudfront.net" \
    "String" \
    "CloudFront Domain for serving uploaded files"

create_parameter \
    "${BASE_PREFIX}/config/vector-db-env" \
    "faiss" \
    "String" \
    "Vector Database Type"

create_parameter \
    "${BASE_PREFIX}/config/faiss-cache-dir" \
    "/tmp/faiss_cache" \
    "String" \
    "FAISS Cache Directory"

create_parameter \
    "${BASE_PREFIX}/config/aws-region" \
    "ap-northeast-1" \
    "String" \
    "AWS Region"

create_parameter \
    "${BASE_PREFIX}/config/db-host" \
    "your-rds-endpoint.rds.amazonaws.com" \
    "String" \
    "Database Host"

create_parameter \
    "${BASE_PREFIX}/config/db-port" \
    "3306" \
    "String" \
    "Database Port"

create_parameter \
    "${BASE_PREFIX}/config/db-user" \
    "moodleuser" \
    "String" \
    "Database User"

create_parameter \
    "${BASE_PREFIX}/config/db-name" \
    "moodle" \
    "String" \
    "Database Name"

create_parameter \
    "${BASE_PREFIX}/config/admin-username" \
    "admin" \
    "String" \
    "Moodle Admin Username"

create_parameter \
    "${BASE_PREFIX}/config/admin-email" \
    "admin@example.com" \
    "String" \
    "Moodle Admin Email"

create_parameter \
    "${BASE_PREFIX}/config/site-name" \
    "My Moodle Site" \
    "String" \
    "Moodle Site Name"

log_info ""
log_info "=========================================="
log_success "作成完了"
log_info "=========================================="
log_info ""
log_info "次のステップ:"
log_info "  1. .envファイルを作成・編集してください"
log_info "     cp .env.example .env"
log_info "     vim .env"
log_info ""
log_info "  2. 実際の値を投入してください"
log_info "     ./scripts/populate-parameters-from-env.sh"
log_info ""
log_info "確認コマンド:"
log_info "  aws ssm get-parameters-by-path --path ${BASE_PREFIX} --recursive --region ${AWS_REGION}"
log_info ""
