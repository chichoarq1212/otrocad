# OtroCAD Nativo: prototipo alfa

Aplicación Android con interfaz y lienzo Canvas nativos, sin WebView ni permiso de red. Es una base separada del editor web, no un CAD profesional terminado.

Permite crear líneas, segmentos consecutivos, rectángulos y círculos; ver una previsualización y distancia, usar ortogonal, rejilla y forzado de paso, introducir distancia y ángulo, deshacer, elegir color y grosor, ampliar con dos dedos y desplazar la vista. Guarda y abre un formato JSON propio diferente al editor web. Se conserva temporalmente el dibujo local entre sesiones, pero debe guardarse como archivo para compartirlo o respaldarlo.

Limitaciones: todavía no abre DWG, DXF ni proyectos del editor web, no tiene cotas, selección/edición de objetos, capas ni impresión técnica. La polilínea se guarda como segmentos independientes. No existe compatibilidad garantizada de datos o firmas con el APK alfa anterior. La compilación debug es para pruebas y no está verificada en dispositivos físicos.
