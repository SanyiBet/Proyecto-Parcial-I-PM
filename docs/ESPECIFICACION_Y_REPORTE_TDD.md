# Especificación Formal y Reporte de Ejecución TDD (Test-Driven Development)
**Proyecto:** Plataforma Web y Móvil de Boletería Interprovincial y Gestión de Encomiendas — Cooperativa **TransOrense**  
**Asignatura:** Programación Móvil (8vo Semestre)  
**Metodología de Verificación:** Desarrollo Guiado por Pruebas (*Test-Driven Development* — Ciclo *Red $\rightarrow$ Green $\rightarrow$ Refactor*) en integración directa con *Spec-Driven Development* (`docs/OPENAPI_SPEC.yaml`)  
**Motor de Ejecución:** Node.js v22 (`node:assert` nativo) + GitHub Actions CI (`.github/workflows/ci.yml`)  

---

## 1. Propósito y Alcance del Documento

El presente documento constituye la **Especificación Formal y Reporte de Pruebas TDD (*Test-Driven Development*)** del ecosistema **TransOrense**. Su objetivo es documentar de manera auditable cómo cada regla crítica del negocio, control criptográfico, restricción de concurrencia (MongoDB Atlas + Upstash Redis) y blindaje de seguridad fue diseñada y verificada aplicando el ciclo iterativo de tres fases de Kent Beck:

1. **🔴 Fase RED (Prueba que falla):** Antes de escribir o dar por válida la lógica del controlador, servicio o utilidad, se codifica una aserción estricta (`assert.strictEqual`, `assert.deepStrictEqual`, `assert.throws`, `assert.match`) basada en el contrato previo de `docs/OPENAPI_SPEC.yaml` y en las restricciones `$jsonSchema` de MongoDB Atlas. Al no existir aún la implementación (o ante la presencia de un fallo detectado), la prueba falla.
2. **🟢 Fase GREEN (Implementación mínima que pasa la prueba):** Se programa la lógica exacta en la capa correspondiente (`utils/`, `services/`, `middleware/`, `controllers/`) para satisfacer todos los casos de éxito y de frontera definidos en la prueba.
3. **🔵 Fase REFACTOR (Optimización y limpieza sin romper el contrato):** Con la batería de pruebas en estado `PASS`, se refactoriza el código para eliminar duplicidad, optimizar la complejidad algorítmica (p. ej., evaluación en tiempo lineal $O(1)$ frente a *ReDoS*, validación de *Magic Numbers* en buffers binarios o desacoplamiento en middlewares reutilizables) comprobando que el 100% de las pruebas continúen en verde.

---

## 2. Arquitectura de Pruebas y Ejecución en Integración Continua (CI)

### 2.1. Estructura del Directorio `backend/tests/`
El proyecto cuenta con **13 archivos de pruebas automatizadas** (12 suites unitarias/modulares mapeadas a las tarjetas del tablero Kanban y 1 suite de integración *End-to-End*):

| N.º | Archivo de Prueba | Script NPM (`package.json`) | Tarjeta Kanban / Alcance Técnico |
| :--- | :--- | :--- | :--- |
| **01** | `backend/tests/test-card06.js` | `npm run test:card06` | **[CARD-06]** Validador algorítmico Módulo 10 de Cédula Ecuatoriana y hashing criptográfico **Argon2id**. |
| **02** | `backend/tests/test-card07.js` | `npm run test:card07` | **[CARD-07]** Emisión y verificación criptográfica de tokens **JWT** con `UUID v7` y claims de roles **RBAC**. |
| **03** | `backend/tests/test-card08-09.js` | `npm run test:card08-09` | **[CARD-08 / CARD-09]** Middlewares `authMiddleware` (`401`) y `roleMiddleware` (`403`) + *Bypass* administrativo. |
| **04** | `backend/tests/test-card17.js` | `npm run test:card17` | **[CARD-17]** API de Pasajeros, validación de identidad en compra y guardado local de comprobantes de pago. |
| **05** | `backend/tests/test-card19.js` | `npm run test:card19` | **[CARD-19]** Bandeja del Agente de Boletería: aprobación y rechazo transaccional de pagos con control RBAC. |
| **06** | `backend/tests/test-card20.js` | `npm run test:card20` | **[CARD-20]** Algoritmo de tarifación de encomiendas (peso volumétrico vs. báscula) y generador `TRO-XXXXXXXX`. |
| **07** | `backend/tests/test-card21.js` | `npm run test:card21` | **[CARD-21]** Rastreo público con enmascaramiento **LOPDP** y validación de estados/ubicación en movimientos. |
| **08** | `backend/tests/test-auditoria-incidencias.js` | `npm run test:auditoria` | **[CARD-24 / CARD-27]** Bitácora inmutable de auditoría (`auditoria`) y gestión de incidencias técnicas. |
| **09** | `backend/tests/test-card29.js` | `npm run test:card29` | **[CARD-29]** Filtro temporal estricto (`vence_en > ahora`) y *Worker* automático de expiración de reservas. |
| **10** | `backend/tests/test-card31.js` | `npm run test:card31` | **[CARD-31]** Sanitización de expresiones regulares (`escapeRegex`) y mitigación de ataques **ReDoS**. |
| **11** | `backend/tests/test-card32.js` | `npm run test:card32` | **[CARD-32]** Inspección binaria por *Magic Numbers* (`JPEG`, `PNG`, `PDF`, `WEBP`), cuota 5 MB y *Path Traversal*. |
| **12** | `backend/tests/test-card33.js` | `npm run test:card33` | **[CARD-33]** Limitadores de tasa (*Rate Limiting* `HTTP 429`) en Login y Reservas + Restricción de origen CORS. |
| **13** | `backend/tests/test-e2e.js` | `npm run test:e2e` | **[CARD-28]** Suite Integral *End-to-End* (E2E) de las 6 etapas completas del flujo operativo de TransOrense. |

### 2.2. Aislamiento mediante Mocks HTTP (`crearMockHttp`)
Para garantizar que las pruebas unitarias se ejecuten en milisegundos, de forma determinista y sin depender de conexiones de red externas durante el pipeline de Integración Continua, las suites implementan un *Test Double* (Mock HTTP de Express) que simula los objetos `req`, `res` y el callback `next`:

```javascript
function crearMockHttp({ headers = {}, usuario = null, params = {}, body = {}, query = {} } = {}) {
  const req = { headers, usuario, params, body, query };
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
  let nextLlamado = false;
  const next = () => { nextLlamado = true; };
  return { req, res, next, getNextLlamado: () => nextLlamado };
}
```

---

## 3. Desarrollo del Ciclo TDD (*Red $\rightarrow$ Green $\rightarrow$ Refactor*) por Módulo

A continuación se detalla cómo se aplicó formalmente cada fase del ciclo TDD en las 13 suites del proyecto:

---

### 3.1. Suite 01 (`test-card06.js`): Validador Módulo 10 de Cédula Ecuatoriana y Cifrado Argon2id
* **Módulos bajo prueba:** `backend/utils/validador-cedula.js` y `backend/services/hash.service.js`
* **Contrato SDD asociado:** Esquemas `RegistroRequest`, `CompletarCedulaRequest` y `PasajeroInput` en `docs/OPENAPI_SPEC.yaml`.

| Fase TDD | Descripción Técnica de la Iteración |
| :--- | :--- |
| **🔴 RED** | Se escribieron 8 aserciones para `validarCedulaEcuatoriana()`: 2 casos válidos reales (`"1710034065"` de Pichincha y `"0715432183"` de El Oro) y 6 casos inválidos (cadena vacía `""`, longitud `< 10` `"12345"`, longitud `> 10` `"171003406599"`, código de provincia inexistente `"9910034065"`, tercer dígito $\ge 6$ `"1790034065"` y dígito verificador erróneo `"1710034069"`). Asimismo, se exigió que `hashearPassword("TransOrense#2026")` generara un hash con prefijo `$argon2id$`. |
| **🟢 GREEN** | Se implementó el algoritmo oficial del Registro Civil del Ecuador (coeficientes alternados `2, 1, 2, 1, 2, 1, 2, 1, 2`, resta de 9 cuando el producto es $\ge 10$, y verificación de residuo Módulo 10 respecto al décimo dígito), junto con el servicio `argon2.hash()` y `argon2.verify()`. |
| **🔵 REFACTOR** | Se refactorizó `validarCedulaEcuatoriana()` para retornar un objeto tipado `{ esValida: boolean, mensaje: string }` reutilizable tanto en el registro de usuarios como en la nómina de pasajeros y remitentes de encomiendas. |

---

### 3.2. Suite 02 (`test-card07.js`): Emisión y Verificación Criptográfica de JWT con UUID v7 y RBAC
* **Módulos bajo prueba:** `backend/services/token.service.js` y `backend/database/uuid-helper.js`
* **Contrato SDD asociado:** Esquema de seguridad `bearerAuth` (JWT HMAC-SHA256) en `docs/OPENAPI_SPEC.yaml`.

| Fase TDD | Descripción Técnica de la Iteración |
| :--- | :--- |
| **🔴 RED** | Se definió la prueba exigiendo que `generarTokenJWT()` incrustara en el payload el identificador `UUID v7` en el claim estándar `sub`, el `correo`, el `nombre` y el arreglo `roles` (`["agente_boleteria"]`), y que al alterar los últimos 5 caracteres de la firma (`token.slice(0, -5) + "abcde"`), `verificarTokenJWT()` lanzara una excepción `/invalid signature\|jwt malformed/i`. |
| **🟢 GREEN** | Se implementó la firma y verificación con `jsonwebtoken` inyectando los claims requeridos y validando la integridad criptográfica del token. |
| **🔵 REFACTOR** | En articulación con `CARD-30`, se eliminó cualquier secreto por defecto (*fallback* inseguro), obligando a que `JWT_SECRET` provenga estrictamente de `process.env.JWT_SECRET`. |

---

### 3.3. Suite 03 (`test-card08-09.js`): Middlewares de Autorización y Control de Acceso Basado en Roles (RBAC)
* **Módulo bajo prueba:** `backend/middleware/auth.middleware.js` (`authMiddleware` y `roleMiddleware`)
* **Contrato SDD asociado:** Respuestas estandarizadas `401 Unauthorized` y `403 Forbidden` en `docs/OPENAPI_SPEC.yaml`.

| Fase TDD | Descripción Técnica de la Iteración |
| :--- | :--- |
| **🔴 RED** | Se diseñaron 5 escenarios de prueba: (1) Petición sin header `Authorization` $\rightarrow$ `401`; (2) Petición con token válido $\rightarrow$ invoca `next()` e inyecta `req.usuario`; (3) Usuario con rol `["cliente"]` intentando acceder a un endpoint protegido por `roleMiddleware(["agente_boleteria", "administrador"])` $\rightarrow$ `403`; (4) Usuario `["agente_boleteria"]` $\rightarrow$ `next()`; (5) Usuario `["administrador"]` accediendo a una ruta exclusiva de `["auditor_tecnico"]` $\rightarrow$ `next()` (*bypass* jerárquico). |
| **🟢 GREEN** | Se codificaron ambos middlewares interceptores evaluando la intersección entre `req.usuario.roles` y los roles permitidos por el endpoint. |
| **🔵 REFACTOR** | Se centralizó la regla de *bypass* para que el rol `"administrador"` tenga autorización transversal sin necesidad de repetirlo manualmente en cada ruta operativa. |

---

### 3.4. Suite 04 (`test-card17.js`): API de Pasajeros y Almacenamiento Local de Comprobantes de Pago
* **Módulos bajo prueba:** `backend/controllers/pasajeros.controller.js` y `backend/controllers/pagos.controller.js`
* **Contrato SDD asociado:** Endpoints `POST /api/pasajeros` y `POST /api/pagos`.

| Fase TDD | Descripción Técnica de la Iteración |
| :--- | :--- |
| **🔴 RED** | Se exigió que `registrarPasajeros` rechazara con `401` cualquier petición sin sesión activa, que validara con Módulo 10 la cédula de cada pasajero antes de insertar en MongoDB Atlas, y que existiera el directorio protegido `backend/uploads/comprobantes` para almacenar transferencias en Base64. |
| **🟢 GREEN** | Se implementaron los controladores `registrarPasajeros`, `obtenerPasajeroPorReserva`, `registrarPago`, `obtenerPagoPorReserva` y `listarPagosPendientes`. |
| **🔵 REFACTOR** | Se vinculó la creación del pago con el cambio atómico de la reserva al estado `pendiente_verificacion`, evitando que el *worker* de expiración libere asientos que ya tienen comprobante subido. |

---

### 3.5. Suite 05 (`test-card19.js`): Panel Operativo del Agente de Boletería (Verificación de Pagos)
* **Módulo bajo prueba:** `backend/controllers/pagos.controller.js` (`aprobarPago`, `rechazarPago`, `listarPagosPendientes`)
* **Contrato SDD asociado:** Endpoints `PATCH /api/pagos/:id/aprobar` y `PATCH /api/pagos/:id/rechazar`.

| Fase TDD | Descripción Técnica de la Iteración |
| :--- | :--- |
| **🔴 RED** | Se escribieron pruebas exigiendo la exportación de `aprobarPago` y `rechazarPago`, y comprobando que un usuario con rol `"cliente"` reciba `HTTP 403 Forbidden` al intentar aprobar su propio comprobante bancario. |
| **🟢 GREEN** | Se programaron los endpoints transaccionales protegidos con `roleMiddleware(["administrador", "agente_boleteria"])`. |
| **🔵 REFACTOR** | Al aprobar o rechazar un pago, se integró la actualización en cascada del estado de la reserva (`confirmada` o `cancelada`), la liberación de los bloqueos en Upstash Redis y el registro automático en la colección `auditoria`. |

---

### 3.6. Suite 06 (`test-card20.js`): Algoritmo Volumétrico de Encomiendas y Generador de Guías `TRO-XXXXXXXX`
* **Módulo bajo prueba:** `backend/controllers/encomiendas.controller.js` (`calcularTarifaEncomienda`, `generarCodigoRastreo`)
* **Contrato SDD asociado:** Endpoints `POST /api/encomiendas/cotizar` y `POST /api/encomiendas`.

| Fase TDD | Descripción Técnica de la Iteración |
| :--- | :--- |
| **🔴 RED** | Se plantearon 3 pruebas matemáticas exactas para `calcularTarifaEncomienda()`: **Caso A** (paquete pequeño $\le 2\text{ kg}$: $1.5\text{ kg}$ y $20\times 15\times 10\text{ cm} \rightarrow \text{volumétrico } 0.6\text{ kg} \rightarrow \text{tarifa base } \$3.50$); **Caso B** (paquete voluminoso ligero: $1.0\text{ kg}$ y $50\times 40\times 30\text{ cm} \rightarrow \text{volumétrico } 12\text{ kg} \rightarrow \$3.50 + (12-2)\times \$0.80 = \$11.50$); **Caso C** (paquete pesado compacto: $10.0\text{ kg}$ y $10\times 10\times 10\text{ cm} \rightarrow \text{facturable } 10\text{ kg} \rightarrow \$9.90$). Además, se exigió una prueba de estrés generando **1,000 códigos de guía consecutivos** con `generarCodigoRastreo()` sin una sola colisión y con formato `TRO-XXXXXXXX` (12 caracteres). |
| **🟢 GREEN** | Se codificó la fórmula $\text{Peso Volumétrico} = \frac{\text{Largo} \times \text{Ancho} \times \text{Alto}}{5000}$, $\text{Peso Facturable} = \max(\text{Peso Báscula}, \text{Peso Volumétrico})$ y el generador alfanumérico aleatorio de alta entropía. |
| **🔵 REFACTOR** | Se exportaron `calcularTarifaEncomienda` y `generarCodigoRastreo` como funciones puras desacopladas de la base de datos para permitir tanto cotizaciones públicas en tiempo real como emisión de guías oficiales. |

---

### 3.7. Suite 07 (`test-card21.js`): Rastreo Público con Protección LOPDP y Movimientos de Encomiendas
* **Módulo bajo prueba:** `backend/controllers/encomiendas.controller.js` (`rastrearEncomiendaPublico`, `registrarMovimientoEncomienda`)
* **Contrato SDD asociado:** Endpoints `GET /api/encomiendas/rastreo/:codigo` y `POST /api/encomiendas/:id/movimientos`.

| Fase TDD | Descripción Técnica de la Iteración |
| :--- | :--- |
| **🔴 RED** | Se escribieron pruebas exigiendo que: (1) solo `operador_encomiendas` y `administrador` puedan registrar movimientos (`cliente` recibe `403`); (2) un estado inválido como `"estado_inventado_xyz"` retorne `400 Bad Request`; (3) una ubicación vacía `""` retorne `400 Bad Request`; (4) el rastreo público proteja los datos personales (LOPDP) sin exponer cédulas ni teléfonos. |
| **🟢 GREEN** | Se implementó la validación contra el enum `["recibida", "en_transito", "en_agencia_destino", "entregada", "incidencia"]` y el enmascaramiento de nombres en el endpoint público. |
| **🔵 REFACTOR** | Se sincronizó el registro de movimientos en `historial_encomienda` con la actualización del campo `estado` en la colección maestra `encomiendas`. |

---

### 3.8. Suite 08 (`test-auditoria-incidencias.js`): Bitácora Inmutable de Auditoría y Gestión de Incidencias
* **Módulo bajo prueba:** `backend/controllers/auditoria.controller.js`
* **Contrato SDD asociado:** Endpoints `GET /api/auditoria`, `GET /api/auditoria/incidencias` y `POST /api/auditoria/incidencias`.

| Fase TDD | Descripción Técnica de la Iteración |
| :--- | :--- |
| **🔴 RED** | Se exigió que el acceso a la bitácora `listarAuditoria` estuviera restringido exclusivamente al rol `administrador` (bloqueando con `403` tanto a `cliente` como a `agente_boleteria`), y que `reportarIncidencia` rechazara con `400` títulos menores a 4 caracteres (`"abc"`) o severidades fuera del enum oficial (`"super_urgente"`). |
| **🟢 GREEN** | Se implementaron las validaciones de longitud y del enum de severidad `["baja", "media", "alta", "critica"]` junto con la protección RBAC. |
| **🔵 REFACTOR** | Se estandarizó el servicio `registrarAuditoria()` en `backend/services/auditoria.service.js` para insertar eventos de forma asíncrona no bloqueante en MongoDB Atlas cumpliendo el `$jsonSchema` (`estado: "registrado" | "anomalia"`). |

---

### 3.9. Suite 09 (`test-card29.js`): Prevención de Bloqueo Permanente de Asientos y Worker de Expiración
* **Módulo bajo prueba:** `backend/services/limpieza-reservas.service.js` (`expirarReservasVencidas`, `iniciarWorkerLimpieza`, `detenerWorkerLimpieza`)

| Fase TDD | Descripción Técnica de la Iteración |
| :--- | :--- |
| **🔴 RED** | Se simuló un escenario con 3 reservas sobre el mismo viaje: Asiento `"4"` en estado `reservada` pero con `vence_en` vencido hace 5 minutos; Asiento `"5"` en estado `reservada` con `vence_en` a futuro (+5 min); y Asiento `"6"` en estado `confirmada`. Se exigió que el filtro de disponibilidad reportara el Asiento `"4"` como **LIBRE** (`false`) y los asientos `"5"` y `"6"` como **OCUPADOS** (`true`). |
| **🟢 GREEN** | Se corrigió la consulta en `reservas.controller.js` y `viajes.controller.js` para evaluar `vence_en: { $gt: ahora }` y se construyó el *Worker* en segundo plano que cada 60 segundos pasa las reservas vencidas a `estado: "expirada"` y elimina sus llaves en Upstash Redis. |
| **🔵 REFACTOR** | Se añadieron las funciones de control de ciclo de vida `iniciarWorkerLimpieza()` y `detenerWorkerLimpieza()` con `.unref()` en el temporizador para no bloquear el cierre limpio de los procesos de prueba en CI. |

---

### 3.10. Suite 10 (`test-card31.js`): Blindaje contra Inyecciones ReDoS y Sanitización de Expresiones Regulares
* **Módulo bajo prueba:** `backend/utils/sanitizer.js` (`escapeRegex`)

| Fase TDD | Descripción Técnica de la Iteración |
| :--- | :--- |
| **🔴 RED** | Se diseñaron 4 pruebas de seguridad: (1) Escapar todos los metacaracteres peligrosos `.*+?^${}()|[]\`; (2) Evitar que una búsqueda con paréntesis/corchetes sin cerrar `"Machala (Terminal [Andén 4+"` lance `SyntaxError` al instanciar `new RegExp()`; (3) Neutralizar el payload de *backtracking* catastrófico `^(a+)+$` para que se evalúe literalmente en tiempo $O(1)$; (4) Retornar `""` de forma resiliente ante entradas `null`, `undefined` o numéricas `12345`. |
| **🟢 GREEN** | Se implementó `escapeRegex(texto)` reemplazando `/[.*+?^${}()|[\]\\]/g` por `\\$&` y validando previamente `typeof texto === "string"`. |
| **🔵 REFACTOR** | Se inyectó `escapeRegex()` en todos los filtros de búsqueda de `viajes.controller.js` y `encomiendas.controller.js`. |

---

### 3.11. Suite 11 (`test-card32.js`): Inspección Binaria por Magic Numbers, Cuota de 5 MB y LOPDP
* **Módulos bajo prueba:** `backend/utils/file-validator.js` (`validarArchivoComprobante`) y `backend/controllers/pagos.controller.js` (`guardarComprobanteEnDisco`)

| Fase TDD | Descripción Técnica de la Iteración |
| :--- | :--- |
| **🔴 RED** | Se exigió que el validador inspeccionara los primeros bytes (*Magic Numbers*) del `Buffer` binario y no confiara en el encabezado MIME del cliente: aprobando firmas legítimas `JPEG` (`FF D8 FF E0`), `PNG` (`89 50 4E 47`), `PDF` (`25 50 44 46`) y `WEBP` (`RIFF....WEBP`), pero rechazando scripts XSS (`<script>alert('xss')</script>`) disfrazados de `data:image/jpeg;base64`, binarios ejecutables Windows `.exe` (`4D 5A`), archivos mayores a `5 MB` (`MAX_BYTES_PERMITIDOS + 1024`) e intentos de *Directory Traversal* (`../../../etc/passwd`). |
| **🟢 GREEN** | Se programó `validarArchivoComprobante(buffer)` comparando secuencias hexadecimales a nivel de bytes y `path.basename()` en la resolución de rutas. |
| **🔵 REFACTOR** | Se eliminó la exposición pública estática de la carpeta `/uploads` y se reemplazó por el endpoint autenticado `GET /api/pagos/comprobante/:nombre` que verifica la titularidad del dueño de la reserva o el rol de boletería (cumplimiento **LOPDP**). |

---

### 3.12. Suite 12 (`test-card33.js`): Limitador de Tasa (Rate Limiting) y Restricción de Origen en CORS
* **Módulo bajo prueba:** `backend/middleware/rate-limit.middleware.js` (`limiterAuth`, `limiterReservas`, `limiterGeneral`)

| Fase TDD | Descripción Técnica de la Iteración |
| :--- | :--- |
| **🔴 RED** | Se simularon ráfagas de peticiones concurrentes desde una misma dirección IP: (1) En `limiterAuth` (`/api/auth/login`), las peticiones 1 a 10 dentro de 1 minuto deben invocar `next()`, pero la **11.ª petición** debe ser bloqueada con `HTTP 429 Too Many Requests`; (2) En `limiterReservas` (`/api/reservas`), las peticiones 1 a 20 deben pasar, pero la **21.ª petición** debe retornar `HTTP 429`. |
| **🟢 GREEN** | Se configuraron los tres limitadores con `express-rate-limit` estableciendo ventanas de 60 segundos y mensajes JSON estructurados con `statusCode: 429`. |
| **🔵 REFACTOR** | Se integraron los limitadores en las rutas críticas de `backend/index.js` junto con la lista blanca de orígenes permitidos en el middleware `cors`. |

---

### 3.13. Suite 13 (`test-e2e.js`): Suite Integral End-to-End (E2E) del Ciclo Operativo Completo
* **Módulos bajo prueba:** Integración transversal de las 6 etapas de negocio (`CARD-28`).
* **Flujo verificado:**
  1. **Etapa 1 (Autenticación y RBAC):** Emisión de JWT para `Carlos Mora` (`cliente`) y `María Boletería` (`agente_boleteria`), comprobando bloqueo `403` del cliente en boletería y acceso exitoso del agente.
  2. **Etapa 2 (Concurrencia y Bloqueo de Asientos):** Apartado atómico de los asientos `"15"` y `"16"` con TTL de `600s` (10 min) y detección de colisión simultánea cuando un segundo cliente intenta reservar los mismos asientos.
  3. **Etapa 3 (Identidad Módulo 10 en Pasajeros):** Aceptación de cédula válida (`"1710034065"`), rechazo de cédula inválida (`"0704567899"`) y asociación de 1 pasajero por cada asiento bloqueado.
  4. **Etapa 4 (Pago y Aprobación en Boletería):** Creación del pago en estado `"pendiente"` por `$28.50` (`PCH-987654321`) y transición a `"aprobado"` firmada por el `agenteId`.
  5. **Etapa 5 (Encomienda Volumétrica y LOPDP):** Cálculo de caja de $50\times 40\times 30\text{ cm}$ ($12\text{ kg}$ volumétricos vs. $5\text{ kg}$ báscula) y verificación de que la consulta pública devuelve `undefined` en `dni_remitente` y `telefono_destinatario`.
  6. **Etapa 6 (Auditoría Inmutable):** Generación del registro en `auditoria` con `_id` en formato `UUID v7`, `accion: "APROBAR_PAGO_BOLETERIA"` y `estado: "registrado"`.

---

## 4. Matriz Maestra de Casos de Prueba TDD (48 Casos Verificados)

| ID Caso | Suite / Archivo | Módulo / Función Bajo Prueba | Entrada de Prueba (*Input*) | Resultado Esperado (*Expected Output*) | Estado |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-01** | `test-card06.js` | `validarCedulaEcuatoriana()` | `"1710034065"` (Pichincha, válida) | `{ esValida: true }` | **PASS ✅** |
| **TC-02** | `test-card06.js` | `validarCedulaEcuatoriana()` | `"0715432183"` (El Oro, válida) | `{ esValida: true }` | **PASS ✅** |
| **TC-03** | `test-card06.js` | `validarCedulaEcuatoriana()` | `""` (Cadena vacía) | `{ esValida: false }` | **PASS ✅** |
| **TC-04** | `test-card06.js` | `validarCedulaEcuatoriana()` | `"12345"` (Longitud `< 10`) | `{ esValida: false }` | **PASS ✅** |
| **TC-05** | `test-card06.js` | `validarCedulaEcuatoriana()` | `"171003406599"` (Longitud `> 10`) | `{ esValida: false }` | **PASS ✅** |
| **TC-06** | `test-card06.js` | `validarCedulaEcuatoriana()` | `"9910034065"` (Provincia `99` inválida) | `{ esValida: false }` | **PASS ✅** |
| **TC-07** | `test-card06.js` | `validarCedulaEcuatoriana()` | `"1790034065"` (3er dígito `9 >= 6`) | `{ esValida: false }` | **PASS ✅** |
| **TC-08** | `test-card06.js` | `validarCedulaEcuatoriana()` | `"1710034069"` (Verificador erróneo) | `{ esValida: false }` | **PASS ✅** |
| **TC-09** | `test-card06.js` | `hashearPassword()` | `"TransOrense#2026"` | String con prefijo `"$argon2id$"` | **PASS ✅** |
| **TC-10** | `test-card06.js` | `verificarPassword()` | `(hash, "TransOrense#2026")` vs. `"ClaveErronea123"` | `true` para clave correcta / `false` para errónea | **PASS ✅** |
| **TC-11** | `test-card07.js` | `generarTokenJWT()` | Usuario con `_id` UUID v7 y `roles: ["agente_boleteria"]` | Token JWT firmado de longitud `> 20` | **PASS ✅** |
| **TC-12** | `test-card07.js` | `verificarTokenJWT()` | Token JWT válido | Claims exactos (`sub`, `correo`, `roles`, `nombre`) | **PASS ✅** |
| **TC-13** | `test-card07.js` | `verificarTokenJWT()` | `token.slice(0, -5) + "abcde"` (Firma alterada) | Lanza excepción `/invalid signature\|jwt malformed/i` | **PASS ✅** |
| **TC-14** | `test-card08-09.js` | `authMiddleware()` | Petición HTTP sin header `Authorization` | `res.statusCode === 401`, `next()` no invocado | **PASS ✅** |
| **TC-15** | `test-card08-09.js` | `authMiddleware()` | Header `Bearer <tokenValido>` | `next()` invocado y `req.usuario.sub` inyectado | **PASS ✅** |
| **TC-16** | `test-card08-09.js` | `roleMiddleware()` | Rol `["cliente"]` en ruta de Boletería | `res.statusCode === 403 Forbidden` | **PASS ✅** |
| **TC-17** | `test-card08-09.js` | `roleMiddleware()` | Rol `["agente_boleteria"]` en ruta de Boletería | `next()` invocado (`200 OK`) | **PASS ✅** |
| **TC-18** | `test-card08-09.js` | `roleMiddleware()` | Rol `["administrador"]` en ruta exclusiva de Auditoría | `next()` invocado (*Bypass* jerárquico total) | **PASS ✅** |
| **TC-19** | `test-card17.js` | `registrarPasajeros()` | Petición sin sesión autenticada (`usuario: null`) | `res.statusCode === 401 Unauthorized` | **PASS ✅** |
| **TC-20** | `test-card17.js` | `pagos.controller.js` | Verificación de directorio local `uploads/comprobantes` | `fs.existsSync(dirUploads) === true` | **PASS ✅** |
| **TC-21** | `test-card19.js` | `pagos.controller.js` | Exportación de `aprobarPago` y `rechazarPago` y RBAC | `typeof === "function"`, `cliente` bloqueado con `403` | **PASS ✅** |
| **TC-22** | `test-card20.js` | `calcularTarifaEncomienda()` | Caso A: `1.5 kg`, `20x15x10 cm` (`<= 2 kg`) | `peso_volumetrico: 0.6`, `precio_estimado: 3.50` | **PASS ✅** |
| **TC-23** | `test-card20.js` | `calcularTarifaEncomienda()` | Caso B: `1.0 kg`, `50x40x30 cm` (Voluminoso) | `peso_volumetrico: 12`, `precio_estimado: 11.50` | **PASS ✅** |
| **TC-24** | `test-card20.js` | `calcularTarifaEncomienda()` | Caso C: `10.0 kg`, `10x10x10 cm` (Pesado) | `peso_facturable: 10`, `precio_estimado: 9.90` | **PASS ✅** |
| **TC-25** | `test-card20.js` | `generarCodigoRastreo()` | Muestreo de 1,000 iteraciones continuas | Prefijo `TRO-`, longitud `12`, `0` colisiones (`Set` = 1000) | **PASS ✅** |
| **TC-26** | `test-card21.js` | `registrarMovimientoEncomienda()` | Rol `["cliente"]` intentando mover encomienda | `res.statusCode === 403 Forbidden` | **PASS ✅** |
| **TC-27** | `test-card21.js` | `registrarMovimientoEncomienda()` | `nuevo_estado: "estado_inventado_xyz"` | `res.statusCode === 400 Bad Request` | **PASS ✅** |
| **TC-28** | `test-card21.js` | `registrarMovimientoEncomienda()` | `nuevo_estado: "en_transito"`, `ubicacion: ""` | `res.statusCode === 400 Bad Request` | **PASS ✅** |
| **TC-29** | `test-card21.js` | `rastrearEncomiendaPublico()` | Parámetro `codigo: ""` vacío | `res.statusCode === 400 Bad Request` | **PASS ✅** |
| **TC-30** | `test-auditoria-incidencias.js` | `listarAuditoria` (RBAC) | Roles `["cliente"]` y `["agente_boleteria"]` | Bloqueados con `403`; solo `["administrador"]` pasa | **PASS ✅** |
| **TC-31** | `test-auditoria-incidencias.js` | `reportarIncidencia()` | `titulo: "abc"` (`< 4` caracteres) | `res.statusCode === 400 Bad Request` | **PASS ✅** |
| **TC-32** | `test-auditoria-incidencias.js` | `reportarIncidencia()` | `severidad: "super_urgente"` (fuera de enum) | `res.statusCode === 400 Bad Request` | **PASS ✅** |
| **TC-33** | `test-card29.js` | Filtro `vence_en > ahora` | Reserva en asiento `"4"` con `vence_en` hace 5 min | Asiento `"4"` liberado inmediatamente (`false`) | **PASS ✅** |
| **TC-34** | `test-card29.js` | Worker de Limpieza | `iniciarWorkerLimpieza()` y `detenerWorkerLimpieza()` | Arranque y parada limpia del proceso en segundo plano | **PASS ✅** |
| **TC-35** | `test-card31.js` | `escapeRegex()` | `".*+?^${}()\|[]\\"` | `"\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\\|\\[\\]\\\\"` | **PASS ✅** |
| **TC-36** | `test-card31.js` | `escapeRegex()` | `"Machala (Terminal [Andén 4+"` en `new RegExp()` | No lanza `SyntaxError` y evalúa coincidencia exacta | **PASS ✅** |
| **TC-37** | `test-card31.js` | `escapeRegex()` | Payload ReDoS `"^(a+)+$"` contra `"aaaa..."` | Neutralizado en $O(1)$ sin *backtracking* exponencial | **PASS ✅** |
| **TC-38** | `test-card31.js` | `escapeRegex()` | Entradas no string (`null`, `undefined`, `12345`) | Retorna cadena vacía `""` sin excepción | **PASS ✅** |
| **TC-39** | `test-card32.js` | `validarArchivoComprobante()` | Buffers con *Magic Numbers* `JPEG`, `PNG`, `PDF`, `WEBP` | `{ esValido: true }` con extensión y MIME exactos | **PASS ✅** |
| **TC-40** | `test-card32.js` | `validarArchivoComprobante()` | Payload XSS `<script>alert('xss')</script>` y `.exe` (`4D 5A`) | `{ esValido: false }` (Spoofing bloqueado) | **PASS ✅** |
| **TC-41** | `test-card32.js` | `validarArchivoComprobante()` | Buffer de `5 MB + 1 KB` (`MAX_BYTES_PERMITIDOS + 1024`) | `{ esValido: false, error: "supera el tamaño máximo" }` | **PASS ✅** |
| **TC-42** | `test-card32.js` | Mitigación *Path Traversal* | Ruta maliciosa `"../../../etc/passwd"` | Neutralizada a `"passwd"` sin `".."` | **PASS ✅** |
| **TC-43** | `test-card32.js` | `guardarComprobanteEnDisco()` | Base64 con encabezado `.jpeg` falso pero contenido `<script>` | Lanza excepción con `err.statusCode === 400` | **PASS ✅** |
| **TC-44** | `test-card33.js` | `limiterAuth` (Rate Limit) | 11 peticiones seguidas a `POST /api/auth/login` | Peticiones 1–10 pasan (`next`); la 11.ª recibe `HTTP 429` | **PASS ✅** |
| **TC-45** | `test-card33.js` | `limiterReservas` (Rate Limit) | 21 peticiones seguidas a `POST /api/reservas` | Peticiones 1–20 pasan (`next`); la 21.ª recibe `HTTP 429` | **PASS ✅** |
| **TC-46** | `test-e2e.js` | Bloqueo Concurrente Redis | 2 clientes intentando reservar asientos `"15"` y `"16"` | Primer cliente bloquea con TTL `600s`; segundo detecta colisión | **PASS ✅** |
| **TC-47** | `test-e2e.js` | Rastreo Público (LOPDP) | Consulta pública de guía `TRX-...` | `dni_remitente === undefined` y `telefono === undefined` | **PASS ✅** |
| **TC-48** | `test-e2e.js` | Bitácora `$jsonSchema` | Evento `APROBAR_PAGO_BOLETERIA` | `_id` UUID v7 válido y `estado` dentro del enum Atlas | **PASS ✅** |

---

## 5. Instrucciones para Ejecutar la Suite Completa en Vivo (Demostración Docente)

Para ejecutar todas las pruebas TDD desde la terminal local (sin necesidad de conexión externa gracias a los mocks deterministas):

```powershell
# 1. Ubicarse en la carpeta del backend
cd backend

# 2. Definir variables de entorno de prueba para la sesión de PowerShell
$env:NODE_ENV="test"
$env:JWT_SECRET="super_secreto_transorense_ci_pipeline_2026"
$env:UPSTASH_REDIS_REST_URL="https://mock-redis.upstash.io"
$env:UPSTASH_REDIS_REST_TOKEN="mock_token_for_ci"

# 3. Ejecutar las 13 suites completas encadenadas
npm test

# O ejecutar únicamente la suite integral End-to-End (E2E)
npm run test:e2e
```

### Resumen de Métricas de Calidad Obtenidas
* **Total de Suites Automatizadas:** `13 / 13` (`100% PASS`)
* **Total de Casos de Prueba Verificados:** `48 / 48` (`0 errores`, `0 regresiones`)
* **Cobertura de Reglas Críticas de Negocio:** `100%` (Módulo 10, Argon2id, JWT/RBAC, TTL de Asientos 600s, Tarifación Volumétrica, Códigos `TRO-XXXXXXXX`, ReDoS, Magic Numbers, Rate Limiting `HTTP 429`, LOPDP y Auditoría Inmutable).

