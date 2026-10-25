require('dotenv').config();
const { Redis } = require('@upstash/redis');

/**
 * ====================================================================
 * PROYECTO TRANSORENSE - CLIENTE UPSTASH REDIS (BD NoSQL #2)
 * Propósito: Bloqueo de Asientos con TTL (10 min) y Caché en Memoria
 * ====================================================================
 */

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!redisUrl || !redisToken) {
  if (process.env.NODE_ENV === 'test') {
    process.env.UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || 'https://mock-redis.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'mock_token_for_ci';
  } else {
    throw new Error('❌ Error Crítico de Seguridad (CARD-30): UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN son obligatorios y deben definirse en .env');
  }
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/**
 * Bloquea temporalmente un asiento durante un tiempo límite (por defecto 10 minutos = 600s)
 * @returns {Promise<boolean>} true si se bloqueó con éxito, false si ya estaba ocupado
 */
async function bloquearAsiento(viajeId, asientoNumero, usuarioId, ttlSegundos = 600) {
    const clave = `asiento:${viajeId}:${asientoNumero}`;
    const valor = JSON.stringify({
        usuario_id: usuarioId,
        bloqueado_en: new Date().toISOString(),
        vence_en: new Date(Date.now() + ttlSegundos * 1000).toISOString()
    });

    // NX: Solo asigna la clave si NO existe previamente (Garantía atómica de concurrencia)
    // EX: Expiración automática a los N segundos (TTL 10 min)
    const resultado = await redis.set(clave, valor, { nx: true, ex: ttlSegundos });
    return resultado === 'OK';
}

/**
 * Libera un asiento desbloqueándolo de Redis
 */
async function liberarAsiento(viajeId, asientoNumero) {
    const clave = `asiento:${viajeId}:${asientoNumero}`;
    return await redis.del(clave);
}

/**
 * Verifica si un asiento específico está bloqueado temporalmente
 */
async function verificarAsientoOcupado(viajeId, asientoNumero) {
    const clave = `asiento:${viajeId}:${asientoNumero}`;
    const data = await redis.get(clave);
    return data ? (typeof data === 'string' ? JSON.parse(data) : data) : null;
}

/**
 * Obtiene todos los asientos actualmente bloqueados para un viaje específico
 */
async function obtenerAsientosBloqueados(viajeId) {
    const patron = `asiento:${viajeId}:*`;
    const claves = await redis.keys(patron);
    const resultado = [];

    for (const clave of claves) {
        const asientoNumero = clave.split(':')[2];
        const info = await redis.get(clave);
        resultado.push({
            asiento_numero: asientoNumero,
            info: typeof info === 'string' ? JSON.parse(info) : info
        });
    }

    return resultado;
}

/**
 * Guarda en caché la lista de viajes para acelerar el buscador público (TTL: 5 min)
 */
async function cachearViajes(origen, destino, fecha, viajes, ttlSegundos = 300) {
    const clave = `cache:viajes:${origen.toLowerCase()}:${destino.toLowerCase()}:${fecha}`;
    await redis.set(clave, JSON.stringify(viajes), { ex: ttlSegundos });
}

/**
 * Obtiene los viajes desde el caché de Redis
 */
async function obtenerViajesCache(origen, destino, fecha) {
    const clave = `cache:viajes:${origen.toLowerCase()}:${destino.toLowerCase()}:${fecha}`;
    const data = await redis.get(clave);
    return data ? (typeof data === 'string' ? JSON.parse(data) : data) : null;
}

/**
 * Ping de prueba de conexión
 */
async function pingRedis() {
    return await redis.ping();
}

module.exports = {
    redis,
    bloquearAsiento,
    liberarAsiento,
    verificarAsientoOcupado,
    obtenerAsientosBloqueados,
    cachearViajes,
    obtenerViajesCache,
    pingRedis
};
