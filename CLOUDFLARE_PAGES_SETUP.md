# Publicar OtroCAD gratis con Cloudflare Pages

## Configuración inicial (solo una vez)

1. Crear una cuenta gratuita en [Cloudflare](https://dash.cloudflare.com/sign-up).
2. Abrir **Workers & Pages** y elegir **Create application → Pages → Connect to Git**.
3. Conectar GitHub. Cuando solicite permisos, elegir **Only select repositories** y autorizar únicamente `chichoarq1212/otrocad`.
4. Seleccionar el repositorio `chichoarq1212/otrocad` y la rama de producción `main`.
5. Configurar el proyecto así:

| Campo | Valor |
|---|---|
| Framework preset | None |
| Root directory | (vacío, raíz del repositorio) |
| Build command | `node scripts/build-pages.cjs` |
| Build output directory | `dist` |
| Production branch | `main` |

6. Pulsar **Save and Deploy**. Cloudflare asignará una dirección gratuita `*.pages.dev`.

## Qué se publica

El script `scripts/build-pages.cjs` crea `dist/` y copia únicamente:
- `index.html`
- `manifest.webmanifest`
- `sw.js`
- `icon.svg`
- `editor/`

No publica `android/`, `.github/`, `tests/` ni los archivos internos de desarrollo. El editor conserva sus rutas relativas, el manifiesto, el icono y el service worker.

## Cómo se actualizará después

- Yo puedo seguir modificando los archivos del repositorio desde ChatGPT mediante la conexión de GitHub.
- Cada cambio que llegue a `main` activa una publicación automática en Cloudflare Pages.
- Cloudflare permite enlaces de vista previa para ramas y solicitudes de cambios.
- El APK Android continúa compilándose mediante GitHub Actions; Cloudflare Pages solo aloja la versión web.

## Coste y límites del plan gratuito

Cloudflare Pages ofrece alojamiento de archivos estáticos en el plan Free. La cuota publicada incluye hasta 500 compilaciones al mes, una compilación simultánea y un máximo de 20.000 archivos por sitio. Los archivos estáticos no generan cargos por solicitudes. Si se añaden funciones de servidor, se aplican las cuotas de Workers correspondientes.

**No se necesita usar ChatGPT Work para cada publicación ni comprar créditos de IA para que Cloudflare despliegue los cambios.**
