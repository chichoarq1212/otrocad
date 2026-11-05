# OtroCAD

CAD 2D gratuito en desarrollo para arquitectura, dibujo técnico, ingeniería, topografía y vialidad. Proyecto existente: no es un repositorio nuevo.

## Accesos oficiales
- Sitio: https://otrocad.cristhian-torres-arq.workers.dev/
- Editor: https://otrocad.cristhian-torres-arq.workers.dev/editor/
- Descargas: https://otrocad.cristhian-torres-arq.workers.dev/descargas/
- Código fuente: https://github.com/chichoarq1212/otrocad
- Compilaciones: https://github.com/chichoarq1212/otrocad/actions
- Versiones: https://github.com/chichoarq1212/otrocad/releases

## El Arqui Local · biblioteca arquitectónica estática, sin IA ni créditos

- El asistente de vivienda es ahora **100 % determinista**: interpreta medidas, dormitorios, baños, patio, estacionamientos y cambios de dimensionado sin enviar ningún mensaje ni plano a modelos de inteligencia artificial.
- Biblioteca local `editor/arqui-knowledge.js` con **reglas espaciales, mínimos orientativos, relaciones de ambientes, muebles a escala, puertas, escaleras, 17 tipologías documentadas, 15 guías y 8 formatos de lámina**. Las tipologías distinguen las soluciones geométricas implementadas de las todavía documentales.
- Caso compacto validado de casa **10 × 8 m, 3 dormitorios, 2 baños, 2 plantas, patio posterior y 2 estacionamientos**: escalera en U con 16 contrahuellas, 2 tramos y descanso en posición coincidente arriba y abajo; baño máster con acceso desde la suite; puertas y ventanas distribuidas y CAD editable.
- Referencias públicas comprobadas: [Quito RTAU 2024](https://www.ecp.ec/wp-content/uploads/2024/10/RTAU-Tomo2-EDIFICABILIDAD-v2.0-23-10-2024.pdf), [MIDUVI 2024](https://www.habitatyvivienda.gob.ec/wp-content/uploads/2024/08/Lineamientos-urbanos-habitacionales-02-08-2024.pdf) e IRC como referencia comparativa. **Plazola y Neufert son bibliografía reconocida, no libros copiados ni datos normativos no verificados**.
- La geometría rechaza propuestas que sobrepasan capacidades o reducen los ambientes útiles por debajo de las referencias. La aprobación del usuario es obligatoria antes de insertar las entidades CAD.
- **Cero API, cero llamadas a IA, cero tokens, cero cuotas**. Cloudflare queda como alojamiento estático de los archivos; Windows y Android llevan el mismo motor local.
- [Ver biblioteca, alcances y programa de pruebas](docs/ARQUI_LOCAL_ESTATICO.md).

## Capacidades del editor web

### Dibujo y precisión
- Línea, polilínea, rectángulo, círculo, arco circular de tres puntos, elipse, polígono regular, cotas, hachurados, texto, directrices y mobiliario a escala.
- Entrada dinámica de longitud y ángulo, coordenadas, ORTHO, POLAR, GRID, SNAP, OSNAP y cruceta.
- Selección individual, múltiple, ventana y cruce; grips editables e historial deshacer/rehacer.
- Capas, visibilidad/bloqueo, colores, tipos y grosores de línea.
- Navegación por ratón, teclado y controles táctiles.

### Modificación
- Mover, copiar, OFFSET, girar, simetría, escalar, TRIM, EXTEND, FILLET/empalme, CHAMFER/chaflán y EXPLODE para entidades compatibles.
- Los comandos que no pueden procesar una geometría muestran una advertencia en vez de modificar silenciosamente el dibujo.

### Archivos y recuperación
- Guardado automático local tras las operaciones de edición, copia previa, recuperación manual y copia de respaldo descargable.
- Importar DXF y exportar DXF con advertencias para entidades no admitidas o simplificadas.
- Exportar SVG y PDF.
- La integración DWG local está compilada y publicada en `editor/vendor/dwg/` mediante WebAssembly basado en acadrust 0.6.8 (MPL-2.0): lectura DWG→DXF y escritura DXF→DWG AC1032 (AutoCAD 2018), con lectura de retorno y comprobación de cantidad de entidades antes de descargar. La compatibilidad depende de las entidades que el editor pueda representar; no equivale a certificar todos los objetos de AutoCAD, bloques dinámicos, referencias externas o extensiones verticales.
- El archivo de proyecto interno y la copia de respaldo siguen siendo formatos de recuperación; DXF/DWG son formatos de intercambio CAD.

### Proyecto arquitectónico
- Vivienda de demostración editable con distribución articulada, mobiliario y anotaciones. Es una muestra conceptual para enseñar las capacidades del editor, no un plano constructivo aprobado.

## Plataformas

- **Web/PWA:** editor en navegador; el service worker cachea recursos publicados para uso offline después de cargarlos.
- **Android híbrido:** incluye el editor web local, runtime DWG WebAssembly y selector Android SAF para abrir y guardar archivos sin conexión. Se sirve desde `WebViewAssetLoader` bajo un origen HTTPS local.
- **Android nativo Canvas:** variante independiente sin permiso de Internet. Tiene herramientas táctiles propias, pero no toda la paridad del editor web ni DWG.
- **Windows:** aplicación Electron con editor, biblioteca arquitectónica y runtime DWG empaquetados; usa un protocolo local seguro para cargar WebAssembly sin red. La compilación CI instala, abre sin conexión y ejecuta una prueba de ida/vuelta DWG cuando el runtime está presente; aún falta validación en un PC físico.
- **iOS:** PWA instalable desde Safari; no hay aplicación nativa publicada.

## Estado y limitaciones

OtroCAD todavía no es un reemplazo completo de AutoCAD/Civil 3D. La cobertura DXF/DWG varía por entidad y por versión. El motor DWG de terceros está bajo MPL-2.0 y su distribución exige conservar los avisos y cumplir las condiciones de esa licencia. No se declara compatibilidad sin pérdida con dibujos que contengan objetos proxy, verticales, bloques dinámicos, XREF, layouts o estilos no representables por el modelo interno.

Los APK y EXE de CI se identifican como alfa/experimentales hasta superar pruebas de instalación y uso en dispositivos físicos. No están firmados para distribución comercial ni para Google Play/Microsoft Store.

## Compilar Android

Requiere JDK 17, Gradle 8.9 y Android SDK 35:

```bash
gradle -p android assembleDebug --no-daemon
```

## Compilar el motor DWG WebAssembly

Requiere Rust estable, target `wasm32-unknown-unknown` y wasm-pack:

```bash
rustup target add wasm32-unknown-unknown
cargo test --manifest-path dwg-wasm/Cargo.toml
wasm-pack build dwg-wasm --target web --release --out-dir ../editor/vendor/dwg --out-name otrocad_dwg --no-gitignore
```

El flujo `Build OtroCAD DWG WebAssembly` ejecuta pruebas de ida y vuelta y publica el runtime compilado en `editor/vendor/dwg/`.

## Licencias

- El código propio de OtroCAD todavía requiere una decisión de licencia del proyecto.
- El puente DWG usa acadrust 0.6.8 bajo MPL-2.0. Ver `THIRD_PARTY_NOTICES.md` y `dwg-wasm/README.md`.
