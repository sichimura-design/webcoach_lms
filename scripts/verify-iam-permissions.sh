#!/bin/bash

##############################################################################
# IAM権限確認スクリプト
#
# Parameter Storeへのアクセス権限を確認します
##############################################################################

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}IAM権限確認${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# 現在のIAM Identity確認
echo -e "${BLUE}[1] 現在のIAM Identity:${NC}"
aws sts get-caller-identity
echo ""

# Parameter Store 書き込み権限テスト
echo -e "${BLUE}[2] Parameter Store 書き込み権限テスト:${NC}"
if aws ssm put-parameter \
    --name /moodle/prod/test-permission \
    --value "test" \
    --type String \
    --region ap-northeast-1 \
    --overwrite \
    --no-cli-pager 2>/dev/null; then
    echo -e "${GREEN}✓ 書き込み権限あり${NC}"

    # テストパラメータを削除
    aws ssm delete-parameter \
        --name /moodle/prod/test-permission \
        --region ap-northeast-1 \
        --no-cli-pager 2>/dev/null
else
    echo -e "${RED}✗ 書き込み権限なし${NC}"
    echo ""
    echo "必要なIAM権限を追加してください："
    echo "  - ssm:PutParameter"
    echo "  - ssm:GetParameter"
    echo "  - ssm:DeleteParameter"
    exit 1
fi

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✓ 全ての権限確認完了${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "次のステップ:"
echo "  ./scripts/create-parameter-store.sh"
