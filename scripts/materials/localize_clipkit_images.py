#!/usr/bin/env python3
"""教材HTMLが参照する Clipkit(cdn.clipkit.co)の画像を自前のS3へ移し、リンクを書き換える。

  1. <materials-dir>/<bucket>/html/*.html から cdn.clipkit.co の画像URLを集める
  2. assets/materials/_clipkit/<cdn.clipkit.co以降のパス> へダウンロード（取得済みはスキップ、
     取れなかったものはリンクを書き換えない）
  3. HTML内のURLを相対パス ../../_clipkit/<同じパス> に書き換える
  4. --s3-bucket を渡すと _clipkit/ と html/ を s3://<bucket>/materials/ へ上げる

置き場所は Clipkit のパスで決め打ち（クエリ文字列は捨てる）。同じファイル名で medium/large 等の
サイズ違いがあるので、ファイル名だけでなくパスごと残す。
リンクは相対パスなので、materials/ を同じ構成で置けばどのドメインでもそのまま動く。
何度流してもよい（書き換え済みのHTMLには Clipkit のURLが残らない）。

環境ごとにS3上のHTMLは中身が違う（UATは lms-skin.css 注入済み・ファイル数も違う）ので、
ローカルの assets/materials を上げると上書きしてしまう。dev 以外は --pull でバケットのHTMLを
作業ディレクトリへ落とし、それを書き換えて戻す。

  # dev（assets/materials がdevのS3と同じ内容）
  python3 scripts/materials/localize_clipkit_images.py \\
    --s3-bucket dev-devspastack-spabucket48e1059f-yymyziswolti --profile PowerUserAccess-840513866884
  # UAT（uat.webcoach.jp）
  python3 scripts/materials/localize_clipkit_images.py --pull \\
    --s3-bucket moodle-spa-frontend-spafrontendbucketa0c499f3-1q1oez2ib24b --profile PowerUserAccess-822824391912 \\
    --invalidate E1C5CM5I7NU8VT
  # 本番も --pull で、--s3-bucket / --profile / --invalidate を本番の値にする。--dry-run で件数だけ確認できる。
"""
import argparse
import re
import subprocess
import sys
import tempfile
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE_DIR = ROOT / "assets" / "materials" / "_clipkit"
IMAGE_URL = re.compile(
    r"(?:https?:)?//cdn\.clipkit\.co/([^\"'\s()<>\\?#,]+\.(?:png|jpe?g|gif|webp|svg))(?:\?[0-9A-Za-z=&;._-]*)?",
    re.IGNORECASE,
)


def download(path: str) -> str | None:
    dest = CACHE_DIR / path
    if dest.exists() and dest.stat().st_size > 0:
        return None
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(f"https://cdn.clipkit.co/{path}", headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            data = res.read()
    except Exception as e:  # noqa: BLE001 — 失敗分は最後にまとめて報告する
        return f"{path}: {e}"
    tmp = dest.with_suffix(dest.suffix + ".part")
    tmp.write_bytes(data)
    tmp.rename(dest)
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--s3-bucket", help="上げ先のS3バケット（materials/ 配下に置く）。省略時はローカルのみ")
    ap.add_argument("--profile", help="AWS CLI のプロファイル")
    ap.add_argument("--pull", action="store_true",
                    help="ローカルの assets/materials ではなく、バケットのHTMLを落として書き換える（dev以外はこれ）")
    ap.add_argument("--invalidate", metavar="DISTRIBUTION_ID", help="最後に /materials/* を無効化する CloudFront")
    ap.add_argument("--dry-run", action="store_true", help="件数を出すだけで何も変更しない")
    args = ap.parse_args()
    if args.pull and not args.s3_bucket:
        ap.error("--pull には --s3-bucket が必要")

    aws = ["aws"] + (["--profile", args.profile] if args.profile else [])
    dest = f"s3://{args.s3_bucket}/materials"
    if args.pull:
        materials = Path(tempfile.mkdtemp(prefix="clipkit-materials-"))
        subprocess.run(aws + ["s3", "sync", dest, str(materials), "--exclude", "*",
                              "--include", "*/html/*.html", "--only-show-errors"], check=True)
        print(f"pulled {dest}/*/html/ -> {materials}")
    else:
        materials = ROOT / "assets" / "materials"

    html_files = sorted(materials.glob("*/html/*.html"))
    paths: set[str] = set()
    for f in html_files:
        paths.update(m.group(1) for m in IMAGE_URL.finditer(f.read_text(encoding="utf-8")))
    print(f"HTML {len(html_files)} files / Clipkit images {len(paths)}")
    if args.dry_run:
        return 0

    with ThreadPoolExecutor(max_workers=16) as pool:
        errors = [e for e in pool.map(download, sorted(paths)) if e]
    if errors:
        # 取れなかった画像（Clipkit側で既に403など）はリンクを元のまま残す
        print(f"download failed (left as is): {len(errors)}", *errors, sep="\n", file=sys.stderr)

    def to_local(m: re.Match) -> str:
        return f"../../_clipkit/{m.group(1)}" if (CACHE_DIR / m.group(1)).exists() else m.group(0)

    changed = 0
    for f in html_files:
        text = f.read_text(encoding="utf-8")
        new = IMAGE_URL.sub(to_local, text)
        if new != text:
            f.write_text(new, encoding="utf-8")
            changed += 1
    print(f"rewrote {changed} HTML files")

    if args.s3_bucket:
        subprocess.run(aws + ["s3", "sync", str(CACHE_DIR), f"{dest}/_clipkit", "--only-show-errors"], check=True)
        for d in sorted(materials.glob("*/html")):
            subprocess.run(
                aws + ["s3", "sync", str(d), f"{dest}/{d.parent.name}/html",
                       "--exclude", "*", "--include", "*.html",
                       "--content-type", "text/html; charset=utf-8",
                       # Cache-Control が無いとブラウザが古いHTMLを持ち続け、書き換えが見えない
                       "--cache-control", "no-cache", "--only-show-errors"],
                check=True,
            )
        print(f"uploaded to {dest}/")
    if args.invalidate:
        subprocess.run(aws + ["cloudfront", "create-invalidation", "--distribution-id", args.invalidate,
                              "--paths", "/materials/*", "--query", "Invalidation.Id", "--output", "text"],
                       check=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
