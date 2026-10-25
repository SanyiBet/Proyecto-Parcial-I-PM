/**
 * viajes.controller.js
 * Controlador de Rutas, Buses y Programación de Viajes (CARD-13).
 * Compatible al 100% con los tipos BSON e índices $jsonSchema de MongoDB Atlas.
 */

const { Int32, Double } = require("mongodb");
const { obtenerDB } = require("../database/connection");
const { generarUUIDv7 } = require("../database/uuid-helper");
const {
  obtenerViajesCache,
  cachearViajes,
  obtenerAsientosBloqueados,
} = require("../database/redis");
const { escapeRegex } = require("../utils/sanitizer");

/**
 * Sembrador de datos iniciales en MongoDB Atlas
 */
async function sembrarDatosInicialesSiVacio(db) {
  const conteoRutas = await db.collection("rutas").countDocuments();
  if (conteoRutas === 0) {
    const rutasIniciales = [
      { _id: generarUUIDv7(), origen: "Machala", destino: "Guayaquil", duracion_minutos: new Int32(180), estado: "activo" },
      { _id: generarUUIDv7(), origen: "Guayaquil", destino: "Machala", duracion_minutos: new Int32(180), estado: "activo" },
      { _id: generarUUIDv7(), origen: "Machala", destino: "Cuenca", duracion_minutos: new Int32(210), estado: "activo" },
      { _id: generarUUIDv7(), origen: "Cuenca", destino: "Machala", duracion_minutos: new Int32(210), estado: "activo" },
      { _id: generarUUIDv7(), origen: "Machala", destino: "Quito", duracion_minutos: new Int32(540), estado: "activo" },
      { _id: generarUUIDv7(), origen: "Quito", destino: "Machala", duracion_minutos: new Int32(540), estado: "activo" },
      { _id: generarUUIDv7(), origen: "Machala", destino: "Loja", duracion_minutos: new Int32(240), estado: "activo" },
      { _id: generarUUIDv7(), origen: "Loja", destino: "Machala", duracion_minutos: new Int32(240), estado: "activo" },
    ];
    await db.collection("rutas").insertMany(rutasIniciales);
  }

  const conteoBuses = await db.collection("buses").countDocuments();
  if (conteoBuses === 0) {
    // Generar matriz de 40 asientos: 10 filas x 4 columnas
    const asientos = [];
    let num = 1;
    for (let f = 1; f <= 10; f++) {
      for (let c = 1; c <= 4; c++) {
        asientos.push({
          numero: String(num),
          fila: new Int32(f),
          columna: new Int32(c),
        });
        num++;
      }
    }

    const busesIniciales = [
      {
        _id: generarUUIDv7(),
        placa: "OBA-2451",
        descripcion: "Unidad #12 - TransOrense Ejecutivo Doble Piso",
        capacidad: new Int32(40),
        distribucion_asientos: asientos,
        estado: "activo",
      },
      {
        _id: generarUUIDv7(),
        placa: "OBA-3982",
        descripcion: "Unidad #25 - TransOrense Suite",
        capacidad: new Int32(40),
        distribucion_asientos: asientos,
        estado: "activo",
      },
    ];
    await db.collection("buses").insertMany(busesIniciales);
  }

  const conteoViajes = await db.collection("viajes").countDocuments();
  if (conteoViajes === 0) {
    const rutaMachalaGye = await db.collection("rutas").findOne({ origen: "Machala", destino: "Guayaquil" });
    const bus12 = await db.collection("buses").findOne({ placa: "OBA-2451" });

    if (rutaMachalaGye && bus12) {
      const hoy = new Date();
      const viajesDemo = [
        {
          _id: generarUUIDv7(),
          ruta_id: rutaMachalaGye._id,
          bus_id: bus12._id,
          salida: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 8, 30),
          llegada_estimada: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 11, 30),
          precio: new Double(8.50),
          estado: "programado",
        },
        {
          _id: generarUUIDv7(),
          ruta_id: rutaMachalaGye._id,
          bus_id: bus12._id,
          salida: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 14, 0),
          llegada_estimada: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 17, 0),
          precio: new Double(8.50),
          estado: "programado",
        },
        {
          _id: generarUUIDv7(),
          ruta_id: rutaMachalaGye._id,
          bus_id: bus12._id,
          salida: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1, 9, 0),
          llegada_estimada: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1, 12, 0),
          precio: new Double(8.50),
          estado: "programado",
        },
      ];
      await db.collection("viajes").insertMany(viajesDemo);
    }
  }
}

/**
 * GET /api/viajes/rutas
 */
async function obtenerRutas(req, res, next) {
  try {
    const db = obtenerDB();
    await sembrarDatosInicialesSiVacio(db);
    const rutas = await db.collection("rutas").find({ estado: "activo" }).toArray();
    return res.status(200).json({ rutas });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/viajes/buses
 */
async function obtenerBuses(req, res, next) {
  try {
    const db = obtenerDB();
    await sembrarDatosInicialesSiVacio(db);
    const buses = await db.collection("buses").find({ estado: "activo" }).toArray();
    return res.status(200).json({ buses });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/viajes/buscar
 */
async function buscarViajes(req, res, next) {
  try {
    const { origen, destino, fecha } = req.query;

    if (!origen || !destino) {
      return res.status(400).json({
        error: "Parámetros requeridos",
        mensaje: "Debe especificar origen y destino",
      });
    }

    const db = obtenerDB();
    await sembrarDatosInicialesSiVacio(db);

    const fechaFiltro = fecha || new Date().toISOString().split("T")[0];

    // Consulta con agregación en MongoDB Atlas
    const pipeline = [
      {
        $lookup: {
          from: "rutas",
          localField: "ruta_id",
          foreignField: "_id",
          as: "ruta",
        },
      },
      { $unwind: "$ruta" },
      {
        $lookup: {
          from: "buses",
          localField: "bus_id",
          foreignField: "_id",
          as: "bus",
        },
      },
      { $unwind: "$bus" },
      {
        $match: {
          "ruta.origen": { $regex: new RegExp(`^${escapeRegex(origen)}$`, "i") },
          "ruta.destino": { $regex: new RegExp(`^${escapeRegex(destino)}$`, "i") },
          estado: "programado",
        },
      },
      {
        $project: {
          _id: 1,
          salida: 1,
          llegada_estimada: 1,
          precio: 1,
          estado: 1,
          ruta: {
            _id: "$ruta._id",
            origen: "$ruta.origen",
            destino: "$ruta.destino",
            duracion_minutos: "$ruta.duracion_minutos",
          },
          bus: {
            _id: "$bus._id",
            placa: "$bus.placa",
            descripcion: "$bus.descripcion",
            capacidad: "$bus.capacidad",
          },
        },
      },
      { $sort: { salida: 1 } },
    ];

    const viajes = await db.collection("viajes").aggregate(pipeline).toArray();

    // Cruzar disponibilidad en tiempo real con Redis y Atlas
    for (const v of viajes) {
      try {
        const bloqueos = await obtenerAsientosBloqueados(v._id);
        const ahora = new Date();
        const asientosOcupadosAtlas = await db.collection("reservas").countDocuments({
          viaje_id: v._id,
          $or: [
            { estado: { $in: ["pendiente_verificacion", "confirmada"] } },
            { estado: "reservada", vence_en: { $gt: ahora } },
          ],
        });

        const totalBloqueados = (bloqueos?.length || 0) + asientosOcupadosAtlas;
        v.asientos_disponibles = Math.max(0, v.bus.capacidad - totalBloqueados);
      } catch (err) {
        v.asientos_disponibles = v.bus.capacidad;
      }
    }

    return res.status(200).json({
      origen,
      destino,
      fecha: fechaFiltro,
      viajes,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/viajes/:id/asientos
 */
async function obtenerMapaAsientos(req, res, next) {
  try {
    const { id } = req.params;
    const db = obtenerDB();

    const viaje = await db.collection("viajes").findOne({ _id: id });
    if (!viaje) {
      return res.status(404).json({ error: "Viaje no encontrado" });
    }

    const [bus, ruta] = await Promise.all([
      db.collection("buses").findOne({ _id: viaje.bus_id }),
      db.collection("rutas").findOne({ _id: viaje.ruta_id }),
    ]);

    // 1. Asientos activos en Atlas (CARD-29: ignorar reservas temporales expiradas)
    const ahora = new Date();
    const reservasAtlas = await db
      .collection("reservas")
      .find({
        viaje_id: id,
        $or: [
          { estado: { $in: ["pendiente_verificacion", "confirmada"] } },
          { estado: "reservada", vence_en: { $gt: ahora } },
        ],
      })
      .toArray();

    const asientosOcupadosAtlas = new Set(reservasAtlas.map((r) => String(r.asiento_numero)));

    // 2. Asientos con bloqueo temporal en Upstash Redis (TTL)
    const bloqueosRedis = await obtenerAsientosBloqueados(id);
    const mapaBloqueos = new Map();
    bloqueosRedis.forEach((b) => {
      mapaBloqueos.set(String(b.asiento_numero), b.info);
    });

    // 3. Matriz de asientos
    const asientos = (bus.distribucion_asientos || []).map((asiento) => {
      const numStr = String(asiento.numero);
      let estado = "disponible";
      let venceEn = null;

      if (asientosOcupadosAtlas.has(numStr)) {
        estado = "ocupado";
      } else if (mapaBloqueos.has(numStr)) {
        estado = "bloqueado_temporal";
        venceEn = mapaBloqueos.get(numStr)?.vence_en || null;
      }

      return {
        numero: numStr,
        fila: asiento.fila,
        columna: asiento.columna,
        tipo: asiento.columna === 1 || asiento.columna === 4 ? "ventana" : "pasillo",
        estado,
        vence_en: venceEn,
        precio: viaje.precio,
      };
    });

    return res.status(200).json({
      viaje_id: viaje._id,
      precio_base: viaje.precio,
      salida: viaje.salida,
      llegada_estimada: viaje.llegada_estimada,
      ruta: { origen: ruta.origen, destino: ruta.destino, duracion_minutos: ruta.duracion_minutos },
      bus: { placa: bus.placa, descripcion: bus.descripcion, capacidad: bus.capacidad },
      asientos,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  obtenerRutas,
  obtenerBuses,
  buscarViajes,
  obtenerMapaAsientos,
};
