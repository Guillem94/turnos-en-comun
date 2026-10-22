# Pruebas reproducibles y demo ficticia

Microsoft Edge instalado se usa mediante Playwright channel msedge. No se instala un navegador automáticamente. En otros sistemas elegir explícitamente un navegador compatible instalado. Viewports de escritorio/móvil no sustituyen teléfonos físicos.

```sh
npm ci --ignore-scripts --registry=https://registry.npmjs.org --no-audit --no-fund
npm run build
npm test
npm run test:e2e
npm run format:check
```

Ejecutar E2E secuencialmente: comparten artefactos. Playwright arranca su propio preview del build en loopback 127.0.0.1:5179 y lo cierra; el puerto debe estar libre. La prueba de recomposición usa temporalmente 127.0.0.1:5180 y lo cierra al terminar. Una regresión adicional abre el servidor de desarrollo en 127.0.0.1:5181 y verifica cuatro TIFF reales sin dependencias CommonJS, cerrándolo también. Las pruebas solo cargan fixtures sintéticos y bloquean tráfico externo del contexto de prueba; no modifican antivirus o seguridad del sistema.

Los fixtures originales se generan con Canvas y encoders locales de desarrollo; no son respuestas OCR simuladas. Tesseract/WASM reconoce las imágenes cargadas por el input real. scripts/generate-codec-fixtures.mjs y generate-table-fixtures.mjs requieren el servidor local. Los encoders icodec son solo de desarrollo. generate-jpeg-tiff-fixtures.mjs rasteriza el calendario a JPEG y escribe TIFF JPEG6/7; los JPEG planos de componentes tienen bitstreams reales comprobados también por el navegador. No hace falta Pillow.

Las pruebas cubren dominio/fechas/noches, JSON transaccional/corrupto/huérfanos, cuatro comprobaciones ICS con ICAL.js independiente, CRUD/demo/persistencia, formatos/disposiciones OCR, incertidumbre/cancelación/duplicados/conflictos, red, accesibilidad, móvil, JPEG trazable y sustitución libheif. Los resultados exactos deben registrarse al ejecutar, sin tratarlos como precisión universal del OCR.

Demo manual: abrir Probar demo con datos ficticios; alternar mes/semana; consultar Tiempo en común; importar examples/calendario-tabla.png o calendario.heic con contexto y leyenda confirmados; corregir/revisar antes de insertar; cancelar otra revisión y verificar que no muta. Salir de demo y comprobar que el espacio personal sigue separado. Exportar JSON/ICS ficticios y comprobar su restauración/importación.

La aceptación física pendiente debe registrar dispositivo, SO/navegador, fixture y resultado; comprobar selector HEIC/TIFF/GIF, campos táctiles/zoom, corrección/cancelación, persistencia/JSON e importación ICS con noche/zona. El servidor loopback del PC no es accesible desde otro dispositivo; el entorno de prueba debe autorizarse por separado. No abrir red o publicar para fingir esa aceptación.

Para verificar el empaquetador local, Python 3.10+ con biblioteca estándar:

```sh
python -m unittest discover -s tests -p package_candidate_test.py -v
python scripts/package-candidate.py <carpeta-candidata>
```

El empaquetador rechaza rutas externas/ambiguas, duplicados, versiones inconsistentes y archivos esenciales ausentes; verifica enlaces, fuentes nativas y avisos web/source. Congela los bytes antes de escribir y comprueba todos los miembros del ZIP mediante ARTIFACT-MANIFEST.json. No sobrescribe un paquete existente. Su validación no sustituye la comparación con un build limpio ni certifica ausencia absoluta de información sensible.
