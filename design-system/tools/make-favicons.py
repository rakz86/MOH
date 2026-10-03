"""Generate the browser icon set from the source emblem.

    python design-system/tools/make-favicons.py

Runs from anywhere: paths resolve relative to this file, not the cwd.

The emblem is 774x875 and carries transparent margin. A favicon is square and
often 16px, so the mark is trimmed to its own bounding box first and then
centred on a square canvas. Skipping the trim wastes roughly a fifth of the
tile on empty space, which at 16px is the difference between a readable mark
and a smudge.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent      # design-system/
SRC = ROOT / "assets" / "emblem-colour.png"
OUT = ROOT / "assets" / "favicon"

PNG_SIZES = {
    "icon-16.png": 16,
    "icon-32.png": 32,
    "icon-48.png": 48,
    "icon-192.png": 192,
    "icon-512.png": 512,
}
APPLE_TOUCH = 180
ICO_SIZES = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
MARGIN = 1.06     # a little breathing room so the mark is not flush to the edge


def square_canvas(src):
    mark = src.crop(src.getbbox())
    side = int(max(mark.size) * MARGIN)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(mark, ((side - mark.width) // 2, (side - mark.height) // 2), mark)
    return canvas


def main():
    if not SRC.exists():
        raise SystemExit("missing source emblem: %s" % SRC)

    OUT.mkdir(parents=True, exist_ok=True)
    canvas = square_canvas(Image.open(SRC).convert("RGBA"))

    for name, size in PNG_SIZES.items():
        canvas.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
        print("%-24s %dx%d" % (name, size, size))

    # iOS ignores transparency on the home screen and composites onto black,
    # which would hide the emblem black outlines. Flatten onto white instead.
    touch = canvas.resize((APPLE_TOUCH, APPLE_TOUCH), Image.LANCZOS)
    flat = Image.new("RGBA", touch.size, (255, 255, 255, 255))
    flat.paste(touch, (0, 0), touch)
    flat.convert("RGB").save(OUT / "apple-touch-icon.png", optimize=True)
    print("%-24s %dx%d (flattened on white)" % ("apple-touch-icon.png", APPLE_TOUCH, APPLE_TOUCH))

    canvas.resize((256, 256), Image.LANCZOS).save(OUT / "favicon.ico", sizes=ICO_SIZES)
    print("%-24s %s" % ("favicon.ico", ", ".join("%dx%d" % s for s in ICO_SIZES)))


if __name__ == "__main__":
    main()
