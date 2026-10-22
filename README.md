# Turnos en Común

Organiza los turnos de dos personas y encuentra tiempo libre en común. Interfaz en español, calendario mensual/semanal, noches, días libres, recuperación, exportación ICS y copias JSON. Los datos se guardan en este navegador; no hay cuentas, sincronización entre dispositivos, push o telemetría.

**Candidato local 0.5.0, todavía sin publicar.** Código propio bajo [MIT](LICENSE), Copyright (c) 2026 Guillem Carrion. Las bibliotecas de terceros conservan sus condiciones, detalladas en [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). La elección de licencia no implica que se haya publicado o enviado una candidatura.

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

Destino público y aceptación en móviles físicos siguen pendientes. private:true impide una publicación npm accidental; no es una declaración de visibilidad de un repositorio Git. No se afirma adopción externa ni selección en programas.
