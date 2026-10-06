/* ==========================================================================
   egresos.js — Ingresos y egresos en un mismo "Registro del mes"
   --------------------------------------------------------------------------
   - Botones "Ingresos / Egresos" del menú lateral: cambian lo que muestra el
     "Registro del mes" y lo que abre el botón "＋ Nuevo ...".
   - Egresos: se guardan aparte de los ingresos (clave propia en el navegador),
     con los mismos campos del Excel de egresos: Fecha de egreso, Descripción,
     Monto, Pagos y Beneficiarios (uno o varios nombres).
   - Importar / exportar Excel de egresos y carpeta XML de egresos (compras).

   Los ingresos siguen funcionando exactamente igual (script.js). Este archivo
   usa las funciones que ya existen allí (mostrarToast, abrirModal, MESES,
   mesActual, renderTodo, etc.) y NO toca ninguna gráfica.

   Para gráficas futuras, los datos quedan disponibles en la variable global
   "egresos" (lista), y en egresosDelMes(mes) y totalEgresosDelMes(mes).
   ========================================================================== */

const EGRESOS_KEY = "egresos_ladrillos_v1";
const MODO_REGISTRO_KEY = "modo_registro_v1";

// Columnas del egreso: el mismo orden del Excel de egresos
const COLUMNAS_EGRESOS = [
  { key: "fechaEgreso",    label: "Fecha de egreso", tipo: "fecha" },
  { key: "descripcion",    label: "Descripción",     tipo: "texto" },
  { key: "monto",          label: "Monto",           tipo: "moneda" },
  { key: "pagos",          label: "Pagos",           tipo: "numero" },
  { key: "beneficiarios",  label: "Beneficiarios",   tipo: "lista" },
];

let egresos = [];              // todos los egresos guardados
let handleExcelEgresos = null;  // archivo Excel vinculado a los egresos (Excel automático de egresos)
let idEgresoEnEdicion = null;
let beneficiariosEnFormulario = [];
let pagosEditadosAMano = false;

/* ======================================================================
   DATOS: guardar, leer y consultar
   ====================================================================== */

function cargarEgresos() {
  try {
    const raw = localStorage.getItem(EGRESOS_KEY);
    const lista = raw ? JSON.parse(raw) : [];
    egresos = Array.isArray(lista) ? lista.map(normalizarEgreso).filter(Boolean) : [];
  } catch (e) {
    console.error("Error leyendo los egresos:", e);
    egresos = [];
  }
}

function guardarEgresos() {
  try {
    localStorage.setItem(EGRESOS_KEY, JSON.stringify(egresos));
  } catch (e) {
    console.error("Error guardando los egresos:", e);
    mostrarToast("No se pudieron guardar los egresos en este navegador.", "error");
  }
  actualizarExcelEgresos();
}

// Deja cada egreso con la misma forma, venga de donde venga (formulario,
// Excel, XML o una copia de seguridad): fecha AAAA-MM-DD, monto y pagos numéricos
// y beneficiarios como lista de nombres
function normalizarEgreso(e) {
  if (!e || typeof e !== "object") return null;
  const beneficiarios = Array.isArray(e.beneficiarios)
    ? e.beneficiarios.map(n => String(n).trim()).filter(Boolean)
    : separarNombres(e.beneficiarios);
  const monto = Number(e.monto);
  const pagos = parseInt(e.pagos, 10);
  const egreso = {
    id: e.id || generarId(),
    fechaEgreso: String(e.fechaEgreso || "").slice(0, 10),
    descripcion: String(e.descripcion || "").trim(),
    monto: isFinite(monto) ? Math.round(monto * 100) / 100 : 0,
    pagos: pagos > 0 ? pagos : Math.max(1, beneficiarios.length),
    beneficiarios,
  };
  // Aviso para revisar (por ejemplo, un monto que en el Excel venía con signo de dólar).
  // Desaparece cuando el egreso se corrige y se guarda desde el formulario.
  if (e.aviso && !/signo de d[oó]lar/i.test(String(e.aviso))) egreso.aviso = String(e.aviso);
  return egreso;
}

// Igual que los ingresos: el mes se toma de la fecha (todos los años juntos)
function egresosDelMes(monthIndex) {
  return egresos.filter(e => mesDeFecha(e.fechaEgreso) === monthIndex);
}

function totalEgresosDelMes(monthIndex) {
  return egresosDelMes(monthIndex).reduce((s, e) => s + (Number(e.monto) || 0), 0);
}

function anioPredominanteEgresos() {
  if (egresos.length === 0) return new Date().getFullYear();
  const conteo = {};
  egresos.forEach(e => {
    const a = anioDeFecha(e.fechaEgreso);
    conteo[a] = (conteo[a] || 0) + 1;
  });
  return Object.keys(conteo).sort((a, b) => conteo[b] - conteo[a])[0];
}

// Separa "Ana Pérez, Luis Soto; Rosa Díaz" en tres nombres
function separarNombres(texto) {
  if (texto == null) return [];
  return String(texto)
    .split(/[,;\n\r]+/)
    .map(n => n.replace(/\s+/g, " ").trim())
    .filter(n => n && n !== "-" && n !== "—");
}

function escaparHtml(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ======================================================================
   MODO: Ingresos / Egresos
   ====================================================================== */

function cambiarModoRegistro(modo, desplazar) {
  modoRegistro = modo === "egresos" ? "egresos" : "ingresos";
  try { sessionStorage.setItem(MODO_REGISTRO_KEY, modoRegistro); } catch (e) { /* no crítico */ }
  renderTodo();

  // En el celular, el menú se cierra para que se vea el registro
  const shell = document.getElementById("shell");
  if (shell && shell.classList.contains("sb-abierto")) {
    shell.classList.remove("sb-abierto");
    const fondo = document.getElementById("sbFondo");
    if (fondo) fondo.hidden = true;
    const btnMenu = document.getElementById("btnMenuLateral");
    if (btnMenu) btnMenu.setAttribute("aria-expanded", "false");
  }

  if (desplazar) {
    const tarjeta = document.getElementById("sec-ventas");
    if (tarjeta) {
      tarjeta.scrollIntoView({ behavior: "smooth", block: "start" });
      tarjeta.classList.remove("reg-destello");
      void tarjeta.offsetWidth;   // reinicia la animación
      tarjeta.classList.add("reg-destello");
    }
  }
}

// Pone los textos y colores de la pantalla según el modo (lo llama renderTodo)
function actualizarVistaModo() {
  const enEgresos = modoRegistro === "egresos";
  document.body.classList.toggle("modo-egresos", enEgresos);
  document.body.classList.toggle("modo-ingresos", !enEgresos);

  ["btnModoIngresos", "btnModoEgresos"].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.setAttribute("aria-pressed", b.dataset.modo === modoRegistro ? "true" : "false");
  });

  const btnNuevo = document.getElementById("btnNuevo");
  if (btnNuevo) btnNuevo.textContent = enEgresos ? "＋ Nuevo egreso" : "＋ Nuevo ingreso";

  const pill = document.getElementById("pillModoRegistro");
  if (pill) {
    pill.textContent = enEgresos ? "Egresos" : "Ingresos";
    pill.className = "modo-pill " + (enEgresos ? "modo-pill-egresos" : "modo-pill-ingresos");
  }

  const sub = document.getElementById("subRegistro");
  if (sub) {
    sub.textContent = enEgresos
      ? "Cada pago o gasto con su detalle. Usa «Nuevo egreso» del menú para agregar uno."
      : "Cada venta con su detalle. Usa «Nuevo ingreso» del menú para agregar una.";
  }

  const vacio = document.getElementById("emptyState");
  if (vacio) {
    vacio.innerHTML = enEgresos
      ? "No hay egresos en este mes todavía. Usa <strong>“＋ Nuevo egreso”</strong> para agregar el primero."
      : "No hay ingresos en este mes todavía. Usa <strong>“＋ Nuevo ingreso”</strong> para agregar el primero.";
  }

  // Resumen del mes a la derecha del título (total y cantidad)
  const resumen = document.getElementById("resumenRegistro");
  if (resumen) {
    const nombreMes = MESES[mesActual].charAt(0) + MESES[mesActual].slice(1).toLowerCase();
    let total, cantidad, palabra;
    if (enEgresos) {
      const lista = egresosDelMes(mesActual);
      total = lista.reduce((s, e) => s + (Number(e.monto) || 0), 0);
      cantidad = lista.length;
      palabra = cantidad === 1 ? "egreso" : "egresos";
    } else {
      const lista = registrosDelMes(mesActual);
      total = lista.reduce((s, r) => s + (Number(r.montoTotal) || 0), 0);
      cantidad = lista.length;
      palabra = cantidad === 1 ? "ingreso" : "ingresos";
    }
    resumen.innerHTML = `<small>Total de ${escaparHtml(nombreMes)}</small><strong>${formatearMoneda(total)}</strong><span>${cantidad} ${palabra}</span>`;
  }
}

/* ======================================================================
   REGISTRO DEL MES: tabla de egresos
   ====================================================================== */

function renderRegistroEgresos() {
  const head = document.getElementById("tablaHead");
  const body = document.getElementById("tablaBody");
  const vacio = document.getElementById("emptyState");

  head.innerHTML = COLUMNAS_EGRESOS.map(c => {
    const claseNum = (c.tipo === "moneda" || c.tipo === "numero") ? " class='num'" : "";
    return `<th${claseNum}>${c.label}</th>`;
  }).join("") + "<th>Acciones</th>";

  const lista = egresosDelMes(mesActual).slice()
    .sort((a, b) => (a.fechaEgreso || "").localeCompare(b.fechaEgreso || ""));

  if (lista.length === 0) {
    body.innerHTML = "";
    vacio.hidden = false;
    return;
  }
  vacio.hidden = true;

  body.innerHTML = lista.map(e => {
    const nombres = e.beneficiarios || [];
    const visibles = nombres.slice(0, 3);
    const resto = nombres.length - visibles.length;
    const chips = nombres.length === 0
      ? '<span class="eg-sin">—</span>'
      : `<div class="eg-benef" title="${escaparHtml(nombres.join(", "))}">` +
        visibles.map(n => `<span class="eg-chip">${escaparHtml(n)}</span>`).join("") +
        (resto > 0 ? `<span class="eg-chip eg-chip-mas">+${resto} más</span>` : "") +
        "</div>";
    return `<tr>
      <td>${formatearFecha(e.fechaEgreso)}</td>
      <td class="eg-desc">${escaparHtml(e.descripcion) || "—"}${e.aviso ? `<span class="eg-aviso" title="${escaparHtml(e.aviso)}">⚠ Revisar moneda</span>` : ""}</td>
      <td class="num">${formatearMoneda(e.monto)}</td>
      <td class="num">${e.pagos ?? 1}</td>
      <td class="eg-col-benef">${chips}</td>
      <td class="row-actions">
        <button class="icon-btn" title="Editar" onclick="editarEgreso('${e.id}')">✏️</button>
        <button class="icon-btn danger" title="Eliminar" onclick="eliminarEgreso('${e.id}')">🗑️</button>
      </td>
    </tr>`;
  }).join("");
}

/* ======================================================================
   FORMULARIO DE EGRESO (nuevo / editar)
   ====================================================================== */

const modalEgreso = document.getElementById("modalEgreso");
const formEgreso = document.getElementById("formEgreso");
const campoBeneficiario = document.getElementById("campoBeneficiario");
const campoPagosEgreso = document.getElementById("campoPagosEgreso");

// Sugerencias al escribir: descripciones y beneficiarios ya usados, los más frecuentes primero
function actualizarSugerenciasEgresos() {
  function llenar(datalistId, valores) {
    const dl = document.getElementById(datalistId);
    if (!dl) return;
    const conteo = {};
    valores.forEach(v => {
      const t = String(v || "").trim();
      if (t) conteo[t] = (conteo[t] || 0) + 1;
    });
    dl.innerHTML = Object.keys(conteo)
      .sort((a, b) => conteo[b] - conteo[a])
      .slice(0, 200)
      .map(v => `<option value="${escaparHtml(v)}"></option>`).join("");
  }
  llenar("listaDescripcionEgreso", egresos.map(e => e.descripcion));
  llenar("listaBeneficiarios", egresos.flatMap(e => e.beneficiarios || []));
}

function pintarBeneficiarios() {
  const ul = document.getElementById("benefChips");
  ul.innerHTML = beneficiariosEnFormulario.map((n, i) =>
    `<li class="benef-chip"><span>${escaparHtml(n)}</span>` +
    `<button type="button" data-quitar="${i}" aria-label="Quitar a ${escaparHtml(n)}" title="Quitar">✕</button></li>`
  ).join("");

  const cantidad = beneficiariosEnFormulario.length;
  document.getElementById("benefContador").textContent =
    cantidad === 0 ? "Sin beneficiarios" : cantidad === 1 ? "1 beneficiario" : `${cantidad} beneficiarios`;
  campoBeneficiario.placeholder = cantidad === 0 ? "Escribe un nombre y pulsa Enter" : "Agregar otro nombre…";

  // "Pagos" sigue a la cantidad de beneficiarios mientras no se haya cambiado a mano
  if (!pagosEditadosAMano) campoPagosEgreso.value = Math.max(1, cantidad);
}

// Agrega uno o varios nombres (si se pegan separados por comas); sin repetir
function agregarBeneficiarios(texto) {
  const nuevos = separarNombres(texto);
  let agregados = 0;
  nuevos.forEach(n => {
    const existe = beneficiariosEnFormulario.some(x => x.toLowerCase() === n.toLowerCase());
    if (!existe) { beneficiariosEnFormulario.push(n); agregados++; }
  });
  if (nuevos.length > 0 && agregados === 0) mostrarToast("Ese beneficiario ya está en la lista.", "info");
  pintarBeneficiarios();
  return agregados;
}

function confirmarNombreEscrito() {
  const texto = campoBeneficiario.value;
  if (!texto.trim()) return false;
  agregarBeneficiarios(texto);
  campoBeneficiario.value = "";
  return true;
}

campoBeneficiario.addEventListener("keydown", function (e) {
  if (e.key === "Enter" || e.key === ",") {
    // Enter aquí agrega el nombre; no envía el formulario
    if (campoBeneficiario.value.trim()) {
      e.preventDefault();
      confirmarNombreEscrito();
    } else if (e.key === ",") {
      e.preventDefault();
    } else if (e.key === "Enter") {
      e.preventDefault();
    }
  } else if (e.key === "Backspace" && !campoBeneficiario.value && beneficiariosEnFormulario.length) {
    beneficiariosEnFormulario.pop();
    pintarBeneficiarios();
  }
});

// Pegar "Ana, Luis, Rosa" crea tres nombres de una vez
campoBeneficiario.addEventListener("paste", function (e) {
  const texto = (e.clipboardData || window.clipboardData).getData("text");
  if (/[,;\n]/.test(texto)) {
    e.preventDefault();
    agregarBeneficiarios(campoBeneficiario.value + "," + texto);
    campoBeneficiario.value = "";
  }
});

// Al elegir una sugerencia de la lista, se agrega sola
campoBeneficiario.addEventListener("change", function () {
  if (campoBeneficiario.value.trim()) confirmarNombreEscrito();
});

document.getElementById("btnAgregarBeneficiario").addEventListener("click", function () {
  if (!confirmarNombreEscrito()) campoBeneficiario.focus();
  else campoBeneficiario.focus();
});

document.getElementById("benefChips").addEventListener("click", function (e) {
  const b = e.target.closest("[data-quitar]");
  if (!b) return;
  beneficiariosEnFormulario.splice(Number(b.dataset.quitar), 1);
  pintarBeneficiarios();
  campoBeneficiario.focus();
});

// Clic en cualquier parte del recuadro = escribir un nombre
document.getElementById("benefCampo").addEventListener("click", function (e) {
  if (e.target === this) campoBeneficiario.focus();
});

campoPagosEgreso.addEventListener("input", function () { pagosEditadosAMano = true; });

function prepararFormularioEgreso(egreso) {
  formEgreso.reset();
  idEgresoEnEdicion = egreso ? egreso.id : null;
  document.getElementById("modalEgresoTitulo").textContent = egreso ? "Editar egreso" : "Nuevo egreso";
  document.getElementById("campoEgresoId").value = egreso ? egreso.id : "";
  beneficiariosEnFormulario = egreso ? (egreso.beneficiarios || []).slice() : [];
  // Al editar, se respeta el número de pagos guardado si no coincide con los nombres
  pagosEditadosAMano = !!egreso && Number(egreso.pagos) !== Math.max(1, beneficiariosEnFormulario.length);
  actualizarSugerenciasEgresos();

  const aviso = document.getElementById("avisoEgreso");
  aviso.hidden = !(egreso && egreso.aviso);
  aviso.textContent = egreso && egreso.aviso ? `⚠ ${egreso.aviso} Al guardar, esta marca se quita.` : "";

  if (egreso) {
    document.getElementById("campoFechaEgreso").value = egreso.fechaEgreso || "";
    document.getElementById("campoDescripcionEgreso").value = egreso.descripcion || "";
    document.getElementById("campoMontoEgreso").value = egreso.monto ?? "";
    campoPagosEgreso.value = egreso.pagos ?? 1;
  } else {
    // Fecha sugerida dentro del mes que se está viendo: hoy si coincide, si no el día 1
    const hoy = new Date();
    const local = new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    document.getElementById("campoFechaEgreso").value = hoy.getMonth() === mesActual
      ? local
      : `${hoy.getFullYear()}-${String(mesActual + 1).padStart(2, "0")}-01`;
  }
  campoBeneficiario.value = "";
  pintarBeneficiarios();
}

function abrirModalEgresoNuevo() {
  prepararFormularioEgreso(null);
  abrirModal(modalEgreso);
  setTimeout(() => document.getElementById("campoDescripcionEgreso").focus(), 60);
}

function editarEgreso(id) {
  const e = egresos.find(x => x.id === id);
  if (!e) return;
  prepararFormularioEgreso(e);
  abrirModal(modalEgreso);
}

function cerrarModalEgreso() {
  modalEgreso.hidden = true;
  idEgresoEnEdicion = null;
}

function eliminarEgreso(id) {
  const e = egresos.find(x => x.id === id);
  if (!e) return;
  const ok = confirm(`¿Eliminar el egreso "${e.descripcion || "sin descripción"}" de ${formatearMoneda(e.monto)}? Esta acción no se puede deshacer.`);
  if (!ok) return;
  egresos = egresos.filter(x => x.id !== id);
  guardarEgresos();
  renderTodo();
  mostrarToast("Egreso eliminado.", "success");
  registrarEnHistorial("Eliminó egreso", `${e.descripcion || "Sin descripción"} (${formatearMoneda(e.monto)})`);
}

formEgreso.addEventListener("submit", function (ev) {
  ev.preventDefault();
  // Un nombre escrito y sin confirmar también cuenta
  confirmarNombreEscrito();

  const monto = parseFloat(document.getElementById("campoMontoEgreso").value);
  if (!(monto > 0)) {
    mostrarToast("Escribe un monto mayor que cero.", "error");
    document.getElementById("campoMontoEgreso").focus();
    return;
  }

  const egreso = normalizarEgreso({
    id: idEgresoEnEdicion || generarId(),
    fechaEgreso: document.getElementById("campoFechaEgreso").value,
    descripcion: document.getElementById("campoDescripcionEgreso").value,
    monto,
    pagos: campoPagosEgreso.value,
    beneficiarios: beneficiariosEnFormulario.slice(),
  });

  if (idEgresoEnEdicion) {
    egresos = egresos.map(x => (x.id === idEgresoEnEdicion ? egreso : x));
    mostrarToast("Egreso actualizado.", "success");
    registrarEnHistorial("Editó egreso", `${egreso.descripcion} (${formatearMoneda(egreso.monto)})`);
  } else {
    egresos.push(egreso);
    mostrarToast("Egreso agregado.", "success");
    registrarEnHistorial("Agregó egreso", `${egreso.descripcion} (${formatearMoneda(egreso.monto)})`);
  }
  guardarEgresos();

  // Si el egreso es de otro mes, se salta a ese mes para mostrarlo
  const mes = mesDeFecha(egreso.fechaEgreso);
  if (mes !== null && !isNaN(mes)) mesActual = mes;

  cerrarModalEgreso();
  if (modoRegistro !== "egresos") cambiarModoRegistro("egresos", false);
  else renderTodo();
  // Si el Excel automático de egresos no está activo, se avisa (el egreso igual queda guardado en el sistema)
  if (!handleExcelEgresos && window.AvisoExcel) AvisoExcel.inactivo("egresos");
});

document.getElementById("cancelarEgreso").addEventListener("click", cerrarModalEgreso);
document.getElementById("cerrarModalEgreso").addEventListener("click", cerrarModalEgreso);
modalEgreso.addEventListener("click", (e) => { if (e.target === modalEgreso) cerrarModalEgreso(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalEgreso.hidden) cerrarModalEgreso();
});

/* ======================================================================
   BORRAR / RESTAURAR (los usa script.js)
   ====================================================================== */

function borrarTodosLosEgresos() {
  const cantidad = egresos.length;
  egresos = [];
  guardarEgresos();
  return cantidad;
}

function restaurarEgresos(lista) {
  egresos = (Array.isArray(lista) ? lista : []).map(normalizarEgreso).filter(Boolean);
  guardarEgresos();
}

/* ======================================================================
   EXCEL DE EGRESOS: leer
   Acepta el formato del Excel de egresos de la empresa: una hoja por mes,
   con filas de título arriba, y el encabezado "Fecha de egreso | Descripción |
   Monto | Pagos | Beneficiarios" en cualquier fila. Tolera montos escritos como
   texto ("S/ 4,121.08"), fechas como texto ("23/04/2026") y filas de TOTAL.
   ====================================================================== */

function textoComparable(v) {
  return String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

// "S/ 4,121.08" → 4121.08 ; "1.234,50" → 1234.5 ; "\n4" → 4
function numeroDesdeCelda(v) {
  if (typeof v === "number") return isFinite(v) ? v : NaN;
  let s = String(v ?? "").replace(/s\/\.?/gi, "").replace(/[^\d.,-]/g, "");
  if (!s || s === "-") return NaN;
  const coma = s.lastIndexOf(","), punto = s.lastIndexOf(".");
  if (coma > -1 && punto > -1) {
    s = coma > punto ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (coma > -1) {
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, "");
  }
  const n = parseFloat(s);
  return isFinite(n) ? n : NaN;
}

function fechaDesdeCelda(v) {
  if (v == null || v === "") return "";
  if (typeof v === "number") return convertirValorFecha(v);
  if (v instanceof Date && !isNaN(v)) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  const txt = String(v);
  const iso = txt.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  // dd/mm/aaaa (también tolera "6/012/2026", que Excel a veces muestra así)
  const m = txt.match(/(\d{1,2})\/(\d{1,3})\/(\d{2,4})/);
  if (m) {
    const dia = parseInt(m[1], 10), mes = parseInt(m[2], 10);
    let anio = parseInt(m[3], 10);
    if (anio < 100) anio += 2000;
    if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
      return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    }
  }
  return "";
}

// Busca la fila de encabezados de egresos en las primeras filas de una hoja
function encontrarEncabezadoEgresos(filas) {
  const limite = Math.min(filas.length, 40);
  for (let r = 0; r < limite; r++) {
    const celdas = (filas[r] || []).map(textoComparable);
    const col = { fecha: -1, descripcion: -1, monto: -1, pagos: -1, beneficiarios: -1 };
    celdas.forEach((c, i) => {
      if (col.fecha < 0 && c.startsWith("fecha de egreso")) col.fecha = i;
      else if (col.descripcion < 0 && c.startsWith("descripcion")) col.descripcion = i;
      else if (col.monto < 0 && c.startsWith("monto")) col.monto = i;
      else if (col.pagos < 0 && c.startsWith("pago")) col.pagos = i;
      else if (col.beneficiarios < 0 && c.startsWith("beneficiario")) col.beneficiarios = i;
    });
    if (col.fecha > -1 && col.monto > -1) return { fila: r, col };
  }
  return null;
}

// Lo usa también script.js: si alguien intenta importar el Excel de egresos
// como si fuera de ingresos, se le avisa
function libroPareceDeEgresos(wb) {
  let hayEgresos = false;
  let hayIngresos = false;
  wb.SheetNames.forEach(nombre => {
    const filas = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, raw: true, defval: "" }).slice(0, 40);
    filas.forEach(f => (f || []).forEach(c => {
      const t = textoComparable(c);
      if (t.startsWith("fecha de egreso")) hayEgresos = true;
      if (t.startsWith("fecha de ingreso")) hayIngresos = true;
    }));
  });
  return hayEgresos && !hayIngresos;
}

// El monto se ve con signo de dólar (texto "$ 2,034.71" o celda con formato $)
// y no con "S/": puede estar en dólares
function montoPareceEnDolares(crudo, celda) {
  const texto = typeof crudo === "string" ? crudo : (celda && celda.w) || "";
  return /\$|usd|d[oó]lar/i.test(texto) && !/s\s*\//i.test(texto);
}

function leerLibroEgresos(wb) {
  const resultado = { egresos: [], hojas: 0, omitidas: 0, sinEncabezado: 0, enDolares: 0 };
  wb.SheetNames.forEach(nombre => {
    const ws = wb.Sheets[nombre];
    const rango = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]) : { s: { r: 0, c: 0 } };
    const filas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "", blankrows: true });
    if (filas.length < 2) return;
    const enc = encontrarEncabezadoEgresos(filas);
    if (!enc) { resultado.sinEncabezado++; return; }

    let enEstaHoja = 0;
    for (let r = enc.fila + 1; r < filas.length; r++) {
      const f = filas[r] || [];
      const tomar = i => (i > -1 ? f[i] : "");
      const descripcion = String(tomar(enc.col.descripcion) ?? "").replace(/\s+/g, " ").trim();
      const crudoMonto = tomar(enc.col.monto);
      const crudoFecha = tomar(enc.col.fecha);

      // Fila vacía o fila de totales: se salta sin contarla como problema
      const vacia = !descripcion && (crudoMonto === "" || crudoMonto == null) && (crudoFecha === "" || crudoFecha == null);
      if (vacia || textoComparable(descripcion).startsWith("total")) continue;

      const fecha = fechaDesdeCelda(crudoFecha);
      const monto = numeroDesdeCelda(crudoMonto);
      if (!fecha || !(monto > 0)) { resultado.omitidas++; continue; }

      const beneficiarios = separarNombres(tomar(enc.col.beneficiarios));
      const pagos = parseInt(numeroDesdeCelda(tomar(enc.col.pagos)), 10);

      // Todo se trabaja en soles: si en el Excel el monto aparece con «$», es un error de formato
      // y el número se lee como soles (sin marca de aviso). Solo se cuenta para informarlo.
      const celdaMonto = ws[XLSX.utils.encode_cell({ r: rango.s.r + r, c: rango.s.c + enc.col.monto })];
      if (montoPareceEnDolares(crudoMonto, celdaMonto)) resultado.enDolares++;

      resultado.egresos.push(normalizarEgreso({
        fechaEgreso: fecha,
        descripcion,
        monto,
        pagos: pagos > 0 ? pagos : Math.max(1, beneficiarios.length),
        beneficiarios,
      }));
      enEstaHoja++;
    }
    if (enEstaHoja > 0) resultado.hojas++;
  });
  return resultado;
}

document.getElementById("inputImportarEgresos").addEventListener("change", function (e) {
  const archivo = e.target.files[0];
  if (!archivo) return;
  cerrarTodosLosDropdowns();

  const lector = new FileReader();
  lector.onload = function (evt) {
    try {
      const wb = XLSX.read(evt.target.result, { type: "array", cellDates: false });
      const leido = leerLibroEgresos(wb);

      if (leido.egresos.length === 0) {
        mostrarToast(leido.sinEncabezado
          ? "No se encontró el encabezado «Fecha de egreso / Monto». ¿Es el Excel de egresos?"
          : "El archivo no contiene egresos para importar.", "error");
        return;
      }

      const total = leido.egresos.reduce((s, x) => s + x.monto, 0);
      const yaCargados = window.Duplicados ? Duplicados.separarNuevos(leido.egresos, egresos, Duplicados.firmaEgreso).repetidos.length : 0;
      datosImportadosPendientes = leido.egresos;
      tipoImportacionPendiente = "egresos";
      document.getElementById("tituloImportar").textContent = "Importar egresos";
      document.getElementById("textoImportarResumen").textContent =
        `Se encontraron ${leido.egresos.length} egreso(s) en ${leido.hojas} hoja(s), por un total de ${formatearMoneda(total)}.` +
        (leido.omitidas ? ` Se omitieron ${leido.omitidas} fila(s) sin fecha o sin monto válido.` : "") +
        (leido.enDolares ? ` ${leido.enDolares} monto(s) tenían el signo $ en el Excel: se leyeron como soles.` : "") +
        (yaCargados ? ` ${yaCargados === leido.egresos.length ? "Todos" : yaCargados} ya están cargados y no se volverán a sumar; «Agregar datos» solo agrega los ${leido.egresos.length - yaCargados} nuevo(s).` : "") +
        " ¿Deseas agregarlos a los egresos existentes?";
      abrirModal(document.getElementById("modalImportar"));
    } catch (err) {
      console.error(err);
      mostrarToast("No se pudo leer el archivo Excel de egresos.", "error");
    } finally {
      e.target.value = "";
    }
  };
  lector.readAsArrayBuffer(archivo);
});

// Lo llama la ventana de importación de script.js ("Agregar" o "Reemplazar datos del mes")
function aplicarImportacionEgresos(lista, forma) {
  let nuevos = lista.map(normalizarEgreso).filter(Boolean);
  let omitidos = 0;
  // «Agregar»: solo lo que todavía no está cargado (el mismo Excel nunca se suma dos veces)
  if (forma !== "reemplazar" && window.Duplicados) {
    const sep = Duplicados.separarNuevos(nuevos, egresos, Duplicados.firmaEgreso);
    nuevos = sep.nuevos;
    omitidos = sep.repetidos.length;
  }
  let nombresMeses = "";
  if (forma === "reemplazar") {
    const meses = new Set(nuevos.map(x => mesDeFecha(x.fechaEgreso)).filter(m => m !== null && !isNaN(m)));
    egresos = egresos.filter(x => !meses.has(mesDeFecha(x.fechaEgreso)));
    nombresMeses = Array.from(meses).sort((a, b) => a - b).map(m => MESES[m]).join(", ");
  }
  egresos = egresos.concat(nuevos);
  guardarEgresos();

  // Se muestran los egresos, en el último mes que trae el archivo (ahí están los datos recién cargados)
  if (typeof irAlUltimoMesDe === "function") irAlUltimoMesDe(lista.map(x => x && x.fechaEgreso));
  cambiarModoRegistro("egresos", false);

  if (forma === "reemplazar") {
    mostrarToast(`Egresos reemplazados correctamente (${nombresMeses}).`, "success");
    registrarEnHistorial("Importó Excel de egresos (reemplazó)", `Meses: ${nombresMeses}`);
  } else {
    if (!nuevos.length) mostrarToast("Este Excel de egresos ya estaba cargado: no se agregó nada para no duplicar tus datos.", "info");
    else mostrarToast(`✅ ${nuevos.length} egreso(s) importados correctamente.` + (omitidos ? ` Se omitieron ${omitidos} que ya estaban cargados.` : ""), "success");
    registrarEnHistorial("Importó Excel de egresos (agregó)", `${nuevos.length} egreso(s)`);
  }
}

/* ======================================================================
   EXCEL DE EGRESOS: exportar (mismo formato que se puede volver a importar)
   ====================================================================== */

function construirHojaEgresos(lista) {
  const encabezados = COLUMNAS_EGRESOS.map(c => c.label);
  const filas = lista.map(e => [
    e.fechaEgreso ? fechaExcel(e.fechaEgreso) : "",   // fecha exacta (sin correrse un día por la zona horaria)
    e.descripcion || "",
    Number(e.monto) || 0,
    Number(e.pagos) || 1,
    (e.beneficiarios || []).join(", "),
  ]);
  const datos = [encabezados, ...filas];
  const ws = XLSX.utils.aoa_to_sheet(datos);

  ws["!cols"] = [{ wch: 14 }, { wch: 42 }, { wch: 14 }, { wch: 8 }, { wch: 60 }];
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: encabezados.length - 1 } }) };
  for (let c = 0; c < encabezados.length; c++) {
    const ref = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[ref]) ws[ref].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "23201B" } } };
  }
  for (let r = 1; r < datos.length; r++) {
    const refFecha = XLSX.utils.encode_cell({ r, c: 0 });
    const refMonto = XLSX.utils.encode_cell({ r, c: 2 });
    if (ws[refFecha]) ws[refFecha].z = "dd/mm/yyyy";
    if (ws[refMonto]) ws[refMonto].z = '"S/"#,##0.00';
  }
  return ws;
}

function ordenarPorFechaEgreso(lista) {
  return lista.slice().sort((a, b) => (a.fechaEgreso || "").localeCompare(b.fechaEgreso || ""));
}

async function exportarMesEgresos() {
  const lista = ordenarPorFechaEgreso(egresosDelMes(mesActual));
  if (lista.length === 0) {
    mostrarToast(`No hay egresos en ${MESES[mesActual]} para exportar.`, "error");
    return;
  }
  const anio = anioDeFecha(lista[0].fechaEgreso) || anioPredominanteEgresos();
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, construirHojaEgresos(lista), MESES[mesActual].slice(0, 31));
  const guardado = await descargarLibro(wb, `EGRESOS_${MESES[mesActual]}_${anio}.xlsx`);
  if (guardado) mostrarToast("✅ Egresos exportados correctamente a Excel", "success");
}

async function exportarAnioEgresos() {
  if (egresos.length === 0) {
    mostrarToast("No hay egresos guardados para exportar.", "error");
    return;
  }
  const wb = XLSX.utils.book_new();
  MESES.forEach((nombreMes, idx) => {
    XLSX.utils.book_append_sheet(wb, construirHojaEgresos(ordenarPorFechaEgreso(egresosDelMes(idx))), nombreMes.slice(0, 31));
  });
  const guardado = await descargarLibro(wb, `EGRESOS_ANUALES_${anioPredominanteEgresos()}.xlsx`);
  if (guardado) mostrarToast("✅ Egresos exportados correctamente a Excel", "success");
}

document.getElementById("btnExportarMesEgresos").addEventListener("click", exportarMesEgresos);
document.getElementById("btnExportarAnioEgresos").addEventListener("click", exportarAnioEgresos);

/* ======================================================================
   EXCEL AUTOMÁTICO DE EGRESOS
   Igual que el Excel automático de ingresos (script.js), pero con SU PROPIO
   archivo: los dos pueden estar vinculados al mismo tiempo. Cada vez que se
   agrega, edita, borra o importa un egreso, se reescribe solo el archivo de
   egresos; y cada vez que cambian los ingresos, solo el de ingresos.
   Solo funciona en Chrome o Edge (File System Access API).
   ====================================================================== */

const DB_KEY_EGRESOS = "excelAutomaticoEgresos";
let escribiendoExcelEgresos = false;
let pendienteExcelEgresos = false;

function actualizarBadgeSyncEgresos(activo) {
  const badge = document.getElementById("syncBadgeEgresos");
  if (!badge) return;
  badge.querySelector(".status-text").textContent = activo ? "Excel de egresos: Activo" : "Excel de egresos: Inactivo";
  badge.classList.toggle("activo", !!activo);
}

async function actualizarExcelEgresos() {
  if (!handleExcelEgresos) return false;
  // Si ya se está escribiendo, se anota y se repite una vez al terminar (nunca dos escrituras a la vez)
  if (escribiendoExcelEgresos) { pendienteExcelEgresos = true; return false; }
  escribiendoExcelEgresos = true;
  let ok = false;
  try {
    const permiso = await handleExcelEgresos.queryPermission({ mode: "readwrite" });
    if (permiso !== "granted") {
      if (window.AvisoExcel) AvisoExcel.sinPermiso("egresos", handleExcelEgresos.name);
      return false;
    }
    const wb = XLSX.utils.book_new();
    MESES.forEach((nombreMes, idx) => {
      XLSX.utils.book_append_sheet(wb, construirHojaEgresos(ordenarPorFechaEgreso(egresosDelMes(idx))), nombreMes.slice(0, 31));
    });
    if (typeof abrirEnUltimaHojaConDatos === "function") abrirEnUltimaHojaConDatos(wb);
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array", cellStyles: true });
    const writable = await handleExcelEgresos.createWritable();
    await writable.write(buffer);
    await writable.close();
    ok = true;
    if (window.AvisoExcel) AvisoExcel.cerrar("egresos");
    mostrarToast(`✅ Excel de egresos actualizado: «${handleExcelEgresos.name}» (${egresos.length} egreso(s))`, "success");
  } catch (err) {
    console.error("Error actualizando el Excel automático de egresos:", err);
    if (window.AvisoExcel) AvisoExcel.error("egresos", handleExcelEgresos && handleExcelEgresos.name);
    else mostrarToast("No se pudo actualizar el Excel automático de egresos. Si el archivo está abierto en Excel, ciérralo y vuelve a intentar.", "error");
  } finally {
    escribiendoExcelEgresos = false;
    if (pendienteExcelEgresos) { pendienteExcelEgresos = false; actualizarExcelEgresos(); }
  }
  return ok;
}

async function activarExcelEgresos() {
  if (!soportaExcelAutomatico()) {
    mostrarToast("Tu navegador no soporta esta función. Usa Chrome o Edge.", "error");
    return;
  }
  const confirmado = confirm(
    "Vas a elegir un archivo Excel para los EGRESOS (nuevo o existente).\n\n" +
    "A partir de ahora, ESE archivo se sobrescribirá automáticamente " +
    "cada vez que agregues, edites, borres o importes un egreso.\n" +
    "El Excel de ingresos sigue funcionando por separado.\n\n¿Deseas continuar?"
  );
  if (!confirmado) return;
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: `EGRESOS_ANUALES_${anioPredominanteEgresos()}.xlsx`,
      types: [{ description: "Libro de Excel", accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] } }],
    });
    handleExcelEgresos = handle;
    await guardarHandleEnDB(handle, DB_KEY_EGRESOS);
    actualizarBadgeSyncEgresos(true);
    if (window.AvisoExcel) AvisoExcel.cerrar("egresos");
    mostrarToast("Excel automático de egresos activado. Se actualizará con cada cambio.", "success");
    const ok = await actualizarExcelEgresos();
    // Con la página vacía, el Excel queda listo con sus encabezados y se llena con cada egreso
    if (ok && egresos.length === 0) mostrarToast(`Tu Excel «${handle.name}» quedó listo con los encabezados de egresos. Se llenará con cada egreso que registres o importes.`, "info");
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error(err);
      mostrarToast("No se pudo vincular el archivo Excel de egresos.", "error");
    }
  }
}

// Al abrir la página, reactiva en silencio el archivo de egresos de la sesión anterior (si el permiso sigue vigente)
async function intentarReanudarExcelEgresos() {
  if (!soportaExcelAutomatico() || (typeof aperturaNueva !== "undefined" && aperturaNueva)) return;
  try {
    const handle = await obtenerHandleDeDB(DB_KEY_EGRESOS);
    if (!handle) return;
    const permiso = await handle.queryPermission({ mode: "readwrite" });
    if (permiso === "granted") {
      handleExcelEgresos = handle;
      actualizarBadgeSyncEgresos(true);
    }
  } catch (err) {
    console.error("No se pudo reanudar el Excel automático de egresos:", err);
  }
}

(function conectarExcelEgresos() {
  const boton = document.getElementById("btnActivarSyncEgresos");
  if (!boton) return;
  if (!soportaExcelAutomatico()) { boton.hidden = true; return; }
  boton.addEventListener("click", activarExcelEgresos);
  intentarReanudarExcelEgresos();
})();

/* ======================================================================
   ARRANQUE
   ====================================================================== */

(function iniciarEgresos() {
  cargarEgresos();
  // La carpeta XML de egresos ya no existe: se borran sus rastros guardados
  try { localStorage.removeItem("egresos_xml_procesados_v1"); } catch (e) { /* no crítico */ }

  document.getElementById("btnModoIngresos").addEventListener("click", () => cambiarModoRegistro("ingresos", true));
  document.getElementById("btnModoEgresos").addEventListener("click", () => cambiarModoRegistro("egresos", true));

  // Se recuerda la última vista (ingresos o egresos) mientras la pestaña esté abierta
  let guardado = "ingresos";
  try { guardado = sessionStorage.getItem(MODO_REGISTRO_KEY) || "ingresos"; } catch (e) { /* no crítico */ }
  modoRegistro = guardado === "egresos" ? "egresos" : "ingresos";

  // Si el mes de hoy todavía no tiene nada registrado, se abre en el último mes con datos
  // (así al entrar se ven tus datos y no una página vacía)
  if (!registrosDelMes(mesActual).length && !egresosDelMes(mesActual).length) {
    irAlUltimoMesDe(registros.map(r => r.fechaIngreso).concat(egresos.map(e => e.fechaEgreso)));
  }

  renderTodo();
})();
