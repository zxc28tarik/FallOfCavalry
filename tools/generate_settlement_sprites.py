from __future__ import annotations

import argparse
import random
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUT_BASE = ROOT / "assets" / "settlements" / "generated"
OUT_FACTION = OUT_BASE / "factions" / "ottoman"
OUT_VARIANTS = OUT_BASE / "variants"
SH_BASE = ROOT / "assets" / "settlements" / "stronghold"
FORT_SOURCE = ROOT / "assets" / "settlements" / "fort-main-game.png"


def _clamp(v: int) -> int:
    return max(0, min(255, int(v)))


def _shade(color: tuple[int, int, int, int], delta: int) -> tuple[int, int, int, int]:
    return (_clamp(color[0] + delta), _clamp(color[1] + delta), _clamp(color[2] + delta), color[3])


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def _line_points(p0: tuple[int, int], p1: tuple[int, int], count: int) -> Iterable[tuple[int, int]]:
    for i in range(max(1, count)):
        t = 0.5 if count <= 1 else i / (count - 1)
        yield (int(round(_lerp(p0[0], p1[0], t))), int(round(_lerp(p0[1], p1[1], t))))


@dataclass(frozen=True)
class Style:
    name: str
    saturation: float
    contrast: float
    brightness: float
    plaster: tuple[int, int, int, int]
    roof_dark: tuple[int, int, int, int]
    roof_mid: tuple[int, int, int, int]
    roof_light: tuple[int, int, int, int]
    wood_dark: tuple[int, int, int, int]
    wood_mid: tuple[int, int, int, int]
    dome_dark: tuple[int, int, int, int]
    dome_mid: tuple[int, int, int, int]
    dome_light: tuple[int, int, int, int]
    accent: tuple[int, int, int, int]


STRONGHOLD = Style(
    name="stronghold",
    saturation=0.96,
    contrast=1.08,
    brightness=1.02,
    plaster=(196, 180, 154, 232),
    roof_dark=(90, 62, 40, 232),
    roof_mid=(130, 92, 61, 232),
    roof_light=(176, 133, 96, 232),
    wood_dark=(74, 52, 34, 232),
    wood_mid=(108, 78, 52, 232),
    dome_dark=(74, 90, 105, 232),
    dome_mid=(109, 131, 148, 232),
    dome_light=(167, 188, 205, 232),
    accent=(175, 58, 48, 236),
)

HOMM = Style(
    name="homm",
    saturation=1.12,
    contrast=1.05,
    brightness=1.03,
    plaster=(224, 205, 183, 232),
    roof_dark=(103, 45, 43, 232),
    roof_mid=(158, 68, 62, 232),
    roof_light=(210, 117, 90, 232),
    wood_dark=(76, 46, 36, 232),
    wood_mid=(116, 70, 50, 232),
    dome_dark=(52, 77, 116, 232),
    dome_mid=(82, 122, 173, 232),
    dome_light=(137, 171, 216, 232),
    accent=(216, 190, 92, 236),
)


def _load_modules() -> dict[str, Image.Image]:
    names = {
        "wall_front": "wall-front-v2.png",
        "wall_left": "wall-left-v2.png",
        "wall_right": "wall-right-v2.png",
        "wall_plain": "wall-plain-v2.png",
        "tower_left": "tower-left-v2.png",
        "tower_right": "tower-right-v2.png",
    }
    out: dict[str, Image.Image] = {}
    for key, name in names.items():
        p = SH_BASE / name
        if not p.exists():
            raise FileNotFoundError(f"Missing module: {p}")
        out[key] = Image.open(p).convert("RGBA")
    return out


def _tint_module(img: Image.Image, style: Style) -> Image.Image:
    out = ImageEnhance.Color(img).enhance(style.saturation)
    out = ImageEnhance.Contrast(out).enhance(style.contrast)
    out = ImageEnhance.Brightness(out).enhance(style.brightness)
    return out


def _paste_bottom_center(
    canvas: Image.Image,
    sprite: Image.Image,
    x: int,
    y: int,
    scale_x: float,
    scale_y: float,
) -> None:
    w = max(1, int(round(sprite.width * scale_x)))
    h = max(1, int(round(sprite.height * scale_y)))
    resized = sprite.resize((w, h), Image.Resampling.LANCZOS)
    dx = int(round(x - w * 0.5))
    dy = int(round(y - h))
    canvas.alpha_composite(resized, (dx, dy))


def _paste_center_bottom(canvas: Image.Image, sprite: Image.Image, cx: int, cy: int) -> None:
    x = int(round(cx - sprite.width / 2))
    y = int(round(cy - sprite.height))
    canvas.alpha_composite(sprite, (x, y))


def _soft_tone(sprite: Image.Image, style: Style) -> Image.Image:
    out = ImageEnhance.Color(sprite).enhance(style.saturation)
    out = ImageEnhance.Contrast(out).enhance(style.contrast)
    out = ImageEnhance.Brightness(out).enhance(style.brightness)
    return out


def _draw_wall_ring(
    img: Image.Image,
    outer: list[tuple[int, int]],
    inner: list[tuple[int, int]],
    style: Style,
    crenel_count: int,
) -> None:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    wall = _shade(style.plaster, -8)
    wall_dark = _shade(style.plaster, -36)
    wall_light = _shade(style.plaster, 16)
    d.polygon(outer, fill=wall)
    d.polygon(inner, fill=(0, 0, 0, 0))
    d.line(outer + [outer[0]], fill=wall_dark, width=2)
    d.line(inner + [inner[0]], fill=wall_dark, width=2)
    for a, b in ((outer[0], outer[1]), (outer[1], outer[2]), (outer[2], outer[3]), (outer[3], outer[0])):
        for x, y in _line_points(a, b, crenel_count):
            d.rectangle((x - 2, y - 5, x + 2, y - 2), fill=wall_light)
            d.rectangle((x - 2, y - 1, x + 2, y), fill=wall_dark)
    img.alpha_composite(layer)


def _draw_roof_block(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, style: Style) -> None:
    wall = _shade(style.plaster, -4)
    draw.rectangle((x, y, x + w, y + h), fill=wall)
    draw.rectangle((x, y + h - 1, x + w, y + h), fill=_shade(style.plaster, -34))
    draw.polygon([(x - 2, y + 1), (x + w // 2, y - max(4, h // 2)), (x + w + 2, y + 1)], fill=style.roof_dark)
    draw.polygon([(x, y + 2), (x + w // 2, y - max(3, h // 2 - 1)), (x + w, y + 2)], fill=style.roof_mid)


def _draw_dome(draw: ImageDraw.ImageDraw, cx: int, cy: int, rx: int, ry: int, style: Style) -> None:
    draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=style.dome_dark)
    draw.pieslice((cx - int(rx * 0.88), cy - int(ry * 0.22), cx + int(rx * 0.88), cy + int(ry * 1.2)), 180, 360, fill=style.dome_mid)
    draw.ellipse((cx - int(rx * 0.56), cy - int(ry * 0.86), cx - int(rx * 0.08), cy - int(ry * 0.24)), fill=style.dome_light)


def _draw_minaret(draw: ImageDraw.ImageDraw, x: int, y: int, h: int, style: Style) -> None:
    w = max(4, int(h * 0.10))
    draw.rectangle((x, y - h, x + w, y), fill=_shade(style.plaster, -6))
    draw.rectangle((x, y - h, x + 1, y), fill=_shade(style.plaster, -24))
    draw.rectangle((x + w - 1, y - h, x + w, y), fill=_shade(style.plaster, 12))
    draw.polygon([(x - 1, y - h + 2), (x + w // 2, y - h - max(5, int(w * 1.4))), (x + w + 1, y - h + 2)], fill=style.roof_dark)
    draw.line([(x + w // 2, y - h - 2), (x + w // 2, y - h - 8)], fill=_shade(style.roof_light, 14), width=1)


def _draw_house(draw: ImageDraw.ImageDraw, x: int, y: int, rng: random.Random, style: Style) -> None:
    w = rng.randint(22, 34)
    h = rng.randint(15, 24)
    draw.polygon([(x, y), (x + w, y + 8), (x + w, y + h), (x, y + h - 8)], fill=_shade(style.plaster, -8))
    draw.polygon([(x, y), (x - w // 3, y + 8), (x - w // 3, y + h), (x, y + h - 8)], fill=_shade(style.plaster, -24))
    draw.polygon([(x - w // 3, y + 8), (x, y), (x + w, y + 8), (x + w - w // 3, y + 16)], fill=style.roof_mid)
    draw.polygon([(x - w // 3, y + 8), (x - w // 3 + 8, y + 2), (x, y), (x + 8, y + 2)], fill=style.roof_dark)
    draw.rectangle((x + w // 3 - 2, y + h - 8, x + w // 3 + 4, y + h - 1), fill=(38, 24, 16, 185))


def _stronghold_fort_core(style: Style, scale: float) -> Image.Image:
    modules = _load_modules()
    tinted = {k: _tint_module(v, style) for k, v in modules.items()}
    canvas = Image.new("RGBA", (1600, 1200), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas, "RGBA")
    cx, cy = 800, 840
    d.ellipse((cx - 360, cy + 10, cx + 360, cy + 130), fill=(0, 0, 0, 74))

    parts: list[tuple[int, str, int, int, float, float]] = []

    def add(name: str, x: int, y: int, sx: float = 1.0, sy: float = 1.0) -> None:
        parts.append((y, name, x, y, sx, sy))

    wall_sx = 1.42 * scale
    wall_sy = 0.35 * scale
    tower_sx = 1.72 * scale
    tower_sy = 0.44 * scale

    # Back wall chain.
    for i in range(-3, 4):
        add("wall_plain", cx + i * 56, cy - 220, wall_sx, wall_sy)
    # Left and right flanks.
    for i in range(1, 6):
        add("wall_left", cx - 170 - i * 30, cy - 220 + i * 40, wall_sx, wall_sy)
        add("wall_right", cx + 170 + i * 30, cy - 220 + i * 40, wall_sx, wall_sy)
    # Front wall.
    for i in range(-3, 4):
        add("wall_front", cx + i * 56, cy + 20, wall_sx, wall_sy)

    # Corner towers.
    add("tower_left", cx - 330, cy - 14, tower_sx, tower_sy)
    add("tower_right", cx + 330, cy - 14, tower_sx, tower_sy)
    add("tower_left", cx - 262, cy - 220, tower_sx, tower_sy)
    add("tower_right", cx + 262, cy - 220, tower_sx, tower_sy)

    # Inner keep stack.
    add("wall_plain", cx, cy - 120, 2.30 * scale, 0.43 * scale)
    add("wall_plain", cx, cy - 258, 1.86 * scale, 0.37 * scale)
    add("wall_front", cx, cy + 6, 2.22 * scale, 0.40 * scale)

    for _, name, x, y, sx, sy in sorted(parts, key=lambda it: it[0]):
        _paste_bottom_center(canvas, tinted[name], x, y, sx, sy)

    # Gate shadow/readability.
    d = ImageDraw.Draw(canvas, "RGBA")
    d.ellipse((cx - 52, cy + 2, cx + 52, cy + 40), fill=(24, 16, 11, 148))
    d.rectangle((cx - 24, cy - 36, cx + 24, cy + 30), fill=(32, 21, 15, 172))
    d.rectangle((cx - 28, cy - 40, cx + 28, cy - 34), fill=_shade(style.plaster, 12))

    return canvas


def _crop_alpha(img: Image.Image, pad: int = 12) -> Image.Image:
    bb = img.split()[-1].getbbox()
    if not bb:
        return img
    x0 = max(0, bb[0] - pad)
    y0 = max(0, bb[1] - pad)
    x1 = min(img.width, bb[2] + pad)
    y1 = min(img.height, bb[3] + pad)
    return img.crop((x0, y0, x1, y1))


def _draw_fort(style: Style) -> Image.Image:
    if style.name == "stronghold" and FORT_SOURCE.exists():
        out = Image.new("RGBA", (1180, 860), (0, 0, 0, 0))
        src = Image.open(FORT_SOURCE).convert("RGBA")
        src = _soft_tone(src, style).resize((930, 650), Image.Resampling.LANCZOS)
        _paste_center_bottom(out, src, 590, 760)
        d = ImageDraw.Draw(out, "RGBA")
        d.ellipse((350, 734, 830, 820), fill=(0, 0, 0, 72))
        _draw_minaret(d, 430, 610, 118, style)
        _draw_minaret(d, 725, 610, 118, style)
        return _crop_alpha(out)

    core = _stronghold_fort_core(style, 1.0)
    return _crop_alpha(core)


def _draw_city(style: Style) -> Image.Image:
    if style.name == "stronghold" and FORT_SOURCE.exists():
        rng = random.Random(42017)
        out = Image.new("RGBA", (1536, 1100), (0, 0, 0, 0))
        d = ImageDraw.Draw(out, "RGBA")
        outer = [(240, 590), (770, 430), (1305, 580), (785, 770)]
        inner = [(330, 600), (770, 470), (1210, 590), (785, 730)]
        _draw_wall_ring(out, outer, inner, style, crenel_count=22)

        src = Image.open(FORT_SOURCE).convert("RGBA")
        citadel = _soft_tone(src, style).resize((520, 364), Image.Resampling.LANCZOS)
        _paste_center_bottom(out, citadel, 792, 640)

        d = ImageDraw.Draw(out, "RGBA")
        d.rectangle((690, 526, 900, 610), fill=_shade(style.plaster, -2))
        d.rectangle((690, 608, 900, 612), fill=_shade(style.plaster, -34))
        _draw_dome(d, 795, 532, 72, 44, style)
        _draw_dome(d, 716, 555, 36, 22, style)
        _draw_dome(d, 874, 555, 36, 22, style)
        _draw_minaret(d, 648, 556, 142, style)
        _draw_minaret(d, 940, 556, 142, style)
        _draw_minaret(d, 690, 570, 112, style)
        _draw_minaret(d, 896, 570, 112, style)

        block_rows = [
            (562, 652, 10, 50, 42),
            (540, 686, 11, 48, 40),
            (606, 617, 9, 47, 38),
            (710, 708, 8, 46, 34),
        ]
        for start_x, y, count, step, base_w in block_rows:
            for i in range(count):
                bx = start_x + (i - count // 2) * step
                by = y + (i % 2) * 4
                bw = max(20, base_w - (i % 3) * 7)
                bh = max(14, 20 - (i % 2) * 4)
                _draw_roof_block(d, bx, by, bw, bh, style)

        for i in range(15):
            mx = 540 + i * 34
            my = 745 + (i % 2) * 5
            _draw_roof_block(d, mx, my, 24, 12, style)

        return _crop_alpha(out)

    rng = random.Random(7307 if style.name == "stronghold" else 9121)
    canvas = Image.new("RGBA", (1700, 1300), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas, "RGBA")
    cx, cy = 850, 900
    d.ellipse((cx - 430, cy + 14, cx + 430, cy + 154), fill=(0, 0, 0, 68))

    core = _stronghold_fort_core(style, 0.72)
    core = core.resize((int(core.width * 0.72), int(core.height * 0.72)), Image.Resampling.LANCZOS)
    canvas.alpha_composite(core, (cx - core.width // 2, cy - core.height + 20))

    # Dense urban houses around fortress.
    houses: list[tuple[int, int]] = []
    for _ in range(65):
        x = rng.randint(cx - 300, cx + 300)
        y = rng.randint(cy - 150, cy + 80)
        if abs(x - cx) / 330 + abs(y - (cy - 20)) / 210 <= 1.0:
            houses.append((x, y))
    for x, y in sorted(houses, key=lambda p: p[1]):
        _draw_house(d, x, y, rng, style)

    # Ottoman civic center.
    _draw_dome(d, cx + 6, cy - 188, 82, 50, style)
    _draw_dome(d, cx - 88, cy - 156, 38, 23, style)
    _draw_dome(d, cx + 98, cy - 156, 38, 23, style)
    _draw_minaret(d, cx - 198, cy - 138, 162, style)
    _draw_minaret(d, cx + 185, cy - 138, 162, style)
    _draw_minaret(d, cx - 145, cy - 122, 120, style)
    _draw_minaret(d, cx + 134, cy - 122, 120, style)

    # Front bazaar strip.
    for i in range(22):
        bx = cx - 340 + i * 32
        by = cy + 106 + (i % 2) * 5
        _draw_house(d, bx, by, rng, style)

    return _crop_alpha(canvas)


def _draw_town(style: Style) -> Image.Image:
    if style.name == "stronghold" and FORT_SOURCE.exists():
        rng = random.Random(15073)
        out = Image.new("RGBA", (1280, 920), (0, 0, 0, 0))
        d = ImageDraw.Draw(out, "RGBA")
        outer = [(210, 525), (640, 395), (1065, 520), (645, 665)]
        inner = [(280, 532), (640, 430), (995, 528), (645, 638)]
        _draw_wall_ring(out, outer, inner, style, crenel_count=16)

        src = Image.open(FORT_SOURCE).convert("RGBA")
        keep = _soft_tone(src, style).resize((520, 360), Image.Resampling.LANCZOS)
        _paste_center_bottom(out, keep, 645, 570)

        d = ImageDraw.Draw(out, "RGBA")
        for i in range(6):
            bx = 455 + i * 62
            by = 585 + (i % 2) * 6
            _draw_roof_block(d, bx, by, 38, 20, style)

        _draw_dome(d, 645, 525, 38, 24, style)
        _draw_minaret(d, 560, 525, 92, style)
        _draw_minaret(d, 725, 525, 92, style)
        return _crop_alpha(out)

    rng = random.Random(3821 if style.name == "stronghold" else 4877)
    canvas = Image.new("RGBA", (1450, 1100), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas, "RGBA")
    cx, cy = 725, 790
    d.ellipse((cx - 330, cy + 14, cx + 330, cy + 124), fill=(0, 0, 0, 62))

    core = _stronghold_fort_core(style, 0.62)
    core = core.resize((int(core.width * 0.62), int(core.height * 0.62)), Image.Resampling.LANCZOS)
    canvas.alpha_composite(core, (cx - core.width // 2, cy - core.height + 18))

    houses: list[tuple[int, int]] = []
    for _ in range(36):
        x = rng.randint(cx - 220, cx + 220)
        y = rng.randint(cy - 110, cy + 60)
        if abs(x - cx) / 250 + abs(y - (cy - 10)) / 165 <= 1.0:
            houses.append((x, y))
    for x, y in sorted(houses, key=lambda p: p[1]):
        _draw_house(d, x, y, rng, style)

    _draw_dome(d, cx + 4, cy - 138, 56, 34, style)
    _draw_minaret(d, cx - 132, cy - 118, 118, style)
    _draw_minaret(d, cx + 118, cy - 118, 118, style)
    return _crop_alpha(canvas)


def _draw_village(style: Style) -> Image.Image:
    if style.name == "stronghold":
        out = Image.new("RGBA", (980, 720), (0, 0, 0, 0))
        d = ImageDraw.Draw(out, "RGBA")
        outer = [(240, 465), (495, 390), (748, 462), (500, 545)]
        inner = [(280, 472), (495, 412), (708, 469), (500, 532)]
        _draw_wall_ring(out, outer, inner, style, crenel_count=12)

        huts = [(420, 492, 46, 24), (480, 475, 54, 27), (548, 492, 44, 24), (505, 510, 42, 22)]
        for x, y, w, h in huts:
            _draw_roof_block(d, x, y, w, h, style)

        d.rectangle((622, 435, 648, 520), fill=_shade(style.plaster, -10))
        d.rectangle((622, 435, 623, 520), fill=_shade(style.plaster, -30))
        d.rectangle((647, 435, 648, 520), fill=_shade(style.plaster, 12))
        d.polygon([(620, 437), (635, 410), (650, 437)], fill=style.roof_dark)
        d.polygon([(622, 438), (635, 416), (648, 438)], fill=style.roof_mid)
        d.rectangle((633, 468, 637, 520), fill=(45, 28, 18, 180))
        _draw_dome(d, 495, 452, 22, 14, style)
        return _crop_alpha(out)

    rng = random.Random(1949 if style.name == "stronghold" else 2851)
    canvas = Image.new("RGBA", (1200, 900), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas, "RGBA")
    cx, cy = 600, 620
    d.ellipse((cx - 230, cy + 40, cx + 230, cy + 116), fill=(0, 0, 0, 56))

    # Palisade diamond.
    ring = [(340, 620), (600, 528), (860, 620), (600, 708)]
    d.polygon(ring, outline=_shade(style.wood_dark, -10), width=3)
    for a, b in ((ring[0], ring[1]), (ring[1], ring[2]), (ring[2], ring[3]), (ring[3], ring[0])):
        for x, y in _line_points(a, b, 30):
            h = rng.randint(9, 14)
            d.rectangle((x - 1, y - h, x + 1, y), fill=style.wood_mid)
            d.rectangle((x - 1, y - h, x, y), fill=style.wood_dark)

    # Keep-like watch tower from stronghold module for style continuity.
    core = _stronghold_fort_core(style, 0.24)
    core = core.resize((int(core.width * 0.24), int(core.height * 0.24)), Image.Resampling.LANCZOS)
    canvas.alpha_composite(core, (820 - core.width // 2, 670 - core.height))

    for x, y in sorted([(560, 664), (612, 648), (662, 665), (621, 695), (572, 700)], key=lambda p: p[1]):
        _draw_house(d, x, y, rng, style)
    _draw_dome(d, 620, 610, 28, 17, style)
    return _crop_alpha(canvas)


def _post(img: Image.Image, style: Style) -> Image.Image:
    out = ImageEnhance.Color(img).enhance(style.saturation)
    out = ImageEnhance.Contrast(out).enhance(style.contrast)
    out = ImageEnhance.Brightness(out).enhance(style.brightness)
    out = out.filter(ImageFilter.UnsharpMask(radius=1.1, percent=125, threshold=2))
    return out


def _save(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")


def _publish_active(active_dir: Path) -> None:
    for t in ("city", "town", "fort", "village"):
        src = active_dir / f"{t}.png"
        g = OUT_BASE / f"{t}.png"
        f = OUT_FACTION / f"{t}.png"
        g.parent.mkdir(parents=True, exist_ok=True)
        f.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, g)
        shutil.copy2(src, f)


def _generate(style: Style) -> dict[str, Image.Image]:
    return {
        "fort": _post(_draw_fort(style), style),
        "city": _post(_draw_city(style), style),
        "town": _post(_draw_town(style), style),
        "village": _post(_draw_village(style), style),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Stronghold/HoMM inspired settlement sprites.")
    parser.add_argument("--active", choices=["stronghold", "homm"], default="stronghold")
    args = parser.parse_args()

    variants = [STRONGHOLD, HOMM]
    for style in variants:
        out_dir = OUT_VARIANTS / style.name
        out_dir.mkdir(parents=True, exist_ok=True)
        sprites = _generate(style)
        for t, img in sprites.items():
            _save(img, out_dir / f"{t}.png")

    _publish_active(OUT_VARIANTS / args.active)
    print("Generated variants:", [v.name for v in variants])
    print("Active:", args.active)


if __name__ == "__main__":
    main()
