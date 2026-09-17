# Funciones que se usan en este proyecto (explicado fácil)

Guía pensada para alguien que recién empieza a programar. Primero lo básico, después las funciones propias del proyecto, y al final las funciones "de fábrica" de JavaScript que el proyecto usa mucho.

## ¿Qué es una función?

Una función es **una receta con nombre**. Le das algunos datos (ingredientes) y ella hace un trabajo y, a veces, te devuelve un resultado.

```js
function sumar(a, b) {
  return a + b;
}

sumar(2, 3); // → 5
```

Ventaja: escribes la receta una vez y la usas todas las veces que quieras, sin repetir código.

En este proyecto hay dos tipos de funciones:

1. **Funciones propias** — las escribió quien hizo la app, tienen nombres en español (`guardarRegistros`, `formatearMoneda`, etc.).
2. **Funciones integradas de JavaScript** — ya vienen listas en el lenguaje o el navegador (`addEventListener`, `map`, `JSON.stringify`, etc.). El proyecto solo las usa.

---

## 1. Funciones propias del proyecto (33 en total)

Agrupadas por lo que hacen. No hace falta memorizarlas, solo tener una idea de para qué sirve cada grupo.

### Guardar y cargar datos

| Función | Qué hace, en simple |
|---|---|
| `cargarRegistros()` | Al abrir la página, trae los datos guardados en el navegador. |
| `guardarRegistros()` | Guarda todos los registros en el navegador. |
| `generarId()` | Inventa un código único para cada registro nuevo (como un DNI para cada fila). |

### Fechas y formato de texto

| Función | Qué hace, en simple |
|---|---|
| `mesDeFecha(fecha)` | De una fecha, saca "¿qué mes es?" (0 = enero, 1 = febrero...). |
| `anioDeFecha(fecha)` | De una fecha, saca el año. |
| `formatearFecha(fecha)` | Convierte `2026-09-10` en `10/09/2026` para que se vea bonito. |
| `formatearMoneda(numero)` | Convierte `1500` en `S/ 1,500.00`. |
| `registrosDelMes(mes)` | Filtra y devuelve solo los registros de un mes elegido. |
| `anioPredominante()` | Adivina cuál es "el año principal" de tus datos (el que más se repite). |

### Autocompletado (sugerencias mientras escribes)

| Función | Qué hace, en simple |
|---|---|
| `actualizarListasAutocompletado()` | Arma la lista de sugerencias (clientes, bancos, etc.) según lo que ya escribiste antes. |

### Excel automático (guardar en un archivo real del computador)

| Función | Qué hace, en simple |
|---|---|
| `soportaExcelAutomatico()` | Pregunta: "¿este navegador puede escribir archivos directo al disco?" |
| `abrirBaseDeDatosHandles()` | Abre un cajón especial del navegador (IndexedDB) donde se guarda "qué archivo Excel elegiste". |
| `guardarHandleEnDB(handle)` | Guarda en ese cajón el archivo Excel que elegiste. |
| `obtenerHandleDeDB()` | Recupera el archivo Excel que habías elegido antes. |
| `actualizarBadgeSync(activo)` | Prende o apaga el aviso verde "Excel automático: activo". |
| `actualizarExcelAutomatico()` | Reescribe el Excel vinculado con los datos más recientes. |
| `activarExcelAutomatico()` | Te deja elegir un archivo Excel para vincular. |
| `intentarReanudarExcelAutomatico()` | Al abrir la página, revisa si ya tenías un Excel vinculado de antes. |

### Dibujar la pantalla (render)

| Función | Qué hace, en simple |
|---|---|
| `renderTabs()` | Dibuja las 12 pestañas de los meses. |
| `renderStats()` | Dibuja las tarjetas con totales del mes. |
| `renderTablaHead()` | Dibuja el encabezado (títulos) de la tabla. |
| `renderTablaBody()` | Dibuja las filas de la tabla con los registros. |
| `renderTodo()` | Llama a las 4 anteriores juntas, para refrescar toda la pantalla de una vez. |

### El formulario de "Nuevo / Editar registro"

| Función | Qué hace, en simple |
|---|---|
| `abrirModalNuevo()` | Abre el formulario vacío para cargar una venta nueva. |
| `editarRegistro(id)` | Abre el formulario ya lleno con los datos de una venta para corregirla. |
| `cerrarModalRegistro()` | Cierra el formulario. |
| `eliminarRegistro(id)` | Borra una venta (pidiendo confirmación primero). |
| `recalcularMontoTotal()` | Mientras escribes, calcula solo: unidad × precio = monto total. |

### Avisos (toasts)

| Función | Qué hace, en simple |
|---|---|
| `mostrarToast(mensaje, tipo)` | Muestra ese cartelito que aparece abajo a la derecha ("Registro guardado", etc.). |

### Excel — armar, exportar e importar

| Función | Qué hace, en simple |
|---|---|
| `construirHojaExcel(lista)` | Convierte una lista de registros en una hoja de Excel lista para guardar. |
| `descargarLibro(wb, nombre)` | Descarga el archivo Excel al computador. |
| `exportarMesExcel()` | Descarga solo los datos del mes que estás viendo. |
| `exportarTodoExcel()` | Descarga los 12 meses del año en un solo archivo. |
| `normalizarEncabezado(texto)` | Limpia un título de columna (minúsculas, sin espacios raros) para poder compararlo. |
| `mapearFilasImportadas(filas, encabezados)` | Cuando importas un Excel, acomoda cada columna en el campo correcto. |
| `convertirValorFecha(valor)` | Convierte una fecha que viene de Excel al formato que usa la app. |
| `cerrarModalImportar()` | Cierra la ventana de "¿agregar o reemplazar datos?". |

---

## 2. Funciones/métodos de JavaScript que usa el proyecto

Estas no las escribió el autor del proyecto: **ya vienen con el navegador o con el lenguaje**. Aprenderlas te sirve para cualquier proyecto futuro, no solo este.

### Para hablar con la página (el DOM)

- **`document.getElementById("algo")`** — busca un elemento por su `id` y te lo devuelve, para poder leerlo o cambiarlo. Es la función más usada en todo `script.js`.
- **`document.querySelectorAll(".algo")`** — busca *todos* los elementos que tengan esa clase.
- **`elemento.addEventListener("click", funcion)`** — le dice al navegador: "cuando hagan clic (o `"input"`, `"submit"`, `"change"`, `"keydown"`) en este elemento, ejecuta esta función". Así reacciona la app cuando el usuario hace algo.
- **`elemento.innerHTML = "..."`** — reemplaza el contenido visual de un elemento. Así se "dibuja" la tabla y las estadísticas.

### Para trabajar con listas de datos (arrays)

El proyecto guarda todas las ventas en una lista (`registros`). Para recorrerla usa:

- **`.filter(...)`** — se queda solo con los elementos que cumplen una condición. Ejemplo: `registrosDelMes` usa `filter` para quedarse solo con las ventas de un mes.
- **`.map(...)`** — transforma cada elemento de la lista en otra cosa. Ejemplo: convertir cada registro en una fila de tabla.
- **`.reduce(...)`** — junta toda la lista en un solo valor. Ejemplo: sumar el `montoTotal` de todos los registros del mes para la estadística.
- **`.forEach(...)`** — recorre la lista y hace algo con cada elemento, sin devolver nada nuevo. Ejemplo: revisar cada registro para armar las sugerencias de autocompletado.
- **`.sort(...)`** — ordena la lista. Ejemplo: ordenar las ventas por fecha antes de mostrarlas.
- **`.find(...)`** — busca y devuelve el primer elemento que cumple una condición. Ejemplo: encontrar el registro con un `id` específico para editarlo.

### Para guardar datos

- **`localStorage.setItem("clave", texto)`** / **`localStorage.getItem("clave")`** — guarda y lee texto directamente en el navegador, aunque cierres la pestaña.
- **`JSON.stringify(objeto)`** — convierte datos de JavaScript (objetos, listas) en texto, para poder guardarlos.
- **`JSON.parse(texto)`** — hace lo contrario: convierte texto guardado de vuelta en datos que JavaScript puede usar.

### Para números y texto

- **`parseFloat("12.5")`** — convierte texto en número decimal. Se usa mucho porque los `input` del formulario siempre entregan texto.
- **`Number(valor)`** — convierte cualquier valor a número.
- **`(numero).toFixed(2)`** — redondea un número a 2 decimales y lo deja como texto (`10` → `"10.00"`).
- **`texto.trim()`** — quita espacios de más al principio y al final de un texto.
- **`texto.toLowerCase()`** — pasa un texto a minúsculas.

### Asincronía (cosas que tardan, como elegir un archivo)

- **`async function...` / `await`** — se usan para tareas que no son instantáneas, como esperar a que el usuario elija un archivo Excel o a que el navegador termine de escribirlo en el disco. `await` significa "esperá a que esto termine antes de seguir".
- **`try { ... } catch (error) { ... }`** — intenta hacer algo y, si falla, "atrapa" el error en vez de romper toda la app. Por ejemplo, al leer un Excel dañado.

---

## Para seguir aprendiendo

Un buen orden para entender este proyecto de a poco:

1. Empieza por `formatearMoneda` y `formatearFecha` ([script.js:99-109](script.js:99)) — son cortas y fáciles.
2. Sigue con `recalcularMontoTotal` ([script.js:481](script.js:481)) — verás un cálculo real (unidad × precio).
3. Después mira `guardarRegistros` y `cargarRegistros` ([script.js:57-75](script.js:57)) — para entender cómo se guarda todo.
4. Por último, `renderTablaBody` ([script.js:361](script.js:361)) — es más larga, pero ahí se junta casi todo lo anterior.
