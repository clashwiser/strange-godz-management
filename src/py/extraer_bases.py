"""Saca de un pack PDF los enlaces de base y su miniatura.

Formato de estos packs: imagen, texto, enlace, imagen, texto, enlace...
El enlace suele venir DUPLICADO (dos veces la misma URL) y el flujo cruza de
una pagina a la siguiente, asi que la mini de una base puede estar en la
pagina anterior.

Regla: recorriendo el documento en orden de lectura, cada URL nueva se queda
con la ultima imagen vista antes de ella.

    python extraer_bases.py <pdf> <carpeta_salida> <slug>
"""
import io
import json
import sys
from pathlib import Path

import fitz
from PIL import Image

ANCHO_MINI = 640


def extraer(pdf_path, salida, slug):
    doc = fitz.open(pdf_path)
    carpeta = Path(salida) / slug
    carpeta.mkdir(parents=True, exist_ok=True)

    ultima_img = None      # bytes de la ultima imagen vista
    vistas = {}            # xref -> nombre de archivo ya guardado
    bases = []
    urls_vistas = set()

    for pagina in doc:
        elementos = []

        for info in pagina.get_images(full=True):
            xref = info[0]
            for r in pagina.get_image_rects(xref):
                # Descartar iconos y adornos: una base ocupa media pagina
                if r.width >= 200 and r.height >= 100:
                    elementos.append((r.y0, 'img', xref))

        for enlace in pagina.get_links():
            uri = enlace.get('uri', '')
            if 'clashofclans.com' in uri:
                elementos.append((enlace['from'].y0, 'link', uri))

        for _, clase, dato in sorted(elementos, key=lambda e: e[0]):
            if clase == 'img':
                ultima_img = dato
            elif dato not in urls_vistas:
                urls_vistas.add(dato)
                nombre = None
                if ultima_img is not None:
                    if ultima_img in vistas:
                        nombre = vistas[ultima_img]
                    else:
                        crudo = doc.extract_image(ultima_img)
                        im = Image.open(io.BytesIO(crudo['image'])).convert('RGB')
                        if im.width > ANCHO_MINI:
                            im = im.resize(
                                (ANCHO_MINI, round(im.height * ANCHO_MINI / im.width)),
                                Image.LANCZOS,
                            )
                        nombre = f'{len(vistas):02d}.webp'
                        im.save(carpeta / nombre, 'WEBP', quality=82, method=5)
                        vistas[ultima_img] = nombre
                bases.append({
                    'url': dato,
                    'preview': f'/bases/{slug}/{nombre}' if nombre else None,
                })

    doc.close()
    con = sum(1 for b in bases if b['preview'])
    print(f'  {len(bases)} bases, {con} con miniatura, {len(vistas)} imagenes guardadas')
    return bases


if __name__ == '__main__':
    print(json.dumps(extraer(sys.argv[1], sys.argv[2], sys.argv[3]), ensure_ascii=False))
