# Cálculos del proyecto — Registro de Ventas (Ladrillos)

Todas las operaciones matemáticas/lógicas que hace la app, con su fórmula y dónde están en el código.

## 1. Monto total de un registro
**Fórmula:** `Monto Total = Unidad × Precio Unitario`

- Se recalcula solo, en vivo, cada vez que cambias "Unidad" o "Precio unitario" en el formulario.
- El resultado se redondea a 2 decimales.
- El campo queda editable por si necesitas ajustarlo a mano después del cálculo automático.

Ubicación: [script.js:481-487](script.js:481) función `recalcularMontoTotal()`.

```js
const unidad = parseFloat(document.getElementById("campoUnidad").value) || 0;
const precio = parseFloat(document.getElementById("campoPrecioUnitario").value) || 0;
document.getElementById("campoMontoTotal").value = (unidad * precio).toFixed(2);
```

## 2. Monto total del mes (estadística)
**Fórmula:** suma del `montoTotal` de todos los registros del mes activo.

Ubicación: [script.js:330](script.js:330) función `renderStats()`.

```js
const montoTotal = lista.reduce((sum, r) => sum + (Number(r.montoTotal) || 0), 0);
```

## 3. Deuda pendiente del mes (estadística)
**Fórmula:** suma del `deudaPendiente` de todos los registros del mes activo.

Ubicación: [script.js:331](script.js:331) función `renderStats()`.

```js
const deudaTotal = lista.reduce((sum, r) => sum + (Number(r.deudaPendiente) || 0), 0);
```

## 4. Cantidad de registros del mes
**Fórmula:** cantidad de elementos del arreglo filtrado por mes.

Ubicación: [script.js:329](script.js:329) función `renderStats()` → `lista.length`.

## 5. Año predominante
Determina qué año mostrar por defecto (para nombrar archivos exportados), contando en cuántos registros aparece cada año y devolviendo el que más se repite (moda).

Ubicación: [script.js:115-123](script.js:115) función `anioPredominante()`.

```js
const conteo = {};
registros.forEach(r => {
  const a = anioDeFecha(r.fechaIngreso);
  conteo[a] = (conteo[a] || 0) + 1;
});
return Object.keys(conteo).sort((a, b) => conteo[b] - conteo[a])[0];
```

## 6. Extracción de mes desde una fecha
**Fórmula:** de una fecha `"YYYY-MM-DD"` se toma la parte del mes y se resta 1 (para índice 0 = enero).

Ubicación: [script.js:86-91](script.js:86) función `mesDeFecha()`.

## 7. Extracción de año desde una fecha
Toma la primera parte (`YYYY`) de la fecha; si no hay fecha, usa el año actual.

Ubicación: [script.js:93-97](script.js:93) función `anioDeFecha()`.

## 8. Formato de moneda
Convierte un número a formato peruano con 2 decimales y prefijo `S/`.

**Fórmula:** `S/ ` + número con separador de miles y 2 decimales fijos (`toLocaleString("es-PE")`).

Ubicación: [script.js:106-109](script.js:106) función `formatearMoneda()`.

## 9. Ancho automático de columnas en Excel
Para cada columna, calcula el largo máximo entre el título y todos los valores de esa columna (las fechas cuentan como 10 caracteres), le suma 2, y lo limita entre 10 y 40 caracteres.

**Fórmula:** `wch = min(max(maxLen + 2, 10), 40)`

Ubicación: [script.js:576-584](script.js:576) dentro de `construirHojaExcel()`.

## 10. Generación de ID único de registro
Combina la marca de tiempo actual (`Date.now()`) en base 36 con 5 caracteres aleatorios en base 36.

**Fórmula:** `"r" + timestamp.toString(36) + random.toString(36).slice(2, 7)`

Ubicación: [script.js:77-79](script.js:77) función `generarId()`.

## 11. Conversión de fecha serial de Excel
Cuando se importa un Excel, si la celda de fecha viene como número serial (formato interno de Excel), se convierte a fecha real usando `XLSX.SSF.parse_date_code()` y se arma el string `YYYY-MM-DD`.

Ubicación: [script.js:719-736](script.js:719) función `convertirValorFecha()`.

## Resumen rápido

| # | Cálculo | Dónde se usa |
|---|---------|--------------|
| 1 | Unidad × Precio Unitario | Monto total de un registro (formulario) |
| 2 | Σ montoTotal del mes | Tarjeta de estadística "Monto total del mes" |
| 3 | Σ deudaPendiente del mes | Tarjeta de estadística "Deuda pendiente del mes" |
| 4 | Conteo de registros | Tarjeta "Registros en [mes]" |
| 5 | Moda de años | Nombre de archivo exportado |
| 6-7 | Parseo de fecha | Filtrado por mes/año |
| 8 | Formato moneda | Toda la interfaz y el Excel |
| 9 | Ancho de columna | Exportación a Excel |
| 10 | ID único | Al crear un registro |
| 11 | Fecha serial → fecha real | Importación desde Excel |
