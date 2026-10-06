/* ==========================================================================
   dashboard.js — Indicadores, gráficas y menú lateral del diseño "Ladrillera"
   --------------------------------------------------------------------------
   Es de SOLO LECTURA sobre tus datos: lee `registros` (lo que cargó tu
   "Importar Excel") y nunca los modifica. script.js llama a
   actualizarDashboard() cada vez que se redibuja la pantalla, así que todo
   refleja siempre el último Excel.

   Reutiliza de script.js: registros, MESES, mesActual, mesDeFecha,
   anioDeFecha, anioPredominante, registrosDelMes, formatearMoneda y
   formatearMonedaCompacta.
   ========================================================================== */
(function () {
  "use strict";

  /* ======================================================================
     UTILIDADES
     ====================================================================== */

  function esc(texto) {
    return String(texto).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function num(n) {
    return Number(n || 0).toLocaleString("es-PE", { maximumFractionDigits: 0 });
  }

  function iconoSvg(nombre) {
    const trazos = {
      ventas: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
      ladrillos: '<rect x="3" y="4" width="8" height="5" rx="1"/><rect x="13" y="4" width="8" height="5" rx="1"/><rect x="3" y="11" width="4.5" height="5" rx="1"/><rect x="9.5" y="11" width="8" height="5" rx="1"/><rect x="3" y="18" width="8" height="3" rx="1"/><rect x="13" y="18" width="8" height="3" rx="1"/>',
      deuda: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/>',
      cobrado: '<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/>',
      operaciones: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 12h7M9 16h7"/>',
      cerrar: '<circle cx="12" cy="12" r="8.5"/>',
      dona: '<path d="M12 3v9h9"/><path d="M20.5 15A9 9 0 1 1 9 3.5"/>',
      linea: '<path d="M3 17l5-5 4 3 8-9"/><path d="M3 21h18"/>',
      ranking: '<path d="M5 20V12"/><path d="M12 20V5"/><path d="M19 20v-9"/>',
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (trazos[nombre] || "") + "</svg>";
  }

  /* ======================================================================
     DATOS
     ====================================================================== */

  // Un código vacío o solo con rayas («-») cuenta como «Sin código» (igual que en los informes)
  function codigoDe(r) {
    const t = String(r.codigoLadrillo || "").trim();
    return !t || /^[-–—.\s]+$/.test(t) ? "Sin código" : t;
  }

  function porCodigo() {
    const mapa = {};
    registros.forEach(function (r) {
      const c = codigoDe(r);
      if (!mapa[c]) mapa[c] = { unidades: 0, monto: 0, ops: 0, precios: [], montoConUnidades: 0 };
      mapa[c].unidades += Number(r.unidad) || 0;
      mapa[c].monto += Number(r.montoTotal) || 0;
      mapa[c].ops += 1;
      // para el precio promedio solo cuentan las ventas que dicen cuántos ladrillos fueron
      if ((Number(r.unidad) || 0) > 0) mapa[c].montoConUnidades += Number(r.montoTotal) || 0;
      // el precio de cada venta (si no lo trae, sale de monto ÷ unidades) con las unidades que pesa
      const u = Number(r.unidad) || 0;
      const pu = Number(r.precioUnitario) > 0 ? Number(r.precioUnitario) : (u > 0 ? (Number(r.montoTotal) || 0) / u : 0);
      if (pu > 0 && u > 0) mapa[c].precios.push([pu, u]);
    });
    return Object.keys(mapa).map(function (k) { return [k, mapa[k]]; })
      .sort(function (a, b) { return b[1].unidades - a[1].unidades; });
  }

  /* ======================================================================
     CABECERA: mes elegido y avatar
     ====================================================================== */

  function actualizarCabecera() {
    const texto = document.getElementById("heroMesTexto");
    if (texto) {
      // Las pestañas de mes de tu programa juntan TODOS los años en un mismo mes:
      // por eso el año solo se escribe si los datos son de un único año
      const anios = new Set();
      registros.forEach(function (r) { if (r.fechaIngreso) anios.add(anioDeFecha(r.fechaIngreso)); });
      const mes = MESES[mesActual].charAt(0) + MESES[mesActual].slice(1).toLowerCase();
      texto.textContent = anios.size > 1 ? mes + " · todos los años" : mes + " " + (anios.size === 1 ? Array.from(anios)[0] : new Date().getFullYear());
    }
    actualizarAvatar();
  }

  function actualizarAvatar() {
    const avatar = document.getElementById("heroAvatar");
    const campo = document.getElementById("inputAutorSesion");
    if (!avatar) return;
    const nombre = campo ? campo.value.trim() : "";
    const iniciales = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(function (p) { return p.charAt(0).toUpperCase(); }).join("");
    avatar.textContent = iniciales || "•";
  }

  /* Los 5 indicadores de arriba y la fila de 3 gráficas (ganancia o pérdida
     del mes, ¿cuánto me falta para no perder? y clientes clave) ahora los
     dibuja negocio.js con los cálculos compartidos de analitica.js. */

  /* ======================================================================
     TARJETA: ladrillos cerámicos más vendidos (información útil de TUS ventas)
     ====================================================================== */

  // Colores fuertes de cada puesto (del 1.º al 5.º): el mismo color une la barra de reparto, la tarjeta y su número
  const PALETA_PROD = ["#F45F00", "#1B4A78", "#008A2E", "#5B9BDB", "#6B5B95"];
  const COLOR_OTROS = "#B8B2A8";
  let graficosProd = [];   // las dos gráficas de «Ladrillos cerámicos más vendidos»

  function actualizarProductos() {
    const cont = document.getElementById("prodLista");
    const resumen = document.getElementById("prodResumen");
    if (!cont) return;
    const orden = porCodigo();
    if (orden.length === 0) {
      if (resumen) resumen.innerHTML = "";
      cont.innerHTML = '<li><p class="prod-vacio">Aún no hay ventas registradas. Cuando importes tu Excel, aquí verás qué ladrillo se vende más, cuántas unidades y a qué precio.</p></li>';
      return;
    }
    const totalUnidades = orden.reduce(function (s, p) { return s + p[1].unidades; }, 0);
    const totalMonto = orden.reduce(function (s, p) { return s + p[1].montoConUnidades; }, 0);
    const mesAnt = (mesActual - 1 + 12) % 12;
    const enMes = registrosDelMes(mesActual);
    const enAnt = registrosDelMes(mesAnt);

    function unidadesDe(lista, codigo) {
      return lista.filter(function (r) { return codigoDe(r) === codigo; }).reduce(function (s, r) { return s + (Number(r.unidad) || 0); }, 0);
    }

    // Los precios NO son fijos: cambian con el volumen de cada venta. Por eso se muestra el
    // precio promedio de verdad (ingresos ÷ ladrillos), el rango en que se movió y cuánto de lo
    // vendido salió por debajo del precio que más se usa (el «habitual»).
    function analisisPrecios(lista) {
      if (!lista.length) return null;
      const redondo = function (v) { return Math.round(v * 1000) / 1000; };
      let min = Infinity, max = -Infinity;
      const peso = {};
      lista.forEach(function (x) {
        const v = redondo(x[0]);
        if (v < min) min = v;
        if (v > max) max = v;
        peso[v] = (peso[v] || 0) + x[1];
      });
      let habitual = min, mejor = -1, total = 0;
      Object.keys(peso).forEach(function (k) { total += peso[k]; if (peso[k] > mejor) { mejor = peso[k]; habitual = Number(k); } });
      let debajo = 0;
      Object.keys(peso).forEach(function (k) { if (Number(k) < habitual - 0.0005) debajo += peso[k]; });
      return { min: min, max: max, habitual: habitual, pctDebajo: total > 0 ? (debajo / total) * 100 : 0 };
    }
    function p3(v) { return "S/ " + Number(v).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 3 }); }

    const top = orden.slice(0, 5);
    const resto = orden.slice(5);
    const unidadesResto = resto.reduce(function (s, p) { return s + p[1].unidades; }, 0);

    /* ---- Modelo simple: período, total de ladrillos con su precio promedio y una fila por código ---- */
    // (antes: 4 cifras, barra de reparto, leyenda y una tarjeta por código con rango de precios,
    // «▲ % vs mes anterior» y descuentos; se simplificó a lo importante)
    const fechas = registros.map(function (r) { return r.fechaIngreso || ""; }).filter(Boolean).sort();
    let periodo = "Todas tus ventas";
    if (fechas.length) {
      const nom = function (f) { const m = Number(f.slice(5, 7)) - 1; return MESES[m].charAt(0) + MESES[m].slice(1).toLowerCase(); };
      const a1 = fechas[0].slice(0, 4), a2 = fechas[fechas.length - 1].slice(0, 4);
      const m1 = nom(fechas[0]), m2 = nom(fechas[fechas.length - 1]);
      periodo = m1 === m2 && a1 === a2 ? m1 + " " + a2 : a1 === a2 ? m1 + " – " + m2.toLowerCase() + " " + a2 : m1 + " " + a1 + " – " + m2.toLowerCase() + " " + a2;
    }
    if (resumen) {
      resumen.innerHTML =
        '<div class="md-pd-cab"><p class="md-per">' + esc(periodo) + '</p><span class="md-pill md-pill-neu md-pill-lg">' + num(orden.length) + (orden.length === 1 ? " código" : " códigos") + "</span></div>" +
        '<div class="md-stat"><b>' + num(totalUnidades) + '</b><span class="md-txt">ladrillos vendidos</span>' +
        (totalUnidades > 0 ? '<span class="md-pill md-pill-neu">Precio prom. ' + p3(totalMonto / totalUnidades) + "</span>" : "") + "</div>";
    }
    cont.classList.add("md-pd-lista");
    // Dos gráficas con los mismos códigos y colores: cuántos ladrillos vendiste de cada uno y a qué precio
    const filas = top.map(function (p, i) {
      const d = p[1];
      const a = analisisPrecios(d.precios);
      return { nombre: p[0], u: d.unidades, monto: d.monto, precio: d.unidades > 0 ? d.montoConUnidades / d.unidades : 0, min: a ? a.min : null, max: a ? a.max : null, color: PALETA_PROD[i] || "#A9573F" };
    });
    if (unidadesResto > 0) {
      const montoResto = resto.reduce(function (s, p) { return s + p[1].monto; }, 0);
      const montoRestoU = resto.reduce(function (s, p) { return s + p[1].montoConUnidades; }, 0);
      filas.push({ nombre: "Otros " + resto.length, u: unidadesResto, monto: montoResto, precio: montoRestoU / unidadesResto, min: null, max: null, color: COLOR_OTROS });
    }
    const alto = Math.max(170, filas.length * 40 + 24);
    cont.innerHTML = '<li class="pd-graficas">' +
      '<div class="pd-g"><p class="pd-g-tit">Ladrillos vendidos por código</p><div class="pd-g-lienzo" style="height:' + alto + 'px"><canvas id="pdUnidades" role="img" aria-label="Ladrillos vendidos por código"></canvas></div></div>' +
      '<div class="pd-g"><p class="pd-g-tit">Precio promedio por ladrillo</p><div class="pd-g-lienzo" style="height:' + alto + 'px"><canvas id="pdPrecios" role="img" aria-label="Precio promedio por ladrillo de cada código"></canvas></div></div></li>';
    if (typeof Chart === "undefined") return;
    graficosProd.forEach(function (g) { try { g.destroy(); } catch (e) { /* ya no existe */ } });
    graficosProd = [];
    function base(datos, fmt, derecha, tooltipLinea) {
      return {
        type: "bar",
        data: { labels: filas.map(function (f) { return f.nombre; }), datasets: [{ data: datos, backgroundColor: filas.map(function (f) { return f.color; }), borderRadius: 7, barThickness: 22 }] },
        options: {
          indexAxis: "y", responsive: true, maintainAspectRatio: false, animation: { duration: 700 },
          layout: { padding: { right: derecha, top: 4, bottom: 4 } },
          scales: { x: { display: false, beginAtZero: true }, y: { grid: { display: false }, border: { display: false }, ticks: { color: "#3B2F2A", font: { size: 13, weight: "600" } } } },
          plugins: {
            legend: { display: false },
            ngValores: { on: true, horizontal: true, fmt: fmt, minimo: 1, tam: 12 },
            mdSombra: { on: true },
            tooltip: { callbacks: { title: function (it) { return it.length ? filas[it[0].dataIndex].nombre : ""; }, label: function (c) { return tooltipLinea(filas[c.dataIndex]); } } },
          },
        },
      };
    }
    const cu = document.getElementById("pdUnidades"), cp = document.getElementById("pdPrecios");
    graficosProd.push(new Chart(cu, base(filas.map(function (f) { return f.u; }),
      function (v, i) { return num(v) + " u. · " + ((v / totalUnidades) * 100).toFixed(0) + "%"; }, 130,
      function (f) { return [" " + num(f.u) + " ladrillos (" + ((f.u / totalUnidades) * 100).toFixed(1) + "%)", " Ventas: " + formatearMoneda(f.monto)]; })));
    graficosProd.push(new Chart(cp, base(filas.map(function (f) { return f.precio; }),
      function (v, i) { const f = filas[i]; return p3(v) + (f.min !== null && f.max - f.min >= 0.0005 ? "  (" + p3(f.min).replace("S/ ", "") + " a " + p3(f.max).replace("S/ ", "") + ")" : f.min !== null ? "  fijo" : ""); }, 150,
      function (f) { return [" Promedio: " + p3(f.precio) + " por ladrillo"].concat(f.min !== null ? [f.max - f.min >= 0.0005 ? " Se vendió entre " + p3(f.min) + " y " + p3(f.max) : " Precio fijo"] : [" Promedio de los otros códigos"]); })));
  }

  /* ======================================================================
     ACTUALIZACIÓN GENERAL (la llama script.js en cada renderTodo)
     ====================================================================== */

  function conProteccion(nombre, fn) {
    // Si una tarjeta falla, las demás siguen funcionando y la app nunca se rompe
    try { fn(); } catch (error) { console.warn("[dashboard] " + nombre + ":", error); }
  }

  function actualizarDashboard() {
    // Aviso si los datos quedaron cargados más de una vez (duplicados.js)
    if (window.Duplicados) conProteccion("duplicados", window.Duplicados.revisar);
    conProteccion("cabecera", actualizarCabecera);
    conProteccion("productos", actualizarProductos);
    // Indicadores de arriba, fila de 3 gráficas y "Salud de tu negocio" (negocio.js)
    if (typeof window.actualizarNegocio === "function") conProteccion("negocio", window.actualizarNegocio);
    // Títulos cortos y veredicto debajo de los círculos de «Mis gráficos» (mis-graficos.js)
    if (window.MisGraficos) conProteccion("mis gráficos", window.MisGraficos.actualizar);
  }

  /* ======================================================================
     MENÚ LATERAL, SELECTOR DE MES Y VERSIÓN CELULAR
     ====================================================================== */

  function resaltarSeccionVisible() {
    const enlaces = Array.from(document.querySelectorAll(".sb-item[data-sec]"));
    if (!enlaces.length || !("IntersectionObserver" in window)) return;
    const observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) {
        if (!en.isIntersecting) return;
        enlaces.forEach(function (a) { a.classList.toggle("sb-activo", a.dataset.sec === en.target.id); });
      });
    }, { rootMargin: "-25% 0px -60% 0px" });
    enlaces.forEach(function (a) {
      const sec = document.getElementById(a.dataset.sec);
      if (sec) observador.observe(sec);
    });
  }

  function conectarMenuCelular() {
    const shell = document.getElementById("shell");
    const boton = document.getElementById("btnMenuLateral");
    const fondo = document.getElementById("sbFondo");
    if (!shell || !boton) return;
    function poner(abierto) {
      shell.classList.toggle("sb-abierto", abierto);
      boton.setAttribute("aria-expanded", abierto ? "true" : "false");
      if (fondo) fondo.hidden = !abierto;
    }
    boton.addEventListener("click", function () { poner(!shell.classList.contains("sb-abierto")); });
    if (fondo) fondo.addEventListener("click", function () { poner(false); });
    document.querySelectorAll(".sb-item[data-sec], .sb-subitem[href]").forEach(function (a) {
      a.addEventListener("click", function () { poner(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && shell.classList.contains("sb-abierto")) poner(false);
    });
  }

  // El selector de mes de la cabecera reutiliza las pestañas de mes que ya
  // existen (#monthTabs): misma función, otro lugar
  function conectarSelectorMes() {
    const boton = document.getElementById("btnMesHero");
    const panel = document.getElementById("heroMesPanel");
    if (!boton || !panel) return;

    // El panel vivía dentro de la cabecera, que recorta lo que sobresale: por eso
    // se veía cortado y metido debajo de la foto. Se mueve al final de la página
    // y se coloca flotando justo debajo del botón, por encima de todo el contenido.
    document.body.appendChild(panel);
    if (!panel.querySelector(".mes-panel-cab")) {
      const cab = document.createElement("div");
      cab.className = "mes-panel-cab";
      cab.innerHTML = '<strong>Elige el mes</strong><span id="mesPanelNota"></span>';
      panel.insertBefore(cab, panel.firstChild);
    }

    function colocar() {
      const r = boton.getBoundingClientRect();
      const ancho = document.documentElement.clientWidth;
      panel.style.top = Math.round(r.bottom + 10) + "px";
      panel.style.right = Math.max(12, Math.round(ancho - r.right)) + "px";
    }
    function poner(abierto) {
      if (abierto) {
        const nota = document.getElementById("mesPanelNota");
        if (nota) nota.textContent = (typeof modoRegistro !== "undefined" && modoRegistro === "egresos" ? "Egresos" : "Ingresos") + " · el número indica cuántos registros hay";
        colocar();
      }
      panel.hidden = !abierto;
      boton.setAttribute("aria-expanded", abierto ? "true" : "false");
    }
    // Si la página se mueve o cambia de tamaño con el panel abierto, se cierra
    // (así nunca queda flotando lejos de su botón)
    window.addEventListener("scroll", function (e) {
      if (!panel.hidden && !panel.contains(e.target)) poner(false);
    }, true);
    window.addEventListener("resize", function () { if (!panel.hidden) colocar(); });
    boton.addEventListener("click", function (e) { e.stopPropagation(); poner(panel.hidden); });
    panel.addEventListener("click", function (e) {
      if (e.target.closest(".month-tab")) poner(false);
    });
    document.addEventListener("click", function (e) {
      if (!panel.hidden && !panel.contains(e.target)) poner(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) { poner(false); boton.focus(); }
    });
  }

  function conectarAvatar() {
    const campo = document.getElementById("inputAutorSesion");
    if (campo) campo.addEventListener("input", actualizarAvatar);
  }

  /* ======================================================================
     ARRANQUE
     ====================================================================== */
  if (typeof Chart !== "undefined") {
    Chart.defaults.font.family = '"Poppins", "Inter", sans-serif';
  }
  conectarMenuCelular();
  conectarSelectorMes();
  conectarAvatar();
  resaltarSeccionVisible();
  actualizarDashboard();

  window.actualizarDashboard = actualizarDashboard;
})();
