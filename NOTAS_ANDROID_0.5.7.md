# OtroCAD Android 0.5.7 alfa · actualización integrada

Versión de aplicación: **0.5.7-test-alpha** · **versionCode 21**.

## Qué incluye el APK híbrido offline

El paquete de Android 0.5.7 ya no copia solo `editor.js` y unos pocos archivos: la compilación ahora incorpora **todo el directorio oficial `editor/`**, incluidos los motores, las hojas de estilo, los recursos de apoyo y los archivos de proveedores. Un verificador comprueba la presencia de estos elementos antes de construir el APK y una auditoría inspecciona su contenido.

### CAD general y edición

- Editor CAD 2D, comandos de teclado y entrada dinámica de medidas junto al cursor.
- Herramientas de edición, capas, estilos, layouts y lectura/exportación DXF según el alcance implementado.
- Optimización del área de trabajo para móviles y orientación horizontal, dibujo táctil y puntos de arrastre compatibles.
- Mantiene el modo Dibujo separado de las coordenadas topográficas UTM.

### Civil 3D / topografía

- Coordenadas Este/Norte UTM junto al cursor **solo en Civil**; ingreso Norte, Este y Cota para polilíneas.
- Importación de puntos CSV/TXT y bloques de texto PNEZD, con vistas previas y orden de columnas.
- Modelos TIN, curvas, pendientes, perfiles, secciones, volúmenes y exportación LandXML, según la funcionalidad ya existente.
- Acceso a mapa de Ecuador desde Civil, sujeto a disponibilidad cartográfica.
- Asistente flotante **Ing. Jaimito** y barra Civil rediseñada, sin textos superpuestos.

### Señalización vial

- Marcas continuas, discontinuas y dobles; borde de calzada.
- Paso cebra, flechas direccionales, zonas cebradas y símbolos/señales.
- Panel lateral para seleccionar eje, propiedades, vista previa y aplicación al dibujo como geometría CAD editable.
- Herramientas de preproyecto; la señalización y sus dimensiones requieren revisión de normativa local.

### MEP / climatización

- Redes de agua potable, desagüe sanitario, lluvias, gas, protección contra incendios y ductos HVAC; accesorios y símbolos.
- Corrección de la superposición visual en la cinta MEP y AIRE ACONDICIONADO.
- Asistente flotante **Ing. Keeelvin** con su imagen oficial, apoyo contextual y accesos a los cálculos.
- **Cargas térmicas HVAC preliminares:** sensible/latente, transmisión, radiación, ventilación y cargas internas; resumen en kW, BTU/h y TR.
- **Cuartos fríos preliminares:** transmisión, infiltración, enfriamiento/congelación del producto, desescarche y cargas internas; capacidad estimada según horas de operación y enfriamiento.
- Informe CSV y creación de planta 2D esquemática de cuarto frío con puerta, paneles y evaporador.

## Instalación y comprobación

El APK principal de esta actualización es el **híbrido offline**. Abre el editor incluido en el teléfono sin requerir conexión para el dibujo. El botón **Online** ofrece acceso a la web cuando haya internet. El APK **nativo experimental** es una aplicación diferente y todavía no contiene el conjunto completo de herramientas web.

Se trata de un **APK debug de pruebas**, no firmado para la tienda. Si aparece un error de firma al instalar sobre una versión anterior, **respalda tus planos antes de considerar desinstalarla**. Para verificar la actualización, entra en Civil → Señalización y en MEP → Cargas térmicas / Cuartos fríos. La versión se puede comprobar en las propiedades de la aplicación.

**Limitaciones:** las fórmulas de cargas térmicas son simplificadas y no sustituyen dimensionamiento profesional, selección de compresores, conductos, pérdidas de presión, normativa vial o ingeniería de detalle. Los formatos DXF/DWG y funciones avanzadas requieren pruebas con planos reales. El APK Android 0.5.7 no debe considerarse equivalente al motor CAD nativo independiente.

El flujo de GitHub Actions conserva un artefacto `OtroCAD-Android-0.5.7-verified` incluso si la publicación como Release falla. Su instalador APK se denomina `OtroCAD-Android-0.5.7-alpha.apk`.
