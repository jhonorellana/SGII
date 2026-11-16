# Plan de Implementación: Módulo Independiente de Importación Automática de PDFs de Renta Variable (Acciones)

## 1. Objetivo y Justificación Arquitectónica

Implementar una opción dedicada dentro del módulo de **Renta Variable** (`/renta-variable/importar-pdf`) para la carga masiva y automática de expedientes PDF firmados de **Operaciones de Acciones (`ACC` — Compras y Ventas)** de la **Bolsa de Valores de Quito (BVQ)** y de la **Bolsa de Valores de Guayaquil (BVG)**.

### ¿Por qué una opción separada de Renta Fija?
1. **Modelo de Datos Independiente:** Renta Variable registra sus transacciones en `accion_operacion` (y no en `inversion` ni `amortizacion`), maneja un único `Socio (id_persona)` y actualiza automáticamente la posición consolidada (`vw_accion_posicion`) y `movimiento_capital` a través de `AccionOperacionObserver`.
2. **Columnas de Previsualización Específicas:** El usuario necesita validar *Tipo de Operación (`Compra` / `Venta`), Fecha de Negociación, Fecha Valor, Emisor / Código Vector (`BLD`, `BVQ`, `PRE`, `GYL`), Cantidad de Acciones, Precio Unitario (US$), Valor Bruto (US$), Comisión Bolsa, Comisión Operador y Valor Neto (US$)*, sin campos de Renta Fija (plazos, tasas, vencimientos ni tablas de amortización).
3. **Flujo Natural en Renta Variable:** Se integra en el menú lateral bajo **Renta Variable -> Carga Liquidaciones PDF** y además con un botón directo **"Importar PDF"** en la cabecera del listado de **Operaciones de Renta Variable** (`operacion-list.component.html`).

---

## 2. Reglas de Negocio y Mapeo de Datos (Renta Variable — `ACC`)

### 2.1. Detección y Extracción desde los PDFs (BVQ y BVG)
1. **Identificación de Renta Variable (`ACC`):**
   * **Página 1 (Orden SFV):** `Tipo de Documento: ACCIONES`, `Código SEB: ACC`, `Tipo de Renta: Variable`.
   * **Página 9 (Liquidación Oficial BVQ):** `Tipo: Acciones`, `Cod. Vector: <TICKER>` (`BLD`, `BVQ`, `PRE`, etc.), `Compra N0. XXXXX - VADXX` (o `Venta N0.`).
   * **Página 9 (Liquidación Oficial BVG):** `Títulos: ACCIONES`, `Operación No: XXXXXXX`.

2. **Tipo de Operación (`id_tipo_operacion`):**
   * **Compra (`204` — `COMPRA_ACCION`):** Cuando el documento indica `Operación: Compra` / `LIQUIDACION PREVIA DE COMPRA RENTA VARIABLE` / `Total Comprador`.
     * Fórmula: $\text{Valor Neto} = \text{Valor Bruto} + \text{Comisión Bolsa} + \text{Comisión Operador}$.
   * **Venta (`205` — `VENTA_ACCION`):** Cuando el documento indica `Operación: Venta` / `LIQUIDACION PREVIA DE VENTA RENTA VARIABLE` / `Total Vendedor`.
     * Fórmula: $\text{Valor Neto} = \text{Valor Bruto} - \text{Comisión Bolsa} - \text{Comisión Operador}$.

3. **Fechas (`fecha_operacion` y `fecha_valor`):**
   * En la base de datos de SIPRO (`accion_operacion`), el campo `fecha_operacion` almacena históricamente la **Fecha de Cierre / Fecha de Negociación** de la bolsa (`2026-09-23`, `2026-09-24`, `2026-09-22`, `2026-08-05`).
   * El parser extraerá tanto `fecha_operacion` (*Fecha de Cierre* en BVQ / *Fecha de Negociación* en BVG) como `fecha_valor` (*Fecha Valor*), proponiendo `fecha_operacion` como fecha principal editable en la previsualización.

4. **Normalización del Número de Liquidación (`liquidacion`):**
   * **En BVQ:** Se normalizará al formato estándar registrado en `accion_operacion`: `24815_02 - VAD20`, `24885_01 - VAD07`, `24961 - VAD16`, `21164 - VAD08` (con espacios alrededor del guion).
   * **En BVG:** Número de operación directo (`3752452`, `375105`, `3723541`).
   * **Detección de Duplicados:** Se comparará en `accion_operacion` (`activo = 1 AND eliminado = 0`) ignorando espacios (`REPLACE(liquidacion, ' ', '') = REPLACE(?, ' ', '')`) para detectar con exactitud si una liquidación ya fue cargada previamente.

5. **Resolución Automática de Emisor (`emisor`) e Instrumento (`instrumento` con `id_tipo_inversion = 203`):**
   * En SIPRO, cada acción tiene un único instrumento perpetuo con `id_tipo_inversion = 203` (`ACNPI` — *Acción sin pago interés*), `fecha_vencimiento = '2034-12-31'`, `tasa_referencial = 1.00000000` y `codigo_titulo_vector = 'ACC <EMISOR>'`.
   * El servicio resolverá el emisor e instrumento mediante:
     1. **Mapeo de Tickers / Nombres conocidos** (ej. `BLD` / `BANCO BOLIVARIANO` $\rightarrow$ `id_instrumento = 224`; `BVQ` / `BOLSA DE VALORES DE QUITO` $\rightarrow$ `id_instrumento = 240`; `PRE` / `PRODUBANCO` / `BANCO DE LA PRODUCCION` $\rightarrow$ `id_instrumento = 98`; `GYL` / `BANCO GUAYAQUIL` $\rightarrow$ `id_instrumento = 192`; `BANCO PICHINCHA` $\rightarrow$ `id_instrumento = 194`; `BANCO DEL AUSTRO` $\rightarrow$ `id_instrumento = 117`; `LA FAVORITA` $\rightarrow$ `id_instrumento = 196`; `CRIDESA` $\rightarrow$ `id_instrumento = 221`).
     2. **Búsqueda difusa en `emisor` e `instrumento` (`id_tipo_inversion = 203`).**
     3. **Auto-creación en confirmación:** Si se compra una acción de un emisor nuevo que aún no tiene instrumento `203`, el sistema creará automáticamente el Emisor (si no existe) y su Instrumento `203` (`codigo_titulo = 'INV_73_20341231_<SIGLA>'`, `fecha_emision = fecha_operacion`, `fecha_vencimiento = '2034-12-31'`, `tasa_referencial = 1.00`, `codigo_titulo_vector = 'ACC <SIGLA>'`).

6. **Integración Contable Automática (`movimiento_capital`):**
   * Al crear el registro mediante `AccionOperacion::create(...)`, el observer existente [`AccionOperacionObserver.php`](file:///c:/PROYECTOS/SIPRO_07/backend/app/Observers/AccionOperacionObserver.php) **genera automáticamente** el movimiento en `movimiento_capital` (`id_tipo_movimiento = 181 COM_INV` con signo negativo `191` para compras, o `182 VEN_INV` con signo positivo `190` para ventas, por `monto = valor_neto`) y actualiza `id_movimiento_capital` en `accion_operacion`.
   * El usuario podrá elegir mediante un switch en la pantalla (`Registrar Movimiento de Capital en Bancos`, activo por defecto) si desea que se genere el movimiento de capital o si desea omitirlo en cargas históricas.

---

## 3. Componentes a Desarrollar / Modificar

### Fase 1: Backend (Laravel)

1. **Nuevo Servicio Parser: [`backend/app/Services/PdfImport/AccionPdfParserService.php`](file:///c:/PROYECTOS/SIPRO_07/backend/app/Services/PdfImport/AccionPdfParserService.php)**
   * Extrae texto de todas las páginas del PDF usando `Smalot\PdfParser\Parser`.
   * Detecta la bolsa (`BVQ` vs `BVG`) y el tipo de operación (`204` Compra vs `205` Venta).
   * Extrae:
     * `comitente_nombre`, `comitente_cedula` (Pág. 1 / Pág. 3 / Pág. 8).
     * `emisor_nombre`, `codigo_vector` (`Cod. Vector` en Pág. 9 BVQ o tabla de Catastro en Págs. 6–7), `codigo_seb` (`ACC`).
     * `liquidacion` (normalizada a `XXXXX_XX - VADXX` en BVQ o número entero en BVG).
     * `fecha_operacion` (Fecha de Cierre / Negociación) y `fecha_valor` (Fecha Valor).
     * `cantidad` (`N° de Acciones o Títulos` / `Cantidad` / `Número de títulos`).
     * `valor_nominal_unitario` y `valor_nominal_total`.
     * `precio_unitario` (en USD, con hasta 6 decimales).
     * `valor_bruto` (`Valor Efectivo`).
     * `comision_bolsa`, `comision_operador`, `total_comisiones`.
     * `valor_neto` (`Total Comprador` / `Total Comprador Neto` / `VALOR TOTAL DE LA COMPRA`).
   * Ejecuta validaciones aritméticas ($\text{Cantidad} \times \text{Precio Unitario} \approx \text{Valor Bruto}$ y $\text{Valor Bruto} \pm \text{Comisiones} = \text{Valor Neto}$).

2. **Nuevo Servicio Orquestador: [`backend/app/Services/PdfImport/AccionPdfImportService.php`](file:///c:/PROYECTOS/SIPRO_07/backend/app/Services/PdfImport/AccionPdfImportService.php)**
   * **`previewFiles(array $files)`:**
     * Procesa múltiples archivos PDF en lote.
     * Resuelve `id_persona` por cédula (`1711323913` $\rightarrow$ Jhon Orellana) o nombre.
     * Resuelve `id_emisor` e `id_instrumento` (`id_tipo_inversion = 203`).
     * Verifica si la `liquidacion` ya existe en `accion_operacion` (`duplicado_bd = true/false`, devolviendo el `id_accion_operacion` existente para advertir al usuario).
     * Si es Venta (`205`), consulta `vw_accion_posicion` para verificar stock disponible.
   * **`confirmImport(array $items, bool $registrarMovimientoCapital = true)`:**
     * Ejecuta en transacción `DB::transaction`.
     * Crea el Emisor e Instrumento `203` si no existían.
     * Crea el registro en `accion_operacion` (si `$registrarMovimientoCapital` es `true`, `AccionOperacionObserver` crea automáticamente el registro en `movimiento_capital`; si es `false`, usa `AccionOperacion::withoutEvents(...)`).
     * Guarda el archivo PDF de respaldo si corresponde y retorna el resumen de operaciones e IDs creados.

3. **Nuevo Controlador y Rutas API:**
   * **[`backend/app/Http/Controllers/API/AccionPdfImportController.php`](file:///c:/PROYECTOS/SIPRO_07/backend/app/Http/Controllers/API/AccionPdfImportController.php):**
     * `POST /api/acciones/importar-pdf/preview`
     * `POST /api/acciones/importar-pdf/confirm`
   * **[`backend/routes/api.php`](file:///c:/PROYECTOS/SIPRO_07/backend/routes/api.php):** Registro de ambos endpoints bajo el grupo de Renta Variable (`acciones/...`).

---

### Fase 2: Frontend (Angular 17 Standalone + PrimeNG)

1. **Servicio Frontend: [`frontend/src/app/core/accion-operacion.service.ts`](file:///c:/PROYECTOS/SIPRO_07/frontend/src/app/core/accion-operacion.service.ts)**
   * Agregar métodos `previewPdfImport(files: File[])` y `confirmPdfImport(items: any[], registrarMovimientoCapital: boolean)`.

2. **Nuevo Componente Independiente: `frontend/src/app/modules/renta-variable/importar-pdf/`**
   * Archivos:
     * `importar-pdf-acciones.component.ts`
     * `importar-pdf-acciones.component.html`
     * `importar-pdf-acciones.component.css`
   * **Funcionalidades de la interfaz:**
     * Zona Drag & Drop para seleccionar múltiples PDFs de Renta Variable (BVQ / BVG).
     * Tarjetas resumen del lote: *Total Archivos, Listos para Importar, Duplicados Detectados, Con Errores, Total Acciones y Monto Total Neto (US$)*.
     * Tabla interactiva de previsualización con columnas específicas de Renta Variable:
       * Selección (`p-tableHeaderCheckbox`), Estado (Listo / Duplicado / Error), Bolsa (`BVQ`/`BVG`), Liquidación, Fecha Operación, Socio, Emisor / Instrumento (`ACC`), Tipo (`Compra`/`Venta`), **Cantidad**, **Precio Unitario ($)**, **Valor Bruto ($)**, **Comisiones ($)**, **Valor Neto ($)** y botón de **Editar Fila** en modal antes de confirmar.
     * Switch `Registrar Movimiento de Capital` (activo por defecto).
     * Botón **"Confirmar e Importar Seleccionados"** y acceso directo para ir a **Operaciones de Renta Variable** o **Portafolio**.

3. **Integración en Rutas, Menú Lateral y Pantalla de Operaciones:**
   * **[`frontend/src/app/app.routes.ts`](file:///c:/PROYECTOS/SIPRO_07/frontend/src/app/app.routes.ts):** Agregar ruta `{ path: 'renta-variable/importar-pdf', component: ImportarPdfAccionesComponent }`.
   * **[`frontend/src/app/layout/sidebar/sidebar.component.ts`](file:///c:/PROYECTOS/SIPRO_07/frontend/src/app/layout/sidebar/sidebar.component.ts):** Agregar en el submenú de `Renta Variable` la opción **`Carga Liquidaciones PDF`** (`icon: 'bi-file-earmark-arrow-up'`, `path: '/renta-variable/importar-pdf'`).
   * **[`frontend/src/app/modules/renta-variable/operaciones/operacion-list.component.html`](file:///c:/PROYECTOS/SIPRO_07/frontend/src/app/modules/renta-variable/operaciones/operacion-list.component.html):** Agregar un botón **`Importar PDF`** junto a *Nueva Operación* que navegue a `/renta-variable/importar-pdf`.

---

## 4. Plan de Pruebas y Verificación

1. **Prueba automatizada de extracción (`preview`) con los 7 PDFs reales de `documentacion/Acciones`:**
   * Verificar que los 4 archivos de **BVQ** (`24815_02 - VAD20`, `24885_01 - VAD07`, `24961 - VAD16`, `21164 - VAD08`) y los 3 archivos de **BVG** (`3752452`, `375105`, `3723541`) extraigan con precisión del 100%:
     * Socio: `Jhon Orellana` (`id_persona = 1`).
     * Instrumentos: `224` (`BOLIVARIANO`), `240` (`BOLSA VALORES DE QUITO`), `98` (`PRODUBANCO`), `192` (`BANCO GUAYAQUIL`).
     * Cantidades, Precios Unitarios, Valores Brutos, Comisiones y Valores Netos idénticos a los registros en `accion_operacion`.
   * Verificar que el detector de duplicados identifique que las 7 liquidaciones ya existen en `accion_operacion` (`ids: 79, 80, 81, 82, 78, 65, 67`).
2. **Prueba transaccional de confirmación (`confirm`) con rollback:**
   * Simular la importación de una operación nueva en una transacción de prueba para comprobar la inserción en `accion_operacion` y la generación automática del registro en `movimiento_capital` vía `AccionOperacionObserver`, revirtiendo al finalizar para mantener limpia la base de datos.
3. **Compilación Frontend (`ng build`):**
   * Verificar que el proyecto Angular compile sin errores de TypeScript ni de plantillas HTML.

