# Built FROM a fixed snapshot tag rather than public.ecr.aws/bitnami/moodle:4.3.6 directly:
# that base tag has since been removed from Bitnami's public ECR catalog and is no longer
# pullable. moodle-app-base-20260824 is a one-time copy of what was running in production
# on that date (same digest as moodle-app-latest at the time), pinned so it never moves.
# Deliberately NOT FROM moodle-app-latest: this Dockerfile is now built automatically by
# CI on every push, and if it chained from whatever the previous CI run had just pushed to
# -latest, each run would stack new layers on top of all prior runs' layers forever
# (unbounded growth toward Docker's 127-layer limit). Building from this fixed tag instead
# keeps the layer count constant across CI runs.
FROM 840513866884.dkr.ecr.ap-northeast-1.amazonaws.com/webcoach-lms:moodle-app-base-20260824

LABEL maintainer="WebCoach Team"
LABEL description="Custom Moodle with WebCoach plugins (webcoach_tags, webcoach_utils)"
LABEL version=1.1.0

USER root

# Remove customizations that were previously (incorrectly) baked into the EFS-mounted
# persistence target /bitnami/moodle. See the COPY block below for why this was wrong.
# Bitnami's own is_mounted_dir_empty() (libfs.sh) treats ANY entry under /bitnami/moodle
# as "non-empty" -- even a leftover empty directory -- so this must remove the directory
# entirely, not just the customization files, or the same misdetection recurs.
RUN rm -rf /bitnami/moodle

# Bake customizations into the Bitnami "source" tree (/opt/bitnami/moodle) instead, NOT
# the EFS-mounted persistence target (/bitnami/moodle). Bitnami's own entrypoint copies
# /opt/bitnami/moodle -> /bitnami/moodle on first boot when the target is empty.
# Copying directly into /bitnami/moodle (the previous approach) made ECS's EFS volume
# mount (a Docker "volume" type) auto-populate from just these few files before the
# entrypoint ever ran, leaving a non-empty-but-incomplete directory (no version.php)
# that Bitnami's entrypoint then misidentified as a broken "restore" instead of a
# fresh install, crashing every deploy against an empty EFS.
COPY customizations/local/webcoach_tags /opt/bitnami/moodle/local/webcoach_tags
COPY customizations/local/webcoach_utils /opt/bitnami/moodle/local/webcoach_utils
COPY customizations/oauth2_debug.php /opt/bitnami/moodle/oauth2_debug.php

RUN chown -R daemon:root \
      /opt/bitnami/moodle/local/webcoach_tags \
      /opt/bitnami/moodle/local/webcoach_utils \
      /opt/bitnami/moodle/oauth2_debug.php && \
    find /opt/bitnami/moodle/local/webcoach_tags /opt/bitnami/moodle/local/webcoach_utils -type d -exec chmod 775 {} \; && \
    find /opt/bitnami/moodle/local/webcoach_tags /opt/bitnami/moodle/local/webcoach_utils -type f -exec chmod 664 {} \; && \
    chmod 664 /opt/bitnami/moodle/oauth2_debug.php

# 2026-08-01: moodle_wait_for_mysql_connection() を自前実装で上書き。詳細は
# customizations/libmoodle-db-wait-override.sh のコメント参照(自動起動時のみDB接続待ちが
# 原因不明のまま60秒ハングする問題への対応)。
COPY customizations/libmoodle-db-wait-override.sh /tmp/libmoodle-db-wait-override.sh
RUN cat /tmp/libmoodle-db-wait-override.sh >> /opt/bitnami/scripts/libmoodle.sh && \
    rm /tmp/libmoodle-db-wait-override.sh

USER 1001
