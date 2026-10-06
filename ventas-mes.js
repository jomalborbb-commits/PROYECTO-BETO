/* ==========================================================================
   ventas-mes.js — Ventana "Ventas por mes" (editor de gráfico de líneas)
   --------------------------------------------------------------------------
   Se abre desde el círculo "Ventas por mes" del panel de control
   (script.js llama a abrirVentasMes()). Es de SOLO LECTURA sobre tus datos:
   lee `registros` (lo que ya cargó tu "Importar Excel") y nunca los modifica.
   Cada vez que se abre vuelve a leerlos, así que siempre refleja tu Excel.

   Reutiliza de script.js: registros, MESES, mesDeFecha, anioDeFecha,
   formatearMoneda, formatearMonedaCompacta y mostrarToast.
   ========================================================================== */
(function () {
  "use strict";

  /* ======================================================================
     CONFIGURACIÓN
     ====================================================================== */

  // Temas de colores para las series. El predeterminado es el de la ladrillera: terracota, verde y arena.
  const TEMAS = {
    ladrillera: { nombre: "Ladrillera (predeterminado)", colores: ["#A9573F", "#4E7A4F", "#C7A982", "#D9A441", "#7A4A38", "#3F6C8C"] },
    naranja: { nombre: "Naranja vivo", colores: ["#FF7A1A", "#2F7DE1", "#2FA84F", "#E0201B", "#6C4BD8", "#F5A623"] },
    semaforo: { nombre: "Naranja, verde y rojo", colores: ["#FF7A1A", "#2FA84F", "#E0201B", "#2F7DE1", "#6C4BD8", "#F5A623"] },
    referencia: { nombre: "Azul y verde", colores: ["#2F7DE1", "#2FA84F", "#FF7A1A", "#E0201B", "#6C4BD8", "#F5A623"] },
    contraste: { nombre: "Alto contraste", colores: ["#111111", "#FF7A1A", "#2FA84F", "#2F7DE1", "#E0201B", "#6C4BD8"] },
  };

  const METRICAS = {
    monto: { nombre: "Monto vendido (S/)", corto: "Monto vendido", esMoneda: true },
    unidades: { nombre: "Unidades vendidas", corto: "Unidades", esMoneda: false },
    operaciones: { nombre: "N.º de operaciones", corto: "Operaciones", esMoneda: false },
    deuda: { nombre: "Deuda pendiente (S/)", corto: "Deuda pendiente", esMoneda: true },
  };

  const FUENTES = ["Inter", "Space Grotesk", "IBM Plex Mono", "Arial", "Georgia", "Times New Roman", "Courier New"];

  const TAMANOS = {
    predeterminado: { nombre: "Predeterminado (700 × 400)", ancho: 700, alto: 400 },
    amplio: { nombre: "Amplio (1000 × 460)", ancho: 1000, alto: 460 },
    cuadrado: { nombre: "Cuadrado (520 × 520)", ancho: 520, alto: 520 },
    personalizado: { nombre: "Personalizado", ancho: null, alto: null },
  };

  const ESTADO_INICIAL = {
    tipo: "line",            // line | bar | area
    tema: "ladrillera",
    metrica: "monto",
    anios: null,             // null = se eligen solos (los más recientes)
    tamano: "predeterminado",
    ancho: 700,
    alto: 400,
    fuente: "Inter",
    fondo: "#FFFFFF",
    titulo: "Ventas por mes",
    subtitulo: "",           // vacío = texto automático según los datos
    grosor: 3,
    suavizado: 0,            // 0 = líneas rectas (como el icono de la referencia)
    rellenar: false,
    opacidadRelleno: 20,
    etiquetas: true,
    leyenda: true,
    posLeyenda: "bottom",
    puntos: true,
    tamPunto: 4,
    cuadricula: true,
    animacion: true,
    anotaciones: true,
    tendencia: false,
    ceroBase: true,
    maximo: "",
    ejeVisible: true,
    tituloX: "Mes",
    tituloY: "",             // vacío = automático según la métrica
  };

  const MESES_MINUSCULA = MESES.map(function (m) { return m.toLowerCase(); });

  /* ======================================================================
     ESTADO
     ====================================================================== */
  let estado = clonar(ESTADO_INICIAL);
  let datos = null;          // { anios: [..], matriz: { anio: [12 valores|null] } }
  let grafico = null;
  let raiz = null;           // el overlay (se construye la primera vez)
  let elementoAnterior = null;
  let ocultarAnalisis = false;
  let ocultarTabla = false;

  function clonar(obj) { return JSON.parse(JSON.stringify(obj)); }

  /* ======================================================================
     DATOS: se leen de `registros` (tu Excel importado). Nunca se escriben.
     ====================================================================== */

  function valorDeMetrica(acum) {
    if (estado.metrica === "unidades") return acum.unidades;
    if (estado.metrica === "operaciones") return acum.operaciones;
    if (estado.metrica === "deuda") return acum.deuda;
    return acum.monto;
  }

  function calcularDatos() {
    const acum = {};
    registros.forEach(function (r) {
      const m = mesDeFecha(r.fechaIngreso);
      if (m === null || isNaN(m) || m < 0 || m > 11) return;
      const a = anioDeFecha(r.fechaIngreso);
      if (!acum[a]) acum[a] = {};
      if (!acum[a][m]) acum[a][m] = { monto: 0, unidades: 0, operaciones: 0, deuda: 0 };
      acum[a][m].monto += Number(r.montoTotal) || 0;
      acum[a][m].unidades += Number(r.unidad) || 0;
      acum[a][m].operaciones += 1;
      acum[a][m].deuda += Number(r.deudaPendiente) || 0;
    });

    const anios = Object.keys(acum).map(Number).sort(function (x, y) { return x - y; });
    const matriz = {};
    anios.forEach(function (a) {
      // null (y no 0) cuando ese mes no tuvo registros: así la línea no cae
      // a cero por meses que simplemente todavía no existen en el Excel
      matriz[a] = MESES.map(function (_, m) { return acum[a][m] ? valorDeMetrica(acum[a][m]) : null; });
    });
    return { anios: anios, matriz: matriz };
  }

  function aniosElegidos() {
    if (!datos) return [];
    if (Array.isArray(estado.anios)) return estado.anios.filter(function (a) { return datos.anios.indexOf(a) !== -1; });
    return datos.anios.slice(-3);   // por defecto, los 3 años más recientes
  }

  function formatearValor(v, compacto) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    if (METRICAS[estado.metrica].esMoneda) return compacto ? formatearMonedaCompacta(v) : formatearMoneda(v);
    return compacto && Math.abs(v) >= 10000
      ? (v / 1000).toLocaleString("es-PE", { maximumFractionDigits: 1 }) + "K"
      : Number(v).toLocaleString("es-PE", { maximumFractionDigits: 0 });
  }

  /* ======================================================================
     ESTADÍSTICA
     ====================================================================== */

  function estadisticas(serie) {
    const puntos = [];
    serie.forEach(function (v, i) { if (v !== null && v !== undefined) puntos.push({ i: i, v: v }); });
    if (puntos.length === 0) return null;

    const total = puntos.reduce(function (s, p) { return s + p.v; }, 0);
    const promedio = total / puntos.length;
    let max = puntos[0];
    let min = puntos[0];
    puntos.forEach(function (p) { if (p.v > max.v) max = p; if (p.v < min.v) min = p; });

    const varianza = puntos.reduce(function (s, p) { return s + Math.pow(p.v - promedio, 2); }, 0) / puntos.length;
    const desviacion = Math.sqrt(varianza);

    // Último mes contra el mes anterior con datos
    let ultimoVsAnterior = null;
    if (puntos.length >= 2) {
      const ult = puntos[puntos.length - 1];
      const pen = puntos[puntos.length - 2];
      ultimoVsAnterior = { ult: ult, pen: pen, pct: pen.v !== 0 ? ((ult.v - pen.v) / Math.abs(pen.v)) * 100 : null };
    }

    // Tendencia: pendiente de la recta de mínimos cuadrados (valor por mes)
    let pendiente = null;
    let ordenada = null;
    if (puntos.length >= 2) {
      const n = puntos.length;
      const sx = puntos.reduce(function (s, p) { return s + p.i; }, 0);
      const sy = total;
      const sxy = puntos.reduce(function (s, p) { return s + p.i * p.v; }, 0);
      const sxx = puntos.reduce(function (s, p) { return s + p.i * p.i; }, 0);
      const den = n * sxx - sx * sx;
      if (den !== 0) {
        pendiente = (n * sxy - sx * sy) / den;
        ordenada = (sy - pendiente * sx) / n;
      }
    }

    return {
      puntos: puntos, total: total, promedio: promedio, max: max, min: min,
      desviacion: desviacion, cv: promedio !== 0 ? (desviacion / Math.abs(promedio)) * 100 : null,
      ultimoVsAnterior: ultimoVsAnterior, pendiente: pendiente, ordenada: ordenada,
    };
  }

  /* ======================================================================
     GRÁFICO (Chart.js)
     ====================================================================== */

  function aRgba(hex, alfa) {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map(function (c) { return c + c; }).join("") : h, 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + alfa + ")";
  }

  function subtituloAutomatico(anios) {
    if (anios.length === 0) return "";
    return METRICAS[estado.metrica].nombre + " · " + anios.join(", ");
  }

  // Fondo del lienzo: se pinta DETRÁS de todo para que la imagen descargada
  // no salga con el fondo transparente
  const pluginFondo = {
    id: "vmFondo",
    beforeDraw: function (chart) {
      const ctx = chart.ctx;
      ctx.save();
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = estado.fondo;
      ctx.fillRect(0, 0, chart.width, chart.height);
      ctx.restore();
    },
  };

  // Cifra encima de cada punto, como "Datos en gráfico" de la referencia
  const pluginEtiquetas = {
    id: "vmEtiquetas",
    afterDatasetsDraw: function (chart) {
      if (!estado.etiquetas) return;
      const ctx = chart.ctx;
      ctx.save();
      ctx.font = "600 11px " + estado.fuente + ", sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      chart.data.datasets.forEach(function (ds, i) {
        if (ds.vmTendencia || !chart.isDatasetVisible(i)) return;
        chart.getDatasetMeta(i).data.forEach(function (el, j) {
          const v = ds.data[j];
          if (v === null || v === undefined) return;
          const texto = formatearValor(v, true);
          const y = el.y - (estado.tipo === "bar" ? 4 : 9);
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.strokeText(texto, el.x, y);
          ctx.fillStyle = "#111";
          ctx.fillText(texto, el.x, y);
        });
      });
      ctx.restore();
    },
  };

  // Anotaciones: marca el mejor y el peor mes de la serie principal
  const pluginAnotaciones = {
    id: "vmAnotaciones",
    afterDatasetsDraw: function (chart) {
      if (!estado.anotaciones) return;
      const idx = chart.data.datasets.map(function (d) { return !d.vmTendencia; }).lastIndexOf(true);
      if (idx < 0) return;
      const ds = chart.data.datasets[idx];
      const est = estadisticas(ds.data);
      if (!est || est.puntos.length < 2) return;
      const meta = chart.getDatasetMeta(idx);
      const ctx = chart.ctx;

      function marcar(p, texto, color) {
        const el = meta.data[p.i];
        if (!el) return;
        ctx.save();
        ctx.beginPath();
        ctx.arc(el.x, el.y, 8, 0, Math.PI * 2);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.font = "800 11px " + estado.fuente + ", sans-serif";
        const w = ctx.measureText(texto).width + 14;
        const x = Math.min(Math.max(el.x - w / 2, chart.chartArea.left), chart.chartArea.right - w);
        // Encima del punto (por encima de su cifra); si no cabe, debajo, para no
        // taparse con el título ni con la cifra del propio punto
        const cabeArriba = el.y - 44 >= chart.chartArea.top - 2;
        const y = cabeArriba ? el.y - 44 : el.y + 16;
        ctx.fillStyle = color;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, 20, 6); else ctx.rect(x, y, w, 20);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(texto, x + w / 2, y + 10);
        ctx.restore();
      }

      marcar(est.max, "Máx", "#1E8F45");
      marcar(est.min, "Mín", "#D02A1C");
    },
  };

  function construirConfig() {
    const paleta = TEMAS[estado.tema].colores;
    const anios = aniosElegidos();
    const esBarra = estado.tipo === "bar";
    const rellena = estado.tipo === "area" || estado.rellenar;

    const datasets = anios.map(function (a, i) {
      const color = paleta[i % paleta.length];
      return {
        label: String(a),
        data: datos.matriz[a],
        borderColor: color,
        backgroundColor: esBarra ? aRgba(color, 0.9) : aRgba(color, estado.opacidadRelleno / 100),
        borderWidth: esBarra ? 0 : estado.grosor,
        borderRadius: esBarra ? 5 : 0,
        tension: estado.suavizado,
        fill: rellena && !esBarra,
        pointRadius: estado.puntos && !esBarra ? estado.tamPunto : 0,
        pointHoverRadius: estado.tamPunto + 2,
        pointBackgroundColor: "#fff",
        pointBorderColor: color,
        pointBorderWidth: 2,
        borderJoinStyle: "round",
        spanGaps: false,
      };
    });

    // Línea de tendencia de la serie más reciente (recta de mínimos cuadrados)
    if (estado.tendencia && anios.length > 0) {
      const a = anios[anios.length - 1];
      const est = estadisticas(datos.matriz[a]);
      if (est && est.pendiente !== null) {
        datasets.push({
          label: "Tendencia " + a,
          vmTendencia: true,
          type: "line",
          data: MESES.map(function (_, i) { return est.ordenada + est.pendiente * i; }),
          borderColor: "#111111",
          borderDash: [7, 6],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0,
        });
      }
    }

    const fuente = estado.fuente + ", sans-serif";
    const tituloY = estado.tituloY || METRICAS[estado.metrica].corto;

    return {
      type: estado.tipo === "area" ? "line" : estado.tipo,
      data: { labels: MESES_MINUSCULA, datasets: datasets },
      plugins: [pluginFondo, pluginEtiquetas, pluginAnotaciones],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: estado.animacion ? { duration: 900, easing: "easeOutQuart" } : false,
        interaction: { mode: "index", intersect: false },
        layout: { padding: { top: 14, right: 12 } },
        plugins: {
          title: {
            display: !!estado.titulo, text: estado.titulo, color: "#8C4633",
            font: { family: fuente, size: 20, weight: "600" }, padding: { top: 4, bottom: 2 },
          },
          subtitle: {
            display: !!(estado.subtitulo || subtituloAutomatico(anios)),
            text: estado.subtitulo || subtituloAutomatico(anios),
            color: "#666", font: { family: fuente, size: 12 }, padding: { bottom: 8 },
          },
          legend: {
            display: estado.leyenda, position: estado.posLeyenda,
            labels: { usePointStyle: true, boxWidth: 8, font: { family: fuente, size: 12 }, color: "#222" },
          },
          tooltip: {
            callbacks: {
              label: function (c) { return " " + c.dataset.label + ": " + formatearValor(c.parsed.y, false); },
            },
          },
        },
        scales: {
          x: {
            display: estado.ejeVisible,
            grid: { display: estado.cuadricula, color: "#E4E4E4" },
            title: { display: !!estado.tituloX, text: estado.tituloX, font: { family: fuente, size: 12, weight: "600" }, color: "#333" },
            ticks: { font: { family: fuente, size: 11 }, color: "#222" },
          },
          y: {
            display: estado.ejeVisible,
            beginAtZero: estado.ceroBase,
            max: estado.maximo !== "" && !isNaN(Number(estado.maximo)) ? Number(estado.maximo) : undefined,
            grid: { display: estado.cuadricula, color: "#E4E4E4" },
            title: { display: true, text: tituloY, font: { family: fuente, size: 12, weight: "600" }, color: "#333" },
            ticks: {
              font: { family: fuente, size: 11 }, color: "#222",
              callback: function (v) { return formatearValor(v, true); },
            },
          },
        },
      },
    };
  }

  function redibujar(recrear) {
    if (!raiz || !datos) return;
    const lienzo = raiz.querySelector("#vmCanvas");
    const marco = raiz.querySelector(".vm-lienzo");
    marco.style.width = estado.ancho + "px";
    marco.style.height = estado.alto + "px";

    const hayDatos = aniosElegidos().length > 0;
    raiz.querySelector(".vm-vacio").hidden = hayDatos;
    if (!hayDatos) {
      if (grafico) { grafico.destroy(); grafico = null; }
      pintarAnalisisYTabla();
      return;
    }

    const cfg = construirConfig();
    if (!grafico || recrear || grafico.config.type !== cfg.type) {
      if (grafico) grafico.destroy();
      grafico = new Chart(lienzo, cfg);
    } else {
      grafico.data = cfg.data;
      grafico.options = cfg.options;
      grafico.update();
    }
    grafico.resize();
    pintarAnalisisYTabla();
  }

  /* ======================================================================
     ANÁLISIS Y TABLA (debajo del gráfico)
     ====================================================================== */

  function claseVariacion(pct) {
    if (pct === null || isNaN(pct)) return "";
    return pct >= 0 ? "vm-sube" : "vm-baja";
  }

  function textoPct(pct) {
    if (pct === null || isNaN(pct)) return "—";
    return (pct >= 0 ? "▲ +" : "▼ ") + pct.toFixed(1) + "%";
  }

  function pintarAnalisisYTabla() {
    const anios = aniosElegidos();
    const contenedorAnalisis = raiz.querySelector("#vmAnalisis");
    const contenedorTabla = raiz.querySelector("#vmTabla");
    raiz.querySelector("#vmTarjetaAnalisis").hidden = ocultarAnalisis;
    raiz.querySelector("#vmTarjetaTabla").hidden = ocultarTabla;

    // ---- Análisis de la serie más reciente y comparación con la anterior ----
    if (anios.length === 0) {
      contenedorAnalisis.innerHTML = '<p class="vm-pie-nota">Aún no hay ventas registradas. Importa tu Excel con «Más acciones → Importar Excel» y este análisis se llenará solo.</p>';
    } else {
      const principal = anios[anios.length - 1];
      const est = estadisticas(datos.matriz[principal]);
      const met = METRICAS[estado.metrica];
      const cards = [];

      cards.push(["Total " + principal, formatearValor(est.total, false), est.puntos.length + " de 12 meses con datos"]);
      cards.push(["Promedio mensual", formatearValor(est.promedio, false), "sobre los meses con datos"]);
      cards.push(["Mejor mes", MESES_MINUSCULA[est.max.i], formatearValor(est.max.v, false)]);
      cards.push(["Peor mes", MESES_MINUSCULA[est.min.i], formatearValor(est.min.v, false)]);

      if (est.ultimoVsAnterior) {
        const u = est.ultimoVsAnterior;
        cards.push(["Último mes vs anterior",
          '<span class="' + claseVariacion(u.pct) + '">' + textoPct(u.pct) + "</span>",
          MESES_MINUSCULA[u.ult.i] + " frente a " + MESES_MINUSCULA[u.pen.i]]);
      }

      if (est.pendiente !== null && est.promedio !== 0) {
        const pctMes = (est.pendiente / Math.abs(est.promedio)) * 100;
        const etiqueta = Math.abs(pctMes) < 1 ? "Estable" : pctMes > 0 ? "Creciente" : "Decreciente";
        cards.push(["Tendencia", '<span class="' + claseVariacion(pctMes) + '">' + etiqueta + "</span>",
          (pctMes >= 0 ? "+" : "") + pctMes.toFixed(1) + "% del promedio por mes"]);
      }

      cards.push(["Variabilidad (desv. estándar)", formatearValor(est.desviacion, false),
        est.cv !== null ? "coef. de variación " + est.cv.toFixed(0) + "%" : ""]);

      if (anios.length >= 2) {
        const previo = anios[anios.length - 2];
        // Solo se comparan los meses que existen en AMBOS años, para no
        // comparar un año completo contra uno a medias
        let sumaA = 0;
        let sumaB = 0;
        let n = 0;
        datos.matriz[principal].forEach(function (v, i) {
          const w = datos.matriz[previo][i];
          if (v !== null && w !== null) { sumaA += v; sumaB += w; n += 1; }
        });
        if (n > 0 && sumaB !== 0) {
          const pct = ((sumaA - sumaB) / Math.abs(sumaB)) * 100;
          cards.push([principal + " vs " + previo,
            '<span class="' + claseVariacion(pct) + '">' + textoPct(pct) + "</span>",
            "en los " + n + " meses en común"]);
        }
      }

      const ranking = est.puntos.slice().sort(function (a, b) { return b.v - a.v; }).slice(0, 3);
      contenedorAnalisis.innerHTML =
        '<div class="vm-analisis-grid">' +
        cards.map(function (c) { return '<div class="vm-dato"><small>' + c[0] + "</small><strong>" + c[1] + "</strong><em>" + c[2] + "</em></div>"; }).join("") +
        "</div>" +
        '<ul class="vm-top3">' +
        ranking.map(function (p, i) { return "<li><b>" + (i + 1) + "</b><span><strong>" + MESES_MINUSCULA[p.i] + "</strong> — " + formatearValor(p.v, false) + "</span></li>"; }).join("") +
        "</ul>";
      contenedorAnalisis.dataset.metrica = met.nombre;
    }

    // ---- Tabla "Hoja1": meses en columnas y años en filas, como la referencia ----
    if (datos.anios.length === 0) {
      contenedorTabla.innerHTML = '<p class="vm-pie-nota">Sin datos todavía.</p>';
    } else {
      contenedorTabla.innerHTML =
        '<div class="vm-tabla-envoltura"><table class="vm-tabla"><thead><tr><th></th>' +
        MESES_MINUSCULA.map(function (m) { return "<th>" + m + "</th>"; }).join("") +
        "</tr></thead><tbody>" +
        datos.anios.map(function (a) {
          return "<tr><td>" + a + "</td>" + datos.matriz[a].map(function (v) {
            return v === null ? '<td class="vm-sin-dato">—</td>' : "<td>" + formatearValor(v, false) + "</td>";
          }).join("") + "</tr>";
        }).join("") +
        "</tbody></table></div>";
    }
  }

  /* ======================================================================
     ARCHIVOS: descargar imagen, datos y compartir
     ====================================================================== */

  function nombreArchivo(ext) {
    return "ventas-por-mes-" + estado.metrica + "." + ext;
  }

  function descargarImagen() {
    if (!grafico) { avisar("No hay datos para descargar todavía.", "error"); return; }
    const a = document.createElement("a");
    a.href = grafico.toBase64Image("image/png", 1);
    a.download = nombreArchivo("png");
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function descargarCsv() {
    if (datos.anios.length === 0) { avisar("No hay datos para descargar todavía.", "error"); return; }
    // Punto y coma: es el separador que Excel en español abre bien
    const filas = [["Año"].concat(MESES_MINUSCULA).join(";")];
    datos.anios.forEach(function (a) {
      filas.push([a].concat(datos.matriz[a].map(function (v) { return v === null ? "" : String(v).replace(".", ","); })).join(";"));
    });
    const blob = new Blob(["﻿" + filas.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombreArchivo("csv");
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  // "Compartir" de la referencia sube el gráfico a su servidor; aquí no sale
  // nada de tu computador: se copia la imagen al portapapeles
  function compartirImagen() {
    if (!grafico) { avisar("No hay datos para compartir todavía.", "error"); return; }
    grafico.canvas.toBlob(function (blob) {
      if (blob && navigator.clipboard && window.ClipboardItem) {
        navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
          .then(function () { avisar("Imagen copiada. Pégala en WhatsApp, Word o correo.", "success"); })
          .catch(function () { avisar("Tu navegador no permitió copiar. Usa «Descargar».", "error"); });
      } else {
        avisar("Tu navegador no permite copiar imágenes. Usa «Descargar».", "error");
      }
    });
  }

  function avisar(mensaje, tipo) {
    if (typeof mostrarToast === "function") mostrarToast(mensaje, tipo);
  }

  /* ======================================================================
     INTERFAZ
     ====================================================================== */

  function opciones(objeto, seleccionada) {
    return Object.keys(objeto).map(function (k) {
      const nombre = typeof objeto[k] === "string" ? objeto[k] : objeto[k].nombre;
      return '<option value="' + k + '"' + (k === seleccionada ? " selected" : "") + ">" + nombre + "</option>";
    }).join("");
  }

  function interruptor(clave, etiquetaAria) {
    return '<label class="vm-interruptor" title="' + etiquetaAria + '"><input type="checkbox" data-k="' + clave + '" aria-label="' + etiquetaAria + '"><i></i></label>';
  }

  function seccion(id, titulo, cuerpo, claveInterruptor, abierta) {
    return '<div class="vm-seccion">' +
      '<div class="vm-seccion-cab">' +
      '<button type="button" class="vm-seccion-boton" aria-expanded="' + (abierta ? "true" : "false") + '" aria-controls="vmSec' + id + '">' + titulo + "</button>" +
      (claveInterruptor ? interruptor(claveInterruptor, titulo) : "") +
      "</div>" +
      '<div class="vm-seccion-cuerpo" id="vmSec' + id + '"' + (abierta ? "" : " hidden") + ">" + cuerpo + "</div></div>";
  }

  function campoNumero(clave, etiqueta, min, max, paso) {
    return '<div class="vm-campo"><span>' + etiqueta + '</span><div class="vm-fila">' +
      '<input type="range" data-k="' + clave + '" min="' + min + '" max="' + max + '" step="' + (paso || 1) + '">' +
      '<input type="number" data-k="' + clave + '" min="' + min + '" max="' + max + '" step="' + (paso || 1) + '"></div></div>';
  }

  function construirVentana() {
    const div = document.createElement("div");
    div.className = "vm-overlay";
    div.hidden = true;
    div.setAttribute("role", "dialog");
    div.setAttribute("aria-modal", "true");
    div.setAttribute("aria-label", "Ventas por mes");

    div.innerHTML =
      '<div class="vm-ventana">' +

      /* ----- barra superior ----- */
      '<header class="vm-barra">' +
      '<div class="vm-marca"><i></i>Ventas por mes</div>' +
      '<nav class="vm-menus" aria-label="Menús">' +
      menu("archivo", "Archivo",
        '<button type="button" class="vm-menu-item" data-accion="png">Descargar imagen (PNG)</button>' +
        '<button type="button" class="vm-menu-item" data-accion="csv">Descargar datos (CSV)</button>' +
        '<button type="button" class="vm-menu-item" data-accion="imprimir">Imprimir</button>' +
        '<div class="vm-menu-sep"></div>' +
        '<button type="button" class="vm-menu-item" data-accion="cerrar">Cerrar ventana <small>Esc</small></button>') +
      menu("editar", "Editar",
        '<button type="button" class="vm-menu-item" data-accion="titulo">Editar el título</button>' +
        '<button type="button" class="vm-menu-item" data-accion="restablecer">Restablecer ajustes</button>') +
      menu("datos", "Datos",
        '<button type="button" class="vm-menu-item" data-accion="ver-tabla">Ir a la tabla de datos</button>' +
        '<button type="button" class="vm-menu-item" data-accion="actualizar">Actualizar desde mis registros</button>' +
        '<button type="button" class="vm-menu-item" data-accion="copiar-datos">Copiar datos (CSV)</button>') +
      menu("vista", "Vista",
        '<button type="button" class="vm-menu-item" data-accion="pantalla-completa">Pantalla completa</button>' +
        '<button type="button" class="vm-menu-item" data-accion="ver-analisis">Mostrar / ocultar análisis</button>' +
        '<button type="button" class="vm-menu-item" data-accion="ver-datos">Mostrar / ocultar tabla</button>') +
      menu("idioma", "Idioma",
        '<button type="button" class="vm-menu-item" disabled>Español <small>✓</small></button>' +
        '<button type="button" class="vm-menu-item" disabled>English <small>próximamente</small></button>') +
      menu("temas", "Temas",
        Object.keys(TEMAS).map(function (k) { return '<button type="button" class="vm-menu-item" data-tema="' + k + '">' + TEMAS[k].nombre + "</button>"; }).join("")) +
      menu("ayuda", "Ayuda",
        '<p class="vm-ayuda-texto">Este gráfico se arma solo con los registros de tu Excel. Con el panel de la izquierda cambias el aspecto (tipo, colores, tamaño, textos). Lo que cambies aquí <b>no modifica tus datos</b>. Usa «Descargar» para guardar la imagen.</p>') +
      "</nav>" +
      '<button type="button" class="vm-cerrar" data-accion="cerrar" aria-label="Cerrar ventana">✕</button>' +
      "</header>" +

      /* ----- cuerpo ----- */
      '<div class="vm-cuerpo">' +

      /* ----- panel izquierdo ----- */
      '<aside class="vm-panel" aria-label="Ajustes del gráfico">' +
      '<div class="vm-pestanas" role="tablist">' +
      '<button type="button" class="vm-pestana" role="tab" aria-selected="true" data-pestana="lienzo">Lienzo</button>' +
      '<button type="button" class="vm-pestana" role="tab" aria-selected="false" data-pestana="formato">Formato</button>' +
      "</div>" +

      '<div class="vm-pagina" data-pagina="lienzo">' +
      '<label class="vm-campo"><span>Tipo de gráfico</span><select data-k="tipo">' +
      '<option value="line">Gráfico de líneas</option><option value="area">Gráfico de área</option><option value="bar">Gráfico de barras</option></select></label>' +
      '<label class="vm-campo"><span>Tema de colores</span><select data-k="tema">' + opciones(TEMAS, estado.tema) + "</select></label>" +
      '<label class="vm-campo"><span>Qué medir (eje vertical)</span><select data-k="metrica">' + opciones(METRICAS, estado.metrica) + "</select></label>" +
      '<div class="vm-campo"><span class="vm-campo-etiqueta">Años a graficar</span><div class="vm-anios" id="vmAnios"></div></div>' +
      '<label class="vm-campo"><span>Tamaño</span><select data-k="tamano">' + opciones(TAMANOS, estado.tamano) + "</select></label>" +
      campoNumero("ancho", "Ancho (px)", 300, 1400, 10) +
      campoNumero("alto", "Altura (px)", 200, 900, 10) +
      '<label class="vm-campo"><span>Tipo de letra</span><select data-k="fuente">' +
      FUENTES.map(function (f) { return '<option value="' + f + '">' + f + "</option>"; }).join("") + "</select></label>" +
      '<label class="vm-campo"><span>Color de fondo</span><input type="color" data-k="fondo"></label>' +
      "</div>" +

      '<div class="vm-pagina" data-pagina="formato" hidden>' +
      seccion("Relleno", "Relleno & Contorno",
        campoNumero("grosor", "Grosor de la línea", 1, 10, 1) +
        '<div class="vm-seccion-cab"><span class="vm-campo-etiqueta" style="margin:0">Rellenar bajo la línea</span>' + interruptor("rellenar", "Rellenar") + "</div>" +
        campoNumero("opacidadRelleno", "Opacidad del relleno (%)", 5, 90, 5) +
        campoNumero("suavizado", "Suavizado de la línea (0 = recta)", 0, 0.5, 0.05), null, true) +
      seccion("Datos", "Datos en gráfico", '<p class="vm-pie-nota">Muestra la cifra sobre cada punto.</p>', "etiquetas", false) +
      seccion("Leyenda", "Leyenda",
        '<label class="vm-campo"><span>Posición</span><select data-k="posLeyenda"><option value="bottom">Abajo</option><option value="top">Arriba</option><option value="right">Derecha</option><option value="left">Izquierda</option></select></label>',
        "leyenda", false) +
      seccion("Conjunto", "Conjunto de datos",
        '<div class="vm-campo-etiqueta">Línea de tendencia</div><div class="vm-seccion-cab"><span style="font-size:13px">Recta de tendencia del año más reciente</span>' + interruptor("tendencia", "Línea de tendencia") + "</div>", null, false) +
      seccion("Punto", "Punto", campoNumero("tamPunto", "Tamaño del punto", 1, 10, 1), "puntos", false) +
      seccion("Escala", "Escala",
        '<div class="vm-seccion-cab"><span style="font-size:13px">Empezar el eje en cero</span>' + interruptor("ceroBase", "Empezar en cero") + "</div>" +
        '<label class="vm-campo" style="margin-top:8px"><span>Valor máximo (vacío = automático)</span><input type="number" data-k="maximo" min="0" step="any"></label>', null, false) +
      seccion("Eje", "Eje",
        '<div class="vm-seccion-cab"><span style="font-size:13px">Mostrar ejes</span>' + interruptor("ejeVisible", "Mostrar ejes") + "</div>" +
        '<label class="vm-campo" style="margin-top:8px"><span>Título del eje horizontal</span><input type="text" data-k="tituloX"></label>' +
        '<label class="vm-campo"><span>Título del eje vertical (vacío = automático)</span><input type="text" data-k="tituloY"></label>', null, false) +
      seccion("Cuadricula", "Cuadrícula", '<p class="vm-pie-nota">Líneas guía de fondo.</p>', "cuadricula", false) +
      seccion("Texto", "Texto",
        '<label class="vm-campo"><span>Título</span><input type="text" data-k="titulo"></label>' +
        '<label class="vm-campo"><span>Subtítulo (vacío = automático)</span><input type="text" data-k="subtitulo"></label>', null, false) +
      seccion("Anotaciones", "Anotaciones", '<p class="vm-pie-nota">Marca el mejor mes (Máx) y el peor mes (Mín) del año más reciente.</p>', "anotaciones", false) +
      seccion("Animacion", "Animación", '<p class="vm-pie-nota">El gráfico se dibuja con movimiento suave.</p>', "animacion", false) +
      '<div class="vm-seccion"><div class="vm-seccion-cab"><span class="vm-seccion-boton" style="cursor:default;color:#8A8A8A">A mano alzada</span><span class="vm-marca-pro">Próximamente</span></div></div>' +
      "</div>" +
      "</aside>" +

      /* ----- centro ----- */
      '<main class="vm-centro">' +
      '<section class="vm-tarjeta" aria-label="Vista previa del gráfico">' +
      '<div class="vm-marco"><div class="vm-lienzo"><canvas id="vmCanvas"></canvas>' +
      '<div class="vm-vacio" hidden>Aún no hay ventas registradas.<br>Importa tu Excel y el gráfico se dibuja solo.</div></div></div>' +
      '<div class="vm-acciones">' +
      '<button type="button" class="vm-boton" data-accion="compartir">Compartir</button>' +
      '<button type="button" class="vm-boton vm-boton-negro" data-accion="png">Descargar</button>' +
      "</div></section>" +

      '<section class="vm-tarjeta" id="vmTarjetaAnalisis" aria-label="Análisis estadístico">' +
      "<h3>Análisis estadístico</h3><div id=\"vmAnalisis\"></div></section>" +

      '<section class="vm-tarjeta" id="vmTarjetaTabla" aria-label="Tabla de datos">' +
      '<div class="vm-hojas"><span class="vm-hoja">Hoja1</span>' +
      '<button type="button" class="vm-hoja-mas" disabled title="Los datos vienen de tus registros: no se agregan hojas">+</button>' +
      '<span class="vm-hoja-nota">Solo lectura · sale de tu Excel importado</span></div>' +
      '<div id="vmTabla"></div></section>' +
      "</main>" +

      "</div></div>";

    document.body.appendChild(div);
    return div;
  }

  function menu(id, titulo, cuerpo) {
    return '<div class="vm-menu" data-menu="' + id + '">' +
      '<button type="button" class="vm-menu-boton" aria-haspopup="true" aria-expanded="false">' + titulo + "</button>" +
      '<div class="vm-menu-lista" hidden>' + cuerpo + "</div></div>";
  }

  /* ---------- vínculo entre controles y estado ---------- */

  function valorAControl(ctrl, valor) {
    if (ctrl.type === "checkbox") ctrl.checked = !!valor;
    else ctrl.value = valor === null || valor === undefined ? "" : valor;
  }

  function sincronizarControles() {
    raiz.querySelectorAll("[data-k]").forEach(function (ctrl) {
      valorAControl(ctrl, estado[ctrl.dataset.k]);
    });
    // Los años dependen de los datos
    const cont = raiz.querySelector("#vmAnios");
    const elegidos = aniosElegidos();
    cont.innerHTML = datos.anios.length === 0
      ? '<span class="vm-pie-nota">Sin años todavía</span>'
      : datos.anios.map(function (a) {
          return '<label><input type="checkbox" data-anio="' + a + '"' + (elegidos.indexOf(a) !== -1 ? " checked" : "") + ">" + a + "</label>";
        }).join("");
  }

  function alCambiarControl(e) {
    const ctrl = e.target;

    if (ctrl.dataset.anio) {
      const marcados = Array.from(raiz.querySelectorAll("[data-anio]:checked")).map(function (c) { return Number(c.dataset.anio); });
      estado.anios = marcados;
      redibujar(false);
      return;
    }

    const k = ctrl.dataset.k;
    if (!k) return;
    let v = ctrl.type === "checkbox" ? ctrl.checked : ctrl.value;
    if (ctrl.type === "range" || ctrl.type === "number") {
      if (k === "maximo") v = ctrl.value;
      else if (ctrl.value === "") return;
      else v = Number(ctrl.value);
    }
    estado[k] = v;

    // El tamaño elegido y los deslizadores de ancho/alto van ligados
    if (k === "tamano" && TAMANOS[v].ancho) {
      estado.ancho = TAMANOS[v].ancho;
      estado.alto = TAMANOS[v].alto;
    }
    if (k === "ancho" || k === "alto") estado.tamano = "personalizado";

    // Al cambiar de métrica cambian los valores de todo el gráfico
    if (k === "metrica") datos = calcularDatos();

    sincronizarControles();
    redibujar(k === "animacion");
  }

  /* ---------- menús desplegables ---------- */

  function cerrarMenus() {
    raiz.querySelectorAll(".vm-menu").forEach(function (m) {
      m.classList.remove("vm-menu-abierto");
      m.querySelector(".vm-menu-lista").hidden = true;
      m.querySelector(".vm-menu-boton").setAttribute("aria-expanded", "false");
    });
  }

  function hayMenuAbierto() {
    return !!raiz.querySelector(".vm-menu.vm-menu-abierto");
  }

  function ejecutarAccion(accion) {
    switch (accion) {
      case "png": descargarImagen(); break;
      case "csv": descargarCsv(); break;
      case "imprimir": window.print(); break;
      case "cerrar": cerrarVentasMes(); break;
      case "compartir": compartirImagen(); break;
      case "titulo":
        activarPestana("formato");
        abrirSeccion("Texto");
        raiz.querySelector('[data-k="titulo"]').focus();
        break;
      case "restablecer":
        estado = clonar(ESTADO_INICIAL);
        datos = calcularDatos();
        sincronizarControles();
        redibujar(true);
        avisar("Ajustes restablecidos.", "success");
        break;
      case "ver-tabla":
        ocultarTabla = false;
        redibujar(false);
        raiz.querySelector("#vmTarjetaTabla").scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      case "actualizar":
        datos = calcularDatos();
        sincronizarControles();
        redibujar(true);
        avisar("Gráfico actualizado con tus registros.", "success");
        break;
      case "copiar-datos": {
        const filas = [["Año"].concat(MESES_MINUSCULA).join("\t")];
        datos.anios.forEach(function (a) {
          filas.push([a].concat(datos.matriz[a].map(function (v) { return v === null ? "" : v; })).join("\t"));
        });
        if (navigator.clipboard) {
          navigator.clipboard.writeText(filas.join("\n"))
            .then(function () { avisar("Datos copiados. Pégalos en Excel.", "success"); })
            .catch(function () { avisar("Tu navegador no permitió copiar.", "error"); });
        }
        break;
      }
      case "pantalla-completa":
        if (document.fullscreenElement) document.exitFullscreen();
        else if (raiz.requestFullscreen) raiz.requestFullscreen();
        break;
      case "ver-analisis": ocultarAnalisis = !ocultarAnalisis; redibujar(false); break;
      case "ver-datos": ocultarTabla = !ocultarTabla; redibujar(false); break;
      default: break;
    }
  }

  function activarPestana(nombre) {
    raiz.querySelectorAll(".vm-pestana").forEach(function (b) {
      b.setAttribute("aria-selected", b.dataset.pestana === nombre ? "true" : "false");
    });
    raiz.querySelectorAll(".vm-pagina").forEach(function (p) { p.hidden = p.dataset.pagina !== nombre; });
  }

  function abrirSeccion(id) {
    const cuerpo = raiz.querySelector("#vmSec" + id);
    if (!cuerpo) return;
    cuerpo.hidden = false;
    const boton = cuerpo.parentElement.querySelector(".vm-seccion-boton");
    if (boton) boton.setAttribute("aria-expanded", "true");
  }

  function conectarEventos() {
    raiz.addEventListener("input", alCambiarControl);
    raiz.addEventListener("change", alCambiarControl);

    raiz.addEventListener("click", function (e) {
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

      const item = t.closest("[data-accion]");
      if (item) { cerrarMenus(); ejecutarAccion(item.dataset.accion); return; }

      const tema = t.closest("[data-tema]");
      if (tema) {
        cerrarMenus();
        estado.tema = tema.dataset.tema;
        sincronizarControles();
        redibujar(false);
        return;
      }

      const pestana = t.closest(".vm-pestana");
      if (pestana) { activarPestana(pestana.dataset.pestana); return; }

      const sec = t.closest(".vm-seccion-boton[aria-controls]");
      if (sec) {
        const abierta = sec.getAttribute("aria-expanded") === "true";
        sec.setAttribute("aria-expanded", abierta ? "false" : "true");
        raiz.querySelector("#" + sec.getAttribute("aria-controls")).hidden = abierta;
        return;
      }

      if (!t.closest(".vm-menu")) cerrarMenus();
    });

    // Esc cierra primero el menú abierto y, si no hay, la ventana
    document.addEventListener("keydown", function (e) {
      if (!raiz || raiz.hidden || e.key !== "Escape") return;
      if (document.fullscreenElement) return;
      e.preventDefault();
      if (hayMenuAbierto()) cerrarMenus(); else cerrarVentasMes();
    });
  }

  /* ======================================================================
     ABRIR / CERRAR (lo único que usa script.js)
     ====================================================================== */

  function abrirVentasMes() {
    if (typeof Chart === "undefined") {
      avisar("No se pudo cargar la librería de gráficos (revisa tu internet).", "error");
      return false;
    }
    if (!raiz) {
      raiz = construirVentana();
      conectarEventos();
    }
    elementoAnterior = document.activeElement;
    datos = calcularDatos();
    sincronizarControles();
    raiz.hidden = false;
    document.documentElement.classList.add("vm-abierta");
    // La app queda inerte detrás para que el teclado no se "escape" de la ventana
    const app = document.querySelector(".app");
    if (app) app.inert = true;
    raiz.querySelector(".vm-cerrar").focus({ preventScroll: true });
    redibujar(true);
    return true;
  }

  function cerrarVentasMes() {
    if (!raiz) return;
    if (document.fullscreenElement) document.exitFullscreen();
    cerrarMenus();
    raiz.hidden = true;
    document.documentElement.classList.remove("vm-abierta");
    const app = document.querySelector(".app");
    if (app) app.inert = false;
    if (grafico) { grafico.destroy(); grafico = null; }
    if (elementoAnterior && elementoAnterior.focus) elementoAnterior.focus({ preventScroll: true });
  }

  window.abrirVentasMes = abrirVentasMes;
  window.cerrarVentasMes = cerrarVentasMes;
})();
