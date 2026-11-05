# El Arqui Local — motor arquitectónico sin IA ni créditos

**Versión 2026.11.4** — la IA generativa, el backend Workers AI, el inicio de sesión y las claves API fueron retirados del proyecto. No existe endpoint para inferencia y el editor funciona en web, PWA/Android y Windows sin consultar modelos externos.

## Biblioteca incorporada (código abierto de OtroCAD)
- `editor/arqui-knowledge.js`: fichas locales de vivienda, dimensiones orientativas, escaleras en U, mobiliario, relaciones entre áreas social/privada/servicio, reglas auditables y tipologías.
- `editor/arqui-references.js`: fichas bibliográficas públicas de **Neufert** y **Plazola**, fuentes municipales ecuatorianas, bibliografía y extractos TXT/MD que los usuarios cargan en su dispositivo. **No están incorporados los libros protegidos por derechos de autor**.
- `editor/arqui-house-layout.js`: interpreta instrucciones frecuentes en español, diferencia casa vs terreno, resuelve la tipología compacta de tres dormitorios en dos plantas.
- `editor/arqui-professional.js`: convierte el plano validado en muros con grosor/hatch, vanos, puertas, ventanas, escalera con dos tramos y descanso, mobiliario, estacionamientos, áreas y cotas CAD editables.

## Tipologías documentadas

| Programa | Estado del motor | Alcance |
|---|---|---|
| Casa compacta de tres dormitorios, dos niveles | Geometría propia | Escalera en U coincidente, circulación central, baño principal privado y compartido, cocina y parqueo |
| Vivienda lineal de 1 planta | Geometría anterior | Distribución por bandas; revisar accesos y tamaños |
| Vivienda lineal de 2 plantas | Geometría anterior | Bandas y escalera conceptual; necesita revisión de continuidad |
| Casa con patio central, lote angosto, vivienda accesible | Fichas bibliográficas | No tienen todavía generador geométrico confiable. Se evita prometer un plano automático. |

## Objetivos de diseño internos

Los siguientes valores son **parámetros editables y orientativos**, no una certificación normativa ni reproducción de Plazola/Neufert:

| Elemento | Referencia del motor |
|---|---|
| Pasillo de vivienda | **1,20 m de ancho libre** |
| Puerta de entrada | **0,96 m de vano preliminar** |
| Puerta de dormitorio | **0,86 m** |
| Puerta de baño | **0,76 m** |
| Dormitorio común | **9 m²** y lado útil **2,20 m** como umbral preliminar |
| Dormitorio máster | **9 m²** y lado útil **2,50 m** |
| Sala–comedor | **16 m²** y lado útil **2,70 m** |
| Cocina | **6,5 m²**, lado útil **1,50 m** |
| Mesón de cocina | **0,60 m** de fondo |
| Isla | **1,40 × 0,80 m**, revisar pasos circundantes de **0,90 m** |
| Vehículo | Bahía de referencia **2,50 × 5,00 m** |
| Escalera vivienda compacta | U, 16 contrahuellas de **17,5 cm**, 7 huellas de **28 cm** por tramo y descanso de **1,05 m**, para **2,80 m** entre pisos |

Las escaleras requieren revisión de acceso inferior/superior, altura libre real, estructura, barandas y cumplimiento de la ordenanza del predio. La accesibilidad universal, el asoleamiento, ventilación, estacionamiento municipal, retiros y estructura **no están verificados automáticamente**.

## Ejemplo interno probado

«Quiero una casa 10 × 8 m con tres dormitorios, uno principal con baño y dos con baño compartido; cocina con isla, patio posterior de 3 m con lavandería, puerta trasera y estacionamiento para dos carros».

El motor interpreta 10 × 8 m como **huella construida**, no como terreno; propone **dos pisos** y muestra una **parcela hipotética 10 × 16,5 m** solo para representar patio y estacionamiento. Crea CAD editable con biblioteca y reglas, no con IA. La parcela hipotética **no debe utilizarse para trámites**.

## Cómo usar y revisar

1. Abrir **Dibujo → El Arqui · Motor Local**.
2. Describir las necesidades en español cotidiano. La vista previa se actualiza durante la escritura.
3. Pulsar **Proponer / actualizar diseño** y leer el panel de observaciones.
4. Verificar personalmente escaleras, accesos, anchos, equipamiento, luz y ventilación. El generador rechaza programas que su tipología no puede resolver; no asigna soluciones inexistentes.
5. Aprobar **Dibujar plano completo en CAD**. El resultado permanece editable por capas y se guarda en el modelo CAD.
6. Solicitar cambios dimensionales o utilizar los comandos de edición de OtroCAD.

**No hay consumo de créditos de IA, límite diario, variables API ni claves de proveedor.**

## Fuentes contextuales externas (referencias, no reproducción)
- Municipio de Quito, RTAU Tomo 2 (consultar versión y ámbito): https://www.ecp.ec/wp-content/uploads/2024/10/RTAU-Tomo2-EDIFICABILIDAD-v2.0-23-10-2024.pdf
- MIDUVI, Lineamientos Urbanísticos y Habitacionales (2024; ámbito limitado): https://www.habitatyvivienda.gob.ec/wp-content/uploads/2024/08/Lineamientos-urbanos-habitacionales-02-08-2024.pdf
- NEC-HS-AU, accesibilidad (ámbito determinado por norma): https://www.registroficial.gob.ec/edicion-especial-no-924-6/
- Plazola y Neufert: referencias bibliográficas indicadas en la biblioteca; **sus textos completos no se distribuyen**.
