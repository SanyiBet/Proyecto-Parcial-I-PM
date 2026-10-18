const crypto = require('crypto');

/**
 * Generador nativo de UUID versión 7 (RFC 9562)
 * Combina timestamp de 48 bits en milisegundos con aleatoriedad criptográfica.
 * Ventaja: Ordenable por tiempo (time-sortable), ideal para índices B-Tree en MongoDB Atlas.
 */
function generarUUIDv7() {
    const timestamp = Date.now();
    const bytes = crypto.randomBytes(16);

    // Timestamp en los primeros 48 bits (6 bytes)
    bytes[0] = Math.floor(timestamp / 0x10000000000) & 0xff;
    bytes[1] = Math.floor(timestamp / 0x100000000) & 0xff;
    bytes[2] = Math.floor(timestamp / 0x1000000) & 0xff;
    bytes[3] = Math.floor(timestamp / 0x10000) & 0xff;
    bytes[4] = Math.floor(timestamp / 0x100) & 0xff;
    bytes[5] = timestamp & 0xff;

    // Versión 7 en el byte 6 (0111xxxx)
    bytes[6] = 0x70 | (bytes[6] & 0x0f);

    // Variante RFC 9562 en el byte 8 (10xxxxxx)
    bytes[8] = 0x80 | (bytes[8] & 0x3f);

    // Formatear a estándar 8-4-4-4-12
    const hex = bytes.toString('hex');
    return [
        hex.substring(0, 8),
        hex.substring(8, 12),
        hex.substring(12, 16),
        hex.substring(16, 20),
        hex.substring(20, 32)
    ].join('-');
}

module.exports = { generarUUIDv7 };
