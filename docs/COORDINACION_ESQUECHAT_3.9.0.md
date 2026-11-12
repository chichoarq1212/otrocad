# Coordinación con ESQUECHAT 3.9.0

Entrega recuperada el 12 de noviembre de 2026 de `ESQUECHAT_3.9.0_y_OtroCAD_Prueba.zip`.

El botón **Coordinar 3D** permite revisar e importar cambios por elemento desde ESQUECHAT y exportar ediciones de regreso. Trabaja en metros y en espacio Modelo. Conserva identificadores, detecta conflictos, respeta capas bloqueadas y permite seleccionar elementos vinculados. El intercambio es explícito mediante JSON, sin servidor nuevo ni sincronización en vivo.

Admite muros y aberturas, huellas rectangulares, perfiles/huecos existentes y nombres de recintos. Los elementos no compatibles se advierten. No convierte universalmente dibujos en BIM.

## Validación de esta subida

- Los 84 archivos del paquete coinciden con su manifiesto SHA-256.
- `node --test tests/*.test.cjs`: 37 resultados correctos, 0 fallos (28 archivos de regresión existentes y 9 casos de coordinación añadidos).
- `node scripts/build-pages.cjs`: construcción web correcta.
- `node scripts/verify-pages.cjs`: enlaces y recursos web comprobados.
- Los cambios del editor se limitan al puente de coordinación, sus scripts y recursos offline. Los archivos ajenos al intercambio permanecen en la base de GitHub.

No se recompilaron ni probaron instaladores Android/Windows en dispositivos físicos en esta subida. Los resultados históricos del LEEME del paquete no se presentan como pruebas repetidas aquí.

## Licencias

Se conserva GPL-3.0-or-later del módulo compartido. La licencia y los avisos se incluyen en `editor/licenses/` para que la construcción web los copie junto al editor. No se añaden servicios, APIs ni dependencias.
