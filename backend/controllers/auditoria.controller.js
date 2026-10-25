/**
 * auditoria.controller.js
 * Controlador de Bitácoras de Auditoría y Gestión de Incidencias Técnicas.
 * Cumple con validaciones $jsonSchema de MongoDB Atlas e identificadores UUID v7.
 */

const { obtenerDB } = require("../database/connection");
const { generarUUIDv7 } = require("../database/uuid-helper");
const { registrarAuditoria } = require("../services/auditoria.service");

/**
 * GET /api/auditoria
 * Consulta el historial de logs de auditoría con filtros.
 * Protegido para administradores y auditores.
 */
async function listarAuditoria(req, res, next) {
  try {
    const { entidad, accion, usuario_id, estado, fecha_desde, fecha_hasta, limite = 100 } = req.query;
    const db = obtenerDB();
    const filtro = {};

    if (entidad && entidad.trim()) {
      filtro.entidad = entidad.trim().toLowerCase();
    }
    if (accion && accion.trim()) {
      filtro.accion = accion.trim().toUpperCase();
    }
    if (usuario_id && usuario_id.trim()) {
      filtro.usuario_id = usuario_id.trim();
    }
    if (estado && ["registrado", "anomalia"].includes(estado)) {
      filtro.estado = estado;
    }
    if (fecha_desde || fecha_hasta) {
      filtro.fecha = {};
      if (fecha_desde) filtro.fecha.$gte = new Date(fecha_desde);
      if (fecha_hasta) filtro.fecha.$lte = new Date(fecha_hasta);
    }

    const maxLimite = Math.min(Math.max(1, parseInt(limite, 10) || 50), 200);

    const auditorias = await db
      .collection("auditoria")
      .find(filtro)
      .sort({ fecha: -1 })
      .limit(maxLimite)
      .toArray();

    const total = await db.collection("auditoria").countDocuments(filtro);

    return res.status(200).json({
      total,
      limite: maxLimite,
      auditorias,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/incidencias
 * Reporta una nueva incidencia técnica o fallo del sistema.
 */
async function reportarIncidencia(req, res, next) {
  try {
    const usuarioId = req.usuario?.sub || "anonimo";
    const {
      titulo,
      descripcion,
      severidad = "media",
      referencia_github = null,
    } = req.body;

    if (!titulo || typeof titulo !== "string" || titulo.trim().length < 4) {
      return res.status(400).json({
        error: "Título inválido",
        mensaje: "El título de la incidencia debe tener al menos 4 caracteres",
      });
    }

    if (!descripcion || typeof descripcion !== "string" || descripcion.trim().length < 6) {
      return res.status(400).json({
        error: "Descripción requerida",
        mensaje: "Debe ingresar una descripción detallada del problema (mínimo 6 caracteres)",
      });
    }

    const severidadesValidas = ["baja", "media", "alta", "critica"];
    if (!severidadesValidas.includes(severidad)) {
      return res.status(400).json({
        error: "Severidad inválida",
        mensaje: `Severidades permitidas: [${severidadesValidas.join(", ")}]`,
      });
    }

    const db = obtenerDB();
    const ahora = new Date();
    const nuevaIncidenciaId = generarUUIDv7();

    const docIncidencia = {
      _id: nuevaIncidenciaId,
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      severidad,
      estado: "abierta",
      reportado_por: usuarioId,
      responsable: null,
      referencia_github: referencia_github ? String(referencia_github).trim() : null,
      creada_en: ahora,
    };

    await db.collection("incidencias").insertOne(docIncidencia);

    // Registro automático en auditoría
    await registrarAuditoria({
      usuarioId,
      accion: "CREAR_INCIDENCIA",
      entidad: "incidencias",
      entidadId: nuevaIncidenciaId,
      detalle: { titulo: docIncidencia.titulo, severidad },
      estado: severidad === "critica" ? "anomalia" : "registrado",
    });

    return res.status(201).json({
      mensaje: "Incidencia técnica reportada exitosamente",
      incidencia: docIncidencia,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/incidencias
 * Lista todas las incidencias técnicas con filtros de estado y severidad.
 */
async function listarIncidencias(req, res, next) {
  try {
    const { estado, severidad } = req.query;
    const db = obtenerDB();
    const filtro = {};

    if (estado && ["abierta", "en_revision", "resuelta", "cerrada"].includes(estado)) {
      filtro.estado = estado;
    }
    if (severidad && ["baja", "media", "alta", "critica"].includes(severidad)) {
      filtro.severidad = severidad;
    }

    const incidencias = await db
      .collection("incidencias")
      .find(filtro)
      .sort({ creada_en: -1 })
      .toArray();

    return res.status(200).json({
      total: incidencias.length,
      incidencias,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/incidencias/:id
 * Actualiza el estado, responsable o enlace GitHub de una incidencia.
 */
async function actualizarEstadoIncidencia(req, res, next) {
  try {
    const { id } = req.params;
    const { estado, responsable, referencia_github } = req.body;
    const db = obtenerDB();

    const actualizacion = {};
    if (estado) {
      if (!["abierta", "en_revision", "resuelta", "cerrada"].includes(estado)) {
        return res.status(400).json({ error: "Estado no válido" });
      }
      actualizacion.estado = estado;
    }
    if (responsable !== undefined) actualizacion.responsable = responsable;
    if (referencia_github !== undefined) actualizacion.referencia_github = referencia_github;

    if (Object.keys(actualizacion).length === 0) {
      return res.status(400).json({ error: "No se enviaron campos a actualizar" });
    }

    const resultado = await db.collection("incidencias").findOneAndUpdate(
      { _id: id },
      { $set: actualizacion },
      { returnDocument: "after" }
    );

    if (!resultado) {
      return res.status(404).json({ error: "Incidencia no encontrada" });
    }

    await registrarAuditoria({
      usuarioId: req.usuario?.sub || "sistema",
      accion: "ACTUALIZAR_INCIDENCIA",
      entidad: "incidencias",
      entidadId: id,
      detalle: actualizacion,
      estado: "registrado",
    });

    return res.status(200).json({
      mensaje: "Incidencia actualizada con éxito",
      incidencia: resultado,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listarAuditoria,
  reportarIncidencia,
  listarIncidencias,
  actualizarEstadoIncidencia,
};
