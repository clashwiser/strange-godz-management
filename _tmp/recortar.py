"""Deja un emblema circular con fondo transparente, listo para el panel.

El modelo devuelve el emblema sobre blanco. Se quita SOLO el blanco pegado al
borde (relleno por difusion desde las esquinas): asi los blancos de dentro del
dibujo -dientes, ojos, la cal del anillo- no se vuelven agujeros.
"""
import sys
from PIL import Image, ImageDraw
import numpy as np

CENT = (255, 0, 255)


def recortar(entrada, salida, lado=1024):
    im = Image.open(entrada).convert('RGB')
    w, h = im.size
    t = im.copy()
    for esq in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        ImageDraw.floodfill(t, esq, CENT, thresh=38)

    m = np.asarray(t)
    fondo = (m[:, :, 0] == 255) & (m[:, :, 1] == 0) & (m[:, :, 2] == 255)
    print(f'  fondo quitado: {fondo.mean() * 100:.0f}%')

    rgba = np.dstack([np.asarray(im), np.where(fondo, 0, 255).astype(np.uint8)])
    sal = Image.fromarray(rgba, 'RGBA')

    ys, xs = np.where(rgba[:, :, 3] > 0)
    rec = sal.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    s = max(rec.size)
    q = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    q.paste(rec, ((s - rec.size[0]) // 2, (s - rec.size[1]) // 2))
    q.resize((lado, lado), Image.LANCZOS).save(salida, 'WEBP', quality=90, method=6)
    print(f'  -> {salida}  ({rec.size[0]}x{rec.size[1]} -> {lado}x{lado})')


if __name__ == '__main__':
    recortar(sys.argv[1], sys.argv[2])
