#!/usr/bin/env python3
"""Create the official OtroCAD Windows icon from the site's master PNG.

Run: python desktop/create_windows_icon.py icon-512.png desktop/build/otrocad.ico
Requires Pillow; keeps the exact blue/white/yellow brand artwork.
"""
from pathlib import Path
from sys import argv
from PIL import Image

source = Path(argv[1]) if len(argv) > 1 else Path("icon-512.png")
target = Path(argv[2]) if len(argv) > 2 else Path("desktop/build/otrocad.ico")
with Image.open(source) as image:
    artwork = image.convert("RGBA")
    if artwork.width != artwork.height or artwork.width < 256:
        raise ValueError("Se requiere un logotipo cuadrado de al menos 256px.")
    target.parent.mkdir(parents=True, exist_ok=True)
    artwork.save(target, format="ICO",
                 sizes=[(16, 16), (24, 24), (32, 32),
                        (48, 48), (64, 64), (128, 128), (256, 256)])
with Image.open(target) as icon:
    if icon.format != "ICO" or (256, 256) not in icon.ico.sizes():
        raise ValueError("El archivo ICO generado no contiene la resolución de 256px.")
print(f"Icono de Windows OtroCAD: {target} ({target.stat().st_size} bytes)")
