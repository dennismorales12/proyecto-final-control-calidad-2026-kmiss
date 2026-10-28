# Carga de catálogo y agenda en QA

El escenario k6 consulta `GET /api/tienda/productos` y
`GET /api/tienda/disponibilidad`. Sube de 0 a 50 usuarios en 30 segundos,
mantiene 50 durante cinco minutos y baja a cero en 30 segundos.
No usa `/health` como endpoint crítico de negocio.

## Requisitos del ambiente

Verificar antes que el App Service y la base son de QA, están separados de
producción y contienen datos descartables. Revisar capacidad y costos de la
suscripción. Las comprobaciones del hostname no garantizan por sí solas el
aislamiento de la base. El catálogo limpia reservas vencidas, por lo que su
consulta puede modificar la base del ambiente.

Configurar estas variables en el proceso y en el contenedor:

- `AMBIENTE=QA`.
- `QA_HOST`: hostname exacto del App Service, con el segmento `qa` en su nombre.
- `PROD_HOST`: hostname de producción para bloquear una coincidencia accidental.
- `BASE_URL`: URL HTTPS que coincide exactamente con `QA_HOST`, sin ruta ni credenciales.
- `MEDICO_ID`, `SEDE_ID`, `SERVICIO_ID`: IDs positivos existentes y relacionados en QA.
- `FECHA`: fecha real futura UTC con horarios disponibles para esas referencias.

En Azure Pipelines se usan `CARGA_MEDICO_ID`, `CARGA_SEDE_ID`,
`CARGA_SERVICIO_ID` y `CARGA_FECHA` del grupo de ambientes. No inventar IDs
solo para superar el preflight.

Copiar los dominios predeterminados reales desde Azure a `QA_HOST_VERIFICADO`
y `PROD_HOST_VERIFICADO`. No construirlos suponiendo que son solo el nombre
de la aplicación: pueden incluir un identificador y una región.

## Ejecución y conservación

Crear primero `load/resultados`. Con las variables configuradas:

```text
node scripts/verificar-qa.mjs
k6 run --out json=load/resultados/serie-k6.json.gz load/kmiss-load.js
node scripts/resumir-carga.mjs load/resultados/resumen-k6.json load/resultados/informe-carga.md
```

El preflight exige HTTP 200, JSON y productos/horarios no vacíos con el contrato
esperado. No acepta redirecciones. El escenario tiene timeout de 15 segundos
por solicitud. Un HTML de App Service o una lista vacía no acreditan QA listo.

`handleSummary` guarda el esquema con `metrics.values`, no el formato legado
de `--summary-export`. El pipeline utiliza `grafana/k6:0.54.0` con el UID/GID
del agente para escribir en el volumen. Solo ejecuta carga después del
despliegue de QA, no en validaciones de PR.

Por endpoint se reportan promedio y p95 en ms, solicitudes por segundo,
número de solicitudes y error HTTP. Umbrales: p95 <=2500 ms, error <1 % y
comprobaciones correctas >99 %. Un HTTP 200 con contenido incorrecto puede
fallar las comprobaciones aunque no incremente el error HTTP.

El artefacto `resultados-carga-k6` conserva resumen, serie temporal comprimida
y reporte Markdown incluso tras un fallo. Si falta una métrica, el reporte
falla; no reemplaza ausencias por cero. Los agregados por sí solos no prueban
la rampa; contrastar usuarios activos y duración en la serie temporal.

RNF-01 también incluye autenticación. Dos endpoints cumplen el mínimo de
alcance E14, pero no permiten declarar cumplimiento de todo RNF-01 sin medir
autenticación bajo condiciones equivalentes.

## Verificación sin carga cloud

```text
node --test scripts/carga-qa.test.mjs
```

Los dobles aíslan configuración, respuestas y métricas. El adaptador simulado
del escenario no ejecuta el motor real k6 ni hace solicitudes de red. Estas
pruebas no sustituyen la carga cloud.

Referencias:

- [Resumen personalizado k6](https://grafana.com/docs/k6/latest/results-output/end-of-test/custom-summary/).
- [Salida JSON y permisos Docker](https://grafana.com/docs/k6/latest/results-output/real-time/json/).
