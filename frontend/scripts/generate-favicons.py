#!/usr/bin/env python
"""ファビコン一式を1枚の元画像から生成する。

使い方（frontend/ で実行）:
    python scripts/generate-favicons.py

元画像の優先順:
  1. assets/favicon-source.png  … 赤地・白ロゴの正方形PNG（あればそれを使う）
  2. public/logo_WEBCOACH.png   … 透過ロゴを白へ置き換え、赤地に載せて合成

生成物はすべて public/ 直下に出力する。
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
SOURCE_SQUARE = ROOT / "assets" / "favicon-source.png"
SOURCE_LOGO = PUBLIC / "logo_WEBCOACH.png"

# 赤地。ブランドの朱赤に合わせている。
BRAND_RED = (225, 37, 29, 255)
MASTER = 512
# 正方形キャンバスに対するロゴ横幅の比率
LOGO_WIDTH_RATIO = 0.86


def build_master() -> Image.Image:
    """512x512 のマスター画像を作る。"""
    if SOURCE_SQUARE.exists():
        return Image.open(SOURCE_SQUARE).convert("RGBA").resize(
            (MASTER, MASTER), Image.LANCZOS
        )

    logo = Image.open(SOURCE_LOGO).convert("RGBA")

    # 小さい元画像なので、一度大きく引き伸ばしてから縮める（輪郭が滑らかになる）
    logo = logo.resize((logo.width * 8, logo.height * 8), Image.LANCZOS)

    # 不透明な部分をすべて白へ。アルファはそのまま残す。
    alpha = logo.getchannel("A")
    logo = Image.new("RGBA", logo.size, (255, 255, 255, 255))
    logo.putalpha(alpha)

    target_w = int(MASTER * LOGO_WIDTH_RATIO)
    target_h = max(1, round(target_w * logo.height / logo.width))
    logo = logo.resize((target_w, target_h), Image.LANCZOS)

    canvas = Image.new("RGBA", (MASTER, MASTER), BRAND_RED)
    canvas.alpha_composite(
        logo, ((MASTER - target_w) // 2, (MASTER - target_h) // 2)
    )
    return canvas


def main() -> None:
    master = build_master()

    for size, name in ((512, "favicon-512.png"), (192, "favicon-192.png")):
        master.resize((size, size), Image.LANCZOS).save(PUBLIC / name)
        print("wrote", name)

    # iOS のホーム画面用。透過を持てないので RGB で書き出す。
    master.resize((180, 180), Image.LANCZOS).convert("RGB").save(
        PUBLIC / "apple-touch-icon.png"
    )
    print("wrote apple-touch-icon.png")

    master.save(
        PUBLIC / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )
    print("wrote favicon.ico")


if __name__ == "__main__":
    main()
