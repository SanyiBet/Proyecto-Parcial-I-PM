const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/transorense';
const dbName = process.env.DB_NAME || 'transorense';

let db = null;
let client = null;

async function conectarDB() {
    if (db) return db;

    try {
        client = new MongoClient(uri, {
            maxPoolSize: 20,
            serverSelectionTimeoutMS: 15000,
        });

        await client.connect();
        db = client.db(dbName);
        console.log(`✅ Conexión establecida con MongoDB Atlas: Base de datos '${dbName}'`);
        return db;
    } catch (error) {
        console.error('❌ Error al conectar con MongoDB Atlas:', error.message);
        throw error;
    }
}

function obtenerDB() {
    if (!db) {
        throw new Error('La base de datos no ha sido inicializada. Ejecuta conectarDB() primero.');
    }
    return db;
}

async function cerrarDB() {
    if (client) {
        await client.close();
        db = null;
        console.log('Conexión con MongoDB cerrada.');
    }
}

module.exports = { conectarDB, obtenerDB, cerrarDB };
