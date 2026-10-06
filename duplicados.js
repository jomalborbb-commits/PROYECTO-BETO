/* ==========================================================================
   duplicados.js — Que el mismo Excel no se sume dos veces
   --------------------------------------------------------------------------
   Si el mismo Excel se importa varias veces con «Agregar datos», cada venta y
   cada pago se repiten y TODOS los totales salen multiplicados (el informe
   mostraba millones que no existen). Aquí se evita y se corrige:

   1. Al importar: cada registro del archivo se compara con los que ya están
      cargados usando su «huella» (todos sus campos, sin el id interno). Cada
      registro que ya existe «tapa» a UNO igual del archivo, así:
        · volver a importar el mismo Excel no agrega nada;
        · si el Excel trae dos filas idénticas legítimas (dos pagos iguales el
          mismo día), las dos se cargan la primera vez.
   2. Datos que ya quedaron multiplicados: si TODOS los registros se repiten
      un múltiplo exacto de veces (k = máximo común divisor de las
      repeticiones), los datos están cargados k veces. Se muestra un aviso con
      el botón «Dejar una sola copia», que divide cada grupo entre k (así se
      conservan las filas idénticas legítimas del Excel original).

   No cambia nada sin que el usuario lo pida.
   ========================================================================== */
(function () {
  "use strict";

  function normal(v) {
    if (typeof v === "number") return isFinite(v) ? String(Math.round(v * 100) / 100) : "0";
    return String(v === null || v === undefined ? "" : v).replace(/\s+/g, " ").trim().toLowerCase();
  }

  // Huella de un ingreso: todas las columnas del registro (las mismas del Excel)
  function firmaIngreso(r) {
    const columnas = typeof COLUMNAS !== "undefined" ? COLUMNAS : [];
    return columnas.map(c => normal(c.tipo === "numero" || c.tipo === "moneda" ? Number(r[c.key]) || 0 : r[c.key])).join("|");
  }

  // Huella de un egreso: fecha, descripción, monto, pagos y beneficiarios
  function firmaEgreso(e) {
    return [e.fechaEgreso, e.descripcion, Number(e.monto) || 0, Number(e.pagos) || 1, (e.beneficiarios || []).join(", ")].map(normal).join("|");
  }

  function contar(lista, firma) {
    const m = new Map();
    lista.forEach(x => { const f = firma(x); m.set(f, (m.get(f) || 0) + 1); });
    return m;
  }

  // Separa lo nuevo de lo que ya estaba cargado
  function separarNuevos(entrantes, existentes, firma) {
    const m = contar(existentes, firma);
    const nuevos = [], repetidos = [];
    entrantes.forEach(x => {
      const f = firma(x);
      const c = m.get(f) || 0;
      if (c > 0) { m.set(f, c - 1); repetidos.push(x); } else nuevos.push(x);
    });
    return { nuevos, repetidos };
  }

  function mcd(a, b) { while (b) { const t = a % b; a = b; b = t; } return a; }

  // ¿Cuántas veces están cargados los datos? (1 = una sola vez)
  function vecesCargado(lista, firma) {
    if (lista.length < 2) return 1;
    let g = 0;
    contar(lista, firma).forEach(v => { g = mcd(g, v); });
    return Math.max(1, g);
  }

  // Deja cada grupo de registros iguales dividido entre k (una sola copia de todo)
  function dejarUnaCopia(lista, firma, k) {
    if (!(k > 1)) return lista.slice();
    const quedan = new Map();
    contar(lista, firma).forEach((v, f) => quedan.set(f, Math.round(v / k)));
    return lista.filter(x => {
      const f = firma(x);
      const q = quedan.get(f) || 0;
      if (q > 0) { quedan.set(f, q - 1); return true; }
      return false;
    });
  }

  // Registros exactamente iguales que sobran (los que se van si se deja una copia de cada uno)
  function sobrantes(lista, firma) {
    let d = 0;
    contar(lista, firma).forEach(v => { if (v > 1) d += v - 1; });
    return d;
  }

  function listaIng() { return typeof registros !== "undefined" && Array.isArray(registros) ? registros : []; }
  function listaEgr() { return typeof egresos !== "undefined" && Array.isArray(egresos) ? egresos : []; }

  function estado() {
    const ing = listaIng(), egr = listaEgr();
    return {
      kIng: vecesCargado(ing, firmaIngreso), kEgr: vecesCargado(egr, firmaEgreso),
      sobraIng: sobrantes(ing, firmaIngreso), sobraEgr: sobrantes(egr, firmaEgreso),
      nIng: ing.length, nEgr: egr.length,
    };
  }

  /* ---------------- Aviso en la página ---------------- */
  function revisar() {
    const cont = document.getElementById("dbAvisoDuplicados");
    if (!cont) return;
    const e = estado();
    const partes = [];
    if (e.kIng > 1) partes.push("los <b>ingresos</b> están cargados <b>" + e.kIng + " veces</b>");
    if (e.kEgr > 1) partes.push("los <b>egresos</b> están cargados <b>" + e.kEgr + " veces</b>");
    if (partes.length) {
      cont.hidden = false;
      cont.innerHTML = '<span class="ng-aviso-ico" aria-hidden="true">!</span>' +
        "<p><b>Tus datos están repetidos:</b> " + partes.join(" y ") + " (el mismo Excel se importó más de una vez). Por eso todos los totales, gráficos e informes salen multiplicados.</p>" +
        '<button type="button" class="ng-aviso-boton" id="btnDejarUnaCopia">Dejar una sola copia</button>';
      return;
    }
    // Repeticiones que no son un múltiplo exacto: no se tocan solas, solo se avisa
    const muchosIng = e.nIng >= 10 && e.sobraIng / e.nIng > 0.1;
    const muchosEgr = e.nEgr >= 10 && e.sobraEgr / e.nEgr > 0.1;
    if (muchosIng || muchosEgr) {
      cont.hidden = false;
      cont.innerHTML = '<span class="ng-aviso-ico" aria-hidden="true">!</span>' +
        "<p><b>Hay registros repetidos:</b> " + [muchosIng ? e.sobraIng + " ingreso(s)" : "", muchosEgr ? e.sobraEgr + " egreso(s)" : ""].filter(Boolean).join(" y ") +
        " son exactamente iguales a otros. Si cargaste un Excel más de una vez, usa «Importar / exportar → Borrar todos los datos» y vuelve a importarlo una sola vez.</p>";
      return;
    }
    cont.hidden = true;
    cont.innerHTML = "";
  }

  function corregir() {
    const e = estado();
    const texto = [e.kIng > 1 ? "ingresos: de " + e.nIng + " a " + Math.round(e.nIng / e.kIng) + " registros" : "", e.kEgr > 1 ? "egresos: de " + e.nEgr + " a " + Math.round(e.nEgr / e.kEgr) + " registros" : ""].filter(Boolean).join("\n");
    if (!texto) return;
    if (!confirm("Se dejará una sola copia de tus datos:\n" + texto + "\n\nLas filas que en tu Excel son iguales entre sí se conservan. ¿Continuar?")) return;
    if (e.kIng > 1) { registros = dejarUnaCopia(listaIng(), firmaIngreso, e.kIng); guardarRegistros(); }
    if (e.kEgr > 1 && typeof guardarEgresos === "function") { egresos = dejarUnaCopia(listaEgr(), firmaEgreso, e.kEgr); guardarEgresos(); }
    if (typeof registrarEnHistorial === "function") registrarEnHistorial("Quitó datos repetidos", texto.replace(/\n/g, "; "));
    if (typeof renderTodo === "function") renderTodo();
    if (typeof mostrarToast === "function") mostrarToast("Listo: quedó una sola copia de tus datos.", "success");
  }

  document.addEventListener("click", ev => { if (ev.target.closest("#btnDejarUnaCopia, .js-dejar-copia")) corregir(); });

  window.Duplicados = { firmaIngreso, firmaEgreso, separarNuevos, vecesCargado, dejarUnaCopia, sobrantes, estado, revisar };
})();
