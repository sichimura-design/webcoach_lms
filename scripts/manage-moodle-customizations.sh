#!/bin/bash
# ========================================
# Moodle カスタマイズ管理ツール
# ========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CUSTOMIZATIONS_DIR="${PROJECT_ROOT}/moodle/customizations"
CONTAINER_NAME="${CONTAINER_NAME:-moodle-app}"

# 色付きログ出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ========================================
# 1. カスタマイズファイルの抽出（コンテナ → ホスト）
# ========================================
extract_customizations() {
    log_info "Extracting customizations from container..."

    # OAuth2カスタマイズ
    if docker exec "$CONTAINER_NAME" test -d /opt/bitnami/moodle/auth/oauth2 2>/dev/null; then
        log_info "Extracting OAuth2 customizations..."
        docker cp "${CONTAINER_NAME}:/opt/bitnami/moodle/auth/oauth2/" \
                  "${CUSTOMIZATIONS_DIR}/auth/" || log_warn "Failed to extract OAuth2"
    fi

    # config.php
    if docker exec "$CONTAINER_NAME" test -f /opt/bitnami/moodle/config.php 2>/dev/null; then
        log_info "Extracting config.php..."
        docker cp "${CONTAINER_NAME}:/opt/bitnami/moodle/config.php" \
                  "${CUSTOMIZATIONS_DIR}/config.php.backup" || log_warn "Failed to extract config.php"
    fi

    # カスタムプラグイン
    if docker exec "$CONTAINER_NAME" test -d /opt/bitnami/moodle/local 2>/dev/null; then
        log_info "Extracting custom plugins..."
        docker cp "${CONTAINER_NAME}:/opt/bitnami/moodle/local/" \
                  "${CUSTOMIZATIONS_DIR}/" || log_warn "Failed to extract plugins"
    fi

    log_info "Extraction completed! Files saved to: ${CUSTOMIZATIONS_DIR}"
}

# ========================================
# 2. カスタマイズファイルの適用（ホスト → コンテナ）
# ========================================
apply_customizations() {
    log_info "Applying customizations to container..."

    # OAuth2カスタマイズ
    if [ -d "${CUSTOMIZATIONS_DIR}/auth/oauth2" ]; then
        log_info "Applying OAuth2 customizations..."
        docker cp "${CUSTOMIZATIONS_DIR}/auth/oauth2/" \
                  "${CONTAINER_NAME}:/opt/bitnami/moodle/auth/" || log_error "Failed to apply OAuth2"
    fi

    # カスタムプラグイン
    if [ -d "${CUSTOMIZATIONS_DIR}/local" ]; then
        log_info "Applying custom plugins..."
        docker cp "${CUSTOMIZATIONS_DIR}/local/" \
                  "${CONTAINER_NAME}:/opt/bitnami/moodle/" || log_error "Failed to apply plugins"
    fi

    # パーミッション修正
    log_info "Fixing permissions..."
    docker exec "$CONTAINER_NAME" chown -R daemon:daemon /opt/bitnami/moodle || log_warn "Permission fix failed"

    # カスタマイズスクリプトの実行
    if docker exec "$CONTAINER_NAME" test -f /opt/bitnami/scripts/apply-customizations.sh 2>/dev/null; then
        log_info "Running customization script..."
        docker exec "$CONTAINER_NAME" /opt/bitnami/scripts/apply-customizations.sh || log_warn "Script execution completed with warnings"
    fi

    log_info "Customizations applied successfully!"
}

# ========================================
# 3. カスタムイメージのビルド
# ========================================
build_custom_image() {
    local tag="${1:-latest}"

    log_info "Building custom Moodle image with tag: $tag"

    cd "$PROJECT_ROOT"

    docker build \
        -t "moodle-custom:${tag}" \
        -f moodle/Dockerfile \
        moodle/

    log_info "Image built successfully: moodle-custom:${tag}"
}

# ========================================
# 4. ECRへのプッシュ
# ========================================
push_to_ecr() {
    local tag="${1:-latest}"
    local ecr_repo="${2}"

    if [ -z "$ecr_repo" ]; then
        log_error "ECR repository URI required"
        log_info "Usage: $0 push-ecr <tag> <ecr-repo-uri>"
        log_info "Example: $0 push-ecr latest 123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/moodle-app"
        exit 1
    fi

    log_info "Pushing image to ECR: ${ecr_repo}:${tag}"

    # ECRログイン
    local region=$(echo "$ecr_repo" | cut -d. -f4)
    aws ecr get-login-password --region "$region" | \
        docker login --username AWS --password-stdin "$(echo "$ecr_repo" | cut -d/ -f1)"

    # タグ付け
    docker tag "moodle-custom:${tag}" "${ecr_repo}:${tag}"

    # プッシュ
    docker push "${ecr_repo}:${tag}"

    log_info "Image pushed successfully!"
}

# ========================================
# 5. データベースパッチの適用
# ========================================
apply_db_patches() {
    log_info "Applying database patches..."

    # OAuth2プロバイダーの設定
    docker exec "$CONTAINER_NAME" php <<'EOPHP'
<?php
require_once('/opt/bitnami/moodle/config.php');

// Cognitoプロバイダーの設定
$issuer = new stdClass();
$issuer->name = 'AWS Cognito';
$issuer->enabled = 1;
$issuer->showonloginpage = 1;
$issuer->baseurl = getenv('COGNITO_DOMAIN');

$existing = $DB->get_record('oauth2_issuer', ['name' => 'AWS Cognito']);
if ($existing) {
    $issuer->id = $existing->id;
    $DB->update_record('oauth2_issuer', $issuer);
    echo "OAuth2 provider updated\n";
} else {
    $DB->insert_record('oauth2_issuer', $issuer);
    echo "OAuth2 provider created\n";
}
EOPHP

    log_info "Database patches applied!"
}

# ========================================
# 6. カスタマイズの検証
# ========================================
validate_customizations() {
    log_info "Validating customizations..."

    # ファイル存在確認
    if docker exec "$CONTAINER_NAME" test -f /opt/bitnami/moodle/config.php 2>/dev/null; then
        log_info "✅ config.php exists"
    else
        log_warn "❌ config.php not found"
    fi

    # OAuth2設定確認
    if docker exec "$CONTAINER_NAME" test -d /opt/bitnami/moodle/auth/oauth2 2>/dev/null; then
        log_info "✅ OAuth2 plugin exists"
    else
        log_warn "❌ OAuth2 plugin not found"
    fi

    # データベース接続確認
    if docker exec "$CONTAINER_NAME" php -r "require_once('/opt/bitnami/moodle/config.php'); echo 'DB OK';" 2>/dev/null | grep -q "DB OK"; then
        log_info "✅ Database connection OK"
    else
        log_warn "❌ Database connection failed"
    fi

    log_info "Validation completed!"
}

# ========================================
# 7. 全体ビルド＆デプロイフロー
# ========================================
full_deploy() {
    local env="${1:-dev}"
    local ecr_repo="${2}"

    log_info "Starting full deployment flow for environment: $env"

    # 1. カスタマイズの抽出（現在の設定をバックアップ）
    extract_customizations

    # 2. カスタムイメージのビルド
    build_custom_image "$env"

    # 3. ECRへのプッシュ（本番環境の場合）
    if [ "$env" = "prod" ] && [ -n "$ecr_repo" ]; then
        push_to_ecr "$env" "$ecr_repo"
    fi

    # 4. ローカルテスト
    if [ "$env" = "dev" ]; then
        log_info "Starting local test..."
        docker-compose -f docker-compose.dev.yml up -d
        sleep 10
        validate_customizations
    fi

    log_info "Deployment flow completed!"
}

# ========================================
# 使用方法
# ========================================
usage() {
    cat <<EOF
Moodle Customization Management Tool

Usage: $0 <command> [options]

Commands:
  extract           Extract customizations from running container
  apply             Apply customizations to running container
  build [tag]       Build custom Docker image (default: latest)
  push-ecr <tag> <ecr-uri>  Push image to ECR
  db-patch          Apply database patches
  validate          Validate customizations
  full-deploy <env> [ecr-uri]  Full deployment flow (env: dev|prod)

Examples:
  $0 extract
  $0 apply
  $0 build v1.0.0
  $0 push-ecr latest 123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/moodle-app
  $0 full-deploy dev
  $0 full-deploy prod 123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/moodle-app

Environment Variables:
  CONTAINER_NAME    Container name (default: moodle-app)
  AWS_REGION        AWS region for ECR (default: ap-northeast-1)

EOF
}

# ========================================
# メイン処理
# ========================================
main() {
    local command="${1:-}"

    case "$command" in
        extract)
            extract_customizations
            ;;
        apply)
            apply_customizations
            ;;
        build)
            build_custom_image "${2:-latest}"
            ;;
        push-ecr)
            push_to_ecr "${2:-latest}" "${3}"
            ;;
        db-patch)
            apply_db_patches
            ;;
        validate)
            validate_customizations
            ;;
        full-deploy)
            full_deploy "${2:-dev}" "${3}"
            ;;
        help|--help|-h)
            usage
            ;;
        *)
            log_error "Unknown command: $command"
            usage
            exit 1
            ;;
    esac
}

main "$@"
