# Arquitectura de alto nivel de KMISS

KMISS usa una arquitectura web cliente-servidor dentro de un monorepositorio. React presenta el portal público y el panel interno; Express concentra autenticación, autorización, reglas y transacciones; PostgreSQL conserva los datos clínico-administrativos y comerciales. En producción académica, Express sirve también la compilación del frontend bajo una sola URL.

## Diagramas

- [Diagrama de contexto](diagrama-contexto.svg)
- [Diagrama de contenedores](diagrama-contenedores.svg)
- [Modelo de datos principal](modelo-datos.svg)

## Tecnologías y dependencias externas

| Capa | Tecnología | Responsabilidad |
| --- | --- | --- |
| Interfaz | React 18, React Router, Vite | Navegación, formularios, catálogos y paneles por rol |
| API | Node.js 20, Express 4 | Endpoints REST, validación, autorización y transacciones |
| Seguridad | JWT, bcryptjs | Sesiones firmadas y contraseñas protegidas |
| Persistencia | PostgreSQL, pg | Integridad relacional, bloqueos y transacciones |
| Archivos | Multer, xlsx | Imágenes e importaciones de hojas de cálculo |
| Despliegue | Render | Servicio web y base de datos administrada |
| Pruebas | Jest, Supertest, Newman, k6 | Pruebas unitarias, API y carga |
| Calidad | SonarCloud o SonarQube | Análisis estático y compuerta de calidad |

## Módulos críticos

| Prioridad | Módulo | Impacto de una falla | Motivo de criticidad |
| --- | --- | --- | --- |
| 1 | Autenticación y autorización | Acceso indebido a datos y operaciones | Protege todas las rutas internas y separa responsabilidades por rol |
| 2 | Agenda y citas | Doble reserva o atención incorrecta | Combina horarios, bloqueos, duración y concurrencia |
| 3 | Ventas e inventario | Pérdida económica y stock inconsistente | Calcula importes y actualiza existencias en la misma transacción |
| 4 | Pedidos y pagos | Reserva, cobro o despacho inconsistente | Usa una máquina de estados y convierte pedidos pagados en ventas |
| 5 | Pacientes e historial | Información incompleta o expuesta | Relaciona identidad, citas, ventas y pedidos |

Estos cinco módulos definen el alcance mínimo de cobertura unitaria de la fase 2. La línea base se medirá antes de agregar pruebas y deberá aumentar al menos veinte puntos porcentuales en cada módulo crítico incluido.
