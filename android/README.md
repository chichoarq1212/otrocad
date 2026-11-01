# OtroCAD Android — motor nativo sin WebView

Esta rama reemplaza la envoltura WebView por una vista de dibujo Android basada en Canvas. El editor de esta versión funciona localmente y no solicita permiso de Internet.

## Incluido en la versión nativa 0.2.0 alfa
- Dibujo táctil por puntos: línea, polilínea, rectángulo, círculo, arco, elipse, cota, hatch, texto y directriz.
- Selección CAD por ventana izquierda→derecha y cruce derecha→izquierda, con selección múltiple táctil, botón MULTI para acumular ventanas/clics y resaltado de entidades.
- Operaciones de grupo en Android: mover, copiar y borrar varias entidades seleccionadas.
- Selección, mover, copiar, borrar, deshacer y rehacer.
- Configuración HP: unidades, rejilla, ORTHO, POLAR, SNAP F9, OSNAP F3, radio de referencia y cruceta.
- Coordenadas absolutas y relativas en la línea de comandos.
- Capas básicas, colores y grosores de línea.
- Abrir/guardar proyectos JSON, importar/exportar DXF y exportar PDF.
- Apertura de archivos compartidos desde el selector de archivos Android cuando el proveedor entrega un tipo compatible.
- Trabajo local sin conexión; el dibujo no depende del editor web.
- Autoguardado del proyecto en el almacenamiento privado del dispositivo y recuperación al volver a abrir la aplicación.

## Limitaciones conocidas de esta alfa
- No es todavía un sustituto completo de AutoCAD ni de Civil 3D.
- La apertura directa de DWG no está implementada en el motor nativo; para esta versión se debe convertir a DXF.
- El importador/exportador DXF cubre entidades comunes, no todas las entidades, bloques, referencias externas, estilos ni objetos proxy de AutoCAD.
- El motor 2D nativo todavía no incluye el conjunto completo de operaciones avanzadas (TRIM, EXTEND, FILLET, CHAMFER, bloques dinámicos, layouts y plot styles).
- El PDF exporta una vista de dibujo básica; se deben revisar escala, textos y grosores antes de usarlo como plano de construcción.
- El APK de CI es una compilación debug para pruebas, no una firma de distribución de Play Store.

## Compilación
Requiere JDK 17, Gradle 8.9 y Android SDK 35. Desde la raíz del repositorio:

```bash
gradle -p android assembleDebug --no-daemon
```

El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`.
