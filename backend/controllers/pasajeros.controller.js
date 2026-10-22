/**
 * pasajeros.controller.js
 * Controlador de Gestión de Pasajeros (CARD-17).
 * Cumple con validación algorítmica de cédula ecuatoriana (Módulo 10),
 * esquema $jsonSchema de MongoDB Atlas e identificadores UUID v7.
 */

const { obtenerDB } = require("../database/connection");
const { generarUUIDv7 } = require("../database/uuid-helper");
const { validarCedulaEcuatoriana } = require("../utils/validador-cedula");

/**
 * POST /api/pasajeros
 * Registra o actualiza los datos de los pasajeros asociados a una o varias reservas.
 * Permite comprar pasajes para uno mismo o para terceros.
 * 
 * Body esperado:
 * {
 *   "pasajeros": [
 *     { "reserva_id": "uuid-reserva", "nombre": "Juan Pérez", "identificacion": "0704567890" }
 *   ]
 * }
 * O también formato individual:
 * { "reserva_id": "uuid", "nombre": "...", "identificacion": "..." }
 */
async function registrarPasajeros(req, res, next) {
  try {
    const usuarioId = req.usuario?.sub;
    if (!usuarioId) {
      return res.status(401).json({
        error: "No autenticado",
        mensaje: "Debe iniciar sesión para registrar los datos de los pasajeros",
      });
    }

    let listaPasajeros = [];
    if (Array.isArray(req.body.pasajeros)) {
      listaPasajeros = req.body.pasajeros;
    } else if (req.body.reserva_id && req.body.nombre && req.body.identificacion) {
      listaPasajeros = [
        {
          reserva_id: req.body.reserva_id,
          nombre: req.body.nombre,
          identificacion: req.body.identificacion,
        },
      ];
    } else {
      return res.status(400).json({
        error: "Datos incompletos",
        mensaje: "Debe proporcionar al menos un pasajero con reserva_id, nombre e identificacion",
      });
    }

    if (listaPasajeros.length === 0) {
      return res.status(400).json({
        error: "Lista vacía",
        mensaje: "No se proporcionaron pasajeros a registrar",
      });
    }

    // 1. Validar cada pasajero (nombre y cédula ecuatoriana Módulo 10)
    for (let i = 0; i < listaPasajeros.length; i++) {
      const p = listaPasajeros[i];
      if (!p.reserva_id || typeof p.reserva_id !== "string") {
        return res.status(400).json({
          error: "Reserva requerida",
          mensaje: `El pasajero #${i + 1} debe especificar un reserva_id válido`,
        });
      }

      if (!p.nombre || typeof p.nombre !== "string" || p.nombre.trim().length < 3) {
        return res.status(400).json({
          error: "Nombre inválido",
          mensaje: `El nombre del pasajero #${i + 1} debe tener al menos 3 caracteres`,
        });
      }

      const validacionCedula = validarCedulaEcuatoriana(p.identificacion);
      if (!validacionCedula.esValida) {
        return res.status(400).json({
          error: "Cédula inválida",
          mensaje: `Pasajero #${i + 1} (${p.nombre}): ${validacionCedula.mensaje}`,
        });
      }
    }

    const db = obtenerDB();
    const reservasIds = listaPasajeros.map((p) => p.reserva_id);

    // 2. Verificar que las reservas existan y correspondan al usuario (o admin)
    const reservas = await db.collection("reservas").find({
      _id: { $in: reservasIds },
    }).toArray();

    if (reservas.length !== reservasIds.length) {
      return res.status(404).json({
        error: "Reserva no encontrada",
        mensaje: "Una o más reservas especificadas no existen en el sistema",
      });
    }

    const esAdmin = Array.isArray(req.usuario?.roles) && req.usuario.roles.includes("administrador");
    for (const r of reservas) {
      if (!esAdmin && r.usuario_id !== usuarioId) {
        return res.status(403).json({
          error: "Acceso no autorizado",
          mensaje: `No tiene autorización para modificar la reserva ${r._id}`,
        });
      }

      if (!["reservada", "pendiente_verificacion"].includes(r.estado)) {
        return res.status(400).json({
          error: "Estado no válido",
          mensaje: `La reserva ${r._id} se encuentra en estado '${r.estado}' y no permite asignar pasajeros`,
        });
      }
    }

    // 3. Registrar o actualizar pasajeros en la colección 'pasajeros'
    const resultados = [];
    for (const p of listaPasajeros) {
      const pasajeroDoc = {
        reserva_id: p.reserva_id,
        nombre: p.nombre.trim(),
        identificacion: String(p.identificacion).trim(),
        estado: "activo",
      };

      // Si ya existe un pasajero para esa reserva, actualizarlo (índice único en reserva_id)
      const existente = await db.collection("pasajeros").findOne({ reserva_id: p.reserva_id });
      if (existente) {
        await db.collection("pasajeros").updateOne(
          { _id: existente._id },
          { $set: pasajeroDoc }
        );
        resultados.push({ ...pasajeroDoc, _id: existente._id, accion: "actualizado" });
      } else {
        const nuevoId = generarUUIDv7();
        const nuevoDoc = { _id: nuevoId, ...pasajeroDoc };
        await db.collection("pasajeros").insertOne(nuevoDoc);
        resultados.push({ ...nuevoDoc, accion: "creado" });
      }
    }

    return res.status(201).json({
      mensaje: "Pasajeros registrados correctamente",
      pasajeros: resultados,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/pasajeros/reserva/:reserva_id
 * Obtiene el pasajero asociado a una reserva específica
 */
async function obtenerPasajeroPorReserva(req, res, next) {
  try {
    const { reserva_id } = req.params;
    if (!reserva_id) {
      return res.status(400).json({ error: "Parámetro requerido", mensaje: "Debe indicar el reserva_id" });
    }

    const db = obtenerDB();
    const pasajero = await db.collection("pasajeros").findOne({ reserva_id, estado: "activo" });

    if (!pasajero) {
      return res.status(404).json({
        error: "No encontrado",
        mensaje: "No hay ningún pasajero registrado para esta reserva",
      });
    }

    return res.status(200).json({ pasajero });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  registrarPasajeros,
  obtenerPasajeroPorReserva,
};
