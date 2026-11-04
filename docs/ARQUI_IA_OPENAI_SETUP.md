# Conectar El Arqui IA con OpenAI — configuración opcional

## Estado

OtroCAD incluye El Arqui IA con un motor de **dibujo arquitectónico local funcional**. La capacidad generativa mediante OpenAI está **preparada pero desactivada** porque no se han suministrado credenciales, autenticación ni cuota de API.

Archivo del proxy seguro: `workers/arqui-ai.js`. Está separado del despliegue estático existente de OtroCAD: **no cambia la configuración `wrangler.jsonc` ni publica una API abierta**.

## Para activarlo con permisos del propietario

1. Crear un Worker independiente con Cloudflare Workers que utilice `workers/arqui-ai.js` como código de entrada y exponga `/api/arqui`.
2. Proteger su dominio/ruta mediante **Cloudflare Access** (validación de identidad) y colocar un **rate limiter** por usuario/identidad con cuota y alertas de coste. CORS por sí solo NO protege una API.
3. Crear en el Worker el secreto `OPENAI_API_KEY` desde Wrangler, Cloudflare o un gestor de secretos. **Nunca** agregarlo a JavaScript de OtroCAD, al GitHub público, a una web PWA ni a un APK.
4. Configurar las variables de entorno `OPENAI_MODEL` (un modelo compatible con Structured Outputs), `ALLOWED_ORIGIN` (origen HTTPS exacto del editor) y, **solo después de aplicar Access y rate limiting**, `ARQUI_ACCESS_ENABLED=yes`.
5. Configurar en la página de OtroCAD, antes de cargar `arqui-assistant.js`:
   `window.OTROCAD_ARQUI_AI_ENDPOINT='https://SERVICIO-AUTORIZADO.example.com/api/arqui'`.
6. Probar con una cuenta habilitada por Access, un entorno de pruebas y límites presupuestarios bajos. El motor **valida de nuevo** dimensiones/ambientes y requiere aprobación antes de escribir entidades CAD.
7. Si el navegador y Cloudflare Access son de orígenes diferentes, revisar la política de cookies/autenticación, que depende del dominio. Para uso real es preferible una ruta del mismo dominio protegida con Access, no un endpoint público.
   
Referencias oficiales de API: https://developers.openai.com/api/docs/guides/structured-outputs y https://developers.openai.com/api/reference/resources/responses/methods/create.

## Biblioteca Plazola y Neufert

El editor ya incluye fichas públicas y reglas seleccionadas de NEC-HS-AU 2019, con su ámbito explícito. Las fichas bibliográficas no proporcionan páginas técnicas de los libros. Ver `docs/EL_ARQUI_IA.md` para el alcance de consulta y la recuperación de programas.

No está autorizado ni implementado copiar o publicar automáticamente libros completos. Para incorporar fuentes del propietario con una edición identificada y derechos de uso:

- **Fase local disponible:** importar extractos TXT/MD por capítulo desde la pestaña Biblioteca técnica. El navegador conserva los fragmentos localmente; el servicio externo solo recibe los pasajes relevantes si el usuario marca expresamente la autorización.
- **Fase PDF grandes pendiente:** indexar el documento con número de edición, capítulo y página; recuperar páginas relevantes; diseñar reglas verificables por tipología, jurisdicción y edición; citar siempre páginas; generar un informe de comprobaciones, no afirmar cumplimiento automático.
- No implementar verificación de áreas, alturas, ancho de puertas, escaleras o evacuación sobre una supuesta tabla de Plazola o Neufert sin tener el texto y su contexto.

## Conversación libre y estado real

Cuando se configura el servicio, el editor envía el mensaje tal como lo escribió el usuario, el programa anterior validado y hasta ocho intervenciones recientes de la conversación. La interpretación local deja de filtrar primero el texto: expresiones informales y peticiones acumuladas llegan al modelo. Si el servicio necesita una aclaración o identifica una condición que el dibujo no puede garantizar, responde sin sustituir la propuesta anterior.

Esto no conecta el servicio por sí solo: requiere la configuración y protección indicadas arriba. Sin servicio, funciona únicamente el intérprete local de reglas. Aunque el modelo mejore la conversación, el motor geométrico actual sigue usando una distribución predefinida con pasillo central: no puede garantizar una implantación de 12 × 8 m, una distribución sin eje central ni la posición libre de todos los ambientes. Se necesita un motor espacial adicional para resolverlas. El historial conversacional de esta integración se mantiene durante la sesión, no queda recuperado automáticamente al reabrir el dibujo.

## Alcance técnico

La API generativa puede sugerir un **programa numérico** —terreno, plantas, dormitorios, baños, garaje, muros, presentación, equipamiento y condiciones orientativas—. No acepta JS arbitrario, comandos de shell ni escrituras directas al editor. El CAD local genera y controla la geometría, muestra la vista previa y requiere confirmación del operador.

Los dibujos generados son **anteproyectos 2D**. No sustituyen proyectos arquitectónicos aprobados, cálculos estructurales, coordinación MEP, BIM 3D o cumplimiento municipal. Se requiere supervisión profesional.
