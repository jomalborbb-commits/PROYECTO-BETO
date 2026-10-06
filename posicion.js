/* ==========================================================================
   posicion.js — Ventana "Medidas de posición" (cuartiles, quintiles,
   deciles y percentiles de tus ingresos y egresos)
   --------------------------------------------------------------------------
   Ordena tus montos de menor a mayor y los parte en grupos iguales:
     cuartiles (4 partes), quintiles (5), deciles (10) y percentiles (100).
   Fórmula del curso (igual a CUARTIL.EXC / PERCENTIL.EXC de Excel):
     W = j(n + 1) ÷ N     W = y,z     Cⱼ = x(y) + z·[x(y+1) − x(y)]
   Da indicadores de mes bueno / malo (verde = bueno, rojo = malo, los mismos
   colores de «Estabilidad» y «¿Mis ventas y pagos son parecidos?»), la interpretación en
   palabras, recomendaciones, consejos de decisión y el paso a paso.

   Se abre desde el círculo "Medidas de posición" del panel (script.js llama
   a abrirPosicion()). Es de SOLO LECTURA: todos los números salen de
   analitica.js, la misma fuente del resto del panel.
   Gráficos inspirados en StatsUnlock (diagrama de caja, curva de
   percentiles, histograma con el rango intercuartil) y en LiveGap (barras);
   el diseño es el de las otras ventanas (clases vm- y pj-).
   ========================================================================== */
(function () {
  "use strict";

  const TITULO = "Puesto de mi mes";

  const TEMAS = {
    verdeAzul: { nombre: "Verde y azul (predeterminado)", ingresos: "#16A34A", egresos: "#2563EB", resultado: "#0F766E", linea: "#1E3A8A" },
    verdeNaranja: { nombre: "Verde y naranja", ingresos: "#2FA84F", egresos: "#F07A1E", resultado: "#8C4633", linea: "#7A4A38" },
    ladrillera: { nombre: "Ladrillera (terracota)", ingresos: "#4E7A4F", egresos: "#A9573F", resultado: "#8C4633", linea: "#5A2E22" },
  };

  const GRAFICOS = {
    caja: "1. Diagrama de caja: cuartiles y montos atípicos",
    percentiles: "2. Curva de percentiles (del P0 al P100)",
    histograma: "3. Histograma con el 50% central (Q1 a Q3)",
    quintiles: "4. Quintiles: cuánto dinero aporta cada 20%",
    meses: "5. Posición de cada mes: ¿bueno o malo?",
  };

  const METODOS = {
    curso: "Fórmula del curso: W = j(n+1)/N (Excel .EXC)",
    inc: "Excel .INC / StatsUnlock: h = (n−1)p + 1",
  };

  const FUENTES = ["Inter", "Poppins", "Space Grotesk", "Arial", "Georgia"];

  const ESTADO_INICIAL = {
    tipo: "ingresos",          // ingresos | egresos | ambos
    anio: null,
    mes: -1,                   // -1 = todo el año; 0..11 = solo los montos de ese mes
    grafico: "meses",           // en la vista simple siempre se ve este; los demás están en «Más detalles»
    metodo: "curso",
    excluirIncompletos: true,  // en la posición de cada mes, no contar el último mes si está incompleto
    verAtipicos: false,        // false = el gráfico se enfoca en los montos normales
    etiquetas: true,
    leyenda: true,
    animacion: true,
    decimales: 0,
    tema: "verdeAzul",
    ancho: 900,
    alto: 440,
    fuente: "Inter",
    fondo: "#FFFFFF",
  };

  const PALABRA = {
    ingresos: { uno: "ingreso", varios: "ingresos", Varios: "Ingresos", monto: "venta", montos: "ventas", del: "de tus ingresos" },
    egresos: { uno: "egreso", varios: "egresos", Varios: "Egresos", monto: "pago", montos: "pagos", del: "de tus egresos" },
    resultado: { uno: "resultado", varios: "resultados", Varios: "Resultado (ingresos − egresos)", monto: "resultado", montos: "resultados", del: "del resultado" },
  };

  const A = () => window.Analitica;
  const SEM = () => window.SEMAFORO;

  let estado = clonar(ESTADO_INICIAL);
  let grafico = null;
  let raiz = null;
  let elementoAnterior = null;
  let verFormulas = true;
  let hoja = "meses";          // tabla visible: "meses" | "percentiles"

  function clonar(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(t) { return String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function avisar(m, t) { if (typeof mostrarToast === "function") mostrarToast(m, t); }

  function soles(v, compacto) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    if (compacto) return formatearMonedaCompacta(v);
    const d = estado.decimales;
    return (v < 0 ? "−S/ " : "S/ ") + Math.abs(v).toLocaleString("es-PE", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function signo(v) { return v > 0 ? "+" + soles(v) : soles(v); }
  function pct(v, dec) { return v === null || v === undefined || isNaN(v) ? "—" : Number(v).toLocaleString("es-PE", { maximumFractionDigits: dec === undefined ? 1 : dec }) + "%"; }
  function num(v, dec) { return Number(v).toLocaleString("es-PE", { maximumFractionDigits: dec === undefined ? 2 : dec }); }
  function plural(t, n) { return n === 1 ? t : t.replace(/(\S+)$/, w => /[aeiou]$/.test(w) ? w + "s" : w + "es"); }
  function aRgba(hex, a) {
    const n = parseInt(hex.replace("#", ""), 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  function colorDe(tipo) { return TEMAS[estado.tema][tipo]; }
  function tiposMontos() { return estado.tipo === "ambos" ? ["ingresos", "egresos"] : [estado.tipo]; }
  function tipoMensual() { return estado.tipo === "ambos" ? "resultado" : estado.tipo; }
  function nombrePeriodo() { return estado.mes < 0 ? "todo " + estado.anio : A().MESES_TITULO[estado.mes] + " " + estado.anio; }

  /* ======================================================================
     DATOS (todo sale de analitica.js)
     ====================================================================== */

  // Montos del período (cada ingreso o egreso por separado) y sus medidas de posición
  function serieMontos(tipo) {
    const lista = A().movimientos(tipo, estado.anio).filter(m => estado.mes < 0 || m.mes === estado.mes);
    return { tipo, lista, res: A().resumenPosicion(lista.map(m => m.valor), estado.metodo), color: colorDe(tipo) };
  }

  // Totales de cada mes del año y sus medidas de posición
  function serieMensual(tipo) {
    const meses = A().totalesMensuales(tipo, estado.anio, estado.excluirIncompletos);
    const usados = meses.filter(u => u.total !== null && !u.excluido);
    return { tipo, meses, usados, res: A().resumenPosicion(usados.map(u => u.total), estado.metodo), color: colorDe(tipo) };
  }

  function semaforoMes(tipo, u, res) {
    if (u.total === null) return null;
    if (u.excluido) return SEM().incompleto;
    return A().semaforoPosicion(tipo, u.total, res);
  }

  /* ======================================================================
     GRÁFICOS
     ====================================================================== */

  const pluginFondo = {
    id: "psFondo",
    beforeDraw(chart) {
      const ctx = chart.ctx;
      ctx.save();
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = estado.fondo;
      ctx.fillRect(0, 0, chart.width, chart.height);
      ctx.restore();
    },
  };

  // Escribe un texto con borde blanco (se lee sobre cualquier color) y evita
  // que se encime con otro ya escrito: si choca, lo sube o baja una fila
  function rotulos(ctx) {
    const puestos = [];
    return function (texto, x, y, color, alinear, direccion) {
      const w = ctx.measureText(texto).width;
      let x0 = alinear === "right" ? x - w : alinear === "left" ? x : x - w / 2;
      let yy = y;
      for (let intento = 0; intento < 4; intento++) {
        const choca = puestos.some(p => x0 < p.x1 + 4 && x0 + w > p.x0 - 4 && Math.abs(p.y - yy) < 13);
        if (!choca) break;
        yy += (direccion || -1) * 14;
      }
      puestos.push({ x0, x1: x0 + w, y: yy });
      ctx.textAlign = alinear || "center";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.fillStyle = color;
      ctx.strokeText(texto, x, yy);
      ctx.fillText(texto, x, yy);
    };
  }

  const pluginDeco = {
    id: "psDeco",
    beforeDatasetsDraw(chart, args, o) {
      if (!o || !o.tipo) return;
      const ctx = chart.ctx, a = chart.chartArea, x = chart.scales.x, y = chart.scales.y;
      ctx.save();
      ctx.beginPath(); ctx.rect(a.left, a.top, a.right - a.left, a.bottom - a.top); ctx.clip();

      if (o.tipo === "caja") {
        o.filas.forEach(f => {
          const yc = y.getPixelForValue(f.fila);
          const alto = Math.min(46, Math.abs(y.getPixelForValue(f.fila + 0.5) - yc) * 0.62);
          const px = v => x.getPixelForValue(v);
          const r = f.res;
          ctx.strokeStyle = f.color;
          ctx.lineWidth = 2.2;
          // Bigotes (del mínimo normal al Q1 y del Q3 al máximo normal)
          ctx.beginPath();
          ctx.moveTo(px(r.bigoteInf), yc); ctx.lineTo(px(r.q1.valor), yc);
          ctx.moveTo(px(r.q3.valor), yc); ctx.lineTo(px(r.bigoteSup), yc);
          ctx.moveTo(px(r.bigoteInf), yc - alto * 0.5); ctx.lineTo(px(r.bigoteInf), yc + alto * 0.5);
          ctx.moveTo(px(r.bigoteSup), yc - alto * 0.5); ctx.lineTo(px(r.bigoteSup), yc + alto * 0.5);
          ctx.stroke();
          // Caja: 25% a 50% y 50% a 75% en dos tonos
          const x1 = px(r.q1.valor), x2 = px(r.q2.valor), x3 = px(r.q3.valor);
          ctx.fillStyle = aRgba(f.color, 0.18);
          ctx.fillRect(x1, yc - alto, x2 - x1, alto * 2);
          ctx.fillStyle = aRgba(f.color, 0.34);
          ctx.fillRect(x2, yc - alto, x3 - x2, alto * 2);
          ctx.lineWidth = 2.2;
          ctx.strokeRect(x1, yc - alto, x3 - x1, alto * 2);
          // Mediana
          ctx.strokeStyle = "#1F2937";
          ctx.lineWidth = 3.5;
          ctx.beginPath(); ctx.moveTo(x2, yc - alto - 3); ctx.lineTo(x2, yc + alto + 3); ctx.stroke();
        });
      }

      if (o.tipo === "bandas") {
        // Franja del 50% central (Q1 a Q3) de cada serie
        o.bandas.forEach(b => {
          const x1 = x.getPixelForValue(b.q1), x3 = x.getPixelForValue(b.q3);
          ctx.fillStyle = aRgba(b.color, 0.12);
          ctx.fillRect(x1, a.top, x3 - x1, a.bottom - a.top);
        });
      }

      if (o.tipo === "meses" && o.res) {
        const y1 = y.getPixelForValue(o.res.q1.valor), y3 = y.getPixelForValue(o.res.q3.valor);
        ctx.fillStyle = "rgba(37,99,235,0.07)";
        ctx.fillRect(a.left, y3, a.right - a.left, y1 - y3);
      }
      ctx.restore();
    },

    afterDatasetsDraw(chart, args, o) {
      if (!o || !o.tipo) return;
      const ctx = chart.ctx, a = chart.chartArea, x = chart.scales.x, y = chart.scales.y;
      ctx.save();
      ctx.font = "700 11px " + estado.fuente + ", sans-serif";
      ctx.textBaseline = "bottom";
      const poner = rotulos(ctx);

      if (o.tipo === "caja" && o.etiquetas) {
        o.filas.forEach(f => {
          const r = f.res;
          const yc = y.getPixelForValue(f.fila);
          const alto = Math.min(46, Math.abs(y.getPixelForValue(f.fila + 0.5) - yc) * 0.62);
          const px = v => Math.max(a.left + 2, Math.min(a.right - 2, x.getPixelForValue(v)));
          poner("Mediana " + soles(r.q2.valor, true), px(r.q2.valor), yc - alto - 6, "#1F2937", "center", -1);
          ctx.textBaseline = "top";
          poner("Q1 " + soles(r.q1.valor, true), px(r.q1.valor) - 3, yc + alto + 6, f.color, "right", 1);
          poner("Q3 " + soles(r.q3.valor, true), px(r.q3.valor) + 3, yc + alto + 6, f.color, "left", 1);
          ctx.textBaseline = "bottom";
          poner("mín " + soles(r.bigoteInf, true), px(r.bigoteInf), yc - alto * 0.5 - 6, f.color, "center", -1);
          poner((r.atipicosAltos.length ? "máx normal " : "máx ") + soles(r.bigoteSup, true), px(r.bigoteSup), yc - alto * 0.5 - 6, f.color, "center", -1);
          // Aviso de los atípicos que quedan fuera del enfoque (arriba, a la derecha de la fila)
          if (f.fueraDer) {
            ctx.textBaseline = "bottom";
            poner("+" + f.fueraDer + " atípico" + (f.fueraDer === 1 ? "" : "s") + " más, hasta " + soles(r.max, true) + " →", a.right - 4, yc - alto - 6, "#B71C1C", "right", -1);
          }
        });
      }

      if (o.tipo === "percentiles" && o.etiquetas) {
        o.marcas.forEach(m => {
          const px = x.getPixelForValue(m.p), py = y.getPixelForValue(m.valor);
          if (py < a.top || py > a.bottom) return;
          poner(m.texto, px, py - 9, m.color, "center", -1);
        });
      }

      if (o.tipo === "bandas") {
        o.bandas.forEach((b, i) => {
          [[b.q1, "Q1", [6, 4]], [b.q2, "Me", []], [b.q3, "Q3", [6, 4]]].forEach(([v, t, dash]) => {
            const px = x.getPixelForValue(v);
            if (px < a.left || px > a.right) return;
            ctx.strokeStyle = b.color;
            ctx.lineWidth = t === "Me" ? 2.5 : 1.6;
            ctx.setLineDash(dash);
            ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke();
            ctx.setLineDash([]);
            if (o.etiquetas) poner(t + (o.bandas.length > 1 ? " " + b.corto : "") + " " + soles(v, true), px, a.top + 14 + i * 28, b.color, "center", 1);
          });
        });
      }

      if (o.tipo === "quintiles" && o.etiquetas) {
        chart.data.datasets.forEach((ds, i) => {
          if (!chart.isDatasetVisible(i) || ds.$sinRotulo) return;
          chart.getDatasetMeta(i).data.forEach((bar, j) => {
            const v = ds.data[j];
            if (v === null || v === undefined) return;
            poner(pct(v, 0), bar.x, bar.y - 4, ds.borderColor, "center", -1);
          });
        });
        const yy = y.getPixelForValue(20);
        ctx.strokeStyle = "#6B7280";
        ctx.setLineDash([6, 5]);
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(a.left, yy); ctx.lineTo(a.right, yy); ctx.stroke();
        ctx.setLineDash([]);
        // A la izquierda, sobre los grupos chicos, para no tapar las barras altas
        ctx.textAlign = "left";
        ctx.fillStyle = "#4B5563";
        ctx.fillText("si todos los montos fueran iguales: 20% cada grupo", a.left + 6, yy - 3);
      }

      if (o.tipo === "meses" && o.res) {
        const bueno = o.tipoMes === "egresos" ? "gasto alto" : "mes bueno";
        const flojo = o.tipoMes === "egresos" ? "gasto bajo" : "mes flojo";
        const q1t = o.simple ? (o.tipoMes === "egresos" ? "Por debajo: " + flojo : "Por debajo: " + flojo) : "Q1 · 25% de los meses por debajo";
        const q2t = o.simple ? "Mes típico" : "Mediana (mes típico)";
        const q3t = o.simple ? "Por encima: " + bueno : "Q3 · 25% de los meses por encima";
        [[o.res.q1.valor, q1t, [6, 4]], [o.res.q2.valor, q2t, []], [o.res.q3.valor, q3t, [6, 4]]].forEach(([v, t, dash]) => {
          const py = y.getPixelForValue(v);
          if (py < a.top || py > a.bottom) return;
          ctx.strokeStyle = "#1E3A8A";
          ctx.lineWidth = t.startsWith("Mediana") ? 2.2 : 1.4;
          ctx.setLineDash(dash);
          ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke();
          ctx.setLineDash([]);
          if (o.etiquetas) poner(t + " " + soles(v, true), a.right - 4, py - 2, "#1E3A8A", "right", -1);
        });
        if (o.cero) {
          const y0 = y.getPixelForValue(0);
          ctx.strokeStyle = "#3B2F2A"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(a.left, y0); ctx.lineTo(a.right, y0); ctx.stroke();
        }
      }
      ctx.restore();
    },
  };

  function opcionesBase(titulo, subtitulo) {
    const fuente = estado.fuente + ", sans-serif";
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: estado.animacion ? { duration: 800, easing: "easeOutQuart" } : false,
      layout: { padding: { top: 6, right: 16, left: 6 } },
      plugins: {
        title: { display: true, text: titulo, color: "#1E3A8A", font: { family: fuente, size: 17, weight: "600" }, padding: { top: 4, bottom: 2 } },
        subtitle: { display: !!subtitulo, text: subtitulo, color: "#555", font: { family: fuente, size: 12 }, padding: { bottom: 10 } },
        legend: { display: estado.leyenda, position: "bottom", labels: { usePointStyle: true, boxWidth: 8, font: { family: fuente, size: 12 }, color: "#222" } },
        tooltip: { padding: 10, titleFont: { family: fuente, size: 13 }, bodyFont: { family: fuente, size: 12 }, bodySpacing: 3 },
      },
    };
  }

  function ejeSoles(titulo, extra) {
    const fuente = estado.fuente + ", sans-serif";
    return Object.assign({
      grid: { color: "#EEF0F4" },
      title: { display: !!titulo, text: titulo, color: "#333", font: { family: fuente, size: 12, weight: "600" } },
      ticks: { color: "#222", font: { family: fuente, size: 11 }, callback: v => formatearMonedaCompacta(v) },
    }, extra || {});
  }

  // Frase de cada medida para los globos: "el 25% de tus ventas es de S/ X o menos"
  function fraseMedida(p, valor, tipo) {
    const w = PALABRA[tipo];
    return " El " + p + "% de tus " + w.montos + " es de " + soles(valor) + " o menos";
  }

  function construirConfig() {
    const fuente = estado.fuente + ", sans-serif";

    /* ---------- 5. Posición de cada mes ---------- */
    if (estado.grafico === "meses") {
      const tipo = tipoMensual();
      const s = serieMensual(tipo);
      if (!s.meses.some(u => u.total !== null)) return null;
      const colores = s.meses.map(u => { const k = semaforoMes(tipo, u, s.res); return k ? k.color : "#ccc"; });
      const simple = window.VistaSimple && VistaSimple.esSimple(raiz);
      const o = simple
        ? opcionesBase("¿Cómo le fue a cada mes?", (tipo === "ingresos" ? "Lo que entró" : tipo === "egresos" ? "Lo que salió" : "Lo que te queda") + " · " + estado.anio + " · verde = bueno · rojo = flojo")
        : opcionesBase(GRAFICOS.meses.slice(3), PALABRA[tipo].Varios + " · " + estado.anio + " · el color dice si el mes fue bueno (verde) o malo (rojo) frente a tus demás meses");
      o.scales = {
        x: { grid: { display: false }, ticks: { font: { family: fuente, size: 11 } } },
        y: ejeSoles(tipo === "resultado" ? "Resultado del mes" : "Total del mes", tipo === "resultado" ? { grace: "10%" } : { beginAtZero: true, grace: "10%" }),
      };
      o.plugins.legend.display = false;
      o.plugins.psDeco = { tipo: "meses", res: s.res && s.res.n >= 2 ? s.res : null, etiquetas: estado.etiquetas, cero: tipo === "resultado", simple, tipoMes: tipo };
      o.plugins.tooltip.callbacks = {
        title: items => items.length ? s.meses[items[0].dataIndex].nombre + " " + estado.anio : "",
        label: c => {
          const u = s.meses[c.dataIndex];
          if (u.total === null) return " Sin datos";
          const k = semaforoMes(tipo, u, s.res);
          const l = [" Total: " + soles(u.total)];
          if (tipo === "resultado") l.push(" Ingresos " + soles(u.r.ingresos, true) + " − egresos " + soles(u.r.egresos, true));
          if (u.excluido) { l.push(" ⚠ Mes incompleto: no se cuenta en los cuartiles"); return l; }
          if (s.res) {
            const rp = A().rangoPercentil(s.res.ord, u.total);
            l.push(" Percentil " + Math.round(rp) + ": " + (tipo === "egresos" ? "gastaste más que en el " : "supera al ") + Math.round(rp) + "% de tus meses");
            const puesto = s.usados.slice().sort((a, b) => (tipo === "egresos" ? a.total - b.total : b.total - a.total)).findIndex(x => x.mes === u.mes) + 1;
            l.push(" Puesto " + puesto + " de " + s.usados.length + (tipo === "egresos" ? " (1 = el que menos gastó)" : " (1 = el mejor)"));
          }
          l.push(" Indicador: " + k.icono + " " + k.texto);
          return l;
        },
      };
      o.onClick = (ev, el) => {
        if (simple || !el.length) return;
        const u = s.meses[el[0].index];
        if (u.total === null) return;
        estado.mes = estado.mes === u.mes ? -1 : u.mes;
        sincronizarControles();
        // Se redibuja un instante después: el gráfico termina de atender el clic antes de ser reemplazado
        setTimeout(redibujar, 0);
      };
      return {
        type: "bar",
        data: {
          labels: s.meses.map(u => u.corto),
          datasets: [{
            label: PALABRA[tipo].Varios,
            data: s.meses.map(u => u.total),
            backgroundColor: s.meses.map((u, i) => aRgba(colores[i], u.excluido ? 0.35 : estado.mes === u.mes ? 1 : 0.82)),
            borderColor: s.meses.map((u, i) => estado.mes === u.mes ? "#111827" : colores[i]),
            borderWidth: s.meses.map(u => (estado.mes === u.mes ? 3 : 1.5)),
            borderRadius: 6, maxBarThickness: 56,
          }],
        },
        options: o, plugins: [pluginFondo, pluginDeco],
      };
    }

    const series = tiposMontos().map(serieMontos).filter(s => s.res);
    if (!series.length) return null;
    const quien = series.map(s => PALABRA[s.tipo].Varios).join(" y ");

    /* ---------- 1. Diagrama de caja ---------- */
    if (estado.grafico === "caja") {
      const filas = series.map((s, i) => ({ fila: series.length - i, color: s.color, res: s.res, tipo: s.tipo }));
      const bajo = Math.min.apply(null, filas.map(f => f.res.bigoteInf));
      const altoV = Math.max.apply(null, filas.map(f => f.res.bigoteSup));
      const minTotal = Math.min.apply(null, filas.map(f => f.res.min));
      const maxTotal = Math.max.apply(null, filas.map(f => f.res.max));
      const span = (estado.verAtipicos ? maxTotal - minTotal : altoV - bajo) || Math.abs(altoV) || 1;
      const xmin = estado.verAtipicos ? Math.max(0, minTotal - span * 0.04) : Math.max(0, bajo - span * 0.06);
      const xmax = estado.verAtipicos ? maxTotal + span * 0.04 : altoV + span * (filas.some(f => f.res.atipicosAltos.length) ? 0.34 : 0.08);
      filas.forEach(f => { f.fueraDer = estado.verAtipicos ? 0 : f.res.ord.filter(v => v > xmax).length; });

      const cinco = [];
      const atipicos = [];
      filas.forEach(f => {
        const r = f.res;
        [["Mínimo normal", r.bigoteInf, null], ["Q1 · primer cuartil", r.q1.valor, 25], ["Mediana (Q2)", r.q2.valor, 50], ["Q3 · tercer cuartil", r.q3.valor, 75], ["Máximo normal", r.bigoteSup, null]]
          .forEach(([t, v, p]) => cinco.push({ x: v, y: f.fila, t, p, tipo: f.tipo }));
        r.atipicosAltos.concat(r.atipicosBajos).forEach((v, k) => {
          if (v > xmax || v < xmin) return;
          atipicos.push({ x: v, y: f.fila + (((k * 37) % 11) - 5) * 0.035, tipo: f.tipo, color: f.color });
        });
      });
      const o = opcionesBase(GRAFICOS.caja.slice(3), quien + " · " + nombrePeriodo() + " · la caja es el 50% central de tus montos; la raya negra, la mediana" + (estado.verAtipicos ? "" : " · enfocado en los montos normales"));
      o.scales = {
        x: ejeSoles("Monto de cada " + (series.length > 1 ? "movimiento" : PALABRA[series[0].tipo].uno) + " (S/)", { type: "linear", min: xmin, max: xmax }),
        y: {
          type: "linear", min: 0.35, max: filas.length + 0.65, grid: { display: false },
          ticks: { stepSize: 1, font: { family: fuente, size: 13, weight: "600" }, color: "#111", callback: v => { const f = filas.find(ff => ff.fila === v); return f ? PALABRA[f.tipo].Varios : ""; } },
        },
      };
      o.plugins.psDeco = { tipo: "caja", filas, etiquetas: estado.etiquetas };
      o.plugins.tooltip.callbacks = {
        title: items => items.length ? PALABRA[items[0].raw.tipo].Varios + " · " + nombrePeriodo() : "",
        label: c => {
          const d = c.raw;
          if (c.datasetIndex === 0) return [" " + d.t + ": " + soles(d.x)].concat(d.p ? [fraseMedida(d.p, d.x, d.tipo)] : [" (sin contar los atípicos)"]);
          if (c.datasetIndex === 1) return [" Promedio: " + soles(d.x), " Lo levantan los montos grandes si queda a la derecha de la mediana"];
          return [" Monto atípico: " + soles(d.x), " Está fuera de Q1 − 1,5·RIC y Q3 + 1,5·RIC"];
        },
      };
      o.plugins.legend.labels.filter = item => item.datasetIndex > 0;
      return {
        type: "scatter",
        data: {
          datasets: [
            { label: "Cinco números", data: cinco, pointRadius: 0, pointHoverRadius: 7, pointHitRadius: 12, pointBackgroundColor: "#111827", showLine: false },
            { label: "Promedio (◆)", data: filas.map(f => ({ x: f.res.media, y: f.fila, tipo: f.tipo })), pointStyle: "rectRot", pointRadius: 7, pointHoverRadius: 9, pointBackgroundColor: "#FFFFFF", pointBorderColor: "#111827", pointBorderWidth: 2, showLine: false },
            { label: "Montos atípicos", data: atipicos, pointRadius: 3.8, pointHoverRadius: 6, pointBackgroundColor: atipicos.map(p => aRgba(p.color, 0.55)), pointBorderColor: atipicos.map(p => p.color), pointBorderWidth: 1, showLine: false },
          ],
        },
        options: o, plugins: [pluginFondo, pluginDeco],
      };
    }

    /* ---------- 2. Curva de percentiles ---------- */
    if (estado.grafico === "percentiles") {
      const marcas = [];
      const datasets = [];
      series.forEach(s => {
        const valorEn = p => p <= 0 ? s.res.min : p >= 100 ? s.res.max : A().cuantil(s.res.ord, p / 100, estado.metodo);
        datasets.push({
          label: PALABRA[s.tipo].Varios, data: Array.from({ length: 101 }, (_, p) => ({ x: p, y: valorEn(p), tipo: s.tipo })),
          showLine: true, pointRadius: 0, pointHoverRadius: 5, pointHitRadius: 6, borderColor: s.color, backgroundColor: aRgba(s.color, 0.1), borderWidth: 3, fill: "origin", tension: 0.15,
        });
        [10, 25, 50, 75, 90].forEach(p => marcas.push({ p, valor: valorEn(p), color: s.color, texto: "P" + p + " " + soles(valorEn(p), true), tipo: s.tipo }));
      });
      datasets.push({
        label: "P10 · P25 · P50 · P75 · P90", data: marcas.map(m => ({ x: m.p, y: m.valor, tipo: m.tipo, marca: true })),
        showLine: false, pointRadius: 6.5, pointHoverRadius: 8, pointBackgroundColor: marcas.map(m => m.color), pointBorderColor: "#fff", pointBorderWidth: 2,
      });
      const techo = estado.verAtipicos ? undefined : Math.max.apply(null, series.map(s => Math.max(s.res.bigoteSup, s.res.percentil(95).valor))) * 1.1;
      const o = opcionesBase(GRAFICOS.percentiles.slice(3), quien + " · " + nombrePeriodo() + " · lee así: en el percentil 75, el 75% de tus montos es igual o menor" + (techo ? " · enfocado hasta el P95" : ""));
      o.scales = {
        x: { type: "linear", min: 0, max: 100, grid: { color: "#EEF0F4" }, title: { display: true, text: "Percentil (%)", font: { family: fuente, size: 12, weight: "600" } }, ticks: { stepSize: 10, callback: v => "P" + v, font: { family: fuente, size: 11 } } },
        y: ejeSoles("Monto (S/)", { beginAtZero: true, max: techo }),
      };
      o.interaction = { mode: "nearest", intersect: false };
      o.plugins.psDeco = { tipo: "percentiles", marcas, etiquetas: estado.etiquetas };
      o.plugins.tooltip.callbacks = {
        title: items => items.length ? "Percentil " + items[0].raw.x : "",
        label: c => [" " + PALABRA[c.raw.tipo].Varios + ": " + soles(c.raw.y), fraseMedida(c.raw.x, c.raw.y, c.raw.tipo), " y el " + (100 - c.raw.x) + "% es mayor"],
      };
      return { type: "scatter", data: { datasets }, options: o, plugins: [pluginFondo, pluginDeco] };
    }

    /* ---------- 3. Histograma con el 50% central ---------- */
    if (estado.grafico === "histograma") {
      const relativo = series.length > 1;
      const minV = Math.min.apply(null, series.map(s => s.res.min));
      const tope = estado.verAtipicos ? Math.max.apply(null, series.map(s => s.res.max)) : Math.max.apply(null, series.map(s => s.res.bigoteSup));
      const nTot = series.reduce((t, s) => t + s.res.n, 0);
      const k = Math.max(5, Math.min(14, Math.ceil(1 + 3.322 * Math.log10(nTot))));   // regla de Sturges
      const bruto = (tope - minV) / k || 1;
      const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
      const ancho = [1, 2, 2.5, 5, 10].map(f => f * mag).find(w => w >= bruto) || bruto;
      const inicio = Math.floor(minV / ancho) * ancho;
      const nClases = Math.max(1, Math.ceil((tope - inicio) / ancho + 1e-9));
      const hayResto = !estado.verAtipicos && series.some(s => s.res.max > inicio + ancho * nClases);
      const total = nClases + (hayResto ? 1 : 0);
      const datasets = series.map(s => {
        const cuenta = new Array(total).fill(0);
        s.res.ord.forEach(v => { cuenta[Math.min(total - 1, Math.max(0, Math.floor((v - inicio) / ancho)))]++; });
        return {
          label: PALABRA[s.tipo].Varios + (relativo ? " (% de sus montos)" : " (cantidad)"),
          data: cuenta.map((c, i) => ({ x: inicio + ancho * (i + 0.5), y: relativo ? +((c / s.res.n) * 100).toFixed(1) : c, c, resto: hayResto && i === total - 1, tipo: s.tipo })),
          backgroundColor: cuenta.map((c, i) => aRgba(s.color, hayResto && i === total - 1 ? 0.3 : relativo ? 0.55 : 0.78)),
          borderColor: s.color, borderWidth: 1, barPercentage: 1, categoryPercentage: relativo ? 0.9 : 1, grouped: relativo,
        };
      });
      const o = opcionesBase(GRAFICOS.histograma.slice(3), quien + " · " + nombrePeriodo() + " · franja = 50% central (de Q1 a Q3)" + (hayResto ? " · la última barra clara junta los montos atípicos" : ""));
      o.scales = {
        x: { type: "linear", min: inicio, max: inicio + ancho * total, offset: false, grid: { color: "#EEF0F4" }, title: { display: true, text: "Rango de montos (S/)", font: { family: fuente, size: 12, weight: "600" } }, ticks: { font: { family: fuente, size: 11 }, callback: v => formatearMonedaCompacta(v) } },
        y: { beginAtZero: true, grid: { color: "#EEF0F4" }, title: { display: true, text: relativo ? "% de los montos" : "Cantidad de montos", font: { family: fuente, size: 12, weight: "600" } }, ticks: { precision: 0, font: { family: fuente, size: 11 }, callback: v => (relativo ? v + "%" : v) } },
      };
      o.plugins.psDeco = { tipo: "bandas", etiquetas: estado.etiquetas, bandas: series.map(s => ({ q1: s.res.q1.valor, q2: s.res.q2.valor, q3: s.res.q3.valor, color: s.color, corto: s.tipo === "ingresos" ? "ing." : "egr." })) };
      o.plugins.tooltip.callbacks = {
        title: items => {
          if (!items.length) return "";
          const d = items[0].raw;
          return d.resto ? "Más de " + formatearMonedaCompacta(d.x - ancho / 2) + " (atípicos)" : "Entre " + formatearMonedaCompacta(d.x - ancho / 2) + " y " + formatearMonedaCompacta(d.x + ancho / 2);
        },
        label: c => " " + PALABRA[c.raw.tipo].Varios + ": " + c.raw.c + " monto(s)" + (relativo ? " · " + pct(c.raw.y) : ""),
      };
      return { type: "bar", data: { datasets }, options: o, plugins: [pluginFondo, pluginDeco] };
    }

    /* ---------- 4. Quintiles: cuánto dinero aporta cada 20% ---------- */
    if (estado.grafico === "quintiles") {
      const etiquetas = ["20% más chico", "2.º grupo", "3.er grupo", "4.º grupo", "20% más grande"];
      const datasets = series.map(s => ({
        label: PALABRA[s.tipo].Varios,
        data: s.res.aportes.map(g => +g.pct.toFixed(1)),
        $aportes: s.res.aportes, $res: s.res, $tipo: s.tipo,
        backgroundColor: s.res.aportes.map((g, i) => aRgba(s.color, 0.35 + i * 0.15)),
        borderColor: s.color, borderWidth: 1.5, borderRadius: 6, maxBarThickness: 70,
      }));
      const o = opcionesBase(GRAFICOS.quintiles.slice(3), quien + " · " + nombrePeriodo() + " · tus montos ordenados de menor a mayor y partidos en 5 grupos con la misma cantidad");
      o.scales = {
        x: { grid: { display: false }, ticks: { font: { family: fuente, size: 11.5, weight: "600" } } },
        y: { beginAtZero: true, grace: "12%", grid: { color: "#EEF0F4" }, title: { display: true, text: "% del dinero total", font: { family: fuente, size: 12, weight: "600" } }, ticks: { callback: v => v + "%", font: { family: fuente, size: 11 } } },
      };
      o.plugins.psDeco = { tipo: "quintiles", etiquetas: estado.etiquetas };
      o.plugins.tooltip.callbacks = {
        title: items => items.length ? etiquetas[items[0].dataIndex] : "",
        label: c => {
          const ds = c.dataset, g = ds.$aportes[c.dataIndex], r = ds.$res;
          const desde = c.dataIndex === 0 ? r.min : r.quintiles[c.dataIndex - 1].valor;
          const hasta = c.dataIndex === 4 ? r.max : r.quintiles[c.dataIndex].valor;
          return [" " + PALABRA[ds.$tipo].Varios + ": aportan " + pct(g.pct) + " del total", " " + g.cantidad + " montos, de " + soles(desde, true) + " a " + soles(hasta, true), " Suman " + soles(g.suma)];
        },
      };
      return { type: "bar", data: { labels: etiquetas, datasets }, options: o, plugins: [pluginFondo, pluginDeco] };
    }
    return null;
  }

  function redibujar() {
    if (!raiz) return;
    const marco = raiz.querySelector(".vm-lienzo");
    const disponible = raiz.querySelector(".vm-marco").clientWidth - 32;
    const ancho = disponible > 280 ? Math.min(estado.ancho, disponible) : estado.ancho;
    marco.style.width = ancho + "px";
    marco.style.height = (ancho < estado.ancho ? Math.max(320, Math.round(estado.alto * 0.9)) : estado.alto) + "px";
    if (grafico) { grafico.destroy(); grafico = null; }
    const cfg = construirConfig();
    const vacio = raiz.querySelector(".vm-vacio");
    vacio.hidden = !!cfg;
    if (cfg) grafico = new Chart(raiz.querySelector("#psCanvas"), (window.VistaSimple ? VistaSimple.embellecer(cfg) : cfg));
    else vacio.innerHTML = "No hay datos de " + (estado.tipo === "ambos" ? "ingresos ni egresos" : PALABRA[estado.tipo].varios) + " en " + nombrePeriodo() + ".<br>Elige otro período o importa tu Excel.";
    pintarEsencial();
    pintarAnalisis();
    pintarFormulas();
    pintarTabla();
  }

  /* ======================================================================
     LO ESENCIAL (vista simple): qué es un mes bueno o flojo para ti
     ====================================================================== */

  function pintarEsencial() {
    if (!window.VistaSimple) return;
    const bloques = [];
    const conjuntos = estado.tipo === "ambos" ? ["ingresos", "egresos", "resultado"] : [estado.tipo];
    const palabra = k => k.texto.toLowerCase();

    conjuntos.forEach(t => {
      const s = serieMensual(t);
      if (!s.meses.some(u => u.total !== null)) return;
      const res = s.res;
      const titulos = { ingresos: "¿Cuánto vende un mes bueno?", egresos: "¿Cuánto gasta un mes normal?", resultado: "¿Cuánto te queda en un mes bueno?" };
      if (!res || res.n < 2) {
        bloques.push({ titulo: titulos[t], nota: "Con menos de 2 meses completos todavía no se puede saber qué es un mes bueno o flojo. Sigue registrando." });
        return;
      }
      const q1 = res.q1.valor, q2 = res.q2.valor, q3 = res.q3.valor;
      const ultimo = s.usados[s.usados.length - 1];
      const k = semaforoMes(t, ultimo, res);
      const rp = A().rangoPercentil(res.ord, ultimo.total);
      const lineas = [];
      if (t === "ingresos") {
        lineas.push("La mitad de tus meses vende más de <b>" + soles(q2) + "</b> y la otra mitad, menos.");
        lineas.push("Un mes <b>bueno</b> vende más de <b>" + soles(q3) + "</b>. Un mes <b>flojo</b> vende menos de <b>" + soles(q1) + "</b>.");
      } else if (t === "egresos") {
        lineas.push("La mitad de tus meses gasta menos de <b>" + soles(q2) + "</b> y la otra mitad, más.");
        lineas.push("Un mes de gasto <b>alto</b> pasa de <b>" + soles(q3) + "</b>. Un mes de gasto <b>bajo</b> queda debajo de <b>" + soles(q1) + "</b>.");
      } else {
        lineas.push("La mitad de tus meses te deja más de <b>" + soles(q2) + "</b> y la otra mitad, menos.");
        lineas.push("Un mes <b>bueno</b> te deja más de <b>" + soles(q3) + "</b>. Un mes <b>flojo</b> te deja menos de <b>" + soles(q1) + "</b>" + (q1 < 0 ? " (un número negativo es pérdida)." : "."));
      }
      lineas.push("<b>" + esc(ultimo.nombre) + "</b> (tu último mes completo) fue un mes <b>" + palabra(k) + "</b>: " + soles(ultimo.total) + (t === "egresos" ? ", gastaste más que el " : ", superó al ") + Math.round(rp) + "% de tus meses.");

      const m = t === "resultado" ? null : serieMontos(t);
      if (m && m.res && m.res.n >= 10) {
        lineas.push(t === "ingresos"
          ? "El 20% de tus ventas más grandes trae el <b>" + pct(m.res.aportes[4].pct, 0) + "</b> de tu dinero: cuida a esos clientes."
          : "El 20% de tus pagos más grandes se lleva el <b>" + pct(m.res.aportes[4].pct, 0) + "</b> de lo que gastas: controla esos primero.");
      }

      const consejo = t === "ingresos"
        ? "apunta a vender más de <b>" + soles(q2) + "</b> cada mes. Si un mes va por debajo de <b>" + soles(q1) + "</b>, llama a tus clientes y cobra lo pendiente."
        : t === "egresos"
          ? "trata de gastar menos de <b>" + soles(q2) + "</b> al mes. Pasar de <b>" + soles(q3) + "</b> es una alerta: revisa los pagos grandes antes de repetirlos."
          : "guarda una reserva para los meses flojos" + (res.min < 0 ? ": tu peor mes perdió <b>" + soles(-res.min) + "</b>." : ".");

      const nota = res.n < 4 ? "Solo hay " + res.n + " meses completos con datos: es una referencia provisional. Con 6 o más ya es confiable." : (s.meses.some(u => u.excluido) ? "El mes en curso no se cuenta porque todavía está incompleto." : "");
      bloques.push({
        titulo: titulos[t], mide: "tus meses ordenados de menor a mayor, para ver qué es un mes normal, bueno o flojo.", nivel: { texto: ultimo.nombre + ": " + k.texto, color: k.color }, lineas,
        chipsTitulo: "¿Cómo le fue a cada mes?",
        chips: s.meses.filter(u => u.total !== null).map(u => { const kk = semaforoMes(t, u, res); return { mes: u.corto, texto: kk.texto, color: kk.color, titulo: u.nombre + ": " + soles(u.total) }; }),
        consejo, nota,
      });
    });
    VistaSimple.pintar(raiz, bloques);
  }

  /* ======================================================================
     ANÁLISIS: medidas, indicadores, interpretación, recomendaciones y
     consejos de decisión
     ====================================================================== */

  function tarjeta(t, v, nota, color) {
    return '<div class="vm-dato"><small>' + t + "</small><strong" + (color ? ' style="color:' + color + '"' : "") + ">" + v + "</strong><em>" + (nota || "") + "</em></div>";
  }
  function insignia(k, texto) { return '<span class="pj-nivel" style="--c:' + k.color + '">' + (texto || k.texto) + "</span>"; }

  // Qué tan concentrado está el dinero en el 20% de montos más grandes
  function concentracion(r) {
    const p = r.aportes[4].pct;
    if (p >= 70) return { k: SEM().malo, texto: "Muy concentrado", frase: "pocos montos grandes mueven casi todo el dinero" };
    if (p >= 50) return { k: SEM().regular, texto: "Concentrado", frase: "el 20% más grande mueve la mitad o más del dinero" };
    return { k: SEM().bueno, texto: "Repartido", frase: "el dinero se reparte entre montos de distintos tamaños" };
  }

  function chipsMensuales(tipo) {
    const s = serieMensual(tipo);
    const conDato = s.meses.filter(u => u.total !== null);
    if (!conDato.length) return { html: "", s, malos: [], buenos: [] };
    const conteo = {};
    const malos = [], buenos = [];
    const chips = conDato.map(u => {
      const k = semaforoMes(tipo, u, s.res);
      conteo[k.texto] = (conteo[k.texto] || 0) + 1;
      if (k === SEM().malo || k === SEM().muyMalo) malos.push(u);
      if (k === SEM().bueno || k === SEM().muyBueno) buenos.push(u);
      return '<span class="es-chip' + (u.mes === estado.mes ? " es-chip-activo" : "") + '" style="--c:' + k.color + '" title="' + esc(u.nombre + ": " + soles(u.total)) + '"><b>' + esc(u.corto) + "</b> " + k.icono + " " + k.texto + "</span>";
    }).join("");
    const leyenda = tipo === "egresos"
      ? "<b>Muy bueno</b> = gastaste poco (en el 25% más bajo, ≤ Q1) · <b>Bueno</b> = entre Q1 y la mediana · <b>Regular</b> = entre la mediana y Q3 · <b>Malo</b> = en el 25% que más gastó (≥ Q3) · <b>Muy malo</b> = gasto atípico (> Q3 + 1,5·RIC)."
      : tipo === "resultado"
        ? "<b>Bueno</b> = ganaste · <b>Muy bueno</b> = ganaste y quedas en el 25% más alto (≥ Q3) · <b>Malo</b> = perdiste · <b>Muy malo</b> = perdiste y quedas en el 25% más bajo (≤ Q1)."
        : "<b>Muy bueno</b> = en el 25% más alto (≥ Q3) · <b>Bueno</b> = entre la mediana y Q3 · <b>Regular</b> = entre Q1 y la mediana · <b>Malo</b> = en el 25% más bajo (≤ Q1) · <b>Muy malo</b> = atípico por debajo.";
    const html = '<h5 class="es-sub">Indicadores: ¿cada mes fue bueno o malo? · ' + esc(PALABRA[tipo].Varios.toLowerCase()) + "</h5>" +
      '<div class="es-chips">' + chips + "</div>" +
      '<p class="es-leyenda">' + leyenda + " Resumen: " + Object.keys(conteo).map(k => conteo[k] + " " + plural(k.toLowerCase(), conteo[k])).join(", ") + ".</p>";
    return { html, s, malos, buenos };
  }

  function bloqueMontos(s) {
    const r = s.res, w = PALABRA[s.tipo];
    const conc = concentracion(r);
    const p10 = r.percentil(10).valor, p90 = r.percentil(90).valor;
    let html = '<div class="pj-bloque ps-bloque" style="border-left:4px solid ' + s.color + '"><h4 class="pj-bloque-titulo"><i style="background:' + s.color + '"></i>' + w.Varios + " · " + nombrePeriodo() + " · " + r.n + " " + (r.n === 1 ? w.uno : w.varios) + " " + insignia(conc.k, conc.texto) + "</h4>";
    html += '<div class="vm-analisis-grid">' +
      tarjeta("Mínimo", soles(r.min), "el " + w.monto + " más chico") +
      tarjeta("Q1 · primer cuartil (25%)", soles(r.q1.valor), "el 25% es de este monto o menos", s.color) +
      tarjeta("Mediana · Q2 (50%)", soles(r.q2.valor), "la mitad es menor, la mitad mayor", "#1F2937") +
      tarjeta("Q3 · tercer cuartil (75%)", soles(r.q3.valor), "el 75% es de este monto o menos", s.color) +
      tarjeta("Máximo", soles(r.max), "el " + w.monto + " más grande") +
      tarjeta("Rango intercuartil (RIC)", soles(r.ric), "Q3 − Q1: ancho del 50% central") +
      tarjeta("P10 y P90 (deciles 1 y 9)", soles(p10, true) + " – " + soles(p90, true), "aquí está el 80% central") +
      tarjeta("Quintiles K1 · K2 · K3 · K4", r.quintiles.map(q => soles(q.valor, true)).join(" · "), "cortes cada 20%") +
      tarjeta("Promedio", soles(r.media), r.media > r.q2.valor * 1.15 ? "mayor que la mediana: lo levantan montos grandes" : "cerca de la mediana") +
      tarjeta("El 20% más grande aporta", pct(r.aportes[4].pct), "del dinero · el 20% más chico: " + pct(r.aportes[0].pct), conc.k.color) +
      tarjeta("Montos atípicos", String(r.atipicosAltos.length + r.atipicosBajos.length), r.atipicosAltos.length ? "mayores a " + soles(r.cercaSup, true) + " (Q3 + 1,5·RIC)" : "ninguno fuera de lo normal", r.atipicosAltos.length ? SEM().malo.color : SEM().bueno.color) +
      "</div>";

    // Interpretación, al estilo del ejemplo del curso
    const interp = "Con lo que concluiríamos que la mitad de tus " + w.montos + " de " + nombrePeriodo() + " es de <b>" + soles(r.q2.valor) + "</b> o menos (la mediana) y la otra mitad es mayor. " +
      "El <b>50% central</b> de tus " + w.montos + " está entre <b>" + soles(r.q1.valor) + "</b> (Q1) y <b>" + soles(r.q3.valor) + "</b> (Q3): ese es tu " + w.monto + " «normal». " +
      "Solo el 10% supera <b>" + soles(p90) + "</b> (P90). El 20% de " + w.montos + " más grandes " + (s.tipo === "egresos" ? "se lleva" : "aporta") + " el <b>" + pct(r.aportes[4].pct) + "</b> del dinero y el 20% más chico solo el " + pct(r.aportes[0].pct) + ". " +
      (s.tipo === "egresos"
        ? "Esta información te permite saber dónde se concentra tu gasto: controlando pocos pagos grandes controlas la mayor parte del dinero que sale."
        : "Esta información te permite saber qué tamaño de pedido es normal en tu negocio, fijar un pedido mínimo y reconocer a tiempo un pedido excepcional.");
    html += '<h5 class="es-sub">Interpretación</h5><p class="pj-parrafo es-interpretacion">' + interp + "</p>";

    // Recomendaciones (reglas generales: sirven para cualquier Excel)
    const rec = [];
    const k4 = r.quintiles[3].valor;
    if (s.tipo === "ingresos") {
      rec.push("<b>Pedido mínimo sugerido: " + soles(r.q1.valor) + "</b> (Q1). Las ventas más chicas son el 25% de tus operaciones pero aportan poco (" + pct(r.aportes[0].pct) + " el 20% más chico): agrúpalas por zona o revisa que cubran el despacho.");
      rec.push("Tus ventas de <b>" + soles(k4) + " o más</b> (el 20% más grande) aportan el <b>" + pct(r.aportes[4].pct) + "</b>: identifica a esos clientes y dales prioridad en despacho, atención y crédito.");
      if (r.media > r.q2.valor * 1.3) rec.push("Para metas y proyecciones usa la <b>mediana (" + soles(r.q2.valor) + ")</b>, no el promedio (" + soles(r.media) + "): unos pocos pedidos grandes inflan el promedio.");
      if (r.atipicosAltos.length) rec.push("<b>" + r.atipicosAltos.length + " " + (r.atipicosAltos.length === 1 ? "venta atípica" : "ventas atípicas") + "</b> (más de " + soles(r.cercaSup) + "): son extraordinarias; no cuentes con ellas para planificar un mes normal.");
    } else {
      rec.push("Controla primero los <b>pagos de " + soles(k4) + " o más</b> (el 20% más grande): se llevan el <b>" + pct(r.aportes[4].pct) + "</b> del gasto. Pide dos cotizaciones y prográmalos con anticipación.");
      rec.push("Tu pago típico (mediana) es <b>" + soles(r.q2.valor) + "</b>. Los pagos chicos (hasta " + soles(r.q1.valor) + ") son muchos pero pesan poco (" + pct(r.aportes[0].pct) + "): no gastes tiempo ahí.");
      if (r.atipicosAltos.length) {
        const grandes = s.lista.filter(m => m.valor > r.cercaSup).sort((a, b) => b.valor - a.valor).slice(0, 3);
        rec.push("<b>" + r.atipicosAltos.length + " " + (r.atipicosAltos.length === 1 ? "pago atípico" : "pagos atípicos") + "</b> (más de " + soles(r.cercaSup) + "). Revisa si fueron inversiones puntuales o gastos que se repiten:" +
          '<ul class="pj-lista">' + grandes.map(m => "<li>" + esc(formatearFecha(m.fecha)) + " · " + esc((m.descripcion || "—").slice(0, 60)) + " · <b>" + soles(m.valor) + "</b></li>").join("") + "</ul>");
      }
    }
    html += '<h5 class="es-sub">Recomendaciones</h5><ul class="es-rec">' + rec.map(t => "<li>" + t + "</li>").join("") + "</ul>";
    html += "</div>";
    return html;
  }

  // Consejos de decisión: cómo actuar con los datos que hay hoy
  function consejosDeDecision() {
    const an = A();
    const anio = estado.anio;
    const ultimo = an.ultimoMesConDatos(anio);
    if (ultimo < 0) return "";
    const incI = an.mesIncompleto("ingresos", anio), incE = an.mesIncompleto("egresos", anio);
    const enCurso = (incI && incI.mes === ultimo) || (incE && incE.mes === ultimo) ? ultimo : -1;
    // Último mes completo: el más reciente con ingresos y egresos que no esté en curso
    let completo = -1;
    for (let m = ultimo; m >= 0; m--) {
      const r = an.resumenMes(anio, m);
      if (m !== enCurso && r.hayIng && r.hayEgr) { completo = m; break; }
    }
    const c = [];
    const MT = an.MESES_TITULO;
    const sI = serieMensual("ingresos"), sE = serieMensual("egresos"), sR = serieMensual("resultado");
    if (completo >= 0) {
      const pI = an.posicionDelMes("ingresos", anio, completo, estado.metodo);
      const pE = an.posicionDelMes("egresos", anio, completo, estado.metodo);
      const r = an.resumenMes(anio, completo);
      const kI = pI.disponible ? pI.semaforo : SEM().sinDatos, kE = pE.disponible ? pE.semaforo : SEM().sinDatos;
      c.push("<b>" + MT[completo] + " (tu último mes completo):</b> ventas " + insignia(kI) + " y gastos " + insignia(kE) + " frente a tus otros meses; " +
        (r.resultado >= 0 ? "ganaste <b>" + soles(r.resultado) + "</b>." : "perdiste <b>" + soles(-r.resultado) + "</b>.") +
        (kI === SEM().malo || kI === SEM().muyMalo ? " <b>Acción:</b> prioriza vender: llama a tus clientes clave y ofrece despacho inmediato." : "") +
        (kE === SEM().malo || kE === SEM().muyMalo ? " <b>Acción:</b> revisa los pagos grandes de ese mes antes de repetirlos." : ""));
    }
    if (enCurso >= 0) {
      const eq = an.equilibrioDelMes(anio, enCurso);
      if (eq.disponible) {
        c.push("<b>" + MT[enCurso] + " (en curso):</b> " + (eq.alcanzado
          ? "ya cubriste tus egresos registrados: vas <b>" + soles(eq.r.resultado) + "</b> arriba. Cuida el gasto para no perder esa ventaja."
          : "para no perder te faltan <b>" + soles(eq.faltaVentas) + "</b> en ventas (≈ " + num(Math.ceil(eq.faltaLadrillos), 0) + " ladrillos a tu precio promedio). Es el mismo cálculo de «¿Cuánto me falta para no perder?»."));
      }
    }
    if (sI.res && sI.res.n >= 2) c.push("<b>Meta de ventas por mes:</b> supera <b>" + soles(sI.res.q2.valor) + "</b> (la mediana de tus meses) para un mes bueno y <b>" + soles(sI.res.q3.valor) + "</b> (Q3) para un mes muy bueno.");
    if (sE.res && sE.res.n >= 2) c.push("<b>Tope de gasto por mes:</b> quedarte debajo de <b>" + soles(sE.res.q2.valor) + "</b> es un mes bueno; pasar <b>" + soles(sE.res.q3.valor) + "</b> (Q3) es señal de alerta.");
    if (sR.res && sR.res.n >= 2) {
      const peor = sR.res.min;
      c.push(peor < 0
        ? "<b>Reserva de caja:</b> tu peor mes perdió <b>" + soles(-peor) + "</b>. Guarda al menos esa cantidad para pagar planilla y proveedores si se repite."
        : "<b>Reserva de caja:</b> todos tus meses completos terminaron con ganancia; aun así, guarda al menos " + soles(sE.res ? sE.res.q1.valor * 0.25 : 0) + " (una semana de gastos de un mes bajo).");
    }
    const mI = serieMontos("ingresos");
    if (mI.res) c.push("<b>Dónde poner tu esfuerzo de venta:</b> los pedidos de <b>" + soles(mI.res.quintiles[3].valor) + " o más</b> son el 20% de tus ventas y traen el " + pct(mI.res.aportes[4].pct) + " del dinero.");
    if (!c.length) return "";
    return '<div class="pj-bloque ps-bloque-consejos"><h4 class="pj-bloque-titulo"><i style="background:linear-gradient(135deg,#16A34A,#2563EB)"></i>Consejos de decisión · ¿cómo actuar con tus datos de hoy?</h4>' +
      '<ul class="es-rec ps-consejos">' + c.map(t => "<li>" + t + "</li>").join("") + "</ul></div>";
  }

  function pintarAnalisis() {
    const cont = raiz.querySelector("#psAnalisis");
    const series = tiposMontos().map(serieMontos);
    let html = "";

    series.forEach(s => {
      if (!s.res) html += '<p class="pj-parrafo">No hay ' + PALABRA[s.tipo].varios + " en " + nombrePeriodo() + ".</p>";
      else html += bloqueMontos(s);
    });

    // Indicadores de cada mes (con sus propios cuartiles)
    const tiposMes = estado.tipo === "ambos" ? ["ingresos", "egresos", "resultado"] : [estado.tipo];
    let chipsHtml = "";
    tiposMes.forEach(t => { chipsHtml += chipsMensuales(t).html; });
    if (chipsHtml) html += '<div class="pj-bloque ps-bloque-meses">' + chipsHtml +
      (estado.mes >= 0 ? '<p class="es-leyenda">Viendo solo los montos de <b>' + esc(A().MESES_TITULO[estado.mes]) + "</b>; los indicadores comparan el total de cada mes con los demás meses de " + estado.anio + ".</p>" : "") + "</div>";

    html += consejosDeDecision();

    // Notas y calidad del dato
    const notas = [];
    notas.push("Método: " + (estado.metodo === "inc" ? "Excel CUARTIL.INC / StatsUnlock (h = (n − 1)p + 1)." : "fórmula del curso W = j(n + 1) ÷ N (igual a CUARTIL.EXC de Excel)."));
    series.forEach(s => { if (s.res && s.res.n < 10) notas.push("Pocos " + PALABRA[s.tipo].varios + " (" + s.res.n + "): tómalo como referencia."); });
    const inc = ["ingresos", "egresos"].map(t => ({ t, m: A().mesIncompleto(t, estado.anio) })).filter(x => x.m);
    if (inc.length && estado.excluirIncompletos) notas.push(inc.map(x => A().MESES_TITULO[x.m.mes] + " de " + x.t + " parece incompleto (último registro del " + formatearFecha(x.m.fecha) + ")").join("; ") + ": no se cuenta en la posición de cada mes, pero sus montos sí están en los cuartiles de montos.");
    const avisos = series.reduce((t, s) => t + s.lista.filter(m => m.aviso).length, 0);
    if (avisos) notas.push("Incluye " + avisos + " egreso(s) marcados «⚠ Revisar moneda» (posible monto en dólares).");
    notas.push("En «Estabilidad» un mes se compara con el promedio ± desviación; aquí, con la mediana y los cuartiles. Por eso un mes puede salir «regular» aquí y «bueno» allá: los totales son los mismos, cambia la regla.");
    html += '<p class="pj-notas">' + notas.join(" ") + "</p>";
    cont.innerHTML = html;
  }

  /* ======================================================================
     FÓRMULAS: resolución paso a paso con tus datos (como el ejemplo del curso)
     ====================================================================== */

  function filaCuantil(nombre, d, n) {
    const W = d.W;
    return "<tr><td><b>" + nombre + "</b></td><td>" + d.j + "</td><td>" + d.N + "</td><td>" + (estado.metodo === "inc" ? num(W, 2) : d.j + "(" + n + "+1)/" + d.N + " = " + num(W, 2)) + "</td><td>" + d.y + "</td><td>" + num(d.z, 2) + "</td><td>" + soles(d.xy) + "</td><td>" + soles(d.xy1) + '</td><td><b>' + soles(d.valor) + "</b>" + (d.limite ? " <small>(" + (d.limite === "min" ? "antes del 1.er dato: mínimo" : "después del último: máximo") + ")</small>" : "") + "</td></tr>";
  }

  function pintarFormulas() {
    const tarjetaF = raiz.querySelector("#psTarjetaFormulas");
    tarjetaF.hidden = !verFormulas;
    if (!verFormulas) return;
    const cont = raiz.querySelector("#psFormulas");
    const s = serieMontos(tiposMontos()[0]);
    const curso = estado.metodo !== "inc";

    let res = "";
    if (s.res) {
      const r = s.res, n = r.n, ord = r.ord;
      const muestra = n > 12 ? ord.slice(0, 5).map(v => num(v, 0)).join(", ") + ", … , " + ord.slice(-5).map(v => num(v, 0)).join(", ") : ord.map(v => num(v, 0)).join(", ");
      const q1 = r.q1;
      const filas = [["Q1 (cuartil 1)", r.q1], ["Q2 = Mediana", r.q2], ["Q3 (cuartil 3)", r.q3]]
        .concat(r.quintiles.map((q, i) => ["K" + (i + 1) + " (quintil " + (i + 1) + ")", q]))
        .concat([["D1 (decil 1)", r.deciles[0]], ["D9 (decil 9)", r.deciles[8]], ["P10 (percentil 10)", r.percentil(10)], ["P90 (percentil 90)", r.percentil(90)], ["P95 (percentil 95)", r.percentil(95)]]);
      res =
        '<h4 class="pj-sub">Resolución con tus ' + PALABRA[s.tipo].varios + " de " + nombrePeriodo() + "</h4>" +
        '<div class="es-paso"><span>1. Ordenamos los ' + n + " montos de menor a mayor:</span><code>" + muestra + "</code></div>" +
        '<div class="es-paso"><span>2. Posición del primer cuartil (j = 1, N = 4):</span><code>' + (curso ? "W = 1(" + n + " + 1) ÷ 4 = <b>" + num(q1.W, 2) + "</b>" : "h = (" + n + " − 1)(0,25) + 1 = <b>" + num(q1.W, 2) + "</b>") + " → y = " + q1.y + " , z = " + num(q1.z, 2) + "</code></div>" +
        '<div class="es-paso"><span>3. Valor del primer cuartil:</span><code>Q₁ = x(' + q1.y + ") + " + num(q1.z, 2) + "·[x(" + (q1.y + 1) + ") − x(" + q1.y + ")] = " + num(q1.xy, 2) + " + " + num(q1.z, 2) + "·(" + num(q1.xy1, 2) + " − " + num(q1.xy, 2) + ") = <b>" + soles(q1.valor) + "</b></code></div>" +
        '<p class="pj-parrafo">Igual se calculan las demás medidas; solo cambian <b>j</b> y <b>N</b>:</p>' +
        '<div class="vm-tabla-envoltura"><table class="vm-tabla pj-tabla-ejemplo ps-tabla-formula"><thead><tr><th>Medida</th><th>j</th><th>N</th><th>' + (curso ? "W = j(n+1)/N" : "h = (n−1)p+1") + "</th><th>y</th><th>z</th><th>x(y)</th><th>x(y+1)</th><th>Resultado</th></tr></thead><tbody>" +
        filas.map(f => filaCuantil(f[0], f[1], n)).join("") + "</tbody></table></div>" +
        '<div class="es-paso"><span>4. Rango intercuartil y límites de lo normal:</span><code>RIC = Q₃ − Q₁ = ' + soles(r.q3.valor) + " − " + soles(r.q1.valor) + " = <b>" + soles(r.ric) + "</b> · Q₁ − 1,5·RIC = " + soles(r.cercaInf) + " · Q₃ + 1,5·RIC = <b>" + soles(r.cercaSup) + "</b></code></div>" +
        (r.cercaInf < 0 ? '<p class="pj-notas">El límite de abajo sale negativo y no existen montos negativos: por eso no hay atípicos por abajo. Lo normal va de ' + soles(r.min) + " a " + soles(r.cercaSup) + ".</p>" : "");
    }

    cont.innerHTML =
      '<p class="pj-parrafo"><b>¿Qué son?</b> Las <b>medidas de posición</b> ordenan tus montos de menor a mayor y los parten en grupos con la misma cantidad de datos: ' +
      "los <b>cuartiles</b> en 4 (Q1, Q2, Q3), los <b>quintiles</b> en 5 (K1 a K4), los <b>deciles</b> en 10 (D1 a D9) y los <b>percentiles</b> en 100 (P1 a P99). " +
      "La <b>mediana</b> es el Q2 = D5 = P50: el monto del medio. A diferencia del promedio, <b>no se deja arrastrar</b> por unos pocos montos muy grandes.</p>" +
      '<div class="pj-formulas">' +
      '<div class="pj-formula"><span>Posición (fórmula del curso)</span><code>W = j(n + 1) ÷ N</code><em>n = cantidad de datos · N = 4, 5, 10 o 100 · j = la medida que buscas (1, 2, 3…)</em></div>' +
      '<div class="pj-formula"><span>Valor de la medida</span><code>Cⱼ = x(y) + z·[x(y+1) − x(y)]</code><em>W = y,z → y = parte entera, z = parte decimal · x(y) = el dato en la posición y</em></div>' +
      '<div class="pj-formula"><span>Rango intercuartil</span><code>RIC = Q₃ − Q₁</code><em>el ancho del 50% central de tus datos</em></div>' +
      '<div class="pj-formula"><span>Montos atípicos (Tukey)</span><code>x &lt; Q₁ − 1,5·RIC  ó  x &gt; Q₃ + 1,5·RIC</code><em>fuera de estos límites el monto es excepcional</em></div>' +
      '<div class="pj-formula"><span>Rango percentil de un dato</span><code>PR = (menores + ½·iguales) ÷ n × 100</code><em>qué % de tus datos queda por debajo</em></div>' +
      '<div class="pj-formula"><span>En Excel</span><code>=CUARTIL.EXC(rango; 1)</code><em>=PERCENTIL.EXC(rango; 0,9) · la versión .INC (StatsUnlock) usa h = (n − 1)p + 1</em></div>' +
      "</div>" + res +
      '<h4 class="pj-sub">Cómo leer la posición de un mes</h4>' +
      '<div class="pj-guia">' +
      [[SEM().muyBueno, "≥ Q3", "ventas en el 25% más alto (en egresos: gasto ≤ Q1)"], [SEM().bueno, "Mediana a Q3", "mejor que la mitad de tus meses"], [SEM().regular, "Q1 a mediana", "peor que la mitad, pero dentro de lo normal"], [SEM().malo, "≤ Q1", "en el 25% más bajo (en egresos: gasto ≥ Q3)"], [SEM().muyMalo, "Atípico", "fuera de los límites Q1 − 1,5·RIC o Q3 + 1,5·RIC"]]
        .map(g => '<div class="pj-guia-fila"><span class="pj-nivel" style="--c:' + g[0].color + '">' + g[0].icono + " " + g[0].texto + "</span><b>" + g[1] + "</b><em>" + g[2] + "</em></div>").join("") +
      "</div>" +
      '<p class="pj-notas">Con la fórmula del curso, si W cae antes del primer dato se toma el mínimo y si cae después del último, el máximo. StatsUnlock y CUARTIL.INC de Excel usan h = (n − 1)p + 1; con muchos datos ambos métodos dan casi lo mismo. Puedes cambiar el método en la pestaña Análisis.</p>';
  }

  /* ======================================================================
     TABLAS: mes a mes y percentiles
     ====================================================================== */

  function pintarTabla() {
    const cont = raiz.querySelector("#psTabla");
    raiz.querySelectorAll(".ps-hoja").forEach(b => b.setAttribute("aria-pressed", b.dataset.hoja === hoja ? "true" : "false"));
    if (hoja === "percentiles") {
      const series = tiposMontos().map(serieMontos).filter(s => s.res);
      if (!series.length) { cont.innerHTML = '<p class="vm-sin-dato">Sin datos</p>'; return; }
      const ps = [5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95];
      const nombre = p => p === 25 ? "P25 = Q1" : p === 50 ? "P50 = Mediana" : p === 75 ? "P75 = Q3" : p % 10 === 0 ? "P" + p + " = D" + p / 10 + (p % 20 === 0 ? " = K" + p / 20 : "") : "P" + p;
      cont.innerHTML = '<div class="vm-tabla-envoltura"><table class="vm-tabla pj-tabla es-tabla"><thead><tr><th>Medida</th>' + series.map(s => '<th style="color:' + s.color + '">' + PALABRA[s.tipo].Varios + "</th>").join("") + "<th>Se lee</th></tr></thead><tbody>" +
        ps.map(p => "<tr><td>" + nombre(p) + "</td>" + series.map(s => "<td>" + soles(s.res.percentil(p).valor) + "</td>").join("") + "<td>el " + p + "% de los montos es igual o menor</td></tr>").join("") +
        '<tr class="es-fila-resumen"><td>Mínimo · Máximo</td>' + series.map(s => "<td>" + soles(s.res.min, true) + " · " + soles(s.res.max, true) + "</td>").join("") + "<td>extremos</td></tr>" +
        '<tr class="es-fila-resumen"><td>Promedio</td>' + series.map(s => "<td>" + soles(s.res.media) + "</td>").join("") + "<td>para comparar con la mediana</td></tr>" +
        "</tbody></table></div>";
      return;
    }
    const tipo = tipoMensual();
    const s = serieMensual(tipo);
    const filas = s.meses.map(u => {
      if (u.total === null) return '<tr class="es-fila" data-mes="' + u.mes + '"><td>' + esc(u.nombre) + '</td><td class="vm-sin-dato" colspan="4">—</td></tr>';
      const k = semaforoMes(tipo, u, s.res);
      const rp = s.res && !u.excluido ? A().rangoPercentil(s.res.ord, u.total) : null;
      const cuartil = !s.res || u.excluido ? "—" : u.total <= s.res.q1.valor ? "Q1 (25% más bajo)" : u.total <= s.res.q2.valor ? "Q2 (bajo la mediana)" : u.total <= s.res.q3.valor ? "Q3 (sobre la mediana)" : "Q4 (25% más alto)";
      return '<tr class="es-fila' + (u.mes === estado.mes ? " pj-fila-activa" : "") + '" data-mes="' + u.mes + '"><td>' + esc(u.nombre) + (u.excluido ? " <small>(incompleto)</small>" : "") + "</td><td>" + soles(u.total) + "</td><td>" + (rp !== null ? "P" + Math.round(rp) : "—") + "</td><td>" + cuartil + '</td><td><span class="es-chip" style="--c:' + k.color + '">' + k.icono + " " + k.texto + "</span></td></tr>";
    }).join("");
    const pie = s.res
      ? '<tr class="es-fila-resumen"><td>Q1 · Mediana · Q3</td><td colspan="4">' + soles(s.res.q1.valor) + " · " + soles(s.res.q2.valor) + " · " + soles(s.res.q3.valor) + "</td></tr>" +
        '<tr class="es-fila-resumen"><td>Meses contados</td><td colspan="4">' + s.res.n + (s.meses.some(u => u.excluido) ? " (sin el mes incompleto)" : "") + "</td></tr>"
      : "";
    cont.innerHTML = '<div class="vm-tabla-envoltura"><table class="vm-tabla pj-tabla es-tabla"><thead><tr><th>Mes</th><th>' + (tipo === "resultado" ? "Resultado" : "Total") + "</th><th>Percentil</th><th>Cuartil</th><th>Indicador</th></tr></thead><tbody>" +
      filas + pie + "</tbody></table></div>";
  }

  /* ======================================================================
     ARCHIVOS
     ====================================================================== */

  function nombreArchivo(ext) {
    return "medidas-de-posicion-" + estado.tipo + "-" + (estado.mes < 0 ? "anio" : MESES[estado.mes].toLowerCase()) + "-" + estado.anio + "." + ext;
  }

  function descargarImagen() {
    if (!grafico) { avisar("No hay gráfico para descargar todavía.", "error"); return; }
    const a = document.createElement("a");
    a.href = grafico.toBase64Image("image/png", 1);
    a.download = nombreArchivo("png");
    document.body.appendChild(a); a.click(); a.remove();
  }

  function compartirImagen() {
    if (!grafico) { avisar("No hay gráfico para compartir todavía.", "error"); return; }
    grafico.canvas.toBlob(blob => {
      if (blob && navigator.clipboard && window.ClipboardItem) {
        navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
          .then(() => avisar("Imagen copiada. Pégala en WhatsApp, Word o correo.", "success"))
          .catch(() => avisar("Tu navegador no permitió copiar. Usa «Descargar».", "error"));
      } else avisar("Tu navegador no permite copiar imágenes. Usa «Descargar».", "error");
    });
  }

  async function descargarExcel() {
    if (typeof XLSX === "undefined" || typeof descargarLibro !== "function") { avisar("No se pudo preparar el Excel.", "error"); return; }
    const wb = XLSX.utils.book_new();
    ["ingresos", "egresos"].forEach(t => {
      const s = serieMontos(t);
      const filas = [["Medida (" + nombrePeriodo() + ")", "Valor (S/)"]];
      if (s.res) {
        const r = s.res;
        filas.push(["Cantidad de montos", r.n], ["Mínimo", r.min], ["Q1", r.q1.valor], ["Mediana (Q2)", r.q2.valor], ["Q3", r.q3.valor], ["Máximo", r.max], ["Rango intercuartil", r.ric], ["Promedio", r.media]);
        r.quintiles.forEach((q, i) => filas.push(["K" + (i + 1), q.valor]));
        r.deciles.forEach((q, i) => filas.push(["D" + (i + 1), q.valor]));
        [5, 10, 25, 50, 75, 90, 95].forEach(p => filas.push(["P" + p, r.percentil(p).valor]));
        r.aportes.forEach(g => filas.push(["Aporte del grupo " + g.grupo + " (20%) en %", Number(g.pct.toFixed(2))]));
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), PALABRA[t].Varios);
    });
    ["ingresos", "egresos", "resultado"].forEach(t => {
      const s = serieMensual(t);
      const filas = [["Mes", "Total (S/)", "Percentil", "Indicador"]];
      s.meses.filter(u => u.total !== null).forEach(u => {
        const k = semaforoMes(t, u, s.res);
        filas.push([u.nombre, u.total, s.res && !u.excluido ? Math.round(A().rangoPercentil(s.res.ord, u.total)) : "", k ? k.texto : ""]);
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), ("Meses " + (t === "resultado" ? "resultado" : t)).slice(0, 31));
    });
    if (await descargarLibro(wb, nombreArchivo("xlsx"))) avisar("✅ Resultados guardados en Excel.", "success");
  }

  function copiarResumen() {
    const texto = raiz.querySelector("#psAnalisis").innerText.trim();
    if (!navigator.clipboard) { avisar("Tu navegador no permitió copiar.", "error"); return; }
    navigator.clipboard.writeText(TITULO + "\n\n" + texto)
      .then(() => avisar("Resumen copiado. Pégalo en Word, WhatsApp o correo.", "success"))
      .catch(() => avisar("Tu navegador no permitió copiar.", "error"));
  }

  /* ======================================================================
     VENTANA
     ====================================================================== */

  function opciones(o, sel) { return Object.keys(o).map(k => '<option value="' + k + '"' + (k === sel ? " selected" : "") + ">" + (typeof o[k] === "string" ? o[k] : o[k].nombre) + "</option>").join(""); }
  function menu(id, t, cuerpo) { return '<div class="vm-menu" data-menu="' + id + '"><button type="button" class="vm-menu-boton" aria-haspopup="true" aria-expanded="false">' + t + '</button><div class="vm-menu-lista" hidden>' + cuerpo + "</div></div>"; }
  function item(accion, t) { return '<button type="button" class="vm-menu-item" data-accion="' + accion + '">' + t + "</button>"; }
  function interruptor(k, t) { return '<div class="vm-seccion"><div class="vm-seccion-cab"><span class="pj-interruptor-texto">' + t + '</span><label class="vm-interruptor" title="' + t + '"><input type="checkbox" data-k="' + k + '" aria-label="' + t + '"><i></i></label></div></div>'; }
  function campoNumero(k, t, min, max, paso) {
    return '<div class="vm-campo"><span>' + t + '</span><div class="vm-fila"><input type="range" data-k="' + k + '" min="' + min + '" max="' + max + '" step="' + paso + '"><input type="number" data-k="' + k + '" min="' + min + '" max="' + max + '" step="' + paso + '"></div></div>';
  }

  function construirVentana() {
    const div = document.createElement("div");
    div.className = "vm-overlay pj-overlay ps-overlay";
    div.hidden = true;
    div.setAttribute("role", "dialog");
    div.setAttribute("aria-modal", "true");
    div.setAttribute("aria-label", TITULO);
    div.innerHTML =
      '<div class="vm-ventana">' +
      '<header class="vm-barra"><div class="vm-marca pj-marca ps-marca"><i></i><span>' + TITULO + "</span></div>" +
      '<nav class="vm-menus" aria-label="Menús">' +
      menu("archivo", "Archivo", item("png", "Descargar imagen (PNG)") + item("excel", "Descargar resultados (Excel)") + item("imprimir", "Imprimir") + '<div class="vm-menu-sep"></div>' + item("cerrar", "Cerrar ventana <small>Esc</small>")) +
      menu("editar", "Editar", item("copiar", "Copiar resumen del análisis") + item("restablecer", "Restablecer ajustes")) +
      menu("datos", "Datos", item("ver-ingresos", "Ver ingresos") + item("ver-egresos", "Ver egresos") + item("ver-ambos", "Ver ambos (y el resultado por mes)") + '<div class="vm-menu-sep"></div>' + item("todo-anio", "Todo el año") + item("mes-sistema", "Mes elegido en el sistema") + '<div class="vm-menu-sep"></div>' + item("actualizar", "Actualizar desde mis registros") + item("ir-tabla", "Ir a la tabla")) +
      menu("vista", "Vista", Object.keys(GRAFICOS).map(k => '<button type="button" class="vm-menu-item" data-grafico="' + k + '">' + GRAFICOS[k] + "</button>").join("") + '<div class="vm-menu-sep"></div>' + item("ver-formulas", "Mostrar / ocultar fórmulas") + item("pantalla-completa", "Pantalla completa") + item("parejos", "Abrir «¿Mis ventas y pagos son parecidos?»") + item("estabilidad", "Abrir «Estabilidad»")) +
      menu("temas", "Temas", Object.keys(TEMAS).map(k => '<button type="button" class="vm-menu-item" data-tema="' + k + '">' + TEMAS[k].nombre + "</button>").join("")) +
      menu("ayuda", "Ayuda", '<p class="vm-ayuda-texto"><b>¿Qué mide esto?</b> Dónde cae cada monto cuando los ordenas de menor a mayor. La <b>mediana</b> es el del medio; el <b>Q1</b> deja abajo al 25% y el <b>Q3</b> al 75%. ' +
        "Los <b>quintiles</b> parten en 5 grupos y muestran cuánto dinero aporta cada 20%.<br><br>Los <b>indicadores</b> dicen si cada mes fue bueno (verde) o malo (rojo) frente a tus demás meses. <b>Ambos</b> compara ingresos con egresos y, por mes, usa el resultado (ingresos − egresos). Nada de lo que cambies aquí modifica tus datos.</p>") +
      "</nav><button type=\"button\" class=\"vm-cerrar\" data-accion=\"cerrar\" aria-label=\"Cerrar ventana\">✕</button></header>" +

      '<div class="vm-cuerpo"><aside class="vm-panel" aria-label="Ajustes del análisis">' +
      '<div class="vm-pestanas" role="tablist"><button type="button" class="vm-pestana" role="tab" aria-selected="true" data-pestana="analisis">Análisis</button><button type="button" class="vm-pestana" role="tab" aria-selected="false" data-pestana="formato">Formato</button></div>' +
      '<div class="vm-pagina" data-pagina="analisis">' +
      '<div class="vm-campo"><span class="vm-campo-etiqueta">¿Qué quieres analizar?</span><div class="pj-tipos ps-tipos" role="group" aria-label="Qué analizar">' +
      '<button type="button" class="pj-tipo" data-tipo="ingresos"><i></i>Ingresos</button>' +
      '<button type="button" class="pj-tipo" data-tipo="egresos"><i></i>Egresos</button>' +
      '<button type="button" class="pj-tipo" data-tipo="ambos"><i></i>Ambos</button></div>' +
      '<small class="es-nota-tipo">«Los dos» compara lo que entra con lo que sale; por mes, lo que te queda (ingresos − egresos)</small></div>' +
      '<label class="vm-campo"><span>Año</span><select data-k="anio" id="psAnio"></select></label>' +
      '<label class="vm-campo"><span>Período (montos)</span><select data-k="mes" id="psMes"></select></label>' +
      '<label class="vm-campo"><span>Gráfico</span><select data-k="grafico">' + opciones(GRAFICOS, estado.grafico) + "</select></label>" +
      '<label class="vm-campo"><span>Método de cálculo</span><select data-k="metodo">' + opciones(METODOS, estado.metodo) + "</select></label>" +
      '<label class="vm-campo"><span>Decimales</span><select data-k="decimales"><option value="0">Sin decimales</option><option value="2">2 decimales</option></select></label>' +
      interruptor("verAtipicos", "Mostrar todos los montos atípicos en el gráfico") +
      interruptor("excluirIncompletos", "No contar el último mes si está incompleto") +
      '<p class="vm-pie-nota pj-nota-panel">Los datos salen de tu «Registro del mes» (ingresos y egresos) y se actualizan cada vez que abres esta ventana.</p></div>' +
      '<div class="vm-pagina" data-pagina="formato" hidden>' +
      '<label class="vm-campo"><span>Tema de colores</span><select data-k="tema">' + opciones(TEMAS, estado.tema) + "</select></label>" +
      campoNumero("ancho", "Ancho (px)", 400, 1400, 10) + campoNumero("alto", "Altura (px)", 260, 800, 10) +
      '<label class="vm-campo"><span>Tipo de letra</span><select data-k="fuente">' + FUENTES.map(f => '<option value="' + f + '">' + f + "</option>").join("") + "</select></label>" +
      '<label class="vm-campo"><span>Color de fondo del gráfico</span><input type="color" data-k="fondo"></label>' +
      interruptor("etiquetas", "Mostrar textos sobre el gráfico") + interruptor("leyenda", "Mostrar leyenda") + interruptor("animacion", "Animación") +
      "</div></aside>" +

      '<main class="vm-centro">' +
      '<section class="vm-tarjeta" aria-label="Gráfico"><div class="vm-marco"><div class="vm-lienzo"><canvas id="psCanvas"></canvas><div class="vm-vacio" hidden></div></div></div>' +
      '<div class="vm-acciones"><button type="button" class="vm-boton" data-accion="compartir">Compartir</button><button type="button" class="vm-boton vm-boton-negro" data-accion="png">Descargar</button></div></section>' +
      '<section class="vm-tarjeta" aria-label="Análisis estadístico"><h3>Análisis estadístico</h3><div id="psAnalisis"></div></section>' +
      '<section class="vm-tarjeta" id="psTarjetaFormulas" aria-label="Cómo se calcula"><h3>¿Cómo se calcula? Cuartiles, quintiles, deciles y percentiles paso a paso</h3><div id="psFormulas"></div></section>' +
      '<section class="vm-tarjeta" id="psTarjetaTabla" aria-label="Tabla"><div class="vm-hojas"><button type="button" class="vm-hoja ps-hoja" data-hoja="meses">Mes a mes</button><button type="button" class="vm-hoja ps-hoja" data-hoja="percentiles">Percentiles</button><span class="vm-hoja-nota">Haz clic en un mes para ver solo sus montos · solo lectura</span></div><div id="psTabla"></div></section>' +
      "</main></div></div>";
    document.body.appendChild(div);
    if (window.VistaSimple) {
      VistaSimple.instalar(div, {
        idEsencial: "psEsencial",
        mantener: "#psAnio",
        alAlternar: detalles => { if (!detalles) { estado.grafico = "meses"; estado.mes = -1; } sincronizarControles(); redibujar(); },
        ayudas: [
          { sel: "#psMes", texto: "Elige todo el año o un mes para ver solo los montos de ese mes." },
          { sel: "select[data-k='grafico']", texto: "Cada gráfico muestra lo mismo desde otro ángulo. El de «cada mes» es el más fácil de leer." },
          { sel: "select[data-k='metodo']", texto: "Cómo se calculan los cortes. Con muchos datos los dos métodos dan casi lo mismo." },
          { sel: "select[data-k='decimales']", texto: "Cuántos decimales se muestran en los montos." },
          { sel: "input[data-k='verAtipicos']", texto: "Los montos atípicos son los muy distintos al resto (por ejemplo, un pago muy grande). Normalmente el gráfico se enfoca en los montos normales." },
          { sel: "input[data-k='excluirIncompletos']", texto: "Un mes incompleto (con pocos días registrados) puede parecer flojo sin serlo; por eso no se cuenta." },
        ],
      });
    }
    return div;
  }

  function sincronizarControles() {
    raiz.querySelectorAll(".pj-tipo").forEach(b => {
      b.setAttribute("aria-pressed", b.dataset.tipo === estado.tipo ? "true" : "false");
      const t = TEMAS[estado.tema];
      b.querySelector("i").style.background = b.dataset.tipo === "ambos" ? "linear-gradient(90deg," + t.ingresos + " 0 50%," + t.egresos + " 50% 100%)" : t[b.dataset.tipo];
    });
    const anios = A().aniosDisponibles();
    raiz.querySelector("#psAnio").innerHTML = (anios.length ? anios : [estado.anio]).map(a => '<option value="' + a + '">' + a + "</option>").join("");
    const conDatos = MESES.map((_, m) => {
      const r = A().resumenMes(estado.anio, m);
      return estado.tipo === "ingresos" ? r.hayIng : estado.tipo === "egresos" ? r.hayEgr : r.hayDatos;
    });
    raiz.querySelector("#psMes").innerHTML = '<option value="-1">Todo el año</option>' +
      A().MESES_TITULO.map((n, m) => '<option value="' + m + '">' + n + (conDatos[m] ? "" : " · sin datos") + "</option>").join("");
    raiz.querySelectorAll("[data-k]").forEach(c => {
      const v = estado[c.dataset.k];
      if (c.type === "checkbox") c.checked = !!v; else c.value = v === null || v === undefined ? "" : String(v);
    });
  }

  function alCambiar(e) {
    const c = e.target, k = c.dataset.k;
    if (!k) return;
    let v = c.type === "checkbox" ? c.checked : c.value;
    if (["anio", "mes", "decimales", "ancho", "alto"].indexOf(k) !== -1) { if (c.value === "") return; v = Number(c.value); }
    estado[k] = v;
    sincronizarControles();
    redibujar();
  }

  function cerrarMenus() {
    raiz.querySelectorAll(".vm-menu").forEach(m => {
      m.classList.remove("vm-menu-abierto");
      m.querySelector(".vm-menu-lista").hidden = true;
      m.querySelector(".vm-menu-boton").setAttribute("aria-expanded", "false");
    });
  }

  function ponerTipo(t) { estado.tipo = t; sincronizarControles(); redibujar(); }

  function ejecutar(a) {
    switch (a) {
      case "png": descargarImagen(); break;
      case "excel": descargarExcel(); break;
      case "imprimir": window.print(); break;
      case "cerrar": cerrarPosicion(); break;
      case "compartir": compartirImagen(); break;
      case "copiar": copiarResumen(); break;
      case "restablecer": { const t = estado.tipo, an = estado.anio; estado = clonar(ESTADO_INICIAL); estado.tipo = t; estado.anio = an; sincronizarControles(); redibujar(); avisar("Ajustes restablecidos.", "success"); break; }
      case "ver-ingresos": ponerTipo("ingresos"); break;
      case "ver-egresos": ponerTipo("egresos"); break;
      case "ver-ambos": ponerTipo("ambos"); break;
      case "todo-anio": estado.mes = -1; sincronizarControles(); redibujar(); break;
      case "mes-sistema": estado.mes = mesActual; sincronizarControles(); redibujar(); break;
      case "actualizar": sincronizarControles(); redibujar(); avisar("Análisis actualizado con tus registros.", "success"); break;
      case "ir-tabla": raiz.querySelector("#psTarjetaTabla").scrollIntoView({ behavior: "smooth", block: "start" }); break;
      case "ver-formulas": verFormulas = !verFormulas; pintarFormulas(); break;
      case "pantalla-completa": if (document.fullscreenElement) document.exitFullscreen(); else if (raiz.requestFullscreen) raiz.requestFullscreen(); break;
      case "parejos": cerrarPosicion(); if (typeof abrirParejos === "function") abrirParejos(); break;
      case "estabilidad": cerrarPosicion(); if (typeof abrirEstabilidad === "function") abrirEstabilidad(); break;
      default: break;
    }
  }

  function conectarEventos() {
    raiz.addEventListener("change", alCambiar);
    raiz.addEventListener("input", e => { if (["range", "number", "color"].indexOf(e.target.type) !== -1) alCambiar(e); });
    raiz.addEventListener("click", e => {
      const t = e.target;
      const bm = t.closest(".vm-menu-boton");
      if (bm) {
        const m = bm.parentElement, abierto = m.classList.contains("vm-menu-abierto");
        cerrarMenus();
        if (!abierto) { m.classList.add("vm-menu-abierto"); m.querySelector(".vm-menu-lista").hidden = false; bm.setAttribute("aria-expanded", "true"); }
        return;
      }
      const ac = t.closest("[data-accion]");
      if (ac) { cerrarMenus(); ejecutar(ac.dataset.accion); return; }
      const g = t.closest("[data-grafico]");
      if (g) { cerrarMenus(); estado.grafico = g.dataset.grafico; sincronizarControles(); redibujar(); return; }
      const te = t.closest("[data-tema]");
      if (te) { cerrarMenus(); estado.tema = te.dataset.tema; sincronizarControles(); redibujar(); return; }
      const tp = t.closest(".pj-tipo");
      if (tp) { ponerTipo(tp.dataset.tipo); return; }
      const hj = t.closest(".ps-hoja");
      if (hj) { hoja = hj.dataset.hoja; pintarTabla(); return; }
      const fila = t.closest(".es-fila[data-mes]");
      if (fila) {
        const m = Number(fila.dataset.mes);
        const r = A().resumenMes(estado.anio, m);
        if (r.hayDatos) { estado.mes = estado.mes === m ? -1 : m; sincronizarControles(); redibujar(); raiz.querySelector(".vm-centro").scrollTo({ top: 0, behavior: "smooth" }); }
        return;
      }
      const pe = t.closest(".vm-pestana");
      if (pe) {
        raiz.querySelectorAll(".vm-pestana").forEach(b => b.setAttribute("aria-selected", b === pe ? "true" : "false"));
        raiz.querySelectorAll(".vm-pagina").forEach(p => { p.hidden = p.dataset.pagina !== pe.dataset.pestana; });
        return;
      }
      if (!t.closest(".vm-menu")) cerrarMenus();
    });
    document.addEventListener("keydown", e => {
      if (!raiz || raiz.hidden || e.key !== "Escape" || document.fullscreenElement) return;
      e.preventDefault();
      if (raiz.querySelector(".vm-menu.vm-menu-abierto")) cerrarMenus(); else cerrarPosicion();
    });
  }

  function abrirPosicion() {
    if (typeof Chart === "undefined") { avisar("No se pudo cargar la librería de gráficos (revisa tu internet).", "error"); return false; }
    if (!window.Analitica) { avisar("No se pudo cargar el módulo de cálculos (analitica.js).", "error"); return false; }
    if (!raiz) { raiz = construirVentana(); conectarEventos(); }
    if (typeof modoRegistro !== "undefined" && estado.tipo !== "ambos") estado.tipo = modoRegistro === "egresos" ? "egresos" : "ingresos";
    const anios = A().aniosDisponibles();
    if (!estado.anio || anios.indexOf(estado.anio) === -1) estado.anio = anios.length ? anios[anios.length - 1] : new Date().getFullYear();
    estado.mes = -1;
    estado.grafico = "meses";
    if (window.VistaSimple) VistaSimple.reiniciar(raiz);
    elementoAnterior = document.activeElement;
    sincronizarControles();
    raiz.hidden = false;
    document.documentElement.classList.add("vm-abierta");
    const app = document.querySelector(".app");
    if (app) app.inert = true;
    raiz.querySelector(".vm-cerrar").focus({ preventScroll: true });
    redibujar();
    return true;
  }

  function cerrarPosicion() {
    if (!raiz || raiz.hidden) return;
    if (document.fullscreenElement) document.exitFullscreen();
    cerrarMenus();
    raiz.hidden = true;
    document.documentElement.classList.remove("vm-abierta");
    const app = document.querySelector(".app");
    if (app) app.inert = false;
    if (grafico) { grafico.destroy(); grafico = null; }
    if (elementoAnterior && elementoAnterior.focus) elementoAnterior.focus({ preventScroll: true });
  }

  window.abrirPosicion = abrirPosicion;
  window.cerrarPosicion = cerrarPosicion;
})();
