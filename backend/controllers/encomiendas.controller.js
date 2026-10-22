/**
 * encomiendas.controller.js
 * Controlador del Módulo de Encomiendas (CARD-20).
 * Incluye:
 * 1. Algoritmo de cálculo de tarifas interprovinciales por peso volumétrico y báscula.
 * 2. Cotización con registro temporal de 24 horas en MongoDB Atlas.
 * 3. Generador criptográfico de código de rastreo alfanumérico seguro y no secuencial.
 * 4. Registro transaccional de encomiendas con validación Módulo 10 de cédulas y primer hito en historial.
 */

const crypto = require("crypto");
const { Double } = require("mongodb");
const { obtenerDB } = require("../database/connection");
const { generarUUIDv7 } = require("../database/uuid-helper");
const { validarCedulaEcuatoriana } = require("../utils/validador-cedula");

// Factor volumétrico estándar para transporte terrestre (IATA / Courier interprovincial en cm³/kg)
const FACTOR_VOLUMETRICO = 5000;

// Estructura tarifaria oficial TransOrense
const TARIFA_BASE = 3.5; // Tarifa mínima inicial (cubre hasta 2 kg de peso facturable)
const KG_BASE_INCLUIDOS = 2.0;
const COSTO_POR_KG_ADICIONAL = 0.8; // Tarifa por cada kilogramo adicional

/**
 * Algoritmo oficial de cálculo tarifario de encomiendas
 * Calcula peso volumétrico: (largo x ancho x alto / 5000)
 * Determina peso facturable: max(peso_kg, peso_volumetrico)
 * Calcula precio final según tarifa base y adicionales.
 *
 * @param {Object} params
 * @param {number} params.peso_kg - Peso real en báscula (kilogramos)
 * @param {number} params.largo_cm - Largo del paquete en cm
 * @param {number} params.ancho_cm - Ancho del paquete en cm
 * @param {number} params.alto_cm - Alto del paquete en cm
 * @returns {Object} Desglose completo de tarifación
 */
function calcularTarifaEncomienda({ peso_kg, largo_cm, ancho_cm, alto_cm }) {
  const pReal = Math.max(0.01, parseFloat(peso_kg) || 0);
  const largo = Math.max(1, parseFloat(largo_cm) || 1);
  const ancho = Math.max(1, parseFloat(ancho_cm) || 1);
  const alto = Math.max(1, parseFloat(alto_cm) || 1);

  // 1. Cálculo de peso volumétrico: (largo x ancho x alto) / 5000
  const volumenCm3 = largo * ancho * alto;
  const pesoVolumetrico = Number((volumenCm3 / FACTOR_VOLUMETRICO).toFixed(2));

  // 2. Peso a facturar (el mayor entre báscula y volumétrico)
  const pesoFacturable = Number(Math.max(pReal, pesoVolumetrico).toFixed(2));

  // 3. Cálculo de tarifa: Base ($3.50) + adicional por exceso de 2 kg ($0.80/kg)
  let precio = TARIFA_BASE;
  let pesoAdicional = 0;
  if (pesoFacturable > KG_BASE_INCLUIDOS) {
    pesoAdicional = Number((pesoFacturable - KG_BASE_INCLUIDOS).toFixed(2));
    precio += pesoAdicional * COSTO_POR_KG_ADICIONAL;
  }

  const precioFinal = Number(precio.toFixed(2));

  return {
    peso_real_kg: pReal,
    dimensiones: {
      largo_cm: largo,
      ancho_cm: ancho,
      alto_cm: alto,
      volumen_cm3: volumenCm3,
    },
    factor_volumetrico: FACTOR_VOLUMETRICO,
    peso_volumetrico_kg: pesoVolumetrico,
    peso_facturable_kg: pesoFacturable,
    tarifa_base: TARIFA_BASE,
    kg_base_incluidos: KG_BASE_INCLUIDOS,
    peso_adicional_kg: pesoAdicional,
    costo_kg_adicional: COSTO_POR_KG_ADICIONAL,
    precio_estimado: precioFinal,
  };
}

/**
 * Genera un código de rastreo único, seguro, alfanumérico y no secuencial.
 * Prefijo 'TRO-' + 8 caracteres aleatorios en base32 segura (sin caracteres ambiguos 0, O, 1, I).
 * Ejemplo: 'TRO-7K8M9X2P' (12 caracteres en total, cumple minLength: 8 del $jsonSchema).
 *
 * @returns {string} Código de rastreo
 */
function generarCodigoRastreo() {
  const ALFABETO_SEGURO = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = crypto.randomBytes(8);
  let codigo = "TRO-";
  for (let i = 0; i < 8; i++) {
    const indice = bytes[i] % ALFABETO_SEGURO.length;
    codigo += ALFABETO_SEGURO[indice];
  }
  return codigo;
}

/**
 * POST /api/encomiendas/cotizar
 * Endpoint público para cotización instantánea de paquetes.
 * Almacena la cotización con vigencia de 24 horas en 'cotizaciones_encomienda'.
 */
async function cotizarEncomienda(req, res, next) {
  try {
    const { origen, destino, peso_kg, dimensiones, largo_cm, ancho_cm, alto_cm } = req.body;

    if (!origen || !destino) {
      return res.status(400).json({
        error: "Datos incompletos",
        mensaje: "Debe indicar origen y destino de la encomienda",
      });
    }

    const largo = dimensiones?.largo_cm || largo_cm;
    const ancho = dimensiones?.ancho_cm || ancho_cm;
    const alto = dimensiones?.alto_cm || alto_cm;

    if (!peso_kg || !largo || !ancho || !alto) {
      return res.status(400).json({
        error: "Parámetros inválidos",
        mensaje: "Debe proporcionar peso_kg, largo_cm, ancho_cm y alto_cm mayores a 0",
      });
    }

    const calculo = calcularTarifaEncomienda({
      peso_kg: parseFloat(peso_kg),
      largo_cm: parseFloat(largo),
      ancho_cm: parseFloat(ancho),
      alto_cm: parseFloat(alto),
    });

    const ahora = new Date();
    const venceEn = new Date(ahora.getTime() + 24 * 60 * 60 * 1000); // 24 horas de vigencia

    const nuevaCotizacion = {
      _id: generarUUIDv7(),
      origen: String(origen).trim(),
      destino: String(destino).trim(),
      peso_kg: new Double(calculo.peso_real_kg),
      dimensiones: {
        largo_cm: new Double(calculo.dimensiones.largo_cm),
        ancho_cm: new Double(calculo.dimensiones.ancho_cm),
        alto_cm: new Double(calculo.dimensiones.alto_cm),
      },
      precio_estimado: new Double(calculo.precio_estimado),
      estado: "calculada",
      vence_en: venceEn,
    };

    const db = obtenerDB();
    await db.collection("cotizaciones_encomienda").insertOne(nuevaCotizacion);

    return res.status(201).json({
      mensaje: "Cotización calculada y guardada exitosamente",
      cotizacion_id: nuevaCotizacion._id,
      origen: nuevaCotizacion.origen,
      destino: nuevaCotizacion.destino,
      desglose: calculo,
      precio_estimado: calculo.precio_estimado,
      vence_en: venceEn,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/encomiendas
 * Registro de nueva encomienda con código único de rastreo.
 * Protegido para 'administrador', 'operador_encomiendas', 'agente_boleteria'.
 */
async function registrarEncomienda(req, res, next) {
  try {
    const {
      cotizacion_id,
      remitente,
      destinatario,
      origen,
      destino,
      peso_kg,
      dimensiones,
      descripcion_paquete,
      precio_final,
    } = req.body;

    // 1. Validar remitente
    if (!remitente || !remitente.nombre || !remitente.cedula || !remitente.telefono) {
      return res.status(400).json({
        error: "Datos del remitente incompletos",
        mensaje: "El remitente debe incluir nombre, cedula y telefono",
      });
    }

    const validacionCedRem = validarCedulaEcuatoriana(remitente.cedula);
    if (!validacionCedRem.esValida) {
      return res.status(400).json({
        error: "Cédula del remitente inválida",
        mensaje: `Remitente: ${validacionCedRem.mensaje}`,
      });
    }

    // 2. Validar destinatario
    if (!destinatario || !destinatario.nombre || !destinatario.cedula || !destinatario.telefono) {
      return res.status(400).json({
        error: "Datos del destinatario incompletos",
        mensaje: "El destinatario debe incluir nombre, cedula y telefono",
      });
    }

    const validacionCedDest = validarCedulaEcuatoriana(destinatario.cedula);
    if (!validacionCedDest.esValida) {
      return res.status(400).json({
        error: "Cédula del destinatario inválida",
        mensaje: `Destinatario: ${validacionCedDest.mensaje}`,
      });
    }

    // 3. Validar ruta
    if (!origen || !destino) {
      return res.status(400).json({
        error: "Ruta incompleta",
        mensaje: "Debe especificar origen y destino",
      });
    }

    // 4. Determinar tarifa final
    let tarifaFinal = precio_final;
    const pReal = parseFloat(peso_kg) || 1.0;
    const dimLargo = parseFloat(dimensiones?.largo_cm) || 20;
    const dimAncho = parseFloat(dimensiones?.ancho_cm) || 15;
    const dimAlto = parseFloat(dimensiones?.alto_cm) || 10;

    if (!tarifaFinal || tarifaFinal <= 0) {
      const calculo = calcularTarifaEncomienda({
        peso_kg: pReal,
        largo_cm: dimLargo,
        ancho_cm: dimAncho,
        alto_cm: dimAlto,
      });
      tarifaFinal = calculo.precio_estimado;
    }

    const db = obtenerDB();
    const ahora = new Date();
    const usuarioOperador = req.usuario?.sub || "sistema";

    // 5. Generar código de rastreo garantizando unicidad
    let codigoRastreo = generarCodigoRastreo();
    let existe = await db.collection("encomiendas").findOne({ codigo_rastreo: codigoRastreo });
    let intentos = 0;
    while (existe && intentos < 5) {
      codigoRastreo = generarCodigoRastreo();
      existe = await db.collection("encomiendas").findOne({ codigo_rastreo: codigoRastreo });
      intentos++;
    }

    const nuevaEncomiendaId = generarUUIDv7();

    // 6. Documento de Encomienda según $jsonSchema en MongoDB Atlas
    const nuevaEncomienda = {
      _id: nuevaEncomiendaId,
      codigo_rastreo: codigoRastreo,
      remitente: {
        nombre: String(remitente.nombre).trim(),
        cedula: String(remitente.cedula).trim(),
        telefono: String(remitente.telefono).trim(),
      },
      destinatario: {
        nombre: String(destinatario.nombre).trim(),
        cedula: String(destinatario.cedula).trim(),
        telefono: String(destinatario.telefono).trim(),
      },
      origen: String(origen).trim(),
      destino: String(destino).trim(),
      peso_kg: new Double(pReal),
      precio_final: new Double(Number(tarifaFinal.toFixed ? tarifaFinal.toFixed(2) : tarifaFinal)),
      estado: "recibida",
      registrada_por: usuarioOperador,
      creada_en: ahora,
    };

    await db.collection("encomiendas").insertOne(nuevaEncomienda);

    // 7. Primer hito en 'historial_encomienda'
    const primerHito = {
      _id: generarUUIDv7(),
      encomienda_id: nuevaEncomiendaId,
      estado: "recibida",
      ubicacion: `Agencia ${origen}`,
      observacion: descripcion_paquete
        ? `Recepción en ventanilla: ${descripcion_paquete}`
        : "Paquete recibido y embalado en agencia de origen. Guía de envío generada.",
      usuario_id: usuarioOperador,
      fecha: ahora,
    };
    await db.collection("historial_encomienda").insertOne(primerHito);

    // 8. Si venía asociada a una cotización, marcarla como aceptada
    if (cotizacion_id) {
      await db.collection("cotizaciones_encomienda").updateOne(
        { _id: cotizacion_id },
        { $set: { estado: "aceptada" } }
      );
    }

    // 9. Auditoría técnica (CARD-24)
    try {
      await db.collection("auditoria").insertOne({
        _id: generarUUIDv7(),
        usuario_id: usuarioOperador,
        accion: "CREAR_ENCOMIENDA",
        entidad: "encomiendas",
        entidad_id: nuevaEncomiendaId,
        fecha: ahora,
        estado: "exitoso",
      });
    } catch (e) {
      console.warn("Aviso auditoría encomienda:", e.message);
    }

    return res.status(201).json({
      mensaje: "Encomienda registrada exitosamente. Guía generada.",
      encomienda: {
        id: nuevaEncomienda._id,
        codigo_rastreo: nuevaEncomienda.codigo_rastreo,
        remitente: nuevaEncomienda.remitente,
        destinatario: nuevaEncomienda.destinatario,
        origen: nuevaEncomienda.origen,
        destino: nuevaEncomienda.destino,
        peso_kg: pReal,
        precio_final: Number(nuevaEncomienda.precio_final),
        estado: nuevaEncomienda.estado,
        creada_en: nuevaEncomienda.creada_en,
      },
      primer_hito: primerHito,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/encomiendas
 * Listado de encomiendas con filtros por estado o búsqueda por código/cédula.
 * Para panel operativo de encomiendas.
 */
async function listarEncomiendas(req, res, next) {
  try {
    const { estado, busqueda } = req.query;
    const db = obtenerDB();
    const filtro = {};

    if (estado && estado !== "todos") {
      filtro.estado = estado;
    }

    if (busqueda && busqueda.trim()) {
      const q = busqueda.trim();
      filtro.$or = [
        { codigo_rastreo: { $regex: q, $options: "i" } },
        { "remitente.cedula": { $regex: q, $options: "i" } },
        { "remitente.nombre": { $regex: q, $options: "i" } },
        { "destinatario.cedula": { $regex: q, $options: "i" } },
        { "destinatario.nombre": { $regex: q, $options: "i" } },
      ];
    }

    const encomiendas = await db
      .collection("encomiendas")
      .find(filtro)
      .sort({ creada_en: -1 })
      .limit(100)
      .toArray();

    return res.status(200).json({ encomiendas });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/encomiendas/:id
 * Detalle completo de una encomienda con su historial cronológico de movimientos.
 */
async function obtenerEncomiendaPorId(req, res, next) {
  try {
    const { id } = req.params;
    const db = obtenerDB();

    const encomienda = await db.collection("encomiendas").findOne({ _id: id });
    if (!encomienda) {
      return res.status(404).json({
        error: "Encomienda no encontrada",
        mensaje: `No existe encomienda con ID ${id}`,
      });
    }

    const historial = await db
      .collection("historial_encomienda")
      .find({ encomienda_id: id })
      .sort({ fecha: 1 })
      .toArray();

    return res.status(200).json({
      encomienda,
      historial,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  calcularTarifaEncomienda,
  generarCodigoRastreo,
  cotizarEncomienda,
  registrarEncomienda,
  listarEncomiendas,
  obtenerEncomiendaPorId,
};
