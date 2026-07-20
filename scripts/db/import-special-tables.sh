#!/bin/bash
# Import special Moodle tables data to production database
# These tables contain critical system configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# AWS Profile for production account
AWS_PROFILE=${AWS_PROFILE:-PowerUserAccess-840513866884}
AWS_REGION=${AWS_REGION:-ap-northeast-1}

# Secret name for production RDS credentials
SECRET_NAME="prod/moodle/db-credentials"

# Input file
INPUT_FILE="$SCRIPT_DIR/special-tables-data.sql"

echo ""
echo "=================================================="
echo "  Importing Special Moodle Tables Data"
echo "=================================================="
echo ""

# Check if input file exists
if [ ! -f "$INPUT_FILE" ]; then
    echo -e "${RED}✗${NC} Input file not found: $INPUT_FILE"
    echo ""
    echo "Please run export-special-tables.sh first to generate the data file."
    exit 1
fi

# Get file size
FILE_SIZE=$(du -h "$INPUT_FILE" | cut -f1)
echo "Input file: $INPUT_FILE"
echo "File size: $FILE_SIZE"
echo ""

# Retrieve database credentials from Secrets Manager
echo -e "${YELLOW}Retrieving database credentials from AWS Secrets Manager...${NC}"
SECRET_JSON=$(AWS_PROFILE=$AWS_PROFILE aws secretsmanager get-secret-value \
    --region $AWS_REGION \
    --secret-id $SECRET_NAME \
    --query SecretString \
    --output text 2>/dev/null)

if [ $? -ne 0 ]; then
    echo -e "${RED}✗${NC} Failed to retrieve credentials from Secrets Manager"
    echo ""
    echo "Make sure you have the correct AWS profile configured:"
    echo "  export AWS_PROFILE=$AWS_PROFILE"
    exit 1
fi

# Parse JSON credentials
DB_HOST=$(echo $SECRET_JSON | jq -r '.host')
DB_PORT=$(echo $SECRET_JSON | jq -r '.port // 3306')
DB_NAME=$(echo $SECRET_JSON | jq -r '.dbname')
DB_USER=$(echo $SECRET_JSON | jq -r '.username')
DB_PASSWORD=$(echo $SECRET_JSON | jq -r '.password')

echo -e "${GREEN}✓${NC} Retrieved credentials successfully"
echo ""
echo "Target Database:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Warning prompt
echo -e "${YELLOW}⚠ WARNING${NC}"
echo "This will TRUNCATE and replace data in the following tables:"
echo "  - mdl_role"
echo "  - mdl_capabilities"
echo "  - mdl_config"
echo "  - mdl_external_services"
echo "  - mdl_oauth2_issuer"
echo ""
echo -e "${RED}This operation cannot be undone!${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo ""
    echo "Import cancelled."
    exit 0
fi

echo ""
echo -e "${YELLOW}Starting import...${NC}"
echo ""

# Import data
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$INPUT_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Import completed successfully${NC}"
    echo ""
    echo "Verifying imported data..."
    echo ""

    # Verify each table
    TABLES=("mdl_role" "mdl_capabilities" "mdl_config" "mdl_external_services" "mdl_oauth2_issuer")

    for table in "${TABLES[@]}"; do
        ROW_COUNT=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -N -e "SELECT COUNT(*) FROM $table")
        echo "  $table: $ROW_COUNT rows"
    done

    echo ""
    echo -e "${GREEN}✓ Import verification completed${NC}"
else
    echo ""
    echo -e "${RED}✗ Import failed${NC}"
    exit 1
fi

echo ""
echo "Next steps:"
echo "  1. Verify the imported data in the production database"
echo "  2. Update mdl_oauth2_issuer with production Cognito settings if needed"
echo "  3. Update mdl_config with production-specific settings if needed"
echo ""
