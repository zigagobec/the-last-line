"""Cut usable sprites out of the design PDF's illustrations.

Usage: python3 -I tools/extract-sprites.py <dir-with-pdfimages-output> <out-dir>
(pdfimages -png "The last line.pdf" <dir>/img)
"""
import sys
from PIL import Image, ImageDraw, ImageFilter

src, out = sys.argv[1], sys.argv[2]


def comp(a, b):
    im = Image.open(f'{src}/img-{a:03d}.png').convert('RGB')
    m = Image.open(f'{src}/img-{b:03d}.png').convert('L')
    im.putalpha(m)
    return im


def keep(im, shapes):
    """Zero alpha outside the union of the given shapes (('rect'|'ellipse', box))."""
    mask = Image.new('L', im.size, 0)
    d = ImageDraw.Draw(mask)
    for kind, box in shapes:
        (d.rectangle if kind == 'rect' else d.ellipse)(box, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))
    a = Image.composite(im.getchannel('A'), Image.new('L', im.size, 0), mask)
    im = im.copy()
    im.putalpha(a)
    return im


def trim(im, pad=4):
    box = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    l, t, r, b = box
    return im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))


tree = comp(7, 8)
tree = keep(tree, [('rect', (0, 0, tree.width, 214)), ('ellipse', (38, 180, 266, 276))])
tree = tree.crop((0, 0, tree.width, 272))
trim(tree).save(f'{out}/tree.png')

sign = comp(11, 12)
sign = keep(sign, [('rect', (138, 26, 209, 68)), ('rect', (156, 60, 194, 116))])
trim(sign).save(f'{out}/sign.png')
