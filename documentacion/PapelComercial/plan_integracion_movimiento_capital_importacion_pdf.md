# Plan de Implementación: Integración Contable (`movimiento_capital` y Tablas Relacionadas) en la Importación PDF

## 1. Diagnóstico y Validación de Factibilidad

### 1.1. ¿Es factible actualizar `movimiento_capital` al importar un PDF?
**Sí, es 100% factible y nativo a la arquitectura actual de SIPRO.**
Al analizar el código existente en [`InversionController::store()`](file:///c:/PROYECTOS/SIPRO_07/backend/app/Http/Controllers/API/InversionController.php#L128-L129), cuando registras manualmente una inversión por formulario, el sistema dispara el evento:
```php
event(new InversionCreada($inversion));
```
Este evento ejecuta el listener [`CrearMovimientoCompraInversion`](file:///c:/PROYECTOS/SIPRO_07/backend/app/Listeners/CrearMovimientoCompraInversion.php), que inserta automáticamente el asiento contable de egreso en la tabla `movimiento_capital`. Sin embargo, en [`InversionPdfImportService::confirm()`](file:///c:/PROYECTOS/SIPRO_07/backend/app/Services/InversionPdfImportService.php#L361) se guardaba la inversión con `$inversion->save()` sin disparar dicho evento.

### 1.2. Estructura del Registro en `movimiento_capital`
Al confirmar cada PDF de compra (Nota de Crédito o Papel Comercial), el registro que debe crearse en `movimiento_capital` sigue exactamente el estándar de tus registros actuales (ej. movimientos `#373` y `#429`–`#434`):

| Campo | Valor Asignado | Origen / Regla de Negocio |
| :--- | :--- | :--- |
| `fecha_movimiento` | `$inversion->fecha_compra` | Fecha de liquidación/negociación del PDF |
| `id_tipo_movimiento` | `181` | Catálogo `COMPRA_INVERSION` (`COM_INV`) |
| `id_persona` | `$inversion->id_propietario` | Titular comitente (`1` Jhon, `2` Cristian, `3` Isabel, `5` Argentina) |
| `id_signo` | `191` | Catálogo `NEGATIVO` (`-`, salida de efectivo en Casa de Valores) |
| `monto` | `$inversion->capital_invertido` | Costo total neto pagado (Efectivo + Comisión Bolsa + Comisión Casa de Valores) |
| `id_inversion` | `$inversion->id_inversion` | Llave foránea hacia la inversión recién insertada |
| `descripcion` | Según tipo de título | • Nota de Crédito: `"Compra Nota de Crédito"`<br/>• Papel Comercial: `"Compra de Papel Comercial YYYY-MM-DD"` |
| `conciliado` | `0` (`false`) | Queda pendiente de conciliación en el módulo de Movimientos de Capital |
| `activo` / `eliminado` | `1` / `0` | Activo y vigente |

> [!IMPORTANT]
> **Refinamiento detectado en la descripción de Notas de Crédito**:
> El instrumento genérico de Notas de Crédito (`id_instrumento = 222`, `SRI 2034-12-31`) tiene como fecha referencial `2034-12-31`. Actualmente `CrearMovimientoCompraInversion::generarDescripcionCompra()` concatenaría `"Compra de Nota de Crédito 2034-12-31"`. Ajustaremos ese método para que cuando el tipo sea `NOTCR` (`id_tipo_inversion = 91`) genere limpiamente **`"Compra Nota de Crédito"`**, tal como están registrados tus movimientos `#423` y `#429`–`#434`.

---

## 2. Evaluación de Otras Tablas del Sistema (Auditoría de las 53 Tablas de `sipro_desa`)

Revisamos todas las tablas y procedimientos almacenados del sistema para determinar si alguna otra tabla debe actualizarse cuando se compra una **Nota de Crédito** o un **Papel Comercial**:

| # | Tabla / Objeto | Estado Actual en Importación PDF | ¿Requiere Acción? | Justificación Técnica |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **`inversion`** | ✅ Implementada | **No (Ya lista)** | Registra la operación con su liquidación, valores nominales, comisiones y propietario. |
| **2** | **`instrumento`** | ✅ Implementada | **No (Ya lista)** | Asocia el instrumento `222` (SRI) para Notas de Crédito o busca/crea el instrumento corporativo para Papel Comercial. |
| **3** | **`amortizacion`** | ✅ Implementada | **No (Ya lista)** | 0 cuotas para Notas de Crédito; 1 cuota al vencimiento (`id_estado_amortizacion = 134`) para Papel Comercial Cero Cupón. |
| **4** | **`movimiento_capital`** | ⚠️ **Falta en Importador PDF** | **SÍ (Prioridad Alta)** | Registra el egreso (`COM_INV`, signo `-`) que descuenta el saldo disponible del comitente en Santa Fe Casa de Valores. |
| **5** | **`otro_valor`** *(Fondos en Santa Fe)* | ⚠️ **Sincronización manual hoy** | **SÍ (Recomendado)** | En `otro_valor` se almacenan los rubros **"Fondos en Santa Fe"** de cada persona (`142` Argentina, `143` Cristian, `144` Isabel, `145` Jhon) que alimentan el rubro `Total Corriente` en **Patrimonio Consolidado** y el **Dashboard**. Hoy ese saldo solo se recalcula en el frontend cuando entras a *Otros Valores* y guardas un registro (`actualizarSaldosPorPersona()`). Si actualizamos automáticamente en el backend el saldo de `otro_valor` del propietario tras registrar el `movimiento_capital`, el **Dashboard** y **Patrimonio Consolidado** reflejarán de inmediato la disminución del efectivo en Santa Fe sin pasos manuales. |
| **6** | **`cache`** *(Caché de Patrimonio)* | ⚠️ **Sin invalidación tras compra** | **SÍ (Recomendado)** | `PatrimonioController` almacena en la tabla `cache` el resultado del procedimiento `SP_PATRIMONIO_CONSOLIDADO`. Limpiar la caché al confirmar una importación garantiza que los reportes muestren los nuevos saldos al instante. |
| **7** | **`documento_inversion`** | ℹ️ Tabla vacía en BD | **No necesario** | Aunque existe la estructura en BD, el sistema no almacena PDFs físicos en servidor (la trazabilidad ya queda en `inversion.observacion` y `inversion.liquidacion`). |

---

## 3. Flujo Integral Propuesto al Confirmar Importación PDF

```mermaid
flowchart TD
    A["Usuario confirma importación en<br/>Carga Liquidaciones PDF"] --> B["InversionPdfImportService::confirm()<br/>(Dentro de DB::transaction)"]
    
    B --> C["1. Tabla 'instrumento'<br/>Resuelve o crea instrumento"]
    C --> D["2. Tabla 'inversion'<br/>Inserta la compra del título"]
    
    D --> E{"¿Es Papel Comercial?"}
    E -->|Sí (Tipo 3)| F["3. Tabla 'amortizacion'<br/>Inserta 1 cuota al vencimiento"]
    E -->|No (Nota Crédito Tipo 91)| G["Omite 'amortizacion'"]
    
    F --> H["4. Evento InversionCreada<br/>Tabla 'movimiento_capital'<br/>Inserta COMPRA_INVERSION (181) con signo NEGATIVO (191)"]
    G --> H
    
    H --> I["5. Tabla 'otro_valor'<br/>Recalcula y actualiza el saldo 'Fondos en Santa Fe'<br/>de la persona propietaria"]
    I --> J["6. Tabla 'cache'<br/>Invalida caché de Patrimonio Consolidado"]
```

---

## 4. Plan de Trabajo Paso a Paso

### Fase 1: Actualización de `CrearMovimientoCompraInversion` (Backend)
1. En [`CrearMovimientoCompraInversion.php`](file:///c:/PROYECTOS/SIPRO_07/backend/app/Listeners/CrearMovimientoCompraInversion.php):
   * Ajustar `generarDescripcionCompra($inversion)` para que cuando el tipo de inversión sea `NOTCR` (`id_tipo_inversion == 91`), retorne `"Compra Nota de Crédito"` (sin la fecha ficticia `2034-12-31`), manteniendo `"Compra de Papel Comercial YYYY-MM-DD"` para Papeles Comerciales.
   * Verificar que no se duplique un movimiento si ya existiera uno para el mismo `id_inversion` e `id_tipo_movimiento = 181`.

### Fase 2: Sincronización Automática de Saldo en Santa Fe (`otro_valor`)
1. Crear un método reutilizable (ej. en un servicio o dentro del flujo de `MovimientoCapital`) que recalcule el saldo acumulado en Casa de Valores para un `id_persona` (sumando movimientos `POSITIVO = 190` y restando `NEGATIVO = 191` activos de esa persona en `movimiento_capital`) y actualice automáticamente el registro correspondiente en `otro_valor`:
   * `id_persona = 1` (Jhon) $\rightarrow$ `id_tipo_otro_valor = 145` (`SANTA FE JHON`)
   * `id_persona = 2` (Cristian) $\rightarrow$ `id_tipo_otro_valor = 143` (`SANTA FE CRISTIAN`)
   * `id_persona = 3` (Isabel) $\rightarrow$ `id_tipo_otro_valor = 144` (`SANTA FE ISABEL`)
   * `id_persona = 5` (Argentina) $\rightarrow$ `id_tipo_otro_valor = 142` (`SANTA FE ARGENTINA`)

### Fase 3: Integración en `InversionPdfImportService` y Limpieza de Caché
1. En [`InversionPdfImportService::confirm()`](file:///c:/PROYECTOS/SIPRO_07/backend/app/Services/InversionPdfImportService.php):
   * Disparar `event(new InversionCreada($inversion))` inmediatamente después de `$inversion->save()`.
   * Actualizar el saldo de `otro_valor` para los propietarios involucrados en el lote importado.
   * Limpiar la caché de reportes (`Cache::flush()` o invalidación de claves de patrimonio).
   * Incluir en la respuesta JSON de confirmación el `id_movimiento_capital` generado para mostrarlo en el resumen de importación.

### Fase 4: Visibilidad en Frontend (Angular)
1. En [`movimiento-capital-list.component.ts`](file:///c:/PROYECTOS/SIPRO_07/frontend/src/app/modules/movimientos-capital/movimiento-capital-list/movimiento-capital-list.component.ts):
   * Ajustar `loadInversiones()` para que pase `{ incluir_notas_credito: true }`, de modo que el selector/filtro de inversiones en la pantalla de **Movimientos de Capital** liste también las Notas de Crédito junto con los Papeles Comerciales y Bonos.
2. En [`importar-pdf.component.html`](file:///c:/PROYECTOS/SIPRO_07/frontend/src/app/modules/notas-credito/importar-pdf/importar-pdf.component.html):
   * Indicar en la alerta de confirmación que, además de la inversión (y amortización en Papel Comercial), se registrará automáticamente el egreso en **Movimientos de Capital**.
