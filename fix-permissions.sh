#!/bin/bash
# Fix Moodle data directory permissions
# This script ensures proper permissions for Moodle data directory

echo "Fixing Moodle data directory permissions..."

# Fix permissions inside container
docker exec moodle-app bash -c '
    # Ensure daemon user owns the data directory
    chown -R daemon:daemon /bitnami/moodledata 2>/dev/null || true

    # Set proper permissions for directories
    find /bitnami/moodledata -type d -exec chmod 02775 {} \; 2>/dev/null || true

    # Set proper permissions for files
    find /bitnami/moodledata -type f -exec chmod 0664 {} \; 2>/dev/null || true

    echo "Permissions fixed successfully"
'

echo "Done!"
