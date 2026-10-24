# Migraciones PostgreSQL

Este conjunto es de integración, no de pruebas unitarias. Usa `node:test` y
PostgreSQL real para comprobar esquema, reejecución, conversión de estados
históricos, restricciones y conservación de datos.

Se admite únicamente `NODE_ENV=test`, host `127.0.0.1` o `localhost`, y base
`kmiss_ci` o `kmiss_migraciones_test`. La base debe estar vacía. Cada caso
ejecuta `BEGIN` y `ROLLBACK`; no contiene DROP DATABASE ni limpia datos de
una instalación existente. El proceso falla antes de probar si encuentra
tablas públicas. Nunca usar una cadena de conexión de Azure.

En Azure Pipelines se ejecuta contra el servicio efímero PostgreSQL 16,
antes de inicializar los datos de Newman. Su XML se publica como
`Migraciones PostgreSQL KMISS`, separado de Jest, Vitest y API. El agente
se fija en Ubuntu 24.04 para evitar cambios automáticos de ubuntu-latest.

Ejemplo local, con una base desechable ya creada:

```sh
NODE_ENV=test DATABASE_URL=postgresql://postgres@127.0.0.1:55434/kmiss_migraciones_test \
  node --test backend/integration/migraciones.test.cjs
```

Un resultado aprobado demuestra ejecución en PostgreSQL, pero no sustituye
un análisis estático del dialecto correcto ni prueba una migración sobre
datos productivos. Sonar trata `.sql` como PL/SQL por defecto; los avisos
deben revisarse contra el dialecto PostgreSQL. No se han excluido archivos
ni desactivado reglas para conseguir una puerta de calidad aprobada.
