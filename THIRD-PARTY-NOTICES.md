# Avisos de terceros — Turnos en Común 0.5.0

Código propio: MIT, Copyright (c) 2026 Guillem Carrion; texto íntegro en LICENSE. Esta elección no cambia las licencias de terceros. El candidato aún no se ha publicado. Mantener este documento, legal/third-party, las fuentes acompañantes y los avisos ya contenidos en el build.

## Interfaz, herramientas emitidas y codecs

| Componente                  | Versión/fuente                                          | Licencia/aviso completo                                                                                                                            |
| --------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| React / React DOM           | 19.3.1 / 19.3.1                                         | react-LICENSE / react-dom-LICENSE, MIT, Meta Platforms, Inc. and affiliates                                                                        |
| scheduler                   | 0.28.0                                                  | scheduler-LICENSE, MIT                                                                                                                             |
| Tesseract.js                | 7.0.0                                                   | tesseract.js-LICENSE.md, Apache-2.0                                                                                                                |
| regenerator-runtime         | 0.13.11                                                 | regenerator-runtime-LICENSE, MIT, Facebook, Inc. and affiliates                                                                                    |
| Helpers de Vite / Rolldown  | 8.3.5 / 1.2.15                                          | vite-LICENSE.md, rolldown-LICENSE, rolldown-THIRD-PARTY-LICENSE.txt; no se distribuye el compilador completo                                       |
| libheif-js / libheif nativo | 1.23.5 / 1.23.5                                         | libheif-COPYING.txt y codecs/libheif/COPYING.txt, LGPLv3/GPLv3 y MIT para partes indicadas                                                         |
| libde265 dentro de libheif  | 1.0.15                                                  | libde265-COPYING.txt, LGPLv3/GPLv3 completos                                                                                                       |
| Contenedor UTIF local       | Derivado de 3.1.0, Photopea                             | utif-LICENSE, MIT, Copyright (c) 2017 Photopea; bloque JPEG histórico retirado                                                                     |
| JPEG trazable               | Mozilla/pdf.js 11ab3b5c000eb13e7ea5632ac36b1109ff7280b7 | pdfjs-jpeg-LICENSE.txt (Apache-2.0), pdfjs-jpeg-NOTICE.txt (atribuciones preparadas); Copyright 2014 Mozilla Foundation, linaje notmasteryet/jpgjs |
| pako                        | 1.0.11                                                  | pako-LICENSE, MIT; pako-lib-zlib-inflate.js.txt conserva también condiciones Zlib y autores Gailly/Adler/Puzrin/Tupitsin                           |

Las bibliotecas se empaquetan/minifican para el navegador. libheif permanece como ESM local separado y sustituible. vendor/manifest.json fija fuentes y cambios de TIFF/JPEG. El decoder JPEG conserva algoritmo y copyright de la revisión Mozilla identificada; solo se adaptaron interfaz ESM y aviso local. No se afirma que sea el origen exacto del minificado antiguo, que ya no integra el camino de producción. Los archivos derivados señalan los cambios.

## Worker OCR precompilado

Conservar ocr/worker.min.js.LICENSE.txt y los textos completos por versión en legal/third-party. Sus nueve archivos npm se contrastaron por SHA-512 y once fuentes coinciden exactamente con su mapa de fuentes.

| Componente          | Versión | Licencia     |
| ------------------- | ------- | ------------ |
| base64-js           | 1.5.1   | MIT          |
| bmp-js              | 0.1.0   | MIT          |
| buffer              | 6.0.3   | MIT          |
| idb-keyval          | 6.2.1   | Apache-2.0   |
| ieee754             | 1.2.1   | BSD-3-Clause |
| is-url              | 1.2.4   | MIT          |
| regenerator-runtime | 0.13.11 | MIT          |
| wasm-feature-detect | 1.8.0   | Apache-2.0   |
| zlibjs              | 0.3.1   | MIT          |

Las versiones embebidas no siempre coinciden con el árbol instalado de desarrollo. El inventario distingue ambos ámbitos.

## Motor y datos OCR

Se incluyen seis variantes WASM y sus seis glue JS de tesseract.js-core 7.0.0. Getter del core LSTM: Tesseract 5.1.0-288-g2a9c1. Las fuentes upstream fijan Tesseract, Leptonica, giflib, libjpeg, libpng, libtiff, libwebp, zlib y openlibm por commit. Mantener sus avisos íntegros separados; Apache-2.0 del paquete npm no licencia automáticamente todas esas partes.

This software is based in part on the work of the Independent JPEG Group.

Se conservan las atribuciones de Leptonica, IJG, PNG Reference Library, TIFF de Sam Leffler/Silicon Graphics, giflib, zlib, libwebp (COPYING y PATENTS) y las varias licencias de openlibm. Textos del runtime/glue Emscripten y sus componentes identificados también acompañan la entrega; no se afirma que todos los ficheros del toolchain estén enlazados.

eng.traineddata.gz 4.0.0_best_int coincide byte a byte con naptha/tessdata commit 806cd9adc8c6e8abc11c782db1818c990576bebc, Apache-2.0: eng-tessdata-LICENSE.txt. El MIT declarado por su empaquetado npm no se atribuye al modelo.

## Fuentes y recomposición LGPL

legal/sources incluye las cuatro fuentes exactas de libheif-js, libheif-emscripten, libheif y libde265, con commits/tamaños/SHA-256. El código de aplicación y sus utilidades acompañan el paquete bajo MIT; las fuentes nativas conservan sus licencias. codecs/libheif/libheif-bundle.mjs se puede reemplazar por un módulo compatible; no hay bloqueo de modificación o ingeniería inversa. La prueba de recomposición ejecuta un módulo modificado en disco y comprueba HEIC/OCR con bundles de aplicación idénticos.

Eso demuestra la sustitución técnica, no un rebuild nativo byte a byte ni una certificación legal. El wrapper upstream no incluye lockfile de sus herramientas. Mantener recetas, fuentes, avisos y documentar cambios al modificar bibliotecas. Las instrucciones de distribución describen la reconstrucción y qué fuentes acompañan el artefacto. No se emite una oferta vinculante de fuentes ni se aceptan contratos en nombre del titular.

## Alcance de entrega

web/legal/index.html permite consultar y descargar estos avisos, textos completos y fuentes nativas. Conservar web y source juntos; el código fuente de aplicación acompaña el candidato. Las licencias MIT/BSD/IJG/libpng/libtiff/Zlib/Apache/LGPL/GPL conservan sus condiciones y atribuciones. Los textos completos prevalecen sobre estas etiquetas de resumen; las atribuciones preparadas no se presentan como un NOTICE upstream inexistente.

icodec y sus encoders, incluido x265, solo generan fixtures ficticios: no están en el runtime web. No incluir node_modules en una publicación. Si se redistribuyeran herramientas/encoders, revisar sus condiciones completas como una entrega distinta. No se etiqueta una imagen GPL por el programa que la codificó.

No se distribuyen navegador, Node/npm, herramientas completas de compilación/pruebas ni servicios de desarrollo. No se afirma autorización universal de patentes HEVC por las licencias de código; no se ha realizado una evaluación de patentes. No se inventan adopción, testers o selección en programas.
