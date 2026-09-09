"""Saca de un pack PDF los enlaces de base y su miniatura.

Hay dos formatos de pack en circulacion y este script traga los dos.

Con imagen (RH Champs1, Clash Champ1):

    "Base:1"
    "RH September C1 | Vibes | 2 IG, 2 witches & archer"   <- que donar
    [imagen de la base]
    "Base link :-Click here"
    enlace

Solo texto (RH CWL): una lista corrida, sin imagenes, donde la URL ademas
se ve como texto:

    "#1 RH September CWL | Burak | 2 IG, furnace, HH & archer"
    "https://link.clashofclans.com/en?action=..."
    "#2 ..."

El enlace viene DUPLICADO -hasta tres veces si el texto de la URL parte en
varias lineas- y el flujo cruza de pagina en pagina, asi que la mini de una
base puede estar en la pagina anterior.

Regla: recorriendo el documento en orden de lectura, cada URL nueva se queda
con la ultima imagen vista antes de ella Y con el texto acumulado desde el
enlace anterior.

Se recorre LINEA a linea, no bloque a bloque: en el pack de solo texto la
pagina entera es un unico bloque, asi que agrupando por bloque las quince
anotaciones se apilaban todas sobre la primera base y se perdian catorce.

Ese texto es lo que el proveedor anota de cada base -contra que ejercito
defiende, que meter en el castillo- y antes se tiraba entero. Es informacion
que ya estaba pagada y que los lideres reescribian a mano.

    python extraer_bases.py <pdf> <carpeta_salida> <slug>
"""
import io
import json
import re
import sys

# La consola de Windows habla cp1252 y estos PDF traen espacios de ancho
# cero y guiones tipograficos: sin esto el import muere al imprimir.
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
from pathlib import Path

import fitz
from PIL import Image

ANCHO_MINI = 640

# Texto de relleno que traen todos los packs y no dice nada de la base.
# Espacios de ancho cero y demas invisibles que traen los PDF exportados
# desde Word: no se ven pero rompen las comparaciones y la consola.
INVISIBLES = re.compile(r'[​-‏  ﻿]')
# Relleno: navegacion del PDF, publicidad del proveedor ("USE CODE...") y
# etiquetas sueltas que encabezan la recomendacion pero no dicen nada solas.
RELLENO = re.compile(
    r'^\s*(base\s*link|click here|https?://|use code|legend leaders'
    r'|cc\s*troops\s*:?\s*$)',
    re.I,
)
# "Base:3", "Base 3" -> etiqueta corta para reconocerla en la tabla.
ETIQUETA = re.compile(r'^\s*base\s*:?\s*(\d+)\s*$', re.I)
# "#3 RH September CWL | Zub | ..." -> el numero es etiqueta, el resto nota.
# El ':' inicial aparece cuando la URL de la base anterior parte de linea
# justo antes del titulo de la siguiente.
NUMERADA = re.compile(r'^[\s:·.-]*#\s*(\d+)\s+(.*\S)\s*$')


def lineas_de(pagina):
    """Las lineas de la pagina con su altura, para ordenarlas con el resto.

    get_text('blocks') seria mas corto pero agrupa demasiado: un pack entero
    puede venir en un solo bloque y entonces no hay forma de saber que nota
    va con que enlace.
    """
    for bloque in pagina.get_text('dict').get('blocks', ()):
        for linea in bloque.get('lines', ()):
            texto = ''.join(t.get('text', '') for t in linea.get('spans', ()))
            texto = INVISIBLES.sub('', texto).strip()
            if texto:
                yield linea['bbox'][1], texto


def extraer(pdf_path, salida, slug):
    doc = fitz.open(pdf_path)
    carpeta = Path(salida) / slug
    carpeta.mkdir(parents=True, exist_ok=True)

    ultima_img = None      # bytes de la ultima imagen vista
    vistas = {}            # xref -> nombre de archivo ya guardado
    bases = []
    urls_vistas = set()
    # Texto visto desde el enlace anterior: pertenece a la base que viene.
    textos = []

    for pagina in doc:
        elementos = []

        for info in pagina.get_images(full=True):
            xref = info[0]
            for r in pagina.get_image_rects(xref):
                # Descartar iconos y adornos: una base ocupa media pagina
                if r.width >= 200 and r.height >= 100:
                    elementos.append((r.y0, 'img', xref))

        for y, texto in lineas_de(pagina):
            elementos.append((y, 'txt', texto))

        for enlace in pagina.get_links():
            uri = enlace.get('uri', '')
            if 'clashofclans.com' in uri:
                elementos.append((enlace['from'].y0, 'link', uri))

        for _, clase, dato in sorted(elementos, key=lambda e: e[0]):
            if clase == 'img':
                ultima_img = dato
            elif clase == 'txt':
                # Sin espacios es un pedazo de URL partida ("86mPBjtkaj6p"),
                # no una anotacion. Las etiquetas ("Base:1") son la excepcion.
                if RELLENO.match(dato):
                    continue
                if ' ' in dato or ETIQUETA.match(dato):
                    textos.append(dato)
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
                etiqueta = None
                notas = []
                for linea in textos:
                    m = ETIQUETA.match(linea)
                    if m:
                        etiqueta = f'Base {m.group(1)}'
                        continue
                    m = NUMERADA.match(linea)
                    if m:
                        etiqueta = f'Base {m.group(1)}'
                        linea = m.group(2)
                    notas.append(linea)
                textos = []

                bases.append({
                    'url': dato,
                    'preview': f'/bases/{slug}/{nombre}' if nombre else None,
                    'etiqueta': etiqueta,
                    'nota': ' · '.join(notas) or None,
                })

    doc.close()
    con = sum(1 for b in bases if b['preview'])
    con_nota = sum(1 for b in bases if b['nota'])
    print(f'  {len(bases)} bases, {con} con miniatura, {con_nota} con nota del proveedor')
    return bases


if __name__ == '__main__':
    print(json.dumps(extraer(sys.argv[1], sys.argv[2], sys.argv[3]), ensure_ascii=False))
