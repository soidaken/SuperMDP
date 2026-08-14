"""生成 SuperMDP 应用图标（可复现脚本）。

设计：黑色背景 + 2×2 四格 + 每格居中白色加粗大写字母 S/M/D/P。
源文件：build/appicon.svg（视觉一致，仅作源/预览）。
产物：
  - build/appicon.png        （256×256，Wails 跨平台默认图标）
  - build/windows/icon.ico   （16/32/48/64/128/256 多尺寸，Windows exe 嵌入）

用法：python tools/gen_icon.py
依赖：Pillow（pip install pillow）
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_PATH = "C:/Windows/Fonts/arialbd.ttf"  # Arial Bold，Windows 系统自带

# 比例常量（相对 512 设计基准，任意尺寸按比例缩放）
MARGIN_RATIO = 8 / 512      # 外留白
GAP_RATIO = 8 / 512         # 格子间距
FONT_RATIO = 150 / 512      # 字母字号
STROKE_RATIO = 2 / 512      # 格子描边宽
RADIUS_RATIO = 10 / 512     # 格子圆角


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 255))
    d = ImageDraw.Draw(img)

    margin = max(2, round(size * MARGIN_RATIO))
    gap = max(2, round(size * GAP_RATIO))
    cell = (size - gap - 2 * margin) // 2
    radius = max(1, round(size * RADIUS_RATIO))
    stroke = max(1, round(size * STROKE_RATIO))
    font = ImageFont.truetype(FONT_PATH, max(8, round(size * FONT_RATIO)))

    letters = ["S", "M", "D", "P"]
    positions = [
        (margin, margin),
        (margin + cell + gap, margin),
        (margin, margin + cell + gap),
        (margin + cell + gap, margin + cell + gap),
    ]
    for (cx, cy), ch in zip(positions, letters):
        d.rounded_rectangle(
            [cx, cy, cx + cell, cy + cell],
            radius=radius,
            fill=(10, 10, 10, 255),       # 格子底：近黑
            outline=(34, 34, 34, 255),    # 格子描边：深灰，让四格可辨
            width=stroke,
        )
        d.text(
            (cx + cell / 2, cy + cell / 2),
            ch,
            font=font,
            fill=(255, 255, 255, 255),    # 字母：纯白
            anchor="mm",                  # 水平垂直居中
        )
    return img


def main() -> None:
    build_dir = os.path.join(ROOT, "app", "build")
    img256 = draw_icon(256)
    img256.save(os.path.join(build_dir, "appicon.png"))

    sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    img256.save(os.path.join(build_dir, "windows", "icon.ico"), sizes=sizes)
    print(f"OK: app/build/appicon.png (256x256) + app/build/windows/icon.ico ({len(sizes)} sizes)")


if __name__ == "__main__":
    main()
