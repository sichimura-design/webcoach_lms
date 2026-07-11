#!/bin/bash

##############################################################################
# Parameter Store一覧表示スクリプト
#
# このスクリプトはParameter Storeに保存されている全パラメータを表示します。
#
# 使い方:
#   ./scripts/list-parameters.sh
#   ./scripts/list-parameters.sh --with-decryption  # 機密情報も復号化して表示
##############################################################################

set -e

# 色付きログ
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# 環境設定
ENVIRONMENT="prod"
BASE_PREFIX="/moodle/${ENVIRONMENT}"
AWS_REGION="${AWS_REGION:-ap-northeast-1}"
WITH_DECRYPTION=""

# オプション解析
if [[ "$1" == "--with-decryption" ]]; then
    WITH_DECRYPTION="--with-decryption"
    log_info "機密情報も復号化して表示します"
fi

log_info "=========================================="
log_info "Parameter Store 一覧"
log_info "=========================================="
log_info "環境: $ENVIRONMENT"
log_info "リージョン: $AWS_REGION"
log_info "プレフィックス: $BASE_PREFIX"
log_info "=========================================="
log_info ""

# 全パラメータを取得
log_info "パラメータを取得中..."
aws ssm get-parameters-by-path \
    --path "$BASE_PREFIX" \
    --recursive \
    $WITH_DECRYPTION \
    --region "$AWS_REGION" \
    --query 'Parameters[*].[Name,Type,Value,LastModifiedDate]' \
    --output table

log_info ""
log_success "取得完了"
log_info ""
log_info "特定のパラメータを取得するには:"
log_info "  aws ssm get-parameter --name ${BASE_PREFIX}/config/public-ip --region ${AWS_REGION}"
log_info ""
log_info "機密情報を復号化して取得するには:"
log_info "  aws ssm get-parameter --name ${BASE_PREFIX}/secrets/session-secret --with-decryption --region ${AWS_REGION}"
log_info ""
