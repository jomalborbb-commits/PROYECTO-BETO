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
