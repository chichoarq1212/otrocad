# El Arqui IA automática · activación segura sin gastos de inferencia

**Estado de implementación (noviembre de 2026):** listo en GitHub; la activación en la cuenta Cloudflare del propietario es **opcional y requiere una sola intervención privada**. **No se publica una API abierta sin presupuestos ni cuotas.**

## Experiencia del visitante

- Entrar a OtroCAD → DIBUJO → **El Arqui IA**.
- **No hay que seleccionar Gemini, OpenRouter, OpenAI ni introducir claves.** El selector anterior se retiró de la vista del usuario.
- Escribir libremente «Casa de 10 x 8 m, tres habitaciones, baño máster, baño compartido, cocina con isla, patio de 3 m y 2 carros».
- La IA gratuita interpreta la petición y genera una **propuesta de parámetros**, no una respuesta conversacional sin dibujo.
- OtroCAD valida el programa, presenta la **vista previa sobre entidades CAD reales** y permite pulsar «Dibujar plano completo en CAD» para insertar muros, puertas, ventanas, hatch, estacionamientos y cotas editables.
- Pedir modificaciones posteriores («agranda la cocina 50 cm») conserva el programa anterior.
- Si el servicio no está activado, se agota el límite o Cloudflare rechaza la inferencia, **el CAD local continúa disponible**; no se usa ningún modelo pagado como respaldo.
- Se muestra en el panel un indicador «IA automática gratuita · N de 2 consultas disponibles hoy».

## Presupuesto que se aplica de verdad en el servidor

- Máximo **2 inferencias por dirección IP/ubicación de conexión y día UTC** (los dispositivos que comparten una IP comparten el límite; esto no es una identidad individual).
- Máximo **20 inferencias globales entre todas las visitas por día UTC**.
- El backend reserva un cupo **antes** de llamar al modelo, usando un único Durable Object con almacenamiento SQLite y transacciones atómicas: actualizar el teléfono o borrar el almacenamiento local **no reinicia el límite**.
- Consultas fallidas tras reservar cupo también cuentan, para evitar abuso.
- La dirección IP no se guarda en la tabla. Para contabilizar se deriva un hash SHA-256 a partir de la IP, un identificador y el día.
- Se usa exclusivamente un modelo pequeño Workers AI compatible con el plan gratuito: `@cf/meta/llama-3.1-8b-instruct`, con `max_tokens=1200`; sin reintentos ni cadenas de modelos.
- Cualquier falla de identificación, presupuesto, cuota o IA produce **rechazo seguro**; nunca se infiere sin cuota.
- **El propietario debe mantener Cloudflare Workers en el plan Free si exige $0 de cargos por inferencia.** Cloudflare Workers AI Free incluye 10.000 neurons/día y bloquea operaciones al llegar al límite. En **Workers Paid**, el uso superior a la franquicia gratuita puede facturarse; las restricciones de 20 consultas no garantizan $0 absoluto en un plan de pago.
- No se pueden garantizar 2 consultas por *persona* sin crear identidades: el límite se controla por IP (sin registro), y la cuota global protege el consumo del proyecto.

Referencias oficiales (comprobar cambios futuros de condiciones):
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/

## Activación: una vez en la cuenta de Cloudflare (solo el propietario)

1. Confirmar en Cloudflare Workers & Pages que **otrocad** utiliza el repositorio `chichoarq1212/otrocad`, rama `main`.
2. Confirmar que la cuenta está en el **plan Workers Free**. **No activar un plan de pago si se quiere cero cargos**.
3. Confirmar que el despliegue toma `wrangler.jsonc` y ejecuta el Worker principal `workers/arqui-auto.js`; la carpeta estática se sirve desde `dist/` y solo `/api/*` ejecuta el código. Si se configura la compilación manualmente, ejecutar `node scripts/build-pages.cjs` y desplegar con `npx wrangler deploy`.
4. Confirmar que los bindings existen, exactamente `AI` (Workers AI) y `ARQUI_BUDGET` (Durable Object SQLite, clase `ArquiBudget`). Están declarados en `wrangler.jsonc` junto con la migración `arqui_budget_sqlite_v1`. No crear una clave de OpenAI ni pagar por otra API.
5. Añadir la variable de texto `ARQUI_AUTO_ENABLED` con valor **`yes`** en Workers & Pages → OtroCAD → Settings → Variables and Secrets (no se necesita compartir nada por este chat). Aplicar el despliegue para asegurar que tome efecto.
6. Probar `https://otrocad.cristhian-torres-arq.workers.dev/api/arqui/status`. Al principio debe indicar `online:true` y `remaining:2` para la IP del visitante; `globalRemaining:20` si aún no se ha consumido ninguno. Si indica `online:false`, la IA sigue desactivada de forma deliberada.
7. Probar el pedido de casa en El Arqui, revisar el plano y aprobar «Dibujar en CAD». Cada usuario ve su cupo.
8. Si el consumo gratuito deja de convenir, cambiar `ARQUI_AUTO_ENABLED=no` (desactiva inferencia, conserva el editor y las funciones CAD).

**No confundir:** un test con respuesta simulada confirma la conexión IA → CAD, pero **no equivale a haber probado la cuota real gratuita de Cloudflare en la cuenta del usuario**. La prueba en producción se hace únicamente al activar el servicio por el propietario.

## Implementación

- `workers/arqui-auto.js`: backend, validación, interpretación y cuota con SQLite Durable Object.
- `wrangler.jsonc`: archivo estático + Worker solo para `/api/*`, bindings y migración.
- `editor/arqui-assistant.js`: UI con chat sin proveedor visible y cuota.
- `tests/arqui-auto.test.cjs`: simula 2/día por IP, 20/día global y rechazos, sin llamar a Cloudflare real.
- `tests/arqui-browser-smoke.cjs`: verifica en Chromium la conexión automática, el programa, vista previa y CAD editable.

### Privacidad

El pedido arquitectónico se transmite a Cloudflare Workers AI para la interpretación. La vista previa, la edición y el guardado del plano permanecen en OtroCAD. No introducir planos confidenciales o datos personales sensibles sin revisar los términos de Cloudflare.
