# Plataforma Transaccional de Boletería Interprovincial y Encomiendas TransOrense

**Realizado por:** Sanyi Cajamarca, Noemí Cajamarca

Sistema web y móvil de arquitectura distribuida desarrollado para la Cooperativa de Transporte Interprovincial **TransOrense** (Provincia de El Oro, Ecuador). La plataforma digitaliza el ciclo operativo completo de comercialización de boletos interprovinciales con bloqueo concurrente de asientos en tiempo real, validación de transferencias bancarias, emisión de pasajes digitales con código QR, cotización volumétrica de carga y rastreo público de encomiendas bajo cumplimiento de la Ley Orgánica de Protección de Datos Personales (LOPDP).

## Características Principales

1. **Reserva Concurrente de Asientos en Tiempo Real:** Mapa interactivo del bus con bloqueo temporal atómico de 10 minutos (600 segundos) respaldado por Upstash Redis, índices únicos condicionales en MongoDB Atlas y un proceso autónomo de limpieza de reservas expiradas.
2. **Validación Algorítmica de Identidad (Módulo 10):** Verificación matemática estricta de cédulas de ciudadanía ecuatorianas de 10 dígitos tanto en el registro de usuarios como en la nómina de pasajeros y guías de remisión.
3. **Autenticación Híbrida y Criptografía Moderna:** Inicio de sesión federado mediante Google Identity Services (OAuth 2.0) y autenticación local protegida con hashing de contraseñas **Argon2id** y sesiones sin estado firmadas con **JSON Web Tokens (JWT)**.
4. **Control de Acceso Basado en Roles (RBAC):** Segregación operativa en cuatro perfiles (`cliente`, `agente_boleteria`, `operador_encomiendas` y `administrador`) verificada mediante interceptores de autorización en el servidor y guardias reactivas en el cliente.
5. **Gestión Logística y Tarifación Volumétrica de Encomiendas:** Cálculo automatizado del peso tasable comparando el peso físico en báscula frente al peso volumétrico ($\text{Largo} \times \text{Ancho} \times \text{Alto} / 5000$), emisión de guías no secuenciales con formato `TRO-XXXXXXXX` y línea de tiempo de seguimiento público con enmascaramiento de datos sensibles.
6. **Boletos Digitales y Guías Térmicas con Código QR:** Generación instantánea de comprobantes electrónicos verificables listos para descarga en PDF e impresión térmica en agencia.
7. **Auditoría Inmutable y Seguridad Multicapa:** Bitácora centralizada de eventos críticos, inspección binaria de archivos mediante firmas hexadecimales (*Magic Numbers*), sanitización de expresiones regulares contra ataques *ReDoS* y limitación de tasa de peticiones (*Rate Limiting*).

## Stack Tecnológico

| Capa del Sistema | Tecnología Implementada | Propósito en la Arquitectura |
| :--- | :--- | :--- |
| **Frontend Web / Móvil** | Angular 19 + TypeScript | Aplicación de página única (SPA) con arquitectura modular, formularios reactivos y diseño adaptable (*Mobile-First*). |
| **Sistema de Diseño UI** | Tailwind CSS + SweetAlert2 | Estilizado institucional (Verde `#00875A`, Amarillo `#FFCC00`, Azul `#003399`), modo claro/oscuro y vistas híbridas para pantallas móviles. |
| **Backend API REST** | Node.js 22 + Express 5 | Servidor de aplicaciones estructurado por capas (rutas, middlewares, controladores, servicios y utilidades). |
| **Persistencia Documental** | MongoDB Atlas | Base de datos NoSQL principal con 12 colecciones gobernadas por validación nativa `$jsonSchema` e identificadores `UUID v7`. |
| **Memoria y Concurrencia** | Upstash Redis | Motor NoSQL clave-valor en memoria para bloqueo atómico de asientos con TTL, caché de rutas y métricas operativas. |
| **Seguridad y Autenticación** | Google OAuth 2.0 + Argon2id + JWT | Verificación de identidad federada, cifrado resistente a GPU y control de sesiones por roles. |
| **Integración Continua** | GitHub Actions | Pipeline automatizado de compilación de producción en Angular y ejecución de las 13 suites de pruebas del backend. |

## Estructura del Proyecto

```text
Proyecto-Parcial-I-PM/
├── .github/
│   └── workflows/
│       └── ci.yml
├── backend/
│   ├── controllers/
│   ├── database/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   ├── tests/
│   ├── uploads/
│   ├── utils/
│   ├── index.js
│   └── package.json
├── docs/
│   ├── ESPECIFICACION_Y_REPORTE_TDD.md
│   ├── MEMORIA_TECNICA_ARQUITECTURA.md
│   └── OPENAPI_SPEC.yaml
└── frontend/
    ├── public/
    ├── src/
    │   ├── app/
    │   │   ├── core/
    │   │   ├── features/
    │   │   └── shared/
    │   ├── index.html
    │   └── styles.css
    ├── angular.json
    └── package.json
```

## Arquitectura de Bases de Datos NoSQL

### Colecciones Documentales en MongoDB Atlas (`transorense`)

Todas las colecciones utilizan identificadores universales ordenables temporalmente **UUID v7** como clave primaria (`_id`) y aplican reglas de validación `$jsonSchema` en el motor de base de datos:

| Colección | Descripción Funcional | Índices y Reglas Clave |
| :--- | :--- | :--- |
| `usuarios` | Cuentas de clientes y personal operativo con roles RBAC. | Índice único en `correo` y validación de longitud de `cedula`. |
| `rutas` | Catálogo de rutas interprovinciales, terminales y duración estimada. | Validación de origen, destino, distancia y estado. |
| `buses` | Unidades de transporte, placa, número de disco y capacidad de asientos. | Índice único sobre el campo `placa`. |
| `viajes` | Programación de frecuencias diarias vinculando ruta, bus y tarifa. | Índices compuestos por ruta, fecha de salida y estado. |
| `reservas` | Apartado temporal (10 minutos) y confirmación definitiva de asientos. | Índice único parcial `uq_asiento_reserva_activa` contra sobreventa. |
| `pasajeros` | Nómina de viajeros asignados a cada asiento con cédula validada. | Vinculación directa con `reserva_id` y verificación Módulo 10. |
| `pagos` | Registro de transferencias bancarias y rutas protegidas de comprobantes. | Índice único parcial `uq_pago_aprobado_reserva`. |
| `cotizaciones_encomienda` | Historial de simulaciones tarifarias por peso real y volumétrico. | Almacenamiento de dimensiones, peso facturable y monto estimado. |
| `encomiendas` | Guías oficiales de carga con datos de remitente y destinatario. | Índice único sobre `codigo_rastreo` (`TRO-XXXXXXXX`). |
| `historial_encomienda` | Trazabilidad cronológica de estados y ubicaciones físicas del paquete. | Relación con `encomienda_id` y operador responsable. |
| `auditoria` | Bitácora inmutable de acciones críticas ejecutadas en la plataforma. | Registro de usuario, rol, acción, entidad afectada y marca de tiempo. |
| `incidencias` | Reportes técnicos categorizados por nivel de severidad operativa. | Clasificación en severidad `baja`, `media`, `alta` y `critica`. |

### Estructuras en Memoria en Upstash Redis

| Espacio de Nombres (Key Pattern) | Tipo de Dato | Tiempo de Vida (TTL) | Propósito Operativo |
| :--- | :--- | :--- | :--- |
| `asiento:{viajeId}:{numero}` | `STRING` | 600 segundos | Bloqueo atómico temporal del asiento durante el proceso de compra. |
| `cache:viajes:{origen}:{destino}:{fecha}` | `STRING` (JSON) | 300 segundos | Aceleración de consultas públicas frecuentes de horarios disponibles. |
| `configuracion:empresa` / `politicas:reservas` | `HASH` | Permanente | Parámetros globales de operación, tarifas base y tiempos de expiración. |
| `rutas:populares` / `terminales:activas` | `SET` | Permanente | Conjuntos de acceso rápido para autocompletado y filtrado en el portal. |

## Metodologías de Ingeniería y Documentación Técnica

El repositorio incluye la documentación formal de arquitectura, contratos de interfaz y verificación automatizada en el directorio `docs/`:

* **Desarrollo Basado en Especificaciones (SDD):** Contrato formal OpenAPI 3.0 disponible en [`docs/OPENAPI_SPEC.yaml`](docs/OPENAPI_SPEC.yaml), donde se definen los esquemas de entrada, respuestas HTTP y modelos de error de todos los endpoints.
* **Desarrollo Guiado por Pruebas (TDD):** Especificación del ciclo *Red $\rightarrow$ Green $\rightarrow$ Refactor* y matriz de 48 casos de prueba verificados en [`docs/ESPECIFICACION_Y_REPORTE_TDD.md`](docs/ESPECIFICACION_Y_REPORTE_TDD.md).
* **Memoria Técnica y Flujo GitFlow:** Justificación arquitectónica, estrategia de ramificación (`main`, `dev`, `feature/*`, `fix/*`, `docs/*`) y controles de seguridad en [`docs/MEMORIA_TECNICA_ARQUITECTURA.md`](docs/MEMORIA_TECNICA_ARQUITECTURA.md).

## Requisitos Previos e Instalación Local

### Requisitos del Entorno
* **Node.js:** versión 20.x o 22.x LTS
* **NPM:** versión 10.x o superior
* **Angular CLI:** versión 19.x
* Instancia activa en **MongoDB Atlas** y base de datos en **Upstash Redis**

### 1. Configuración del Backend

Crear un archivo `.env` dentro de la carpeta `backend/` tomando como referencia la plantilla `backend/.env.example`:

```env
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:4200
MONGODB_URI=mongodb+srv://<usuario>:<password>@<cluster>.mongodb.net/transorense?retryWrites=true&w=majority
MONGODB_DB_NAME=transorense
UPSTASH_REDIS_REST_URL=https://<instancia>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<token_upstash>
JWT_SECRET=<secreto_criptografico_jwt>
JWT_EXPIRES_IN=8h
GOOGLE_CLIENT_ID=<client_id_google_oauth>
```

Instalar las dependencias, inicializar los esquemas de base de datos y levantar el servidor Express:

```bash
cd backend
npm install
npm run db:init
npm run redis:init
npm run dev
```

El servidor API REST quedará disponible en `http://localhost:3000`.

### 2. Configuración del Frontend

En una nueva terminal, instalar las dependencias del cliente Angular y ejecutar el servidor de desarrollo:

```bash
cd frontend
npm install --legacy-peer-deps
npm start
```

La aplicación web estará disponible en `http://localhost:4200`.

## Ejecución de Pruebas Automatizadas (TDD y E2E)

El backend incorpora 12 suites de pruebas unitarias por módulo y 1 suite de integración *End-to-End* (E2E) que validan los 48 casos de prueba del sistema sin requerir servicios externos mediante mocks HTTP deterministas:

```bash
cd backend
npm test
npm run test:e2e
```

