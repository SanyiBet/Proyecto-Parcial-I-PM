/**
 * admin.controller.js
 * Controlador de Gestión Administrativa y Dashboard Global (CARD-26).
 * Incluye KPIs gerenciales, gestión de rutas, buses y asignación de roles RBAC.
 */

const { Int32 } = require("mongodb");
const { obtenerDB } = require("../database/connection");
const { generarUUIDv7 } = require("../database/uuid-helper");
const { registrarAuditoria } = require("../services/auditoria.service");

/**
 * GET /api/admin/metricas
 * Retorna las métricas y KPIs globales para el dashboard gerencial
 */
async function obtenerMetricasDashboard(req, res, next) {
  try {
    const db = obtenerDB();

    // 1. Total ventas de pasajes (pagos aprobados)
    const pagosAprobados = await db.collection("pagos").find({ estado: "aprobado" }).toArray();
    const recaudacionPasajes = pagosAprobados.reduce((acc, p) => acc + Number(p.importe || 0), 0);

    // 2. Total ventas de encomiendas
    const encomiendas = await db.collection("encomiendas").find({}).toArray();
    const recaudacionEncomiendas = encomiendas.reduce((acc, e) => acc + Number(e.precio_final || 0), 0);

    // 3. Conteos de entidades
    const totalBoletosConfirmados = await db.collection("reservas").countDocuments({ estado: "confirmada" });
    const totalReservasPendientes = await db.collection("reservas").countDocuments({ estado: "pendiente_verificacion" });
    const totalViajesActivos = await db.collection("viajes").countDocuments({ estado: "programado" });
    const totalUsuariosRegistrados = await db.collection("usuarios").countDocuments({});
    const totalBusesActivos = await db.collection("buses").countDocuments({ estado: "activo" });
    const totalRutasActivas = await db.collection("rutas").countDocuments({ estado: "activo" });

    // 4. Últimos pagos recibidos para la vista de transacciones recientes
    const ultimosPagos = await db
      .collection("pagos")
      .find({})
      .sort({ creado_en: -1 })
      .limit(6)
      .toArray();

    return res.status(200).json({
      kpis: {
        recaudacion_total: Number((recaudacionPasajes + recaudacionEncomiendas).toFixed(2)),
        recaudacion_pasajes: Number(recaudacionPasajes.toFixed(2)),
        recaudacion_encomiendas: Number(recaudacionEncomiendas.toFixed(2)),
        boletos_confirmados: totalBoletosConfirmados,
        reservas_pendientes: totalReservasPendientes,
        viajes_activos: totalViajesActivos,
        usuarios_registrados: totalUsuariosRegistrados,
        buses_activos: totalBusesActivos,
        rutas_activas: totalRutasActivas,
        encomiendas_totales: encomiendas.length,
      },
      ultimos_pagos: ultimosPagos,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/usuarios
 * Lista los usuarios registrados con soporte de búsqueda
 */
async function listarUsuarios(req, res, next) {
  try {
    const { busqueda } = req.query;
    const db = obtenerDB();
    const filtro = {};

    if (busqueda && busqueda.trim()) {
      const q = busqueda.trim();
      filtro.$or = [
        { nombre: { $regex: q, $options: "i" } },
        { correo: { $regex: q, $options: "i" } },
        { cedula: { $regex: q, $options: "i" } },
      ];
    }

    const usuarios = await db
      .collection("usuarios")
      .find(filtro)
      .project({ contrasena_hash: 0 })
      .sort({ creado_en: -1 })
      .limit(100)
      .toArray();

    return res.status(200).json({ usuarios });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/admin/usuarios/:id/rol
 * Asigna o modifica los roles asignados a un usuario (RBAC)
 */
async function actualizarRolUsuario(req, res, next) {
  try {
    const { id } = req.params;
    const { roles } = req.body;
    const adminId = req.usuario?.sub || "sistema";

    const rolesValidos = [
      "administrador",
      "agente_boleteria",
      "operador_encomiendas",
      "cliente",
      "auditor_tecnico",
    ];

    if (!Array.isArray(roles) || roles.length === 0 || !roles.every((r) => rolesValidos.includes(r))) {
      return res.status(400).json({
        error: "Roles inválidos",
        mensaje: `Los roles deben pertenecer a: [${rolesValidos.join(", ")}]`,
      });
    }

    const db = obtenerDB();
    const usuario = await db.collection("usuarios").findOne({ _id: id });
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    await db.collection("usuarios").updateOne(
      { _id: id },
      { $set: { roles, actualizado_en: new Date() } }
    );

    await registrarAuditoria({
      usuarioId: adminId,
      accion: "CAMBIO_ROL_USUARIO",
      entidad: "usuarios",
      entidadId: id,
      detalle: { roles_anteriores: usuario.roles, nuevos_roles: roles },
      estado: "registrado",
    });

    return res.status(200).json({
      mensaje: `Roles del usuario ${usuario.nombre} actualizados con éxito.`,
      roles,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/admin/rutas
 * Crea una nueva ruta interprovincial
 */
async function crearRuta(req, res, next) {
  try {
    const { origen, destino, duracion_minutos } = req.body;
    const adminId = req.usuario?.sub || "sistema";

    if (!origen || !destino || !duracion_minutos) {
      return res.status(400).json({
        error: "Datos requeridos",
        mensaje: "Origen, destino y duración en minutos son obligatorios",
      });
    }

    const minutos = parseInt(duracion_minutos, 10);
    if (isNaN(minutos) || minutos < 10) {
      return res.status(400).json({
        error: "Duración inválida",
        mensaje: "La duración debe ser al menos de 10 minutos",
      });
    }

    const db = obtenerDB();
    const nuevaRutaId = generarUUIDv7();

    const nuevaRuta = {
      _id: nuevaRutaId,
      origen: String(origen).trim(),
      destino: String(destino).trim(),
      duracion_minutos: new Int32(minutos),
      estado: "activo",
    };

    await db.collection("rutas").insertOne(nuevaRuta);

    await registrarAuditoria({
      usuarioId: adminId,
      accion: "CREAR_RUTA",
      entidad: "rutas",
      entidadId: nuevaRutaId,
      detalle: { origen: nuevaRuta.origen, destino: nuevaRuta.destino, minutos },
      estado: "registrado",
    });

    return res.status(201).json({
      mensaje: "Ruta interprovincial creada con éxito",
      ruta: nuevaRuta,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/admin/rutas/:id/estado
 * Alterna el estado de una ruta entre activo e inactivo
 */
async function alternarEstadoRuta(req, res, next) {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!["activo", "inactivo"].includes(estado)) {
      return res.status(400).json({ error: "Estado no válido (debe ser activo o inactivo)" });
    }

    const db = obtenerDB();
    await db.collection("rutas").updateOne({ _id: id }, { $set: { estado } });

    return res.status(200).json({ mensaje: `Estado de la ruta actualizado a '${estado}'` });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/admin/buses
 * Registra una nueva unidad con matriz oficial de 40 asientos
 */
async function crearBus(req, res, next) {
  try {
    const { placa, descripcion, capacidad = 40 } = req.body;
    const adminId = req.usuario?.sub || "sistema";

    const placaRegex = /^[A-Z]{3}-[0-9]{3,4}$/;
    if (!placa || !placaRegex.test(placa.toUpperCase().trim())) {
      return res.status(400).json({
        error: "Placa inválida",
        mensaje: "El formato de placa debe ser ABC-123 o ABC-1234",
      });
    }

    const db = obtenerDB();
    const busExistente = await db.collection("buses").findOne({ placa: placa.toUpperCase().trim() });
    if (busExistente) {
      return res.status(409).json({ error: "Placa ya registrada", mensaje: "Ya existe un bus con esta placa" });
    }

    const cap = Math.max(10, parseInt(capacidad, 10) || 40);

    // Generar matriz de asientos (10 filas x 4 columnas)
    const asientos = [];
    let num = 1;
    for (let f = 1; f <= Math.ceil(cap / 4); f++) {
      for (let c = 1; c <= 4; c++) {
        if (num <= cap) {
          asientos.push({
            numero: String(num),
            fila: new Int32(f),
            columna: new Int32(c),
          });
          num++;
        }
      }
    }

    const nuevoBusId = generarUUIDv7();
    const nuevoBus = {
      _id: nuevoBusId,
      placa: placa.toUpperCase().trim(),
      descripcion: descripcion ? String(descripcion).trim() : `Unidad TransOrense - Placa ${placa}`,
      capacidad: new Int32(cap),
      distribucion_asientos: asientos,
      estado: "activo",
    };

    await db.collection("buses").insertOne(nuevoBus);

    await registrarAuditoria({
      usuarioId: adminId,
      accion: "CREAR_BUS",
      entidad: "buses",
      entidadId: nuevoBusId,
      detalle: { placa: nuevoBus.placa, capacidad: cap },
      estado: "registrado",
    });

    return res.status(201).json({
      mensaje: "Bus y matriz de asientos registrados con éxito",
      bus: nuevoBus,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  obtenerMetricasDashboard,
  listarUsuarios,
  actualizarRolUsuario,
  crearRuta,
  alternarEstadoRuta,
  crearBus,
};
