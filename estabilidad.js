/* ==========================================================================
   estabilidad.js — Ventana "Estabilidad" (desviación estándar)
   --------------------------------------------------------------------------
   ¿Qué tan estables son tus ingresos, tus egresos y el resultado del mes
   (ingresos − egresos)? Usa la desviación estándar MUESTRAL de los totales de
   cada mes (o de cada día, si eliges un mes), como el ejemplo del curso:
       x̄ = Σx ÷ n     s² = Σ(x − x̄)² ÷ (n − 1)     s = √s²
   Da indicadores de mes bueno / malo, la interpretación en palabras (al estilo
   del ejemplo de la gelatina), recomendaciones y el paso a paso con tus datos.
   Todo se calcula solo con el Excel que cargues, de enero a diciembre.

   Se abre desde el círculo "Estabilidad" del panel (script.js llama a
   abrirEstabilidad()). Es de SOLO LECTURA sobre `registros` y `egresos`.
   Tipos de gráfico inspirados en la calculadora de StatsUnlock (barras,
   curva normal, aporte de cada dato y estimaciones por grupo); el diseño es el
   mismo de la ventana "¿Qué tan parejos…?" (clases vm- y pj-).
   ========================================================================== */
(function () {
  "use strict";

  const TITULO = "Cambio de mis meses";

  const TEMAS = {
    rojoAmarillo: { nombre: "Rojo y amarillo (predeterminado)", fuerte: "#E53935", suave: "#FFC107", banda1: "rgba(255,193,7,0.32)", banda2: "rgba(255,193,7,0.13)", linea: "#B71C1C" },
    naranja: { nombre: "Naranja y arena", fuerte: "#E8590C", suave: "#F4B266", banda1: "rgba(244,178,102,0.35)", banda2: "rgba(244,178,102,0.14)", linea: "#8C3A0A" },
    ladrillera: { nombre: "Ladrillera (terracota)", fuerte: "#A9573F", suave: "#C7A982", banda1: "rgba(199,169,130,0.38)", banda2: "rgba(199,169,130,0.15)", linea: "#5A2E22" },
  };

  const COLOR_TIPO = { ingresos: "#2FA84F", egresos: "#F07A1E", resultado: "#8C4633" };

  // Indicador de cada mes (o día) según qué tan lejos está de su promedio.
  // Es el semáforo común de todo el panel (analitica.js): verde = bueno, rojo = malo,
  // igual que en «¿Mis ventas y pagos son parecidos?» y «Mi mes frente a los demás».
  const INDICADORES = window.SEMAFORO || {
    muyBueno: { texto: "Muy bueno", color: "#1B8A3A", icono: "▲▲" },
    bueno: { texto: "Bueno", color: "#43A047", icono: "▲" },
    regular: { texto: "Regular", color: "#E0A100", icono: "●" },
    malo: { texto: "Malo", color: "#E53935", icono: "▼" },
    muyMalo: { texto: "Muy malo", color: "#B71C1C", icono: "▼▼" },
    incompleto: { texto: "Incompleto", color: "#9E9E9E", icono: "…" },
  };

  const GRAFICOS = {
    rango: "1. Mes a mes con su rango normal (promedio ± desviación)",
    campana: "2. Campana de Gauss: ¿dónde cae cada mes?",
    cuadrados: "3. ¿Qué mes mueve más la variación?",
    promedios: "4. Promedio ± desviación de cada mes (montos)",
    comparar: "5. Ingresos y egresos con su rango normal",
  };

  const FUENTES = ["Inter", "Poppins", "Space Grotesk", "Arial", "Georgia"];

  const ESTADO_INICIAL = {
    tipo: "ingresos",          // ingresos | egresos | ambos (resultado = ingresos − egresos)
    anio: null,
    mes: -1,                   // -1 = todo el año (mes a mes); 0..11 = ese mes (día a día)
    grafico: "rango",
    excluirIncompletos: true,
    verBandas: true,
    etiquetas: true,
    leyenda: true,
    animacion: true,
    decimales: 0,
    tema: "rojoAmarillo",
    ancho: 900,
    alto: 440,
    fuente: "Inter",
    fondo: "#FFFFFF",
  };

  const MESES_TITULO = MESES.map(m => m.charAt(0) + m.slice(1).toLowerCase());
  const MESES_CORTOS = MESES.map(m => m.charAt(0) + m.slice(1, 3).toLowerCase());

  let estado = clonar(ESTADO_INICIAL);
  let grafico = null;
  let raiz = null;
  let elementoAnterior = null;
  let verFormulas = true;

  function clonar(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(t) { return String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function avisar(m, t) { if (typeof mostrarToast === "function") mostrarToast(m, t); }

  const PALABRA = {
    ingresos: { uno: "ingreso", varios: "ingresos", Varios: "Ingresos", del: "de tus ingresos" },
    egresos: { uno: "egreso", varios: "egresos", Varios: "Egresos", del: "de tus egresos" },
    resultado: { uno: "resultado", varios: "resultados", Varios: "Resultado (ingresos − egresos)", del: "del resultado de tu negocio" },
  };

  function tipoEfectivo() { return estado.tipo === "ambos" ? "resultado" : estado.tipo; }

  /* ======================================================================
     DATOS (solo lectura)
     ====================================================================== */

  function movimientos(tipo) {
    if (tipo === "ingresos") return registros.map(r => ({ fecha: r.fechaIngreso || "", valor: Number(r.montoTotal) || 0, aviso: "" }));
    const lista = typeof egresos !== "undefined" ? egresos : [];
    return lista.map(e => ({ fecha: e.fechaEgreso || "", valor: Number(e.monto) || 0, aviso: e.aviso || "" }));
  }

  function delAnio(tipo, anio) {
    return movimientos(tipo).filter(m => m.fecha && m.valor > 0 && Number(anioDeFecha(m.fecha)) === Number(anio));
  }

  function aniosDisponibles() {
    const set = new Set();
    ["ingresos", "egresos"].forEach(t => movimientos(t).forEach(m => { if (m.fecha && m.valor > 0) set.add(Number(anioDeFecha(m.fecha))); }));
    return Array.from(set).sort((a, b) => a - b);
  }

  // El último mes con datos está incompleto si su último registro es antes del día 25
  function mesIncompletoDe(tipo, anio) {
    const lista = delAnio(tipo, anio);
    if (!lista.length) return null;
    const ultima = lista.reduce((a, m) => (m.fecha > a ? m.fecha : a), "");
    const dia = Number(ultima.slice(8, 10));
    return dia < 25 ? { mes: mesDeFecha(ultima), fecha: ultima } : null;
  }

  // Unidades a analizar: los 12 meses del año o los días de un mes, con su total
  function unidades(tipo, anio, mes) {
    const porClave = t => {
      const mapa = {};
      delAnio(t, anio).forEach(m => {
        if (mes >= 0 && mesDeFecha(m.fecha) !== mes) return;
        const k = mes < 0 ? mesDeFecha(m.fecha) : Number(m.fecha.slice(8, 10));
        if (!mapa[k]) mapa[k] = { total: 0, n: 0, avisos: 0 };
        mapa[k].total += m.valor;
        mapa[k].n += 1;
        if (m.aviso) mapa[k].avisos += 1;
      });
      return mapa;
    };
    const claves = mes < 0 ? MESES.map((_, i) => i) : Array.from({ length: new Date(anio, mes + 1, 0).getDate() }, (_, i) => i + 1);
    const inc = mes < 0 ? ((tipo === "resultado" ? [mesIncompletoDe("ingresos", anio), mesIncompletoDe("egresos", anio)] : [mesIncompletoDe(tipo, anio)]).filter(Boolean)) : [];

    let fuente;
    if (tipo === "resultado") {
      const a = porClave("ingresos");
      const b = porClave("egresos");
      fuente = {};
      claves.forEach(k => {
        // Por meses: solo los meses que tienen ingresos Y egresos. Por días: cualquier día con movimiento.
        const hay = mes < 0 ? (a[k] && b[k]) : (a[k] || b[k]);
        if (hay) fuente[k] = { total: (a[k] ? a[k].total : 0) - (b[k] ? b[k].total : 0), n: (a[k] ? a[k].n : 0) + (b[k] ? b[k].n : 0), avisos: b[k] ? b[k].avisos : 0, ingresos: a[k] ? a[k].total : 0, egresos: b[k] ? b[k].total : 0 };
      });
    } else {
      fuente = porClave(tipo);
    }

    return claves.map(k => {
      const f = fuente[k];
      const incompleto = mes < 0 && inc.some(x => x.mes === k);
      return {
        clave: k,
        etiqueta: mes < 0 ? MESES_CORTOS[k] : String(k),
        nombre: mes < 0 ? MESES_TITULO[k] : k + " de " + MESES_TITULO[mes].toLowerCase(),
        total: f ? f.total : null,
        n: f ? f.n : 0,
        avisos: f ? f.avisos : 0,
        ingresos: f && f.ingresos !== undefined ? f.ingresos : null,
        egresos: f && f.egresos !== undefined ? f.egresos : null,
        incompleto,
      };
    });
  }

  /* ======================================================================
     ESTADÍSTICA (muestral, como en el ejemplo del curso)
     ====================================================================== */

  function calcular(lista) {
    const usados = lista.filter(u => u.total !== null && !(estado.excluirIncompletos && u.incompleto));
    const n = usados.length;
    if (n === 0) return null;
    const suma = usados.reduce((s, u) => s + u.total, 0);
    const media = suma / n;
    const cuadrados = usados.map(u => (u.total - media) * (u.total - media));
    const sumaCuadrados = cuadrados.reduce((s, v) => s + v, 0);
    const varianza = n > 1 ? sumaCuadrados / (n - 1) : null;
    const s = varianza !== null ? Math.sqrt(varianza) : null;
    const mejor = usados.reduce((a, u) => (u.total > a.total ? u : a));
    const peor = usados.reduce((a, u) => (u.total < a.total ? u : a));
    // Tendencia: pendiente de la recta de mínimos cuadrados (cuánto sube o baja por mes)
    let pendiente = null;
    if (n >= 3) {
      const xs = usados.map(u => u.clave);
      const mx = xs.reduce((a, b) => a + b, 0) / n;
      const num = usados.reduce((acc, u) => acc + (u.clave - mx) * (u.total - media), 0);
      const den = xs.reduce((acc, x) => acc + (x - mx) * (x - mx), 0);
      pendiente = den ? num / den : null;
    }
    return {
      usados, n, suma, media, sumaCuadrados, varianza, s,
      cv: s !== null && media ? (s / Math.abs(media)) * 100 : null,
      mejor, peor, pendiente,
      excluidos: lista.filter(u => u.total !== null && estado.excluirIncompletos && u.incompleto),
    };
  }

  // Mes bueno o malo según a cuántas desviaciones está de su promedio (z)
  function indicador(tipo, u, est) {
    if (u.total === null) return null;
    if (u.incompleto && estado.excluirIncompletos) return INDICADORES.incompleto;
    if (!est || !est.s) return INDICADORES.regular;
    const z = (u.total - est.media) / est.s;
    if (tipo === "ingresos") return z >= 1 ? INDICADORES.muyBueno : z >= 0 ? INDICADORES.bueno : z > -1 ? INDICADORES.regular : INDICADORES.malo;
    if (tipo === "egresos") return z <= -1 ? INDICADORES.muyBueno : z <= 0 ? INDICADORES.bueno : z < 1 ? INDICADORES.regular : INDICADORES.malo;
    // Resultado: ganar es bueno; perder es malo; lejos del promedio, "muy"
    if (u.total < 0) return z <= -1 ? INDICADORES.muyMalo : INDICADORES.malo;
    return z >= 1 ? INDICADORES.muyBueno : INDICADORES.bueno;
  }

  // Nivel de estabilidad según el coeficiente de variación (desviación ÷ promedio)
  function nivel(tipo, est) {
    if (!est || est.s === null) return { texto: "Sin datos suficientes", color: "#9A8A7E", frase: "" };
    const I = INDICADORES;
    if (tipo === "resultado") {
      const perdidas = est.usados.filter(u => u.total < 0).length;
      if (perdidas === 0 && est.cv !== null && est.cv < 25) return { texto: "Estable", color: I.bueno.color, frase: "ganas todos los meses y con poca variación" };
      if (perdidas === 0) return { texto: "Variable", color: I.regular.color, frase: "ganas todos los meses, pero la ganancia sube y baja bastante" };
      if (perdidas / est.n <= 1 / 3 && est.s < Math.abs(est.media) * 2) return { texto: "Variable", color: I.regular.color, frase: "algunos meses hay pérdida" };
      return { texto: "Muy inestable", color: I.malo.color, frase: "hay meses con ganancia y otros con pérdida fuerte; el resultado es difícil de prever" };
    }
    const cv = est.cv;
    if (cv < 10) return { texto: "Muy estable", color: I.muyBueno.color, frase: "los totales casi no cambian; puedes planificar con el promedio" };
    if (cv < 25) return { texto: "Estable", color: I.bueno.color, frase: "variación normal; el promedio es buena referencia para planificar" };
    if (cv <= 50) return { texto: "Variable", color: I.regular.color, frase: "hay meses bastante distintos; planifica con el rango normal, no solo con el promedio" };
    return { texto: "Muy inestable", color: I.malo.color, frase: "los totales cambian mucho de un período a otro; necesitas reserva de caja" };
  }

  function soles(v, compacto) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    if (compacto) return formatearMonedaCompacta(v);
    const d = estado.decimales;
    return (v < 0 ? "−S/ " : "S/ ") + Math.abs(v).toLocaleString("es-PE", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function signo(v) { return v > 0 ? "+" + soles(v) : soles(v); }
  function pct(v) { return v === null || v === undefined || isNaN(v) ? "—" : Number(v).toLocaleString("es-PE", { maximumFractionDigits: 1 }) + "%"; }
  function num(v) { return Number(v).toLocaleString("es-PE", { maximumFractionDigits: 0 }); }
  // "bueno" → "buenos", "regular" → "regulares" (solo la última palabra)
  function plural(t, n) {
    if (n === 1) return t;
    return t.replace(/(\S+)$/, w => /[aeiou]$/.test(w) ? w + "s" : w + "es");
  }

  function nombrePeriodo() {
    return estado.mes < 0 ? "todo " + estado.anio + " (mes a mes)" : MESES_TITULO[estado.mes] + " " + estado.anio + " (día a día)";
  }
  function palabraUnidad(plural) { return estado.mes < 0 ? (plural ? "meses" : "mes") : (plural ? "días" : "día"); }

  /* ======================================================================
     GRÁFICOS
     ====================================================================== */

  function aRgba(hex, a) {
    const n = parseInt(hex.replace("#", ""), 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }
  function normal(x, m, s) { return Math.exp(-0.5 * Math.pow((x - m) / s, 2)) / (s * Math.sqrt(2 * Math.PI)); }

  const pluginFondo = {
    id: "esFondo",
    beforeDraw(chart) {
      const ctx = chart.ctx;
      ctx.save();
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = estado.fondo;
      ctx.fillRect(0, 0, chart.width, chart.height);
      ctx.restore();
    },
  };

  // Franjas del rango normal (± 1 y ± 2 desviaciones), línea del promedio,
  // bigotes de "promedio ± desviación" y etiquetas de los meses en la campana
  const pluginDeco = {
    id: "esDeco",
    beforeDatasetsDraw(chart, args, o) {
      if (!o || !o.tipo) return;
      const ctx = chart.ctx, a = chart.chartArea, y = chart.scales.y;
      ctx.save();
      ctx.beginPath(); ctx.rect(a.left, a.top, a.right - a.left, a.bottom - a.top); ctx.clip();
      if ((o.tipo === "rango" || o.tipo === "comparar") && o.bandas) {
        o.bandas.forEach(b => {
          if (o.verBandas) {
            [[2, b.banda2], [1, b.banda1]].forEach(([k, color]) => {
              const y1 = y.getPixelForValue(b.media + k * b.s);
              const y2 = y.getPixelForValue(b.media - k * b.s);
              ctx.fillStyle = color;
              ctx.fillRect(a.left, y1, a.right - a.left, y2 - y1);
            });
          }
          ctx.strokeStyle = b.linea;
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 5]);
          const ym = y.getPixelForValue(b.media);
          ctx.beginPath(); ctx.moveTo(a.left, ym); ctx.lineTo(a.right, ym); ctx.stroke();
          ctx.setLineDash([]);
        });
        if (o.cero) {
          const y0 = y.getPixelForValue(0);
          ctx.strokeStyle = "#3B2F2A";
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(a.left, y0); ctx.lineTo(a.right, y0); ctx.stroke();
        }
      }
      ctx.restore();
    },
    afterDatasetsDraw(chart, args, o) {
      if (!o || !o.tipo) return;
      const ctx = chart.ctx, a = chart.chartArea, x = chart.scales.x, y = chart.scales.y;
      ctx.save();
      ctx.font = "700 11px " + estado.fuente + ", sans-serif";
      if ((o.tipo === "rango" || o.tipo === "comparar") && o.bandas && o.etiquetas) {
        o.bandas.forEach(b => {
          const marcas = [[b.media, (b.prefijo || "") + "Promedio " + soles(b.media, true)]];
          if (o.verBandas) { marcas.push([b.media + b.s, o.simple ? "Lo normal llega hasta aquí" : "+1 desviación"]); marcas.push([b.media - b.s, o.simple ? "Lo normal empieza aquí" : "−1 desviación"]); }
          marcas.forEach(m => {
            const yy = y.getPixelForValue(m[0]);
            if (yy < a.top + 8 || yy > a.bottom - 2) return;
            ctx.textAlign = "right";
            ctx.textBaseline = "bottom";
            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgba(255,255,255,0.92)";
            ctx.fillStyle = b.linea;
            ctx.strokeText(m[1], a.right - 4, yy - 2);
            ctx.fillText(m[1], a.right - 4, yy - 2);
          });
        });
      }
      if (o.tipo === "bigotes") {
        // Bigotes de promedio ± desviación sobre cada barra
        chart.data.datasets.forEach((ds, i) => {
          if (!chart.isDatasetVisible(i) || !ds.$s) return;
          const meta = chart.getDatasetMeta(i);
          ctx.strokeStyle = "#3B2F2A";
          ctx.lineWidth = 1.8;
          meta.data.forEach((bar, j) => {
            const m = ds.data[j], s = ds.$s[j];
            if (m === null || s === null || s === undefined) return;
            const yTop = y.getPixelForValue(m + s), yBot = y.getPixelForValue(Math.max(0, m - s));
            const w = Math.min(10, bar.width / 3);
            ctx.beginPath();
            ctx.moveTo(bar.x, yTop); ctx.lineTo(bar.x, yBot);
            ctx.moveTo(bar.x - w, yTop); ctx.lineTo(bar.x + w, yTop);
            ctx.moveTo(bar.x - w, yBot); ctx.lineTo(bar.x + w, yBot);
            ctx.stroke();
          });
        });
      }
      if (o.tipo === "campana") {
        // Líneas en ±1 y ±2 desviaciones con su texto, y el nombre de cada mes sobre su punto
        [[-2, "−2 desv."], [-1, "−1 desv."], [0, "Promedio"], [1, "+1 desv."], [2, "+2 desv."]].forEach(([k, t]) => {
          const xx = x.getPixelForValue(o.media + k * o.s);
          if (xx < a.left || xx > a.right) return;
          ctx.strokeStyle = k === 0 ? o.linea : aRgba(o.linea, 0.55);
          ctx.setLineDash(k === 0 ? [] : [5, 4]);
          ctx.lineWidth = k === 0 ? 2 : 1.4;
          ctx.beginPath(); ctx.moveTo(xx, a.bottom); ctx.lineTo(xx, y.getPixelForValue(normal(o.media + k * o.s, o.media, o.s))); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = o.linea;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(t, xx, a.bottom - 16);
        });
        const puntos = chart.getDatasetMeta(o.indicePuntos);
        const datosPuntos = chart.data.datasets[o.indicePuntos].data;
        ctx.textBaseline = "bottom";
        puntos.data.forEach((p, i) => {
          const d = datosPuntos[i];
          ctx.fillStyle = "#2B211C";
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(255,255,255,0.95)";
          const yy = p.y - 9 - (i % 2) * 13;
          ctx.strokeText(d.u.etiqueta, p.x, yy);
          ctx.fillText(d.u.etiqueta, p.x, yy);
        });
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
      layout: { padding: { top: 6, right: 14, left: 4 } },
      plugins: {
        title: { display: true, text: titulo, color: "#B71C1C", font: { family: fuente, size: 17, weight: "600" }, padding: { top: 4, bottom: 2 } },
        subtitle: { display: !!subtitulo, text: subtitulo, color: "#666", font: { family: fuente, size: 12 }, padding: { bottom: 10 } },
        legend: { display: estado.leyenda, position: "bottom", labels: { usePointStyle: true, boxWidth: 8, font: { family: fuente, size: 12 }, color: "#222" } },
        tooltip: { padding: 10, titleFont: { family: fuente, size: 13 }, bodyFont: { family: fuente, size: 12 }, bodySpacing: 3 },
      },
    };
  }

  function ejeSoles(titulo, extra) {
    const fuente = estado.fuente + ", sans-serif";
    return Object.assign({
      grace: "8%",
      grid: { color: "#EFE8E2" },
      title: { display: !!titulo, text: titulo, color: "#333", font: { family: fuente, size: 12, weight: "600" } },
      ticks: { color: "#222", font: { family: fuente, size: 11 }, callback: v => formatearMonedaCompacta(v) },
    }, extra || {});
  }

  // Texto del globo al señalar un mes (o día): todo lo que dice ese punto
  function lineasDeTooltip(tipo, u, est) {
    if (!u || u.total === null) return [" Sin datos"];
    const ind = indicador(tipo, u, est);
    const l = [" Total: " + soles(u.total)];
    if (tipo === "resultado" && u.ingresos !== null) l.push(" Ingresos " + soles(u.ingresos, true) + " − egresos " + soles(u.egresos, true));
    if (est && est.s) {
      const dif = u.total - est.media;
      l.push(" Diferencia con el promedio: " + signo(dif) + (est.media ? " (" + (dif >= 0 ? "+" : "") + pct((dif / Math.abs(est.media)) * 100) + ")" : ""));
      l.push(" Está a " + ((dif) / est.s).toFixed(2) + " desviaciones del promedio");
    }
    if (ind) l.push(" Indicador: " + ind.icono + " " + ind.texto);
    l.push(" Movimientos: " + u.n);
    if (u.avisos) l.push(" ⚠ " + u.avisos + " egreso(s) con posible monto en dólares");
    if (u.incompleto) l.push(" ⚠ Parece incompleto" + (estado.excluirIncompletos ? " (no se cuenta)" : ""));
    return l;
  }

  function construirConfig() {
    const tipo = tipoEfectivo();
    const tema = TEMAS[estado.tema];
    const fuente = estado.fuente + ", sans-serif";
    const lista = unidades(tipo, estado.anio, estado.mes);
    const est = calcular(lista);
    const hayDos = est && est.s !== null;
    const quien = PALABRA[tipo].Varios;

    if (estado.grafico === "promedios" || estado.grafico === "comparar") {
      // Estos dos siempre miran el año entero (mes a mes)
      return estado.grafico === "promedios" ? configPromedios(fuente, tema) : configComparar(fuente, tema);
    }
    if (!est) return null;

    /* ---------- 1. Rango normal ---------- */
    if (estado.grafico === "rango") {
      const colores = lista.map(u => { const ind = indicador(tipo, u, est); return ind ? ind.color : "#ccc"; });
      const simple = window.VistaSimple && VistaSimple.esSimple(raiz);
      const o = simple
        ? opcionesBase("Mes a mes: ¿cómo te fue?", (tipo === "ingresos" ? "Lo que entró" : tipo === "egresos" ? "Lo que salió" : "Lo que te queda") + " · " + estado.anio + " · verde = bueno · rojo = malo · franja = lo normal")
        : opcionesBase(GRAFICOS.rango.slice(3), quien + " · " + nombrePeriodo() + (hayDos ? " · franja fuerte = promedio ± 1 desviación" : ""));
      o.scales = {
        x: { grid: { display: false }, title: { display: true, text: estado.mes < 0 ? "Mes" : "Día", font: { family: fuente, size: 12, weight: "600" } }, ticks: { font: { family: fuente, size: 11 } } },
        y: ejeSoles(tipo === "resultado" ? "Resultado del " + palabraUnidad() : "Total del " + palabraUnidad(), tipo === "resultado" ? {} : { beginAtZero: true }),
      };
      o.plugins.esDeco = hayDos ? { tipo: "rango", simple, verBandas: estado.verBandas, etiquetas: estado.etiquetas, cero: tipo === "resultado", bandas: [{ media: est.media, s: est.s, banda1: tema.banda1, banda2: tema.banda2, linea: tema.linea }] } : {};
      o.plugins.tooltip.callbacks = { title: items => items.length ? lista[items[0].dataIndex].nombre + " " + estado.anio : "", label: c => lineasDeTooltip(tipo, lista[c.dataIndex], est) };
      o.plugins.legend.display = false;
      o.onClick = (ev, el) => {
        if (simple || !el.length || estado.mes >= 0) return;
        const u = lista[el[0].index];
        if (u.total === null) return;
        estado.mes = u.clave; sincronizarControles();
        // Se redibuja un instante después: el gráfico termina de atender el clic antes de ser reemplazado
        setTimeout(redibujar, 0);
      };
      return {
        type: "bar",
        data: { labels: lista.map(u => u.etiqueta), datasets: [{ label: quien, data: lista.map(u => u.total), backgroundColor: colores.map(c => aRgba(c, 0.85)), borderColor: colores, borderWidth: 1.5, borderRadius: 6, maxBarThickness: 56 }] },
        options: o, plugins: [pluginFondo, pluginDeco],
      };
    }

    if (!hayDos) return null;

    /* ---------- 2. Campana de Gauss ---------- */
    if (estado.grafico === "campana") {
      const m = est.media, s = est.s;
      const curva = [], zona1 = [], zona2 = [];
      for (let k = -3.6; k <= 3.601; k += 0.05) {
        const xv = m + k * s, p = { x: xv, y: normal(xv, m, s) };
        curva.push(p);
        if (k >= -2.001 && k <= 2.001) zona2.push(p);
        if (k >= -1.001 && k <= 1.001) zona1.push(p);
      }
      const puntos = est.usados.map(u => ({ x: Math.max(m - 3.5 * s, Math.min(m + 3.5 * s, u.total)), y: normal(Math.max(m - 3.5 * s, Math.min(m + 3.5 * s, u.total)), m, s), u }));
      const o = opcionesBase(GRAFICOS.campana.slice(3), quien + " · " + nombrePeriodo() + " · en una campana, ~68% cae en la zona fuerte y ~95% en la zona clara");
      o.scales = {
        x: ejeSoles(tipo === "resultado" ? "Resultado del " + palabraUnidad() : "Total del " + palabraUnidad(), { type: "linear", grace: 0, min: m - 3.6 * s, max: m + 3.6 * s }),
        y: { display: false, beginAtZero: true, grace: "18%" },
      };
      o.plugins.esDeco = { tipo: "campana", media: m, s, linea: tema.linea, indicePuntos: 3 };
      o.plugins.tooltip.filter = item => item.datasetIndex === 3;
      o.plugins.tooltip.callbacks = { title: items => items.length ? items[0].raw.u.nombre + " " + estado.anio : "", label: c => lineasDeTooltip(tipo, c.raw.u, est) };
      o.plugins.legend.labels.filter = item => item.datasetIndex !== 1 && item.datasetIndex !== 2;
      return {
        type: "scatter",
        data: {
          datasets: [
            { label: "Curva normal (lo esperado)", data: curva, showLine: true, pointRadius: 0, borderColor: tema.fuerte, borderWidth: 2.5, fill: "origin", backgroundColor: aRgba(tema.suave, 0.08), tension: 0.3 },
            { label: "±2", data: zona2, showLine: true, pointRadius: 0, borderWidth: 0, fill: "origin", backgroundColor: tema.banda2, tension: 0.3 },
            { label: "±1", data: zona1, showLine: true, pointRadius: 0, borderWidth: 0, fill: "origin", backgroundColor: tema.banda1, tension: 0.3 },
            { label: "Cada " + palabraUnidad() + " (color = indicador)", data: puntos, showLine: false, pointRadius: 7, pointHoverRadius: 9, pointBorderColor: "#fff", pointBorderWidth: 2, pointBackgroundColor: puntos.map(p => indicador(tipo, p.u, est).color) },
          ],
        },
        options: o, plugins: [pluginFondo, pluginDeco],
      };
    }

    /* ---------- 3. Aporte a la variación ---------- */
    if (estado.grafico === "cuadrados") {
      const usados = est.usados;
      const aportes = usados.map(u => est.sumaCuadrados ? ((u.total - est.media) ** 2 / est.sumaCuadrados) * 100 : 0);
      const o = opcionesBase(GRAFICOS.cuadrados.slice(3), quien + " · " + nombrePeriodo() + " · parte de la suma Σ(x − x̄)² que aporta cada " + palabraUnidad());
      o.scales = {
        x: { grid: { display: false }, ticks: { font: { family: fuente, size: 11 } } },
        y: { beginAtZero: true, grace: "8%", grid: { color: "#EFE8E2" }, title: { display: true, text: "Aporte a la variación (%)", font: { family: fuente, size: 12, weight: "600" } }, ticks: { callback: v => v + "%", font: { family: fuente, size: 11 } } },
      };
      o.plugins.legend.display = false;
      o.plugins.tooltip.callbacks = {
        title: items => items.length ? usados[items[0].dataIndex].nombre + " " + estado.anio : "",
        label: c => {
          const u = usados[c.dataIndex];
          const d = u.total - est.media;
          return [" Aporta el " + pct(c.parsed.y) + " de la variación", " x − x̄ = " + signo(d), " (x − x̄)² = " + num(d * d), " Total: " + soles(u.total)];
        },
      };
      const maxA = Math.max.apply(null, aportes);
      return {
        type: "bar",
        data: { labels: usados.map(u => u.etiqueta), datasets: [{ label: "Aporte", data: aportes.map(v => +v.toFixed(1)), backgroundColor: aportes.map(v => aRgba(tema.fuerte, 0.3 + 0.65 * (maxA ? v / maxA : 0))), borderColor: tema.fuerte, borderWidth: 1, borderRadius: 6, maxBarThickness: 60 }] },
        options: o, plugins: [pluginFondo],
      };
    }
    return null;
  }

  // Promedio de los montos de cada mes ± su desviación (ingresos, egresos o ambos)
  function configPromedios(fuente) {
    const tipos = estado.tipo === "ambos" ? ["ingresos", "egresos"] : [estado.tipo];
    const datasets = tipos.map(t => {
      const medias = [], sds = [], ns = [];
      MESES.forEach((_, m) => {
        const vals = delAnio(t, estado.anio).filter(x => mesDeFecha(x.fecha) === m).map(x => x.valor);
        if (!vals.length) { medias.push(null); sds.push(null); ns.push(0); return; }
        const media = vals.reduce((a, b) => a + b, 0) / vals.length;
        const sd = vals.length > 1 ? Math.sqrt(vals.reduce((a, v) => a + (v - media) ** 2, 0) / (vals.length - 1)) : 0;
        medias.push(media); sds.push(sd); ns.push(vals.length);
      });
      return {
        label: PALABRA[t].Varios + ": promedio de cada monto",
        data: medias, $s: sds, $n: ns,
        backgroundColor: MESES.map((_, m) => aRgba(COLOR_TIPO[t], estado.mes === m ? 0.95 : 0.6)),
        borderColor: COLOR_TIPO[t], borderWidth: 1, borderRadius: 5, maxBarThickness: 44,
      };
    });
    if (!datasets.some(d => d.data.some(v => v !== null))) return null;
    const o = opcionesBase(GRAFICOS.promedios.slice(3), (estado.tipo === "ambos" ? "Ingresos y egresos" : PALABRA[estado.tipo].Varios) + " · " + estado.anio + " · la raya negra va de (promedio − desviación) a (promedio + desviación)");
    o.scales = { x: { grid: { display: false }, ticks: { font: { family: fuente, size: 11 } } }, y: ejeSoles("Monto de cada movimiento", { beginAtZero: true }) };
    o.plugins.esDeco = { tipo: "bigotes" };
    o.plugins.tooltip.callbacks = {
      title: items => items.length ? MESES_TITULO[items[0].dataIndex] + " " + estado.anio : "",
      label: c => {
        const ds = c.dataset, i = c.dataIndex;
        if (ds.data[i] === null) return " sin datos";
        return [" " + ds.label.split(":")[0], " Promedio de cada monto: " + soles(ds.data[i]), " Desviación estándar: " + soles(ds.$s[i]), " Rango típico: " + soles(Math.max(0, ds.data[i] - ds.$s[i]), true) + " a " + soles(ds.data[i] + ds.$s[i], true), " Movimientos: " + ds.$n[i]];
      },
    };
    o.onClick = (ev, el) => { if (!el.length) return; estado.mes = el[0].index; sincronizarControles(); setTimeout(redibujar, 0); };
    return { type: "bar", data: { labels: MESES_CORTOS, datasets }, options: o, plugins: [pluginFondo, pluginDeco] };
  }

  // Ingresos y egresos por mes, cada uno con su rango normal
  function configComparar(fuente, tema) {
    const series = ["ingresos", "egresos"].map(t => {
      const lista = unidades(t, estado.anio, -1);
      return { t, lista, est: calcular(lista) };
    });
    if (!series.some(s => s.est)) return null;
    const datasets = series.map(s => ({
      label: PALABRA[s.t].Varios,
      data: s.lista.map(u => u.total),
      borderColor: COLOR_TIPO[s.t], backgroundColor: aRgba(COLOR_TIPO[s.t], 0.15),
      pointBackgroundColor: s.lista.map(u => { const ind = indicador(s.t, u, s.est); return ind ? ind.color : "#fff"; }),
      pointBorderColor: "#fff", pointBorderWidth: 2, pointRadius: 6, pointHoverRadius: 8, borderWidth: 3, tension: 0, spanGaps: false,
    }));
    const o = opcionesBase(GRAFICOS.comparar.slice(3), estado.anio + " · cada franja = promedio ± 1 desviación de su serie · el color del punto es su indicador");
    o.interaction = { mode: "index", intersect: false };
    o.scales = { x: { grid: { color: "#F3EDE7" }, ticks: { font: { family: fuente, size: 11 } } }, y: ejeSoles("Total del mes", { beginAtZero: true }) };
    o.plugins.esDeco = {
      tipo: "comparar", verBandas: estado.verBandas, etiquetas: false,
      bandas: series.filter(s => s.est && s.est.s).map(s => ({ media: s.est.media, s: s.est.s, banda1: aRgba(COLOR_TIPO[s.t], 0.14), banda2: "rgba(0,0,0,0)", linea: COLOR_TIPO[s.t] })),
    };
    o.plugins.tooltip.callbacks = {
      title: items => items.length ? MESES_TITULO[items[0].dataIndex] + " " + estado.anio : "",
      label: c => { const s = series[c.datasetIndex]; return [" " + PALABRA[s.t].Varios + ":"].concat(lineasDeTooltip(s.t, s.lista[c.dataIndex], s.est).map(x => "  " + x)); },
    };
    return { type: "line", data: { labels: MESES_CORTOS, datasets }, options: o, plugins: [pluginFondo, pluginDeco] };
  }

  function redibujar() {
    if (!raiz) return;
    const marco = raiz.querySelector(".vm-lienzo");
    const disponible = raiz.querySelector(".vm-marco").clientWidth - 32;
    const ancho = disponible > 280 ? Math.min(estado.ancho, disponible) : estado.ancho;
    marco.style.width = ancho + "px";
    marco.style.height = (ancho < estado.ancho ? Math.max(300, Math.round(estado.alto * 0.85)) : estado.alto) + "px";
    if (grafico) { grafico.destroy(); grafico = null; }
    const cfg = construirConfig();
    const vacio = raiz.querySelector(".vm-vacio");
    vacio.hidden = !!cfg;
    if (cfg) grafico = new Chart(raiz.querySelector("#esCanvas"), (window.VistaSimple ? VistaSimple.embellecer(cfg) : cfg));
    else vacio.innerHTML = "No hay datos suficientes de " + PALABRA[tipoEfectivo()].varios + " en " + nombrePeriodo() + ".<br>Se necesitan al menos 2 " + palabraUnidad(true) + " con datos. Elige otro período o importa tu Excel.";
    pintarEsencial();
    pintarAnalisis();
    pintarFormulas();
    pintarTabla();
  }

  /* ======================================================================
     LO ESENCIAL (vista simple): ¿tu negocio es estable de un mes a otro?
     ====================================================================== */

  function pintarEsencial() {
    if (!window.VistaSimple) return;
    const tipo = tipoEfectivo();
    const lista = unidades(tipo, estado.anio, -1);
    const est = calcular(lista);
    const titulo = tipo === "ingresos" ? "¿Tus ventas son estables de un mes a otro?" : tipo === "egresos" ? "¿Tus gastos son estables de un mes a otro?" : "¿Lo que te queda cada mes es estable?";
    if (!est || est.s === null) {
      VistaSimple.pintar(raiz, [{ titulo, nota: "Se necesitan al menos 2 meses con datos para saber qué tan estable es tu negocio. Importa tu Excel o sigue registrando." }]);
      return;
    }
    const nv = nivel(tipo, est);
    const bajo = tipo === "resultado" ? est.media - est.s : Math.max(0, est.media - est.s);
    const alto = est.media + est.s;
    const verbo = tipo === "ingresos" ? "vende" : tipo === "egresos" ? "gasta" : "te deja";
    const lineas = [];
    if (nv.frase) lineas.push(nv.frase.charAt(0).toUpperCase() + nv.frase.slice(1) + ".");
    lineas.push("Un mes normal " + verbo + " entre <b>" + soles(bajo) + "</b> y <b>" + soles(alto) + "</b>. Tu promedio es <b>" + soles(est.media) + "</b>.");
    const mejor = tipo === "egresos" ? est.peor : est.mejor, peor = tipo === "egresos" ? est.mejor : est.peor;
    lineas.push("Mejor mes: <b>" + esc(mejor.nombre) + "</b> (" + soles(mejor.total) + "). Peor mes: <b>" + esc(peor.nombre) + "</b> (" + soles(peor.total) + ").");

    const consejo = tipo === "ingresos"
      ? "pon como meta mínima <b>" + soles(bajo) + "</b> al mes. Si un mes va por debajo, llama a tus clientes y cobra lo pendiente."
      : tipo === "egresos"
        ? "pon como tope de gasto <b>" + soles(alto) + "</b> al mes. Pasarlo es una alerta: revisa qué pagos se salieron de lo habitual."
        : "guarda una reserva de al menos <b>" + soles(Math.max(est.s, est.s - est.media)) + "</b> para pagar planilla y proveedores en un mes malo.";
    const notas = [];
    if (est.n < 6) notas.push("Solo hay " + est.n + " meses con datos: es una referencia provisional. Con 6 o más ya es confiable.");
    if (est.excluidos.length) notas.push(est.excluidos.map(u => u.nombre).join(", ") + " no se cuenta porque todavía está incompleto.");
    VistaSimple.pintar(raiz, [{
      titulo, mide: "el total de cada mes frente a tu promedio mensual, para ver cuánto cambia de un mes a otro.", nivel: { texto: nv.texto, color: nv.color }, lineas,
      chipsTitulo: "¿Cómo le fue a cada mes?",
      chips: lista.filter(u => u.total !== null).map(u => { const k = indicador(tipo, u, est); return { mes: u.etiqueta, texto: k.texto, color: k.color, titulo: u.nombre + ": " + soles(u.total) }; }),
      consejo, nota: notas.join(" "),
    }]);
  }

  /* ======================================================================
     ANÁLISIS: indicadores, interpretación y recomendaciones
     ====================================================================== */

  function tarjeta(t, v, nota, color) {
    return '<div class="vm-dato"><small>' + t + "</small><strong" + (color ? ' style="color:' + color + '"' : "") + ">" + v + "</strong><em>" + (nota || "") + "</em></div>";
  }
  function insignia(nv) { return '<span class="pj-nivel" style="--c:' + nv.color + '">' + nv.texto + "</span>"; }

  function pintarAnalisis() {
    const cont = raiz.querySelector("#esAnalisis");
    const tipo = tipoEfectivo();
    const w = PALABRA[tipo];
    const lista = unidades(tipo, estado.anio, estado.mes);
    const est = calcular(lista);
    const uni = palabraUnidad(), unis = palabraUnidad(true);

    if (!est || est.s === null) {
      cont.innerHTML = '<p class="pj-parrafo">Para calcular la desviación estándar se necesitan al menos <b>2 ' + unis + "</b> con datos de " + w.varios + " en " + nombrePeriodo() + ". " +
        (est ? "Por ahora hay " + est.n + "." : "Todavía no hay datos.") + " Importa tu Excel (Más acciones → Importar Excel) o elige otro período.</p>";
      return;
    }
    const nv = nivel(tipo, est);
    const bajo = est.media - est.s, alto = est.media + est.s;
    let html = '<div class="pj-bloque es-bloque-' + tipo + '"><h4 class="pj-bloque-titulo"><i style="background:' + COLOR_TIPO[tipo] + '"></i>' + w.Varios + " · " + nombrePeriodo() + " " + insignia(nv) + "</h4>";

    // Tarjetas
    html += '<div class="vm-analisis-grid">' +
      tarjeta("Promedio del " + uni + " (x̄)", soles(est.media), "suma " + soles(est.suma, true) + " ÷ " + est.n) +
      tarjeta("Desviación estándar (s)", "± " + soles(est.s), "cuánto varía un " + uni + " típico") +
      tarjeta("Varianza (s²)", num(est.varianza), "s² = Σ(x − x̄)² ÷ (n − 1)") +
      tarjeta("Coeficiente de variación", tipo === "resultado" ? "—" : pct(est.cv), tipo === "resultado" ? "no aplica al resultado: puede ser negativo" : nv.texto, tipo === "resultado" ? null : nv.color) +
      tarjeta("Rango normal (x̄ ± s)", soles(bajo, true) + " a " + soles(alto, true), "aquí cae un " + uni + " normal") +
      tarjeta("Rango amplio (x̄ ± 2s)", soles(est.media - 2 * est.s, true) + " a " + soles(est.media + 2 * est.s, true), "fuera de aquí: muy raro") +
      // En egresos, el mejor es el que menos gastó
      (tipo === "egresos"
        ? tarjeta("Mejor " + uni + " (menos gasto)", est.peor.nombre, soles(est.peor.total)) + tarjeta("Peor " + uni + " (más gasto)", est.mejor.nombre, soles(est.mejor.total))
        : tarjeta("Mejor " + uni, est.mejor.nombre, soles(est.mejor.total)) + tarjeta("Peor " + uni, est.peor.nombre, soles(est.peor.total))) +
      "</div>";

    // Indicadores de cada mes (o día)
    const conDato = lista.filter(u => u.total !== null);
    const conteo = {};
    const chips = conDato.map(u => {
      const ind = indicador(tipo, u, est);
      conteo[ind.texto] = (conteo[ind.texto] || 0) + 1;
      return '<span class="es-chip" style="--c:' + ind.color + '" title="' + esc(u.nombre + ": " + soles(u.total)) + '"><b>' + esc(u.etiqueta) + "</b> " + ind.icono + " " + ind.texto + "</span>";
    }).join("");
    html += '<h5 class="es-sub">Indicadores: ¿' + (estado.mes < 0 ? "cada mes fue bueno o malo" : "cada día fue bueno o malo") + "?</h5>" +
      '<div class="es-chips">' + chips + "</div>" +
      '<p class="es-leyenda">Verde = bueno, rojo = malo (los mismos colores de «¿Mis ventas y pagos son parecidos?» y «Mi mes frente a los demás»). ' + (tipo === "egresos"
        ? "En egresos, <b>bueno</b> = gastaste menos que tu promedio; <b>malo</b> = gastaste más de una desviación por encima."
        : tipo === "resultado"
          ? "<b>Bueno</b> = ganaste (ingresos mayores que egresos); <b>malo</b> = perdiste; «muy» = a más de una desviación del promedio."
          : "<b>Bueno</b> = por encima de tu promedio; <b>regular</b> = por debajo pero dentro de lo normal; <b>malo</b> = más de una desviación por debajo.") +
      " Resumen: " + Object.keys(conteo).map(k => conteo[k] + " " + plural(k.toLowerCase(), conteo[k])).join(", ") + ".</p>";

    // Interpretación, al estilo del ejemplo del curso
    let interp;
    if (tipo === "resultado") {
      interp = "Con lo que concluiríamos que el resultado de tu negocio (ingresos − egresos) es en promedio <b>" + soles(est.media) + "</b> por " + uni +
        ", con una tendencia a variar por debajo o por encima de ese monto en <b>" + soles(est.s) + "</b> en promedio. " +
        (est.s > Math.abs(est.media) ? "Como la variación es mayor que el promedio, <b>algunos " + unis + " ganas y otros pierdes</b>. " : "") +
        "Esta información te permite saber cuánta <b>reserva de caja</b> necesitas para cubrir un " + uni + " malo sin quedarte sin dinero.";
    } else {
      interp = "Con lo que concluiríamos que tus " + w.varios + " son en promedio <b>" + soles(est.media) + "</b> por " + uni +
        ", con una tendencia a variar por debajo o por encima de dicho monto en <b>" + soles(est.s) + "</b> en promedio (el " + pct(est.cv) + " del promedio: " + nv.texto.toLowerCase() + "). " +
        "Esta información te permite saber que un " + uni + " normal está entre <b>" + soles(bajo) + "</b> y <b>" + soles(alto) + "</b>, " +
        (tipo === "egresos" ? "fijar un tope de gasto y detectar a tiempo cuando un " + uni + " gasta de más." : "fijar metas realistas y detectar a tiempo cuando un " + uni + " vende de menos.");
    }
    html += '<h5 class="es-sub">Interpretación</h5><p class="pj-parrafo es-interpretacion">' + interp + "</p>";

    // Recomendaciones (reglas generales que se aplican a cualquier Excel)
    const rec = [];
    const malos = conDato.filter(u => { const i = indicador(tipo, u, est); return i === INDICADORES.malo || i === INDICADORES.muyMalo; });
    if (tipo === "ingresos") {
      rec.push("<b>Meta mínima:</b> " + soles(Math.max(0, bajo)) + " por " + uni + ". Si un " + uni + " va por debajo, actúa: llama a tus clientes frecuentes, cobra deudas pendientes y ofrece despachos.");
      rec.push("<b>Meta realista:</b> " + soles(est.media) + " (tu promedio). <b>Meta alta:</b> " + soles(alto) + " (un " + uni + " muy bueno).");
    } else if (tipo === "egresos") {
      rec.push("<b>Tope de gasto:</b> " + soles(alto) + " por " + uni + ". Pasarlo es una alerta: revisa qué pagos se salieron de lo habitual.");
      rec.push("<b>Presupuesto base:</b> " + soles(est.media) + " por " + uni + ". Programa con anticipación los pagos grandes (planilla, materia prima) para que no coincidan en el mismo " + uni + ".");
    } else {
      const reserva = Math.max(0, est.s - est.media);
      rec.push("<b>Reserva de caja recomendada:</b> al menos " + soles(Math.max(est.s, reserva)) + " (una desviación estándar del resultado), para pagar planilla y proveedores en un " + uni + " malo.");
      rec.push("En un " + uni + " muy malo (2 desviaciones por debajo), el resultado podría llegar a <b>" + soles(est.media - 2 * est.s) + "</b>. Tenlo en cuenta antes de comprometer gastos grandes.");
    }
    if (malos.length) rec.push("Revisa " + (malos.length === 1 ? "el " + uni + " marcado como malo" : "los " + unis + " marcados como malos") + " (" + malos.map(u => u.nombre).join(", ") + "): ¿fue un pedido que no llegó, un gasto extraordinario o datos incompletos?");
    if (est.pendiente !== null && estado.mes < 0 && est.media) {
      const p = (est.pendiente / Math.abs(est.media)) * 100;
      if (tipo === "egresos" && p > 5) rec.push("Tus egresos <b>suben en promedio " + pct(p) + " por mes</b>. Revisa qué gastos crecen (planilla, materia prima, combustible) antes de que superen a los ingresos.");
      if (tipo === "ingresos" && p < -5) rec.push("Tus ingresos <b>bajan en promedio " + pct(Math.abs(p)) + " por mes</b>. Conviene reforzar ventas y cobranza.");
      if (tipo === "ingresos" && p > 5) rec.push("Tus ingresos <b>crecen en promedio " + pct(p) + " por mes</b>: buena señal; asegúrate de que la producción acompañe.");
      if (tipo === "resultado" && est.pendiente < 0) rec.push("El resultado <b>viene bajando</b> mes a mes: compara el ritmo de ingresos y egresos para ver cuál lo está causando.");
    }
    if (tipo !== "resultado" && est.cv > 50) rec.push("Tu variación es muy alta: separa los montos grandes y analízalos aparte (ventana «¿Mis ventas y pagos son parecidos?»).");
    html += '<h5 class="es-sub">Recomendaciones</h5><ul class="es-rec">' + rec.map(r => "<li>" + r + "</li>").join("") + "</ul>";

    // Calidad del dato
    const notas = [];
    if (est.n < 3) notas.push("Muy pocos datos (" + est.n + " " + unis + "): el resultado cambia mucho con cada dato nuevo.");
    else if (est.n < 6) notas.push("Resultado provisional: solo " + est.n + " " + unis + " con datos (con 6 o más ya es buena referencia; con 12, sólido).");
    if (est.excluidos.length) notas.push(est.excluidos.map(u => u.nombre).join(", ") + " no se cuenta porque parece incompleto (puedes incluirlo en la pestaña Formato).");
    const avisos = lista.reduce((s, u) => s + (u.avisos || 0), 0);
    if (avisos) notas.push("Incluye " + avisos + " egreso(s) marcados «⚠ Revisar moneda» (posible monto en dólares).");
    if (tipo === "resultado") notas.push("Los ingresos son lo registrado (no necesariamente lo cobrado); por mes solo se cuentan los meses que tienen ingresos y egresos.");
    notas.push("Se usa la desviación estándar muestral (÷ n − 1), como en el ejemplo del curso.");
    html += '<p class="pj-notas">' + notas.join(" ") + "</p></div>";

    cont.innerHTML = html;
  }

  /* ======================================================================
     FÓRMULAS: resolución paso a paso con tus datos (como el ejemplo del curso)
     ====================================================================== */

  function pintarFormulas() {
    const tarjetaF = raiz.querySelector("#esTarjetaFormulas");
    tarjetaF.hidden = !verFormulas;
    if (!verFormulas) return;
    const cont = raiz.querySelector("#esFormulas");
    const tipo = tipoEfectivo();
    const est = calcular(unidades(tipo, estado.anio, estado.mes));
    const uni = palabraUnidad(), unis = palabraUnidad(true);

    let res = "";
    if (est && est.s !== null) {
      const us = est.usados;
      const corto = us.length > 6;
      const suma = (corto ? us.slice(0, 3) : us).map(u => num(u.total)).join(" + ") + (corto ? " + … + " + num(us[us.length - 1].total) : "");
      res =
        '<h4 class="pj-sub">Resolución con tus ' + (tipo === "resultado" ? "resultados" : PALABRA[tipo].varios) + " de " + nombrePeriodo() + "</h4>" +
        '<p class="pj-parrafo">Para saber qué tanto varían los totales de cada ' + uni + " se usa la <b>desviación estándar</b>, que es igual a la raíz cuadrada de la varianza.</p>" +
        '<div class="es-paso"><span>Por lo que su media es:</span><code>x̄ = (' + suma + ") ÷ " + est.n + " = " + num(est.suma) + " ÷ " + est.n + " = <b>" + soles(est.media) + "</b></code></div>" +
        '<div class="es-paso"><span>Luego, la varianza de la muestra es:</span><code>s² = Σ(xᵢ − x̄)² ÷ (n − 1) = ' + num(est.sumaCuadrados) + " ÷ " + (est.n - 1) + " = <b>" + num(est.varianza) + "</b></code></div>" +
        '<div class="vm-tabla-envoltura"><table class="vm-tabla pj-tabla-ejemplo"><thead><tr><th>' + (estado.mes < 0 ? "Mes" : "Día") + "</th><th>xᵢ</th><th>xᵢ − x̄</th><th>(xᵢ − x̄)²</th></tr></thead><tbody>" +
        us.map(u => "<tr><td>" + esc(u.nombre) + "</td><td>" + soles(u.total) + "</td><td>" + signo(u.total - est.media) + "</td><td>" + num((u.total - est.media) ** 2) + "</td></tr>").join("") +
        '<tr><td colspan="3"><b>Suma Σ(xᵢ − x̄)²</b></td><td><b>' + num(est.sumaCuadrados) + "</b></td></tr></tbody></table></div>" +
        '<div class="es-paso"><span>Por lo tanto la desviación estándar sería:</span><code>s = √s² = √' + num(est.varianza) + " = <b>" + soles(est.s) + "</b></code></div>" +
        (tipo !== "resultado" ? '<div class="es-paso"><span>Y en porcentaje del promedio:</span><code>CV = s ÷ x̄ × 100 = ' + soles(est.s) + " ÷ " + soles(est.media) + " × 100 = <b>" + pct(est.cv) + "</b></code></div>" : "");
    }

    cont.innerHTML =
      '<p class="pj-parrafo"><b>¿Qué es?</b> La <b>desviación estándar</b> dice cuánto se alejan, típicamente, los totales de cada ' + uni + " de su promedio. " +
      "Si es pequeña, tu negocio es <b>estable</b> (los " + unis + " se parecen). Si es grande, es <b>inestable</b> (hay " + unis + " muy buenos y otros muy malos). " +
      "A diferencia de la desviación media absoluta, eleva las diferencias al cuadrado, así que <b>los " + unis + " extremos pesan más</b>.</p>" +
      '<div class="pj-formulas">' +
      '<div class="pj-formula"><span>Media (promedio)</span><code>x̄ = Σ xᵢ ÷ n</code><em>xᵢ = total de cada ' + uni + " · n = cantidad de " + unis + "</em></div>" +
      '<div class="pj-formula"><span>Varianza muestral</span><code>s² = Σ (xᵢ − x̄)² ÷ (n − 1)</code><em>se divide entre n − 1 porque tus ' + unis + " son una muestra de cómo se comporta tu negocio</em></div>" +
      '<div class="pj-formula"><span>Desviación estándar muestral</span><code>s = √s²</code><em>vuelve a quedar en soles, como tus datos</em></div>' +
      '<div class="pj-formula"><span>Poblacional (si fuera toda la población)</span><code>σ² = Σ (xᵢ − μ)² ÷ N   ·   σ = √σ²</code><em>μ = media poblacional · N = total de datos</em></div>' +
      '<div class="pj-formula"><span>Coeficiente de variación</span><code>CV = s ÷ x̄ × 100</code><em>para comparar la estabilidad de ingresos y egresos de distinto tamaño</em></div>' +
      '<div class="pj-formula"><span>En Excel</span><code>=DESVEST.M(rango)</code><em>poblacional: =DESVEST.P(rango) · varianza: =VAR.S(rango)</em></div>' +
      "</div>" + res +
      '<h4 class="pj-sub">Cómo leer el resultado</h4>' +
      '<div class="pj-guia">' +
      [["#1B8A3A", "Muy estable", "CV menor a 10%", "los totales casi no cambian"], ["#43A047", "Estable", "10% a 25%", "variación normal; se puede planificar con el promedio"], ["#E0A100", "Variable", "25% a 50%", "planifica con el rango normal (x̄ ± s)"], ["#E53935", "Muy inestable", "más de 50%", "necesitas reserva de caja y seguimiento mensual"]]
        .map(g => '<div class="pj-guia-fila"><span class="pj-nivel" style="--c:' + g[0] + '">' + g[1] + "</span><b>" + g[2] + "</b><em>" + g[3] + "</em></div>").join("") +
      "</div>" +
      '<p class="pj-notas">Regla práctica: si los totales se reparten en forma de campana, cerca del <b>68%</b> de los ' + unis + " cae entre x̄ − s y x̄ + s, y cerca del <b>95%</b> entre x̄ − 2s y x̄ + 2s. " +
      "Un " + uni + " fuera de x̄ ± 2s es muy raro y merece revisión.</p>";
  }

  /* ======================================================================
     TABLA MES A MES
     ====================================================================== */

  function pintarTabla() {
    const cont = raiz.querySelector("#esTabla");
    const tipo = tipoEfectivo();
    const lista = unidades(tipo, estado.anio, estado.mes);
    const est = calcular(lista);
    const filas = (estado.mes < 0 ? lista : lista.filter(u => u.total !== null)).map(u => {
      if (u.total === null) return '<tr class="es-fila" data-mes="' + u.clave + '"><td>' + esc(u.nombre) + '</td><td class="vm-sin-dato" colspan="4">—</td></tr>';
      const ind = indicador(tipo, u, est);
      const dif = est ? u.total - est.media : null;
      const z = est && est.s ? dif / est.s : null;
      return '<tr class="es-fila' + (estado.mes < 0 ? "" : " es-fila-dia") + '" data-mes="' + u.clave + '"><td>' + esc(u.nombre) + (u.incompleto ? " <small>(incompleto)</small>" : "") + "</td><td>" + soles(u.total) + "</td><td>" + (dif !== null ? signo(dif) : "—") + "</td><td>" + (z !== null ? z.toFixed(2) : "—") + '</td><td><span class="es-chip" style="--c:' + ind.color + '">' + ind.icono + " " + ind.texto + "</span></td></tr>";
    }).join("");
    const pie = est && est.s !== null
      ? '<tr class="es-fila-resumen"><td>Promedio (x̄)</td><td colspan="4">' + soles(est.media) + "</td></tr>" +
        '<tr class="es-fila-resumen"><td>Desviación estándar (s)</td><td colspan="4">± ' + soles(est.s) + (tipo !== "resultado" ? " · CV " + pct(est.cv) : "") + "</td></tr>" +
        '<tr class="es-fila-resumen"><td>Rango normal (x̄ ± s)</td><td colspan="4">' + soles(est.media - est.s) + " a " + soles(est.media + est.s) + "</td></tr>"
      : "";
    cont.innerHTML = '<div class="vm-tabla-envoltura"><table class="vm-tabla pj-tabla es-tabla"><thead><tr><th>' + (estado.mes < 0 ? "Mes" : "Día") + "</th><th>Total</th><th>Diferencia con el promedio</th><th>Desviaciones (z)</th><th>Indicador</th></tr></thead><tbody>" +
      (filas || '<tr><td colspan="5" class="vm-sin-dato">Sin datos</td></tr>') + pie + "</tbody></table></div>";
  }

  /* ======================================================================
     ARCHIVOS
     ====================================================================== */

  function nombreArchivo(ext) {
    return "estabilidad-" + estado.tipo + "-" + (estado.mes < 0 ? "anio" : MESES[estado.mes].toLowerCase()) + "-" + estado.anio + "." + ext;
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
    ["ingresos", "egresos", "resultado"].forEach(t => {
      const lista = unidades(t, estado.anio, estado.mes);
      const est = calcular(lista);
      const filas = [[estado.mes < 0 ? "Mes" : "Día", "Total (S/)", "Diferencia con el promedio (S/)", "Desviaciones (z)", "Indicador"]];
      lista.filter(u => u.total !== null).forEach(u => {
        const ind = indicador(t, u, est);
        filas.push([u.nombre, u.total, est ? u.total - est.media : "", est && est.s ? Number(((u.total - est.media) / est.s).toFixed(3)) : "", ind ? ind.texto : ""]);
      });
      if (est) filas.push([], ["Promedio", est.media], ["Desviación estándar (muestral)", est.s], ["Varianza", est.varianza], ["Coef. de variación %", est.cv !== null ? Number(est.cv.toFixed(2)) : ""]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), (t === "resultado" ? "Resultado" : PALABRA[t].Varios).slice(0, 31));
    });
    if (await descargarLibro(wb, nombreArchivo("xlsx"))) avisar("✅ Resultados guardados en Excel.", "success");
  }

  function copiarResumen() {
    const texto = raiz.querySelector("#esAnalisis").innerText.trim();
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
    div.className = "vm-overlay pj-overlay es-overlay";
    div.hidden = true;
    div.setAttribute("role", "dialog");
    div.setAttribute("aria-modal", "true");
    div.setAttribute("aria-label", TITULO);
    div.innerHTML =
      '<div class="vm-ventana">' +
      '<header class="vm-barra"><div class="vm-marca pj-marca es-marca"><i></i><span>' + TITULO + "</span></div>" +
      '<nav class="vm-menus" aria-label="Menús">' +
      menu("archivo", "Archivo", item("png", "Descargar imagen (PNG)") + item("excel", "Descargar resultados (Excel)") + item("imprimir", "Imprimir") + '<div class="vm-menu-sep"></div>' + item("cerrar", "Cerrar ventana <small>Esc</small>")) +
      menu("editar", "Editar", item("copiar", "Copiar resumen del análisis") + item("restablecer", "Restablecer ajustes")) +
      menu("datos", "Datos", item("ver-ingresos", "Ver ingresos") + item("ver-egresos", "Ver egresos") + item("ver-ambos", "Ver resultado (ingresos − egresos)") + '<div class="vm-menu-sep"></div>' + item("todo-anio", "Todo el año (mes a mes)") + item("mes-sistema", "Mes elegido en el sistema (día a día)") + '<div class="vm-menu-sep"></div>' + item("actualizar", "Actualizar desde mis registros") + item("ir-tabla", "Ir a la tabla")) +
      menu("vista", "Vista", Object.keys(GRAFICOS).map(k => '<button type="button" class="vm-menu-item" data-grafico="' + k + '">' + GRAFICOS[k] + "</button>").join("") + '<div class="vm-menu-sep"></div>' + item("ver-formulas", "Mostrar / ocultar fórmulas") + item("pantalla-completa", "Pantalla completa") + item("parejos", "Abrir «¿Mis ventas y pagos son parecidos?»")) +
      menu("temas", "Temas", Object.keys(TEMAS).map(k => '<button type="button" class="vm-menu-item" data-tema="' + k + '">' + TEMAS[k].nombre + "</button>").join("")) +
      menu("ayuda", "Ayuda", '<p class="vm-ayuda-texto"><b>¿Qué mide esto?</b> Qué tan estables son los totales de cada mes. La <b>desviación estándar</b> dice cuánto varía un mes típico respecto al promedio. ' +
        "Menos de 25% del promedio es estable; más de 50%, muy inestable.<br><br><b>Ambos</b> analiza el resultado: ingresos − egresos de cada mes. Si eliges un mes, se analiza día a día. Nada de lo que cambies aquí modifica tus datos.</p>") +
      "</nav><button type=\"button\" class=\"vm-cerrar\" data-accion=\"cerrar\" aria-label=\"Cerrar ventana\">✕</button></header>" +

      '<div class="vm-cuerpo"><aside class="vm-panel" aria-label="Ajustes del análisis">' +
      '<div class="vm-pestanas" role="tablist"><button type="button" class="vm-pestana" role="tab" aria-selected="true" data-pestana="analisis">Análisis</button><button type="button" class="vm-pestana" role="tab" aria-selected="false" data-pestana="formato">Formato</button></div>' +
      '<div class="vm-pagina" data-pagina="analisis">' +
      '<div class="vm-campo"><span class="vm-campo-etiqueta">¿Qué quieres analizar?</span><div class="pj-tipos es-tipos" role="group" aria-label="Qué analizar">' +
      '<button type="button" class="pj-tipo" data-tipo="ingresos"><i></i>Ingresos</button>' +
      '<button type="button" class="pj-tipo" data-tipo="egresos"><i></i>Egresos</button>' +
      '<button type="button" class="pj-tipo es-tipo-ambos" data-tipo="ambos"><i></i>Ambos</button></div>' +
      '<small class="es-nota-tipo">«Los dos» = lo que te queda cada mes (ingresos − egresos)</small></div>' +
      '<label class="vm-campo"><span>Año</span><select data-k="anio" id="esAnio"></select></label>' +
      '<label class="vm-campo"><span>Período</span><select data-k="mes" id="esMes"></select></label>' +
      '<label class="vm-campo"><span>Gráfico</span><select data-k="grafico">' + opciones(GRAFICOS, estado.grafico) + "</select></label>" +
      '<label class="vm-campo"><span>Decimales</span><select data-k="decimales"><option value="0">Sin decimales</option><option value="2">2 decimales</option></select></label>' +
      interruptor("excluirIncompletos", "No contar el último mes si está incompleto") +
      '<p class="vm-pie-nota pj-nota-panel">Los datos salen de tu «Registro del mes» (ingresos y egresos) y se actualizan cada vez que abres esta ventana.</p></div>' +
      '<div class="vm-pagina" data-pagina="formato" hidden>' +
      '<label class="vm-campo"><span>Tema de colores</span><select data-k="tema">' + opciones(TEMAS, estado.tema) + "</select></label>" +
      campoNumero("ancho", "Ancho (px)", 400, 1400, 10) + campoNumero("alto", "Altura (px)", 260, 800, 10) +
      '<label class="vm-campo"><span>Tipo de letra</span><select data-k="fuente">' + FUENTES.map(f => '<option value="' + f + '">' + f + "</option>").join("") + "</select></label>" +
      '<label class="vm-campo"><span>Color de fondo del gráfico</span><input type="color" data-k="fondo"></label>' +
      interruptor("verBandas", "Mostrar el rango normal (franjas)") + interruptor("etiquetas", "Mostrar textos sobre el gráfico") + interruptor("leyenda", "Mostrar leyenda") + interruptor("animacion", "Animación") +
      "</div></aside>" +

      '<main class="vm-centro">' +
      '<section class="vm-tarjeta" aria-label="Gráfico"><div class="vm-marco"><div class="vm-lienzo"><canvas id="esCanvas"></canvas><div class="vm-vacio" hidden></div></div></div>' +
      '<div class="vm-acciones"><button type="button" class="vm-boton" data-accion="compartir">Compartir</button><button type="button" class="vm-boton vm-boton-negro" data-accion="png">Descargar</button></div></section>' +
      '<section class="vm-tarjeta" aria-label="Análisis estadístico"><h3>Análisis estadístico</h3><div id="esAnalisis"></div></section>' +
      '<section class="vm-tarjeta" id="esTarjetaFormulas" aria-label="Cómo se calcula"><h3>¿Cómo se calcula? Desviación estándar paso a paso</h3><div id="esFormulas"></div></section>' +
      '<section class="vm-tarjeta" id="esTarjetaTabla" aria-label="Tabla"><div class="vm-hojas"><span class="vm-hoja">Mes a mes</span><span class="vm-hoja-nota">Haz clic en un mes para verlo día a día · solo lectura</span></div><div id="esTabla"></div></section>' +
      "</main></div></div>";
    document.body.appendChild(div);
    if (window.VistaSimple) {
      VistaSimple.instalar(div, {
        idEsencial: "esEsencial",
        mantener: "#esAnio",
        alAlternar: detalles => { if (!detalles) { estado.grafico = "rango"; estado.mes = -1; } sincronizarControles(); redibujar(); },
        ayudas: [
          { sel: "#esMes", texto: "Elige todo el año (mes a mes) o un mes para verlo día a día." },
          { sel: "select[data-k='grafico']", texto: "Cada gráfico muestra lo mismo desde otro ángulo. El de «mes a mes» es el más fácil de leer." },
          { sel: "select[data-k='decimales']", texto: "Cuántos decimales se muestran en los montos." },
          { sel: "input[data-k='excluirIncompletos']", texto: "Un mes incompleto (con pocos días registrados) puede parecer flojo sin serlo; por eso no se cuenta." },
        ],
      });
    }
    return div;
  }

  function sincronizarControles() {
    raiz.querySelectorAll(".pj-tipo").forEach(b => b.setAttribute("aria-pressed", b.dataset.tipo === estado.tipo ? "true" : "false"));
    const anios = aniosDisponibles();
    raiz.querySelector("#esAnio").innerHTML = (anios.length ? anios : [estado.anio]).map(a => '<option value="' + a + '">' + a + "</option>").join("");
    const tipo = tipoEfectivo();
    const meses = unidades(tipo, estado.anio, -1);
    raiz.querySelector("#esMes").innerHTML = '<option value="-1">Todo el año (mes a mes)</option>' +
      meses.map(u => '<option value="' + u.clave + '">' + u.nombre + (u.total !== null ? " (día a día)" : " · sin datos") + "</option>").join("");
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
      case "cerrar": cerrarEstabilidad(); break;
      case "compartir": compartirImagen(); break;
      case "copiar": copiarResumen(); break;
      case "restablecer": { const t = estado.tipo, an = estado.anio; estado = clonar(ESTADO_INICIAL); estado.tipo = t; estado.anio = an; sincronizarControles(); redibujar(); avisar("Ajustes restablecidos.", "success"); break; }
      case "ver-ingresos": ponerTipo("ingresos"); break;
      case "ver-egresos": ponerTipo("egresos"); break;
      case "ver-ambos": ponerTipo("ambos"); break;
      case "todo-anio": estado.mes = -1; sincronizarControles(); redibujar(); break;
      case "mes-sistema": estado.mes = mesActual; sincronizarControles(); redibujar(); break;
      case "actualizar": sincronizarControles(); redibujar(); avisar("Análisis actualizado con tus registros.", "success"); break;
      case "ir-tabla": raiz.querySelector("#esTarjetaTabla").scrollIntoView({ behavior: "smooth", block: "start" }); break;
      case "ver-formulas": verFormulas = !verFormulas; pintarFormulas(); break;
      case "pantalla-completa": if (document.fullscreenElement) document.exitFullscreen(); else if (raiz.requestFullscreen) raiz.requestFullscreen(); break;
      case "parejos": cerrarEstabilidad(); if (typeof abrirParejos === "function") abrirParejos(); break;
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
      const fila = t.closest(".es-fila[data-mes]");
      if (fila && estado.mes < 0) {
        const u = unidades(tipoEfectivo(), estado.anio, -1)[Number(fila.dataset.mes)];
        if (u && u.total !== null) { estado.mes = u.clave; sincronizarControles(); redibujar(); raiz.querySelector(".vm-centro").scrollTo({ top: 0, behavior: "smooth" }); }
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
      if (raiz.querySelector(".vm-menu.vm-menu-abierto")) cerrarMenus(); else cerrarEstabilidad();
    });
  }

  function abrirEstabilidad() {
    if (typeof Chart === "undefined") { avisar("No se pudo cargar la librería de gráficos (revisa tu internet).", "error"); return false; }
    if (!raiz) { raiz = construirVentana(); conectarEventos(); }
    if (typeof modoRegistro !== "undefined" && estado.tipo !== "ambos") estado.tipo = modoRegistro === "egresos" ? "egresos" : "ingresos";
    const anios = aniosDisponibles();
    if (!estado.anio || anios.indexOf(estado.anio) === -1) estado.anio = anios.length ? anios[anios.length - 1] : new Date().getFullYear();
    estado.mes = -1;
    estado.grafico = "rango";
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

  function cerrarEstabilidad() {
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

  window.abrirEstabilidad = abrirEstabilidad;
  window.cerrarEstabilidad = cerrarEstabilidad;
})();
