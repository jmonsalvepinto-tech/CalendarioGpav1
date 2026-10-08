/**
 * =====================================================================
 * LÓGICA DEL CALENDARIO DE OPERACIONES — NODEX HUB
 * =====================================================================
 * Conecta el tablero interactivo con la API REST de Nodex y ofrece:
 *   1. Navegación por fechas y datepicker interactivo.
 *   2. Detección automática y visual de cruces de horario (conflictos).
 *   3. Bloqueo de jornada completa (incapacidades / permisos / contingencias).
 *   4. Visualización de ranuras / franjas libres ("huecos") para asignación rápida.
 *   5. Copia de hoja de ruta limpia para WhatsApp al mensajero.
 *   6. Bandeja de citas pendientes de Nodex por programar.
 *   7. Buscador instantáneo por radicado, municipio o entidad.
 */

// ─────────────────────────────────────────────────────────────────────
// ESTADO GLOBAL DEL CALENDARIO
// ─────────────────────────────────────────────────────────────────────
let fechaActual = new Date(); // Fecha visible actualmente
let datosCargados = []; // Citas y bloqueos del día actual
let citasPendientes = []; // Bandeja de solicitudes sin asignar
let ciudadFiltroActivo = "todos"; // Filtro de sede activo ('todos', 'bogota', 'medellin')
let coloresAsignados = {}; // Mapa: mensajero → colores Tailwind
let indiceColorExtra = 0; // Rotación de colores para mensajeros dinámicos
let textoBusqueda = ""; // Término de búsqueda en vivo
let mostrarHuecos = true; // Interruptor para visualizar huecos libres
let citaPendienteEnEdicion = null; // Referencia a cita de la bandeja en proceso de asignación

// ─────────────────────────────────────────────────────────────────────
// TEMA VISUAL
// ─────────────────────────────────────────────────────────────────────
function aplicarTema(tema) {
  const oscuro = tema === "dark";
  document.documentElement.dataset.theme = oscuro ? "dark" : "light";
  const boton = document.getElementById("themeToggle");
  const etiqueta = document.getElementById("themeToggleLabel");
  const iconoLuna = document.getElementById("themeIconMoon");
  const iconoSol = document.getElementById("themeIconSun");

  if (boton) {
    boton.setAttribute("aria-pressed", String(oscuro));
    boton.setAttribute(
      "aria-label",
      oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro",
    );
  }
  if (etiqueta) etiqueta.textContent = oscuro ? "Modo claro" : "Modo oscuro";
  if (iconoLuna) iconoLuna.hidden = oscuro;
  if (iconoSol) iconoSol.hidden = !oscuro;

  const metaTema = document.querySelector('meta[name="theme-color"]');
  if (metaTema) metaTema.content = oscuro ? "#0b1220" : "#10243a";
}

function alternarTema() {
  const siguiente =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  aplicarTema(siguiente);
  try {
    localStorage.setItem("nodex-theme", siguiente);
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────
// 1. INICIALIZACIÓN
// ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  aplicarTema(
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );
  // Inicializar bandeja con fallback de Nodex
  citasPendientes = [
    ...(typeof CITAS_PENDIENTES_FALLBACK !== "undefined"
      ? CITAS_PENDIENTES_FALLBACK
      : []),
  ];
  actualizarBadgePendientes();

  // Establecer fecha y cargar
  sincronizarControlesFecha();
  cargarDatosDesdeAPI();
});

// ─────────────────────────────────────────────────────────────────────
// 2. CARGA DE DATOS DESDE LA API (O FALLBACK)
// ─────────────────────────────────────────────────────────────────────

let modoDemostracionManual = false;
let todosLosTramitesAPI = []; // Todos los trámites de Nodex en caché local
let totalTramitesEnNodex = 0;

function mapearNombreMensajero(nombre) {
  if (!nombre) return "";
  const n = String(nombre)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (n.includes("carlos") && n.includes("leon")) return "Carlos León";
  if (
    n.includes("fredy") ||
    n.includes("freddy") ||
    n.includes("bernal") ||
    n.includes("yessid") ||
    n.includes("yesid")
  )
    return "Fredy Yesid Bernal";
  if (n.includes("gonzalo") || n.includes("romero")) return "Gonzalo Romero";
  if (n.includes("eric") || n.includes("quiceno") || n.includes("john"))
    return "Eric Quiceno";
  return String(nombre).trim();
}

/**
 * Consulta la API de Nodex cargando las páginas más recientes primero (donde están hoy y fechas actuales).
 */
async function cargarDatosDesdeAPI(forzarModoPrueba = null, forzarRecargaAPI = false) {
  mostrarEstadoCarga(true);
  ocultarMensajeError();
  ocultarMensajeInfo();

  if (typeof forzarModoPrueba === "boolean") {
    modoDemostracionManual = forzarModoPrueba;
  }

  // 1. Detección de protocolo file:// (cuando el usuario hace doble clic en el archivo)
  if (window.location.protocol === "file:") {
    console.warn("[Nodex] Ejecutando desde file://. CORS bloquea llamadas directas.");
    mostrarMensajeError(
      "⚠️ Estás abriendo el proyecto con doble clic (protocolo file://). Los navegadores bloquean peticiones a APIs por seguridad (CORS). Haz doble clic en 'iniciar_servidor.bat' (o abre con Live Server de VS Code) para conectar en vivo con la API de Nodex. Mostrando datos locales de demostración."
    );
    cargarDatosFallback();
    procesarYRenderizar();
    mostrarEstadoCarga(false);
    return;
  }

  const baseUrl =
    typeof API_BASE_URL !== "undefined"
      ? API_BASE_URL
      : "https://api.nodexgpa.com";
  const endpoint =
    typeof ENDPOINT_PROGRAMACION !== "undefined"
      ? ENDPOINT_PROGRAMACION
      : "/api/externa/mensajeros/tramites";
  const apiKey =
    typeof API_KEY_EXTERNA !== "undefined"
      ? API_KEY_EXTERNA
      : "cbN4NViOhHcuKIqiIX1IKX24so-U3Q6N38g2QaeeddM";

  const url = `${baseUrl}${endpoint}`;

  try {
    // Si la caché de la API está vacía o se pulsa Sincronizar (forzarRecargaAPI)
    if (todosLosTramitesAPI.length === 0 || forzarRecargaAPI) {
      console.log("[Nodex API] Consultando trámites desde Nodex...");
      
      // Consultamos la primera página con tamano=500 para saber el total de páginas
      const primeraRespuesta = await fetch(`${url}?tamano=500&pagina=1`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-api-key": apiKey,
        },
      });

      if (!primeraRespuesta.ok) {
        throw new Error(`HTTP ${primeraRespuesta.status}: ${primeraRespuesta.statusText}`);
      }

      const primeraData = await primeraRespuesta.json();
      totalTramitesEnNodex = primeraData.total || (primeraData.datos ? primeraData.datos.length : 0);
      const totalPaginas = primeraData.paginas || 1;

      let acumulados = [];

      if (totalPaginas <= 1) {
        acumulados = Array.isArray(primeraData) ? primeraData : (primeraData.datos || []);
      } else {
        // En Nodex los registros están ordenados del más antiguo (abril) al más nuevo (hoy).
        // Descargamos de inmediato las páginas más recientes (la última y las anteriores),
        // donde se encuentran los trámites de hoy (octubre) y de las semanas recientes.
        const paginasATraer = [];
        for (let p = totalPaginas; p >= 1 && paginasATraer.length < 5; p--) {
          paginasATraer.push(p);
        }

        // Si la página 1 no está incluida y queda espacio, la agregamos
        for (const p of paginasATraer) {
          try {
            if (p === 1) {
              const d1 = Array.isArray(primeraData) ? primeraData : (primeraData.datos || []);
              acumulados = acumulados.concat(d1);
            } else {
              const r = await fetch(`${url}?tamano=500&pagina=${p}`, {
                headers: { Accept: "application/json", "x-api-key": apiKey },
              });
              if (r.ok) {
                const j = await r.json();
                if (Array.isArray(j.datos)) {
                  acumulados = acumulados.concat(j.datos);
                }
              }
            }
          } catch (e) {
            console.warn(`[Nodex] Error al cargar página ${p}:`, e);
          }
        }
      }

      todosLosTramitesAPI = acumulados;
      console.log(`[Nodex API] ${todosLosTramitesAPI.length} trámites recientes recibidos de Nodex.`);
    }

    if (modoDemostracionManual) {
      cargarDatosFallback();
      actualizarTimestampUltimaActualizacion(true, null, "Demostración (API conectada)");
      mostrarMensajeInfo(
        "Visualizando datos de prueba. La API de Nodex está conectada y operativa.",
        "Ver datos reales de la API"
      );
      procesarYRenderizar();
      return;
    }

    // 2. Aplicar filtro y distribución de la fecha seleccionada
    aplicarTramitesParaFechaActual();

  } catch (error) {
    console.warn(`[Nodex API] Fallo de conexión (${error.message}). Usando fallback.`);
    cargarDatosFallback();
    actualizarTimestampUltimaActualizacion(true);
    mostrarMensajeError(
      `No fue posible obtener datos de la API de Nodex (${error.message}). Mostrando datos locales de ejemplo.`
    );
    procesarYRenderizar();
  } finally {
    mostrarEstadoCarga(false);
  }
}

/**
 * Filtra los trámites en memoria para la fecha actual, asigna sólo los que tienen mensajero
 * y envía a la bandeja de pendientes aquellos sin asignar.
 */
function aplicarTramitesParaFechaActual() {
  const fechaParam = formatearFechaISO(fechaActual);

  // 1. Trámites de la fecha seleccionada
  const tramitesDelDia = todosLosTramitesAPI.filter((raw) => {
    const f = normalizarFecha(raw.fechaInicio || raw.fecha || raw.fechaFin || "");
    return f === fechaParam;
  });

  const citasAsignadas = [];
  const tramitesSinMensajeroDelDia = [];

  // Contador de distribución de franjas por mensajero para evitar solapamientos artificiales
  const conteoPorMensajero = {};

  tramitesDelDia.forEach((filaRaw) => {
    const rawMensajero =
      filaRaw.nombreTramitador ||
      filaRaw.nombre_tramitador ||
      filaRaw.tramitador ||
      filaRaw.mensajero ||
      "";

    const tieneMensajero = Boolean(rawMensajero && String(rawMensajero).trim() !== "");

    if (tieneMensajero) {
      const nombreMapeado = mapearNombreMensajero(rawMensajero);
      conteoPorMensajero[nombreMapeado] = (conteoPorMensajero[nombreMapeado] || 0);
      const normalizada = normalizarFila(filaRaw, conteoPorMensajero[nombreMapeado]);
      conteoPorMensajero[nombreMapeado]++;
      citasAsignadas.push(normalizada);
    } else {
      const normalizada = normalizarFila(filaRaw, 0);
      tramitesSinMensajeroDelDia.push({
        radicado: normalizada.radicado,
        tramiteId: normalizada.tramiteId,
        tipo_diligencia: normalizada.tipo_diligencia,
        sede: normalizada.sede,
        municipio: normalizada.municipio,
        entidad: normalizada.entidad,
        duracion_est: "1 hora",
        prioridad: filaRaw.prioridad || "Media",
      });
    }
  });

  // 2. Trámites sin mensajero en general (para la bandeja de pendientes de Nodex)
  const backlogSinMensajero = [];
  todosLosTramitesAPI.forEach((filaRaw) => {
    const m = filaRaw.nombreTramitador || filaRaw.nombre_tramitador || filaRaw.mensajero;
    if (!m || String(m).trim() === "") {
      const norm = normalizarFila(filaRaw, 0);
      backlogSinMensajero.push({
        radicado: norm.radicado,
        tramiteId: norm.tramiteId,
        tipo_diligencia: norm.tipo_diligencia,
        sede: norm.sede,
        municipio: norm.municipio,
        entidad: norm.entidad,
        duracion_est: "1 hora",
        prioridad: filaRaw.prioridad || "Media",
      });
    }
  });

  datosCargados = citasAsignadas;
  citasPendientes = backlogSinMensajero.length > 0 ? backlogSinMensajero : tramitesSinMensajeroDelDia;
  actualizarBadgePendientes();

  actualizarTimestampUltimaActualizacion(
    false,
    citasAsignadas.length,
    `Nodex (${citasAsignadas.length} asignadas hoy · ${todosLosTramitesAPI.length} en total)`
  );

  if (citasAsignadas.length === 0 && tramitesDelDia.length === 0) {
    mostrarMensajeInfo(
      `Conectado a Nodex. No hay diligencias registradas para esta fecha (${fechaParam}). Hay ${todosLosTramitesAPI.length} diligencias en otras fechas.`,
      "Cargar datos de prueba"
    );
  } else {
    ocultarMensajeInfo();
  }

  procesarYRenderizar();
}

function cargarDatosFallback() {
  const fallback = typeof DATOS_FALLBACK !== "undefined" ? DATOS_FALLBACK : [];
  datosCargados = fallback.map((f) => ({ ...f }));
  if (typeof CITAS_PENDIENTES_FALLBACK !== "undefined") {
    citasPendientes = [...CITAS_PENDIENTES_FALLBACK];
    actualizarBadgePendientes();
  }
}

function alternarDatosPrueba() {
  modoDemostracionManual = !modoDemostracionManual;
  cargarDatosDesdeAPI(modoDemostracionManual);
}

function normalizarHora(valor, defecto = "08:00") {
  if (!valor) return defecto;
  if (typeof valor === "string") {
    const matchIso = valor.match(/T(\d{2}:\d{2})/i);
    if (matchIso) return matchIso[1];
    const matchSimple = valor.match(/(\d{1,2}):(\d{2})/);
    if (matchSimple) {
      return `${matchSimple[1].padStart(2, "0")}:${matchSimple[2]}`;
    }
  }
  return defecto;
}

function normalizarFecha(valor) {
  if (!valor) return null;
  if (typeof valor === "string") {
    const match = valor.match(/(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  return null;
}

/**
 * Normaliza una fila JSON extrayendo el número de trámite de Nodex (tramiteId) y reconociendo nombreTramitador.
 */
function normalizarFila(fila, indiceSlot = 0) {
  const c = typeof CAMPO !== "undefined" ? CAMPO : {};

  // 1. Mensajero asignado (reconoce nombreTramitador de la API de Nodex)
  let rawMensajero =
    fila.nombreTramitador ||
    fila.nombre_tramitador ||
    fila.tramitador ||
    fila[c.mensajero] ||
    fila.mensajero ||
    fila.mensajero_nombre ||
    fila.nombre_mensajero ||
    fila.usuario ||
    fila.asignado_a ||
    "";
  if (typeof rawMensajero === "object" && rawMensajero !== null) {
    rawMensajero = rawMensajero.nombre || rawMensajero.name || "";
  }
  rawMensajero = String(rawMensajero || "").trim();
  const mensajero = rawMensajero ? mapearNombreMensajero(rawMensajero) : "";

  // 2. Número de trámite de Nodex (tramiteId o radicado)
  const numTramite =
    fila.tramiteId ??
    fila.tramite_id ??
    fila.id_tramite ??
    fila[c.radicado] ??
    fila.radicado ??
    fila.numero_radicado ??
    fila.codigo ??
    fila.id ??
    "";

  const radicado = numTramite
    ? (String(numTramite).toUpperCase().startsWith("NX-") ? String(numTramite) : `NX-${numTramite}`)
    : "S/R";

  // 3. Sede
  let sede = String(
    fila.departamento ||
    fila.municipio ||
    fila[c.sede] ||
    fila.sede ||
    fila.ciudad ||
    ""
  ).toLowerCase().trim();

  if (sede.includes("bogot") || sede.includes("cundinamarca")) {
    sede = "bogota";
  } else if (sede.includes("medell") || sede.includes("antioquia")) {
    sede = "medellin";
  } else {
    if (mensajero === "Gonzalo Romero" || mensajero === "Eric Quiceno") {
      sede = "medellin";
    } else {
      sede = "bogota";
    }
  }

  // 4. Tipo de diligencia / trámite
  const tipo_diligencia = String(
    fila.tipoDiligencia ||
    fila.tipo_diligencia ||
    fila[c.tipo_diligencia] ||
    fila.tipoTramite ||
    fila.tipo_tramite ||
    fila.diligencia ||
    fila.tramite ||
    fila.titulo ||
    fila.descripcion ||
    fila.asunto ||
    "Diligencia Nodex"
  ).trim();

  // 5. Horarios (respeta horaInicio si viene en la API, o distribuye las franjas ordenadamente)
  const tieneHoraReal = Boolean(fila.horaInicio || fila.hora_inicio);
  let hora_inicio = normalizarHora(fila.horaInicio || fila.hora_inicio || fila[c.hora_inicio]);
  let hora_fin = normalizarHora(fila.horaFin || fila.hora_fin || fila[c.hora_fin]);

  if (!tieneHoraReal) {
    const FRANJAS = [
      { ini: "07:30", fin: "08:30" },
      { ini: "08:45", fin: "09:45" },
      { ini: "10:00", fin: "11:00" },
      { ini: "11:15", fin: "12:15" },
      { ini: "12:30", fin: "13:30" },
      { ini: "14:00", fin: "15:00" },
      { ini: "15:15", fin: "16:15" },
      { ini: "16:30", fin: "17:30" },
    ];
    const f = FRANJAS[indiceSlot % FRANJAS.length];
    hora_inicio = f.ini;
    hora_fin = f.fin;
  } else if (!hora_fin || hora_fin === "09:30") {
    const [h, m] = hora_inicio.split(":").map(Number);
    const finH = Math.min(h + 1, 23);
    hora_fin = `${String(finH).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;
  }

  // 6. Fecha
  const fechaStr = fila.fechaInicio || fila.fecha || fila.fechaFin || fila.created_at || "";
  const fecha = normalizarFecha(fechaStr);

  // 7. Estado
  let estado = String(fila.estado || fila.estado_tramite || fila[c.estado] || "Programada").trim();
  if (estado.toLowerCase() === "finalizado") estado = "Completada";

  // 8. Ubicación y Entidad / Dirección
  const municipio = String(fila.municipio || fila.departamento || fila[c.municipio] || "").trim();
  const direccion = String(fila.direccion || "").trim();
  const entidad = direccion || String(fila.entidad || fila[c.entidad] || "").trim() || "Entidad Nodex";

  // 9. Bloqueos
  const es_bloqueo = Boolean(
    fila[c.es_bloqueo] ?? (fila.es_bloqueo || fila.bloqueo || fila.tipo === "bloqueo" || estado === "Bloqueada")
  );
  const es_dia_completo = Boolean(
    fila[c.es_dia_completo] ?? (fila.es_dia_completo || fila.dia_completo || fila.jornada_completa)
  );

  return {
    id: fila.tramiteId || fila.id || radicado,
    tramiteId: numTramite,
    mensajero,
    rawMensajero,
    sede,
    radicado,
    tipo_diligencia,
    hora_inicio,
    hora_fin,
    tieneHoraReal,
    fecha,
    estado,
    municipio,
    entidad,
    direccion,
    es_bloqueo,
    es_dia_completo,
    raw: fila,
  };
}

// ─────────────────────────────────────────────────────────────────────
// 3. PROCESAMIENTO Y DETECCIÓN DE CRUCES
// ─────────────────────────────────────────────────────────────────────

function horaAMinutos(horaStr) {
  if (!horaStr || !horaStr.includes(":")) return 0;
  const [h, m] = horaStr.split(":").map(Number);
  return h * 60 + (m || 0);
}

function analizarCrucesHorarios(citas) {
  citas.forEach((c) => {
    c.tieneCruce = false;
    c.cruceCon = null;
  });

  const citasConHorario = citas.filter((c) => !c.es_dia_completo);

  for (let i = 0; i < citasConHorario.length; i++) {
    const c1 = citasConHorario[i];
    const ini1 = horaAMinutos(c1.hora_inicio);
    const fin1 = horaAMinutos(c1.hora_fin);

    for (let j = i + 1; j < citasConHorario.length; j++) {
      const c2 = citasConHorario[j];
      const ini2 = horaAMinutos(c2.hora_inicio);
      const fin2 = horaAMinutos(c2.hora_fin);

      if (ini1 < fin2 && fin1 > ini2) {
        c1.tieneCruce = true;
        c2.tieneCruce = true;
        c1.cruceCon = c2.radicado || c2.tipo_diligencia;
        c2.cruceCon = c1.radicado || c1.tipo_diligencia;
      }
    }
  }
}

function calcularHuecosLibres(citasMensajero, nombreMensajero) {
  const JORNADA_INICIO = 7 * 60 + 30; // 07:30 AM
  const JORNADA_FIN = 17 * 60 + 30; // 05:30 PM
  const huecos = [];

  if (citasMensajero.some((c) => c.es_dia_completo)) {
    return [];
  }

  const ordenadas = [...citasMensajero].sort(
    (a, b) => horaAMinutos(a.hora_inicio) - horaAMinutos(b.hora_inicio),
  );

  let cursor = JORNADA_INICIO;

  ordenadas.forEach((cita) => {
    const ini = horaAMinutos(cita.hora_inicio);
    const fin = horaAMinutos(cita.hora_fin);

    if (ini > cursor) {
      const duracion = ini - cursor;
      if (duracion >= 30) {
        huecos.push({
          es_hueco_libre: true,
          mensajero: nombreMensajero,
          hora_inicio: minutosAHora(cursor),
          hora_fin: minutosAHora(ini),
          duracionMinutos: duracion,
        });
      }
    }
    cursor = Math.max(cursor, fin);
  });

  if (cursor < JORNADA_FIN && JORNADA_FIN - cursor >= 30) {
    huecos.push({
      es_hueco_libre: true,
      mensajero: nombreMensajero,
      hora_inicio: minutosAHora(cursor),
      hora_fin: minutosAHora(JORNADA_FIN),
      duracionMinutos: JORNADA_FIN - cursor,
    });
  }

  return huecos;
}

function minutosAHora(totalMinutos) {
  const h = Math.floor(totalMinutos / 60);
  const m = totalMinutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────
// 4. RENDERIZADO DEL CALENDARIO PRINCIPAL
// ─────────────────────────────────────────────────────────────────────

function procesarYRenderizar() {
  const mensajerosMap = agruparPorMensajero(datosCargados);
  asignarColores(Object.keys(mensajerosMap));
  actualizarFiltrosCiudad(mensajerosMap);

  let totalCruces = 0;
  Object.values(mensajerosMap).forEach((m) => {
    analizarCrucesHorarios(m.citas);
    totalCruces += m.citas.filter((c) => c.tieneCruce).length;
  });

  const alertaCruces = document.getElementById("contenedorAlertaCruces");
  const textoCruces = document.getElementById("textoAlertaCruces");
  if (alertaCruces && textoCruces) {
    if (totalCruces > 0) {
      alertaCruces.classList.remove("hidden");
      textoCruces.textContent = `⚠️ Se detectaron ${totalCruces} citas con cruce o conflicto de horario en la jornada.`;
    } else {
      alertaCruces.classList.add("hidden");
    }
  }

  actualizarKPIs(datosCargados, mensajerosMap);
  renderizarCalendario(mensajerosMap);
  filtrarPorCiudad(ciudadFiltroActivo);

  if (textoBusqueda) {
    aplicarFiltroBusquedaEnUI();
  }
}

function agruparPorMensajero(datos) {
  const mapa = {
    "Carlos León": { sede: "bogota", citas: [] },
    "Fredy Yesid Bernal": { sede: "bogota", citas: [] },
    "Gonzalo Romero": { sede: "medellin", citas: [] },
    "Eric Quiceno": { sede: "medellin", citas: [] },
  };

  datos.forEach((fila) => {
    if (!fila.mensajero) return;
    if (!mapa[fila.mensajero]) {
      mapa[fila.mensajero] = { sede: fila.sede || "bogota", citas: [] };
    }
    mapa[fila.mensajero].citas.push(fila);
  });

  Object.values(mapa).forEach((m) => {
    m.citas.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  });

  return mapa;
}

function renderizarCalendario(mensajerosMap) {
  const contenedor = document.getElementById("contenedorMensajeros");
  contenedor.innerHTML = "";

  const nombres = Object.keys(mensajerosMap);

  nombres.forEach((nombre) => {
    const { sede, citas } = mensajerosMap[nombre];
    const color = coloresAsignados[nombre] || COLORES_EXTRA[0];
    const iniciales = obtenerIniciales(nombre);

    const tieneDiaBloqueado = citas.some((c) => c.es_dia_completo);
    const bloqueoDiaInfo = citas.find((c) => c.es_dia_completo);

    const totalCitas = citas.filter(
      (c) => !c.es_bloqueo && !c.es_dia_completo,
    ).length;
    const maxCitas = 6;
    const porcentaje = tieneDiaBloqueado
      ? 100
      : Math.min(Math.round((totalCitas / maxCitas) * 100), 100);
    const bloqueos = citas.filter((c) => c.es_bloqueo).length;

    const etiquetaEstado = tieneDiaBloqueado
      ? `<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-200">No Disponible</span>`
      : obtenerEtiquetaEstadoMensajero(porcentaje, bloqueos);

    const colorBarra = tieneDiaBloqueado
      ? "bg-rose-500"
      : obtenerColorBarra(porcentaje);
    const zonaTexto = obtenerZonaMensajero(sede, nombre);

    let itemsParaRenderizar = [];
    if (tieneDiaBloqueado) {
      itemsParaRenderizar = citas;
    } else {
      const huecos = mostrarHuecos ? calcularHuecosLibres(citas, nombre) : [];
      itemsParaRenderizar = [...citas, ...huecos].sort((a, b) =>
        a.hora_inicio.localeCompare(b.hora_inicio),
      );
    }

    const htmlItems = itemsParaRenderizar
      .map((item) => {
        if (item.es_hueco_libre) {
          return renderizarTarjetaHuecoLibre(item, nombre);
        }
        return renderizarTarjetaCita(item, color, nombre);
      })
      .join("");

    const columna = document.createElement("div");
    columna.className =
      "columna-mensajero bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden";
    columna.setAttribute("data-ciudad", sede);
    columna.setAttribute("data-mensajero", nombre.toLowerCase());

    columna.innerHTML = `
      <div class="p-4 bg-slate-50/80 border-b border-slate-200">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full ${color.bg} text-white font-bold flex items-center justify-center text-sm shadow-xs">${iniciales}</div>
            <div>
              <h2 class="font-bold text-slate-900 text-base leading-tight">${nombre}</h2>
              <div class="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                <span class="inline-block w-2 h-2 rounded-full ${color.bg}"></span>
                <span>${zonaTexto}</span>
              </div>
            </div>
          </div>
          ${etiquetaEstado}
        </div>

        <div class="mt-3">
          <div class="flex justify-between items-center text-xs font-medium text-slate-600 mb-1">
            <span>${tieneDiaBloqueado ? "Día no hábil / Inactivo" : `Carga: <strong>${totalCitas} de${maxCitas} citas</strong>`}</span>
            <span class="font-bold text-${color.accent}-600">${porcentaje}%</span>
          </div>
          <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div class="${colorBarra} h-2 rounded-full transition-all duration-500" style="width: ${porcentaje}%"></div>
          </div>
        </div>

        <div class="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-xs">
          <span class="text-slate-400 font-medium">Acción rápida:</span>
          <button onclick="copiarRutaWhatsApp('${esc(nombre)}')"
            class="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg font-semibold transition"
            title="Copiar agenda del día formateada para enviar por WhatsApp">
            <span>📲 Copiar Ruta WhatsApp</span>
          </button>
        </div>
      </div>

      ${
        tieneDiaBloqueado
          ? `
        <div class="m-3 p-3 dia-bloqueado-banner rounded-xl text-rose-900 text-xs">
          <div class="flex items-center gap-1.5 font-bold mb-1">
            <span>🚫</span>
            <span>Jornada Completa Bloqueada</span>
          </div>
          <p class="font-medium">${esc(bloqueoDiaInfo?.tipo_diligencia || "No disponible por motivos operativos")}</p>
        </div>
      `
          : ""
      }

      <div class="p-3 space-y-2.5 flex-1 bg-slate-50/30 overflow-y-auto max-h-[620px]">
        ${htmlItems || '<p class="text-xs text-center text-slate-400 py-6">Sin citas registradas para este día.</p>'}
      </div>
    `;

    contenedor.appendChild(columna);
  });
}

function renderizarTarjetaCita(cita, color, nombreMensajero) {
  const horario = cita.es_dia_completo
    ? "Jornada Completa"
    : `${formatearHora12(cita.hora_inicio)} - ${formatearHora12(cita.hora_fin)}`;

  const claseCruce = cita.tieneCruce ? "tarjeta-cruce" : "";
  const bannerCruce = cita.tieneCruce
    ? `
    <div class="flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100/80 px-2 py-0.5 rounded mt-1.5">
      <span>⚠️ Cruce con:</span>
      <span class="truncate">${esc(cita.cruceCon)}</span>
    </div>
  `
    : "";

  if (cita.es_bloqueo || cita.es_dia_completo) {
    return `
      <div onclick="mostrarDetalleBloqueo('${esc(nombreMensajero)}', '${esc(horario)}', '${esc(cita.tipo_diligencia)}', ${cita.es_dia_completo})"
           class="tarjeta-cita cursor-pointer franja-bloqueada border border-red-200 p-3 rounded-xl transition hover:border-red-300 ${claseCruce}"
           data-busqueda="${esc(cita.tipo_diligencia)} ${esc(cita.radicado)} ${esc(nombreMensajero)}">
        <div class="flex items-center justify-between text-xs font-bold text-red-700">
          <span class="flex items-center gap-1">
            🔒 ${esc(horario)}
          </span>
          <span class="text-[10px] bg-red-100 px-1.5 py-0.5 rounded text-red-800 font-semibold">Bloqueo Nodex</span>
        </div>
        <p class="text-xs text-red-800 mt-1 font-semibold">${esc(cita.tipo_diligencia)}</p>
        ${bannerCruce}
      </div>`;
  }

  const badgeEstado = renderizarBadgeEstado(cita.estado);
  const badgeZona = cita.municipio
    ? `
    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
      📍 ${esc(cita.municipio)}
    </span>
  `
    : "";

  return `
    <div onclick="mostrarDetalleCita('${esc(cita.radicado)}', '${esc(nombreMensajero)}', '${esc(cita.municipio)}', '${esc(horario)}', '${esc(cita.tipo_diligencia)}', '${esc(cita.estado)}', '${esc(cita.entidad)}')"
         class="tarjeta-cita cursor-pointer group p-3 bg-white hover:bg-${color.accent}-50/40 border border-slate-200 hover:border-${color.accent}-300 rounded-xl transition shadow-xs ${claseCruce}"
         data-busqueda="${esc(cita.radicado)} ${esc(cita.tipo_diligencia)} ${esc(cita.municipio)} ${esc(cita.entidad)} ${esc(nombreMensajero)}">
      <div class="flex items-center justify-between text-xs font-semibold mb-1">
        <span class="text-${color.accent}-700 bg-${color.accent}-50 px-2 py-0.5 rounded-md font-mono">${esc(horario)}</span>
        ${badgeEstado}
      </div>
      <div class="font-bold text-xs text-slate-800 group-hover:text-${color.accent}-700 transition leading-snug">
        ${esc(cita.tipo_diligencia)}
      </div>
      <div class="flex flex-wrap items-center gap-1.5 mt-2">
        <span class="text-[10px] font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 font-bold">${esc(cita.radicado)}</span>
        ${badgeZona}
      </div>
      ${cita.entidad ? `<div class="text-[11px] text-slate-400 mt-1 truncate">🏛️ ${esc(cita.entidad)}</div>` : ""}
      ${bannerCruce}
    </div>`;
}

function renderizarTarjetaHuecoLibre(hueco, nombreMensajero) {
  const horas = Math.floor(hueco.duracionMinutos / 60);
  const mins = hueco.duracionMinutos % 60;
  const textoDuracion = `${horas > 0 ? horas + "h " : ""}${mins > 0 ? mins + "m" : ""}`;
  const horario = `${formatearHora12(hueco.hora_inicio)} - ${formatearHora12(hueco.hora_fin)}`;

  return `
    <div onclick="asignacionRapida('${esc(nombreMensajero)}', '${hueco.hora_inicio}', '${hueco.hora_fin}')"
         class="ranura-disponible p-2.5 rounded-xl cursor-pointer text-center group transition"
         title="Clic para programar una diligencia en este horario libre">
      <div class="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 group-hover:text-blue-600">
        <span class="text-blue-500 font-bold text-sm leading-none">＋</span>
        <span>Franja Libre: <strong>${horario}</strong></span>
        <span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full">(${textoDuracion})</span>
      </div>
      <span class="text-[10px] text-slate-400 group-hover:text-blue-500 transition block mt-0.5">Asignar diligencia aquí</span>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────
// 5. BANDEJA DE CITAS PENDIENTES DE NODEX (BACKLOG)
// ─────────────────────────────────────────────────────────────────────

function abrirBandejaPendientes() {
  renderizarBandejaPendientes();
  document.getElementById("modalBandejaPendientes").classList.remove("hidden");
}

function cerrarBandejaPendientes() {
  document.getElementById("modalBandejaPendientes").classList.add("hidden");
}

function actualizarBadgePendientes() {
  const badge = document.getElementById("badge-pendientes-count");
  if (badge) {
    badge.textContent = citasPendientes.length;
    badge.className =
      citasPendientes.length > 0
        ? "bg-white text-amber-900 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shadow-xs"
        : "hidden";
  }
}

function renderizarBandejaPendientes() {
  const contenedor = document.getElementById("listaCitasPendientes");
  if (!contenedor) return;

  if (citasPendientes.length === 0) {
    contenedor.innerHTML = `
      <div class="text-center py-10 text-slate-400">
        <span class="text-3xl block mb-2">🎉</span>
        <p class="font-semibold text-slate-700">¡Al día! No hay citas pendientes de asignar en Nodex.</p>
        <p class="text-xs text-slate-500 mt-1">Todas las solicitudes recibidas tienen mensajero y horario asignado.</p>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = citasPendientes
    .map(
      (c, idx) => `
    <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-blue-300 transition">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span class="font-mono text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">${esc(c.radicado)}</span>
          <span class="text-xs font-semibold text-slate-800">${esc(c.tipo_diligencia)}</span>
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${c.prioridad === "Urgente" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}">${c.prioridad}</span>
        </div>
        <div class="flex items-center gap-3 text-xs text-slate-500">
          <span>🏛️ ${esc(c.entidad)}</span>
          <span>📍 ${esc(c.municipio)}</span>
          <span>⏱️ Est: ${esc(c.duracion_est)}</span>
        </div>
      </div>
      <button onclick="asignarDesdeBandeja(${idx})"
        class="inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition shadow-xs whitespace-nowrap">
        <span>Asignar a Mensajero ▶</span>
      </button>
    </div>
  `,
    )
    .join("");
}

function asignarDesdeBandeja(indice) {
  const cita = citasPendientes[indice];
  if (!cita) return;

  citaPendienteEnEdicion = { cita, indice };
  cerrarBandejaPendientes();

  abrirModalNuevo();
  document.getElementById("campoTipoAccion").value = "asignacion";
  cambiarTipoRegistroUI("asignacion");

  document.getElementById("campoMotivoNota").value =
    `${cita.radicado} - ${cita.tipo_diligencia}`;
  document.getElementById("campoMunicipio").value = cita.municipio || "";
  document.getElementById("campoEntidad").value = cita.entidad || "";

  const selectMensajero = document.getElementById("campoMensajero");
  if (cita.sede === "medellin") {
    selectMensajero.value = "Gonzalo Romero";
  } else {
    selectMensajero.value = "Carlos León";
  }

  verificarConflictoEnVivo();
}

// ─────────────────────────────────────────────────────────────────────
// 6. COPIAR HOJA DE RUTA PARA WHATSAPP
// ─────────────────────────────────────────────────────────────────────

function copiarRutaWhatsApp(nombreMensajero) {
  const citasMensajero = datosCargados
    .filter((c) => c.mensajero === nombreMensajero)
    .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

  const opciones = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  const fechaTexto = fechaActual.toLocaleDateString("es-CO", opciones);

  let texto = `📍 *HOJA DE RUTA — NODEX HUB*\n`;
  texto += `👤 *Mensajero:* ${nombreMensajero}\n`;
  texto += `📅 *Fecha:* ${fechaTexto}\n`;
  texto += `----------------------------------------\n\n`;

  if (citasMensajero.length === 0) {
    texto += `Sin diligencias asignadas para este día.\n`;
  } else {
    citasMensajero.forEach((c, i) => {
      const num = i + 1;
      const horario = c.es_dia_completo
        ? "Jornada Completa"
        : `${formatearHora12(c.hora_inicio)} - ${formatearHora12(c.hora_fin)}`;
      if (c.es_bloqueo || c.es_dia_completo) {
        texto += `${num}️⃣ 🔒 *${horario}* (Bloqueo Preventivo)\n`;
        texto += `   📌 Motivo: ${c.tipo_diligencia}\n\n`;
      } else {
        texto += `${num}️⃣ ⏰ *${horario}* | *Rad: ${c.radicado}*\n`;
        texto += `   📌 *Trámite:* ${c.tipo_diligencia}\n`;
        if (c.entidad) texto += `   🏛️ *Entidad:* ${c.entidad}\n`;
        if (c.municipio) texto += `   📍 *Zona:* ${c.municipio}\n`;
        texto += `   📊 *Estado:* ${c.estado}\n\n`;
      }
    });
  }

  texto += `----------------------------------------\n`;
  texto += `*Total Citas:* ${citasMensajero.filter((c) => !c.es_bloqueo && !c.es_dia_completo).length} | Notificar novedades por este medio.`;

  navigator.clipboard
    .writeText(texto)
    .then(() => {
      mostrarToast(`✓ Hoja de ruta copiada para WhatsApp (${nombreMensajero})`);
    })
    .catch(() => {
      prompt("Copia la hoja de ruta manualmente:", texto);
    });
}

// ─────────────────────────────────────────────────────────────────────
// 7. BUSCADOR INSTANTÁNEO EN TIEMPO REAL
// ─────────────────────────────────────────────────────────────────────

function filtrarPorBusqueda(query) {
  textoBusqueda = (query || "").trim().toLowerCase();
  const btnLimpiar = document.getElementById("botonLimpiarBusqueda");
  if (btnLimpiar) {
    btnLimpiar.classList.toggle("hidden", !textoBusqueda);
  }
  aplicarFiltroBusquedaEnUI();
}

function limpiarBusqueda() {
  const campo = document.getElementById("campoBusqueda");
  if (campo) campo.value = "";
  filtrarPorBusqueda("");
}

function aplicarFiltroBusquedaEnUI() {
  const tarjetas = document.querySelectorAll(".tarjeta-cita");
  if (!textoBusqueda) {
    tarjetas.forEach((t) => {
      t.style.opacity = "1";
      t.style.filter = "none";
    });
    return;
  }

  tarjetas.forEach((tarjeta) => {
    const texto = (tarjeta.getAttribute("data-busqueda") || "").toLowerCase();
    if (texto.includes(textoBusqueda)) {
      tarjeta.style.opacity = "1";
      tarjeta.style.filter = "none";
      tarjeta.classList.add("ring-2", "ring-blue-500");
    } else {
      tarjeta.style.opacity = "0.2";
      tarjeta.style.filter = "grayscale(80%)";
      tarjeta.classList.remove("ring-2", "ring-blue-500");
    }
  });
}

function alternarHuecosDisponibles(mostrar) {
  mostrarHuecos = Boolean(mostrar);
  procesarYRenderizar();
}

// ─────────────────────────────────────────────────────────────────────
// 8. NAVEGACIÓN Y SINCRONIZACIÓN DE FECHAS
// ─────────────────────────────────────────────────────────────────────

function cambiarFecha(dias) {
  fechaActual.setDate(fechaActual.getDate() + dias);
  sincronizarControlesFecha();
  if (todosLosTramitesAPI.length > 0 && !modoDemostracionManual) {
    aplicarTramitesParaFechaActual();
  } else {
    cargarDatosDesdeAPI();
  }
}

function irAHoy() {
  fechaActual = new Date();
  sincronizarControlesFecha();
  if (todosLosTramitesAPI.length > 0 && !modoDemostracionManual) {
    aplicarTramitesParaFechaActual();
  } else {
    cargarDatosDesdeAPI();
  }
}

function seleccionarFecha(fechaStr) {
  if (!fechaStr) return;
  const [y, m, d] = fechaStr.split("-").map(Number);
  fechaActual = new Date(y, m - 1, d);
  sincronizarControlesFecha();
  if (todosLosTramitesAPI.length > 0 && !modoDemostracionManual) {
    aplicarTramitesParaFechaActual();
  } else {
    cargarDatosDesdeAPI();
  }
}

function sincronizarControlesFecha() {
  const iso = formatearFechaISO(fechaActual);
  const inputFecha = document.getElementById("selectorFecha");
  if (inputFecha) inputFecha.value = iso;

  const opciones = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  const textoLargo = fechaActual.toLocaleDateString("es-CO", opciones);

  const elFechaLarga = document.getElementById("textoFechaLarga");
  if (elFechaLarga) {
    elFechaLarga.textContent = capitalizar(textoLargo);
  }
}

// ─────────────────────────────────────────────────────────────────────
// 9. GESTIÓN DE MODALES Y VALIDACIÓN DE CONFLICTOS
// ─────────────────────────────────────────────────────────────────────

function abrirModalNuevo() {
  document.getElementById("modalNuevoBloqueo").classList.remove("hidden");
  document.getElementById("checkDiaCompleto").checked = false;
  alternarCamposDiaCompleto(false);
  verificarConflictoEnVivo();
}

function cerrarModalNuevo() {
  document.getElementById("modalNuevoBloqueo").classList.add("hidden");
  citaPendienteEnEdicion = null;
  document.getElementById("formularioAsignacion").reset();
  ocultarAlertaConflictoModal();
}

function asignacionRapida(nombreMensajero, horaInicio, horaFin) {
  abrirModalNuevo();
  document.getElementById("campoTipoAccion").value = "asignacion";
  cambiarTipoRegistroUI("asignacion");
  document.getElementById("campoMensajero").value = nombreMensajero;
  document.getElementById("campoHoraInicio").value = horaInicio;
  document.getElementById("campoHoraFin").value = horaFin;
  verificarConflictoEnVivo();
}

function cambiarTipoRegistroUI(tipo) {
  const contenedorDia = document.getElementById("contenedorDiaCompleto");
  const seccionUbicacion = document.getElementById("seccionUbicacion");
  const inputMotivo = document.getElementById("campoMotivoNota");

  if (tipo === "bloqueo") {
    contenedorDia.classList.remove("hidden");
    seccionUbicacion.classList.add("hidden");
    inputMotivo.placeholder = "Ej: Reserva preventiva / Trámite masivo Notaría";
  } else {
    contenedorDia.classList.add("hidden");
    seccionUbicacion.classList.remove("hidden");
    inputMotivo.placeholder = "Ej: NX-10530 Entrega Notificación Judicial";
    document.getElementById("checkDiaCompleto").checked = false;
    alternarCamposDiaCompleto(false);
  }
  verificarConflictoEnVivo();
}

function alternarCamposDiaCompleto(estaMarcado) {
  const seccionHoras = document.getElementById("seccionHoras");
  if (seccionHoras) {
    seccionHoras.style.display = estaMarcado ? "none" : "grid";
  }
  verificarConflictoEnVivo();
}

function verificarConflictoEnVivo() {
  const alerta = document.getElementById("alertaConflictoModal");
  const mensajero = document.getElementById("campoMensajero")?.value;
  const esDiaCompleto = document.getElementById("checkDiaCompleto")?.checked;
  const horaIni = document.getElementById("campoHoraInicio")?.value;
  const horaFin = document.getElementById("campoHoraFin")?.value;

  if (!alerta || !mensajero) return;

  const citasMensajero = datosCargados.filter((c) => c.mensajero === mensajero);

  const tieneDiaCompleto = citasMensajero.find((c) => c.es_dia_completo);
  if (tieneDiaCompleto) {
    alerta.innerHTML = `⚠️ <strong>Conflicto Total:</strong> ${mensajero} ya tiene la <strong>jornada completa bloqueada</strong> (${tieneDiaCompleto.tipo_diligencia}).`;
    alerta.classList.remove("hidden");
    return;
  }

  if (esDiaCompleto && citasMensajero.length > 0) {
    alerta.innerHTML = `⚠️ <strong>Advertencia:</strong> ${mensajero} ya tiene <strong>${citasMensajero.length} citas programadas</strong> hoy. Al bloquear el día completo se generará conflicto con todas ellas.`;
    alerta.classList.remove("hidden");
    return;
  }

  if (!esDiaCompleto && horaIni && horaFin) {
    const iniNuevo = horaAMinutos(horaIni);
    const finNuevo = horaAMinutos(horaFin);

    if (iniNuevo >= finNuevo) {
      alerta.innerHTML = `⚠️ <strong>Horario inválido:</strong> La hora de inicio debe ser anterior a la hora de fin.`;
      alerta.classList.remove("hidden");
      return;
    }

    const conflicto = citasMensajero.find((c) => {
      if (c.es_dia_completo) return true;
      const iniC = horaAMinutos(c.hora_inicio);
      const finC = horaAMinutos(c.hora_fin);
      return iniNuevo < finC && finNuevo > iniC;
    });

    if (conflicto) {
      const horarioConflicto = `${formatearHora12(conflicto.hora_inicio)} - ${formatearHora12(conflicto.hora_fin)}`;
      alerta.innerHTML = `⚠️ <strong>Cruce detectado:</strong> ${mensajero} ya tiene asignado: <em>"${conflicto.tipo_diligencia}"</em> en el horario <strong>${horarioConflicto}</strong>.`;
      alerta.classList.remove("hidden");
      return;
    }
  }

  ocultarAlertaConflictoModal();
}

function ocultarAlertaConflictoModal() {
  const alerta = document.getElementById("alertaConflictoModal");
  if (alerta) alerta.classList.add("hidden");
}

function guardarRegistro(evento) {
  evento.preventDefault();

  const tipoAccion = document.getElementById("campoTipoAccion").value;
  const mensajero = document.getElementById("campoMensajero").value;
  const esDiaCompleto = document.getElementById("checkDiaCompleto").checked;
  const horaInicio = esDiaCompleto
    ? "07:30"
    : document.getElementById("campoHoraInicio").value;
  const horaFin = esDiaCompleto
    ? "17:30"
    : document.getElementById("campoHoraFin").value;
  const motivoNota = document.getElementById("campoMotivoNota").value;
  const municipio = document.getElementById("campoMunicipio").value || "";
  const entidad = document.getElementById("campoEntidad").value || "";

  const sede =
    mensajero.includes("Gonzalo") || mensajero.includes("Eric")
      ? "medellin"
      : "bogota";

  let radicado = "NX-" + Math.floor(10000 + Math.random() * 90000);
  if (motivoNota.toUpperCase().includes("NX-")) {
    const match = motivoNota.match(/NX-\d+/i);
    if (match) radicado = match[0].toUpperCase();
  }

  const nuevaFila = {
    mensajero,
    sede,
    radicado:
      tipoAccion === "bloqueo" && !esDiaCompleto
        ? "BLQ-" + Math.floor(1000 + Math.random() * 9000)
        : radicado,
    tipo_diligencia: motivoNota,
    hora_inicio: horaInicio,
    hora_fin: horaFin,
    estado: "Programada",
    municipio,
    entidad,
    es_bloqueo: tipoAccion === "bloqueo",
    es_dia_completo: esDiaCompleto,
  };

  datosCargados.push(nuevaFila);

  if (citaPendienteEnEdicion) {
    citasPendientes.splice(citaPendienteEnEdicion.indice, 1);
    actualizarBadgePendientes();
    citaPendienteEnEdicion = null;
  }

  cerrarModalNuevo();
  procesarYRenderizar();

  mostrarToast(
    `Guardado solo en esta sesión para ${mensajero}. Aún no se envía a Nodex.`,
  );
}

// ─────────────────────────────────────────────────────────────────────
// 10. MODAL DE DETALLES Y UTILIDADES
// ─────────────────────────────────────────────────────────────────────

function mostrarDetalleCita(
  radicado,
  mensajero,
  ubicacion,
  horario,
  titulo,
  estado,
  entidad,
) {
  document.getElementById("etiquetaRadicado").innerText = radicado
    ? `Radicado #${radicado}`
    : "Diligencia";
  document.getElementById("etiquetaTitulo").innerText = titulo;
  document.getElementById("etiquetaMensajero").innerText = mensajero;
  document.getElementById("etiquetaHorario").innerText = horario;
  document.getElementById("etiquetaUbicacion").innerText =
    ubicacion || "Sin ubicación registrada";
  document.getElementById("etiquetaEntidad").innerText =
    entidad || "No especificada";

  const etiquetaEstado = document.getElementById("etiquetaEstado");
  etiquetaEstado.innerText = estado;
  etiquetaEstado.className = claseEstadoBadge(estado);

  document.getElementById("modalDetalleCita").classList.remove("hidden");
}

function mostrarDetalleBloqueo(mensajero, horario, motivo, esDiaCompleto) {
  document.getElementById("etiquetaRadicado").innerText = esDiaCompleto
    ? "🚫 Jornada Completa Bloqueada"
    : "🔒 Franja Horaria Bloqueada";
  document.getElementById("etiquetaTitulo").innerText = motivo;
  document.getElementById("etiquetaMensajero").innerText = mensajero;
  document.getElementById("etiquetaHorario").innerText = horario;
  document.getElementById("etiquetaUbicacion").innerText =
    "Reserva preventiva para evitar asignación";
  document.getElementById("etiquetaEntidad").innerText =
    "Operaciones / Nodex Hub";

  const etiquetaEstado = document.getElementById("etiquetaEstado");
  etiquetaEstado.innerText = esDiaCompleto
    ? "Día No Disponible"
    : "Bloqueo Preventivo";
  etiquetaEstado.className =
    "inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800";

  document.getElementById("modalDetalleCita").classList.remove("hidden");
}

function cerrarModalDetalle() {
  document.getElementById("modalDetalleCita").classList.add("hidden");
}

function abrirModalReasignacion() {
  cerrarModalDetalle();
  abrirModalNuevo();
}

function filtrarPorCiudad(ciudadSeleccionada) {
  ciudadFiltroActivo = ciudadSeleccionada;
  const columnas = document.querySelectorAll(".columna-mensajero");

  columnas.forEach((columna) => {
    const ciudadMensajero = columna.getAttribute("data-ciudad");
    columna.style.display =
      ciudadSeleccionada === "todos" || ciudadMensajero === ciudadSeleccionada
        ? "flex"
        : "none";
  });

  ["todos", "bogota", "medellin"].forEach((ciudad) => {
    const boton = document.getElementById("boton-filtro-" + ciudad);
    if (!boton) return;
    boton.className =
      ciudad === ciudadSeleccionada
        ? "px-3 py-1.5 rounded-lg bg-white shadow-xs text-slate-900 font-semibold transition"
        : "px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition";
  });
}

function actualizarKPIs(datos, mensajerosMap) {
  const totalMensajeros = Object.keys(mensajerosMap).length;
  const totalCitas = datos.filter(
    (d) => !d.es_bloqueo && !d.es_dia_completo,
  ).length;
  const totalBloqueos = datos.filter(
    (d) => d.es_bloqueo || d.es_dia_completo,
  ).length;

  let totalHuecos = 0;
  Object.keys(mensajerosMap).forEach((m) => {
    totalHuecos += calcularHuecosLibres(mensajerosMap[m].citas, m).length;
  });

  const elMensajeros = document.getElementById("kpi-mensajeros");
  const elCitas = document.getElementById("kpi-citas");
  const elLibres = document.getElementById("kpi-libres");
  const elBloqueos = document.getElementById("kpi-bloqueos");

  if (elMensajeros) elMensajeros.textContent = `${totalMensajeros} Activos`;
  if (elCitas) elCitas.textContent = `${totalCitas} Diligencias`;
  if (elLibres) elLibres.textContent = `${totalHuecos} Disponibles`;
  if (elBloqueos) elBloqueos.textContent = `${totalBloqueos} Registrados`;
}

function actualizarFiltrosCiudad(mensajerosMap) {
  const conteos = { bogota: 0, medellin: 0, todos: 0 };
  Object.values(mensajerosMap).forEach(({ sede }) => {
    conteos.todos++;
    if (sede === "bogota") conteos.bogota++;
    if (sede === "medellin") conteos.medellin++;
  });

  const elTodos = document.getElementById("boton-filtro-todos");
  const elBogota = document.getElementById("boton-filtro-bogota");
  const elMedellin = document.getElementById("boton-filtro-medellin");

  if (elTodos) elTodos.textContent = `Todos (${conteos.todos})`;
  if (elBogota) elBogota.textContent = `Bogotá (${conteos.bogota})`;
  if (elMedellin) elMedellin.textContent = `Medellín (${conteos.medellin})`;
}

function asignarColores(nombresMensajeros) {
  coloresAsignados = {};
  indiceColorExtra = 0;
  const mapaColores =
    typeof COLORES_MENSAJERO !== "undefined" ? COLORES_MENSAJERO : {};
  const extras =
    typeof COLORES_EXTRA !== "undefined"
      ? COLORES_EXTRA
      : [
          { bg: "bg-blue-600", ring: "ring-blue-400", accent: "blue" },
          { bg: "bg-indigo-600", ring: "ring-indigo-400", accent: "indigo" },
          { bg: "bg-teal-600", ring: "ring-teal-400", accent: "teal" },
          { bg: "bg-rose-600", ring: "ring-rose-400", accent: "rose" },
        ];
  nombresMensajeros.forEach((nombre) => {
    if (mapaColores[nombre]) {
      coloresAsignados[nombre] = mapaColores[nombre];
    } else {
      coloresAsignados[nombre] = extras[indiceColorExtra % extras.length];
      indiceColorExtra++;
    }
  });
}

function mostrarToast(mensaje) {
  const toast = document.getElementById("toastNotificacion");
  const texto = document.getElementById("toastTexto");
  if (!toast || !texto) return;

  texto.textContent = mensaje;
  toast.classList.remove("hidden");

  setTimeout(() => {
    toast.classList.add("hidden");
  }, 3500);
}

function mostrarEstadoCarga(cargando) {
  const btn = document.getElementById("boton-actualizar");
  const spin = document.getElementById("spinner-actualizar");
  const txt = document.getElementById("texto-actualizar");
  if (!btn) return;
  btn.disabled = cargando;
  if (spin) spin.classList.toggle("hidden", !cargando);
  if (txt) txt.textContent = cargando ? "Cargando…" : "↻ Sincronizar";
}

function mostrarMensajeError(mensaje) {
  const el = document.getElementById("banner-error-api");
  if (!el) return;
  const txt = el.querySelector("#texto-error-api");
  if (txt) txt.textContent = mensaje;
  el.classList.remove("hidden");
}

function ocultarMensajeError() {
  const el = document.getElementById("banner-error-api");
  if (el) el.classList.add("hidden");
}

function mostrarMensajeInfo(mensaje, textoBoton = null) {
  const el = document.getElementById("banner-info-api");
  const txt = document.getElementById("texto-info-api");
  const btn = document.getElementById("btnAlternarDatosPrueba");
  if (!el || !txt) return;
  txt.textContent = mensaje;
  if (btn) {
    if (textoBoton) {
      btn.textContent = textoBoton;
      btn.classList.remove("hidden");
    } else {
      btn.classList.add("hidden");
    }
  }
  el.classList.remove("hidden");
}

function ocultarMensajeInfo() {
  const el = document.getElementById("banner-info-api");
  if (el) el.classList.add("hidden");
}

function actualizarTimestampUltimaActualizacion(esFallback, conteoApi = null, mensajePersonalizado = null) {
  const el = document.getElementById("ultima-actualizacion");
  const badge = document.getElementById("estadoConexion");
  const texto = document.getElementById("textoConexion");
  if (!el) return;
  const hora = new Date().toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (mensajePersonalizado) {
    el.textContent = `${mensajePersonalizado} · ${hora}`;
  } else if (esFallback) {
    el.textContent = `Datos de demostración · ${hora}`;
  } else {
    el.textContent = `Datos de Nodex (${conteoApi ?? datosCargados.length} diligencias) · ${hora}`;
  }

  el.className = esFallback
    ? "text-amber-600 font-medium"
    : "text-emerald-600 font-medium";

  if (badge) {
    badge.classList.toggle("is-demo", esFallback);
    badge.classList.toggle("is-connected", !esFallback);
  }
  if (texto) {
    if (esFallback) {
      texto.textContent = "Modo demostración";
    } else {
      texto.textContent = (conteoApi === 0) ? "API conectada (0 trámites)" : `API conectada (${conteoApi ?? datosCargados.length})`;
    }
  }
}

function esc(str) {
  return String(str || "")
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;");
}

function formatearFechaISO(fecha) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatearHora12(hora24) {
  if (!hora24 || !hora24.includes(":")) return hora24;
  const [h, m] = hora24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hora = h % 12 || 12;
  return `${String(hora).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

function obtenerIniciales(nombre) {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function obtenerZonaMensajero(sede, nombre) {
  const zonas = {
    "Carlos León": "Bogotá (Norte & Centro)",
    "Fredy Yesid Bernal": "Bogotá Sur & Soacha",
    "Gonzalo Romero": "Medellín (Centro & Poblado)",
    "Eric Quiceno": "Medellín Norte & Bello",
  };
  return (
    zonas[nombre] ||
    (sede === "bogota" ? "Bogotá D.C." : "Medellín / Antioquia")
  );
}

function obtenerEtiquetaEstadoMensajero(porcentaje, bloqueos) {
  if (porcentaje >= 100 || (bloqueos > 0 && porcentaje >= 83)) {
    return `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 border border-rose-200">Saturado</span>`;
  } else if (porcentaje >= 70) {
    return `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200">Carga Alta</span>`;
  } else {
    return `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">Disponible</span>`;
  }
}

function obtenerColorBarra(porcentaje) {
  if (porcentaje >= 100) return "bg-rose-500";
  if (porcentaje >= 70) return "bg-amber-500";
  return "bg-blue-600";
}

function renderizarBadgeEstado(estado) {
  switch (estado) {
    case "Completada":
      return `<span class="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold text-[11px]">✓ Entregado</span>`;
    case "En Curso":
      return `<span class="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-semibold text-[11px]">● En Ruta</span>`;
    case "Bloqueada":
      return `<span class="text-red-700 bg-red-50 px-2 py-0.5 rounded-md font-semibold text-[11px]">🔒 Bloqueado</span>`;
    default:
      return `<span class="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-semibold text-[11px]">📅 ${esc(estado)}</span>`;
  }
}

function claseEstadoBadge(estado) {
  const base = "inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold ";
  if (estado === "Completada") return base + "bg-emerald-100 text-emerald-800";
  if (estado === "En Curso") return base + "bg-amber-100 text-amber-800";
  return base + "bg-blue-100 text-blue-800";
}

function capitalizar(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}
