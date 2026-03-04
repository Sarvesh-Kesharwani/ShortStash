"""Generate PNG icons from scratch using Pillow."""
from PIL import Image, ImageDraw
import math

def create_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    s = size / 128.0  # scale factor

    # Rounded square background - purple gradient approximation
    r = int(24 * s)
    margin = int(8 * s)
    box = [margin, margin, size - margin, size - margin]
    draw.rounded_rectangle(box, radius=r, fill=(108, 92, 231))

    # White bookmark/card shape
    card_r = int(6 * s)
    card_box = [int(36 * s), int(30 * s), int(98 * s), int(98 * s)]
    draw.rounded_rectangle(card_box, radius=card_r, fill=(255, 255, 255, 242))

    # Play triangle
    p1 = (int(56 * s), int(48 * s))
    p2 = (int(56 * s), int(80 * s))
    p3 = (int(80 * s), int(64 * s))
    draw.polygon([p1, p2, p3], fill=(108, 92, 231))

    # Green plus badge
    cx, cy, cr = int(92 * s), int(92 * s), int(18 * s)
    draw.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=(0, 184, 148))
    # Plus sign
    bar_w = int(8 * s)
    bar_h = int(20 * s)
    # Vertical bar
    draw.rounded_rectangle(
        [cx - bar_w // 2, cy - bar_h // 2, cx + bar_w // 2, cy + bar_h // 2],
        radius=int(2 * s), fill=(255, 255, 255)
    )
    # Horizontal bar
    draw.rounded_rectangle(
        [cx - bar_h // 2, cy - bar_w // 2, cx + bar_h // 2, cy + bar_w // 2],
        radius=int(2 * s), fill=(255, 255, 255)
    )

    return img

for sz in [16, 48, 128]:
    icon = create_icon(sz)
    icon.save(f'd:/categorize_shorts/icons/icon{sz}.png')
    print(f'Created icon{sz}.png')
