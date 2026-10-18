/**
 * ====================================================================
 * PROYECTO TRANSORENSE - INICIALIZADOR DE BASE DE DATOS MONGODB ATLAS
 * Colecciones: 12 entidades con Validación de Esquema $jsonSchema
 * Identificadores: UUID v7 (Time-Sortable)
 * Concurrencia: Índices únicos condicionales para asientos y pagos
 * ====================================================================
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/transorense';
const dbName = process.env.DB_NAME || 'transorense';

async function inicializarEsquema() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Conectado a MongoDB Atlas. Inicializando colecciones y esquemas de seguridad...');
        const db = client.db(dbName);

        // 1. USUARIOS
        console.log('-> Creando colección: usuarios');
        await db.createCollection('usuarios', {
            validator: {
                $jsonSchema: {
                    bsonType: 'object',
                    required: ['_id', 'nombre', 'correo', 'roles', 'estado', 'metodo_auth', 'creado_en'],
                    properties: {
                        _id: { bsonType: 'string', description: 'UUID v7 obligatorio' },
                        nombre: { bsonType: 'string', minLength: 3 },
                        cedula: { bsonType: ['string', 'null'], pattern: '^[0-9]{10}$' },
                        correo: { bsonType: 'string', pattern: '^.+@.+\\..+$' },
                        contrasena_hash: { bsonType: ['string', 'null'] },
                        google_id: { bsonType: ['string', 'null'] },
                        metodo_auth: { enum: ['local', 'google'] },
                        roles: {
                            bsonType: 'array',
                            items: { enum: ['administrador', 'agente_boleteria', 'operador_encomiendas', 'cliente', 'auditor_tecnico'] }
                        },
                        estado: { enum: ['activo', 'inactivo', 'bloqueado'] },
                        creado_en: { bsonType: 'date' },
                        actualizado_en: { bsonType: 'date' }
                    }
                }
            }
        });
        await db.collection('usuarios').createIndex({ correo: 1 }, { unique: true });
        await db.collection('usuarios').createIndex({ cedula: 1 }, { unique: true, partialFilterExpression: { cedula: { $type: 'string' } } });
        await db.collection('usuarios').createIndex({ google_id: 1 }, { unique: true, partialFilterExpression: { google_id: { $type: 'string' } } });

        // 2. RUTAS
        console.log('-> Creando colección: rutas');
        await db.createCollection('rutas', {
            validator: {
                $jsonSchema: {
                    bsonType: 'object',
                    required: ['_id', 'origen', 'destino', 'duracion_minutos', 'estado'],
                    properties: {
                        _id: { bsonType: 'string', description: 'UUID v7' },
                        origen: { bsonType: 'string' },
                        destino: { bsonType: 'string' },
                        duracion_minutos: { bsonType: 'int', minimum: 1 },
                        estado: { enum: ['activo', 'inactivo'] }
                    }
                }
            }
        });
        await db.collection('rutas').createIndex({ origen: 1, destino: 1 });

        // 3. BUSES
        console.log('-> Creando colección: buses');
        await db.createCollection('buses', {
            validator: {
                $jsonSchema: {
                    bsonType: 'object',
                    required: ['_id', 'placa', 'capacidad', 'distribucion_asientos', 'estado'],
                    properties: {
                        _id: { bsonType: 'string', description: 'UUID v7' },
                        placa: { bsonType: 'string', pattern: '^[A-Z]{3}-[0-9]{3,4}$' },
                        descripcion: { bsonType: 'string' },
                        capacidad: { bsonType: 'int', minimum: 10 },
                        distribucion_asientos: {
                            bsonType: 'array',
                            items: {
                                bsonType: 'object',
                                required: ['numero', 'fila', 'columna'],
                                properties: {
                                    numero: { bsonType: 'string' },
                                    fila: { bsonType: 'int' },
                                    columna: { bsonType: 'int' }
                                }
                            }
                        },
                        estado: { enum: ['activo', 'inactivo', 'mantenimiento'] }
                    }
                }
            }
        });
        await db.collection('buses').createIndex({ placa: 1 }, { unique: true });

        // 4. VIAJES
        console.log('-> Creando colección: viajes');
        await db.createCollection('viajes', {
            validator: {
                $jsonSchema: {
                    bsonType: 'object',
                    required: ['_id', 'ruta_id', 'bus_id', 'salida', 'llegada_estimada', 'precio', 'estado'],
                    properties: {
                        _id: { bsonType: 'string', description: 'UUID v7' },
                        ruta_id: { bsonType: 'string' },
                        bus_id: { bsonType: 'string' },
                        salida: { bsonType: 'date' },
                        llegada_estimada: { bsonType: 'date' },
                        precio: { bsonType: 'double', minimum: 0 },
                        estado: { enum: ['programado', 'en_curso', 'finalizado', 'cancelado'] }
                    }
                }
            }
        });
        await db.collection('viajes').createIndex({ ruta_id: 1, salida: 1, estado: 1 });

        // 5. RESERVAS (Con control estricto de concurrencia)
        console.log('-> Creando colección: reservas');
        await db.createCollection('reservas', {
            validator: {
                $jsonSchema: {
                    bsonType: 'object',
                    required: ['_id', 'usuario_id', 'viaje_id', 'bus_id', 'asiento_numero', 'precio_final', 'estado', 'creada_en', 'vence_en'],
                    properties: {
                        _id: { bsonType: 'string', description: 'UUID v7' },
                        usuario_id: { bsonType: 'string' },
                        viaje_id: { bsonType: 'string' },
                        bus_id: { bsonType: 'string' },
                        asiento_numero: { bsonType: 'string' },
                        precio_final: { bsonType: 'double', minimum: 0 },
                        estado: { enum: ['reservada', 'pendiente_verificacion', 'confirmada', 'cancelada', 'expirada'] },
                        creada_en: { bsonType: 'date' },
                        vence_en: { bsonType: 'date', description: 'Expiración a los 10 minutos' },
                        actualizada_en: { bsonType: 'date' }
                    }
                }
            }
        });
        // ÍNDICE DE CONCURRENCIA: Un asiento no puede reservarse dos veces para el mismo viaje
        await db.collection('reservas').createIndex(
            { viaje_id: 1, asiento_numero: 1 },
            {
                unique: true,
                name: 'uq_asiento_reserva_activa',
                partialFilterExpression: {
                    estado: { $in: ['reservada', 'pendiente_verificacion', 'confirmada'] }
                }
            }
        );
        await db.collection('reservas').createIndex({ usuario_id: 1, creada_en: -1 });

        // 6. PASAJEROS
        console.log('-> Creando colección: pasajeros');
        await db.createCollection('pasajeros', {
            validator: {
                $jsonSchema: {
                    bsonType: 'object',
                    required: ['_id', 'reserva_id', 'nombre', 'identificacion', 'estado'],
                    properties: {
                        _id: { bsonType: 'string', description: 'UUID v7' },
                        reserva_id: { bsonType: 'string' },
                        nombre: { bsonType: 'string' },
                        identificacion: { bsonType: 'string' },
                        estado: { enum: ['activo', 'inactivo'] }
                    }
                }
            }
        });
        await db.collection('pasajeros').createIndex({ reserva_id: 1 }, { unique: true });

        // 7. PAGOS
        console.log('-> Creando colección: pagos');
        await db.createCollection('pagos', {
            validator: {
                $jsonSchema: {
                    bsonType: 'object',
                    required: ['_id', 'reserva_id', 'metodo', 'importe', 'estado', 'creado_en'],
                    properties: {
                        _id: { bsonType: 'string', description: 'UUID v7' },
                        reserva_id: { bsonType: 'string' },
                        metodo: { bsonType: 'string' },
                        referencia: { bsonType: 'string' },
                        comprobante_url: { bsonType: ['string', 'null'] },
                        importe: { bsonType: 'double', minimum: 0.01 },
                        estado: { enum: ['pendiente', 'en_revision', 'aprobado', 'rechazado'] },
                        verificado_por: { bsonType: ['string', 'null'] },
                        creado_en: { bsonType: 'date' },
                        verificado_en: { bsonType: ['date', 'null'] }
                    }
                }
            }
        });
        await db.collection('pagos').createIndex(
            { reserva_id: 1 },
            {
                unique: true,
                name: 'uq_pago_aprobado_reserva',
                partialFilterExpression: { estado: 'aprobado' }
            }
        );

        // 8. COTIZACIONES ENCOMIENDA
        console.log('-> Creando colección: cotizaciones_encomienda');
        await db.createCollection('cotizaciones_encomienda', {
            validator: {
                $jsonSchema: {
                    bsonType: 'object',
                    required: ['_id', 'origen', 'destino', 'peso_kg', 'dimensiones', 'precio_estimado', 'estado', 'vence_en'],
                    properties: {
                        _id: { bsonType: 'string', description: 'UUID v7' },
                        origen: { bsonType: 'string' },
                        destino: { bsonType: 'string' },
                        peso_kg: { bsonType: 'double', minimum: 0.01 },
                        dimensiones: {
                            bsonType: 'object',
                            required: ['largo_cm', 'ancho_cm', 'alto_cm'],
                            properties: {
                                largo_cm: { bsonType: 'double', minimum: 1 },
                                ancho_cm: { bsonType: 'double', minimum: 1 },
                                alto_cm: { bsonType: 'double', minimum: 1 }
                            }
                        },
                        precio_estimado: { bsonType: 'double', minimum: 0 },
                        estado: { enum: ['calculada', 'aceptada', 'vencida'] },
                        vence_en: { bsonType: 'date' }
                    }
                }
            }
        });

        // 9. ENCOMIENDAS
        console.log('-> Creando colección: encomiendas');
        await db.createCollection('encomiendas', {
            validator: {
                $jsonSchema: {
                    bsonType: 'object',
                    required: ['_id', 'codigo_rastreo', 'remitente', 'destinatario', 'origen', 'destino', 'precio_final', 'estado', 'creada_en'],
                    properties: {
                        _id: { bsonType: 'string', description: 'UUID v7' },
                        codigo_rastreo: { bsonType: 'string', minLength: 8 },
                        remitente: {
                            bsonType: 'object',
                            required: ['nombre', 'cedula', 'telefono'],
                            properties: {
                                nombre: { bsonType: 'string' },
                                cedula: { bsonType: 'string' },
                                telefono: { bsonType: 'string' }
                            }
                        },
                        destinatario: {
                            bsonType: 'object',
                            required: ['nombre', 'cedula', 'telefono'],
                            properties: {
                                nombre: { bsonType: 'string' },
                                cedula: { bsonType: 'string' },
                                telefono: { bsonType: 'string' }
                            }
                        },
                        origen: { bsonType: 'string' },
                        destino: { bsonType: 'string' },
                        peso_kg: { bsonType: 'double' },
                        precio_final: { bsonType: 'double', minimum: 0 },
                        estado: { enum: ['recibida', 'en_transito', 'en_destino', 'en_reparto', 'entregada', 'incidencia', 'cancelada'] },
                        registrada_por: { bsonType: 'string' },
                        creada_en: { bsonType: 'date' }
                    }
                }
            }
        });
        await db.collection('encomiendas').createIndex({ codigo_rastreo: 1 }, { unique: true });

        // 10. HISTORIAL ENCOMIENDA
        console.log('-> Creando colección: historial_encomienda');
        await db.createCollection('historial_encomienda', {
            validator: {
                $jsonSchema: {
                    bsonType: 'object',
                    required: ['_id', 'encomienda_id', 'estado', 'fecha'],
                    properties: {
                        _id: { bsonType: 'string', description: 'UUID v7' },
                        encomienda_id: { bsonType: 'string' },
                        estado: { bsonType: 'string' },
                        ubicacion: { bsonType: 'string' },
                        observacion: { bsonType: 'string' },
                        usuario_id: { bsonType: 'string' },
                        fecha: { bsonType: 'date' }
                    }
                }
            }
        });
        await db.collection('historial_encomienda').createIndex({ encomienda_id: 1, fecha: -1 });

        // 11. AUDITORIA
        console.log('-> Creando colección: auditoria');
        await db.createCollection('auditoria', {
            validator: {
                $jsonSchema: {
                    bsonType: 'object',
                    required: ['_id', 'usuario_id', 'accion', 'entidad', 'entidad_id', 'fecha', 'estado'],
                    properties: {
                        _id: { bsonType: 'string', description: 'UUID v7' },
                        usuario_id: { bsonType: 'string' },
                        accion: { bsonType: 'string' },
                        entidad: { bsonType: 'string' },
                        entidad_id: { bsonType: 'string' },
                        detalle: { bsonType: 'object' },
                        estado: { enum: ['registrado', 'anomalia'] },
                        fecha: { bsonType: 'date' }
                    }
                }
            }
        });
        await db.collection('auditoria').createIndex({ usuario_id: 1, fecha: -1 });

        // 12. INCIDENCIAS
        console.log('-> Creando colección: incidencias');
        await db.createCollection('incidencias', {
            validator: {
                $jsonSchema: {
                    bsonType: 'object',
                    required: ['_id', 'titulo', 'descripcion', 'severidad', 'estado', 'creada_en'],
                    properties: {
                        _id: { bsonType: 'string', description: 'UUID v7' },
                        titulo: { bsonType: 'string' },
                        descripcion: { bsonType: 'string' },
                        severidad: { enum: ['baja', 'media', 'alta', 'critica'] },
                        estado: { enum: ['abierta', 'en_revision', 'resuelta', 'cerrada'] },
                        reportado_por: { bsonType: 'string' },
                        responsable: { bsonType: ['string', 'null'] },
                        referencia_github: { bsonType: ['string', 'null'] },
                        creada_en: { bsonType: 'date' }
                    }
                }
            }
        });

        console.log('🎉 Estructura de base de datos MongoDB Atlas creada con éxito total.');
    } catch (error) {
        if (error.codeName === 'NamespaceExists') {
            console.log('ℹ️ Las colecciones ya existen. Los esquemas fueron validados.');
        } else {
            console.error('❌ Error durante la inicialización:', error);
        }
    } finally {
        await client.close();
    }
}

if (require.main === module) {
    inicializarEsquema();
}

module.exports = { inicializarEsquema };
