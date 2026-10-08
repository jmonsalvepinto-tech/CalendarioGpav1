# 📦 Proyecto: Tablero Operativo de Mensajeros & Citas (Nodex Hub)

Prototipo web funcional e interactivo para la gestión, visualización y asignación de diligencias de mensajería (Bogotá y Medellín), diseñado para integrarse con la **API de Nodex** y alineado a las necesidades de la **Solicitud Calendario Nodex**.

> **Estado actual:** la integración real está pendiente. Si la API configurada no responde, el tablero muestra datos de demostración. Las asignaciones nuevas se conservan solo en memoria durante la sesión y todavía no se envían ni guardan en Nodex.

---

## ✨ Nuevas Funcionalidades Implementadas

Atendiendo a los requerimientos de la solicitud operativa y superando las limitaciones de un archivo Excel tradicional:

1. **🚨 Detección y Prevención Activa de Cruces de Horario (Conflict Overlapping):**
   - El sistema analiza automáticamente la agenda de cada mensajero.
   - Si dos citas o bloqueos coinciden en el mismo horario, se resaltan con un borde rojo animado, fondo de alerta y una etiqueta `⚠️ Cruce con: [Radicado/Motivo]`.
   - **Validación en vivo en el modal:** Mientras el despachador asigna una cita, el sistema le notifica al instante si el mensajero ya está ocupado en ese horario.

2. **🚫 Bloqueo de Jornada Completa:**
   - Permite bloquear el día completo a un mensajero por incapacidad médica, permisos, mantenimiento de vehículo o contingencias notariales.
   - La columna del mensajero cambia a estado `No Disponible` con un banner informativo destacado.

3. **➕ Franjas Libres Interactivas ("Huecos de Disponibilidad"):**
   - El tablero calcula los espacios desocupados ($\ge 30$ min) en la jornada laboral (07:30 AM a 05:30 PM).
   - Muestra tarjetas punteadas de disponibilidad (ej. `Franja Libre: 11:15 AM - 02:00 PM · 2h 45m`).
   - Al hacer clic en la franja, se abre automáticamente el modal con el mensajero y el horario pre-seleccionados.

4. **📥 Bandeja de Citas Pendientes de Nodex (Backlog):**
   - Acceso rápido a solicitudes de diligencias entrantes que aún no tienen mensajero asignado.
   - Permite ver radicado, prioridad, zona y entidad, con un botón **"Asignar a Mensajero"** que transfiere los datos directamente al formulario.

5. **📲 Generador de Hoja de Ruta para WhatsApp:**
   - Botón directo en la tarjeta de cada mensajero que compila su agenda del día formateada con emojis, horarios y direcciones, copiándola al portapapeles para enviársela de inmediato por chat.

6. **🔍 Buscador Instantáneo en Vivo:**
   - Filtra o resalta en tiempo real cualquier cita por radicado (ej: `NX-10492`), municipio, trámite o entidad judicial/notarial.

7. **📅 Selector de Fecha Completo (Datepicker) y Botón "Hoy":**
   - Permite saltar a cualquier fecha pasada o futura para planificar semanas enteras.

---

## 📁 Estructura del Proyecto

```text
calendario_nodex/
│
├── index.html          # Interfaz de usuario (Tailwind CSS, diseño responsivo)
├── README.md           # Documentación técnica y funcional
│
├── css/
│   └── estilos.css     # Animaciones de cruces, franjas rayadas, huecos y toasts
├── img/
│   ├── logo.png        # Logo Gómez Pineda Abogados × Nodex
│   └── favicon.png     # Emblema para el icono de la pestaña
│
└── js/
    ├── config.js       # Endpoints, esquemas de campos y fallbacks de Nodex
    └── script.js       # Lógica operativa (detección de colisiones, KPIs, modales)
```

---

## 👥 Mensajeros Configurados

1. **Carlos León** - Sede Bogotá (Norte y Centro)
2. **Fredy Yesid Bernal** - Sede Bogotá Sur y Soacha
3. **Gonzalo Romero** - Sede Medellín Centro y El Poblado
4. **Eric Quiceno** - Sede Medellín Norte, Bello e Itagüí

---

## 🚀 Cómo ejecutar el tablero con conexión a la API

Para que las peticiones a la API funcionen correctamente y el navegador no las bloquee por políticas de seguridad (CORS al abrir archivos directos por `file://`):

1. **Opción recomendada (1 clic):**
   - Haz doble clic en el archivo **`iniciar_servidor.bat`**.
   - Se abrirá automáticamente tu navegador en `http://localhost:3000/index.html` con conexión en vivo a la API de Nodex.

2. **Opción con VS Code:**
   - Haz clic derecho sobre [index.html](file:///c:/Users/JuanPabloMonsalvePin/Desktop/calendario_nodex/index.html) -> **"Open with Live Server"**.

3. **API Configurada:**
   - **URL:** `https://api.nodexgpa.com/api/externa/mensajeros/tramites`
   - **Header:** `x-api-key: cbN4NViOhHcuKIqiIX1IKX24so-U3Q6N38g2QaeeddM`
   - **Estado:** Conexión en vivo activa. Si la base de datos de Nodex no tiene trámites creados aún (devuelve 0 registros), la interfaz te permite alternar con un clic entre los datos de prueba y los datos reales en vivo de la API.

---

## 🛠️ Integración con Power Apps & Nodex
- **Vía Web Resource / Custom Page:** Este dashboard puede embeberse dentro de una solución de Power Apps como página personalizada conectada a los servicios web de Nodex.
- **Vía Conector Personalizado (Custom Connector):** Los métodos `cargarDatosDesdeAPI()` y `guardarRegistro()` se vinculan a flujos de **Power Automate** para escribir directamente en la base de datos de Nodex.
