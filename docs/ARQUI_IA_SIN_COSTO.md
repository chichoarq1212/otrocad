# El Arqui IA · guía actual

La conexión por claves personales de OpenRouter/Gemini fue una versión experimental anterior. **Ya no es necesario elegir un proveedor ni pegar una clave.**

La interfaz actual de OtroCAD muestra directamente **El Arqui IA**, un contador de **2 solicitudes por conexión/IP al día**, y mantiene **20 solicitudes globales por día** como límite de seguridad. El motor de dibujo CAD local sigue funcionando cuando no hay IA.

La inteligencia artificial automática utiliza un Worker protegido de Cloudflare. **Solo se activa si el dueño del proyecto configura `ARQUI_AUTO_ENABLED=yes` en su cuenta de Cloudflare Workers Free**, después de confirmar los bindings AI y ARQUI_BUDGET.

La guía vigente es **[Activar El Arqui IA automática con límites gratuitos](ARQUI_IA_AUTOMATICA.md)**.

El modo anterior de cuentas personales queda documentado en el historial de Git, pero no aparece en la interfaz normal del visitante.
