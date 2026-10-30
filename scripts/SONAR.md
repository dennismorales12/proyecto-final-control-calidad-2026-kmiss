# SonarCloud por ambiente

La organización utiliza el plan Free, que permite analizar la rama principal de cada proyecto y PR dirigidos a esa rama. DEV y QA tienen proyectos independientes; el proyecto histórico sigue reservado a main. No se cambia el nombre de la rama durante el análisis.

| Rama o destino de PR | Proyecto | Rama principal configurada en SonarCloud |
| --- | --- | --- |
| DEV | dennismorales12_kmiss-dev | DEV |
| QA | dennismorales12_kmiss-qa | QA |
| main | dennismorales12_proyecto-final-control-calidad-2026-kmiss | main |
| revision/sonar-sql | dennismorales12_kmiss-sql | revision/sonar-sql |

La rama de revisión SQL permite comparar análisis completos del mismo código
antes y después de un cambio del esquema. Tiene un proyecto separado y no
selecciona ningún job de despliegue: únicamente DEV, QA y main tienen destinos.
El registro histórico de main se conserva y no se sustituye por esta medición.

`configurar-sonar.cjs` selecciona el proyecto usando la rama del push o el destino del PR. Una referencia ausente o desconocida detiene el pipeline. `SonarCloudPrepare` aplica la clave y el nombre sobre el archivo común de configuración. El resto de las propiedades, el alcance, los informes LCOV y la espera del quality gate se mantienen.

Los nuevos proyectos no heredan el historial del proyecto de producción. Su primer análisis establece una línea inicial propia: no se debe presentar como comparativa antes/después ni como remediación de los hallazgos históricos. La cobertura crítica sigue comparándose contra el commit fijo `55c90b29d479102c6de16448dd2bd6d77845f148` mediante el script de cobertura. Para comparar hallazgos, usar siempre el mismo proyecto, rama, alcance y revisión.

La conexión existente de SonarCloud debe tener permiso de ejecución de análisis en los dos proyectos nuevos. Si no lo tiene, el análisis debe fallar y conservar el bloqueo de despliegue. No se imprimen ni se guardan tokens en el repositorio.

Verificación local: `node --test scripts/configurar-sonar.test.cjs`.

Referencia: https://docs.sonarsource.com/sonarqube-cloud/administering-sonarcloud/managing-subscription/subscription-plans
