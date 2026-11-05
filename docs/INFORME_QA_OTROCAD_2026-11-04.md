# OtroCAD · Recorrido funcional integral

**Fecha local (Ecuador):** 4 de noviembre de 2026  
**Versión del código de aplicación auditada:** commit `00ff55dd` (la revisión final `9a770ae8` agrega pruebas y su ejecución sin modificar los archivos de la aplicación).  
**Ambiente:** Chrome headless sobre Ubuntu en GitHub Actions, aplicación web servida desde la salida estática de producción; pruebas complementarias unitarias y trabajos de compilación para Android/Windows.  
**Resultado:** las pruebas automatizadas principales pasan, con reservas detalladas abajo.

## Comprobación A · Recorrido de interfaz y operaciones reales

**Prueba:** `tests/otrocad-full-tour-browser.cjs`  
**Ejecución:** https://github.com/chichoarq1212/otrocad/actions/runs/41961539480  
**Resultado:** 28 comprobaciones correctas, 0 errores JavaScript no controlados, 0 llamadas a APIs generativas.

- Arranque del editor con 11 pestañas y al menos 27 herramientas, verificación de carga de CAD, Civil, MEP, térmico, topografía, geolocalización, guardado, biblioteca arquitectónica.
- Visita de cada pestaña: ARCHIVO, DIBUJO, MODIFICAR, ANOTAR, BLOQUES, CAPAS, VISTA, CONFIGURACIÓN, CIVIL, MEP y HVAC. Todos los grupos de controles aparecieron.
- Dibujo con eventos de ratón reales: línea, rectángulo y círculo. Prueba de deshacer y rehacer.
- Comandos `MA`, `TR` y `L` a través de la barra de comandos.
- Guardado local, recarga de página y recuperación exacta de las entidades.
- Exportación y comprobación de la copia JSON editable.
- Apertura de vivienda de demostración: 251 objetos.
- Pestañas de Modelo/Presentación, cuadro Guardar como, y creación de un proyecto nuevo.
- Interfaz móvil a 390 × 844, lienzo y barra de comandos operativos; captura adicional apaisada.
- Verificación de que El Arqui carga fichas locales, sin selector de modelos ni servicios de IA.

## Comprobación B · Civil, MEP, coordenadas, DXF y reimportación

**Prueba:** `tests/otrocad-full-functional-tour.cjs`  
**Ejecución:** https://github.com/chichoarq1212/otrocad/actions/runs/41962133567  
**Resultado:** 19 puntos funcionales correctos, con generación y recuperación de entidades reales.

- `LINE`, `RECT`, `CIRCLE` y `PLINE` desde comandos numéricos, deshacer/rehacer; `MA`, `OFFSET`, `FILLET` y `TRIM` se activan.
- Importación de cuatro puntos XYZ y triangulación TIN (2 triángulos). Curvas de nivel (2 entidades).
- Tubería de agua fría y ductos de impulsión: capas MEP y cómputo generado (8 entidades MEP; 2 partidas).
- Creación de presentación de papel y conservación de los layouts en el respaldo JSON.
- Exportación DXF, contenido `ENTITIES`, reimportación de ese DXF exportado por OtroCAD: 20 entidades editables recuperadas (líneas, polígonos, círculos, polilíneas, puntos y textos). El informe de importación mostró 1 nota de compatibilidad; conservar el aviso visible y revisar la representación antes de continuar.
- Nuevo dibujo, importación del respaldo JSON (20 objetos), interfaz móvil y El Arqui local.
- Cero solicitudes a IA generativa.

## Verificación de versiones

Al comparar el commit base de aplicación `00ff55dd` con `9a770ae8` solo cambiaron **archivos de prueba y workflows**; no se alteró el editor ni el código Android/Windows.

- **Web:** `Validar y preparar OtroCAD Web`, `Verify Cloudflare live OtroCAD` y publicación satisfactorios sobre el código base probado.
- **Android:** `Android APK build and verification` y compilación Android híbrida satisfactorios sobre el mismo código de aplicación.
- **Windows:** `Windows offline experimental` satisfactorio sobre el mismo código de aplicación; instalación y arranque automatizados. Sigue siendo un instalador experimental sin firma.

## Riesgos y pruebas pendientes

1. **DWG complejo:** hay pruebas específicas de formatos y motor WASM, pero este recorrido en navegador no verificó todos los tipos de bloques dinámicos, atributos, dimensiones y layouts de archivos AutoCAD de terceros. Siempre conservar originales.
2. **iPhone físico:** el navegador automatizado emula un tamaño de pantalla, **no** las particularidades del motor Safari ni gestos táctiles reales de iOS.
3. **Windows físico y Android real:** las compilaciones y arranques automatizados no reemplazan pruebas con archivos del usuario en diferentes equipos.
4. **Civil 3D y MEP:** se ejecutaron escenarios reales reducidos, **no** un proyecto completo de infraestructura o instalaciones.
5. **PDF, drivers e impresión:** no se probó la impresión física ni todas las combinaciones de escala.
6. **Anteproyectos de El Arqui:** la biblioteca y el CAD local funcionan en los casos automatizados, pero la precisión de cada distribución requiere revisión arquitectónica y municipal. No es una licencia ni una certificación normativa.

**Conclusión:** las funciones verificadas funcionaron en el recorrido real de Chrome; no se encontraron errores graves en esos escenarios. No es correcto prometer que todas las operaciones de un CAD profesional estén libres de defectos. El informe separa lo probado de lo aún pendiente.
