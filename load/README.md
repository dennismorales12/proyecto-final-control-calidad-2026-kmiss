# Prueba de carga de KMISS

El escenario prueba dos endpoints críticos: disponibilidad del backend (`GET /health`) y catálogo público (`GET /api/tienda/productos`). La carga sube de 0 a 50 usuarios virtuales en 30 segundos, se mantiene en 50 durante cinco minutos y baja a 0 en 30 segundos.

Umbrales verificables:

- percentil 95 de respuesta menor o igual a 2.5 segundos;
- tasa de solicitudes fallidas menor al 1 %;
- tasa de comprobaciones correctas mayor al 99 %.

Ejecución local:

```text
k6 run -e BASE_URL=https://URL-QA load/kmiss-load.js
```

En GitHub Actions se ejecuta manualmente el flujo `KMISS load test`, indicando la URL del ambiente QA. El artefacto descargable contiene `summary.json` y `console.txt`.
