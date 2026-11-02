# OtroCAD

CAD 2D gratuito en desarrollo para arquitectura, dibujo técnico, ingeniería, topografía y vialidad. Proyecto existente: no es un repositorio nuevo.

## Accesos oficiales
- Sitio: https://otrocad.cristhian-torres-arq.workers.dev/
- Editor: https://otrocad.cristhian-torres-arq.workers.dev/editor/
- Descargas: https://otrocad.cristhian-torres-arq.workers.dev/descargas/
- Código fuente: https://github.com/chichoarq1212/otrocad
- Compilaciones: https://github.com/chichoarq1212/otrocad/actions
- Versiones: https://github.com/chichoarq1212/otrocad/releases

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
- La integración DWG local se está incorporando con un módulo WebAssembly basado en acadrust 0.6.8 (MPL-2.0): lectura DWG→DXF y escritura DXF→DWG AC1032, con lectura de retorno. La compatibilidad final depende de las entidades que el editor pueda representar; no equivale a certificar todos los objetos de AutoCAD, bloques dinámicos, referencias externas o extensiones verticales.
- El archivo de proyecto interno y la copia de respaldo siguen siendo formatos de recuperación; DXF/DWG son formatos de intercambio CAD.

### Proyecto arquitectónico
- Vivienda de demostración editable con distribución articulada, mobiliario y anotaciones. Es una muestra conceptual para enseñar las capacidades del editor, no un plano constructivo aprobado.

## Plataformas

- **Web/PWA:** editor en navegador; el service worker cachea recursos publicados para uso offline después de cargarlos.
- **Android híbrido:** incluye el editor web local para trabajar offline. La integración DWG se empaqueta en esta variante cuando el runtime WebAssembly se compila.
- **Android nativo Canvas:** variante independiente sin permiso de Internet. Tiene herramientas táctiles propias, pero no toda la paridad del editor web ni DWG.
- **Windows:** aplicación Electron con editor empaquetado; la validación offline debe incluir el módulo DWG y realizarse también en un PC físico.
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
wasm-pack build dwg-wasm --target web --release --no-default-features --out-dir ../editor/vendor/dwg --out-name otrocad_dwg
```

El flujo `Build OtroCAD DWG WebAssembly` ejecuta pruebas de ida y vuelta y publica el runtime compilado en `editor/vendor/dwg/`.

## Licencias

- El código propio de OtroCAD todavía requiere una decisión de licencia del proyecto.
- El puente DWG usa acadrust 0.6.8 bajo MPL-2.0. Ver `THIRD_PARTY_NOTICES.md` y `dwg-wasm/README.md`.
