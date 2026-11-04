# OtroCAD Android 0.5.8 alfa — El Arqui IA

La versión Android 0.5.8 alfa (`versionCode 22`) recopila el editor CAD/Civil/MEP existente y añade el nuevo asistente arquitectónico **El Arqui IA**.

## El Arqui IA — edición arquitectónica

- Avatar oficial aportado por el propietario, optimizado con transparencia real, flotante solo en las pestañas de dibujo/arquitectura.
- No sustituye ni mezcla los asistentes **Ing. Jaimito** (Civil 3D) e **Ing. Keeelvin** (MEP/HVAC).
- Instrucciones arquitectónicas básicas en lenguaje natural para viviendas conceptuales (lote, número de plantas y dormitorios, garaje si cabe).
- Generación de planta arquitectónica 2D con recinto de cada habitación, pasillo, muros, puertas, ventanas, textos, áreas y cotas, sin convertir el plano en imagen.
- Vista previa, auditoría dimensional, aprobación antes de dibujar, animación progresiva de entidades, cancelación, sustitución segura del diseño anterior y posibilidad de deshacer.
- Capas CAD dedicadas para paredes, aberturas, ventanas, textos, cotas, terreno y estacionamiento.
- Biblioteca técnica opcional **solo para extractos TXT/MD que el usuario esté autorizado a usar**. Los libros completos de Plazola y Neufert **no están cargados**. Una API generativa de OpenAI está preparada a nivel de código, pero requiere autenticación, credenciales y cuotas antes de activarla.

## Se conserva de 0.5.7

- Dibujo CAD 2D y layouts, lectura DXF/DWG dentro de las limitaciones actuales.
- Coordenadas UTM y puntos topográficos; TIN, curvas, perfil, secciones y volúmenes en Civil 3D.
- Señalización vial editable: marcas, pasos peatonales, flechas y panel de propiedades con vista previa.
- MEP, agua, sanitaria, HVAC, cálculo preliminar de cargas térmicas y cuartos fríos, y generación del esquema 2D de un cuarto frigorífico.
- Uso sin conexión del editor empaquetado en APK híbrido; la IA generativa de terceros necesita conectividad y activación.

## Instalación y advertencias

El APK alfa es **debug de pruebas**, no firmado para Play Store. Su firma puede ser diferente de instalaciones previas. **Respaldar proyectos antes de desinstalar una versión anterior.**

Las plantas automáticas son **anteproyectos orientativos**, no modelos BIM paramétricos, no documentación de construcción aprobada y no acreditan cumplimiento de Plazola, Neufert ni ordenanzas del municipio. Requieren revisión técnica de arquitectura, estructura, evacuación, accesibilidad, ventilación, normativa y especialidades.

Documentación: [El Arqui IA](docs/EL_ARQUI_IA.md) · [Conectar OpenAI con seguridad](docs/ARQUI_IA_OPENAI_SETUP.md).
