#!/usr/bin/env python3
"""
Draw the UVY mark into the home-screen icons.

    python3 tools/make-icon.py

Writes assets/touch-icon.png (180) and assets/icon-512.png. Same geometry as the
SVG in index.html, redrawn with Pillow — there's no SVG rasteriser on this
machine, and hand-copying base64 out of a browser is not a build step.

Everything is drawn at 4x and shrunk down, which is where the smooth edges come
from: Pillow has no antialiasing of its own.
"""
import pathlib
from PIL import Image, ImageDraw

YELLOW = (255, 217, 28)
INK = (22, 22, 26)
WHITE = (255, 255, 255)

SCALE = 8          # supersample, then LANCZOS down. Pillow joins thick
                   # segments with visible lumps, and this hides them
BOX = 1024         # the SVG's coordinate space


def bezier(p0, p1, p2, p3, steps=140):
    """Sample a cubic — Pillow only draws straight segments."""
    out = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        out.append((
            u**3 * p0[0] + 3 * u*u*t * p1[0] + 3 * u*t*t * p2[0] + t**3 * p3[0],
            u**3 * p0[1] + 3 * u*u*t * p1[1] + 3 * u*t*t * p2[1] + t**3 * p3[1],
        ))
    return out


def face_outline():
    """The eared head, matching the path in index.html."""
    pts = [(272, 226), (380, 334)]
    pts += bezier((380, 334), (425, 288), (465, 270), (512, 270))[1:]
    pts += bezier((512, 270), (559, 270), (599, 288), (644, 334))[1:]
    pts += [(752, 226), (748, 506)]
    pts += bezier((748, 506), (748, 642), (641, 730), (512, 730))[1:]
    pts += bezier((512, 730), (383, 730), (276, 642), (276, 506))[1:]
    return pts


def draw_icon(size):
    s = size * SCALE
    k = s / BOX                                   # SVG units -> pixels
    px = lambda pts: [(x * k, y * k) for x, y in pts]
    w = lambda units: max(1, round(units * k))

    im = Image.new("RGB", (s, s), WHITE)
    d = ImageDraw.Draw(im)

    # headphone cups, behind everything
    for cx in (252, 772):
        d.ellipse([(cx - 66) * k, (500 - 108) * k, (cx + 66) * k, (500 + 108) * k], fill=INK)

    # the dark disc that shows as the rim around the face
    d.ellipse([(512 - 248) * k, (514 - 248) * k, (512 + 248) * k, (514 + 248) * k], fill=INK)

    face = px(face_outline())
    d.polygon(face, fill=YELLOW)
    d.line(face + [face[0]], fill=INK, width=w(26), joint="curve")

    # U
    u = [(366, 406), (366, 462)]
    u += bezier((366, 462), (366, 518), (460, 518), (460, 462))[1:]
    u += [(460, 406)]
    d.line(px(u), fill=INK, width=w(21), joint="curve")

    # V
    d.line(px([(566, 406), (614, 514), (662, 406)]), fill=INK, width=w(21), joint="curve")

    # smile
    d.line(px(bezier((400, 590), (438, 666), (586, 666), (624, 590))),
           fill=INK, width=w(22), joint="curve")

    return im.resize((size, size), Image.LANCZOS)


def main():
    root = pathlib.Path(__file__).resolve().parent.parent
    for size, name in [(180, "touch-icon.png"), (512, "icon-512.png")]:
        out = root / "assets" / name
        draw_icon(size).save(out)
        print(f"{name}: {size}x{size}, {out.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
