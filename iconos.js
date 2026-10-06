/* ==========================================================================
   iconos.js — Miniaturas (iconos) de las gráficas, en 3D y con movimiento propio
   --------------------------------------------------------------------------
   Un solo lugar para los iconos: las mismas miniaturas se ven en las tarjetas
   del panel, en «Salud de tu negocio» y en la esfera «Mapa de mi negocio», así
   todo queda sincronizado. Cada icono es una pieza con volumen que gira sola
   despacio (solo CSS; con «reducir movimiento» del sistema se queda quieta).

   Uso:  IconosPro.html("resultado")            → texto HTML del icono
         <span data-ico="resultado"></span>     → se completa solo al cargar
   Los estilos están en iconos.css.
   ========================================================================== */
(function () {
  "use strict";

  // Dibujos (viewBox 24). i-w = blanco, i-s = blanco suave, i-l = línea blanca, i-k = línea del color del fondo
  const DIBUJOS = {
    resultado: '<rect class="i-s" x="3" y="13" width="4.2" height="8" rx="1.2"/><rect class="i-s" x="9.9" y="9.5" width="4.2" height="11.5" rx="1.2"/><rect class="i-w" x="16.8" y="5.5" width="4.2" height="15.5" rx="1.2"/><path class="i-l" d="M3.5 9 9 5l4 3 6-4.8"/><path class="i-l" d="M15.6 3.2h3.9v3.9"/>',
    cobertura: '<path class="i-w" d="M12 2.4 4.4 5.6v5.7c0 4.7 3.2 8.7 7.6 10.4 4.4-1.7 7.6-5.7 7.6-10.4V5.6z"/><path class="i-k" d="m8.3 12.2 2.7 2.7 4.8-5.3"/>',
    concentracion: '<path class="i-s" d="M11 12.5V4a8.5 8.5 0 1 0 8.5 8.5z"/><path class="i-w" d="M13.2 10.3V2.6a8.5 8.5 0 0 1 8.2 7.7z"/>',
    equilibrio: '<path class="i-l" d="M12 3.5V20M6.5 20.2h11"/><path class="i-l" d="M4.5 7.2h15"/><path class="i-w" d="M4.5 8 1.9 14.2a3.2 3.2 0 0 0 5.2 0z"/><path class="i-w" d="M19.5 8l-2.6 6.2a3.2 3.2 0 0 0 5.2 0z"/>',
    estructura: '<path class="i-w" d="M12 2.6 2.8 7.2 12 11.8l9.2-4.6z"/><path class="i-s" d="M2.8 11.2 12 15.8l9.2-4.6v1.9L12 17.7 2.8 13.1z"/><path class="i-s" d="M2.8 15.4 12 20l9.2-4.6v1.9L12 21.9 2.8 17.3z"/>',
    ranking: '<rect class="i-s" x="2.3" y="13.5" width="6" height="7.7" rx="1.1"/><rect class="i-w" x="9" y="9.2" width="6" height="12" rx="1.1"/><rect class="i-s" x="15.7" y="15.6" width="6" height="5.6" rx="1.1"/><path class="i-w" d="m12 1.8.95 2 2.15.3-1.6 1.5.4 2.1L12 6.6l-1.9 1.1.4-2.1-1.6-1.5 2.15-.3z"/>',
    margen: '<path class="i-l" d="M18.2 5.4 5.8 18.6"/><circle class="i-w" cx="7.2" cy="7.2" r="3"/><circle class="i-w" cx="16.8" cy="16.8" r="3"/>',
    ingresos: '<path class="i-l" d="M12 3.8v11.4"/><path class="i-l" d="m7.4 10.6 4.6 4.6 4.6-4.6"/><path class="i-l" d="M4.4 20h15.2"/>',
    egresos: '<path class="i-l" d="M12 15.2V3.8"/><path class="i-l" d="m7.4 8.4 4.6-4.6 4.6 4.6"/><path class="i-l" d="M4.4 20h15.2"/>',
  };

  // Colores de cada miniatura (a = arriba, b = abajo). Los mismos en todas partes.
  const COLORES = {
    resultado: ["#22C55E", "#0D9488"],
    cobertura: ["#3B82F6", "#6D28D9"],
    concentracion: ["#A78BFA", "#F59E0B"],
    equilibrio: ["#38BDF8", "#1D4ED8"],
    estructura: ["#FB923C", "#1B4A78"],
    ranking: ["#F45F00", "#5B9BDB"],
    margen: ["#FDE047", "#F97316"],
    ingresos: ["#34D399", "#0891B2"],
    egresos: ["#FB7185", "#E11D48"],
  };

  // Nombres antiguos (los de las claves de la esfera y de las tarjetas) → nombre nuevo
  const ALIAS = { gan: "resultado", falta: "cobertura", cli: "concentracion", plata: "estructura", ganancia: "resultado", meta: "cobertura", clientes: "ranking", balanza: "equilibrio", ing: "ingresos", egr: "egresos" };

  // Miniaturas aprobadas (opción A «cristal de color»): pieza de color intenso como la del Ranking,
  // figura blanca con volumen y detalles dorados, dibujada en SVG (nítida a cualquier tamaño).
  // [color claro, color oscuro = grosor de la pieza y brillo al señalar la tarjeta, dibujo]
  // (las imágenes anteriores siguen guardadas en assets/iconos/m-*.png, ya no se usan)
  const BRILLO = (x, y, w, h) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="2" fill="#fff" fill-opacity="0.55"/>';
  const MINIS = {
    "m-ventas": ["#5AA6F2", "#1E4FB0", u =>
      '<rect x="16" y="58" width="17" height="26" rx="5" fill="url(#w' + u + ')" opacity="0.8"/><rect x="41" y="44" width="17" height="40" rx="5" fill="url(#w' + u + ')" opacity="0.9"/>' +
      '<rect x="66" y="30" width="17" height="54" rx="5" fill="url(#w' + u + ')"/>' + BRILLO(19, 61, 4, 18) + BRILLO(44, 47, 4, 32) + BRILLO(69, 33, 4, 46) +
      '<path d="M14 46 L36 30 L50 40 L78 18" fill="none" stroke="url(#g' + u + ')" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M64 15 L82 14 L81 32" fill="none" stroke="url(#g' + u + ')" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>'],
    "m-resmes": ["#43CB84", "#11774A", u =>
      '<rect x="22" y="12" width="48" height="74" rx="7" fill="url(#w' + u + ')"/><rect x="22" y="12" width="11" height="74" rx="6" fill="rgba(255,255,255,0.55)"/>' +
      '<rect x="38" y="26" width="22" height="5" rx="2.5" fill="#11774A" fill-opacity="0.9"/><rect x="38" y="38" width="16" height="5" rx="2.5" fill="#11774A" fill-opacity="0.55"/>' +
      '<rect x="38" y="50" width="22" height="5" rx="2.5" fill="#11774A" fill-opacity="0.9"/><rect x="38" y="62" width="14" height="5" rx="2.5" fill="#11774A" fill-opacity="0.55"/>' + BRILLO(35, 15, 30, 4) +
      '<circle cx="75" cy="33" r="13" fill="url(#v' + u + ')" stroke="#fff" stroke-width="3.5"/><path d="M69 33 H81 M75 27 V39" stroke="#fff" stroke-width="4.2" stroke-linecap="round"/>' +
      '<circle cx="75" cy="67" r="13" fill="url(#r' + u + ')" stroke="#fff" stroke-width="3.5"/><path d="M69 67 H81" stroke="#fff" stroke-width="4.2" stroke-linecap="round"/>'],
    "m-clientes": ["#B08CF0", "#5B34B0", u =>
      '<circle cx="50" cy="50" r="33" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="11"/>' +
      '<path d="M50 17 A33 33 0 1 1 18.6 60.2" fill="none" stroke="url(#g' + u + ')" stroke-width="11" stroke-linecap="round"/>' +
      '<circle cx="50" cy="40" r="10.5" fill="url(#w' + u + ')"/><path d="M33 70 Q33 53 50 53 Q67 53 67 70Z" fill="url(#w' + u + ')"/><ellipse cx="46.5" cy="36" rx="3.5" ry="2.4" fill="#fff" fill-opacity="0.8"/>'],
    "m-equilibrio": ["#7A86F5", "#2E36B0", u =>
      '<rect x="46.5" y="24" width="7" height="54" rx="3" fill="url(#w' + u + ')"/><rect x="16" y="24" width="68" height="7" rx="3.5" fill="url(#w' + u + ')"/><rect x="30" y="76" width="40" height="8" rx="4" fill="url(#w' + u + ')"/>' +
      '<path d="M22 31 L12 55 M22 31 L32 55 M78 31 L68 55 M78 31 L88 55" stroke="rgba(255,255,255,0.55)" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M9 55 H35 Q33 66 22 66 Q11 66 9 55Z" fill="url(#w' + u + ')"/><path d="M65 55 H91 Q89 66 78 66 Q67 66 65 55Z" fill="url(#w' + u + ')"/>' +
      '<circle cx="50" cy="17" r="9" fill="url(#g' + u + ')" stroke="#fff" stroke-width="2.5"/><circle cx="47" cy="14" r="2.6" fill="#fff" fill-opacity="0.85"/>'],
    "m-estructura": ["#2DD4BF", "#0F766E", u =>
      '<path d="M50 50 L50.0 18.0 A32 32 0 0 1 77.7 66.0Z" fill="url(#w' + u + ')"/><path transform="translate(0 6)" d="M50 50 L77.7 66.0 A32 32 0 0 1 22.3 66.0Z" fill="#FF7A5C"/>' +
      '<path d="M50 50 L22.3 66.0 A32 32 0 0 1 50.0 18.0Z" fill="#A78BFA"/><path d="M52 22 A28 28 0 0 1 74 34" fill="none" stroke="#fff" stroke-opacity="0.8" stroke-width="3" stroke-linecap="round"/>'],
  };
  // degradados (blanco, dorado, verde, rojo) y sombra de la figura; «u» los hace únicos en cada icono
  function defsMini(u) {
    const deg = (id, a, b) => '<linearGradient id="' + id + u + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient>';
    return "<defs>" + deg("w", "#FFFFFF", "#E4ECFF") + deg("g", "#FFE58A", "#FFB300") + deg("v", "#6EF0A6", "#16A34A") + deg("r", "#FF8A8A", "#DC2626") +
      '<filter id="s' + u + '" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="3.2" stdDeviation="2.4" flood-color="#000" flood-opacity="0.3"/></filter></defs>';
  }
  // Qué clave (de la esfera, de las tarjetas o de «Salud de tu negocio») usa cada miniatura
  const ALIAS_IMG = {
    ven: "m-ventas", ventas: "m-ventas",
    res: "m-resmes", resmes: "m-resmes",
    cli: "m-clientes", cliconc: "m-clientes",
    equ: "m-equilibrio", balanza: "m-equilibrio",
    plata: "m-estructura",
  };

  let contador = 0;
  function nombre(clave) { return DIBUJOS[clave] ? clave : ALIAS[clave] || clave; }
  function imagenDe(clave) { const k = ALIAS_IMG[clave] || clave; return MINIS[k] ? k : null; }
  function colorDe(clave) { const k = imagenDe(clave); return k ? MINIS[k][1] : (COLORES[nombre(clave)] || [])[1] || "#A9573F"; }

  function html(clave, opciones) {
    const o = opciones || {};
    const img = imagenDe(clave);
    if (img) {
      const m = MINIS[img], u = "mi" + contador;
      const retardoI = -((contador++ * 1.37) % 6.5).toFixed(2);
      return '<span class="ico3d ico3d-a" style="--a:' + m[0] + ";--b:" + m[1] + (o.t ? ";--t:" + o.t + "px" : "") + ";--d:" + retardoI + 's" aria-hidden="true">' +
        '<span class="ico3d-c"><svg viewBox="0 0 100 100" focusable="false">' + defsMini(u) + '<g filter="url(#s' + u + ')">' + m[2](u) + "</g></svg></span></span>";
    }
    const n = nombre(clave);
    if (!DIBUJOS[n]) return "";
    const c = COLORES[n] || ["#F45F00", "#1B4A78"];
    const retardo = -((contador++ * 1.37) % 6.5).toFixed(2);   // cada icono gira desfasado de los demás
    return '<span class="ico3d ico3d-' + n + '" style="--a:' + (o.a || c[0]) + ";--b:" + (o.b || c[1]) + (o.t ? ";--t:" + o.t + "px" : "") + ";--d:" + retardo + 's" aria-hidden="true">' +
      '<span class="ico3d-c"><svg viewBox="0 0 24 24" focusable="false">' + DIBUJOS[n] + "</svg></span></span>";
  }

  // Completa los <span data-ico="..."> del HTML
  function montar(raiz) {
    (raiz || document).querySelectorAll("[data-ico]").forEach(el => {
      if (el.dataset.icoListo) return;
      const t = el.dataset.icoTam;
      el.innerHTML = html(el.dataset.ico, t ? { t } : null);
      el.dataset.icoListo = "1";
    });
  }

  window.IconosPro = { html, montar, COLORES, DIBUJOS, colorDe };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => montar());
  else montar();
})();
