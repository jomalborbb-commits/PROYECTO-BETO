/* ==========================================================================
   splash.js — Pantalla de bienvenida: solo el nombre de la empresa
   --------------------------------------------------------------------------
   Es una capa independiente sobre la interfaz. NO lee ni modifica script.js,
   style.css ni ningún elemento de la app: solo se agrega encima y, al terminar,
   se elimina a sí misma.

   Secuencia:
     1. Sobre un fondo oscuro con un leve resplandor cálido, "CRF & LADRILLOS
        S.A.C." viene desde el fondo, pequeño, y se acerca hasta su tamaño.
     2. A los 2,5 segundos se desvanece y se entra al sistema. Un clic, Enter,
        Espacio o Esc también entran de inmediato.

   (El ladrillo holográfico que había que jalar se quitó. Su código anterior
   está guardado como respaldo fuera del proyecto.)

   Se carga desde el <head> a propósito: así la capa cubre la pantalla desde el
   primer instante y nunca se alcanza a ver la interfaz antes del mensaje.
   Si algo falla, la pantalla se retira en silencio y el sistema abre normal.
   ========================================================================== */
(function () {
  'use strict';

  const CONFIG = {
    // false = aparece en cada carga. true = solo la primera vez por pestaña/sesión.
    soloUnaVezPorSesion: false,
    claveSesion: 'splash_pared_vista',

    textoEmpresa: 'CRF & LADRILLOS S.A.C.',
    segundosBienvenida: 2.5,   // cuánto dura el mensaje en pantalla
    familiaFuente: 'Montserrat',
    anchoTextoRel: 0.66,       // ancho del nombre respecto al ancho de pantalla

    tiempoMaxCargaMs: 6000     // red de seguridad: si algo se cuelga, se entra igual
  };

  if (CONFIG.soloUnaVezPorSesion) {
    try {
      if (sessionStorage.getItem(CONFIG.claveSesion)) return;
    } catch (e) { /* sin sessionStorage: se muestra igual */ }
  }

  let retirada = false;
  const limpiezas = [];

  const raiz = document.createElement('div');
  raiz.className = 'splash-root splash-lista';
  raiz.setAttribute('role', 'dialog');
  raiz.setAttribute('aria-label', 'Pantalla de bienvenida');
  document.documentElement.appendChild(raiz);
  document.documentElement.classList.add('splash-activa');
  bloquearInterfaz();

  const fondo = document.createElement('div');
  fondo.className = 'splash-fondo';
  raiz.appendChild(fondo);

  arrancar().catch(function (error) {
    console.warn('[splash] Se omitió la pantalla de bienvenida:', error);
    retirarSplash();
  });

  // Red de seguridad: jamás se deja al usuario fuera de su sistema
  setTimeout(retirarSplash, CONFIG.tiempoMaxCargaMs);

  async function arrancar() {
    await cargarFuente();
    if (retirada) return;
    mostrarBienvenida();
    permitirEntradaInmediata();
  }

  // Se mide el área realmente visible (clientWidth) y no window.innerWidth: si la
  // interfaz de atrás se desborda en horizontal, innerWidth se infla y el texto
  // quedaría descentrado
  function medirPantalla() {
    const el = document.documentElement;
    return {
      W: el.clientWidth || window.innerWidth,
      H: el.clientHeight || window.innerHeight
    };
  }

  function retirarSplash() {
    if (retirada) return;
    retirada = true;
    raiz.remove();
    limpiezas.forEach(function (f) {
      try { f(); } catch (e) { /* liberar recursos nunca debe impedir entrar */ }
    });
    document.documentElement.classList.remove('splash-activa');
    if (document.body) document.body.inert = false;
    try {
      if (CONFIG.soloUnaVezPorSesion) sessionStorage.setItem(CONFIG.claveSesion, '1');
    } catch (e) { /* ignorar */ }
  }

  // Se deja la app inerte (sin foco ni clics) mientras se ve el mensaje
  function bloquearInterfaz() {
    function aplicar() {
      if (!retirada && document.body) document.body.inert = true;
    }
    if (document.body) aplicar();
    else document.addEventListener('DOMContentLoaded', aplicar, { once: true });
  }

  // El texto usa una tipografía web: se espera un máximo de 2 s para no retrasar la entrada
  async function cargarFuente() {
    try {
      await Promise.race([
        document.fonts.load('600 100px "' + CONFIG.familiaFuente + '"', CONFIG.textoEmpresa),
        new Promise(function (resolver) { setTimeout(resolver, 2000); })
      ]);
    } catch (e) { /* se usa la fuente de respaldo */ }
  }

  // Salida rápida: un clic, Enter, Espacio o Esc entran de inmediato
  function permitirEntradaInmediata() {
    function alTeclear(e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        salirYa();
      }
    }
    raiz.addEventListener('click', salirYa);
    document.addEventListener('keydown', alTeclear);
    limpiezas.push(function () { document.removeEventListener('keydown', alTeclear); });
  }

  let saliendo = false;
  function salirYa() {
    if (saliendo || retirada) return;
    saliendo = true;
    raiz.style.transition = 'opacity 0.2s ease';
    raiz.style.opacity = '0';
    setTimeout(retirarSplash, 200);
  }

  /* ======================================================================
     MENSAJE DE BIENVENIDA
     ====================================================================== */
  function mostrarBienvenida() {
    if (retirada) return;

    const W = medirPantalla().W;
    const H = medirPantalla().H;
    const vertical = W < H * 0.9;

    const lineas = vertical
      ? [
          { t: 'CRF &', rel: 0.6, tope: H * 0.08 },
          { t: 'LADRILLOS', rel: 0.84, tope: H * 0.08 },
          { t: 'S.A.C.', rel: 0.5, tope: H * 0.07 }
        ]
      : [{ t: CONFIG.textoEmpresa, rel: CONFIG.anchoTextoRel, tope: H * 0.12 }];

    const cont = document.createElement('div');
    cont.className = 'splash-bienvenida';
    cont.style.animationDuration = CONFIG.segundosBienvenida + 's';

    const bloque = document.createElement('div');
    bloque.className = 'splash-bv-bloque';

    const medidor = document.createElement('span');
    medidor.className = 'splash-bv-linea';
    medidor.style.cssText = 'position:absolute;visibility:hidden;font-size:100px;';
    cont.appendChild(medidor);
    raiz.appendChild(cont);

    lineas.forEach(function (l) {
      medidor.textContent = l.t;
      const anchoBase = medidor.offsetWidth / 100 || l.t.length * 0.75;
      const fs = Math.min((l.rel * W) / anchoBase, l.tope);
      const el = document.createElement('div');
      el.className = 'splash-bv-linea';
      el.textContent = l.t;
      el.dataset.t = l.t;
      el.style.fontSize = fs + 'px';
      bloque.appendChild(el);
    });
    medidor.remove();
    cont.appendChild(bloque);

    // Un instante antes del final todo se desvanece suavemente y se entra al sistema
    setTimeout(function () {
      if (saliendo || retirada) return;
      raiz.style.transition = 'opacity 0.3s ease';
      raiz.style.opacity = '0';
    }, Math.max(0, CONFIG.segundosBienvenida - 0.3) * 1000);
    setTimeout(retirarSplash, CONFIG.segundosBienvenida * 1000);
  }
})();
