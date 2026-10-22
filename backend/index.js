require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { conectarDB } = require("./database/connection");
const { pingRedis } = require("./database/redis");

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales de seguridad y parseo (soporta imágenes base64 hasta 10MB)
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Servidor estático seguro para visualización de comprobantes bancarios
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Endpoint de verificación de salud del sistema (Health Check)
app.get("/api/health", async (req, res) => {
  let redisEstado = "conectado";
  try {
    await pingRedis();
  } catch (err) {
    redisEstado = "error: " + err.message;
  }

  res.status(200).json({
    estado: "ok",
    servicio: "TransOrense Backend API",
    version: "1.0.0",
    bases_de_datos: {
      nosql_documental: "MongoDB Atlas (Conectado)",
      nosql_clave_valor: `Upstash Redis (${redisEstado})`
    },
    identificadores: "UUID v7",
    timestamp: new Date().toISOString(),
  });
});

// Rutas de los módulos
const authRoutes = require("./routes/auth.routes");
const viajesRoutes = require("./routes/viajes.routes");
const reservasRoutes = require("./routes/reservas.routes");
const pasajerosRoutes = require("./routes/pasajeros.routes");
const pagosRoutes = require("./routes/pagos.routes");
const encomiendasRoutes = require("./routes/encomiendas.routes");

app.use("/api/auth", authRoutes);
app.use("/api/viajes", viajesRoutes);
app.use("/api/reservas", reservasRoutes);
app.use("/api/pasajeros", pasajerosRoutes);
app.use("/api/pagos", pagosRoutes);
app.use("/api/encomiendas", encomiendasRoutes);

// Manejo centralizado de rutas no encontradas (404)
app.use((req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada",
    metodo: req.method,
    ruta: req.originalUrl,
  });
});

// Manejo centralizado de errores del servidor (500)
app.use((err, req, res, next) => {
  console.error("❌ Error interno en el servidor:", err);
  res.status(err.status || 500).json({
    error: "Error interno del servidor",
    mensaje:
      process.env.NODE_ENV === "production"
        ? "Ocurrió un error inesperado"
        : err.message,
  });
});

// Inicio del servidor con conexión a MongoDB Atlas y Upstash Redis
async function iniciarServidor() {
  try {
    await conectarDB();
    const redisPing = await pingRedis();
    console.log(`✅ Conexión establecida con Upstash Redis: [${redisPing}] - Clave-Valor / TTL activo`);

    app.listen(PORT, () => {
      console.log(`🚀 Servidor TransOrense activo en: http://localhost:${PORT}`);
      console.log(`📡 Chequeo de salud: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error("❌ Fallo crítico al iniciar el servidor:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  iniciarServidor();
}

module.exports = app;
