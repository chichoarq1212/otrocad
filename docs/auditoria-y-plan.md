# OtroCAD: auditoría inicial y plan

Base auditada: main a2d7624dab63f9ab8e35609e6ffce759186eabb9 (0.5.4 alfa). Las funciones descritas son hallazgos de código, no una certificación completa.

## Estado inicial
- El editor guarda un único arreglo de entidades en localStorage. Ese almacenamiento pertenece al navegador y se pierde si se eliminan sus datos. No es un archivo de proyecto ni una garantía contra todos los cierres o fallos.
- DXF inicial: exporta geometría limitada, omite textos y elipses, representa los arcos como segmentos y transforma los hachurados en contornos. El importador acepta un subconjunto de entidades; no se ha validado con planos complejos.
- DWG: la importación del editor descarga una biblioteca desde una CDN; no está probada ni funciona sin acceso a dicha dependencia. No existe escritura de DWG en el editor.
- Android: hay código nativo Canvas, pero la actividad de inicio es HybridActivity y utiliza WebView. La acción de Android crea un APK debug e inspecciona sus metadatos: no prueba instalación ni funcionamiento en un dispositivo. La release 0.5.4-test existe.
- Windows: no se encontró un instalador. El service worker está pensado para acceso sin conexión del editor web; eso no equivale a un instalador Windows ni verifica todos los escenarios offline.
- Cloudflare: el flujo existente comprueba una cadena en la página de descargas, no la correspondencia exacta del código publicado ni la descarga e instalación del APK. El editor público fue accesible en la auditoría.
- El repositorio no incluye un archivo de licencia; antes de integrar código de terceros hay que acordar la licencia y comprobar las obligaciones de distribución.

## Primera mejora en esta rama
Copia local previa a una edición, recuperación manual y aviso si falla el almacenamiento. DXF ahora incluye texto, arcos, elipses alineadas y hachurados sólidos rectangulares; advierte de entidades omitidas o simplificadas tanto al abrir como al exportar. Aún no es una conversión sin pérdida. Existe una vivienda conceptual articulada de demostración editable con 251 entidades y mobiliario CC0, con comprobaciones básicas de despeje de puertas, una captura real de la interfaz y una portada preparada para mostrarla. La muestra es conceptual y no constituye un proyecto constructivo verificado. Los datos del navegador siguen siendo una copia local: eliminarlos también elimina las copias. El respaldo descargable existente sigue disponible para conservar entidades que DXF aún no soporta.

## DWG: alternativas para evaluar
- GNU LibreDWG lee y escribe DWG, con licencia GPL-3.0 o posterior. La integración requiere evaluar compatibilidad de licencia, versiones, cobertura, compilación web/Android/Windows y pruebas con AutoCAD y otros lectores. https://www.gnu.org/software/libredwg/
- Open Design Alliance ofrece SDK para DWG mediante membresía y condiciones comerciales. Antes de elegirlo hay que comprobar cobertura, tarifas, redistribución y plataformas. https://www.opendesign.com/pricing
Ninguna alternativa está integrada ni validada aquí.

## Etapas siguientes
1. Persistencia: diseñar múltiples proyectos, snapshots transaccionales, restauración de versiones, pruebas de cierres y almacenamiento lleno; guardar como DXF con advertencias reales de fidelidad. Probar en navegadores y dispositivos.
2. DXF: preservar unidades, geometría, textos, capas, colores y grosores; implementar soporte explícito o diagnóstico de entidades no soportadas; verificar con lectores independientes y abrir de nuevo en OtroCAD. Evaluar DWG y licencia por plataforma.
3. Crear vivienda editable con dimensiones y entidades compatibles. Abrirla en el editor real, comprobarla y capturar la interfaz para la portada.
4. Verificar y completar herramientas, precisión, selección, interfaz táctil y controles. Migrar funcionalidad al motor nativo de Android y crear instalador Windows offline.
5. Automatizar pruebas de instalación, firma y versionado sin sobrescribir una release existente; validar los bytes descargados y la versión realmente servida, incluida actualización de service worker y escenarios offline.

## Android nativo experimental
Se añadió una variante aislada con identificador propio, actividad Canvas nativa y sin permiso de Internet. Una revisión previa compiló, se instaló y arrancó en un emulador; los cambios posteriores requieren repetir esas pruebas y probarse en equipos físicos. Es una alfa independiente: no tiene paridad con el editor web, ni DWG auténtico, ni biblioteca de bloques web. La versión híbrida permanece separada.
