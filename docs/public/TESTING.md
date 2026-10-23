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
