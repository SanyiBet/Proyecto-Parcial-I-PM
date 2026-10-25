/**
 * pagos.controller.js
 * Controlador de Pagos y Comprobantes Bancarios (CARD-17 y CARD-19).
 * Maneja almacenamiento local seguro de comprobantes, registro en MongoDB Atlas
 * y transición de reservas al estado 'pendiente_verificacion'.
 */

const fs = require("fs");
const path = require("path");
const { Double } = require("mongodb");
const { obtenerDB } = require("../database/connection");
const { generarUUIDv7 } = require("../database/uuid-helper");

// Directorio seguro de comprobantes en almacenamiento local
const RUTA_UPLOADS = path.join(__dirname, "..", "uploads", "comprobantes");
if (!fs.existsSync(RUTA_UPLOADS)) {
  fs.mkdirSync(RUTA_UPLOADS, { recursive: true });
}

/**
 * Guarda una imagen o PDF en base64 en el almacenamiento local seguro
 * @param {string} base64Data
 * @param {string} nombreOriginal
 * @returns {string} URL relativa del comprobante guardado
 */
function guardarComprobanteEnDisco(base64Data, nombreOriginal = "comprobante.jpg") {
  let cleanBase64 = base64Data;
  let extension = ".jpg";

  // Detección de Data URI (ej: data:image/png;base64,...)
  const match = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (match) {
    const mime = match[1];
    cleanBase64 = match[2];
    if (mime.includes("png")) extension = ".png";
    else if (mime.includes("pdf")) extension = ".pdf";
    else if (mime.includes("webp")) extension = ".webp";
    else if (mime.includes("jpeg") || mime.includes("jpg")) extension = ".jpg";
  } else {
    const extMatch = path.extname(nombreOriginal);
    if (extMatch) extension = extMatch.toLowerCase();
  }

  const nombreArchivo = `comprobante-${generarUUIDv7()}${extension}`;
  const rutaCompleta = path.join(RUTA_UPLOADS, nombreArchivo);

  const buffer = Buffer.from(cleanBase64, "base64");
  fs.writeFileSync(rutaCompleta, buffer);

  return `/uploads/comprobantes/${nombreArchivo}`;
}

/**
 * POST /api/pagos
 * Registra un comprobante de pago bancario (transferencia/depósito).
 * Pone la reserva en estado 'pendiente_verificacion'.
 */
async function registrarPago(req, res, next) {
  try {
    const usuarioId = req.usuario?.sub;
    if (!usuarioId) {
      return res.status(401).json({
        error: "No autenticado",
        mensaje: "Debe iniciar sesión para registrar el pago",
      });
    }

    const {
      reserva_id,
      reservas_ids,
      metodo = "transferencia",
      referencia,
      comprobante_base64,
      comprobante_nombre = "comprobante.jpg",
      importe,
    } = req.body;

    // Acepta reserva_id único o array reservas_ids
    const idsObjetivo = Array.isArray(reservas_ids) && reservas_ids.length > 0
      ? reservas_ids
      : reserva_id ? [reserva_id] : [];

    if (idsObjetivo.length === 0) {
      return res.status(400).json({
        error: "Reserva requerida",
        mensaje: "Debe especificar la reserva (reserva_id o reservas_ids) a pagar",
      });
    }

    if (!referencia || typeof referencia !== "string" || referencia.trim().length < 3) {
      return res.status(400).json({
        error: "Referencia bancaria requerida",
        mensaje: "Debe ingresar el número de comprobante o referencia bancaria (mínimo 3 caracteres)",
      });
    }

    const db = obtenerDB();

    // 1. Verificar existencia y pertenencia de las reservas
    const reservas = await db.collection("reservas").find({
      _id: { $in: idsObjetivo },
    }).toArray();

    if (reservas.length !== idsObjetivo.length) {
      return res.status(404).json({
        error: "Reserva no encontrada",
        mensaje: "Una o más reservas especificadas no existen",
      });
    }

    const esAdmin = Array.isArray(req.usuario?.roles) && req.usuario.roles.includes("administrador");
    for (const r of reservas) {
      if (!esAdmin && r.usuario_id !== usuarioId) {
        return res.status(403).json({
          error: "Acceso denegado",
          mensaje: `No está autorizado para pagar la reserva ${r._id}`,
        });
      }

      if (r.estado === "confirmada") {
        return res.status(400).json({
          error: "Reserva ya pagada",
          mensaje: `La reserva ${r._id} ya fue confirmada previamente`,
        });
      }

      if (r.estado === "cancelada" || r.estado === "expirada") {
        return res.status(400).json({
          error: "Reserva no disponible",
          mensaje: `La reserva ${r._id} se encuentra en estado '${r.estado}' y no puede ser pagada`,
        });
      }
    }

    // 2. Procesar y guardar el comprobante si se adjuntó
    let comprobanteUrl = null;
    if (comprobante_base64) {
      comprobanteUrl = guardarComprobanteEnDisco(comprobante_base64, comprobante_nombre);
    }

    // 3. Calcular importe total si no viene explícito
    const totalCalculado = reservas.reduce((acc, r) => acc + (typeof r.precio_final === "object" ? r.precio_final.valueOf() : Number(r.precio_final || 0)), 0);
    const montoFinal = Number(importe || totalCalculado || 0);

    if (montoFinal <= 0) {
      return res.status(400).json({
        error: "Importe inválido",
        mensaje: "El monto del pago debe ser mayor a 0",
      });
    }

    // 4. Crear documento en la colección 'pagos'
    const ahora = new Date();
    const nuevoPago = {
      _id: generarUUIDv7(),
      reserva_id: idsObjetivo[0], // ID de reserva representativa
      reservas_asociadas: idsObjetivo,
      metodo: String(metodo),
      referencia: String(referencia).trim(),
      comprobante_url: comprobanteUrl,
      importe: new Double(montoFinal),
      estado: "en_revision", // Pendiente de revisión por boletería
      verificado_por: null,
      creado_en: ahora,
      verificado_en: null,
    };

    await db.collection("pagos").insertOne(nuevoPago);

    // 5. Actualizar el estado de las reservas a 'pendiente_verificacion'
    await db.collection("reservas").updateMany(
      { _id: { $in: idsObjetivo } },
      {
        $set: {
          estado: "pendiente_verificacion",
          actualizada_en: ahora,
        },
      }
    );

    return res.status(201).json({
      mensaje: "Comprobante de pago registrado exitosamente. Su reserva está ahora en revisión por boletería.",
      pago: {
        id: nuevoPago._id,
        reserva_id: nuevoPago.reserva_id,
        reservas_afectadas: idsObjetivo.length,
        metodo: nuevoPago.metodo,
        referencia: nuevoPago.referencia,
        comprobante_url: nuevoPago.comprobante_url,
        importe: montoFinal,
        estado: nuevoPago.estado,
        creado_en: nuevoPago.creado_en,
      },
      estado_reserva: "pendiente_verificacion",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/pagos/reserva/:reserva_id
 * Obtiene el registro de pago asociado a una reserva
 */
async function obtenerPagoPorReserva(req, res, next) {
  try {
    const { reserva_id } = req.params;
    const db = obtenerDB();

    const pago = await db.collection("pagos").findOne({
      $or: [{ reserva_id }, { reservas_asociadas: reserva_id }],
    });

    if (!pago) {
      return res.status(404).json({
        error: "Pago no encontrado",
        mensaje: "No hay ningún comprobante de pago registrado para esta reserva",
      });
    }

    return res.status(200).json({ pago });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/pagos/pendientes
 * Lista todos los pagos en estado 'en_revision' para el panel de Agente de Boletería (CARD-19)
 */
async function listarPagosPendientes(req, res, next) {
  try {
    const db = obtenerDB();
    const pagosPendientes = await db.collection("pagos")
      .find({ estado: { $in: ["pendiente", "en_revision"] } })
      .sort({ creado_en: 1 })
      .toArray();

    // Enriquecer con datos de los pasajeros y de los viajes
    const resultado = [];
    for (const p of pagosPendientes) {
      const reserva = await db.collection("reservas").findOne({ _id: p.reserva_id });
      let pasajero = null;
      let viaje = null;

      if (reserva) {
        pasajero = await db.collection("pasajeros").findOne({ reserva_id: reserva._id });
        viaje = await db.collection("viajes").findOne({ _id: reserva.viaje_id });
      }

      resultado.push({
        ...p,
        reserva_detalle: reserva,
        pasajero_detalle: pasajero,
        viaje_detalle: viaje,
      });
    }

    return res.status(200).json({ pagos: resultado });
  } catch (error) {
    next(error);
  }
}

const { liberarAsiento } = require("../database/redis");

/**
 * POST /api/pagos/:id/aprobar
 * Aprueba el pago bancario, confirmando definitivamente la reserva y liberando el boleto.
 * Protegido para rol 'agente_boleteria' o 'administrador' (CARD-19).
 */
async function aprobarPago(req, res, next) {
  try {
    const { id } = req.params;
    const db = obtenerDB();
    const ahora = new Date();
    const agenteId = req.usuario?.sub || "sistema";

    const pago = await db.collection("pagos").findOne({ _id: id });
    if (!pago) {
      return res.status(404).json({ error: "Pago no encontrado", mensaje: `No existe el pago con ID ${id}` });
    }

    if (pago.estado === "aprobado") {
      return res.status(400).json({ error: "Pago ya aprobado", mensaje: "Este pago ya fue aprobado previamente." });
    }

    // 1. Actualizar el pago a 'aprobado'
    await db.collection("pagos").updateOne(
      { _id: id },
      {
        $set: {
          estado: "aprobado",
          verificado_por: agenteId,
          verificado_en: ahora,
        },
      }
    );

    // 2. Identificar todas las reservas afectadas
    const idsReservas = Array.isArray(pago.reservas_asociadas) && pago.reservas_asociadas.length > 0
      ? pago.reservas_asociadas
      : [pago.reserva_id];

    // 3. Confirmar definitivamente las reservas en MongoDB Atlas
    await db.collection("reservas").updateMany(
      { _id: { $in: idsReservas } },
      {
        $set: {
          estado: "confirmada",
          actualizada_en: ahora,
        },
      }
    );

    return res.status(200).json({
      mensaje: "Pago aprobado exitosamente. Reserva y pasajes confirmados de manera definitiva.",
      pago_id: id,
      estado: "aprobado",
      reservas_confirmadas: idsReservas,
      verificado_en: ahora,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/pagos/:id/rechazar
 * Rechaza el pago bancario, cancela la reserva y libera los asientos en Redis.
 * Protegido para rol 'agente_boleteria' o 'administrador' (CARD-19).
 */
async function rechazarPago(req, res, next) {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const db = obtenerDB();
    const ahora = new Date();
    const agenteId = req.usuario?.sub || "sistema";

    const pago = await db.collection("pagos").findOne({ _id: id });
    if (!pago) {
      return res.status(404).json({ error: "Pago no encontrado", mensaje: `No existe el pago con ID ${id}` });
    }

    if (pago.estado === "rechazado") {
      return res.status(400).json({ error: "Pago ya rechazado", mensaje: "Este pago ya fue rechazado anteriormente." });
    }

    // 1. Actualizar el pago a 'rechazado' con motivo
    await db.collection("pagos").updateOne(
      { _id: id },
      {
        $set: {
          estado: "rechazado",
          motivo_rechazo: motivo || "Comprobante bancario no coincide o valor incompleto.",
          verificado_por: agenteId,
          verificado_en: ahora,
        },
      }
    );

    // 2. Identificar las reservas para cancelarlas y liberar asientos
    const idsReservas = Array.isArray(pago.reservas_asociadas) && pago.reservas_asociadas.length > 0
      ? pago.reservas_asociadas
      : [pago.reserva_id];

    const reservas = await db.collection("reservas").find({ _id: { $in: idsReservas } }).toArray();

    // 3. Cancelar reservas en MongoDB
    await db.collection("reservas").updateMany(
      { _id: { $in: idsReservas } },
      {
        $set: {
          estado: "cancelada",
          actualizada_en: ahora,
        },
      }
    );

    // 4. Liberar bloqueo en Redis si estaba reservado
    for (const r of reservas) {
      if (r.viaje_id && r.asiento_numero) {
        try {
          await liberarAsiento(r.viaje_id, r.asiento_numero);
        } catch (e) {
          console.warn("Aviso al liberar asiento en Redis:", e.message);
        }
      }
    }

    return res.status(200).json({
      mensaje: "Pago rechazado exitosamente. Reservas canceladas y asientos liberados.",
      pago_id: id,
      estado: "rechazado",
      motivo_rechazo: motivo || "Comprobante no válido",
      verificado_en: ahora,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/pagos/mis-pagos
 * Obtiene todos los comprobantes y pagos asociados al cliente en sesión
 */
async function obtenerMisPagos(req, res, next) {
  try {
    const usuarioId = req.usuario?.sub;
    if (!usuarioId) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const db = obtenerDB();
    const reservasUsuario = await db
      .collection("reservas")
      .find({ usuario_id: usuarioId })
      .project({ _id: 1 })
      .toArray();

    const idsReservas = reservasUsuario.map((r) => r._id);

    const pagos = await db
      .collection("pagos")
      .find({
        $or: [
          { reserva_id: { $in: idsReservas } },
          { reservas_asociadas: { $in: idsReservas } },
        ],
      })
      .sort({ creado_en: -1 })
      .toArray();

    return res.status(200).json({ pagos });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  registrarPago,
  obtenerPagoPorReserva,
  listarPagosPendientes,
  aprobarPago,
  rechazarPago,
  obtenerMisPagos,
};

