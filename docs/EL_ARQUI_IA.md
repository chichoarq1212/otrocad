# El Arqui IA — Arquitectura asistida en OtroCAD

## Actualización del 4 de noviembre de 2026 · conversación y fuentes

- El flujo comienza con un pedido en texto. Los ajustes se muestran en un desplegable después de generar la propuesta; no es necesario rellenar el formulario.
- Interpreta medidas con `x`, `por` y números escritos, hasta cuatro dormitorios/baños, una o dos plantas, retiros y muros. Modifica cocina, sala y dormitorios con incrementos acumulativos medidos en la geometría; rechaza ampliaciones que no caben. Permite retirar lavandería, vestidor e isla, cerrar/abrir cocina y solicitar criterio accesible.
- El número de baños solicitado se distribuye entre las plantas. Las peticiones sin operación reconocida o de tipologías no soportadas conservan la propuesta previa y explican el límite. No equivale a comprensión libre de cualquier encargo.
- El programa, unidades y origen se incluyen en marcadores de las entidades generadas. Se recuperan del modelo y del autoguardado/formato interno que conserva propiedades. **La exportación e importación DWG/DXF actual no conserva estos metadatos de conversación**; sí conserva la geometría compatible. Los diseños anteriores sin programa embebido no permiten recuperar automáticamente sus requisitos.
- Antes de regenerar se detectan cambios manuales dentro del grupo y se avisa de su sustitución. Las entidades ajenas se conservan. La regeneración todavía reemplaza el grupo completo, no es una edición semántica de cada muro.
- La biblioteca incorpora fichas públicas de Neufert (nota editorial GG de la 16.ª edición, 2013) y Plazola (catálogo universitario UPAEP). Son referencias bibliográficas y tipológicas: **no se incorporaron los libros completos ni se extrajeron de ellos tablas dimensionales**.
- Se verificaron reglas seleccionadas de la actualización NEC-HS-AU 2019 (Acuerdo 007-19; Registro Oficial 924): campo de aplicación pp. RO 12–13, circulación tabla 1 p. RO 19 y puertas tabla 7 p. RO 27. La revisión comprueba el ancho libre del pasillo entre caras de muro y mantiene pendientes marcos, altura, giros, mobiliario, ruta y normativa del predio. Las viviendas privadas reciben estos criterios como orientación salvo exigencia aplicable.
- Las áreas útiles aproximadas descuentan espesores; los objetivos propios de habitaciones permanecen identificados como reglas de OtroCAD. Los retiros propuestos no se presentan como retiros legales de Quito u otra ciudad.
- **Nueva integración en línea:** el editor de Cloudflare consulta automáticamente `/api/arqui` y `/api/arqui/status`; Cloudflare Workers AI u OpenAI pueden interpretar pedidos conversacionales con todo el programa y proponer revisiones. El motor CAD 2D sigue generando geometría editable local, no BIM libre. El backend está implementado y probado con respuestas simuladas, pero permanece desactivado hasta que el propietario configure Cloudflare Access, su audiencia y `ARQUI_ACCESS_ENABLED=yes`; véase `docs/ARQUI_IA_OPENAI_SETUP.md`.

Fuentes públicas consultadas:

- https://editorialgg.com/media/catalog/product/uploader/805aed1db5aeaa7db4a9ee52199428d4.pdf
- https://ils.upaep.mx/bib/44210
- https://www.registroficial.gob.ec/edicion-especial-no-924-6/
- Reproducción consultada del documento primario publicado en RO 924: https://derechoecuador.com/uploads/content/pdf/2019/05/pdf190527055044_1558997918.pdf

Validación: pruebas del intérprete y geometría, UI montada, recuperación del modelo, advertencia de cambios manuales, conservación de contenido ajeno, suite CAD existente y revisión visual en navegador.

## Estado base previo — noviembre de 2026

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

El generador usa un **esquema determinista de anteproyecto**, no un algoritmo equivalente a Revit ni un sistema BIM paramétrico. Usa dormitorios de 2,80 m y 9 m² como **objetivos internos orientativos**, y evita dibujar un garaje que no cabe en el ancho disponible. Son criterios para detectar errores evidentes, **no son citas de una edición de Plazola, Neufert ni normas ecuatorianas**.

El sistema NO ha sido alimentado con los libros completos de **Plazola** o **Neufert**. No debe afirmar que una planta «cumple Plazola» o «cumple Neufert» sin un ejemplar legítimo, edición identificada, pasajes relevantes y una comprobación explícita. Para una biblioteca de PDF grandes se necesitará indexación por capítulos/páginas, controles de derecho de uso, recuperación de fragmentos y referencias de página. Solo después deben incorporarse criterios derivados de esas fuentes a una revisión estructurada.

Aspectos que aún requieren desarrollo y revisión de un arquitecto:

- Normativa local de uso de suelo, retiros y alturas, accesibilidad, iluminación y ventilación natural, salidas y seguridad contra incendios.
- Estructura portante, escaleras reglamentarias, instalaciones MEP, puertas de evacuación, detalles y coordinación entre especialidades.
- Distribuciones alternativas y optimización de adyacencias con inteligencia generativa completa.
- Construcción y modificación libre de objetos BIM 3D, muros paramétricos, familias y detección de interferencias.
- Activación productiva del modelo en línea: la ruta y el binding Cloudflare ya están incluidos, pero requieren credenciales de Cloudflare Access y control del propietario; OpenAI es opcional mediante secreto servidor, nunca incrustado en JS público.

Esta primera etapa es una **demostración funcional de dibujo arquitectónico progresivo y editable**, no un proyecto final listo para construir.
