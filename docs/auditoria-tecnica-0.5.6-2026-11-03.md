# Auditoría técnica de OtroCAD 0.5.6 — 03/11/2026

**Alcance:** revisión estática de `main`, pruebas Node/Rust descritas en el repositorio, configuración CI/CD y publicaciones. La experiencia de arrastre en iPhone fue confirmada por el usuario; no equivale a una certificación de todos los comandos sobre dispositivos físicos. Clasificación: **Implementado**, **Parcial**, **No implementado / no encontrado**, **Pendiente de validación real**.

## Resumen ejecutivo

El producto dispone de un editor CAD 2D funcional en navegador/PWA, dibujo y modificación básica, referencias a objetos, capas, DXF y puente DWG WebAssembly; además, Android híbrido, Android nativo experimental y Windows Electron experimental. No existe todavía equivalencia funcional con AutoCAD y mucho menos con el modelo paramétrico completo de Autodesk Civil 3D. El riesgo número uno es la **fidelidad del plano tras abrir, modificar, guardar y volver a abrir**, especialmente layouts, viewports, hatches y objetos de Civil 3D.

## CAD: capacidades verificadas en el código

| Bloque | Estado | Evidencia y limitación |
| --- | --- | --- |
| Geometría 2D | Implementado/parcial | LINE, PLINE, RECT, CIRCLE, ARC tres puntos, ELLIPSE, POLYGON, punto y símbolos. No se encontró SPLINE editable ni curvas NURBS. |
| Edición | Parcial | MOVE, COPY, ROTATE, MIRROR, SCALE, ERASE, EXPLODE, array rectangular, TRIM, EXTEND, OFFSET, FILLET, CHAMFER. TRIM/EXTEND se limitan a segmentos LINE; OFFSET a LINE/CIRCLE/RECT; FILLET/CHAMFER a dos líneas; array solo rectangular. |
| Precisión y referencias | Implementado/parcial | Entrada dinámica, coordenadas relativas, GRID/SNAP, ORTHO/POLAR, cruz, selección por ventana/cruce y OSNAP: endpoint, midpoint, center, quadrant, intersection, nearest, parallel, perpendicular, tangente, extensión, etc. La robustez geométrica requiere pruebas reales con dibujos densos. |
| Anotación | Parcial | TEXT, edición colectiva y estilos recuperados en parte; DIM lineal/alineada/radio/diámetro, centerline/centermark y leader. No se encontraron tablas editables ni multileaders completos, campos o motor anotativo de escalas equivalente a AutoCAD. |
| Capas y propiedades | Implementado/parcial | Colores, grosor/tipo de línea, bloqueo/visibilidad, panel de propiedades. Los tipos y estilos se simplifican en DXF. |
| HATCH | Parcial | SOLID y algunos patrones básicos propios; interpretación de DXF con color/gris y opacidad. El comportamiento de patrones AutoCAD complejos no está garantizado. |
| Bloques/librería | Parcial | Inserción de mobiliario con transformación. Las referencias y bloques dinámicos externos no conservan todas sus reglas paramétricas. |
| Presentaciones | Parcial | MODEL y layouts con ventanas de presentación, previsualización y ajustes de papel; al exportar DXF se advierte que layouts/ventanas no se guardan íntegramente. |
| Impresión | Parcial | Usa la función de impresión del navegador para generar PDF. Faltan pruebas de escala física/CTB-STB y comparación en impresoras. |
| Archivo DXF/DWG | Parcial — alto riesgo | DXF importación/exportación y runtime DWG real (AC1032) vía DXF; la vuelta a abrir compara número de entidades, no equivalencia geométrica completa. Objetos proxy, xrefs, bloques dinámicos y estilos avanzados pueden degradarse. |
| Guardado | Parcial | Guardar guarda copia local en el navegador; Guardar como DWG es operación separada. Hay respaldo y recuperación, pero no gestor de múltiples proyectos ni guardado DWG predeterminado persistente por archivo. |

## CIVIL 3D: capacidades verificadas en el código

| Módulo | Estado | Evidencia y limitación |
| --- | --- | --- |
| Puntos | Implementado/parcial | Importar CSV/XYZ, importar puntos LandXML, etiquetar y exportar CSV. Sin grupos COGO completos ni estilos de puntos configurables como Civil 3D. |
| Superficie TIN | Implementado/parcial | Delaunay con puntos XYZ y vértices de curvas: máximo 1800 puntos. Sin límites ni breaklines obligatorias, ni actualización automática del TIN por edición de una fuente. |
| Intercambio LandXML TIN | Implementado recientemente | Exporta Pnts/Faces en LandXML 1.2, coordenadas N/E/Z en metros, con conversión desde m/cm/mm; cubierto por regresión de geometría. Validar recepción en Civil 3D físico. |
| Curvas, pendientes y visor | Implementado/parcial | Curvas de nivel, clasificación de pendientes y visor 3D Canvas con exageración vertical. Sin pendientes hidráulicas/cuencas ni grandes nubes de puntos. |
| Ejes/progresivas | Parcial | Marcación de LINE/PLINE como eje y estacado. No incluye alineaciones paramétricas con curvas de transición, radios normativos o peraltes. |
| Perfil longitudinal/sección | Parcial | Muestreo del TIN y gráfico temporal; no son perfiles de diseño persistentes editables, con rasante, bandas, estaciones o ensamblajes. |
| Movimiento de tierras | Parcial | Corte/relleno aproximado contra una cota horizontal mediante integración triangular. No hay comparación EG/FG entre dos superficies, ni cubicación por secciones. |
| Obras lineales | No implementado | Corredores, subensamblajes, intersecciones dinámicas y glorietas. |
| Drenaje y redes | No implementado | Redes de tuberías por gravedad y presión, estructuras, cálculos hidrológicos e hidráulicos. |
| Gestión civil | No implementado | Prospector, grupos/sitios, data shortcuts, parcelas paramétricas, GIS/EPSG de extremo a extremo, estilos de etiquetas enlazadas, planimetría automática plan-perfil. |

**Criterio de comparación:** documentación pública de Autodesk Civil 3D 2026: los objetos de superficies, alineamientos, perfiles, corredores, redes y estilos están asociados y pueden actualizarse en cadena. OtroCAD actualmente opera mayoritariamente sobre entidades 2D independientes. Fuente: https://help.autodesk.com/cloudhelp/2025/ENU/Civil3D-UserGuide/files/GUID-AA3DBD43-5F17-4E51-B743-374652778DD5.htm

## Plataformas y calidad

- **iPhone/iPad:** instalable desde Safari como PWA; menús optimizados y gestos CAD/OSNAP cubiertos por pruebas de regresión simuladas; el usuario confirmó que la UI táctil va bien. Pruebas sobre varios iPhone/iPad, sistema de archivos y escenarios offline siguen pendientes.
- **Android híbrido:** paquete con recursos web locales y WebViewAssetLoader, no es el motor Canvas nativo. **Android nativo Canvas** existe como experimento, sin paridad completa ni DWG.
- **Windows:** Electron experimental con motor web local. Falta certificación manual de archivos grandes, impresión, atajos y asociación de archivos en PC físico. La descarga Windows anunciada es de versión experimental 0.5.4, frente al sitio 0.5.6.
- **Despliegue:** GitHub Pages y Cloudflare se comprueban con acciones diferentes. Algunas verificaciones previas de Cloudflare fallaron por diferencia de `build-info.json`; ejecuciones posteriores tuvieron éxito. Vigilar coincidencia exacta del build y la validez de APK/EXE.
- **CI:** pruebas automatizadas de geometría Civil, DWG, importación DXF, grips, táctil iOS y proyectos. Son útiles para regresión, pero faltan baterías visuales end-to-end y matrices de archivos DWG/DXF reales.
- **Legal:** el README indica que aún falta decidir e incorporar una licencia explícita del código propio; conservar avisos y condiciones MPL-2.0 de las dependencias del módulo DWG.

## Plan de cierre — orden recomendado

### P0: antes de considerar el producto profesional

1. **Golden files y fidelidad DWG/DXF:** corpus de planos reales P1/P2/P3 con hatches grises, textos SHX/MTEXT, colores, bloques, cotas, capas y viewports. Abrir → modificar → guardar DWG → abrir en AutoCAD/Civil 3D y de regreso. Comparar entidad, coordenadas, cota Z, propiedades, vistas y contenidos de papel; no solo el número de entidades.
2. **Layouts confiables:** reconstruir y exportar adecuadamente VIEWPORT, bloque de papel, formatos, escala de ventanas, orientación, estilos de impresión y visibilidad de capas en ventanas.
3. **Seguridad del proyecto:** administrador de varios dibujos, nombre y ruta, guardado manual DWG según preferencia, autosalvados versionados recuperables y pruebas con almacenamiento lleno o cierre inesperado. No confundir copia local con archivo DWG.

### P1: edición arquitectónica completa

4. Implementar **OFFSET de polilíneas** con uniones correctas; **TRIM/EXTEND** sobre polígonos, polilíneas, círculos y arcos; **FILLET/CHAMFER** con radios/distancias editables entre segmentos; pruebas numéricas de geometría.
5. Añadir matriz polar y a lo largo de trayectoria, spline, textos MTEXT de párrafo, atributos de bloque, referencias externas básicas y gestión de bloques reutilizables.
6. Anotación, escalas, tablas y salida PDF a escala con impresión A4/A3/A2/A1/A0, grosores y estilos de ploteo reproducibles.

### P1-P2: Civil topográfico real

7. Superficies TIN **con breaklines, boundaries, exclusiones y edición controlada**, grupos de puntos, códigos topográficos, georreferenciación EPSG/UTM y lectura/escritura LandXML completa validada.
8. Superficies terreno natural vs. proyecto, pendientes etiquetadas, mapas por rangos y volúmenes entre superficies; exportación de reportes y curvas/secciones.
9. Alineamientos con tangentes, curvas circulares y espirales, rasantes verticales, perfiles editables, bandas y secciones persistentes. Dependencias que recalculen al modificar el eje o terreno.

### P3: Civil de infraestructura

10. Corredores y subensamblajes, intersecciones, plataformas, explanaciones, parcelas, drenaje y tuberías; herramientas de estándares viales/ferroviarios, funciones GIS/BIM, tablas e informes de ingeniería. No anunciar paridad con Civil 3D hasta que exista un sistema de objetos dependientes y validación contra proyectos reales.

## Criterios de aceptación de una versión estable

- Cero pérdida silenciosa en archivos soportados; los elementos no compatibles se conservan o se reportan con detalle antes de modificar/guardar.
- Los casos de prueba reales abren y reabren con coincidencia de geometría y propiedades (no solo conteo); layouts P1/P2/P3 se imprimen a escala.
- Mismo proyecto se edita y guarda en Windows, iOS PWA y Android híbrido sin sobrescribir datos ajenos.
- Todo comando visible ejecuta su función o declara claramente su limitación.
- Todos los flujos CI relevantes en verde **y** pruebas manuales documentadas con dispositivos reales.

**Estado:** auditoría basada en código y CI; no certificación de compatibilidad comercial con Autodesk AutoCAD/Civil 3D ni aprobación de planos ejecutivos.
