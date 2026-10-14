#!/usr/bin/env python3
"""教材HTMLの旧サイト（learn.webcoach.jp）へのリンクを、本番 LMS のレッスン URL に直接書き換える（2026-10-14）

lms-embed.js は表示時に lesson-map.json を読んで data-lms-route を付けるが、
CloudFront に UAT 用の古い表が残っていると UAT の番号へ飛んでしまい、href も learn.webcoach.jp のままになる。
HTML 側に本番の URL と data-lms-route を書いておけば、表の配信に左右されない。

  python3 rewrite_learn_links.py SRC OUT [lesson-map.prod.json]

SRC の .html を読み、変わったものだけ OUT に同じ相対パスで書き出す。表に無いリンク（unlink・未登録）はそのまま。
"""
import json
import os
import re
import sys
import urllib.parse

SRC, OUT = sys.argv[1], sys.argv[2]
MAP = sys.argv[3] if len(sys.argv) > 3 else os.path.join(
    os.path.dirname(__file__), '../../assets/materials/_assets/lesson-map.prod.json')
PROD = 'https://study.webcoach.jp'
routes = json.load(open(MAP, encoding='utf-8'))['routes']

A_TAG = re.compile(r'<a\b[^>]*\bhref="https?://learn\.webcoach\.jp[^"]*"[^>]*>', re.I)
HREF = re.compile(r'\bhref="(https?://learn\.webcoach\.jp[^"]*)"', re.I)


def key_of(href):
    # lms-embed.js の keyOf と同じ：記事は末尾5文字の ID、一覧ページはパス
    m = re.match(r'https?://learn\.webcoach\.jp(/[^?#]*)', href, re.I)
    if not m:
        return None
    p = urllib.parse.unquote(m.group(1)).lower().rstrip('/')
    if re.search(r'/(theme|media)/|\.(png|jpe?g|gif|svg|webp|pdf|rss)$', p):
        return None
    k = p[p.rfind('/') + 1:]
    return k if re.fullmatch(r'[a-z0-9]{5}', k) else p.lstrip('/')


stats = {'files': 0, 'links': 0, 'left': {}}


def repl(m):
    tag = m.group(0)
    k = key_of(HREF.search(tag).group(1))
    route = routes.get(k) if k else None
    if not route:
        stats['left'][k] = stats['left'].get(k, 0) + 1
        return tag
    stats['links'] += 1
    tag = re.sub(r'\s+data-lms-route="[^"]*"', '', tag)
    return HREF.sub(f'href="{PROD}{route}" data-lms-route="{route}"', tag, count=1)


for root, _, files in os.walk(SRC):
    for f in files:
        if not f.endswith('.html'):
            continue
        rel = os.path.relpath(os.path.join(root, f), SRC)
        s = open(os.path.join(SRC, rel), encoding='utf-8').read()
        s2 = A_TAG.sub(repl, s)
        if s2 != s:
            os.makedirs(os.path.dirname(os.path.join(OUT, rel)), exist_ok=True)
            open(os.path.join(OUT, rel), 'w', encoding='utf-8').write(s2)
            stats['files'] += 1

print(f"{stats['files']} files, {stats['links']} links")
print('表に無く残したリンク:', sum(stats['left'].values()), sorted(stats['left'].items(), key=lambda x: -x[1])[:30])
