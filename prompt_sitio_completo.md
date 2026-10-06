# PARTE 1 — prompt_rediseno.md

Actúa como un equipo multidisciplinario de expertos en tecnología (Diseñador UI Senior, Investigador UX, Desarrollador Frontend Senior y Arquitecto Backend). Necesito que resuelvas un proyecto complejo paso a paso. Toma un respiro y aborda cada fase con el máximo nivel de detalle profesional.

<contexto_global>
Estoy construyendo un dashboard de ventas y gestión para una empresa ladrillera peruana.

Stack actual: Vanilla (HTML + CSS + JS puro). Cero frameworks (ni React, ni Vue).

Persistencia actual: localStorage y vinculación a un archivo Excel (.xlsx) local.

Usuarios: Dueños de negocio (20-60 años), con experiencia media en software. Usarán la app a diario.
</contexto_global>

Por favor, ejecuta las siguientes 4 fases en orden:

FASE 1: Diseño UI Senior (Gráficos y Estilos)
<contexto_ui>Actualmente uso colores tierra/ladrillo modernos. La tipografía de los títulos es monoespaciada y el cuerpo usa fuentes Serif.</contexto_ui>
<tarea_ui>

Rediseña los gráficos estadísticos. Crea contenedores para 6 gráficos en total que no se superpongan. Deben tener dimensiones fijas y compactas (equivalentes visualmente a unos 120x160 píxeles, simulando tus 3x4 cm).

Estilo: Panel de control industrial y futurista (piensa en un centro de control de gran minería: números resaltantes, alto contraste, cero decoración innecesaria, nada de colores pastel ni estilos de "app de hábitos").

Interactividad: Al hacer clic, los gráficos deben girar 180 grados en 2D manteniendo el eje vertical fijo (efecto flip de tarjeta).

Fondo y visuales: Diseña un fondo de pantalla CSS con temática de "ladrillos con rayos X" (líneas de neón o wireframes). Incluye miniaturas en 3D (usando trucos de sombras CSS).
</tarea_ui>
<formato_ui>Entrégame el código CSS detallado con comentarios técnicos que expliquen cada decisión de diseño.</formato_ui>

FASE 2: UX Research (Flujos y Claridad)
<tarea_ux>

Audita el flujo de los botones de la interfaz (guardar, importar, exportar). Haz que el flujo sea obvio. Ejemplo de problema a evitar: "El usuario presiona un botón y no sabe si la acción guardará en el navegador, importará de un archivo o exportará a un Excel".

Diseña (en concepto y estructura HTML) cómo se debe mostrar la información en las gráficas: cada vértice/punto de la gráfica debe ser interactivo, acompañado de un "tablero adyacente" que resalte el dato más crítico en ese momento.
</tarea_ux>
<formato_ux>Presenta la auditoría y las soluciones de flujo de forma muy profesional y futurista (usa listas y viñetas).</formato_ux>

FASE 3: Desarrollo Frontend Senior (Lógica JS Vainilla)
<tarea_frontend>

Registro de Sesión: Crea una función de "Ingreso de Usuario" que, al hacer clic, registre la hora exacta y el usuario.

Seguridad del Excel: Crea la lógica para registrar qué archivo Excel se modificó antes de cerrar la página, estableciendo un estado que marque ese archivo específico como "inmodificable" (bloqueo lógico desde el frontend para futuros cambios).

Botón Machine Learning (PDF): Propón una arquitectura en JS puro (usando APIs del navegador o fetch a un endpoint si es estrictamente necesario, o librerías CDN ligeras como pdf.js) que permita cargar un PDF, extraer datos necesarios y autocompletar formularios sin repetir datos existentes.
</tarea_frontend>
<estilo_codigo>Las funciones deben tener nombres en español. Los comentarios deben explicar el "POR QUÉ" de la lógica, no el "qué" (ejemplo de tu estilo: actualizarListasAutocompletado). Garantiza que cada botón cumpla un flujo perfecto y sin errores.</estilo_codigo>

FASE 4: Arquitectura Backend (Escalabilidad)
<contexto_backend>El sistema hoy guarda todo en localStorage. Necesito migrar a un sistema donde múltiples personas vean los mismos datos en tiempo real, pero que NO puedan manipularlos (solo lectura para ellos, escritura centralizada).</contexto_backend>
<tarea_backend>
Descompón la solución técnica para hacer esta migración. Asegúrate de explicar cómo la vinculación al Excel seguirá siendo prolija y cómo se mantendrá la seguridad del sistema en este nuevo entorno.
</tarea_backend>
<formato_backend>Entrégame una tabla comparativa exhaustiva (LocalStorage vs. Nueva Arquitectura Real-time) y diagramas conceptuales (en texto/ASCII o descripción clara) sobre cómo debe fluir la información.</formato_backend>


---

# PARTE 2 — prompt_pantalla_diseno.md

Actúa como un equipo de expertos (Diseñador UI Senior, Desarrollador Frontend Senior y Especialista en gráficos 3D web). Necesito que implementes una pantalla de bienvenida (splash screen) con efecto de fractura para mi sistema. Aborda cada fase con el máximo detalle profesional.

<contexto_global>
Proyecto: dashboard de ventas para una empresa ladrillera peruana, llamada "CRF & LADRILLOS S.A.C.".

Stack actual: Vanilla (HTML + CSS + JS puro), sin frameworks. Archivos existentes: index.html, style.css, script.js. Se abre en un servidor local.

REGLA CRÍTICA: NO modificar la interfaz existente. Ni su estructura, ni sus estilos, ni su lógica. Solo se AGREGAN archivos nuevos (splash.js y splash.css) y como máximo una línea <link> y una línea <script> en index.html. La splash es una capa (overlay) que va encima de todo.

Referencia de comportamiento (solo inspiración, NO copiar su código): https://pushmatrix.github.io/tearable/ . Escribe tu propia implementación desde cero.
</contexto_global>

Ejecuta las siguientes 4 fases en orden:

FASE 0: Revisión previa
<tarea_revision>
Antes de escribir código, lee index.html, style.css y script.js. Dime en qué punto exacto conectas la splash sin alterar nada y qué z-index y qué mecanismo usas para que quede por encima de todo. Espera mi visto bueno si detectas algún riesgo.
</tarea_revision>

FASE 1: Diseño visual
<contexto_ui>
Imagen base: una pared de ladrillos estilo caricatura (ladrillos rojizos brillantes con juntas color durazno, filas desfasadas). La imagen NO es un mosaico repetible (su borde derecho no encaja con el izquierdo), así que no se puede usar como patrón directo. Se guarda en assets/pared-ladrillos.png (469×464 px) y contiene 5 ladrillos completos: con ellos se reconstruye la pared, recortándolos de junta a junta.
</contexto_ui>
<tarea_ui>
- La pared ocupa el 100% de la pantalla, armada con los ladrillos de la imagen en filas desfasadas. Cuida que no se vea borrosa en pantallas grandes: usa un tamaño de ladrillo moderado.
- Sobre la pared, en el centro, texto gigante: línea 1 "BIENVENIDO", línea 2 "a CRF & LADRILLOS S.A.C.". El nombre de la empresa NUNCA debe verse pequeño: debe ocupar como mínimo el 80% del ancho de la pantalla en escritorio.
- Tipografía llamativa, nada de fuentes cotidianas. Usa una fuente display gruesa de Google Fonts (elige entre Bowlby One, Titan One, Lilita One o Bungee, la que mejor combine con el estilo caricatura de la pared).
- Letras inclinadas (rotación aproximada de -6° a -8°), con relleno claro cálido (crema o amarillo), contorno oscuro grueso color marrón ladrillo y sombra sólida desplazada que simule volumen 3D.
- El texto va "pintado" sobre la pared y forma parte de la misma textura, de modo que se rompe junto con la pared.
- Una indicación sutil y animada tipo "Jala la pared para entrar" para que el usuario sepa qué hacer.
</tarea_ui>

FASE 2: Interacción y física de fractura
<tarea_fisica>
- Usa three.js (versión reciente, por CDN) con una cámara ortográfica o de perspectiva suave que cubra toda la pantalla.
- Divide la pared en piezas siguiendo la distribución real de ladrillos de la imagen (filas desfasadas), de modo que se rompa por las juntas, ladrillo por ladrillo. Cada pieza lleva su fragmento de la textura, incluidas las letras.
- Al hacer clic y arrastrar sobre un ladrillo, este se despega y sigue el cursor. Mientras más se jala, aparecen grietas visibles y los ladrillos vecinos se agrietan y tiemblan.
- Al superar cierto umbral de jalón, la pared se fractura en cadena desde el punto de agarre. Las piezas caen con gravedad, rotación, rebote y desvanecimiento, en aproximadamente 2 a 3 segundos.
- Al terminar, la splash se elimina del DOM, se libera la memoria de three.js y queda visible mi interfaz intacta y funcional.
- Debe funcionar con mouse y con pantalla táctil (usa pointer events).
- Botón secundario discreto "Entrar" que dispara la misma fractura automáticamente, para quien no quiera arrastrar.
</tarea_fisica>

FASE 3: Robustez
<tarea_robustez>
- Mientras la splash esté activa, bloquea el scroll y las interacciones con la interfaz de atrás.
- Debe verse en cada carga de la página. Deja una constante de configuración al inicio de splash.js para cambiar a "solo una vez por sesión" (sessionStorage) si luego lo quiero.
- Respeta prefers-reduced-motion: en ese caso, sin física, solo un desvanecimiento breve.
- Si WebGL no está disponible o three.js falla al cargar, la splash se omite en silencio y el sistema abre normal. Nunca debe dejar al usuario bloqueado fuera de la interfaz.
- Mantén 60 fps en un equipo de gama media.
</tarea_robustez>
<estilo_codigo>
Las funciones deben tener nombres en español (por ejemplo: crearPiezasDePared, romperPared, retirarSplash). Los comentarios deben explicar el "POR QUÉ" de la lógica, no el "qué". Todos los valores ajustables (umbral de jalón, gravedad, tamaño de mosaico, ángulo del texto, duración) van como constantes al inicio del archivo.
</estilo_codigo>

<entregable>
1. Lista de archivos nuevos y las líneas exactas que se agregan en index.html.
2. Código completo de splash.css y splash.js.
3. Instrucciones para probarlo en mi servidor local y cómo desactivarlo si algo falla.
</entregable>


---

# PARTE 3 — prompt_graficos_medallones.md (rediseño visual de los gráficos)

Actúa como un equipo de expertos (Diseñador UI Senior, Diseñador de Interacción y Desarrollador Frontend Senior). Necesito rediseñar EXCLUSIVAMENTE el aspecto de la sección de gráficos de mi dashboard, al estilo de la galería de tipos de gráfico de https://charts.livegap.com/es/#TypesofCharts . Toma un respiro y aborda cada fase con el máximo nivel de detalle profesional.

<prioridad>
Esta PARTE 3 prevalece sobre la PARTE 1 (FASE 1) SOLO en lo visual del panel de gráficos: tamaño de las tarjetas, colores, estilo y espaciado. Las tarjetas ya no son compactas (120x160 px), ya no son de estilo industrial oscuro y sí pueden usar color. El texto de la PARTE 1 no se modifica.
</prioridad>

<contexto_global>
Es el mismo proyecto de las partes anteriores: dashboard de ventas de "CRF & LADRILLOS S.A.C.", en Vanilla (HTML + CSS + JS puro), con Chart.js 4.4.4 ya cargado por CDN. Los datos salen de los registros guardados (localStorage).

Hoy la sección se llama "Panel de control — Indicadores operativos" (`.control-panel-section`) y tiene 6 tarjetas apretadas (3 cm × 4 cm) con fondo casi negro y acentos cian. Tres de ellas tienen un gráfico miniatura (línea, dona, torta) y las otras tres solo un icono y un texto. Al hacer clic cada tarjeta se voltea y muestra el detalle por detrás.
</contexto_global>

<referencia>
Referencia de estilo y de comportamiento (solo inspiración, NO copiar sus dibujos ni su código; los gráficos se dibujan desde cero con Chart.js):
- Es una galería en 4 columnas en escritorio (3 en tablet, 2 en celular). Cada elemento es un círculo grande (~150 px) con su nombre en negrita debajo, con mucho espacio entre elementos.
- En reposo cada gráfico es de un solo color (gris y negro), enmarcado en un círculo.
- Al pasar el cursor por encima, el gráfico se colorea con varios colores y se anima con suavidad hasta llegar a un estado final. El nombre de abajo cambia de color.
</referencia>

<alcance>
Modifica:
- index.html: SOLO la sección `.control-panel-section`.
- style.css: SOLO el bloque "FASE 1 (UI): PANEL DE CONTROL INDUSTRIAL".
- script.js: SOLO `dibujarMiniChart`, las 6 funciones `actualizarCard*` y el bloque de clic de las tarjetas (donde se agregan los eventos de cursor).

NO toca: la tabla, los modales, el formulario, la barra de acciones, las estadísticas de arriba, la sección "Indicadores clave", la pantalla de bienvenida (splash), los datos, las claves de localStorage ni el Excel.

Debe conservar, sin renombrarlos: las clases `.flip-card`, `.flip-card-inner`, `.flip-card-face`, `.flip-card-front`, `.flip-card-back`, `.is-flipped`, y los id `flipVentasMes`, `flipFormaPago`, `flipTopDeudor`, `flipTopRepresentante`, `flipTopCodigo`, `flipBancos`, `cpVentasMesValor`, `cpFormaPagoValor`, `cpTopDeudorValor`, `cpTopRepresentanteValor`, `cpTopCodigoValor`, `cpBancosValor` y los `cp*Back`.
</alcance>

FASE 3.0: Revisión previa
<tarea_revision>
Antes de escribir código, lee index.html, style.css y script.js. Dime qué partes exactas vas a cambiar y cuáles NO vas a tocar. Espera mi visto bueno si detectas algún riesgo.
</tarea_revision>

FASE 3.1: Diseño y distribución
<tarea_diseno>
- Los 6 gráficos se distribuyen en una cuadrícula que ocupe TODO el ancho disponible, muy espaciada y cómoda de leer: 3 columnas en escritorio (2 filas), 2 columnas en tablet y celular. Nada de tarjetas apretadas.
- Cada elemento es un círculo grande (de unos 130 a 200 px de diámetro, que crece con la pantalla) con el gráfico dentro, el nombre en negrita debajo y el valor principal debajo del nombre.
- Los nombres son claros y completos: "Ventas por mes", "Adelanto vs contado", "Cliente con más deuda", "Mejor vendedor", "Producto más vendido", "Banco / Efectivo".
- COLOR EN REPOSO: en vez del gris de la referencia, todo va en NARANJA ROJO (`#E4451A`, con su versión oscura `#C93A14` y tintas más claras para las porciones). Círculo con borde grueso naranja rojo y gráfico de un solo tono naranja rojo dentro.
- Fondo del panel claro (tono crema muy suave) para que el círculo y el gráfico se lean con alto contraste. El texto es oscuro.
- Los colores viven como variables CSS al inicio del bloque, para poder cambiarlos en un solo lugar.
</tarea_diseno>

FASE 3.2: Interacción al pasar el cursor
<tarea_interaccion>
- Al pasar el cursor por un círculo (o al enfocarlo con el teclado): el círculo crece un poco y sube unos píxeles, el borde se desvanece, el gráfico cambia de naranja rojo a VARIOS COLORES vivos y se dibuja de nuevo con animación (las barras suben, la línea se traza, la dona se llena) hasta llegar a su estado final. El nombre de abajo cambia de color.
- Al retirar el cursor, todo vuelve suavemente al naranja rojo.
- Movimiento suave, en 2D, con duración de 0.5 a 1 segundo. Sin saltos bruscos.
- Respeta prefers-reduced-motion: en ese caso el cambio de color es inmediato y sin animación.
- El clic sigue igual que hoy: voltea la tarjeta y muestra el detalle por detrás. NO cambies ese comportamiento todavía.
</tarea_interaccion>

FASE 3.3: Un gráfico distinto por tarjeta, con datos reales
<tarea_graficos>
Cada círculo tiene su propio tipo de gráfico (como en la galería de referencia), sin ejes ni leyendas dentro del círculo, y con los datos reales de los registros:
1. Ventas por mes: gráfico de línea con área suave (los 12 meses).
2. Adelanto vs contado: gráfico de dona.
3. Cliente con más deuda: barras horizontales (los 3 mayores deudores).
4. Mejor vendedor: barras verticales (los 3 mejores representantes).
5. Producto más vendido: área polar (los 3 códigos más vendidos).
6. Banco / Efectivo: gráfico circular (torta) con la participación de cada entidad.
- Si no hay datos, cada círculo muestra un dibujo de reposo suave con su tipo de gráfico y el valor "—". Nunca debe dar error.
- Si Chart.js no cargó (sin internet), el panel no debe romper nada: se ve el círculo vacío con su nombre.
- El detalle numérico sigue estando por detrás de la tarjeta (al voltearla), pero con letra más grande y legible, acorde al nuevo tamaño.
</tarea_graficos>

<fuera_de_alcance_por_ahora>
FUTURO (NO implementar ahora): al hacer clic en un círculo se abrirá una ventana nueva con más gráficos y detalles según el tema de esa tarjeta. Eso será un módulo posterior. Solo deja un atributo `data-tarjeta` en cada tarjeta (por ejemplo `data-tarjeta="ventas-mes"`) como punto de enganche.
</fuera_de_alcance_por_ahora>

<estilo_codigo>
Las funciones deben tener nombres en español. Los comentarios deben explicar el "POR QUÉ" de la lógica, no el "qué". Los valores ajustables (colores, duraciones, tamaños) van como constantes o variables al inicio.
</estilo_codigo>

<entregable>
1. Lista de archivos modificados y qué se cambió en cada uno (solo las 3 zonas del alcance).
2. El código completo de cada bloque modificado.
3. Cómo probarlo en el servidor local (recordando Ctrl+F5) y cómo volver atrás si algo falla.
</entregable>


---

# PARTE 4 — Ventana "Ventas por mes" (editor de gráfico de líneas)

Actúa como un equipo de expertos (Diseñador UI Senior, Diseñador de Interacción, Desarrollador Frontend Senior y Analista de Datos). Necesito que, al hacer clic en el círculo "Ventas por mes" del panel de control, se abra una ventana que replique el editor de gráfico de líneas de https://charts.livegap.com/v2/app.php?lan=es&gallery=line , alimentada con los datos de mi Excel. Aborda cada fase con el máximo nivel de detalle profesional.

<prioridad>
Esta PARTE 4 completa la PARTE 3: la PARTE 3 define el aspecto de los círculos y esta parte define lo que ocurre al hacer clic en "Ventas por mes". Solo esa tarjeta cambia su clic (abre la ventana); las otras 5 tarjetas siguen volteándose como hasta ahora.
Regla general: NO cambies la función de ningún botón existente de mi programa. Enfócate solo en lo que se pide aquí.
</prioridad>

<referencia>
Referencia de estilo y comportamiento (solo inspiración, NO copiar su código, sus dibujos ni sus archivos; se construye desde cero con el Chart.js que ya está cargado). Lo que tiene ese editor:
- Barra superior: Archivo, Editar, Datos, Vista, Idioma, Temas, Ayuda (más Iniciar sesión e Install, que NO se replican).
- Panel izquierdo con dos pestañas, "Lienzo" y "Formato". Lienzo: tipo de gráfico, tema de colores, tamaño con deslizadores, tipo de letra, color de fondo. Formato: Relleno & Contorno, Datos en gráfico, Leyenda, Conjunto de datos, Punto, Escala, Eje, Cuadrícula, Texto, Anotaciones, Animación, A mano alzada (Pro).
- Centro: vista previa del gráfico (título, subtítulo, meses en el eje, series de colores, cifras sobre los puntos, leyenda) y botones "Compartir" y "Descargar".
- Debajo: tabla de datos "Hoja1" con los meses en las columnas y los años en las filas.
</referencia>

<alcance>
Crea: ventas-mes.js y ventas-mes.css.
Modifica:
- index.html: SOLO 2 líneas (un `<link rel="stylesheet" href="ventas-mes.css">` en el `<head>` y un `<script src="ventas-mes.js"></script>` DESPUÉS de script.js, porque usa la lista de meses que define script.js).
- script.js: SOLO el bloque de clic de las tarjetas (para que "Ventas por mes" llame a `abrirVentasMes()` y, si ese archivo no cargó, se voltee como las demás) y el estilo del gráfico del círculo "Ventas por mes".
- style.css: SOLO la separación de los círculos del panel de control.
NO toca: la tabla, los modales, el formulario, la barra de acciones, los indicadores clave, la pantalla de bienvenida, los datos, las claves de localStorage ni el Excel. La ventana es de SOLO LECTURA sobre los datos.
</alcance>

FASE 4.0: Revisión previa
<tarea_revision>
Antes de escribir código, lee index.html, style.css y script.js. Dime qué partes exactas vas a cambiar y cuáles NO. Espera mi visto bueno si detectas algún riesgo.
</tarea_revision>

FASE 4.1: Ajustes al panel de círculos
<tarea_panel>
- Separación entre círculos un tercio más corta, medida de borde a borde: horizontal de 182 a 121 px y vertical de 241 a 161 px (círculos de 147 px). Los valores viven en un solo lugar de style.css para poder ajustarlos.
- El gráfico dentro del círculo "Ventas por mes" copia el icono "Gráfico de línea" de la referencia: línea gruesa y quebrada (sin curvas) con puntos huecos, con los datos reales. Al pasar el cursor: línea naranja vivo y área bajo la línea en naranja opaco.
</tarea_panel>

FASE 4.2: Diseño de la ventana
<tarea_ventana>
- Ventana a pantalla completa sobre la aplicación. Fondo de temática NARANJA; los paneles en blanco y el texto en negro; los colores fuertes quedan reservados para lo que se grafica (series, puntos, barras).
- Replica TODOS los menús y secciones de la referencia listados arriba, cada uno con función real cuando tenga sentido en mi programa. Lo que no aplica se muestra desactivado con la etiqueta "Próximamente" (Idioma en inglés, "A mano alzada") o no se replica (Iniciar sesión, Install, publicidad, Pro).
- "Compartir" NO sube nada a ningún servidor: copia la imagen del gráfico al portapapeles. "Descargar" guarda la imagen PNG (con fondo opaco). En Archivo también se puede descargar los datos en CSV.
- La tabla "Hoja1" es de solo lectura: viene de mis registros. El botón "+" de hojas aparece desactivado.
- Se cierra con la ✕ o con la tecla Esc. Mientras está abierta, la aplicación de atrás queda inerte (sin scroll ni foco).
</tarea_ventana>

FASE 4.3: Datos y análisis estadístico (desde mi Excel)
<tarea_datos>
- Los datos salen de los registros que ya carga "Importar Excel" (fechaIngreso, montoTotal, unidad, deudaPendiente). Se vuelven a leer cada vez que se abre la ventana, para que siempre reflejen el último Excel. Nunca se modifican.
- Eje horizontal: los 12 meses (enero a diciembre). Una serie (línea) por año presente en los datos (por defecto, los 3 más recientes). Un mes sin registros queda vacío (no se dibuja como cero).
- Eje vertical elegible: monto vendido (S/), unidades vendidas, número de operaciones o deuda pendiente. Por defecto, monto vendido.
- Análisis estadístico del año más reciente seleccionado: total, promedio mensual, mejor mes, peor mes, variación del último mes contra el anterior, tendencia (recta de mínimos cuadrados, como % del promedio por mes), variabilidad (desviación estándar y coeficiente de variación), comparación contra el año anterior usando solo los meses en común, y el Top 3 de meses.
- Estado vacío: si aún no hay ventas, la ventana lo dice con claridad y explica cómo importar el Excel. Nunca da error.
</tarea_datos>

FASE 4.4: Robustez
<tarea_robustez>
- Si Chart.js no cargó, la tarjeta se voltea como las demás y no se rompe nada.
- Respeta prefers-reduced-motion y permite desactivar la animación del gráfico desde la sección "Animación".
- Se adapta a pantallas angostas (el panel de ajustes pasa arriba del gráfico).
</tarea_robustez>

<estilo_codigo>
Las funciones deben tener nombres en español. Los comentarios deben explicar el "POR QUÉ" de la lógica, no el "qué". Los valores ajustables (temas de colores, tamaños, métricas) van como constantes al inicio del archivo.
</estilo_codigo>

<entregable>
1. Lista de archivos nuevos y modificados, con lo que cambió en cada uno (solo las zonas del alcance).
2. Cómo probarlo en el servidor local (recordando Ctrl+F5) y cómo volver atrás si algo falla.
3. Qué se verificó y qué no se pudo verificar.
</entregable>



---

# PARTE 5 — Rediseño completo al estilo "Ladrillera" (modelo de la imagen de referencia)

Actúa como un equipo de expertos (Director de Arte y Diseñador UI Senior, Diseñador de Interacción, Desarrollador Frontend Senior e Ilustrador). Necesito reestructurar TODO el diseño de mi aplicación para que se vea casi igual que la imagen de referencia que te adjunto ("LADRILLERA — Solidez que construye"): muy profesional, con sus fotos e ilustraciones de ladrillos y hojas, y con mis botones y gráficas reubicados en los lugares más cómodos. NO cambies ninguna función: cada botón, menú, formulario, tabla y cálculo conserva su id y hace exactamente lo mismo que hoy. Aborda cada fase con el máximo nivel de detalle profesional.

<prioridad>
Esta PARTE 5 prevalece sobre las PARTES 1 a 4 SOLO en lo visual: paleta, distribución, tipografía e imágenes. Reemplaza los colores azul y naranja anteriores por la paleta cálida de la imagen (terracota, crema, arena y verde hoja). La pantalla de bienvenida (pared de ladrillos) NO cambia. Los 6 círculos de la PARTE 3 y la ventana "Ventas por mes" de la PARTE 4 conservan su funcionamiento y adoptan la nueva paleta.
Regla general: se cambia la ubicación y el aspecto, nunca la función. Los textos y conceptos de la imagen se reemplazan por los de mi negocio (ventas de ladrillos); el diseño se mantiene.
</prioridad>

<contexto_global>
Mismo proyecto de las partes anteriores: registro de ventas de "CRF & LADRILLOS S.A.C.", en Vanilla (HTML + CSS + JS puro) con Chart.js ya cargado por CDN. Los datos salen de `registros` (localStorage / Excel importado) y NUNCA se modifican desde el diseño.
Hoy la página ya tiene un menú lateral, una barra superior y tarjetas (dashboard.css y dashboard.js, versión clara con azul). Esta parte los reemplaza por el nuevo diseño.
</contexto_global>

<referencia_visual>
La imagen adjunta es la guía. Sus zonas, de izquierda a derecha y de arriba abajo:
1. Menú lateral (≈19% del ancho), fondo crema con degradado suave. Arriba, el logo (icono de ladrillos apilados + nombre en mayúsculas + lema "SOLIDEZ QUE CONSTRUYE"). Luego 7 botones con icono de línea: Inicio, Ventas, Productos, Clientes, Pedidos, Reportes y Configuración; el activo es una píldora terracota con texto blanco. Abajo, una fotografía de ladrillos apilados con hojas que sale por el borde inferior, y encima una frase manuscrita ("Cada ladrillo cuenta en grandes proyectos").
2. Cabecera "hero" (≈18% del alto): a la izquierda "Bienvenido al sistema" (pequeño), un título grande en dos líneas y un subtítulo con separador; a la derecha, una fotografía panorámica de un patio de ladrillos con un montacargas que se funde con el fondo crema hacia la izquierda, con una frase manuscrita inclinada encima ("Materializando tus proyectos"). En la esquina superior derecha: un selector de fechas en forma de píldora, una campana con punto rojo y un avatar circular con iniciales.
3. Fila de 5 tarjetas de indicadores: icono circular de color (terracota, marrón, verde, ámbar) + etiqueta en mayúsculas + cifra grande con su unidad + mini gráfica de línea o barras + etiqueta de variación (▲ verde) + nota pequeña.
4. Fila de 3 tarjetas de gráficas: barras agrupadas por trimestre con 3 series y leyenda (≈45% del ancho); dona con un porcentaje grande al centro y una lista de valores a la derecha (≈27%); línea con área suave, línea punteada de referencia y una etiqueta destacada en el último punto (≈27%).
5. Fila inferior: tabla ancha con encabezado de iconos y columna de estado con etiquetas de color (verde "Operacional", ámbar "Mantenimiento", azul "En revisión") (≈66%); y una tarjeta de lista con barras de progreso, porcentaje, meta y variación (≈33%).
6. Pie de página: hojas, lemas y una píldora final con una flecha ("Juntos construimos un mundo más sostenible ›").
Estilo de las tarjetas: esquinas muy redondeadas (≈14 px), fondo crema casi blanco semitransparente, sombra suave, y un encabezado con un icono circular marrón, un título y un subtítulo.
</referencia_visual>

<paleta_y_tipografia>
- Colores (variables CSS al inicio): terracota principal `#A9573F`, terracota oscuro `#8C4633`, marrón de texto `#3B2F2A`, texto secundario `#7A6A60`, crema de fondo `#F6EFE6` con degradado a `#EBDCCB`, tarjeta `#FFFDF9`, arena `#C7A982`, verde hoja `#4E7A4F`, ámbar `#D9A441`. Etiquetas de estado: verde `#E2F1E4` con texto `#2E7D4F`, ámbar `#FBEBC8` con texto `#9A6A10`, azul `#E3F0FB` con texto `#2F6FA8`. El rojo `#C0392B` se reserva SOLO para peligro (borrar, errores, deuda).
- Tipografía: una sans geométrica y limpia para títulos y textos (por ejemplo Poppins u Outfit, con respaldo del sistema) y una fuente manuscrita (por ejemplo Caveat) SOLO para las frases inclinadas. Las cifras grandes van en peso 600.
- Iconos de línea SVG propios (no copiados), trazo de 1.75 px, del mismo estilo en todo el diseño.
</paleta_y_tipografia>

<alcance>
Crea: assets/img/ (fotografías e ilustraciones) y el CSS/JS del nuevo diseño.
Reemplaza: dashboard.css y dashboard.js (el diseño claro con azul de la versión anterior).
Modifica:
- index.html: la estructura del <body> por encima de los modales. Se conservan TODOS los id y las clases que usa script.js (comprobar que ninguno se pierde ni se repite).
- style.css y script.js: SOLO los colores de los círculos y una línea en renderTodo() que ya llama a actualizarDashboard().
- ventas-mes.css y ventas-mes.js: SOLO los colores.
NO toca: los modales, los formularios, la lógica de datos, el Excel, localStorage, la pantalla de bienvenida ni ninguna función de ningún botón.
</alcance>

FASE 5.0: Revisión previa
<tarea_revision>
Antes de escribir código, lee index.html, style.css, script.js, dashboard.css y dashboard.js. Lista todos los id que usa script.js y confirma que ninguno se pierde al reubicar. Haz una copia de seguridad de los archivos que vas a tocar. Dime qué vas a cambiar y qué NO, y espera mi visto bueno si detectas algún riesgo.
</tarea_revision>

FASE 5.1: Sistema de diseño
<tarea_sistema>
Define las variables de paleta, radios, sombras y tipografías, y los componentes reutilizables: tarjeta con encabezado (icono circular + título + subtítulo), etiqueta de estado, píldora, indicador con mini gráfica y barra de progreso. Todo en un solo lugar, cargado después de style.css, para poder revertir el diseño quitando una línea.
</tarea_sistema>

FASE 5.2: Menú lateral
<tarea_menu>
- Logo y nombre "CRF & LADRILLOS S.A.C." con el lema "SOLIDEZ QUE CONSTRUYE", como en la imagen.
- Los 7 botones del modelo, adaptados a mis funciones y usando los mismos id (ver la tabla de distribución de funciones).
- El botón activo es la píldora terracota y cambia con la sección visible al desplazarse.
- Los desplegables se abren hacia abajo dentro del mismo menú, con el mecanismo actual.
- Abajo: la fotografía de ladrillos con hojas y la frase manuscrita.
- En pantallas medianas el menú se reduce a iconos; en celular es un cajón que se abre con un botón ☰.
</tarea_menu>

FASE 5.3: Cabecera hero
<tarea_hero>
- Texto: "Bienvenido al sistema", un título grande de dos líneas (por ejemplo "Control de Ventas / y Despachos") y el subtítulo "Ladrillera · Gestión eficiente, mejores resultados".
- Fotografía del patio con el montacargas fundida con el fondo, y la frase manuscrita "Materializando tus proyectos" encima.
- Arriba a la derecha: el selector de mes con forma de píldora de fechas (reutiliza las pestañas de mes existentes, sin duplicar su lógica) y el avatar con las iniciales del nombre escrito en el campo "Tu nombre (para el historial)", que conserva su id. Como las pestañas de mes de mi programa juntan todos los años en un mismo mes, el rótulo escribe el año solo si los datos son de un único año; si hay varios dice "todos los años".
- Los dos indicadores de estado (Excel automático y Carpeta de facturas XML, con sus id) van dentro del menú lateral, justo debajo del botón al que pertenecen, para no recargar la cabecera.
</tarea_hero>

FASE 5.4: Fila de 5 indicadores (con mis datos reales)
<tarea_indicadores>
Ventas del mes (S/) con variación contra el mes anterior; unidades vendidas; deuda pendiente con su porcentaje; ticket promedio; y operaciones del mes. Cada tarjeta lleva su mini gráfica calculada con las mismas funciones que ya usa la app. Sin datos, muestran "—" y nunca dan error.
</tarea_indicadores>

FASE 5.5: Fila de gráficas
<tarea_graficas>
- Barras agrupadas: ventas por trimestre para los 3 ladrillos (códigos) más vendidos, con leyenda.
- Dona: cobros por entidad (bancos y efectivo) con el porcentaje cobrado al centro y la lista de valores a la derecha.
- Líneas: evolución mensual de la deuda pendiente, con área suave, una línea punteada con el PROMEDIO calculado (no se inventan metas) y una etiqueta destacada en el último punto.
</tarea_graficas>

FASE 5.6: "Mis gráficos", indicadores clave y fila inferior
<tarea_inferior>
Orden de las secciones de la página, de arriba abajo: cabecera, 5 indicadores, fila de 3 gráficas, "Mis gráficos", "Indicadores clave del negocio", fila inferior y pie de página.
- "Mis gráficos": los 6 círculos de la PARTE 3, con sus animaciones al pasar el cursor y su clic (la ventana "Ventas por mes" de la PARTE 4), como una franja propia dentro de una tarjeta, con la nueva paleta. NO se elimina ninguno.
- "Indicadores clave del negocio": se conservan y se MEJORAN (ver FASE 5.6b).
- Fila inferior: a la izquierda la tabla ancha de registros con TODAS sus columnas y acciones (mismos id), con el encabezado y las etiquetas de estado de la imagen (Adelanto / Al contado, deuda), desplazable en horizontal; a la derecha una tarjeta de lista con barras de progreso, "Ladrillos cerámicos más vendidos", con el código, el % de las unidades, las unidades, el precio promedio y la variación contra el mes anterior. Solo información de ladrillos cerámicos, calculada con mis ventas, sin cifras inventadas.
</tarea_inferior>

FASE 5.6b: Indicadores clave del negocio, mejorados
<tarea_indicadores_clave>
Hoy son 3 tarjetas: tamaño de venta (ticket promedio), variación contra el mes anterior y racha de ventas. NO se eliminan y NO cambia ningún cálculo; se mejora cómo se presentan, en diseño y en claridad:
- Un título en lenguaje simple como pregunta o frase corta ("¿Cuánto vendo por venta?", "¿Vendo más o menos que el mes pasado?", "¿Cuántos días seguidos vengo vendiendo?"), con el nombre técnico más pequeño debajo.
- Una cifra grande y una etiqueta de estado de color (verde bien, ámbar regular, rojo cuidado) que diga de un vistazo cómo va.
- Una frase corta que explique qué significa la cifra, sin términos técnicos.
- Una mini gráfica en cada tarjeta (por ejemplo, los últimos 6 meses) o una barra de avance.
- Los datos de detalle en una lista ordenada y con etiquetas claras; los avisos de "pocos registros" como una nota discreta.
- La misma estética de la imagen (tarjeta redondeada, icono circular en el encabezado, paleta terracota, crema y verde).
</tarea_indicadores_clave>

FASE 5.7: Pie de página
<tarea_pie>
Franja con hojas, el lema "Solidez que construye", el nombre de la empresa y la píldora final "Juntos construimos obras más sólidas ›". Los textos son estáticos y fáciles de cambiar.
</tarea_pie>

FASE 5.8: Imágenes e ilustraciones
<tarea_imagenes>
- NO se crean ni se descargan fotografías nuevas. Las imágenes son recortes de la propia imagen de referencia que yo te doy (van en assets/img/): el patio de ladrillos con montacargas (cabecera, con desvanecido hacia la izquierda) y los ladrillos apilados con hojas (parte inferior del menú lateral). Se recortan solo las zonas que no tienen letras ni botones dibujados encima. Como la imagen es pequeña, se cuida que no se vea pixelada: tamaño de exhibición moderado y desvanecidos suaves. Si algún día tengo mis fotos, se reemplaza solo el archivo.
- Ilustraciones SVG propias: hojas (menú, pie de página), icono del logo (ladrillos apilados) y los iconos de línea.
- Cada imagen lleva texto alternativo, carga diferida y un tamaño optimizado. Si una imagen no carga, el diseño no se rompe: queda el color de fondo.
- Las frases manuscritas son texto real (no imagen) para poder editarlas.
</tarea_imagenes>

FASE 5.9: Distribución de funciones (en los lugares más cómodos)
<tarea_distribucion>
Cada botón conserva su id y su función; solo cambia su lugar:
| Sección del menú | Qué agrupa |
|---|---|
| Inicio | Cabecera, indicadores, gráficas y selector de mes |
| Ventas | Nuevo registro (btnNuevo), la tabla de registros y sus acciones |
| Productos | Tarjeta de ladrillos cerámicos más vendidos |
| Clientes | "Mis gráficos": los 6 círculos, con cliente con más deuda y mejor comprador |
| Facturas | Importar carpeta de facturas XML (btnActivarCarpetaFacturas) y Escanear ahora (btnEscanearAhora) |
| Reportes | El desplegable "Más acciones" COMPLETO: Importar Excel, Exportar mes, Exportar todo el año, Historial y Borrar todos los datos (en rojo); además los indicadores clave y la ventana "Ventas por mes" |
| Configuración | Excel automático (btnActivarSync) y el desplegable "Caja de seguridad" COMPLETO (crear y restaurar copia) |
Los desplegables "Más acciones" y "Caja de seguridad" se conservan enteros (con sus id y contenido) porque script.js los conecta por id: no se dividen ni se duplican.
</tarea_distribucion>

FASE 5.10: Robustez
<tarea_robustez>
- Si Chart.js no cargó o falta una imagen, el diseño sigue funcionando.
- Si una tarjeta falla, las demás siguen funcionando.
- Se adapta a pantalla completa, tablet y celular; las imágenes decorativas se ocultan en celular.
- Respeta prefers-reduced-motion. Contraste suficiente para leer todo.
</tarea_robustez>

<estilo_codigo>
Funciones con nombres en español. Los comentarios explican el "POR QUÉ". Colores, tamaños y textos ajustables como variables o constantes al inicio.
</estilo_codigo>

<entregable>
1. Archivos nuevos y modificados, con lo que cambió en cada uno.
2. Comprobación de que TODOS los id de script.js siguen existiendo y de que cada botón funciona igual.
3. Cómo probarlo (recordando Ctrl+F5) y cómo volver atrás.
4. Qué se verificó y qué no se pudo verificar.
</entregable>



---

# PARTE 6 — Ajustes de detalle sobre el diseño "Ladrillera"

Actúa como el mismo equipo de expertos de la PARTE 5. Estos ajustes ya están aplicados en el programa; si se vuelve a construir el diseño desde cero, deben respetarse.

<prioridad>
Esta PARTE 6 prevalece sobre la PARTE 5 en los puntos que menciona. NINGUNA función cambia: cada botón, menú, tabla y cálculo conserva su id y hace lo mismo que antes.
</prioridad>

<ajustes>
- Logo: imagen circular del toro con "CRF" (assets/img/logo-crf.png), recortada solo en la parte a color y con fondo transparente, junto al nombre "CRF & LADRILLOS". El lema "Solidez que construye" NO aparece en ninguna parte (ni en el logo ni en el pie de página).
- Cabecera: sin campo para poner el nombre y sin la frase manuscrita "Materializando tus proyectos". Solo queda el selector de mes sobre la foto del patio. El campo #inputAutorSesion se conserva OCULTO (no se puede eliminar porque script.js lo usa); mientras esté vacío, el historial anota al autor como "Sin nombre".
- Orden de la página, de arriba abajo: cabecera, 5 indicadores del mes, "Registro del mes" (la tabla a todo lo ancho, porque el objetivo es registrar el mes), las 3 gráficas, "Mis gráficos" (los 6 círculos), "Indicadores clave del negocio", "Ladrillos cerámicos más vendidos" (a lo ancho, con la lista en columnas) y el pie de página.
- Pie de página: sin hojas ni lemas. Quedan "CRF & LADRILLOS S.A.C." y "Gestión de ventas", y un botón "Vista de usuario" que lleva a vista-usuario.html, una página reservada ("Próximamente", con "Volver al sistema") para construir después lo que verá el usuario o comprador.
- Menú lateral ordenado por temas: arriba el botón grande "＋ Nuevo registro"; luego Principal (Inicio, Registro del mes, Productos, Clientes); Facturas y boletas (Importar carpeta XML, Escanear ahora y el estado de la carpeta); Reportes (Indicadores clave y el desplegable "Más acciones" completo); Configuración (Excel automático con su estado y el desplegable "Caja de seguridad" completo). Cada grupo lleva su título en letras pequeñas. Los desplegables se conservan enteros porque script.js los conecta por id.
- Textos: donde decía "facturas" ahora dice "facturas y boletas" (botón, indicador de estado y avisos), porque la carpeta XML también recibe boletas.
- Se conserva el diseño, los colores (terracota, crema, arena y verde), las formas y las tipografías de la PARTE 5.
</ajustes>

<entregable>
1. Archivos nuevos y modificados, con lo que cambió en cada uno.
2. Comprobación de que TODOS los id de script.js siguen existiendo y de que cada botón funciona igual (crear, editar y borrar un registro; cambiar de mes; desplegables; historial; círculos y ventana "Ventas por mes").
3. Cómo probarlo (recordando Ctrl+F5) y cómo volver atrás.
4. Qué se verificó y qué no se pudo verificar (los selectores de archivo de Excel automático y de la carpeta XML piden permiso del usuario).
</entregable>



---

# PARTE 7 — Pantalla de bienvenida "Ladrillo holográfico" y ajustes de marca (versión ACTUAL del sitio)

Actúa como el mismo equipo de expertos de las partes anteriores, ahora con especialista en three.js y motion graphics.

<prioridad>
Esta PARTE 7 REEMPLAZA por completo la pantalla de bienvenida descrita en la PARTE 2 (pared de ladrillos que se fractura) y la frase "La pantalla de bienvenida (pared de ladrillos) NO cambia" de la PARTE 5. Todo lo demás del sitio (PARTES 3, 4, 5 y 6) se mantiene tal cual. NINGUNA función del programa cambia: cada botón, menú, tabla, cálculo, id y desplegable hace lo mismo que antes. La bienvenida es una capa independiente (splash.js + splash.css) que no lee ni modifica script.js, style.css ni la app.
</prioridad>

## 7.A — Ajustes de marca en la interfaz

<ajustes_interfaz>
- Menú lateral, arriba a la izquierda: el nombre dice **"CRF & LADRILLOS S.A.C."** (con S.A.C.).
- Pie de página: en lugar del escudito, un **toro dibujado solo con su contorno**, en naranja (`#E2702F`), sin fondo ni la parte naranja del medallón, del mismo alto que el escudo (50×26 px). Sale del contorno del logo (`assets/img/logo-crf.png`) convertido en una máscara `assets/img/toro-contorno.png`, y se pinta con CSS (`mask`).
</ajustes_interfaz>

## 7.B — Pantalla de bienvenida (al cargar el programa)

<escena>
Fondo oscuro (casi negro con un resplandor cálido central) con un **ladrillo holográfico en 3D que gira**, en **naranja eléctrico**, con el estilo de un tablero de datos futurista (referencia: globo holográfico con números, red de líneas y código de fondo). En vez del planeta esférico, la geometría es la de un ladrillo real; el estilo es el mismo.

El ladrillo es el protagonista y debe verse elegante, "construido geométricamente pero transparente", como una radiografía:
- Proporción de ladrillo King Kong (largo 3,6 · alto 1,08 · ancho 1,8 unidades).
- Superficie de cristal naranja muy tenue con red de nodos conectados, zonas brillantes y números diminutos; miles de puntos luminosos sobre la superficie; contorno brillante.
- Las **18 perforaciones** (3 filas de 6) dibujadas como cilindros de alambre que lo atraviesan.
- **Cotas** de plano técnico con su medida (24 cm, 12 cm, 7 cm).
- Un **plano de escáner** que sube y baja atravesándolo.
- Las caras internas de los cortes quedan invisibles con el ladrillo entero (así se ve transparente y no saturado).

Alrededor, todo en 3D y girando con el ladrillo (no exagerado):
- ~34 **números flotantes** unidos al ladrillo por líneas finas con un nodo en el extremo. Los valores son propios de un ladrillo y de ventas: medidas (24.0, 11.5, 9.0), pesos, precios (S/ 0.85), resistencia (180), cantidades (1200), porcentajes (38%, +12.4), etc.
- Una **red de nodos y líneas** (plexus) y una cáscara de puntos punteada alrededor.
- Dos anillos finos que orbitan.

Al fondo (no giran con el ladrillo, solo se deslizan despacio): paneles de **código** relacionado con ladrillos y ventas (`const ladrillo = {...}`, `function venta(cant, precio)`, `struct Ladrillo`, `stock -= cantidad`, `return despacho.estado == "ENTREGADO"`…), columnas de letras verticales (STOCK, PEDIDO, FACTURA, DESPACHO…), barras grises y lluvia de dígitos.

Paleta: naranja eléctrico `#FF6A13`, naranja claro `#FFA347`, casi blanco cálido `#FFE2B5` para los puntos calientes. Mezcla aditiva (brillo tipo holograma). NO hay ninguna barra o mancha amarilla vertical.

Sin textos, botones ni indicaciones en pantalla.
</escena>

<interaccion>
- Jalar = clic sostenido y arrastre en cualquier parte de la pantalla (umbral: 17 % del lado menor, mínimo 130 px).
- Mientras se jala, la estructura se **tensa**: gira más rápido, vibra y aparecen **rajaduras luminosas** cuanto más se jala. Si se suelta antes del umbral, se calma.
- Al cruzar el umbral se rompe (se comprueba en el propio evento del puntero, para que un jalón rápido no falle).
- Teclado (Enter, Espacio o Esc): rompe directamente. Es la salida de emergencia; no se muestra ninguna indicación.
- `prefers-reduced-motion`: sin escena 3D, solo el mensaje de bienvenida.
</interaccion>

<rotura>
1. **Destello** y temblor de cámara.
2. Durante ~0,4 s se ven las **rajaduras marcadas** sobre el ladrillo entero. Las grietas siguen exactamente los cortes internos, así parecen reales y continuas entre trozos.
3. El ladrillo se parte en ~30 **trozos irregulares** de cristal con aristas luminosas. La rotura cruza toda la estructura en ~0,5 s desde el centro.
4. Todo lo demás se desprende y **cae con gravedad y giro**: red, cáscara, anillos, cotas, perforaciones, números con sus líneas y los paneles de código.
5. Todo se apaga (fade) entre 1,8 s y 2,8 s después de la rotura.
6. El **fondo oscuro se mantiene**: la interfaz del programa NO se ve en ningún momento hasta que termina el mensaje de bienvenida.
</rotura>

<mensaje_final>
Cuando todo terminó de caer (≈2,9 s tras la rotura) aparece **solamente**: **CRF & LADRILLOS S.A.C.**
- Tipografía **Montserrat seminegrita (600)**, letras separadas (`letter-spacing: 0.16em`), sobria y corporativa.
- Relleno **rojo-naranja suave** (`#FF8A66`).
- **Contorno fino dorado-amarillo** (`#F3C94F`, ~0,075 em) en cada letra, solo por fuera, con un halo dorado muy tenue. Se logra con una copia del texto detrás (`::before` con `-webkit-text-stroke`), para que funcione en cualquier navegador.
- Ancho ≈ 66 % de la pantalla; en pantallas verticales se parte en tres líneas (CRF & / LADRILLOS / S.A.C.).
- **Animación "de menos a más"**: el nombre viene desde el fondo. Empieza muy pequeño (escala 0,10) y se acerca y agranda hasta 1,04 en **un solo movimiento continuo** (curva `cubic-bezier(0.16, 0.62, 0.3, 1)`, sin cortes ni tirones). La transparencia (0,8 s) y el desenfoque (1 s, de 7 px a 0) entran aparte, al comienzo.
- Duración total **2,5 s**; en los últimos 0,3 s todo se desvanece suavemente y se entra al sistema. Un instante después la capa se elimina y se libera la memoria 3D.
</mensaje_final>

<tecnica>
- three.js 0.182 cargado con `import()` dinámico desde jsdelivr. Cámara en perspectiva, renderizador con alpha.
- `splash.js` se carga desde el `<head>` para que la capa cubra la pantalla desde el primer instante; `index.html` conserva la app inerte (`body.inert`) mientras la splash está encima.
- Medir el área visible con `documentElement.clientWidth/Height` (no `innerWidth`).
- En pantallas altas (móvil) el conjunto se encoge para que quepa entero.
- Materiales compartidos y con opacidad global para que el fade sea barato; texturas de caras y grietas generadas por código en canvas; los trozos comparten las texturas con UV continuas.
- Cargar la imagen/fuente sin `img.decode()` (se cuelga en pestañas en segundo plano). Red de seguridad: si en 9 s no hay escena lista, se abandona la splash.
- Configuración editable al inicio de `splash.js` (colores, umbrales, tiempos, gravedad).
</tecnica>

<entregable>
1. Archivos nuevos y modificados, con lo que cambió en cada uno (`splash.js`, `splash.css`, `index.html`, `dashboard.css`, `assets/img/toro-contorno.png`).
2. Comprobación de que TODOS los `id` de `script.js` siguen existiendo y de que los botones funcionan igual (Nuevo registro, desplegables, etc.) después de la bienvenida.
3. Cómo probarlo (recordando **Ctrl+F5**) y cómo volver atrás.
4. Qué se verificó y qué no se pudo verificar (la vista previa integrada se congela en la rotura y falla al capturar; las animaciones se verifican midiendo valores).
</entregable>
