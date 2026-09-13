# Pruebas y trazabilidad

El libro `Matriz_Pruebas_Trazabilidad_Defectos_KMISS.xlsx` contiene 40 casos de prueba, cobertura de los 21 requerimientos funcionales, 10 defectos de línea base y los 8 requerimientos no funcionales medibles. La columna **Ejecución** se actualizará con los resultados de Azure DevOps Test Plans; las métricas y el estado de trazabilidad se recalculan automáticamente.

La fuente versionable de los registros es `../calidad/datos-pruebas.mjs`. No se debe marcar un caso como aprobado o fallido sin una ejecución real y evidencia asociada.

## Distribución por técnica

- Partición de equivalencia: 13 casos.
- Análisis de valores límite: 12 casos.
- Tabla de decisión: 10 casos.
- Transición de estados: 5 casos.

## Criterio de defectos

Los defectos DEF-01 a DEF-10 describen comportamientos observados en la línea base del código. Durante la ejecución funcional se agregará una captura o respuesta de API a cada registro. Los defectos que se corrijan en la fase 2 conservarán la evidencia inicial y se cerrarán únicamente después de una prueba de regresión aprobada.
