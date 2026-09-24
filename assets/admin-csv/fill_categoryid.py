"""02_moodle_courses.csv の categoryid を、カテゴリ管理の「全件ダウンロード」CSVから埋める。

使い方: python3 fill_categoryid.py all_categories_YYYY-MM-DD.csv
出力:   03_moodle_courses_upload.csv（これを「Moodleコース作成」でアップロードする）
"""
import csv
import sys
from pathlib import Path

here = Path(__file__).parent
with open(sys.argv[1], encoding='utf-8-sig', newline='') as f:
    ids = {r['name'].strip(): r['id'].strip() for r in csv.DictReader(f)}

with open(here / '02_moodle_courses.csv', encoding='utf-8', newline='') as f:
    rows = list(csv.DictReader(f))

missing = sorted({r['area'] for r in rows if r['area'] not in ids})
if missing:
    sys.exit(f'Moodleにカテゴリがありません: {", ".join(missing)}（先に 01_categories.csv を登録）')

for r in rows:
    r['categoryid'] = ids[r['area']]

# アップロード画面はBOMを外さないので、BOM無し・LFで書く
with open(here / '03_moodle_courses_upload.csv', 'w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), lineterminator='\n')
    w.writeheader()
    w.writerows(rows)
print(f'{len(rows)}件 → 03_moodle_courses_upload.csv')
