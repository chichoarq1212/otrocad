# Guía de verificación: Layout unificado CAD + Civil 3D

Actualización de noviembre 2026 — OtroCAD alfa 0.5.6.

## Qué cambió

OtroCAD utiliza **un solo sistema Modelo / Presentación** tanto para dibujo arquitectónico CAD como para las entidades del módulo Civil 3D. Los dibujos nuevos disponen de **Presentación 1**, con hoja A3 horizontal, marco y cajetín. Los archivos CAD importados **conservan todas las hojas recuperadas** (por ejemplo P1, P2 y P3); no se eliminan ni se fusionan para forzar una sola.

## Flujo de trabajo recomendado

1. Abra **Modelo** y dibuje o importe su plano CAD o su superficie Civil 3D (TIN, curvas de nivel, cotas topográficas).
2. Pulse **▤ Presentación** en la barra inferior para abrir la hoja predeterminada.
3. Pulse **⚙ Página** o escriba `PAGESETUP` para elegir formato A4–A0, orientación, márgenes y escala 1:20–1:5000, además de impresión color / gris / monocromática. Active o desactive el cajetín y edite proyecto, nombre de plano, número y revisión.
4. Pulse **▣ Ventanas** o escriba `MVIEW`. Puede indicar la escala 1:N, centro X/Y del Modelo, posición X/Y y tamaño en milímetros de la ventana sobre el papel. **Dividir en dos ventanas** es opcional; no crea otro Layout.
5. Para centrar una planta o zona topográfica específica, regrese a Modelo, haga zoom sobre ella, vuelva a la Presentación y utilice **Capturar última vista de Modelo** en las opciones de página o ventanas.
6. Revise la hoja y utilice **PDF / Imprimir**. Compruebe el tamaño real del papel y la escala con una regla o cota conocida.

## Qué debe comprobar el ingeniero

- Una planta arquitectónica en metros, con vista 1:100 en A3 horizontal.
- Superficie TIN / curvas de nivel con coordenadas de topografía UTM muy grandes (ej. E 500000 / N 9970000), en escala 1:500 y 1:1000, sin mover la geometría.
- Dos ventanas con encuadres diferentes usando los centros X/Y de cada vista; verificar que no se sobrepongan al cajetín y el tamaño esté dentro de la hoja.
- Color, gris y monocromático: verificar lectura de cotas, textos, grosores y hatches.
- Importar un DWG con P1/P2/P3 y verificar que todas las hojas originales sigan disponibles.
- Modo iPhone horizontal: barra inferior desplegable, botones Modelo/Presentación, Página y Ventanas, sin invadir el área de dibujo.

## Limitaciones actuales

El cajetín automático es una **representación de la hoja para previsualización e impresión/PDF**; aún no se convierte automáticamente en entidades CAD nativas al guardar DWG/DXF. La conservación integral de VIEWPORT, plot styles, bloque de título y configuración de impresión en el formato DWG/DXF sigue siendo una tarea de fidelidad pendiente. Los perfiles y secciones actuales de Civil 3D se generan como gráficos de análisis, no como objetos paramétricos de perfil/sección listos para componer automáticamente una lámina. Las pruebas automáticas del repositorio detectan regresiones, pero **no sustituyen una prueba de impresión física ni una verificación de ida y vuelta en Autodesk**.

## Comandos útiles

`MODEL` o `MSPACE`: volver al Modelo.

`LAYOUT` o `PSPACE`: abrir la presentación.

`PAGESETUP`: editar configuración de página.

`MVIEW` o `VPORTS`: editar ventanas gráficas.

`PLOT`: imprimir / exportar a PDF.

## Referencias Autodesk

- https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-MAC-Core/files/GUID-A008409F-3B61-4A0B-BDF0-C2A0494F01AD.htm
- https://help.autodesk.com/cloudhelp/ENU/AutoCAD-Web-Help/files/Drafting-and-Creating/AutoCAD_Web_Help_Drafting_and_Creating_viewports_html.html
