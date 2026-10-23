<?php
/**
 * Moodle のコースの並び順(course.sortorder)を、学習システムの今の表示順にそろえる
 *
 * 学習システムの領域内のコースの並びは、以前はフロントの courseTaxonomy.ts の宣言順で決めていたが、
 * Moodle の「コースおよびカテゴリ管理」の順(categorysortorder)で決めるように変えた。
 * そのまま切り替えると Moodle 側の今の順(作成順に近い)がそのまま画面に出るので、
 * フロントを切り替える前にこのスクリプトで Moodle 側を今の表示順にそろえる。
 *
 * 今の表示順 = カテゴリ内で、順番ファイルに載っているコースをファイルの順に並べ、
 *              載っていないコースはその後ろに id 順(作成順)で並べたもの。
 * 変えるのは course.sortorder だけ。カテゴリの並び・コースの中身には触らない。
 *
 * Usage (moodle-app コンテナ内、daemon ユーザーで):
 *   php align-course-sortorder.php <順番ファイル>            … 変更内容と今の値を表示するだけ(既定)
 *   php align-course-sortorder.php <順番ファイル> --apply    … 実際に並べ替える
 *   php align-course-sortorder.php --restore=<控えCSV>       … 控えた sortorder に戻す
 *
 * 順番ファイルは shortname を1行1件。courseTaxonomy.ts から作る:
 *   grep -o "slug: '[^']*'" frontend/src/constants/courseTaxonomy.ts | sed "s/slug: '\(.*\)'/\1/" > order.txt
 *
 * 実行するたびに「id,shortname,category,sortorder」の控えCSVを標準出力の先頭に出す。
 * --apply の前に必ず控えを保存しておくこと(--restore にそのまま渡せる)。
 */

define('CLI_SCRIPT', true);

require('/bitnami/moodle/config.php');
require_once($CFG->libdir . '/clilib.php');
require_once($CFG->dirroot . '/course/lib.php');

$apply = in_array('--apply', $argv, true);
$restorefile = null;
$orderfile = null;
foreach (array_slice($argv, 1) as $arg) {
    if (strpos($arg, '--restore=') === 0) {
        $restorefile = substr($arg, strlen('--restore='));
    } else if ($arg !== '--apply') {
        $orderfile = $arg;
    }
}

/** サイトコース(id=1)以外の全コース。カテゴリ・sortorder 順 */
function load_courses() {
    global $DB;
    return $DB->get_records_select('course', 'id <> ?', [SITEID], 'category, sortorder', 'id, shortname, category, sortorder');
}

function print_backup($courses) {
    echo "---- 控え(id,shortname,category,sortorder) ----\n";
    foreach ($courses as $c) {
        echo "{$c->id},{$c->shortname},{$c->category},{$c->sortorder}\n";
    }
    echo "---- 控えここまで ----\n";
}

if ($restorefile !== null) {
    $lines = file($restorefile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        cli_error("控えCSVを読めません: {$restorefile}");
    }
    $transaction = $DB->start_delegated_transaction();
    $n = 0;
    foreach ($lines as $line) {
        $cols = explode(',', $line);
        if (count($cols) !== 4 || !ctype_digit($cols[0]) || !ctype_digit($cols[3])) {
            continue; // 見出し行など
        }
        $DB->set_field('course', 'sortorder', (int)$cols[3], ['id' => (int)$cols[0], 'category' => (int)$cols[2]]);
        $n++;
    }
    fix_course_sortorder();
    $transaction->allow_commit();
    cache_helper::purge_by_event('changesincourse');
    echo "{$n} 件の sortorder を戻しました\n";
    exit(0);
}

if ($orderfile === null) {
    cli_error('順番ファイルを指定してください(Usage はファイル先頭のコメント参照)');
}
$slugs = file($orderfile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
if ($slugs === false || !$slugs) {
    cli_error("順番ファイルを読めないか空です: {$orderfile}");
}
$rankbyslug = array_flip(array_map('trim', $slugs));

$courses = load_courses();
print_backup($courses);

// カテゴリごとに、あるべき順を作る
$bycategory = [];
foreach ($courses as $c) {
    $bycategory[$c->category][] = $c;
}
$plans = [];
foreach ($bycategory as $categoryid => $list) {
    $current = array_column($list, 'id');
    $indexed = [];
    foreach ($list as $c) {
        // 載っていないコースは後ろへ、id 順(作成順)で。今の画面がそうなっている
        // (core_course_get_courses は id 順に返し、フロントはそれをそのまま後ろへ付けていた)
        $rank = $rankbyslug[$c->shortname] ?? (count($rankbyslug) + (int)$c->id);
        $indexed[] = [$rank, $c];
    }
    usort($indexed, fn($a, $b) => $a[0] <=> $b[0]);
    $desired = array_map(fn($x) => $x[1], $indexed);
    if (array_column($desired, 'id') === $current) {
        continue;
    }
    $plans[$categoryid] = ['current' => $list, 'desired' => $desired];
}

if (!$plans) {
    echo "並べ替えが必要なカテゴリはありません\n";
    exit(0);
}

foreach ($plans as $categoryid => $plan) {
    $name = $DB->get_field('course_categories', 'name', ['id' => $categoryid]);
    echo "\n== カテゴリ {$categoryid}「{$name}」 ==\n";
    echo "  今      : " . implode(' / ', array_column($plan['current'], 'shortname')) . "\n";
    echo "  変更後  : " . implode(' / ', array_column($plan['desired'], 'shortname')) . "\n";
}

if (!$apply) {
    echo "\n(確認のみ。並べ替えるには --apply を付けて実行)\n";
    exit(0);
}

$transaction = $DB->start_delegated_transaction();
foreach ($plans as $categoryid => $plan) {
    $after = 0;
    foreach ($plan['desired'] as $c) {
        course_change_sortorder_after_course($c->id, $after);
        $after = $c->id;
    }
}
fix_course_sortorder();

// 結果がねらいどおりか確かめてから確定する
$result = [];
foreach (load_courses() as $c) {
    $result[$c->category][] = (int)$c->id;
}
foreach ($plans as $categoryid => $plan) {
    $want = array_map('intval', array_column($plan['desired'], 'id'));
    if (($result[$categoryid] ?? []) !== $want) {
        $transaction->rollback(new moodle_exception('generalexceptionmessage', 'error', '',
            "カテゴリ {$categoryid} の並びがねらいと違うので取り消しました"));
    }
}
$transaction->allow_commit();
cache_helper::purge_by_event('changesincourse');
echo "\n" . count($plans) . " カテゴリを並べ替えました\n";
