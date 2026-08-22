# Vitalis

Sistema web de gestión para clínica / consultorio. Desarrollado con React, Vite, Node.js, Express y PostgreSQL.

> **Nota:** "Vitalis" es un nombre placeholder. Para cambiarlo al nombre real de tu negocio, edita `frontend/src/config.js` (constante `APP_CONFIG.nombreEmpresa`) — se actualiza en toda la interfaz automáticamente.

## Descripción

Vitalis centraliza la operación diaria de una clínica en una sola plataforma. Módulos incluidos en esta primera entrega:

- **Autenticación** con JWT y control de acceso por roles
- **Pacientes** — ficha completa (contacto, tipo de sangre, alergias, contacto de emergencia)
- **Servicios** — catálogo de servicios médicos con duración y precio
- **Citas** — agenda diaria con cambio de estado (programada → confirmada → atendida / cancelada)
- **Panel general** — resumen de pacientes, citas del día y servicios activos

## Stack

### Frontend
- React 18 + Vite
- React Router
- Lucide React (iconos)
- CSS propio (sin frameworks de UI)

### Backend
- Node.js + Express
- PostgreSQL
- JWT + bcryptjs

## Roles del sistema

| Rol | Permisos |
|---|---|
| **Administrador** | Acceso completo, gestión de servicios, eliminar registros |
| **Recepción** | Gestión de pacientes y citas |
| **Médico** | Consulta de citas, actualización de notas y estado |

## Estructura del proyecto

```
vitalis/
├── backend/
│   ├── src/
│   │   ├── middleware/
│   │   │   └── auth.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── pacientes.js
│   │   │   ├── servicios.js
│   │   │   └── citas.js
│   │   ├── db.js
│   │   └── server.js
│   ├── init-db.js
│   ├── seed-data.js
│   └── package.json
├── db/
│   └── init.sql
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Pacientes.jsx
│   │   │   ├── Servicios.jsx
│   │   │   └── Citas.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── config.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   └── package.json
└── README.md
```

## Cómo ejecutar localmente

### 1. Instalar dependencias

```
cd backend
npm install

cd ../frontend
npm install
```

### 2. Configurar variables de entorno

Copia `backend/.env.example` a `backend/.env` y ajusta si es necesario:

```
PORT=4000
DATABASE_URL=postgresql://postgres@localhost:5432/vitalis
JWT_SECRET=cambia_esto_por_una_clave_larga_y_aleatoria
JWT_EXPIRES_IN=8h
NODE_ENV=development
```

Copia `frontend/.env.example` a `frontend/.env`:

```
VITE_API_URL=http://localhost:4000/api
```

### 3. Crear la base de datos en PostgreSQL

Con PostgreSQL corriendo localmente:

```
createdb vitalis
```

(O crea la base `vitalis` desde pgAdmin / tu cliente de preferencia.)

### 4. Inicializar el esquema y datos de ejemplo

```
cd backend
npm run init-db
npm run seed
```

### 5. Ejecutar el backend

```
cd backend
npm run dev
```

### 6. Ejecutar el frontend

En otra terminal:

```
cd frontend
npm run dev
```

### 7. Abrir la aplicación

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Health check: `http://localhost:4000/health`

## Usuarios de prueba

Contraseña para todos: `vitalis123`

- `admin@vitalis.local` — Administrador
- `recepcion@vitalis.local` — Recepción
- `medico@vitalis.local` — Médico

## Pendientes / próximos módulos

- Historial clínico detallado por paciente (evolución de consultas)
- Facturación y pagos
- Notificaciones (recordatorio de citas por email/SMS)
- Reportes exportables (CSV/PDF)
- Vista de calendario semanal/mensual para citas

## Licencia

Proyecto personal — de uso libre para el negocio de origen.
