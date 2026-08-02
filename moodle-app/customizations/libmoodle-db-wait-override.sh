# 2026-08-02: Bitnamiの moodle_wait_for_mysql_connection() (libmoodle.sh) は失敗時に
# エラー内容を /dev/null に握りつぶすため、原因調査が困難だった。実際のmysqlエラーを
# ログに出すよう差し替える。この関数定義は libmoodle.sh の末尾に追記され、bash の
# 関数再定義規則により元の定義を上書きする。
#
# 2026-08-02 に判明した本番障害の根本原因(参考): /bitnami/moodle/config.php の
# $CFG->dbpass が getenv('MOODLE_DATABASE_PASSWORD') というPHP式になっており、
# Bitnamiのシェルレベル関数 moodle_conf_get() (grep+sedによる単純なテキスト抽出で
# PHPを評価しない) がこれを「getenv(MOODLE_DATABASE_PASSWORD)」という文字列その
# ものとして誤って読み取っていたため、復元パス(is_app_initialized=true)経由の
# 自動起動時のみ常に認証エラーになっていた。config.php側を修正済みだが、再発時に
# 原因を即座に特定できるよう、このエラーログ改善は残しておく。
moodle_wait_for_mysql_connection() {
    local -r db_host="${1:?missing database host}"
    local -r db_port="${2:?missing database port}"
    local -r db_name="${3:?missing database name}"
    local -r db_user="${4:?missing database user}"
    local -r db_pass="${5:-}"
    local -i attempt=0
    local -r max_attempts=24
    local mysql_err
    local -i mysql_start mysql_elapsed
    while [[ "$attempt" -lt "$max_attempts" ]]; do
        attempt=$((attempt + 1))
        mysql_start=$(date +%s)
        # "2>&1 1>/dev/null" で stderr だけを mysql_err に capture し、stdoutは捨てる。
        if mysql_err="$(mysql -h "$db_host" -P "$db_port" --connect-timeout=5 --skip-ssl -N -u "$db_user" -p"$db_pass" "$db_name" -e "SELECT 1" 2>&1 1>/dev/null)"; then
            return 0
        fi
        mysql_elapsed=$(( $(date +%s) - mysql_start ))
        echo "[webcoach-fix] mysql attempt ${attempt} failed after ${mysql_elapsed}s: ${mysql_err}" >&2
        sleep 5
    done
    error "Could not connect to the database"
    return 1
}
