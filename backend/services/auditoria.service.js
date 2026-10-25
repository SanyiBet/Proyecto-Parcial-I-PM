/**
 * auditoria.service.js
 * Servicio de Auditoría y Bitácora Centralizada para TransOrense.
 * Cumple estrictamente con el esquema $jsonSchema de MongoDB Atlas.
 */

const { obtenerDB } = require("../database/connection");
const { generarUUIDv7 } = require("../database/uuid-helper");

/**
 * Registra un evento de auditoría en MongoDB Atlas
 *
 * @param {Object} params
 * @param {string} params.usuarioId - UUID v7 del usuario responsable (o 'sistema'/'anonimo')
 * @param {string} params.accion - Acción ejecutada (ej: 'CREAR_RESERVA', 'APROBAR_PAGO', 'LOGIN')
 * @param {string} params.entidad - Colección afectada (ej: 'reservas', 'pagos', 'usuarios')
 * @param {string} params.entidadId - UUID v7 del documento afectado
 * @param {Object} [params.detalle] - Información contextual adicional
 * @param {'registrado'|'anomalia'} [params.estado='registrado'] - Estado del evento
 * @returns {Promise<Object>} Documento de auditoría insertado
 */
async function registrarAuditoria({
  usuarioId = "sistema",
  accion,
  entidad,
  entidadId,
  detalle = {},
  estado = "registrado",
}) {
  try {
    const db = obtenerDB();
    const docAuditoria = {
      _id: generarUUIDv7(),
      usuario_id: String(usuarioId),
      accion: String(accion).toUpperCase().trim(),
      entidad: String(entidad).toLowerCase().trim(),
      entidad_id: String(entidadId),
      detalle: typeof detalle === "object" && detalle !== null ? detalle : {},
      estado: ["registrado", "anomalia"].includes(estado) ? estado : "registrado",
      fecha: new Date(),
    };

    await db.collection("auditoria").insertOne(docAuditoria);
    return docAuditoria;
  } catch (error) {
    console.error("⚠️ Fallo no bloqueante al registrar auditoría:", error.message);
    return null;
  }
}

module.exports = {
  registrarAuditoria,
};
