/* ==========================================================================
   mis-graficos.js — «Mis gráficos» en versión simple (versión 1 aprobada)
   --------------------------------------------------------------------------
   · Debajo de cada círculo: un título corto («Ventas y pagos», «Cambio de mis
     meses» y «Agosto: puesto 5 de 5») y su veredicto.
   · Dentro de cada ventana, la «Conclusión» pasa a ser una tarjeta con el
     veredicto, pocos datos precisos y una gráfica simple (en vez del texto largo).
   Todo sale de analitica.js, con los mismos Excel cargados. Solo lectura.
   ========================================================================== */
(function () {
  "use strict";

  const A = () => window.Analitica;
  const VERDE = "#639922", AMBAR = "#EF9F27", ROJO = "#E24B4A", GRIS = "#B4B2A9", VERDE_S = "#9CC26A";
  const T_BIEN = "#3B6D11", T_REG = "#9A6206", T_MAL = "#A32D2D";

  function esc(t) { return String(t === null || t === undefined ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function num(v, d) { return Number(v || 0).toLocaleString("es-PE", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function soles(v) { return (v < 0 ? "−S/ " : "S/ ") + num(Math.abs(v)); }
  function mil(v) { const a = Math.abs(v); return (v < 0 ? "−" : "") + "S/ " + (a >= 1e6 ? num(a / 1e6, 2) + " mill." : a >= 1e3 ? num(a / 1e3) + " mil" : num(a)); }
  function suma(v) { return v.reduce((s, x) => s + x, 0); }
  function media(v) { return v.length ? suma(v) / v.length : 0; }
  function mediana(v) { if (!v.length) return 0; const o = v.slice().sort((a, b) => a - b), m = Math.floor(o.length / 2); return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2; }
  function cv(v) { if (v.length < 2) return null; const m = media(v); if (!(m > 0)) return null; const s = Math.sqrt(suma(v.map(x => (x - m) * (x - m))) / (v.length - 1)); return (s / m) * 100; }
  const MES = m => A().MESES_TITULO[m];

  function anioDe(raiz, idSelect) {
    const sel = raiz && idSelect ? raiz.querySelector("#" + idSelect) : null;
    const v = sel ? Number(sel.value) : NaN;
    if (v > 1900) return v;
    const mes = typeof mesActual === "number" ? mesActual : new Date().getMonth();
    return A().anioParaMes(mes);
  }
  function rango(meses, anio) {
    if (!meses.length) return String(anio);
    const a = MES(meses[0]), b = MES(meses[meses.length - 1]);
    return a === b ? a + " " + anio : a.toLowerCase() + " – " + b.toLowerCase();
  }

  // Piezas de la tarjeta
  function tarjeta(sub, veredicto, color, filas, grafica) {
    return '<div class="mg-tarjeta">' +
      '<p class="mg-sub">' + esc(sub) + "</p>" +
      '<p class="mg-veredicto" style="color:' + color + '">' + esc(veredicto) + "</p>" +
      '<dl class="mg-filas">' + filas.map(f => "<div><dt>" + esc(f[0]) + '</dt><dd style="' + (f[2] ? "color:" + f[2] : "") + '">' + esc(f[1]) + "</dd></div>").join("") + "</dl>" +
      (grafica || "") + "</div>";
  }
  function barrasH(lista) {   // [{nombre, w, color}]
    return '<div class="mg-barras">' + lista.map(b => '<div class="mg-barra"><span>' + esc(b.nombre) + '</span><i style="width:' + Math.max(2, Math.min(100, b.w)).toFixed(1) + "%;background-color:" + b.color + '"></i></div>').join("") + "</div>";
  }

  /* ---------------- 1. Ventas y pagos ---------------- */
  function datosVentasPagos(anio) {
    const an = A();
    const ing = an.ingresosDelAnio(anio).filter(m => m.valor > 0);
    const egr = an.egresosDelAnio(anio).filter(m => m.valor > 0);
    const v = ing.map(m => m.valor), p = egr.map(m => m.valor);
    const c = cv(v);
    const nivel = c === null ? null : c < 15 ? ["Muy parejas", T_BIEN] : c < 30 ? ["Parejas", T_BIEN] : c < 50 ? ["Algo desiguales", T_REG] : ["Muy desiguales", T_MAL];
    return { ing, egr, v, p, c, nivel, meses: Array.from(new Set(ing.map(m => m.mes))).sort((a, b) => a - b) };
  }
  function htmlVentasPagos(anio) {
    const d = datosVentasPagos(anio);
    if (d.v.length < 2) return tarjeta(anio + "", "Sin datos suficientes", "#8A7A70", [["Ventas registradas", num(d.v.length)]]);
    const prom = media(d.v), tip = mediana(d.v), pago = media(d.p);
    const menores = d.v.filter(x => x < 5000).length;
    const orden = d.v.slice().sort((a, b) => b - a);
    const top10 = (suma(orden.slice(0, 10)) / suma(d.v)) * 100;
    const tope = Math.max(prom, tip, pago) || 1;
    return tarjeta(num(d.v.length) + " ventas · " + rango(d.meses, anio), d.nivel[0], d.nivel[1], [
      ["Venta promedio", soles(prom)],
      ["Venta típica (la mitad vende menos)", soles(tip)],
      ["Ventas menores a S/ 5,000", Math.round((menores / d.v.length) * 10) + " de cada 10"],
      ["Las " + Math.min(10, d.v.length) + " ventas más grandes", Math.round(top10) + "% del total"],
      ["Pago promedio", d.p.length ? soles(pago) : "—"],
    ], barrasH([
      { nombre: "Venta promedio", w: (prom / tope) * 100, color: VERDE },
      { nombre: "Venta típica", w: (tip / tope) * 100, color: VERDE_S },
      { nombre: "Pago promedio", w: (pago / tope) * 100, color: AMBAR },
    ]));
  }

  /* ---------------- 2. Cambio de mis meses ---------------- */
  function datosCambio(anio) {
    const meses = A().resumenAnio(anio).meses.filter(x => x.hayIng && !x.incompleto);
    const c = cv(meses.map(x => x.ingresos));
    const nivel = c === null ? null : c < 25 ? ["Meses estables", T_BIEN] : c < 50 ? ["Meses variables", T_REG] : ["Meses muy variables", T_MAL];
    return { meses, c, nivel };
  }
  function htmlCambio(anio) {
    const d = datosCambio(anio);
    if (d.meses.length < 2) return tarjeta(anio + "", "Sin datos suficientes", "#8A7A70", [["Meses completos con ventas", num(d.meses.length)]]);
    const conGasto = d.meses.filter(x => x.hayEgr);
    const mejor = d.meses.reduce((a, b) => (b.ingresos > a.ingresos ? b : a));
    const bajo = d.meses.reduce((a, b) => (b.ingresos < a.ingresos ? b : a));
    const ambos = d.meses.filter(x => x.hayEgr);
    const tope = Math.max.apply(null, d.meses.map(x => Math.max(x.ingresos, x.hayEgr ? x.egresos : 0))) || 1;
    const graf = '<div class="mg-columnas">' + d.meses.map(x =>
      '<div class="mg-col"><div class="mg-col-b"><i style="height:' + ((x.ingresos / tope) * 100).toFixed(1) + "%;background-color:" + VERDE + '" title="Ventas ' + esc(soles(x.ingresos)) + '"></i>' +
      '<i style="height:' + ((x.hayEgr ? x.egresos / tope : 0) * 100).toFixed(1) + "%;background-color:" + AMBAR + '" title="Gastos ' + esc(x.hayEgr ? soles(x.egresos) : "—") + '"></i></div><span>' + esc(A().MESES_CORTOS[x.mes]) + "</span></div>").join("") + "</div>";
    return tarjeta("Meses completos · " + rango(d.meses.map(x => x.mes), anio), d.nivel[0], d.nivel[1], [
      ["Ventas promedio al mes", mil(media(d.meses.map(x => x.ingresos)))],
      ["Gastos promedio al mes", conGasto.length ? mil(media(conGasto.map(x => x.egresos))) : "—"],
      ["Mejor mes de ventas", MES(mejor.mes) + " · " + mil(mejor.ingresos)],
      ["Mes más bajo de ventas", MES(bajo.mes) + " · " + mil(bajo.ingresos)],
      ["Meses con ganancia", ambos.filter(x => x.resultado >= 0).length + " de " + ambos.length],
    ], graf);
  }

  /* ---------------- 3. Puesto del mes (sigue el botón «Ingresos / Egresos / Ambos» de la ventana) ---------------- */
  const CAMPOS = {
    ingresos: { hay: x => x.hayIng, valor: x => x.ingresos, verbo: "vendió", cosa: "Ventas", sufijo: "",
      nivel: (p, n, v, prom) => (n === 1 ? ["Tu único mes con ventas", T_REG] : p === 1 ? ["Tu mejor mes", T_BIEN] : p === n ? ["Tu mes más flojo", T_MAL] : v >= prom ? ["Sobre tu promedio", T_BIEN] : ["Bajo tu promedio", T_REG]),
      mejor: "tu mejor mes" },
    egresos: { hay: x => x.hayEgr, valor: x => x.egresos, verbo: "gastó", cosa: "Gastos", sufijo: " en gastos",
      nivel: (p, n, v, prom) => (n === 1 ? ["Tu único mes con gastos", T_REG] : p === 1 ? ["Tu mes de más gasto", T_MAL] : p === n ? ["Tu mes de menos gasto", T_BIEN] : v >= prom ? ["Gasto sobre tu promedio", T_REG] : ["Gasto bajo tu promedio", T_BIEN]),
      mejor: "tu mes de menos gasto", mejorEsUltimo: true },
    ambos: { hay: x => x.hayIng && x.hayEgr, valor: x => x.resultado, verbo: "dejó", cosa: "Resultado", sufijo: " en resultado",
      nivel: (p, n, v, prom) => (n === 1 ? ["Tu único mes completo", T_REG] : p === 1 ? ["Tu mejor resultado", T_BIEN] : p === n ? ["Tu peor resultado", T_MAL] : v >= prom ? ["Sobre tu promedio", T_BIEN] : ["Bajo tu promedio", T_REG]),
      mejor: "tu mejor mes" },
  };
  function datosPuesto(anio, mes, tipo) {
    const k = CAMPOS[tipo] || CAMPOS.ingresos;
    const todos = A().resumenAnio(anio).meses;
    const con = todos.filter(k.hay);
    const r = todos[mes];
    if (!r || !k.hay(r)) return { sin: true, anio, mes, con, k };
    const orden = con.slice().sort((a, b) => k.valor(b) - k.valor(a));
    const puesto = orden.findIndex(x => x.mes === mes) + 1;
    const otros = con.filter(x => x.mes !== mes);
    const prom = otros.length ? media(otros.map(k.valor)) : null;
    return { anio, mes, r, orden, puesto, otros, prom, k, nivel: k.nivel(puesto, orden.length, k.valor(r), prom), ant: mes > 0 ? todos[mes - 1] : null };
  }
  function tituloPuesto(anio, mes, tipo) {
    const d = datosPuesto(anio, mes, tipo);
    return MES(mes) + ": " + (d.sin ? "sin " + (tipo === "egresos" ? "gastos" : tipo === "ambos" ? "datos completos" : "ventas") : "puesto " + d.puesto + " de " + d.orden.length + d.k.sufijo);
  }
  function htmlPuesto(anio, mes, tipo) {
    const d = datosPuesto(anio, mes, tipo), k = d.k;
    if (d.sin) return tarjeta(k.cosa + " · " + MES(mes).toLowerCase() + " " + anio, "Sin datos este mes", "#8A7A70", [["Meses con datos en " + anio, num(d.con.length)]]);
    const v = k.valor(d.r);
    const filas = [[MES(mes) + " " + k.verbo, mil(v), d.nivel[1] === T_MAL ? T_MAL : ""]];
    if (d.prom !== null) filas.push(["Promedio de los otros " + d.otros.length + (d.otros.length === 1 ? " mes" : " meses"), mil(d.prom)]);
    if (d.ant && k.hay(d.ant)) { const dif = v - k.valor(d.ant); filas.push([MES(mes) + " vs " + MES(d.ant.mes).toLowerCase(), (dif >= 0 ? "+" : "") + mil(dif)]); }
    const ref = k.mejorEsUltimo ? d.orden[d.orden.length - 1] : d.orden[0];
    if (ref.mes !== mes) { const dif = v - k.valor(ref); filas.push([MES(mes) + " vs " + k.mejor + " (" + MES(ref.mes).toLowerCase() + ")", (dif >= 0 ? "+" : "") + mil(dif)]); }
    const tope = Math.max.apply(null, d.orden.map(x => Math.abs(k.valor(x)))) || 1;
    const colorYo = d.nivel[1] === T_BIEN ? VERDE : d.nivel[1] === T_MAL ? ROJO : AMBAR;
    const graf = '<div class="mg-ranking">' + d.orden.map(x => {
      const yo = x.mes === mes, val = k.valor(x);
      return '<div class="mg-rk' + (yo ? " mg-rk-yo" : "") + '"><span>' + esc(A().MESES_CORTOS[x.mes]) + '</span><i style="width:' + ((Math.abs(val) / tope) * 100).toFixed(1) + "%;background-color:" + (yo ? colorYo : val < 0 ? "#E9A19F" : GRIS) + '"></i><em>' + esc(mil(val).replace("S/ ", "")) + "</em></div>";
    }).join("") + "</div>";
    return tarjeta(k.cosa + " · " + MES(mes).toLowerCase() + " " + anio, d.nivel[0], d.nivel[1], filas, graf);
  }

  /* ---------------- Conclusión de cada ventana (la usa simple.js) ---------------- */
  function conclusion(raiz) {
    if (!A() || !raiz) return "";
    try {
      const mes = typeof mesActual === "number" ? mesActual : new Date().getMonth();
      if (raiz.querySelector("#pjEsencial")) return htmlVentasPagos(anioDe(raiz, "pjAnio"));
      if (raiz.querySelector("#esEsencial")) return htmlCambio(anioDe(raiz, "esAnio"));
      if (raiz.querySelector("#psEsencial")) {
        const anio = anioDe(raiz, "psAnio");
        const b = raiz.querySelector('.pj-tipo[aria-pressed="true"]');
        const tipo = b ? b.dataset.tipo : "ingresos";
        const marca = raiz.querySelector(".vm-marca span");
        if (marca) marca.textContent = tituloPuesto(anio, mes, tipo);
        return htmlPuesto(anio, mes, tipo);
      }
    } catch (e) { console.warn("[mis gráficos]", e); }
    return "";
  }

  /* ---------------- Títulos cortos debajo de cada círculo ---------------- */
  function actualizar() {
    if (!A()) return;
    try {
      const mes = typeof mesActual === "number" ? mesActual : new Date().getMonth();
      const anio = A().anioParaMes(mes);
      const poner = (id, texto) => { const el = document.getElementById(id); if (el) el.textContent = texto; };
      poner("cpVentasMesTitulo", "Ventas y pagos");
      poner("cpFormaPagoTitulo", "Cambio de mis meses");
      poner("cpTopDeudorTitulo", tituloPuesto(anio, mes, "ingresos"));
      const vp = datosVentasPagos(anio), cm = datosCambio(anio), ps = datosPuesto(anio, mes, "ingresos");
      poner("cpVentasMesValor", vp.nivel ? vp.nivel[0] : "Sin datos");
      poner("cpFormaPagoValor", cm.nivel ? cm.nivel[0] : "Sin datos");
      poner("cpTopDeudorValor", ps.sin ? "Sin ventas" : ps.nivel[0]);
    } catch (e) { console.warn("[mis gráficos] títulos:", e); }
  }

  window.MisGraficos = { conclusion, actualizar, tituloPuesto };
  // Al abrir la página (aunque todavía no haya datos) los títulos ya quedan puestos
  actualizar();
})();
