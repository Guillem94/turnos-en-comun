# Checklist de aceptación en móviles físicos

Estado inicial: **pendiente**, sin resultados físicos acreditados. Ejecutar por separado en iPhone con Safari y Android con Chrome; un viewport emulado no los sustituye.

## Entorno y registro

El loopback del PC (`127.0.0.1`) no llega a otro móvil. Se ha autorizado preparar una demo HTTPS en GitHub Pages: https://Guillem94.github.io/turnos-en-comun/ (demo de código público y datos ficticios). Comprobar el estado del despliegue en Actions antes de probar; no abrir LAN ni cambiar firewall o certificados. Pulsar «Probar demo con datos ficticios». Usar exclusivamente fixtures ficticios del repositorio y un almacenamiento de prueba, nunca calendarios personales.

Registrar en cada ejecución: fecha, dispositivo, versión de SO/navegador, versión de aplicación y SHA del commit, entorno autorizado, ruta/hash del fixture ficticio, zona IANA, pasos, resultado esperado y observado. Marcar **PASS / FAIL / NO PROBADO / NO SOPORTADO**, con el motivo real; no convertir ausencia de prueba en éxito.

## Casos por dispositivo

- [ ] Abrir la aplicación; comprobar controles táctiles, zoom, desplazamiento y revisión sin recortes.
- [ ] Importar un fixture rasterizado ficticio conocido; elegir persona, mes y leyenda. Revisar el OCR real y corregir dudas antes de confirmar.
- [ ] Probar selector e importación de HEIC/TIFF/GIF según el soporte y las variantes documentadas en DISTRIBUTION.md. Registrar rechazos/limitaciones reales; no asumir soporte universal.
- [ ] Cancelar una revisión y comprobar que no guarda cambios. Reimportar para comprobar duplicados y conflictos sin inserción silenciosa.
- [ ] Confirmar solo candidatos revisados; recargar y comprobar persistencia y separación demo/personal.
- [ ] Exportar y restaurar JSON ficticio en el entorno de prueba; comprobar contenido y rechazo de copia inválida sin reemplazo parcial.
- [ ] Exportar ICS con turno nocturno que cruce medianoche; importar en calendario de prueba y comprobar fecha, duración y zona IANA. Verificar tratamiento de horas ambiguas/inexistentes sin inferir resultados.

## Resultado real

Completar una fila por caso y dispositivo; mientras no se ejecute, permanece pendiente.

| Dispositivo / SO / navegador | Versión / commit / fixture | Caso / zona | Esperado | Observado | Estado / incidencia |
| --- | --- | --- | --- | --- | --- |
| Pendiente | Pendiente | Pendiente | Pendiente | No ejecutado | NO PROBADO |

No incluir imágenes, turnos ni datos personales en los resultados. Las pruebas automatizadas con imágenes rasterizadas no acreditan esta aceptación física.

La demo guarda datos solo en este navegador/origen, sin sincronización ni PWA/offline. GitHub recibe IP y solicitudes estáticas al servirla; no hay analítica propia ni proveedor OCR remoto, y la app no sube imágenes/texto OCR. WebKit automatizado no acredita iPhone físico: conservar el estado NO PROBADO hasta la comprobación humana real.
