# Histórico — configuración de IA externa reemplazada

El Arqui se ha simplificado para que **los visitantes no seleccionen proveedor de IA ni introduzcan claves**. La arquitectura vigente usa un servicio opcional Cloudflare Workers AI en el mismo dominio, **con dos consultas por IP y 20 consultas globales al día**, bloqueadas en el backend.

Para un **gasto de inferencia de $0**, el propietario debe activar el servicio en **Cloudflare Workers Free**, cuyas cuotas gratuitas se bloquean al agotarse. Un plan Paid podría generar cargos.

La guía vigente, con el único ajuste manual para el propietario, es [IA automática con límites estrictos](ARQUI_IA_AUTOMATICA.md).

El método anterior (BYOK/OpenRouter) ya no aparece al visitante.
