#!/usr/bin/env python3
"""Generate bento-grid thumbnails from real screenshots.

Crops each screenshot to the exact aspect ratios needed for a
2-column bento grid so cells align perfectly without rowspans.

Output: Shots/thumbs/
"""
import os
from PIL import Image

THUMB_DIR = "Shots/thumbs"
os.makedirs(THUMB_DIR, exist_ok=True)

screenshots = {
    "playing-full": "Shots/playing-full.png",
    "playing-visualizer": "Shots/playing-visualizer.png",
    "playing-lyrics": "Shots/playing-lyrics.png",
    "playing-green": "Shots/playing-green.png",
    "paused": "Shots/paused.png",
}


def crop_center(img, w, h):
    """Crop to center square/rectangle."""
    iw, ih = img.size
    # Scale so the crop fits within the image
    scale = max(w / iw, h / ih)
    sw, sh = int(w * scale), int(h * scale)
    x = (iw - sw) // 2
    y = (ih - sh) // 2
    return img.crop((x, y, x + sw, y + sh)).resize((w, h), Image.LANCZOS)


for name, path in screenshots.items():
    img = Image.open(path).convert("RGB")

    # Wide hero (2×1 cells)
    crop_center(img, 1000, 500).save(os.path.join(THUMB_DIR, f"{name}-wide.png"))
    # Square (1×1 cells)
    crop_center(img, 500, 500).save(os.path.join(THUMB_DIR, f"{name}-square.png"))

    print(f"✓ {name}: wide + square thumbnails")

print(f"\nAll thumbnails in {THUMB_DIR}/")
