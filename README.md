# OtroCAD

CAD 2D libre en desarrollo para arquitectura, dibujo técnico, topografía y vialidad.

Proyecto hermano de [ESQUECHAT 3D](https://esquechat.com/). Identidad visual azul marino, amarillo y blanco.

## Accesos
- Sitio: https://otrocad.ficti-ia3ec.chatgpt.site
- Editor web: https://otrocad.ficti-ia3ec.chatgpt.site/editor/
- Código fuente: https://github.com/chichoarq1212/otrocad
- APK y compilaciones: https://github.com/chichoarq1212/otrocad/releases

## Estado actual
### Web / PWA
- Dibujo 2D: línea, polilínea, rectángulo, círculo, arco, elipse, polígono, cotas, hatch, texto y directrices.
- Precisión: entrada dinámica, coordenadas absolutas/relativas, ORTHO, POLAR, GRID, SNAP, OSNAP y cruceta.
- Selección CAD: ventana izquierda→derecha (solo entidades totalmente contenidas), cruce derecha→izquierda (entidades tocadas o atravesadas), selección múltiple, Shift/Ctrl o botón MULTI para acumular/quitar, ESC para limpiar; mover/copiar/borrar conjuntos.
- Edición: mover, copiar, OFFSET, rotar, espejo, escalar, TRIM, EXTEND y EXPLODE para entidades compatibles.
- Grips CAD: arrastra extremos, vértices, esquinas y puntos de control para editar geometría directamente; incluye líneas, polilíneas, polígonos, rectángulos, círculos, elipses, arcos, cotas, directrices y textos.
- Grips con historial de edición: guardar, deshacer y cancelar cambios.
- Capas básicas con visibilidad y bloqueo, color, tipo y grosor de línea.
- Ventana de configuración HP: unidades, rejilla, incremento POLAR, radio OSNAP, ORTHO, SNAP y cruceta.
- Abrir/guardar JSON; importar/exportar DXF; exportar SVG e imprimir/guardar PDF.
- PWA con recursos locales cacheados para volver a abrir el editor sin conexión después de la primera carga.

### Android nativo
La versión Android 0.4.0 alfa reemplaza la envoltura WebView por una vista Android Canvas. No usa permiso de Internet y el dibujo funciona localmente. Incluye dibujo táctil, selección, edición geométrica mediante grips arrastrables, mover/copiar/borrar, undo/redo, configuración HP, ORTHO/POLAR, SNAP F9, OSNAP F3, unidades, capas básicas, autoguardado local, JSON, DXF y PDF.

## Limitaciones importantes
- No es todavía un reemplazo completo de AutoCAD ni de Civil 3D.
- DWG directo no está implementado en el motor Android nativo. La conversión DWG del editor web carga un módulo externo y necesita Internet.
- La compatibilidad DXF cubre entidades frecuentes, no todos los objetos, bloques, referencias externas, estilos ni objetos proxy.
- En Android nativo faltan operaciones avanzadas como TRIM, EXTEND, FILLET, CHAMFER, bloques dinámicos, layouts y plot styles.
- Los archivos PDF y las medidas deben revisarse antes de usarse como documentación de obra.
- Los APK de CI son compilaciones debug para pruebas, no paquetes firmados para Google Play.
- No instalar el APK antiguo 0.1.0 (basado en WebView); el APK nativo 0.4.0 debe pasar la compilación y validación antes de publicarse.

## Compilar Android
Requiere JDK 17, Gradle 8.9 y Android SDK 35:

```bash
gradle -p android assembleDebug --no-daemon
```

El APK se genera en `android/app/build/outputs/apk/debug/app-debug.apk`.

## Licencia
Por definir antes de la distribución pública del producto.
