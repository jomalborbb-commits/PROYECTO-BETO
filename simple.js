/* ==========================================================================
   simple.js — Vista simple de las ventanas de análisis
   --------------------------------------------------------------------------
   Las tres ventanas («¿Mis ventas y pagos son parecidos?», «Estabilidad» y «Medidas de
   posición») abren en modo SIMPLE, pensado para quien no sabe estadística:
     · un solo gráfico principal,
     · una tarjeta «Conclusión» con qué se midió, el resultado y 2 o 3 líneas en
       palabras comunes, los meses en verde o rojo y qué hacer,
     · a la izquierda solo «Lo que entra / Lo que sale / Los dos» y el año.
   El botón «Más detalles» muestra todo lo demás: los otros gráficos, los
   cuadros de datos, los cálculos paso a paso, las tablas y los ajustes.

   Este archivo solo ordena qué se ve; no calcula nada ni toca tus datos.
   Cada ventana lo instala con VistaSimple.instalar(raiz, opciones) y le
   entrega su propio texto con VistaSimple.pintar(raiz, bloques).
   ========================================================================== */
(function () {
  "use strict";

  function esc(t) { return String(t === null || t === undefined ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  const ETIQUETAS = {
    ingresos: { texto: "Lo que entra", ayuda: "Ingresos: el dinero que entra por tus ventas." },
    egresos: { texto: "Lo que sale", ayuda: "Egresos: el dinero que sale en pagos y gastos." },
    ambos: { texto: "Los dos", ayuda: "Compara lo que entra con lo que sale. Por mes, muestra lo que te queda (ingresos − egresos)." },
  };

  /* opciones: {
       idEsencial,            id del contenedor de «Conclusión»
       mantener,              selector de los campos del panel que se ven en modo simple (además del de tipo)
       ayudas: [{sel, texto}] textos de ayuda que aparecen solo en «Más detalles»
       alAlternar(detalles)   la ventana vuelve a dibujarse
     } */
  function instalar(raiz, op) {
    raiz.classList.add("vm-simple");
    raiz._simple = op;

    // Panel izquierdo: en modo simple solo quedan el tipo y el año
    raiz.querySelectorAll(".vm-pestanas, [data-pagina='formato']").forEach(el => el.classList.add("vm-solo-detalle"));
    const pagina = raiz.querySelector("[data-pagina='analisis']");
    let primero = true;
    Array.from(pagina.children).forEach(ch => {
      if (primero && ch.classList.contains("vm-campo")) { primero = false; return; }
      if (op.mantener && ch.querySelector && ch.querySelector(op.mantener)) return;
      ch.classList.add("vm-solo-detalle");
    });
    const nota = document.createElement("p");
    nota.className = "vm-simple-nota vm-solo-simple";
    nota.textContent = "Aquí ves lo esencial. Toca «Más detalles» para ver todos los gráficos, los cálculos y los ajustes.";
    pagina.appendChild(nota);

    // Botones de tipo con palabras comunes
    raiz.querySelectorAll(".pj-tipo").forEach(b => {
      const e = ETIQUETAS[b.dataset.tipo === "comparar" ? "ambos" : b.dataset.tipo];
      if (!e) return;
      const i = b.querySelector("i");
      b.textContent = "";
      if (i) b.appendChild(i);
      b.appendChild(document.createTextNode(e.texto));
      b.title = e.ayuda;
    });

    // Ayudas de cada ajuste (se ven solo en «Más detalles»)
    (op.ayudas || []).forEach(a => {
      const el = raiz.querySelector(a.sel);
      if (!el) return;
      const campo = el.closest(".vm-campo, .vm-seccion") || el;
      const p = document.createElement("small");
      p.className = "vm-ayuda-campo";
      p.textContent = a.texto;
      campo.appendChild(p);
    });

    // Tarjeta «Conclusión» justo debajo del gráfico
    const centro = raiz.querySelector(".vm-centro");
    const tarjetas = Array.from(centro.querySelectorAll(":scope > .vm-tarjeta"));
    tarjetas.slice(1).forEach(t => t.classList.add("vm-solo-detalle"));
    const es = document.createElement("section");
    es.className = "vm-tarjeta vm-esencial vm-solo-simple";
    es.setAttribute("aria-label", "Lo esencial");
    es.innerHTML = '<h3>Conclusión</h3><div id="' + op.idEsencial + '" class="ve-cuerpo" aria-live="polite"></div>';
    tarjetas[0].insertAdjacentElement("afterend", es);

    // Botón «Más detalles»
    const acciones = tarjetas[0].querySelector(".vm-acciones");
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "vm-boton vm-boton-detalles";
    boton.setAttribute("data-simple", "alternar");
    boton.setAttribute("aria-expanded", "false");
    boton.innerHTML = 'Más detalles <span aria-hidden="true">▾</span>';
    acciones.appendChild(boton);
    boton.addEventListener("click", () => alternar(raiz));
  }

  function alternar(raiz, forzarSimple) {
    const op = raiz._simple || {};
    const simple = forzarSimple === undefined ? !raiz.classList.contains("vm-simple") : !!forzarSimple;
    raiz.classList.toggle("vm-simple", simple);
    const b = raiz.querySelector(".vm-boton-detalles");
    if (b) {
      b.setAttribute("aria-expanded", simple ? "false" : "true");
      b.innerHTML = simple ? 'Más detalles <span aria-hidden="true">▾</span>' : 'Ver menos <span aria-hidden="true">▴</span>';
    }
    if (typeof op.alAlternar === "function") op.alAlternar(!simple);
    const centro = raiz.querySelector(".vm-centro");
    if (centro && !forzarSimple) centro.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reiniciar(raiz) { if (raiz && raiz._simple) alternar(raiz, true); }
  function esSimple(raiz) { return !!raiz && raiz.classList.contains("vm-simple"); }

  /* ======================================================================
     TEXTO DE «CONCLUSIÓN»
     bloque: { titulo, mide, nivel: {texto, color}, lineas: [html], chips: [{texto, color, titulo}],
               chipsTitulo, consejo: html, nota: texto }
     ====================================================================== */
  function bloqueHtml(b) {
    let h = '<div class="ve-bloque" style="--c:' + (b.nivel ? b.nivel.color : "#8C4633") + '">';
    h += '<div class="ve-cab">' + (b.nivel ? '<span class="ve-nivel">' + esc(b.nivel.texto) + "</span>" : "") + '<strong class="ve-titulo">' + esc(b.titulo) + "</strong></div>";
    if (b.mide) h += '<p class="ve-mide"><b>Qué medimos:</b> ' + b.mide + "</p>";
    if (b.lineas && b.lineas.length) h += '<p class="ve-rotulo">Resultado</p><ul class="ve-lineas">' + b.lineas.map(l => "<li>" + l + "</li>").join("") + "</ul>";
    if (b.chips && b.chips.length) {
      h += (b.chipsTitulo ? '<p class="ve-chips-titulo">' + esc(b.chipsTitulo) + "</p>" : "") +
        '<div class="es-chips">' + b.chips.map(c => '<span class="es-chip' + (c.activo ? " es-chip-activo" : "") + '" style="--c:' + c.color + '"' + (c.titulo ? ' title="' + esc(c.titulo) + '"' : "") + "><b>" + esc(c.mes) + "</b> " + esc(c.texto) + "</span>").join("") + "</div>" +
        '<p class="ve-leyenda"><i style="background:#43A047"></i>verde = bueno <i style="background:#E0A100"></i>amarillo = regular <i style="background:#E53935"></i>rojo = malo</p>';
    }
    if (b.consejo) h += '<p class="ve-consejo"><b>Recomendación:</b> ' + b.consejo + "</p>";
    if (b.nota) h += '<p class="ve-nota">' + esc(b.nota) + "</p>";
    return h + "</div>";
  }

  function pintar(raiz, bloques) {
    const cont = raiz && raiz.querySelector(".ve-cuerpo");
    if (!cont) return;
    // Versión simple aprobada: veredicto, pocos datos precisos y una gráfica (mis-graficos.js)
    const simple = window.MisGraficos ? window.MisGraficos.conclusion(raiz) : "";
    if (simple) { cont.innerHTML = simple; return; }
    cont.innerHTML = bloques.map(bloqueHtml).join("") || '<p class="ve-nota">Todavía no hay datos suficientes. Importa tu Excel o registra ingresos y egresos.</p>';
  }

  /* ======================================================================
     GRÁFICOS MÁS CLAROS Y CON VOLUMEN
     embellecer(config) se aplica a los gráficos de las tres ventanas: las
     barras llevan degradé, esquinas redondeadas, una sombra suave y, si son
     pocas, su valor escrito encima (para no tener que adivinarlo). No cambia
     ningún dato ni cálculo.
     ====================================================================== */
  function aRgb(c) {
    if (typeof c !== "string") return null;
    let m = c.match(/^#([0-9a-f]{6})$/i);
    if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]; }
    m = c.match(/^#([0-9a-f]{3})$/i);
    if (m) { const h = m[1]; return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), 1]; }
    m = c.match(/^rgba?\(([^)]+)\)$/i);
    if (m) { const p = m[1].split(",").map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
    return null;
  }
  // Aclara (t > 0) u oscurece (t < 0) un color
  function mezcla(rgb, t) {
    const f = t >= 0 ? 255 : 0, k = Math.abs(t);
    return "rgba(" + rgb.slice(0, 3).map(v => Math.round(v + (f - v) * k)).join(",") + "," + rgb[3] + ")";
  }

  const pluginBello = {
    id: "veBello",
    beforeDatasetsDraw(chart, args, o) {
      if (!o || !o.activo) return;
      chart.ctx.save();
      chart.ctx.shadowColor = "rgba(60,30,20,0.22)";
      chart.ctx.shadowBlur = 8;
      chart.ctx.shadowOffsetY = 3;
    },
    afterDatasetsDraw(chart, args, o) {
      if (!o || !o.activo) return;
      chart.ctx.restore();
      if (!o.etiquetas) return;
      const ctx = chart.ctx;
      const horizontal = chart.options.indexAxis === "y";
      const escala = chart.scales[horizontal ? "x" : "y"];
      const formato = escala && escala.options && escala.options.ticks && typeof escala.options.ticks.callback === "function" ? escala.options.ticks.callback : (v => v);
      ctx.save();
      ctx.font = "700 10.5px Poppins, Inter, sans-serif";
      ctx.fillStyle = "#3B2F2A";
      chart.data.datasets.forEach((ds, di) => {
        if (!chart.isDatasetVisible(di) || (ds.type && ds.type !== "bar")) return;
        const meta = chart.getDatasetMeta(di);
        meta.data.forEach((el, i) => {
          const v = ds.data[i];
          if (typeof v !== "number" || !isFinite(v) || !el) return;
          const grosor = horizontal ? el.height : el.width;
          if (grosor < 16) return;
          const texto = String(formato(v, i, []));
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(255,255,255,0.92)";
          if (horizontal) { ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.strokeText(texto, el.x + 5, el.y); ctx.fillText(texto, el.x + 5, el.y); }
          else { ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.strokeText(texto, el.x, Math.min(el.y, el.base) - 4); ctx.fillText(texto, el.x, Math.min(el.y, el.base) - 4); }
        });
      });
      ctx.restore();
    },
  };
  if (typeof Chart !== "undefined") Chart.register(pluginBello);

  function embellecer(cfg) {
    try {
      if (!cfg || cfg.type !== "bar" || !cfg.data || !cfg.data.datasets) return cfg;
      const horizontal = !!(cfg.options && cfg.options.indexAxis === "y");
      let pocas = true;
      cfg.data.datasets.forEach(ds => {
        if (ds.type && ds.type !== "bar") return;
        const numeros = Array.isArray(ds.data) && ds.data.every(v => v === null || typeof v === "number");
        if (!numeros) pocas = false;
        else if (ds.data.length > 16) pocas = false;
        const base = ds.backgroundColor;
        const colores = Array.isArray(base) ? base : [base];
        const parseados = colores.map(aRgb);
        if (!parseados.length || parseados.some(x => !x)) return;
        ds.backgroundColor = function (c) {
          const a = c.chart.chartArea;
          const rgb = parseados[Array.isArray(base) ? c.dataIndex % parseados.length : 0];
          if (!a) return mezcla(rgb, 0);
          const g = horizontal ? c.chart.ctx.createLinearGradient(a.left, 0, a.right, 0) : c.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom);
          g.addColorStop(0, mezcla(rgb, 0.2));
          g.addColorStop(1, mezcla(rgb, -0.14));
          return g;
        };
        if (numeros && ds.borderRadius === undefined) ds.borderRadius = 7;
      });
      cfg.options = cfg.options || {};
      cfg.options.plugins = cfg.options.plugins || {};
      cfg.options.plugins.veBello = { activo: true, etiquetas: pocas };
    } catch (e) { /* si algo raro pasa, el gráfico se dibuja tal cual */ }
    return cfg;
  }

  window.VistaSimple = { instalar, alternar, reiniciar, esSimple, pintar, embellecer };
})();
