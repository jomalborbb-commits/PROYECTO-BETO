/* =========================================================
   CONFIGURACIÓN Y ESTADO
   ========================================================= */

const STORAGE_KEY = "registros_ladrillos_v1";

const MESES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
];

// Columnas en el orden EXACTO exigido para tabla, Excel e importación.
const COLUMNAS = [
  { key: "fechaIngreso",       label: "Fecha de ingreso",            tipo: "fecha" },
  { key: "fechaFacturacion",   label: "Fecha de facturación",        tipo: "fecha" },
  { key: "representante",      label: "Representante",               tipo: "texto" },
  { key: "cliente",            label: "Cliente o razón social",      tipo: "texto" },
  { key: "entidadBancaria",    label: "Entidad bancaria/efectivo",   tipo: "texto" },
  { key: "numeroOperacion",    label: "Número de operación",         tipo: "texto" },
  { key: "rucDni",             label: "RUC/DNI",                     tipo: "texto" },
  { key: "numeroFactura",      label: "Número de factura/boleta",    tipo: "texto" },
  { key: "adelantoContado",    label: "Adelanto o al contado",       tipo: "texto" },
  { key: "unidad",             label: "Unidad",                      tipo: "numero" },
  { key: "precioUnitario",     label: "Precio Unitario",             tipo: "moneda" },
  { key: "montoTotal",         label: "Monto Total",                 tipo: "moneda" },
  { key: "codigoLadrillo",     label: "Código de ladrillo",          tipo: "texto" },
  { key: "deudaPendiente",     label: "Deuda pendiente",             tipo: "moneda" },
  { key: "observaciones",      label: "Observaciones",               tipo: "texto" },
];

let registros = [];          // todos los registros del sistema
let mesActual = new Date().getMonth(); // 0 = enero
let idEnEdicion = null;
let datosImportadosPendientes = null;  // buffer temporal para el flujo de importación

/* =========================================================
   CONTROL CENTRAL DE MODALES
   Garantiza que nunca haya dos ventanas modales abiertas
   al mismo tiempo (evita que una bloquee los clics de la otra).
   ========================================================= */

function cerrarTodasLasModales() {
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.hidden = true;
  });
}

function abrirModal(elementoOverlay) {
  cerrarTodasLasModales();
  elementoOverlay.hidden = false;
}

/* =========================================================
   PERSISTENCIA (localStorage)
   ========================================================= */

function cargarRegistros() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    registros = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Error leyendo localStorage:", e);
    registros = [];
  }
}

function guardarRegistros() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registros));
  } catch (e) {
    console.error("Error guardando en localStorage:", e);
    mostrarToast("No se pudo guardar en este navegador.", "error");
  }
  actualizarExcelAutomatico();
}

function generarId() {
  return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* =========================================================
   UTILIDADES DE FECHA / MES / FORMATO
   ========================================================= */

// Devuelve el índice de mes (0-11) a partir de una fecha "YYYY-MM-DD"
function mesDeFecha(fechaStr) {
  if (!fechaStr) return null;
  const partes = String(fechaStr).split("-");
  if (partes.length < 2) return null;
  return parseInt(partes[1], 10) - 1;
}

function anioDeFecha(fechaStr) {
  if (!fechaStr) return new Date().getFullYear();
  const partes = String(fechaStr).split("-");
  return parseInt(partes[0], 10) || new Date().getFullYear();
}

function formatearFecha(fechaStr) {
  if (!fechaStr) return "—";
  const partes = String(fechaStr).split("-");
  if (partes.length !== 3) return fechaStr;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatearMoneda(numero) {
  const n = Number(numero) || 0;
  return "S/ " + n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function registrosDelMes(monthIndex) {
  return registros.filter(r => mesDeFecha(r.fechaIngreso) === monthIndex);
}

function anioPredominante() {
  if (registros.length === 0) return new Date().getFullYear();
  const conteo = {};
  registros.forEach(r => {
    const a = anioDeFecha(r.fechaIngreso);
    conteo[a] = (conteo[a] || 0) + 1;
  });
  return Object.keys(conteo).sort((a, b) => conteo[b] - conteo[a])[0];
}

/* =========================================================
   MEMORIA DE RECOMENDACIÓN (autocompletado)
   Sugiere valores ya escritos antes en cada campo repetitivo,
   ordenados por frecuencia de uso (los más usados primero).
   ========================================================= */

const CAMPOS_CON_MEMORIA = [
  { campoKey: "representante",   datalistId: "listaRepresentante" },
  { campoKey: "cliente",         datalistId: "listaCliente" },
  { campoKey: "rucDni",          datalistId: "listaRucDni" },
  { campoKey: "entidadBancaria", datalistId: "listaEntidadBancaria" },
  { campoKey: "codigoLadrillo",  datalistId: "listaCodigoLadrillo" },
];

function actualizarListasAutocompletado() {
  CAMPOS_CON_MEMORIA.forEach(({ campoKey, datalistId }) => {
    const datalist = document.getElementById(datalistId);
    if (!datalist) return;

    const conteo = {};
    registros.forEach(r => {
      const valor = (r[campoKey] || "").trim();
      if (!valor) return;
      conteo[valor] = (conteo[valor] || 0) + 1;
    });

    const valoresOrdenados = Object.keys(conteo).sort((a, b) => conteo[b] - conteo[a]);
    datalist.innerHTML = valoresOrdenados.map(v => `<option value="${v.replace(/"/g, "&quot;")}"></option>`).join("");
  });
}

/* =========================================================
   EXCEL AUTOMÁTICO (File System Access API)
   Vincula un archivo .xlsx real en el disco que se reescribe
   solo cada vez que se agrega, edita, borra o importa un registro.
   Disponible solo en navegadores basados en Chromium
   (Chrome, Edge, Opera). En Firefox/Safari no aparece la opción.
   ========================================================= */

let handleExcelAutomatico = null;
const DB_NAME = "registrosLadrilleraDB";
const DB_STORE = "handles";
const DB_KEY = "excelAutomatico";

function soportaExcelAutomatico() {
  return "showSaveFilePicker" in window;
}

function abrirBaseDeDatosHandles() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function guardarHandleEnDB(handle, clave = DB_KEY) {
  const db = await abrirBaseDeDatosHandles();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(handle, clave);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function obtenerHandleDeDB(clave = DB_KEY) {
  const db = await abrirBaseDeDatosHandles();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).get(clave);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

function actualizarBadgeSync(activo) {
  const badge = document.getElementById("syncBadge");
  const texto = badge.querySelector(".status-text");
  if (activo) {
    texto.textContent = "Excel automático: Activo";
    badge.classList.add("activo");
  } else {
    texto.textContent = "Excel automático: Inactivo";
    badge.classList.remove("activo");
  }
}

// Construye el mismo libro que "Exportar todo el año" (una hoja por mes)
// y lo escribe directamente sobre el archivo vinculado, sin descargar nada.
async function actualizarExcelAutomatico() {
  if (!handleExcelAutomatico) return;
  try {
    const permiso = await handleExcelAutomatico.queryPermission({ mode: "readwrite" });
    if (permiso !== "granted") return; // se pedirá de nuevo con el botón de "reanudar"

    const wb = XLSX.utils.book_new();
    MESES.forEach((nombreMes, idx) => {
      const lista = registrosDelMes(idx).slice().sort((a, b) => (a.fechaIngreso || "").localeCompare(b.fechaIngreso || ""));
      const ws = construirHojaExcel(lista);
      XLSX.utils.book_append_sheet(wb, ws, nombreMes.slice(0, 31));
    });

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array", cellStyles: true });
    const writable = await handleExcelAutomatico.createWritable();
    await writable.write(buffer);
    await writable.close();
    mostrarToast("✅ Datos exportados correctamente a Excel", "success");
  } catch (err) {
    console.error("Error actualizando el Excel automático:", err);
    mostrarToast("No se pudo actualizar el Excel automático.", "error");
  }
}

async function activarExcelAutomatico() {
  if (!soportaExcelAutomatico()) {
    mostrarToast("Tu navegador no soporta esta función. Usa Chrome o Edge.", "error");
    return;
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: `REGISTROS_ANUALES_${anioPredominante()}.xlsx`,
      types: [{ description: "Libro de Excel", accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] } }],
    });
    handleExcelAutomatico = handle;
    await guardarHandleEnDB(handle);
    actualizarBadgeSync(true);
    mostrarToast("Excel automático activado. Se actualizará con cada cambio.", "success");
    await actualizarExcelAutomatico();
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error(err);
      mostrarToast("No se pudo vincular el archivo Excel.", "error");
    }
  }
}

// Al cargar la página, revisa si ya existía un archivo vinculado de una
// sesión anterior y, si el permiso sigue vigente, lo reactiva en silencio.
// Si el navegador ya no tiene el permiso, simplemente queda inactivo:
// el usuario puede volver a vincularlo con "Activar Excel automático".
async function intentarReanudarExcelAutomatico() {
  if (!soportaExcelAutomatico()) return;
  try {
    const handle = await obtenerHandleDeDB();
    if (!handle) return;
    const permiso = await handle.queryPermission({ mode: "readwrite" });
    if (permiso === "granted") {
      handleExcelAutomatico = handle;
      actualizarBadgeSync(true);
    }
  } catch (err) {
    console.error("No se pudo reanudar el Excel automático:", err);
  }
}

document.getElementById("btnActivarSync").addEventListener("click", activarExcelAutomatico);


/* =========================================================
   IMPORTAR CARPETA DE FACTURAS XML (SUNAT — formato UBL 2.1)
   Vincula una carpeta local; la app la revisa cada 20 segundos
   y agrega como registro nuevo cada factura XML que no haya
   importado antes. Funciona igual sin importar qué proveedor
   de facturación electrónica emitió el XML (Nubefact, Bizlinks,
   Efact, etc.), porque SUNAT exige la misma estructura para todos.
   Disponible solo en navegadores basados en Chromium.
   ========================================================= */

let handleCarpetaFacturas = null;
let intervaloVigilanciaCarpeta = null;
const DB_KEY_CARPETA = "carpetaFacturasXml";
const XML_PROCESADOS_KEY = "facturas_xml_procesadas_v1";

function soportaCarpetaFacturas() {
  return "showDirectoryPicker" in window;
}

function cargarNombresXmlProcesados() {
  try {
    const raw = localStorage.getItem(XML_PROCESADOS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (e) {
    return new Set();
  }
}

function guardarNombresXmlProcesados(set) {
  localStorage.setItem(XML_PROCESADOS_KEY, JSON.stringify(Array.from(set)));
}

let archivosXmlProcesados = cargarNombresXmlProcesados();

function actualizarBadgeCarpeta(activo) {
  const badge = document.getElementById("badgeCarpetaFacturas");
  const texto = badge.querySelector(".status-text");
  const btnEscanear = document.getElementById("btnEscanearAhora");
  if (activo) {
    texto.textContent = "Carpeta de facturas XML: Activa";
    badge.classList.add("activo");
    btnEscanear.hidden = false;
  } else {
    texto.textContent = "Carpeta de facturas XML: Inactiva";
    badge.classList.remove("activo");
    btnEscanear.hidden = true;
  }
}

// Busca, dentro de un nodo XML, el primer elemento cuyo nombre local
// (ignorando el prefijo de espacio de nombres, ej. "cbc:ID" → "ID")
// coincida con el buscado.
function elementoPorEtiqueta(contexto, nombreLocal) {
  const elementos = contexto.getElementsByTagName("*");
  for (const el of elementos) {
    const tag = el.tagName.includes(":") ? el.tagName.split(":").pop() : el.tagName;
    if (tag === nombreLocal) return el;
  }
  return null;
}

function textoPorEtiqueta(contexto, nombreLocal) {
  const el = elementoPorEtiqueta(contexto, nombreLocal);
  return el ? el.textContent.trim() : "";
}

// Lee un XML de factura/boleta electrónica SUNAT (estándar UBL 2.1,
// igual para todos los proveedores) y saca los datos que sí trae:
// número de comprobante, fecha, cliente, RUC/DNI y monto total.
function parsearFacturaXML(textoXml) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(textoXml, "application/xml");
    if (xmlDoc.querySelector("parsererror")) return null;

    const root = xmlDoc.documentElement;
    const numeroFactura = textoPorEtiqueta(root, "ID");
    const fechaEmision = textoPorEtiqueta(root, "IssueDate");

    const clienteEl = elementoPorEtiqueta(root, "AccountingCustomerParty");
    const cliente = clienteEl ? textoPorEtiqueta(clienteEl, "RegistrationName") : "";
    const rucDni = clienteEl ? textoPorEtiqueta(clienteEl, "ID") : "";

    const totalesEl = elementoPorEtiqueta(root, "LegalMonetaryTotal");
    const montoTotal = totalesEl ? parseFloat(textoPorEtiqueta(totalesEl, "PayableAmount")) || 0 : 0;

    if (!numeroFactura && !cliente) return null; // no parece ser un comprobante válido

    return { numeroFactura, fechaEmision, cliente, rucDni, montoTotal };
  } catch (err) {
    console.error("Error interpretando el XML:", err);
    return null;
  }
}

async function activarCarpetaFacturas() {
  if (!soportaCarpetaFacturas()) {
    mostrarToast("Tu navegador no soporta esta función. Usa Chrome o Edge.", "error");
    return;
  }
  try {
    const dirHandle = await window.showDirectoryPicker();
    handleCarpetaFacturas = dirHandle;
    await guardarHandleEnDB(dirHandle, DB_KEY_CARPETA);
    actualizarBadgeCarpeta(true);
    mostrarToast("Carpeta vinculada. Buscando facturas XML...", "success");
    await escanearCarpetaFacturas();
    iniciarVigilanciaCarpeta();
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error(err);
      mostrarToast("No se pudo vincular la carpeta.", "error");
    }
  }
}

// Revisa la carpeta vinculada y agrega como registro nuevo cada .xml
// que no se haya importado antes (se identifica por nombre de archivo).
async function escanearCarpetaFacturas() {
  if (!handleCarpetaFacturas) return;
  try {
    const permiso = await handleCarpetaFacturas.queryPermission({ mode: "read" });
    if (permiso !== "granted") return;

    let nuevosImportados = 0;

    for await (const [nombre, entryHandle] of handleCarpetaFacturas.entries()) {
      if (entryHandle.kind !== "file") continue;
      if (!nombre.toLowerCase().endsWith(".xml")) continue;
      if (archivosXmlProcesados.has(nombre)) continue;

      try {
        const archivo = await entryHandle.getFile();
        const texto = await archivo.text();
        const datos = parsearFacturaXML(texto);

        archivosXmlProcesados.add(nombre); // se marca como visto aunque no se pueda leer, para no reintentar siempre
        if (!datos) continue;

        registros.push({
          id: generarId(),
          fechaIngreso: datos.fechaEmision || "",
          fechaFacturacion: datos.fechaEmision || "",
          representante: "",
          cliente: datos.cliente || "",
          entidadBancaria: "",
          numeroOperacion: "",
          rucDni: datos.rucDni || "",
          numeroFactura: datos.numeroFactura || "",
          adelantoContado: "Al contado",
          unidad: 0,
          precioUnitario: 0,
          montoTotal: datos.montoTotal || 0,
          codigoLadrillo: "",
          deudaPendiente: 0,
          observaciones: `Importado automáticamente desde ${nombre}. Completa unidad, precio, código y forma de pago.`,
        });
        nuevosImportados++;
      } catch (err) {
        console.error(`Error leyendo el archivo ${nombre}:`, err);
      }
    }

    if (nuevosImportados > 0) {
      guardarNombresXmlProcesados(archivosXmlProcesados);
      guardarRegistros();
      renderTodo();
      actualizarListasAutocompletado();
      mostrarToast(`Se importaron ${nuevosImportados} factura(s) nueva(s) desde XML.`, "success");
    }
  } catch (err) {
    console.error("Error escaneando la carpeta de facturas:", err);
  }
}

function iniciarVigilanciaCarpeta() {
  if (intervaloVigilanciaCarpeta) return; // ya está corriendo, no duplicar
  intervaloVigilanciaCarpeta = setInterval(escanearCarpetaFacturas, 20000);
}

// Al cargar la página, si ya existía una carpeta vinculada de una sesión
// anterior y el permiso sigue vigente, la reactiva en silencio.
async function intentarReanudarCarpetaFacturas() {
  if (!soportaCarpetaFacturas()) return;
  try {
    const handle = await obtenerHandleDeDB(DB_KEY_CARPETA);
    if (!handle) return;
    const permiso = await handle.queryPermission({ mode: "read" });
    if (permiso === "granted") {
      handleCarpetaFacturas = handle;
      actualizarBadgeCarpeta(true);
      await escanearCarpetaFacturas();
      iniciarVigilanciaCarpeta();
    }
  } catch (err) {
    console.error("No se pudo reanudar la carpeta de facturas:", err);
  }
}

document.getElementById("btnActivarCarpetaFacturas").addEventListener("click", activarCarpetaFacturas);
document.getElementById("btnEscanearAhora").addEventListener("click", function () {
  escanearCarpetaFacturas();
  mostrarToast("Buscando facturas nuevas...", "success");
});


function renderTabs() {
  const nav = document.getElementById("monthTabs");
  nav.innerHTML = "";
  MESES.forEach((nombre, idx) => {
    const btn = document.createElement("button");
    btn.className = "month-tab" + (idx === mesActual ? " active" : "");
    btn.textContent = nombre;
    btn.addEventListener("click", () => {
      mesActual = idx;
      renderTodo();
    });
    nav.appendChild(btn);
  });
}

/* =========================================================
   RENDER: ESTADÍSTICAS
   ========================================================= */

function renderStats() {
  const cont = document.getElementById("statsRow");
  const lista = registrosDelMes(mesActual);
  const totalRegistros = lista.length;
  const montoTotal = lista.reduce((sum, r) => sum + (Number(r.montoTotal) || 0), 0);
  const deudaTotal = lista.reduce((sum, r) => sum + (Number(r.deudaPendiente) || 0), 0);

  // Variación % vs. el mes anterior (para saber de un vistazo si se vendió más o menos)
  const mesAnteriorIdx = (mesActual - 1 + 12) % 12;
  const montoMesAnterior = registrosDelMes(mesAnteriorIdx).reduce((sum, r) => sum + (Number(r.montoTotal) || 0), 0);
  let variacionHtml = `<p class="stat-variation stat-variation-neutral">Sin datos de ${MESES[mesAnteriorIdx].toLowerCase()} para comparar</p>`;
  if (montoMesAnterior > 0) {
    const variacion = ((montoTotal - montoMesAnterior) / montoMesAnterior) * 100;
    const subio = variacion >= 0;
    variacionHtml = `<p class="stat-variation ${subio ? "stat-variation-up" : "stat-variation-down"}">
      ${subio ? "▲" : "▼"} ${Math.abs(variacion).toFixed(1)}% vs. ${MESES[mesAnteriorIdx].toLowerCase()}
    </p>`;
  }

  cont.innerHTML = `
    <div class="stat-card">
      <p class="stat-label">Registros en ${MESES[mesActual]}</p>
      <p class="stat-value">${totalRegistros}</p>
    </div>
    <div class="stat-card total">
      <p class="stat-label">Monto total del mes</p>
      <p class="stat-value">${formatearMoneda(montoTotal)}</p>
      ${variacionHtml}
    </div>
    <div class="stat-card debt">
      <p class="stat-label">Deuda pendiente del mes</p>
      <p class="stat-value">${formatearMoneda(deudaTotal)}</p>
    </div>
  `;
}

/* =========================================================
   RENDER: TABLA
   ========================================================= */

function renderTablaHead() {
  const head = document.getElementById("tablaHead");
  head.innerHTML = COLUMNAS.map(c => {
    const claseNum = (c.tipo === "moneda" || c.tipo === "numero") ? " class='num'" : "";
    return `<th${claseNum}>${c.label}</th>`;
  }).join("") + "<th>Acciones</th>";
}

function renderTablaBody() {
  const body = document.getElementById("tablaBody");
  const emptyState = document.getElementById("emptyState");
  let lista = registrosDelMes(mesActual);
  lista = lista.slice().sort((a, b) => (a.fechaIngreso || "").localeCompare(b.fechaIngreso || ""));

  if (lista.length === 0) {
    body.innerHTML = "";
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  body.innerHTML = lista.map(r => {
    const celdas = COLUMNAS.map(c => {
      const valor = r[c.key];
      if (c.tipo === "fecha") return `<td>${formatearFecha(valor)}</td>`;
      if (c.tipo === "moneda") {
        if (c.key === "deudaPendiente") {
          const cls = (Number(valor) || 0) > 0 ? "debt-positive" : "debt-zero";
          return `<td class="num ${cls}">${formatearMoneda(valor)}</td>`;
        }
        return `<td class="num">${formatearMoneda(valor)}</td>`;
      }
      if (c.tipo === "numero") return `<td class="num">${valor ?? 0}</td>`;
      if (c.key === "adelantoContado") {
        const cls = valor === "Adelanto" ? "badge-adelanto" : "badge-contado";
        return `<td><span class="badge ${cls}">${valor || "—"}</span></td>`;
      }
      if (c.key === "codigoLadrillo" || c.key === "numeroOperacion" || c.key === "rucDni" || c.key === "numeroFactura") {
        return `<td class="mono">${valor || "—"}</td>`;
      }
      return `<td>${valor || "—"}</td>`;
    }).join("");

    return `<tr>
      ${celdas}
      <td class="row-actions">
        <button class="icon-btn" title="Editar" onclick="editarRegistro('${r.id}')">✏️</button>
        <button class="icon-btn danger" title="Eliminar" onclick="eliminarRegistro('${r.id}')">🗑️</button>
      </td>
    </tr>`;
  }).join("");
}

function renderTodo() {
  renderTabs();
  renderStats();
  renderTablaHead();
  renderTablaBody();
  actualizarAnalisisEstrategico();
  actualizarIndicadoresClave();
}

/* =========================================================
   ANÁLISIS ESTRATÉGICO Y OPERATIVO (2 gráficas detalladas,
   con TODOS los registros guardados) — usan Chart.js.
   ========================================================= */

const PALETA_GRAFICOS = ["#B23E28", "#47624B", "#B3801F", "#5C564A", "#8C2F1E", "#7A8B6F", "#C2B79E", "#3F5566"];

let chartTendenciaClientes = null;
let chartDistribucionProductos = null;

// Crea el gráfico si no existe, o solo actualiza sus datos si ya existe
// (evita duplicar canvases y parpadeos al volver a dibujar).
function dibujarOActualizarChart(referenciaPrevia, canvasId, config) {
  if (referenciaPrevia) {
    referenciaPrevia.data = config.data;
    referenciaPrevia.options = config.options;
    referenciaPrevia.config.type = config.type;
    referenciaPrevia.update();
    return referenciaPrevia;
  }
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === "undefined") return null;
  return new Chart(canvas, config);
}

function actualizarAnalisisEstrategico() {
  if (typeof Chart === "undefined") return; // Chart.js no cargó (sin internet la primera vez)
  actualizarGraficaTendenciaClientes();
  actualizarGraficaDistribucionProductos();
}

/* ---------------------------------------------------------
   GRÁFICA 1: Volumen de ventas y tendencia por cliente
   --------------------------------------------------------- */
function actualizarGraficaTendenciaClientes() {
  // Monto total histórico por cliente (para elegir a los principales)
  const montoHistoricoPorCliente = {};
  registros.forEach(r => {
    const nombre = (r.cliente || "Sin nombre").trim();
    montoHistoricoPorCliente[nombre] = (montoHistoricoPorCliente[nombre] || 0) + (Number(r.montoTotal) || 0);
  });

  const topClientes = Object.entries(montoHistoricoPorCliente)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([nombre]) => nombre);

  let datasets;
  if (topClientes.length > 0) {
    // Serie mensual (12 meses) por cada cliente principal
    datasets = topClientes.map((nombre, i) => {
      const datosPorMes = MESES.map((_, idx) =>
        registrosDelMes(idx)
          .filter(r => (r.cliente || "Sin nombre").trim() === nombre)
          .reduce((s, r) => s + (Number(r.montoTotal) || 0), 0)
      );
      const color = PALETA_GRAFICOS[i % PALETA_GRAFICOS.length];
      return {
        label: nombre,
        data: datosPorMes,
        borderColor: color,
        backgroundColor: color,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 5,
        fill: false,
      };
    });
  } else {
    // Sin clientes todavía: se muestra el gráfico igual, plano en cero.
    datasets = [{
      label: "Sin datos aún",
      data: MESES.map(() => 0),
      borderColor: "#C2B79E",
      backgroundColor: "#C2B79E",
      tension: 0.3,
      pointRadius: 2,
      fill: false,
    }];
  }

  chartTendenciaClientes = dibujarOActualizarChart(chartTendenciaClientes, "chartTendenciaClientes", {
    type: "line",
    data: { labels: MESES.map(m => m.slice(0, 3)), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } },
        tooltip: {
          callbacks: {
            label: (item) => `${item.dataset.label}: ${formatearMoneda(item.raw)}`,
          },
        },
      },
      scales: { y: { beginAtZero: true, ticks: { callback: v => "S/ " + v } } },
    },
  });

  // --- Tabla de detalle: Cliente, Total (mes), Var. %, Ticket promedio, Frecuencia ---
  const mesAnteriorIdx = (mesActual - 1 + 12) % 12;
  const listaMesActual = registrosDelMes(mesActual);
  const listaMesAnterior = registrosDelMes(mesAnteriorIdx);

  const datosMesPorCliente = {};
  listaMesActual.forEach(r => {
    const nombre = (r.cliente || "Sin nombre").trim();
    if (!datosMesPorCliente[nombre]) datosMesPorCliente[nombre] = { monto: 0, pedidos: 0 };
    datosMesPorCliente[nombre].monto += Number(r.montoTotal) || 0;
    datosMesPorCliente[nombre].pedidos += 1;
  });

  const montoAnteriorPorCliente = {};
  listaMesAnterior.forEach(r => {
    const nombre = (r.cliente || "Sin nombre").trim();
    montoAnteriorPorCliente[nombre] = (montoAnteriorPorCliente[nombre] || 0) + (Number(r.montoTotal) || 0);
  });

  const filasClientes = Object.entries(datosMesPorCliente)
    .sort((a, b) => b[1].monto - a[1].monto)
    .slice(0, 8);

  const cuerpoTabla = document.getElementById("tablaClientesDetalle");
  if (filasClientes.length === 0) {
    cuerpoTabla.innerHTML = `<tr class="chart-detail-empty-row"><td colspan="5">No hay ventas registradas en ${MESES[mesActual].toLowerCase()}.</td></tr>`;
  } else {
    cuerpoTabla.innerHTML = filasClientes.map(([nombre, datos]) => {
      const ticketProm = datos.pedidos > 0 ? datos.monto / datos.pedidos : 0;
      const montoAnterior = montoAnteriorPorCliente[nombre] || 0;

      let variacionTexto = "Nuevo";
      let claseVariacion = "neutral";
      if (montoAnterior > 0) {
        const variacion = ((datos.monto - montoAnterior) / montoAnterior) * 100;
        claseVariacion = variacion >= 0 ? "up" : "down";
        variacionTexto = `${variacion >= 0 ? "▲" : "▼"} ${Math.abs(variacion).toFixed(1)}%`;
      }

      return `<tr>
        <td title="${nombre}">${nombre}</td>
        <td class="num">${formatearMoneda(datos.monto)}</td>
        <td class="num ${claseVariacion}">${variacionTexto}</td>
        <td class="num">${formatearMoneda(ticketProm)}</td>
        <td class="num">${datos.pedidos} pedido${datos.pedidos === 1 ? "" : "s"}</td>
      </tr>`;
    }).join("");
  }
}

/* ---------------------------------------------------------
   GRÁFICA 2: Distribución por código de ladrillo y margen
   --------------------------------------------------------- */
function actualizarGraficaDistribucionProductos() {
  const datosPorCodigo = {};
  registros.forEach(r => {
    const codigo = (r.codigoLadrillo || "Sin código").trim() || "Sin código";
    if (!datosPorCodigo[codigo]) datosPorCodigo[codigo] = { unidades: 0, ingreso: 0 };
    datosPorCodigo[codigo].unidades += Number(r.unidad) || 0;
    datosPorCodigo[codigo].ingreso += Number(r.montoTotal) || 0;
  });

  const codigosOrdenados = Object.entries(datosPorCodigo).sort((a, b) => b[1].ingreso - a[1].ingreso);
  const ingresoTotal = codigosOrdenados.reduce((s, [, d]) => s + d.ingreso, 0);

  let etiquetas, valores, colores, tooltipFn;
  if (ingresoTotal > 0) {
    etiquetas = codigosOrdenados.map(([codigo]) => codigo);
    valores = codigosOrdenados.map(([, d]) => d.ingreso);
    colores = PALETA_GRAFICOS;
    tooltipFn = (item) => {
      const pct = ((item.raw / ingresoTotal) * 100).toFixed(1);
      return `${item.label}: ${formatearMoneda(item.raw)} (${pct}%)`;
    };
  } else {
    // Sin ventas todavía: círculo completo en gris neutro, en vez de nada.
    etiquetas = ["Sin datos aún"];
    valores = [1];
    colores = ["#D7CDB8"];
    tooltipFn = () => "Aún no hay ventas registradas.";
  }

  chartDistribucionProductos = dibujarOActualizarChart(chartDistribucionProductos, "chartDistribucionProductos", {
    type: "doughnut",
    data: {
      labels: etiquetas,
      datasets: [{
        data: valores,
        backgroundColor: colores,
        borderColor: "#FFFFFF",
        borderWidth: 3,
        hoverOffset: 10,
        hoverBorderWidth: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "55%",
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 13, font: { size: 12 }, padding: 14 } },
        tooltip: { callbacks: { label: tooltipFn } },
      },
    },
  });

  // --- Tabla de detalle: Código, Unidades, Ingreso, % Participación, Margen ---
  const cuerpoTabla = document.getElementById("tablaProductosDetalle");
  if (codigosOrdenados.length === 0) {
    cuerpoTabla.innerHTML = `<tr class="chart-detail-empty-row"><td colspan="5">Aún no hay ventas registradas.</td></tr>`;
  } else {
    cuerpoTabla.innerHTML = codigosOrdenados.map(([codigo, d]) => {
      const pct = ingresoTotal > 0 ? (d.ingreso / ingresoTotal) * 100 : 0;
      return `<tr>
        <td title="${codigo}">${codigo}</td>
        <td class="num">${d.unidades}</td>
        <td class="num">${formatearMoneda(d.ingreso)}</td>
        <td class="num">${pct.toFixed(1)}%</td>
        <td class="num neutral">N/D</td>
      </tr>`;
    }).join("");
  }
}


/* =========================================================
   INDICADORES CLAVE (ticket promedio, variación detallada,
   racha de ventas). Se apoyan en TODOS los registros guardados.
   ========================================================= */

// Convierte "YYYY-MM-DD" en un objeto Date a medianoche local,
// evitando el corrimiento de un día que causa "new Date('YYYY-MM-DD')".
function fechaLocalDesdeTexto(fechaStr) {
  return new Date(fechaStr + "T00:00:00");
}

function diferenciaEnDias(fechaA, fechaB) {
  const msPorDia = 1000 * 60 * 60 * 24;
  return Math.round((fechaA.getTime() - fechaB.getTime()) / msPorDia);
}

function actualizarIndicadoresClave() {
  actualizarKpiTicketPromedio();
  actualizarKpiVariacionDetallada();
  actualizarKpiRachaVentas();
}

// --- 1. Ticket promedio: ¿muchas ventas chicas o pocas ventas grandes? ---
function actualizarKpiTicketPromedio() {
  const cont = document.getElementById("kpiTicketPromedio");
  const listaMes = registrosDelMes(mesActual);
  const nMes = listaMes.length;
  const montoMes = listaMes.reduce((s, r) => s + (Number(r.montoTotal) || 0), 0);
  const ticketMes = nMes > 0 ? montoMes / nMes : 0;

  const nHistorico = registros.length;
  const montoHistorico = registros.reduce((s, r) => s + (Number(r.montoTotal) || 0), 0);
  const ticketHistorico = nHistorico > 0 ? montoHistorico / nHistorico : 0;

  let interpretacion = "Aún no hay suficientes ventas este mes para comparar.";
  let claseValor = "neutral";
  if (nMes > 0 && ticketHistorico > 0) {
    const diferenciaPct = ((ticketMes - ticketHistorico) / ticketHistorico) * 100;
    if (diferenciaPct >= 15) {
      interpretacion = `📈 Estás cerrando pocas ventas grandes (ticket ${diferenciaPct.toFixed(0)}% más alto que tu promedio histórico).`;
      claseValor = "up";
    } else if (diferenciaPct <= -15) {
      interpretacion = `📉 Estás cerrando muchas ventas chicas (ticket ${Math.abs(diferenciaPct).toFixed(0)}% más bajo que tu promedio histórico).`;
      claseValor = "down";
    } else {
      interpretacion = "Tu tamaño de venta este mes es similar a tu promedio histórico.";
      claseValor = "neutral";
    }
  }

  const confiable = nMes >= 5;
  const tagHtml = nMes === 0
    ? ""
    : confiable
      ? `<span class="kpi-tag kpi-tag-ok">✓ Basado en ${nMes} venta${nMes === 1 ? "" : "s"}</span>`
      : `<span class="kpi-tag kpi-tag-warn">⚠️ Muestra pequeña (${nMes} venta${nMes === 1 ? "" : "s"})</span>`;

  cont.innerHTML = `
    <div class="kpi-card-header">
      <span class="kpi-icon">🎯</span>
      <span class="kpi-card-title">Tamaño de venta</span>
    </div>
    <p class="kpi-value ${claseValor}">${formatearMoneda(ticketMes)}</p>
    <p class="kpi-interpretation">${interpretacion}</p>
    <div class="kpi-detail-list">
      <span>Ticket promedio histórico: <strong>${formatearMoneda(ticketHistorico)}</strong></span>
      <span>Ventas este mes: <strong>${nMes}</strong> · Total histórico: <strong>${nHistorico}</strong></span>
    </div>
    ${tagHtml}
  `;
}

// --- 2. Variación % vs. mes anterior, con contexto detallado ---
function actualizarKpiVariacionDetallada() {
  const cont = document.getElementById("kpiVariacionDetallada");
  const mesAnteriorIdx = (mesActual - 1 + 12) % 12;

  const listaMes = registrosDelMes(mesActual);
  const listaAnterior = registrosDelMes(mesAnteriorIdx);

  const montoMes = listaMes.reduce((s, r) => s + (Number(r.montoTotal) || 0), 0);
  const montoAnterior = listaAnterior.reduce((s, r) => s + (Number(r.montoTotal) || 0), 0);
  const nMes = listaMes.length;
  const nAnterior = listaAnterior.length;

  let valorHtml = "—";
  let interpretacion = `Aún no hay registros en ${MESES[mesAnteriorIdx].toLowerCase()} para comparar.`;
  let claseValor = "neutral";
  let tagHtml = "";

  if (montoAnterior > 0) {
    const variacionMonto = ((montoMes - montoAnterior) / montoAnterior) * 100;
    const subio = variacionMonto >= 0;
    claseValor = subio ? "up" : "down";
    valorHtml = `${subio ? "▲" : "▼"} ${Math.abs(variacionMonto).toFixed(1)}%`;
    interpretacion = subio
      ? `Vendiste más que en ${MESES[mesAnteriorIdx].toLowerCase()}.`
      : `Vendiste menos que en ${MESES[mesAnteriorIdx].toLowerCase()}.`;

    const confiable = nAnterior >= 3 && nMes >= 3;
    tagHtml = confiable
      ? `<span class="kpi-tag kpi-tag-ok">✓ Comparación confiable</span>`
      : `<span class="kpi-tag kpi-tag-warn">⚠️ Pocos registros para comparar bien</span>`;
  }

  cont.innerHTML = `
    <div class="kpi-card-header">
      <span class="kpi-icon">📊</span>
      <span class="kpi-card-title">Variación vs. mes anterior</span>
    </div>
    <p class="kpi-value ${claseValor}">${valorHtml}</p>
    <p class="kpi-interpretation">${interpretacion}</p>
    <div class="kpi-detail-list">
      <span>${MESES[mesActual]}: <strong>${formatearMoneda(montoMes)}</strong> (${nMes} venta${nMes === 1 ? "" : "s"})</span>
      <span>${MESES[mesAnteriorIdx]}: <strong>${formatearMoneda(montoAnterior)}</strong> (${nAnterior} venta${nAnterior === 1 ? "" : "s"})</span>
    </div>
    ${tagHtml}
  `;
}

// --- 3. Racha de ventas: días consecutivos con al menos una venta ---
function actualizarKpiRachaVentas() {
  const cont = document.getElementById("kpiRachaVentas");

  const fechasUnicas = Array.from(new Set(registros.map(r => r.fechaIngreso).filter(Boolean)))
    .map(fechaLocalDesdeTexto)
    .sort((a, b) => a - b);

  if (fechasUnicas.length === 0) {
    cont.innerHTML = `
      <div class="kpi-card-header">
        <span class="kpi-icon">🔥</span>
        <span class="kpi-card-title">Racha de ventas</span>
      </div>
      <p class="kpi-value neutral">—</p>
      <p class="kpi-interpretation">Aún no hay registros para calcular una racha.</p>
    `;
    return;
  }

  // Racha más larga registrada en todo el historial
  let rachaMaxima = 1, rachaActualCalculo = 1;
  for (let i = 1; i < fechasUnicas.length; i++) {
    if (diferenciaEnDias(fechasUnicas[i], fechasUnicas[i - 1]) === 1) {
      rachaActualCalculo++;
      rachaMaxima = Math.max(rachaMaxima, rachaActualCalculo);
    } else {
      rachaActualCalculo = 1;
    }
  }

  // Racha vigente: consecutiva terminando en la última fecha con ventas
  const ultimaFecha = fechasUnicas[fechasUnicas.length - 1];
  let rachaActual = 1;
  for (let i = fechasUnicas.length - 1; i > 0; i--) {
    if (diferenciaEnDias(fechasUnicas[i], fechasUnicas[i - 1]) === 1) {
      rachaActual++;
    } else {
      break;
    }
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diasSinVentas = diferenciaEnDias(hoy, ultimaFecha);

  let interpretacion, claseValor, tagHtml;
  if (diasSinVentas <= 0) {
    interpretacion = `🔥 Racha activa: ${rachaActual} día${rachaActual === 1 ? "" : "s"} seguido${rachaActual === 1 ? "" : "s"} con ventas, incluyendo hoy.`;
    claseValor = "up";
    tagHtml = `<span class="kpi-tag kpi-tag-ok">✓ Racha vigente</span>`;
  } else {
    interpretacion = `Sin ventas registradas en los últimos ${diasSinVentas} día${diasSinVentas === 1 ? "" : "s"}. La última racha activa duró ${rachaActual} día${rachaActual === 1 ? "" : "s"}.`;
    claseValor = diasSinVentas >= 5 ? "down" : "neutral";
    tagHtml = `<span class="kpi-tag kpi-tag-warn">⚠️ Racha interrumpida</span>`;
  }

  cont.innerHTML = `
    <div class="kpi-card-header">
      <span class="kpi-icon">🔥</span>
      <span class="kpi-card-title">Racha de ventas</span>
    </div>
    <p class="kpi-value ${claseValor}">${diasSinVentas <= 0 ? rachaActual : 0} día${(diasSinVentas <= 0 ? rachaActual : 0) === 1 ? "" : "s"}</p>
    <p class="kpi-interpretation">${interpretacion}</p>
    <div class="kpi-detail-list">
      <span>Récord histórico: <strong>${rachaMaxima} día${rachaMaxima === 1 ? "" : "s"}</strong> seguidos</span>
      <span>Última venta registrada: <strong>${formatearFecha(ultimaFecha.toISOString().slice(0, 10))}</strong></span>
    </div>
    ${tagHtml}
  `;
}

/* =========================================================
   MODAL: NUEVO / EDITAR REGISTRO
   ========================================================= */

const modalRegistro = document.getElementById("modalRegistro");
const formRegistro = document.getElementById("formRegistro");

function abrirModalNuevo() {
  idEnEdicion = null;
  document.getElementById("modalTitulo").textContent = "Nuevo registro";
  formRegistro.reset();
  document.getElementById("campoId").value = "";
  document.getElementById("campoDeudaPendiente").value = 0;
  actualizarListasAutocompletado();
  // Sugerir fecha de ingreso dentro del mes activo, día de hoy si coincide, si no el día 1.
  const hoy = new Date();
  let fechaSugerida;
  if (hoy.getMonth() === mesActual) {
    fechaSugerida = hoy.toISOString().slice(0, 10);
  } else {
    fechaSugerida = `${hoy.getFullYear()}-${String(mesActual + 1).padStart(2, "0")}-01`;
  }
  document.getElementById("campoFechaIngreso").value = fechaSugerida;
  abrirModal(modalRegistro);
}

function editarRegistro(id) {
  const r = registros.find(x => x.id === id);
  if (!r) return;
  idEnEdicion = id;
  actualizarListasAutocompletado();
  document.getElementById("modalTitulo").textContent = "Editar registro";
  document.getElementById("campoId").value = r.id;
  document.getElementById("campoFechaIngreso").value = r.fechaIngreso || "";
  document.getElementById("campoFechaFacturacion").value = r.fechaFacturacion || "";
  document.getElementById("campoRepresentante").value = r.representante || "";
  document.getElementById("campoCliente").value = r.cliente || "";
  document.getElementById("campoEntidadBancaria").value = r.entidadBancaria || "";
  document.getElementById("campoNumeroOperacion").value = r.numeroOperacion || "";
  document.getElementById("campoRucDni").value = r.rucDni || "";
  document.getElementById("campoNumeroFactura").value = r.numeroFactura || "";
  document.getElementById("campoAdelantoContado").value = r.adelantoContado || "Al contado";
  document.getElementById("campoUnidad").value = r.unidad ?? 0;
  document.getElementById("campoPrecioUnitario").value = r.precioUnitario ?? 0;
  document.getElementById("campoMontoTotal").value = r.montoTotal ?? 0;
  document.getElementById("campoCodigoLadrillo").value = r.codigoLadrillo || "";
  document.getElementById("campoDeudaPendiente").value = r.deudaPendiente ?? 0;
  document.getElementById("campoObservaciones").value = r.observaciones || "";
  abrirModal(modalRegistro);
}

function cerrarModalRegistro() {
  modalRegistro.hidden = true;
  idEnEdicion = null;
}

function eliminarRegistro(id) {
  const r = registros.find(x => x.id === id);
  if (!r) return;
  const ok = confirm(`¿Eliminar el registro de "${r.cliente || "cliente sin nombre"}"? Esta acción no se puede deshacer.`);
  if (!ok) return;
  registros = registros.filter(x => x.id !== id);
  guardarRegistros();
  renderTodo();
  mostrarToast("Registro eliminado.", "success");
}

// Recalcular monto total automáticamente al cambiar unidad o precio unitario
function recalcularMontoTotal() {
  const unidad = parseFloat(document.getElementById("campoUnidad").value) || 0;
  const precio = parseFloat(document.getElementById("campoPrecioUnitario").value) || 0;
  document.getElementById("campoMontoTotal").value = (unidad * precio).toFixed(2);
}
document.getElementById("campoUnidad").addEventListener("input", recalcularMontoTotal);
document.getElementById("campoPrecioUnitario").addEventListener("input", recalcularMontoTotal);

formRegistro.addEventListener("submit", function (e) {
  e.preventDefault();

  const registro = {
    id: idEnEdicion || generarId(),
    fechaIngreso: document.getElementById("campoFechaIngreso").value,
    fechaFacturacion: document.getElementById("campoFechaFacturacion").value,
    representante: document.getElementById("campoRepresentante").value.trim(),
    cliente: document.getElementById("campoCliente").value.trim(),
    entidadBancaria: document.getElementById("campoEntidadBancaria").value.trim(),
    numeroOperacion: document.getElementById("campoNumeroOperacion").value.trim(),
    rucDni: document.getElementById("campoRucDni").value.trim(),
    numeroFactura: document.getElementById("campoNumeroFactura").value.trim(),
    adelantoContado: document.getElementById("campoAdelantoContado").value,
    unidad: parseFloat(document.getElementById("campoUnidad").value) || 0,
    precioUnitario: parseFloat(document.getElementById("campoPrecioUnitario").value) || 0,
    montoTotal: parseFloat(document.getElementById("campoMontoTotal").value) || 0,
    codigoLadrillo: document.getElementById("campoCodigoLadrillo").value.trim(),
    deudaPendiente: parseFloat(document.getElementById("campoDeudaPendiente").value) || 0,
    observaciones: document.getElementById("campoObservaciones").value.trim(),
  };

  if (idEnEdicion) {
    registros = registros.map(r => (r.id === idEnEdicion ? registro : r));
    mostrarToast("Registro actualizado.", "success");
  } else {
    registros.push(registro);
    mostrarToast("Registro agregado.", "success");
  }

  guardarRegistros();

  // Si el registro pertenece a otro mes, saltar a ese mes para mostrarlo.
  const mesDelRegistro = mesDeFecha(registro.fechaIngreso);
  if (mesDelRegistro !== null) mesActual = mesDelRegistro;

  cerrarModalRegistro();
  renderTodo();
});

document.getElementById("btnNuevo").addEventListener("click", abrirModalNuevo);
document.getElementById("cancelarRegistro").addEventListener("click", cerrarModalRegistro);
document.getElementById("cerrarModalRegistro").addEventListener("click", cerrarModalRegistro);
modalRegistro.addEventListener("click", (e) => { if (e.target === modalRegistro) cerrarModalRegistro(); });

document.getElementById("modalImportar").addEventListener("click", (e) => {
  if (e.target.id === "modalImportar") cerrarModalImportar();
});

document.getElementById("modalBorrarTodo").addEventListener("click", (e) => {
  if (e.target.id === "modalBorrarTodo") cerrarModalBorrarTodo();
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!modalRegistro.hidden) cerrarModalRegistro();
  if (!document.getElementById("modalImportar").hidden) cerrarModalImportar();
  if (!document.getElementById("modalBorrarTodo").hidden) cerrarModalBorrarTodo();
});

/* =========================================================
   BORRAR TODOS LOS DATOS
   ========================================================= */

function cerrarModalBorrarTodo() {
  document.getElementById("modalBorrarTodo").hidden = true;
}

document.getElementById("btnBorrarTodo").addEventListener("click", function () {
  cerrarTodosLosDropdowns();
  abrirModal(document.getElementById("modalBorrarTodo"));
});

document.getElementById("btnCancelarBorrarTodo").addEventListener("click", cerrarModalBorrarTodo);

document.getElementById("btnConfirmarBorrarTodo").addEventListener("click", function () {
  registros = [];
  guardarRegistros();
  renderTodo();
  actualizarListasAutocompletado();
  cerrarModalBorrarTodo();
  mostrarToast("Todos los datos fueron borrados.", "success");
});

/* =========================================================
   TOASTS
   ========================================================= */

function mostrarToast(mensaje, tipo = "info") {
  const cont = document.getElementById("toastContainer");
  const el = document.createElement("div");
  el.className = "toast " + tipo;
  el.textContent = mensaje;
  cont.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* =========================================================
   EXCEL — CONSTRUCCIÓN DE HOJAS (SheetJS)
   ========================================================= */

// Convierte una lista de registros (ya ordenada) en una hoja de cálculo
// con encabezados en negrita, autofiltro, fila congelada, formato de
// moneda y fechas, y columnas ajustadas automáticamente.
function construirHojaExcel(lista) {
  const encabezados = COLUMNAS.map(c => c.label);
  const filas = lista.map(r => COLUMNAS.map(c => {
    if (c.tipo === "fecha") return r[c.key] ? new Date(r[c.key] + "T00:00:00") : "";
    if (c.tipo === "moneda" || c.tipo === "numero") return Number(r[c.key]) || 0;
    return r[c.key] || "";
  }));

  const datos = [encabezados, ...filas];
  const ws = XLSX.utils.aoa_to_sheet(datos);

  // Ancho de columnas automático (basado en el contenido más largo de cada una)
  ws["!cols"] = COLUMNAS.map((c, i) => {
    let maxLen = c.label.length;
    filas.forEach(fila => {
      const val = fila[i];
      const len = val instanceof Date ? 10 : String(val ?? "").length;
      if (len > maxLen) maxLen = len;
    });
    return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
  });

  const totalFilas = datos.length;
  const totalCols = COLUMNAS.length;
  const rangoRef = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalFilas - 1, c: totalCols - 1 } });
  ws["!ref"] = rangoRef;

  // Autofiltro en la fila de encabezados
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }) };

  // Primera fila congelada
  ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };

  // Estilo de encabezados: negrita + fondo oscuro (mejor esfuerzo; algunos
  // visores de Excel no aplican estilos escritos por librerías gratuitas).
  for (let c = 0; c < totalCols; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[cellRef]) continue;
    ws[cellRef].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "23201B" } },
      alignment: { vertical: "center" },
    };
  }

  // Formato de moneda para Precio Unitario, Monto Total y Deuda pendiente,
  // y formato de fecha para las columnas de fecha.
  COLUMNAS.forEach((c, colIdx) => {
    if (c.tipo !== "moneda" && c.tipo !== "fecha") return;
    for (let r = 1; r < totalFilas; r++) {
      const cellRef = XLSX.utils.encode_cell({ r, c: colIdx });
      if (!ws[cellRef]) continue;
      if (c.tipo === "moneda") ws[cellRef].z = '"S/"#,##0.00';
      if (c.tipo === "fecha") ws[cellRef].z = "dd/mm/yyyy";
    }
  });

  return ws;
}

// Antes descargaba directo a la carpeta de Descargas del navegador.
// Ahora, si el navegador lo permite, pregunta primero en qué carpeta
// guardar (el mismo cuadro de "Guardar como" de Windows/Mac).
async function descargarLibro(wb, nombreArchivoSugerido) {
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array", cellStyles: true });

  if ("showSaveFilePicker" in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: nombreArchivoSugerido,
        types: [{
          description: "Libro de Excel",
          accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(buffer);
      await writable.close();
      return true;
    } catch (err) {
      if (err.name === "AbortError") return false; // el usuario cerró el cuadro sin elegir carpeta
      console.error("No se pudo guardar con el selector de carpeta:", err);
      // si falla por otra razón, se intenta con el método de respaldo abajo
    }
  }

  // Respaldo para navegadores sin este selector (Firefox, Safari):
  // se descarga directo a la carpeta de Descargas, como antes.
  XLSX.writeFile(wb, nombreArchivoSugerido, { cellStyles: true });
  return true;
}

/* =========================================================
   EXCEL — EXPORTAR MES / AÑO
   ========================================================= */

async function exportarMesExcel() {
  const lista = registrosDelMes(mesActual).slice().sort((a, b) => (a.fechaIngreso || "").localeCompare(b.fechaIngreso || ""));
  if (lista.length === 0) {
    mostrarToast(`No hay registros en ${MESES[mesActual]} para exportar.`, "error");
    return;
  }
  const anio = anioDeFecha(lista[0].fechaIngreso) || anioPredominante();
  const ws = construirHojaExcel(lista);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, MESES[mesActual].slice(0, 31));
  const nombreArchivo = `REGISTROS_${MESES[mesActual]}_${anio}.xlsx`;
  const guardado = await descargarLibro(wb, nombreArchivo);
  if (guardado) mostrarToast("✅ Datos exportados correctamente a Excel", "success");
}

async function exportarTodoExcel() {
  if (registros.length === 0) {
    mostrarToast("No hay registros guardados para exportar.", "error");
    return;
  }
  const anio = anioPredominante();
  const wb = XLSX.utils.book_new();
  let algunaHoja = false;

  MESES.forEach((nombreMes, idx) => {
    const lista = registrosDelMes(idx).slice().sort((a, b) => (a.fechaIngreso || "").localeCompare(b.fechaIngreso || ""));
    const filasParaHoja = lista.length > 0 ? lista : [];
    // Aun sin registros, se crea la hoja vacía con encabezados para mantener las 12 hojas.
    const ws = construirHojaExcel(filasParaHoja);
    XLSX.utils.book_append_sheet(wb, ws, nombreMes.slice(0, 31));
    if (lista.length > 0) algunaHoja = true;
  });

  if (!algunaHoja) {
    mostrarToast("No hay registros guardados para exportar.", "error");
    return;
  }

  const guardado = await descargarLibro(wb, `REGISTROS_ANUALES_${anio}.xlsx`);
  if (guardado) mostrarToast("✅ Datos exportados correctamente a Excel", "success");
}

document.getElementById("btnExportarMes").addEventListener("click", exportarMesExcel);
document.getElementById("btnExportarAnio").addEventListener("click", exportarTodoExcel);

/* =========================================================
   EXCEL — IMPORTAR
   ========================================================= */

function normalizarEncabezado(txt) {
  return String(txt || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// Convierte las filas crudas del Excel (array de objetos con claves = encabezados)
// en registros con las claves internas del sistema, respetando el orden de columnas
// declarado. Si los encabezados no coinciden con los esperados, cae a posición.
function mapearFilasImportadas(filasCrudas, encabezadosOriginales) {
  const mapaEncabezados = {};
  encabezadosOriginales.forEach((h, i) => {
    mapaEncabezados[normalizarEncabezado(h)] = i;
  });

  const usarPosicion = COLUMNAS.every(c => mapaEncabezados[normalizarEncabezado(c.label)] === undefined);

  return filasCrudas.map(filaArray => {
    const registro = { id: generarId() };
    COLUMNAS.forEach((c, idx) => {
      let valorCrudo;
      if (usarPosicion) {
        valorCrudo = filaArray[idx];
      } else {
        const posEncabezado = mapaEncabezados[normalizarEncabezado(c.label)];
        valorCrudo = posEncabezado !== undefined ? filaArray[posEncabezado] : "";
      }

      if (c.tipo === "fecha") {
        registro[c.key] = convertirValorFecha(valorCrudo);
      } else if (c.tipo === "moneda" || c.tipo === "numero") {
        registro[c.key] = parseFloat(valorCrudo) || 0;
      } else {
        registro[c.key] = valorCrudo != null ? String(valorCrudo).trim() : "";
      }
    });
    return registro;
  }).filter(r => r.fechaIngreso || r.cliente); // descarta filas totalmente vacías
}

function convertirValorFecha(valor) {
  if (!valor) return "";
  // Fecha serial de Excel (número)
  if (typeof valor === "number") {
    const fecha = XLSX.SSF.parse_date_code(valor);
    if (!fecha) return "";
    return `${fecha.y}-${String(fecha.m).padStart(2, "0")}-${String(fecha.d).padStart(2, "0")}`;
  }
  // Texto tipo dd/mm/yyyy
  const txt = String(valor).trim();
  const conBarras = txt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (conBarras) {
    return `${conBarras[3]}-${conBarras[2].padStart(2, "0")}-${conBarras[1].padStart(2, "0")}`;
  }
  // Ya viene como YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(txt)) return txt.slice(0, 10);
  return "";
}

document.getElementById("inputImportarExcel").addEventListener("change", function (e) {
  const archivo = e.target.files[0];
  if (!archivo) return;
  cerrarTodosLosDropdowns();

  const lector = new FileReader();
  lector.onload = function (evt) {
    try {
      const wb = XLSX.read(evt.target.result, { type: "array", cellDates: false });

      // Lee TODAS las hojas del archivo (por ejemplo, las 12 hojas de un
      // Excel exportado con "Exportar todo el año") y junta los registros
      // de todas ellas, no solo de la primera.
      let registrosCombinados = [];
      let hojasConDatos = 0;

      wb.SheetNames.forEach((nombreHoja) => {
        const hoja = wb.Sheets[nombreHoja];
        const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: "" });
        if (filas.length < 2) return; // hoja vacía (solo encabezado o nada), se salta

        const encabezados = filas[0];
        const filasDatos = filas.slice(1);
        const nuevos = mapearFilasImportadas(filasDatos, encabezados);
        if (nuevos.length > 0) {
          registrosCombinados = registrosCombinados.concat(nuevos);
          hojasConDatos++;
        }
      });

      if (registrosCombinados.length === 0) {
        mostrarToast("El archivo Excel no contiene registros para importar.", "error");
        return;
      }

      datosImportadosPendientes = registrosCombinados;
      document.getElementById("textoImportarResumen").textContent =
        `Se encontraron ${registrosCombinados.length} registro(s) en ${hojasConDatos} hoja(s) del archivo. ¿Deseas agregar estos registros a los datos existentes?`;
      abrirModal(document.getElementById("modalImportar"));
    } catch (err) {
      console.error(err);
      mostrarToast("No se pudo leer el archivo Excel.", "error");
    } finally {
      e.target.value = "";
    }
  };
  lector.readAsArrayBuffer(archivo);
});

document.getElementById("btnAgregarDatos").addEventListener("click", function () {
  if (!datosImportadosPendientes) return;
  registros = registros.concat(datosImportadosPendientes);
  guardarRegistros();
  cerrarModalImportar();
  renderTodo();
  mostrarToast("✅ Datos exportados correctamente a Excel".replace("exportados", "importados"), "success");
});

document.getElementById("btnReemplazarDatos").addEventListener("click", function () {
  if (!datosImportadosPendientes) return;

  // Reemplaza los datos de TODOS los meses que vienen en el archivo
  // importado (puede ser uno solo, o los 12 si importaste el Excel anual),
  // no solo el mes que tengas abierto en pantalla en este momento.
  const mesesEnArchivo = new Set(
    datosImportadosPendientes.map(r => mesDeFecha(r.fechaIngreso)).filter(m => m !== null)
  );
  registros = registros.filter(r => !mesesEnArchivo.has(mesDeFecha(r.fechaIngreso)));
  registros = registros.concat(datosImportadosPendientes);

  guardarRegistros();
  cerrarModalImportar();
  renderTodo();

  const nombresMeses = Array.from(mesesEnArchivo).sort((a, b) => a - b).map(m => MESES[m]).join(", ");
  mostrarToast(`Datos reemplazados correctamente (${nombresMeses}).`, "success");
});

document.getElementById("btnCancelarImportar").addEventListener("click", cerrarModalImportar);

function cerrarModalImportar() {
  document.getElementById("modalImportar").hidden = true;
  datosImportadosPendientes = null;
}

/* =========================================================
   COPIA DE SEGURIDAD (usa el mismo almacenamiento del sistema:
   localStorage, bajo la clave STORAGE_KEY, en formato JSON)
   ========================================================= */

let archivoRespaldoSeleccionado = null;

// --- Crear copia de seguridad ---
document.getElementById("btnCrearRespaldo").addEventListener("click", function () {
  const contenido = JSON.stringify({ version: 1, exportadoEn: new Date().toISOString(), registros }, null, 2);
  const blob = new Blob([contenido], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const fecha = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `COPIA_SEGURIDAD_REGISTROS_${fecha}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  mostrarToast("Copia de seguridad creada y descargada.", "success");
});

// --- Selección de archivo para restaurar (paso 1 de 2) ---
document.getElementById("inputRestaurarRespaldo").addEventListener("change", function (e) {
  const archivo = e.target.files[0] || null;
  archivoRespaldoSeleccionado = archivo;

  const nombreEl = document.getElementById("nombreArchivoRespaldo");
  const btnRestaurar = document.getElementById("btnRestaurarRespaldo");

  if (archivo) {
    nombreEl.textContent = `Archivo seleccionado: ${archivo.name}`;
    btnRestaurar.disabled = false;
  } else {
    nombreEl.textContent = "Ningún archivo seleccionado.";
    btnRestaurar.disabled = true;
  }
});

// --- Restaurar copia de seguridad (paso 2 de 2) ---
document.getElementById("btnRestaurarRespaldo").addEventListener("click", function () {
  if (!archivoRespaldoSeleccionado) {
    mostrarToast("Primero selecciona un archivo de respaldo.", "error");
    return;
  }

  const lector = new FileReader();
  lector.onload = function (evt) {
    try {
      const data = JSON.parse(evt.target.result);
      const listaRestaurada = Array.isArray(data) ? data : data.registros;
      if (!Array.isArray(listaRestaurada)) throw new Error("Formato inválido");

      const ok = confirm(`Se restaurarán ${listaRestaurada.length} registro(s) desde el respaldo. Esto reemplazará TODOS los datos actuales. ¿Continuar?`);
      if (!ok) return;

      registros = listaRestaurada;
      guardarRegistros();
      renderTodo();
      actualizarListasAutocompletado();
      mostrarToast("Copia de seguridad restaurada correctamente.", "success");

      // Limpiar la selección para evitar restaurar el mismo archivo dos veces por error.
      archivoRespaldoSeleccionado = null;
      document.getElementById("nombreArchivoRespaldo").textContent = "Ningún archivo seleccionado.";
      document.getElementById("btnRestaurarRespaldo").disabled = true;
      document.getElementById("inputRestaurarRespaldo").value = "";
    } catch (err) {
      console.error(err);
      mostrarToast("El archivo de copia de seguridad no es válido.", "error");
    }
  };
  lector.readAsText(archivoRespaldoSeleccionado);
});

/* =========================================================
   MENÚS DESPLEGABLES ("Más acciones" y "Caja de seguridad")
   ========================================================= */

const DEFINICIONES_DROPDOWN = [
  { contenedorId: "dropdownMasAcciones", botonId: "btnMasAcciones", menuId: "menuMasAcciones" },
  { contenedorId: "dropdownSafebox", botonId: "btnSafebox", menuId: "menuSafebox" },
];

function cerrarTodosLosDropdowns() {
  DEFINICIONES_DROPDOWN.forEach(({ botonId, menuId }) => {
    document.getElementById(menuId).hidden = true;
    document.getElementById(botonId).setAttribute("aria-expanded", "false");
  });
}

DEFINICIONES_DROPDOWN.forEach(({ contenedorId, botonId, menuId }) => {
  const boton = document.getElementById(botonId);
  const menu = document.getElementById(menuId);

  boton.addEventListener("click", function (e) {
    e.stopPropagation();
    const estaAbierto = !menu.hidden;
    cerrarTodosLosDropdowns(); // solo uno abierto a la vez
    if (!estaAbierto) {
      menu.hidden = false;
      boton.setAttribute("aria-expanded", "true");
    }
  });

  // Cerrar al elegir una opción de adentro (excepto los controles que abren
  // un selector de archivos nativo: si cerramos el menú en el mismo clic,
  // el navegador cancela el diálogo de "elegir archivo" antes de mostrarlo).
  menu.addEventListener("click", (e) => {
    if (e.target.closest("#btnRestaurarRespaldo, #inputRestaurarRespaldo, label[for='inputRestaurarRespaldo']")) return;
    if (e.target.closest("label[for='inputImportarExcel'], #inputImportarExcel")) return;
    if (e.target.closest(".dropdown-item, #btnCrearRespaldo")) cerrarTodosLosDropdowns();
  });
});

document.addEventListener("click", (e) => {
  const dentroDeAlgunDropdown = DEFINICIONES_DROPDOWN.some(({ contenedorId }) =>
    document.getElementById(contenedorId).contains(e.target)
  );
  if (!dentroDeAlgunDropdown) cerrarTodosLosDropdowns();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") cerrarTodosLosDropdowns();
});

/* =========================================================
   INICIO
   ========================================================= */

cargarRegistros();
renderTodo();
actualizarListasAutocompletado();

if (!soportaExcelAutomatico()) {
  document.getElementById("btnActivarSync").hidden = true;
}
intentarReanudarExcelAutomatico();

if (!soportaCarpetaFacturas()) {
  document.getElementById("btnActivarCarpetaFacturas").hidden = true;
}
intentarReanudarCarpetaFacturas();
