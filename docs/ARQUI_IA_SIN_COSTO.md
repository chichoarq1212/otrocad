# El Arqui IA sin costos de inferencia para OtroCAD (BYOK)

**Configuración publicada en código el 4 de noviembre de 2026.**

OtroCAD es open source y **no utiliza ni paga por Cloudflare Workers AI**. `wrangler.jsonc` aloja archivos estáticos; no existe un `AI` binding ni un backend común que pague las consultas del público. Los archivos en `editor/` proporcionan la interfaz y la conexión directa desde el navegador.

## Cómo se conecta cada usuario

En OtroCAD → Dibujo → **El Arqui IA** → **Conectar mi IA · gratuita / cuenta propia**:

1. **OpenRouter (recomendado):** seleccionar OpenRouter y pulsar **Iniciar sesión con OpenRouter**. Este flujo OAuth PKCE lleva al usuario al sitio oficial de OpenRouter para iniciar sesión o crear cuenta y autorizar a OtroCAD. Al regresar, el editor intercambia el código de autorización directamente con OpenRouter; la clave resultante se mantiene **solo en la memoria de la página**. El programa utiliza exclusivamente `openrouter/free` (enrutador de modelos gratuitos, sujeto a la cuota de cada cuenta). La cuenta de OtroCAD no paga por esa inferencia. Como alternativa manual se puede pegar una clave personal de OpenRouter.
2. **Gemini:** seleccionar Gemini y copiar una clave personal del proyecto gratuito de Google AI Studio. El editor consulta directamente la API de Google con `gemini-3.5-flash-lite`, que tiene nivel gratuito sujeto a cuota y elegibilidad de la cuenta. **Si la cuenta tiene facturación habilitada, consulta los límites y condiciones antes de usarla.**
3. **Groq:** seleccionar Groq e introducir la clave personal. El proyecto utiliza `openai/gpt-oss-20b`. La disponibilidad gratuita depende de la cuota de la cuenta.
4. **OpenAI API:** opción avanzada con la clave del propio usuario; **puede generar costos individuales**. Una cuenta ChatGPT no es automáticamente una clave de API ni autoriza a una web externa. El usuario debe controlar sus límites. Algunas plataformas restringen las llamadas directas desde navegador.
5. **Sin conexión:** el motor CAD local continúa dibujando y generando vista previa sin consultar ningún modelo externo.

No se solicita ni se guarda ninguna clave maestra. El formulario de clave es `type=password` y se conserva únicamente mientras la página esté abierta; OtroCAD no escribe claves a `localStorage`, `sessionStorage` ni al servidor. Durante OAuth, **solo el verificador y el estado de PKCE** se guardan temporalmente en `sessionStorage` hasta el retorno, luego se eliminan. El código OAuth se quita de la dirección del navegador tras el intercambio.

## Flujo arquitectónico

- El usuario describe el proyecto con lenguaje natural y puede pedir cambios sobre la propuesta anterior.
- El navegador envía el texto, los parámetros actuales y hasta ocho intervenciones recientes **directamente al proveedor seleccionado**. Los extractos de bibliografía solo se transmiten si el usuario autoriza la casilla.
- La IA devuelve un objeto JSON de programa arquitectónico. El motor local vuelve a validar dimensiones y dibuja una vista previa.
- El usuario debe pulsar explícitamente **Dibujar plano completo en CAD**. Los muros, puertas, ventanas, cotas y hatch se insertan como entidades editables.
- Si hay un error o se alcanza la cuota, OtroCAD conserva el último diseño y muestra el motivo. No cambia automáticamente a un modelo pagado.
- El dibujo sigue siendo un anteproyecto 2D, no reemplaza validaciones municipales, estructurales ni BIM.

## Privacidad, seguridad y límites

- **Conexión sin proxy común:** las claves y los textos enviados son visibles al navegador del usuario, las extensiones instaladas y al proveedor elegido. **Ninguna clave que funciona dentro de JavaScript del navegador está perfectamente protegida**; por ello se recomiendan credenciales gratuitas, de alcance y gasto restringidos.
- OAuth evita copiar una clave manual, **no** equivale a que cualquier servicio detecte automáticamente una suscripción ChatGPT/Gemini/Claude. Cada proveedor exige su propio flujo de autorización disponible.
- La gratuidad no es ilimitada. OpenRouter publica límites para el enrutador `openrouter/free` y Gemini/Groq tienen cuotas sujetas a cambios. Solo el plan y cuenta del usuario pueden generar cargos si los habilita.
- Como desarrollador, puedes seguir alojando la web estática con el plan que te convenga. Los costos de alojamiento dependen del host; los costos de **inferencia** de otros usuarios no se centralizan.
- Los proveedores pueden tratar los prompts conforme a sus propias políticas (Gemini gratuito puede usarlos para mejorar productos). Evitar subir planos reservados o datos personales sensibles sin autorización.
- No hay garantía de que una petición en lenguaje natural pueda resolver distribuciones arquitectónicas arbitrarias: el CAD sigue usando modelos espaciales específicos; la IA mejora la interpretación, no sustituye un motor BIM avanzado.

## Referencias de proveedores

- Inicio de sesión OpenRouter OAuth PKCE: https://openrouter.ai/docs/guides/overview/auth/oauth
- Modelos gratuitos OpenRouter: https://openrouter.ai/collections/free-models
- Crear clave de OpenRouter: https://openrouter.ai/settings/keys
- Gemini AI Studio: https://aistudio.google.com/api-keys
- Nivel gratuito Gemini: https://ai.google.dev/gemini-api/docs/pricing
- Crear clave Groq: https://console.groq.com/keys

## Implementación

- `editor/arqui-user-ai.js`: proveedor/URL permitidos, JSON, contexto, validación, errores y manejo seguro de solicitudes.
- `editor/arqui-oauth.js`: OpenRouter OAuth PKCE S256, verificación de estado y expiración.
- `editor/arqui-assistant.js`: panel visual, elección de proveedor, recuperación de OAuth, conversación y propuesta CAD.
- `editor/arqui-planner.js`, `editor/arqui-house-layout.js`, `editor/arqui-professional.js`: geometría, programas y vista previa.
- `tests/arqui-user-ai.test.cjs`: pruebas de providers, modelos, claves, errores y OAuth.
