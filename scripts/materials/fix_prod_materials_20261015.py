#!/usr/bin/env python3
"""本番教材の修正（2026-10-15、ビジネスサイドの回答を受けて）

  python3 fix_prod_materials_20261015.py SRC OUT

SRC は本番S3の教材のコピー（10-14 のリンク書き換え後の版）。変わったファイルだけ OUT に同じ相対パスで書き出す。
  - Illustrator 1〜3章（vtwf1・bfxto・ss3wt）：中身の無い「作業動画」見出しを目次ごと消す（動画は原本にも無く、不要と回答あり）
  - Photoshop -実践編-（9ypxf）：Notion の消えた psd（403）を _downloads/parallax_effect_skycar.psd へ
  - Wix実践 -中級編-（chior）：デベロッパーツールの説明画像 3 枚を差し替え（_assets/wix-devtools-01〜03.webp）
"""
import os
import re
import sys

SRC, OUT = sys.argv[1], sys.argv[2]
done = {}


def edit(rel, fn):
    s = open(os.path.join(SRC, rel), encoding='utf-8').read()
    s2 = fn(s)
    assert s2 != s, rel
    os.makedirs(os.path.dirname(os.path.join(OUT, rel)), exist_ok=True)
    open(os.path.join(OUT, rel), 'w', encoding='utf-8').write(s2)
    done[rel] = True


def drop_video_headings(s):
    heads = re.findall(r'<h\d id="(heading\d+)">作業動画</h\d>', s)
    assert heads
    s = re.sub(r'\s*<div class="article-item item_markdown " id="item\d+"[^>]*><h\d id="heading\d+">作業動画</h\d>\s*</div>', '', s)
    # 見出しでなく箇条書き「・作業動画」の形のもの（ss3wt に 3 か所。続く動画の項目が無い）
    s = re.sub(r'\s*<div class="article-item item_html " id="item\d+"[^>]*><div class="item-body"><ul>\s*<li>作業動画</li>\s*</ul></div></div>', '', s)
    for h in heads:
        s, n = re.subn(rf'<li><a href="#{h}" class="tocLink">作業動画</a></li>', '', s)
        assert n >= 1, h
    return s


def ss3wt(s):
    s = drop_video_headings(s)
    # 消えた動画を指す文言を、手順の例として読めるようにする
    s = s.replace('<li>動画では、dog.psdというPhotoshopのファイルをIllustratorへリンク配置しています。',
                  '<li>例：dog.psdというPhotoshopのファイルをIllustratorへリンク配置した場合')
    return s.replace('（動画では切り抜きを実施）', '（例：切り抜き）')


def psd(s):
    old = 'https://s3-us-west-2.amazonaws.com/secure.notion-static.com/57d629a8-7813-4eee-bde0-b95cf9f8d4c3/parallax_effect_skycar.psd'
    s = s.replace(f'href="{old}" rel="nofollow noopener noreferrer" target="_blank"',
                  'href="../../_downloads/parallax_effect_skycar.psd" download')
    return s.replace(f'data-reference="{old}"', 'data-reference=""')


def wix(s):
    for n, item in enumerate(['42993', '42996', '42999'], 1):
        img = f'../../_assets/wix-devtools-0{n}.webp'
        s, c = re.subn(
            rf'(id="item{item}"[^>]*><div class="image-large"><a class="lightbox" href=")[^"]*(" title=""><img [^>]*src=")[^"]*(" width="640" height=")360(")',
            rf'\g<1>{img}\g<2>{img}\g<3>318\g<4>', s)
        assert c == 1, item
    return s


edit('web-design/html/vtwf1.html', drop_video_headings)
edit('web-design/html/bfxto.html', drop_video_headings)
edit('web-design/html/ss3wt.html', ss3wt)
edit('web-design/html/9ypxf.html', psd)
edit('web-design/html/chior.html', wix)
print(len(done), 'files:', ', '.join(done))
