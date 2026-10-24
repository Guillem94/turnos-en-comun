# Turnos en Común

Organiza los turnos de dos personas y encuentra tiempo libre en común. Interfaz en español, calendario mensual/semanal, noches, días libres, recuperación, exportación ICS y copias JSON. Los datos se guardan en este navegador; no hay cuentas, sincronización entre dispositivos, push o telemetría.

**Versión 0.5.0 publicada en [Guillem94/turnos-en-comun](https://github.com/Guillem94/turnos-en-comun).** Código propio bajo [MIT](LICENSE), Copyright (c) 2026 Guillem Carrion. Las bibliotecas de terceros conservan sus condiciones, detalladas en [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). No se ha enviado ninguna candidatura.

## Demo HTTPS para pruebas ficticias

Dirección de la demo: [Guillem94.github.io/turnos-en-comun/](https://Guillem94.github.io/turnos-en-comun/). Consultar [Actions](https://github.com/Guillem94/turnos-en-comun/actions) para el commit y resultado reales.

Al abrirla, elegir **Probar demo con datos ficticios**. El calendario se guarda solo en ese navegador/origen: no sincroniza con el PC ni otros móviles. No es una PWA ni promete funcionamiento offline. La aplicación no sube imágenes, texto OCR o turnos; OCR y conversión se ejecutan localmente, sin analítica propia ni proveedor OCR remoto.

GitHub recibe la IP y las solicitudes de archivos estáticos necesarias para servir Pages: no equivale a navegación sin contacto con el hosting. Véanse [GitHub Pages y registro de IP](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection) y la [declaración de privacidad de GitHub](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). Usar solo datos ficticios para estas pruebas. WebKit automatizado no acredita Safari en un iPhone físico; la aceptación móvil sigue pendiente del checklist.

## Arrancar

Requisitos: Node.js 22.12+ o 24 LTS, npm y navegador moderno con WebAssembly. Desde esta carpeta:

```sh
npm ci --ignore-scripts --registry=https://registry.npmjs.org --no-audit --no-fund
npm run build
npm run preview
```

Abrir http://127.0.0.1:5179. Solo loopback; no abre acceso LAN. No ejecutar dev y preview a la vez. Para desarrollo: npm run prepare:assets, después npm run dev. No abrir index.html mediante file://. npm descarga dependencias del registro oficial durante la instalación; el build prepara los recursos OCR, codecs y avisos locales sin descargar imágenes o datos del usuario.

## Probar sin datos personales

Abre **Probar demo con datos ficticios** en el inicio. Usa únicamente Ana/Luis ficticios; la demo y el calendario personal tienen espacios de almacenamiento separados. Los fixtures rasterizados están en tests/images y tests/jpeg-images; examples ofrece muestras seleccionadas con los mismos hashes de origen. Nunca hace falta usar un calendario familiar para probar.

La ausencia de datos no se considera libre por defecto. Confirma el día cuando estén registrados todos los turnos; los huecos se calculan en una franja configurable. Los nocturnos terminan al día siguiente. Las horas son locales y comparten una zona IANA configurable; se rechazan horas ambiguas/inexistentes al exportar ICS.

**Importar imagen** admite formatos descritos en [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md), OCR local y varios diseños legibles. Elegir persona/mes/leyenda, corregir pendientes, revisar cada candidato y confirmar antes de insertar. No adivina calendarios arbitrarios ni completa celdas vacías como libres. La imagen y el texto OCR no se guardan en JSON/localStorage.

ICS es exportación manual para importar en el móvil, sin sincronización. Exporta copias JSON: el navegador puede borrar sus datos. La restauración valida toda la copia antes de reemplazar.

## Código y pruebas

React/Vite, dominio y parsers separados; sin servidor de datos. [Arquitectura, límites, licencias y sustitución del codec](docs/DISTRIBUTION.md). [Pruebas reproducibles](docs/TESTING.md). [Contribución](CONTRIBUTING.md). El proyecto no depende de servicios de desarrollo o aplicaciones privadas.

La CI está activa en [GitHub Actions](https://github.com/Guillem94/turnos-en-comun/actions). El workflow comprueba formato, pruebas Node, compilación y la suite E2E con Chromium. Consulta allí el resultado del commit concreto: la documentación no sustituye el resultado de una ejecución concreta. La aceptación en móviles físicos sigue pendiente; registra las pruebas reales con el [checklist móvil](docs/MOBILE-CHECKLIST.md). private:true impide una publicación npm accidental; no es una declaración de visibilidad de un repositorio Git. No se afirma adopción externa ni selección en programas.
