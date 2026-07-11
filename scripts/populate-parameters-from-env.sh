#!/bin/bash

##############################################################################
# Parameter Store投入スクリプト
#
# このスクリプトは.envファイルから値を読み取り、
# AWS Systems Manager Parameter Storeに投入します。
#
# 使い方:
#   1. CDKスタックをデプロイ: cd cdk-example && cdk deploy MoodleParameterStoreStack
#   2. このスクリプトを実行: ./scripts/populate-parameters.sh
#
# 注意:
#   - .envファイルがルートディレクトリに存在する必要があります
#   - AWS CLIが設定されている必要があります
#   - 適切なIAM権限が必要です（ssm:PutParameter）
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

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

# 環境設定
ENVIRONMENT="prod"  # dev, staging, prod など
BASE_PREFIX="/moodle/${ENVIRONMENT}"
AWS_REGION="${AWS_REGION:-ap-northeast-1}"

log_info "=========================================="
log_info "Parameter Store 投入スクリプト"
log_info "=========================================="
log_info "環境: $ENVIRONMENT"
log_info "リージョン: $AWS_REGION"
log_info "プレフィックス: $BASE_PREFIX"
log_info ".envファイル: $ENV_FILE"
log_info "=========================================="

# .envファイルの存在確認
if [ ! -f "$ENV_FILE" ]; then
    log_error ".envファイルが見つかりません: $ENV_FILE"
    log_info ".env.exampleから.envを作成してください"
    exit 1
fi

# .envファイルを読み込む関数
get_env_value() {
    local key=$1
    local value=$(grep "^${key}=" "$ENV_FILE" | cut -d '=' -f2- | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/")
    echo "$value"
}

# Parameter Storeに値を投入する関数
put_parameter() {
    local param_name=$1
    local param_value=$2
    local param_type=$3  # String または SecureString
    local description=$4

    if [ -z "$param_value" ] || [ "$param_value" = "CHANGE_ME_GENERATE_RANDOM_SECRET" ] || [[ "$param_value" == *"XXXXXXXXX"* ]] || [[ "$param_value" == *"your-"* ]]; then
        log_warning "スキップ: $param_name (値が未設定またはプレースホルダー)"
        return
    fi

    log_info "投入中: $param_name"

    if aws ssm put-parameter \
        --name "$param_name" \
        --value "$param_value" \
        --type "$param_type" \
        --description "$description" \
        --overwrite \
        --region "$AWS_REGION" \
        --no-cli-pager \
        > /dev/null 2>&1; then
        log_success "✓ $param_name"
    else
        log_error "✗ $param_name の投入に失敗しました"
    fi
}

log_info ""
log_info "=========================================="
log_info "機密情報（SecureString）の投入"
log_info "=========================================="

# 機密情報の投入
put_parameter \
    "${BASE_PREFIX}/secrets/session-secret" \
    "$(get_env_value 'SESSION_SECRET')" \
    "SecureString" \
    "Session secret for BFF server authentication"

put_parameter \
    "${BASE_PREFIX}/secrets/anthropic-api-key" \
    "$(get_env_value 'ANTHROPIC_API_KEY')" \
    "SecureString" \
    "Anthropic API key for Claude AI"

put_parameter \
    "${BASE_PREFIX}/secrets/content-token-secret" \
    "$(get_env_value 'CONTENT_TOKEN_SECRET')" \
    "SecureString" \
    "Secret for content token generation"

put_parameter \
    "${BASE_PREFIX}/secrets/internal-api-key" \
    "$(get_env_value 'INTERNAL_API_KEY')" \
    "SecureString" \
    "Internal API key for service-to-service authentication"

put_parameter \
    "${BASE_PREFIX}/secrets/moodle-service-password" \
    "$(get_env_value 'MOODLE_SERVICE_PASSWORD')" \
    "SecureString" \
    "Moodle service account password"

put_parameter \
    "${BASE_PREFIX}/secrets/moodle-admin-password" \
    "$(get_env_value 'MOODLE_ADMIN_PASSWORD')" \
    "SecureString" \
    "Moodle admin account password"

put_parameter \
    "${BASE_PREFIX}/secrets/db-password" \
    "$(get_env_value 'MOODLE_DB_PASSWORD')" \
    "SecureString" \
    "Database password"

log_info ""
log_info "=========================================="
log_info "設定値（String）の投入"
log_info "=========================================="

# 設定値の投入
put_parameter \
    "${BASE_PREFIX}/config/public-ip" \
    "$(get_env_value 'PUBLIC_IP')" \
    "String" \
    "EC2 Public IP Address or Domain"

put_parameter \
    "${BASE_PREFIX}/config/moodle-url" \
    "$(get_env_value 'MOODLE_URL')" \
    "String" \
    "Moodle URL (Docker network internal)"

put_parameter \
    "${BASE_PREFIX}/config/api-server-url" \
    "$(get_env_value 'API_SERVER_URL')" \
    "String" \
    "API Server URL (Docker network internal)"

put_parameter \
    "${BASE_PREFIX}/config/node-env" \
    "$(get_env_value 'NODE_ENV')" \
    "String" \
    "Node environment"

put_parameter \
    "${BASE_PREFIX}/config/allowed-origins" \
    "$(get_env_value 'ALLOWED_ORIGINS')" \
    "String" \
    "Allowed CORS Origins (comma-separated)"

put_parameter \
    "${BASE_PREFIX}/config/moodle-lang" \
    "$(get_env_value 'MOODLE_LANG')" \
    "String" \
    "Moodle Language Configuration"

put_parameter \
    "${BASE_PREFIX}/config/moodle-service-username" \
    "$(get_env_value 'MOODLE_SERVICE_USERNAME')" \
    "String" \
    "Moodle Service Account Username"

put_parameter \
    "${BASE_PREFIX}/config/moodle-service-name" \
    "$(get_env_value 'MOODLE_SERVICE_NAME')" \
    "String" \
    "Moodle Service Name"

put_parameter \
    "${BASE_PREFIX}/config/cognito-user-pool-id" \
    "$(get_env_value 'COGNITO_USER_POOL_ID')" \
    "String" \
    "Cognito User Pool ID"

put_parameter \
    "${BASE_PREFIX}/config/cognito-client-id" \
    "$(get_env_value 'COGNITO_CLIENT_ID')" \
    "String" \
    "Cognito Client ID"

put_parameter \
    "${BASE_PREFIX}/config/cognito-region" \
    "$(get_env_value 'COGNITO_REGION')" \
    "String" \
    "AWS Cognito Region"

put_parameter \
    "${BASE_PREFIX}/config/s3-bucket-name" \
    "$(get_env_value 'S3_BUCKET_NAME')" \
    "String" \
    "S3 Bucket Name for file uploads"

put_parameter \
    "${BASE_PREFIX}/config/cloudfront-domain" \
    "$(get_env_value 'CLOUDFRONT_DOMAIN')" \
    "String" \
    "CloudFront Domain for serving uploaded files"

put_parameter \
    "${BASE_PREFIX}/config/vector-db-env" \
    "$(get_env_value 'VECTOR_DB_ENV')" \
    "String" \
    "Vector Database Type"

put_parameter \
    "${BASE_PREFIX}/config/faiss-cache-dir" \
    "$(get_env_value 'FAISS_CACHE_DIR')" \
    "String" \
    "FAISS Cache Directory"

put_parameter \
    "${BASE_PREFIX}/config/aws-region" \
    "$(get_env_value 'AWS_REGION')" \
    "String" \
    "AWS Region"

put_parameter \
    "${BASE_PREFIX}/config/db-host" \
    "$(get_env_value 'MOODLE_DB_HOST')" \
    "String" \
    "Database Host"

put_parameter \
    "${BASE_PREFIX}/config/db-port" \
    "$(get_env_value 'MOODLE_DB_PORT')" \
    "String" \
    "Database Port"

put_parameter \
    "${BASE_PREFIX}/config/db-user" \
    "$(get_env_value 'MOODLE_DB_USER')" \
    "String" \
    "Database User"

put_parameter \
    "${BASE_PREFIX}/config/db-name" \
    "$(get_env_value 'MOODLE_DB_NAME')" \
    "String" \
    "Database Name"

put_parameter \
    "${BASE_PREFIX}/config/admin-username" \
    "$(get_env_value 'MOODLE_ADMIN_USERNAME')" \
    "String" \
    "Moodle Admin Username"

put_parameter \
    "${BASE_PREFIX}/config/admin-email" \
    "$(get_env_value 'MOODLE_ADMIN_EMAIL')" \
    "String" \
    "Moodle Admin Email"

put_parameter \
    "${BASE_PREFIX}/config/site-name" \
    "$(get_env_value 'MOODLE_SITE_NAME')" \
    "String" \
    "Moodle Site Name"

log_info ""
log_info "=========================================="
log_success "投入完了"
log_info "=========================================="
log_info ""
log_info "確認コマンド:"
log_info "  # 全パラメータ一覧"
log_info "  aws ssm get-parameters-by-path --path ${BASE_PREFIX} --recursive --region ${AWS_REGION}"
log_info ""
log_info "  # 機密情報（復号化して表示）"
log_info "  aws ssm get-parameter --name ${BASE_PREFIX}/secrets/session-secret --with-decryption --region ${AWS_REGION}"
log_info ""
log_info "  # 設定値"
log_info "  aws ssm get-parameter --name ${BASE_PREFIX}/config/public-ip --region ${AWS_REGION}"
log_info ""
