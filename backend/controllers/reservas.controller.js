/**
 * reservas.controller.js
 * Controlador Transaccional de Reservas Temporales de Asientos (CARD-14).
 * Cumple con validación estricta $jsonSchema e índice único uq_asiento_reserva_activa en Atlas.
 */

const { Double } = require("mongodb");
const { obtenerDB } = require("../database/connection");
const { generarUUIDv7 } = require("../database/uuid-helper");
const {
  bloquearAsiento,
  liberarAsiento,
} = require("../database/redis");

const TTL_RESERVA_SEGUNDOS = 600; // 10 minutos de reserva temporal

/**
 * POST /api/reservas
 * Crea una reserva de 1 o más asientos con bloqueo concurrente
 */
async function crearReservaTemporal(req, res, next) {
  const usuarioId = req.usuario?.sub;
  if (!usuarioId) {
    return res.status(401).json({ error: "No autenticado", mensaje: "Debe iniciar sesión para reservar asientos" });
  }

  const { viaje_id, asientos } = req.body;

  if (!viaje_id || !Array.isArray(asientos) || asientos.length === 0) {
    return res.status(400).json({
      error: "Datos requeridos",
      mensaje: "Debe seleccionar un viaje y al menos un número de asiento",
    });
  }

  const asientosStrings = asientos.map((a) => String(a));
  const db = obtenerDB();

  try {
    const viaje = await db.collection("viajes").findOne({ _id: viaje_id, estado: "programado" });
    if (!viaje) {
      return res.status(404).json({
        error: "Viaje no disponible",
        mensaje: "El viaje seleccionado no existe o no está activo",
      });
    }

    // 1. Verificar si están ocupados en Atlas
    const ocupadosAtlas = await db.collection("reservas").find({
      viaje_id,
      asiento_numero: { $in: asientosStrings },
      estado: { $in: ["reservada", "pendiente_verificacion", "confirmada"] },
    }).toArray();

    if (ocupadosAtlas.length > 0) {
      return res.status(409).json({
        error: "Asiento ocupado",
        mensaje: `El asiento #${ocupadosAtlas[0].asiento_numero} ya se encuentra reservado`,
      });
    }

    // 2. Bloqueo atómico en Upstash Redis (NX: Atomic Set-if-Not-Exists)
    const bloqueadosRedis = [];
    for (const asientoStr of asientosStrings) {
      const exito = await bloquearAsiento(viaje_id, asientoStr, usuarioId, TTL_RESERVA_SEGUNDOS);
      if (!exito) {
        // Rollback atómico
        for (const reversar of bloqueadosRedis) {
          await liberarAsiento(viaje_id, reversar);
        }
        return res.status(409).json({
          error: "Conflicto de concurrencia",
          mensaje: `El asiento #${asientoStr} acaba de ser reservado por otro usuario. Por favor elija otro.`,
        });
      }
      bloqueadosRedis.push(asientoStr);
    }

    // 3. Crear documentos en Atlas cumpliendo $jsonSchema (1 documento por asiento reservado)
    const ahora = new Date();
    const venceEn = new Date(ahora.getTime() + TTL_RESERVA_SEGUNDOS * 1000);

    const documentosReserva = asientosStrings.map((numStr) => ({
      _id: generarUUIDv7(),
      usuario_id: usuarioId,
      viaje_id: viaje_id,
      bus_id: viaje.bus_id,
      asiento_numero: numStr,
      precio_final: new Double(viaje.precio),
      estado: "reservada",
      creada_en: ahora,
      vence_en: venceEn,
      actualizada_en: ahora,
    }));

    await db.collection("reservas").insertMany(documentosReserva);

    return res.status(201).json({
      mensaje: "Asientos reservados temporalmente con éxito",
      viaje_id,
      asientos: asientosStrings,
      total: Number((viaje.precio * asientosStrings.length).toFixed(2)),
      tiempo_limite_segundos: TTL_RESERVA_SEGUNDOS,
      vence_en: venceEn.toISOString(),
      reservas_ids: documentosReserva.map((r) => r._id),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/reservas/activa
 */
async function obtenerReservaActiva(req, res, next) {
  try {
    const usuarioId = req.usuario?.sub;
    if (!usuarioId) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const db = obtenerDB();
    const ahora = new Date();

    const reservas = await db.collection("reservas").find({
      usuario_id: usuarioId,
      estado: "reservada",
      vence_en: { $gt: ahora },
    }).toArray();

    if (reservas.length === 0) {
      return res.status(200).json({ reserva: null });
    }

    const primera = reservas[0];
    const segundosRestantes = Math.max(0, Math.floor((new Date(primera.vence_en).getTime() - Date.now()) / 1000));

    return res.status(200).json({
      reserva: {
        viaje_id: primera.viaje_id,
        asientos: reservas.map((r) => r.asiento_numero),
        total: Number(reservas.reduce((acc, r) => acc + (r.precio_final || 0), 0).toFixed(2)),
        vence_en: primera.vence_en,
      },
      segundos_restantes: segundosRestantes,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/reservas/cancelar
 */
async function cancelarReserva(req, res, next) {
  try {
    const usuarioId = req.usuario?.sub;
    const { viaje_id, asientos } = req.body;
    const db = obtenerDB();

    if (Array.isArray(asientos)) {
      for (const a of asientos) {
        await liberarAsiento(viaje_id, String(a));
      }

      await db.collection("reservas").updateMany(
        { usuario_id: usuarioId, viaje_id, asiento_numero: { $in: asientos.map(String) }, estado: "reservada" },
        { $set: { estado: "cancelada", actualizada_en: new Date() } }
      );
    }

    return res.status(200).json({ mensaje: "Reserva cancelada con éxito" });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/reservas/mis-reservas
 * Devuelve el historial de reservas/boletos del cliente autenticado con datos del viaje, ruta y pago
 */
async function obtenerMisReservas(req, res, next) {
  try {
    const usuarioId = req.usuario?.sub;
    if (!usuarioId) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const db = obtenerDB();
    const reservas = await db
      .collection("reservas")
      .find({ usuario_id: usuarioId })
      .sort({ creada_en: -1 })
      .toArray();

    const resultado = [];
    for (const r of reservas) {
      const viaje = await db.collection("viajes").findOne({ _id: r.viaje_id });
      let ruta = null;
      let bus = null;
      if (viaje) {
        ruta = await db.collection("rutas").findOne({ _id: viaje.ruta_id });
        bus = await db.collection("buses").findOne({ _id: viaje.bus_id });
      }

      const pasajero = await db.collection("pasajeros").findOne({ reserva_id: r._id });
      const pago = await db.collection("pagos").findOne({
        $or: [{ reserva_id: r._id }, { reservas_asociadas: r._id }],
      });

      resultado.push({
        _id: r._id,
        asiento_numero: r.asiento_numero,
        precio_final: Number(r.precio_final || 0),
        estado: r.estado,
        creada_en: r.creada_en,
        vence_en: r.vence_en,
        viaje: viaje
          ? {
              _id: viaje._id,
              salida: viaje.salida,
              llegada_estimada: viaje.llegada_estimada,
              ruta: ruta ? { origen: ruta.origen, destino: ruta.destino } : null,
              bus: bus ? { placa: bus.placa, descripcion: bus.descripcion } : null,
            }
          : null,
        pasajero: pasajero ? { nombre: pasajero.nombre, identificacion: pasajero.identificacion } : null,
        pago: pago
          ? {
              _id: pago._id,
              estado: pago.estado,
              referencia: pago.referencia,
              importe: Number(pago.importe || 0),
              comprobante_url: pago.comprobante_url,
              motivo_rechazo: pago.motivo_rechazo || null,
            }
          : null,
      });
    }

    return res.status(200).json({ reservas: resultado });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  crearReservaTemporal,
  obtenerReservaActiva,
  cancelarReserva,
  obtenerMisReservas,
};

