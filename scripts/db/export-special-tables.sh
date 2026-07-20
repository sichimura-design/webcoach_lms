#!/bin/bash
# Export special Moodle tables data for migration
# These tables contain critical system configuration that must be preserved

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
    echo -e "${GREEN}✓${NC} Loaded environment variables from .env"
else
    echo -e "${RED}✗${NC} .env file not found"
    exit 1
fi

# Validate required environment variables
if [ -z "$MOODLE_DB_HOST" ] || [ -z "$MOODLE_DB_USER" ] || [ -z "$MOODLE_DB_PASSWORD" ] || [ -z "$MOODLE_DB_NAME" ]; then
    echo -e "${RED}✗${NC} Missing required database environment variables"
    exit 1
fi

# Special tables to export
TABLES=(
    "mdl_role"
    "mdl_capabilities"
    "mdl_config"
    "mdl_external_services"
    "mdl_oauth2_issuer"
)

# Output file
OUTPUT_FILE="$SCRIPT_DIR/special-tables-data.sql"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$SCRIPT_DIR/special-tables-data-${TIMESTAMP}.sql"

echo ""
echo "=================================================="
echo "  Exporting Special Moodle Tables Data"
echo "=================================================="
echo ""
echo "Source Database:"
echo "  Host: $MOODLE_DB_HOST"
echo "  Database: $MOODLE_DB_NAME"
echo "  User: $MOODLE_DB_USER"
echo ""
echo "Tables to export:"
for table in "${TABLES[@]}"; do
    echo "  - $table"
done
echo ""
echo "Output file: $OUTPUT_FILE"
echo ""

# Create temporary file for export
TEMP_FILE=$(mktemp)

# Export each table
echo -e "${YELLOW}Starting export...${NC}"
echo ""

# Add header to output file
cat > "$TEMP_FILE" <<EOF
-- Special Moodle Tables Data Export
-- Exported: $(date)
-- Source: $MOODLE_DB_HOST/$MOODLE_DB_NAME
--
-- Tables included:
$(for table in "${TABLES[@]}"; do echo "--   - $table"; done)
--
-- IMPORTANT: These tables contain critical system configuration
--            Review and modify as needed before importing to production

SET FOREIGN_KEY_CHECKS=0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;

EOF

# Export data for each table
for table in "${TABLES[@]}"; do
    echo -e "Exporting ${GREEN}$table${NC}..."

    # Get row count
    ROW_COUNT=$(mysql -h "$MOODLE_DB_HOST" -u "$MOODLE_DB_USER" -p"$MOODLE_DB_PASSWORD" "$MOODLE_DB_NAME" -N -e "SELECT COUNT(*) FROM $table")

    if [ "$ROW_COUNT" -gt 0 ]; then
        echo "-- " >> "$TEMP_FILE"
        echo "-- Table: $table (${ROW_COUNT} rows)" >> "$TEMP_FILE"
        echo "-- " >> "$TEMP_FILE"
        echo "TRUNCATE TABLE $table;" >> "$TEMP_FILE"

        mysqldump \
            --no-create-info \
            --skip-lock-tables \
            --complete-insert \
            --skip-extended-insert \
            -h "$MOODLE_DB_HOST" \
            -u "$MOODLE_DB_USER" \
            -p"$MOODLE_DB_PASSWORD" \
            "$MOODLE_DB_NAME" \
            "$table" >> "$TEMP_FILE"

        echo "" >> "$TEMP_FILE"
        echo -e "  ${GREEN}✓${NC} Exported $ROW_COUNT rows"
    else
        echo -e "  ${YELLOW}!${NC} Table is empty, skipping"
    fi
done

# Add footer
cat >> "$TEMP_FILE" <<EOF

COMMIT;
SET FOREIGN_KEY_CHECKS=1;

-- Export completed: $(date)
EOF

# Move temp file to output file
mv "$TEMP_FILE" "$OUTPUT_FILE"

# Get file size
FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)

echo ""
echo -e "${GREEN}✓ Export completed successfully${NC}"
echo ""
echo "Output file: $OUTPUT_FILE"
echo "File size: $FILE_SIZE"
echo ""
echo "Next steps:"
echo "  1. Review the exported data in $OUTPUT_FILE"
echo "  2. Commit to git if needed: git add $OUTPUT_FILE && git commit -m 'feat: export special tables data'"
echo "  3. Use import-special-tables.sh to import to prod-moodle-db"
echo ""
