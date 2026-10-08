/**
 * =====================================================================
 * CONFIG.JS — CONFIGURACIÓN DE INTEGRACIÓN CON API DE NODEX
 * =====================================================================
 */

const API_BASE_URL = "https://api.nodexgpa.com";
const ENDPOINT_PROGRAMACION = "/api/externa/mensajeros/tramites";
const API_KEY_EXTERNA = "cbN4NViOhHcuKIqiIX1IKX24so-U3Q6N38g2QaeeddM";

const CAMPO = {
  mensajero: "nombreTramitador",
  sede: "departamento",
  radicado: "tramiteId",
  tipo_diligencia: "tipoDiligencia",
  hora_inicio: "horaInicio",
  hora_fin: "fechaFin",
  estado: "estado",
  municipio: "municipio",
  entidad: "direccion",
  es_bloqueo: "es_bloqueo",
  es_dia_completo: "es_dia_completo",
};

// Mantén aquí tus objetos de colores y DATOS_FALLBACK tal cual los tenías en tu código original.
// ─────────────────────────────────────────────────────────────────────
// 4. PALETA DE COLORES POR MENSAJERO
//    Se asignan automáticamente en orden si hay más mensajeros de los configurados.
//    Puedes agregar más entradas con el nombre exacto que devuelve la API.
// ─────────────────────────────────────────────────────────────────────
const COLORES_MENSAJERO = {
  "Carlos León": { bg: "bg-blue-600", ring: "ring-blue-400", accent: "blue" },
  "Carlos Eduardo Leon Merchan": {
    bg: "bg-blue-600",
    ring: "ring-blue-400",
    accent: "blue",
  },
  "Fredy Yesid Bernal": {
    bg: "bg-indigo-600",
    ring: "ring-indigo-400",
    accent: "indigo",
  },
  "Gonzalo Romero": {
    bg: "bg-teal-600",
    ring: "ring-teal-400",
    accent: "teal",
  },
  "Eric Quiceno": { bg: "bg-rose-600", ring: "ring-rose-400", accent: "rose" },
};

// Colores de rotación para mensajeros adicionales no configurados arriba
const COLORES_EXTRA = [
  { bg: "bg-purple-600", ring: "ring-purple-400", accent: "purple" },
  { bg: "bg-orange-600", ring: "ring-orange-400", accent: "orange" },
  { bg: "bg-cyan-600", ring: "ring-cyan-400", accent: "cyan" },
  { bg: "bg-lime-600", ring: "ring-lime-400", accent: "lime" },
];

// ─────────────────────────────────────────────────────────────────────
// 5. DATASET DE FALLBACK
//    Si la API no responde, se muestran estos datos de ejemplo para que
//    el calendario nunca quede en blanco.
// ─────────────────────────────────────────────────────────────────────
const DATOS_FALLBACK = [
  {
    mensajero: "Carlos León",
    sede: "bogota",
    radicado: "NX-10492",
    tipo_diligencia: "Entrega Notificación Judicial",
    hora_inicio: "08:00",
    hora_fin: "09:30",
    estado: "Programada",
    municipio: "Bogotá - Usaquén",
    entidad: "Juzgado 14 Civil",
    es_bloqueo: false,
    es_dia_completo: false,
  },
  {
    mensajero: "Carlos León",
    sede: "bogota",
    radicado: "NX-10498",
    tipo_diligencia: "Retiro Expediente Notaría 45",
    hora_inicio: "09:45",
    hora_fin: "11:15",
    estado: "En Curso",
    municipio: "Bogotá - Chapinero",
    entidad: "Notaría 45",
    es_bloqueo: false,
    es_dia_completo: false,
  },
  {
    mensajero: "Carlos León",
    sede: "bogota",
    radicado: "NX-10512",
    tipo_diligencia: "Firma Poder Especial",
    hora_inicio: "14:00",
    hora_fin: "15:30",
    estado: "Programada",
    municipio: "Bogotá - Suba",
    entidad: "Cliente Corp",
    es_bloqueo: false,
    es_dia_completo: false,
  },
  {
    mensajero: "Carlos León",
    sede: "bogota",
    radicado: "NX-10520",
    tipo_diligencia: "Radicación Memorial Super",
    hora_inicio: "15:45",
    hora_fin: "17:00",
    estado: "Programada",
    municipio: "Bogotá - Barrios Unidos",
    entidad: "Superintendencia",
    es_bloqueo: false,
    es_dia_completo: false,
  },
  {
    mensajero: "Fredy Yesid Bernal",
    sede: "bogota",
    radicado: "NX-10495",
    tipo_diligencia: "Diligencia Juzgado Municipal",
    hora_inicio: "08:00",
    hora_fin: "10:00",
    estado: "Completada",
    municipio: "Soacha (Cundinamarca)",
    entidad: "Juzgado 2",
    es_bloqueo: false,
    es_dia_completo: false,
  },
  {
    mensajero: "Fredy Yesid Bernal",
    sede: "bogota",
    radicado: "NX-10501",
    tipo_diligencia: "Entrega Paquete Documental",
    hora_inicio: "10:30",
    hora_fin: "12:00",
    estado: "En Curso",
    municipio: "Bogotá - Kennedy",
    entidad: "Sede Central",
    es_bloqueo: false,
    es_dia_completo: false,
  },
  {
    mensajero: "Fredy Yesid Bernal",
    sede: "bogota",
    radicado: "BLQ-9982",
    tipo_diligencia: "Reserva preventiva Nodex",
    hora_inicio: "13:00",
    hora_fin: "14:30",
    estado: "Bloqueada",
    municipio: "",
    entidad: "Operaciones Nodex",
    es_bloqueo: true,
    es_dia_completo: false,
  },
  {
    mensajero: "Fredy Yesid Bernal",
    sede: "bogota",
    radicado: "NX-10515",
    tipo_diligencia: "Firma Proveedor Industrial",
    hora_inicio: "14:45",
    hora_fin: "16:00",
    estado: "Programada",
    municipio: "Bogotá - Puente Aranda",
    entidad: "Industrial S.A.",
    es_bloqueo: false,
    es_dia_completo: false,
  },
  {
    mensajero: "Fredy Yesid Bernal",
    sede: "bogota",
    radicado: "NX-10528",
    tipo_diligencia: "Entrega Zona Franca",
    hora_inicio: "16:15",
    hora_fin: "17:30",
    estado: "Programada",
    municipio: "Bogotá - Fontibón",
    entidad: "Zona Franca",
    es_bloqueo: false,
    es_dia_completo: false,
  },
  {
    mensajero: "Gonzalo Romero",
    sede: "medellin",
    radicado: "NX-10488",
    tipo_diligencia: "Revisión Palacio de Justicia",
    hora_inicio: "08:30",
    hora_fin: "10:00",
    estado: "Completada",
    municipio: "Medellín - Centro",
    entidad: "Palacio de Justicia",
    es_bloqueo: false,
    es_dia_completo: false,
  },
  {
    mensajero: "Gonzalo Romero",
    sede: "medellin",
    radicado: "NX-10510",
    tipo_diligencia: "Firma Escritura Notaría 16",
    hora_inicio: "13:30",
    hora_fin: "15:00",
    estado: "Programada",
    municipio: "Medellín - El Poblado",
    entidad: "Notaría 16",
    es_bloqueo: false,
    es_dia_completo: false,
  },
  {
    mensajero: "Gonzalo Romero",
    sede: "medellin",
    radicado: "NX-10522",
    tipo_diligencia: "Entrega Cheque Gerencia",
    hora_inicio: "15:30",
    hora_fin: "16:45",
    estado: "Programada",
    municipio: "Envigado",
    entidad: "Bancolombia Envigado",
    es_bloqueo: false,
    es_dia_completo: false,
  },
  {
    mensajero: "Eric Quiceno",
    sede: "medellin",
    radicado: "NX-10490",
    tipo_diligencia: "Entrega Notaría Bello",
    hora_inicio: "08:00",
    hora_fin: "09:30",
    estado: "Completada",
    municipio: "Bello (Antioquia)",
    entidad: "Juzgado Bello",
    es_bloqueo: false,
    es_dia_completo: false,
  },
  {
    mensajero: "Eric Quiceno",
    sede: "medellin",
    radicado: "NX-10504",
    tipo_diligencia: "Trámite Movilidad Tránsito",
    hora_inicio: "10:00",
    hora_fin: "11:30",
    estado: "En Curso",
    municipio: "Medellín - Robledo",
    entidad: "Tránsito",
    es_bloqueo: false,
    es_dia_completo: false,
  },
  {
    mensajero: "Eric Quiceno",
    sede: "medellin",
    radicado: "BLQ-EQ01",
    tipo_diligencia: "Bloqueo operativo cierre",
    hora_inicio: "16:00",
    hora_fin: "17:30",
    estado: "Bloqueada",
    municipio: "",
    entidad: "Operaciones Nodex",
    es_bloqueo: true,
    es_dia_completo: false,
  },
];

// ─────────────────────────────────────────────────────────────────────
// 6. SOLICITUDES PENDIENTES DE PROGRAMACIÓN EN NODEX (BANDEJA DE ENTRADA)
//    Citas enviadas por clientes o juzgados que aún no tienen mensajero asignado.
// ─────────────────────────────────────────────────────────────────────
const CITAS_PENDIENTES_FALLBACK = [
  {
    radicado: "NX-10535",
    tipo_diligencia: "Radicación Trámite Curaduría 1",
    sede: "bogota",
    municipio: "Bogotá - Chapinero",
    entidad: "Curaduría Urbana 1",
    duracion_est: "1.5 horas",
    prioridad: "Alta",
  },
  {
    radicado: "NX-10540",
    tipo_diligencia: "Autenticación Poder Notaría 2",
    sede: "medellin",
    municipio: "Medellín - Centro",
    entidad: "Notaría 2 Medellín",
    duracion_est: "1 hora",
    prioridad: "Media",
  },
  {
    radicado: "NX-10544",
    tipo_diligencia: "Reclamación Certificado DIAN",
    sede: "bogota",
    municipio: "Bogotá - Centro",
    entidad: "DIAN Sede Principal",
    duracion_est: "2 horas",
    prioridad: "Urgente",
  },
];
