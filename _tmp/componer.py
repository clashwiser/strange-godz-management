"""Encaja un retrato dentro de un aro decorativo.

El aro viene con fondo blanco y el centro tambien blanco. Hay que distinguir
las dos zonas blancas: la de AFUERA (que se vuelve transparente) y el AGUJERO
del medio (donde va el retrato). Se separan por relleno de difusion: una nace
en las esquinas, la otra en el centro.
"""
import sys
from PIL import Image, ImageDraw
import numpy as np

CENT_FUERA = (255, 0, 255)
CENT_HUECO = (0, 255, 255)


def preparar_aro(ruta):
    im = Image.open(ruta).convert('RGB')
    w, h = im.size
    t = im.copy()
    for esq in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        ImageDraw.floodfill(t, esq, CENT_FUERA, thresh=45)
    ImageDraw.floodfill(t, (w // 2, h // 2), CENT_HUECO, thresh=45)

    m = np.asarray(t)
    fuera = (m[:, :, 0] == 255) & (m[:, :, 1] == 0) & (m[:, :, 2] == 255)
    hueco = (m[:, :, 0] == 0) & (m[:, :, 1] == 255) & (m[:, :, 2] == 255)
    if hueco.sum() < 500:
        raise SystemExit('no se detecto el agujero central del aro')

    alpha = np.where(fuera | hueco, 0, 255).astype(np.uint8)
    aro = Image.fromarray(np.dstack([np.asarray(im), alpha]), 'RGBA')

    ys, xs = np.where(hueco)
    caja = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    return aro, caja, hueco.sum() / hueco.size


def componer(ruta_aro, ruta_retrato, salida, lado=1024, solape=0.055, zoom=1.0):
    aro, caja, frac = preparar_aro(ruta_aro)
    W, H = aro.size
    x0, y0, x1, y1 = caja
    dh, dv = x1 - x0, y1 - y0
    print(f'  agujero: {dh}x{dv} px ({frac*100:.0f}% del lienzo)')

    # El retrato se mete un pelin mas grande que el agujero para que no quede
    # una linea de fondo entre el borde del retrato y el filo interior del aro.
    d = int(max(dh, dv) * (1 + solape))
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2

    retrato = Image.open(ruta_retrato).convert('RGBA')
    # zoom>1 recorta mas cerca antes de encajar: sin esto el personaje queda
    # chico y se ve mucho fondo dentro del aro.
    r = int(min(retrato.size) / zoom)
    retrato = retrato.crop(((retrato.size[0] - r) // 2, (retrato.size[1] - r) // 2,
                            (retrato.size[0] + r) // 2, (retrato.size[1] + r) // 2))
    retrato = retrato.resize((d, d), Image.LANCZOS)

    mascara = Image.new('L', (d, d), 0)
    ImageDraw.Draw(mascara).ellipse((0, 0, d - 1, d - 1), fill=255)

    lienzo = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    lienzo.paste(retrato, (cx - d // 2, cy - d // 2), mascara)
    lienzo.alpha_composite(aro)

    # Recortar al contenido real y cuadrar
    a = np.asarray(lienzo)[:, :, 3] > 0
    ys, xs = np.where(a)
    rec = lienzo.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    s = max(rec.size)
    q = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    q.paste(rec, ((s - rec.size[0]) // 2, (s - rec.size[1]) // 2))
    q.resize((lado, lado), Image.LANCZOS).save(salida, 'WEBP', quality=90, method=6)
    print(f'  -> {salida}')


if __name__ == '__main__':
    z = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
    componer(sys.argv[1], sys.argv[2], sys.argv[3], zoom=z)
