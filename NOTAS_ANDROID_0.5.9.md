# OtroCAD Android 0.5.9 alfa — El Arqui IA profesional, MA y Guardar como

**Versión:** 0.5.9-test-alpha · versionCode 23.

## Novedades
- **El Arqui IA:** diálogo arquitectónico más elaborado, interpretación de terreno y retiros, espesor exterior/interior de muros, número de dormitorios, plazas de parqueo, estilo técnico/concurso, mobiliario, hatch y cotas.
- Plantas 2D con muros de espesor real, puertas con giro, ventanas con hojas, muebles básicos de dormitorios, baños, sala, comedor, cocina y lavado, estacionamiento (una plaza o tándem si hay espacio), acotado exterior/interior, norte, cuadro de áreas por ambientes y gráfica de anteproyecto.
- Dibujo progresivo de entidades CAD editables, vista previa basada en la misma geometría del CAD, deshacer, cancelar, cambiar propuesta y mantener capas separadas.
- **MA / MATCHPROP:** comando de teclado o herramienta Igualar propiedades; origen y destinos, cambio de capa, color, tipo/grosor de línea, propiedades textuales y hatch cuando sean compatibles. Geometría no cambia.
- **Guardar como:** elección de nombre y DWG 2018 (binario AC1032 validado por relectura), DXF o proyecto editable JSON. Si el motor DWG no convierte fielmente, se muestra el error y queda DXF como alternativa.
- **Progreso:** guardado local por cambios, recuperación automática en IndexedDB y un historial con puntos recientes. `Ctrl+S` inicia Guardar o Guardar como.
- Conserva Civil 3D, señalización vial, Ing. Jaimito, Ing. Keeelvin, MEP/HVAC, cargas térmicas y cuartos fríos.

## Limitaciones
El motor de El Arqui IA sigue siendo un generador de anteproyecto 2D basado en reglas y no un diseñador arquitectónico universal conectado a OpenAI. No se han importado libros completos de Plazola o Neufert. Los criterios de circulación y espacios no sustituyen revisión de normativa, estructura, instalaciones o seguridad.

El APK es híbrido **offline** (no el proyecto Android nativo experimental) y de prueba, sin firma comercial. Respaldar los archivos antes de reemplazar una instalación con otra firma. La instalación puede requerir desinstalar versiones incompatibles después de hacer copias de seguridad.

El autosave protege el progreso dentro de la app/navegador; no sobrescribe automáticamente un archivo DWG arbitrario en Descargas sin autorización del sistema operativo.
