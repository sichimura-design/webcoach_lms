#!/bin/bash

# セキュリティグループ確認スクリプト

echo "=========================================="
echo "EC2セキュリティグループ確認"
echo "=========================================="
echo ""

# IMDSv2トークンを取得
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" 2>/dev/null)

# インスタンスIDを取得
if [ -n "$TOKEN" ]; then
    INSTANCE_ID=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null)
else
    # IMDSv1フォールバック
    INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null)
fi

if [ -z "$INSTANCE_ID" ]; then
    echo "✗ EC2インスタンスIDを取得できませんでした"
    echo "  このスクリプトはEC2インスタンス上で実行する必要があります"
    exit 1
fi

echo "インスタンスID: $INSTANCE_ID"

# リージョンを取得
if [ -n "$TOKEN" ]; then
    REGION=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/region 2>/dev/null)
else
    REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region 2>/dev/null)
fi
echo "リージョン: $REGION"
echo ""

# セキュリティグループIDを取得
echo "セキュリティグループを確認中..."
SECURITY_GROUPS=$(aws ec2 describe-instances \
    --instance-ids "$INSTANCE_ID" \
    --region "$REGION" \
    --query 'Reservations[0].Instances[0].SecurityGroups[*].[GroupId,GroupName]' \
    --output text 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "✗ AWS CLIでの情報取得に失敗しました"
    echo "  AWS認証情報が設定されているか確認してください"
    exit 1
fi

echo "このインスタンスのセキュリティグループ:"
echo "$SECURITY_GROUPS"
echo ""

# 各セキュリティグループについてポート8080のルールを確認
echo "ポート8080のインバウンドルールを確認中..."
echo ""

HAS_PORT_8080=false

while read -r SG_ID SG_NAME; do
    echo "セキュリティグループ: $SG_NAME ($SG_ID)"

    # ポート8080のルールを取得
    RULES=$(aws ec2 describe-security-groups \
        --group-ids "$SG_ID" \
        --region "$REGION" \
        --query "SecurityGroups[0].IpPermissions[?FromPort==\`8080\` || ToPort==\`8080\`]" \
        --output json 2>/dev/null)

    if [ "$RULES" != "[]" ] && [ "$RULES" != "null" ]; then
        echo "  ✓ ポート8080が開いています"
        echo "$RULES" | grep -o '"CidrIp": "[^"]*"' | sed 's/"CidrIp": /    許可元: /'
        HAS_PORT_8080=true
    else
        echo "  ✗ ポート8080が開いていません"
    fi
    echo ""
done <<< "$SECURITY_GROUPS"

echo "=========================================="
if [ "$HAS_PORT_8080" = true ]; then
    echo "✓ ポート8080が開いています"
    echo ""
    echo "Moodleにアクセスできるはずです。"
else
    echo "✗ ポート8080が開いていません"
    echo ""
    echo "以下のコマンドでポート8080を開くことができます："
    echo ""
    SG_ID=$(echo "$SECURITY_GROUPS" | head -1 | awk '{print $1}')
    echo "aws ec2 authorize-security-group-ingress \\"
    echo "    --group-id $SG_ID \\"
    echo "    --protocol tcp \\"
    echo "    --port 8080 \\"
    echo "    --cidr 0.0.0.0/0 \\"
    echo "    --region $REGION"
    echo ""
    echo "注意: 0.0.0.0/0は全てのIPアドレスからのアクセスを許可します。"
    echo "      本番環境では、特定のIPアドレスのみを許可することを推奨します。"
fi
echo "=========================================="
echo ""
