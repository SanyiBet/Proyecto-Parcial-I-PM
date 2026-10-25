require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { conectarDB } = require("./database/connection");
const { pingRedis } = require("./database/redis");

const {
  limiterAuth,
  limiterReservas,
  limiterGeneral,
} = require("./middleware/rate-limit.middleware");

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración estricta de CORS (CARD-33)
const origenesPermitidos = [
  "http://localhost:4200",
  "http://127.0.0.1:4200",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir solicitudes sin origen (Postman, curl, tests internos, apps móviles)
    if (!origin || origenesPermitidos.includes(origin)) {
      return callback(null, true);
    }
    const err = new Error(`Acceso denegado por política CORS: El origen '${origin}' no está autorizado.`);
    err.status = 403;
    return callback(err);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "x-bypass-ratelimit"],
};

// Middlewares globales de seguridad y parseo (soporta imágenes base64 hasta 10MB)
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate Limiting preventivo y específico (CARD-33)
app.use("/api", limiterGeneral);
app.use("/api/auth/login", limiterAuth);
app.use("/api/auth/register", limiterAuth);
app.use("/api/reservas", limiterReservas);

// Protección LOPDP: Bloqueo de acceso estático público a comprobantes bancarios (CARD-32)
app.use("/uploads/comprobantes", (req, res) => {
  return res.status(403).json({
    error: "Acceso denegado (Protección LOPDP)",
    mensaje: "Los comprobantes bancarios están protegidos. Acceda mediante /api/pagos/comprobante/:archivo con sesión autenticada.",
  });
});
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
const auditoriaRoutes = require("./routes/auditoria.routes");
const adminRoutes = require("./routes/admin.routes");

app.use("/api/auth", authRoutes);
app.use("/api/viajes", viajesRoutes);
app.use("/api/reservas", reservasRoutes);
app.use("/api/pasajeros", pasajerosRoutes);
app.use("/api/pagos", pagosRoutes);
app.use("/api/encomiendas", encomiendasRoutes);
app.use("/api/auditoria", auditoriaRoutes);
app.use("/api/admin", adminRoutes);

// Manejo centralizado de rutas no encontradas (404)
app.use((req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada",
    metodo: req.method,
    ruta: req.originalUrl,
  });
});

// Manejo centralizado de errores del servidor (500 / 403 CORS)
app.use((err, req, res, next) => {
  if (err.message && err.message.includes("CORS")) {
    return res.status(403).json({
      error: "Acceso denegado por política CORS",
      mensaje: err.message,
    });
  }
  console.error("❌ Error interno en el servidor:", err);
  res.status(err.status || err.statusCode || 500).json({
    error: err.statusCode === 400 ? "Solicitud inválida" : "Error interno del servidor",
    mensaje:
      process.env.NODE_ENV === "production"
        ? "Ocurrió un error inesperado"
        : err.message,
  });
});

const { iniciarWorkerLimpieza } = require("./services/limpieza-reservas.service");

// Inicio del servidor con conexión a MongoDB Atlas y Upstash Redis
async function iniciarServidor() {
  try {
    await conectarDB();
    const redisPing = await pingRedis();
    console.log(`✅ Conexión establecida con Upstash Redis: [${redisPing}] - Clave-Valor / TTL activo`);

    // Iniciar worker en segundo plano para limpiar y expirar reservas vencidas (CARD-29)
    iniciarWorkerLimpieza(60000);

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
