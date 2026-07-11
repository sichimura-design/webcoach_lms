#!/bin/bash
#
# Apply Japanese Language Configuration to Running Moodle Instance
# This script can be run at any time to update language settings
#

cd "$(dirname "$0")"

echo "=========================================="
echo "Applying Japanese Language Configuration"
echo "=========================================="

# Check if containers are running
if ! docker ps | grep -q moodle-mysql; then
    echo "ERROR: MySQL container is not running"
    echo "Please start the containers first: ./start-moodle.sh"
    exit 1
fi

if ! docker ps | grep -q moodle-app; then
    echo "ERROR: Moodle container is not running"
    echo "Please start the containers first: ./start-moodle.sh"
    exit 1
fi

echo "Copying initialization script to Moodle container..."
docker cp scripts/init-japanese-lang.sh moodle-app:/tmp/init-japanese-lang.sh

echo "Executing language configuration script..."
docker exec moodle-app bash /tmp/init-japanese-lang.sh

echo ""
echo "=========================================="
echo "Done!"
echo "=========================================="
echo "Please clear your browser cache and reload the page to see the changes."
echo ""
