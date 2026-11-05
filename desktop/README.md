# OtroCAD Windows 0.6.1 alfa experimental

El instalador de Windows (.exe) incluye el editor web completo, el motor local DWG WebAssembly y el asistente arquitectónico **El Arqui IA**, manteniendo todo el editor CAD disponible sin Internet.

## IA arquitectónica automática

- El navegador integrado usa el origen seguro local `otrocad://app` y no permite navegar ni realizar solicitudes a destinos de Internet arbitrarios.
- Únicamente las solicitudes `otrocad://app/api/arqui/status` y `otrocad://app/api/arqui` se trasladan mediante un puente restringido de Electron al dominio oficial `https://otrocad.cristhian-torres-arq.workers.dev`.
- No hay contraseñas ni claves de IA en el programa ni configuración por usuario.
- Se utilizan los **mismos límites de Cloudflare** que en la web: 2 consultas por IP/día y 20 para todo el sitio/día. Las consultas desde Windows y web comparten la cuota global.
- Si no hay Internet o la cuota se agotó, el CAD y la vista previa local siguen disponibles.
- Los datos de las solicitudes se transmiten a Cloudflare Workers AI solo al pulsar «Proponer»; no se transmiten archivos completos ni se lee el disco automáticamente.
- El instalador no está firmado digitalmente y es **experimental**; Windows SmartScreen puede pedir confirmar la instalación.

## Verificación automatizada

El workflow `.github/workflows/windows-experimental.yml` genera el instalador, lo instala y lo abre con la red bloqueada. Comprueba el editor, el guardado, el DWG cuando esté incluido y el puente offline para la IA. También ejecuta `node tests/arqui-windows-proxy.test.cjs`, que verifica las rutas permitidas, la conservación de los límites 429 y el funcionamiento sin conexión.

Una prueba real de interpretación y dibujo en el modelo de Cloudflare está disponible en la versión web. La integración de la IA online dentro de un PC Windows físico todavía requiere validación manual; **no confundir que el instalador compile con una prueba real del modelo dentro de Windows**.

La interfaz web utiliza la última versión del editor; el instalador de Windows debe descargarse de la versión 0.6.1 específica para obtener el puente. Las compilaciones 0.5.6 anteriores no incorporan este cambio.
