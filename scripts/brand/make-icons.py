"""
Renders the Nabd app icons from one geometric mark.

The mark is a lime disc with a pine pulse line (one heartbeat) cut through it. Geometry lives in
a 100 x 100 box, the same numbers as `src/design/BrandMark.tsx`: disc radius 40 centred, pulse
stroke 7 with round caps and joins through PULSE. Each PNG is drawn 4x larger and scaled down
for clean edges.

Run from the repo root (needs Pillow):  python scripts/brand/make-icons.py
"""
from PIL import Image, ImageDraw

PINE = (14, 59, 53, 255)     # #0E3B35  brand.primary
LIME = (200, 241, 105, 255)  # #C8F169  brand.accent
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)

PULSE = [(21, 53), (35, 53), (41, 43), (47, 69), (56, 29), (63, 59), (67, 53), (79, 53)]
PULSE_STROKE = 7
DISC_RADIUS = 40

SS = 4  # supersampling factor
OUT = 'assets/images/'


def mark(px, scale, disc=LIME, line=PINE, bg=CLEAR, cut=False):
    """The mark on a px x px canvas; `scale` is the mark size relative to the 100-unit box.

    `cut=True` punches the pulse out of the disc (transparent) instead of painting it, which the
    Android monochrome layer needs: the launcher tints the opaque pixels.
    """
    n = px * SS
    u = n / 100 * scale
    off = n / 2 - 50 * u  # centre the 100-unit box on the canvas

    def p(x, y):
        return (off + x * u, off + y * u)

    layer = Image.new('RGBA', (n, n), CLEAR)
    d = ImageDraw.Draw(layer)
    cx, cy = p(50, 50)
    r = DISC_RADIUS * u
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=disc)

    colour = CLEAR if cut else line
    w = PULSE_STROKE * u
    pts = [p(x, y) for x, y in PULSE]
    for a, b in zip(pts, pts[1:]):
        d.line((a, b), fill=colour, width=round(w))
    for x, y in pts:  # round caps and joins
        d.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=colour)

    canvas = Image.new('RGBA', (n, n), bg)
    canvas.alpha_composite(layer)
    return canvas.resize((px, px), Image.LANCZOS)


def solid(px, colour):
    return Image.new('RGBA', (px, px), colour)


# iOS / store icon: full-bleed pine, no transparency.
mark(1024, 0.92, bg=PINE).convert('RGB').save(OUT + 'icon.png')
# Android adaptive icon: the mark stays inside the 66/108 safe circle.
mark(512, 0.74).save(OUT + 'android-icon-foreground.png')
solid(512, PINE).save(OUT + 'android-icon-background.png')
mark(432, 0.74, disc=WHITE, cut=True).save(OUT + 'android-icon-monochrome.png')
# Splash: the mark alone; the pine background comes from app.config.ts.
mark(512, 1.0).save(OUT + 'splash-icon.png')
# Web preview tab icon.
mark(196, 0.96, bg=PINE).save(OUT + 'favicon.png')
print('icons written to', OUT)
