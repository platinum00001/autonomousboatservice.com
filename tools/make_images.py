#!/usr/bin/env python3
"""Draws the logo icons and the 1200x630 share image (og.jpg). Run: python3 tools/make_images.py"""
from PIL import Image, ImageDraw, ImageFont
import math, os
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
def logo(sz):
    s = sz / 64; im = Image.new('RGBA', (sz, sz), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, sz - 1, sz - 1], radius=int(16 * s), fill='#0b2638')
    d.line([(32 * s, 9 * s), (32 * s, 33 * s)], fill='#e9f3f6', width=max(1, int(3 * s)))
    d.polygon([(34 * s, 12 * s), (47 * s, 31 * s), (34 * s, 31 * s)], fill='#f28c28')
    d.polygon([(30 * s, 15 * s), (19 * s, 31 * s), (30 * s, 31 * s)], fill='#7fd3dc')
    d.polygon([(12 * s, 36 * s), (52 * s, 36 * s), (46 * s, 45 * s), (18 * s, 45 * s)], fill='#e9f3f6')
    pts = [(8 * s + i * s / 2, 52 * s - 2.5 * s * math.sin((i / 2) / 12 * 2 * math.pi)) for i in range(0, 97)]
    d.line(pts, fill='#0e7d8c', width=max(1, int(3.5 * s)), joint='curve')
    return im
big = logo(1024)
for n, sz in [('apple-touch-icon.png', 180), ('favicon-32.png', 32), ('img/icon-192.png', 192), ('img/icon-512.png', 512)]:
    big.resize((sz, sz), Image.LANCZOS).save(n)
big.resize((48, 48), Image.LANCZOS).save('favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
W, H = 1200, 630
og = Image.new('RGB', (W, H)); d = ImageDraw.Draw(og)
for y in range(H):
    t = y / H; d.line([(0, y), (W, y)], fill=(int(11 + 4 * t), int(38 + 41 * t), int(56 + 43 * t)))
for k, (col, off) in enumerate([('#0e7d8c', 545), ('#12a0b2', 580), ('#7fd3dc', 610)]):
    d.polygon([(x, off + 10 * math.sin(x / 70 + k)) for x in range(0, W + 1, 6)] + [(W, H), (0, H)], fill=col)
L = logo(150); og.paste(L, (80, 70), L)
F = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'; R = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
d.text((255, 85), 'AUTONOMOUS', font=ImageFont.truetype(F, 30), fill='#7fd3dc')
d.text((255, 125), 'BOAT SERVICE', font=ImageFont.truetype(F, 56), fill='#ffffff')
d.text((80, 260), 'Boat repair, matched fast.', font=ImageFont.truetype(F, 62), fill='#ffffff')
d.text((80, 350), 'One request connects you with local repair shops', font=ImageFont.truetype(R, 34), fill='#c8dde4')
d.text((80, 398), 'on Cape Cod, the Islands and the South Shore.', font=ImageFont.truetype(R, 34), fill='#c8dde4')
d.rounded_rectangle([80, 455, 380, 515], radius=14, fill='#f28c28')
d.text((108, 467), 'Get a quote', font=ImageFont.truetype(F, 32), fill='#1d1206')
og.save('og.jpg', quality=88)
print('images ok')
