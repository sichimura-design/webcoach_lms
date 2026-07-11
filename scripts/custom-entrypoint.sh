#!/bin/bash
#
# Custom Entrypoint Wrapper for Moodle
# This script runs before the standard Bitnami entrypoint
#

set -e

# Run the original Bitnami entrypoint
/opt/bitnami/scripts/moodle/entrypoint.sh "$@" &
ENTRYPOINT_PID=$!

# Wait for Moodle to be fully initialized (check if database exists)
echo "Waiting for Moodle initialization..."
sleep 30

# Run language configuration script if Moodle is installed
if [ -f /opt/bitnami/scripts/moodle/init-japanese-lang.sh ]; then
    echo "Running Japanese language initialization..."
    /opt/bitnami/scripts/moodle/init-japanese-lang.sh || true
fi

# Wait for the original entrypoint process
wait $ENTRYPOINT_PID
