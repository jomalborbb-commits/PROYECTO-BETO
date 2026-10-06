/* ==========================================================================
   informes.js — Informe general e informe detallado (Word y PDF), vista previa y correo
   --------------------------------------------------------------------------
   Desde «Informes y correo» (menú lateral o botón de la cabecera):
     · Eliges los meses (de uno o de varios años) para cualquiera de los dos informes.
     · CADA MES VA POR SEPARADO, en su propia sección, sin mezclar sus cifras
       con las de otros meses.
     · Al final va la COMPARACIÓN: si elegiste varios meses, cómo se comparan
       entre sí; si elegiste uno solo, cómo se compara ese mes con los demás
       meses del año.
     · INFORME GENERAL: por cada mes, lo esencial (veredicto, cifras clave, un
       gráfico, lo más importante y qué hacer) y una comparación corta.
     · INFORME DETALLADO: por cada mes, 6 pasos siempre en el mismo orden
       (resultado, gastos, punto de equilibrio, clientes, ladrillos y
       conclusión), una comparación completa y las comprobaciones de sumas.
     · «Vista previa» muestra el informe tal como saldrá, antes de descargarlo.

   PRECISIÓN: todas las cifras salen de analitica.js, con las mismas fórmulas
   del panel y de las ventanas. Se comprueba que la suma de los meses, de los
   clientes, de los tipos de gasto y de los ladrillos por código coincida con
   los totales. Si los datos están cargados más de una vez (duplicados.js) el
   informe no se descarga hasta corregirlo. Es de SOLO LECTURA sobre tus datos.
   ========================================================================== */
(function () {
  "use strict";

  const A = () => window.Analitica;
  const DOCX_URL = "https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js";
  const PDFMAKE_URL = "https://cdn.jsdelivr.net/npm/pdfmake@0.2.10/build/pdfmake.min.js";
  const PDFFONTS_URL = "https://cdn.jsdelivr.net/npm/pdfmake@0.2.10/build/vfs_fonts.js";
  const CLAVE_CORREO = "informe_destinatario_v1";
  const EMPRESA = "CRF & LADRILLOS S.A.C.";

  // Colores del informe
  const C = { marca: "A9573F", tinta: "2B211C", suave: "6A5A50", linea: "E5D8CB", crema: "FAF4EC", bueno: "16A34A", regular: "B45309", malo: "B91C1C", ing: "16A34A", egr: "F97316" };
  const NIVEL = { bueno: { color: C.bueno, texto: "Bien" }, regular: { color: C.regular, texto: "Ojo" }, malo: { color: C.malo, texto: "Mal" } };

  // tipo: "general" | "detallado"; meses: meses elegidos (claves "año-mes"), los mismos para los dos informes
  const estado = { tipo: "general", meses: null };

  /* ======================================================================
     UTILIDADES
     ====================================================================== */
  function num(v, d) { return Number(v || 0).toLocaleString("es-PE", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function s0(v) { return v === null || v === undefined || isNaN(v) ? "—" : (v < 0 ? "−S/ " : "S/ ") + num(Math.abs(v)); }
  function s2(v) { return v === null || v === undefined || isNaN(v) ? "—" : (v < 0 ? "−S/ " : "S/ ") + num(Math.abs(v), 2); }
  function sU(v) { return v === null || v === undefined || isNaN(v) ? "—" : "S/ " + num(v, 3); }
  function pc(v, d) { return v === null || v === undefined || isNaN(v) ? "—" : (v < 0 && Math.abs(v) >= 0.5 * Math.pow(10, -(d || 0)) ? "−" : "") + num(Math.abs(v), d === undefined ? 0 : d) + "%"; }
  function conSigno(v, f) { return v === null || v === undefined || isNaN(v) ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + f(Math.abs(v)); }
  // Montos en palabras cortas para los gráficos: «S/ 300.9 mil», «S/ 1.42 millones»
  function mil(v) {
    if (v === null || v === undefined || isNaN(v)) return "";
    const a = Math.abs(v), s = v < 0 ? "−" : "";
    if (a >= 1e6) return s + "S/ " + num(a / 1e6, 2) + " millones";
    if (a >= 1e3) return s + "S/ " + num(a / 1e3, a >= 1e5 ? 0 : 1) + " mil";
    return s + "S/ " + num(a);
  }
  function lad(v) {
    const a = Math.abs(v || 0);
    if (a >= 1e6) return num(a / 1e6, 2) + " mill.";
    if (a >= 1e3) return num(a / 1e3, a >= 1e5 ? 0 : 1) + " mil";
    return num(a);
  }
  function titulo(t) { return String(t || "").toLowerCase().replace(/(^|\s)\S/g, s => s.toUpperCase()); }
  function sinTildes(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function esc(t) { return String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function hoy() { const f = new Date(); return String(f.getDate()).padStart(2, "0") + "/" + String(f.getMonth() + 1).padStart(2, "0") + "/" + f.getFullYear(); }
  function fechaTxt(f) { return f ? f.slice(8, 10) + "/" + f.slice(5, 7) + "/" + f.slice(0, 4) : "—"; }
  function aviso(m, t) { if (typeof mostrarToast === "function") mostrarToast(m, t || "info"); }
  function nombreUsuario() { const c = document.getElementById("inputAutorSesion"); return c ? c.value.trim() : ""; }
  function unir(xs) { return xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " y " + xs[xs.length - 1]; }
  function suma(xs, f) { return xs.reduce((s, x) => s + (f ? f(x) : x), 0); }
  function media(v) { return v.reduce((s, x) => s + x, 0) / v.length; }
  function desvio(v) { if (v.length < 2) return null; const m = media(v); return Math.sqrt(v.reduce((s, x) => s + (x - m) * (x - m), 0) / (v.length - 1)); }
  function variacion(a, b) { return b > 0 ? ((a - b) / b) * 100 : null; }
  const clave = (anio, mes) => anio + "-" + mes;
  // Un código vacío o solo con rayas cuenta como «Sin código» (igual que en el panel)
  function codigo(c) { const t = String(c || "").trim(); return !t || /^[-–—.\s]+$/.test(t) ? "Sin código" : t; }

  /* ======================================================================
     PERÍODOS: meses con datos y meses elegidos
     ====================================================================== */
  function disponibles() {
    const an = A();
    const mapa = new Map();
    an.aniosDisponibles().forEach(anio => {
      const ms = an.resumenAnio(anio).meses.filter(r => r.hayDatos).map(r => r.mes);
      if (ms.length) mapa.set(anio, ms);
    });
    return mapa;   // año → meses con datos (en orden)
  }

  function seleccion() {
    const out = [];
    disponibles().forEach((ms, anio) => ms.forEach(m => { if (estado.meses && estado.meses.has(clave(anio, m))) out.push({ anio, mes: m }); }));
    return out.sort((a, b) => a.anio - b.anio || a.mes - b.mes);
  }

  // «Abril 2026», «Abril a julio 2026», «Abril, junio y agosto 2026», «Año 2026 (abril a agosto)»
  function etiquetaPeriodo(sel, disp) {
    const an = A();
    const porAnio = new Map();
    sel.forEach(s => { if (!porAnio.has(s.anio)) porAnio.set(s.anio, []); porAnio.get(s.anio).push(s.mes); });
    const partes = [];
    porAnio.forEach((ms, anio) => {
      ms.sort((a, b) => a - b);
      const T = m => an.MESES_TITULO[m];
      const seguidos = ms.every((m, i) => i === 0 || m === ms[i - 1] + 1);
      let txt;
      if (ms.length === 1) txt = T(ms[0]);
      else if (seguidos) txt = T(ms[0]) + " a " + T(ms[ms.length - 1]).toLowerCase();
      else txt = ms.map((m, i) => (i === 0 ? T(m) : T(m).toLowerCase())).join(", ").replace(/, ([^,]+)$/, " y $1");
      const todos = disp && disp.get(anio) && disp.get(anio).length === ms.length && ms.length > 1;
      partes.push(todos ? "Año " + anio + " (" + txt.charAt(0).toLowerCase() + txt.slice(1) + ")" : txt + " " + anio);
    });
    return partes.join(" · ");
  }

  /* ======================================================================
     DATOS DE UN MES (cada mes se calcula solo, sin mezclarlo con otros)
     ====================================================================== */
  function productosDe(ing) {
    const mapa = {};
    ing.forEach(m => {
      const k = codigo(m.codigo);
      if (!mapa[k]) mapa[k] = { codigo: k, unidades: 0, monto: 0, n: 0, precios: [] };
      const x = mapa[k];
      x.unidades += m.unidades; x.monto += m.valor; x.n += 1;
      const pu = m.precio > 0 ? m.precio : (m.unidades > 0 ? m.valor / m.unidades : 0);
      if (pu > 0) x.precios.push(pu);
    });
    const lista = Object.keys(mapa).map(k => mapa[k]).sort((a, b) => b.unidades - a.unidades || b.monto - a.monto).map(x => ({
      codigo: x.codigo, unidades: x.unidades, monto: x.monto, n: x.n,
      promedio: x.unidades > 0 ? x.monto / x.unidades : null,   // igual que en el panel: ingresos del código ÷ sus ladrillos
      min: x.precios.length ? Math.min.apply(null, x.precios) : null,
      max: x.precios.length ? Math.max.apply(null, x.precios) : null,
    }));
    const total = suma(lista, x => x.unidades);
    lista.forEach(x => { x.pct = total > 0 ? (x.unidades / total) * 100 : 0; });
    return { lista, totalUnidades: total };
  }

  function datosMes(anio, mes, varios) {
    const an = A();
    const r = an.resumenMes(anio, mes);
    const pe = an.puntoEquilibrio(anio);
    const eq = an.equilibrioDelMes(anio, mes, pe);
    const salud = an.saludDelMes(anio, mes);
    const ant = mes > 0 ? an.resumenMes(anio, mes - 1) : an.resumenMes(anio - 1, 11);
    const ing = an.ingresosDelAnio(anio).filter(m => m.mes === mes);
    const egr = an.egresosDelAnio(anio).filter(m => m.mes === mes);
    const prods = productosDe(ing);
    // Mes anterior (siempre el mes calendario anterior, se haya elegido o no): con sus propias listas
    const antAnio = mes > 0 ? anio : anio - 1, antMes = mes > 0 ? mes - 1 : 11;
    const antIng = an.ingresosDelAnio(antAnio).filter(m => m.mes === antMes);
    const antEgr = an.egresosDelAnio(antAnio).filter(m => m.mes === antMes);
    return {
      anio, mes, r, pe, eq, ing, egr,
      nombre: an.MESES_TITULO[mes] + " " + anio,
      corto: an.MESES_CORTOS[mes] + (varios ? " " + String(anio).slice(2) : ""),
      veredicto: { texto: salud.texto, frase: salud.frase, color: salud.color },
      razones: (salud.razones || []).map(x => ({ nombre: x.nombre, nivel: x.nivel, valor: x.valor, frase: x.frase, clave: x.clave })),
      ant: ant.hayDatos ? { nombre: an.MESES_TITULO[antMes] + (antAnio !== anio ? " " + antAnio : ""), completo: an.MESES_TITULO[antMes] + " " + antAnio, r: ant, cl: an.clientesDeLista(antIng), plata: an.gastosDeLista(antEgr) } : null,
      antNombre: an.MESES_TITULO[antMes] + " " + antAnio,
      plata: an.gastosDeLista(egr),
      cl: an.clientesDeLista(ing),
      productos: prods.lista, totalUnidades: prods.totalUnidades,
    };
  }

  // Qué hacer, solo con las cifras de ESE mes
  function recomendacionesMes(dm) {
    const rec = [];
    const g = k => dm.razones.find(x => x.clave === k);
    const r = dm.r;
    if (!r.hayDatos) return ["Registra los ingresos y egresos del mes para poder analizarlo."];
    if (!(r.hayIng && r.hayEgr)) rec.push("Falta registrar los " + (r.hayIng ? "egresos" : "ingresos") + " de " + dm.nombre.toLowerCase() + ": sin ellos no se puede saber si se ganó o se perdió.");
    const m = g("margen");
    const mayor = dm.plata.categorias[0];
    if (m && m.nivel === "malo") rec.push("Se gastó más de lo que se vendió. Revisa primero el gasto más grande" + (mayor ? " (" + mayor.nombre.toLowerCase() + ": " + s0(mayor.total) + ", el " + pc(mayor.pct, 1) + " de los egresos)" : "") + " y los precios de venta.");
    else if (m && m.nivel === "regular") rec.push("El margen fue bajo (" + m.valor + "): busca bajar gastos fijos o mejorar precios.");
    const v = g("ventas");
    if (v && v.nivel === "malo") rec.push("Las ventas bajaron frente al mes anterior (" + v.valor + "): llama a tus clientes principales y revisa quiénes dejaron de comprar.");
    const ga = g("gastos");
    if (ga && ga.nivel === "malo") rec.push("Los gastos subieron frente al mes anterior (" + ga.valor + "): revisa los pagos más grandes antes de repetirlos.");
    if (dm.eq.disponible && !dm.eq.alcanzado && !r.incompleto) rec.push("Para no perder faltaron ≈ " + num(Math.ceil(dm.eq.faltaLadrillos)) + " ladrillos (≈ " + s0(dm.eq.faltaVentas) + " en ventas).");
    const c = g("clientes");
    if (c && c.nivel !== "bueno") rec.push("Las ventas dependen de pocos clientes (" + c.valor + " en los 5 mejores): busca nuevos compradores.");
    if (r.incompleto) rec.push("Este mes todavía está en curso: vuelve a sacar el informe cuando termines de registrarlo.");
    if (!rec.length) rec.push("Mes sano: mantén el ritmo y sigue registrando cada venta y cada pago.");
    return rec.slice(0, 5);
  }

  /* ======================================================================
     COMPARACIÓN (lo único que junta meses, y solo para compararlos)
     ====================================================================== */
  function estabilidadDe(valores) {
    if (valores.length < 2) return { n: valores.length };
    const m = media(valores), s = desvio(valores);
    return { n: valores.length, media: m, s, cv: m ? (s / m) * 100 : null, res: valores.length >= 3 ? A().resumenPosicion(valores, "curso") : null };
  }

  function datosComparacion(sel, meses, varios) {
    const an = A();
    if (sel.length === 1) {
      // Un mes: se compara con los demás meses con datos de su año
      const { anio, mes } = sel[0];
      const filas = an.resumenAnio(anio).meses.filter(x => x.hayDatos);
      const otros = filas.filter(x => x.mes !== mes);
      const promedio = campo => (otros.length ? media(otros.map(x => x[campo])) : null);
      const completos = filas.filter(x => x.hayIng && x.hayEgr && !x.incompleto);
      const puesto = (lista, campo, mayorEsPrimero) => {
        const orden = lista.slice().sort((a, b) => (mayorEsPrimero ? b[campo] - a[campo] : a[campo] - b[campo]));
        return { puesto: orden.findIndex(x => x.mes === mes) + 1, de: orden.length };
      };
      const conIng = filas.filter(x => x.hayIng), conEgr = filas.filter(x => x.hayEgr), conAmbos = filas.filter(x => x.hayIng && x.hayEgr);
      return {
        modo: "uno", anio, mes, filas, otros,
        prom: { ingresos: promedio("ingresos"), egresos: promedio("egresos"), resultado: otros.filter(x => x.hayIng && x.hayEgr).length ? media(otros.filter(x => x.hayIng && x.hayEgr).map(x => x.resultado)) : null, unidades: promedio("unidades") },
        puestos: {
          ingresos: conIng.some(x => x.mes === mes) ? puesto(conIng, "ingresos", true) : null,
          egresos: conEgr.some(x => x.mes === mes) ? puesto(conEgr, "egresos", false) : null,
          resultado: conAmbos.some(x => x.mes === mes) ? puesto(conAmbos, "resultado", true) : null,
        },
        pos: { ingresos: an.posicionDelMes("ingresos", anio, mes), egresos: an.posicionDelMes("egresos", anio, mes), resultado: an.posicionDelMes("resultado", anio, mes) },
        completos,
      };
    }
    // Varios meses: todos contra todos
    const filas = meses.map(dm => dm.r);
    const ing = [].concat.apply([], meses.map(dm => dm.ing));
    const egr = [].concat.apply([], meses.map(dm => dm.egr));
    const total = an.resumenDe(ing, egr);
    const n = meses.length;
    const completos = meses.filter(dm => dm.r.hayIng && dm.r.hayEgr && !dm.r.incompleto);
    const mayor = (lista, f) => lista.reduce((a, b) => (f(b) > f(a) ? b : a));
    const menor = (lista, f) => lista.reduce((a, b) => (f(b) < f(a) ? b : a));
    const conIng = meses.filter(dm => dm.r.hayIng && !dm.r.incompletoIng);
    const conEgr = meses.filter(dm => dm.r.hayEgr && !dm.r.incompletoEgr);
    // Clientes que compraron en todos los meses elegidos con ventas
    const conVentas = meses.filter(dm => dm.r.hayIng);
    const cl = an.clientesDeLista(ing);
    const periodosVentas = conVentas.map(dm => dm.anio * 12 + dm.mes);
    const fieles = periodosVentas.length >= 2 ? cl.clientes.filter(c => periodosVentas.every(p => c.periodos.has(p))) : [];
    let dejaron = { ventana: [], lista: [] };
    if (periodosVentas.length >= 3) {
      const ventana = periodosVentas.slice(-2);
      dejaron = { ventana: conVentas.slice(-2).map(dm => dm.nombre), lista: cl.clientes.filter(c => !ventana.some(p => c.periodos.has(p))) };
    }
    return {
      modo: "varios", filas, total, n, completos, fieles, dejaron, cl,
      mejor: completos.length ? mayor(completos, dm => dm.r.resultado) : null,
      peor: completos.length ? menor(completos, dm => dm.r.resultado) : null,
      masVentas: conIng.length ? mayor(conIng, dm => dm.r.ingresos) : null,
      menosVentas: conIng.length ? menor(conIng, dm => dm.r.ingresos) : null,
      masGastos: conEgr.length ? mayor(conEgr, dm => dm.r.egresos) : null,
      prom: { ingresos: total.ingresos / n, egresos: total.egresos / n, resultado: total.resultado / n, unidades: total.unidades / n },
      est: { ingresos: estabilidadDe(conIng.map(dm => dm.r.ingresos)), egresos: estabilidadDe(conEgr.map(dm => dm.r.egresos)) },
    };
  }

  function recomendacionesComparacion(d) {
    const cp = d.comp;
    const rec = [];
    if (cp.modo === "uno") {
      const dm = d.meses[0];
      if (!cp.otros.length) return ["Cuando haya más meses con datos en " + cp.anio + ", aquí verás cómo se compara " + dm.nombre.toLowerCase() + " con ellos."];
      if (dm.r.hayIng && cp.prom.ingresos) rec.push(dm.nombre + " vendió " + conSigno(variacion(dm.r.ingresos, cp.prom.ingresos), v => num(v, 1) + "%") + " frente al promedio de los demás meses (" + s0(cp.prom.ingresos) + ").");
      if (dm.r.hayIng && dm.r.hayEgr && cp.prom.resultado !== null) rec.push("Su resultado (" + s0(dm.r.resultado) + ") fue " + (dm.r.resultado >= cp.prom.resultado ? "mejor" : "peor") + " que el promedio de los demás meses (" + s0(cp.prom.resultado) + ").");
      if (cp.puestos.resultado) rec.push("Por resultado quedó en el puesto " + cp.puestos.resultado.puesto + " de " + cp.puestos.resultado.de + " meses (1 = el que más ganó).");
      if (dm.r.incompleto) rec.push("Ojo: el mes está en curso, así que la comparación todavía puede cambiar.");
      return rec;
    }
    const nom = dm => dm.nombre;
    if (cp.mejor) rec.push("El mejor mes fue " + nom(cp.mejor) + " (" + s0(cp.mejor.r.resultado) + ") y el peor, " + nom(cp.peor) + " (" + s0(cp.peor.r.resultado) + ").");
    const ganados = cp.completos.filter(dm => dm.r.resultado >= 0).length;
    if (cp.completos.length) rec.push(ganados + " de " + cp.completos.length + " meses completos cerraron con ganancia.");
    if (cp.est.ingresos.cv !== undefined && cp.est.ingresos.cv !== null) rec.push("Las ventas fueron " + palabraCv(cp.est.ingresos.cv) + " de un mes a otro (variación de " + pc(cp.est.ingresos.cv, 1) + ").");
    if (cp.masGastos && cp.masGastos !== cp.mejor) rec.push("El mes con más gastos fue " + nom(cp.masGastos) + " (" + s0(cp.masGastos.r.egresos) + "): revisa qué pagos lo subieron.");
    if (cp.dejaron.lista.length) rec.push(cp.dejaron.lista.length + " cliente(s) que compraban no aparecen en " + unir(cp.dejaron.ventana.map(x => x.toLowerCase())) + ": conviene contactarlos.");
    if (d.incompletos.length) rec.push(unir(d.incompletos) + (d.incompletos.length > 1 ? " están" : " está") + " en curso: sus cifras todavía pueden cambiar.");
    return rec;
  }

  function palabraCv(cv) { return cv === null || cv === undefined ? "" : cv < 10 ? "muy estables" : cv < 25 ? "estables" : cv <= 50 ? "variables" : "muy inestables"; }

  /* ======================================================================
     DATOS DEL INFORME (una sola vez; sirve para la vista previa, el Word, el PDF y el correo)
     ====================================================================== */
  function armarDatos(sel) {
    const an = A();
    if (!sel || !sel.length) return null;
    const disp = disponibles();
    const anios = Array.from(new Set(sel.map(s => s.anio)));
    const varios = anios.length > 1;
    const meses = sel.map(s => datosMes(s.anio, s.mes, varios));
    const comp = datosComparacion(sel, meses, varios);

    // Datos usados y comprobaciones (dos caminos de cálculo que deben dar lo mismo)
    const ing = [].concat.apply([], meses.map(dm => dm.ing));
    const egr = [].concat.apply([], meses.map(dm => dm.egr));
    const total = an.resumenDe(ing, egr);
    const fI = ing.map(m => m.fecha).sort(), fE = egr.map(m => m.fecha).sort();
    const sinU = ing.filter(m => !(m.unidades > 0));
    const comprobaciones = [
      { nombre: "Suma de los meses = total de ingresos", dif: Math.abs(suma(meses, dm => dm.r.ingresos) - total.ingresos) },
      { nombre: "Suma de los meses = total de egresos", dif: Math.abs(suma(meses, dm => dm.r.egresos) - total.egresos) },
      { nombre: "Suma de los clientes de cada mes = ingresos del mes", dif: suma(meses, dm => Math.abs(dm.cl.total - dm.r.ingresos)) },
      { nombre: "Suma de los tipos de gasto de cada mes = egresos del mes", dif: suma(meses, dm => Math.abs(dm.plata.total - dm.r.egresos)) },
      { nombre: "Suma de los ladrillos por código = ladrillos vendidos", dif: suma(meses, dm => Math.abs(dm.totalUnidades - dm.r.unidades)) },
    ];
    comprobaciones.forEach(c => { c.ok = c.dif < 0.005; });
    const incompletos = meses.filter(dm => dm.r.incompleto).map(dm => dm.nombre);

    return {
      an, sel, meses, comp, varios, anios, total,
      n: meses.length, unMes: meses.length === 1,
      periodo: etiquetaPeriodo(sel, disp),
      incompletos,
      calidad: {
        nIng: ing.length, nEgr: egr.length,
        ingDesde: fI[0], ingHasta: fI[fI.length - 1], egrDesde: fE[0], egrHasta: fE[fE.length - 1],
        sinUnidades: sinU.length, sinUnidadesTotal: suma(sinU, m => m.valor),
        repetidos: window.Duplicados ? window.Duplicados.estado() : null,
        comprobaciones,
      },
    };
  }

  /* ======================================================================
     ASUNTO Y MENSAJE DEL CORREO
     ====================================================================== */
  function asunto(d) { return (estado.tipo === "general" ? "Informe general" : "Informe detallado") + " – " + d.periodo + " – " + EMPRESA; }

  function mensaje(d) {
    const l = [];
    l.push("Estimado/a:", "");
    l.push("Les comparto el " + (estado.tipo === "general" ? "informe general" : "informe detallado") + " de " + EMPRESA.replace(/\.$/, "") + ".", "Período: " + d.periodo + (d.n > 1 ? " · " + d.n + " meses" : "") + ".", "");
    l.push("Resumen de cada mes:");
    d.meses.forEach(dm => {
      const r = dm.r;
      l.push("- " + dm.nombre + (r.incompleto ? " (en curso)" : "") + ": ingresos " + s2(r.hayIng ? r.ingresos : 0) + ", egresos " + s2(r.hayEgr ? r.egresos : 0) +
        (r.hayIng && r.hayEgr ? ", " + (r.resultado >= 0 ? "ganancia " : "pérdida ") + s2(Math.abs(r.resultado)) : "") + ". Situación: " + dm.veredicto.texto + ".");
    });
    l.push("", "Adjunto el informe completo.", "", "Saludos cordiales,");
    const nombre = nombreUsuario();
    if (nombre) l.push(nombre);
    return l.join("\n");
  }

  /* ======================================================================
     VENTANA: elección de meses, resumen rápido e insignia
     ====================================================================== */
  function pintarSelector() {
    const cont = document.getElementById("infPeriodoCaja");
    if (!cont) return;
    const an = A();
    const disp = disponibles();
    if (!disp.size) { cont.innerHTML = ""; return; }
    const anios = Array.from(disp.keys()).sort((a, b) => a - b);
    const n = seleccion().length;
    cont.innerHTML = '<p class="inf-per-nota"><span class="inf-contador">' + n + (n === 1 ? " mes elegido" : " meses elegidos") + "</span> " + (n >= 1 ? "Cada mes va por separado y se compara con su mes anterior." : "Elige al menos un mes.") + "</p>" +
      anios.slice().reverse().map(a => {
        const ms = disp.get(a);
        return '<div class="inf-anio-fila"><div class="inf-anio-cab"><b>' + a + '</b><button type="button" data-anio-todo="' + a + '">Todo el año</button><button type="button" data-anio-nada="' + a + '">Quitar</button></div>' +
          '<div class="inf-meses" role="group" aria-label="Meses de ' + a + '">' + an.MESES_CORTOS.map((nombre, m) => {
            const hay = ms.indexOf(m) >= 0;
            const on = hay && estado.meses && estado.meses.has(clave(a, m));
            return '<button type="button" data-mes-k="' + clave(a, m) + '"' + (hay ? "" : ' disabled title="Sin datos"') + ' aria-pressed="' + on + '">' + nombre + "</button>";
          }).join("") + "</div></div>";
      }).join("");
  }

  // Resumen rápido en la ventana: una fila por mes (sin mezclar)
  function pintarResumen(d) {
    const cont = document.getElementById("infResumen");
    if (!cont) return;
    if (!d) { cont.innerHTML = '<p class="inf-alerta">Elige al menos un mes para armar el informe.</p>'; return; }
    const rep = d.calidad.repetidos;
    const multiplicado = rep && (rep.kIng > 1 || rep.kEgr > 1);
    const filas = d.meses.map(dm => {
      const r = dm.r;
      const res = r.hayIng && r.hayEgr ? '<b class="' + (r.resultado >= 0 ? "inf-pos" : "inf-neg") + '">' + s0(r.resultado) + "</b>" : "—";
      return "<tr><td>" + esc(dm.nombre) + (r.incompleto ? " <small>(en curso)</small>" : "") + '</td><td class="inf-num">' + (r.hayIng ? s0(r.ingresos) : "—") + '</td><td class="inf-num">' + (r.hayEgr ? s0(r.egresos) : "—") + '</td><td class="inf-num">' + res +
        '</td><td><span class="inf-mini-sello" style="--c:' + esc(dm.veredicto.color || "#8C4633") + '">' + esc(dm.veredicto.texto) + "</span></td></tr>";
    }).join("");
    const partes = estado.tipo === "general"
      ? ["Portada", "Resumen ejecutivo con cifras clave", "Cada mes frente a su mes anterior", "Gráfico y lo más importante de cada mes", "Conclusiones y recomendaciones", "Nota sobre los datos"]
      : ["Portada y resumen", "Introducción", "Datos, método y ecuaciones", "Resultados de cada mes (6 pasos)", "Comparación con el mes anterior", "Modelo y estadística", "Discusión", "Limitaciones", "Conclusiones y recomendaciones", "Anexos"];
    cont.innerHTML =
      (multiplicado ? '<div class="inf-alerta inf-alerta-roja"><b>Tus datos están repetidos</b> (' + [rep.kIng > 1 ? "ingresos ×" + rep.kIng : "", rep.kEgr > 1 ? "egresos ×" + rep.kEgr : ""].filter(Boolean).join(", ") + "): el informe saldría con cifras multiplicadas. Corrígelo primero. " +
        '<button type="button" class="inf-enlace js-dejar-copia">Dejar una sola copia</button></div>' : "") +
      '<div class="inf-tabla-mini"><table><thead><tr><th>Mes</th><th class="inf-num">Ingresos</th><th class="inf-num">Egresos</th><th class="inf-num">Resultado</th><th>Situación</th></tr></thead><tbody>' + filas + "</tbody></table></div>" +
      '<div class="inf-indice"><b>Contenido del informe</b><ol>' + partes.map(p => "<li>" + esc(p) + "</li>").join("") + "</ol></div>" +
      (d.incompletos.length ? '<p class="inf-alerta">⚠ ' + esc(unir(d.incompletos)) + (d.incompletos.length > 1 ? " están" : " está") + " en curso: sus cifras pueden cambiar cuando registres más movimientos.</p>" : "");
  }

  // Insignia fija arriba a la derecha: qué período y qué informe se va a enviar
  function pintarInsignia(d) {
    const mes = document.getElementById("infBadgeMes");
    const det = document.getElementById("infBadgeDet");
    if (!mes || !det) return;
    mes.textContent = d ? d.periodo.toUpperCase() : "SIN MESES ELEGIDOS";
    det.textContent = (estado.tipo === "general" ? "Informe general" : "Informe detallado") + (d ? " · " + d.n + (d.n === 1 ? " mes" : " meses") + (d.incompletos.length ? " · incluye mes en curso" : "") : "");
    const caja = document.getElementById("infBadge");
    if (caja) caja.classList.toggle("inf-badge-curso", !!(d && d.incompletos.length));
  }

  function refrescar(conMensaje) {
    if (!window.Analitica) return null;
    pintarSelector();
    let d = null;
    try { d = armarDatos(seleccion()); } catch (e) { console.warn("[informes] datos:", e); }
    pintarResumen(d);
    pintarInsignia(d);
    if (conMensaje && d) {
      const a = document.getElementById("infAsunto");
      const m = document.getElementById("infMensaje");
      if (a) a.value = asunto(d);
      if (m) m.value = mensaje(d);
    }
    return d;
  }

  /* ======================================================================
     GRÁFICOS DEL INFORME (se dibujan fuera de pantalla y se guardan como imagen)
     Montos en palabras cortas («S/ 300.9 mil»); las cifras exactas están en las tablas.
     ====================================================================== */
  const pluginBlanco = { id: "infBlanco", beforeDraw(chart) { const c = chart.ctx; c.save(); c.globalCompositeOperation = "destination-over"; c.fillStyle = "#fff"; c.fillRect(0, 0, chart.width, chart.height); c.restore(); } };
  const pluginEtiquetas = {
    id: "infEtiquetas",
    afterDatasetsDraw(chart, args, o) {
      if (!o || !o.on) return;
      const c = chart.ctx;
      c.save();
      c.font = "600 " + (o.tam || 16) + "px Calibri, Arial, sans-serif";
      c.fillStyle = "#2B211C";
      const fmt = o.fmt || mil;
      chart.data.datasets.forEach((ds, di) => {
        if (ds.type === "line" || !chart.isDatasetVisible(di)) return;
        chart.getDatasetMeta(di).data.forEach((el, i) => {
          const v = ds.data[i];
          if (typeof v !== "number" || !el) return;
          if (o.horizontal) { c.textAlign = "left"; c.textBaseline = "middle"; c.fillText(fmt(v, i), el.x + 8, el.y); }
          else { c.textAlign = "center"; c.textBaseline = v >= 0 ? "bottom" : "top"; c.fillText(fmt(v, i), el.x, v >= 0 ? el.y - 5 : el.y + 5); }
        });
      });
      c.restore();
    },
  };

  function grafico(cfg, ancho, alto) {
    const lienzo = document.createElement("canvas");
    lienzo.width = ancho; lienzo.height = alto;
    cfg.options = Object.assign({ responsive: false, animation: false, devicePixelRatio: 1, events: [], font: { family: "Calibri, Arial, sans-serif", size: 18 } }, cfg.options || {});
    cfg.plugins = (cfg.plugins || []).concat([pluginBlanco, pluginEtiquetas]);
    let g = null, url = "";
    try { g = new Chart(lienzo, cfg); url = lienzo.toDataURL("image/png"); } finally { if (g) g.destroy(); }
    const bin = atob(url.split(",")[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, ancho, alto, url };
  }

  const EJE_Y = { grid: { color: "#EFE6DA" }, border: { display: false }, ticks: { color: "#5A4A40", font: { size: 16 }, callback: v => mil(v) } };
  const EJE_X = { grid: { display: false }, ticks: { color: "#3B2F2A", font: { size: 17 } } };
  const LEYENDA = { display: true, position: "bottom", labels: { usePointStyle: true, pointStyle: "rect", boxWidth: 16, boxHeight: 16, padding: 22, font: { size: 18 } } };

  // Un mes: ingresos, egresos y resultado (3 barras, con la cifra completa encima)
  function imagenMesBarras(dm) {
    const r = dm.r;
    if (!r.hayDatos) return null;
    const datos = [r.hayIng ? r.ingresos : null, r.hayEgr ? r.egresos : null, r.hayIng && r.hayEgr ? r.resultado : null];
    return grafico({
      type: "bar",
      data: { labels: ["Ingresos (ventas)", "Egresos (gastos)", r.resultado >= 0 ? "Ganancia" : "Pérdida"], datasets: [{ data: datos, backgroundColor: ["#16A34A", "#F97316", r.resultado >= 0 ? "#0F766E" : "#DC2626"], borderRadius: 8, maxBarThickness: 150 }] },
      options: { layout: { padding: { top: 34, bottom: 8, right: 10 } }, scales: { x: EJE_X, y: Object.assign({ beginAtZero: true, grace: "12%" }, EJE_Y) }, plugins: { legend: { display: false }, infEtiquetas: { on: true, tam: 19, fmt: v => s2(v) } } },
    }, 1240, 460);
  }

  function imagenGastos(plata) {
    const cats = plata.categorias;
    if (!cats.length) return null;
    return grafico({
      type: "bar",
      data: { labels: cats.map(c => c.nombre), datasets: [{ label: "Egresos", data: cats.map(c => c.total), backgroundColor: cats.map(c => c.color), borderRadius: 6, maxBarThickness: 44 }] },
      options: {
        indexAxis: "y", layout: { padding: { right: 280 } },
        scales: { x: { beginAtZero: true, display: false }, y: { grid: { display: false }, border: { display: false }, ticks: { color: "#3B2F2A", font: { size: 18 } } } },
        plugins: { legend: { display: false }, infEtiquetas: { on: true, horizontal: true, fmt: (v, i) => s0(v) + " · " + pc(cats[i].pct, 1) } },
      },
    }, 1240, Math.max(320, cats.length * 60 + 40));
  }

  // Un mes: ladrillos vendidos frente a los necesarios para no perder
  function imagenEquilibrioMes(dm) {
    if (!dm.eq.disponible || !(dm.r.unidades > 0)) return null;
    const ok = dm.eq.alcanzado;
    return grafico({
      type: "bar",
      data: { labels: ["Ladrillos vendidos", "Necesarios para no perder"], datasets: [{ data: [dm.r.unidades, Math.round(dm.eq.necesarios)], backgroundColor: [ok ? "#1E88E5" : "#DC2626", "#868E96"], borderRadius: 8, maxBarThickness: 150 }] },
      options: { layout: { padding: { top: 34, right: 10 } }, scales: { x: EJE_X, y: Object.assign({ beginAtZero: true, grace: "12%" }, EJE_Y, { ticks: { color: "#5A4A40", font: { size: 16 }, callback: v => lad(v) } }) }, plugins: { legend: { display: false }, infEtiquetas: { on: true, tam: 19, fmt: v => num(v) + " ladrillos" } } },
    }, 1240, 420);
  }

  function imagenPareto(cl) {
    const top = cl.clientes.slice(0, 10);
    if (!top.length) return null;
    const color = c => (c.clase === "A" ? "#F45F00" : c.clase === "B" ? "#5B9BDB" : "#9AA0A6");
    return grafico({
      type: "bar",
      data: {
        labels: top.map((c, i) => (i + 1) + "º"),
        datasets: [
          { label: "Ventas del cliente", data: top.map(c => c.total), backgroundColor: top.map(color), borderRadius: 6, maxBarThickness: 64, yAxisID: "y", order: 2 },
          { type: "line", label: "% acumulado de las ventas", data: top.map(c => +c.acumulado.toFixed(1)), yAxisID: "y2", borderColor: "#032440", backgroundColor: "rgba(3,36,64,0.08)", fill: "origin", pointBackgroundColor: "#032440", pointBorderColor: "#fff", pointBorderWidth: 2, pointRadius: 6, borderWidth: 3.5, tension: 0, order: 1 },
        ],
      },
      options: {
        layout: { padding: { top: 20, right: 10 } },
        scales: { x: EJE_X, y: Object.assign({ beginAtZero: true, grace: "8%" }, EJE_Y), y2: { position: "right", min: 0, max: 100, grid: { display: false }, border: { display: false }, ticks: { color: "#37474F", font: { size: 16 }, stepSize: 20, callback: v => v + "%" } } },
        plugins: { legend: LEYENDA, infEtiquetas: { on: false } },
      },
    }, 1240, 500);
  }

  // Varios meses: ingresos y egresos de cada mes (el mes resaltado va con color fuerte y los demás suaves)
  function imagenMeses(filas, etiqueta, resaltar) {
    if (!filas.length) return null;
    const fuerte = x => !resaltar || resaltar(x);
    return grafico({
      type: "bar",
      data: {
        labels: filas.map(etiqueta),
        datasets: [
          { label: "Ingresos", data: filas.map(x => (x.hayIng ? x.ingresos : null)), backgroundColor: filas.map(x => (fuerte(x) ? "#16A34A" : "rgba(22,163,74,0.35)")), borderRadius: 6, maxBarThickness: 70 },
          { label: "Egresos", data: filas.map(x => (x.hayEgr ? x.egresos : null)), backgroundColor: filas.map(x => (fuerte(x) ? "#F97316" : "rgba(249,115,22,0.35)")), borderRadius: 6, maxBarThickness: 70 },
        ],
      },
      options: { layout: { padding: { top: 28, right: 10 } }, scales: { x: EJE_X, y: Object.assign({ beginAtZero: true, grace: "10%" }, EJE_Y) }, plugins: { legend: LEYENDA, infEtiquetas: { on: true, tam: filas.length > 8 ? 13 : 16 } } },
    }, 1240, 540);
  }

  function imagenResultado(filas, etiqueta, resaltar) {
    const ms = filas.filter(x => x.hayIng && x.hayEgr);
    if (!ms.length) return null;
    const fuerte = x => !resaltar || resaltar(x);
    return grafico({
      type: "bar",
      data: { labels: ms.map(etiqueta), datasets: [{ label: "Resultado", data: ms.map(x => x.resultado), backgroundColor: ms.map(x => (x.resultado >= 0 ? (fuerte(x) ? "#16A34A" : "rgba(22,163,74,0.4)") : (fuerte(x) ? "#DC2626" : "rgba(220,38,38,0.4)"))), borderRadius: 6, maxBarThickness: 70 }] },
      options: { layout: { padding: { top: 32, bottom: 12, right: 10 } }, scales: { x: EJE_X, y: Object.assign({ grace: "14%" }, EJE_Y) }, plugins: { legend: { display: false }, infEtiquetas: { on: true, fmt: v => (v > 0 ? "+" : "") + mil(v) } } },
    }, 1240, 480);
  }

  /* ======================================================================
     MODELO Y ESTADÍSTICA (solo con los datos cargados; nada inventado)
     La serie de meses: si se eligió un mes, todos los meses con datos de su
     año; si se eligieron varios, esos meses. Para la estadística solo se usan
     meses COMPLETOS (un mes en curso todavía puede cambiar).
     ====================================================================== */
  function mediana(v) { const o = v.slice().sort((a, b) => a - b); const n = o.length; return n ? (n % 2 ? o[(n - 1) / 2] : (o[n / 2 - 1] + o[n / 2]) / 2) : null; }
  function descriptiva(v) {
    if (!v.length) return null;
    const m = media(v), s = v.length >= 2 ? desvio(v) : null;
    const min = Math.min.apply(null, v), max = Math.max.apply(null, v);
    // El CV solo tiene sentido con cifras siempre positivas (con meses en pérdida el promedio no representa a los meses)
    return { n: v.length, media: m, mediana: mediana(v), s, cv: s !== null && m > 0 && min > 0 ? (s / m) * 100 : null, min, max };
  }
  // Recta de mínimos cuadrados y = a + b·x, con su R²
  function regresion(xs, ys) {
    const n = xs.length;
    if (n < 3) return null;
    const mx = media(xs), my = media(ys);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); syy += (ys[i] - my) * (ys[i] - my); }
    if (!sxx || !syy) return null;
    const b = sxy / sxx, a = my - b * mx;
    let res = 0;
    for (let i = 0; i < n; i++) res += Math.pow(ys[i] - (a + b * xs[i]), 2);
    return { n, a, b, r2: 1 - res / syy };
  }
  function pearson(xs, ys) {
    const n = xs.length;
    if (n < 3) return null;
    const mx = media(xs), my = media(ys);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); syy += (ys[i] - my) * (ys[i] - my); }
    return sxx && syy ? { n, r: sxy / Math.sqrt(sxx * syy) } : null;
  }
  function palabraR(r) { const a = Math.abs(r); return (a >= 0.8 ? "muy fuerte" : a >= 0.6 ? "fuerte" : a >= 0.4 ? "moderada" : a >= 0.2 ? "débil" : "casi nula") + (r >= 0 ? " y directa (suben juntas)" : " e inversa (cuando una sube, la otra baja)"); }

  function modeloDe(d) {
    const an = d.an;
    const cp = d.comp;
    const serie = cp.modo === "uno" ? cp.filas : d.meses.map(dm => dm.r);
    const etiqueta = x => an.MESES_TITULO[x.mes] + (d.varios ? " " + x.anio : "");
    // Un mes en curso queda fuera entero (ventas y gastos), para que todas las cifras usen los mismos meses
    const compI = serie.filter(x => x.hayIng && !x.incompleto);
    const compE = serie.filter(x => x.hayEgr && !x.incompleto);
    const compR = serie.filter(x => x.hayIng && x.hayEgr && !x.incompleto);
    const desc = [
      { nombre: "Ingresos (S/)", d: descriptiva(compI.map(x => x.ingresos)), fmt: s0 },
      { nombre: "Egresos (S/)", d: descriptiva(compE.map(x => x.egresos)), fmt: s0 },
      { nombre: "Resultado (S/)", d: descriptiva(compR.map(x => x.resultado)), fmt: s0 },
      { nombre: "Margen neto (%)", d: descriptiva(compR.filter(x => x.margenPct !== null).map(x => x.margenPct)), fmt: v => pc(v, 1) },
      { nombre: "Ladrillos vendidos", d: descriptiva(compI.filter(x => x.unidades > 0).map(x => x.unidades)), fmt: v => num(v) },
    ].filter(x => x.d);
    const t = x => x.anio * 12 + x.mes;
    const t0 = serie.length ? t(serie[0]) : 0;
    const tendencia = {
      ingresos: regresion(compI.map(x => t(x) - t0 + 1), compI.map(x => x.ingresos)),
      egresos: regresion(compE.map(x => t(x) - t0 + 1), compE.map(x => x.egresos)),
    };
    const conU = compR.filter(x => x.unidades > 0);
    const relaciones = [
      { nombre: "Ladrillos vendidos y ventas (S/)", p: pearson(conU.map(x => x.unidades), conU.map(x => x.ingresos)) },
      { nombre: "Ventas y gastos del mes", p: pearson(compR.map(x => x.ingresos), compR.map(x => x.egresos)) },
      { nombre: "Ladrillos vendidos y resultado", p: pearson(conU.map(x => x.unidades), conU.map(x => x.resultado)) },
    ].filter(x => x.p);
    // Modelo costo–volumen–utilidad (el mismo punto de equilibrio del panel), comparado con lo real
    const cvu = d.anios.map(anio => {
      const dm = d.meses.find(x => x.anio === anio);
      const pe = dm ? dm.pe : an.puntoEquilibrio(anio);
      if (!pe || !(pe.margen > 0)) return { anio, pe: null, filas: [] };
      const filas = conU.filter(x => x.anio === anio).map(x => {
        const modelo = pe.margen * x.unidades - pe.fijosMes;
        return { x, real: x.resultado, modelo, dif: x.resultado - modelo };
      });
      const mae = filas.length ? media(filas.map(f => Math.abs(f.dif))) : null;
      const escala = filas.length ? media(filas.map(f => Math.abs(f.real))) : null;
      return { anio, pe, filas, mae, maePct: mae !== null && escala ? (mae / escala) * 100 : null };
    });
    // Concentración (regla 80/20): clientes del período
    const cl = cp.modo === "uno" ? d.meses[0].cl : cp.cl;
    let pareto = null;
    if (cl && cl.cantidad) {
      const k = Math.max(1, Math.ceil(cl.cantidad * 0.2));
      pareto = { k, n: cl.cantidad, pct: suma(cl.clientes.slice(0, k), c => c.pct), claveA: cl.claveA };
    }
    return { serie, etiqueta, compI, compE, compR, desc, tendencia, t, t0, relaciones, cvu, pareto, cl };
  }

  // Gráfico: resultado real frente al que da el modelo, mes a mes
  function imagenModelo(filas, etiqueta) {
    if (!filas.length) return null;
    return grafico({
      type: "bar",
      data: {
        labels: filas.map(f => etiqueta(f.x)),
        datasets: [
          { label: "Resultado real", data: filas.map(f => f.real), backgroundColor: "#0F766E", borderRadius: 5, maxBarThickness: 60 },
          { label: "Resultado según el modelo", data: filas.map(f => f.modelo), backgroundColor: "#9AA0A6", borderRadius: 5, maxBarThickness: 60 },
        ],
      },
      options: { layout: { padding: { top: 30, right: 10 } }, scales: { x: EJE_X, y: Object.assign({ grace: "14%" }, EJE_Y) }, plugins: { legend: LEYENDA, infEtiquetas: { on: true, tam: filas.length > 6 ? 12 : 15, fmt: v => (v > 0 ? "+" : "") + mil(v) } } },
    }, 1240, 520);
  }

  // Gráfico: ventas y gastos de cada mes con su recta de tendencia
  function imagenTendencia(mod) {
    // Solo meses completos: los mismos que usa la tabla de tendencia
    const pts = mod.serie.filter(x => (x.hayIng || x.hayEgr) && !x.incompleto);
    if (pts.length < 3) return null;
    const x = r => mod.t(r) - mod.t0 + 1;
    const recta = reg => pts.map(p => (reg ? reg.a + reg.b * x(p) : null));
    return grafico({
      type: "line",
      data: {
        labels: pts.map(mod.etiqueta),
        datasets: [
          { label: "Ventas del mes", data: pts.map(p => (p.hayIng ? p.ingresos : null)), borderColor: "#16A34A", backgroundColor: "#16A34A", pointRadius: 7, borderWidth: 3, tension: 0, spanGaps: true },
          { label: "Gastos del mes", data: pts.map(p => (p.hayEgr ? p.egresos : null)), borderColor: "#F97316", backgroundColor: "#F97316", pointRadius: 7, borderWidth: 3, tension: 0, spanGaps: true },
          { label: "Tendencia de las ventas", data: recta(mod.tendencia.ingresos), borderColor: "#16A34A", borderDash: [10, 7], borderWidth: 2.5, pointRadius: 0 },
          { label: "Tendencia de los gastos", data: recta(mod.tendencia.egresos), borderColor: "#F97316", borderDash: [10, 7], borderWidth: 2.5, pointRadius: 0 },
        ],
      },
      options: { layout: { padding: { top: 20, right: 10 } }, scales: { x: EJE_X, y: Object.assign({ beginAtZero: true, grace: "10%" }, EJE_Y) }, plugins: { legend: LEYENDA, infEtiquetas: { on: false } } },
    }, 1240, 520);
  }

  /* ======================================================================
     CADA MES FRENTE A SU MES ANTERIOR (siempre el mes calendario anterior,
     aunque no se haya elegido: abril con marzo, agosto con julio)
     ====================================================================== */
  function pctTxt(v) { return v === null || v === undefined || !isFinite(v) ? "—" : (v >= 0 ? "▲ +" : "▼ −") + num(Math.abs(v), 1) + "%"; }
  function nombreAnt(dm) { return dm.ant ? dm.ant.completo : dm.antNombre; }

  // Filas: [indicador, mes anterior, mes, variación] y si la variación es buena (true), mala (false) o neutra (null)
  function filasVsAnterior(dm, dinero) {
    const r = dm.r, a = dm.ant ? dm.ant.r : null;
    const f = [];
    const fila = (ind, va, vr, vari, bueno) => f.push({ c: [ind, va, vr, vari], bueno });
    const pv = (x, y) => (x !== null && y !== null && y > 0 ? variacion(x, y) : null);
    const ingA = a && a.hayIng ? a.ingresos : null, ingR = r.hayIng ? r.ingresos : null;
    const egrA = a && a.hayEgr ? a.egresos : null, egrR = r.hayEgr ? r.egresos : null;
    const resA = a && a.hayIng && a.hayEgr ? a.resultado : null, resR = r.hayIng && r.hayEgr ? r.resultado : null;
    const vI = pv(ingR, ingA), vE = pv(egrR, egrA);
    fila("Ventas (ingresos)", ingA !== null ? dinero(ingA) : "sin datos", ingR !== null ? dinero(ingR) : "sin registrar", pctTxt(vI), vI === null ? null : vI >= 0);
    fila("Gastos (egresos)", egrA !== null ? dinero(egrA) : "sin datos", egrR !== null ? dinero(egrR) : "sin registrar", pctTxt(vE), vE === null ? null : vE <= 0);
    if (resR !== null || resA !== null) fila("Resultado (ganancia o pérdida)", resA !== null ? dinero(resA) : "—", resR !== null ? dinero(resR) : "—", resA !== null && resR !== null ? conSigno(resR - resA, dinero) : "—", resA !== null && resR !== null ? resR >= resA : null);
    const mA = resA !== null ? a.margenPct : null, mR = resR !== null ? r.margenPct : null;
    if (mR !== null || mA !== null) fila("Margen neto (de cada S/ 100 vendidos)", mA !== null ? pc(mA, 1) : "—", mR !== null ? pc(mR, 1) : "—", mA !== null && mR !== null ? conSigno(mR - mA, v => num(v, 1) + " pts") : "—", mA !== null && mR !== null ? mR >= mA : null);
    const uA = a && a.unidades > 0 ? a.unidades : null, uR = r.unidades > 0 ? r.unidades : null;
    if (uA !== null || uR !== null) { const v = pv(uR, uA); fila("Ladrillos vendidos", uA !== null ? num(uA) : "—", uR !== null ? num(uR) : "—", pctTxt(v), v === null ? null : v >= 0); }
    const prA = a && a.precio ? a.precio : null, prR = r.precio || null;
    if (prA !== null || prR !== null) fila("Precio promedio por ladrillo", prA !== null ? sU(prA) : "—", prR !== null ? sU(prR) : "—", pctTxt(pv(prR, prA)), null);
    const cA = dm.ant && dm.ant.cl.cantidad ? dm.ant.cl.cantidad : null, cR = dm.cl.cantidad || null;
    if (cA !== null || cR !== null) fila("Clientes que compraron", cA !== null ? num(cA) : "—", cR !== null ? num(cR) : "—", cA !== null && cR !== null ? conSigno(cR - cA, v => num(v)) : "—", cA !== null && cR !== null ? cR >= cA : null);
    return f;
  }

  // Clientes del mes frente a los del mes anterior: nuevos y los que no volvieron
  function clientesVsAnterior(dm) {
    if (!dm.ant) return null;
    const antes = new Set(dm.ant.cl.clientes.map(c => c.clave));
    const ahora = new Set(dm.cl.clientes.map(c => c.clave));
    const nuevos = dm.cl.clientes.filter(c => !antes.has(c.clave));
    const noVolvieron = dm.ant.cl.clientes.filter(c => !ahora.has(c.clave));
    return { nuevos, noVolvieron, repiten: dm.cl.clientes.length - nuevos.length, montoNuevos: suma(nuevos, c => c.total), montoPerdido: suma(noVolvieron, c => c.total) };
  }

  // Gastos por tipo: mes anterior, mes y diferencia (de mayor a menor cambio)
  function gastosVsAnterior(dm) {
    const antes = dm.ant ? dm.ant.plata.categorias : [];
    const claves = [];
    dm.plata.categorias.concat(antes).forEach(c => { if (claves.indexOf(c.clave) < 0) claves.push(c.clave); });
    return claves.map(k => {
      const x = dm.plata.categorias.find(c => c.clave === k), y = antes.find(c => c.clave === k);
      return { nombre: (x || y).nombre, antes: y ? y.total : 0, ahora: x ? x.total : 0, dif: (x ? x.total : 0) - (y ? y.total : 0) };
    }).sort((p, q) => Math.abs(q.dif) - Math.abs(p.dif));
  }

  // Gráfico: ventas, gastos y resultado del mes al lado de los de su mes anterior
  function imagenVsAnterior(dm) {
    const r = dm.r, a = dm.ant ? dm.ant.r : null;
    if (!r.hayDatos) return null;
    const val = (x, k) => (!x ? null : k === 0 ? (x.hayIng ? x.ingresos : null) : k === 1 ? (x.hayEgr ? x.egresos : null) : (x.hayIng && x.hayEgr ? x.resultado : null));
    return grafico({
      type: "bar",
      data: {
        labels: ["Ventas", "Gastos", "Resultado"],
        datasets: [
          { label: nombreAnt(dm) + " (mes anterior)" + (a ? "" : " · sin datos"), data: [0, 1, 2].map(k => val(a, k)), backgroundColor: "#A7B4C4", borderRadius: 6, maxBarThickness: 120 },
          { label: dm.nombre, data: [0, 1, 2].map(k => val(r, k)), backgroundColor: "#A9573F", borderRadius: 6, maxBarThickness: 120 },
        ],
      },
      options: { layout: { padding: { top: 34, right: 10 } }, scales: { x: EJE_X, y: Object.assign({ beginAtZero: true, grace: "14%" }, EJE_Y) }, plugins: { legend: LEYENDA, infEtiquetas: { on: true, tam: 17, fmt: v => mil(v) } } },
    }, 1240, 480);
  }

  // Gráfico: resultado de cada mes elegido al lado del de su mes anterior
  function imagenResultadoVsAnterior(meses) {
    const ms = meses.filter(dm => dm.r.hayIng && dm.r.hayEgr);
    if (!ms.length) return null;
    const antRes = dm => (dm.ant && dm.ant.r.hayIng && dm.ant.r.hayEgr ? dm.ant.r.resultado : null);
    return grafico({
      type: "bar",
      data: {
        labels: ms.map(dm => dm.corto),
        datasets: [
          { label: "Mes anterior", data: ms.map(antRes), backgroundColor: "#A7B4C4", borderRadius: 6, maxBarThickness: 70 },
          { label: "Mes analizado", data: ms.map(dm => dm.r.resultado), backgroundColor: ms.map(dm => (dm.r.resultado >= 0 ? "#16A34A" : "#DC2626")), borderRadius: 6, maxBarThickness: 70 },
        ],
      },
      options: { layout: { padding: { top: 32, bottom: 8, right: 10 } }, scales: { x: EJE_X, y: Object.assign({ grace: "14%" }, EJE_Y) }, plugins: { legend: LEYENDA, infEtiquetas: { on: true, tam: ms.length > 6 ? 12 : 15, fmt: v => (v > 0 ? "+" : "") + mil(v) } } },
    }, 1240, 500);
  }

  // Una frase por mes: qué cambió frente al mes anterior
  function fraseVsAnterior(dm) {
    const r = dm.r, a = dm.ant ? dm.ant.r : null;
    const ant = nombreAnt(dm).toLowerCase();
    if (!a) return dm.nombre + ": no hay datos de " + ant + " para comparar.";
    const partes = [];
    if (r.hayIng && a.hayIng && a.ingresos > 0) partes.push("ventas " + pctTxt(variacion(r.ingresos, a.ingresos)).replace(/^[▲▼] /, ""));
    if (r.hayEgr && a.hayEgr && a.egresos > 0) partes.push("gastos " + pctTxt(variacion(r.egresos, a.egresos)).replace(/^[▲▼] /, ""));
    let fin = "";
    if (r.hayIng && r.hayEgr && a.hayIng && a.hayEgr) {
      const dif = r.resultado - a.resultado;
      fin = "; el resultado " + (dif >= 0 ? "mejoró en " : "empeoró en ") + s0(Math.abs(dif)) + " (de " + s0(a.resultado) + " a " + s0(r.resultado) + ")";
    }
    return dm.nombre + " frente a " + ant + ": " + (partes.length ? unir(partes) : "sin cifras comparables") + fin + "." + (r.incompleto ? " El mes está en curso." : "");
  }

  /* ======================================================================
     EL INFORME COMO BLOQUES: un solo contenido que sirve para Word, PDF y vista previa
     Bloques: cubierta, caja, h1, h2, p, li, nota, ec (ecuación), tabla (con título y
     fuente), img (con título), salto
     Texto con formato: cadena, o {t: texto, b: negrita, i: cursiva, c: color, s: tamaño}
     Formato de trabajo de investigación: portada, resumen, contenido, introducción,
     datos y método, resultados de cada mes (por separado), análisis comparativo,
     [modelo y estadística], discusión, [limitaciones], conclusiones y [anexos].
     ====================================================================== */
  const R = (t, o) => Object.assign({ t: String(t) }, o || {});

  function armarBloques(d, tipo) {
    const det = tipo === "detallado";
    const an = d.an;
    const cp = d.comp;
    const mod = modeloDe(d);
    const q = d.calidad;
    const B = [];
    const P = (partes, o) => B.push(Object.assign({ t: "p", partes: Array.isArray(partes) ? partes : [partes] }, o || {}));
    const H1 = t => B.push({ t: "h1", texto: t });
    const H2 = t => B.push({ t: "h2", texto: t });
    const NOTA = t => B.push({ t: "nota", texto: t });
    const LI = partes => B.push({ t: "li", partes: Array.isArray(partes) ? partes : [partes] });
    const SALTO = () => B.push({ t: "salto" });
    const FUENTE = "Fuente: registros de ingresos y egresos importados desde Excel (" + d.periodo + ").";
    let nT = 0, nF = 0, nE = 0;
    const TAB = (titulo, cab, filas, anchos, derecha, estilo, fuente) => { nT++; B.push({ t: "tabla", titulo: "Tabla " + nT + ". " + titulo, fuente: fuente === undefined ? FUENTE : fuente, cab, filas, anchos, derecha, estilo: estilo || (() => null) }); };
    const FIG = (titulo, img) => { if (!img) return; nF++; B.push({ t: "img", img, titulo: "Figura " + nF + ". " + titulo }); };
    const EC = texto => { nE++; B.push({ t: "ec", num: nE, texto }); return nE; };
    const QUE = t => P([R("Qué mide: ", { b: true, c: C.suave }), R(t, { c: C.suave })], { compacto: true });
    const varTxt = v => (v === null || v === undefined ? "—" : (v >= 0 ? "▲ +" : "▼ −") + num(Math.abs(v), 1) + "%");
    const nMes = d.n;
    const unMesNombre = d.meses[0].nombre.toLowerCase().replace(/ \d+$/, "");
    const tituloComp = "Comparación de cada mes con su mes anterior";
    const secc = det
      ? { intro: 1, datos: 2, res: 3, comp: 4, modelo: 5, disc: 6, lim: 7, concl: 8 }
      : { intro: 1, datos: 2, res: 3, comp: 4, disc: 5, concl: 6 };

    // Totales del período (solo para el resumen y la discusión; los meses no se mezclan en sus capítulos)
    const T = cp.modo === "varios" ? cp.total : d.meses[0].r;
    const mejor = cp.modo === "varios" ? cp.mejor : null, peor = cp.modo === "varios" ? cp.peor : null;
    const pe0 = d.meses[0].pe;

    /* ================= PORTADA ================= */
    B.push({
      t: "cubierta", empresa: EMPRESA,
      tipoDoc: det ? "Informe de investigación · Informe detallado con modelo y estadística" : "Informe ejecutivo · Informe general",
      titulo: "Análisis de la gestión comercial y financiera",
      subtitulo: d.periodo + (nMes > 1 ? " · " + nMes + " meses" : ""),
      lineas: ["Elaborado el " + hoy() + (nombreUsuario() ? " por " + nombreUsuario() : ""), "Datos: " + num(q.nIng) + " ventas y " + num(q.nEgr) + " pagos registrados en el sistema", "Todas las cifras en soles (S/) y calculadas solo con los Excel cargados"],
    });
    SALTO();

    /* ================= INFORME GENERAL: formato ejecutivo (para directorio) =================
       Poco texto y cifras clave: un resumen del período y, por cada mes, sus cifras frente a
       las de su mes anterior, un gráfico y lo más importante. */
    if (!det) {
      const colVar = (filas, bueno) => (ri, c) => (c === 3 && bueno(ri) !== null ? { c: bueno(ri) ? C.bueno : C.malo, b: true } : null);
      H1("Resumen ejecutivo");
      NOTA("Período: " + frasePeriodo(d) + " · " + num(q.nIng) + " ventas y " + num(q.nEgr) + " pagos registrados · cifras en soles (S/) · cada mes se compara con su mes anterior.");
      const fr = d.meses.map(dm => {
        const r = dm.r, a = dm.ant ? dm.ant.r : null;
        return [dm.nombre + (r.incompleto ? " (en curso)" : ""), r.hayIng ? s0(r.ingresos) : "—", r.hayEgr ? s0(r.egresos) : "—", r.hayIng && r.hayEgr ? s0(r.resultado) : "—", r.hayIng && r.hayEgr ? pc(r.margenPct, 1) : "—",
          a && a.hayIng && r.hayIng ? pctTxt(variacion(r.ingresos, a.ingresos)) : "—", a && a.hayIng && a.hayEgr && r.hayIng && r.hayEgr ? conSigno(r.resultado - a.resultado, s0) : "—"];
      });
      if (nMes > 1) fr.push(["Total del período", s0(T.ingresos), s0(T.egresos), s0(T.resultado), T.margenPct !== null ? pc(T.margenPct, 1) : "—", "", ""]);
      TAB("Indicadores clave de cada mes", ["Mes", "Ventas", "Gastos", "Resultado", "Margen", "Ventas vs mes anterior", "Resultado vs mes anterior"], fr, [2.3, 1.7, 1.7, 1.7, 1.1, 1.6, 1.9], [1, 2, 3, 4, 5, 6], (ri, c) => {
        const v = fr[ri][c];
        if (c === 3 && v !== "—") return { c: v.indexOf("−") === 0 ? C.malo : C.bueno, b: true };
        if ((c === 5 || c === 6) && v && v !== "—") return { c: /^[▲+]/.test(v) ? C.bueno : C.malo };
        return nMes > 1 && ri === fr.length - 1 ? { b: true } : null;
      });
      if (nMes > 1) FIG("Resultado de cada mes frente al de su mes anterior", imagenResultadoVsAnterior(d.meses));
      H2("Mensajes clave");
      LI([R("Resultado: ", { b: true }), conclusionPrincipal(d)]);
      if (mejor && peor && mejor !== peor) LI([R("Mejor y peor mes: ", { b: true }), mejor.nombre + " (" + s0(mejor.r.resultado) + ") y " + peor.nombre + " (" + s0(peor.r.resultado) + ")."]);
      const caidas = d.meses.filter(dm => dm.ant && dm.ant.r.hayIng && dm.r.hayIng && !dm.r.incompleto).map(dm => ({ dm, v: variacion(dm.r.ingresos, dm.ant.r.ingresos) })).filter(x => x.v !== null).sort((x, y) => x.v - y.v);
      if (caidas.length && caidas[0].v < 0) LI([R("Mayor caída de ventas: ", { b: true }), caidas[0].dm.nombre + ", " + pctTxt(caidas[0].v).replace(/^[▲▼] /, "") + " frente a " + nombreAnt(caidas[0].dm).toLowerCase() + "."]);
      if (pe0 && pe0.margen > 0) {
        const falta = d.meses.filter(dm => dm.eq.disponible && !dm.eq.alcanzado && !dm.r.incompleto);
        LI([R("Meta mínima: ", { b: true }), "≈ " + num(pe0.unidadesEq) + " ladrillos al mes (≈ " + s0(pe0.solesEq) + " en ventas) para no perder" + (falta.length ? "; no se alcanzó en " + unir(falta.map(dm => dm.nombre.toLowerCase())) + "." : "; se alcanzó en todos los meses completos.")]);
      }
      if (mod.pareto) LI([R("Clientes: ", { b: true }), "el 20% de los clientes (" + mod.pareto.k + " de " + mod.pareto.n + ") hizo el " + pc(mod.pareto.pct, 1) + " de las ventas."]);

      d.meses.forEach((dm, i) => {
        const r = dm.r;
        SALTO();
        const ant = nombreAnt(dm);
        H1((i + 1) + ". " + dm.nombre + (r.incompleto ? " (en curso)" : "") + " frente a " + ant.toLowerCase());
        const colorVer = (dm.veredicto.color || "#8C4633").replace("#", "");
        B.push({ t: "caja", titulo: "Veredicto: " + (dm.veredicto.texto || "—"), texto: dm.veredicto.frase || "", color: colorVer.length === 6 ? colorVer : C.marca });
        const fv = filasVsAnterior(dm, s0);
        TAB("Cifras clave: " + dm.nombre.toLowerCase() + " frente a " + ant.toLowerCase(), ["Indicador", ant + (dm.ant ? "" : " (sin datos)"), dm.nombre, "Variación"], fv.map(x => x.c), [4, 2.2, 2.2, 2], [1, 2, 3], colVar(fv, ri => fv[ri].bueno));
        FIG(dm.nombre + " frente a " + ant.toLowerCase() + ": ventas, gastos y resultado", imagenVsAnterior(dm));
        H2("Lo más importante");
        const gv = gastosVsAnterior(dm).filter(x => dm.ant && Math.abs(x.dif) >= 1);
        if (gv.length) LI([R("Gasto que más cambió: ", { b: true }), gv[0].nombre + ", " + conSigno(gv[0].dif, s0) + " frente a " + ant.toLowerCase() + " (" + s0(gv[0].antes) + " → " + s0(gv[0].ahora) + ")."]);
        const mayor = dm.plata.categorias[0];
        if (mayor) LI([R("Mayor gasto del mes: ", { b: true }), mayor.nombre + ", " + s0(mayor.total) + " (" + pc(mayor.pct, 1) + " de los gastos)."]);
        const cv = clientesVsAnterior(dm);
        if (dm.cl.cantidad) LI([R("Clientes: ", { b: true }), num(dm.cl.cantidad) + " compraron" + (cv ? " (" + num(cv.nuevos.length) + " nuevos frente a " + ant.toLowerCase() + ")" : "") + "; los 5 mejores hicieron el " + pc(dm.cl.top5, 1) + " de las ventas."]);
        if (dm.eq.disponible) LI([R("Punto de equilibrio: ", { b: true }), dm.eq.alcanzado ? "cubierto: se vendieron " + num(r.unidades) + " ladrillos y hacían falta " + num(Math.round(dm.eq.necesarios)) + "." : "no cubierto: faltaron ≈ " + num(Math.ceil(dm.eq.faltaLadrillos)) + " ladrillos (≈ " + s0(dm.eq.faltaVentas) + " en ventas)."]);
        H2("Acción recomendada");
        recomendacionesMes(dm).slice(0, 2).forEach(t => LI(t));
      });

      SALTO();
      H1((nMes + 1) + ". Conclusiones y recomendaciones");
      H2("Conclusiones");
      conclusiones(d, mod).forEach((t, k) => LI([R((k + 1) + ". ", { b: true }), t]));
      H2("Recomendaciones");
      recomendacionesFinales(d, mod).forEach((t, k) => LI([R((k + 1) + ". ", { b: true }), t]));
      H2("Nota sobre los datos");
      TAB("Datos usados", ["Dato", "Valor"], [
        ["Origen", "Excel de ingresos y Excel de egresos cargados en el sistema"],
        ["Ventas (ingresos)", num(q.nIng) + (q.ingDesde ? " registros · del " + fechaTxt(q.ingDesde) + " al " + fechaTxt(q.ingHasta) : "")],
        ["Pagos (egresos)", num(q.nEgr) + (q.egrDesde ? " registros · del " + fechaTxt(q.egrDesde) + " al " + fechaTxt(q.egrHasta) : "")],
        ["Comparación", "Cada mes frente a su mes calendario anterior (aunque ese mes no se haya elegido)"],
        ["Meses en curso", d.incompletos.length ? unir(d.incompletos) + " (último registro antes del día 25)" : "ninguno"],
        ["Comprobación de sumas", q.comprobaciones.every(c => c.ok) ? "Correcta: las sumas por mes, cliente, tipo de gasto y código coinciden" : "Revisar: alguna suma no coincide"],
      ], [3, 7], [], null, "");
      NOTA("Informe generado con los ingresos y egresos registrados en el sistema de " + EMPRESA.replace(/\.$/, "") + ". Cifras en soles (S/): miles con coma y decimales con punto.");
      return B;
    }

    /* ================= RESUMEN ================= */
    H1("Resumen");
    const frRes = T.hayIng && T.hayEgr ? (T.resultado >= 0 ? "una ganancia de " : "una pérdida de ") + s2(Math.abs(T.resultado)) + " (margen neto " + pc(T.margenPct, 1) + ")" : "sin resultado completo (faltan ingresos o egresos)";
    P([R("Objetivo. ", { b: true }), "Evaluar cómo le fue a " + EMPRESA + " " + (nMes > 1 ? "en cada uno de los " + nMes + " meses analizados (" + frasePeriodo(d) + "), comparando cada uno con su mes anterior" : "en " + frasePeriodo(d) + " y compararlo con su mes anterior") + ", usando únicamente los registros de ingresos y egresos cargados en el sistema."]);
    P([R("Datos y método. ", { b: true }), "Se analizaron " + num(q.nIng) + " ventas y " + num(q.nEgr) + " pagos. Para cada mes se calculó el resultado (ingresos − egresos), la estructura de gastos, el punto de equilibrio, la concentración de clientes y los precios por ladrillo" + (det ? "; después se aplicó estadística descriptiva, un modelo costo–volumen–utilidad, tendencia lineal y correlaciones" : "") + ". Las sumas se verificaron por varios caminos."]);
    P([R("Resultados. ", { b: true }), (nMes > 1 ? "En el período se vendieron " + s2(T.ingresos) + " y se gastaron " + s2(T.egresos) + ", con " + frRes + "." + (mejor && mejor !== peor ? " El mejor mes fue " + mejor.nombre.toLowerCase() + " (" + s0(mejor.r.resultado) + ") y el peor, " + peor.nombre.toLowerCase() + " (" + s0(peor.r.resultado) + ")." : "") : "En " + d.meses[0].nombre.toLowerCase() + " se vendieron " + s2(T.ingresos) + " y se gastaron " + s2(T.egresos) + ", con " + frRes + ".") +
      (pe0 && pe0.margen > 0 ? " El punto de equilibrio es de ≈ " + num(pe0.unidadesEq) + " ladrillos al mes." : "") + (mod.cl && mod.cl.cantidad ? " Los 5 mejores clientes hicieron el " + pc(mod.cl.top5, 1) + " de las ventas." : "")]);
    P([R("Conclusión. ", { b: true }), conclusionPrincipal(d)]);
    P([R("Palabras clave: ", { b: true, c: C.suave }), R("ingresos, egresos, resultado, punto de equilibrio, clientes, ladrillos" + (det ? ", estadística descriptiva, tendencia" : "") + ".", { c: C.suave })]);

    /* ================= CONTENIDO ================= */
    H2("Contenido");
    LI(secc.intro + ". Introducción");
    LI(secc.datos + ". Datos y método");
    LI(secc.res + ". Resultados de cada mes: " + unir(d.meses.map(dm => dm.nombre.toLowerCase())));
    LI(secc.comp + ". " + tituloComp);
    if (det) LI(secc.modelo + ". Modelo y estadística");
    LI(secc.disc + ". Discusión");
    if (det) LI(secc.lim + ". Limitaciones");
    LI(secc.concl + ". Conclusiones y recomendaciones");
    if (det) LI("Anexo A. Datos usados y comprobaciones · Anexo B. Glosario");

    /* ================= 1. INTRODUCCIÓN ================= */
    SALTO();
    H1(secc.intro + ". Introducción");
    P("Este informe responde, con los datos reales de la empresa, a preguntas concretas sobre su marcha. Cada mes se estudia por separado, sin mezclar sus cifras con las de otros meses, y siempre se compara con su mes anterior (por ejemplo, abril con marzo y agosto con julio).");
    if (det) {
      P([R("Objetivo general: ", { b: true }), "medir el desempeño comercial y financiero de cada mes y explicar sus diferencias con base en los registros."]);
      P([R("Objetivos específicos:", { b: true })]);
    } else P([R("Preguntas que responde:", { b: true })]);
    LI("¿Se ganó o se perdió dinero en cada mes, y por qué?");
    LI("¿En qué tipo de gasto se fue el dinero?");
    LI("¿Se vendió lo suficiente para cubrir los gastos (punto de equilibrio)?");
    LI("¿Qué clientes y qué ladrillos sostienen las ventas?");
    LI("¿Qué mejoró y qué empeoró frente al mes anterior?");
    if (det) LI("¿Qué dicen la estadística y el modelo de costos sobre la estabilidad y la tendencia del negocio?");

    /* ================= 2. DATOS Y MÉTODO ================= */
    H1(secc.datos + ". Datos y método");
    H2(secc.datos + ".1 Datos analizados");
    TAB("Datos usados en el informe", ["Dato", "Valor"], [
      ["Origen", "Excel de ingresos y Excel de egresos cargados en el sistema"],
      ["Meses analizados", unir(d.meses.map(dm => dm.nombre))],
      ["Ventas (ingresos)", num(q.nIng) + (q.ingDesde ? " registros · del " + fechaTxt(q.ingDesde) + " al " + fechaTxt(q.ingHasta) : "")],
      ["Pagos (egresos)", num(q.nEgr) + (q.egrDesde ? " registros · del " + fechaTxt(q.egrDesde) + " al " + fechaTxt(q.egrHasta) : "")],
      ["Meses en curso", d.incompletos.length ? unir(d.incompletos) + " (último registro antes del día 25)" : "ninguno"],
      ["Moneda", "Soles (S/). Los montos que en el Excel tenían «$» se leen como soles."],
      ["Control de repetidos", q.repetidos && (q.repetidos.kIng > 1 || q.repetidos.kEgr > 1) ? "Datos repetidos: corregir antes de usar" : "Cada registro está cargado una sola vez"],
    ], [3.2, 6.8], [], null, "");
    H2(secc.datos + ".2 Qué se mide y cómo");
    TAB("Indicadores del informe", ["Indicador", "Qué significa", "Cómo se calcula"], [
      ["Ingresos", "Dinero que entró por ventas", "Suma de los montos de las ventas del mes"],
      ["Egresos", "Dinero que salió en pagos y gastos", "Suma de los montos de los pagos del mes"],
      ["Resultado", "Ganancia (+) o pérdida (−)", "Ingresos − egresos"],
      ["Margen neto", "Lo que queda de cada S/ 100 vendidos", "Resultado ÷ ingresos × 100"],
      ["Precio promedio", "Lo que se cobró en promedio por ladrillo", "Ingresos ÷ ladrillos vendidos"],
      ["Punto de equilibrio", "Ladrillos a vender al mes para no perder", "Gastos fijos ÷ (precio − costo variable)"],
      ["Clientes clave", "Clientes que hacen el 80% de las ventas", "Clientes ordenados de mayor a menor hasta sumar 80%"],
    ], [2.2, 3.8, 4], [], null, "");
    if (det) {
      H2(secc.datos + ".3 Ecuaciones");
      P("Las fórmulas usadas en todo el informe son las mismas del panel del sistema:");
      EC("Resultado = Ingresos − Egresos");
      EC("Margen neto (%) = Resultado ÷ Ingresos × 100");
      EC("Precio (p) = Ingresos ÷ Ladrillos;   Costo variable (cv) = (Materia prima + Combustible) ÷ Ladrillos");
      EC("Punto de equilibrio (Q*) = Gastos fijos del mes ÷ (p − cv)");
      EC("Resultado del modelo = (p − cv) × Ladrillos − Gastos fijos promedio");
      EC("Ladrillos necesarios del mes = Ladrillos vendidos − Resultado ÷ (p − cv)");
      EC("Desviación estándar: s = raíz cuadrada de [ suma de (x − promedio)² ÷ (n − 1) ]");
      EC("Coeficiente de variación (CV) = s ÷ promedio × 100");
      EC("Tendencia lineal: y = a + b × t   (b = cambio promedio por mes; R² = qué tanto explica la recta)");
      EC("Correlación de Pearson: r = covarianza(x, y) ÷ (s de x × s de y), entre −1 y +1");
      H2(secc.datos + ".4 Procedimiento");
      LI("1. Lectura de los Excel: fechas, montos (también los escritos como texto) y ladrillos, todo en soles.");
      LI("2. Control de repetidos: un Excel cargado dos veces no se suma dos veces.");
      LI("3. Cálculo de cada mes por separado, con sus propias ventas y pagos.");
      LI("4. Comparación de cada mes con su mes anterior; estadística y modelo solo con meses completos.");
      LI("5. Comprobación: las sumas por mes, por cliente, por tipo de gasto y por código deben coincidir (Anexo A).");
    } else {
      NOTA("Criterios: cada egreso se clasifica por las palabras de su descripción (materia prima y combustible cuentan como gastos que varían con la producción; el resto, como fijos). Un mes está «en curso» si su último registro es anterior al día 25.");
    }

    /* ================= 3. RESULTADOS DE CADA MES ================= */
    d.meses.forEach((dm, i) => {
      const r = dm.r;
      SALTO();
      if (i === 0) {
        H1(secc.res + ". Resultados de cada mes");
        P("Cada mes se presenta por separado y con el mismo orden, para que se puedan leer y comparar con facilidad.");
      }
      H1(secc.res + "." + (i + 1) + " " + dm.nombre + (r.incompleto ? " (en curso)" : ""));

      const antNom = nombreAnt(dm);
      const fv = filasVsAnterior(dm, s2);
      const tablaCifras = () => TAB("Cifras clave de " + dm.nombre.toLowerCase() + " frente a " + antNom.toLowerCase() + " (mes anterior)", ["Indicador", antNom + (dm.ant ? "" : " (sin datos)"), dm.nombre, "Variación"], fv.map(x => x.c), [3.8, 2.3, 2.3, 2], [1, 2, 3],
        (ri, c) => (c === 3 && fv[ri].bueno !== null ? { c: fv[ri].bueno ? C.bueno : C.malo, b: true } : null));
      const colorVer = (dm.veredicto.color || "#8C4633").replace("#", "");
      const caja = () => B.push({ t: "caja", titulo: "Veredicto: " + (dm.veredicto.texto || "—"), texto: dm.veredicto.frase || "", color: colorVer.length === 6 ? colorVer : C.marca });
      const mayor = dm.plata.categorias[0];

      P("Este apartado analiza " + dm.nombre.toLowerCase() + " en 6 pasos, con las ventas y los pagos de ese mes; cada cifra se compara con " + antNom.toLowerCase() + ", su mes anterior.");
      H2("Paso 1 · ¿Ganamos o perdimos?");
      QUE("lo que entró (ventas) menos lo que salió (pagos y gastos), frente al mes anterior.");
      caja();
      tablaCifras();
      FIG(dm.nombre + " frente a " + antNom.toLowerCase() + ": ventas, gastos y resultado", imagenVsAnterior(dm));
      P([R("Lectura: ", { b: true }), fraseVsAnterior(dm)]);

      H2("Paso 2 · ¿En qué se gastó?");
      QUE("cómo se reparten los egresos del mes por tipo de gasto.");
      if (dm.plata.total > 0) {
        const nc = dm.plata.categorias.length;
        TAB("Egresos de " + dm.nombre.toLowerCase() + " por tipo de gasto", ["Tipo de gasto", "Monto", "% de los egresos", "Pagos", "Tipo"],
          dm.plata.categorias.map(c => [c.nombre, s2(c.total), pc(c.pct, 1), num(c.n), c.variable ? "Varía con la producción" : "Fijo"]).concat([["Total", s2(dm.plata.total), "100%", num(dm.plata.n), ""]]),
          [3, 2.2, 1.6, 1, 2.6], [1, 2, 3], ri => (ri === nc ? { b: true } : null));
        FIG("Egresos de " + dm.nombre.toLowerCase() + " por tipo de gasto", imagenGastos(dm.plata));
        P([R("Lectura: ", { b: true }), "el mayor gasto fue " + mayor.nombre.toLowerCase() + " (" + pc(mayor.pct, 1) + "). Los gastos que suben con la producción sumaron " + s2(dm.plata.variables) + " (" + pc((dm.plata.variables / dm.plata.total) * 100, 1) + ") y los fijos, " + s2(dm.plata.fijos) + "."]);
      } else P("No hay egresos registrados en este mes.");
      if (dm.ant && dm.ant.plata.total > 0 && dm.plata.total > 0) {
        const gv = gastosVsAnterior(dm);
        TAB("Egresos por tipo: " + dm.nombre.toLowerCase() + " frente a " + antNom.toLowerCase(), ["Tipo de gasto", antNom, dm.nombre, "Diferencia"],
          gv.map(x => [x.nombre, s2(x.antes), s2(x.ahora), conSigno(x.dif, s2)]).concat([["Total", s2(dm.ant.plata.total), s2(dm.plata.total), conSigno(dm.plata.total - dm.ant.plata.total, s2)]]),
          [3.4, 2.3, 2.3, 2.2], [1, 2, 3], (ri, c) => (ri === gv.length ? { b: true } : c === 3 && gv[ri].dif !== 0 ? { c: gv[ri].dif > 0 ? C.malo : C.bueno } : null));
        if (Math.abs(gv[0].dif) >= 1) P([R("Lectura: ", { b: true }), "lo que más cambió frente a " + antNom.toLowerCase() + " fue " + gv[0].nombre.toLowerCase() + " (" + conSigno(gv[0].dif, s2) + ")."]);
      }

      H2("Paso 3 · ¿Llegamos al punto de equilibrio?");
      QUE("cuántos ladrillos había que vender este mes para que los ingresos pagaran todos sus gastos (ecuaciones 4 y 6).");
      if (dm.eq.disponible && dm.pe) {
        const dif = r.unidades - dm.eq.necesarios;
        TAB("Punto de equilibrio de " + dm.nombre.toLowerCase(), ["Dato", "Valor"], [
          ["Ladrillos vendidos", num(r.unidades)],
          ["Ladrillos necesarios para no perder", num(Math.round(dm.eq.necesarios))],
          ["Diferencia", (dif >= 0 ? "+" : "−") + num(Math.abs(Math.round(dif))) + (dif >= 0 ? " (sobraron)" : " (faltaron)")],
          ["Lo que deja cada ladrillo, p − cv (año " + dm.anio + ")", sU(dm.pe.margen)],
          ["Resultado del mes", s2(r.resultado)],
        ], [6, 4], [1], (ri, c) => (c === 1 && (ri === 2 || ri === 4) ? { c: dm.eq.alcanzado ? C.bueno : C.malo, b: true } : null));
        FIG("Ladrillos vendidos frente a los necesarios en " + dm.nombre.toLowerCase(), imagenEquilibrioMes(dm));
        P([R("Lectura: ", { b: true }), dm.eq.alcanzado ? "se cubrieron todos los gastos y sobraron ≈ " + num(Math.round(dif)) + " ladrillos de margen." : "faltaron ≈ " + num(Math.ceil(dm.eq.faltaLadrillos)) + " ladrillos (≈ " + s0(dm.eq.faltaVentas) + " en ventas) para no perder." + (r.incompleto ? " El mes está en curso y todavía puede cambiar." : "")]);
      } else P(r.unidades > 0 ? "No se puede calcular: el costo variable por ladrillo supera al precio promedio." : "No se puede calcular: faltan los ladrillos vendidos o los egresos del mes.");

      H2("Paso 4 · ¿Quiénes compraron?");
      QUE("qué parte de las ventas del mes hizo cada cliente.");
      if (dm.cl.cantidad) {
        const dep = an.dependencia(dm.cl.top5);
        TAB("Clientes de " + dm.nombre.toLowerCase() + " (los 10 primeros)", ["#", "Cliente", "Compras", "Monto", "% ventas", "% acumulado", "Clase"],
          dm.cl.clientes.slice(0, 10).map((c, k) => [String(k + 1), titulo(c.nombre).slice(0, 38), num(c.n), s2(c.total), pc(c.pct, 1), pc(c.acumulado, 1), c.clase]),
          [0.5, 4.2, 1.1, 2.1, 1.3, 1.6, 0.9], [2, 3, 4, 5]);
        FIG("Ventas por cliente y porcentaje acumulado en " + dm.nombre.toLowerCase(), imagenPareto(dm.cl));
        P([R("Lectura: ", { b: true }), dm.cl.cantidad + " clientes compraron; " + dm.cl.claveA + " hicieron el 80% de las ventas y los 5 mejores, el " + pc(dm.cl.top5, 1) + " (" + dep.texto.toLowerCase() + ")."]);
        const cv = clientesVsAnterior(dm);
        if (cv) P([R("Frente a " + antNom.toLowerCase() + ": ", { b: true }), num(cv.repiten) + " clientes volvieron a comprar y " + num(cv.nuevos.length) + " son nuevos (" + s2(cv.montoNuevos) + " en ventas); " + num(cv.noVolvieron.length) + " de los que compraron en " + antNom.toLowerCase() + " no compraron este mes (en " + antNom.toLowerCase() + " habían comprado " + s2(cv.montoPerdido) + ")."]);
      } else P("No hay ventas registradas en este mes.");

      H2("Paso 5 · ¿Qué ladrillos se vendieron y a qué precio?");
      QUE("ladrillos y dinero por código, y el rango en que se movió el precio (el precio cambia con el volumen de cada venta).");
      if (dm.productos.length) {
        const fp = dm.productos.slice(0, 12).map(x => [x.codigo, num(x.unidades), pc(x.pct, 1), s2(x.monto), sU(x.promedio), sU(x.min), sU(x.max)]);
        if (dm.productos.length > 1) fp.push(["Total", num(dm.totalUnidades), "100%", s2(suma(dm.productos, x => x.monto)), sU(r.precio), "", ""]);
        TAB("Ladrillos vendidos en " + dm.nombre.toLowerCase() + " por código", ["Código", "Ladrillos", "% del total", "Ingresos", "Precio promedio", "Mínimo", "Máximo"], fp, [1.4, 1.6, 1.3, 2.2, 1.8, 1.4, 1.4], [1, 2, 3, 4, 5, 6], ri => (dm.productos.length > 1 && ri === fp.length - 1 ? { b: true } : null));
      } else P("No hay ventas registradas en este mes.");

      H2("Paso 6 · Conclusión de " + dm.nombre.toLowerCase());
      dm.razones.forEach(x => {
        const nv = NIVEL[x.nivel] || NIVEL.regular;
        P([R("• " + nv.texto + "  ", { b: true, c: nv.color }), R(x.nombre + ": ", { b: true }), x.frase + " (" + x.valor + ")."], { compacto: true });
      });
      P([R("Qué hacer:", { b: true })]);
      recomendacionesMes(dm).forEach(t => LI(t));
    });

    /* ================= 4. COMPARACIÓN CON EL MES ANTERIOR =================
       Siempre cada mes frente a su mes calendario anterior (abril con marzo, agosto con julio),
       se hayan elegido meses seguidos o separados. */
    SALTO();
    H1(secc.comp + ". " + tituloComp);
    P("En este capítulo cada mes analizado se pone al lado de su mes anterior, aunque ese mes anterior no se haya elegido. Así se ve, en orden, qué mejoró y qué empeoró de un mes al siguiente.");
    const fe = d.meses.map(dm => {
      const r = dm.r, a = dm.ant ? dm.ant.r : null;
      const pv = (x, y) => (x !== null && y !== null && y > 0 ? pctTxt(variacion(x, y)) : "—");
      return [dm.nombre + (r.incompleto ? " (en curso)" : ""), nombreAnt(dm) + (a ? "" : " (sin datos)"),
        pv(r.hayIng ? r.ingresos : null, a && a.hayIng ? a.ingresos : null),
        pv(r.hayEgr ? r.egresos : null, a && a.hayEgr ? a.egresos : null),
        a && a.hayIng && a.hayEgr && r.hayIng && r.hayEgr ? conSigno(r.resultado - a.resultado, s0) : "—",
        pv(r.unidades > 0 ? r.unidades : null, a && a.unidades > 0 ? a.unidades : null)];
    });
    TAB("Cada mes frente a su mes anterior", ["Mes", "Mes anterior", "Ventas", "Gastos", "Resultado", "Ladrillos"], fe, [2.4, 2.4, 1.6, 1.6, 2, 1.6], [2, 3, 4, 5], (ri, c) => {
      const v = fe[ri][c];
      if (c < 2 || !v || v === "—") return null;
      const sube = /^[▲+]/.test(v);
      return { c: (c === 3 ? !sube : sube) ? C.bueno : C.malo, b: c === 4 };
    });
    NOTA("Ventas, gastos y ladrillos: variación en %. Resultado: diferencia en soles frente al mes anterior. En gastos, bajar es bueno.");
    FIG("Resultado de cada mes frente al de su mes anterior", imagenResultadoVsAnterior(d.meses));
    const conAnt = d.meses.filter(dm => dm.ant && dm.eq.disponible && dm.ant.r.unidades > 0);
    if (conAnt.length) {
      const fq = conAnt.map(dm => [dm.nombre, num(dm.ant.r.unidades), num(dm.r.unidades), dm.pe ? num(Math.round(dm.eq.necesarios)) : "—", dm.eq.alcanzado ? "Cubierto" : "Faltó"]);
      TAB("Ladrillos vendidos: mes anterior, mes y punto de equilibrio del mes", ["Mes", "Mes anterior", "Este mes", "Necesarios", "¿Se cubrió?"], fq, [2.6, 2, 2, 2, 1.6], [1, 2, 3], (ri, c) => (c === 4 ? { c: conAnt[ri].eq.alcanzado ? C.bueno : C.malo, b: true } : null));
    }
    H2("Lectura de la comparación");
    d.meses.forEach(dm => LI(fraseVsAnterior(dm)));

    /* ================= 5. MODELO Y ESTADÍSTICA (solo detallado) ================= */
    if (det) {
      SALTO();
      H1(secc.modelo + ". Modelo y estadística");
      P("Este capítulo aplica herramientas estadísticas a los meses " + (cp.modo === "uno" ? "con datos de " + cp.anio : "analizados") + ". Solo se usan meses completos (" + (mod.compR.length ? unir(mod.compR.map(x => mod.etiqueta(x).toLowerCase())) : "ninguno") + "): un mes en curso todavía puede cambiar.");

      H2(secc.modelo + ".1 Estadística descriptiva");
      if (mod.desc.length) {
        TAB("Estadística descriptiva de los meses completos", ["Variable", "n", "Promedio", "Mediana", "Desv. estándar", "CV", "Mínimo", "Máximo"],
          mod.desc.map(v => [v.nombre, String(v.d.n), v.fmt(v.d.media), v.fmt(v.d.mediana), v.d.s !== null ? v.fmt(v.d.s) : "—", v.d.cv !== null ? pc(v.d.cv, 1) : "—", v.fmt(v.d.min), v.fmt(v.d.max)]),
          [2.4, 0.6, 1.6, 1.6, 1.6, 1, 1.6, 1.6], [1, 2, 3, 4, 5, 6, 7]);
        if (mod.desc.some(v => v.d.s !== null && v.d.cv === null)) NOTA("CV = desviación estándar ÷ promedio × 100 (ecuación 8). Se marca «—» cuando hay meses en pérdida o en cero: con cifras de distinto signo el promedio no representa a los meses y el CV no tiene sentido.");
        const dI = mod.desc.find(v => /^Ingresos/.test(v.nombre));
        if (dI && dI.d.cv !== null) P([R("Lectura: ", { b: true }), "las ventas mensuales promedian " + s0(dI.d.media) + " con una desviación estándar de " + s0(dI.d.s) + " (CV " + pc(dI.d.cv, 1) + "): los meses son " + palabraCv(dI.d.cv) + ". Cuando el promedio y la mediana se parecen, no hay meses extremos que distorsionen el promedio."]);
      } else P("No hay suficientes meses completos para la estadística descriptiva.");

      H2(secc.modelo + ".2 Modelo costo–volumen–utilidad");
      P("El modelo explica el resultado de un mes con tres parámetros calculados de los registros: el precio promedio por ladrillo (p), el costo variable por ladrillo (cv) y los gastos fijos promedio del mes (ecuaciones 3 a 5).");
      mod.cvu.forEach(m => {
        if (!m.pe) { P("Año " + m.anio + ": no se puede aplicar el modelo (faltan ladrillos o el costo variable supera al precio)."); return; }
        TAB("Parámetros del modelo" + (d.anios.length > 1 ? " · año " + m.anio : " (año " + m.anio + ")"), ["Parámetro", "Valor", "Cómo se obtuvo"], [
          ["Precio por ladrillo (p)", sU(m.pe.precio), "Ingresos ÷ ladrillos de los meses completos"],
          ["Costo variable por ladrillo (cv)", sU(m.pe.costoVariable), "(Materia prima + combustible) ÷ ladrillos"],
          ["Lo que deja cada ladrillo (p − cv)", sU(m.pe.margen), pc(m.pe.razonMargen * 100, 1) + " del precio"],
          ["Gastos fijos promedio al mes", s2(m.pe.fijosMes), "Promedio de los meses " + m.pe.meses.map(x => an.MESES_CORTOS[x].toLowerCase()).join(", ")],
          ["Punto de equilibrio (Q*)", num(m.pe.unidadesEq) + " ladrillos", "≈ " + s0(m.pe.solesEq) + " en ventas al mes"],
        ], [3.4, 2.2, 4.4], [1], ri => (ri === 4 ? { b: true } : null));
        if (m.filas.length) {
          TAB("Resultado real frente al resultado del modelo", ["Mes", "Ladrillos", "Resultado real", "Resultado del modelo", "Diferencia"],
            m.filas.map(f => [mod.etiqueta(f.x), num(f.x.unidades), s2(f.real), s2(f.modelo), conSigno(f.dif, s2)]),
            [2.4, 1.8, 2.4, 2.4, 2.2], [1, 2, 3, 4], (ri, c) => (c === 2 ? { c: m.filas[ri].real >= 0 ? C.bueno : C.malo, b: true } : null));
          FIG("Resultado real y resultado del modelo por mes", imagenModelo(m.filas, mod.etiqueta));
          P([R("Lectura: ", { b: true }), "la diferencia promedio entre el modelo y lo real es de " + s0(m.mae) + (m.maePct !== null ? " (" + pc(m.maePct, 1) + " del resultado típico)" : "") + ". Las diferencias aparecen en los meses cuyo precio, costo variable o gastos fijos se alejaron del promedio del año: el modelo resume el negocio, no reemplaza a las cifras reales."]);
        }
      });

      H2(secc.modelo + ".3 Tendencia");
      const tI = mod.tendencia.ingresos, tE = mod.tendencia.egresos;
      if (tI || tE) {
        const lecturaT = (reg, cosa) => (!reg ? "—" : (reg.r2 < 0.5 ? "sin tendencia clara (la recta explica poco)" : (reg.b >= 0 ? cosa + " suben" : cosa + " bajan") + " de forma consistente"));
        TAB("Tendencia lineal de los meses completos (ecuación 9)", ["Variable", "Cambio promedio por mes (b)", "R²", "Lectura"], [
          ["Ventas", tI ? conSigno(tI.b, s0) : "—", tI ? num(tI.r2, 2) : "—", lecturaT(tI, "las ventas")],
          ["Gastos", tE ? conSigno(tE.b, s0) : "—", tE ? num(tE.r2, 2) : "—", lecturaT(tE, "los gastos")],
        ], [1.6, 2.6, 1, 4.8], [1, 2]);
        FIG("Ventas y gastos por mes con su recta de tendencia", imagenTendencia(mod));
        NOTA("R² va de 0 a 1: cerca de 1, los meses siguen la recta; cerca de 0, suben y bajan sin un patrón. Con pocos meses la tendencia es solo orientativa.");
      } else P("Se necesitan al menos 3 meses completos para calcular una tendencia.");

      H2(secc.modelo + ".4 Relación entre variables");
      if (mod.relaciones.length) {
        TAB("Correlación de Pearson entre variables mensuales (ecuación 10)", ["Variables", "r", "n", "Lectura"],
          mod.relaciones.map(x => [x.nombre, num(x.p.r, 2), String(x.p.n), "Relación " + palabraR(x.p.r)]), [3.6, 1, 0.8, 4.6], [1, 2]);
        NOTA("Una correlación indica que dos cifras se mueven juntas; no demuestra que una cause la otra.");
      } else P("Se necesitan al menos 3 meses completos para medir relaciones entre variables.");

      H2(secc.modelo + ".5 Concentración de clientes (regla 80/20)");
      if (mod.pareto) P("De " + mod.pareto.n + " clientes, el 20% más grande (" + mod.pareto.k + " clientes) hizo el " + pc(mod.pareto.pct, 1) + " de las ventas; " + mod.pareto.claveA + " clientes bastan para llegar al 80%. " + (mod.pareto.pct >= 80 ? "Se cumple la regla 80/20: las ventas dependen de pocos clientes." : mod.pareto.pct >= 60 ? "Hay una concentración moderada." : "Las ventas están bien repartidas."));
      else P("No hay ventas para medir la concentración.");
    }

    /* ================= DISCUSIÓN ================= */
    SALTO();
    H1(secc.disc + ". Discusión");
    discusion(d, mod).forEach(p => P(p));

    /* ================= LIMITACIONES (detallado) ================= */
    if (det) {
      H1(secc.lim + ". Limitaciones");
      LI("El análisis depende de lo registrado en los Excel: una venta o un pago que no se registró no aparece en ninguna cifra.");
      LI("Con pocos meses, la estadística, la tendencia y las correlaciones son orientativas" + (mod.compR.length ? " (aquí se usaron " + mod.compR.length + " meses completos)" : "") + ".");
      if (d.incompletos.length) LI(unir(d.incompletos) + (d.incompletos.length > 1 ? " están" : " está") + " en curso: sus cifras pueden cambiar y no entran en la estadística.");
      LI("Cada egreso se clasifica por las palabras de su descripción; un gasto mal descrito puede quedar en «Otros».");
      LI("Los montos que en el Excel tenían «$» se leyeron como soles, porque la empresa trabaja solo en soles.");
      if (q.sinUnidades) LI(q.sinUnidades + " venta(s) no traen ladrillos (" + s2(q.sinUnidadesTotal) + "): suman a los ingresos pero no al conteo de ladrillos.");
    }

    /* ================= CONCLUSIONES Y RECOMENDACIONES ================= */
    H1(secc.concl + ". Conclusiones y recomendaciones");
    H2("Conclusiones");
    conclusiones(d, mod).forEach((t, k) => LI([R((k + 1) + ". ", { b: true }), t]));
    H2("Recomendaciones");
    recomendacionesFinales(d, mod).forEach((t, k) => LI([R((k + 1) + ". ", { b: true }), t]));

    /* ================= ANEXOS (detallado) ================= */
    if (det) {
      SALTO();
      H1("Anexo A. Datos usados y comprobaciones");
      const fq = [
        ["Meses incluidos", unir(d.meses.map(dm => dm.nombre))],
        ["Ventas (ingresos) usadas", num(q.nIng) + (q.ingDesde ? " · del " + fechaTxt(q.ingDesde) + " al " + fechaTxt(q.ingHasta) : "")],
        ["Pagos (egresos) usados", num(q.nEgr) + (q.egrDesde ? " · del " + fechaTxt(q.egrDesde) + " al " + fechaTxt(q.egrHasta) : "")],
        ["Datos repetidos", q.repetidos && (q.repetidos.kIng > 1 || q.repetidos.kEgr > 1) ? "SÍ: ingresos ×" + q.repetidos.kIng + ", egresos ×" + q.repetidos.kEgr : "No: cada registro está cargado una sola vez"],
      ].concat(q.comprobaciones.map(c => [c.nombre, c.ok ? "Correcto" : "No coincide (diferencia " + s2(c.dif) + ")"]));
      TAB("Datos usados y comprobaciones de sumas", ["Dato", "Valor"], fq, [5, 5], [], (ri, c) => (c === 1 && /^Correcto/.test(fq[ri][1]) ? { c: C.bueno, b: true } : c === 1 && /^(No coincide|SÍ)/.test(fq[ri][1]) ? { c: C.malo, b: true } : null), "");
      NOTA("Las comprobaciones vuelven a sumar por otro camino (por mes, por cliente, por tipo de gasto y por código) y deben dar exactamente lo mismo.");
      H1("Anexo B. Glosario");
      [["Ingresos", "dinero que entra por ventas."], ["Egresos", "dinero que sale en pagos y gastos."], ["Resultado", "ingresos − egresos; positivo es ganancia, negativo es pérdida."], ["Margen neto", "lo que queda de cada S/ 100 vendidos después de pagar todo."], ["Costo variable", "gasto que sube con cada ladrillo producido (materia prima y combustible)."], ["Gasto fijo", "gasto que no depende de cuántos ladrillos se producen (planilla, alquiler, luz…)."], ["Punto de equilibrio", "ladrillos que hay que vender para no ganar ni perder."], ["Mediana", "el valor del medio cuando los meses se ordenan de menor a mayor."], ["Desviación estándar", "cuánto se aleja, en promedio, cada mes de su promedio."], ["Coeficiente de variación", "la desviación estándar como % del promedio; menos es más estable."], ["R²", "qué tanto sigue una recta a los datos (0 a 1)."], ["Correlación (r)", "qué tanto se mueven juntas dos cifras (−1 a +1)."], ["Mes en curso", "mes cuyo último registro es anterior al día 25; puede cambiar."]]
        .forEach(g => LI([R(g[0] + ": ", { b: true }), g[1]]));
    }
    NOTA("Informe generado con los ingresos y egresos registrados en el sistema de " + EMPRESA.replace(/\.$/, "") + ". Cifras en soles (S/): miles con coma y decimales con punto.");
    return B;
  }

  // Una frase que resume lo más importante (para el resumen)
  function conclusionPrincipal(d) {
    const cp = d.comp;
    if (cp.modo === "uno") {
      const dm = d.meses[0], r = dm.r;
      if (!(r.hayIng && r.hayEgr)) return "Falta registrar los " + (r.hayIng ? "egresos" : "ingresos") + " de " + dm.nombre.toLowerCase() + " para saber si se ganó o se perdió.";
      const pr = cp.puestos.resultado;
      return dm.nombre + (r.resultado >= 0 ? " cerró con ganancia" : " cerró con pérdida") + (pr && pr.de > 1 ? " y quedó en el puesto " + pr.puesto + " de " + pr.de + " meses por resultado" : "") + ". Veredicto del sistema: " + dm.veredicto.texto.toLowerCase() + ".";
    }
    const T = cp.total;
    const ganados = cp.completos.filter(dm => dm.r.resultado >= 0).length;
    return "El período " + (T.resultado >= 0 ? "dejó ganancia" : "dejó pérdida") + (cp.completos.length ? " y " + ganados + " de " + cp.completos.length + " meses completos cerraron en positivo" : "") + "; " + (T.margenPct !== null && T.margenPct < 15 ? "el margen neto (" + pc(T.margenPct, 1) + ") es bajo y conviene cuidar los gastos." : "el margen neto es de " + pc(T.margenPct, 1) + ".");
  }

  // Discusión: explica los resultados con los mismos datos
  function discusion(d, mod) {
    const cp = d.comp;
    const out = [];
    // 1. ¿Qué explica los meses con pérdida?
    const serieComp = mod.compR;
    const perdidos = serieComp.filter(x => x.resultado < 0);
    perdidos.forEach(x => {
      const otros = serieComp.filter(y => y !== x);
      if (!otros.length) return;
      const pI = media(otros.map(y => y.ingresos)), pE = media(otros.map(y => y.egresos));
      const dI = x.ingresos - pI, dE = x.egresos - pE;
      const causa = -dI >= dE ? "principalmente a que las ventas fueron " + s0(Math.abs(dI)) + " " + (dI < 0 ? "menores" : "mayores") + " que el promedio de los otros meses" : "principalmente a que los gastos fueron " + s0(Math.abs(dE)) + " " + (dE > 0 ? "mayores" : "menores") + " que el promedio de los otros meses";
      out.push([R("Pérdida de " + mod.etiqueta(x).toLowerCase() + ". ", { b: true }), "La pérdida de " + s0(Math.abs(x.resultado)) + " se debe " + causa + " (ventas " + s0(x.ingresos) + " frente a " + s0(pI) + "; gastos " + s0(x.egresos) + " frente a " + s0(pE) + ")."]);
    });
    if (!perdidos.length && serieComp.length) out.push([R("Resultados. ", { b: true }), "Todos los meses completos analizados cerraron con ganancia."]);
    // 2. Estructura de costos
    const meses = d.meses.filter(dm => dm.plata.total > 0);
    if (meses.length) {
      const tot = suma(meses, dm => dm.plata.total), vari = suma(meses, dm => dm.plata.variables);
      out.push([R("Estructura de costos. ", { b: true }), "De cada S/ 100 gastados, S/ " + num((vari / tot) * 100, 1) + " suben con la producción (materia prima y combustible) y S/ " + num(((tot - vari) / tot) * 100, 1) + " son fijos. " + ((tot - vari) / tot > 0.6 ? "Con tantos gastos fijos, el negocio necesita un volumen alto de ventas para no perder: los meses flojos pesan mucho." : "Buena parte del gasto acompaña a la producción, así que baja cuando se vende menos.")]);
    }
    // 3. Distancia al punto de equilibrio
    const pe = d.meses[0].pe;
    const conU = mod.compI.filter(x => x.unidades > 0);
    if (pe && pe.margen > 0 && conU.length) {
      const prom = media(conU.map(x => x.unidades));
      const dif = ((prom - pe.unidadesEq) / pe.unidadesEq) * 100;
      out.push([R("Punto de equilibrio. ", { b: true }), "En los meses completos se vendieron en promedio " + num(Math.round(prom)) + " ladrillos al mes, un " + num(Math.abs(dif), 1) + "% " + (dif >= 0 ? "por encima" : "por debajo") + " del punto de equilibrio (" + num(pe.unidadesEq) + "). " + (dif >= 0 ? "Hay margen, pero un mes con menos ventas o más gastos puede terminar en pérdida." : "En promedio no se llega a cubrir los gastos: hay que vender más o gastar menos.")]);
    }
    // 4. Concentración
    if (mod.pareto) out.push([R("Clientes. ", { b: true }), "El 20% de los clientes (" + mod.pareto.k + " de " + mod.pareto.n + ") hizo el " + pc(mod.pareto.pct, 1) + " de las ventas. " + (mod.pareto.pct >= 60 ? "Perder a uno de ellos afectaría mucho los ingresos." : "El riesgo por dependencia es bajo.")]);
    // 5. Estabilidad y tendencia
    const dI = mod.desc.find(v => /^Ingresos/.test(v.nombre));
    if (dI && dI.d.cv !== null) {
      const tI = mod.tendencia.ingresos;
      out.push([R("Estabilidad. ", { b: true }), "Las ventas de los meses completos fueron " + palabraCv(dI.d.cv) + " (coeficiente de variación " + pc(dI.d.cv, 1) + ")" + (tI ? (tI.r2 >= 0.5 ? " y muestran una tendencia a " + (tI.b >= 0 ? "subir" : "bajar") + " de ≈ " + s0(Math.abs(tI.b)) + " por mes." : ", sin una tendencia clara en el tiempo.") : ".")]);
    }
    if (!out.length) out.push("No hay datos suficientes para discutir los resultados.");
    return out;
  }

  function conclusiones(d, mod) {
    const out = [conclusionPrincipal(d)];
    const cp = d.comp;
    if (cp.modo === "varios" && cp.mejor && cp.mejor !== cp.peor) out.push("El mejor mes fue " + cp.mejor.nombre.toLowerCase() + " (" + s0(cp.mejor.r.resultado) + ") y el peor, " + cp.peor.nombre.toLowerCase() + " (" + s0(cp.peor.r.resultado) + ").");
    const mayor = d.meses.map(dm => dm.plata.categorias[0]).filter(Boolean);
    if (mayor.length) {
      const cuenta = {};
      mayor.forEach(c => { cuenta[c.nombre] = (cuenta[c.nombre] || 0) + 1; });
      const top = Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a])[0];
      out.push("El gasto más grande fue «" + top.toLowerCase() + "» en " + cuenta[top] + " de " + mayor.length + " mes(es).");
    }
    const pe = d.meses[0].pe;
    const faltas = d.meses.filter(dm => dm.eq.disponible && !dm.eq.alcanzado && !dm.r.incompleto);
    if (pe && pe.margen > 0) out.push("El punto de equilibrio es de ≈ " + num(pe.unidadesEq) + " ladrillos al mes; " + (faltas.length ? "no se alcanzó en " + unir(faltas.map(dm => dm.nombre.toLowerCase())) + "." : "se alcanzó en todos los meses completos analizados."));
    if (mod.pareto) out.push("Las ventas " + (mod.pareto.pct >= 60 ? "dependen de pocos clientes" : "están repartidas entre muchos clientes") + ": el 20% de ellos hizo el " + pc(mod.pareto.pct, 1) + ".");
    return out;
  }

  // Recomendaciones: cada una es una acción concreta apoyada en una cifra de los mismos datos
  function recomendacionesFinales(d, mod) {
    const cp = d.comp;
    const out = [];
    const pe = d.meses[0].pe;
    // 1. Meses con pérdida (con un solo mes elegido, solo ese mes): qué revisar primero
    const foco = cp.modo === "uno" ? mod.compR.filter(x => x.anio === cp.anio && x.mes === cp.mes) : mod.compR;
    foco.filter(x => x.resultado < 0).forEach(x => {
      const otros = mod.compR.filter(y => y !== x);
      if (!otros.length) return;
      const dI = x.ingresos - media(otros.map(y => y.ingresos)), dE = x.egresos - media(otros.map(y => y.egresos));
      const mes = d.an.MESES_TITULO[x.mes].toLowerCase() + " de " + x.anio;
      out.push(-dI >= dE
        ? "Recuperar el nivel de ventas: en " + mes + " se vendió " + s0(Math.abs(dI)) + " menos que el promedio de los otros meses; contactar a los clientes que bajaron sus compras."
        : "Revisar los pagos de " + mes + ": los gastos fueron " + s0(dE) + " mayores que el promedio de los otros meses; separar los pagos únicos de los que se repetirán.");
    });
    // 2. Meta mínima de ventas
    if (pe && pe.margen > 0) out.push("Fijar como meta mínima ≈ " + num(pe.unidadesEq) + " ladrillos al mes (≈ " + s0(pe.solesEq) + " en ventas): es el punto de equilibrio; por debajo, el mes termina en pérdida.");
    // 3. Gastos fijos
    const conGasto = d.meses.filter(dm => dm.plata.total > 0);
    if (conGasto.length) {
      const tot = suma(conGasto, dm => dm.plata.total), fijo = ((tot - suma(conGasto, dm => dm.plata.variables)) / tot) * 100;
      if (fijo > 60) out.push("Controlar los gastos fijos: son S/ " + num(fijo, 1) + " de cada S/ 100 gastados y no bajan en los meses de pocas ventas.");
    }
    // 4. Margen neto bajo
    const T = cp.modo === "varios" ? cp.total : d.meses[0].r;
    if (T.hayIng && T.hayEgr && T.margenPct !== null && T.margenPct < 15 && pe && pe.margen > 0) out.push("Mejorar el margen neto (" + pc(T.margenPct, 1) + "): revisar los precios por volumen (hoy ≈ " + sU(pe.precio) + " por ladrillo) y el costo variable (≈ " + sU(pe.costoVariable) + " por ladrillo).");
    // 5. Clientes que dejaron de comprar y dependencia
    if (cp.modo === "varios" && cp.dejaron.lista.length) out.push("Contactar a los " + cp.dejaron.lista.length + " clientes que compraban y no aparecen en " + unir(cp.dejaron.ventana.map(x => x.toLowerCase())) + ".");
    if (mod.pareto && mod.pareto.pct >= 60) out.push("Cuidar a los " + mod.pareto.k + " clientes principales (" + pc(mod.pareto.pct, 1) + " de las ventas) y sumar compradores nuevos para depender menos de ellos.");
    // 6. Datos que faltan o que todavía pueden cambiar
    d.meses.filter(dm => dm.r.hayDatos && !(dm.r.hayIng && dm.r.hayEgr)).forEach(dm => out.push("Registrar los " + (dm.r.hayIng ? "egresos" : "ingresos") + " de " + dm.nombre.toLowerCase() + ": sin ellos no se puede saber si el mes ganó o perdió."));
    if (d.incompletos.length) out.push("Terminar de registrar " + unir(d.incompletos.map(x => x.toLowerCase())) + " y volver a generar el informe cuando el mes cierre.");
    if (!out.length) out.push("Mantener el ritmo actual y seguir registrando cada venta y cada pago para comparar los próximos meses.");
    return out.slice(0, 8);
  }

  // Meses del informe en una frase: «abril a agosto de 2026», «abril, junio y agosto de 2026»
  function frasePeriodo(d) {
    const grupos = [];
    d.meses.forEach(dm => {
      let g = grupos.find(x => x.anio === dm.anio);
      if (!g) grupos.push((g = { anio: dm.anio, meses: [] }));
      g.meses.push(dm.mes);
    });
    const nom = m => d.an.MESES_TITULO[m].toLowerCase();
    return unir(grupos.map(g => {
      const ms = g.meses.slice().sort((a, b) => a - b);
      const seguidos = ms.length > 2 && ms[ms.length - 1] - ms[0] === ms.length - 1;
      return (seguidos ? nom(ms[0]) + " a " + nom(ms[ms.length - 1]) : unir(ms.map(nom))) + " de " + g.anio;
    }));
  }

  /* ======================================================================
     VISTA PREVIA: los mismos bloques dibujados como hojas dentro de la página
     ====================================================================== */
  function aHtml(B) {
    const col = c => (c ? (c.charAt(0) === "#" ? c : "#" + c) : "");
    const partes = arr => arr.map(x => {
      if (typeof x === "string") return esc(x);
      const st = (x.c ? "color:" + col(x.c) + ";" : "") + (x.b ? "font-weight:700;" : "") + (x.i ? "font-style:italic;" : "");
      return st ? '<span style="' + st + '">' + esc(x.t) + "</span>" : esc(x.t);
    }).join("");
    const hojas = [[]];
    let lista = null;
    const cerrar = () => { if (lista) { hojas[hojas.length - 1].push("<ul>" + lista.join("") + "</ul>"); lista = null; } };
    B.forEach(b => {
      if (b.t !== "li") cerrar();
      const h = hojas[hojas.length - 1];
      if (b.t === "salto") { hojas.push([]); return; }
      if (b.t === "portada") h.push('<p class="pv-empresa">' + esc(b.empresa) + '</p><h1 class="pv-titulo">' + esc(b.titulo) + '</h1><p class="pv-sub">' + esc(b.sub) + "</p>");
      else if (b.t === "cubierta") h.push('<div class="pv-cubierta"><p class="pv-c-emp">' + esc(b.empresa) + '</p><p class="pv-c-tipo">' + esc(b.tipoDoc) + '</p><h1 class="pv-c-tit">' + esc(b.titulo) + '</h1><p class="pv-c-sub">' + esc(b.subtitulo) + "</p>" + b.lineas.map(l => '<p class="pv-c-lin">' + esc(l) + "</p>").join("") + "</div>");
      else if (b.t === "ec") h.push('<div class="pv-ec"><span>' + esc(b.texto) + "</span><em>(" + b.num + ")</em></div>");
      else if (b.t === "caja") h.push('<div class="pv-caja" style="--c:' + col(b.color) + '"><b>' + esc(b.titulo) + "</b><p>" + esc(b.texto) + "</p></div>");
      else if (b.t === "h1") h.push("<h2 class=\"pv-h1\">" + esc(b.texto) + "</h2>");
      else if (b.t === "h2") h.push("<h3 class=\"pv-h2\">" + esc(b.texto) + "</h3>");
      else if (b.t === "p") h.push("<p" + (b.compacto ? ' class="pv-compacto"' : "") + ">" + partes(b.partes) + "</p>");
      else if (b.t === "li") (lista = lista || []).push("<li>" + partes(b.partes) + "</li>");
      else if (b.t === "nota") h.push('<p class="pv-nota">' + esc(b.texto) + "</p>");
      else if (b.t === "img") h.push('<figure class="pv-fig"><img class="pv-img" src="' + b.img.url + '" alt="">' + (b.titulo ? "<figcaption>" + esc(b.titulo) + "</figcaption>" : "") + "</figure>");
      else if (b.t === "tabla") {
        const total = b.anchos.reduce((s, x) => s + x, 0);
        if (b.titulo) h.push('<p class="pv-cap">' + esc(b.titulo) + "</p>");
        h.push('<table class="pv-tabla"><colgroup>' + b.anchos.map(x => '<col style="width:' + ((x / total) * 100).toFixed(1) + '%">').join("") + "</colgroup><thead><tr>" +
          b.cab.map((t, i) => '<th class="' + (b.derecha.indexOf(i) >= 0 ? "pv-der" : "") + '">' + esc(t) + "</th>").join("") + "</tr></thead><tbody>" +
          b.filas.map((f, ri) => "<tr>" + f.map((t, i) => {
            const o = b.estilo(ri, i);
            const st = o ? (o.c ? "color:" + col(o.c) + ";" : "") + (o.b ? "font-weight:700;" : "") : "";
            return '<td class="' + (b.derecha.indexOf(i) >= 0 ? "pv-der" : "") + '"' + (st ? ' style="' + st + '"' : "") + ">" + esc(t) + "</td>";
          }).join("") + "</tr>").join("") + "</tbody></table>");
        if (b.fuente) h.push('<p class="pv-fuente">' + esc(b.fuente) + "</p>");
      }
    });
    cerrar();
    return hojas.filter(h => h.length).map((h, i, todas) => '<article class="pv-hoja"><div class="pv-cab">' + esc(EMPRESA) + "</div>" + h.join("") + '<div class="pv-pie">Página ' + (i + 1) + " de " + todas.length + "</div></article>").join("");
  }

  /* ======================================================================
     WORD (.docx)
     ====================================================================== */
  function cargarScript(url, comprobar, mensaje) {
    if (comprobar()) return Promise.resolve();
    if (cargas[url]) return cargas[url];
    cargas[url] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = url;
      s.onload = () => (comprobar() ? resolve() : reject(new Error(mensaje)));
      s.onerror = () => { delete cargas[url]; reject(new Error(mensaje + " Revisa tu conexión a internet.")); };
      document.head.appendChild(s);
    });
    return cargas[url];
  }
  const cargas = {};
  function cargarDocx() { return cargarScript(DOCX_URL, () => !!window.docx, "No se pudo cargar la librería de Word.").then(() => window.docx); }
  function cargarPdf() {
    return cargarScript(PDFMAKE_URL, () => !!window.pdfMake, "No se pudo cargar la librería de PDF.")
      .then(() => cargarScript(PDFFONTS_URL, () => !!(window.pdfMake && window.pdfMake.vfs && Object.keys(window.pdfMake.vfs).length), "No se pudieron cargar las letras del PDF."))
      .then(() => window.pdfMake);
  }

  function aWord(D, B, d, tipo) {
    const { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, ImageRun, ShadingType, BorderStyle, Header, Footer, PageNumber, VerticalAlign } = D;
    const ANCHO = 9746;   // ancho útil de la hoja A4 con márgenes de 1,9 cm
    const run = (t, o) => new TextRun(Object.assign({ text: String(t), font: "Calibri", size: 22, color: C.tinta }, o || {}));
    const runs = (partes, base) => partes.map(x => (typeof x === "string" ? run(x, base) : run(x.t, Object.assign({}, base || {}, { bold: !!x.b, italics: !!x.i }, x.c ? { color: x.c } : {}, x.s ? { size: Math.round(x.s * 2) } : {}))));
    const borde = { style: BorderStyle.SINGLE, size: 4, color: C.linea };
    const hijos = [];

    function tabla(b) {
      const total = b.anchos.reduce((s, x) => s + x, 0);
      const anch = b.anchos.map(x => Math.round((x / total) * ANCHO));
      const celda = (t, i, esCab, zebra, o) => new TableCell({
        width: { size: anch[i], type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 55, bottom: 55, left: 100, right: 100 },
        shading: esCab ? { type: ShadingType.CLEAR, fill: C.marca, color: "auto" } : zebra ? { type: ShadingType.CLEAR, fill: C.crema, color: "auto" } : undefined,
        children: [new Paragraph({ alignment: b.derecha.indexOf(i) >= 0 ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [run(t, Object.assign({ size: 19, bold: !!esCab, color: esCab ? "FFFFFF" : C.tinta }, o ? { bold: !!o.b, color: o.c || C.tinta } : {}))] })],
      });
      return new Table({
        width: { size: ANCHO, type: WidthType.DXA },
        columnWidths: anch,
        borders: { top: borde, bottom: borde, left: borde, right: borde, insideHorizontal: borde, insideVertical: borde },
        rows: [new TableRow({ tableHeader: true, cantSplit: true, children: b.cab.map((t, i) => celda(t, i, true, false)) })].concat(
          b.filas.map((f, ri) => new TableRow({ cantSplit: true, children: f.map((t, i) => celda(t, i, false, ri % 2 === 1, b.estilo(ri, i))) }))
        ),
      });
    }

    function caja(b) {
      const bo = { style: BorderStyle.SINGLE, size: 4, color: b.color };
      return new Table({
        width: { size: ANCHO, type: WidthType.DXA },
        columnWidths: [ANCHO],
        borders: { top: bo, bottom: bo, right: bo, left: { style: BorderStyle.SINGLE, size: 36, color: b.color }, insideHorizontal: bo, insideVertical: bo },
        rows: [new TableRow({ children: [new TableCell({
          width: { size: ANCHO, type: WidthType.DXA },
          margins: { top: 110, bottom: 110, left: 200, right: 160 },
          shading: { type: ShadingType.CLEAR, fill: C.crema, color: "auto" },
          children: [
            new Paragraph({ spacing: { after: 50 }, children: [run(b.titulo, { size: 30, bold: true, color: b.color })] }),
            new Paragraph({ spacing: { after: 0, line: 300 }, children: [run(b.texto, { size: 22 })] }),
          ],
        })] })],
      });
    }

    B.forEach(b => {
      if (b.t === "portada") {
        hijos.push(new Paragraph({ spacing: { after: 40 }, children: [run(b.empresa, { size: 22, bold: true, color: C.marca })] }));
        hijos.push(new Paragraph({ spacing: { after: 40 }, children: [run(b.titulo, { size: 44, bold: true })] }));
        hijos.push(new Paragraph({ spacing: { after: 220 }, children: [run(b.sub, { size: 22, color: C.suave })] }));
      } else if (b.t === "cubierta") {
        const centro = (texto, o, esp) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: esp, children: [run(texto, o)] });
        hijos.push(centro(b.empresa, { size: 30, bold: true, color: C.marca }, { before: 2000, after: 120 }));
        hijos.push(centro(b.tipoDoc, { size: 21, color: C.suave }, { after: 900 }));
        hijos.push(centro(b.titulo, { size: 50, bold: true }, { after: 200 }));
        hijos.push(centro(b.subtitulo, { size: 30, color: C.marca }, { after: 1400 }));
        b.lineas.forEach(l => hijos.push(centro(l, { size: 20, color: C.suave }, { after: 80 })));
      } else if (b.t === "ec") {
        hijos.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 90 }, shading: { type: ShadingType.CLEAR, fill: "F3F8FD", color: "auto" }, children: [run(b.texto, { size: 20, italics: true, color: "1E3A5F" }), run("      (" + b.num + ")", { size: 18, color: C.suave })] }));
      } else if (b.t === "caja") hijos.push(caja(b));
      else if (b.t === "h1") hijos.push(new Paragraph({ spacing: { before: 280, after: 110 }, keepNext: true, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.marca, space: 2 } }, children: [run(b.texto, { size: 30, bold: true, color: C.marca })] }));
      else if (b.t === "h2") hijos.push(new Paragraph({ spacing: { before: 180, after: 80 }, keepNext: true, children: [run(b.texto, { size: 24, bold: true })] }));
      else if (b.t === "p") hijos.push(new Paragraph({ spacing: b.compacto ? { after: 70, line: 290 } : { after: 100, line: 300 }, children: runs(b.partes) }));
      else if (b.t === "li") hijos.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 70, line: 290 }, children: runs(b.partes) }));
      else if (b.t === "nota") hijos.push(new Paragraph({ spacing: { after: 100, line: 300 }, children: [run(b.texto, { size: 18, italics: true, color: C.suave })] }));
      else if (b.t === "tabla") {
        if (b.titulo) hijos.push(new Paragraph({ keepNext: true, spacing: { before: 140, after: 60 }, children: [run(b.titulo, { size: 19, bold: true })] }));
        hijos.push(tabla(b));
        if (b.fuente) hijos.push(new Paragraph({ spacing: { before: 40, after: 120 }, children: [run(b.fuente, { size: 16, italics: true, color: C.suave })] }));
        else hijos.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
      }
      else if (b.t === "img") {
        hijos.push(new Paragraph({ alignment: AlignmentType.CENTER, keepNext: !!b.titulo, spacing: { before: 80, after: b.titulo ? 20 : 120 }, children: [new ImageRun({ data: b.img.bytes, type: "png", transformation: { width: 620, height: Math.round((620 * b.img.alto) / b.img.ancho) } })] }));
        if (b.titulo) hijos.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 140 }, children: [run(b.titulo, { size: 18, bold: true, color: C.suave })] }));
      }
      else if (b.t === "salto") hijos.push(new Paragraph({ pageBreakBefore: true, children: [] }));
    });

    return new Document({
      creator: EMPRESA,
      title: (tipo === "detallado" ? "Informe detallado" : "Informe general") + " – " + d.periodo,
      styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 900, left: 1080, right: 1080 } } },
        headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [run(EMPRESA + "  ·  " + d.periodo, { size: 16, color: C.suave })] })] }) },
        footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run("Página ", { size: 16, color: C.suave }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: C.suave, font: "Calibri" }), run(" de ", { size: 16, color: C.suave }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: C.suave, font: "Calibri" })] })] }) },
        children: hijos,
      }],
    });
  }

  // Compatibilidad: arma el Word directamente desde los datos
  function construirWord(D, d, tipo) { return aWord(D, armarBloques(d, tipo), d, tipo); }

  /* ======================================================================
     PDF (pdfmake)
     ====================================================================== */
  function aPdf(B, d, tipo) {
    const ANCHO = 515;   // ancho útil de la hoja A4 con márgenes de 40 pt
    const col = c => (c && c.charAt(0) === "#" ? c : "#" + c);
    // La letra del PDF no trae los triángulos: se quitan (queda el signo + o −)
    const L = s => String(s).replace(/[▲▼]\s?/g, "");
    const txt = partes => partes.map(x => (typeof x === "string" ? { text: L(x) } : { text: L(x.t), bold: !!x.b, italics: !!x.i, color: x.c ? col(x.c) : undefined, fontSize: x.s })).map(x => {
      // pdfmake ignora las claves con valor undefined, pero se limpian por claridad
      Object.keys(x).forEach(k => x[k] === undefined && delete x[k]);
      return x;
    });
    const contenido = [];
    let lista = null;
    const cerrarLista = () => { if (lista) { contenido.push({ ul: lista, margin: [4, 0, 0, 6], markerColor: col(C.marca) }); lista = null; } };

    B.forEach(b => {
      if (b.t !== "li") cerrarLista();
      if (b.t === "portada") {
        contenido.push({ text: b.empresa, bold: true, color: col(C.marca), fontSize: 11 });
        contenido.push({ text: b.titulo, bold: true, fontSize: 22, margin: [0, 2, 0, 2] });
        contenido.push({ text: b.sub, color: col(C.suave), fontSize: 10.5, margin: [0, 0, 0, 12] });
      } else if (b.t === "cubierta") {
        contenido.push({ stack: [
          { text: b.empresa, fontSize: 16, bold: true, color: col(C.marca), alignment: "center", margin: [0, 110, 0, 6] },
          { text: b.tipoDoc, fontSize: 10.5, color: col(C.suave), alignment: "center", margin: [0, 0, 0, 60] },
          { text: b.titulo, fontSize: 25, bold: true, alignment: "center", margin: [0, 0, 0, 10] },
          { text: b.subtitulo, fontSize: 15, color: col(C.marca), alignment: "center", margin: [0, 0, 0, 90] },
        ].concat(b.lineas.map(l => ({ text: L(l), fontSize: 10, color: col(C.suave), alignment: "center", margin: [0, 0, 0, 4] }))) });
      } else if (b.t === "ec") {
        contenido.push({ table: { widths: ["*", 26], body: [[{ text: L(b.texto), italics: true, color: "#1E3A5F", alignment: "center" }, { text: "(" + b.num + ")", color: col(C.suave), alignment: "right" }]] }, layout: { fillColor: () => "#F3F8FD", hLineWidth: () => 0, vLineWidth: () => 0, paddingTop: () => 4, paddingBottom: () => 4 }, margin: [0, 1, 0, 5] });
      } else if (b.t === "caja") {
        const c = col(b.color);
        contenido.push({
          table: { widths: ["*"], body: [[{ stack: [{ text: b.titulo, bold: true, fontSize: 15, color: c }, { text: b.texto, margin: [0, 3, 0, 0] }], fillColor: col(C.crema), margin: [6, 5, 6, 5] }]] },
          layout: { hLineWidth: () => 0.6, vLineWidth: i => (i === 0 ? 4 : 0.6), hLineColor: () => c, vLineColor: () => c },
          margin: [0, 0, 0, 8],
        });
      } else if (b.t === "h1") {
        contenido.push({ unbreakable: true, margin: [0, 14, 0, 6], stack: [{ text: b.texto, bold: true, fontSize: 15, color: col(C.marca) }, { canvas: [{ type: "line", x1: 0, y1: 3, x2: ANCHO, y2: 3, lineWidth: 1.2, lineColor: col(C.marca) }] }] });
      } else if (b.t === "h2") {
        contenido.push({ text: b.texto, bold: true, fontSize: 12, margin: [0, 8, 0, 4] });
      } else if (b.t === "p") {
        contenido.push({ text: txt(b.partes), margin: [0, 0, 0, b.compacto ? 3 : 6] });
      } else if (b.t === "li") {
        (lista = lista || []).push({ text: txt(b.partes), margin: [0, 0, 0, 3] });
      } else if (b.t === "nota") {
        contenido.push({ text: b.texto, italics: true, fontSize: 8.5, color: col(C.suave), margin: [0, 0, 0, 6] });
      } else if (b.t === "tabla") {
        const total = b.anchos.reduce((s, x) => s + x, 0);
        const widths = b.anchos.map(x => (x / total) * ANCHO - 10.4);   // pdfmake suma el relleno (5 pt a cada lado) al ancho de cada columna
        const celda = (t, i, esCab, o) => ({ text: L(t), alignment: b.derecha.indexOf(i) >= 0 ? "right" : "left", fontSize: 9, bold: esCab || !!(o && o.b), color: esCab ? "#FFFFFF" : (o && o.c ? col(o.c) : col(C.tinta)) });
        const tablaPdf = {
          table: { headerRows: 1, dontBreakRows: true, widths, body: [b.cab.map((t, i) => celda(t, i, true))].concat(b.filas.map((f, ri) => f.map((t, i) => celda(t, i, false, b.estilo(ri, i))))) },
          layout: { fillColor: ri => (ri === 0 ? col(C.marca) : ri % 2 === 0 ? col(C.crema) : null), hLineColor: () => col(C.linea), vLineColor: () => col(C.linea), hLineWidth: () => 0.5, vLineWidth: () => 0.5, paddingTop: () => 3, paddingBottom: () => 3, paddingLeft: () => 5, paddingRight: () => 5 },
          margin: [0, 0, 0, 8],
        };
        // Título arriba, fuente abajo; una tabla corta nunca se parte entre dos páginas
        const piezas = [];
        if (b.titulo) piezas.push({ text: L(b.titulo), bold: true, fontSize: 9.5, margin: [0, 6, 0, 3] });
        piezas.push(tablaPdf);
        if (b.fuente) piezas.push({ text: L(b.fuente), italics: true, fontSize: 7.5, color: col(C.suave), margin: [0, -5, 0, 8] });
        contenido.push(b.filas.length <= 12 ? { unbreakable: true, stack: piezas } : { stack: piezas });
      } else if (b.t === "img") {
        contenido.push({ unbreakable: true, stack: [{ image: b.img.url, width: ANCHO, alignment: "center", margin: [0, 2, 0, 2] }].concat(b.titulo ? [{ text: L(b.titulo), bold: true, fontSize: 9, color: col(C.suave), alignment: "center", margin: [0, 0, 0, 8] }] : []) });
      } else if (b.t === "salto") {
        contenido.push({ text: "", pageBreak: "before" });
      }
    });
    cerrarLista();

    return {
      pageSize: "A4",
      pageMargins: [40, 54, 40, 46],
      info: { title: (tipo === "detallado" ? "Informe detallado" : "Informe general") + " – " + d.periodo, author: EMPRESA, creator: EMPRESA },
      defaultStyle: { font: "Roboto", fontSize: 10.5, color: col(C.tinta), lineHeight: 1.22 },
      header: () => ({ text: EMPRESA + "  ·  " + d.periodo, alignment: "right", fontSize: 8, color: col(C.suave), margin: [40, 24, 40, 0] }),
      footer: (pag, total) => ({ text: "Página " + pag + " de " + total, alignment: "center", fontSize: 8, color: col(C.suave), margin: [0, 16, 0, 0] }),
      content: contenido,
    };
  }

  function nombreArchivo(d, ext) {
    const base = (estado.tipo === "general" ? "Informe_general_" : "Informe_detallado_") + sinTildes(d.periodo).replace(/[()·,]/g, " ").trim().replace(/\s+/g, "_") + "_CRF";
    return base.replace(/[^A-Za-z0-9_\-]/g, "").slice(0, 120) + "." + (ext || "docx");
  }

  function descargarBlob(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // Datos listos para armar el informe (o null con el aviso de por qué no)
  function datosListos() {
    const d = refrescar(false);
    if (!d) { aviso(disponibles().size ? "Elige al menos un mes para armar el informe." : "No hay datos para armar el informe. Importa tus ingresos y egresos primero.", "error"); return null; }
    const rep = d.calidad.repetidos;
    if (rep && (rep.kIng > 1 || rep.kEgr > 1)) {
      aviso("Tus datos están cargados más de una vez: el informe saldría multiplicado. Pulsa «Dejar una sola copia» y vuelve a intentarlo.", "error");
      return null;
    }
    if (typeof Chart === "undefined") { aviso("Los gráficos no cargaron (revisa tu conexión a internet).", "error"); return null; }
    return d;
  }

  // Botón «en trabajo»: mientras se arma, se ve el aviso y no se puede pulsar dos veces
  async function conBoton(boton, textoTrabajando, tarea) {
    const d = datosListos();
    if (!d) return false;
    const original = boton ? boton.innerHTML : "";
    if (boton) { boton.disabled = true; boton.textContent = textoTrabajando; }
    try {
      await new Promise(r => setTimeout(r, 30));   // deja que se vea «Armando…» antes de dibujar los gráficos
      await tarea(d);
      return true;
    } catch (e) {
      console.warn("[informes]", e);
      aviso("No se pudo armar el informe: " + (e && e.message ? e.message : e), "error");
      return false;
    } finally {
      if (boton) { boton.disabled = false; boton.innerHTML = original; }
    }
  }

  function descargarWord(ev) {
    return conBoton(ev && ev.currentTarget, "Armando el Word…", async d => {
      const D = await cargarDocx();
      const blob = await D.Packer.toBlob(construirWord(D, d, estado.tipo));
      const nombre = nombreArchivo(d, "docx");
      descargarBlob(blob, nombre);
      aviso("Listo: se descargó «" + nombre + "». Adjúntalo al correo.", "success");
    });
  }

  function descargarPdf(ev) {
    return conBoton(ev && ev.currentTarget, "Armando el PDF…", async d => {
      const pm = await cargarPdf();
      const def = aPdf(armarBloques(d, estado.tipo), d, estado.tipo);
      const blob = await new Promise((resolve, reject) => { try { pm.createPdf(def).getBlob(resolve); } catch (e) { reject(e); } });
      const nombre = nombreArchivo(d, "pdf");
      descargarBlob(blob, nombre);
      aviso("Listo: se descargó «" + nombre + "». Adjúntalo al correo.", "success");
    });
  }

  /* ======================================================================
     VISTA PREVIA (antes de descargar)
     ====================================================================== */
  function abrirVistaPrevia(ev) {
    return conBoton(ev && ev.currentTarget, "Armando la vista previa…", async d => {
      const capa = document.getElementById("infPrevia");
      document.getElementById("infPreviaTitulo").textContent = (estado.tipo === "general" ? "Informe general" : "Informe detallado") + " · " + d.periodo;
      document.getElementById("infPreviaDoc").innerHTML = aHtml(armarBloques(d, estado.tipo));
      capa.hidden = false;
      document.getElementById("infPreviaDoc").scrollTop = 0;
      document.getElementById("infPreviaCerrar").focus();
    });
  }

  function cerrarVistaPrevia() {
    const capa = document.getElementById("infPrevia");
    if (!capa || capa.hidden) return false;
    capa.hidden = true;
    document.getElementById("infPreviaDoc").innerHTML = "";
    const b = document.getElementById("infVistaPrevia");
    if (b) b.focus();
    return true;
  }

  /* ======================================================================
     CORREO
     ====================================================================== */
  function datosCorreo() {
    const para = (document.getElementById("infPara").value || "").trim();
    const asu = document.getElementById("infAsunto").value || "";
    const cuerpo = document.getElementById("infMensaje").value || "";
    try { localStorage.setItem(CLAVE_CORREO, para); } catch (e) { /* sin almacenamiento */ }
    return { para, asu, cuerpo };
  }

  function abrirCorreo() {
    if (!refrescar(false)) { aviso("No hay datos para armar el informe.", "error"); return; }
    const c = datosCorreo();
    if (c.para && !/^[^\s@,;]+(@[^\s@,;]+\.[^\s@,;]+)([,;][^\s@,;]+@[^\s@,;]+\.[^\s@,;]+)*$/.test(c.para.replace(/\s+/g, ""))) { aviso("Revisa el correo del destinatario: no parece válido.", "error"); return; }
    const url = "mailto:" + encodeURIComponent(c.para.replace(/\s+/g, "")).replace(/%40/g, "@").replace(/%2C/g, ",") + "?subject=" + encodeURIComponent(c.asu) + "&body=" + encodeURIComponent(c.cuerpo).replace(/%0A/g, "%0D%0A");
    const a = document.createElement("a");
    a.href = url; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    aviso("Se abrió tu programa de correo con el mensaje listo. Adjunta el archivo descargado.", "info");
  }

  function abrirGmail() {
    if (!refrescar(false)) { aviso("No hay datos para armar el informe.", "error"); return; }
    const c = datosCorreo();
    const url = "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(c.para.replace(/\s+/g, "")) + "&su=" + encodeURIComponent(c.asu) + "&body=" + encodeURIComponent(c.cuerpo);
    window.open(url, "_blank", "noopener");
    aviso("Se abrió Gmail con el mensaje listo. Adjunta el archivo descargado.", "info");
  }

  /* ======================================================================
     VENTANA
     ====================================================================== */
  // Deja la elección válida con los datos de hoy (si se cargó o borró algo desde la última vez)
  function ajustarEleccion() {
    const disp = disponibles();
    const anios = Array.from(disp.keys()).sort((a, b) => a - b);
    const ultimo = anios[anios.length - 1];
    if (estado.meses) {
      Array.from(estado.meses).forEach(k => {
        const [a, m] = k.split("-").map(Number);
        if (!disp.has(a) || disp.get(a).indexOf(m) < 0) estado.meses.delete(k);
      });
    }
    // Por defecto: todos los meses del último año con datos
    if ((!estado.meses || !estado.meses.size) && ultimo !== undefined) estado.meses = new Set(disp.get(ultimo).map(m => clave(ultimo, m)));
  }

  function abrir() {
    const modal = document.getElementById("modalInforme");
    if (!modal || !window.Analitica) return;
    ajustarEleccion();
    try { document.getElementById("infPara").value = localStorage.getItem(CLAVE_CORREO) || ""; } catch (e) { /* sin almacenamiento */ }
    if (!disponibles().size) {
      document.getElementById("infPeriodoCaja").innerHTML = "";
      document.getElementById("infResumen").innerHTML = '<p class="inf-alerta">Todavía no hay ingresos ni egresos registrados. Importa tu Excel o registra tus movimientos y vuelve aquí.</p>';
      pintarInsignia(null);
    } else refrescar(true);
    modal.hidden = false;
    const shell = document.getElementById("shell");
    if (shell) shell.classList.remove("sb-abierto");
    const fondo = document.getElementById("sbFondo");
    if (fondo) fondo.hidden = true;
    setTimeout(() => { const b = modal.querySelector("input[name='infTipo']:checked"); if (b) b.focus(); }, 30);
  }

  function cerrar() {
    cerrarVistaPrevia();
    const modal = document.getElementById("modalInforme");
    if (modal) modal.hidden = true;
  }

  function conectar() {
    const modal = document.getElementById("modalInforme");
    if (!modal) return;
    ["btnAbrirInformes", "btnInformeRapido"].forEach(id => { const b = document.getElementById(id); if (b) b.addEventListener("click", abrir); });
    document.getElementById("cerrarModalInforme").addEventListener("click", cerrar);
    modal.addEventListener("click", e => { if (e.target === modal) cerrar(); });
    document.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      if (cerrarVistaPrevia()) return;       // primero se cierra la vista previa
      if (!modal.hidden) cerrar();
    });
    modal.querySelectorAll("input[name='infTipo']").forEach(r => r.addEventListener("change", () => { estado.tipo = r.value; ajustarEleccion(); refrescar(true); }));

    // Meses elegidos: un mes, «Todo el año» o «Quitar»
    document.getElementById("infPeriodoCaja").addEventListener("click", e => {
      const b = e.target.closest("button");
      if (!b || b.disabled) return;
      if (b.dataset.mesK) { if (estado.meses.has(b.dataset.mesK)) estado.meses.delete(b.dataset.mesK); else estado.meses.add(b.dataset.mesK); }
      else if (b.dataset.anioTodo) { const a = Number(b.dataset.anioTodo); (disponibles().get(a) || []).forEach(m => estado.meses.add(clave(a, m))); }
      else if (b.dataset.anioNada) { const a = Number(b.dataset.anioNada); Array.from(estado.meses).forEach(k => { if (k.indexOf(a + "-") === 0) estado.meses.delete(k); }); }
      else return;
      refrescar(true);
      // el foco vuelve al mismo botón (la lista se vuelve a dibujar)
      if (b.dataset.mesK) { const nuevo = document.querySelector('#infPeriodoCaja [data-mes-k="' + b.dataset.mesK + '"]'); if (nuevo) nuevo.focus(); }
    });
    document.getElementById("infVistaPrevia").addEventListener("click", abrirVistaPrevia);
    document.getElementById("infDescargar").addEventListener("click", descargarWord);
    document.getElementById("infPdf").addEventListener("click", descargarPdf);
    document.getElementById("infPreviaWord").addEventListener("click", descargarWord);
    document.getElementById("infPreviaPdf").addEventListener("click", descargarPdf);
    document.getElementById("infPreviaCerrar").addEventListener("click", cerrarVistaPrevia);
    document.getElementById("infCorreo").addEventListener("click", abrirCorreo);
    document.getElementById("infGmail").addEventListener("click", abrirGmail);
    document.getElementById("infRestablecer").addEventListener("click", () => refrescar(true));
    // Si los datos cambian con la ventana abierta (por ejemplo, «Dejar una sola copia»), se actualiza
    document.addEventListener("click", e => { if (e.target.closest("#btnDejarUnaCopia, .js-dejar-copia") && !modal.hidden) setTimeout(() => refrescar(true), 50); });
  }

  conectar();
  window.Informes = { abrir, cerrar, armarDatos, armarBloques, aHtml, construirWord, aPdf, cargarDocx, cargarPdf, seleccion, estado };
})();
