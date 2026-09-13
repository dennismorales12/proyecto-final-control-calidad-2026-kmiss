# Configuración de CI/CD y ambientes

## Ramas

- `DEV`: integración de cambios.
- `QA`: validación funcional y automatizada.
- `main`: producción.

Las ramas `QA` y `main` deben configurarse en GitHub con protección que exija pull request, una aprobación de otro integrante y el estado exitoso del trabajo `quality` antes de fusionar. Los cambios se promueven `rama de trabajo -> DEV -> QA -> main`.

## Secretos del repositorio

- `SONAR_TOKEN`: token de SonarQube Cloud.
- `QA_BASE_URL`: URL del backend QA sin barra final.
- `QA_ADMIN_EMAIL`: correo del administrador de pruebas.
- `QA_ADMIN_PASSWORD`: contraseña del administrador de pruebas.
- `RENDER_DEPLOY_HOOK`: hook de despliegue del servicio de producción en Render.

No se almacenan credenciales en el repositorio. Si no existe un secreto opcional, la etapa correspondiente se omite; antes de la entrega final todos deben configurarse para ejecutar el flujo completo.

## Orden del pipeline

1. Instalar dependencias de backend y frontend.
2. Compilar el frontend.
3. Ejecutar pruebas unitarias y generar cobertura LCOV.
4. Ejecutar análisis SonarQube Cloud.
5. bloquear el pipeline si falla el Quality Gate.
6. Ejecutar la colección Postman/Newman contra QA.
7. Publicar artefactos de evidencia.
8. Desplegar en Render únicamente después de un `push` aceptado en `main`.

## Evidencia

Cada ejecución conserva cobertura y resultados Newman como artefactos. La prueba de rendimiento se ejecuta mediante el flujo manual `KMISS load test` y conserva el resumen JSON y la salida completa de k6.
