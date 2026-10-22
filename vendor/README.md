# Fuentes derivadas trazables

manifest.json fija hashes de UTIF 3.1.0 y de la fuente JPEG Mozilla, su commit, cambios y atribuciones. pdfjs-jpeg/jpg.original.js conserva la fuente original; jpg.mjs adapta solo interfaz ESM y warning local. utif/UTIF.mjs conserva el contenedor MIT con el bloque JPEG minificado retirado y delegación al componente explícito.

Regenerar mediante node scripts/prepare-tiff-source.mjs después de npm ci. Verifica las fuentes ya incluidas; no descarga nada por defecto. --fetch-upstream es solo para una obtención inicial explícita desde URLs fijadas y se niega a sobrescribir archivos existentes.

Las licencias y copyrights originales se conservan; las modificaciones están señaladas. No se afirma que la revisión Mozilla elegida sea la fuente histórica exacta del bloque antiguo eliminado.
