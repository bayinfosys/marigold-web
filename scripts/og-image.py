#!/usr/bin/env python3
"""Generate a 1200x630 social card (og:image) in the marigold.run style.

Colours are the :root custom properties of the site stylesheet.
Fonts follow the stylesheet: Knewave (wordmark), Junction (UI text),
Georgia (headings), Courier New (code). Knewave and Junction are web
fonts, so point --fonts-dir at the folder holding their .ttf or .otf
files. Each role falls back to a system font; the font chosen for each
role is printed to stderr.

  python scripts/og_image.py --out assets/og-default.png
  python scripts/og_image.py --fonts-dir assets/fonts \
      --title "Ollama Alternative for Self-Hosted Inference" \
      --term "ollama alternative" \
      --line "marigold deployment start marigold-examples/chat" \
      --tag "open source" --tag python \
      --out assets/og/ollama-alternative.png

Requires Pillow 10.1 or later.
"""
import argparse
import glob
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

W, H, MARGIN = 1200, 630, 80

BG = "#F8F5EE"
BG_ALT = "#F0EDE4"
INK = "#1A1710"
INK_MID = "#4A4740"
INK_MUTED = "#8A877E"
AMBER = "#C07A0A"
AMBER_LT = "#FDE9B8"
RULE = "#D8D4CA"

TITLE_ROLE = "serif"

DEFAULT_TITLE = "Self-Hosted LLM Server and Inference API"
DEFAULT_TERM = "self hosted llm"
DEFAULT_LINE = "marigold deployment start marigold-examples/chat"
DEFAULT_TAGS = ["open source", "python", "open-weight models"]

DEJAVU = "/usr/share/fonts/truetype/dejavu/"
LIBERATION = "/usr/share/fonts/truetype/liberation/"

ROLES = {
    "slogan": (
        ["Knewave", "knewave"],
        [DEJAVU + "DejaVuSans-Bold.ttf", "C:/Windows/Fonts/arialbd.ttf"],
    ),
    "ui": (
        ["Junction", "junction"],
        ["C:/Windows/Fonts/trebuc.ttf", "/Library/Fonts/Trebuchet MS.ttf",
         "/System/Library/Fonts/Supplemental/GillSans.ttc",
         DEJAVU + "DejaVuSans.ttf"],
    ),
    "serif": (
        ["Georgia", "georgia"],
        ["C:/Windows/Fonts/georgia.ttf", "/Library/Fonts/Georgia.ttf",
         "/System/Library/Fonts/Supplemental/Georgia.ttf",
         DEJAVU + "DejaVuSerif.ttf"],
    ),
    "mono": (
        ["CourierNew", "cour"],
        ["C:/Windows/Fonts/cour.ttf",
         "/System/Library/Fonts/Supplemental/Courier New.ttf",
         LIBERATION + "LiberationMono-Regular.ttf",
         DEJAVU + "DejaVuSansMono.ttf"],
    ),
}

_resolved = {}


def load(a, role, size):
    """Return a font for a role, resolving and reporting its file once."""
    if role not in _resolved:
        names, fallbacks = ROLES[role]
        paths = []
        explicit = getattr(a, "font_" + role)
        if explicit:
            paths.append(explicit)
        if a.fonts_dir:
            for name in names:
                for ext in ("ttf", "otf", "woff"):
                    pattern = os.path.join(a.fonts_dir, "**", name + "*." + ext)
                    paths.extend(sorted(glob.glob(pattern, recursive=True)))
        paths.extend(fallbacks)
        _resolved[role] = None
        for path in paths:
            try:
                ImageFont.truetype(path, size)
                _resolved[role] = path
                break
            except OSError:
                continue
        sys.stderr.write("font %s: %s\n" % (role, _resolved[role] or "Pillow default"))
    if _resolved[role]:
        return ImageFont.truetype(_resolved[role], size)
    return ImageFont.load_default(size)


def spaced_width(d, text, font, tracking):
    return sum(d.textlength(c, font=font) for c in text) + tracking * max(len(text) - 1, 0)


def spaced(d, x, y, text, font, fill, tracking):
    """Draw text on baseline y with letter spacing; return the end x."""
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill, anchor="ls")
        x += d.textlength(ch, font=font) + tracking
    return x


def wrap(d, text, font, max_width):
    lines, current = [], ""
    for word in text.split():
        trial = (current + " " + word).strip()
        if d.textlength(trial, font=font) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def flower(d, cx, cy, r):
    for k in range(5):
        ang = math.radians(72 * k - 90)
        px = cx + r * 0.62 * math.cos(ang)
        py = cy + r * 0.62 * math.sin(ang)
        d.ellipse([px - r * 0.4, py - r * 0.4, px + r * 0.4, py + r * 0.4], fill=AMBER)
    d.ellipse([cx - r * 0.22, cy - r * 0.22, cx + r * 0.22, cy + r * 0.22], fill=BG)


def render(a):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # Nav row: wordmark, flower, domain, rule
    slogan = load(a, "slogan", 46)
    d.text((MARGIN, 88), a.brand, font=slogan, fill=INK, anchor="ls")
    end = MARGIN + d.textlength(a.brand, font=slogan)
    flower(d, end + 24 + 16, 71, 16)
    d.text((W - MARGIN, 86), a.domain, font=load(a, "ui", 22), fill=INK_MUTED, anchor="rs")
    d.line([(0, 118), (W, 118)], fill=RULE, width=2)

    # Eyebrow: primary term, uppercase, tracked, amber
    if a.term:
        spaced(d, MARGIN, 186, a.term.upper(), load(a, "ui", 24), AMBER, 3.5)

    # Title
    head = load(a, TITLE_ROLE, 66)
    lines = wrap(d, a.title, head, W - 2 * MARGIN)
    if len(lines) > 3:
        sys.stderr.write("warning: title wraps to %d lines; three are drawn\n" % len(lines))
    y = 266
    for line in lines[:3]:
        d.text((MARGIN, y), line, font=head, fill=INK, anchor="ls")
        y += 80

    # Tags: amber on amber-lt, as .tag in the stylesheet
    tag_font = load(a, "ui", 19)
    x = MARGIN
    for tag in (a.tag or DEFAULT_TAGS):
        text = tag.upper()
        w = spaced_width(d, text, tag_font, 2) + 24
        d.rectangle([x, 462, x + w, 498], fill=AMBER_LT)
        spaced(d, x + 12, 487, text, tag_font, AMBER, 2)
        x += w + 10

    # Code box: as pre in the stylesheet
    d.rectangle([MARGIN, 520, W - MARGIN, 588], fill=BG_ALT, outline=RULE, width=2)
    text = "$ " + a.line
    size = 28
    mono = load(a, "mono", size)
    while size > 16 and d.textlength(text, font=mono) > W - 2 * MARGIN - 48:
        size -= 2
        mono = load(a, "mono", size)
    d.text((MARGIN + 24, 564), text, font=mono, fill=INK_MID, anchor="ls")

    img.save(a.out, optimize=True)


def main():
    p = argparse.ArgumentParser(description="Generate a marigold.run og:image card.")
    p.add_argument("--title", default=DEFAULT_TITLE)
    p.add_argument("--term", default=DEFAULT_TERM)
    p.add_argument("--line", default=DEFAULT_LINE)
    p.add_argument("--tag", action="append")
    p.add_argument("--brand", default="Marigold")
    p.add_argument("--domain", default="marigold.run")
    p.add_argument("--fonts-dir")
    p.add_argument("--font-slogan")
    p.add_argument("--font-ui")
    p.add_argument("--font-serif")
    p.add_argument("--font-mono")
    p.add_argument("--out", default="og-default.png")
    render(p.parse_args())


if __name__ == "__main__":
    main()
