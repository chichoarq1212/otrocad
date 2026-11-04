# El Arqui IA — Arquitectura asistida en OtroCAD

## Estado real — noviembre de 2026

**Implementado en el editor web y en el paquete fuente offline:**

- Personaje oficial **El Arqui IA**, tomado de la ilustración aportada por el propietario; transparencia real y avatar flotante en el módulo arquitectónico (Dibujo, Modificar, Anotar, Bloques, Capas, Vista).
- El **Ing. Jaimito** sigue únicamente en Civil 3D; el **Ing. Keeelvin**, en MEP/Aire Acondicionado.
- Entrada conversacional de instrucciones arquitectónicas sencillas: dimensiones de lote, número de plantas, dormitorios y estacionamiento lateral cuando hay espacio.
- Generador local de plantas 2D conceptuales con muros y aberturas, puertas con arco de giro, ventanas, separación de ambientes, pasillo, escaleras esquemáticas en dos plantas, textos de espacios, áreas y cotas.
- Vista previa y auditoría dimensional **antes de escribir en el Modelo**.
- Aplicación solo por decisión del usuario, creación progresiva de entidades CAD, cancelación, una operación de deshacer, sustitución restringida al último proyecto de El Arqui, y eliminación sin tocar otras entidades.
- Vinculación de extractos técnicos **TXT y MD proporcionados por el usuario**, almacenados en su navegador; no se publican en GitHub ni en la web para terceros. La incorporación de PDF completo no está habilitada.
- Endpoint HTTPS opcional para que un servicio de IA generativa sugiera un **programa numérico validado**, que el motor local vuelve a comprobar antes de dibujar. No permite inyectar entidades arbitrarias ni ejecutar código producido por IA.

## Cómo probar

1. Abrir OtroCAD, ir a **DIBUJO** y pulsar **El Arqui IA** (avatar o botón de la cinta).
2. Escribir: `Diseña una vivienda de dos plantas en un terreno de 12x20 m con tres dormitorios y garaje`.
3. Examinar la vista previa, la lista de observaciones y la distribución.
4. Modificar el tamaño del terreno, plantas o dormitorios si es necesario y pulsar **Revisar medidas**.
5. Pulsar **Dibujar en CAD**. En el Modelo aparecerán las líneas, arcos, textos, ventanas y cotas por grupos progresivos. Se pueden editar con comandos CAD ordinarios.
6. Para corregir una propuesta, escribir por ejemplo `agranda la cocina 50 cm`, revisar la nueva vista y aprobar la sustitución del diseño anterior.
7. Presionar Ctrl+Z o retirar únicamente el diseño de El Arqui para revertirlo.
8. Si se dispone de extractos autorizados de Plazola/Neufert, abrir **Biblioteca técnica** y añadir archivos de texto. Los pasajes solo se transmiten a un eventual servicio IA externo con consentimiento explícito.

## Criterio profesional y límites

El generador usa un **esquema determinista de anteproyecto**, no un algoritmo equivalente a Revit ni un sistema BIM paramétrico. Verifica dimensionalmente la circulación de 1,20 m, dormitorios esquemáticos de 2,80 m y 9 m² como **objetivos internos orientativos**, y evita dibujar un garaje que no cabe en el ancho disponible. Son criterios para detectar errores evidentes, **no son citas de una edición de Plazola, Neufert ni normas ecuatorianas**.

El sistema NO ha sido alimentado con los libros completos de **Plazola** o **Neufert**. No debe afirmar que una planta «cumple Plazola» o «cumple Neufert» sin un ejemplar legítimo, edición identificada, pasajes relevantes y una comprobación explícita. Para una biblioteca de PDF grandes se necesitará indexación por capítulos/páginas, controles de derecho de uso, recuperación de fragmentos y referencias de página. Solo después deben incorporarse criterios derivados de esas fuentes a una revisión estructurada.

Aspectos que aún requieren desarrollo y revisión de un arquitecto:

- Normativa local de uso de suelo, retiros y alturas, accesibilidad, iluminación y ventilación natural, salidas y seguridad contra incendios.
- Estructura portante, escaleras reglamentarias, instalaciones MEP, puertas de evacuación, detalles y coordinación entre especialidades.
- Distribuciones alternativas y optimización de adyacencias con inteligencia generativa completa.
- Construcción y modificación libre de objetos BIM 3D, muros paramétricos, familias y detección de interferencias.
- Conectividad real a un servicio OpenAI: falta configurar un endpoint seguro, autenticación y credenciales de API del propietario; no se almacenan claves en JavaScript público.

Esta primera etapa es una **demostración funcional de dibujo arquitectónico progresivo y editable**, no un proyecto final listo para construir.
