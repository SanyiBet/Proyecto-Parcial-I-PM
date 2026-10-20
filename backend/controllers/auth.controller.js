/**
 * auth.controller.js
 * Controlador de Autenticación de TransOrense:
 * - Registro local con validación de cédula y hash Argon2id
 * - Login local con credenciales
 * - Autenticación con Google Identity Services (OAuth 2.0)
 * - Completar/Vincular cédula obligatoria para cuentas Google
 */

const { obtenerDB } = require("../database/connection");
const { generarUUIDv7 } = require("../database/uuid-helper");
const { validarCedulaEcuatoriana } = require("../utils/validador-cedula");
const { hashearPassword, verificarPassword } = require("../services/hash.service");
const { generarTokenJWT, verificarTokenJWT } = require("../services/token.service");
const { verificarTokenGoogle } = require("../services/google-auth.service");

/**
 * Normaliza y formatea el objeto de usuario para respuestas seguras (sin hashes)
 */
function serializarUsuario(usuario) {
  return {
    id: usuario._id,
    nombre: usuario.nombre,
    correo: usuario.correo,
    cedula: usuario.cedula || null,
    roles: usuario.roles,
    metodo_auth: usuario.metodo_auth,
    estado: usuario.estado,
    requiere_cedula: !usuario.cedula,
  };
}

/**
 * POST /api/auth/register
 * Registro de clientes mediante formulario tradicional
 */
async function register(req, res, next) {
  try {
    const { nombre, correo, cedula, password } = req.body;

    if (!nombre || !correo || !cedula || !password) {
      return res.status(400).json({
        error: "Campos incompletos",
        mensaje: "Nombre, correo, cédula y contraseña son obligatorios",
      });
    }

    if (typeof nombre !== "string" || nombre.trim().length < 3) {
      return res.status(400).json({
        error: "Nombre inválido",
        mensaje: "El nombre debe tener al menos 3 caracteres",
      });
    }

    const emailRegex = /^.+@.+\..+$/;
    const correoNormalizado = correo.trim().toLowerCase();
    if (!emailRegex.test(correoNormalizado)) {
      return res.status(400).json({
        error: "Correo inválido",
        mensaje: "El formato de correo electrónico no es válido",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Contraseña insegura",
        mensaje: "La contraseña debe tener un mínimo de 6 caracteres",
      });
    }

    // 1. Validar cédula ecuatoriana algorítmicamente (Módulo 10)
    const validacionCedula = validarCedulaEcuatoriana(cedula);
    if (!validacionCedula.esValida) {
      return res.status(400).json({
        error: "Cédula inválida",
        mensaje: validacionCedula.mensaje,
      });
    }
    const cedulaNormalizada = String(cedula).trim();

    const db = obtenerDB();
    const coleccionUsuarios = db.collection("usuarios");

    // 2. Verificar duplicidad de correo o cédula
    const usuarioExistente = await coleccionUsuarios.findOne({
      $or: [{ correo: correoNormalizado }, { cedula: cedulaNormalizada }],
    });

    if (usuarioExistente) {
      if (usuarioExistente.correo === correoNormalizado) {
        return res.status(409).json({
          error: "Correo ya registrado",
          mensaje: "Ya existe una cuenta registrada con este correo electrónico",
        });
      }
      if (usuarioExistente.cedula === cedulaNormalizada) {
        return res.status(409).json({
          error: "Cédula ya registrada",
          mensaje: "El número de cédula ingresado ya pertenece a un usuario",
        });
      }
    }

    // 3. Hashear contraseña con Argon2id
    const contrasenaHash = await hashearPassword(password);
    const ahora = new Date();

    // 4. Crear documento con UUID v7
    const nuevoUsuario = {
      _id: generarUUIDv7(),
      nombre: nombre.trim(),
      correo: correoNormalizado,
      cedula: cedulaNormalizada,
      contrasena_hash: contrasenaHash,
      google_id: null,
      metodo_auth: "local",
      roles: ["cliente"],
      estado: "activo",
      creado_en: ahora,
      actualizado_en: ahora,
    };

    await coleccionUsuarios.insertOne(nuevoUsuario);

    // 5. Emitir token JWT
    const token = generarTokenJWT(nuevoUsuario);

    return res.status(201).json({
      mensaje: "Usuario registrado exitosamente",
      token,
      usuario: serializarUsuario(nuevoUsuario),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/login
 * Inicio de sesión mediante credenciales locales
 */
async function login(req, res, next) {
  try {
    const { correo, password } = req.body;

    if (!correo || !password) {
      return res.status(400).json({
        error: "Datos requeridos",
        mensaje: "Debe ingresar su correo y contraseña",
      });
    }

    const correoNormalizado = correo.trim().toLowerCase();
    const db = obtenerDB();
    const usuario = await db.collection("usuarios").findOne({ correo: correoNormalizado });

    if (!usuario) {
      return res.status(401).json({
        error: "Credenciales incorrectas",
        mensaje: "El correo o la contraseña son incorrectos",
      });
    }

    if (usuario.estado !== "activo") {
      return res.status(403).json({
        error: "Acceso denegado",
        mensaje: `Su cuenta se encuentra en estado '${usuario.estado}'. Contacte al administrador.`,
      });
    }

    if (!usuario.contrasena_hash) {
      return res.status(400).json({
        error: "Método de autenticación alternativo",
        mensaje: "Esta cuenta fue registrada con Google. Por favor, inicie sesión con el botón oficial de Google.",
      });
    }

    // Comprobación segura con Argon2id
    const coincide = await verificarPassword(usuario.contrasena_hash, password);
    if (!coincide) {
      return res.status(401).json({
        error: "Credenciales incorrectas",
        mensaje: "El correo o la contraseña son incorrectos",
      });
    }

    const token = generarTokenJWT(usuario);

    return res.status(200).json({
      mensaje: "Inicio de sesión exitoso",
      token,
      usuario: serializarUsuario(usuario),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/google
 * Inicio de sesión o registro automático con Google OAuth 2.0 (Google Identity Services)
 */
async function googleAuth(req, res, next) {
  try {
    const credential = req.body.credential || req.body.idToken;

    if (!credential) {
      return res.status(400).json({
        error: "Token faltante",
        mensaje: "Se requiere la credencial provista por Google (credential o idToken)",
      });
    }

    // 1. Verificar criptográficamente con los servidores de Google
    const datosGoogle = await verificarTokenGoogle(credential);
    const correoGoogle = datosGoogle.correo.toLowerCase();

    const db = obtenerDB();
    const coleccionUsuarios = db.collection("usuarios");

    // 2. Buscar si ya existe por google_id o por correo
    let usuario = await coleccionUsuarios.findOne({
      $or: [{ google_id: datosGoogle.googleId }, { correo: correoGoogle }],
    });

    const ahora = new Date();

    if (usuario) {
      // Si el usuario existe pero no tenía vinculado el google_id, vincularlo
      if (!usuario.google_id) {
        await coleccionUsuarios.updateOne(
          { _id: usuario._id },
          { $set: { google_id: datosGoogle.googleId, actualizado_en: ahora } }
        );
        usuario.google_id = datosGoogle.googleId;
      }

      if (usuario.estado !== "activo") {
        return res.status(403).json({
          error: "Acceso denegado",
          mensaje: `Su cuenta se encuentra en estado '${usuario.estado}'. Contacte al administrador.`,
        });
      }
    } else {
      // 3. Crear nuevo usuario cliente automáticamente
      usuario = {
        _id: generarUUIDv7(),
        nombre: datosGoogle.nombre,
        correo: correoGoogle,
        cedula: null, // Pendiente de completar por requerimiento institucional
        contrasena_hash: null,
        google_id: datosGoogle.googleId,
        metodo_auth: "google",
        roles: ["cliente"],
        estado: "activo",
        creado_en: ahora,
        actualizado_en: ahora,
      };

      await coleccionUsuarios.insertOne(usuario);
    }

    // 4. Emitir token JWT con roles RBAC
    const token = generarTokenJWT(usuario);

    return res.status(200).json({
      mensaje: "Autenticación con Google exitosa",
      token,
      usuario: serializarUsuario(usuario),
      requiere_cedula: !usuario.cedula,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/completar-cedula
 * Vincula la cédula obligatoria a una cuenta que ingresó por Google
 */
async function completarCedula(req, res, next) {
  try {
    const { cedula } = req.body;

    if (!cedula) {
      return res.status(400).json({
        error: "Cédula requerida",
        mensaje: "Debe ingresar el número de cédula",
      });
    }

    // 1. Validar cédula con algoritmo Módulo 10
    const validacionCedula = validarCedulaEcuatoriana(cedula);
    if (!validacionCedula.esValida) {
      return res.status(400).json({
        error: "Cédula inválida",
        mensaje: validacionCedula.mensaje,
      });
    }
    const cedulaNormalizada = String(cedula).trim();

    // 2. Extraer usuario desde el token JWT (req.usuario si pasó por middleware o decodificar header)
    let usuarioId = null;
    if (req.usuario && req.usuario.sub) {
      usuarioId = req.usuario.sub;
    } else {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const decoded = verificarTokenJWT(authHeader.substring(7));
        usuarioId = decoded.sub;
      }
    }

    if (!usuarioId) {
      return res.status(401).json({
        error: "No autenticado",
        mensaje: "Se requiere un token de sesión válido para completar la cédula",
      });
    }

    const db = obtenerDB();
    const coleccionUsuarios = db.collection("usuarios");

    // 3. Comprobar que nadie más tenga ya esta cédula
    const duplicado = await coleccionUsuarios.findOne({
      cedula: cedulaNormalizada,
      _id: { $ne: usuarioId },
    });

    if (duplicado) {
      return res.status(409).json({
        error: "Cédula en uso",
        mensaje: "El número de cédula ingresado ya pertenece a otro usuario registrado",
      });
    }

    // 4. Actualizar cédula en el perfil
    const resultado = await coleccionUsuarios.findOneAndUpdate(
      { _id: usuarioId },
      { $set: { cedula: cedulaNormalizada, actualizado_en: new Date() } },
      { returnDocument: "after" }
    );

    const usuarioActualizado = resultado.value || (await coleccionUsuarios.findOne({ _id: usuarioId }));

    return res.status(200).json({
      mensaje: "Cédula vinculada exitosamente",
      usuario: serializarUsuario(usuarioActualizado),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/auth/perfil
 * Retorna los datos del usuario autenticado
 */
async function obtenerPerfil(req, res, next) {
  try {
    const usuarioId = req.usuario?.sub;
    if (!usuarioId) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const db = obtenerDB();
    const usuario = await db.collection("usuarios").findOne({ _id: usuarioId });

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    return res.status(200).json({
      usuario: serializarUsuario(usuario),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  googleAuth,
  completarCedula,
  obtenerPerfil,
};
