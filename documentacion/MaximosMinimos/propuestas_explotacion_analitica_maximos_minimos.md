# Propuestas de Nuevos Desarrollos y Explotación Analítica: Historial de Máximos y Mínimos (BVQ 2019–2026)

## 1. Introducción y Contexto de la Base de Datos

Con la estructuración y carga inicial de la tabla **`inversion.maximos_minimos_acciones`**, el ecosistema **SIPRO** ahora dispone de **126.976 registros históricos** que cubren de manera ininterrumpida **1.734 ruedas bursátiles** (septiembre 2019 a noviembre 2026) para **101 nemotécnicos bursátiles y 103 emisores**.

A diferencia de las cotizaciones aisladas, este conjunto de datos ofrece una riqueza cuantitativa única:
1. **Precio de Cierre Oficial:** El valor con el que formalmente concluyó cada jornada.
2. **Bandas Reglamentarias de Fluctuación ($\pm 10\%$):** El precio máximo y mínimo autorizado por la BVQ para la siguiente sesión en títulos líquidos.
3. **Volumen de Formación:** Cantidad de acciones con las que se marcó el precio (`num_acc_ult_cierre`).
4. **Fechas Operativas Disociadas:** Permite contrastar la `fecha_informacion` con la `fecha_ult_negoc`, lo que permite medir empíricamente la **inactividad y latencia de liquidez** de cada acción.

A continuación, se presentan las propuestas de desarrollo técnico y analítico organizadas en cuatro ejes estratégicos.

---

## 2. Eje 1: Visualizaciones y Gráficos Avanzados

### 2.1. Gráfico de Canal Bursátil y Túnel de Cotización (Envelopes $\pm 10\%$)
* **Descripción:** Implementar en el módulo de Renta Variable un gráfico interactivo (Chart.js / ApexCharts) que contraste día por día el precio de cierre real frente al canal de fluctuación autorizado por la BVQ.
* **Componentes visuales:**
  * **Línea continua central (Verde/Azul):** Precio de Cierre real (`precio_cierre`).
  * **Banda superior discontinua (Rojo o Ámbar):** Límite máximo operativo (`precio_maximo`).
  * **Banda inferior discontinua (Verde tenue):** Límite mínimo operativo (`precio_minimo`).
  * **Área sombreada entre bandas:** Representa el túnel regulatorio oficial de la sesión.
  * **Barras de Volumen inferiores:** Cantidad de acciones transadas (`num_acc_ult_cierre`).
* **Valor analítico para el inversor:** Permite detectar de inmediato cuándo una acción cerró en "techo de banda" (señal de presión compradora acumulada sin oferta) o en "suelo de banda" (presión vendedora).

```mermaid
flowchart LR
    A["maximos_minimos_acciones"] --> B["API: /api/renta-variable/canal-precios/{nemotecnico}"]
    B --> C["Gráfico Canal BVQ: Cierre vs [Mín, Máx]"]
    C --> D["Alertas de Tensión de Banda (>95% del límite superior)"]
```

### 2.2. Semáforo Dinámico de Liquidez y Profundidad
* **Métrica calculada:** $\Delta_{\text{inactividad}} = \text{fecha\_informacion} - \text{fecha\_ult\_negoc}$.
* **Visualización:** Badge / Indicador de estado en las tarjetas del Radar:
  * 🟢 **Alta Liquidez:** Negociada en las últimas 48–72 horas.
  * 🟡 **Liquidez Moderada:** Sin transacciones entre 4 y 15 días hábiles.
  * 🔴 **Baja Rotación / Ilíquida:** Más de 15 días sin marcar operaciones.
* **Histograma de Rotación:** Gráfico de distribución de días de inactividad entre negociaciones efectivas para evaluar el riesgo de liquidez al momento de querer salir de una posición.

---

## 3. Eje 2: Modelos Cuantitativos y Proyecciones de Precios Futuros

Teniendo 8 años de precios diarios ($N = 1.734$ sesiones), es posible alimentar modelos estocásticos y estadísticos rigurosos:

### 3.1. Simulación Monte Carlo Acotada por Regulación BVQ
* **Fundamento Matemático:** Modelo de Movimiento Browniano Geométrico (GBM):
  $$S_{t+\Delta t} = S_t \cdot \exp\left( \left(\mu - \frac{\sigma^2}{2}\right)\Delta t + \sigma \sqrt{\Delta t} \cdot Z \right)$$
  Donde:
  * $\mu$: Deriva o retorno medio diario histórico de la acción.
  * $\sigma$: Volatilidad histórica anualizada calculada con la serie 2019–2026.
  * $Z \sim \mathcal{N}(0, 1)$: Variable aleatoria normal estándar.
* **Ajuste Regulatorio Ecuatoriano (Innovación Clave):**
  A diferencia de los modelos para Wall Street, en Ecuador ninguna acción puede variar más de $\pm 10\%$ en un solo día. Por tanto, en cada paso de tiempo simulado $t+1$:
  $$S_{t+1}^{\text{sim}} = \max\left(S_t \cdot 0.90, \, \min\left(S_t \cdot 1.10, \, S_{t+1}^{\text{GBM}}\right)\right)$$
* **Resultado para el Usuario:**
  Un gráfico tipo "abanico" o cono de probabilidad a 30, 60 y 90 días proyectados mostrando:
  * **Percentil 90 (P90 - Escenario Optimista)**
  * **Percentil 50 (P50 - Mediana / Escenario Más Probable)**
  * **Percentil 10 (P10 - Escenario Conservador / Suelo de Seguridad)**

### 3.2. Bandas de Volatilidad Histórica y Estimación de Precios Extremos (VaR)
* **Value at Risk (VaR 95% y 99%):** Determinar la máxima pérdida esperada en 1 mes para una cartera accionaria basado en los peores descensos diarios históricos de la BVQ.
* **Rango de Negociación Esperado a 1 Mes:** Proyección de la banda superior e inferior donde con un 95% de confianza estadística oscilará el precio en las próximas 20 sesiones bursátiles.

---

## 4. Eje 3: Integración Operativa en Pantallas Existentes de SIPRO

| Módulo Actual en SIPRO | Funcionalidad a Incorporar con la Nueva Tabla |
| :--- | :--- |
| **Radar de Oportunidades & Portafolio** (`DividendRadarComponent`) | 1. Mostrar el rango del día: *«Banda hoy: \$178.20 – \$217.80»*.<br>2. Alerta de postura: si el usuario simula una compra fuera de banda, avisar que la BVQ rechazaría la orden.<br>3. Ratio de Proximidad al Mínimo Anual de 52 semanas. |
| **Evolución Acciones** (`EvolucionAccionesComponent`) | 1. Selector de capas en el gráfico: `[ Cierre ]`, `[ Canal BVQ ±10% ]`, `[ Cono Proyección Monte Carlo ]`.<br>2. Selector de horizontes: 1 Año, 3 Años, 5 Años, Todo el Histórico (2019-2026). |
| **Simulador de Inversión y Reinversión** | Contrastar el precio simulado contra la mediana histórica proyectada para advertir sobrevaloración o descuento relativo. |
| **Generador de Mensajes IA (ChatGPT)** | Enriquecer el contexto analítico del prompt: *"Produbanco cotiza a \$198.00 con un rango autorizado para mañana de \$178.20 a \$217.80, habiendo cerrado 3 días consecutivos con tendencia alcista."* |

---

## 5. Eje 4: Hoja de Ruta de Implementación Propuesta (Fases)

```mermaid
flowchart TD
    subgraph Fase1 ["Fase 1: Backend APIs y Consultas (Corto Plazo)"]
        A1["Endpoint API: Serie Histórica Cierre + Bandas BVQ por Nemotécnico"]
        A2["Cálculo en Backend de Volatilidad Anualizada (sigma) y Retornos"]
        A3["Algoritmo de Proyección Monte Carlo Acotado (+/-10%)"]
    end

    subgraph Fase2 ["Fase 2: Gráfico Interactivo de Canales (Frontend)"]
        B1["Componente Gráfico en Evolución Acciones (Chart.js Line + Fill)"]
        B2["Toggle para mostrar/ocultar Bandas Máximas y Mínimas"]
        B3["Selector de período: 3M, 6M, 1A, 3A, Histórico"]
    end

    subgraph Fase3 ["Fase 3: Proyecciones Futuras y Simulación"]
        C1["Capa visual de Cono de Proyección a 30, 60 y 90 días"]
        C2["Métricas P10, P50 y P90 en el modal del Simulador"]
        C3["Alertas de Oportunidad cuando el precio roza el suelo reglamentario"]
    end

    Fase1 --> Fase2
    Fase2 --> Fase3
```

---

## 6. Ejemplo de Respuesta del Nuevo Endpoint Propuesto

### `GET /api/renta-variable/acciones/{codigo_seb}/canal-historico?periodo=1y`
```json
{
  "success": true,
  "emisor": "PRODUBANCO",
  "codigo_seb": "PCD",
  "fecha_inicio": "2025-11-20",
  "fecha_fin": "2026-11-19",
  "total_sesiones": 248,
  "volatilidad_anualizada_pct": 14.85,
  "retorno_acumulado_pct": 8.20,
  "dias_sin_negociacion_actual": 0,
  "proyeccion_30d": {
    "escenario_pesimista_p10": 184.50,
    "escenario_base_p50": 199.20,
    "escenario_optimista_p90": 215.80
  },
  "series": [
    {
      "fecha": "2026-11-19",
      "precio_cierre": 198.00,
      "precio_maximo": 217.80,
      "precio_minimo": 178.20,
      "num_acciones": 23.00,
      "es_liquido": 1
    }
  ]
}
```

---

## 7. Conclusión
La nueva tabla `maximos_minimos_acciones` posiciona a **SIPRO** a la vanguardia de las herramientas bursátiles en Ecuador, permitiendo pasar de un enfoque puramente descriptivo (lo que pasó) a un enfoque **prescriptivo y predictivo** (lo que puede cotizar dentro de los límites legales de la bolsa).
