"""Generate the BlexAgent platform icon set from the approved brand artwork.

The supplied artwork contains a white mark on a blue background.  This script
keeps that mark as the source of truth, creates a clean high-resolution blue
application icon, and derives a monochrome transparent mark for the macOS
template tray icon.  It intentionally does not touch third-party or workspace
icons.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "src-tauri" / "icons"
BRAND_DIR = ROOT / "src" / "renderer" / "assets" / "brand"
RUNTIME_DIR = ROOT / "src" / "renderer" / "assets" / "runtime-icons"
DEFAULT_SOURCE = BRAND_DIR / "brand-source.jpg"

# The product's new primary surface colour.  The mark is sampled from the
# approved image, while the solid surface keeps icon edges clean at 16px.
BLUE_TOP = (40, 38, 203)
BLUE_BOTTOM = (26, 25, 172)


def alpha_mark(source: Image.Image) -> Image.Image:
    """Extract the near-white supplied mark while preserving its antialiasing."""
    rgb = source.convert("RGB")
    alpha = Image.new("L", rgb.size)
    pixels = []
    for red, green, blue in rgb.get_flattened_data():
        # The artwork has a saturated blue field and a nearly neutral white
        # glyph.  Luminance minus chroma cleanly separates them without making
        # the blue field semi-transparent.
        low, high = min(red, green, blue), max(red, green, blue)
        luminance = (299 * red + 587 * green + 114 * blue) / 1000
        chroma = high - low
        coverage = (luminance - 180) * 3.4 - max(0, chroma - 30) * 0.6
        pixels.append(max(0, min(255, round(coverage))))
    alpha.putdata(pixels)
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.35))
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError("No light brand mark could be extracted from the source image")
    return alpha.crop(bbox)


def canvas(size: int) -> Image.Image:
    """Create the rounded primary app surface with transparent outer corners."""
    scale = 4
    scaled_size = size * scale
    surface = Image.new("RGB", (scaled_size, scaled_size))
    pixels = []
    for y in range(scaled_size):
        t = y / max(1, scaled_size - 1)
        row_colour = tuple(round(a * (1 - t) + b * t) for a, b in zip(BLUE_TOP, BLUE_BOTTOM))
        pixels.extend([row_colour] * scaled_size)
    surface.putdata(pixels)

    # One fifth of the edge makes the application mark read as a rounded
    # rectangle at normal sizes without becoming a circular badge.  Draw at
    # 4x so the small Store and tray-adjacent assets retain smooth corners.
    mask = Image.new("L", (scaled_size, scaled_size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, scaled_size - 1, scaled_size - 1),
        radius=round(scaled_size * 0.2),
        fill=255,
    )
    image = surface.convert("RGBA")
    image.putalpha(mask)
    return image.resize((size, size), Image.Resampling.LANCZOS)


def color_icon(mark: Image.Image, size: int) -> Image.Image:
    icon = canvas(size)
    # Preserve the original mark's proportions and leave a generous safe area
    # for rounded macOS/Windows icon masks.
    max_side = round(size * 0.62)
    scale = min(max_side / mark.width, max_side / mark.height)
    resized = mark.resize((round(mark.width * scale), round(mark.height * scale)), Image.Resampling.LANCZOS)
    glyph = Image.new("RGBA", resized.size, (255, 255, 255, 0))
    glyph.putalpha(resized)
    icon.alpha_composite(glyph, ((size - glyph.width) // 2, (size - glyph.height) // 2))
    return icon


def tray_icon(mark: Image.Image, size: int) -> Image.Image:
    # Template images are recoloured by macOS.  A transparent canvas with an
    # opaque monochrome glyph is the required form; the pixel colour itself is
    # irrelevant, but black makes the asset inspectable outside macOS.
    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    max_side = round(size * 0.84)
    scale = min(max_side / mark.width, max_side / mark.height)
    resized = mark.resize((round(mark.width * scale), round(mark.height * scale)), Image.Resampling.LANCZOS)
    glyph = Image.new("RGBA", resized.size, (0, 0, 0, 255))
    glyph.putalpha(resized)
    icon.alpha_composite(glyph, ((size - glyph.width) // 2, (size - glyph.height) // 2))
    return icon


def save_png(image: Image.Image, path: Path) -> None:
    image.save(path, format="PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    args = parser.parse_args()
    if not args.source.is_file():
        raise SystemExit(f"Brand source image not found: {args.source}")

    with Image.open(args.source) as image:
        mark = alpha_mark(image)

    ICON_DIR.mkdir(parents=True, exist_ok=True)
    BRAND_DIR.mkdir(parents=True, exist_ok=True)
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)

    master = color_icon(mark, 1024)
    save_png(master, BRAND_DIR / "brand-icon.png")
    for filename, size in {
        "32x32.png": 32,
        "64x64.png": 64,
        "128x128.png": 128,
        "128x128@2x.png": 256,
        "icon.png": 512,
        "Square30x30Logo.png": 30,
        "Square44x44Logo.png": 44,
        "Square71x71Logo.png": 71,
        "Square89x89Logo.png": 89,
        "Square107x107Logo.png": 107,
        "Square142x142Logo.png": 142,
        "Square150x150Logo.png": 150,
        "Square284x284Logo.png": 284,
        "Square310x310Logo.png": 310,
        "StoreLogo.png": 50,
    }.items():
        save_png(color_icon(mark, size), ICON_DIR / filename)

    save_png(color_icon(mark, 40), BRAND_DIR / "blexagent-web-logo.png")
    save_png(color_icon(mark, 128), RUNTIME_DIR / "blexagent.png")

    for filename, size in {
        "trayIconTemplate.png": 16,
        "trayIconTemplate22.png": 22,
        "trayIconTemplate@2x.png": 32,
    }.items():
        save_png(tray_icon(mark, size), ICON_DIR / filename)

    # Pillow writes all standard Windows/macOS representations from the same
    # canonical asset, preventing platform branding drift.
    master.save(
        ICON_DIR / "icon.ico",
        format="ICO",
        sizes=[(16, 16), (20, 20), (24, 24), (32, 32), (40, 40), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    master.save(
        ICON_DIR / "icon.icns",
        format="ICNS",
        sizes=[(16, 16), (32, 32), (64, 64), (128, 128), (256, 256), (512, 512), (1024, 1024)],
    )


if __name__ == "__main__":
    main()
