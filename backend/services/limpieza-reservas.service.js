/**
 * limpieza-reservas.service.js
 * Worker en Segundo Plano para Expiración y Limpieza de Reservas (CARD-29).
 * 
 * Busca periódicamente reservas temporales en estado 'reservada' cuya fecha
 * 'vence_en' sea anterior o igual al momento actual, las transiciona atómicamente
 * a 'expirada' en MongoDB Atlas y libera cualquier remanente en Upstash Redis.
 */

const { obtenerDB } = require("../database/connection");
const { liberarAsiento } = require("../database/redis");

let intervaloId = null;

/**
 * Ejecuta un ciclo de expiración y limpieza de reservas vencidas
 */
async function expirarReservasVencidas() {
  try {
    const db = obtenerDB();
    if (!db) return;

    const ahora = new Date();

    // 1. Buscar reservas temporales con vencimiento alcanzado
    const vencidas = await db
      .collection("reservas")
      .find({
        estado: "reservada",
        vence_en: { $lte: ahora },
      })
      .toArray();

    if (vencidas.length === 0) return;

    console.log(`🧹 [Worker Limpieza] Encontradas ${vencidas.length} reservas temporales vencidas. Expirando...`);

    const idsVencidas = vencidas.map((r) => r._id);

    // 2. Transición atómica en MongoDB Atlas a 'expirada'
    const resultado = await db.collection("reservas").updateMany(
      { _id: { $in: idsVencidas }, estado: "reservada" },
      { $set: { estado: "expirada", actualizada_en: ahora } }
    );

    // 3. Liberar asientos en Redis (por si persistía TTL local)
    for (const r of vencidas) {
      try {
        await liberarAsiento(r.viaje_id, String(r.asiento_numero));
      } catch (err) {
        // Ignorar si Redis ya expiró la clave automáticamente
      }
    }

    console.log(`✅ [Worker Limpieza] ${resultado.modifiedCount} reservas marcadas como 'expirada' y liberadas en inventario.`);
  } catch (error) {
    console.error("⚠️ [Worker Limpieza] Error en ciclo de expiración:", error.message);
  }
}

/**
 * Inicia el recolector de reservas periódicas
 * @param {number} intervaloMs - Intervalo en milisegundos (por defecto 60 segundos)
 */
function iniciarWorkerLimpieza(intervaloMs = 60000) {
  if (intervaloId) return;

  console.log(`⏱️ [Worker Limpieza] Recolector de reservas expiradas activo (cada ${intervaloMs / 1000}s).`);

  // Primera pasada 5 segundos después del arranque
  setTimeout(() => {
    expirarReservasVencidas();
  }, 5000);

  // Intervalo recurrente
  intervaloId = setInterval(expirarReservasVencidas, intervaloMs);
}

/**
 * Detiene el recolector (usado en tests y shutdown ordenado)
 */
function detenerWorkerLimpieza() {
  if (intervaloId) {
    clearInterval(intervaloId);
    intervaloId = null;
    console.log("⏹️ [Worker Limpieza] Recolector de reservas detenido.");
  }
}

module.exports = {
  expirarReservasVencidas,
  iniciarWorkerLimpieza,
  detenerWorkerLimpieza,
};
