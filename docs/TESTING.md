# Pruebas reproducibles y demo ficticia

## Preparación común

Usar Node 24.18.0 para reproducir el runner CI. Desde la raíz del repositorio:

```sh
npm ci --ignore-scripts --registry=https://registry.npmjs.org --no-audit --no-fund
npm run format:check
npm test
npm run build
```

## Windows: Edge instalado

Playwright usa el canal `msedge` de Microsoft Edge ya instalado. No descarga otro navegador:

```sh
npm run test:e2e
```

## Linux/macOS: Chromium de Playwright

Sin canal explícito, Playwright usa su Chromium correspondiente a la versión fijada en el lockfile. En un entorno local de pruebas autorizado, preparar el navegador una vez si falta:

```sh
npx --no-install playwright install chromium
npm run test:e2e
```

En Linux se requieren las bibliotecas de sistema de Chromium. La instalación automática de dependencias del sistema se limita al runner CI; no cambiar la seguridad ni instalar dependencias del sistema en el PC como parte de estas instrucciones. En GitHub Actions, después del build, el workflow prepara el runner efímero con:

```sh
npx --no-install playwright install --with-deps chromium
npm run test:e2e
```

La descarga inicial del navegador usa la distribución oficial de Playwright; `--no-install` impide instalar un paquete npm Playwright nuevo. El runner instala sus dependencias de sistema mediante el mecanismo oficial de Playwright. Esto es preparación del entorno, no tráfico de datos de la aplicación ni del OCR. macOS usa igualmente Chromium de Playwright, no Safari. Consultar [Actions](https://github.com/Guillem94/turnos-en-comun/actions) para el resultado real del commit; no asumir que este incremento haya pasado antes de su ejecución.

Ejecutar E2E secuencialmente con un solo worker: comparten artefactos. No lanzar otro dev/preview ni otra suite a la vez. No se reutilizan servidores existentes: liberar los puertos antes de ejecutar. En CI se rechaza `test.only`; la suite tiene un límite global de 10 minutos dentro de los 15 minutos del job, sin retries añadidos. Playwright arranca su propio preview del build en loopback 127.0.0.1:5179 y lo cierra; el puerto debe estar libre. La prueba de recomposición usa temporalmente 127.0.0.1:5180 y lo cierra al terminar. Una regresión adicional abre el servidor de desarrollo en 127.0.0.1:5181 y verifica cuatro TIFF reales sin dependencias CommonJS, cerrándolo también. Las pruebas solo cargan fixtures sintéticos. La interceptación de red se limita al contexto del navegador de test; no es un bloqueo global de red ni afecta a la instalación de dependencias. No modifica antivirus, firewall, proxy, TLS ni seguridad del sistema.

Los fixtures originales se generan con Canvas y encoders locales de desarrollo; no son respuestas OCR simuladas. Tesseract/WASM reconoce las imágenes cargadas por el input real. scripts/generate-codec-fixtures.mjs y generate-table-fixtures.mjs requieren el servidor local. Los encoders icodec son solo de desarrollo. generate-jpeg-tiff-fixtures.mjs rasteriza el calendario a JPEG y escribe TIFF JPEG6/7; los JPEG planos de componentes tienen bitstreams reales comprobados también por el navegador. No hace falta Pillow.

Las pruebas cubren dominio/fechas/noches, JSON transaccional/corrupto/huérfanos, cuatro comprobaciones ICS con ICAL.js independiente, CRUD/demo/persistencia, formatos/disposiciones OCR, incertidumbre/cancelación/duplicados/conflictos, red, accesibilidad, móvil, JPEG trazable y sustitución libheif. Los resultados exactos deben registrarse al ejecutar, sin tratarlos como precisión universal del OCR.

Demo manual: abrir Probar demo con datos ficticios; alternar mes/semana; consultar Tiempo en común; importar examples/calendario-tabla.png o calendario.heic con contexto y leyenda confirmados; corregir/revisar antes de insertar; cancelar otra revisión y verificar que no muta. Salir de demo y comprobar que el espacio personal sigue separado. Exportar JSON/ICS ficticios y comprobar su restauración/importación.

Viewports móviles no acreditan teléfonos físicos. Seguir [MOBILE-CHECKLIST.md](MOBILE-CHECKLIST.md). La aceptación física pendiente debe registrar dispositivo, SO/navegador, fixture y resultado; comprobar selector HEIC/TIFF/GIF, campos táctiles/zoom, corrección/cancelación, persistencia/JSON e importación ICS con noche/zona. El servidor loopback del PC no es accesible desde otro dispositivo; el entorno de prueba debe autorizarse por separado. No abrir red o publicar para fingir esa aceptación.

Para verificar el empaquetador local, Python 3.10+ con biblioteca estándar:

```sh
python -m unittest discover -s tests -p package_candidate_test.py -v
python scripts/package-candidate.py <carpeta-candidata>
```

El empaquetador rechaza rutas externas/ambiguas, duplicados, versiones inconsistentes y archivos esenciales ausentes; verifica enlaces, fuentes nativas y avisos web/source. Congela los bytes antes de escribir y comprueba todos los miembros del ZIP mediante ARTIFACT-MANIFEST.json. No sobrescribe un paquete existente. Su validación no sustituye la comparación con un build limpio ni certifica ausencia absoluta de información sensible.

## Smoke Pages en subruta: Chromium y WebKit

Suite separada `pages-tests/`, dos casos por navegador con viewport 390×844. No modifica la suite root. Comprueba UI, CRUD nocturno, persistencia, JSON/ICS, PNG/HEIC reales con Tesseract, candidatos/evidencia y cancelación sin mutación. Observa peticiones/respuestas de navegador y workers, rechaza recursos fuera del origen/subruta, métodos distintos de GET/HEAD y errores HTTP. No sustituye respuestas ni simula OCR. Consola, fallos de red y screenshots quedan en `test-artifacts/pages-results/`, ignorado por Git, sin upload adicional. Los datos de cada contexto son ficticios y aislados del perfil habitual.

El ejecutor debe disponer de los navegadores: Edge instalado en Windows para el proyecto Chromium, Chromium de Playwright en Linux/macOS y WebKit de la versión fijada. La CI instala Chromium/WebKit y dependencias oficiales solo en el runner. Esta preparación no instala navegadores en el PC.

Preparar y probar la subruta en PowerShell (puerto 5179 libre, sin otro preview ni E2E):

```powershell
$env:TURNOS_BASE_PATH = '/turnos-en-comun/'
npm run build
npm run test:pages
Remove-Item Env:TURNOS_BASE_PATH
```

Equivalente POSIX:

```sh
TURNOS_BASE_PATH=/turnos-en-comun/ npm run build
TURNOS_BASE_PATH=/turnos-en-comun/ npm run test:pages
```

La configuración arranca y cierra su propio preview loopback y no reutiliza servidores. Sin `TURNOS_BASE_PATH`, Vite conserva `/` para build/root. Se admiten únicamente rutas absolutas de path con barra final, no URLs ni proxies. Para volver a las pruebas root, reconstruir sin esa variable.

Después de publicar y verificar el despliegue, el ejecutor puede probar la URL pública final sin arrancar servidor local:

```powershell
$env:PAGES_URL = 'https://Guillem94.github.io/turnos-en-comun/'
npm run test:pages
Remove-Item Env:PAGES_URL
```

`PAGES_URL` exige HTTPS, barra final y ausencia de credenciales/query/fragmento. No usar una URL de sesión ni datos personales. Consultar el estado del despliegue y commit concretos en Actions; esta guía no sustituye sus resultados. El job `pages-build` depende de `test-build` y solo se ejecuta en push/manual de main; valida el build de subruta antes de subir exclusivamente `dist`. El job de deploy usa permisos temporales `pages:write`/`id-token:write`, sin secretos ni permisos OAuth nuevos. No se despliega desde PR.

El hosting GitHub recibe IP/solicitudes estáticas ([documentación oficial](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection)); la app no envía imágenes/OCR, no tiene analítica propia, sincronización ni PWA/offline. WebKit de Playwright no es una prueba en iPhone: registrar aparte los resultados físicos reales en MOBILE-CHECKLIST.md.
