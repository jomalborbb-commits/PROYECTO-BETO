/* =========================================================
   ¿EN QUÉ MES ESTOY? (referencia fija al bajar por la página)
   Cuando el selector de mes de la cabecera sale de la vista, aparece arriba
   una píldora fija con: el mes que se está viendo, la sección de la página
   donde estás y si ves ingresos o egresos. Se actualiza sola al cambiar de
   mes, de sección o de modo. Al tocarla, sube a la cabecera para cambiar el mes.
   Solo muestra información: no cambia datos ni lo que hace ningún botón.
   ========================================================= */
(function () {
  const barra = document.querySelector(".hero-barra");
  const main = document.querySelector(".main");
  const fuenteMes = document.getElementById("heroMesTexto");
  if (!barra || !main || !fuenteMes) return;

  const p = document.createElement("div");
  p.className = "ubic";
  p.id = "ubicacionMes";
  p.setAttribute("aria-live", "polite");
  p.innerHTML =
    '<button type="button" class="ubic-abrir" aria-haspopup="true" aria-expanded="false" title="Elegir el mes que quieres ver">' +
    '<span class="ubic-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg></span>' +
    '<span class="ubic-txt"><small>Estás viendo</small><b class="ubic-mes">—</b></span></button>' +
    '<span class="ubic-sep" aria-hidden="true"></span>' +
    '<span class="ubic-sec"></span>' +
    '<span class="ubic-modo"></span>' +
    '<button type="button" class="ubic-inicio" title="Ir a Inicio" aria-label="Ir a Inicio"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6"/><path d="m6 11.5 6-6.5 6 6.5"/></svg></button>' +
    '<div class="ubic-menu" role="menu" hidden></div>';
  document.body.appendChild(p);
  const abrir = p.querySelector(".ubic-abrir"), menu = p.querySelector(".ubic-menu");
  const elMes = p.querySelector(".ubic-mes"), elSec = p.querySelector(".ubic-sec"), elModo = p.querySelector(".ubic-modo");

  function refrescar() {
    elMes.textContent = (fuenteMes.textContent || "—").trim();
    const activo = document.querySelector(".sb-item.sb-activo[data-sec] span");
    const sec = activo ? activo.textContent.trim() : "";
    elSec.textContent = sec;
    elSec.hidden = true;   // la sección ya no se muestra: solo el mes, el modo y la flecha a Inicio
    p.querySelector(".ubic-sep").hidden = elSec.hidden;
    const modo = typeof modoRegistro !== "undefined" && modoRegistro === "egresos" ? "egresos" : "ingresos";
    elModo.textContent = modo === "egresos" ? "Egresos" : "Ingresos";
    elModo.className = "ubic-modo ubic-" + modo;
  }

  function colocar() {
    const r = main.getBoundingClientRect();
    p.style.left = Math.round(r.left + r.width / 2) + "px";
  }

  // Aparece cuando el selector de mes de la cabecera ya no se ve
  let fuera = false;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(entradas => {
      fuera = !entradas[0].isIntersecting && entradas[0].boundingClientRect.top < 0;
      if (fuera) { refrescar(); colocar(); }
      p.classList.toggle("visible", fuera);
      if (!fuera) cerrarMenu();
    }).observe(barra);
  }

  // Se actualiza solo: mes, sección visible y modo (ingresos o egresos)
  const obs = new MutationObserver(refrescar);
  obs.observe(fuenteMes, { childList: true, characterData: true, subtree: true });
  document.querySelectorAll(".sb-item[data-sec]").forEach(a => obs.observe(a, { attributes: true, attributeFilter: ["class"] }));
  const pill = document.getElementById("pillModoRegistro");
  if (pill) obs.observe(pill, { childList: true, characterData: true, subtree: true, attributes: true });
  window.addEventListener("resize", colocar);

  // El calendario abre los 12 meses; se elige uno sin moverse de donde estás.
  // El menú se queda abierto mientras el cursor esté dentro y se cierra solo al salir.
  let temporizador = null;
  function pintarMenu() {
    if (typeof MESES === "undefined") return;
    const enEgresos = typeof modoRegistro !== "undefined" && modoRegistro === "egresos" && typeof egresosDelMes === "function";
    menu.innerHTML = '<p class="ubic-menu-tit">Elige el mes</p><div class="ubic-meses">' + MESES.map((nombre, i) => {
      let n = 0;
      try { n = enEgresos ? egresosDelMes(i).length : registrosDelMes(i).length; } catch (e) { n = 0; }
      return '<button type="button" role="menuitem" data-mes="' + i + '" class="ubic-m' + (i === mesActual ? " ubic-m-act" : "") + (n ? "" : " ubic-m-vacio") + '">' +
        '<span>' + nombre.charAt(0) + nombre.slice(1, 3).toLowerCase() + "</span>" + (n ? "<small>" + n + "</small>" : "") + "</button>";
    }).join("") + "</div>";
  }
  function abrirMenu() {
    clearTimeout(temporizador);
    pintarMenu();
    menu.hidden = false;
    abrir.setAttribute("aria-expanded", "true");
  }
  function cerrarMenu() {
    clearTimeout(temporizador);
    menu.hidden = true;
    abrir.setAttribute("aria-expanded", "false");
  }
  abrir.addEventListener("click", e => { e.stopPropagation(); if (menu.hidden) abrirMenu(); else cerrarMenu(); });
  p.addEventListener("mouseleave", () => { if (!menu.hidden) temporizador = setTimeout(cerrarMenu, 250); });
  p.addEventListener("mouseenter", () => clearTimeout(temporizador));
  menu.addEventListener("click", e => {
    const b = e.target.closest("[data-mes]");
    if (!b) return;
    e.stopPropagation();
    cerrarMenu();
    const m = Number(b.dataset.mes);
    if (typeof renderTodo === "function" && !isNaN(m)) { mesActual = m; renderTodo(); }
  });
  document.addEventListener("click", e => { if (!menu.hidden && !p.contains(e.target)) cerrarMenu(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !menu.hidden) { cerrarMenu(); abrir.focus(); } });

  // La flechita lleva al panel de Inicio
  p.querySelector(".ubic-inicio").addEventListener("click", e => {
    e.stopPropagation();
    cerrarMenu();
    const inicio = document.getElementById("sec-inicio");
    if (inicio) inicio.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  });

  refrescar();
  colocar();
})();
