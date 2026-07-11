#!/bin/bash
#
# Moodle Japanese Language Initialization Script
# This script ensures admin user and system default language is set to Japanese
#

set -e

# Configuration
DB_HOST="${MOODLE_DATABASE_HOST:-mysql}"
DB_NAME="${MOODLE_DATABASE_NAME:-moodle}"
DB_USER="${MOODLE_DATABASE_USER:-moodleuser}"
DB_PASS="${MOODLE_DATABASE_PASSWORD:-moodlepass123}"
TARGET_LANG="${MOODLE_LANG:-ja}"
BITNAMI_DB_NAME="bitnami_moodle"

# MySQL client path and options
MYSQL_CMD="/opt/bitnami/mysql/bin/mysql --skip-ssl"
if [ ! -x "/opt/bitnami/mysql/bin/mysql" ]; then
    MYSQL_CMD="mysql"
fi

echo "=========================================="
echo "Moodle Japanese Language Configuration"
echo "=========================================="
echo "Target Language: ${TARGET_LANG}"
echo "Database Host: ${DB_HOST}"

# Wait for MySQL to be ready
echo "Waiting for MySQL to be ready..."
for i in {1..30}; do
    if $MYSQL_CMD -h"${DB_HOST}" -u"${DB_USER}" -p"${DB_PASS}" -e "SELECT 1" > /dev/null 2>&1; then
        echo "MySQL is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "ERROR: MySQL did not become ready in time"
        exit 1
    fi
    sleep 2
done

# Check if Moodle is installed (bitnami_moodle database exists)
if $MYSQL_CMD -h"${DB_HOST}" -u"${DB_USER}" -p"${DB_PASS}" -e "USE ${BITNAMI_DB_NAME};" 2>/dev/null; then
    echo "Moodle installation detected (${BITNAMI_DB_NAME} database exists)"

    # Update admin user language
    echo "Updating admin user language to ${TARGET_LANG}..."
    $MYSQL_CMD -h"${DB_HOST}" -u"${DB_USER}" -p"${DB_PASS}" "${BITNAMI_DB_NAME}" <<EOF
UPDATE mdl_user SET lang='${TARGET_LANG}' WHERE username='admin';
EOF

    # Check if language was updated
    ADMIN_LANG=$($MYSQL_CMD -h"${DB_HOST}" -u"${DB_USER}" -p"${DB_PASS}" "${BITNAMI_DB_NAME}" -sN -e "SELECT lang FROM mdl_user WHERE username='admin';")
    if [ "${ADMIN_LANG}" = "${TARGET_LANG}" ]; then
        echo "✓ Admin user language successfully set to: ${TARGET_LANG}"
    else
        echo "✗ Warning: Admin user language is: ${ADMIN_LANG} (expected: ${TARGET_LANG})"
    fi

    # Update system default language
    echo "Updating system default language to ${TARGET_LANG}..."
    $MYSQL_CMD -h"${DB_HOST}" -u"${DB_USER}" -p"${DB_PASS}" "${BITNAMI_DB_NAME}" <<EOF
UPDATE mdl_config SET value='${TARGET_LANG}' WHERE name='lang';
EOF

    # Verify system language
    SYS_LANG=$($MYSQL_CMD -h"${DB_HOST}" -u"${DB_USER}" -p"${DB_PASS}" "${BITNAMI_DB_NAME}" -sN -e "SELECT value FROM mdl_config WHERE name='lang';")
    if [ "${SYS_LANG}" = "${TARGET_LANG}" ]; then
        echo "✓ System default language successfully set to: ${TARGET_LANG}"
    else
        echo "✗ Warning: System default language is: ${SYS_LANG} (expected: ${TARGET_LANG})"
    fi

    echo "=========================================="
    echo "Language configuration completed!"
    echo "=========================================="
else
    echo "Moodle not yet installed. Language will be configured during installation via MOODLE_LANG environment variable."
fi
