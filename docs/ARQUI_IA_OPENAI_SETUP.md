# El Arqui IA en línea — activación de Cloudflare Workers AI u OpenAI

Actualización: 4 de noviembre de 2026. Se integró un backend real en el propio Worker de OtroCAD y el editor ya reconoce automáticamente la ruta HTTPS del mismo dominio, sin poner claves en el navegador. **El código está listo, pero el modelo no podrá responder hasta terminar la configuración privada de autenticación y permisos en Cloudflare.**

## Arquitectura implantada

- Web y CAD: `otrocad.cristhian-torres-arq.workers.dev/editor/`.
- Endpoint de inferencia: `/api/arqui` (POST); estado: `/api/arqui/status` (GET).
- Router Cloudflare: `workers/index.js`; servicio de IA: `workers/arqui-online.js`.
- Configuración: `wrangler.jsonc` con script Worker, assets, binding `AI`, y limitador `ARQUI_RATE_LIMIT` (8 solicitudes/minuto por identidad y ubicación de Cloudflare, límite aproximado).
- Modelos: por defecto Cloudflare Workers AI `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, o OpenAI si se configura `OPENAI_API_KEY` y `OPENAI_MODEL`.
- El asistente muestra si detecta un servicio en línea activo. Si la activación no está completa devuelve al modo local e informa que está pendiente; si ocurre un error de autorización no pretende que la IA haya ejecutado el pedido.
- El texto llega al modelo con el programa anterior y hasta ocho intervenciones recientes. El modelo devuelve un programa numérico; OtroCAD valida y presenta la vista previa. **Dibujar en CAD requiere aprobación expresa.** No se ejecutan comandos arbitrarios del modelo.
- El generador 2D continúa siendo un motor geométrico esquemático. La IA en línea interpreta mejor textos libres, pero todavía NO inventa geometría espacial flexible ni asegura normativas urbanísticas.

## Activar el servicio con permisos del propietario (paso obligatorio, una sola vez)

1. En Cloudflare, confirmar que el proyecto **otrocad** sigue conectado al repositorio `chichoarq1212/otrocad`, rama `main`, con build `node scripts/build-pages.cjs` y despliegue `npx wrangler deploy`. Publicar/reiniciar despliegue si el Worker todavía sirve la configuración anterior.
2. En Cloudflare Zero Trust, configurar un **Access Application** para restringir la API. Autorizar solo la cuenta o grupo designado. Debe llegarse al Worker con un token firmado por Cloudflare Access. En Workers con assets, `ctx.access` puede no estar disponible y se comprueba criptográficamente el header `Cf-Access-Jwt-Assertion`. No basta con CORS.
3. En el panel de la aplicación Access, copiar el **Application Audience (AUD) Tag**, y localizar el team domain de la cuenta (`tuequipo.cloudflareaccess.com`).
4. En Workers & Pages → **otrocad** → Settings → Variables and Secrets, configurar:
   - `ACCESS_TEAM_DOMAIN`: dominio de equipo de Access sin `https://`.
   - `ACCESS_AUD`: AUD real de la aplicación Access.
   - `ARQUI_ALLOWED_EMAILS`: dirección(es) autorizada(s), separadas por coma (recomendado).
   - `ARQUI_ACCESS_ENABLED`: **`yes`**, pero SOLO después de proteger la ruta en Access y confirmar el binding de rate limiting.
   - No se necesita `OPENAI_API_KEY` para Cloudflare Workers AI: el binding `AI` ya aparece en `wrangler.jsonc` y usa la cuenta Cloudflare correspondiente. Incurre en uso medido según la cuenta.
   - Opcional, usar OpenAI en lugar del motor Cloudflare: agregar el secreto `OPENAI_API_KEY` y variable `OPENAI_MODEL` con un modelo compatible con Structured Outputs. Nunca enviar la clave por chat, GitHub, web o APK.
   - Opcional `ARQUI_AI_MODEL`: un identificador de modelo Workers AI compatible con JSON Mode.
5. Redesplegar si los bindings o variables no están aplicados, y consultar desde el dominio público `/api/arqui/status`. Debe mostrar `online:true`; ese estado indica configuración y permisos, **no equivale a haber probado una consulta real autenticada**.
6. Entrar por Access, abrir el editor, escribir: `Quiero una casa 10x8 con 3 habitaciones, baño máster, baño compartido, patio de 3 metros, lavandería y dos estacionamientos`; pulsar **Proponer / actualizar diseño**; verificar respuesta con la etiqueta **IA en línea conectada**; revisar y aprobar la geometría.
7. Establecer límites presupuestarios/alertas en Cloudflare Workers AI u OpenAI. La suscripción ChatGPT no cubre automáticamente el consumo de API de un proyecto externo.

La API está deshabilitada de forma deliberada si faltan Access y la bandera de activación, el rate limiter o el modelo. El Worker valida los JWT (issuer, audience, expiración y firma RS256) usando las claves públicas de Access y revalida el JSON antes de devolverlo a CAD. El rate limiter de Workers es aproximado por ubicación, no constituye una cuota presupuestaria global estricta.

## Biblioteca Plazola/Neufert y privacidad

No hay libros completos incluidos ni tablas normativas inventadas. Los extractos TXT/MD del usuario solo se mandan a IA si se marca la casilla de consentimiento. Si se activan, el texto introducido, el programa previo y hasta ocho mensajes de contexto se envían al proveedor de IA seleccionado para generar una respuesta; no se publica en GitHub. No se deben introducir datos personales sensibles ni expedientes confidenciales sin comprobar primero las políticas de tratamiento del proveedor.

Documentación: https://developers.cloudflare.com/workers/static-assets/binding/ ; https://developers.cloudflare.com/workers/configuration/cloudflare-access/ ; https://developers.cloudflare.com/workers-ai/features/json-mode/ ; https://developers.openai.com/api/docs/guides/structured-outputs
