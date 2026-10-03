require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const pacientesRoutes = require('./routes/pacientes');
const serviciosRoutes = require('./routes/servicios');
const citasRoutes = require('./routes/citas');
const productosRoutes = require('./routes/productos');
const ventasRoutes = require('./routes/ventas');
const tiendaRoutes = require('./routes/tienda');
const pedidosRoutes = require('./routes/pedidos');
const usuariosRoutes = require('./routes/usuarios');
const ajustesRoutes = require('./routes/ajustes');
const mediaRoutes = require('./routes/media');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/health', (req, res) => {
  res.json({ estado: 'ok', servicio: 'kmiss-backend', timestamp: new Date().toISOString() });
});

app.use('/api/media', mediaRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/pacientes', pacientesRoutes);
app.use('/api/servicios', serviciosRoutes);
app.use('/api/citas', citasRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/tienda', tiendaRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/ajustes', ajustesRoutes);

// En producción, Express entrega también la aplicación React bajo la misma URL.
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Manejador de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejador de errores general
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`Vitalis backend corriendo en http://localhost:${PORT}`);
});
