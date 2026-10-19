require('dotenv').config();
const { Redis } = require('@upstash/redis');

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || 'https://open-newt-142623.upstash.io',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || 'gQAAAAAAAi0fAAIgcDExYjNmOWQ4NzVlNzE0ZmNhOWEyNzJiZDU3MTEzYWYzYw',
});

async function inicializarRedis() {
    console.log('🔄 Conectando a Upstash Redis para inicializar estructuras y claves...');

    try {
        const ping = await redis.ping();
        console.log(`✅ Conexión establecida con Redis: ${ping}`);

        // 1. Estructura HASH: Configuración General de la Empresa
        console.log('-> Creando estructura: configuracion:empresa');
        await redis.hset('configuracion:empresa', {
            nombre: 'Cooperativa de Transporte Interprovincial TransOrense',
            provincia: 'El Oro',
            ciudad_matriz: 'Machala',
            moneda: 'USD',
            estado: 'activo'
        });

        // 2. Estructura HASH: Políticas de Reserva Temporal (Regla de los 10 minutos)
        console.log('-> Creando estructura: politicas:reservas');
        await redis.hset('politicas:reservas', {
            tiempo_expiracion_segundos: 600,
            tiempo_expiracion_minutos: 10,
            max_asientos_por_compra: 5,
            permitir_compra_terceros: 'true'
        });

        // 3. Estructura SET: Terminales y Rutas Frecuentes
        console.log('-> Creando estructura: rutas:populares');
        await redis.sadd('rutas:populares', 
            'Machala - Guayaquil', 
            'Machala - Cuenca', 
            'Machala - Quito', 
            'Machala - Loja',
            'Machala - Santa Rosa'
        );

        // 4. Estructura con TTL: Registro de Demostración de Asiento Bloqueado (10 minutos)
        console.log('-> Creando estructura con TTL: asiento:demo:viaje-01:14');
        await redis.set(
            'asiento:demo:viaje-01:14',
            JSON.stringify({
                viaje_id: 'viaje-demo-01',
                asiento_numero: '14',
                estado: 'reservado_temporal',
                usuario_demo: 'cliente_demo@transorense.com',
                creado_en: new Date().toISOString()
            }),
            { ex: 600 } // Expira en 10 minutos automáticamente
        );

        // 5. Estructura HASH: Estado del Sistema Multi-NoSQL
        console.log('-> Creando estructura: sistema:estado');
        await redis.hset('sistema:estado', {
            nosql_primaria: 'MongoDB Atlas (Documental)',
            nosql_secundaria: 'Upstash Redis (Clave-Valor / In-Memory)',
            estado: 'operativo',
            inicializado_en: new Date().toISOString()
        });

        console.log('🎉 Todas las estructuras de Upstash Redis fueron creadas e inicializadas exitosamente.');

    } catch (error) {
        console.error('❌ Error al inicializar Upstash Redis:', error);
    }
}

if (require.main === module) {
    inicializarRedis();
}

module.exports = { inicializarRedis };
