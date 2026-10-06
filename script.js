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
// Qué se está viendo y registrando: "ingresos" (ventas, lo de siempre) o "egresos" (egresos.js)
let modoRegistro = "ingresos";
// De qué tipo son los datos que esperan en la ventana de importación
let tipoImportacionPendiente = "ingresos";

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
   APERTURA SIN DATOS (pedido del usuario)
   Cada vez que se entra a la página (abrirla, recargarla con F5 o la
   recarga de Live Server) empieza vacía: ningún Excel queda cargado y los
   datos los carga el usuario importando sus Excel.
   Al entrar, tampoco se reactivan solos el Excel automático ni la carpeta
   XML: así nada se carga ni se sobrescribe sin que el usuario lo pida.
   ========================================================= */
const aperturaNueva = (function () {
  try {
    ["registros_ladrillos_v1", "egresos_ladrillos_v1", "facturas_xml_procesadas_v1"].forEach(k => localStorage.removeItem(k));
    sessionStorage.removeItem("sesion_abierta_v1");   // marca de la versión anterior (ya no se usa)
  } catch (e) { /* sin almacenamiento: igual empieza vacía */ }
  return true;
})();

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
    texto.textContent = "Excel de ingresos: Activo";
    badge.classList.add("activo");
  } else {
    texto.textContent = "Excel de ingresos: Inactivo";
    badge.classList.remove("activo");
  }
}

// Fecha "AAAA-MM-DD" → número de fecha de Excel exacto.
// Antes se escribía como fecha de JavaScript y, por la zona horaria de Perú, Excel la
// mostraba un día antes (el 01/04 salía 31/03) y al volver a importarla se corría de mes.
function fechaExcel(fechaStr) {
  const p = String(fechaStr || "").slice(0, 10).split("-").map(Number);
  if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return "";
  return (Date.UTC(p[0], p[1] - 1, p[2]) - Date.UTC(1899, 11, 30)) / 86400000;
}

// Al abrir el Excel se ve el último mes con datos (no una hoja de enero vacía)
function abrirEnUltimaHojaConDatos(wb) {
  let idx = -1;
  wb.SheetNames.forEach((n, i) => {
    const ref = wb.Sheets[n] && wb.Sheets[n]["!ref"];
    if (ref && XLSX.utils.decode_range(ref).e.r >= 1) idx = i;
  });
  if (idx < 0) return;
  wb.Workbook = wb.Workbook || {};
  wb.Workbook.Views = [{ activeTab: idx }];
}

// Construye el mismo libro que "Exportar todo el año" (una hoja por mes)
// y lo escribe directamente sobre el archivo vinculado, sin descargar nada.
// Nunca hay dos escrituras a la vez: si llega un cambio mientras se escribe, se repite al terminar.
let escribiendoExcelIngresos = false;
let pendienteExcelIngresos = false;
async function actualizarExcelAutomatico() {
  if (!handleExcelAutomatico) return false;
  if (escribiendoExcelIngresos) { pendienteExcelIngresos = true; return false; }
  escribiendoExcelIngresos = true;
  let ok = false;
  try {
    const permiso = await handleExcelAutomatico.queryPermission({ mode: "readwrite" });
    if (permiso !== "granted") {
      if (window.AvisoExcel) AvisoExcel.sinPermiso("ingresos", handleExcelAutomatico.name);
      return false;
    }

    const wb = XLSX.utils.book_new();
    MESES.forEach((nombreMes, idx) => {
      const lista = registrosDelMes(idx).slice().sort((a, b) => (a.fechaIngreso || "").localeCompare(b.fechaIngreso || ""));
      const ws = construirHojaExcel(lista);
      XLSX.utils.book_append_sheet(wb, ws, nombreMes.slice(0, 31));
    });
    abrirEnUltimaHojaConDatos(wb);

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array", cellStyles: true });
    const writable = await handleExcelAutomatico.createWritable();
    await writable.write(buffer);
    await writable.close();
    ok = true;
    if (window.AvisoExcel) AvisoExcel.cerrar("ingresos");
    mostrarToast(`✅ Excel de ingresos actualizado: «${handleExcelAutomatico.name}» (${registros.length} ingreso(s))`, "success");
  } catch (err) {
    console.error("Error actualizando el Excel automático:", err);
    if (window.AvisoExcel) AvisoExcel.error("ingresos", handleExcelAutomatico && handleExcelAutomatico.name);
    else mostrarToast("No se pudo actualizar el Excel automático. Si el archivo está abierto en Excel, ciérralo y vuelve a intentar.", "error");
  } finally {
    escribiendoExcelIngresos = false;
    if (pendienteExcelIngresos) { pendienteExcelIngresos = false; actualizarExcelAutomatico(); }
  }
  return ok;
}

async function activarExcelAutomatico() {
  if (!soportaExcelAutomatico()) {
    mostrarToast("Tu navegador no soporta esta función. Usa Chrome o Edge.", "error");
    return;
  }

  // Hallazgo de la auditoría UX: el usuario no sabía si este botón guardaba,
  // importaba o exportaba. Se aclara explícitamente ANTES de elegir el archivo.
  const confirmado = confirm(
    "Vas a elegir un archivo Excel (nuevo o existente).\n\n" +
    "A partir de ahora, ESE archivo se sobrescribirá automáticamente " +
    "cada vez que agregues, edites, borres o importes un registro — " +
    "no es una exportación de una sola vez.\n\n¿Deseas continuar?"
  );
  if (!confirmado) return;

  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: `REGISTROS_ANUALES_${anioPredominante()}.xlsx`,
      types: [{ description: "Libro de Excel", accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] } }],
    });
    handleExcelAutomatico = handle;
    await guardarHandleEnDB(handle);
    actualizarBadgeSync(true);
    if (window.AvisoExcel) AvisoExcel.cerrar("ingresos");
    mostrarToast("Excel automático activado. Se actualizará con cada cambio.", "success");
    const ok = await actualizarExcelAutomatico();
    // Con la página vacía, el Excel queda listo con sus encabezados y se llena con cada ingreso
    if (ok && registros.length === 0) mostrarToast(`Tu Excel «${handle.name}» quedó listo con los encabezados de ingresos. Se llenará con cada ingreso que registres o importes.`, "info");
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
  if (!soportaExcelAutomatico() || aperturaNueva) return;
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
    texto.textContent = "Ingresos XML: Activa";
    badge.classList.add("activo");
    btnEscanear.hidden = false;
  } else {
    texto.textContent = "Ingresos XML: Inactiva";
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
    mostrarToast("Carpeta vinculada. Buscando facturas y boletas XML...", "success");
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
      registrarEnHistorial("Importó facturas XML (automático)", `${nuevosImportados} factura(s)`);
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
  if (!soportaCarpetaFacturas() || aperturaNueva) return;
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
  mostrarToast("Buscando facturas y boletas nuevas...", "success");
});


function renderTabs() {
  const nav = document.getElementById("monthTabs");
  nav.innerHTML = "";
  // Cuántos registros tiene cada mes (de ingresos o de egresos, según lo que se esté viendo)
  const enEgresos = modoRegistro === "egresos" && typeof egresosDelMes === "function";
  MESES.forEach((nombre, idx) => {
    const btn = document.createElement("button");
    btn.className = "month-tab" + (idx === mesActual ? " active" : "");
    const cantidad = enEgresos ? egresosDelMes(idx).length : registrosDelMes(idx).length;
    btn.innerHTML = `<span class="mt-nombre">${nombre}</span>` +
      (cantidad > 0 ? `<span class="mt-cantidad" title="${cantidad} registro(s)">${cantidad}</span>` : "");
    btn.setAttribute("aria-label", `${nombre}${cantidad > 0 ? `, ${cantidad} registro(s)` : ", sin registros"}`);
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
  // Un solo "Registro del mes": muestra ingresos o egresos según el botón elegido en el menú
  if (modoRegistro === "egresos" && typeof renderRegistroEgresos === "function") {
    renderRegistroEgresos();
  } else {
    renderTablaHead();
    renderTablaBody();
  }
  if (typeof actualizarVistaModo === "function") actualizarVistaModo();
  actualizarPanelControl();
  // Tarjetas de gráficos del nuevo diseño (dashboard.js). Si ese archivo no cargó, no pasa nada.
  if (typeof actualizarDashboard === "function") actualizarDashboard();
}

/* =========================================================
   PANEL DE CONTROL — 6 medallones con un gráfico distinto cada
   uno (estilo galería de tipos de gráfico). En reposo todo va en
   naranja rojo; al pasar el cursor el gráfico se colorea y se
   dibuja de nuevo. Con TODOS los registros guardados.
   ========================================================= */

// Terracota de reposo y sus tintas: las porciones de un mismo gráfico se
// distinguen por intensidad, sin salir del color del tema
const COLOR_REPOSO = "#A9573F";
const TINTAS_REPOSO = ["#8C4633", "#A9573F", "#C9775B", "#DFA58F", "#F0CDBE"];
// Dibujo de reposo cuando todavía no hay ventas: suave, para que se note que es de relleno
const TINTAS_SIN_DATOS = ["#EADBCB", "#F5EBDF"];
// Colores vivos que aparecen al pasar el cursor: el trío terracota, arena y verde
// hoja de la imagen de referencia, bien marcados entre sí para distinguir cada sector
const VIVO_AZUL = "#A9573F";
const VIVO_CIAN = "#4E7A4F";
const VIVO_MORADO = "#D9A441";
// Terracota apagada (opaca) para rellenos, como el área bajo la línea de ventas
const AZUL_OPACO = "rgba(199,169,130,0.6)";
// Para gráficos con más de 3 sectores: primero el trío y luego versiones más claras,
// así ningún sector vecino repite el color
const COLORES_VIVOS = [VIVO_AZUL, VIVO_MORADO, VIVO_CIAN, "#C9775B", "#E8C476", "#7FA680"];

let miniChartVentasMes = null;
let miniChartFormaPago = null;
// "Medidas de posición" (antes "Cliente con más deuda": se conserva el nombre de su lienzo)
let miniChartTopDeudor = null;

function reducirMovimiento() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Se repite el ciclo de colores si hay más porciones que colores
function repetirColores(paleta, cantidad) {
  return Array.from({ length: cantidad }, (_, i) => paleta[i % paleta.length]);
}

// Cada gráfico lleva sus dos "trajes" de color: reposo (naranja rojo) y color (vivo).
// Sin datos, los dos trajes son el mismo para que el dibujo de relleno no se coloree.
function estilosDeSectores(cantidad, hayDatos, extra = {}, coloresVivos = COLORES_VIVOS) {
  if (!hayDatos) {
    const suave = { backgroundColor: repetirColores(TINTAS_SIN_DATOS, cantidad), ...extra };
    return { reposo: suave, color: suave };
  }
  return {
    reposo: { backgroundColor: repetirColores(TINTAS_REPOSO, cantidad), ...extra },
    color: { backgroundColor: repetirColores(coloresVivos, cantidad), ...extra },
  };
}

// Opciones comunes: sin ejes ni leyendas dentro del círculo, y sin eventos propios
// del gráfico (el cursor lo maneja la tarjeta entera, no cada barra)
function opcionesBaseMedallon() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    events: [],
    animation: { duration: 900, easing: "easeOutQuart" },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  };
}

// Notación compacta para que un monto quepa bajo el círculo
// (ej. "S/12.4K" en vez de "S/ 12,400.00").
function formatearMonedaCompacta(numero) {
  const v = Number(numero) || 0;
  const signo = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  if (abs >= 1000000) return `${signo}S/${(abs / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${signo}S/${(abs / 1000).toFixed(1)}K`;
  return `${signo}S/${abs.toFixed(0)}`;
}

// Crea el gráfico la primera vez y, después, solo le cambia los datos.
// Al actualizar se vuelve a aplicar el traje de color vigente: si el cursor
// está encima justo cuando cambian los datos, no debe "apagarse" el color.
function dibujarMiniChart(referenciaPrevia, canvasId, config, estilos) {
  const modo = referenciaPrevia ? referenciaPrevia.$modo : "reposo";
  Object.assign(config.data.datasets[0], estilos[modo]);

  if (referenciaPrevia) {
    referenciaPrevia.data = config.data;
    referenciaPrevia.$estilos = estilos;
    referenciaPrevia.update();
    return referenciaPrevia;
  }
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === "undefined") return null;
  const grafico = new Chart(canvas, config);
  grafico.$estilos = estilos;
  grafico.$modo = "reposo";
  return grafico;
}

// Cambia entre el traje de reposo y el de color. Al pasar a "color" se reinicia
// el dibujo para que el gráfico se trace de nuevo con animación (las barras suben,
// la línea se traza, la dona se llena) hasta su estado final.
function cambiarModoGrafico(canvas, modo) {
  if (!canvas || typeof Chart === "undefined") return;
  const grafico = Chart.getChart(canvas);
  if (!grafico || !grafico.$estilos) return;

  grafico.$modo = modo;
  // Los gráficos de varias series (como la simulación de la DMA) traen su propia forma de pintarse
  if (typeof grafico.$aplicarModo === "function") grafico.$aplicarModo(modo);
  else Object.assign(grafico.data.datasets[0], grafico.$estilos[modo]);
  const sinMovimiento = reducirMovimiento();
  if (modo === "color" && !sinMovimiento) grafico.reset();
  grafico.update(sinMovimiento ? "none" : undefined);
}

function actualizarPanelControl() {
  if (typeof Chart === "undefined") return; // Chart.js no cargó (sin internet la primera vez)

  actualizarCardVentasMes();
  actualizarCardFormaPago();
  actualizarCardPosicion();
}

/* --- 1. ¿QUÉ TAN PAREJOS SON TUS INGRESOS Y EGRESOS? Simulación de la desviación
   media absoluta: cada punto es un monto (relativo a su promedio); la franja es
   "lo normal" (promedio ± DMA) y la rayita de cada punto es su distancia al
   promedio. En reposo va en terracota; al pasar el cursor, ingresos en verde
   y egresos en naranja. Al hacer clic se abre su ventana (parejos.js). --- */

// DMA como porcentaje del promedio: cuánto se aleja, en promedio, cada monto
function dmaPorcentaje(montos) {
  if (montos.length < 2) return null;
  const media = montos.reduce((s, v) => s + v, 0) / montos.length;
  if (!media) return null;
  const dma = montos.reduce((s, v) => s + Math.abs(v - media), 0) / montos.length;
  return (dma / media) * 100;
}

// Toma hasta "cuantos" montos repartidos en el tiempo, para que el dibujo no se amontone
function muestraRepartida(lista, cuantos) {
  if (lista.length <= cuantos) return lista.slice();
  const paso = (lista.length - 1) / (cuantos - 1);
  return Array.from({ length: cuantos }, (_, i) => lista[Math.round(i * paso)]);
}

// Rayita desde cada punto hasta el promedio: la "distancia" que mide la DMA
const pluginDistanciasMedallon = {
  id: "cpDistancias",
  beforeDatasetsDraw(chart) {
    const y = chart.scales.y;
    if (!y) return;
    const ctx = chart.ctx;
    const y0 = y.getPixelForValue(1);
    ctx.save();
    [3, 4].forEach(i => {
      const ds = chart.data.datasets[i];
      const meta = chart.getDatasetMeta(i);
      if (!ds || !meta) return;
      ctx.strokeStyle = ds.$colorRaya || "rgba(169,87,63,0.35)";
      ctx.lineWidth = 2.6;
      meta.data.forEach(p => {
        ctx.beginPath();
        ctx.moveTo(p.x, y0);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      });
    });
    ctx.restore();
  },
};

function actualizarCardVentasMes() {
  const listaEgresos = typeof egresos !== "undefined" ? egresos : [];
  const porFecha = (a, b) => (a.f || "").localeCompare(b.f || "");
  const ing = registros.map(r => ({ f: r.fechaIngreso, v: Number(r.montoTotal) || 0 })).filter(x => x.v > 0).sort(porFecha);
  const egr = listaEgresos.map(e => ({ f: e.fechaEgreso, v: Number(e.monto) || 0 })).filter(x => x.v > 0).sort(porFecha);

  const pIng = dmaPorcentaje(ing.map(x => x.v));
  const pEgr = dmaPorcentaje(egr.map(x => x.v));
  const hayDatos = pIng !== null || pEgr !== null;

  const valor = document.getElementById("cpVentasMesValor");
  // Lectura en palabras comunes (sin porcentajes): ¿los montos se parecen entre sí?
  const planoDma = p => p === null ? null : p < 15 ? "parejos" : p < 30 ? "algo distintos" : p <= 50 ? "muy distintos" : "muy desiguales";
  const lecDma = [["Ventas", planoDma(pIng)], ["Pagos", planoDma(pEgr)]].filter(x => x[1]);
  valor.textContent = !hayDatos ? "—"
    : lecDma.length === 2 && lecDma[0][1] === lecDma[1][1] ? `Ventas y pagos: ${lecDma[0][1]}`
    : lecDma.map(x => `${x[0]}: ${x[1]}`).join(" · ");
  valor.title = "¿Tus montos se parecen entre sí? Si son muy desiguales, el promedio no representa a un monto típico. Toca para ver el detalle.";

  // Cada monto se dibuja relativo a su propio promedio (1 = justo el promedio),
  // así ingresos y egresos caben en el mismo círculo. Sin datos: una simulación de ejemplo.
  const relativos = (lista, pct) => {
    if (lista.length < 2) return [];
    const media = lista.reduce((s, x) => s + x.v, 0) / lista.length;
    return muestraRepartida(lista, 6).map(x => Math.min(2.05, x.v / media));
  };
  let yIng = relativos(ing, pIng);
  let yEgr = relativos(egr, pEgr);
  if (!hayDatos) {
    yIng = [1.35, 0.7, 1.15, 0.55, 1.6, 0.9];
    yEgr = [0.8, 1.45, 0.6, 1.2, 1.05, 1.5];
  }
  const pcts = [pIng, pEgr].filter(p => p !== null);
  // En el círculo la franja se limita a ±0.6 para que se lea a este tamaño (el valor exacto está en la ventana)
  const banda = hayDatos ? Math.min(0.6, (pcts.reduce((s, p) => s + p, 0) / pcts.length) / 100) : 0.4;

  // Ingresos en las posiciones pares y egresos en las impares, intercalados
  const puntosIng = yIng.map((y, i) => ({ x: i * 2 + 0.6, y }));
  const puntosEgr = yEgr.map((y, i) => ({ x: i * 2 + 1.6, y }));
  const bordes = [{ x: 0, y: 0 }, { x: 12.2, y: 0 }];

  const datos = {
    datasets: [
      { data: bordes.map(p => ({ x: p.x, y: 1 + banda })), showLine: true, pointRadius: 0, borderWidth: 0, fill: "+1" },
      { data: bordes.map(p => ({ x: p.x, y: Math.max(0, 1 - banda) })), showLine: true, pointRadius: 0, borderWidth: 0, fill: false },
      { data: bordes.map(p => ({ x: p.x, y: 1 })), showLine: true, pointRadius: 0, borderWidth: 2, borderDash: [4, 3], fill: false },
      { data: puntosIng, showLine: false, pointRadius: 5.5, pointBorderWidth: 2, pointBorderColor: "#fff" },
      { data: puntosEgr, showLine: false, pointRadius: 5.5, pointBorderWidth: 2, pointBorderColor: "#fff" },
    ],
  };

  // Colores de cada estado: reposo (terracota) y color (verde y naranja)
  function aplicarModo(modo) {
    const g = miniChartVentasMes;
    if (!g) return;
    const ds = g.data.datasets;
    const vivo = modo === "color";
    ds[0].backgroundColor = vivo ? "rgba(217,164,65,0.22)" : "rgba(169,87,63,0.10)";
    ds[2].borderColor = vivo ? "#7A4A38" : "rgba(169,87,63,0.55)";
    ds[3].pointBackgroundColor = vivo ? "#2FA84F" : COLOR_REPOSO;
    ds[4].pointBackgroundColor = vivo ? "#F07A1E" : "#DFA58F";
    ds[3].$colorRaya = vivo ? "rgba(47,168,79,0.75)" : "rgba(169,87,63,0.30)";
    ds[4].$colorRaya = vivo ? "rgba(240,122,30,0.75)" : "rgba(169,87,63,0.30)";
  }

  const opciones = {
    ...opcionesBaseMedallon(),
    layout: { padding: 4 },
    scales: {
      x: { type: "linear", display: false, min: 0, max: 12.2 },
      y: { display: false, min: -0.05, max: 2.15 },
    },
    elements: { line: { tension: 0 } },
  };

  if (miniChartVentasMes && miniChartVentasMes.config.type === "scatter") {
    miniChartVentasMes.data = datos;
    aplicarModo(miniChartVentasMes.$modo || "reposo");
    miniChartVentasMes.update();
  } else {
    if (miniChartVentasMes) miniChartVentasMes.destroy();
    const canvas = document.getElementById("miniChartVentasMes");
    if (!canvas || typeof Chart === "undefined") return;
    miniChartVentasMes = new Chart(canvas, { type: "scatter", data: datos, options: opciones, plugins: [pluginDistanciasMedallon] });
    miniChartVentasMes.$estilos = {};
    miniChartVentasMes.$modo = "reposo";
    miniChartVentasMes.$aplicarModo = aplicarModo;
    aplicarModo("reposo");
    miniChartVentasMes.update("none");
  }

  // Parte de atrás (solo se ve si la ventana no pudiera abrirse)
  const nivel = p => p === null ? "sin datos" : p < 15 ? "parejos" : p < 30 ? "variación moderada" : p <= 50 ? "muy variables" : "muy disparejos";
  document.getElementById("cpVentasMesBack").innerHTML = `<h4>¿Son parecidos?</h4>` +
    `<p><strong>Ingresos</strong><br>${pIng !== null ? Math.round(pIng) + "% · " + nivel(pIng) : "sin datos"}</p>` +
    `<p><strong>Egresos</strong><br>${pEgr !== null ? Math.round(pEgr) + "% · " + nivel(pEgr) : "sin datos"}</p>`;
}

/* --- 2. ADELANTO VS CONTADO: dona + montos exactos al voltear --- */
/* --- 2. ESTABILIDAD (desviación estándar): campana de Gauss con los meses encima.
   Antes aquí iba "Adelanto vs contado". La campana es "lo normal"; la zona central
   es el promedio ± 1 desviación estándar; cada punto es un mes (rojo = ingresos,
   blanco con borde rojo = egresos). Al pasar el cursor: rojo y amarillo.
   Al hacer clic se abre su ventana (estabilidad.js). --- */

// Totales de cada mes (año-mes) de una lista de {f: fecha, v: monto}. Igual que la
// ventana "Estabilidad", el último mes no se cuenta si parece incompleto
// (su último registro es antes del día 25).
function totalesPorMes(lista) {
  const mapa = {};
  let ultimaFecha = "";
  lista.forEach(x => {
    if (!x.f || !(x.v > 0)) return;
    const clave = String(x.f).slice(0, 7);
    mapa[clave] = (mapa[clave] || 0) + x.v;
    if (x.f > ultimaFecha) ultimaFecha = String(x.f);
  });
  if (ultimaFecha && Number(ultimaFecha.slice(8, 10)) < 25) delete mapa[ultimaFecha.slice(0, 7)];
  return Object.keys(mapa).sort().slice(-12).map(k => mapa[k]);
}

// Desviación estándar muestral (divide entre n − 1, como en el ejemplo del curso)
function desviacionMuestral(valores) {
  if (valores.length < 2) return null;
  const media = valores.reduce((s, v) => s + v, 0) / valores.length;
  const suma = valores.reduce((s, v) => s + (v - media) * (v - media), 0);
  return { media, s: Math.sqrt(suma / (valores.length - 1)) };
}

function curvaNormal(z) { return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI); }

// Líneas punteadas en ±1 desviación y línea del promedio
const pluginLineasCampana = {
  id: "cpLineasCampana",
  afterDatasetsDraw(chart) {
    const x = chart.scales.x, y = chart.scales.y;
    if (!x || !y) return;
    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = chart.$colorLineas || "rgba(169,87,63,0.5)";
    ctx.lineWidth = 2;
    [-1, 0, 1].forEach(z => {
      ctx.setLineDash(z === 0 ? [] : [4, 3]);
      ctx.beginPath();
      ctx.moveTo(x.getPixelForValue(z), y.getPixelForValue(0));
      ctx.lineTo(x.getPixelForValue(z), y.getPixelForValue(curvaNormal(z)));
      ctx.stroke();
    });
    ctx.restore();
  },
};

function actualizarCardFormaPago() {
  const listaEgresos = typeof egresos !== "undefined" ? egresos : [];
  const mesesIng = totalesPorMes(registros.map(r => ({ f: r.fechaIngreso, v: Number(r.montoTotal) || 0 })));
  const mesesEgr = totalesPorMes(listaEgresos.map(e => ({ f: e.fechaEgreso, v: Number(e.monto) || 0 })));
  const dIng = desviacionMuestral(mesesIng);
  const dEgr = desviacionMuestral(mesesEgr);
  const hayDatos = !!(dIng || dEgr);

  // Coeficiente de variación: la desviación como % del promedio mensual (menos es más estable)
  const planoCv = d => !d || !d.media ? null : (d.s / d.media) * 100 < 10 ? "muy estables" : (d.s / d.media) * 100 < 25 ? "estables" : (d.s / d.media) * 100 <= 50 ? "variables" : "muy inestables";
  const lecCv = [["Ventas", planoCv(dIng)], ["Gastos", planoCv(dEgr)]].filter(x => x[1]);
  const valor = document.getElementById("cpFormaPagoValor");
  valor.textContent = !hayDatos ? "—"
    : lecCv.length === 2 && lecCv[0][1] === lecCv[1][1] ? `Ventas y gastos: ${lecCv[0][1]}`
    : lecCv.map(x => `${x[0]}: ${x[1]}`).join(" · ");
  valor.title = "¿Tus ventas y tus gastos cambian mucho de un mes a otro? Toca para ver el detalle.";

  // Cada mes se ubica en la campana según a cuántas desviaciones está de su promedio (z)
  const aZ = (vals, d) => d && d.s ? vals.map(v => Math.max(-2.8, Math.min(2.8, (v - d.media) / d.s))) : [];
  let zIng = aZ(mesesIng, dIng);
  let zEgr = aZ(mesesEgr, dEgr);
  if (!hayDatos) { zIng = [-1.4, -0.3, 0.6, 1.3]; zEgr = [-0.8, 0.2, 1.8]; }

  const curva = [];
  for (let z = -3; z <= 3.001; z += 0.15) curva.push({ x: +z.toFixed(2), y: curvaNormal(z) });
  const centro = curva.filter(p => p.x >= -1.001 && p.x <= 1.001);

  const datos = {
    datasets: [
      { data: curva, showLine: true, pointRadius: 0, borderWidth: 2.5, fill: "origin", tension: 0.3 },
      { data: centro, showLine: true, pointRadius: 0, borderWidth: 0, fill: "origin", tension: 0.3 },
      { data: zIng.map(z => ({ x: z, y: curvaNormal(z) })), showLine: false, pointRadius: 5.5, pointBorderWidth: 2 },
      { data: zEgr.map(z => ({ x: z, y: curvaNormal(z) })), showLine: false, pointRadius: 5, pointBorderWidth: 2.5 },
    ],
  };

  function aplicarModo(modo) {
    const g = miniChartFormaPago;
    if (!g) return;
    const ds = g.data.datasets;
    const vivo = modo === "color";
    ds[0].borderColor = vivo ? "#E53935" : COLOR_REPOSO;
    ds[0].backgroundColor = vivo ? "rgba(255,213,79,0.45)" : "rgba(169,87,63,0.10)";
    ds[1].backgroundColor = vivo ? "rgba(255,193,7,0.85)" : "rgba(169,87,63,0.22)";
    ds[2].pointBackgroundColor = vivo ? "#E53935" : COLOR_REPOSO;
    ds[2].pointBorderColor = "#fff";
    ds[3].pointBackgroundColor = "#fff";
    ds[3].pointBorderColor = vivo ? "#E53935" : COLOR_REPOSO;
    g.$colorLineas = vivo ? "rgba(229,57,53,0.85)" : "rgba(169,87,63,0.45)";
  }

  const opciones = {
    ...opcionesBaseMedallon(),
    layout: { padding: 4 },
    scales: {
      x: { type: "linear", display: false, min: -3, max: 3 },
      y: { display: false, min: 0, max: 0.46 },
    },
  };

  if (miniChartFormaPago && miniChartFormaPago.config.type === "scatter") {
    miniChartFormaPago.data = datos;
    aplicarModo(miniChartFormaPago.$modo || "reposo");
    miniChartFormaPago.update();
  } else {
    if (miniChartFormaPago) miniChartFormaPago.destroy();
    const canvas = document.getElementById("miniChartFormaPago");
    if (!canvas || typeof Chart === "undefined") return;
    miniChartFormaPago = new Chart(canvas, { type: "scatter", data: datos, options: opciones, plugins: [pluginLineasCampana] });
    miniChartFormaPago.$estilos = {};
    miniChartFormaPago.$modo = "reposo";
    miniChartFormaPago.$aplicarModo = aplicarModo;
    aplicarModo("reposo");
    miniChartFormaPago.update("none");
  }

  // Parte de atrás (solo se ve si la ventana no pudiera abrirse)
  const linea = (n, d) => `<p><strong>${n}</strong><br>${d ? formatearMonedaCompacta(d.media) + " ± " + formatearMonedaCompacta(d.s) + " al mes" : "sin datos"}</p>`;
  document.getElementById("cpFormaPagoBack").innerHTML = `<h4>Estabilidad</h4>` + linea("Ingresos", dIng) + linea("Egresos", dEgr);
}

/* --- 3. MEDIDAS DE POSICIÓN: diagrama de caja de los ingresos (arriba) y de los
   egresos (abajo), la misma figura de su ventana. Cada fila va en su propia
   escala (1 = su máximo normal) para que las dos quepan en el círculo: la caja
   es el 50% central (de Q1 a Q3), la raya oscura es la mediana y la línea fina
   llega del mínimo al máximo normales. En reposo va en terracota; al pasar el
   cursor, ingresos en verde y egresos en azul. Al hacer clic se abre su
   ventana (posicion.js). Los números salen de analitica.js. --- */
function actualizarCardPosicion() {
  const an = window.Analitica;
  const anio = an ? an.anioAnalisis() : null;
  const resumen = tipo => (an ? an.resumenPosicion(an.movimientos(tipo, anio).map(m => m.valor), "curso") : null);
  const rIng = resumen("ingresos");
  const rEgr = resumen("egresos");
  const hayDatos = !!(rIng || rEgr);

  const valor = document.getElementById("cpTopDeudorValor");
  // Lectura en palabras comunes: cuánto vende un mes bueno (o, con pocos meses, una venta típica)
  let lecturaPos = "—";
  if (hayDatos) {
    const meses = an.totalesMensuales("ingresos", anio, true).filter(u => u.total !== null && !u.excluido).map(u => u.total);
    const rm = meses.length >= 3 ? an.resumenPosicion(meses, "curso") : null;
    lecturaPos = rm ? `Un mes bueno vende más de ${formatearMonedaCompacta(rm.q3.valor)}`
      : rIng ? `Una venta típica es de ${formatearMonedaCompacta(rIng.q2.valor)}`
      : `Un pago típico es de ${formatearMonedaCompacta(rEgr.q2.valor)}`;
  }
  valor.textContent = lecturaPos;
  valor.title = "Ordena tus montos de menor a mayor y muestra qué es «normal», «bueno» o «flojo». Toca para ver el detalle.";

  // Sin datos: una caja de ejemplo para que se vea la forma del gráfico
  const fila = (r, ejemplo) => {
    if (!r) return hayDatos ? null : ejemplo;
    const tope = r.bigoteSup || r.max || 1;
    return { bigote: [r.bigoteInf / tope, 1], caja: [r.q1.valor / tope, r.q3.valor / tope], mediana: r.q2.valor / tope };
  };
  const filas = [
    fila(rIng, { bigote: [0.08, 1], caja: [0.3, 0.64], mediana: 0.45 }),
    fila(rEgr, { bigote: [0.04, 0.92], caja: [0.18, 0.52], mediana: 0.3 }),
  ];
  const grosor = 0.014;
  const datos = {
    labels: ["Ingresos", "Egresos"],
    datasets: [
      { data: filas.map(f => (f ? f.bigote : null)), barPercentage: 0.14, categoryPercentage: 1, grouped: false, borderSkipped: false },
      { data: filas.map(f => (f ? f.caja : null)), barPercentage: 0.7, categoryPercentage: 1, grouped: false, borderWidth: 2.5, borderRadius: 5, borderSkipped: false },
      { data: filas.map(f => (f ? [f.mediana - grosor, f.mediana + grosor] : null)), barPercentage: 0.9, categoryPercentage: 1, grouped: false, borderSkipped: false },
    ],
  };

  // Colores de cada estado: reposo (terracota) y color (verde y azul)
  function aplicarModo(modo) {
    const g = miniChartTopDeudor;
    if (!g) return;
    const ds = g.data.datasets;
    const vivo = modo === "color";
    const verde = "#22C55E", azul = "#2563EB";
    ds[0].backgroundColor = vivo ? [verde, azul] : [COLOR_REPOSO, "#C9775B"];
    ds[1].backgroundColor = vivo ? ["rgba(34,197,94,0.38)", "rgba(37,99,235,0.32)"] : ["rgba(169,87,63,0.20)", "rgba(201,119,91,0.18)"];
    ds[1].borderColor = vivo ? [verde, azul] : [COLOR_REPOSO, "#C9775B"];
    ds[2].backgroundColor = vivo ? ["#14532D", "#1E3A8A"] : ["#5A2E22", "#7A4A38"];
  }

  const opciones = {
    ...opcionesBaseMedallon(),
    indexAxis: "y",
    layout: { padding: 2 },
    scales: {
      x: { display: false, min: 0, max: 1.04 },
      y: { display: false },
    },
  };

  if (miniChartTopDeudor && miniChartTopDeudor.$posicion) {
    miniChartTopDeudor.data = datos;
    aplicarModo(miniChartTopDeudor.$modo || "reposo");
    miniChartTopDeudor.update();
  } else {
    if (miniChartTopDeudor) miniChartTopDeudor.destroy();
    const canvas = document.getElementById("miniChartTopDeudor");
    if (!canvas || typeof Chart === "undefined") return;
    miniChartTopDeudor = new Chart(canvas, { type: "bar", data: datos, options: opciones });
    miniChartTopDeudor.$estilos = {};
    miniChartTopDeudor.$modo = "reposo";
    miniChartTopDeudor.$posicion = true;
    miniChartTopDeudor.$aplicarModo = aplicarModo;
    aplicarModo("reposo");
    miniChartTopDeudor.update("none");
  }

  // Parte de atrás (solo se ve si la ventana no pudiera abrirse)
  const linea = (n, r) => `<p><strong>${n}</strong><br>${r ? "Q1 " + formatearMonedaCompacta(r.q1.valor) + " · Me " + formatearMonedaCompacta(r.q2.valor) + " · Q3 " + formatearMonedaCompacta(r.q3.valor) : "sin datos"}</p>`;
  document.getElementById("cpTopDeudorBack").innerHTML = `<h4>Mi mes frente a los demás</h4>` + linea("Ingresos", rIng) + linea("Egresos", rEgr);
}

/* --- Clic: voltea la tarjeta. Cursor o teclado: colorea y redibuja el gráfico --- */
document.querySelectorAll(".flip-card").forEach(tarjeta => {
  tarjeta.addEventListener("click", () => {
    // Este círculo abre la ventana "¿Mis ventas y pagos son parecidos?"
    // (parejos.js). Si ese archivo no cargó, abre la de "Ventas por mes"
    // (ventas-mes.js), y si tampoco, se voltea como las demás: nunca queda sin respuesta.
    if (tarjeta.dataset.tarjeta === "ventas-mes") {
      if (typeof abrirParejos === "function" && abrirParejos()) return;
      if (typeof abrirVentasMes === "function" && abrirVentasMes()) return;
    }
    // "Estabilidad" (desviación estándar) abre su ventana (estabilidad.js)
    if (tarjeta.dataset.tarjeta === "forma-pago" && typeof abrirEstabilidad === "function" && abrirEstabilidad()) return;
    // "Medidas de posición" (cuartiles, quintiles y percentiles) abre su ventana (posicion.js)
    if (tarjeta.dataset.tarjeta === "top-deudor" && typeof abrirPosicion === "function" && abrirPosicion()) return;
    tarjeta.classList.toggle("is-flipped");
  });

  const lienzo = tarjeta.querySelector("canvas");
  const activar = () => cambiarModoGrafico(lienzo, "color");
  const desactivar = () => cambiarModoGrafico(lienzo, "reposo");
  tarjeta.addEventListener("mouseenter", activar);
  tarjeta.addEventListener("mouseleave", desactivar);
  // Con el mouse, hacer clic también da foco: solo se colorea por foco si viene del teclado
  tarjeta.addEventListener("focus", () => { if (tarjeta.matches(":focus-visible")) activar(); });
  tarjeta.addEventListener("blur", desactivar);
});


/* =========================================================
   INDICADORES CLAVE → ahora «Salud de tu negocio» (punto de
   equilibrio, en qué se va la plata y clientes clave del año).
   Los dibuja negocio.js dentro de actualizarDashboard().
   ========================================================= */

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
  registrarEnHistorial("Eliminó registro", `${r.cliente || "Sin cliente"} (${formatearMoneda(r.montoTotal)})`);
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
    registrarEnHistorial("Editó registro", `${registro.cliente || "Sin cliente"} (${formatearMoneda(registro.montoTotal)})`);
  } else {
    registros.push(registro);
    mostrarToast("Registro agregado.", "success");
    registrarEnHistorial("Agregó registro", `${registro.cliente || "Sin cliente"} (${formatearMoneda(registro.montoTotal)})`);
  }

  guardarRegistros();

  // Si el registro pertenece a otro mes, saltar a ese mes para mostrarlo.
  const mesDelRegistro = mesDeFecha(registro.fechaIngreso);
  if (mesDelRegistro !== null) mesActual = mesDelRegistro;

  cerrarModalRegistro();
  renderTodo();
  // Si el Excel automático de ingresos no está activo, se avisa (el registro igual queda guardado en el sistema)
  if (!handleExcelAutomatico && window.AvisoExcel) AvisoExcel.inactivo("ingresos");
});

// El mismo botón del menú abre el formulario de ingreso o el de egreso, según lo que se esté viendo
document.getElementById("btnNuevo").addEventListener("click", function () {
  if (modoRegistro === "egresos" && typeof abrirModalEgresoNuevo === "function") abrirModalEgresoNuevo();
  else abrirModalNuevo();
});
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
  if (!document.getElementById("modalHistorial").hidden) document.getElementById("modalHistorial").hidden = true;
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
  // Qué se borra: ingresos, egresos o todo (se elige en la misma ventana)
  const elegido = document.querySelector('input[name="alcanceBorrado"]:checked');
  const alcance = elegido ? elegido.value : "todo";
  let cantidadIngresos = 0;
  let cantidadEgresos = 0;

  if (alcance !== "egresos") {
    cantidadIngresos = registros.length;
    registros = [];
    guardarRegistros();
  }
  if (alcance !== "ingresos" && typeof borrarTodosLosEgresos === "function") {
    cantidadEgresos = borrarTodosLosEgresos();
  }

  renderTodo();
  actualizarListasAutocompletado();
  cerrarModalBorrarTodo();

  const textos = { todo: "Se borraron los ingresos y los egresos.", ingresos: "Se borraron todos los ingresos.", egresos: "Se borraron todos los egresos." };
  mostrarToast(textos[alcance] || textos.todo, "success");
  const detalle = [];
  if (alcance !== "egresos") detalle.push(`${cantidadIngresos} ingreso(s)`);
  if (alcance !== "ingresos") detalle.push(`${cantidadEgresos} egreso(s)`);
  registrarEnHistorial(alcance === "todo" ? "Borró TODOS los datos" : `Borró todos los ${alcance}`, detalle.join(" y ") + " eliminados");
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
    if (c.tipo === "fecha") return r[c.key] ? fechaExcel(r[c.key]) : "";
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
  abrirEnUltimaHojaConDatos(wb);
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
// Encabezados sin tildes ni mayúsculas, para comparar "Código de ladrillo"
// con "Codigo de ladrillos" o "Adelanto ó al contado" con "Adelanto o al contado"
function encabezadoSinTildes(txt) {
  return String(txt ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

// Otros nombres con que aparece cada columna en el Excel real de la empresa
const ALIAS_COLUMNAS = {
  fechaIngreso: ["fecha de ingreso"],
  fechaFacturacion: ["fecha de facturacion"],
  representante: ["representante"],
  cliente: ["cliente o razon social", "cliente"],
  entidadBancaria: ["entidad bancaria"],
  numeroOperacion: ["numero de operacion", "n° de operacion", "nro de operacion"],
  rucDni: ["ruc/dni", "ruc / dni", "ruc"],
  numeroFactura: ["numero de factura", "n° de factura", "nro de factura"],
  adelantoContado: ["adelanto"],
  unidad: ["unidad"],
  precioUnitario: ["precio unitario"],
  montoTotal: ["monto total"],
  codigoLadrillo: ["codigo de ladrillo"],
  deudaPendiente: ["deuda pendiente"],
  observaciones: ["observacion"],
};

// Posición de una columna: primero el nombre exacto y luego "empieza con"
function indiceDeColumna(encabezadosNorm, columna) {
  const candidatos = [encabezadoSinTildes(columna.label)].concat(ALIAS_COLUMNAS[columna.key] || []);
  for (const c of candidatos) {
    const i = encabezadosNorm.indexOf(c);
    if (i > -1) return i;
  }
  for (const c of candidatos) {
    const i = encabezadosNorm.findIndex(h => h && h.startsWith(c));
    if (i > -1) return i;
  }
  return -1;
}

// En el Excel real, cada hoja tiene filas de título arriba y el encabezado
// en una fila distinta (3, 4 o 5). Se busca la fila que dice "Fecha de ingreso";
// si no aparece (por ejemplo, un Excel exportado por esta app), se usa la primera.
function filaDeEncabezadoIngresos(filas) {
  const limite = Math.min(filas.length, 40);
  for (let r = 0; r < limite; r++) {
    if ((filas[r] || []).some(c => encabezadoSinTildes(c).startsWith("fecha de ingreso"))) return r;
  }
  return 0;
}

function mapearFilasImportadas(filasCrudas, encabezadosOriginales) {
  const encabezadosNorm = encabezadosOriginales.map(encabezadoSinTildes);
  const posiciones = COLUMNAS.map(c => indiceDeColumna(encabezadosNorm, c));

  const usarPosicion = posiciones.every(p => p === -1);

  return filasCrudas.map(filaArray => {
    const registro = { id: generarId() };
    COLUMNAS.forEach((c, idx) => {
      let valorCrudo;
      if (usarPosicion) {
        valorCrudo = filaArray[idx];
      } else {
        const posEncabezado = posiciones[idx];
        valorCrudo = posEncabezado > -1 ? filaArray[posEncabezado] : "";
      }

      if (c.tipo === "fecha") {
        registro[c.key] = convertirValorFecha(valorCrudo);
      } else if (c.tipo === "moneda" || c.tipo === "numero") {
        // Sirve para números y para textos como «S/ 1,200.00», «1,000» o «$ 950» (siempre en soles)
        const n = typeof numeroDesdeCelda === "function" ? numeroDesdeCelda(valorCrudo) : parseFloat(valorCrudo);
        registro[c.key] = isFinite(n) ? n : 0;
      } else {
        registro[c.key] = valorCrudo != null ? String(valorCrudo).trim() : "";
      }
    });
    return registro;
  }).filter(r => r.fechaIngreso || r.cliente); // descarta filas totalmente vacías
}

// Deja en pantalla el mes más reciente de una lista de fechas (el último mes que trae un Excel importado)
function irAlUltimoMesDe(fechas) {
  const ultima = (fechas || []).filter(f => /^\d{4}-\d{2}-\d{2}/.test(f || "")).sort().pop();
  if (ultima) mesActual = mesDeFecha(ultima);
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
  const conBarras = txt.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
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

      // Si el archivo es de egresos (tiene "Fecha de egreso" y no "Fecha de ingreso"),
      // se avisa en vez de meter pagos como si fueran ventas
      if (typeof libroPareceDeEgresos === "function" && libroPareceDeEgresos(wb)) {
        mostrarToast("Este Excel parece ser de egresos. Usa «Importar Excel de egresos».", "error");
        return;
      }

      // Lee TODAS las hojas del archivo (por ejemplo, las 12 hojas de un
      // Excel exportado con "Exportar todo el año") y junta los registros
      // de todas ellas, no solo de la primera.
      let registrosCombinados = [];
      let hojasConDatos = 0;

      wb.SheetNames.forEach((nombreHoja) => {
        const hoja = wb.Sheets[nombreHoja];
        const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: "" });
        if (filas.length < 2) return; // hoja vacía (solo encabezado o nada), se salta

        const filaEncabezado = filaDeEncabezadoIngresos(filas);
        const encabezados = filas[filaEncabezado];
        const filasDatos = filas.slice(filaEncabezado + 1);
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
      tipoImportacionPendiente = "ingresos";
      document.getElementById("tituloImportar").textContent = "Importar ingresos";
      // ¿Cuántos ya estaban cargados? (volver a importar el mismo Excel no debe duplicar nada)
      const yaCargados = window.Duplicados ? Duplicados.separarNuevos(registrosCombinados, registros, Duplicados.firmaIngreso).repetidos.length : 0;
      document.getElementById("textoImportarResumen").textContent =
        `Se encontraron ${registrosCombinados.length} registro(s) en ${hojasConDatos} hoja(s) del archivo.` +
        (yaCargados ? ` ${yaCargados === registrosCombinados.length ? "Todos" : yaCargados} ya están cargados y no se volverán a sumar; «Agregar datos» solo agrega los ${registrosCombinados.length - yaCargados} nuevo(s).` : "") +
        " ¿Deseas agregar estos registros a los datos existentes?";
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
  if (tipoImportacionPendiente === "egresos" && typeof aplicarImportacionEgresos === "function") {
    aplicarImportacionEgresos(datosImportadosPendientes, "agregar");
    cerrarModalImportar();
    return;
  }
  // Solo se agrega lo que todavía no está cargado: así el mismo Excel nunca se suma dos veces
  const separados = window.Duplicados
    ? Duplicados.separarNuevos(datosImportadosPendientes, registros, Duplicados.firmaIngreso)
    : { nuevos: datosImportadosPendientes, repetidos: [] };
  const cantidad = separados.nuevos.length;
  registros = registros.concat(separados.nuevos);
  guardarRegistros();
  irAlUltimoMesDe(datosImportadosPendientes.map(r => r.fechaIngreso));
  cambiarModoRegistro("ingresos", false);
  cerrarModalImportar();
  renderTodo();
  if (!cantidad) mostrarToast("Este Excel ya estaba cargado: no se agregó nada para no duplicar tus datos.", "info");
  else mostrarToast(`✅ ${cantidad} registro(s) importados correctamente.` + (separados.repetidos.length ? ` Se omitieron ${separados.repetidos.length} que ya estaban cargados.` : ""), "success");
  registrarEnHistorial("Importó Excel (agregó)", `${cantidad} registro(s)` + (separados.repetidos.length ? `, ${separados.repetidos.length} omitido(s) por estar ya cargados` : ""));
});

document.getElementById("btnReemplazarDatos").addEventListener("click", function () {
  if (!datosImportadosPendientes) return;
  if (tipoImportacionPendiente === "egresos" && typeof aplicarImportacionEgresos === "function") {
    aplicarImportacionEgresos(datosImportadosPendientes, "reemplazar");
    cerrarModalImportar();
    return;
  }

  // Reemplaza los datos de TODOS los meses que vienen en el archivo
  // importado (puede ser uno solo, o los 12 si importaste el Excel anual),
  // no solo el mes que tengas abierto en pantalla en este momento.
  const mesesEnArchivo = new Set(
    datosImportadosPendientes.map(r => mesDeFecha(r.fechaIngreso)).filter(m => m !== null)
  );
  registros = registros.filter(r => !mesesEnArchivo.has(mesDeFecha(r.fechaIngreso)));
  registros = registros.concat(datosImportadosPendientes);

  guardarRegistros();
  irAlUltimoMesDe(datosImportadosPendientes.map(r => r.fechaIngreso));
  cambiarModoRegistro("ingresos", false);
  cerrarModalImportar();
  renderTodo();

  const nombresMeses = Array.from(mesesEnArchivo).sort((a, b) => a - b).map(m => MESES[m]).join(", ");
  mostrarToast(`Datos reemplazados correctamente (${nombresMeses}).`, "success");
  registrarEnHistorial("Importó Excel (reemplazó)", `Meses: ${nombresMeses}`);
});

document.getElementById("btnCancelarImportar").addEventListener("click", cerrarModalImportar);

function cerrarModalImportar() {
  document.getElementById("modalImportar").hidden = true;
  datosImportadosPendientes = null;
  tipoImportacionPendiente = "ingresos";
}

/* =========================================================
   COPIA DE SEGURIDAD (usa el mismo almacenamiento del sistema:
   localStorage, bajo la clave STORAGE_KEY, en formato JSON)
   ========================================================= */

let archivoRespaldoSeleccionado = null;

// --- Crear copia de seguridad ---
document.getElementById("btnCrearRespaldo").addEventListener("click", function () {
  // Versión 2: además de los ingresos ("registros"), guarda los egresos
  const listaEgresos = typeof egresos !== "undefined" ? egresos : [];
  const contenido = JSON.stringify({ version: 2, exportadoEn: new Date().toISOString(), registros, egresos: listaEgresos }, null, 2);
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

      // Las copias nuevas traen también los egresos; las antiguas (solo ingresos) no los tocan
      const egresosRestaurados = !Array.isArray(data) && Array.isArray(data.egresos) ? data.egresos : null;
      const mensaje = egresosRestaurados
        ? `Se restaurarán ${listaRestaurada.length} ingreso(s) y ${egresosRestaurados.length} egreso(s) desde el respaldo. Esto reemplazará TODOS los datos actuales. ¿Continuar?`
        : `Se restaurarán ${listaRestaurada.length} ingreso(s) desde el respaldo. Esto reemplazará TODOS los ingresos actuales (esta copia no trae egresos: los egresos actuales se conservan). ¿Continuar?`;
      const ok = confirm(mensaje);
      if (!ok) return;

      registros = listaRestaurada;
      guardarRegistros();
      if (egresosRestaurados && typeof restaurarEgresos === "function") restaurarEgresos(egresosRestaurados);
      renderTodo();
      actualizarListasAutocompletado();
      mostrarToast("Copia de seguridad restaurada correctamente.", "success");
      registrarEnHistorial("Restauró copia de seguridad", `${listaRestaurada.length} ingreso(s)` + (egresosRestaurados ? ` y ${egresosRestaurados.length} egreso(s)` : ""));

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
    if (e.target.closest("label[for='inputImportarEgresos'], #inputImportarEgresos")) return;
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
   HISTORIAL DE CAMBIOS (Fase 3, resuelta)
   IMPORTANTE: esto es una bitácora de referencia, NO seguridad.
   El "autor" es un texto libre que cualquiera puede escribir —
   no hay contraseña ni verificación. Para eso se necesitaría un
   backend real con inicio de sesión, que esta app no tiene.
   ========================================================= */

const HISTORIAL_KEY = "historial_cambios_v1";
const AUTOR_SESION_KEY = "autorSesionActual";
const MAX_ENTRADAS_HISTORIAL = 300;

function obtenerAutorActual() {
  const input = document.getElementById("inputAutorSesion");
  const valor = (input && input.value.trim()) || sessionStorage.getItem(AUTOR_SESION_KEY) || "";
  return valor || "Sin nombre";
}

document.getElementById("inputAutorSesion").addEventListener("change", function (e) {
  sessionStorage.setItem(AUTOR_SESION_KEY, e.target.value.trim());
});

// Al cargar la página, si ya habían escrito su nombre en esta pestaña
// (sessionStorage), lo vuelve a poner en el campo.
(function restaurarAutorSesion() {
  const guardado = sessionStorage.getItem(AUTOR_SESION_KEY);
  if (guardado) document.getElementById("inputAutorSesion").value = guardado;
})();

function cargarHistorial() {
  try {
    const raw = localStorage.getItem(HISTORIAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function registrarEnHistorial(accion, detalle) {
  const historial = cargarHistorial();
  historial.unshift({
    fecha: new Date().toISOString(),
    autor: obtenerAutorActual(),
    accion,
    detalle,
  });
  localStorage.setItem(HISTORIAL_KEY, JSON.stringify(historial.slice(0, MAX_ENTRADAS_HISTORIAL)));
}

function formatearFechaHistorial(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function abrirModalHistorial() {
  const historial = cargarHistorial();
  const lista = document.getElementById("historialLista");
  lista.innerHTML = historial.length === 0
    ? `<p class="analytics-list-empty">Todavía no hay cambios registrados.</p>`
    : historial.map(h => `
        <div class="historial-fila">
          <span class="historial-fecha">${formatearFechaHistorial(h.fecha)}</span><br>
          <strong>${h.autor}</strong> — ${h.accion}${h.detalle ? `: ${h.detalle}` : ""}
        </div>
      `).join("");
  abrirModal(document.getElementById("modalHistorial"));
}

document.getElementById("btnVerHistorial").addEventListener("click", function () {
  cerrarTodosLosDropdowns();
  abrirModalHistorial();
});

document.getElementById("cerrarModalHistorial").addEventListener("click", () => {
  document.getElementById("modalHistorial").hidden = true;
});

document.getElementById("modalHistorial").addEventListener("click", (e) => {
  if (e.target.id === "modalHistorial") document.getElementById("modalHistorial").hidden = true;
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
