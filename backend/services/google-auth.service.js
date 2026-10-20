/**
 * google-auth.service.js
 * Servicio de verificación criptográfica de tokens ID emitidos por Google Identity Services (OAuth 2.0).
 * Utiliza google-auth-library para validar la firma, vigencia y Client ID.
 */

const { OAuth2Client } = require("google-auth-library");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * Verifica la autenticidad de un idToken enviado por Google Identity Services en el Frontend.
 * 
 * @param {string} idToken - Token JWT emitido por los servidores de Google
 * @returns {Promise<{ googleId: string, correo: string, nombre: string, foto: string, emailVerificado: boolean }>}
 */
async function verificarTokenGoogle(idToken) {
  if (!idToken || typeof idToken !== "string") {
    throw new Error("El token de Google (idToken) es requerido");
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID || undefined, // Si GOOGLE_CLIENT_ID está configurado, valida la audiencia estricta
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new Error("No se pudo obtener el payload del token de Google");
    }

    return {
      googleId: payload.sub,
      correo: payload.email,
      nombre: payload.name || "Usuario de Google",
      foto: payload.picture || "",
      emailVerificado: Boolean(payload.email_verified),
    };
  } catch (error) {
    console.error("❌ Error verificando token de Google:", error.message);
    throw new Error(`Credencial de Google inválida o expirada: ${error.message}`);
  }
}

module.exports = {
  verificarTokenGoogle,
};
