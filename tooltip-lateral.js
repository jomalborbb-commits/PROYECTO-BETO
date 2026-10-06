/* =========================================================
   CUADRO DE AYUDA DE LAS GRÁFICAS, A UN COSTADO (todas las gráficas)
   Al pasar el cursor por un punto o una barra, el cuadro negro de ayuda ya no
   se dibuja encima de lo que se está leyendo:
     1) si dentro de la gráfica hay un espacio vacío (sin líneas, barras ni
        textos) donde quepa, se pone ahí, lo más cerca posible del punto;
     2) si no, se pone al costado de la gráfica (derecha, izquierda, arriba o
        abajo, donde haya lugar en la pantalla), alineado con el punto.
   El punto elegido queda marcado con un anillo para saber de qué habla el cuadro.
   En las gráficas por meses, cada cifra muestra además su cambio frente al mes
   anterior; en las de torta, su parte del total.
   No cambia los datos ni lo que hace cada gráfica: solo dónde y cómo se ve la ayuda.
   ========================================================= */
(function () {
  if (typeof Chart === "undefined") return;

  // Alta resolución: todas las gráficas se dibujan con al menos el doble de píxeles (se ven nítidas)
  Chart.defaults.devicePixelRatio = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);

  const MESES = /^(ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)/i;
  const texto = l => String(Array.isArray(l) ? l.join(" ") : l == null ? "" : l).trim();
  const numero = v => (typeof v === "number" ? v : v && typeof v === "object" && typeof v.y === "number" ? v.y : null);

  // Dato extra de cada cifra: cambio frente al mes anterior (gráficas por meses) o parte del total (tortas)
  Chart.defaults.plugins.tooltip.callbacks.afterLabel = function (ctx) {
    try {
      const chart = ctx.chart;
      const tipo = ctx.dataset.type || chart.config.type;
      if (tipo === "doughnut" || tipo === "pie" || tipo === "polarArea") {
        const vals = ctx.dataset.data.map(numero).filter(v => v !== null && v > 0);
        const total = vals.reduce((s, v) => s + v, 0);
        const v = numero(ctx.raw);
        return total > 0 && v > 0 ? (v / total * 100).toFixed(1) + "% del total" : "";
      }
      const labels = chart.data.labels || [];
      const i = ctx.dataIndex;
      if (i < 1 || !MESES.test(texto(labels[i])) || !MESES.test(texto(labels[i - 1]))) return "";
      const actual = numero(ctx.raw), antes = numero(ctx.dataset.data[i - 1]);
      if (actual === null || antes === null || !(antes > 0) || actual < 0) return "";
      const v = (actual - antes) / antes * 100;
      return (v >= 0 ? "▲ +" : "▼ −") + Math.abs(v).toFixed(1) + "% vs " + texto(labels[i - 1]).toLowerCase();
    } catch (e) { return ""; }
  };

  /* ---------- El cuadro (uno solo para toda la página) ---------- */
  let caja = null;
  function cuadro() {
    if (caja) return caja;
    caja = document.createElement("div");
    caja.className = "ayuda-grafica";
    caja.setAttribute("role", "tooltip");
    caja.hidden = true;
    document.body.appendChild(caja);
    return caja;
  }
  let dueño = null;
  function ocultar(chart) {
    if (!caja || (chart && dueño !== chart)) return;
    caja.hidden = true;
    caja.classList.remove("visible");
    if (dueño) dueño.$ayudaVisible = false;
    dueño = null;
  }
  window.addEventListener("scroll", () => ocultar(), true);
  window.addEventListener("resize", () => ocultar());

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function contenido(tip) {
    const h = [];
    (tip.title || []).forEach(t => { if (t) h.push('<p class="ag-titulo">' + esc(t) + "</p>"); });
    (tip.beforeBody || []).forEach(t => { if (t) h.push('<p class="ag-nota">' + esc(t) + "</p>"); });
    (tip.body || []).forEach((b, i) => {
      const col = tip.labelColors && tip.labelColors[i] ? tip.labelColors[i] : {};
      const fondo = typeof col.backgroundColor === "string" ? col.backgroundColor : typeof col.borderColor === "string" ? col.borderColor : "#fff";
      (b.before || []).forEach(t => { if (t) h.push('<p class="ag-nota">' + esc(t) + "</p>"); });
      (b.lines || []).forEach((t, k) => {
        if (!t) return;
        // El dato extra (cambio frente al mes anterior o % del total) va junto a la cifra principal
        const extra = k === 0 ? (b.after || []).filter(Boolean).join(" · ") : "";
        h.push('<p class="ag-fila">' + (k === 0 ? '<i style="background:' + esc(fondo) + '"></i>' : "<i></i>") + "<span>" + esc(String(t).trim()) + "</span>" +
          (extra ? "<em>" + esc(extra) + "</em>" : "") + "</p>");
      });
    });
    (tip.afterBody || []).forEach(t => { if (t && String(t).trim()) h.push('<p class="ag-nota">' + esc(String(t).trim()) + "</p>"); });
    (tip.footer || []).forEach(t => { if (t) h.push('<p class="ag-nota">' + esc(t) + "</p>"); });
    return h.join("");
  }

  /* ---------- Dónde hay espacio vacío dentro de la gráfica ---------- */
  const CELDA = 4;
  function mapaDeTinta(chart) {
    const lienzo = chart.canvas, r = chart.currentDevicePixelRatio || 1;
    const W = lienzo.width, H = lienzo.height;
    if (!W || !H) return null;
    let img;
    try { img = chart.ctx.getImageData(0, 0, W, H).data; } catch (e) { return null; }
    const cw = Math.ceil(chart.width / CELDA), ch = Math.ceil(chart.height / CELDA);
    const suma = new Float32Array((cw + 1) * (ch + 1));
    const paso = Math.max(1, Math.round(r * 2));
    for (let cy = 0; cy < ch; cy++) {
      let fila = 0;
      for (let cx = 0; cx < cw; cx++) {
        let tinta = 0;
        const x0 = Math.floor(cx * CELDA * r), y0 = Math.floor(cy * CELDA * r);
        for (let dy = 0; dy < CELDA * r; dy += paso) {
          for (let dx = 0; dx < CELDA * r; dx += paso) {
            const px = x0 + dx, py = y0 + dy;
            if (px >= W || py >= H) continue;
            const k = (py * W + px) * 4;
            if (img[k + 3] < 40) continue;
            const luz = (img[k] + img[k + 1] + img[k + 2]) / 3;
            tinta += luz > 232 ? 0.1 : luz > 205 ? 0.5 : 1;   // líneas guía muy claras casi no cuentan
          }
        }
        fila += tinta;
        suma[(cy + 1) * (cw + 1) + (cx + 1)] = suma[cy * (cw + 1) + (cx + 1)] + fila;
      }
    }
    return { suma, cw, ch };
  }
  function tintaEn(m, x, y, w, h) {
    const x1 = Math.max(0, Math.floor(x / CELDA)), y1 = Math.max(0, Math.floor(y / CELDA));
    const x2 = Math.min(m.cw, Math.ceil((x + w) / CELDA)), y2 = Math.min(m.ch, Math.ceil((y + h) / CELDA));
    if (x2 <= x1 || y2 <= y1) return 0;
    const S = m.suma, c = m.cw + 1;
    return S[y2 * c + x2] - S[y1 * c + x2] - S[y2 * c + x1] + S[y1 * c + x1];
  }

  // Lugar dentro de la gráfica: solo si está realmente vacío
  function lugarAdentro(chart, px, py, w, h) {
    const W = chart.width, H = chart.height, m = 4;
    if (w + 2 * m > W || h + 2 * m > H) return null;
    const mapa = mapaDeTinta(chart);
    if (!mapa) return null;
    const limite = (w * h) / (CELDA * CELDA) * 0.06;   // hasta ~6% de tinta suelta (rótulos de ejes lejanos, etc.)
    let mejor = null;
    for (let y = m; y <= H - h - m; y += 6) {
      for (let x = m; x <= W - w - m; x += 6) {
        if (!(px < x - 14 || px > x + w + 14 || py < y - 14 || py > y + h + 14)) continue;   // nunca encima del punto
        const t = tintaEn(mapa, x, y, w, h);
        if (t > limite) continue;
        const dx = Math.max(x - px, 0, px - (x + w)), dy = Math.max(y - py, 0, py - (y + h));
        const costo = Math.sqrt(dx * dx + dy * dy) + t * 2;
        if (!mejor || costo < mejor.costo) mejor = { x, y, costo };
      }
    }
    return mejor;
  }

  // Lugar al costado de la gráfica, dentro de la pantalla
  function lugarAfuera(rect, px, py, w, h) {
    const vw = window.innerWidth, vh = window.innerHeight, m = 8, sep = 12;
    const enY = Math.min(Math.max(py - h / 2, m), vh - h - m);
    const enX = Math.min(Math.max(px - w / 2, m), vw - w - m);
    const opciones = [
      { x: rect.right + sep, y: enY, lado: "der" },
      { x: rect.left - w - sep, y: enY, lado: "izq" },
      { x: enX, y: rect.top - h - sep, lado: "arr" },
      { x: enX, y: rect.bottom + sep, lado: "aba" },
    ].filter(o => o.x >= m && o.x + w <= vw - m && o.y >= m && o.y + h <= vh - m);
    if (!opciones.length) return null;
    opciones.forEach(o => { const dx = Math.max(o.x - px, 0, px - (o.x + w)), dy = Math.max(o.y - py, 0, py - (o.y + h)); o.d = Math.sqrt(dx * dx + dy * dy); });
    opciones.sort((a, b) => a.d - b.d);
    return opciones[0];
  }

  const plugin = {
    id: "ayudaAlCostado",
    beforeTooltipDraw(chart, args) {
      const tip = args.tooltip;
      if (!tip || !tip.options || tip.options.enabled === false) return;
      if (!tip.opacity || !(tip.body || []).length) { ocultar(chart); return false; }
      const div = cuadro();
      const act = tip.getActiveElements ? tip.getActiveElements() : [];
      const clave = act.map(a => a.datasetIndex + ":" + a.index).join(",") + "|" + chart.width + "x" + chart.height;
      const rect = chart.canvas.getBoundingClientRect();
      if (chart.$ayudaClave !== clave || dueño !== chart || div.hidden) {
        chart.$ayudaClave = clave;
        div.innerHTML = contenido(tip);
        div.className = "ayuda-grafica";
        div.hidden = false;
        div.style.left = "-9999px"; div.style.top = "0px";
        const w = div.offsetWidth, h = div.offsetHeight;
        const px = tip.caretX, py = tip.caretY;
        const adentro = lugarAdentro(chart, px, py, w, h);
        let x, y, lado = "";
        if (adentro) { x = rect.left + adentro.x; y = rect.top + adentro.y; lado = "adentro"; }
        else {
          const afuera = lugarAfuera(rect, rect.left + px, rect.top + py, w, h);
          if (afuera) { x = afuera.x; y = afuera.y; lado = afuera.lado; }
          else { x = Math.min(Math.max(rect.left + px + 16, 8), window.innerWidth - w - 8); y = Math.min(Math.max(rect.top + py - h - 16, 8), window.innerHeight - h - 8); }
        }
        div.style.left = Math.round(x) + "px";
        div.style.top = Math.round(y) + "px";
        div.classList.add("visible", "ag-" + (lado || "libre"));
        dueño = chart;
        chart.$ayudaVisible = true;
      }
      return false;   // el cuadro de Chart.js no se dibuja: se muestra el de la página
    },
    afterEvent(chart, args) {
      const e = args.event;
      if (e.type === "mouseout" || (chart.tooltip && !(chart.tooltip.getActiveElements ? chart.tooltip.getActiveElements() : []).length)) ocultar(chart);
    },
    afterDraw(chart) {
      // Anillo en el punto elegido, para saber de qué punto habla el cuadro
      const tip = chart.tooltip;
      if (!chart.$ayudaVisible || dueño !== chart || !tip || !tip.opacity) return;
      const act = tip.getActiveElements ? tip.getActiveElements() : [];
      const c = chart.ctx;
      c.save();
      c.strokeStyle = "rgba(43,33,28,0.75)";
      c.lineWidth = 1.5;
      act.forEach(a => {
        const el = a.element;
        if (!el || typeof el.tooltipPosition !== "function") return;
        // Solo puntos (líneas y dispersión); en barras y tortas ya se resalta la figura entera
        if (el.width !== undefined || el.outerRadius !== undefined) return;
        const p = el.tooltipPosition(true);
        if (!p || !isFinite(p.x) || !isFinite(p.y)) return;
        c.beginPath(); c.arc(p.x, p.y, 8, 0, Math.PI * 2); c.stroke();
      });
      c.restore();
    },
    afterDestroy(chart) { ocultar(chart); },
  };
  Chart.register(plugin);
})();
