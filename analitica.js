/* ==========================================================================
   analitica.js — Cálculos compartidos de ingresos y egresos
   --------------------------------------------------------------------------
   Una sola fuente para todo el panel: ganancia o pérdida del mes, punto de
   equilibrio, en qué se va la plata, clientes clave y medidas de posición
   (cuartiles, quintiles, deciles y percentiles). Así ninguna tarjeta, gráfica
   o ventana da un número distinto para lo mismo.

   Es de SOLO LECTURA: lee `registros` (ingresos, script.js) y `egresos`
   (egresos.js) y nunca los modifica. Sirve para cualquier Excel de enero a
   diciembre: todo se calcula con lo que haya cargado.

   Reglas comunes (las mismas de las ventanas «Estabilidad» y «¿Mis ventas
   y pagos son parecidos?»):
   - Se analiza el último año que tiene datos.
   - El último mes con datos de un tipo está «incompleto» si su último
     registro es antes del día 25.
   - Resultado del mes = ingresos − egresos (los ingresos son lo registrado,
     no necesariamente lo cobrado).
   ========================================================================== */
(function () {
  "use strict";

  /* ======================================================================
     SEMÁFORO: verde = bueno, rojo = malo (el mismo en todas las ventanas)
     ====================================================================== */
  const SEMAFORO = {
    muyBueno: { clave: "muyBueno", texto: "Muy bueno", color: "#1B8A3A", icono: "▲▲" },
    bueno: { clave: "bueno", texto: "Bueno", color: "#43A047", icono: "▲" },
    regular: { clave: "regular", texto: "Regular", color: "#E0A100", icono: "●" },
    malo: { clave: "malo", texto: "Malo", color: "#E53935", icono: "▼" },
    muyMalo: { clave: "muyMalo", texto: "Muy malo", color: "#B71C1C", icono: "▼▼" },
    incompleto: { clave: "incompleto", texto: "Incompleto", color: "#9E9E9E", icono: "…" },
    sinDatos: { clave: "sinDatos", texto: "Sin datos", color: "#9A8A7E", icono: "—" },
  };

  const MESES_TITULO = MESES.map(m => m.charAt(0) + m.slice(1).toLowerCase());
  const MESES_CORTOS = MESES.map(m => m.charAt(0) + m.slice(1, 3).toLowerCase());

  /* ======================================================================
     CATEGORÍAS DE EGRESOS (por palabras de la descripción)
     El orden importa: se revisan de arriba hacia abajo y gana la primera
     que coincide (ej. "pago de luz (cambio de soles a dólares)" es Luz).
     "variable" = sube o baja con los ladrillos que produces y vendes.
     ====================================================================== */
  const CATEGORIAS = [
    { clave: "luz", nombre: "Luz y servicios", variable: false, color: "#EAB308",
      palabras: ["luz", "agua", "internet", "telefon", "celular", "energia electrica", "recibo de luz"] },
    { clave: "planilla", nombre: "Planilla y sueldos", variable: false, color: "#2563EB",
      palabras: ["planilla", "sueldo", "quincena", "gratificacion", "cts", "jornal", "dias de trabajo", "vacaciones", "liquidacion", "bono", "remuneracion"] },
    { clave: "bancos", nombre: "Bancos, deudas e impuestos", variable: false, color: "#7C3AED",
      palabras: ["prestamo", "deuda", "amortizacion", "conciliacion", "banco", "bcp", "bbva", "scotiabank", "interbank", "sunat", "essalud", "afp", "impuesto", "impstos", "renta", "interes", "fraccionamiento", "dj anual", "cambio de soles", "detraccion", "igv"] },
    { clave: "combustible", nombre: "Combustible y leña", variable: true, color: "#EA580C",
      palabras: ["petroleo", "combustible", "gasolina", "diesel", "lena", "carbon", "gas"] },
    { clave: "materia", nombre: "Materia prima", variable: true, color: "#92400E",
      palabras: ["aserrin", "viruta", "greda", "arcilla", "ripio", "cemento", "arena", "materia prima", "cascarilla"] },
    { clave: "alquiler", nombre: "Alquileres", variable: false, color: "#0891B2",
      palabras: ["alquiler", "aquiler", "arriendo", "terreno"] },
    { clave: "maquinaria", nombre: "Maquinaria y mantenimiento", variable: false, color: "#16A34A",
      palabras: ["mantenimiento", "mant", "repuesto", "filtro", "rodaje", "rodamiento", "torno", "soldadura", "fierro", "varilla", "herramienta", "maquinaria", "tablero", "construccion", "fabricacion", "molde", "tolva", "martillo", "molino", "pinon", "eje", "ejes", "freno", "calamina", "canaleta", "plancha", "placha", "malla", "clips", "cable", "tubo", "abrazadera", "cuna", "cunas", "parihuela", "cargador", "motor", "bomba", "electrodo", "pintura", "cabo", "naylon", "nylon", "aceite", "llanta", "bateria", "epp"] },
    { clave: "admin", nombre: "Caja chica, trámites y fletes", variable: false, color: "#DB2777",
      palabras: ["caja chica", "oficina", "administrativ", "movilidad", "licencia", "lincencia", "tramite", "notaria", "asesoria", "contador", "contab", "laboratori", "derecho minero", "defensa civil", "flete", "transporte", "pasaje", "viatico", "utiles"] },
    { clave: "otros", nombre: "Otros", variable: false, color: "#78716C", palabras: [] },
  ];

  function sinTildes(t) {
    return String(t === null || t === undefined ? "" : t)
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/\s+/g, " ").trim();
  }

  function escaparRegex(t) { return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  // Cada palabra debe empezar una palabra de la descripción; las cortas
  // (3 letras o menos, como "luz" o "cts") además deben terminarla
  CATEGORIAS.forEach(c => {
    c.regex = c.palabras.length
      ? new RegExp("\\b(?:" + c.palabras.map(p => escaparRegex(p) + (p.length <= 3 ? "\\b" : "")).join("|") + ")")
      : null;
  });

  const cacheCategoria = new Map();
  function categoriaDe(descripcion) {
    const texto = sinTildes(descripcion);
    if (cacheCategoria.has(texto)) return cacheCategoria.get(texto);
    const cat = CATEGORIAS.find(c => c.regex && c.regex.test(texto)) || CATEGORIAS[CATEGORIAS.length - 1];
    if (cacheCategoria.size > 5000) cacheCategoria.clear();
    cacheCategoria.set(texto, cat);
    return cat;
  }

  /* ======================================================================
     DATOS (solo lectura)
     ====================================================================== */

  const FECHA_OK = /^\d{4}-\d{2}-\d{2}/;

  function listaIngresos() { return typeof registros !== "undefined" && Array.isArray(registros) ? registros : []; }
  function listaEgresos() { return typeof egresos !== "undefined" && Array.isArray(egresos) ? egresos : []; }

  /* Los datos de un año se preparan una sola vez por cada redibujo de la
     pantalla: la copia se descarta sola al terminar (setTimeout 0) o si
     cambia la cantidad de registros, así nunca se usa un dato viejo. */
  let copia = null;

  function datosDelAnio(anio) {
    anio = Number(anio);
    const ingresos = listaIngresos(), egresosLista = listaEgresos();
    const firma = ingresos.length + "|" + egresosLista.length;
    if (!copia || copia.firma !== firma || copia.ingresos !== ingresos || copia.egresos !== egresosLista) {
      copia = { firma, ingresos, egresos: egresosLista, porAnio: new Map() };
      const esta = copia;
      setTimeout(() => { if (copia === esta) copia = null; }, 0);
    }
    if (copia.porAnio.has(anio)) return copia.porAnio.get(anio);

    const ing = ingresos
      .filter(r => FECHA_OK.test(r.fechaIngreso || "") && Number(String(r.fechaIngreso).slice(0, 4)) === anio && (Number(r.montoTotal) || 0) > 0)
      .map(r => ({
        fecha: String(r.fechaIngreso).slice(0, 10),
        mes: Number(String(r.fechaIngreso).slice(5, 7)) - 1,
        valor: Number(r.montoTotal) || 0,
        unidades: Number(r.unidad) || 0,
        precio: Number(r.precioUnitario) || 0,
        cliente: r.cliente || "",
        codigo: r.codigoLadrillo || "",
      }));
    const egr = egresosLista
      .filter(e => FECHA_OK.test(e.fechaEgreso || "") && Number(String(e.fechaEgreso).slice(0, 4)) === anio && (Number(e.monto) || 0) > 0)
      .map(e => ({
        fecha: String(e.fechaEgreso).slice(0, 10),
        mes: Number(String(e.fechaEgreso).slice(5, 7)) - 1,
        valor: Number(e.monto) || 0,
        descripcion: e.descripcion || "",
        aviso: e.aviso || "",
        categoria: categoriaDe(e.descripcion),
      }));
    const d = { ing, egr, incompleto: { ingresos: incompletoDeLista(ing), egresos: incompletoDeLista(egr) } };
    copia.porAnio.set(anio, d);
    return d;
  }

  // Año que se analiza para un mes elegido: el más reciente que tenga datos en ESE mes
  // (así el panel coincide con lo que muestra el «Registro del mes»). Si el mes no
  // tiene datos en ningún año, se usa el último año con datos.
  function anioParaMes(mes) {
    let mejor = null;
    listaIngresos().forEach(r => { if (FECHA_OK.test(r.fechaIngreso || "") && (Number(r.montoTotal) || 0) > 0 && Number(String(r.fechaIngreso).slice(5, 7)) - 1 === mes) { const a = Number(String(r.fechaIngreso).slice(0, 4)); if (mejor === null || a > mejor) mejor = a; } });
    listaEgresos().forEach(e => { if (FECHA_OK.test(e.fechaEgreso || "") && (Number(e.monto) || 0) > 0 && Number(String(e.fechaEgreso).slice(5, 7)) - 1 === mes) { const a = Number(String(e.fechaEgreso).slice(0, 4)); if (mejor === null || a > mejor) mejor = a; } });
    return mejor === null ? anioAnalisis() : mejor;
  }

  // El último mes con datos está incompleto si su último registro es antes del día 25
  function incompletoDeLista(lista) {
    if (!lista.length) return null;
    const ultima = lista.reduce((a, m) => (m.fecha > a ? m.fecha : a), "");
    const dia = Number(ultima.slice(8, 10));
    return dia < 25 ? { mes: Number(ultima.slice(5, 7)) - 1, fecha: ultima } : null;
  }

  // Copias: quien las use puede ordenarlas o filtrarlas sin afectar a los demás
  function ingresosDelAnio(anio) { return datosDelAnio(anio).ing.slice(); }
  function egresosDelAnio(anio) { return datosDelAnio(anio).egr.slice(); }

  function movimientos(tipo, anio) { return tipo === "egresos" ? egresosDelAnio(anio) : ingresosDelAnio(anio); }

  function aniosDisponibles() {
    const set = new Set();
    listaIngresos().forEach(r => { if (FECHA_OK.test(r.fechaIngreso || "") && (Number(r.montoTotal) || 0) > 0) set.add(Number(String(r.fechaIngreso).slice(0, 4))); });
    listaEgresos().forEach(e => { if (FECHA_OK.test(e.fechaEgreso || "") && (Number(e.monto) || 0) > 0) set.add(Number(String(e.fechaEgreso).slice(0, 4))); });
    return Array.from(set).sort((a, b) => a - b);
  }

  // Último año con datos (el mismo que usan las ventanas por defecto)
  function anioAnalisis() {
    const anios = aniosDisponibles();
    return anios.length ? anios[anios.length - 1] : new Date().getFullYear();
  }

  function mesIncompleto(tipo, anio) {
    return datosDelAnio(anio).incompleto[tipo === "egresos" ? "egresos" : "ingresos"];
  }

  function ultimoMesConDatos(anio) {
    const d = datosDelAnio(anio);
    let ultimo = -1;
    d.ing.forEach(m => { if (m.mes > ultimo) ultimo = m.mes; });
    d.egr.forEach(m => { if (m.mes > ultimo) ultimo = m.mes; });
    return ultimo;
  }

  /* ======================================================================
     RESUMEN DEL MES Y DEL AÑO
     ====================================================================== */

  function resumenDeListas(ing, egr) {
    const r = {
      ingresos: 0, egresos: 0, unidades: 0, variables: 0,
      nIng: ing.length, nEgr: egr.length, avisos: 0,
      ultimaIng: "", ultimaEgr: "",
    };
    ing.forEach(m => { r.ingresos += m.valor; r.unidades += m.unidades; if (m.fecha > r.ultimaIng) r.ultimaIng = m.fecha; });
    egr.forEach(m => {
      r.egresos += m.valor;
      if (m.categoria.variable) r.variables += m.valor;
      if (m.aviso) r.avisos += 1;
      if (m.fecha > r.ultimaEgr) r.ultimaEgr = m.fecha;
    });
    r.fijos = r.egresos - r.variables;
    r.resultado = r.ingresos - r.egresos;
    r.hayIng = r.nIng > 0;
    r.hayEgr = r.nEgr > 0;
    r.hayDatos = r.hayIng || r.hayEgr;
    r.margenPct = r.ingresos > 0 ? (r.resultado / r.ingresos) * 100 : null;
    r.cobertura = r.egresos > 0 ? (r.ingresos / r.egresos) * 100 : null;   // cuánto de lo gastado cubren las ventas
    r.precio = r.unidades > 0 ? r.ingresos / r.unidades : null;
    return r;
  }

  function resumenMes(anio, mes) {
    const d = datosDelAnio(anio);
    const incI = d.incompleto.ingresos;
    const incE = d.incompleto.egresos;
    const r = resumenDeListas(d.ing.filter(m => m.mes === mes), d.egr.filter(m => m.mes === mes));
    r.anio = Number(anio);
    r.mes = mes;
    r.nombre = MESES_TITULO[mes] + " " + anio;
    r.incompletoIng = !!(incI && incI.mes === mes);
    r.incompletoEgr = !!(incE && incE.mes === mes);
    r.incompleto = r.incompletoIng || r.incompletoEgr;
    return r;
  }

  function resumenAnio(anio) {
    const meses = MESES.map((_, m) => resumenMes(anio, m));
    const d = datosDelAnio(anio);
    const total = resumenDeListas(d.ing, d.egr);
    total.anio = Number(anio);
    return { anio: Number(anio), meses, total };
  }

  /* ======================================================================
     PUNTO DE EQUILIBRIO
     Costos variables = materia prima + combustible (suben con cada ladrillo).
     Todo lo demás se toma como fijo del mes.
     Se usan los meses de referencia: con ingresos y egresos, con ladrillos
     vendidos y que no estén incompletos.
       precio = ingresos ÷ ladrillos     costo variable = variables ÷ ladrillos
       margen por ladrillo = precio − costo variable
       punto de equilibrio = gastos fijos del mes ÷ margen por ladrillo
     ====================================================================== */

  function puntoEquilibrio(anio) {
    const incI = mesIncompleto("ingresos", anio);
    const incE = mesIncompleto("egresos", anio);
    const meses = MESES.map((_, m) => resumenMes(anio, m));
    const utiles = meses.filter(r => r.hayIng && r.hayEgr && r.unidades > 0);
    let ref = utiles.filter(r => !(incI && incI.mes === r.mes) && !(incE && incE.mes === r.mes));
    let provisional = false;
    if (!ref.length) { ref = utiles; provisional = true; }
    if (!ref.length) return null;

    const I = ref.reduce((s, r) => s + r.ingresos, 0);
    const Q = ref.reduce((s, r) => s + r.unidades, 0);
    const V = ref.reduce((s, r) => s + r.variables, 0);
    const F = ref.reduce((s, r) => s + r.fijos, 0);
    const precio = I / Q;
    const costoVariable = V / Q;
    const margen = precio - costoVariable;
    const fijosMes = F / ref.length;
    const unidadesEq = margen > 0 ? fijosMes / margen : null;
    return {
      anio: Number(anio),
      meses: ref.map(r => r.mes),
      n: ref.length,
      provisional,
      precio, costoVariable, margen,
      razonMargen: precio > 0 ? margen / precio : null,       // de cada S/ 1 vendido, cuánto queda para los fijos
      fijosMes,
      variablesMes: V / ref.length,
      ingresosMes: I / ref.length,
      unidadesMes: Q / ref.length,
      unidadesEq,
      solesEq: unidadesEq !== null ? unidadesEq * precio : null,
    };
  }

  /* ¿Cuánto le faltó (o le sobró) a un mes para no perder?
     Cada ladrillo adicional deja "margen" soles (precio − costo variable), así
     que para tapar una pérdida P se necesitan P ÷ margen ladrillos más.
     Por construcción: el mes alcanzó el equilibrio ⇔ su resultado ≥ 0
     (coincide siempre con «Resultado del mes»). */
  function equilibrioDelMes(anio, mes, pe) {
    const r = resumenMes(anio, mes);
    pe = pe === undefined ? puntoEquilibrio(anio) : pe;
    const res = { r, pe, disponible: false };
    if (!r.hayEgr) { res.motivo = r.hayIng ? "sinEgresos" : "sinDatos"; return res; }
    if (!pe) { res.motivo = "sinUnidades"; return res; }
    if (!(pe.margen > 0)) { res.motivo = "sinMargen"; return res; }
    res.disponible = true;
    res.alcanzado = r.resultado >= 0;
    res.faltaSoles = Math.max(0, -r.resultado);                  // lo que falta cubrir de egresos
    res.faltaLadrillos = res.faltaSoles / pe.margen;             // ladrillos más a vender
    res.faltaVentas = res.faltaLadrillos * pe.precio;            // ventas más (en soles)
    res.sobraLadrillos = r.resultado > 0 ? r.resultado / pe.margen : 0;
    res.necesarios = Math.max(0, r.unidades - r.resultado / pe.margen);   // ladrillos para quedar en cero
    res.avance = res.necesarios > 0 ? (r.unidades / res.necesarios) * 100 : 100;
    return res;
  }

  /* ======================================================================
     ¿EN QUÉ SE ME VA LA PLATA? (egresos por categoría)
     mes = -1 → todo el año
     ====================================================================== */

  function gastosPorCategoria(anio, mes) {
    return gastosDeLista(egresosDelAnio(anio).filter(m => mes < 0 || m.mes === mes));
  }

  // Lo mismo para cualquier lista de egresos (por ejemplo, varios meses elegidos en un informe)
  function gastosDeLista(lista) {
    const total = lista.reduce((s, m) => s + m.valor, 0);
    const mapa = {};
    lista.forEach(m => {
      const c = m.categoria;
      if (!mapa[c.clave]) mapa[c.clave] = { clave: c.clave, nombre: c.nombre, color: c.color, variable: c.variable, total: 0, n: 0, movimientos: [] };
      mapa[c.clave].total += m.valor;
      mapa[c.clave].n += 1;
      mapa[c.clave].movimientos.push(m);
    });
    const cats = Object.keys(mapa).map(k => mapa[k]).sort((a, b) => b.total - a.total);
    cats.forEach(c => {
      c.pct = total > 0 ? (c.total / total) * 100 : 0;
      c.movimientos.sort((a, b) => b.valor - a.valor);
    });
    const variables = cats.filter(c => c.variable).reduce((s, c) => s + c.total, 0);
    return { total, n: lista.length, categorias: cats, variables, fijos: total - variables };
  }

  /* ======================================================================
     CLIENTES CLAVE
     El nombre se compara sin tildes, mayúsculas ni espacios de más, para
     que "ARTURO PINEDO " y "arturo pinedo" sean el mismo cliente.
     Clase A = hacen el 80% de las ventas; B = hasta el 95%; C = el resto.
     ====================================================================== */

  function claveCliente(nombre) {
    return sinTildes(nombre).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim() || "sin nombre";
  }

  function clientesDe(anio, mes) {
    return clientesDeLista(ingresosDelAnio(anio).filter(m => mes < 0 || m.mes === mes));
  }

  // Lo mismo para cualquier lista de ingresos. «periodos» guarda año*12+mes de cada compra,
  // para poder trabajar con meses de años distintos sin confundirlos.
  function clientesDeLista(lista) {
    const total = lista.reduce((s, m) => s + m.valor, 0);
    const mapa = {};
    lista.forEach(m => {
      const k = claveCliente(m.cliente);
      if (!mapa[k]) mapa[k] = { clave: k, nombre: String(m.cliente || "").replace(/\s+/g, " ").trim() || "Sin nombre", total: 0, n: 0, unidades: 0, meses: new Set(), periodos: new Set(), ultima: "" };
      const c = mapa[k];
      c.total += m.valor;
      c.n += 1;
      c.unidades += m.unidades;
      c.meses.add(m.mes);
      c.periodos.add(Number(m.fecha.slice(0, 4)) * 12 + m.mes);
      if (m.fecha > c.ultima) c.ultima = m.fecha;
    });
    const orden = Object.keys(mapa).map(k => mapa[k]).sort((a, b) => b.total - a.total);
    let acumulado = 0;
    orden.forEach(c => {
      const antes = acumulado;
      c.pct = total > 0 ? (c.total / total) * 100 : 0;
      acumulado += c.pct;
      c.acumulado = acumulado;
      c.clase = antes < 80 ? "A" : antes < 95 ? "B" : "C";
    });
    const top = k => orden.slice(0, k).reduce((s, c) => s + c.pct, 0);
    return {
      total, n: lista.length, clientes: orden,
      cantidad: orden.length,
      claveA: orden.filter(c => c.clase === "A").length,
      top1: top(1), top5: top(5),
    };
  }

  // Dependencia de pocos clientes (según cuánto hacen tus 5 mejores)
  function dependencia(top5) {
    if (top5 === null || top5 === undefined || isNaN(top5)) return Object.assign({}, SEMAFORO.sinDatos, { frase: "" });
    if (top5 < 40) return Object.assign({}, SEMAFORO.bueno, { texto: "Diversificado", frase: "tus ventas están repartidas entre muchos clientes" });
    if (top5 <= 60) return Object.assign({}, SEMAFORO.regular, { texto: "Dependencia media", frase: "unos pocos clientes pesan bastante" });
    return Object.assign({}, SEMAFORO.malo, { texto: "Dependencia alta", frase: "si uno de tus clientes grandes deja de comprar, lo sientes mucho" });
  }

  // Clientes que compraban y no aparecen en los 2 últimos meses con ventas
  function clientesQueDejaron(anio) {
    const ing = ingresosDelAnio(anio);
    if (!ing.length) return { ventana: [], lista: [] };
    const mesesCon = Array.from(new Set(ing.map(m => m.mes))).sort((a, b) => a - b);
    if (mesesCon.length < 3) return { ventana: mesesCon, lista: [] };
    const ventana = mesesCon.slice(-2);
    const antes = clientesDe(anio, -1).clientes;
    const lista = antes.filter(c => !ventana.some(m => c.meses.has(m)));
    return { ventana, lista };
  }

  /* ======================================================================
     MEDIDAS DE POSICIÓN
     Fórmula del curso (la misma de CUARTIL.EXC y PERCENTIL.EXC en Excel):
        W = j(n + 1) ÷ N     W = y,z (parte entera y decimal)
        Cⱼ = x(y) + z·[x(y+1) − x(y)]
     N = 4 cuartiles, 5 quintiles, 10 deciles, 100 percentiles; los datos x
     van ordenados de menor a mayor. Si W cae antes del primer dato o
     después del último, se toma el mínimo o el máximo.
     Método "inc" (Excel CUARTIL.INC / StatsUnlock): h = (n − 1)·p + 1.
     ====================================================================== */

  function cuantilDetalle(ordenados, j, N, metodo) {
    const n = ordenados.length;
    if (!n) return null;
    const p = j / N;
    const W = metodo === "inc" ? (n - 1) * p + 1 : (j * (n + 1)) / N;
    let y = Math.floor(W);
    let z = W - y;
    let limite = "";
    if (W <= 1) { y = 1; z = 0; limite = W < 1 ? "min" : ""; }
    if (W >= n) { y = n; z = 0; limite = W > n ? "max" : ""; }
    const xy = ordenados[y - 1];
    const xy1 = y < n ? ordenados[y] : ordenados[n - 1];
    return { j, N, p, W, y, z, xy, xy1, valor: xy + z * (xy1 - xy), limite };
  }

  function cuantil(ordenados, p, metodo) {
    const d = cuantilDetalle(ordenados, p * 1000, 1000, metodo);
    return d ? d.valor : null;
  }

  // Qué porcentaje de los datos queda por debajo de v (el empate cuenta la mitad)
  function rangoPercentil(ordenados, v) {
    const n = ordenados.length;
    if (!n) return null;
    let menores = 0, iguales = 0;
    ordenados.forEach(x => { if (x < v) menores += 1; else if (x === v) iguales += 1; });
    return ((menores + 0.5 * iguales) / n) * 100;
  }

  function resumenPosicion(valores, metodo) {
    const ord = valores.filter(v => typeof v === "number" && isFinite(v)).slice().sort((a, b) => a - b);
    const n = ord.length;
    if (!n) return null;
    const c = (j, N) => cuantilDetalle(ord, j, N, metodo);
    const q1 = c(1, 4), q2 = c(2, 4), q3 = c(3, 4);
    const ric = q3.valor - q1.valor;
    const cercaInf = q1.valor - 1.5 * ric;
    const cercaSup = q3.valor + 1.5 * ric;
    const dentro = ord.filter(v => v >= cercaInf && v <= cercaSup);
    const total = ord.reduce((s, v) => s + v, 0);
    // Cuánto dinero aporta cada 20% de los datos (del más chico al más grande)
    const aportes = [0, 0, 0, 0, 0];
    const cantidades = [0, 0, 0, 0, 0];
    ord.forEach((v, i) => { const g = Math.min(4, Math.floor((i * 5) / n)); aportes[g] += v; cantidades[g] += 1; });
    return {
      n, ord, total, media: total / n, metodo: metodo === "inc" ? "inc" : "curso",
      min: ord[0], max: ord[n - 1],
      q1, q2, q3, ric, cercaInf, cercaSup,
      bigoteInf: dentro.length ? dentro[0] : ord[0],
      bigoteSup: dentro.length ? dentro[dentro.length - 1] : ord[n - 1],
      atipicosBajos: ord.filter(v => v < cercaInf),
      atipicosAltos: ord.filter(v => v > cercaSup),
      quintiles: [1, 2, 3, 4].map(j => c(j, 5)),
      deciles: [1, 2, 3, 4, 5, 6, 7, 8, 9].map(j => c(j, 10)),
      percentil: pp => c(pp, 100),
      aportes: aportes.map((s, i) => ({ grupo: i + 1, suma: s, cantidad: cantidades[i], pct: total > 0 ? (s / total) * 100 : 0 })),
    };
  }

  /* Totales de cada mes de un tipo ("ingresos", "egresos" o "resultado").
     Por defecto no cuenta el último mes si está incompleto (igual que
     «Estabilidad»). Para "resultado" solo cuentan los meses con ingresos Y egresos. */
  function totalesMensuales(tipo, anio, excluirIncompletos) {
    const meses = MESES.map((_, m) => resumenMes(anio, m));
    return meses.map(r => {
      let total = null;
      if (tipo === "ingresos" && r.hayIng) total = r.ingresos;
      if (tipo === "egresos" && r.hayEgr) total = r.egresos;
      if (tipo === "resultado" && r.hayIng && r.hayEgr) total = r.resultado;
      const incompleto = tipo === "ingresos" ? r.incompletoIng : tipo === "egresos" ? r.incompletoEgr : r.incompleto;
      return { mes: r.mes, nombre: MESES_TITULO[r.mes], corto: MESES_CORTOS[r.mes], total, incompleto, excluido: total !== null && incompleto && excluirIncompletos !== false, r };
    });
  }

  // ¿Mes bueno o malo? según dónde cae frente a los cuartiles de los meses.
  // En egresos gastar menos es lo bueno; en el resultado, ganar es lo bueno.
  function semaforoPosicion(tipo, valor, res) {
    if (valor === null || valor === undefined) return SEMAFORO.sinDatos;
    if (!res || res.n < 2) return tipo === "resultado" ? (valor >= 0 ? SEMAFORO.bueno : SEMAFORO.malo) : SEMAFORO.regular;
    if (res.max === res.min) return tipo === "resultado" ? (valor >= 0 ? SEMAFORO.bueno : SEMAFORO.malo) : SEMAFORO.regular;   // todos iguales: no hay mejor ni peor
    const q1 = res.q1.valor, q2 = res.q2.valor, q3 = res.q3.valor;
    // Con pocos meses el corte cae justo sobre el menor o el mayor: por eso los
    // extremos (≤ Q1 y ≥ Q3) cuentan como parte del 25% de abajo y del 25% de arriba
    if (tipo === "egresos") {
      if (valor > res.cercaSup) return SEMAFORO.muyMalo;
      if (valor >= q3) return SEMAFORO.malo;
      if (valor > q2) return SEMAFORO.regular;
      if (valor > q1) return SEMAFORO.bueno;
      return SEMAFORO.muyBueno;
    }
    if (tipo === "resultado") {
      if (valor < 0) return valor <= q1 ? SEMAFORO.muyMalo : SEMAFORO.malo;
      return valor >= q3 ? SEMAFORO.muyBueno : SEMAFORO.bueno;
    }
    if (valor >= q3) return SEMAFORO.muyBueno;
    if (valor >= q2) return SEMAFORO.bueno;
    if (valor < res.cercaInf) return SEMAFORO.muyMalo;
    if (valor <= q1) return SEMAFORO.malo;
    return SEMAFORO.regular;
  }

  // Dónde queda un mes frente a los demás meses del año (para las tarjetas)
  function posicionDelMes(tipo, anio, mes, metodo) {
    const meses = totalesMensuales(tipo, anio, true);
    const usados = meses.filter(u => u.total !== null && !u.excluido);
    const res = resumenPosicion(usados.map(u => u.total), metodo);
    const u = meses[mes];
    if (!u || u.total === null) return { disponible: false, res, meses };
    const ord = res ? res.ord : [];
    return {
      disponible: true, res, meses, u,
      percentil: res ? rangoPercentil(ord, u.total) : null,
      semaforo: u.excluido ? SEMAFORO.incompleto : semaforoPosicion(tipo, u.total, res),
      puesto: usados.slice().sort((a, b) => (tipo === "egresos" ? a.total - b.total : b.total - a.total)).findIndex(x => x.mes === mes) + 1,
      deTotal: usados.length,
    };
  }

  /* ======================================================================
     SALUD DEL NEGOCIO: un veredicto con su explicación
     Cinco indicadores, cada uno bueno (+1), regular (0) o malo (−1):
       margen de ganancia, ventas frente al mes anterior, gastos frente al mes
       anterior, cumplimiento del punto de equilibrio y concentración de ventas.
     Favorable: ganaste y la suma es 2 o más. Riesgo: perdiste y la suma es −2
     o menos. Todo lo demás es «Atención». Un mes en curso no se califica.
     ====================================================================== */

  function unirFrases(lista) {
    if (lista.length <= 1) return lista.join("");
    return lista.slice(0, -1).join(", ") + " y " + lista[lista.length - 1];
  }

  function saludDelMes(anio, mes) {
    const S = SEMAFORO;
    const nombre = MESES_TITULO[mes];
    const r = resumenMes(anio, mes);
    const base = { anio: Number(anio), mes, nombre, razones: [], score: 0 };
    if (!r.hayDatos) return Object.assign(base, { clave: "sinDatos", texto: "Sin datos", color: S.sinDatos.color, frase: nombre + " todavía no tiene ingresos ni egresos registrados." });
    if (!r.hayIng || !r.hayEgr) {
      return Object.assign(base, { clave: "faltan", texto: "Faltan datos", color: S.regular.color, frase: "Falta registrar los " + (r.hayIng ? "egresos" : "ingresos") + " de " + nombre.toLowerCase() + " para saber si ganaste o perdiste." });
    }

    const ant = mes > 0 ? resumenMes(anio, mes - 1) : null;
    const nomAnt = mes > 0 ? MESES_TITULO[mes - 1].toLowerCase() : "";
    const pe = puntoEquilibrio(anio);
    const eq = equilibrioDelMes(anio, mes, pe);
    const cl = clientesDe(anio, mes);
    const razones = [];
    const soles = v => "S/ " + Math.round(Math.abs(v)).toLocaleString("es-PE");
    const gano = r.resultado >= 0;

    // 1. Margen de ganancia (incluye si ganaste o perdiste)
    const m = r.margenPct;
    razones.push({
      clave: "margen", nombre: "Margen neto",
      nivel: m >= 15 ? "bueno" : m >= 0 ? "regular" : "malo",
      valor: m === null ? "—" : Math.round(m) + "%",
      frase: gano
        ? (m >= 15 ? "ganaste " + soles(r.resultado) + " (te queda el " + Math.round(m) + "% de lo que vendes)" : "ganaste poco: " + soles(r.resultado) + " (solo el " + Math.round(m) + "% de lo que vendes)")
        : "perdiste " + soles(r.resultado) + " (gastaste más de lo que vendiste)",
      ayuda: "Del total que vendiste, cuánto te queda después de pagar todos los gastos.",
    });

    // 2. Ventas frente al mes anterior
    if (ant && ant.hayIng && ant.ingresos > 0 && !r.incompletoIng && !ant.incompletoIng) {
      const v = ((r.ingresos - ant.ingresos) / ant.ingresos) * 100;
      razones.push({
        clave: "ventas", nombre: "Ventas frente a " + nomAnt,
        nivel: v >= 5 ? "bueno" : v > -5 ? "regular" : "malo",
        valor: (v >= 0 ? "+" : "") + Math.round(v) + "%",
        frase: v >= 5 ? "las ventas subieron " + Math.round(v) + "% frente a " + nomAnt : v > -5 ? "las ventas se mantienen frente a " + nomAnt : "las ventas bajaron " + Math.round(-v) + "% frente a " + nomAnt,
        ayuda: "Si vendiste más o menos que el mes pasado.",
      });
    }

    // 3. Gastos frente al mes anterior (gastar menos es lo bueno)
    if (ant && ant.hayEgr && ant.egresos > 0 && !r.incompletoEgr && !ant.incompletoEgr) {
      const v = ((r.egresos - ant.egresos) / ant.egresos) * 100;
      razones.push({
        clave: "gastos", nombre: "Gastos frente a " + nomAnt,
        nivel: v <= -5 ? "bueno" : v <= 10 ? "regular" : "malo",
        valor: (v >= 0 ? "+" : "") + Math.round(v) + "%",
        frase: v <= -5 ? "los gastos bajaron " + Math.round(-v) + "% frente a " + nomAnt : v <= 10 ? "los gastos se mantienen frente a " + nomAnt : "los gastos subieron " + Math.round(v) + "% frente a " + nomAnt,
        ayuda: "Si gastaste más o menos que el mes pasado. Gastar menos es lo bueno.",
      });
    }

    // 4. Punto de equilibrio
    if (eq.disponible) {
      razones.push({
        clave: "equilibrio", nombre: "Punto de equilibrio operativo",
        nivel: eq.alcanzado ? "bueno" : "malo",
        valor: eq.alcanzado ? "Cubierto" : "Faltó",
        frase: eq.alcanzado ? "vendiste más de lo necesario para no perder" : "te faltaron ≈ " + Math.round(Math.ceil(eq.faltaLadrillos)).toLocaleString("es-PE") + " ladrillos para no perder",
        ayuda: "Lo mínimo que hay que vender para pagar todos los gastos del mes.",
      });
    }

    // 5. Concentración de ventas en pocos clientes
    if (cl.cantidad >= 3) {
      razones.push({
        clave: "clientes", nombre: "Concentración de clientes",
        nivel: cl.top5 < 40 ? "bueno" : cl.top5 <= 60 ? "regular" : "malo",
        valor: Math.round(cl.top5) + "%",
        frase: cl.top5 < 40 ? "tus ventas están bien repartidas entre tus clientes" : cl.top5 <= 60 ? "tus 5 mejores clientes hacen el " + Math.round(cl.top5) + "% de tus ventas" : "solo 5 clientes hacen el " + Math.round(cl.top5) + "% de tus ventas",
        ayuda: "Si tus ventas dependen de pocos clientes. Es más seguro tener muchos.",
      });
    }

    const puntos = { bueno: 1, regular: 0, malo: -1 };
    const score = razones.reduce((s, x) => s + puntos[x.nivel], 0);
    const buenas = razones.filter(x => x.nivel === "bueno").map(x => x.frase);
    const malas = razones.filter(x => x.nivel === "malo").map(x => x.frase);
    const regulares = razones.filter(x => x.nivel === "regular").map(x => x.frase);

    // Mes en curso: todavía puede cambiar, no se califica
    if (r.incompleto) {
      const ult = r.incompletoIng ? r.ultimaIng : r.ultimaEgr;
      return Object.assign(base, {
        clave: "enCurso", texto: "Mes en curso", color: S.regular.color, razones, score, r,
        frase: "Todavía faltan registros de " + nombre.toLowerCase() + " (el último es del " + ult.slice(8, 10) + "/" + ult.slice(5, 7) + "). Hasta ahora " + (gano ? "vas ganando " : "vas perdiendo ") + soles(r.resultado) + ".",
      });
    }

    let clave, texto, color, frase;
    if (gano && score >= 2) { clave = "favorable"; texto = "Favorable"; color = S.bueno.color; frase = "Situación favorable porque " + unirFrases(buenas.slice(0, 3)) + "."; }
    else if (!gano && score <= -2) { clave = "riesgo"; texto = "Riesgo"; color = S.malo.color; frase = "Situación de riesgo porque " + unirFrases(malas.slice(0, 3)) + "."; }
    else {
      clave = "atencion"; texto = "Atención"; color = S.regular.color;
      const pos = buenas.length ? unirFrases(buenas.slice(0, 2)) : "";
      const neg = malas.length ? unirFrases(malas.slice(0, 2)) : unirFrases(regulares.slice(0, 2));
      frase = "Situación para vigilar: " + (pos ? pos + ", pero " : "") + (neg || "no hay una señal clara") + ".";
    }
    return Object.assign(base, { clave, texto, color, frase, razones, score, r });
  }

  /* ======================================================================
     EXPORTAR
     ====================================================================== */
  window.SEMAFORO = SEMAFORO;
  window.Analitica = {
    SEMAFORO, CATEGORIAS, MESES_TITULO, MESES_CORTOS,
    sinTildes, categoriaDe,
    ingresosDelAnio, egresosDelAnio, movimientos,
    aniosDisponibles, anioAnalisis, anioParaMes, mesIncompleto, ultimoMesConDatos,
    resumenMes, resumenAnio, resumenDe: resumenDeListas,
    puntoEquilibrio, equilibrioDelMes,
    gastosPorCategoria, gastosDeLista,
    clientesDe, clientesDeLista, dependencia, clientesQueDejaron,
    cuantilDetalle, cuantil, rangoPercentil, resumenPosicion,
    totalesMensuales, semaforoPosicion, posicionDelMes,
    saludDelMes,
  };
})();
