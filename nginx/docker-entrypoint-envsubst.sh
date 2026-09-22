#!/bin/sh
# Runs before nginx starts (nginx:alpine executes every /docker-entrypoint.d/*.sh
# in alphabetical order; this is named 00- so it runs first).
#
# Substitutes BFF_HOST/MOODLE_HOST into nginx.conf so the same image works
# both in docker-compose (Docker embedded DNS resolves service names like
# moodle-bff:3001) and in ECS EC2 host network mode, where sibling containers
# are only reachable via localhost:<port>. Only these two variables are
# substituted -- nginx's own $variables (e.g. $host, $request_uri) must stay
# literal, so the variable list passed to envsubst is explicit.
set -e
envsubst '${BFF_HOST} ${MOODLE_HOST}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
