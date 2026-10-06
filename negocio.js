/* ==========================================================================
   negocio.js — El panel de un vistazo: ¿cómo va mi empresa?
   --------------------------------------------------------------------------
   1. Los 5 indicadores de arriba (#dbKpis): ganancia o pérdida del mes, lo
      que falta para no perder, ventas y gastos del mes (con su posición
      frente a los demás meses) y clientes clave.
   2. La fila de 3 gráficas: «Resultado del mes», «Cobertura de egresos» y
      «Concentración de clientes». Cada una dice qué muestra y qué lee hoy.
   3. «Salud de tu negocio»: «Punto de equilibrio operativo», «Estructura de
      egresos» y «Ranking anual de clientes».
   Todo sale de analitica.js (la misma fuente de las ventanas), así que las
   cifras coinciden en todas partes. Es de SOLO LECTURA sobre tus datos.
   dashboard.js llama a actualizarNegocio() cada vez que se redibuja.
   ========================================================================== */
(function () {
  "use strict";

  const A = () => window.Analitica;
  const graficos = {};
  let vistaPlata = "mes";          // (ya no se usa) antes «Mes / Todo el año» en la estructura de egresos
  let categoriaAbierta = null;     // categoría con su detalle abierto
  const SIN_HOVER = window.matchMedia ? window.matchMedia("(hover: none)").matches : false;

  // Colores de reposo (suaves) y vivos (al pasar el cursor) de cada gráfica
  const COL = {
    gana: { vivo: "#16A34A", suave: "rgba(22,163,74,0.38)" },
    pierde: { vivo: "#DC2626", suave: "rgba(220,38,38,0.36)" },
    ingreso: { vivo: "#2563EB", suave: "#9DB8F0" },
    egreso: { vivo: "#F97316", suave: "#F8C39B" },
    clave: { vivo: "#7C3AED", suave: "#C9B8F5" },
    resto: { vivo: "#F59E0B", suave: "#F6DC9C" },
  };

  // Sombra suave debajo del dibujo de los círculos de «Mis gráficos» (da volumen); más marcada con el cursor encima
  if (typeof Chart !== "undefined") {
    Chart.register({
      id: "ngSombraMedallon",
      beforeDatasetsDraw(chart) {
        if (!chart.canvas || !/^miniChart/.test(chart.canvas.id)) return;
        const c = chart.ctx;
        c.save();
        const vivo = chart.$modo === "color";
        c.shadowColor = vivo ? "rgba(40,20,10,0.36)" : "rgba(40,20,10,0.07)";
        c.shadowBlur = vivo ? 7 : 2;
        c.shadowOffsetY = vivo ? 4 : 1;
      },
      afterDatasetsDraw(chart) {
        if (!chart.canvas || !/^miniChart/.test(chart.canvas.id)) return;
        chart.ctx.restore();
      },
    });
  }

  /* ======================================================================
     UTILIDADES
     ====================================================================== */
  function esc(t) { return String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function num(v, d) { return Number(v || 0).toLocaleString("es-PE", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function soles(v) { return v === null || v === undefined || isNaN(v) ? "—" : (v < 0 ? "−S/ " : "S/ ") + num(Math.abs(v)); }
  function solesC(v) { return v === null || v === undefined || isNaN(v) ? "—" : (v < 0 ? "−" : "") + formatearMonedaCompacta(Math.abs(v)); }
  function solesU(v) { return v === null || v === undefined || isNaN(v) ? "—" : "S/ " + Number(v).toLocaleString("es-PE", { minimumFractionDigits: 3, maximumFractionDigits: 3 }); }
  function signo(v) { return v > 0 ? "+" + soles(v) : soles(v); }
  function signoC(v) { return v > 0 ? "+" + solesC(v) : solesC(v); }
  function pct(v, d) { return v === null || v === undefined || isNaN(v) ? "—" : Number(v).toLocaleString("es-PE", { maximumFractionDigits: d === undefined ? 0 : d }) + "%"; }
  function aRgba(hex, a) {
    const n = parseInt(hex.replace("#", ""), 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }
  function corto(t, n) { t = String(t || ""); return t.length > n ? t.slice(0, n - 1) + "…" : t; }
  function titulo(t) { return String(t || "").toLowerCase().replace(/(^|\s)\S/g, s => s.toUpperCase()); }
  function sinMovimiento() { return typeof reducirMovimiento === "function" && reducirMovimiento(); }

  const ICONOS = {
    ganancia: '<path d="M3 17.5l5.5-5.5 4 4L21 7.5"/><path d="M15 7.5h6v6"/><path d="M3 21h18"/>',
    meta: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.2"/><path d="M19.5 4.5 13 11"/>',
    ventas: '<rect x="3" y="4" width="8" height="5" rx="1"/><rect x="13" y="4" width="8" height="5" rx="1"/><rect x="3" y="11" width="4.5" height="5" rx="1"/><rect x="9.5" y="11" width="8" height="5" rx="1"/><rect x="3" y="18" width="8" height="3" rx="1"/><rect x="13" y="18" width="8" height="3" rx="1"/>',
    gastos: '<rect x="3" y="6.5" width="18" height="13" rx="2.2"/><path d="M3 10.5h18"/><path d="M15.5 15h2.5"/><path d="M7.5 6.5 9 3.5h6l1.5 3"/>',
    clientes: '<circle cx="9" cy="8" r="3.4"/><path d="M2.8 20c.8-3.6 3.3-5.6 6.2-5.6s5.4 2 6.2 5.6"/><path d="m17.8 4.2.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z"/>',
    balanza: '<path d="M12 3.5v17"/><path d="M5 7h14"/><path d="M8 20.5h8"/><path d="M5 7 2.5 13a2.8 2.8 0 0 0 5 0z"/><path d="M19 7l-2.5 6a2.8 2.8 0 0 0 5 0z"/>',
    plata: '<ellipse cx="9" cy="6.5" rx="5.5" ry="2.5"/><path d="M3.5 6.5v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4"/><path d="M3.5 10.5v4c0 1.4 2.5 2.5 5.5 2.5 1 0 2-.1 2.8-.4"/><path d="M15 14.5h6"/><path d="m18.5 12 2.5 2.5-2.5 2.5"/>',
    calendario: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  };
  function icono(n) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONOS[n] || "") + "</svg>"; }

  // Mini gráfica de línea (SVG) para las tarjetas de arriba
  function spark(valores, color) {
    const v = valores.map(x => (x === null || x === undefined || isNaN(x) ? 0 : x));
    const n = v.length;
    if (n < 2) return '<svg class="k5-spark" viewBox="0 0 90 34" aria-hidden="true"></svg>';
    const max = Math.max.apply(null, v), min = Math.min.apply(null, v);
    const rango = max - min || 1;
    const puntos = v.map((x, i) => ((i / (n - 1)) * 88 + 1).toFixed(1) + "," + (32 - ((x - min) / rango) * 26 - 2).toFixed(1));
    return '<svg class="k5-spark" viewBox="0 0 90 34" aria-hidden="true" preserveAspectRatio="none">' +
      '<polygon points="1,33 ' + puntos.join(" ") + ' 89,33" fill="' + aRgba(color, 0.16) + '"/>' +
      '<polyline points="' + puntos.join(" ") + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }

  function chip(texto, color, titulo) {
    return '<span class="k5-chip ng-chip" style="--c:' + color + '"' + (titulo ? ' title="' + esc(titulo) + '"' : "") + ">" + texto + "</span>";
  }

  /* ======================================================================
     GRÁFICOS: se crean una vez y luego solo cambian sus datos. Cada serie
     trae dos trajes de color ($reposo y $vivo); el cursor elige cuál.
     ====================================================================== */
  function pintarModo(g, modo) {
    g.data.datasets.forEach(ds => { const c = modo === "vivo" ? ds.$vivo : ds.$reposo; if (c) Object.assign(ds, c); });
  }

  function asegurar(clave, canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === "undefined") return null;
    let g = graficos[clave];
    if (g && g.canvas !== canvas) { g.destroy(); g = null; }
    if (g && g.config.type === config.type) {
      g.data = config.data;
      g.options = config.options;
      pintarModo(g, g.$modo);
      g.update();
      ajustarTamano(g);
      return g;
    }
    if (g) g.destroy();
    const modo = SIN_HOVER ? "vivo" : "reposo";
    config.data.datasets.forEach(ds => { const c = modo === "vivo" ? ds.$vivo : ds.$reposo; if (c) Object.assign(ds, c); });
    g = new Chart(canvas, config);
    g.$modo = modo;
    graficos[clave] = g;
    ajustarTamano(g);
    return g;
  }

  // Un gráfico creado dentro de algo oculto queda con tamaño 0: se corrige al mostrarse
  function ajustarTamano(g) {
    if (g.canvas.width > 0 && g.canvas.clientWidth > 0) return;
    requestAnimationFrame(() => { try { g.resize(); } catch (e) { /* el gráfico ya no existe */ } });
  }

  function cambiarModo(clave, modo) {
    const g = graficos[clave];
    if (!g || SIN_HOVER || g.$modo === modo) return;
    g.$modo = modo;
    pintarModo(g, modo);
    if (modo === "vivo" && !sinMovimiento()) g.reset();
    g.update(sinMovimiento() ? "none" : undefined);
  }

  function opcionesBase() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 850, easing: "easeOutQuart" },
      plugins: { legend: { display: false }, tooltip: { padding: 10, bodySpacing: 3, titleFont: { size: 12.5 }, bodyFont: { size: 12 } } },
    };
  }

  function ejeSoles(extra) {
    return Object.assign({
      grid: { color: "#EFE6DA" },
      border: { display: false },
      ticks: { color: "#8A7A70", font: { size: 10.5 }, callback: v => formatearMonedaCompacta(v) },
    }, extra || {});
  }

  // Rótulos con borde blanco para leerse sobre cualquier color
  function rotulo(ctx, texto, x, y, color, alinear) {
    ctx.textAlign = alinear || "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.fillStyle = color;
    ctx.strokeText(texto, x, y);
    ctx.fillText(texto, x, y);
  }

  const pluginRotulos = {
    id: "ngRotulos",
    afterDatasetsDraw(chart, args, o) {
      if (!o || !o.tipo) return;
      const ctx = chart.ctx, a = chart.chartArea, y = chart.scales.y, x = chart.scales.x;
      ctx.save();
      ctx.font = "600 10.5px Poppins, Inter, sans-serif";

      if (o.tipo === "ganancia") {
        const y0 = y.getPixelForValue(0);
        ctx.strokeStyle = "#5A4A40"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(a.left, y0); ctx.lineTo(a.right, y0); ctx.stroke();
        const meta = chart.getDatasetMeta(0);
        chart.data.datasets[0].data.forEach((v, i) => {
          if (v === null || v === undefined) return;
          const bar = meta.data[i];
          if (!bar) return;
          // En pantallas angostas solo se rotula el mes elegido, para que no se encimen
          if (bar.width < 30 && i !== o.sel) return;
          ctx.textBaseline = v >= 0 ? "bottom" : "top";
          rotulo(ctx, signoC(v), bar.x, v >= 0 ? bar.y - 3 : bar.y + 3, v >= 0 ? "#166534" : "#991B1B");
        });
      }

      if (o.tipo === "meta") {
        const yy = y.getPixelForValue(o.valor);
        if (yy >= a.top && yy <= a.bottom) {
          ctx.strokeStyle = "#032440"; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
          ctx.beginPath(); ctx.moveTo(a.left, yy); ctx.lineTo(a.right, yy); ctx.stroke();
          ctx.setLineDash([]);
          ctx.textBaseline = "bottom";
          rotulo(ctx, o.texto, a.right - 2, yy - 3, "#032440", "right");
        }
      }

      if (o.tipo === "brecha") {
        const i = o.sel;
        const vi = o.ing[i], ve = o.egr[i];
        const met = chart.getDatasetMeta(0).data[i];
        if (vi !== null && vi !== undefined && ve !== null && ve !== undefined && met) {
          const yy = (y.getPixelForValue(vi) + y.getPixelForValue(ve)) / 2;
          const d = vi - ve;
          ctx.font = "700 11px Poppins, Inter, sans-serif";
          ctx.textBaseline = "middle";
          rotulo(ctx, signoC(d), met.x, yy, d >= 0 ? "#166534" : "#991B1B");
        }
      }

      if (o.tipo === "cascada") {
        const meta = chart.getDatasetMeta(0);
        const d = chart.data.datasets[0].data;
        const y0 = y.getPixelForValue(0);
        ctx.strokeStyle = "#5A4A40"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(a.left, y0); ctx.lineTo(a.right, y0); ctx.stroke();
        // conectores punteados: el final de cada barra es el comienzo de la siguiente
        ctx.strokeStyle = "#9C8B7E"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        let previo = -1;
        for (let i = 0; i < d.length; i++) {
          if (!d[i]) continue;
          if (previo >= 0 && meta.data[previo] && meta.data[i]) {
            const b0 = meta.data[previo], b1 = meta.data[i];
            const yy = y.getPixelForValue(d[previo][1]);
            ctx.beginPath(); ctx.moveTo(b0.x + b0.width / 2, yy); ctx.lineTo(b1.x - b1.width / 2, yy); ctx.stroke();
          }
          previo = i;
        }
        ctx.setLineDash([]);
        d.forEach((par, i) => {
          if (!par) return;
          const bar = meta.data[i];
          if (!bar) return;
          const v = o.valores[i];
          // si el rótulo no cabe entre una barra y la siguiente, solo se escribe el del mes elegido y el del total
          const paso = meta.data.length > 1 ? Math.abs(meta.data[1].x - meta.data[0].x) : 999;
          if (ctx.measureText(signoC(v)).width + 4 > paso && i !== o.sel && i !== 12) return;
          ctx.textBaseline = "bottom";
          rotulo(ctx, signoC(v), bar.x, Math.min(bar.y, bar.base) - 3, i === 12 ? "#1E293B" : v >= 0 ? "#166534" : "#991B1B");
        });
      }

      if (o.tipo === "clientes" || o.tipo === "plata") {
        // Nombre encima de cada barra (a la izquierda) y su monto a la derecha:
        // así nada se corta aunque la tarjeta sea angosta
        const meta = chart.getDatasetMeta(0);
        ctx.textBaseline = "bottom";
        chart.data.datasets[0].data.forEach((v, i) => {
          const bar = meta.data[i];
          if (!bar) return;
          const yy = bar.y - bar.height / 2 - 2;
          const valor = o.tipo === "plata" ? pct(o.pcts[i]) + " · " + solesC(v) : solesC(v) + " · " + pct(o.pcts[i]);
          ctx.font = "600 10.5px Poppins, Inter, sans-serif";
          const anchoValor = ctx.measureText(valor).width;
          ctx.textAlign = "right";
          ctx.fillStyle = "#3B2F2A";
          ctx.fillText(valor, a.right, yy);
          ctx.font = "500 10.5px Poppins, Inter, sans-serif";
          let nombre = o.nombres[i] || "";
          const libre = a.right - a.left - anchoValor - 10;
          while (nombre.length > 3 && ctx.measureText(nombre).width > libre) nombre = nombre.slice(0, -2).trimEnd() + "…";
          ctx.textAlign = "left";
          ctx.fillStyle = "#4A3C35";
          ctx.fillText(nombre, a.left, yy);
        });
      }

      if (o.tipo === "equilibrio" && o.referencia) {
        const yy = y.getPixelForValue(o.referencia);
        if (yy >= a.top && yy <= a.bottom) {
          ctx.strokeStyle = "#1E3A8A"; ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]);
          ctx.beginPath(); ctx.moveTo(a.left, yy); ctx.lineTo(a.right, yy); ctx.stroke();
          ctx.setLineDash([]);
          ctx.textBaseline = "bottom";
          rotulo(ctx, "mes normal: " + num(o.referencia) + " lad.", a.right - 2, yy - 3, "#1E3A8A", "right");
        }
      }

      if (o.tipo === "pareto") {
        const y2 = chart.scales.y2;
        const yy = y2.getPixelForValue(80);
        ctx.strokeStyle = "#37474F"; ctx.lineWidth = 1.3; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(a.left, yy); ctx.lineTo(a.right, yy); ctx.stroke();
        ctx.setLineDash([]);
        ctx.textBaseline = "bottom";
        rotulo(ctx, "80% de tus ventas", a.left + 4, yy - 3, "#37474F", "left");
      }
      ctx.restore();
    },
  };

  /* ======================================================================
     CONTEXTO: el mes elegido en el sistema y el año que se analiza
     ====================================================================== */
  function contexto() {
    const an = A();
    const mes = typeof mesActual === "number" && mesActual >= 0 && mesActual <= 11 ? mesActual : new Date().getMonth();
    const anio = an.anioParaMes(mes);   // el año del mes elegido (o el último con datos)
    const resumen = an.resumenAnio(anio);
    const pe = an.puntoEquilibrio(anio);
    return {
      an, anio, mes, resumen, pe,
      r: resumen.meses[mes],
      ant: mes > 0 ? resumen.meses[mes - 1] : null,
      eq: an.equilibrioDelMes(anio, mes, pe),
      ultimo: an.ultimoMesConDatos(anio),
      nombreMes: an.MESES_TITULO[mes],
      desde: Math.max(0, mes - 5),
    };
  }

  function nombreDe(ctx, m) { return ctx.an.MESES_TITULO[m]; }
  function cortoDe(ctx, m) { return ctx.an.MESES_CORTOS[m]; }

  /* ======================================================================
     AVISO: el mes elegido no tiene datos
     ====================================================================== */
  function pintarAviso(ctx) {
    const cont = document.getElementById("dbAvisoMes");
    if (!cont) return;
    if (ctx.r.hayDatos || ctx.ultimo < 0 || ctx.ultimo === ctx.mes) { cont.hidden = true; cont.innerHTML = ""; return; }
    cont.hidden = false;
    cont.innerHTML = '<span class="ng-aviso-ico">' + icono("calendario") + "</span>" +
      "<p><b>" + esc(ctx.nombreMes + " " + ctx.anio) + "</b> todavía no tiene ingresos ni egresos registrados: por eso los indicadores del mes están vacíos. Tu último mes con datos es <b>" + esc(nombreDe(ctx, ctx.ultimo).toLowerCase()) + "</b>.</p>" +
      '<button type="button" class="ng-aviso-boton" data-ir-mes="' + ctx.ultimo + '">Ver ' + esc(nombreDe(ctx, ctx.ultimo).toLowerCase()) + " →</button>";
  }

  /* ======================================================================
     1. MAPA DE MI NEGOCIO (la esfera de arriba, la dibuja esfera.js)
        2 entradas (ingresos y egresos) → veredicto del mes → 5 salidas
     ====================================================================== */
  const BR = { bueno: "#4ADE80", regular: "#FBBF24", malo: "#FB7185", gris: "#CBD5E1", azul: "#93C5FD" };
  const BR_CLAVE = { favorable: BR.bueno, atencion: BR.regular, enCurso: BR.regular, faltan: BR.regular, riesgo: BR.malo, sinDatos: BR.gris };

  // Chip de variación frente al mes anterior (menosEsMejor: en los gastos bajar es lo bueno)
  function chipVar(actual, previo, menosEsMejor, nomAnt, enCurso) {
    if (enCurso) return { texto: "mes en curso", color: BR.regular, titulo: "Todavía faltan registros de este mes" };
    if (!(previo > 0)) return null;
    const v = ((actual - previo) / previo) * 100;
    const sube = v >= 0;
    const bueno = menosEsMejor ? !sube : sube;
    return { texto: (sube ? "▲ " : "▼ ") + Math.abs(Math.round(v)) + "% vs " + nomAnt, color: Math.abs(v) < 1 ? BR.regular : bueno ? BR.bueno : BR.malo };
  }

  function datosEsfera(ctx) {
    const an = ctx.an, r = ctx.r, ant = ctx.ant, eq = ctx.eq;
    const nomAnt = ant ? nombreDe(ctx, ant.mes).toLowerCase().slice(0, 3) : "";
    const completo = r.hayIng && r.hayEgr;
    const gano = r.resultado >= 0;
    const salud = an.saludDelMes(ctx.anio, ctx.mes);
    const antIng = ant && ant.hayIng && !ant.incompletoIng ? ant.ingresos : 0;
    const antEgr = ant && ant.hayEgr && !ant.incompletoEgr ? ant.egresos : 0;

    const ing = {
      clave: "ing", titulo: "Ingresos", valor: r.hayIng ? soles(r.ingresos) : "—",
      sub: r.hayIng ? r.nIng + (r.nIng === 1 ? " venta" : " ventas") + " · " + num(r.unidades) + " ladrillos" : "sin ingresos este mes",
      chip: r.hayIng ? chipVar(r.ingresos, antIng, false, nomAnt, r.incompletoIng) : null,
    };
    const egr = {
      clave: "egr", titulo: "Egresos", valor: r.hayEgr ? soles(r.egresos) : "—",
      sub: r.hayEgr ? r.nEgr + (r.nEgr === 1 ? " pago" : " pagos") : "sin egresos este mes",
      chip: r.hayEgr ? chipVar(r.egresos, antEgr, true, nomAnt, r.incompletoEgr) : null,
    };

    // --- Las 5 salidas, en el orden de la página. Cada una dice algo distinto (sin datos repetidos) ---
    // 1. Ventas del mes (tarjeta «Resultado del mes»)
    const ven = { clave: "ven", titulo: "Ventas brutas del mes", valor: r.hayIng ? soles(r.ingresos) : "—", sub: r.hayIng ? "" : "sin ventas este mes", chip: null };
    if (r.hayIng) {
      ven.chip = chipVar(r.ingresos, antIng, false, nomAnt, r.incompletoIng);
      ven.sub = antIng > 0 ? signo(r.ingresos - antIng) + " frente a " + nombreDe(ctx, ant.mes).toLowerCase() : r.nIng + (r.nIng === 1 ? " venta" : " ventas");
    }
    // 2. Resultado mes a mes (tarjeta «Resultado mes a mes»)
    const res = { clave: "res", titulo: "Resultado neto mes a mes", valor: "—", sub: r.hayIng ? "faltan los egresos del mes" : r.hayEgr ? "faltan los ingresos del mes" : "sin datos este mes", chip: null };
    if (completo) {
      const acum = ctx.resumen.meses.filter(x => x.hayIng && x.hayEgr).reduce((s, x) => s + x.resultado, 0);
      res.valor = signo(r.resultado);
      res.colorValor = gano ? BR.bueno : BR.malo;
      res.sub = "acumulado " + signo(acum);
      res.chip = r.incompleto ? { texto: gano ? "Vas ganando" : "Vas perdiendo", color: BR.regular, titulo: "El mes todavía no termina" } : { texto: gano ? "Ganaste" : "Perdiste", color: gano ? BR.bueno : BR.malo };
    }
    // 3. Concentración de clientes
    const cl = an.clientesDe(ctx.anio, ctx.mes);
    const dep = an.dependencia(cl.cantidad ? cl.top5 : null);
    const cli = { clave: "cli", titulo: "Concentración de clientes", valor: "—", sub: "sin ventas este mes", chip: null };
    if (cl.cantidad) {
      cli.valor = pct(cl.top5);
      cli.sub = cl.cantidad > 5 ? "5 de " + cl.cantidad + " clientes" : "tus " + cl.cantidad + " clientes";
      cli.chip = { texto: dep.texto, color: dep.clave === "bueno" ? BR.bueno : dep.clave === "regular" ? BR.regular : BR.malo, titulo: dep.frase };
    }
    // 4. Punto de equilibrio (qué parte de tus egresos pagan tus ingresos)
    const equ = { clave: "equ", titulo: "Punto de equilibrio", valor: "—", sub: completo ? "" : "registra ingresos y egresos del mes", chip: null };
    if (completo && r.egresos > 0) {
      const cubre = r.cobertura >= 100;
      equ.valor = pct(r.cobertura);
      equ.colorValor = cubre ? BR.bueno : BR.malo;
      equ.chip = { texto: cubre ? "Cubres tus egresos" : "No cubres tus egresos", color: cubre ? BR.bueno : BR.malo, titulo: "Tus ingresos ÷ tus egresos del mes" };
      equ.sub = eq.disponible ? (eq.alcanzado ? "sobran ≈ " + num(eq.sobraLadrillos) + " ladrillos" : "faltan ≈ " + num(Math.ceil(eq.faltaLadrillos)) + " ladrillos") : (cubre ? "" : "faltan " + soles(r.egresos - r.ingresos));
    }
    // 5. Estructura de egresos
    const g = an.gastosPorCategoria(ctx.anio, ctx.mes);
    const top = g.categorias[0];
    const plata = { clave: "plata", titulo: "Estructura de egresos", valor: "—", sub: "sin egresos este mes", chip: null };
    if (top) {
      plata.valor = top.nombre; plata.texto = true;
      plata.sub = pct(top.pct) + " · " + soles(top.total);
      plata.chip = top.variable ? { texto: "sube con la producción", color: BR.regular } : { texto: "gasto fijo", color: BR.azul };
    }

    // «¿Por qué?» (al tocar la esfera): una ventana por cada círculo del mapa, en el mismo orden,
    // con pocos textos y sobre todo datos que no se ven en otras partes de la página.
    // El nivel y el valor de las 5 razones del veredicto no cambian (salen de saludDelMes).
    const porClave = {};
    (salud.razones || []).forEach(x => { porClave[x.clave] = x; });
    const antR = ctx.mes > 0 ? an.resumenMes(ctx.anio, ctx.mes - 1) : null;
    const nomAntL = ctx.mes > 0 ? nombreDe(ctx, ctx.mes - 1).toLowerCase() : "";
    const nomMesL = nombreDe(ctx, ctx.mes).toLowerCase();
    const cortoAnt = ctx.mes > 0 ? an.MESES_CORTOS[ctx.mes - 1] : "", cortoMes = an.MESES_CORTOS[ctx.mes];
    const fechaC = f => f ? f.slice(8, 10) + "/" + f.slice(5, 7) : "";
    const corto = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
    const NEUTRO = "#93C5FD";
    const ventanas = [];
    const nivelDe = (clave, valorSinNivel) => {
      const x = porClave[clave];
      return x ? { nivel: x.nivel, valor: x.valor } : { nivel: "info", color: NEUTRO, valor: valorSinNivel };
    };
    const conAnt = v => antR && v > 0;
    const barrasAnt = (a, b) => [{ etq: cortoAnt, v: a, txt: milCorto(a) }, { etq: cortoMes, v: b, txt: milCorto(b) }];
    const meses = ctx.resumen.meses;
    const ingMes = an.ingresosDelAnio(ctx.anio).filter(m => m.mes === ctx.mes);
    const egrMes = an.egresosDelAnio(ctx.anio).filter(m => m.mes === ctx.mes);

    // 1. Ingresos: la venta más grande, cuánto deja cada venta y el precio del ladrillo en el mes
    if (r.hayIng) {
      const mayor = ingMes.reduce((a, m) => (!a || m.valor > a.valor ? m : a), null);
      ventanas.push(Object.assign({ nombre: "Ingresos" }, { nivel: "info", color: NEUTRO, valor: soles(r.ingresos) }, {
        filas: [
          ["Venta más grande (" + fechaC(mayor.fecha) + ")", soles(mayor.valor)],
          ["Hecha por", corto(titulo(mayor.cliente), 20)],
          ["Promedio por venta (" + r.nIng + ")", soles(r.ingresos / r.nIng)],
          r.precio ? ["Precio promedio del ladrillo", solesU(r.precio)] : null,
        ].filter(Boolean),
        ayuda: "Lo que entró por tus ventas.",
      }));
    }
    // 2. Egresos: el pago más grande, el promedio por pago y cuánto gastaste por ladrillo vendido
    if (r.hayEgr) {
      const mayor = egrMes.reduce((a, m) => (!a || m.valor > a.valor ? m : a), null);
      const w = Object.assign({ nombre: "Egresos" }, nivelDe("gastos", soles(r.egresos)), {
        filas: [
          ["Pago más grande", soles(mayor.valor)],
          ["En", corto(mayor.descripcion || "sin descripción", 22)],
          ["Promedio por pago (" + r.nEgr + ")", soles(r.egresos / r.nEgr)],
          r.unidades > 0 ? ["Gasto por ladrillo vendido", solesU(r.egresos / r.unidades)] : null,
        ].filter(Boolean),
        ayuda: "Gastar menos es lo bueno.",
      });
      if (porClave.gastos && conAnt(antR.egresos)) w.barras = barrasAnt(antR.egresos, r.egresos);
      ventanas.push(w);
    }
    // 3. Ventas brutas del mes: su puesto en el año y frente al promedio mensual
    if (r.hayIng) {
      const conIng = meses.filter(x => x.hayIng);
      const puesto = conIng.slice().sort((a, b) => b.ingresos - a.ingresos).findIndex(x => x.mes === ctx.mes) + 1;
      const prom = conIng.reduce((s, x) => s + x.ingresos, 0) / conIng.length;
      const w = Object.assign({ nombre: "Ventas brutas del mes" }, nivelDe("ventas", soles(r.ingresos)), {
        filas: [
          antR && antR.ingresos > 0 ? ["Frente a " + nomAntL, signo(r.ingresos - antR.ingresos)] : null,
          ["Puesto en " + ctx.anio + (r.incompletoIng ? " (en curso)" : ""), puesto + "º de " + conIng.length + " meses"],
          ["Promedio mensual " + ctx.anio, soles(prom)],
          ["Frente al promedio", (r.ingresos >= prom ? "+" : "−") + pct(Math.abs((r.ingresos - prom) / prom * 100))],
        ].filter(Boolean),
        ayuda: "Todo lo vendido, sin descontar egresos.",
      });
      if (porClave.ventas && conAnt(antR.ingresos)) w.barras = barrasAnt(antR.ingresos, r.ingresos);
      ventanas.push(w);
    }
    // 4. Resultado neto mes a mes: cuánto queda de cada S/ 100, lo acumulado hasta este mes y el mejor mes
    if (completo) {
      const hasta = meses.filter(x => x.hayIng && x.hayEgr && x.mes <= ctx.mes);
      const acumHasta = hasta.reduce((s, x) => s + x.resultado, 0);
      const mejor = meses.filter(x => x.hayIng && x.hayEgr).reduce((a, x) => (!a || x.resultado > a.resultado ? x : a), null);
      ventanas.push(Object.assign({ nombre: "Resultado neto mes a mes" }, nivelDe("margen", signo(r.resultado)), {
        filas: [
          [gano ? "Ganaste" : "Perdiste", soles(Math.abs(r.resultado))],
          gano && r.margenPct !== null ? ["Te quedan, de cada S/ 100", "S/ " + num(r.margenPct)] : null,
          ["Acumulado " + (hasta.length > 1 ? an.MESES_CORTOS[hasta[0].mes].toLowerCase() + "–" + cortoMes.toLowerCase() : "del mes"), signo(acumHasta)],
          ["Mejor mes: " + nombreDe(ctx, mejor.mes).toLowerCase(), signo(mejor.resultado)],
        ].filter(Boolean),
        medidor: gano && r.margenPct !== null ? r.margenPct : 100,
        ayuda: "Ventas menos todos los egresos.",
      }));
    }
    // 5. Concentración de clientes: el cliente principal y cuántos hacen el 80 % de las ventas
    {
      const c = an.clientesDe(ctx.anio, ctx.mes);
      if (c.cantidad) {
        const p1 = c.clientes[0];
        ventanas.push(Object.assign({ nombre: "Concentración de clientes" }, nivelDe("clientes", pct(c.top5)), {
          filas: [
            ["Cliente principal", pct(p1.pct)],
            ["Es", corto(titulo(p1.nombre), 20)],
            [c.cantidad > 5 ? "Tus 5 mejores de " + c.cantidad : "Tus " + c.cantidad + " clientes", pct(c.top5)],
            ["Clientes que hacen el 80%", String(c.claveA)],
          ],
          medidor: c.top5,
          ayuda: "Más clientes = menos riesgo.",
        }));
      }
    }
    // 6. Punto de equilibrio operativo: cuántos ladrillos necesitabas, cuántos vendiste y cuánto deja cada uno
    if (completo && r.egresos > 0) {
      const pe = eq.pe;
      const filas = [["Tus ventas cubren de tus egresos", pct(r.cobertura)]];
      if (eq.disponible) {
        filas.push(["Ladrillos para no perder", "≈ " + num(eq.necesarios)]);
        filas.push(["Ladrillos vendidos", num(r.unidades)]);
        filas.push(["Cada ladrillo deja para fijos", solesU(pe.margen)]);
      }
      ventanas.push(Object.assign({ nombre: "Punto de equilibrio operativo" }, nivelDe("equilibrio", pct(r.cobertura)), {
        filas, medidor: r.cobertura,
        ayuda: "Lo mínimo a vender para no perder.",
      }));
    }
    // 7. Estructura de egresos: fijos frente a variables y las 3 categorías más grandes
    if (g.categorias.length) {
      const top3 = g.categorias.slice(0, 3);
      ventanas.push({ nombre: "Estructura de egresos", nivel: "info", color: NEUTRO, valor: g.categorias.length + (g.categorias.length === 1 ? " categoría" : " categorías"),
        filas: [
          ["Fijos / variables", pct(g.total ? g.fijos / g.total * 100 : 0) + " · " + pct(g.total ? g.variables / g.total * 100 : 0)],
        ].concat(top3.map(k => [k.nombre + " · " + milCorto(k.total), pct(k.pct)])),
        pila: top3.map(k => ({ pct: k.pct, color: k.color })),
        ayuda: "En qué se va tu dinero.",
      });
    }
    const razones = ventanas;

    return {
      mes: an.MESES_TITULO[ctx.mes].toLowerCase() + " " + ctx.anio,
      entradas: [ing, egr],
      salidas: [ven, res, cli, equ, plata],
      centro: { etiqueta: an.MESES_TITULO[ctx.mes] + " " + ctx.anio, texto: salud.texto, color: BR_CLAVE[salud.clave] || BR.gris, frase: salud.frase },
      razones,
    };
  }

  function pintarKpis(ctx) {
    if (!window.Esfera) return;
    window.Esfera.actualizar(datosEsfera(ctx));
  }

  // Al tocar un círculo de la esfera se va a su detalle
  const DESTINOS = { ven: '[data-ng="ganancia"]', res: '[data-ng="falta"]', cli: '[data-ng="clientes"]', equ: "#ngEquilibrio", plata: "#ngPlata" };
  // Al llegar a la tarjeta, un contorno semibrillante del color de su miniatura la señala durante 2.5 s
  const COLOR_ENTRADA = { ing: "#1FA55E", egr: "#E5484D" };
  function resaltar(destino, clave) {
    const color = COLOR_ENTRADA[clave] || (window.IconosPro && window.IconosPro.colorDe ? window.IconosPro.colorDe(clave) : "#A9573F");
    destino.style.setProperty("--resalte", color);
    // se espera a que termine de bajar la página, así el contorno se ve completo
    let ultimo = null, quietos = 0, inicio = performance.now();
    (function esperar() {
      const y = destino.getBoundingClientRect().top;
      quietos = ultimo !== null && Math.abs(y - ultimo) < 0.5 ? quietos + 1 : 0;
      ultimo = y;
      if (quietos < 4 && performance.now() - inicio < 1600) { setTimeout(esperar, 16); return; }
      destino.classList.remove("ng-resalte");
      void destino.offsetWidth;
      destino.classList.add("ng-resalte");
      setTimeout(() => destino.classList.remove("ng-resalte"), 2550);
    })();
  }
  function conectarEsfera() {
    if (!window.Esfera) return;
    window.Esfera.alClic = function (clave) {
      let destino;
      if (clave === "ing" || clave === "egr") {
        if (typeof cambiarModoRegistro === "function") cambiarModoRegistro(clave === "ing" ? "ingresos" : "egresos", true);
        destino = document.getElementById("sec-ventas");
      } else {
        destino = document.querySelector(DESTINOS[clave]);
      }
      if (!destino) return;
      destino.scrollIntoView({ behavior: sinMovimiento() ? "auto" : "smooth", block: "start" });
      resaltar(destino, clave);
    };
  }

  /* ======================================================================
     MODELOS SIMPLES (los 7 modelos aprobados por el usuario)
     Poco texto y solo datos: un período arriba, una cifra con su píldora,
     una gráfica simple y, como mucho, una línea de dato. Sin «Lectura»,
     sin «¿Qué muestra?» y sin datos repetidos.
     ====================================================================== */
  const MD = { verde: "#639922", verdeT: "#3B6D11", ambar: "#EF9F27", rojo: "#E24B4A", rojoT: "#A32D2D", gris: "#B4B2A9", coral: "#D85A30", coralS: "#F0997B", azul: "#378ADD", azulS: "#85B7EB" };
  const MD_DONA = ["#D85A30", "#378ADD", "#EF9F27", "#639922"];

  // «S/ 158 mil», «S/ 1.42 mill.»
  function compacto(v) {
    const a = Math.abs(v || 0), s = v < 0 ? "−" : "";
    if (a >= 1e6) return s + "S/ " + num(a / 1e6, 2) + " mill.";
    if (a >= 1e3) return s + "S/ " + num(a / 1e3) + " mil";
    return s + "S/ " + num(a);
  }
  // Oculta textos que ya no se usan (se ocultan, no se borran)
  function mdOcultar(ids) { ids.forEach(id => { const el = document.getElementById(id); if (el) el.classList.add("md-oculto"); }); }
  function mdPer(t) { return '<p class="md-per">' + esc(t) + "</p>"; }
  function mdPill(texto, tipo, flecha, grande) {
    return '<span class="md-pill md-pill-' + tipo + (grande ? " md-pill-lg" : "") + '">' + (flecha ? '<i aria-hidden="true">' + (flecha === "baja" ? "↓" : "↑") + "</i>" : "") + esc(texto) + "</span>";
  }
  function mdStat(valor, color, extra) { return '<div class="md-stat"><b' + (color ? ' style="color:' + color + '"' : "") + ">" + esc(valor) + "</b>" + (extra || "") + "</div>"; }
  function mdTxt(t) { return '<span class="md-txt">' + esc(t) + "</span>"; }
  // Filas con barra: {nombre, sub, valor, w (0-100), color, attr, activa}
  function mdFilas(filas) {
    return '<div class="md-filas">' + filas.map(f =>
      '<div class="md-fila' + (f.activa ? " md-activa" : "") + '"' + (f.attr || "") + '><div class="md-fila-l"><span class="md-fila-n" title="' + esc(f.nombre) + '">' + esc(f.nombre) + (f.sub ? "<small>" + esc(f.sub) + "</small>" : "") + '</span><span class="md-fila-v">' + esc(f.valor) + '</span></div>' +
      '<div class="md-fila-b"><i style="width:' + Math.max(2, Math.min(100, f.w || 0)).toFixed(1) + "%;background-color:" + f.color + '"></i></div></div>').join("") + "</div>";
  }
  // Nombre corto de un rango de meses: «Abril – agosto 2026»
  function rangoMeses(ctx, m1, m2) {
    if (m1 === m2) return nombreDe(ctx, m1) + " " + ctx.anio;
    return nombreDe(ctx, m1) + " – " + nombreDe(ctx, m2).toLowerCase() + " " + ctx.anio;
  }
  // Medidor de medio círculo de 0% a 100% con marcas en 0, 25, 50, 75 y 100
  function mdMedidor(valorPct, color) {
    const p = Math.max(0, Math.min(100, valorPct || 0));
    const cx = 110, cy = 108, r = 86, L = Math.PI * r;
    const pos = (q, rr) => { const a = Math.PI * (1 - q / 100); return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)]; };
    const arco = "M " + (cx - r) + " " + cy + " A " + r + " " + r + " 0 0 1 " + (cx + r) + " " + cy;
    const marcas = [0, 25, 50, 75, 100].map(q => { const c = pos(q, r); return '<circle cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="2.4" class="md-g-marca"/>'; }).join("");
    const et = [[0, cx - r, cy + 16], [100, cx + r, cy + 16]].concat([25, 50, 75].map(q => { const c = pos(q, r + 17); return [q, c[0], c[1] + 3]; }))
      .map(e => '<text x="' + e[1].toFixed(1) + '" y="' + e[2].toFixed(1) + '" text-anchor="middle" class="md-g-et">' + e[0] + "%</text>").join("");
    const punta = pos(p, r);
    return '<svg class="md-gauge" viewBox="0 0 220 128" role="img" aria-label="' + Math.round(valorPct || 0) + '% de la meta">' +
      '<path d="' + arco + '" class="md-g-pista"/><path d="' + arco + '" class="md-g-borde"/>' +
      (p > 0 ? '<path d="' + arco + '" class="md-g-valor" style="stroke:' + color + '" stroke-dasharray="' + (L * p / 100).toFixed(1) + " " + L.toFixed(1) + '"/>' : "") +
      marcas + (p > 0 ? '<circle cx="' + punta[0].toFixed(1) + '" cy="' + punta[1].toFixed(1) + '" r="5" class="md-g-punta" style="fill:' + color + '"/>' : "") +
      '<text x="' + cx + '" y="' + (cy - 12) + '" text-anchor="middle" class="md-g-num">' + (valorPct === null || valorPct === undefined ? "—" : Math.round(valorPct) + "%") + "</text>" +
      '<text x="' + cx + '" y="' + (cy + 6) + '" text-anchor="middle" class="md-g-sub">de tu meta</text>' + et + "</svg>";
  }

  // Aspecto 3D de las barras (sin movimiento): degradé de claro a oscuro y una sombra suave
  function tono(hex, t) {
    const n = parseInt(String(hex).replace("#", ""), 16);
    if (isNaN(n)) return hex;
    const f = t >= 0 ? 255 : 0, k = Math.abs(t);
    return "rgb(" + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(v + (f - v) * k)).join(",") + ")";
  }
  function relieve(colores) {
    return function (c) {
      const col = Array.isArray(colores) ? colores[c.dataIndex] : colores;
      const a = c.chart.chartArea;
      if (!a || !col || c.chart.options.indexAxis === "y") return col;
      const g = c.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom);
      g.addColorStop(0, tono(col, 0.28));
      g.addColorStop(1, tono(col, -0.12));
      return g;
    };
  }
  const pluginSombra = {
    id: "mdSombra",
    beforeDatasetDraw(chart, args, o) {
      if (!o || !o.on) return;
      const c = chart.ctx;
      c.save();
      c.shadowColor = "rgba(70,35,20,0.32)";
      c.shadowBlur = 11;
      c.shadowOffsetY = 5;
    },
    afterDatasetDraw(chart, args, o) { if (o && o.on) chart.ctx.restore(); },
  };
  // Brillo de volumen sobre cada barra (como una pieza redondeada iluminada desde la izquierda/arriba)
  const pluginBrillo = {
    id: "mdBrillo",
    afterDatasetDraw(chart, args) {
      const o = chart.options.plugins && chart.options.plugins.mdSombra;
      if (!o || !o.on) return;
      const meta = args.meta;
      if (!meta || meta.type !== "bar") return;
      const c = chart.ctx, horiz = chart.options.indexAxis === "y";
      c.save();
      meta.data.forEach(el => {
        const p = el.getProps(["x", "y", "base", "width", "height"], true);
        if (!p || !isFinite(p.x) || !isFinite(p.y)) return;
        let x0, y0, w, h, g;
        if (horiz) {
          x0 = Math.min(p.x, p.base); w = Math.abs(p.x - p.base); y0 = p.y - p.height / 2; h = p.height * 0.45;
          if (w < 3 || h < 2) return;
          g = c.createLinearGradient(0, y0, 0, y0 + h);
        } else {
          x0 = p.x - p.width / 2; w = p.width * 0.4; y0 = Math.min(p.y, p.base); h = Math.abs(p.base - p.y);
          if (w < 2 || h < 3) return;
          g = c.createLinearGradient(x0, 0, x0 + w, 0);
        }
        g.addColorStop(0, "rgba(255,255,255,0.30)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        c.fillStyle = g;
        const r = Math.min(5, w / 2, h / 2);
        c.beginPath();
        if (c.roundRect) c.roundRect(x0 + (horiz ? 1 : 1.5), y0 + (horiz ? 1.5 : 1.5), w - (horiz ? 2 : 1.5), h - (horiz ? 1.5 : 3), r); else c.rect(x0, y0, w, h);
        c.fill();
      });
      c.restore();
    },
  };
  if (typeof Chart !== "undefined") Chart.register(pluginSombra, pluginBrillo);

  // «301 mil» (sin «K» y sin «S/» para que quepa encima de cada barra)
  function milCorto(v) {
    const a = Math.abs(v || 0);
    if (a >= 1e6) return num(a / 1e6, 2) + " mill.";
    if (a >= 1e3) return num(a / 1e3) + " mil";
    return num(a);
  }

  // --- Gráfica 1 · Inicio: ingresos contra egresos de cada mes del año (todos los meses con datos) ---
  function pintarSeis(ctx) {
    const todos = ctx.resumen.meses;
    const conDato = todos.filter(x => x.hayIng || x.hayEgr);
    let meses;
    if (conDato.length) {
      const ini = Math.min(conDato[0].mes, ctx.mes), fin = Math.max(conDato[conDato.length - 1].mes, ctx.mes);
      meses = todos.slice(ini, fin + 1);
    } else {
      const fin = Math.max(ctx.mes, 5);
      meses = todos.slice(fin - 5, fin + 1);
    }
    mdOcultar(["ngSeisSub", "ngSeisChips"]);
    const resp = document.getElementById("ngSeisResp");
    if (resp) {
      resp.innerHTML = '<div class="md-cab">' + mdPer(meses.length > 1 ? rangoMeses(ctx, meses[0].mes, meses[meses.length - 1].mes) : ctx.nombreMes + " " + ctx.anio) + "</div>";
    }
    const pie = document.getElementById("ngSeisPie");
    if (pie) {
      const r = ctx.r;
      let txt, tipo;
      if (r.hayIng && r.hayEgr) {
        const gano = r.resultado >= 0;
        txt = ctx.anio + " · " + (gano ? "Ganancia" : "Pérdida") + " en " + ctx.nombreMes.toLowerCase() + " " + soles(Math.abs(r.resultado)) + (r.incompleto ? " · mes en curso" : "");
        tipo = gano ? "bien" : "mal";
      } else {
        txt = ctx.anio + " · " + ctx.nombreMes + (r.hayDatos ? ": faltan los " + (r.hayIng ? "egresos" : "ingresos") : ": sin datos");
        tipo = "neu";
      }
      // leyenda de colores centrada debajo de la gráfica, y después el resultado del mes
      pie.innerHTML = '<div class="md-leyenda-g md-leyenda-abajo"><span><i style="background:' + MD.verde + '"></i>Ingresos</span><span><i style="background:' + MD.ambar + '"></i>Egresos</span></div>' +
        mdPill(txt, tipo, null, true);
    }
    const muchos = meses.length > 7;
    const o = opcionesBase();
    o.layout = { padding: { top: muchos ? 48 : 26, right: 6 } };
    o.datasets = { bar: { categoryPercentage: 0.66, barPercentage: 0.9 } };
    o.scales = {
      x: { grid: { display: false }, border: { color: "#DDD2C7" }, ticks: { color: "#5A4A40", font: { size: 12.5 }, callback: function (v, i) { return meses.length > 8 ? cortoDe(ctx, meses[i].mes) : nombreDe(ctx, meses[i].mes); } } },
      y: { display: false, beginAtZero: true, grace: "6%" },
    };
    o.plugins.ngValores = { on: true, fmt: v => milCorto(v), minimo: 1, rotar: true, tam: 11 };
    o.plugins.mdSombra = { on: true };
    o.plugins.tooltip.callbacks = {
      title: items => items.length ? nombreDe(ctx, meses[items[0].dataIndex].mes) + " " + ctx.anio : "",
      label: c => " " + c.dataset.label + ": " + soles(c.parsed.y),
      afterBody: items => {
        if (!items.length) return "";
        const x = meses[items[0].dataIndex];
        return x.hayIng && x.hayEgr ? (x.resultado >= 0 ? " Ganancia " : " Pérdida ") + soles(Math.abs(x.resultado)) : "";
      },
    };
    o.onClick = (ev, el) => { if (el.length) { const m = meses[el[0].index].mes; setTimeout(() => irAMes(m), 0); } };
    o.onHover = (ev, el) => { ev.native.target.style.cursor = el.length ? "pointer" : "default"; };
    asegurar("seis", "ngSeisCanvas", {
      type: "bar",
      data: {
        labels: meses.map(x => cortoDe(ctx, x.mes)),
        datasets: [
          { label: "Ingresos", data: meses.map(x => (x.hayIng ? x.ingresos : null)), borderRadius: 6, backgroundColor: relieve(MD.verde) },
          { label: "Egresos", data: meses.map(x => (x.hayEgr ? x.egresos : null)), borderRadius: 6, backgroundColor: relieve(MD.ambar) },
        ],
      },
      options: o,
    });
    const lienzo = document.getElementById("ngSeisCanvas");
    if (lienzo) { lienzo.parentElement.classList.add("md-lienzo-g1"); lienzo.parentElement.classList.toggle("ng-lienzo-vacio", !conDato.length); }
  }

  // Tarjetitas de datos: una etiqueta pequeña y una cifra (en lugar de párrafos)
  const COLOR_TARJETITA = { "ng-t-ing": "#1E88E5", "ng-t-egr": "#F45F00", "ng-pos": "#16A34A", "ng-neg": "#DC2626" };
  // lista: [etiqueta, valor, clase (opcional), color (opcional), línea pequeña (opcional)]
  function tiles(lista) {
    return '<div class="ng-tiles" style="--n:' + lista.length + '">' + lista.map(t => {
      const color = t[3] || COLOR_TARJETITA[t[2]] || "#7A5C48";
      return '<div class="ng-tile" style="--tc:' + color + '"><small>' + esc(t[0]) + "</small><b>" + t[1] + "</b>" + (t[4] ? '<em title="' + esc(t[4]) + '">' + esc(t[4]) + "</em>" : "") + "</div>";
    }).join("") + "</div>";
  }

  // Relleno en degradé vertical para las barras (da volumen sin cambiar los colores)
  function degradado(arriba, abajo) {
    return function (c) {
      const a = c.chart.chartArea;
      if (!a) return arriba;
      const g = c.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom);
      g.addColorStop(0, arriba);
      g.addColorStop(1, abajo);
      return g;
    };
  }

  // Colores de los anillos (clientes y gastos): vivos y sus versiones suaves
  const RANGO = ["#F45F00", "#1B4A78", "#00843D", "#F2B01E", "#D62828"];   // naranja, azul marino, verde, amarillo y rojo: uno por cliente
  const RESTO = "#9AA0A6";

  // Dibuja el texto del centro de un anillo o medidor
  const pluginCentro = {
    id: "ngCentro",
    afterDatasetsDraw(chart, args, o) {
      if (!o || !o.grande) return;
      const meta = chart.getDatasetMeta(0);
      const arco = meta.data && meta.data[0];
      if (!arco) return;
      const ctx = chart.ctx;
      ctx.save();
      ctx.textAlign = "center";
      if (o.medidor) {
        // medio anillo: el centro del círculo está abajo, el texto va dentro del arco
        const ry = arco.innerRadius;
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = o.color || "#2B211C";
        ctx.font = "700 " + Math.max(22, Math.min(38, ry * 0.62)) + "px Poppins, Inter, sans-serif";
        ctx.fillText(o.grande, arco.x, arco.y - ry * 0.26);
        ctx.fillStyle = "#6A5A50";
        ctx.font = "500 " + Math.max(10, Math.min(12, ry * 0.19)) + "px Poppins, Inter, sans-serif";
        ctx.fillText(o.chico, arco.x, arco.y - 2);
        // extremos de la escala
        ctx.fillStyle = "#8A7A70";
        ctx.font = "600 10px Poppins, Inter, sans-serif";
        const mid = (arco.outerRadius + arco.innerRadius) / 2;
        ctx.fillText("0%", arco.x - mid, arco.y + 13);
        ctx.fillText("100%", arco.x + mid, arco.y + 13);
      } else {
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#2B211C";
        // la cifra se achica hasta caber dentro del hueco del anillo
        let tam = Math.max(12, Math.min(24, arco.innerRadius * 0.5));
        ctx.font = "700 " + tam + "px Poppins, Inter, sans-serif";
        while (tam > 11 && ctx.measureText(o.grande).width > arco.innerRadius * 1.6) { tam -= 1; ctx.font = "700 " + tam + "px Poppins, Inter, sans-serif"; }
        ctx.fillText(o.grande, arco.x, arco.y - 7);
        ctx.fillStyle = "#6A5A50";
        ctx.font = "500 10px Poppins, Inter, sans-serif";
        ctx.fillText(o.chico, arco.x, arco.y + 11);
      }
      ctx.restore();
    },
  };

  // Lista de posiciones junto al anillo: 1º, 2º… con su monto y su porcentaje
  function filasRank(filas, maximo, atributo) {
    return filas.map(f => '<li style="--c:' + f.color + ";--w:" + Math.max(3, Math.round((f.valor / (maximo || 1)) * 100)) + '%"' + (f.dato ? ' data-' + (atributo || "cat") + '="' + esc(f.dato) + '" tabindex="0" role="button"' : "") + (f.activa ? ' class="ng-rk-activa"' : "") + ">" +
      "<i>" + esc(f.marca) + '</i><span class="ng-rk-n" title="' + esc(f.nombre) + '">' + esc(corto(f.nombre, 24)) + "</span><em>" + esc(f.monto) + "</em><b>" + esc(f.porc) + "</b><s></s></li>").join("");
  }

  /* ---- Piezas comunes de las 6 gráficas (estilo de tablero financiero: azul, gris y fondo claro) ---- */
  const AZUL = "#1E88E5", GRIS = "#868E96", NARANJA = "#F97316";
  const NARANJA_FUERTE = "#F45F00", AZUL_MARINO = "#1B4A78";   // pareja de colores fuertes de «Estructura de egresos» y «Ranking anual»

  // Frase fija: qué muestra la gráfica (para que se entienda sin adivinar)
  function concepto(t) { return '<p class="ng-concepto"><b>Qué muestra:</b> ' + t + "</p>"; }
  // Lo mismo, pero escondido detrás de un botoncito «¿Qué muestra?»; recuerda si estaba abierto
  const infoAbierta = {};
  function info(clave, t) {
    const abierto = !!infoAbierta[clave];
    return '<div class="ng-info" data-info="' + clave + '"><button type="button" class="ng-info-b" aria-expanded="' + abierto + '"><span aria-hidden="true">i</span>¿Qué muestra?</button>' +
      '<div class="ng-info-p"' + (abierto ? "" : " hidden") + ">" + t + "</div></div>";
  }
  // Frase que cambia con tus datos: qué dice la gráfica hoy
  function lectura(html, color) { return '<p class="ng-lectura" style="--c:' + (color || AZUL) + '"><b>Lectura:</b> ' + html + "</p>"; }

  // Barras de progreso con su valor a la derecha (como «Risk Overview»). filas: {nombre, valor, tope, marca, color, texto, ayuda}
  function barrasEstado(filas) {
    return '<ul class="ng-barras">' + filas.map(f => {
      const w = Math.max(2, Math.min(100, (Math.max(0, f.valor) / f.tope) * 100));
      const m = f.marca ? Math.min(100, (f.marca / f.tope) * 100) : null;
      return '<li style="--c:' + f.color + ";--w:" + w.toFixed(1) + '%"' + (f.ayuda ? ' title="' + esc(f.ayuda) + '"' : "") + '><span class="ng-b-n">' + esc(f.nombre) + '</span><div class="ng-b-pista"><i></i>' +
        (m !== null ? '<s style="left:' + m.toFixed(1) + '%"></s>' : "") + '</div><b style="color:' + f.color + '">' + esc(f.texto) + "</b></li>";
    }).join("") + "</ul>";
  }

  // Línea punteada vertical al pasar el cursor (como en los gráficos de referencia)
  const pluginCruz = {
    id: "ngCruz",
    afterDatasetsDraw(chart, args, o) {
      if (!o || !o.on) return;
      const act = chart.tooltip && chart.tooltip.getActiveElements ? chart.tooltip.getActiveElements() : [];
      if (!act.length) return;
      const a = chart.chartArea, x = act[0].element.x, c = chart.ctx;
      c.save();
      c.strokeStyle = "rgba(30,30,30,0.75)"; c.lineWidth = 1.4; c.setLineDash([2, 3]);
      c.beginPath(); c.moveTo(x, a.top); c.lineTo(x, a.bottom); c.stroke();
      c.restore();
    },
  };

  // Valor escrito al final de cada barra (si caben) y, en «brecha», la diferencia entre dos líneas
  const pluginValores = {
    id: "ngValores",
    afterDatasetsDraw(chart, args, o) {
      if (!o || !o.on) return;
      const c = chart.ctx;
      c.save();
      c.font = "600 " + (o.tam || 10) + "px Poppins, Inter, sans-serif";
      c.fillStyle = "#2F3B4A";
      const fmt = o.fmt || (v => formatearMonedaCompacta(v));
      chart.data.datasets.forEach((ds, di) => {
        if (!chart.isDatasetVisible(di) || ds.type === "line") return;
        chart.getDatasetMeta(di).data.forEach((el, i) => {
          const v = ds.data[i];
          if (typeof v !== "number" || !isFinite(v) || !el || v === 0) return;
          const grosor = o.horizontal ? el.height : el.width;
          if (grosor < (o.minimo || 10) && i !== o.sel) return;
          const t = fmt(v, i, di);
          c.lineWidth = 3; c.strokeStyle = "rgba(255,255,255,0.95)";
          if (o.horizontal) { c.textAlign = "left"; c.textBaseline = "middle"; c.strokeText(t, el.x + 4, el.y); c.fillText(t, el.x + 4, el.y); }
          else if (o.rotar && c.measureText(t).width > el.width + 16) {
            c.save(); c.translate(el.x, el.y - 5); c.rotate(-Math.PI / 2);
            c.textAlign = "left"; c.textBaseline = "middle"; c.strokeText(t, 0, 0); c.fillText(t, 0, 0);
            c.restore();
          }
          else { c.textAlign = "center"; c.textBaseline = "bottom"; c.strokeText(t, el.x, el.y - 4); c.fillText(t, el.x, el.y - 4); }
        });
      });
      c.restore();
    },
  };
  if (typeof Chart !== "undefined") Chart.register(pluginCruz, pluginValores);

  /* ======================================================================
     2. FILA DE 3 GRÁFICAS
     ====================================================================== */

  // --- Modelo 2 · Resultado del mes: ventas del mes frente al mes anterior, con los últimos 6 meses ---
  function pintarGanancia(ctx) {
    const resp = document.getElementById("ngGananciaResp");
    if (!resp) return;
    mdOcultar(["ngGananciaSub", "ngGananciaLeyenda", "ngGananciaLectura"]);
    let ini = Math.max(0, ctx.mes - 5);
    const fin = Math.min(11, Math.max(ctx.mes, ini + 5));
    ini = Math.max(0, fin - 5);
    // sin los meses vacíos del comienzo (ej.: marzo sin ventas antes de abril)
    const primero = ctx.resumen.meses.findIndex(x => x.hayIng);
    if (primero >= 0 && primero > ini && primero <= ctx.mes) ini = primero;
    const meses = ctx.resumen.meses.slice(ini, fin + 1);
    const r = ctx.r, ant = ctx.ant;
    let extra = "";
    if (r.hayIng && ant && ant.hayIng) {
      const dif = r.ingresos - ant.ingresos;
      extra = mdPill(signo(dif), dif >= 0 ? "bien" : "mal", dif >= 0 ? "sube" : "baja");
    }
    resp.innerHTML = mdPer((ant ? ctx.nombreMes + " vs " + nombreDe(ctx, ant.mes).toLowerCase() : ctx.nombreMes + " " + ctx.anio) + (r.incompleto ? " · en curso" : "")) +
      mdStat(r.hayIng ? soles(r.ingresos) : "—", null, r.hayIng ? extra : mdPill("Sin ventas", "neu"));
    const o = opcionesBase();
    o.layout = { padding: { top: 26, right: 4 } };
    o.scales = {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: "#5A4A40", font: { size: 12.5 } } },
      y: { display: false, beginAtZero: true, grace: "8%" },
    };
    o.plugins.ngValores = { on: true, fmt: v => milCorto(v), minimo: 1, rotar: true, tam: 10.5 };
    o.plugins.mdSombra = { on: true };
    o.plugins.tooltip.callbacks = {
      title: items => items.length ? nombreDe(ctx, meses[items[0].dataIndex].mes) + " " + ctx.anio : "",
      label: c => " Ventas: " + soles(c.parsed.y),
    };
    o.onClick = (ev, el) => { if (el.length) { const m = meses[el[0].index].mes; setTimeout(() => irAMes(m), 0); } };
    o.onHover = (ev, el) => { ev.native.target.style.cursor = el.length ? "pointer" : "default"; };
    const colores = meses.map(x => (x.mes === ctx.mes ? MD.verde : MD.gris));
    asegurar("ganancia", "ngGananciaCanvas", {
      type: "bar",
      data: {
        labels: meses.map(x => cortoDe(ctx, x.mes)),
        datasets: [{ label: "Ventas", data: meses.map(x => (x.hayIng ? x.ingresos : null)), borderRadius: 7, maxBarThickness: 64, backgroundColor: relieve(colores) }],
      },
      options: o,
    });
    const lienzo = document.getElementById("ngGananciaCanvas");
    if (lienzo) {
      lienzo.parentElement.classList.remove("md-lienzo-m1");
      lienzo.parentElement.classList.add("md-lienzo-res");
      lienzo.parentElement.classList.toggle("ng-lienzo-vacio", !meses.some(x => x.hayIng));
    }
  }

  // --- Tarjeta «Resultado mes a mes»: ganancia o pérdida de cada mes del año (el mes elegido va marcado) ---
  // Símbolo de sumatoria (Σ) en 3D: pieza de cristal con la Σ dorada con relieve
  const SIGMA = '<span class="md-sigma" aria-label="Suma"><svg viewBox="0 0 40 40" aria-hidden="true"><defs>' +
    '<linearGradient id="mdSigmaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF4C2"/><stop offset=".55" stop-color="#FFD24A"/><stop offset="1" stop-color="#E29A00"/></linearGradient></defs>' +
    '<path d="M11 9.5 H29 V14 M11 9.5 L20.5 20 L11 30.5 H29 V26" fill="none" stroke="#0B3E28" stroke-opacity=".55" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(1.2 2)"/>' +
    '<path d="M11 9.5 H29 V14 M11 9.5 L20.5 20 L11 30.5 H29 V26" fill="none" stroke="url(#mdSigmaG)" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M12.5 9.5 H27" stroke="#fff" stroke-opacity=".75" stroke-width="1.4" stroke-linecap="round"/></svg></span>';
  function pintarFalta(ctx) {
    const resp = document.getElementById("ngFaltaResp");
    if (!resp) return;
    mdOcultar(["ngFaltaSub", "ngFaltaBarras", "ngFaltaLectura"]);
    const lienzo = document.getElementById("ngFaltaCanvas");
    if (lienzo) lienzo.parentElement.classList.add("md-oculto");
    if (graficos.falta) { graficos.falta.destroy(); delete graficos.falta; }
    const meses = ctx.resumen.meses.filter(x => x.hayIng && x.hayEgr);
    if (!meses.length) {
      resp.innerHTML = mdPer(String(ctx.anio)) + mdStat("—", null, mdPill("Sin datos", "neu"));
      return;
    }
    const mil = v => (v > 0 ? "+" : v < 0 ? "−" : "") + milCorto(v);
    const ganados = meses.filter(x => x.resultado >= 0).length;
    const enCurso = meses.filter(x => x.incompleto).pop();
    const acum = meses.reduce((s, x) => s + x.resultado, 0);

    // Mes de referencia: el elegido (si tiene datos) o el último; se compara con el mes anterior
    const ref = meses.find(x => x.mes === ctx.mes) || meses[meses.length - 1];
    const prev = meses.find(x => x.mes === ref.mes - 1);
    const filas = [];
    // Σ: la suma neta de todos los meses (ganancias menos pérdidas)
    filas.push(['<span class="md-sigma-fila">' + SIGMA + '<span>de todos los meses</span></span>', '<b class="md-gr" style="color:' + (acum >= 0 ? MD.verdeT : MD.rojoT) + '">' + esc(signo(acum)) + "</b>"]);
    if (prev) {
      // «Aumentó» o «Redujo» según lo que de verdad pasó con el resultado entre los dos meses
      const dif = ref.resultado - prev.resultado;
      const nr = nombreDe(ctx, ref.mes).toLowerCase(), np = nombreDe(ctx, prev.mes).toLowerCase();
      const verbo = dif > 0 ? "Aumentó" : dif < 0 ? "Se redujo" : "Igual";
      filas.push(['<span>' + (dif === 0 ? nr + " igual que " + np : verbo + " " + nr + " frente a " + np) + "</span>",
        '<b style="color:' + (dif > 0 ? MD.verdeT : dif < 0 ? MD.rojoT : "#6A5A50") + '">' + esc(dif === 0 ? "sin cambio" : signo(dif)) + "</b>"]);
    }
    // Racha: meses seguidos, hasta el mes de referencia, con el mismo resultado (pérdida o ganancia)
    const pierde = ref.resultado < 0;
    let racha = 0, m = ref.mes;
    for (let k = meses.findIndex(x => x.mes === ref.mes); k >= 0 && meses[k].mes === m && (meses[k].resultado < 0) === pierde; k--, m--) racha++;
    filas.push(['<span>Meses seguidos con ' + (pierde ? "pérdida" : "ganancia") + "</span>", '<b style="color:' + (pierde ? MD.rojoT : MD.verdeT) + '">' + racha + "</b>"]);

    // el período es el del mes que estás viendo (no un texto fijo)
    resp.innerHTML = mdPer(nombreDe(ctx, ref.mes) + " " + ctx.anio + (ref.incompleto ? " · en curso" : "")) +
      mdStat(ganados + " de " + meses.length, null, mdTxt(meses.length === 1 ? "mes ganaste dinero" : "meses ganaste dinero")) +
      '<div class="md-strip2">' + meses.map(x => {
        const gano = x.resultado >= 0;
        return '<div class="md-mes' + (x.mes === ctx.mes ? " md-sel" : "") + '"><button type="button" data-ir-mes="' + x.mes + '" style="background-color:' + (gano ? MD.verde : MD.rojo) + '"' +
          ' title="' + esc(nombreDe(ctx, x.mes) + " " + ctx.anio + ": " + (gano ? "ganancia " : "pérdida ") + soles(Math.abs(x.resultado))) + '">' + esc(cortoDe(ctx, x.mes)) + "</button>" +
          '<b style="color:' + (gano ? MD.verdeT : MD.rojoT) + '">' + esc(mil(x.resultado)) + '</b><small style="color:' + (gano ? MD.verdeT : MD.rojoT) + '">' + (gano ? "ganancia" : "pérdida") + "</small></div>";
      }).join("") + "</div>" +
      '<div class="md-datos">' + filas.map(f => '<div class="md-dato">' + f[0] + f[1] + "</div>").join("") + "</div>";
  }

  // --- Modelo 6 · Concentración de clientes: cuánto de las ventas del mes hacen tus 2 mejores clientes ---
  let clienteSel = null;   // (se conserva: lo usa el clic de la lista de clientes)
  function pintarClientesMes(ctx) {
    const resp = document.getElementById("ngClientesResp");
    if (!resp) return;
    mdOcultar(["ngClientesSub", "ngClientesFila", "ngClientesLeyenda", "ngClientesLectura"]);
    if (graficos.clientes) { graficos.clientes.destroy(); delete graficos.clientes; }
    const cl = ctx.an.clientesDe(ctx.anio, ctx.mes);
    const per = ctx.nombreMes + " " + ctx.anio;
    if (!cl.cantidad) {
      resp.innerHTML = '<div class="md-cab">' + mdPer(per) + "</div>" + mdStat("—", null, mdPill("Sin ventas", "neu"));
      return;
    }
    const n = Math.min(2, cl.cantidad);
    const mejores = cl.clientes.slice(0, n);
    const resto = cl.clientes.slice(n);
    const parte = mejores.reduce((s, c) => s + c.pct, 0);
    const filas = mejores.map(c => ({ nombre: titulo(c.nombre), valor: soles(c.total) + " · " + pct(c.pct), w: c.pct, color: MD.azul }));
    if (resto.length) {
      const tot = resto.reduce((s, c) => s + c.total, 0);
      filas.push({ nombre: "Otros " + resto.length + (resto.length === 1 ? " cliente" : " clientes"), valor: soles(tot) + " · " + pct((tot / cl.total) * 100), w: (tot / cl.total) * 100, color: MD.azulS });
    }
    resp.innerHTML = '<div class="md-cab">' + mdPer(per) + mdPill(num(cl.cantidad) + (cl.cantidad === 1 ? " cliente en total" : " clientes en total"), "neu", null, true) + "</div>" +
      mdStat(pct(parte), null, mdTxt("de las ventas en " + (n === 1 ? "1 cliente" : "2 clientes"))) + mdFilas(filas);
  }

  /* ======================================================================
     3. SALUD DE TU NEGOCIO
     ====================================================================== */

  function detalle(filas) {
    return '<ul class="kc-detalle">' + filas.map(f => "<li><span>" + f[0] + "</span><strong>" + f[1] + "</strong></li>").join("") + "</ul>";
  }

  function cabecera(iconoN, pregunta, tecnico, estado) {
    return '<div class="kc-cab">' + (window.IconosPro && window.IconosPro.html(iconoN) ? window.IconosPro.html(iconoN) : '<span class="kc-icono ng-ico ng-ico-' + iconoN + '">' + icono(iconoN) + "</span>") +
      '<div class="kc-titulos"><h3 class="kc-pregunta">' + pregunta + '</h3><p class="kc-tecnico">' + tecnico + "</p>" + (estado ? '<div class="kc-estado-fila">' + estado + "</div>" : "") + "</div></div>";
  }

  function estadoChip(k, texto) { return '<span class="kc-estado ng-estado" style="--c:' + k.color + '">' + esc(texto || k.texto) + "</span>"; }

  // La tarjeta se arma una sola vez: texto de arriba, lienzo fijo y texto de abajo.
  // Así su gráfico no se destruye en cada redibujo: solo cambian sus datos.
  function partes(cont, canvasId, etiqueta, sinMas) {
    if (!cont.querySelector("#" + canvasId)) {
      cont.innerHTML = '<div class="ng-arriba"></div><div class="ng-mini-lienzo"><canvas id="' + canvasId + '" role="img" aria-label="' + etiqueta + '"></canvas></div><div class="ng-abajo"></div>' + (sinMas ? "" : '<button type="button" class="ng-mas" aria-expanded="false">Más detalles <span aria-hidden="true">▾</span></button>');
    }
    return { arriba: cont.querySelector(".ng-arriba"), lienzo: cont.querySelector(".ng-mini-lienzo"), abajo: cont.querySelector(".ng-abajo") };
  }

  // --- Punto de equilibrio operativo (tabla B3): egresos del mes = 100%; los ingresos, qué % de ellos cubren ---
  function pintarEquilibrio(ctx) {
    const cont = document.getElementById("ngEquilibrio");
    if (!cont) return;
    if (graficos.equilibrio) { graficos.equilibrio.destroy(); delete graficos.equilibrio; }
    const r = ctx.r;
    const cab = cabecera("balanza", "Punto de equilibrio operativo", "", "");
    const per = mdPer(ctx.nombreMes + " " + ctx.anio + (r.incompleto ? " · en curso" : ""));
    if (!(r.hayIng && r.hayEgr && r.egresos > 0)) {
      cont.innerHTML = cab + per + mdStat("—", null, mdPill(r.hayDatos ? (r.hayIng ? "Faltan los egresos" : "Faltan los ingresos") : "Sin datos", "neu"));
      return;
    }
    const eg = r.egresos, ing = r.ingresos, tope = Math.max(eg, ing);
    const pctIng = (ing / eg) * 100;
    const gano = ing >= eg;
    const barra = (partes) => '<div class="md-b3-b">' + partes.map(p => '<i style="width:' + Math.max(0.5, p.w).toFixed(2) + "%;background-color:" + p.c + '"></i>').join("") + "</div>";
    const fila = (nombre, monto, porc, partes) =>
      '<div class="md-b3-fila"><div class="md-b3-l"><b>' + nombre + "</b><span>" + esc(soles(monto)) + "</span><em>" + esc(porc) + "</em></div>" + barra(partes) + "</div>";
    cont.innerHTML = cab + per +
      '<div class="md-b3"><div class="md-b3-cab"><span>Concepto</span><span>Monto</span><span>% de egresos</span></div>' +
      fila("Egresos", eg, "100%", [{ w: (eg / tope) * 100, c: MD.ambar }]) +
      fila("Ingresos", ing, pct(pctIng), gano ? [{ w: (eg / tope) * 100, c: MD.verde }, { w: ((ing - eg) / tope) * 100, c: MD.verdeT }] : [{ w: (ing / tope) * 100, c: MD.verde }]) +
      '<div class="md-b3-res"><span>' + (gano ? "Ganancia" : "Resultado") + '</span><b style="color:' + (gano ? MD.verdeT : MD.rojoT) + '">' + esc(signo(ing - eg)) + "</b></div></div>";
  }

  // --- Modelo 5 · Estructura de egresos: los 3 gastos más grandes del mes ---
  function pintarPlata(ctx) {
    const cont = document.getElementById("ngPlata");
    if (!cont) return;
    if (graficos.plata) { graficos.plata.destroy(); delete graficos.plata; }
    const g = ctx.an.gastosPorCategoria(ctx.anio, ctx.mes);
    const cab = cabecera("plata", "Estructura de egresos", "", "");
    const per = mdPer(ctx.nombreMes + " " + ctx.anio);
    if (!g.total) {
      categoriaAbierta = null;
      cont.innerHTML = cab + per + mdStat("—", null, mdPill("Sin egresos", "neu"));
      return;
    }
    const cats = g.categorias;
    const n = Math.min(2, cats.length);
    const parte = cats.slice(0, n).reduce((s, c) => s + c.pct, 0);
    const top3 = cats.slice(0, 3);
    if (categoriaAbierta && !cats.some(c => c.clave === categoriaAbierta)) categoriaAbierta = null;
    const filas = top3.map((c, i) => ({
      nombre: c.nombre, valor: soles(c.total) + " · " + pct(c.pct), w: (c.total / top3[0].total) * 100, color: i === 0 ? MD.coral : MD.coralS,
      attr: ' data-cat="' + esc(c.clave) + '" role="button" tabindex="0" title="Toca para ver sus pagos más grandes"', activa: c.clave === categoriaAbierta,
    }));
    const abierta = cats.find(c => c.clave === categoriaAbierta);
    const detalleHtml = abierta ? '<div class="ng-plata-detalle" style="--c:' + abierta.color + '"><b>' + esc(abierta.nombre) + " · " + abierta.n + " pago(s) · " + soles(abierta.total) + "</b><ol>" +
      abierta.movimientos.slice(0, 5).map(m => "<li><span>" + esc(corto(m.descripcion || "—", 46)) + "</span><small>" + esc(formatearFecha(m.fecha)) + " · <b>" + soles(m.valor) + "</b></small></li>").join("") + "</ol></div>" : "";
    cont.innerHTML = cab + per +
      '<p class="md-grande">' + n + (n === 1 ? " gasto" : " gastos") + " <span>= " + esc(pct(parte)) + " del total</span></p>" + mdFilas(filas) + detalleHtml;
  }

  // --- Modelo 7 · Ranking anual de clientes: círculo con tus 3 mejores clientes del año y el resto ---
  function pintarClientesAnio(ctx) {
    const cont = document.getElementById("ngClientesAnio");
    if (!cont) return;
    const cl = ctx.an.clientesDe(ctx.anio, -1);
    if (!cont.querySelector(".md-m7 #ngParetoCanvas")) {
      if (graficos.pareto) { graficos.pareto.destroy(); delete graficos.pareto; }
      cont.innerHTML = cabecera("clientes", "Ranking anual de clientes", "", "") + '<div class="md-m7-cab"></div>' +
        '<div class="md-m7"><div class="md-m7-dona"><canvas id="ngParetoCanvas" role="img" aria-label="Tus mejores clientes del año"></canvas><div class="md-m7-centro"></div></div><ul class="md-m7-leg"></ul></div>';
      const lienzo = cont.querySelector("#ngParetoCanvas");
      lienzo.addEventListener("mouseleave", () => { if (cont.$centro) cont.$centro(-1); });
    }
    const cabDatos = cont.querySelector(".md-m7-cab"), fila = cont.querySelector(".md-m7"), centro = cont.querySelector(".md-m7-centro"), leg = cont.querySelector(".md-m7-leg");
    if (!cl.cantidad) {
      cabDatos.innerHTML = '<div class="md-cab">' + mdPer("Año " + ctx.anio) + "</div>" + mdStat("—", null, mdPill("Sin ventas", "neu"));
      fila.classList.add("md-oculto");
      return;
    }
    fila.classList.remove("md-oculto");
    const top = cl.clientes.slice(0, 3);
    const resto = cl.clientes.slice(3);
    const seg = top.map((c, i) => ({ nombre: titulo(c.nombre), total: c.total, pct: c.pct, color: MD_DONA[i] }));
    if (resto.length) {
      const tot = resto.reduce((s, c) => s + c.total, 0);
      seg.push({ nombre: "Otros " + resto.length + (resto.length === 1 ? " cliente" : " clientes"), total: tot, pct: (tot / cl.total) * 100, color: MD_DONA[3] });
    }
    cabDatos.innerHTML = '<div class="md-cab">' + mdPer("Año " + ctx.anio) + mdPill(num(cl.cantidad) + (cl.cantidad === 1 ? " cliente" : " clientes"), "neu") + "</div>";
    leg.innerHTML = seg.map(s => '<li><i style="background:' + s.color + '"></i><span title="' + esc(s.nombre) + '">' + esc(s.nombre) + "</span><em>" + esc(soles(s.total)) + "</em></li>").join("");
    // Centro: el total; al señalar un color, su porcentaje
    cont.$centro = i => {
      centro.innerHTML = i >= 0 && seg[i]
        ? "<b>" + esc(pct(seg[i].pct)) + "</b><span>" + esc(corto(seg[i].nombre, 18)) + "</span>"
        : '<b class="' + (compacto(cl.total).length > 9 ? "md-largo" : "") + '">' + esc(compacto(cl.total)) + "</b><span>total</span>";
    };
    cont.$centro(-1);
    const o = opcionesBase();
    o.cutout = "70%";
    o.layout = { padding: 4 };
    o.plugins.tooltip = { enabled: false };
    o.plugins.mdSombra = { on: true };
    o.onHover = (ev, el) => { cont.$centro(el && el.length ? el[0].index : -1); ev.native.target.style.cursor = el && el.length ? "pointer" : "default"; };
    o.onClick = (ev, el) => { cont.$centro(el && el.length ? el[0].index : -1); };
    asegurar("pareto", "ngParetoCanvas", {
      type: "doughnut",
      data: { labels: seg.map(s => s.nombre), datasets: [{ data: seg.map(s => s.total), backgroundColor: seg.map(s => s.color), borderWidth: 2, borderColor: "#fff", hoverOffset: 5 }] },
      options: o,
    });
  }

  /* ======================================================================
     ACTUALIZACIÓN GENERAL (la llama dashboard.js)
     ====================================================================== */
  function conProteccion(nombre, fn) {
    try { fn(); } catch (error) { console.warn("[negocio] " + nombre + ":", error); }
  }

  function actualizarNegocio() {
    if (!window.Analitica) return;
    let ctx;
    try { ctx = contexto(); } catch (error) { console.warn("[negocio] contexto:", error); return; }
    conProteccion("aviso", () => pintarAviso(ctx));
    conProteccion("esfera", () => pintarKpis(ctx));
    if (typeof Chart === "undefined") return;   // sin la librería de gráficos, solo los textos
    conProteccion("seis meses", () => pintarSeis(ctx));
    conProteccion("ganancia", () => pintarGanancia(ctx));
    conProteccion("falta", () => pintarFalta(ctx));
    conProteccion("clientes del mes", () => pintarClientesMes(ctx));
    conProteccion("equilibrio", () => pintarEquilibrio(ctx));
    conProteccion("plata", () => pintarPlata(ctx));
    conProteccion("clientes del año", () => pintarClientesAnio(ctx));
  }

  // Cambiar el mes del sistema desde el panel (mismo efecto que las pestañas de mes)
  function irAMes(m) {
    if (typeof renderTodo !== "function" || isNaN(m)) return;
    mesActual = m;
    renderTodo();
  }

  /* ======================================================================
     EVENTOS
     ====================================================================== */
  document.addEventListener("click", e => {
    const mas = e.target.closest(".ng-mas");
    if (mas) {
      const tarjeta = mas.closest(".kpi-card, .ng-card");
      const abierto = tarjeta.classList.toggle("ng-abierto");
      mas.setAttribute("aria-expanded", abierto ? "true" : "false");
      mas.innerHTML = abierto ? 'Ver menos <span aria-hidden="true">▴</span>' : 'Más detalles <span aria-hidden="true">▾</span>';
      // lo que estaba oculto (gráficos incluidos) ya tiene tamaño: se ajusta
      requestAnimationFrame(() => Object.keys(graficos).forEach(k => { try { graficos[k].resize(); } catch (e) { /* sin gráfico */ } }));
      return;
    }
    const ir = e.target.closest("[data-ir-mes]");
    if (ir && !ir.disabled) { irAMes(Number(ir.dataset.irMes)); return; }
    const cli = e.target.closest(".ng-rank [data-cli]");
    if (cli) {
      clienteSel = clienteSel === cli.dataset.cli ? null : cli.dataset.cli;
      if (window.Analitica) conProteccion("clientes del mes", () => pintarClientesMes(contexto()));
      return;
    }
    const ib = e.target.closest(".ng-info-b");
    if (ib) {
      const caja = ib.closest(".ng-info");
      const panel = caja.querySelector(".ng-info-p");
      panel.hidden = !panel.hidden;
      infoAbierta[caja.dataset.info] = !panel.hidden;
      ib.setAttribute("aria-expanded", String(!panel.hidden));
      return;
    }
    const fila = e.target.closest(".ng-rank [data-cat], .md-fila[data-cat]");
    if (fila) {
      categoriaAbierta = categoriaAbierta === fila.dataset.cat ? null : fila.dataset.cat;
      if (window.Analitica) conProteccion("plata", () => pintarPlata(contexto()));
      return;
    }
    const pl = e.target.closest("[data-plata]");
    if (pl) {
      vistaPlata = pl.dataset.plata === "anio" ? "anio" : "mes";
      categoriaAbierta = null;
      if (window.Analitica) conProteccion("plata", () => pintarPlata(contexto()));
    }
  });

  document.addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches(".ng-rank [data-cat], .ng-rank [data-cli], .md-fila[data-cat]")) { e.preventDefault(); e.target.click(); }
  });

  document.querySelectorAll(".ng-card[data-ng]").forEach(card => {
    const clave = card.dataset.ng;
    card.addEventListener("mouseenter", () => cambiarModo(clave, "vivo"));
    card.addEventListener("mouseleave", () => cambiarModo(clave, "reposo"));
  });

  conectarEsfera();
  window.actualizarNegocio = actualizarNegocio;
})();
