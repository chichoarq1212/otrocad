# Reglas de desarrollo de OTROCAD

Estas reglas son obligatorias para cualquier persona o asistente que modifique este repositorio. La prioridad es mantener la calidad del CAD sin generar consumos o suscripciones inesperadas.

## 1. Política de costos y servicios

- La asistencia de análisis y programación se realiza con ChatGPT. **No contratar ni utilizar GitHub Copilot, Copilot Chat, Copilot coding agent, GitHub Spark ni créditos de IA de pago** para este proyecto.
- No integrar APIs de modelos de lenguaje, servicios de inferencia externos, claves de API, servicios SaaS de pago ni infraestructura facturable nueva sin autorización expresa del propietario.
- La funcionalidad de arquitectura asistida del producto debe conservar su enfoque local y determinista. No enviar planos, geometría, prompts ni datos del usuario a modelos externos.
- GitHub se utiliza principalmente para código fuente, historial, incidencias, revisiones y versiones.
- Priorizar desarrollo, pruebas y compilaciones en el PC local. No utilizar GitHub Codespaces ni sandboxes en la nube para el trabajo habitual.
- No crear nuevos workflows de GitHub Actions ni ampliar sus disparadores por comodidad. Reutilizar los flujos existentes y ejecutarlos solo cuando aporten una comprobación o compilación necesaria.
- Este repositorio es público: se permiten los runners estándar hospedados por GitHub para repositorios públicos. No configurar runners más grandes, macOS de pago, cómputo externo ni infraestructura de CI facturable.
- Mantener artefactos de CI pequeños y con retención corta (máximo recomendado: 7 días), salvo que el propietario solicite una publicación concreta. No almacenar APK, EXE, instaladores ni archivos generados dentro del historial Git.
- Evitar Git LFS y GitHub Packages salvo necesidad técnica justificada y autorización expresa. No subir binarios grandes al repositorio.
- No modificar presupuestos, métodos de pago, planes ni límites de facturación desde el código. Los límites de gasto son controles de cuenta y deben mantenerse con bloqueo al alcanzar el presupuesto.

## 2. Arquitectura local y privacidad

- Mantener el editor utilizable sin conexión cuando la plataforma lo permita.
- No introducir telemetría, analítica, seguimiento, llamadas de red ni dependencias remotas nuevas sin aprobación.
- No incorporar secretos, tokens, contraseñas, certificados privados ni archivos de firma al repositorio.
- Las bibliotecas y motores de terceros deben tener licencia compatible; registrar cambios en `THIRD_PARTY_NOTICES.md` y conservar los avisos requeridos.
- Preferir las dependencias ya presentes. Toda dependencia nueva debe justificarse por funcionalidad, tamaño, mantenimiento, licencia y posibles costos.

## 3. Estándar de calidad obligatorio

- Antes de modificar, leer la implementación actual y localizar los componentes relacionados. No reemplazar módulos completos ni reescribir el motor sin una justificación técnica y autorización.
- Mantener compatibilidad con los dibujos y proyectos existentes. No eliminar datos, capas, estilos, entidades ni configuraciones durante una migración.
- Para cambios de geometría, probar al menos los casos normales, límites, intersecciones, selección, deshacer/rehacer y persistencia cuando correspondan.
- Para cambios de archivos, comprobar importación, exportación y lectura de retorno cuando exista un formato de ida y vuelta (especialmente DXF/DWG).
- Para cambios de plataforma, comprobar el comportamiento afectado en Web/PWA, Android y Windows. Verificar el modo offline cuando corresponda.
- Corregir la causa raíz; no ocultar errores con mensajes falsos, silencios, datos inventados ni excepciones generales.
- No declarar una función como terminada hasta ejecutar las pruebas disponibles y documentar con precisión lo que se probó y lo que aún falta validar en dispositivos físicos.
- Mantener la interfaz coherente, accesible y usable con ratón, teclado y pantalla táctil. Evitar regresiones en herramientas existentes.

## 4. Flujo de trabajo y protección de versiones

1. Revisar el estado actual de la rama y los cambios pendientes antes de editar.
2. Realizar cambios pequeños, enfocados y reversibles.
3. Ejecutar pruebas y compilaciones localmente siempre que sea posible.
4. Revisar el diff para detectar archivos temporales, binarios, secretos o cambios ajenos a la tarea.
5. Conservar una versión estable recuperable antes de una modificación estructural o publicación.
6. No hacer force-push, borrar ramas estables ni sobrescribir entregas publicadas sin autorización.
7. En el resumen de cada entrega, indicar archivos modificados, pruebas ejecutadas, resultado, limitaciones y cualquier posible consumo externo.

## 5. Regla de autorización

Si una solución requiere una suscripción, API de pago, créditos, runner de pago, almacenamiento facturable, servicio externo o cambio de plan, detener esa parte y explicar el costo y la alternativa local/gratuita. **No activar ni consumir el servicio hasta recibir autorización expresa del propietario.**
