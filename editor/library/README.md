# Mobiliario editable de OtroCAD

Los ocho símbolos en planta incluidos proceden de la biblioteca de mobiliario de [FloorPlanner](https://github.com/pjm4github/FloorPlanner/tree/634d47d83b8458f08dd3b7e565024157ed2c8521/assets/furnishings), publicada por su autor bajo CC0 1.0. Se conserva el texto original en `source/LICENSE`.

Los archivos SVG de `source/` usan pulgadas; `scripts/generate-furniture.py` convierte su geometría a metros, aproxima las esquinas curvas mediante segmentos y genera `furnishings.js`. OtroCAD convierte a centímetros o milímetros según la unidad seleccionada.

Al colocarlos, sus piezas se agrupan para selección y modificación dentro de OtroCAD. Explotar los desagrupa. En esta etapa la exportación DXF descompone esos grupos en entidades y avisa al usuario; no son bloques dinámicos DWG de AutoCAD.
