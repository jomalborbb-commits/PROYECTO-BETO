/* ==========================================================================
   parejos.js — Ventana "¿Mis ventas y pagos son parecidos?"
   --------------------------------------------------------------------------
   Desviación media absoluta (DMA) de tus ingresos y de tus egresos: gráficos,
   fórmulas paso a paso con tus propios números, interpretación en palabras
   sencillas y la tabla mes a mes (enero a diciembre) y de todo el año.

   Se abre desde el círculo del panel "Mis gráficos" (script.js llama a
   abrirParejos()). Es de SOLO LECTURA: lee `registros` (ingresos) y
   `egresos` (egresos.js) y nunca los modifica.

   Conceptos, fórmulas y guía de lectura basados en la calculadora de DMA de
   StatsUnlock (statsunlock.com/mean-absolute-deviation-calculator); el diseño
   es el mismo de la ventana "Ventas por mes" (reutiliza sus estilos vm-).
   ========================================================================== */
(function () {
  "use strict";

  /* ======================================================================
     CONFIGURACIÓN
     ====================================================================== */

  const TITULO = "Ventas y pagos";

  const TEMAS = {
    verdeNaranja: { nombre: "Verde y naranja (predeterminado)", ingresos: "#2FA84F", egresos: "#F07A1E", banda: "rgba(217,164,65,0.20)", centro: "#7A4A38" },
    rojoAmarillo: { nombre: "Rojo y amarillo", ingresos: "#E3A008", egresos: "#D0342C", banda: "rgba(227,160,8,0.16)", centro: "#5A3A2A" },
    ladrillera: { nombre: "Ladrillera (terracota y verde)", ingresos: "#4E7A4F", egresos: "#A9573F", banda: "rgba(199,169,130,0.28)", centro: "#3B2F2A" },
  };

  const GRAFICOS = {
    distancias: "1. ¿Cuánto se aleja cada monto del promedio?",
    banda: "2. Montos dentro y fuera de lo normal (± DMA)",
    histograma: "3. ¿En qué rango caen tus montos?",
    mensual: "4. Mes a mes: ¿qué tan parejo fue cada mes?",
    medidas: "5. Medidas de variación comparadas",
    totales: "6. Ingresos y egresos por mes (S/)",
  };

  const FUENTES = ["Inter", "Poppins", "Space Grotesk", "Arial", "Georgia"];

  const ESTADO_INICIAL = {
    tipo: "ingresos",       // ingresos | egresos | comparar
    anio: null,             // null = el más reciente con datos
    mes: -1,                // -1 = todo el año; 0..11 = un mes
    grafico: "mensual",     // en la vista simple siempre se ve este; los demás están en «Más detalles»
    centro: "media",        // media | mediana
    decimales: 2,
    tema: "verdeNaranja",
    ancho: 900,
    alto: 440,
    fuente: "Inter",
    fondo: "#FFFFFF",
    verBanda: true,
    resaltar: true,
    leyenda: true,
    animacion: true,
  };

  const MESES_TITULO = MESES.map(m => m.charAt(0) + m.slice(1).toLowerCase());
  const MESES_CORTOS = MESES.map(m => m.charAt(0) + m.slice(1, 3).toLowerCase());

  /* ======================================================================
     ESTADO
     ====================================================================== */

  let estado = clonar(ESTADO_INICIAL);
  let grafico = null;
  let raiz = null;
  let elementoAnterior = null;
  let verFormulas = true;

  function clonar(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(t) { return String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function avisar(m, t) { if (typeof mostrarToast === "function") mostrarToast(m, t); }
  // Nombres sin repetir (sin distinguir mayúsculas), en el mismo orden
  function unicos(lista) {
    const vistos = new Set();
    return lista.map(t => String(t || "").trim()).filter(t => t && !vistos.has(t.toLowerCase()) && vistos.add(t.toLowerCase()));
  }

  /* ======================================================================
     DATOS (solo lectura)
     ====================================================================== */

  const PALABRA = {
    ingresos: { uno: "ingreso", varios: "ingresos", Varios: "Ingresos" },
    egresos: { uno: "egreso", varios: "egresos", Varios: "Egresos" },
  };

  function movimientos(tipo) {
    if (tipo === "ingresos") {
      return registros.map(r => ({
        fecha: r.fechaIngreso || "",
        valor: Number(r.montoTotal) || 0,
        nombre: r.cliente || r.representante || "",
        detalle: r.codigoLadrillo ? "Ladrillo " + r.codigoLadrillo : "",
        aviso: "",
      }));
    }
    const lista = typeof egresos !== "undefined" ? egresos : [];
    return lista.map(e => ({
      fecha: e.fechaEgreso || "",
      valor: Number(e.monto) || 0,
      nombre: (e.beneficiarios || []).join(", "),
      detalle: e.descripcion || "",
      aviso: e.aviso || "",
    }));
  }

  // Montos de un año y un mes (o de todo el año). Los montos en cero no entran:
  // un registro sin monto no es un ingreso ni un egreso de verdad.
  function delPeriodo(tipo, anio, mes) {
    const todos = movimientos(tipo).filter(m => m.fecha && Number(anioDeFecha(m.fecha)) === Number(anio) && (mes < 0 || mesDeFecha(m.fecha) === mes));
    const validos = todos.filter(m => m.valor > 0).sort((a, b) => a.fecha.localeCompare(b.fecha));
    return { lista: validos, ceros: todos.length - validos.length };
  }

  function aniosDisponibles() {
    const set = new Set();
    ["ingresos", "egresos"].forEach(t => movimientos(t).forEach(m => { if (m.fecha && m.valor > 0) set.add(Number(anioDeFecha(m.fecha))); }));
    return Array.from(set).sort((a, b) => a - b);
  }

  function tiposActivos() {
    return estado.tipo === "comparar" ? ["ingresos", "egresos"] : [estado.tipo];
  }

  /* ======================================================================
     ESTADÍSTICA
     ====================================================================== */

  // Cuantil como CUARTIL.INC de Excel (interpolación lineal)
  function cuantil(ordenados, p) {
    if (!ordenados.length) return null;
    const pos = (ordenados.length - 1) * p;
    const base = Math.floor(pos);
    const resto = pos - base;
    return ordenados[base + 1] !== undefined ? ordenados[base] + resto * (ordenados[base + 1] - ordenados[base]) : ordenados[base];
  }

  function calcular(valores, tipoCentro) {
    const n = valores.length;
    if (n === 0) return null;
    const ord = valores.slice().sort((a, b) => a - b);
    const total = valores.reduce((s, v) => s + v, 0);
    const media = total / n;
    const mediana = cuantil(ord, 0.5);
    const centro = tipoCentro === "mediana" ? mediana : media;
    const distancias = valores.map(v => Math.abs(v - centro));
    const sumaDist = distancias.reduce((s, v) => s + v, 0);
    const dma = sumaDist / n;
    const dmaMedia = valores.reduce((s, v) => s + Math.abs(v - media), 0) / n;
    const dmaMediana = valores.reduce((s, v) => s + Math.abs(v - mediana), 0) / n;
    const medDesv = cuantil(ord.map(v => Math.abs(v - mediana)).sort((a, b) => a - b), 0.5);
    const de = n > 1 ? Math.sqrt(valores.reduce((s, v) => s + (v - media) * (v - media), 0) / (n - 1)) : 0;
    const q1 = cuantil(ord, 0.25);
    const q3 = cuantil(ord, 0.75);
    return {
      n, total, media, mediana, centro, dma, sumaDist, dmaMedia, dmaMediana,
      pct: centro ? (dma / centro) * 100 : null,
      medDesv, medDesvEsc: medDesv * 1.4826,
      de, cv: media ? (de / media) * 100 : null,
      ratio: de ? dmaMedia / de : null,
      min: ord[0], max: ord[n - 1], rango: ord[n - 1] - ord[0], q1, q3, iqr: q3 - q1,
    };
  }

  // Semáforo común de todo el panel (analitica.js): verde = bueno, rojo = malo.
  // Si ese archivo no cargara, se usan los mismos colores escritos aquí.
  const SEMAFORO = window.SEMAFORO || {
    muyBueno: { texto: "Muy bueno", color: "#1B8A3A", icono: "▲▲" },
    bueno: { texto: "Bueno", color: "#43A047", icono: "▲" },
    regular: { texto: "Regular", color: "#E0A100", icono: "●" },
    malo: { texto: "Malo", color: "#E53935", icono: "▼" },
    muyMalo: { texto: "Muy malo", color: "#B71C1C", icono: "▼▼" },
  };

  // Bandas de lectura de la DMA relativa (DMA ÷ centro), las mismas de StatsUnlock.
  // Cada nivel lleva su indicador de mes bueno o malo, para que la etiqueta y el
  // color digan siempre lo mismo.
  function nivel(pct) {
    if (pct === null || pct === undefined || isNaN(pct)) return { clave: "sin", texto: "Sin datos", color: "#9A8A7E", frase: "", ind: null };
    if (pct < 5) return { clave: "muy-parejo", texto: "Muy parejo", color: SEMAFORO.muyBueno.color, ind: SEMAFORO.muyBueno, frase: "los montos son casi iguales entre sí; el promedio los representa muy bien" };
    if (pct < 15) return { clave: "parejo", texto: "Parejo", color: SEMAFORO.bueno.color, ind: SEMAFORO.bueno, frase: "variación normal; el promedio es una buena referencia" };
    if (pct < 30) return { clave: "moderado", texto: "Variación moderada", color: SEMAFORO.regular.color, ind: SEMAFORO.regular, frase: "hay diferencias; conviene mirar también la mediana" };
    if (pct <= 50) return { clave: "variable", texto: "Muy variable", color: SEMAFORO.malo.color, ind: SEMAFORO.malo, frase: "hay bastante diferencia entre montos; revisa si se mezclan tipos distintos (montos chicos y grandes)" };
    return { clave: "disparejo", texto: "Muy disparejo", color: SEMAFORO.muyMalo.color, ind: SEMAFORO.muyMalo, frase: "el promedio no representa a un monto típico; usa la mediana (el monto del medio)" };
  }

  function soles(v, compacto) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    if (compacto) return formatearMonedaCompacta(v);
    return "S/ " + Number(v).toLocaleString("es-PE", { minimumFractionDigits: estado.decimales, maximumFractionDigits: estado.decimales });
  }

  function pctTexto(p) {
    return p === null || p === undefined || isNaN(p) ? "—" : Number(p).toLocaleString("es-PE", { maximumFractionDigits: 1 }) + "%";
  }

  function fechaCorta(f) { return formatearFecha(f); }

  function nombrePeriodo(anio, mes) {
    return mes < 0 ? "todo " + anio : MESES_TITULO[mes] + " " + anio;
  }

  // Estadística de los 12 meses y de todo el año para un tipo
  function resumenAnual(tipo, anio) {
    const meses = MESES.map((_, m) => {
      const { lista } = delPeriodo(tipo, anio, m);
      return { mes: m, est: calcular(lista.map(x => x.valor), estado.centro), lista };
    });
    const anual = delPeriodo(tipo, anio, -1);
    const totales = meses.filter(x => x.est).map(x => x.est.total);
    return {
      meses,
      anual: calcular(anual.lista.map(x => x.valor), estado.centro),
      entreMeses: totales.length >= 2 ? calcular(totales, estado.centro) : null,
      mesesConDatos: totales.length,
    };
  }

  // ¿El mes podría estar incompleto? (es el último con datos y su último registro es antes del día 25)
  function mesIncompleto(tipo, anio, mes, lista) {
    if (mes < 0 || !lista.length) return null;
    const ultimoMes = Math.max.apply(null, movimientos(tipo).filter(m => m.fecha && Number(anioDeFecha(m.fecha)) === Number(anio) && m.valor > 0).map(m => mesDeFecha(m.fecha)));
    const ultimaFecha = lista[lista.length - 1].fecha;
    const dia = Number(ultimaFecha.slice(8, 10));
    return mes === ultimoMes && dia < 25 ? ultimaFecha : null;
  }

  /* ======================================================================
     GRÁFICOS (Chart.js)
     ====================================================================== */

  function aRgba(hex, a) {
    const h = hex.replace("#", "");
    const n = parseInt(h, 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  function colorDe(tipo) { return TEMAS[estado.tema][tipo]; }

  // Posición horizontal de una fecha: día del mes (vista de un mes) o día del año
  function xDeFecha(fecha, mes) {
    const p = fecha.split("-").map(Number);
    if (mes >= 0) return p[2];
    return Math.round((Date.UTC(p[0], p[1] - 1, p[2]) - Date.UTC(p[0], 0, 1)) / 86400000) + 1;
  }

  // Fondo del lienzo (para que la imagen descargada no salga transparente)
  const pluginFondo = {
    id: "pjFondo",
    beforeDraw(chart) {
      const ctx = chart.ctx;
      ctx.save();
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = estado.fondo;
      ctx.fillRect(0, 0, chart.width, chart.height);
      ctx.restore();
    },
  };

  // Dibujos propios de cada gráfico: franja ± DMA, línea del promedio, líneas
  // de la DMA, rayitas de distancia y zonas de lectura. La información llega en
  // options.plugins.pjDeco.
  const pluginDeco = {
    id: "pjDeco",
    beforeDatasetsDraw(chart, args, o) {
      if (!o || !o.tipo) return;
      const ctx = chart.ctx;
      const a = chart.chartArea;
      const x = chart.scales.x;
      const y = chart.scales.y;
      ctx.save();
      ctx.beginPath();
      ctx.rect(a.left, a.top, a.right - a.left, a.bottom - a.top);
      ctx.clip();

      if (o.tipo === "banda" && o.series) {
        // Franja de "lo normal" (centro ± DMA) y línea del centro
        o.series.forEach(s => {
          if (o.verBanda) {
            ctx.fillStyle = s.banda;
            const y1 = y.getPixelForValue(s.centro + s.dma);
            const y2 = y.getPixelForValue(Math.max(0, s.centro - s.dma));
            ctx.fillRect(a.left, y1, a.right - a.left, y2 - y1);
          }
          ctx.strokeStyle = s.color;
          ctx.setLineDash([7, 5]);
          ctx.lineWidth = 2;
          const yc = y.getPixelForValue(s.centro);
          ctx.beginPath(); ctx.moveTo(a.left, yc); ctx.lineTo(a.right, yc); ctx.stroke();
          ctx.setLineDash([]);
        });
      }

      if (o.tipo === "tira" && o.series) {
        // Comparación: una franja por grupo (ingresos arriba, egresos abajo)
        o.series.forEach(s => {
          const yc = y.getPixelForValue(s.fila);
          const alto = Math.abs(y.getPixelForValue(s.fila + 0.34) - yc);
          if (o.verBanda) {
            const x1 = x.getPixelForValue(Math.max(0, s.centro - s.dma));
            const x2 = x.getPixelForValue(s.centro + s.dma);
            ctx.fillStyle = s.banda;
            ctx.fillRect(x1, yc - alto, x2 - x1, alto * 2);
          }
          const xc = x.getPixelForValue(s.centro);
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(xc, yc - alto - 4); ctx.lineTo(xc, yc + alto + 4); ctx.stroke();
        });
      }

      if (o.tipo === "zonas") {
        // Zonas de lectura detrás de las barras del gráfico mes a mes
        // Mismos colores del semáforo: verde (parejo, bueno) → ámbar → rojo (disparejo, malo)
        const zonas = [[0, 15, "rgba(67,160,71,0.12)"], [15, 30, "rgba(224,161,0,0.12)"], [30, 50, "rgba(229,57,53,0.10)"], [50, 1e6, "rgba(183,28,28,0.10)"]];
        zonas.forEach(z => {
          const y1 = y.getPixelForValue(Math.min(z[1], y.max));
          const y2 = y.getPixelForValue(z[0]);
          if (y2 > y1) { ctx.fillStyle = z[2]; ctx.fillRect(a.left, y1, a.right - a.left, y2 - y1); }
        });
        ctx.font = "600 10px " + estado.fuente + ", sans-serif";
        ctx.fillStyle = "rgba(60,40,30,0.55)";
        ctx.textAlign = "right";
        (o.simple ? [[7.5, "Parejos"], [22.5, "Algo distintos"], [40, "Muy distintos"], [Math.min(y.max - 4, 75), "Muy desiguales"]] : [[7.5, "Parejo"], [22.5, "Moderado"], [40, "Muy variable"], [Math.min(y.max - 4, 75), "Muy disparejo"]]).forEach(t => {
          if (t[0] < y.max) ctx.fillText(t[1], a.right - 6, y.getPixelForValue(t[0]) + 3);
        });
      }
      ctx.restore();
    },
    afterDatasetsDraw(chart, args, o) {
      if (!o || !o.tipo) return;
      const ctx = chart.ctx;
      const a = chart.chartArea;
      const x = chart.scales.x;
      const y = chart.scales.y;
      ctx.save();
      ctx.font = "700 11px " + estado.fuente + ", sans-serif";

      if (o.tipo === "distancias" && o.series) {
        // Línea de la DMA de cada serie, con su cifra
        o.series.forEach((s, i) => {
          const yy = y.getPixelForValue(s.dma);
          ctx.strokeStyle = s.color;
          ctx.setLineDash([8, 5]);
          ctx.lineWidth = 2.2;
          ctx.beginPath(); ctx.moveTo(a.left, yy); ctx.lineTo(a.right, yy); ctx.stroke();
          ctx.setLineDash([]);
          const texto = "DMA " + s.texto;
          const w = ctx.measureText(texto).width + 12;
          const px = a.right - w - 4;
          const py = yy - 22 - i * 24;
          ctx.fillStyle = s.color;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(px, py, w, 19, 6); else ctx.rect(px, py, w, 19);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.textBaseline = "middle";
          ctx.fillText(texto, px + 6, py + 10);
        });
      }

      if (o.tipo === "banda" && o.series) {
        o.series.forEach(s => {
          const etiquetas = [[s.centro, (estado.centro === "mediana" ? "Mediana " : "Promedio ") + s.textoCentro]];
          if (o.verBanda) {
            etiquetas.push([s.centro + s.dma, "+ DMA"]);
            if (s.centro - s.dma > 0) etiquetas.push([s.centro - s.dma, "− DMA"]);
          }
          etiquetas.forEach(e => {
            const yy = y.getPixelForValue(e[0]);
            if (yy < a.top || yy > a.bottom) return;
            ctx.fillStyle = s.color;
            ctx.textAlign = "left";
            ctx.textBaseline = "bottom";
            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgba(255,255,255,0.9)";
            ctx.strokeText(e[1], a.left + 6, yy - 3);
            ctx.fillText(e[1], a.left + 6, yy - 3);
          });
        });
      }

      if (o.tipo === "histograma" && o.lineas) {
        o.lineas.forEach(l => {
          const xx = x.getPixelForValue(l.valor);
          if (xx < a.left || xx > a.right) return;
          ctx.strokeStyle = l.color;
          ctx.setLineDash(l.punteada ? [6, 4] : []);
          ctx.lineWidth = l.punteada ? 1.8 : 2.6;
          ctx.beginPath(); ctx.moveTo(xx, a.top); ctx.lineTo(xx, a.bottom); ctx.stroke();
          ctx.setLineDash([]);
          if (l.texto) {
            ctx.fillStyle = l.color;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgba(255,255,255,0.9)";
            ctx.strokeText(l.texto, xx, a.top + 2 + (l.fila || 0) * 14);
            ctx.fillText(l.texto, xx, a.top + 2 + (l.fila || 0) * 14);
          }
        });
      }
      ctx.restore();
    },
  };

  // Tallos del gráfico de distancias (lollipop): se dibujan antes que los puntos
  const pluginTallos = {
    id: "pjTallos",
    beforeDatasetsDraw(chart, args, o) {
      if (!o || !o.activo) return;
      const ctx = chart.ctx;
      const y0 = chart.scales.y.getPixelForValue(0);
      ctx.save();
      chart.data.datasets.forEach((ds, i) => {
        if (!chart.isDatasetVisible(i) || !ds.$tallo) return;
        ctx.strokeStyle = ds.$tallo;
        ctx.lineWidth = 1.6;
        chart.getDatasetMeta(i).data.forEach(p => {
          ctx.beginPath(); ctx.moveTo(p.x, y0); ctx.lineTo(p.x, p.y); ctx.stroke();
        });
      });
      ctx.restore();
    },
  };

  function opcionesBase(titulo, subtitulo) {
    const fuente = estado.fuente + ", sans-serif";
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: estado.animacion ? { duration: 800, easing: "easeOutQuart" } : false,
      layout: { padding: { top: 6, right: 14, left: 4 } },
      plugins: {
        title: { display: true, text: titulo, color: "#8C4633", font: { family: fuente, size: 17, weight: "600" }, padding: { top: 4, bottom: 2 } },
        subtitle: { display: !!subtitulo, text: subtitulo, color: "#666", font: { family: fuente, size: 12 }, padding: { bottom: 10 } },
        legend: { display: estado.leyenda, position: "bottom", labels: { usePointStyle: true, boxWidth: 8, font: { family: fuente, size: 12 }, color: "#222" } },
        tooltip: { titleFont: { family: fuente }, bodyFont: { family: fuente } },
      },
    };
  }

  function ejeDinero(titulo, extra) {
    const fuente = estado.fuente + ", sans-serif";
    return Object.assign({
      beginAtZero: true,
      grace: "6%",   // un margen arriba para que el monto más alto no quede pegado al borde
      grid: { color: "#ECE6E0" },
      title: { display: !!titulo, text: titulo, color: "#333", font: { family: fuente, size: 12, weight: "600" } },
      ticks: { color: "#222", font: { family: fuente, size: 11 }, callback: v => formatearMonedaCompacta(v) },
    }, extra || {});
  }

  function ejeFecha(anio, mes) {
    const fuente = estado.fuente + ", sans-serif";
    // Marcas: días redondos en la vista de un mes; el día 1 de cada mes en la vista del año
    const marcas = mes >= 0
      ? [1, 5, 10, 15, 20, 25, 30]
      : MESES.map((_, m) => Math.round((Date.UTC(anio, m, 1) - Date.UTC(anio, 0, 1)) / 86400000) + 1);
    return {
      type: "linear",
      min: mes >= 0 ? 0.5 : 1,
      max: mes >= 0 ? 31.5 : 366,
      grid: { color: "#F1ECE6" },
      title: { display: true, text: mes >= 0 ? "Día de " + MESES_TITULO[mes].toLowerCase() : "Fecha", color: "#333", font: { family: fuente, size: 12, weight: "600" } },
      afterBuildTicks: escala => { escala.ticks = marcas.map(v => ({ value: v })); },
      ticks: { color: "#222", font: { family: fuente, size: 11 }, autoSkip: false, callback: v => mes >= 0 ? String(v) : MESES_CORTOS[marcas.indexOf(v)] || "" },
    };
  }

  function subtituloDe(extra) {
    const quien = estado.tipo === "comparar" ? "Ingresos y egresos" : PALABRA[estado.tipo].Varios;
    return quien + " · " + nombrePeriodo(estado.anio, estado.mes) + (extra ? " · " + extra : "");
  }

  // Construye la configuración del gráfico elegido
  function construirConfig() {
    const anio = estado.anio;
    const mes = estado.mes;
    const tipos = tiposActivos();
    const datos = tipos.map(t => {
      const { lista } = delPeriodo(t, anio, mes);
      return { tipo: t, lista, est: calcular(lista.map(x => x.valor), estado.centro), color: colorDe(t) };
    });
    const conDatos = datos.filter(d => d.est && d.est.n >= 1);
    const fuente = estado.fuente + ", sans-serif";

    if (!conDatos.length && estado.grafico !== "mensual" && estado.grafico !== "totales") return null;

    /* ---------- 1. Distancias (piruletas) ---------- */
    if (estado.grafico === "distancias") {
      const relativo = estado.tipo === "comparar";
      const datasets = conDatos.map(d => ({
        label: PALABRA[d.tipo].Varios + (relativo ? " (% de su centro)" : ""),
        data: d.lista.map(m => {
          const dist = Math.abs(m.valor - d.est.centro);
          return { x: xDeFecha(m.fecha, mes), y: relativo ? (dist / d.est.centro) * 100 : dist, m };
        }),
        showLine: false,
        pointRadius: ctx => {
          const p = ctx.raw;
          if (!p) return 3;
          const limite = relativo ? d.est.pct : d.est.dma;
          return estado.resaltar && p.y > limite ? 4.5 : 3;
        },
        pointBackgroundColor: ctx => {
          const p = ctx.raw;
          const limite = relativo ? d.est.pct : d.est.dma;
          return p && estado.resaltar && p.y > limite ? d.color : aRgba(d.color, 0.45);
        },
        pointBorderColor: d.color,
        pointBorderWidth: 1,
        $tallo: aRgba(d.color, 0.35),
      }));
      const o = opcionesBase(GRAFICOS.distancias.slice(3), subtituloDe(relativo ? "distancias en % de su propio centro" : ""));
      o.scales = {
        x: ejeFecha(anio, mes),
        y: relativo
          ? { beginAtZero: true, grid: { color: "#ECE6E0" }, title: { display: true, text: "Distancia al centro (%)", font: { family: fuente, size: 12, weight: "600" } }, ticks: { callback: v => v + "%", font: { family: fuente, size: 11 } } }
          : ejeDinero("Distancia al " + (estado.centro === "mediana" ? "monto del medio" : "promedio")),
      };
      o.plugins.pjDeco = {
        tipo: "distancias",
        series: conDatos.map(d => ({ dma: relativo ? d.est.pct : d.est.dma, color: d.color, texto: relativo ? pctTexto(d.est.pct) : soles(d.est.dma) })),
      };
      o.plugins.pjTallos = { activo: true };
      o.plugins.tooltip.callbacks = {
        title: items => items.length ? fechaCorta(items[0].raw.m.fecha) : "",
        label: c => {
          const m = c.raw.m;
          return [" " + (m.nombre || m.detalle || "—").slice(0, 60), " Monto: " + soles(m.valor), " Se aleja: " + (relativo ? pctTexto(c.raw.y) : soles(c.raw.y))];
        },
      };
      return { type: "scatter", data: { datasets }, options: o, plugins: [pluginFondo, pluginTallos, pluginDeco] };
    }

    /* ---------- 2. Banda ± DMA ---------- */
    if (estado.grafico === "banda") {
      if (estado.tipo !== "comparar") {
        const d = conDatos[0];
        const dentro = m => Math.abs(m.valor - d.est.centro) <= d.est.dma;
        const datasets = [
          {
            label: "Dentro de lo normal (" + d.lista.filter(dentro).length + ")",
            data: d.lista.filter(dentro).map(m => ({ x: xDeFecha(m.fecha, mes), y: m.valor, m })),
            pointRadius: 3.5, pointBackgroundColor: aRgba(d.color, 0.45), pointBorderColor: d.color, pointBorderWidth: 1,
          },
          {
            label: "Fuera de lo normal (" + d.lista.filter(m => !dentro(m)).length + ")",
            data: d.lista.filter(m => !dentro(m)).map(m => ({ x: xDeFecha(m.fecha, mes), y: m.valor, m })),
            pointRadius: estado.resaltar ? 5 : 3.5, pointBackgroundColor: estado.resaltar ? d.color : aRgba(d.color, 0.45), pointBorderColor: "#fff", pointBorderWidth: 1.2,
          },
        ];
        const o = opcionesBase(GRAFICOS.banda.slice(3), subtituloDe("franja = " + (estado.centro === "mediana" ? "mediana" : "promedio") + " ± DMA"));
        o.scales = { x: ejeFecha(anio, mes), y: ejeDinero("Monto") };
        o.plugins.pjDeco = { tipo: "banda", verBanda: estado.verBanda, series: [{ centro: d.est.centro, dma: d.est.dma, color: TEMAS[estado.tema].centro, banda: TEMAS[estado.tema].banda, textoCentro: soles(d.est.centro, true) }] };
        o.plugins.tooltip.callbacks = {
          title: items => items.length ? fechaCorta(items[0].raw.m.fecha) : "",
          label: c => [" " + (c.raw.m.nombre || c.raw.m.detalle || "—").slice(0, 60), " Monto: " + soles(c.raw.m.valor)],
        };
        return { type: "scatter", data: { datasets }, options: o, plugins: [pluginFondo, pluginDeco] };
      }
      // Comparar: tira horizontal, ingresos arriba y egresos abajo
      const filas = { ingresos: 1, egresos: 0 };
      const datasets = conDatos.map(d => ({
        label: PALABRA[d.tipo].Varios,
        data: d.lista.map((m, i) => ({ x: m.valor, y: filas[d.tipo] + (((i * 37) % 11) - 5) * 0.045, m })),
        pointRadius: 3.5,
        pointBackgroundColor: ctx => (ctx.raw && estado.resaltar && Math.abs(ctx.raw.x - d.est.centro) > d.est.dma) ? d.color : aRgba(d.color, 0.4),
        pointBorderColor: d.color,
        pointBorderWidth: 1,
      }));
      const o = opcionesBase("Ingresos y egresos: ¿cuál es más parejo?", subtituloDe("franja = centro ± DMA de cada uno"));
      o.scales = {
        x: ejeDinero("Monto", { type: "linear" }),
        y: { min: -0.6, max: 1.6, grid: { display: false }, ticks: { stepSize: 1, font: { family: fuente, size: 12, weight: "600" }, callback: v => v === 1 ? "Ingresos" : v === 0 ? "Egresos" : "" } },
      };
      o.plugins.pjDeco = { tipo: "tira", verBanda: estado.verBanda, series: conDatos.map(d => ({ fila: filas[d.tipo], centro: d.est.centro, dma: d.est.dma, color: d.color, banda: aRgba(d.color, 0.16) })) };
      o.plugins.tooltip.callbacks = {
        title: items => items.length ? fechaCorta(items[0].raw.m.fecha) : "",
        label: c => [" " + (c.raw.m.nombre || c.raw.m.detalle || "—").slice(0, 60), " Monto: " + soles(c.raw.m.valor)],
      };
      return { type: "scatter", data: { datasets }, options: o, plugins: [pluginFondo, pluginDeco] };
    }

    /* ---------- 3. Histograma ---------- */
    if (estado.grafico === "histograma") {
      const relativo = estado.tipo === "comparar";
      const valoresDe = d => d.lista.map(m => relativo ? (m.valor / d.est.media) * 100 : m.valor);
      const todos = conDatos.flatMap(valoresDe);
      const minV = Math.min.apply(null, todos);
      const maxV = Math.max.apply(null, todos);
      const nTot = todos.length;
      const k = Math.max(5, Math.min(14, Math.ceil(Math.log2(nTot) + 1)));
      const bruto = (maxV - minV) / k || 1;
      const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
      const ancho = [1, 2, 2.5, 5, 10].map(f => f * mag).find(w => w >= bruto) || bruto;
      const inicio = Math.floor(minV / ancho) * ancho;
      const nClases = Math.max(1, Math.ceil((maxV - inicio) / ancho + 1e-9));
      const datasets = conDatos.map(d => {
        const cuenta = new Array(nClases).fill(0);
        valoresDe(d).forEach(v => { cuenta[Math.min(nClases - 1, Math.floor((v - inicio) / ancho))]++; });
        return {
          label: PALABRA[d.tipo].Varios + " (cantidad)",
          data: cuenta.map((c, i) => ({ x: inicio + ancho * (i + 0.5), y: c })),
          backgroundColor: aRgba(d.color, relativo ? 0.55 : 0.8),
          borderColor: d.color,
          borderWidth: 1,
          barPercentage: 1,
          categoryPercentage: relativo ? 0.9 : 1,
          grouped: relativo,
        };
      });
      const formatoX = v => relativo ? Math.round(v) + "%" : formatearMonedaCompacta(v);
      const o = opcionesBase(GRAFICOS.histograma.slice(3), subtituloDe(relativo ? "montos en % de su propio promedio (100% = el promedio)" : "cada barra: cuántos montos caen en ese rango"));
      o.scales = {
        x: { type: "linear", min: inicio, max: inicio + ancho * nClases, offset: false, grid: { color: "#F1ECE6" }, title: { display: true, text: relativo ? "Monto como % del promedio" : "Rango de montos", font: { family: fuente, size: 12, weight: "600" } }, ticks: { font: { family: fuente, size: 11 }, callback: formatoX } },
        y: { beginAtZero: true, grid: { color: "#ECE6E0" }, title: { display: true, text: "Cantidad de montos", font: { family: fuente, size: 12, weight: "600" } }, ticks: { precision: 0, font: { family: fuente, size: 11 } } },
      };
      // Líneas del centro y de ± DMA; en la comparación, cada etiqueta en su propia fila para que no se encimen
      const lineas = [];
      const nombreCentro = estado.centro === "mediana" ? "Mediana" : "Promedio";
      conDatos.forEach((d, i) => {
        const c = relativo ? (d.est.centro / d.est.media) * 100 : d.est.centro;
        const w = relativo ? (d.est.dma / d.est.media) * 100 : d.est.dma;
        const col = relativo ? d.color : TEMAS[estado.tema].centro;
        if (relativo) {
          const textoCentro = estado.centro === "media" ? (i === 0 ? "Promedio (100%)" : "") : "Mediana de " + PALABRA[d.tipo].varios;
          lineas.push({ valor: c, color: estado.centro === "media" ? TEMAS[estado.tema].centro : col, texto: textoCentro, fila: estado.centro === "media" ? 0 : i });
          if (estado.verBanda) {
            lineas.push({ valor: c - w, color: col, punteada: true });
            lineas.push({ valor: c + w, color: col, punteada: true, texto: "+ DMA " + PALABRA[d.tipo].varios, fila: i + 1 + (estado.centro === "media" ? 0 : 1) });
          }
        } else {
          lineas.push({ valor: c, color: col, texto: nombreCentro, fila: 0 });
          if (estado.verBanda) {
            lineas.push({ valor: c - w, color: col, punteada: true, texto: "− DMA", fila: 1 });
            lineas.push({ valor: c + w, color: col, punteada: true, texto: "+ DMA", fila: 1 });
          }
        }
      });
      o.plugins.pjDeco = { tipo: "histograma", lineas };
      o.plugins.tooltip.callbacks = {
        title: items => items.length ? "Entre " + formatoX(items[0].raw.x - ancho / 2) + " y " + formatoX(items[0].raw.x + ancho / 2) : "",
        label: c => " " + c.dataset.label.replace(" (cantidad)", "") + ": " + c.raw.y + " monto(s)",
      };
      return { type: "bar", data: { datasets }, options: o, plugins: [pluginFondo, pluginDeco] };
    }

    /* ---------- 4. Mes a mes ---------- */
    if (estado.grafico === "mensual") {
      const datasets = tipos.map(t => {
        const r = resumenAnual(t, anio);
        return {
          label: PALABRA[t].Varios + " (DMA en %)",
          data: r.meses.map(x => x.est ? Number(x.est.pct.toFixed(1)) : null),
          $meses: r.meses,
          backgroundColor: r.meses.map(x => aRgba(colorDe(t), estado.mes === x.mes ? 1 : 0.7)),
          borderColor: r.meses.map(x => estado.mes === x.mes ? "#3B2F2A" : colorDe(t)),
          borderWidth: r.meses.map(x => estado.mes === x.mes ? 2.5 : 1),
          borderRadius: 5,
        };
      });
      const maximo = Math.max(60, ...datasets.flatMap(d => d.data.filter(v => v !== null)));
      const simple = window.VistaSimple && VistaSimple.esSimple(raiz);
      const quienEs = estado.tipo === "comparar" ? "Ingresos y egresos" : PALABRA[estado.tipo].Varios;
      const o = simple
        ? opcionesBase("¿Tus montos se parecen entre sí, mes a mes?", quienEs + " · " + anio + " · más bajo = más parejos")
        : opcionesBase(GRAFICOS.mensual.slice(3), quienEs + " · " + anio + " · menos es más parejo · haz clic en un mes para verlo");
      o.scales = {
        x: { grid: { display: false }, ticks: { font: { family: fuente, size: 11 } } },
        y: { beginAtZero: true, max: Math.ceil(maximo / 10) * 10 + 10, grid: { color: "rgba(0,0,0,0.05)" }, title: { display: true, text: simple ? "Qué tanto se alejan del monto típico (%)" : "DMA como % del centro", font: { family: fuente, size: 12, weight: "600" } }, ticks: { callback: v => v + "%", font: { family: fuente, size: 11 } } },
      };
      o.plugins.pjDeco = { tipo: "zonas", simple };
      o.plugins.tooltip.callbacks = {
        label: c => {
          const x = c.dataset.$meses[c.dataIndex];
          if (!x || !x.est) return " sin datos";
          return [" " + c.dataset.label.replace(" (DMA en %)", "") + ": " + pctTexto(x.est.pct) + " · " + nivel(x.est.pct).texto, " DMA " + soles(x.est.dma) + " · " + x.est.n + " monto(s)"];
        },
      };
      o.onClick = (ev, elementos) => {
        if (simple || !elementos.length) return;
        estado.mes = elementos[0].index;
        sincronizarControles();
        // Se redibuja un instante después: el gráfico termina de atender el clic antes de ser reemplazado
        setTimeout(redibujar, 0);
      };
      return { type: "bar", data: { labels: MESES_CORTOS, datasets }, options: o, plugins: [pluginFondo, pluginDeco] };
    }

    /* ---------- 5. Medidas comparadas ---------- */
    if (estado.grafico === "medidas") {
      const etiquetas = ["DMA", "Mediana de las desviaciones", "Desviación estándar", "Rango intercuartil (50% central)"];
      const datasets = conDatos.map(d => ({
        label: PALABRA[d.tipo].Varios,
        data: [d.est.dma, d.est.medDesv, d.est.de, d.est.iqr],
        backgroundColor: aRgba(d.color, 0.85),
        borderColor: d.color,
        borderWidth: 1,
        borderRadius: 6,
      }));
      const o = opcionesBase(GRAFICOS.medidas.slice(3), subtituloDe("todas en soles; más alto = más disparejo"));
      o.scales = { x: { grid: { display: false }, ticks: { font: { family: fuente, size: 11 } } }, y: ejeDinero("Soles") };
      o.plugins.tooltip.callbacks = { label: c => " " + c.dataset.label + ": " + soles(c.parsed.y) };
      return { type: "bar", data: { labels: etiquetas, datasets }, options: o, plugins: [pluginFondo] };
    }

    /* ---------- 6. Totales por mes ---------- */
    const datasets = ["ingresos", "egresos"].map(t => ({
      label: PALABRA[t].Varios,
      data: resumenAnual(t, anio).meses.map(x => x.est ? x.est.total : null),
      borderColor: colorDe(t),
      backgroundColor: aRgba(colorDe(t), 0.15),
      pointBackgroundColor: "#fff",
      pointBorderColor: colorDe(t),
      pointBorderWidth: 2,
      pointRadius: 4,
      borderWidth: 3,
      tension: 0,
      spanGaps: false,
    }));
    const o = opcionesBase(GRAFICOS.totales.slice(3), "Montos totales de cada mes · " + anio);
    o.interaction = { mode: "index", intersect: false };
    o.scales = { x: { grid: { color: "#F1ECE6" }, ticks: { font: { family: fuente, size: 11 } } }, y: ejeDinero("Monto del mes") };
    o.plugins.tooltip.callbacks = { label: c => " " + c.dataset.label + ": " + soles(c.parsed.y) };
    return { type: "line", data: { labels: MESES_CORTOS, datasets }, options: o, plugins: [pluginFondo] };
  }

  function redibujar() {
    if (!raiz) return;
    const marco = raiz.querySelector(".vm-lienzo");
    // Si la pantalla es más angosta que el ancho elegido, el gráfico se achica para caber
    const disponible = raiz.querySelector(".vm-marco").clientWidth - 32;
    const ancho = disponible > 280 ? Math.min(estado.ancho, disponible) : estado.ancho;
    marco.style.width = ancho + "px";
    marco.style.height = (ancho < estado.ancho ? Math.max(300, Math.round(estado.alto * 0.85)) : estado.alto) + "px";
    const cfg = construirConfig();
    const vacio = raiz.querySelector(".vm-vacio");
    if (grafico) { grafico.destroy(); grafico = null; }
    vacio.hidden = !!cfg;
    if (cfg) {
      grafico = new Chart(raiz.querySelector("#pjCanvas"), (window.VistaSimple ? VistaSimple.embellecer(cfg) : cfg));
    } else {
      vacio.innerHTML = "No hay " + (estado.tipo === "comparar" ? "ingresos ni egresos" : PALABRA[estado.tipo].varios) + " en " + nombrePeriodo(estado.anio, estado.mes) + ".<br>Elige otro período o importa tu Excel.";
    }
    pintarEsencial();
    pintarAnalisis();
    pintarFormulas();
    pintarTabla();
  }

  /* ======================================================================
     LO ESENCIAL (vista simple): ¿tus montos se parecen entre sí?
     ====================================================================== */

  const PLANO = { "muy-parejo": "Muy parejos", parejo: "Parejos", moderado: "Algo distintos", variable: "Muy distintos", disparejo: "Muy desiguales" };
  const PLANO_MES = { "muy-parejo": "Muy parejo", parejo: "Parejo", moderado: "Algo distinto", variable: "Muy distinto", disparejo: "Muy desigual" };

  function pintarEsencial() {
    if (!window.VistaSimple) return;
    const bloques = [];
    const anio = estado.anio;
    tiposActivos().forEach(t => {
      const cosa = t === "ingresos" ? "ventas" : "pagos";
      const titulo = t === "ingresos" ? "¿Tus ventas se parecen entre sí?" : "¿Tus pagos se parecen entre sí?";
      const { lista } = delPeriodo(t, anio, -1);
      const est = calcular(lista.map(x => x.valor), estado.centro);
      if (!est) { bloques.push({ titulo, nota: "Todavía no hay " + PALABRA[t].varios + " en " + anio + "." }); return; }
      const nv = nivel(est.pct);
      const lineas = [];
      if (nv.clave === "muy-parejo" || nv.clave === "parejo") lineas.push("Casi todas tus " + cosa + " son de un tamaño parecido.");
      else if (nv.clave === "moderado") lineas.push("Tus " + cosa + " varían un poco de tamaño.");
      else lineas.push("Hay " + cosa + (t === "ingresos" ? " muy chicas y otras muy grandes" : " muy chicos y otros muy grandes") + ": no se parecen entre sí.");
      lineas.push("Lo típico (el monto del medio) es <b>" + soles(est.mediana) + "</b>, pero el promedio es <b>" + soles(est.media) + "</b>" +
        (est.media > est.mediana * 1.3 ? (t === "ingresos" ? ": unas pocas ventas muy grandes lo suben." : ": unos pocos pagos muy grandes lo suben.") : "."));
      const grandes = lista.filter(x => est.dma > 0 && x.valor - est.centro > 2 * est.dma).sort((a, b) => b.valor - a.valor);
      if (grandes.length) {
        const quienes = unicos(grandes.map(x => t === "ingresos" ? x.nombre : (x.detalle || x.nombre))).slice(0, 3).map(n => esc(n.slice(0, 34)));
        lineas.push("Hay <b>" + grandes.length + "</b> " + cosa + " mucho más grandes de lo normal" + (quienes.length ? ", por ejemplo: " + quienes.join("; ") : "") + ".");
      }
      const consejo = est.pct > 50
        ? (t === "ingresos" ? "para tus metas y precios usa <b>" + soles(est.mediana) + "</b>, no el promedio. Y cuida a los clientes de las ventas grandes." : "para presupuestar usa <b>" + soles(est.mediana) + "</b> como gasto típico y prevé aparte los pagos grandes.")
        : est.pct > 30
          ? "revisa si mezclas montos de tipos distintos y míralos por separado."
          : "puedes planificar con el promedio (<b>" + soles(est.media) + "</b>): tus " + cosa + " son predecibles.";
      const meses = resumenAnual(t, anio).meses.filter(x => x.est && x.est.pct !== null);
      bloques.push({
        titulo, mide: "el tamaño de cada " + (t === "ingresos" ? "venta" : "pago") + " frente al promedio, para ver si se parecen entre sí.", nivel: { texto: PLANO[nv.clave] || nv.texto, color: nv.color }, lineas,
        chipsTitulo: "¿Cómo fue cada mes?",
        chips: meses.map(x => { const n = nivel(x.est.pct); return { mes: MESES_CORTOS[x.mes], texto: PLANO_MES[n.clave] || n.texto, color: n.color, titulo: MESES_TITULO[x.mes] + ": los montos se alejan " + pctTexto(x.est.pct) + " del monto típico" }; }),
        consejo, nota: est.n < 10 ? "Solo hay " + est.n + " " + PALABRA[t].varios + ": tómalo como referencia." : "",
      });
    });
    VistaSimple.pintar(raiz, bloques);
  }

  /* ======================================================================
     ANÁLISIS ESTADÍSTICO (en palabras sencillas)
     ====================================================================== */

  function tarjetaDato(titulo, valor, nota, color) {
    return '<div class="vm-dato"><small>' + titulo + '</small><strong' + (color ? ' style="color:' + color + '"' : "") + ">" + valor + "</strong><em>" + (nota || "") + "</em></div>";
  }

  function insigniaNivel(p) {
    const nv = nivel(p);
    return '<span class="pj-nivel" style="--c:' + nv.color + '">' + nv.texto + "</span>";
  }

  function analisisDeTipo(tipo) {
    const anio = estado.anio;
    const mes = estado.mes;
    const w = PALABRA[tipo];
    const { lista, ceros } = delPeriodo(tipo, anio, mes);
    const est = calcular(lista.map(x => x.valor), estado.centro);
    if (!est) return { html: '<p class="pj-parrafo">No hay ' + w.varios + " en " + nombrePeriodo(anio, mes) + ".</p>", est: null };

    const nv = nivel(est.pct);
    const delCentro = estado.centro === "mediana" ? "de la mediana (el monto del medio)" : "del promedio";
    const p = [];

    p.push("En <b>" + nombrePeriodo(anio, mes) + "</b> hay <b>" + est.n + " " + (est.n === 1 ? w.uno : w.varios) + "</b> por un total de <b>" + soles(est.total) + "</b>. " +
      "El promedio es <b>" + soles(est.media) + "</b> y el monto del medio (la mediana) es <b>" + soles(est.mediana) + "</b>.");

    p.push("<b>En promedio, cada " + w.uno + " se aleja " + soles(est.dma) + " " + delCentro + ".</b> Eso es el <b>" + pctTexto(est.pct) + "</b> " + delCentro +
      " → " + insigniaNivel(est.pct) + ": " + nv.frase + ".");

    if (est.pct !== null && est.pct > 30 && estado.centro === "media" && est.mediana < est.media * 0.8) {
      p.push("El promedio (" + soles(est.media) + ") está muy por encima del monto del medio (" + soles(est.mediana) + "): unos pocos " + w.varios +
        " muy grandes lo levantan. Para hablar de un " + w.uno + " <b>típico</b>, usa la mediana.");
    }

    if (est.ratio !== null && est.n >= 5) {
      if (est.ratio < 0.7) p.push("Relación DMA ÷ desviación estándar = <b>" + est.ratio.toFixed(2) + "</b> (menor a 0.70): hay <b>montos extremos</b> que inflan la variación.");
      else if (est.ratio <= 0.85) p.push("Relación DMA ÷ desviación estándar = <b>" + est.ratio.toFixed(2) + "</b>: los montos se reparten de forma habitual, sin extremos fuertes.");
      else if (est.ratio > 0.9) p.push("Relación DMA ÷ desviación estándar = <b>" + est.ratio.toFixed(2) + "</b> (mayor a 0.90): los montos se agrupan en pocos niveles, sin extremos.");
    }

    // Montos fuera de lo normal: más de 2 DMA de distancia del centro
    const lejanos = lista.map(m => ({ m, d: Math.abs(m.valor - est.centro) }))
      .filter(x => est.dma > 0 && x.d > 2 * est.dma)
      .sort((a, b) => b.d - a.d);
    if (lejanos.length) {
      p.push("<b>" + lejanos.length + " " + (lejanos.length === 1 ? w.uno : w.varios) + " fuera de lo normal</b> (a más de 2 veces la DMA del centro). Los más alejados:" +
        '<ul class="pj-lista">' + lejanos.slice(0, 3).map(x => "<li>" + fechaCorta(x.m.fecha) + " · " + esc((x.m.nombre || x.m.detalle || "—").slice(0, 60)) + " · <b>" + soles(x.m.valor) + "</b> (" + (x.d / est.dma).toFixed(1) + " veces la DMA)</li>").join("") + "</ul>");
    }

    // Todo el año: estabilidad entre meses y el mes más y menos parejo
    if (mes < 0) {
      const r = resumenAnual(tipo, anio);
      if (r.entreMeses) {
        p.push("<b>Entre meses:</b> el total de cada mes se aleja en promedio <b>" + soles(r.entreMeses.dma) + "</b> del total mensual típico (" + pctTexto(r.entreMeses.pct) + ", " + nivel(r.entreMeses.pct).texto.toLowerCase() + ")." +
          (r.mesesConDatos < 10 ? " <i>Provisional: solo " + r.mesesConDatos + " meses con datos (con 10 o más es confiable).</i>" : ""));
      }
      const validos = r.meses.filter(x => x.est && x.est.n >= 5);
      if (validos.length >= 2) {
        const mas = validos.reduce((a, b) => (b.est.pct > a.est.pct ? b : a));
        const menos = validos.reduce((a, b) => (b.est.pct < a.est.pct ? b : a));
        p.push("Mes más parejo: <b>" + MESES_TITULO[menos.mes] + "</b> (" + pctTexto(menos.est.pct) + "). Mes más disparejo: <b>" + MESES_TITULO[mas.mes] + "</b> (" + pctTexto(mas.est.pct) + ").");
      }
    } else {
      const anual = calcular(delPeriodo(tipo, anio, -1).lista.map(x => x.valor), estado.centro);
      if (anual && anual.pct !== null && est.pct !== null) {
        const dif = est.pct - anual.pct;
        p.push("Comparado con todo " + anio + " (" + pctTexto(anual.pct) + "), " + MESES_TITULO[mes].toLowerCase() + " fue <b>" +
          (Math.abs(dif) < 3 ? "igual de parejo" : dif < 0 ? "más parejo" : "más disparejo") + "</b>" + (Math.abs(dif) >= 3 ? " (" + Math.abs(dif).toFixed(1) + " puntos)" : "") + ".");
      }
    }

    // Calidad del dato
    const notas = [];
    if (est.n < 10) notas.push("Pocos datos (" + est.n + "): tómalo solo como referencia.");
    else if (est.n < 30) notas.push("Datos suficientes para una referencia (con 30 o más el resultado es sólido).");
    else notas.push("Cantidad de datos suficiente (" + est.n + "): resultado sólido.");
    const incompleto = mesIncompleto(tipo, anio, mes, lista);
    if (incompleto) notas.push("Este mes podría estar incompleto: el último registro es del " + fechaCorta(incompleto) + ".");
    const conAviso = lista.filter(m => m.aviso).length;
    if (conAviso) notas.push("Incluye " + conAviso + " egreso(s) marcados «⚠ Revisar moneda» (posible monto en dólares): pueden alterar el resultado.");
    if (ceros) notas.push(ceros + " registro(s) con monto 0 no se cuentan.");

    // Indicadores: ¿cada mes fue bueno (montos parejos) o malo (montos muy disparejos)?
    // Sale del mismo nivel de la DMA: la etiqueta del mes y su color nunca se contradicen
    const indicadorDma = v => { const k = nivel(v).ind || SEMAFORO.regular; return { t: k.texto, c: k.color, i: k.icono }; };
    const meses = resumenAnual(tipo, anio).meses.filter(x => x.est && x.est.pct !== null);
    const indicadoresHtml = meses.length
      ? '<h5 class="es-sub">Indicadores: ¿cada mes fue bueno o malo?</h5><div class="es-chips">' +
        meses.map(x => {
          const k = indicadorDma(x.est.pct);
          return '<span class="es-chip' + (x.mes === mes ? " es-chip-activo" : "") + '" style="--c:' + k.c + '" title="' + MESES_TITULO[x.mes] + ": se aleja en promedio " + soles(x.est.dma) + '"><b>' + MESES_CORTOS[x.mes] + "</b> " + k.i + " " + k.t + " · " + pctTexto(x.est.pct) + "</span>";
        }).join("") + "</div>" +
        '<p class="es-leyenda">Verde = bueno, rojo = malo (los mismos colores de «Estabilidad» y «Mi mes frente a los demás»). <b>Muy bueno</b> = menos de 5% del ' + (estado.centro === "mediana" ? "monto del medio" : "promedio") + " · <b>Bueno</b> = 5% a 15%: montos parejos, el promedio sirve para planificar · <b>Regular</b> = 15% a 30% · <b>Malo</b> = 30% a 50% · <b>Muy malo</b> = más de 50%: los montos son muy distintos entre sí y difíciles de prever.</p>"
      : "";

    // Interpretación, al estilo del ejemplo de la gelatina
    const interpretacion = '<h5 class="es-sub">Interpretación</h5><p class="pj-parrafo es-interpretacion">Con lo que concluiríamos que cada ' + w.uno + " de " + nombrePeriodo(anio, mes) +
      " es en promedio <b>" + soles(est.media) + "</b>, con una tendencia a alejarse " + delCentro + " en <b>" + soles(est.dma) + "</b> en promedio (el " + pctTexto(est.pct) + "). " +
      (est.pct > 50
        ? "Como esa distancia es mayor que la mitad del promedio, el promedio no describe bien a un " + w.uno + " común: uno típico está más cerca de <b>" + soles(est.mediana) + "</b> (la mediana). "
        : est.pct > 30
          ? "Los montos varían bastante: usa el promedio con cuidado y mira también la mediana (" + soles(est.mediana) + "). "
          : "Los montos se parecen entre sí: el promedio es una buena referencia para planificar. ") +
      "Esta información te permite saber cómo es un " + w.uno + " normal y detectar los que se salen de lo común.</p>";

    // Recomendaciones (reglas generales: sirven para cualquier Excel que cargues)
    const rec = [];
    if (est.pct > 50) {
      rec.push("Separa los montos grandes: los mayores a <b>" + soles(est.centro + 2 * est.dma) + "</b> son pocos pero pesan mucho; analízalos aparte del resto.");
      if (tipo === "ingresos") {
        rec.push("Para metas, precios y proyecciones usa la <b>mediana (" + soles(est.mediana) + ")</b>, no el promedio.");
        if (lejanos.length) rec.push("Tus ingresos dependen de pocos pedidos grandes (por ejemplo: " + unicos(lejanos.map(x => x.m.nombre)).slice(0, 3).map(n => esc(n.slice(0, 40))).join("; ") + "). Cuida a esos clientes y busca más pedidos medianos para no depender de ellos.");
      } else {
        rec.push("Para presupuestar gastos usa la <b>mediana (" + soles(est.mediana) + ")</b> como gasto típico y prevé aparte los pagos grandes.");
        if (lejanos.length) rec.push("Programa con anticipación los pagos grandes (por ejemplo: " + unicos(lejanos.map(x => x.m.detalle || x.m.nombre)).slice(0, 3).map(n => esc(n.slice(0, 40))).join("; ") + "): son los que desordenan tu caja.");
      }
    } else if (est.pct > 30) {
      rec.push("Revisa si mezclas " + w.varios + " de tipos distintos (por ejemplo, " + (tipo === "ingresos" ? "pedidos por millar y ventas sueltas" : "planilla y compras pequeñas") + ") y míralos por separado.");
    } else {
      rec.push("Tus " + w.varios + " son predecibles: puedes presupuestar con el promedio (" + soles(est.media) + ").");
    }
    if (mes < 0 && meses.length >= 2) {
      const peorMes = meses.reduce((a, b) => (b.est.pct > a.est.pct ? b : a));
      rec.push("Revisa <b>" + MESES_TITULO[peorMes.mes] + "</b>: fue el mes más disparejo (" + pctTexto(peorMes.est.pct) + "). Haz clic en él en la tabla para ver sus montos fuera de lo normal.");
    }
    if (conAviso) rec.push("Convierte a soles los egresos marcados «⚠ Revisar moneda» para que el análisis sea exacto.");
    if (est.n < 10) rec.push("Registra más " + w.varios + " para que el resultado sea confiable.");
    const recomendaciones = '<h5 class="es-sub">Recomendaciones</h5><ul class="es-rec">' + rec.map(r => "<li>" + r + "</li>").join("") + "</ul>";

    return {
      html: indicadoresHtml + interpretacion +
        '<h5 class="es-sub">Detalle</h5>' + p.map(t => '<p class="pj-parrafo">' + t + "</p>").join("") +
        recomendaciones + '<p class="pj-notas">' + notas.join(" ") + "</p>",
      est,
    };
  }

  function pintarAnalisis() {
    const cont = raiz.querySelector("#pjAnalisis");
    const tipos = tiposActivos();
    const partes = tipos.map(t => ({ t, a: analisisDeTipo(t) }));

    let html = "";
    partes.forEach(({ t, a }) => {
      const e = a.est;
      html += '<div class="pj-bloque pj-bloque-' + t + '">' +
        '<h4 class="pj-bloque-titulo"><i style="background:' + colorDe(t) + '"></i>' + PALABRA[t].Varios + " · " + nombrePeriodo(estado.anio, estado.mes) + (e ? " " + insigniaNivel(e.pct) : "") + "</h4>";
      if (e) {
        html += '<div class="vm-analisis-grid">' +
          tarjetaDato("DMA (se aleja en promedio)", soles(e.dma), "respecto " + (estado.centro === "mediana" ? "a la mediana" : "al promedio")) +
          tarjetaDato("DMA en %", pctTexto(e.pct), nivel(e.pct).texto, nivel(e.pct).color) +
          tarjetaDato("Promedio", soles(e.media), "total ÷ " + e.n) +
          tarjetaDato("Mediana (monto del medio)", soles(e.mediana), "la mitad está por debajo") +
          tarjetaDato("Cantidad", String(e.n), "total " + soles(e.total, true)) +
          tarjetaDato("Desviación estándar", soles(e.de), "coef. de variación " + pctTexto(e.cv)) +
          tarjetaDato("Mínimo y máximo", soles(e.min, true) + " – " + soles(e.max, true), "rango " + soles(e.rango, true)) +
          tarjetaDato("50% central (Q1 – Q3)", soles(e.q1, true) + " – " + soles(e.q3, true), "rango intercuartil " + soles(e.iqr, true)) +
          "</div>";
      }
      html += a.html + "</div>";
    });

    // Comparación y relación entre los dos
    if (estado.tipo === "comparar") {
      const ei = partes[0].a.est;
      const ee = partes[1].a.est;
      if (ei && ee) {
        const masParejo = ei.pct < ee.pct ? "ingresos" : "egresos";
        const dif = Math.abs(ei.pct - ee.pct);
        html += '<div class="pj-bloque pj-bloque-relacion"><h4 class="pj-bloque-titulo">Ingresos frente a egresos · ' + nombrePeriodo(estado.anio, estado.mes) + "</h4>" +
          '<p class="pj-parrafo">' + (dif < 3
            ? "Tus ingresos y tus egresos son <b>igual de parejos</b> (" + pctTexto(ei.pct) + " y " + pctTexto(ee.pct) + ")."
            : "Tus <b>" + masParejo + " son más parejos</b>: " + pctTexto(ei.pct) + " en ingresos frente a " + pctTexto(ee.pct) + " en egresos (" + dif.toFixed(1) + " puntos de diferencia).") +
          "</p>" +
          '<p class="pj-parrafo">En este período registraste <b>' + soles(ei.total) + "</b> de ingresos y <b>" + soles(ee.total) + "</b> de egresos: " +
          (ei.total >= ee.total ? "los ingresos cubren los egresos con <b>" + soles(ei.total - ee.total) + "</b> de diferencia." : "los egresos superan a los ingresos en <b>" + soles(ee.total - ei.total) + "</b>.") +
          ' <i>Los ingresos son lo registrado (no necesariamente lo cobrado).</i></p></div>';
      }
    }
    cont.innerHTML = html;
  }

  /* ======================================================================
     FÓRMULAS Y CONCEPTO (con tus propios números)
     ====================================================================== */

  function pintarFormulas() {
    const tarjeta = raiz.querySelector("#pjTarjetaFormulas");
    tarjeta.hidden = !verFormulas;
    if (!verFormulas) return;
    const cont = raiz.querySelector("#pjFormulas");
    const tipo = estado.tipo === "comparar" ? "ingresos" : estado.tipo;
    const w = PALABRA[tipo];
    const { lista } = delPeriodo(tipo, estado.anio, estado.mes);
    const est = calcular(lista.map(x => x.valor), estado.centro);
    const simb = estado.centro === "mediana" ? "Me" : "x̄";
    const nombreC = estado.centro === "mediana" ? "mediana" : "promedio";
    const elC = estado.centro === "mediana" ? "la mediana" : "el promedio";
    const alC = estado.centro === "mediana" ? "a la mediana" : "al promedio";
    const delC = estado.centro === "mediana" ? "de la mediana" : "del promedio";

    let ejemplo = "";
    if (est) {
      const muestra = lista.slice(0, 5);
      ejemplo = '<h4 class="pj-sub">Paso a paso con tus ' + w.varios + " de " + nombrePeriodo(estado.anio, estado.mes) + (estado.tipo === "comparar" ? " (ejemplo con ingresos)" : "") + "</h4>" +
        '<ol class="pj-pasos">' +
        "<li><b>Calcula " + elC + "</b>: " + (estado.centro === "mediana" ? "ordena los " + est.n + " montos y toma el del medio" : "suma los " + est.n + " montos (" + soles(est.total) + ") y divide entre " + est.n) + " → " + simb + " = <b>" + soles(est.centro) + "</b>.</li>" +
        "<li><b>Mide la distancia de cada monto</b> " + alC + ", sin signo (el valor absoluto |…| hace que las distancias nunca se anulen):</li></ol>" +
        '<div class="vm-tabla-envoltura"><table class="vm-tabla pj-tabla-ejemplo"><thead><tr><th>Fecha</th><th>Monto xᵢ</th><th>xᵢ − ' + simb + "</th><th>|xᵢ − " + simb + "|</th></tr></thead><tbody>" +
        muestra.map(m => "<tr><td>" + fechaCorta(m.fecha) + "</td><td>" + soles(m.valor) + "</td><td>" + soles(m.valor - est.centro) + "</td><td><b>" + soles(Math.abs(m.valor - est.centro)) + "</b></td></tr>").join("") +
        (est.n > 5 ? '<tr><td colspan="4" class="vm-sin-dato">… y ' + (est.n - 5) + " monto(s) más</td></tr>" : "") +
        "</tbody></table></div>" +
        '<ol class="pj-pasos" start="3">' +
        "<li><b>Suma todas las distancias</b>: Σ|xᵢ − " + simb + "| = <b>" + soles(est.sumaDist) + "</b>.</li>" +
        "<li><b>Divide entre la cantidad de montos</b> (n = " + est.n + ", nunca n − 1): DMA = " + soles(est.sumaDist) + " ÷ " + est.n + " = <b>" + soles(est.dma) + "</b>.</li>" +
        "<li><b>Pásalo a porcentaje</b>: " + soles(est.dma) + " ÷ " + soles(est.centro) + " × 100 = <b>" + pctTexto(est.pct) + "</b> → " + insigniaNivel(est.pct) + ".</li></ol>";
    }

    cont.innerHTML =
      '<p class="pj-parrafo"><b>¿Qué es?</b> La <b>desviación media absoluta (DMA)</b> responde una pregunta sencilla: <i>en promedio, ¿cuánto se aleja cada monto ' + delC + "?</i> " +
      "Si es pequeña, tus montos se parecen entre sí (son <b>parejos</b>). Si es grande, son muy distintos (son <b>disparejos</b>) y el promedio deja de representar a un monto típico.</p>" +
      '<div class="pj-formulas">' +
      '<div class="pj-formula"><span>Desviación media absoluta</span><code>DMA = Σ |xᵢ − ' + simb + "| ÷ n</code><em>xᵢ = cada monto · " + simb + " = " + nombreC + " · n = cantidad · |…| = distancia sin signo</em></div>" +
      '<div class="pj-formula"><span>DMA en porcentaje</span><code>DMA % = DMA ÷ ' + simb + ' × 100</code><em>permite comparar meses, ingresos y egresos de distinto tamaño</em></div>' +
      '<div class="pj-formula"><span>DMA respecto a la mediana</span><code>DMAₘ = Σ |xᵢ − Me| ÷ n</code><em>' + (est ? "con tus datos: " + soles(est.dmaMediana) : "") + " · menos sensible a montos extremos</em></div>" +
      '<div class="pj-formula"><span>Mediana de las desviaciones</span><code>MedAD = mediana(|xᵢ − Me|)</code><em>' + (est ? "con tus datos: " + soles(est.medDesv) + " (× 1.4826 = " + soles(est.medDesvEsc) + ")" : "") + " · la versión más resistente a extremos</em></div>" +
      '<div class="pj-formula"><span>Relación con la desviación estándar</span><code>DMA ÷ DE ≈ 0.80</code><em>' + (est && est.ratio !== null ? "con tus datos: " + est.ratio.toFixed(2) + " · " : "") + "si es menor a 0.70, hay montos extremos</em></div>" +
      '<div class="pj-formula"><span>En Excel</span><code>=DESVPROM(rango)</code><em>en Excel en inglés: =AVEDEV(rango) · da la DMA respecto al promedio</em></div>' +
      "</div>" + ejemplo +
      '<h4 class="pj-sub">Cómo leer el resultado (DMA en %)</h4>' +
      '<div class="pj-guia">' +
      [[2, "Menos de 5%"], [10, "5% a 15%"], [20, "15% a 30%"], [40, "30% a 50%"], [70, "Más de 50%"]].map(g => {
        const nv = nivel(g[0]);
        return '<div class="pj-guia-fila"><span class="pj-nivel" style="--c:' + nv.color + '">' + nv.texto + "</span><b>" + g[1] + "</b><em>" + nv.frase + "</em></div>";
      }).join("") + "</div>" +
      '<p class="pj-notas">Errores comunes: olvidar el valor absoluto (las distancias con signo siempre suman 0), dividir entre n − 1 (eso es de la varianza, no de la DMA) y confundir la DMA con la mediana de las desviaciones. La DMA describe tus datos; no es un pronóstico.</p>';
  }

  /* ======================================================================
     TABLA MES A MES Y TODO EL AÑO
     ====================================================================== */

  function pintarTabla() {
    const cont = raiz.querySelector("#pjTabla");
    const anio = estado.anio;
    const tipos = tiposActivos();
    const res = tipos.map(t => ({ t, r: resumenAnual(t, anio) }));

    function celdas(est) {
      if (!est) return '<td class="vm-sin-dato">—</td><td class="vm-sin-dato">—</td><td class="vm-sin-dato">—</td><td class="vm-sin-dato">—</td>';
      return "<td>" + est.n + "</td><td>" + soles(est.total, true) + "</td><td>" + soles(est.dma, true) + "</td><td>" + pctTexto(est.pct) + " " + insigniaNivel(est.pct) + "</td>";
    }

    let html = '<div class="vm-tabla-envoltura"><table class="vm-tabla pj-tabla"><thead>';
    if (tipos.length > 1) {
      html += '<tr><th rowspan="2">Mes</th>' + res.map(x => '<th colspan="4" style="color:' + colorDe(x.t) + '">' + PALABRA[x.t].Varios + "</th>").join("") + "</tr><tr>" +
        res.map(() => "<th>N.º</th><th>Total</th><th>DMA</th><th>DMA %</th>").join("") + "</tr>";
    } else {
      html += "<tr><th>Mes</th><th>N.º</th><th>Total</th><th>DMA</th><th>DMA %</th></tr>";
    }
    html += "</thead><tbody>";
    MESES.forEach((_, m) => {
      html += '<tr class="pj-fila' + (estado.mes === m ? " pj-fila-activa" : "") + '" data-mes="' + m + '" title="Ver ' + MESES_TITULO[m] + '"><td>' + MESES_TITULO[m] + "</td>" + res.map(x => celdas(x.r.meses[m].est)).join("") + "</tr>";
    });
    html += '<tr class="pj-fila pj-fila-anio' + (estado.mes < 0 ? " pj-fila-activa" : "") + '" data-mes="-1"><td><b>Todo ' + anio + "</b></td>" + res.map(x => celdas(x.r.anual)).join("") + "</tr>";
    html += '<tr class="pj-fila-entre"><td>Entre meses <small>(totales de cada mes)</small></td>' + res.map(x => x.r.entreMeses
      ? "<td>" + x.r.mesesConDatos + " meses</td><td>" + soles(x.r.entreMeses.media, true) + " prom.</td><td>" + soles(x.r.entreMeses.dma, true) + "</td><td>" + pctTexto(x.r.entreMeses.pct) + (x.r.mesesConDatos < 10 ? ' <small class="pj-provisional">provisional</small>' : "") + "</td>"
      : '<td colspan="4" class="vm-sin-dato">Se necesitan al menos 2 meses</td>').join("") + "</tr>";
    html += "</tbody></table></div>";
    cont.innerHTML = html;
  }

  /* ======================================================================
     ARCHIVOS
     ====================================================================== */

  function nombreArchivo(ext) {
    return "que-tan-parejos-" + estado.tipo + "-" + (estado.mes < 0 ? "anio" : MESES[estado.mes].toLowerCase()) + "-" + estado.anio + "." + ext;
  }

  function descargarImagen() {
    if (!grafico) { avisar("No hay gráfico para descargar todavía.", "error"); return; }
    const a = document.createElement("a");
    a.href = grafico.toBase64Image("image/png", 1);
    a.download = nombreArchivo("png");
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Igual que en "Ventas por mes": se copia la imagen al portapapeles (no sale de tu computador)
  function compartirImagen() {
    if (!grafico) { avisar("No hay gráfico para compartir todavía.", "error"); return; }
    grafico.canvas.toBlob(blob => {
      if (blob && navigator.clipboard && window.ClipboardItem) {
        navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
          .then(() => avisar("Imagen copiada. Pégala en WhatsApp, Word o correo.", "success"))
          .catch(() => avisar("Tu navegador no permitió copiar. Usa «Descargar».", "error"));
      } else {
        avisar("Tu navegador no permite copiar imágenes. Usa «Descargar».", "error");
      }
    });
  }

  async function descargarExcel() {
    if (typeof XLSX === "undefined" || typeof descargarLibro !== "function") { avisar("No se pudo preparar el Excel.", "error"); return; }
    const wb = XLSX.utils.book_new();
    const filasMes = [["Tipo", "Mes", "N.º", "Total (S/)", "Promedio (S/)", "Mediana (S/)", "DMA (S/)", "DMA %", "Nivel"]];
    ["ingresos", "egresos"].forEach(t => {
      const r = resumenAnual(t, estado.anio);
      r.meses.concat([{ mes: -1, est: r.anual }]).forEach(x => {
        const e = x.est;
        filasMes.push([PALABRA[t].Varios, x.mes < 0 ? "Todo " + estado.anio : MESES_TITULO[x.mes],
          e ? e.n : 0, e ? e.total : "", e ? e.media : "", e ? e.mediana : "", e ? e.dma : "", e && e.pct !== null ? Number(e.pct.toFixed(2)) : "", e ? nivel(e.pct).texto : "Sin datos"]);
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filasMes), "Mes a mes");
    tiposActivos().forEach(t => {
      const { lista } = delPeriodo(t, estado.anio, estado.mes);
      const e = calcular(lista.map(x => x.valor), estado.centro);
      const filas = [["Fecha", "Nombre", "Detalle", "Monto (S/)", "Distancia al centro (S/)"]];
      lista.forEach(m => filas.push([fechaCorta(m.fecha), m.nombre, m.detalle, m.valor, e ? Math.abs(m.valor - e.centro) : ""]));
      if (e) filas.push([], ["Centro (" + estado.centro + ")", "", "", e.centro], ["DMA", "", "", e.dma], ["DMA %", "", "", Number(e.pct.toFixed(2))]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), (PALABRA[t].Varios + " " + (estado.mes < 0 ? "año" : MESES_CORTOS[estado.mes])).slice(0, 31));
    });
    const ok = await descargarLibro(wb, nombreArchivo("xlsx"));
    if (ok) avisar("✅ Resultados guardados en Excel.", "success");
  }

  function copiarResumen() {
    const texto = raiz.querySelector("#pjAnalisis").innerText.trim();
    if (!navigator.clipboard) { avisar("Tu navegador no permitió copiar.", "error"); return; }
    navigator.clipboard.writeText(TITULO + "\n\n" + texto)
      .then(() => avisar("Resumen copiado. Pégalo en Word, WhatsApp o correo.", "success"))
      .catch(() => avisar("Tu navegador no permitió copiar.", "error"));
  }

  /* ======================================================================
     VENTANA
     ====================================================================== */

  function opciones(objeto, sel) {
    return Object.keys(objeto).map(k => '<option value="' + k + '"' + (k === sel ? " selected" : "") + ">" + (typeof objeto[k] === "string" ? objeto[k] : objeto[k].nombre) + "</option>").join("");
  }

  function interruptor(clave, texto) {
    return '<div class="vm-seccion-cab"><span class="pj-interruptor-texto">' + texto + '</span><label class="vm-interruptor" title="' + texto + '"><input type="checkbox" data-k="' + clave + '" aria-label="' + texto + '"><i></i></label></div>';
  }

  function campoNumero(clave, etiqueta, min, max, paso) {
    return '<div class="vm-campo"><span>' + etiqueta + '</span><div class="vm-fila">' +
      '<input type="range" data-k="' + clave + '" min="' + min + '" max="' + max + '" step="' + paso + '">' +
      '<input type="number" data-k="' + clave + '" min="' + min + '" max="' + max + '" step="' + paso + '"></div></div>';
  }

  function menu(id, titulo, cuerpo) {
    return '<div class="vm-menu" data-menu="' + id + '"><button type="button" class="vm-menu-boton" aria-haspopup="true" aria-expanded="false">' + titulo + '</button><div class="vm-menu-lista" hidden>' + cuerpo + "</div></div>";
  }

  function construirVentana() {
    const div = document.createElement("div");
    div.className = "vm-overlay pj-overlay";
    div.hidden = true;
    div.setAttribute("role", "dialog");
    div.setAttribute("aria-modal", "true");
    div.setAttribute("aria-label", TITULO);

    const item = (accion, texto) => '<button type="button" class="vm-menu-item" data-accion="' + accion + '">' + texto + "</button>";

    div.innerHTML =
      '<div class="vm-ventana">' +
      '<header class="vm-barra">' +
      '<div class="vm-marca pj-marca"><i></i><span>' + TITULO + "</span></div>" +
      '<nav class="vm-menus" aria-label="Menús">' +
      menu("archivo", "Archivo",
        item("png", "Descargar imagen (PNG)") + item("excel", "Descargar resultados (Excel)") + item("imprimir", "Imprimir") +
        '<div class="vm-menu-sep"></div>' + item("cerrar", "Cerrar ventana <small>Esc</small>")) +
      menu("editar", "Editar", item("copiar", "Copiar resumen del análisis") + item("restablecer", "Restablecer ajustes")) +
      menu("datos", "Datos",
        item("ver-ingresos", "Ver ingresos") + item("ver-egresos", "Ver egresos") + item("ver-comparar", "Comparar ingresos y egresos") +
        '<div class="vm-menu-sep"></div>' + item("todo-anio", "Todo el año") + item("mes-sistema", "Mes elegido en el sistema") +
        '<div class="vm-menu-sep"></div>' + item("actualizar", "Actualizar desde mis registros") + item("ir-tabla", "Ir a la tabla mes a mes")) +
      menu("vista", "Vista",
        Object.keys(GRAFICOS).map(k => '<button type="button" class="vm-menu-item" data-grafico="' + k + '">' + GRAFICOS[k] + "</button>").join("") +
        '<div class="vm-menu-sep"></div>' + item("ver-formulas", "Mostrar / ocultar fórmulas") + item("pantalla-completa", "Pantalla completa") +
        item("ventas-mes", "Abrir el editor de líneas «Ventas por mes»")) +
      menu("temas", "Temas", Object.keys(TEMAS).map(k => '<button type="button" class="vm-menu-item" data-tema="' + k + '">' + TEMAS[k].nombre + "</button>").join("")) +
      menu("ayuda", "Ayuda",
        '<p class="vm-ayuda-texto"><b>¿Qué mide esto?</b> Qué tan parecidos son tus montos entre sí. La <b>DMA</b> dice cuánto se aleja, en promedio, cada monto del promedio. ' +
        "En porcentaje: menos de 15% es parejo; más de 50% es muy disparejo y el promedio ya no representa un monto típico.<br><br>" +
        "Elige a la izquierda <b>ingresos, egresos o ambos</b>, el <b>año</b> y el <b>mes</b> (o todo el año). Nada de lo que cambies aquí modifica tus datos.</p>") +
      "</nav>" +
      '<button type="button" class="vm-cerrar" data-accion="cerrar" aria-label="Cerrar ventana">✕</button>' +
      "</header>" +

      '<div class="vm-cuerpo">' +
      '<aside class="vm-panel" aria-label="Ajustes del análisis">' +
      '<div class="vm-pestanas" role="tablist">' +
      '<button type="button" class="vm-pestana" role="tab" aria-selected="true" data-pestana="analisis">Análisis</button>' +
      '<button type="button" class="vm-pestana" role="tab" aria-selected="false" data-pestana="formato">Formato</button>' +
      "</div>" +

      '<div class="vm-pagina" data-pagina="analisis">' +
      '<div class="vm-campo"><span class="vm-campo-etiqueta">¿Qué quieres analizar?</span>' +
      '<div class="pj-tipos" role="group" aria-label="Qué analizar">' +
      '<button type="button" class="pj-tipo" data-tipo="ingresos"><i></i>Ingresos</button>' +
      '<button type="button" class="pj-tipo" data-tipo="egresos"><i></i>Egresos</button>' +
      '<button type="button" class="pj-tipo" data-tipo="comparar"><i></i>Ambos</button>' +
      "</div></div>" +
      '<label class="vm-campo"><span>Año</span><select data-k="anio" id="pjAnio"></select></label>' +
      '<label class="vm-campo"><span>Período</span><select data-k="mes" id="pjMes"></select></label>' +
      '<label class="vm-campo"><span>Gráfico</span><select data-k="grafico">' + opciones(GRAFICOS, estado.grafico) + "</select></label>" +
      '<label class="vm-campo"><span>Medir la distancia desde</span><select data-k="centro"><option value="media">El promedio (lo habitual)</option><option value="mediana">La mediana (monto del medio)</option></select></label>' +
      '<label class="vm-campo"><span>Decimales</span><select data-k="decimales"><option value="0">Sin decimales</option><option value="1">1 decimal</option><option value="2">2 decimales</option></select></label>' +
      '<p class="vm-pie-nota pj-nota-panel">Los datos salen de tu «Registro del mes» (ingresos y egresos) y se actualizan cada vez que abres esta ventana.</p>' +
      "</div>" +

      '<div class="vm-pagina" data-pagina="formato" hidden>' +
      '<label class="vm-campo"><span>Tema de colores</span><select data-k="tema">' + opciones(TEMAS, estado.tema) + "</select></label>" +
      campoNumero("ancho", "Ancho (px)", 400, 1400, 10) +
      campoNumero("alto", "Altura (px)", 260, 800, 10) +
      '<label class="vm-campo"><span>Tipo de letra</span><select data-k="fuente">' + FUENTES.map(f => '<option value="' + f + '">' + f + "</option>").join("") + "</select></label>" +
      '<label class="vm-campo"><span>Color de fondo del gráfico</span><input type="color" data-k="fondo"></label>' +
      '<div class="vm-seccion">' + interruptor("verBanda", "Mostrar la franja ± DMA") + "</div>" +
      '<div class="vm-seccion">' + interruptor("resaltar", "Resaltar montos fuera de lo normal") + "</div>" +
      '<div class="vm-seccion">' + interruptor("leyenda", "Mostrar leyenda") + "</div>" +
      '<div class="vm-seccion">' + interruptor("animacion", "Animación") + "</div>" +
      "</div>" +
      "</aside>" +

      '<main class="vm-centro">' +
      '<section class="vm-tarjeta" aria-label="Gráfico">' +
      '<div class="vm-marco"><div class="vm-lienzo"><canvas id="pjCanvas"></canvas><div class="vm-vacio" hidden></div></div></div>' +
      '<div class="vm-acciones">' +
      '<button type="button" class="vm-boton" data-accion="compartir">Compartir</button>' +
      '<button type="button" class="vm-boton vm-boton-negro" data-accion="png">Descargar</button>' +
      "</div></section>" +
      '<section class="vm-tarjeta" aria-label="Análisis estadístico"><h3>Análisis estadístico</h3><div id="pjAnalisis"></div></section>' +
      '<section class="vm-tarjeta" id="pjTarjetaFormulas" aria-label="Cómo se calcula"><h3>¿Cómo se calcula? Concepto y fórmulas</h3><div id="pjFormulas"></div></section>' +
      '<section class="vm-tarjeta" id="pjTarjetaTabla" aria-label="Mes a mes y todo el año">' +
      '<div class="vm-hojas"><span class="vm-hoja">Mes a mes</span><span class="vm-hoja-nota">Haz clic en un mes para verlo arriba · solo lectura</span></div>' +
      '<div id="pjTabla"></div></section>' +
      "</main></div></div>";

    document.body.appendChild(div);
    if (window.VistaSimple) {
      VistaSimple.instalar(div, {
        idEsencial: "pjEsencial",
        mantener: "#pjAnio",
        alAlternar: detalles => { if (!detalles) { estado.grafico = "mensual"; estado.mes = -1; } sincronizarControles(); redibujar(); },
        ayudas: [
          { sel: "#pjMes", texto: "Elige todo el año o un mes para ver solo los montos de ese mes." },
          { sel: "select[data-k='grafico']", texto: "Cada gráfico muestra lo mismo desde otro ángulo. El de «mes a mes» es el más fácil de leer." },
          { sel: "select[data-k='centro']", texto: "El promedio es la suma dividida entre la cantidad. La mediana es el monto del medio y no se deja arrastrar por los montos muy grandes." },
          { sel: "select[data-k='decimales']", texto: "Cuántos decimales se muestran en los montos." },
        ],
      });
    }
    return div;
  }

  function sincronizarControles() {
    raiz.querySelectorAll(".pj-tipo").forEach(b => b.setAttribute("aria-pressed", b.dataset.tipo === estado.tipo ? "true" : "false"));

    const anios = aniosDisponibles();
    const selAnio = raiz.querySelector("#pjAnio");
    selAnio.innerHTML = anios.length ? anios.map(a => '<option value="' + a + '">' + a + "</option>").join("") : '<option value="' + estado.anio + '">' + estado.anio + "</option>";

    const selMes = raiz.querySelector("#pjMes");
    const conteo = m => tiposActivos().reduce((s, t) => s + delPeriodo(t, estado.anio, m).lista.length, 0);
    selMes.innerHTML = '<option value="-1">Todo el año (enero a diciembre)</option>' +
      MESES_TITULO.map((n, m) => { const c = conteo(m); return '<option value="' + m + '">' + n + (c ? " · " + c + " monto(s)" : " · sin datos") + "</option>"; }).join("");

    raiz.querySelectorAll("[data-k]").forEach(ctrl => {
      const v = estado[ctrl.dataset.k];
      if (ctrl.type === "checkbox") ctrl.checked = !!v;
      else ctrl.value = v === null || v === undefined ? "" : String(v);
    });
  }

  function alCambiar(e) {
    const c = e.target;
    const k = c.dataset.k;
    if (!k) return;
    let v = c.type === "checkbox" ? c.checked : c.value;
    if (["anio", "mes", "decimales", "ancho", "alto"].indexOf(k) !== -1) {
      if (c.value === "") return;
      v = Number(c.value);
    }
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

  function ponerTipo(t) {
    estado.tipo = t;
    sincronizarControles();
    redibujar();
  }

  function ejecutar(accion) {
    switch (accion) {
      case "png": descargarImagen(); break;
      case "excel": descargarExcel(); break;
      case "imprimir": window.print(); break;
      case "cerrar": cerrarParejos(); break;
      case "compartir": compartirImagen(); break;
      case "copiar": copiarResumen(); break;
      case "restablecer": {
        const tipo = estado.tipo;
        const anio = estado.anio;
        estado = clonar(ESTADO_INICIAL);
        estado.tipo = tipo;
        estado.anio = anio;
        sincronizarControles();
        redibujar();
        avisar("Ajustes restablecidos.", "success");
        break;
      }
      case "ver-ingresos": ponerTipo("ingresos"); break;
      case "ver-egresos": ponerTipo("egresos"); break;
      case "ver-comparar": ponerTipo("comparar"); break;
      case "todo-anio": estado.mes = -1; sincronizarControles(); redibujar(); break;
      case "mes-sistema": estado.mes = mesActual; sincronizarControles(); redibujar(); break;
      case "actualizar": sincronizarControles(); redibujar(); avisar("Análisis actualizado con tus registros.", "success"); break;
      case "ir-tabla": raiz.querySelector("#pjTarjetaTabla").scrollIntoView({ behavior: "smooth", block: "start" }); break;
      case "ver-formulas": verFormulas = !verFormulas; pintarFormulas(); break;
      case "pantalla-completa":
        if (document.fullscreenElement) document.exitFullscreen();
        else if (raiz.requestFullscreen) raiz.requestFullscreen();
        break;
      case "ventas-mes":
        cerrarParejos();
        if (typeof abrirVentasMes === "function") abrirVentasMes();
        break;
      default: break;
    }
  }

  function conectarEventos() {
    raiz.addEventListener("change", alCambiar);
    raiz.addEventListener("input", e => { if (e.target.type === "range" || e.target.type === "number" || e.target.type === "color") alCambiar(e); });

    raiz.addEventListener("click", e => {
      const t = e.target;
      const botonMenu = t.closest(".vm-menu-boton");
      if (botonMenu) {
        const m = botonMenu.parentElement;
        const abierto = m.classList.contains("vm-menu-abierto");
        cerrarMenus();
        if (!abierto) {
          m.classList.add("vm-menu-abierto");
          m.querySelector(".vm-menu-lista").hidden = false;
          botonMenu.setAttribute("aria-expanded", "true");
        }
        return;
      }
      const accion = t.closest("[data-accion]");
      if (accion) { cerrarMenus(); ejecutar(accion.dataset.accion); return; }
      const g = t.closest("[data-grafico]");
      if (g) { cerrarMenus(); estado.grafico = g.dataset.grafico; sincronizarControles(); redibujar(); return; }
      const tema = t.closest("[data-tema]");
      if (tema) { cerrarMenus(); estado.tema = tema.dataset.tema; sincronizarControles(); redibujar(); return; }
      const tipo = t.closest(".pj-tipo");
      if (tipo) { ponerTipo(tipo.dataset.tipo); return; }
      const fila = t.closest(".pj-fila[data-mes]");
      if (fila) {
        estado.mes = Number(fila.dataset.mes);
        sincronizarControles();
        redibujar();
        raiz.querySelector(".vm-centro").scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const pestana = t.closest(".vm-pestana");
      if (pestana) {
        raiz.querySelectorAll(".vm-pestana").forEach(b => b.setAttribute("aria-selected", b === pestana ? "true" : "false"));
        raiz.querySelectorAll(".vm-pagina").forEach(p => { p.hidden = p.dataset.pagina !== pestana.dataset.pestana; });
        return;
      }
      if (!t.closest(".vm-menu")) cerrarMenus();
    });

    document.addEventListener("keydown", e => {
      if (!raiz || raiz.hidden || e.key !== "Escape" || document.fullscreenElement) return;
      e.preventDefault();
      if (raiz.querySelector(".vm-menu.vm-menu-abierto")) cerrarMenus(); else cerrarParejos();
    });
  }

  /* ======================================================================
     ABRIR / CERRAR (lo que usa script.js)
     ====================================================================== */

  function abrirParejos() {
    if (typeof Chart === "undefined") {
      avisar("No se pudo cargar la librería de gráficos (revisa tu internet).", "error");
      return false;
    }
    if (!raiz) {
      raiz = construirVentana();
      conectarEventos();
    }
    // Se abre con lo que se está viendo en el sistema: ingresos o egresos
    estado.tipo = (typeof modoRegistro !== "undefined" && modoRegistro === "egresos") ? "egresos" : estado.tipo === "comparar" ? "comparar" : "ingresos";
    const anios = aniosDisponibles();
    if (!estado.anio || anios.indexOf(estado.anio) === -1) {
      const conTipo = anios.filter(a => tiposActivos().some(t => delPeriodo(t, a, -1).lista.length));
      estado.anio = conTipo.length ? conTipo[conTipo.length - 1] : (anios[anios.length - 1] || new Date().getFullYear());
    }
    // Período: el mes elegido en el sistema si tiene datos; si no, todo el año
    const hayEnMes = tiposActivos().some(t => delPeriodo(t, estado.anio, mesActual).lista.length);
    estado.mes = hayEnMes ? mesActual : -1;
    // La vista simple mira siempre todo el año, mes a mes
    estado.grafico = "mensual";
    estado.mes = -1;
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

  function cerrarParejos() {
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

  window.abrirParejos = abrirParejos;
  window.cerrarParejos = cerrarParejos;
})();
