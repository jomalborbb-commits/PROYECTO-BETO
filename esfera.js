/* ==========================================================================
   esfera.js — «Mapa de mi negocio»: una esfera 3D que gira en el centro,
   2 entradas a la izquierda (ingresos y egresos) y 5 salidas a la derecha
   (ganancia o pérdida, cuánto falta para no perder, margen, en qué se va la
   plata y clientes clave). Los tentáculos son curvas con luz que fluye:
   hacia la esfera lo que entra y desde la esfera lo que sale.

   Solo dibuja: los números se los da negocio.js (que los saca de
   analitica.js) llamando a Esfera.actualizar(datos). No lee tus registros
   ni los modifica. Sin librerías: es un canvas 2D.

   - La esfera se puede girar arrastrándola con el mouse (o el dedo): gira hacia
     donde lleves el cursor y, al soltar, sigue un poco por inercia.
   - Se pausa cuando no se ve en pantalla o la pestaña está oculta.
   - Con «reducir movimiento» en el sistema, queda quieta.
   - En pantallas angostas los nodos se apilan y no se dibujan los tentáculos.
   ========================================================================== */
(function () {
  "use strict";

  /* ======================================================================
     NODOS: colores vivos (dos por nodo) e iconos
     ====================================================================== */
  const ICONOS = {
    ing: '<path d="M12 4v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4.5 19.5h15"/>',
    egr: '<path d="M12 15V4"/><path d="M7.5 8.5 12 4l4.5 4.5"/><path d="M4.5 19.5h15"/>',
    gan: '<path d="M3 17.5l5.5-5.5 4 4L21 7.5"/><path d="M15 7.5h6v6"/><path d="M3 21h18"/>',
    falta: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.2"/><path d="M19.5 4.5 13 11"/>',
    margen: '<path d="M18.5 5.5 5.5 18.5"/><circle cx="7.5" cy="7.5" r="2.3"/><circle cx="16.5" cy="16.5" r="2.3"/>',
    plata: '<ellipse cx="9" cy="6.5" rx="5.5" ry="2.5"/><path d="M3.5 6.5v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4"/><path d="M3.5 10.5v4c0 1.4 2.5 2.5 5.5 2.5 1 0 2-.1 2.8-.4"/><path d="M15 14.5h6"/><path d="m18.5 12 2.5 2.5-2.5 2.5"/>',
    cli: '<circle cx="9" cy="8" r="3.4"/><path d="M2.8 20c.8-3.6 3.3-5.6 6.2-5.6s5.4 2 6.2 5.6"/><path d="m17.8 4.2.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z"/>',
  };

  ICONOS.ven = ICONOS.ven || ICONOS.gan; ICONOS.res = ICONOS.res || ICONOS.gan; ICONOS.equ = ICONOS.equ || ICONOS.falta;
  const NODOS = [
    { clave: "ing", lado: "in", c1: "#34D399", c2: "#06B6D4", titulo: "Ingresos" },
    { clave: "egr", lado: "in", c1: "#FB7185", c2: "#F43F5E", titulo: "Egresos" },
    // Salidas en el MISMO orden en que aparecen sus tarjetas al bajar la página (nombres y miniaturas iguales)
    { clave: "ven", lado: "out", c1: "#5AA6F2", c2: "#2760C0", titulo: "Ventas brutas del mes" },
    { clave: "res", lado: "out", c1: "#43CB84", c2: "#1B8A52", titulo: "Resultado neto mes a mes" },
    { clave: "cli", lado: "out", c1: "#B08CF0", c2: "#6A42BC", titulo: "Concentración de clientes" },
    { clave: "equ", lado: "out", c1: "#7A86F5", c2: "#3844C2", titulo: "Punto de equilibrio" },
    { clave: "plata", lado: "out", c1: "#2DD4BF", c2: "#F0654B", titulo: "Estructura de egresos" },
  ];

  const NIVEL = { bueno: "#4ADE80", regular: "#FBBF24", malo: "#FB7185" };

  /* ======================================================================
     ESTADO
     ====================================================================== */
  let raiz = null;
  let escena = null, lienzo = null, ctx = null, centroEl = null;
  let nodosEl = {};
  let vivo = false, visible = true, reproduciendo = false;
  let rafId = 0;
  let w = 0, h = 0, dpr = 1;
  let cx = 0, cy = 0, R = 100;
  let anclas = [];
  let conTentaculos = true;
  let hover = -1;
  // Rotación 3D: una matriz que se va girando con el arrastre y con el giro suave de siempre
  const GIRO_AUTO = 0.32;      // rad/s
  let M = null;
  let wx = 0, wy = 0;          // velocidad al soltar (inercia)
  let dirGiro = 1;             // hacia dónde gira sola (el último sentido en que la llevaste)
  let arrastrando = false, huboArrastre = false;
  let tPrev = 0;
  const movReducido = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;
  const callbacks = { alClic: null };

  function rgb(hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) { const c = rgb(hex); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  function esc(t) { return String(t === null || t === undefined ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  /* ======================================================================
     PUNTOS DE LA ESFERA (espiral de Fibonacci) y sus uniones
     ====================================================================== */
  const N = 340;
  const puntos = [];
  const uniones = [];
  (function preparar() {
    const dorada = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (2 * (i + 0.5)) / N;
      const r = Math.sqrt(1 - y * y);
      const a = dorada * i;
      puntos.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r });
    }
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = puntos[i].x - puntos[j].x, dy = puntos[i].y - puntos[j].y, dz = puntos[i].z - puntos[j].z;
        if (dx * dx + dy * dy + dz * dz < 0.085) uniones.push([i, j]);
      }
    }
  })();

  // Color de cada punto según qué tan lejos está del centro de la esfera:
  // casi negro en el núcleo → amarillo → naranja → naranja rojizo en el contorno
  const PARADAS = [[0, [150, 74, 22]], [0.3, [255, 206, 84]], [0.7, [255, 196, 70]], [1, [255, 220, 130]]];
  function colorRadial(rho) {
    for (let i = 1; i < PARADAS.length; i++) {
      if (rho <= PARADAS[i][0]) {
        const a = PARADAS[i - 1], b = PARADAS[i];
        const k = (rho - a[0]) / (b[0] - a[0] || 1);
        return [Math.round(a[1][0] + (b[1][0] - a[1][0]) * k), Math.round(a[1][1] + (b[1][1] - a[1][1]) * k), Math.round(a[1][2] + (b[1][2] - a[1][2]) * k)];
      }
    }
    return PARADAS[PARADAS.length - 1][1];
  }

  /* ======================================================================
     ROTACIÓN (matrices 3×3, giros en ejes de pantalla)
     ====================================================================== */
  function mulMat(a, b) {
    const c = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
    return c;
  }
  function rotY(th) { const c = Math.cos(th), s = Math.sin(th); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; }
  function rotX(ph) { const c = Math.cos(ph), s = Math.sin(ph); return [[1, 0, 0], [0, c, -s], [0, s, c]]; }
  M = mulMat(rotX(0.42), rotY(0.6));
  function girar(thY, phX) { M = mulMat(rotY(thY), mulMat(rotX(phX), M)); }

  /* ======================================================================
     DOM (se arma una sola vez)
     ====================================================================== */
  function svg(clave) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONOS[clave] + "</svg>"; }

  function nodoHtml(n) {
    return '<button type="button" class="esf-nodo esf-' + n.lado + '" data-nodo="' + n.clave + '" style="--c1:' + n.c1 + ";--c2:" + n.c2 + '">' +
      (window.IconosPro && window.IconosPro.html(n.clave) ? '<span class="esf-ico esf-ico-3d">' + window.IconosPro.html(n.clave) + "</span>" : '<span class="esf-ico">' + svg(n.clave) + "</span>") +
      '<span class="esf-txt"><span class="esf-t">' + esc(n.titulo) + '</span><strong class="esf-v">—</strong>' +
      '<span class="esf-fila"><em class="esf-chip" hidden></em><span class="esf-s"></span></span></span></button>';
  }

  function construir(cont) {
    raiz = cont;
    raiz.classList.add("esf");
    raiz.setAttribute("aria-label", "Mapa de mi negocio: cómo entra y sale tu dinero este mes");
    raiz.innerHTML =
      '<header class="esf-cab"><div><h2 class="esf-titulo">Mapa de mi negocio</h2>' +
      '<p class="esf-sub">Cómo entra y sale tu dinero en <b class="esf-mes">este mes</b> y qué significa para ti.</p></div>' +
      '<span class="esf-tip">Toca un círculo para ver su detalle</span></header>' +
      '<div class="esf-escena"><canvas class="esf-lienzo" aria-hidden="true"></canvas>' +
      '<div class="esf-col esf-col-in">' + NODOS.filter(n => n.lado === "in").map(nodoHtml).join("") + "</div>" +
      '<div class="esf-centro"><button type="button" class="esf-nucleo" aria-expanded="false" aria-controls="esfRazones">' +
      '<span class="esf-nucleo-mes"></span><strong class="esf-nucleo-texto">—</strong><small>Toca para ver por qué</small></button></div>' +
      '<div class="esf-col esf-col-out">' + NODOS.filter(n => n.lado === "out").map(nodoHtml).join("") + "</div></div>" +
      '<footer class="esf-pie"><p class="esf-frase"></p>' +
      '<div class="esf-razones" id="esfRazones" hidden><ul class="esf-lista"></ul></div>' +
      '<div class="esf-pie-fila"><button type="button" class="esf-por-que" aria-expanded="false" aria-controls="esfRazones">¿Por qué? <span aria-hidden="true">▾</span></button>' +
      '</div></footer>';

    escena = raiz.querySelector(".esf-escena");
    lienzo = raiz.querySelector(".esf-lienzo");
    ctx = lienzo.getContext("2d");
    centroEl = raiz.querySelector(".esf-centro");
    raiz.querySelectorAll(".esf-nodo").forEach(el => { nodosEl[el.dataset.nodo] = el; });

    NODOS.forEach((n, i) => {
      const el = nodosEl[n.clave];
      el.addEventListener("mouseenter", () => { hover = i; pedirFrame(); });
      el.addEventListener("mouseleave", () => { hover = -1; pedirFrame(); });
      el.addEventListener("focus", () => { hover = i; pedirFrame(); });
      el.addEventListener("blur", () => { hover = -1; pedirFrame(); });
      el.addEventListener("click", () => { if (callbacks.alClic) callbacks.alClic(n.clave); });
    });

    const alternar = () => {
      const lista = raiz.querySelector(".esf-razones");
      const abrir = lista.hidden;
      lista.hidden = !abrir;
      raiz.querySelectorAll(".esf-nucleo, .esf-por-que").forEach(b => b.setAttribute("aria-expanded", abrir ? "true" : "false"));
      raiz.querySelector(".esf-por-que span").textContent = abrir ? "▴" : "▾";
    };
    const nucleo = raiz.querySelector(".esf-nucleo");
    // al abrir desde la esfera, la página baja lo justo para que se vean todas las aclaraciones
    const mostrarRazones = () => setTimeout(() => {
      const pie = raiz.querySelector(".esf-pie");
      if (!pie || raiz.querySelector(".esf-razones").hidden) return;
      const r = pie.getBoundingClientRect();
      const falta = r.bottom - (window.innerHeight - 16);
      if (falta > 0) window.scrollBy({ top: Math.min(falta, Math.max(0, r.top - 90)), behavior: movReducido ? "auto" : "smooth" });
    }, 30);
    nucleo.addEventListener("click", () => { if (huboArrastre) { huboArrastre = false; return; } alternar(); mostrarRazones(); });
    conectarGiro(nucleo);
    raiz.querySelector(".esf-por-que").addEventListener("click", alternar);

    // Se mide en el siguiente cuadro para no provocar el aviso «ResizeObserver loop» del navegador
    if ("ResizeObserver" in window) new ResizeObserver(() => { requestAnimationFrame(() => { medir(); pedirFrame(); }); }).observe(escena);
    else window.addEventListener("resize", () => { medir(); pedirFrame(); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) pedirFrame(); }, { threshold: 0.05 }).observe(raiz);
    }
    document.addEventListener("visibilitychange", () => { if (!document.hidden) pedirFrame(); });
    vivo = true;
    medir();
  }

  /* ======================================================================
     GIRO CON EL MOUSE: la superficie sigue al cursor (ángulo = distancia ÷ radio)
     ====================================================================== */
  function conectarGiro(el) {
    let ultX = 0, ultY = 0, ultT = 0, movido = 0;
    const soltar = e => {
      if (!arrastrando) return;
      arrastrando = false;
      el.classList.remove("esf-agarrada");
      try { el.releasePointerCapture(e.pointerId); } catch (err) { /* ya estaba suelto */ }
      // si se soltó parado no hay inercia; si se soltó en movimiento, sigue un poco
      if (performance.now() - ultT > 90 || movReducido) { wx = 0; wy = 0; }
      wx = Math.max(-6, Math.min(6, wx));
      wy = Math.max(-6, Math.min(6, wy));
      pedirFrame();
    };
    el.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      arrastrando = true; huboArrastre = false; movido = 0; wx = 0; wy = 0;
      ultX = e.clientX; ultY = e.clientY; ultT = performance.now();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
      el.classList.add("esf-agarrada");
    });
    el.addEventListener("pointermove", e => {
      if (!arrastrando) return;
      const dx = e.clientX - ultX, dy = e.clientY - ultY;
      if (!dx && !dy) return;
      movido += Math.abs(dx) + Math.abs(dy);
      if (movido > 5) huboArrastre = true;
      const k = 1 / Math.max(R, 60);
      girar(dx * k, -dy * k);
      const ahora = performance.now();
      const dt = Math.max(0.008, (ahora - ultT) / 1000);
      wy = 0.6 * wy + 0.4 * ((dx * k) / dt);
      wx = 0.6 * wx + 0.4 * ((-dy * k) / dt);
      if (Math.abs(dx) > 1) dirGiro = dx > 0 ? 1 : -1;
      ultX = e.clientX; ultY = e.clientY; ultT = ahora;
      if (movReducido) dibujar(performance.now()); else pedirFrame();
    });
    el.addEventListener("pointerup", soltar);
    el.addEventListener("pointercancel", soltar);
  }

  /* ======================================================================
     MEDIDAS: dónde está la esfera y dónde nace cada tentáculo
     ====================================================================== */
  function medir() {
    if (!escena) return;
    const r = escena.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);   // alta resolución
    w = r.width; h = r.height;
    lienzo.width = Math.round(w * dpr);
    lienzo.height = Math.round(h * dpr);
    const c = centroEl.getBoundingClientRect();
    cx = c.left - r.left + c.width / 2;
    cy = c.top - r.top + c.height / 2;
    R = w > 900
      ? Math.max(70, Math.min(c.width * 0.34, c.height * 0.34, 165))
      : Math.max(80, Math.min(c.width * 0.4, c.height * 0.4, 135));   // en celular, más grande para que el texto se lea
    centroEl.style.setProperty("--esf-d", Math.round(R * 2) + "px");   // el botón central cubre justo la esfera
    conTentaculos = w > 900;
    anclas = NODOS.map(n => {
      const b = nodosEl[n.clave].getBoundingClientRect();
      return { x: n.lado === "in" ? b.right - r.left - 4 : b.left - r.left + 4, y: b.top - r.top + b.height / 2, lado: n.lado, c1: n.c1 };
    });
  }

  /* ======================================================================
     DIBUJO
     ====================================================================== */
  function bezier(p0, p1, p2, p3, u) {
    const v = 1 - u;
    return {
      x: v * v * v * p0.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u * u * u * p3.x,
      y: v * v * v * p0.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u * u * u * p3.y,
    };
  }

  // Resplandor naranja alrededor de la esfera. Se dibuja DETRÁS de todo lo demás
  // (destination-over) para no alterar los colores de los tentáculos.
  function dibujarHalo() {
    const Rh = Math.max(R * 1.25, Math.min(R * 2.25, cy - 2, h - cy - 2));
    ctx.globalCompositeOperation = "destination-over";
    const g = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, Rh);
    g.addColorStop(0, "rgba(255,132,36,0.62)");
    g.addColorStop(0.3, "rgba(255,150,60,0.34)");
    g.addColorStop(0.65, "rgba(255,172,96,0.13)");
    g.addColorStop(1, "rgba(255,190,120,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, Rh, 0, 6.2832); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  function dibujarTentaculos(t) {
    ctx.globalCompositeOperation = "lighter";
    anclas.forEach((a, i) => {
      const nodo = NODOS[i];
      const activo = hover === i;
      const apagado = hover >= 0 && !activo;
      const dirX = a.x - cx, dirY = a.y - cy;
      const dist = Math.hypot(dirX, dirY) || 1;
      const fin = { x: cx + (dirX / dist) * R * 0.97, y: cy + (dirY / dist) * R * 0.97 };
      const ini = { x: a.x, y: a.y };
      const fase = i * 1.7;
      const grosor = activo ? 1.7 : 1;
      const fuerza = apagado ? 0.45 : activo ? 1.35 : 1;

      const cuerdas = [
        { off: 0, ancho: 2.6, alfa: 0.95 },
        { off: -1, ancho: 1.4, alfa: 0.55 },
        { off: 1, ancho: 1.0, alfa: 0.4 },
      ];
      cuerdas.forEach((c, k) => {
        const onda = Math.sin(t * 0.9 + fase + k * 1.3) * (10 + k * 3);
        const onda2 = Math.cos(t * 0.75 + fase * 0.6 + k) * (8 + k * 3);
        const dx = fin.x - ini.x;
        const p1 = { x: ini.x + dx * 0.5, y: ini.y + onda + c.off * 7 };
        const p2 = { x: fin.x - dx * 0.42, y: fin.y + onda2 + c.off * 5 };
        const g = ctx.createLinearGradient(ini.x, ini.y, fin.x, fin.y);
        g.addColorStop(0, rgba(nodo.c1, Math.min(1, c.alfa * fuerza)));
        g.addColorStop(0.55, rgba(nodo.c2, Math.min(1, c.alfa * 0.8 * fuerza)));
        g.addColorStop(1, "rgba(255,160,90," + Math.min(1, c.alfa * 0.9 * fuerza) + ")");
        // brillo suave
        ctx.beginPath();
        ctx.moveTo(ini.x, ini.y);
        ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, fin.x + c.off * 4, fin.y);
        ctx.lineWidth = c.ancho * grosor * 5 * dpr * 0.6;
        ctx.strokeStyle = rgba(nodo.c1, 0.07 * fuerza);
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.lineWidth = c.ancho * grosor * dpr * 0.75;
        ctx.strokeStyle = g;
        ctx.stroke();

        // luz que fluye por la cuerda principal: hacia la esfera si entra, hacia el nodo si sale
        if (k === 0) {
          for (let j = 0; j < 4; j++) {
            let s = (t * 0.2 + j / 4 + i * 0.137) % 1;
            const u = a.lado === "in" ? 1 - s : s;   // u=0 en el nodo, u=1 en la esfera
            const pos = bezier(ini, p1, p2, { x: fin.x, y: fin.y }, a.lado === "in" ? s : 1 - s);
            const radio = (activo ? 7 : 5.5) * (0.7 + 0.5 * Math.sin(s * Math.PI));
            const brillo = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radio);
            brillo.addColorStop(0, "rgba(255,255,255," + (0.95 * fuerza) + ")");
            brillo.addColorStop(0.35, rgba(nodo.c1, 0.7 * fuerza));
            brillo.addColorStop(1, rgba(nodo.c1, 0));
            ctx.fillStyle = brillo;
            ctx.beginPath(); ctx.arc(pos.x, pos.y, radio, 0, 6.2832); ctx.fill();
            void u;
          }
        }
      });
    });
  }

  function dibujarEsfera(t) {
    const proy = puntos.map(p => {
      const x1 = M[0][0] * p.x + M[0][1] * p.y + M[0][2] * p.z;
      const y1 = M[1][0] * p.x + M[1][1] * p.y + M[1][2] * p.z;
      const z1 = M[2][0] * p.x + M[2][1] * p.y + M[2][2] * p.z;
      const e = 1 + z1 * 0.1;
      return { x: cx + x1 * R * e, y: cy + y1 * R * e, z: z1, rho: Math.min(1, Math.hypot(x1, y1)) };
    });

    // cuerpo: un núcleo negro pequeño que se aclara muy despacio, paso a paso:
    // negro → marrón oscuro → rojizo → naranja → naranja claro en el contorno
    ctx.globalCompositeOperation = "source-over";
    const cuerpo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    cuerpo.addColorStop(0, "rgba(10,4,2,0.97)");
    cuerpo.addColorStop(0.14, "rgba(30,12,5,0.96)");
    cuerpo.addColorStop(0.3, "rgba(72,28,8,0.95)");
    cuerpo.addColorStop(0.48, "rgba(122,48,12,0.95)");
    cuerpo.addColorStop(0.64, "rgba(178,72,16,0.95)");
    cuerpo.addColorStop(0.8, "rgba(226,102,22,0.95)");
    cuerpo.addColorStop(0.92, "rgba(248,132,38,0.96)");
    cuerpo.addColorStop(1, "rgba(255,158,62,0.97)");
    ctx.fillStyle = cuerpo;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fill();
    // apoyo suave y pequeño detrás del texto del centro, para que se lea sobre el degradé
    const apoyo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.6);
    apoyo.addColorStop(0, "rgba(14,6,3,0.6)");
    apoyo.addColorStop(0.55, "rgba(20,8,4,0.32)");
    apoyo.addColorStop(1, "rgba(20,8,4,0)");
    ctx.fillStyle = apoyo;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.6, 0, 6.2832); ctx.fill();

    // Los puntos y las líneas se achican si la esfera es más pequeña (celular)
    const esc = Math.max(0.55, Math.min(1, R / 150));
    const dibujarMitad = frente => {
      ctx.globalCompositeOperation = "lighter";
      // uniones en tres tandas de profundidad
      const tandas = [{ alfa: 0.1, lista: [] }, { alfa: 0.26, lista: [] }, { alfa: 0.55, lista: [] }];
      uniones.forEach(u => {
        const a = proy[u[0]], b = proy[u[1]];
        const z = (a.z + b.z) / 2;
        if ((z >= 0) !== frente) return;
        tandas[z > 0.55 ? 2 : z > 0.05 ? 1 : 0].lista.push(u);
      });
      tandas.forEach(td => {
        if (!td.lista.length) return;
        ctx.beginPath();
        td.lista.forEach(u => { ctx.moveTo(proy[u[0]].x, proy[u[0]].y); ctx.lineTo(proy[u[1]].x, proy[u[1]].y); });
        ctx.lineWidth = 0.85 * dpr * esc;
        ctx.strokeStyle = "rgba(255,206,120," + td.alfa + ")";
        ctx.stroke();
      });
      // puntos: color según la distancia al centro
      for (let i = 0; i < N; i++) {
        const p = proy[i];
        if ((p.z >= 0) !== frente) continue;
        const prof = (p.z + 1) / 2;
        const c = colorRadial(p.rho);
        const cerca = p.rho < (esc < 0.9 ? 0.66 : 0.5);   // tras el texto del centro, los puntos se atenúan
        const a = (0.3 + prof * 0.7) * (frente && cerca ? (esc < 0.9 ? 0.26 : 0.4) : 1);
        ctx.fillStyle = "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a.toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(p.x, p.y, (0.9 + prof * 1.9) * dpr * 0.85 * esc, 0, 6.2832);
        ctx.fill();
      }
    };

    dibujarMitad(false);
    dibujarMitad(true);

    // borde luminoso naranja
    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = 7 * dpr * 0.6;
    ctx.strokeStyle = "rgba(255,132,36,0.28)";
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.stroke();
    ctx.lineWidth = 1.7 * dpr;
    ctx.strokeStyle = "rgba(255,196,110,0.9)";
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.stroke();

    // destellos que orbitan
    for (let k = 0; k < 3; k++) {
      const ang = t * (0.5 + k * 0.17) + k * 2.1;
      const rx = R * (1.18 + k * 0.09), ry = R * (0.42 + k * 0.1);
      const inclin = 0.5 + k * 0.6;
      const ex = Math.cos(ang) * rx, ey = Math.sin(ang) * ry;
      const px = cx + ex * Math.cos(inclin) - ey * Math.sin(inclin);
      const py = cy + ex * Math.sin(inclin) + ey * Math.cos(inclin);
      const g = ctx.createRadialGradient(px, py, 0, px, py, 7 * dpr * 0.8);
      g.addColorStop(0, "rgba(255,240,190,1)");
      g.addColorStop(0.4, "rgba(255,170,60,0.7)");
      g.addColorStop(1, "rgba(255,140,40,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, 7 * dpr * 0.8, 0, 6.2832); ctx.fill();
    }
  }

  function dibujar(ts) {
    if (!ctx || !w || !h) return;
    const t = ts / 1000;
    // Giro suave de siempre + lo que quedó de inercia tras soltar
    const dt = tPrev ? Math.min(0.05, Math.max(0, t - tPrev)) : 0.016;
    tPrev = t;
    if (!arrastrando && !movReducido) {
      wy *= Math.exp(-dt * 1.8);
      wx *= Math.exp(-dt * 3);
      girar((wy + dirGiro * GIRO_AUTO) * dt, wx * dt);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (conTentaculos) dibujarTentaculos(t);
    dibujarHalo();
    dibujarEsfera(t);
    ctx.globalCompositeOperation = "source-over";
  }

  function bucle(ts) {
    rafId = 0;
    if (!vivo || !visible || document.hidden) { reproduciendo = false; return; }
    dibujar(ts);
    if (movReducido) { reproduciendo = false; return; }
    rafId = requestAnimationFrame(bucle);
    reproduciendo = true;
  }

  function pedirFrame() {
    if (!vivo || rafId) return;
    if (!visible || document.hidden) return;
    rafId = requestAnimationFrame(bucle);
  }

  /* ======================================================================
     DATOS: negocio.js los entrega ya calculados
     ====================================================================== */
  function pintarChip(el, chip) {
    if (!chip || !chip.texto) { el.hidden = true; el.textContent = ""; return; }
    el.hidden = false;
    el.textContent = chip.texto;
    el.style.setProperty("--k", chip.color || "#FBBF24");
    if (chip.titulo) el.title = chip.titulo; else el.removeAttribute("title");
  }

  function actualizar(datos) {
    const cont = document.getElementById("dbKpis");
    if (!cont || !datos) return;
    if (!vivo) construir(cont);

    raiz.querySelector(".esf-mes").textContent = datos.mes;
    ["entradas", "salidas"].forEach(grupo => {
      (datos[grupo] || []).forEach(d => {
        const el = nodosEl[d.clave];
        if (!el) return;
        const v = el.querySelector(".esf-v");
        v.textContent = d.valor;
        v.style.color = d.colorValor || "";
        v.classList.toggle("esf-v-texto", !!d.texto);
        el.querySelector(".esf-s").textContent = d.sub || "";
        pintarChip(el.querySelector(".esf-chip"), d.chip);
        el.setAttribute("aria-label", d.titulo + ": " + d.valor + (d.sub ? ". " + d.sub : "") + ". Toca para ver su detalle.");
      });
    });

    const c = datos.centro;
    raiz.querySelector(".esf-nucleo-mes").textContent = c.etiqueta;
    const tx = raiz.querySelector(".esf-nucleo-texto");
    tx.textContent = c.texto;
    tx.style.color = c.color;
    // halo oscuro + brillo del color: se lee bien sobre cualquier parte de la esfera
    tx.style.textShadow = "0 1px 2px rgba(0,0,0,0.95), 0 0 10px rgba(20,8,4,0.9), 0 0 24px " + rgba(c.color, 0.65);
    raiz.querySelector(".esf-frase").textContent = c.frase;

    raiz.querySelector(".esf-lista").innerHTML = (datos.razones || []).map(r => {
      const col = r.color || NIVEL[r.nivel] || "#94A3B8";
      // lo visual: dos barras (mes anterior y este mes) o una barrita de porcentaje
      let vis = "";
      if (r.barras && r.barras.length) {
        const max = Math.max.apply(null, r.barras.map(b => b.v).concat([1]));
        vis = '<div class="esf-rz-barras">' + r.barras.map((b, i) =>
          '<div class="esf-rz-b"><em>' + esc(b.etq) + '</em><i><s style="width:' + ((b.v / max) * 100).toFixed(1) + "%" +
          (i === r.barras.length - 1 ? ";background:" + col : "") + '"></s></i><small>' + esc(b.txt) + "</small></div>").join("") + "</div>";
      } else if (r.pila && r.pila.length) {
        vis = '<div class="esf-rz-med"><i class="esf-rz-pila">' + r.pila.map(s => '<s style="width:' + Math.max(0, s.pct).toFixed(1) + "%;background:" + s.color + '"></s>').join("") + "</i></div>";
      } else if (typeof r.medidor === "number" && isFinite(r.medidor)) {
        vis = '<div class="esf-rz-med"><i><s style="width:' + Math.max(0, Math.min(100, r.medidor)).toFixed(1) + "%;background:" + col + '"></s></i></div>';
      }
      return '<li><span class="esf-punto" style="background:' + col + '"></span>' +
        '<div><b>' + esc(r.nombre) + ' <span class="esf-rv" style="color:' + (r.color || NIVEL[r.nivel] || "#CBD5E1") + '">' + esc(r.valor) + "</span></b>" +
        (r.dato ? '<span class="esf-rz-dato">' + esc(r.dato) + "</span>" : "") +
        (r.filas && r.filas.length ? '<dl class="esf-rz-filas">' + r.filas.map(f => "<dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd>").join("") + "</dl>" : "") + vis +
        "<span>" + esc(r.ayuda) + "</span></div></li>";
    }).join("") ||
      '<li><div><span>Cuando haya ingresos y egresos del mes, aquí verás en qué se basa el veredicto.</span></div></li>';

    // los textos cambian de largo: se vuelve a medir dónde nace cada tentáculo
    medir();
    pedirFrame();
    if (movReducido) dibujar(0);
  }

  window.Esfera = { actualizar, set alClic(fn) { callbacks.alClic = fn; } };
})();
