# Nota histórica — conexión centralizada deshabilitada

Esta guía describe un enfoque anterior con un backend de inferencia compartido. A petición del propietario del proyecto, **OtroCAD ya no utiliza un modelo de IA facturado a Cloudflare ni requiere configurar Cloudflare Access para inferencia**.

La implementación actual es **BYOK (cada usuario conecta su IA)**: modelos gratuitos OpenRouter mediante OAuth y modelos Gemini/Groq mediante clave personal. La app no recibe ni almacena claves de los usuarios y conserva un motor de dibujo local.

**Consulta la guía vigente: [El Arqui IA sin costos de inferencia](ARQUI_IA_SIN_COSTO.md).**

No uses las antiguas instrucciones de activación de `ARQUI_ACCESS_ENABLED`, `OPENAI_API_KEY` global o Workers AI, porque no son necesarias ni están montadas en el despliegue estático actual.
