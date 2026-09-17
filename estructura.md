# Estructura del proyecto — Registro de Ventas (Ladrillos)

Aplicación web de una sola página (sin backend) para registrar ventas de una ladrillera: fechas, cliente, forma de pago, producto/montos y deuda. Guarda todo en el navegador (`localStorage`) y permite exportar/importar/sincronizar con Excel.

## Archivos

```
PROYECTO BETO/
├── index.html   → estructura visual (HTML)
├── style.css    → estilos (CSS)
└── script.js    → lógica y datos (JavaScript)
```

No usa frameworks. Solo depende de una librería externa vía CDN: **SheetJS (xlsx.full.min.js)** para leer/escribir archivos Excel.

## index.html

| Sección | Qué contiene |
|---|---|
| `<header class="topbar">` | Título de la app, indicador de "Excel automático" y botones de respaldo (exportar/restaurar JSON) |
| `.sync-banner` | Aviso para reanudar la sincronización automática con Excel de una sesión anterior |
| `<nav class="month-tabs">` | Pestañas de los 12 meses (se llenan por JS) |
| `<section class="stats">` | Tarjetas de estadísticas del mes (se llenan por JS) |
| `<section class="toolbar">` | Botones: nuevo registro, activar Excel automático, importar Excel, exportar mes, exportar año |
| `<section class="table-wrap">` | Tabla de registros del mes (encabezado y filas se llenan por JS) |
| `#modalRegistro` | Modal con el formulario de alta/edición de un registro, dividido en 5 bloques: Fechas, Cliente y representante, Forma de pago, Producto y montos, Notas |
| `#modalImportar` | Modal de decisión al importar un Excel (agregar o reemplazar datos del mes) |
| `.toast-container` | Contenedor de notificaciones flotantes |

## style.css

Organizado en bloques comentados, en este orden:

1. **Tokens** (`:root`) — colores, tipografías, radios y sombra base
2. **Encabezado** (`.topbar`)
3. **Botones** (`.btn`, variantes: primary, accent, outline, ghost)
4. **Pestañas de mes** (`.month-tabs`, `.month-tab`)
5. **Estadísticas** (`.stats`, `.stat-card`)
6. **Barra de acciones** (`.toolbar`)
7. **Tabla** (`table`, `thead`, `tbody`, badges de estado)
8. **Modales** (`.modal-overlay`, `.modal`, `.form-grid`, `.form-section`)
9. **Toasts** (`.toast-container`, `.toast`)
10. **Responsive** (`@media max-width: 900px`)
11. **Accesibilidad** (`focus-visible`, `prefers-reduced-motion`)

## script.js

Organizado en bloques comentados, en este orden:

1. **Configuración y estado** — clave de `localStorage`, lista de `MESES`, definición de `COLUMNAS` (orden exacto de campos para tabla/Excel/importación), variables de estado (`registros`, `mesActual`, `idEnEdicion`, etc.)
2. **Control central de modales** — asegura que nunca haya dos modales abiertas a la vez
3. **Persistencia (localStorage)** — cargar y guardar registros
4. **Utilidades de fecha / mes / formato** — parseo de fechas, formato de moneda
5. **Memoria de recomendación (autocompletado)** — sugiere valores usados antes en cada campo, ordenados por frecuencia
6. **Excel automático (File System Access API)** — vincula un archivo `.xlsx` real que se reescribe solo con cada cambio (solo navegadores Chromium)
7. **Render** — pestañas de mes, estadísticas, encabezado y cuerpo de la tabla
8. **Modal Nuevo/Editar registro** — abrir, cargar datos, guardar, eliminar, recálculo automático del monto total
9. **Toasts** — notificaciones flotantes
10. **Excel — construcción de hojas (SheetJS)** — arma la hoja con encabezados, autofiltro, fila congelada, formato de moneda/fecha y ancho de columnas
11. **Excel — exportar mes / año** — genera y descarga el libro `.xlsx`
12. **Excel — importar** — lee un `.xlsx`, mapea columnas a los campos internos y decide si agregar o reemplazar
13. **Copia de seguridad (JSON)** — exportar/restaurar todos los datos como archivo `.json`
14. **Inicio** — carga inicial de registros y primer render al abrir la página

## Modelo de datos de un registro

Cada registro (objeto en el arreglo `registros`, ver [script.js:13-29](script.js:13)) tiene estos campos:

| Campo (clave interna) | Tipo | Descripción |
|---|---|---|
| `id` | texto | identificador único generado por la app |
| `fechaIngreso` | fecha | fecha en que se registra la venta |
| `fechaFacturacion` | fecha | fecha de facturación |
| `representante` | texto | representante de ventas |
| `cliente` | texto | cliente o razón social |
| `entidadBancaria` | texto | banco o "efectivo" |
| `numeroOperacion` | texto | número de operación bancaria |
| `rucDni` | texto | RUC o DNI del cliente |
| `numeroFactura` | texto | número de factura/boleta |
| `adelantoContado` | texto | "Al contado" o "Adelanto" |
| `unidad` | número | cantidad de unidades vendidas |
| `precioUnitario` | moneda | precio por unidad |
| `montoTotal` | moneda | unidad × precio unitario |
| `codigoLadrillo` | texto | código del producto |
| `deudaPendiente` | moneda | monto que el cliente aún debe |
| `observaciones` | texto | notas libres |

## Cómo guardar tu trabajo, paso a paso

Aquí hay dos cosas distintas que se "guardan", y conviene no confundirlas:

### 1. Guardar el código (cuando tú editas index.html, style.css o script.js)

Cada vez que hagas un cambio en el código, sigue este orden:

1. Edita el archivo (`index.html`, `style.css` o `script.js`).
2. **Guarda el archivo** (`Ctrl + S` en tu editor). Sin este paso, el navegador sigue viendo la versión anterior.
3. Recién ahí, recarga la página en el navegador para ver el cambio.

Regla simple: **después de cada paso que hagas en el código, guarda el archivo antes de probarlo.**

### 2. Guardar los datos (cuando usas la app: agregar, editar, borrar registros)

Esto lo hace la app sola, no tienes que hacer nada extra:

- Cada vez que presionas **"Guardar registro"**, **"Eliminar"**, o importas un Excel, la app llama automáticamente a la función `guardarRegistros()` ([script.js:67](script.js:67)), que escribe todo en la memoria del navegador (`localStorage`).
- Esa memoria vive solo en ese navegador y ese computador. Si limpias el caché/datos del navegador, se pierde.

### 3. Copias de seguridad reales (para no perder nada)

Como el paso 2 solo guarda dentro del navegador, es buena costumbre hacer copias reales de vez en cuando:

- **📤 Exportar respaldo** (arriba a la derecha) → descarga un archivo `.json` con todos tus datos.
- **📊 Exportar mes / Exportar todo el año** → descarga un Excel con tus registros.
- **🔗 Activar Excel automático** → si lo activas una vez, cada registro que agregues/edites/borres se guarda solo también en un archivo Excel real de tu computador (no solo en el navegador).

## Flujo de datos general

```
localStorage  ←→  registros[]  ←→  render (tabla, tabs, stats)
                       │
                       ├──→ Exportar mes / año  → archivo .xlsx descargado
                       ├──→ Excel automático     → archivo .xlsx vinculado en disco
                       ├──→ Respaldo             → archivo .json descargado
                       └──→ Importar Excel/JSON  → agrega o reemplaza registros
```
