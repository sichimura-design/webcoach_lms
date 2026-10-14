#!/usr/bin/env python3
"""本番教材HTMLの個別修正（2026-10-14 教材不具合リスト対応）

本番S3の materials/ を手元に落としたコピー（SRC）を読み、直したファイルだけを OUT に同じ相対パスで書き出す。
S3 へのアップロードは別途（deploy-materials-fix-20261014.sh）。

  python3 fix_prod_materials_20261014.py SRC OUT

直す内容
  1. 心得集など5ページ：Dropbox の PDF を iframe で埋め込んでいた箇所（Dropbox が application/json で返すため表示されない）
     → 同じスライドを画像にしたもの（materials/_assets/slides/<ページ>-<n>.webp）を縦に並べる
  2. チュートリアル・LMSガイド：devプレビュー（dmn2v7nl0g3fq.cloudfront.net/branches/dev-kanegae）の URL が直書き
     → 本番の URL にし、data-lms-route を付けて LMS 内で移る
  3. Wix実践 -中級編-：「アンカーの復習はこちら」の行き先が空の見出し（#heading9）→ #heading62
  4. Illustrator -応用編-：「-応用編- では</strong> では、」の重複
  5. Photoshop -実践編-：素材（jpg/psd）が画像表示や Clipkit の CDN 行きだった → materials/_downloads/（attachment で配信）
"""
import os
import re
import sys

SRC, OUT = sys.argv[1], sys.argv[2]
DEV = 'https://dmn2v7nl0g3fq.cloudfront.net/branches/dev-kanegae'
PROD = 'https://study.webcoach.jp'

# 1. ページ → (Dropbox の共有ID, スライド枚数, 画像の桁数)
SLIDES = {
    'knowledge/html/zapvl.html': ('yjotqxpobp2vvjmufw5js', 10, 2),
    'knowledge/html/gdr01.html': ('nlkdkq8yvy0iesl6u3hr3', 8, 1),
    'knowledge/html/m7yn3.html': ('yairhim8m0clgkyneoz93', 6, 1),
    'knowledge/html/fni96.html': ('hgwakz4opf4x8j3b4pp26', 7, 1),
    'knowledge/html/2enjv.html': ('ik3edrbq2t03mu38bp6wq', 8, 1),
}

# 2. devプレビューの Moodle モジュール番号 → 本番（初回コーチング準備チュートリアル course19・WEBデザイン course21）
DEV_MODULES = {
    '/course/19?module=992': '/course/19?module=33',  # 目標整理
    '/course/19?module=993': '/course/19?module=34',  # 目標宣言と学習時間
    '/course/19?module=994': '/course/19?module=35',  # Slack・Notion
    '/course/19?module=995': '/course/19?module=36',  # AIコーチ（WEBCOACH先生）
    '/course/19?module=996': '/course/19?module=37',  # 生成AIアプリ
    '/course/19?module=997': '/course/19?module=38',  # オリエン動画
    '/course/19?module=998': '/course/19?module=39',  # 学習の心得集
    '/course/19?module=999': '/course/19?module=40',  # デザインの4原則
    '/course/21?module=466': '/course/21?module=52',  # デザインのきほん４原則
    '/course/21?module=474': '/course/21?module=54',  # デザインきほん色彩4原理
}

# 5. Photoshop -実践編- の素材 → materials/_downloads/
DOWNLOADS = {
    '../../_clipkit/tenants/589/resources/assets/000/000/387/original/adobe_photoshop_photo_material_1.jpg':
        '../../_downloads/adobe_photoshop_photo_material_1.jpg',
    'https://cdn.clipkit.co/tenants/589/resources/assets/000/000/389/original/adobe_photoshop_photo_material_2.psd':
        '../../_downloads/adobe_photoshop_photo_material_2.psd',
    'https://cdn.clipkit.co/tenants/589/resources/assets/000/000/388/original/adobe_photoshop_photo_material_3.psd':
        '../../_downloads/adobe_photoshop_photo_material_3.psd',
}


def slides_html(page, n, width):
    name = os.path.basename(page)[:-5]
    imgs = ''.join(
        f'<img class="wc-slides__img" src="../../_assets/slides/{name}-{i:0{width}d}.webp" alt="スライド {i}" loading="lazy" width="1520" height="855">'
        for i in range(1, n + 1))
    return f'<div class="wc-slides">{imgs}</div>'


def fix_slides(path, s):
    if path not in SLIDES:
        return s
    sid, n, width = SLIDES[path]
    pat = re.compile(r'<iframe src="https://www\.dropbox\.com/scl/fi/' + sid + r'/[^"]*"[^>]*>\s*</iframe>')
    s2, k = pat.subn(slides_html(path, n, width), s)
    if k != 1:
        raise SystemExit(f'{path}: Dropbox iframe が {k} 件（1件のはず）')
    return s2


def fix_dev_urls(path, s):
    # <a> タグ単位で置き換える（devの番号の data-lms-route が既に付いているものがある）
    def repl(m):
        tag = m.group(0)
        route = re.search(r'href="' + re.escape(DEV) + r'(/[^"]*)"', tag).group(1)
        route = DEV_MODULES.get(route, route)
        if 'module=' in route and route not in DEV_MODULES.values():
            raise SystemExit(f'{path}: 本番の番号が分からない {route}')
        tag = re.sub(r'\s+data-lms-route="[^"]*"', '', tag)
        return re.sub(r'href="' + re.escape(DEV) + r'/[^"]*"', f'href="{PROD}{route}" data-lms-route="{route}"', tag)
    return re.sub(r'<a\b[^>]*href="' + re.escape(DEV) + r'/[^"]*"[^>]*>', repl, s)


def fix_one(path, s):
    s = fix_slides(path, s)
    s = fix_dev_urls(path, s)
    if path == 'web-design/html/chior.html':
        s, k = re.subn(r'<a href="#heading9">(アンカーの復習はこちら)', r'<a href="#heading62">\1', s)
        assert k == 1, k
    if path == 'web-design/html/zth10.html':
        s, k = re.subn(r'(-応用編-) では</strong>\s*では、', r'\1</strong> では、', s)
        assert k == 2, k
    if path == 'web-design/html/9ypxf.html':
        for old, new in DOWNLOADS.items():
            assert s.count(f'href="{old}"') == 1, old
            s = s.replace(f'href="{old}"', f'href="{new}"')
    return s


def main():
    changed = []
    for root, _, files in os.walk(SRC):
        for f in files:
            if not f.endswith('.html'):
                continue
            full = os.path.join(root, f)
            rel = os.path.relpath(full, SRC)
            s = open(full, encoding='utf-8').read()
            s2 = fix_one(rel, s)
            if s2 != s:
                os.makedirs(os.path.dirname(os.path.join(OUT, rel)), exist_ok=True)
                open(os.path.join(OUT, rel), 'w', encoding='utf-8').write(s2)
                changed.append(rel)
    missing = [p for p in SLIDES if p not in changed]
    if missing:
        raise SystemExit(f'直っていないページ: {missing}')
    print('\n'.join(sorted(changed)))
    print(f'{len(changed)} files')


main()
