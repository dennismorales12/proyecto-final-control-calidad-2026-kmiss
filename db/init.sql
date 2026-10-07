-- ============================================
-- Vitalis - Sistema de Gestión para Clínica
-- Esquema inicial de base de datos (PostgreSQL)
-- ============================================

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    telefono VARCHAR(30),
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('administrador', 'recepcion', 'medico')),
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pacientes (
    id SERIAL PRIMARY KEY,
    nombre_completo VARCHAR(200) NOT NULL,
    nit VARCHAR(30) UNIQUE,
    documento_identificacion VARCHAR(50) UNIQUE,
    fecha_nacimiento DATE,
    telefono VARCHAR(30),
    email VARCHAR(150),
    direccion VARCHAR(255),
    tipo_sangre VARCHAR(5),
    alergias TEXT,
    contacto_emergencia_nombre VARCHAR(150),
    contacto_emergencia_telefono VARCHAR(30),
    notas TEXT,
    creado_por INTEGER REFERENCES usuarios(id),
    creado_en TIMESTAMP DEFAULT NOW(),
    actualizado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS servicios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    duracion_minutos INTEGER NOT NULL DEFAULT 30,
    precio NUMERIC(10,2) NOT NULL DEFAULT 0,
    especialidad VARCHAR(100),
    imagen_url VARCHAR(500),
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS citas (
    id SERIAL PRIMARY KEY,
    paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    servicio_id INTEGER NOT NULL REFERENCES servicios(id),
    medico_id INTEGER REFERENCES usuarios(id),
    fecha_hora TIMESTAMP NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'programada'
        CHECK (estado IN ('solicitada', 'programada', 'confirmada', 'atendida', 'cancelada', 'no_asistio')),
    motivo_consulta TEXT,
    notas_medico TEXT,
    creado_por INTEGER REFERENCES usuarios(id),
    creado_en TIMESTAMP DEFAULT NOW(),
    actualizado_en TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citas_fecha ON citas(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_citas_paciente ON citas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_documento ON pacientes(documento_identificacion);
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS imagen_url VARCHAR(500);

CREATE TABLE IF NOT EXISTS sedes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL UNIQUE,
    direccion VARCHAR(255) NOT NULL,
    telefono VARCHAR(30),
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT NOW(),
    actualizado_en TIMESTAMP DEFAULT NOW()
);
INSERT INTO sedes (nombre, direccion)
VALUES ('Sede Central', 'Dirección pendiente de configurar')
ON CONFLICT (nombre) DO NOTHING;

CREATE TABLE IF NOT EXISTS horarios_semanales (
    id SERIAL PRIMARY KEY,
    medico_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    sede_id INTEGER NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
    semana JSONB NOT NULL DEFAULT '{}'::jsonb,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT NOW(),
    actualizado_en TIMESTAMP DEFAULT NOW(),
    UNIQUE (medico_id, sede_id)
);

-- Convierte instalaciones anteriores: muchos bloques diarios pasan a un solo horario semanal.
DO $$
BEGIN
    IF to_regclass('public.horarios_medicos') IS NOT NULL THEN
        INSERT INTO horarios_semanales (medico_id, sede_id, semana)
        SELECT medico_id, sede_id, jsonb_object_agg(dia_semana::text, bloques)
        FROM (
            SELECT medico_id, sede_id, dia_semana,
                   jsonb_agg(jsonb_build_object(
                       'inicio', TO_CHAR(hora_inicio, 'HH24:MI'),
                       'fin', TO_CHAR(hora_fin, 'HH24:MI')
                   ) ORDER BY hora_inicio) AS bloques
            FROM horarios_medicos
            WHERE activo = TRUE AND sede_id IS NOT NULL
            GROUP BY medico_id, sede_id, dia_semana
        ) horarios_por_dia
        GROUP BY medico_id, sede_id
        ON CONFLICT (medico_id, sede_id) DO UPDATE
        SET semana = EXCLUDED.semana, actualizado_en = NOW();
    END IF;
END $$;
DROP TABLE IF EXISTS horarios_medicos;

CREATE TABLE IF NOT EXISTS bloqueos_medicos (
    id SERIAL PRIMARY KEY,
    medico_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    sede_id INTEGER NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    motivo VARCHAR(150) NOT NULL DEFAULT 'No disponible',
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT NOW(),
    CHECK (hora_fin > hora_inicio)
);
CREATE INDEX IF NOT EXISTS idx_bloqueos_medico_fecha ON bloqueos_medicos(medico_id, sede_id, fecha);

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono VARCHAR(30);
ALTER TABLE citas ADD COLUMN IF NOT EXISTS sede_id INTEGER REFERENCES sedes(id);
UPDATE citas SET sede_id=(SELECT id FROM sedes ORDER BY id LIMIT 1) WHERE sede_id IS NULL;
ALTER TABLE citas ALTER COLUMN sede_id SET NOT NULL;
ALTER TABLE citas DROP CONSTRAINT IF EXISTS citas_estado_check;
ALTER TABLE citas ADD CONSTRAINT citas_estado_check
    CHECK (estado IN ('solicitada', 'programada', 'confirmada', 'atendida', 'cancelada', 'no_asistio'));
INSERT INTO horarios_semanales (medico_id, sede_id, semana)
SELECT u.id, s.id, '{ "0": [], "1": [{"inicio":"08:00","fin":"12:00"},{"inicio":"13:00","fin":"17:00"}], "2": [{"inicio":"08:00","fin":"12:00"},{"inicio":"13:00","fin":"17:00"}], "3": [{"inicio":"08:00","fin":"12:00"},{"inicio":"13:00","fin":"17:00"}], "4": [{"inicio":"08:00","fin":"12:00"},{"inicio":"13:00","fin":"17:00"}], "5": [{"inicio":"08:00","fin":"12:00"},{"inicio":"13:00","fin":"17:00"}], "6": [{"inicio":"08:00","fin":"12:00"},{"inicio":"13:00","fin":"17:00"}] }'::jsonb
FROM usuarios u CROSS JOIN (SELECT id FROM sedes WHERE activo=TRUE ORDER BY id LIMIT 1) s
WHERE u.rol = 'medico' AND u.activo = TRUE
  AND NOT EXISTS (SELECT 1 FROM horarios_semanales hs WHERE hs.medico_id=u.id)
ON CONFLICT (medico_id, sede_id) DO NOTHING;

-- ============================================
-- Módulo de Ventas / Inventario
-- ============================================

CREATE TABLE IF NOT EXISTS categorias_productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    orden INTEGER NOT NULL DEFAULT 0,
    creado_en TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categorias_productos_nombre
    ON categorias_productos (LOWER(nombre));

CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(100),
    categoria_id INTEGER REFERENCES categorias_productos(id),
    imagen_url VARCHAR(500),
    precio NUMERIC(10,2) NOT NULL DEFAULT 0,
    costo NUMERIC(10,2) DEFAULT 0,
    stock_actual INTEGER NOT NULL DEFAULT 0,
    stock_reservado INTEGER NOT NULL DEFAULT 0,
    stock_minimo INTEGER NOT NULL DEFAULT 0,
    unidad_medida VARCHAR(30) DEFAULT 'unidad',
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ventas (
    id SERIAL PRIMARY KEY,
    paciente_id INTEGER REFERENCES pacientes(id),
    vendido_por INTEGER REFERENCES usuarios(id),
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    descuento NUMERIC(10,2) NOT NULL DEFAULT 0,
    total NUMERIC(10,2) NOT NULL DEFAULT 0,
    metodo_pago VARCHAR(20) NOT NULL DEFAULT 'efectivo'
        CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia')),
    estado VARCHAR(20) NOT NULL DEFAULT 'completada'
        CHECK (estado IN ('completada', 'anulada')),
    creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venta_detalles (
    id SERIAL PRIMARY KEY,
    venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id INTEGER REFERENCES productos(id),
    servicio_id INTEGER REFERENCES servicios(id),
    descripcion VARCHAR(200) NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1,
    precio_unitario NUMERIC(10,2) NOT NULL,
    subtotal NUMERIC(10,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(creado_en);
CREATE INDEX IF NOT EXISTS idx_venta_detalles_venta ON venta_detalles(venta_id);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria);

CREATE TABLE IF NOT EXISTS promociones_productos (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    descuento_porcentaje NUMERIC(5,2) NOT NULL CHECK (descuento_porcentaje > 0 AND descuento_porcentaje <= 100),
    fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_fin DATE,
    activo BOOLEAN DEFAULT TRUE,
    creado_por INTEGER REFERENCES usuarios(id),
    creado_en TIMESTAMP DEFAULT NOW(),
    actualizado_en TIMESTAMP DEFAULT NOW(),
    CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_promociones_producto ON promociones_productos(producto_id, activo);

CREATE TABLE IF NOT EXISTS noticias (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(180) NOT NULL,
    resumen VARCHAR(300),
    contenido TEXT,
    fecha_evento DATE,
    enlace_url VARCHAR(500),
    imagen_url VARCHAR(500),
    activo BOOLEAN DEFAULT TRUE,
    creado_por INTEGER REFERENCES usuarios(id),
    creado_en TIMESTAMP DEFAULT NOW(),
    actualizado_en TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_noticias_publicas ON noticias(activo, fecha_evento, creado_en);

-- ============================================
-- Tienda pública / Pedidos web (sin autenticación)
-- ============================================

CREATE TABLE IF NOT EXISTS pedidos_publicos (
    id SERIAL PRIMARY KEY,
    paciente_id INTEGER REFERENCES pacientes(id),
    nit_cliente VARCHAR(30),
    nombre_cliente VARCHAR(200) NOT NULL,
    telefono VARCHAR(30) NOT NULL,
    email VARCHAR(150),
    direccion_envio VARCHAR(255) NOT NULL,
    metodo_pago_preferido VARCHAR(20) NOT NULL DEFAULT 'efectivo'
        CHECK (metodo_pago_preferido IN ('efectivo', 'transferencia')),
    notas TEXT,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    total NUMERIC(10,2) NOT NULL DEFAULT 0,
    estado VARCHAR(30) NOT NULL DEFAULT 'nuevo'
        CHECK (estado IN ('nuevo', 'contactado', 'esperando_pago', 'pagado', 'preparando', 'entregado', 'cancelado', 'vencido')),
    motivo_rechazo TEXT,
    revisado_por INTEGER REFERENCES usuarios(id),
    revisado_en TIMESTAMP,
    venta_id INTEGER REFERENCES ventas(id),
    reserva_expira_en TIMESTAMP,
    contactado_en TIMESTAMP,
    pago_confirmado_en TIMESTAMP,
    referencia_pago VARCHAR(100),
    entregado_en TIMESTAMP,
    creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pedido_detalles (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedidos_publicos(id) ON DELETE CASCADE,
    producto_id INTEGER REFERENCES productos(id),
    descripcion VARCHAR(200) NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1,
    precio_unitario NUMERIC(10,2) NOT NULL,
    subtotal NUMERIC(10,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos_publicos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos_publicos(creado_en);
CREATE INDEX IF NOT EXISTS idx_pedido_detalles_pedido ON pedido_detalles(pedido_id);

-- Migraciones idempotentes para instalaciones creadas con versiones anteriores.
ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock_reservado INTEGER NOT NULL DEFAULT 0;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS categoria_id INTEGER REFERENCES categorias_productos(id);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS imagen_url VARCHAR(500);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS imagen_datos BYTEA;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS imagen_mime VARCHAR(50);
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS imagen_datos BYTEA;
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS imagen_mime VARCHAR(50);
ALTER TABLE noticias ADD COLUMN IF NOT EXISTS imagen_datos BYTEA;
ALTER TABLE noticias ADD COLUMN IF NOT EXISTS imagen_mime VARCHAR(50);
ALTER TABLE promociones_productos ALTER COLUMN producto_id DROP NOT NULL;
ALTER TABLE promociones_productos ADD COLUMN IF NOT EXISTS categoria_id INTEGER REFERENCES categorias_productos(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_promociones_categoria ON promociones_productos(categoria_id, activo);
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'promociones_alcance_check'
    ) THEN
        ALTER TABLE promociones_productos
            ADD CONSTRAINT promociones_alcance_check
            CHECK ((producto_id IS NOT NULL AND categoria_id IS NULL)
                OR (producto_id IS NULL AND categoria_id IS NOT NULL));
    END IF;
END $$;
INSERT INTO categorias_productos (nombre)
SELECT DISTINCT TRIM(p.categoria)
FROM productos p
WHERE p.categoria IS NOT NULL AND TRIM(p.categoria) <> ''
  AND NOT EXISTS (SELECT 1 FROM categorias_productos c WHERE LOWER(c.nombre) = LOWER(TRIM(p.categoria)));
UPDATE productos p SET categoria_id = c.id
FROM categorias_productos c
WHERE p.categoria_id IS NULL AND LOWER(c.nombre) = LOWER(TRIM(p.categoria));
ALTER TABLE pedidos_publicos ADD COLUMN IF NOT EXISTS reserva_expira_en TIMESTAMP;
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS nit VARCHAR(30);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pacientes_nit_unico
    ON pacientes (UPPER(nit)) WHERE nit IS NOT NULL AND TRIM(nit) <> '';
ALTER TABLE pedidos_publicos ADD COLUMN IF NOT EXISTS paciente_id INTEGER REFERENCES pacientes(id);
ALTER TABLE pedidos_publicos ADD COLUMN IF NOT EXISTS nit_cliente VARCHAR(30);
ALTER TABLE pedidos_publicos ADD COLUMN IF NOT EXISTS contactado_en TIMESTAMP;
ALTER TABLE pedidos_publicos ADD COLUMN IF NOT EXISTS pago_confirmado_en TIMESTAMP;
ALTER TABLE pedidos_publicos ADD COLUMN IF NOT EXISTS referencia_pago VARCHAR(100);
ALTER TABLE pedidos_publicos ADD COLUMN IF NOT EXISTS entregado_en TIMESTAMP;
ALTER TABLE pedidos_publicos DROP CONSTRAINT IF EXISTS pedidos_publicos_estado_check;
ALTER TABLE pedidos_publicos ALTER COLUMN estado SET DEFAULT 'nuevo';
UPDATE pedidos_publicos SET estado = CASE estado
    WHEN 'pendiente' THEN 'nuevo'
    WHEN 'aprobado' THEN 'pagado'
    WHEN 'rechazado' THEN 'cancelado'
    ELSE estado
END
WHERE estado IN ('pendiente', 'aprobado', 'rechazado');
UPDATE pedidos_publicos
SET reserva_expira_en = COALESCE(reserva_expira_en, NOW() + INTERVAL '24 hours')
WHERE estado IN ('nuevo', 'contactado', 'esperando_pago');
WITH cantidades AS (
    SELECT d.producto_id, SUM(d.cantidad)::integer AS cantidad
    FROM pedido_detalles d
    JOIN pedidos_publicos p ON p.id = d.pedido_id
    WHERE p.estado IN ('nuevo', 'contactado', 'esperando_pago') AND d.producto_id IS NOT NULL
    GROUP BY d.producto_id
)
UPDATE productos p
SET stock_reservado = LEAST(p.stock_actual, c.cantidad)
FROM cantidades c
WHERE p.id = c.producto_id;
ALTER TABLE pedidos_publicos ADD CONSTRAINT pedidos_publicos_estado_check
    CHECK (estado IN ('nuevo', 'contactado', 'esperando_pago', 'pagado', 'preparando', 'entregado', 'cancelado', 'vencido'));
ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_stock_reservado_check;
ALTER TABLE productos ADD CONSTRAINT productos_stock_reservado_check CHECK (stock_reservado >= 0) NOT VALID;
ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_reserva_no_supera_stock_check;
ALTER TABLE productos ADD CONSTRAINT productos_reserva_no_supera_stock_check CHECK (stock_reservado <= stock_actual) NOT VALID;
ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_valores_no_negativos_check;
ALTER TABLE productos ADD CONSTRAINT productos_valores_no_negativos_check
    CHECK (precio >= 0 AND costo >= 0 AND stock_actual >= 0 AND stock_minimo >= 0) NOT VALID;
ALTER TABLE servicios DROP CONSTRAINT IF EXISTS servicios_valores_validos_check;
ALTER TABLE servicios ADD CONSTRAINT servicios_valores_validos_check
    CHECK (duracion_minutos > 0 AND precio >= 0) NOT VALID;
ALTER TABLE venta_detalles DROP CONSTRAINT IF EXISTS venta_detalles_valores_validos_check;
ALTER TABLE venta_detalles ADD CONSTRAINT venta_detalles_valores_validos_check
    CHECK (cantidad > 0 AND precio_unitario >= 0 AND subtotal >= 0) NOT VALID;
ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_valores_validos_check;
ALTER TABLE ventas ADD CONSTRAINT ventas_valores_validos_check
    CHECK (subtotal >= 0 AND descuento >= 0 AND total >= 0 AND descuento <= subtotal) NOT VALID;

-- Conserva el historial de pedidos anteriores vinculándolos a una ficha de cliente.
INSERT INTO pacientes (nombre_completo, telefono, email, direccion, notas)
SELECT DISTINCT ON (p.telefono) p.nombre_cliente, p.telefono, p.email, p.direccion_envio,
       'Registro creado desde un pedido web anterior'
FROM pedidos_publicos p
WHERE p.paciente_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM pacientes pa
    WHERE pa.telefono = p.telefono OR (p.email IS NOT NULL AND LOWER(pa.email) = LOWER(p.email))
  )
ORDER BY p.telefono, p.creado_en DESC;
UPDATE pedidos_publicos p SET paciente_id = pa.id
FROM pacientes pa
WHERE p.paciente_id IS NULL
  AND (pa.telefono = p.telefono OR (p.email IS NOT NULL AND LOWER(pa.email) = LOWER(p.email)));
