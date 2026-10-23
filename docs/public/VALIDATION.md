# Validación histórica del candidato local 0.5.0 — 22/10/2026

Ejecución del 22/10/2026 en Windows con Node 24.18.0, npm 11.16.0 y Microsoft Edge mediante Playwright. Solo datos y calendarios ficticios. Estos resultados corresponden a fixtures finitos, no a precisión universal de OCR ni a aceptación en teléfonos físicos.

| Comprobación | Resultado observado |
| --- | --- |
| Instalación con lockfile, scripts desactivados y registro npm oficial | 43 paquetes, correcta |
| Build de aplicación y recursos locales | Correcto |
| Node: dominio, JSON, fechas, ICS y codecs | 60 aprobadas, 0 fallos |
| ICS con parser independiente ICAL.js | Cuatro casos dentro de la suite Node |
| Paridad de decodificación JPEG/TIFF frente al componente anterior | 11 fixtures reales y comprobación de fuente/licencia, 12 casos dentro de Node |
| Interfaz E2E, OCR rasterizado, red y accesibilidad | 55 aprobadas, 0 fallos, 3.9 minutos en esta ejecución |
| Formato Prettier | Correcto |
| Empaquetador Python: rutas, duplicados, inventario, enlaces y bytes ZIP | Nueve pruebas aprobadas, 0 fallos |
| Build limpio frente al principal | 84 archivos idénticos: rutas, tamaños y SHA-256, sin archivos extra o ausentes |
| Fuentes nativas acompañantes | Cuatro archivos: hashes y archivos requeridos correctos; scripts upstream no ejecutados |
| Recomposición HEIC | Módulo modificado realmente en disco, cinco bundles de aplicación intactos, HEIC/OCR real con 14 candidatos y cero peticiones externas iniciadas por la aplicación en ese caso |

Las pruebas de imagen recorren el input real, conversión local y Tesseract/WASM. Cubren PNG/JPEG/WebP, BMP, GIF, TIFF, HEIC y AVIF estático de un elemento, según las variantes de fixtures incluidas. TIFF JPEG6/7 y TIFF multipágina tienen comprobaciones propias. Otra prueba abre cuatro TIFF reales mediante el servidor de desarrollo para conservar la regresión ESM; el primer intento CommonJS había fallado en desarrollo y se corrigió sin cambiar el algoritmo JPEG.

Los diseños OCR ensayados incluyen cuadrículas mensuales con bordes y sin ellos, semanas, listas y tablas por persona en filas/columnas. Se prueban giro/recorte, borrosidad/código desconocido, ambigüedad, no calendario e instrucciones maliciosas dentro de la imagen. Las filas dudosas quedan pendientes; cancelar no guarda, y duplicados/conflictos bloquean inserciones silenciosas. Se ejercita revisión móvil a 360/390 píxeles y escritorio. El viewport no acredita funcionamiento en Safari/iPhone o Android reales.

Las pruebas restringen peticiones del contexto del navegador. El equipo de ejecución inyecta scripts de antivirus que se contabilizan aparte; no se desactivó ni modificó antivirus, firewall, CORS o seguridad del sistema. El runtime sirve sus recursos del origen local, sin subir imágenes, OCR o turnos a proveedores. La instalación inicial sí descarga paquetes desde npm.

No se recompiló el codec nativo ni se afirma reproducibilidad binaria de Emscripten, certificación jurídica o compatibilidad con todo HEIC/TIFF. HDR/10 bits/Live Photos, todas las variantes de animación y manuscritos/solo colores no están certificados. PDF/SVG/RAW y los formatos excluidos en DISTRIBUTION.md siguen excluidos. Falta aceptación física e importación ICS en teléfonos reales.

Comandos reproducibles en TESTING.md. Estos resultados no prueban adopción externa, elegibilidad o selección en un programa. Estos resultados históricos corresponden al candidato local del 22/10/2026. El repositorio está publicado en [Guillem94/turnos-en-comun](https://github.com/Guillem94/turnos-en-comun); consultar [Actions](https://github.com/Guillem94/turnos-en-comun/actions) para el estado actual por commit. Esta tabla no acredita ejecuciones nuevas ni el resultado del incremento E2E en CI. No se ha enviado ninguna candidatura.
