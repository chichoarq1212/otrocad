# Publicar OtroCAD gratis con Cloudflare Workers

La interfaz actual de Cloudflare puede guiar la creación como Worker. Esto es válido para OtroCAD: Cloudflare Workers puede alojar archivos estáticos directamente desde un directorio de assets, y Workers Builds puede conectarse a GitHub para publicar automáticamente cada cambio en la rama principal.

## Configuración inicial (solo una vez)

1. En Cloudflare, abre **Workers & Pages → Create application**.
2. Selecciona GitHub y el repositorio `chichoarq1212/otrocad`.
3. Usa el nombre de proyecto **otrocad** (debe coincidir exactamente con `name` en `wrangler.jsonc`).
4. En la pantalla **Set up your application**, configura:

| Campo | Valor |
|---|---|
| Project name | `otrocad` |
| Build command | `node scripts/build-pages.cjs` |
| Deploy command | `npx wrangler deploy` |
| Preview command | `npx wrangler versions upload` |
| Production branch | `main` |
| Root directory | `/` o dejar vacío |

5. Pulsa **Deploy** una sola vez para crear el Worker y publicar el sitio.

## Qué hace la configuración

- `scripts/build-pages.cjs` genera `dist/` con la web, el editor, el manifiesto, el service worker y el icono.
- `wrangler.jsonc` le indica a Cloudflare que sirva `dist/` como archivos estáticos del Worker `otrocad`.
- No se publica la carpeta `android/`, ni los workflows, ni las pruebas internas.
- El editor web queda en la ruta `/editor/` y la portada en `/`.

## Actualizaciones posteriores

Cada vez que se envía un cambio a la rama `main` de GitHub, Workers Builds vuelve a ejecutar el build y despliega el Worker automáticamente. No hay que volver a cargar ZIP ni archivos manualmente.

La aplicación quedará disponible en la dirección `https://otrocad.<tu-subdominio>.workers.dev` (el subdominio exacto lo muestra Cloudflare al finalizar).

## Nota

No es necesario crear un proyecto Pages adicional. El alojamiento de archivos estáticos de Workers es una opción compatible y evita el flujo Pages que no aparece en esta interfaz.
