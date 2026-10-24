# Arquitectura, distribución y límites

React compone calendario, formularios y revisión. domain.js calcula intervalos [inicio, fin), noches, solapes, disponibilidad, validación JSON e ICS. ocr.js coordina Tesseract/WASM local; import-layout.js conserva texto/coordenadas/evidencia y adapta cuadrículas mensuales, semanas, listas y tablas por persona. Persistencia personal/demo separada en localStorage; no login o backend.

La ventana de disponibilidad y la confirmación de cobertura evitan llamar libre a toda ausencia de turnos. El calendario conserva fechas civiles locales y una zona IANA común. Los clientes de calendario deciden cómo gestionan reimportaciones ICS con UID estable; no se ha certificado iOS/Android físico.

## Imágenes y privacidad

PNG, JPEG, WebP, BMP, GIF, TIFF, HEIC/HEIF estático y AVIF estático de un elemento, según soporte verificado del navegador. Límite 12 MB, 16 MP por imagen, 32 páginas/fotogramas y 64 MP acumulados; selección explícita en archivos múltiples. No PDF/SVG/RAW, HEIF temporal, AVIF animado/colecciones, manuscritos o solo colores. HEIC HDR/10 bits/Live Photos y todas las variantes TIFF/animaciones PNG/WebP no están certificados.

No se garantiza comprender cualquier calendario legible. Cabeceras recortadas, celdas combinadas, ejes gráficos y OCR ambiguo requieren contexto o corrección. La confusión 11→1 en algunas lecturas está documentada y las fechas mensuales repetidas quedan pendientes. Ningún porcentaje universal de precisión se afirma.

Imagen, regiones y OCR solo duran la revisión en memoria; se guardan únicamente filas confirmadas. Worker, modelos y codecs se sirven del origen local. No proveedor externo, fallback remoto, credenciales o telemetría. Cerrar cancela y libera recursos; no se promete borrado físico instantáneo de RAM.

## Libheif y fuentes correspondientes

codecs/libheif/libheif-bundle.mjs es una biblioteca LGPL local separada del bundle de la app. Se puede sustituir por una versión modificada que preserve la interfaz de fábrica, HeifDecoder/decode y los objetos de imagen. No hay verificación de hash en runtime que impida esa sustitución. Los hashes son verificaciones de empaquetado, no una restricción a la modificación.

Las cuatro fuentes exactas acompañan la entrega en legal/sources: wrapper libheif-js, receta libheif-emscripten, libheif y libde265. manifest.json fija commits, URLs, tamaños y SHA-256. Contienen los scripts y fuentes upstream, que no se ejecutan durante instalación/build de la app. La receta identificada declara Emscripten 3.1.61; el toolchain no está instalado por este proyecto.

Para reconstruir la biblioteca nativa, revisar primero las recetas incluidas y preparar voluntariamente el toolchain identificado. El archivo libheif/build-emscripten.sh describe la biblioteca estática/libde265 y el wrapper npm scripts/install.js describe el empaquetado ESM con el WASM embebido. Montar el submódulo libheif de la receta con el árbol del commit incluido; no asumir que el archivo de receta contiene los submódulos. El script prepare-native-sources.mjs solo obtiene/verifica las fuentes fijadas; no compila ni ejecuta sus scripts.

Para recomponer la aplicación con un módulo compatible ya modificado: sustituir public/codecs/libheif/libheif-bundle.mjs después de preparar recursos y antes de vite build, o sustituir codecs/libheif/libheif-bundle.mjs dentro de una copia del build. No ejecutar npm run build sobre esa sustitución sin revisar: prepare:assets restablece por diseño la copia de dependencia declarada. Para conservar un cambio, modificar la dependencia/fuente de preparación o ejecutar npx vite build después de la sustitución. Mantener los avisos y documentar los cambios de biblioteca.

La prueba reproducible de recomposición instala realmente un módulo modificado en disco, sirve esa copia en loopback temporal y comprueba HEIC/OCR sin cambiar los bundles. No equivale a un rebuild nativo idéntico. Las fuentes/código de aplicación y los textos LGPL/GPL acompañan el candidato; el código propio usa MIT, Copyright (c) 2026 Guillem Carrion. No se emite una oferta vinculante de fuentes ni se declara una certificación legal. El wrapper upstream no incluye package-lock; por ello no se promete reproducibilidad nativa byte a byte a partir de sus rangos de herramientas de empaquetado.

## JPEG dentro de TIFF

El camino de producción usa vendor/utif/UTIF.mjs: contenedor UTIF 3.1.0 (MIT de Photopea) con su bloque JPEG minificado retirado. Delega en vendor/pdfjs-jpeg/jpg.mjs, basado en Mozilla/pdf.js commit 11ab3b5c000eb13e7ea5632ac36b1109ff7280b7, Apache-2.0 y Copyright 2014 Mozilla Foundation, con su atribución al origen notmasteryet/jpgjs. Solo se adaptaron interfaz ESM y aviso local; la fuente original legible y licencias acompañan la entrega.

No se afirma que ese commit sea la fuente histórica exacta del bloque retirado. La preparación comprueba hashes y límites del bloque; no se parchea por coincidencias vagas. Los fixtures comparan píxeles de JPEG gris/RGB/CMYK/YCCK y TIFF con tiras/tiles y JPEG6/7; las pruebas de UI ejecutan OCR sobre TIFF rasterizados reales. No se promete igualdad universal para imágenes dañadas, todas las conversiones de color o variantes TIFF no ensayadas.

## Entrega

Conservar web y source juntos en el paquete candidato. web/legal/index.html da acceso a avisos, textos íntegros y fuentes nativas; source incluye código y utilidades necesarios para la aplicación. No distribuir el build aislado suprimiendo sus avisos o fuentes acompañantes. El repositorio público es https://github.com/Guillem94/turnos-en-comun. Se ha autorizado preparar la demo HTTPS en GitHub Pages con el código público y datos ficticios; el workflow publica únicamente el build validado en Pages. El estado de cada despliegue se consulta en Actions. El build web conserva avisos y fuentes nativas locales, y legal/index.html enlaza a las fuentes de aplicación del repositorio. Licencia MIT y titular Guillem Carrion se mantienen. No se ha enviado candidatura ni se autoriza por ello otro hosting, puerto LAN o contrato. Las pruebas físicas requieren resultados humanos reales; WebKit automatizado no las sustituye.

El empaquetador exige inventario esencial y versiones coherentes, rechaza rutas externas/duplicadas y enlaces de archivos, comprueba avisos/fuentes y enlaces HTML locales, y verifica cada miembro contra una instantánea de bytes. ARTIFACT-MANIFEST.json acompaña el ZIP. Ese control se complementa con la comparación real de los 84 archivos frente al build limpio; no demuestra por sí solo que un build arbitrario corresponda al código fuente ni reemplaza revisión de contenido/licencias.
